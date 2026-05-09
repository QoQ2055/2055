/**
 * v8 epic · MM5 PR-1 · 世界观规则表 dexie helpers
 *
 * 职责（CK I-3）：纯 IO · 不调任何 LLM · 不触碰其他表。
 *
 * 调用关系（PR-1 阶段尚未接入消费者）：
 *   - 后续 MM1 长片世界观层产出时写入
 *   - 后续 MM4 分镜忠实度自检读取（hard 规则违规阻断）
 */

import { db } from '../db';
import type { WorldRuleRow } from './types';

/** 添加一条世界观规则 · 自动填 createdAt / updatedAt · violations 默认空数组。 */
export async function addWorldRule(
  rec: Omit<WorldRuleRow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = Date.now();
  return (await db.worldContinuityTable.add({
    ...rec,
    violations: rec.violations ?? [],
    createdAt: now,
    updatedAt: now,
  })) as number;
}

/** 列出某项目所有规则（按 domain + chapter 排序）。 */
export async function listWorldRules(projectId: number): Promise<WorldRuleRow[]> {
  const rows = await db.worldContinuityTable.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => {
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.chapter - b.chapter;
  });
}

/** 列出某项目某 domain 的全部规则（按 chapter 升序）。 */
export async function listWorldRulesByDomain(
  projectId: number,
  domain: string,
): Promise<WorldRuleRow[]> {
  const rows = await db.worldContinuityTable
    .where('[projectId+domain]')
    .equals([projectId, domain])
    .toArray();
  return rows.sort((a, b) => a.chapter - b.chapter);
}

/**
 * 追加一条违规记录到指定规则（add-only · 不删既有违规）。
 *
 * 用例：MM4 分镜忠实度自检发现违规 · 调本函数追加到规则的 violations 数组 ·
 * 自动刷新 updatedAt。
 */
export async function appendWorldRuleViolation(id: number, violation: string): Promise<void> {
  const row = await db.worldContinuityTable.get(id);
  if (!row) return;
  const next = [...(row.violations ?? []), violation];
  await db.worldContinuityTable.update(id, { violations: next, updatedAt: Date.now() });
}

/**
 * 更新规则字段 · 自动刷新 updatedAt。
 *
 * 不可改 projectId / domain / createdAt / id（CK · 身份字段不可变）。
 * 注意：违规追加请用 appendWorldRuleViolation · 本函数支持整体替换 violations。
 */
export async function updateWorldRule(
  id: number,
  patch: Partial<Pick<WorldRuleRow, 'rule' | 'severity' | 'chapter' | 'violations' | 'notes'>>,
): Promise<void> {
  await db.worldContinuityTable.update(id, { ...patch, updatedAt: Date.now() });
}

/** 项目重置/删除时清空（不主动调用 · 预留）。 */
export async function clearProjectWorldRules(projectId: number): Promise<void> {
  await db.worldContinuityTable.where('projectId').equals(projectId).delete();
}
