// Archive helpers: persist the current in-memory project (zustand) to
// IndexedDB and load any past project back into memory.
//
// Memory model: one *active* project lives in `useProject` (zustand,
// persisted to localStorage). When the user clicks "新建项目" or "载入"
// we first archive the current state into Dexie tables, then swap.

import {
  db,
  liveArtifactsAll,
  liveArtifactsBulkPut,
  liveArtifactsClear,
  liveRefinementUndoClear,
  type Project as DbProject,
  type LiveArtifact,
} from './db';
import { useProject } from './project';
import type { ArtifactMap, NodeArtifact, ProjectContext } from '../pipeline/types';

// Archive whatever is currently in memory; returns the new DB row id (or null
// if the active project has no artifacts AND default-named).
export async function archiveCurrent(): Promise<number | null> {
  const { ctx } = useProject.getState();
  // Source of truth for artifacts is now `liveArtifacts` table; pull from
  // there in case in-memory is not yet hydrated or a sibling tab updated it.
  const live: LiveArtifact[] = await liveArtifactsAll().catch(() => []);
  const arts: NodeArtifact[] = live.map((la) => ({
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
  }));
  // Skip archiving an "empty" default project (no work done).
  if (arts.length === 0 && ctx.name === '默认项目') return null;

  const now = Date.now();
  const row: DbProject = {
    name: ctx.name || '未命名',
    concept: ctx.concept,
    durationMin: ctx.durationMin,
    mode: ctx.mode,
    projectMode: ctx.projectMode,
    createMode: ctx.createMode,
    projectType: ctx.projectType,
    adaptationType: ctx.adaptationType,
    genres: ctx.genres,
    protagonistGender: ctx.protagonistGender,
    platform: ctx.platform,
    coreConflict: ctx.coreConflict,
    adaptSourceType: ctx.adaptSourceType,
    visualStyle: ctx.visualStyle,
    sourceChunks: ctx.source?.chunks,
    createdAt: now,
    updatedAt: now,
    status: arts.length > 0 ? 'done' : 'idle',
  };
  const projectId = await db.projects.add(row);

  if (arts.length > 0) {
    await db.artifacts.bulkAdd(arts.map((a) => ({
      projectId: projectId as number,
      nodeId: a.nodeId,
      format: a.format,
      content: a.content,
      tokens: a.tokens,
      cost: a.cost,
      durationMs: a.durationMs,
      ts: a.ts,
      meta: { stageId: a.stageId, index: a.index, title: a.title, ...(a.meta ?? {}) },
    })));
  }
  // Re-key any run history that was logged under the live slot (projectId=0)
  // to the freshly-archived project so future load can bring it back.
  await db.runHistory.where('projectId').equals(0).modify({ projectId: projectId as number }).catch(() => 0);

  // The live slot is now archived — wipe it so the next active project
  // starts clean. Caller (startNewActive / loadFromDb) will repopulate.
  await liveArtifactsClear().catch(() => {});
  // v4 阶段 2.6 · 项目切换同步丢弃上一项目的润色撤销栈
  await liveRefinementUndoClear().catch(() => {});
  return projectId as number;
}

// Reset the active project to a fresh ctx (caller-provided).
export function startNewActive(ctx: ProjectContext) {
  liveArtifactsClear().catch(() => {});
  liveRefinementUndoClear().catch(() => {});
  useProject.setState({
    ctx,
    artifacts: {},
    passed: {},
    stale: {},
    hydrated: true,
  });
}

// Load a past project from DB into the active in-memory slot.
// Archives whatever is in memory first.
export async function loadFromDb(projectId: number): Promise<void> {
  await archiveCurrent();
  const row = await db.projects.get(projectId);
  if (!row) throw new Error('项目不存在');
  const rows = await db.artifacts.where('projectId').equals(projectId).toArray();
  const artifacts: ArtifactMap = {};
  for (const r of rows) {
    const meta = (r.meta ?? {}) as { stageId?: any; index?: number; title?: string };
    const a: NodeArtifact = {
      nodeId: r.nodeId,
      stageId: (meta.stageId ?? r.nodeId.split('.')[0]) as any,
      index: meta.index ?? Number(r.nodeId.split('.')[1] ?? 0),
      title: meta.title ?? r.nodeId,
      format: r.format,
      content: r.content,
      tokens: r.tokens,
      cost: r.cost,
      durationMs: r.durationMs ?? 0,
      ts: r.ts,
    };
    artifacts[r.nodeId] = a;
  }
  // Repopulate live IDB slot with the loaded project's artifacts so writes
  // continue to be persisted on next mutation.
  await liveArtifactsClear().catch(() => {});
  await liveRefinementUndoClear().catch(() => {});
  await liveArtifactsBulkPut(
    Object.values(artifacts).map((a): LiveArtifact => ({
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
    })),
  ).catch(() => {});

  // Bring this project's run history back to the live slot so it shows up
  // in node-scoped panels while the project is active.
  await db.runHistory.where('projectId').equals(projectId).modify({ projectId: 0 }).catch(() => 0);

  useProject.setState({
    ctx: {
      name: row.name,
      concept: row.concept,
      durationMin: row.durationMin,
      mode: row.mode,
      projectMode: row.projectMode,
      createMode: row.createMode ?? 'original',
      projectType: row.projectType,
      adaptationType: row.adaptationType,
      genres: row.genres,
      protagonistGender: row.protagonistGender,
      platform: row.platform,
      coreConflict: row.coreConflict,
      adaptSourceType: row.adaptSourceType,
      visualStyle: row.visualStyle,
      source: row.sourceChunks ? { chunks: row.sourceChunks } : undefined,
    },
    artifacts,
    passed: {},
    stale: {},
    hydrated: true,
  });
}

export async function deleteFromDb(projectId: number): Promise<void> {
  await db.transaction('rw', db.projects, db.artifacts, db.runHistory, async () => {
    await db.artifacts.where('projectId').equals(projectId).delete();
    await db.runHistory.where('projectId').equals(projectId).delete();
    await db.projects.delete(projectId);
  });
}
