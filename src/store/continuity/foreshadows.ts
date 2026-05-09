/**
 * v8 epic · MM5 PR-1 · 伏笔追踪表 dexie helpers
 *
 * 职责（CK I-3）：纯 IO · 不调任何 LLM · 不触碰其他表。
 *
 * 调用关系（PR-1 阶段尚未接入消费者 · 仅落数据层）：
 *   - 后续 MM1 长片/剧集流水线在 setup 章节产出时写入
 *   - 后续 MM3 资产工厂在生成角色卡时读取（人物动机串联）
 *   - 后续 MM2 SelfCheckPanel 'broken' 状态告警
 */

import { db } from '../db';
import type { ForeshadowRow, ForeshadowStatus } from './types';

/** 创建一条新伏笔（默认 status='planted'）· 自动填 createdAt / updatedAt。 */
export async function addForeshadow(
  rec: Omit<ForeshadowRow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = Date.now();
  return (await db.foreshadowTable.add({
    ...rec,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

/** 列出某项目所有伏笔（按 setupChapter 升序 · 最早埋的在前）。 */
export async function listForeshadows(projectId: number): Promise<ForeshadowRow[]> {
  const rows = await db.foreshadowTable.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => a.setupChapter - b.setupChapter);
}

/** 列出某项目某状态的伏笔 · 按 setupChapter 升序。 */
export async function listForeshadowsByStatus(
  projectId: number,
  status: ForeshadowStatus,
): Promise<ForeshadowRow[]> {
  const rows = await db.foreshadowTable
    .where('[projectId+status]')
    .equals([projectId, status])
    .toArray();
  return rows.sort((a, b) => a.setupChapter - b.setupChapter);
}

/** 列出某项目某 setup 章节埋下的伏笔（用于章节级面板）。 */
export async function listForeshadowsBySetupChapter(
  projectId: number,
  setupChapter: number,
): Promise<ForeshadowRow[]> {
  return db.foreshadowTable
    .where('[projectId+setupChapter]')
    .equals([projectId, setupChapter])
    .toArray();
}

/**
 * 更新伏笔状态 / 字段 · 自动刷新 updatedAt。
 *
 * 仅可更新业务字段（status / payoffChapter / payoffNote / notes / weight / title /
 * content）· 不可改 projectId / setupChapter / createdAt / id（CK · 不可变身份）。
 */
export async function updateForeshadow(
  id: number,
  patch: Partial<
    Pick<
      ForeshadowRow,
      'status' | 'payoffChapter' | 'payoffNote' | 'notes' | 'weight' | 'title' | 'content'
    >
  >,
): Promise<void> {
  await db.foreshadowTable.update(id, { ...patch, updatedAt: Date.now() });
}

/** 项目重置/删除时清空伏笔表（不主动调用 · 预留）。 */
export async function clearProjectForeshadows(projectId: number): Promise<void> {
  await db.foreshadowTable.where('projectId').equals(projectId).delete();
}
