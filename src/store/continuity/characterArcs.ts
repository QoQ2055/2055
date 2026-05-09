/**
 * v8 epic · MM5 PR-1 · 角色弧光表 dexie helpers
 *
 * 职责（CK I-3）：纯 IO · 不调任何 LLM · 不触碰其他表。
 *
 * 与 characterStates 表的区分（CK · 关注点分离）：
 *   - characterStates（v5）: 章节级"快照"· 每章一行 · 偏运行时状态
 *   - characterArcTable（v8）: 弧光级"里程碑"· 每个 epoch 一行 · 偏长程结构
 *
 * 调用关系（PR-1 阶段尚未接入消费者）：
 *   - 后续 MM1 剧集弧光预算消费此表
 *   - 后续 MM2 人物维度自检消费此表
 */

import { db } from '../db';
import type { CharacterArcRow } from './types';

/** 添加一条角色弧光记录 · 自动填 createdAt / updatedAt。 */
export async function addCharacterArc(
  rec: Omit<CharacterArcRow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = Date.now();
  return (await db.characterArcTable.add({
    ...rec,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

/** 列出某项目某角色的所有弧光点 · 按 chapter 升序（时间线展示）。 */
export async function listCharacterArc(
  projectId: number,
  characterName: string,
): Promise<CharacterArcRow[]> {
  const rows = await db.characterArcTable
    .where('[projectId+characterName]')
    .equals([projectId, characterName])
    .toArray();
  return rows.sort((a, b) => a.chapter - b.chapter);
}

/**
 * 查询某项目某角色某 epoch 的具体记录（CK · upsert 唯一性查找）。
 *
 * 注意：本表 schema 不强制 (projectId, characterName, epoch) 唯一 · 调用方需自查重。
 * 若同 epoch 存在多条 · 返回最新一条（按 updatedAt）。
 */
export async function findCharacterArcEpoch(
  projectId: number,
  characterName: string,
  epoch: string,
): Promise<CharacterArcRow | undefined> {
  const rows = await db.characterArcTable
    .where('[projectId+characterName+epoch]')
    .equals([projectId, characterName, epoch])
    .toArray();
  if (rows.length === 0) return undefined;
  return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/** 列出某项目所有角色的弧光（按 characterName + chapter 排序）· 用于全局视图。 */
export async function listAllCharacterArcs(projectId: number): Promise<CharacterArcRow[]> {
  const rows = await db.characterArcTable.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => {
    if (a.characterName !== b.characterName) return a.characterName.localeCompare(b.characterName);
    return a.chapter - b.chapter;
  });
}

/**
 * 更新弧光记录 · 自动刷新 updatedAt。
 *
 * 不可改 projectId / characterName / epoch / createdAt / id（CK · 身份字段不可变）。
 */
export async function updateCharacterArc(
  id: number,
  patch: Partial<Pick<CharacterArcRow, 'chapter' | 'state' | 'driver' | 'evidence'>>,
): Promise<void> {
  await db.characterArcTable.update(id, { ...patch, updatedAt: Date.now() });
}

/** 项目重置/删除时清空（不主动调用 · 预留）。 */
export async function clearProjectCharacterArcs(projectId: number): Promise<void> {
  await db.characterArcTable.where('projectId').equals(projectId).delete();
}
