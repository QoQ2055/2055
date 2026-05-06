// .flil project package — single-file JSON export/import.
//
// Format: a JSON file containing the project context, every artifact, the
// passed/stale flags, and (optionally) the run history. The extension is
// `.flil.json` so OSes recognise it as JSON for inspection while remaining
// distinct from arbitrary JSON files.
//
// Versioning: a `$schema` discriminator lets us evolve the format without
// breaking older files. Importers must check the version and refuse unknown
// shapes rather than silently mis-parse.

import {
  db,
  liveArtifactsBulkPut,
  liveArtifactsClear,
  liveRefinementUndoClear,
  recordRun,
  type LiveArtifact,
  type RunRecord,
} from './db';
import { useProject } from './project';
import { archiveCurrent } from './projectArchive';
import type { NodeArtifact, ProjectContext } from '../pipeline/types';

export const FLIL_SCHEMA = 'flil/project/v1' as const;

export interface FlilPackageV1 {
  $schema: typeof FLIL_SCHEMA;
  exportedAt: number;
  /** Optional app version hint for forward compat */
  appVersion?: string;
  /** Project meta (name, concept, mode, source chunks, ...) */
  ctx: ProjectContext;
  /** All produced artifacts. Ordered by ts asc for readability. */
  artifacts: NodeArtifact[];
  /** User-marked node review flags */
  passed: Record<string, boolean>;
  stale: Record<string, boolean>;
  /** Optional run history for the project. Excluded by default in
   *  archived export to keep file size manageable for sharing. */
  runHistory?: RunRecord[];
}

/* ── Export ──────────────────────────────────────────────────── */

interface ExportOptions {
  /** Include run history in the export. Default: true for active, false for archived */
  includeRunHistory?: boolean;
}

/** Build a downloadable .flil.json blob from an archived project. */
export async function exportArchivedProjectFile(
  projectId: number,
  opts: ExportOptions = {},
): Promise<{ filename: string; blob: Blob; sizeBytes: number }> {
  const row = await db.projects.get(projectId);
  if (!row) throw new Error('项目不存在');
  const includeRunHistory = opts.includeRunHistory ?? false;

  const arts = await db.artifacts.where('projectId').equals(projectId).toArray();
  const artifacts: NodeArtifact[] = arts
    .map((r) => {
      const meta = (r.meta ?? {}) as { stageId?: any; index?: number; title?: string };
      return {
        nodeId: r.nodeId,
        stageId: (meta.stageId ?? r.nodeId.split('.')[0]) as NodeArtifact['stageId'],
        index: meta.index ?? Number(r.nodeId.split('.')[1] ?? 0),
        title: meta.title ?? r.nodeId,
        format: r.format,
        content: r.content,
        tokens: r.tokens,
        cost: r.cost,
        durationMs: r.durationMs ?? 0,
        ts: r.ts,
      } as NodeArtifact;
    })
    .sort((a, b) => a.ts - b.ts);

  let runHistory: RunRecord[] | undefined;
  if (includeRunHistory) {
    runHistory = await db.runHistory.where('projectId').equals(projectId).sortBy('ts');
  }

  const ctx: ProjectContext = {
    name: row.name,
    concept: row.concept,
    durationMin: row.durationMin,
    mode: row.mode,
    createMode: row.createMode ?? 'original',
    adaptationType: row.adaptationType,
    genres: row.genres,
    protagonistGender: row.protagonistGender,
    platform: row.platform,
    coreConflict: row.coreConflict,
    adaptSourceType: row.adaptSourceType,
    source: row.sourceChunks ? { chunks: row.sourceChunks } : undefined,
  };

  const pkg: FlilPackageV1 = {
    $schema: FLIL_SCHEMA,
    exportedAt: Date.now(),
    appVersion: import.meta.env?.VITE_APP_VERSION as string | undefined,
    ctx,
    artifacts,
    passed: {},
    stale: {},
    runHistory,
  };

  return packageToBlob(pkg);
}

function packageToBlob(pkg: FlilPackageV1): { filename: string; blob: Blob; sizeBytes: number } {
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const safeName = (pkg.ctx.name || 'project').replace(/[\\/:*?"<>|]/g, '_').slice(0, 64);
  const dt = new Date(pkg.exportedAt);
  const stamp =
    dt.getFullYear() +
    String(dt.getMonth() + 1).padStart(2, '0') +
    String(dt.getDate()).padStart(2, '0') +
    '-' +
    String(dt.getHours()).padStart(2, '0') +
    String(dt.getMinutes()).padStart(2, '0');
  return { filename: `${safeName}_${stamp}.flil.json`, blob, sizeBytes: blob.size };
}

/** Trigger a browser download for an exported package. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke; some browsers cancel the download if revoked too early.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ── Import ──────────────────────────────────────────────────── */

export interface ImportSummary {
  projectName: string;
  artifactCount: number;
  runHistoryCount: number;
  bytesParsed: number;
}

/** Parse a File / string into a validated FlilPackageV1. Throws if invalid. */
export async function parseProjectFile(input: File | string): Promise<FlilPackageV1> {
  const text = typeof input === 'string' ? input : await input.text();
  let json: any;
  try { json = JSON.parse(text); }
  catch (e: any) { throw new Error('文件不是合法 JSON：' + (e?.message ?? e)); }

  if (!json || typeof json !== 'object') throw new Error('文件内容为空');
  if (json.$schema !== FLIL_SCHEMA) {
    throw new Error(`不是 FLIL 项目包（$schema = ${json.$schema ?? '未指定'}, 期望 ${FLIL_SCHEMA}）`);
  }
  if (!json.ctx || typeof json.ctx !== 'object') throw new Error('文件缺少 ctx 字段');
  if (!Array.isArray(json.artifacts)) throw new Error('文件缺少 artifacts 数组');

  // Best-effort validation of each artifact's required fields.
  for (const [i, a] of json.artifacts.entries()) {
    if (!a || typeof a !== 'object') throw new Error(`artifacts[${i}] 不是对象`);
    if (!a.nodeId || !a.stageId || !a.format || typeof a.content !== 'string') {
      throw new Error(`artifacts[${i}] 缺少必需字段 (nodeId / stageId / format / content)`);
    }
  }

  return json as FlilPackageV1;
}

/** Import a parsed package as the new active project. The current active
 *  project is archived first (so import is non-destructive). */
export async function importAsActiveProject(
  pkg: FlilPackageV1,
): Promise<ImportSummary> {
  // 1. Archive whatever is in memory now.
  await archiveCurrent();

  // 2. Replace liveArtifacts with imported set.
  await liveArtifactsClear();
  // v4 阶段 2.6 · 导入项目同步丢弃上一项目的润色撤销栈
  await liveRefinementUndoClear().catch(() => {});
  const live: LiveArtifact[] = pkg.artifacts.map((a) => ({
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
  }));
  await liveArtifactsBulkPut(live);

  // 3. Push into zustand memory.
  const map: Record<string, NodeArtifact> = {};
  for (const a of pkg.artifacts) map[a.nodeId] = a;
  useProject.setState({
    ctx: pkg.ctx,
    artifacts: map,
    passed: pkg.passed ?? {},
    stale: pkg.stale ?? {},
    hydrated: true,
  });

  // 4. Replay run history (best-effort; failure logged not thrown).
  let runHistoryCount = 0;
  if (Array.isArray(pkg.runHistory)) {
    for (const r of pkg.runHistory) {
      // strip the original id so Dexie autoIncrement assigns a fresh one,
      // and force projectId=0 (active) for the imported project.
      const { id: _omit, ...rest } = r;
      void _omit;
      await recordRun({ ...rest, projectId: 0 });
      runHistoryCount++;
    }
  }

  return {
    projectName: pkg.ctx.name,
    artifactCount: pkg.artifacts.length,
    runHistoryCount,
    bytesParsed: JSON.stringify(pkg).length,
  };
}

/** Import a parsed package as a NEW archived project (does not change the
 *  active project). Useful for bulk-importing without disturbing current
 *  work-in-progress. Returns the new archived projectId. */
export async function importAsArchivedProject(pkg: FlilPackageV1): Promise<number> {
  const now = Date.now();
  const projectId = await db.projects.add({
    name: pkg.ctx.name || '未命名（导入）',
    concept: pkg.ctx.concept,
    durationMin: pkg.ctx.durationMin,
    mode: pkg.ctx.mode,
    createMode: pkg.ctx.createMode,
    adaptationType: pkg.ctx.adaptationType,
    genres: pkg.ctx.genres,
    protagonistGender: pkg.ctx.protagonistGender,
    platform: pkg.ctx.platform,
    coreConflict: pkg.ctx.coreConflict,
    adaptSourceType: pkg.ctx.adaptSourceType,
    sourceChunks: pkg.ctx.source?.chunks,
    createdAt: pkg.exportedAt ?? now,
    updatedAt: now,
    status: pkg.artifacts.length > 0 ? 'done' : 'idle',
  });

  if (pkg.artifacts.length > 0) {
    await db.artifacts.bulkAdd(pkg.artifacts.map((a) => ({
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

  if (Array.isArray(pkg.runHistory)) {
    for (const r of pkg.runHistory) {
      const { id: _omit, ...rest } = r;
      void _omit;
      await recordRun({ ...rest, projectId: projectId as number });
    }
  }

  return projectId as number;
}

