// Active project state.
//
// Storage strategy (post Task 3.1):
//   • ctx / passed / stale  -> localStorage (small, instantly available)
//   • artifacts             -> IndexedDB `liveArtifacts` table (write-through)
//
// On app start `hydrateProject()` must be called once; it loads artifacts
// from IDB into memory and migrates any legacy `FLIL.project.artifacts` blob
// previously kept in localStorage.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ArtifactMap, NodeArtifact, ProjectContext, SourceChunk, StageId } from '../pipeline/types';
import {
  db,
  liveArtifactsAll,
  liveArtifactsBulkPut,
  liveArtifactsClear,
  liveRefinementUndoClear,
  type LiveArtifact,
} from './db';

export interface ProjectStore {
  ctx: ProjectContext;
  artifacts: ArtifactMap;
  passed: Record<string, boolean>;     // user explicitly clicked 『通过』 on this nodeId
  stale: Record<string, boolean>;      // upstream changed → needs re-run
  /** True after artifacts have been hydrated from IDB on app start */
  hydrated: boolean;
  setCtx: (patch: Partial<ProjectContext>) => void;
  // 改编原作块管理
  addSourceChunk: (chunk: Omit<SourceChunk, 'id' | 'ts'>) => void;
  updateSourceChunk: (id: string, patch: Partial<SourceChunk>) => void;
  removeSourceChunk: (id: string) => void;
  reorderSourceChunks: (ids: string[]) => void;
  clearSourceChunks: () => void;
  upsertArtifact: (a: NodeArtifact) => void;
  overrideArtifactContent: (nodeId: string, content: string) => void;
  clearArtifact: (nodeId: string) => void;
  clearStage: (stageId: StageId) => void;
  // Mark this nodeId and all downstream (within same stage by index) as stale.
  invalidateFrom: (stageId: StageId, fromIndex: number) => void;
  setPassed: (nodeId: string, value: boolean) => void;
  resetAll: () => void;
}

const DEFAULT_CTX: ProjectContext = {
  name: '默认项目',
  concept: '仙侠爱情短剧',
  durationMin: 5,
  mode: '从零创作',
  createMode: 'original',
};

function nid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const useProject = create<ProjectStore>()(
  persist(
    (set) => ({
      ctx: DEFAULT_CTX,
      artifacts: {},
      passed: {},
      stale: {},
      hydrated: false,
      setCtx: (patch) => set((s) => ({ ctx: { ...s.ctx, ...patch } })),
      addSourceChunk: (chunk) => set((s) => {
        const list = s.ctx.source?.chunks ?? [];
        const next: SourceChunk = { ...chunk, id: nid(), ts: Date.now() };
        return { ctx: { ...s.ctx, source: { chunks: [...list, next] } } };
      }),
      updateSourceChunk: (id, patch) => set((s) => {
        const list = (s.ctx.source?.chunks ?? []).map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        );
        return { ctx: { ...s.ctx, source: { chunks: list } } };
      }),
      removeSourceChunk: (id) => set((s) => {
        const list = (s.ctx.source?.chunks ?? []).filter((c) => c.id !== id);
        return { ctx: { ...s.ctx, source: { chunks: list } } };
      }),
      reorderSourceChunks: (ids) => set((s) => {
        const map = new Map((s.ctx.source?.chunks ?? []).map((c) => [c.id, c]));
        const list = ids.map((id) => map.get(id)).filter(Boolean) as SourceChunk[];
        return { ctx: { ...s.ctx, source: { chunks: list } } };
      }),
      clearSourceChunks: () => set((s) => ({ ctx: { ...s.ctx, source: { chunks: [] } } })),
      upsertArtifact: (a) => {
        // Write-through to IDB; failure logged but never blocks UI.
        db.liveArtifacts.put(toLiveArtifact(a)).catch((e) =>
          console.warn('[project] liveArtifacts.put failed:', e),
        );
        set((s) => {
          const stale = { ...s.stale }; delete stale[a.nodeId];
          return { artifacts: { ...s.artifacts, [a.nodeId]: a }, stale };
        });
      },
      overrideArtifactContent: (nodeId, content) => {
        const state = useProject.getState();
        const cur = state.artifacts[nodeId];
        if (!cur) return;
        const next: NodeArtifact = { ...cur, content, ts: Date.now() };
        db.liveArtifacts.put(toLiveArtifact(next)).catch((e) =>
          console.warn('[project] liveArtifacts.put failed:', e),
        );
        set((s) => ({ artifacts: { ...s.artifacts, [nodeId]: next } }));
      },
      clearArtifact: (nodeId) => {
        db.liveArtifacts.delete(nodeId).catch((e) =>
          console.warn('[project] liveArtifacts.delete failed:', e),
        );
        set((s) => {
          const arts = { ...s.artifacts }; delete arts[nodeId];
          const passed = { ...s.passed }; delete passed[nodeId];
          const stale = { ...s.stale }; delete stale[nodeId];
          return { artifacts: arts, passed, stale };
        });
      },
      clearStage: (stageId) => {
        // Bulk delete from IDB asynchronously
        db.liveArtifacts.where('stageId').equals(stageId).delete().catch((e) =>
          console.warn('[project] liveArtifacts clear stage failed:', e),
        );
        set((s) => {
          const next: ArtifactMap = {};
          const passed = { ...s.passed };
          const stale = { ...s.stale };
          for (const [k, v] of Object.entries(s.artifacts)) {
            if (v.stageId !== stageId) next[k] = v;
            else { delete passed[k]; delete stale[k]; }
          }
          return { artifacts: next, passed, stale };
        });
      },
      invalidateFrom: (stageId, fromIndex) =>
        set((s) => {
          const stale = { ...s.stale };
          const passed = { ...s.passed };
          for (const [, v] of Object.entries(s.artifacts)) {
            if (v.stageId === stageId && v.index >= fromIndex) {
              stale[v.nodeId] = true;
              delete passed[v.nodeId];
            }
          }
          return { stale, passed };
        }),
      setPassed: (nodeId, value) =>
        set((s) => {
          const passed = { ...s.passed };
          if (value) passed[nodeId] = true;
          else delete passed[nodeId];
          return { passed };
        }),
      resetAll: () => {
        liveArtifactsClear().catch((e) =>
          console.warn('[project] liveArtifactsClear failed:', e),
        );
        // v4 阶段 2.6 · 项目重置同步清空润色撤销栈
        liveRefinementUndoClear().catch((e) =>
          console.warn('[project] liveRefinementUndoClear failed:', e),
        );
        set({ ctx: DEFAULT_CTX, artifacts: {}, passed: {}, stale: {}, hydrated: true });
      },
    }),
    {
      name: 'FLIL.project',
      // Crucial: do NOT persist artifacts to localStorage; they live in IDB.
      // Without partialize each save would balloon localStorage and easily
      // exceed the 5 MB browser quota for projects with full storyboard.2.
      partialize: (s) => ({
        ctx: s.ctx,
        passed: s.passed,
        stale: s.stale,
      }) as Partial<ProjectStore>,
    },
  ),
);

/* ----- Conversion helpers ------------------------------------- */

function toLiveArtifact(a: NodeArtifact): LiveArtifact {
  return {
    nodeId: a.nodeId,
    stageId: a.stageId,
    index: a.index,
    title: a.title,
    format: a.format,
    content: a.content,
    tokens: a.tokens,
    cost: a.cost,
    durationMs: a.durationMs,
    ts: a.ts,
    meta: a.meta,
  };
}

function fromLiveArtifact(la: LiveArtifact): NodeArtifact {
  return {
    nodeId: la.nodeId,
    stageId: la.stageId as NodeArtifact['stageId'],
    index: la.index,
    title: la.title,
    format: la.format,
    content: la.content,
    tokens: la.tokens,
    cost: la.cost,
    durationMs: la.durationMs ?? 0,
    ts: la.ts,
    meta: la.meta,
  };
}

/* ----- Hydration / migration --------------------------------- */

let _hydrationPromise: Promise<void> | null = null;

/**
 * Load artifacts from IDB into the in-memory store. Idempotent—callers
 * may invoke from multiple components on mount; only one DB roundtrip
 * actually runs.
 *
 * Migration: if a legacy localStorage payload (`FLIL.project`) still has
 * artifacts inlined, copy them to IDB and strip them from localStorage.
 * This makes the upgrade transparent to existing users.
 */
export function hydrateProject(): Promise<void> {
  if (_hydrationPromise) return _hydrationPromise;
  _hydrationPromise = (async () => {
    // 1. Migration: legacy localStorage artifacts → IDB liveArtifacts.
    try {
      const raw = localStorage.getItem('FLIL.project');
      if (raw) {
        const parsed = JSON.parse(raw);
        const legacy = parsed?.state?.artifacts;
        if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
          const list: LiveArtifact[] = Object.values(legacy).map((a: any) => toLiveArtifact(a as NodeArtifact));
          await liveArtifactsBulkPut(list);
          delete parsed.state.artifacts;
          localStorage.setItem('FLIL.project', JSON.stringify(parsed));
          // eslint-disable-next-line no-console
          console.info(`[project] migrated ${list.length} artifacts from localStorage to IDB`);
        }
      }
    } catch (e) {
      console.warn('[project] localStorage migration skipped:', e);
    }

    // 2. Pull current liveArtifacts into memory.
    try {
      const all = await liveArtifactsAll();
      const map: ArtifactMap = {};
      for (const la of all) map[la.nodeId] = fromLiveArtifact(la);
      useProject.setState({ artifacts: map, hydrated: true });
    } catch (e) {
      console.warn('[project] hydrate failed:', e);
      useProject.setState({ hydrated: true });
    }
  })();
  return _hydrationPromise;
}
