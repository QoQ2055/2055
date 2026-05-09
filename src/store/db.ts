import Dexie, { type Table } from 'dexie';
import type { CreateMode, AdaptationType, ProjectMode, SourceChunk } from '../pipeline/types';
import type { UserKbDoc, UserKbFeedback } from './userKb';
import type { CharacterStateRecord } from './characterStates';
import type { ReflectorLesson } from './reflectorLessons';
import type {
  ForeshadowRow,
  CharacterArcRow,
  WorldRuleRow,
  RhythmDiagnosticRow,
} from './continuity/types';

export interface Project {
  id?: number;
  name: string;
  concept: string;
  durationMin: number;     // 时长档（分钟）
  mode: string;            // 人读标签
  /** v3 first-class project mode (workflow refactor). */
  projectMode?: ProjectMode;
  createMode?: CreateMode; // 'original' | 'adaptation' (legacy / back-compat)
  /** v2 legacy: 'normal' | 'express'. Resolves into projectMode='express' on read. */
  projectType?: 'normal' | 'express';
  adaptationType?: AdaptationType;
  // 结构化分类字段（v2）
  genres?: string[];
  protagonistGender?: 'male' | 'female' | 'dual' | 'nonhuman';
  platform?: string;
  coreConflict?: string;
  adaptSourceType?: string;
  visualStyle?: string;
  sourceChunks?: SourceChunk[];
  /**
   * v3 资料库 v2：项目绑定的用户上传资料（趋势 / 范文 / 反例 / 偏好 / 方法论）。
   * 数组元素为 `userKbDocs.id`。运行时由 compose.ts 的注入层根据 type 决定
   * 注入到哪个 prompt 节点。空数组 / undefined 视为无绑定。
   */
  userKbDocIds?: number[];
  /** v3 启用的方法论模块 ID（来自 public/methods/，最多 3 个）。 */
  methodModuleIds?: string[];
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'running' | 'done' | 'error';
}

export interface Artifact {
  id?: number;
  projectId: number;
  nodeId: string;          // e.g. "screenplay.s1" / "assets.roles" / "storyboard.shot.3"
  format: 'markdown' | 'json' | 'text';
  content: string;
  tokens?: number;
  cost?: number;
  durationMs?: number;
  ts: number;
  meta?: Record<string, unknown>;
}

/** Live artifacts of the currently-active project. Written-through on every
 *  `upsertArtifact` from useProject. On project switch they are bulk-copied
 *  to the archived `artifacts` table (with projectId) then cleared. */
export interface LiveArtifact {
  /** primary key — same as NodeArtifact.nodeId (unique per active project) */
  nodeId: string;
  stageId: string;
  index: number;
  title: string;
  format: 'markdown' | 'json' | 'text';
  content: string;
  tokens?: number;
  cost?: number;
  durationMs?: number;
  ts: number;
  /** Free-form artifact-level metadata (e.g. selfCheck report, phase2Loop) */
  meta?: Record<string, unknown>;
}

/** One LLM invocation record. Append-only history; survives project switches.
 *  Use `projectId = 0` for the live (in-memory) project; archived projects use
 *  their stable Dexie id. */
export interface RunRecord {
  id?: number;
  /** 0 means active/live project */
  projectId: number;
  nodeId: string;
  stageId: string;
  stepIndex: number;
  /** human label e.g. "S2 梗概" */
  title?: string;
  ts: number;
  status: 'done' | 'error' | 'aborted';
  durationMs: number;
  tokens?: number;
  cost?: number;
  /** length of resulting artifact content (bytes) */
  contentLength?: number;
  /** first ~4KB of content for quick preview */
  contentSnapshot?: string;
  /** unit index when this run is part of storyboard.2 phase-2 loop */
  unitIndex?: number;
  error?: string;
  /** model + temperature used (best-effort capture) */
  model?: string;
  temperature?: number;
}

/**
 * v4 阶段 2.6 · 润色撤销栈持久化
 *
 * 场景：PreviewModal 在用户三联「选区 → 点击润色 → 点击应用」后压栈，
 * 表面重启 / 刷新 / 关闭 modal 后仅状态丢失，应用过的改动本身已进入
 * artifact，但「原始文本】丢失 → 无法撤销。
 *
 * 该表以 (chapterIndex, source) 为逻辑 key 存储每次应用前的原文，
 * 与 liveArtifacts 同生同死（项目切换时清空）。
 */
export interface LiveRefinementUndoEntry {
  /** 自增主键 */
  id?: number;
  /** 章节 1-based index */
  chapterIndex: number;
  /** 'draft' | 'polish'，与 Novel.tsx 里的 chapterSrc 对齐 */
  source: 'draft' | 'polish';
  /** 应用前的原始文本（整章文本） */
  previousText: string;
  /** 入栈时间戳（也用于排序） */
  ts: number;
}

class CineDB extends Dexie {
  projects!: Table<Project, number>;
  artifacts!: Table<Artifact, number>;
  liveArtifacts!: Table<LiveArtifact, string>;
  runHistory!: Table<RunRecord, number>;
  userKbDocs!: Table<UserKbDoc, number>;
  userKbFeedback!: Table<UserKbFeedback, number>;
  liveRefinementUndo!: Table<LiveRefinementUndoEntry, number>;
  /** v5 · 阶段 b · 角色状态跨章节追踪（gap-b） */
  characterStates!: Table<CharacterStateRecord, number>;
  /** v6 · ACE-lite · Reflector lessons 待审阅队列（CK I-2 add-only） */
  reflectorLessons!: Table<ReflectorLesson, number>;
  /** v8 · MM5 epic · 伏笔追踪表（multimodal continuity layer · add-only） */
  foreshadowTable!: Table<ForeshadowRow, number>;
  /** v8 · MM5 epic · 角色弧光表（多 epoch 跨章节状态轨迹） */
  characterArcTable!: Table<CharacterArcRow, number>;
  /** v8 · MM5 epic · 世界观规则表（domain-rule + 违规记录） */
  worldContinuityTable!: Table<WorldRuleRow, number>;
  /** v8 · MM5 epic · 节奏诊断表（场次 tension/emotion + 警报） */
  rhythmDiagnosticTable!: Table<RhythmDiagnosticRow, number>;

  constructor() {
    super('FLIL');
    this.version(1).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
    });
    // v2: add liveArtifacts (active project) and runHistory (LLM call log)
    this.version(2).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
    });
    // v3: 资料库 v2 — 用户上传资料 + 章节反馈
    // - userKbDocs: 趋势 / 范文 / 反例 / 偏好汇总（账号级，跨项目共享）
    // - userKbFeedback: 用户对生成章节的不满意反馈（用于 P2 偏好沉淀）
    this.version(3).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
    });
    // v4: 阶段 2.6 · 润色工具撤销栈持久化
    this.version(4).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
    });
    // v5: 阶段 b · 角色 Bible 跨章节追踪（gap-b）
    // 仅追加 characterStates 表，v1-v4 stores 字符串保持 0 变更（CK 红线 #1）。
    // 复合索引设计：
    //   - [projectId+chapterIndex] · 某项目某章所有角色状态（listChapterStates）
    //   - [projectId+characterName] · 某项目某角色跨章时间线（listCharacterTimeline）
    //   - [projectId+chapterIndex+characterName] · upsert 唯一性查找
    this.version(5).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
    });
    // v6: epic v5 · 双层存档（dual-layer-archive）
    // CharacterSnapshot.readerLayer? 嵌套 JSON · 不进索引（CK I-2）。
    // stores 字符串 = v5（CK I-3 严守 · CK 红线 #1 v1-v5 stores 0 变更）。
    this.version(6).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
    });
    // v7: epic v6 · ACE-lite Reflector lessons（ace-lite-feedback-loop）
    // reflectorLessons 表 add-only（CK v6 I-2）· v6 stores 字符串完全保留（CK 红线 #1 v1-v6 stores 0 变更 · CK v6 I-2）。
    this.version(7).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
      reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts, [projectId+status], [projectId+chapterIndex]',
    });
    // v8: epic MM5 PR-1 · 多模态连续性表（multimodal continuity layer）
    //
    // 设计原则（inspired by continuity-table concept · re-designed schema · IP tier 2 自写）：
    //   - 4 张 add-only 表 · 每张独立索引 · 不与现有表交叉
    //   - 表名 / 字段名 / 枚举值全部 fili-web 自写 · 不复用任何外部独创命名
    //   - 升级 callback 留空 · 旧项目数据 0 触碰 · 4 张新表默认空 · 首次使用按需写入
    //
    // CK 红线 #1（v1-v7 stores 字符串 0 改）严守 · 仅在尾部追加 4 行新表声明。
    // CK I-2（add-only · 永不删表 / 永不删字段）严守 · 后续 epic 只可追加新字段（用 ?: 可选）。
    this.version(8).stores({
      projects: '++id, name, createdAt, status',
      artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
      liveArtifacts: '&nodeId, stageId, ts',
      runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
      userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
      userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
      liveRefinementUndo: '++id, ts, [chapterIndex+source]',
      characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
      reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts, [projectId+status], [projectId+chapterIndex]',
      // v8 add-only · 4 张连续性表
      foreshadowTable: '++id, projectId, status, setupChapter, payoffChapter, [projectId+status], [projectId+setupChapter]',
      characterArcTable: '++id, projectId, characterName, epoch, chapter, [projectId+characterName], [projectId+characterName+epoch]',
      worldContinuityTable: '++id, projectId, domain, chapter, [projectId+domain]',
      rhythmDiagnosticTable: '++id, projectId, chapter, sceneIdx, [projectId+chapter], [projectId+chapter+sceneIdx]',
    });
  }
}

export const db = new CineDB();

/* ── Run history helpers ─────────────────────────────────────────── */

export async function recordRun(rec: Omit<RunRecord, 'id'>): Promise<number> {
  try {
    return (await db.runHistory.add(rec)) as number;
  } catch (e) {
    // Never let a logging failure break user flow
    console.warn('[runHistory] record failed:', e);
    return -1;
  }
}

export async function listRunsForNode(
  nodeId: string,
  opts: { limit?: number; projectId?: number } = {},
): Promise<RunRecord[]> {
  const { limit = 20, projectId } = opts;
  let q = db.runHistory.where('nodeId').equals(nodeId);
  if (projectId != null) q = q.and((r) => r.projectId === projectId);
  const rows = await q.reverse().sortBy('ts');
  return rows.slice(0, limit);
}

export async function listRecentRuns(
  opts: { limit?: number; projectId?: number } = {},
): Promise<RunRecord[]> {
  const { limit = 50, projectId } = opts;
  if (projectId != null) {
    const rows = await db.runHistory.where('projectId').equals(projectId).reverse().sortBy('ts');
    return rows.slice(0, limit);
  }
  const rows = await db.runHistory.orderBy('ts').reverse().limit(limit).toArray();
  return rows;
}

export async function clearRunHistoryForProject(projectId: number): Promise<void> {
  await db.runHistory.where('projectId').equals(projectId).delete();
}

/* ── Live artifacts helpers ──────────────────────────────────────── */

export async function liveArtifactsAll(): Promise<LiveArtifact[]> {
  return db.liveArtifacts.toArray();
}

export async function liveArtifactsBulkPut(arts: LiveArtifact[]): Promise<void> {
  if (!arts.length) return;
  await db.liveArtifacts.bulkPut(arts);
}

export async function liveArtifactsClear(): Promise<void> {
  await db.liveArtifacts.clear();
}

/* ── v4 阶段 2.6 · Live refinement undo helpers ─────────────── */

/**
 * 取出当前 active project 的所有润色撤销条目（按 ts 升序）。
 * 调用方：PreviewModal 读取 × 项目切换后代码可使用。
 */
export async function liveRefinementUndoAll(): Promise<LiveRefinementUndoEntry[]> {
  return db.liveRefinementUndo.orderBy('ts').toArray();
}

/** 推入一条撤销记录。返回新条目 id。 */
export async function liveRefinementUndoPush(
  entry: Omit<LiveRefinementUndoEntry, 'id'>,
): Promise<number> {
  return (await db.liveRefinementUndo.add(entry)) as number;
}

/** 弹出某章节最新一条撤销记录并返回。不存在返 null。 */
export async function liveRefinementUndoPopLast(
  chapterIndex: number,
  source: 'draft' | 'polish',
): Promise<LiveRefinementUndoEntry | null> {
  // Dexie compound index 查询该章节 × 源的全部记录，取最后一条
  const all = await db.liveRefinementUndo
    .where('[chapterIndex+source]')
    .equals([chapterIndex, source])
    .sortBy('ts');
  if (all.length === 0) return null;
  const latest = all[all.length - 1];
  if (latest.id != null) await db.liveRefinementUndo.delete(latest.id);
  return latest;
}

/** 项目切换时调用：清空所有撤销条目。 */
export async function liveRefinementUndoClear(): Promise<void> {
  await db.liveRefinementUndo.clear();
}
