/**
 * v6 epic · ACE-lite Reflector lessons · Dexie 数据层
 *
 * 职责（CK I-3）：types + 5 个 dexie helpers · **不调任何 LLM**（纯 IO 操作）。
 * 表 schema（v7 add-only · CK I-2）：
 *   reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts,
 *                      [projectId+status], [projectId+chapterIndex]'
 *
 * 调用关系：
 *   - reflector.ts 调 upsertReflectorLesson 写入
 *   - ReflectorLessonsPanel.tsx 调 listLessonsByStatus / listLessonsByChapter 读取
 *   - 用户审阅时 updateLessonStatus 流转 status
 */

import { db } from './db';

// ─── 类型 ──────────────────────────────────────────────────────────

export type LessonStatus = 'pending' | 'approved' | 'rejected' | 'committed';

export type SignalType = 'scoreCard' | 'consistencyCheck' | 'readerLayer' | 'userFeedback';

/**
 * 一条 Reflector lesson 记录（dexie row）。
 *
 * 状态流转：
 *   pending（默认）→ approved（用户批准）→ committed（用户手动改 method module 后标记）
 *                  → rejected（用户驳回）
 *
 * CK I-3：本 row 不会自动改任何 method module · committedTo 是用户手动填值。
 */
export interface ReflectorLesson {
  id?: number;
  projectId: number;
  /** 1-based 与 ChapterMeta.index 对齐。 */
  chapterIndex: number;
  /** 触发的信号类型。 */
  signalType: SignalType;
  /** Reflector LLM 提炼的 lesson · 100-300 字。 */
  lessonContent: string;
  /** 建议写入哪个 method module · null = LLM 没建议或建议不在 active 中。 */
  suggestedModule: string | null;
  /** 状态 · 默认 pending。 */
  status: LessonStatus;
  /** 用户 commit 后填 · 形如 'anti-ai-flavor-rules:L120-130'。 */
  committedTo: string | null;
  /** 用户审阅时的备注（可选）。 */
  reviewNote: string | null;
  ts: number;
  /** 触发 lesson 的原始信号 · 调试用 · 不展示给 LLM。 */
  signalContext: {
    scoreCardScores?: Record<string, number>;
    consistencyIssues?: string[];
    staleChapterRange?: [number, number];
    userFeedbackText?: string;
  };
}

// ─── helpers ──────────────────────────────────────────────────────

/**
 * 写入一条新 lesson（默认 status='pending'）。
 *
 * 不变量 I-3：本函数不调任何 LLM / 不改任何 method module（纯 IO）。
 * 唯一性约束：无（同章同信号可多条 · 用户审阅时去重）。
 */
export async function upsertReflectorLesson(
  rec: Omit<ReflectorLesson, 'id' | 'ts'>,
): Promise<number> {
  const ts = Date.now();
  return (await db.reflectorLessons.add({ ...rec, ts })) as number;
}

/**
 * 列出某项目某 status 的全部 lessons（按 ts 降序 · 最新在前）。
 *
 * 用于 ReflectorLessonsPanel 列表渲染。
 */
export async function listLessonsByStatus(
  projectId: number,
  status: LessonStatus,
): Promise<ReflectorLesson[]> {
  const rows = await db.reflectorLessons
    .where('[projectId+status]')
    .equals([projectId, status])
    .toArray();
  return rows.sort((a, b) => b.ts - a.ts);
}

/**
 * 列出某项目某章节的全部 lessons（不限 status · 按 ts 降序）。
 *
 * 用于章节级 lesson 历史查看。
 */
export async function listLessonsByChapter(
  projectId: number,
  chapterIndex: number,
): Promise<ReflectorLesson[]> {
  const rows = await db.reflectorLessons
    .where('[projectId+chapterIndex]')
    .equals([projectId, chapterIndex])
    .toArray();
  return rows.sort((a, b) => b.ts - a.ts);
}

/**
 * 更新 lesson 状态 · 可选附加 committedTo / reviewNote。
 *
 * 用户审阅 / 批准 / 驳回 / 标记已 commit 时调用。
 */
export async function updateLessonStatus(
  id: number,
  newStatus: LessonStatus,
  opts?: { committedTo?: string; reviewNote?: string; lessonContent?: string; suggestedModule?: string | null },
): Promise<void> {
  const patch: Partial<ReflectorLesson> = { status: newStatus };
  if (opts?.committedTo !== undefined) patch.committedTo = opts.committedTo;
  if (opts?.reviewNote !== undefined) patch.reviewNote = opts.reviewNote;
  if (opts?.lessonContent !== undefined) patch.lessonContent = opts.lessonContent;
  if (opts?.suggestedModule !== undefined) patch.suggestedModule = opts.suggestedModule;
  await db.reflectorLessons.update(id, patch);
}

/**
 * 清空某项目所有 lessons（项目删除 / 重置时使用）。
 *
 * 不主动调用；预留给项目级别的 reset 流程。
 */
export async function clearProjectLessons(projectId: number): Promise<void> {
  await db.reflectorLessons.where('projectId').equals(projectId).delete();
}
