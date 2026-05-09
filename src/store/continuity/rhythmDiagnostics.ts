/**
 * v8 epic · MM5 PR-1 · 节奏诊断表 dexie helpers
 *
 * 职责（CK I-3）：纯 IO · 不调任何 LLM · 不触碰其他表。
 *
 * 调用关系（PR-1 阶段尚未接入消费者）：
 *   - 后续 MM2 5 维自检的"情节张力 + 情感起伏"双维曲线扫描
 *   - 后续 MM4 phase-C 情绪扫描（镜头节奏适配）
 */

import { db } from '../db';
import type { RhythmDiagnosticRow } from './types';

/**
 * 写入或更新一个场景的节奏诊断（CK · upsert 语义 · 同 (projectId, chapter, sceneIdx) 替换）。
 *
 * 设计：节奏数据是"重新计算可重生"的派生数据 · 重跑应直接覆盖 · 不需历史版本。
 */
export async function upsertRhythmDiagnostic(
  rec: Omit<RhythmDiagnosticRow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = Date.now();
  const existing = await db.rhythmDiagnosticTable
    .where('[projectId+chapter+sceneIdx]')
    .equals([rec.projectId, rec.chapter, rec.sceneIdx])
    .first();
  if (existing?.id != null) {
    await db.rhythmDiagnosticTable.update(existing.id, { ...rec, updatedAt: now });
    return existing.id;
  }
  return (await db.rhythmDiagnosticTable.add({
    ...rec,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

/** 列出某项目某章节的全部场景节奏（按 sceneIdx 升序 · 用于曲线展示）。 */
export async function listChapterRhythm(
  projectId: number,
  chapter: number,
): Promise<RhythmDiagnosticRow[]> {
  const rows = await db.rhythmDiagnosticTable
    .where('[projectId+chapter]')
    .equals([projectId, chapter])
    .toArray();
  return rows.sort((a, b) => a.sceneIdx - b.sceneIdx);
}

/** 列出某项目所有节奏点（按 chapter + sceneIdx 排序 · 用于全局曲线）。 */
export async function listAllRhythm(projectId: number): Promise<RhythmDiagnosticRow[]> {
  const rows = await db.rhythmDiagnosticTable.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => {
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.sceneIdx - b.sceneIdx;
  });
}

/** 项目重置/删除时清空（不主动调用 · 预留）。 */
export async function clearProjectRhythm(projectId: number): Promise<void> {
  await db.rhythmDiagnosticTable.where('projectId').equals(projectId).delete();
}
