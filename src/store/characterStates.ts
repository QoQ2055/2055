/**
 * gap-b · 角色 Bible 跨章节追踪 · Dexie 数据层
 *
 * 职责（CA §1.3 公开 API）：types + 5 个 dexie helpers，
 * **不调任何 LLM**（不变量 I-1）；纯 IO 操作。
 *
 * 表 schema（v5 add-only · CA §3.1）：
 *   characterStates: '++id, projectId, chapterIndex, characterName, ts, stale,
 *                     [projectId+chapterIndex], [projectId+characterName],
 *                     [projectId+chapterIndex+characterName]'
 *
 * 调用关系：
 *   - LLM 提取层 `src/pipeline/characterStates.ts` 调 upsertCharacterState 写入
 *   - UI 层 `src/components/CharacterBible.tsx` 调 listXxx 读取
 *   - 修订流 触发 markStateStale 标记下游章节失效
 */

import { db } from './db';

// ─── 类型 ──────────────────────────────────────────────────────────

/**
 * 关系类型枚举（CA §4.2 Q2 决议）。
 *
 * 8 个值平衡 LLM 输出稳定性与表达力：
 * - 主类型 `type` 严格枚举，防止 LLM 词面漂移（"师徒" / "师生" / "亦师亦友" 全部归 mentor）
 * - `note` 自由文本承载具体细节（"暗恋未表白" / "为父复仇" 等）
 */
export type RelationType =
  | 'friend'
  | 'enemy'
  | 'neutral'
  | 'lover'
  | 'family'
  | 'mentor'
  | 'rival'
  | 'unknown';

export interface CharacterRelation {
  /** 主关系类型（受 enum 约束，LLM prompt §3.2 强制 8 选 1）。 */
  type: RelationType;
  /** 自由文本细节，≤ 30 字（prompt 端约束）。 */
  note?: string;
}

/**
 * 单角色在某章末的状态快照。
 *
 * 字段语义（CA §3.4 算法约束）：
 * - `relations`：仅记**变化或新增的**关系（vs 上一章），不全量复读
 * - `abilities` / `keyEvents`：仅记**本章变化**
 * - `summary`：≤ 80 字一句话总结（永远生成，方便 timeline 上排显示）
 */
export interface CharacterSnapshot {
  /** characterName -> relation；只记本章有变化或新增的关系。 */
  relations: Record<string, CharacterRelation>;
  /** 情绪标签 ≤ 20 字，可省。 */
  emotion?: string;
  /** 能力 / 状态变化项 ≤ 30 字 × 最多 5 项，可省。 */
  abilities?: string[];
  /** 关键事件 ≤ 40 字 × 最多 3 项，可省。 */
  keyEvents?: string[];
  /** 一句话本章末状态 ≤ 80 字，必填（永远生成）。 */
  summary?: string;
  /**
   * v6 · 双层存档读者层（dual-layer-archive）· 可选。
   * 与事实层（relations / emotion / abilities / keyEvents / summary）平级。
   * 旧 row（v5）/ LLM 漏返回时为 undefined（CK I-1）。
   */
  readerLayer?: ReaderLayerSnapshot;
}

/**
 * v6 · 读者层快照（dual-layer-archive · CK I-1）。
 *
 * 全部字段可选：旧 row + LLM 漏返回 + schema fallback 兼容。
 * 嵌套在 CharacterSnapshot.readerLayer 内 · 不进 dexie 索引（CK I-2）。
 */
export interface ReaderLayerSnapshot {
  /** 读者本章字面看到的客观信息 · 50-150 字 · 不含推理 */
  whatISaw?: string;
  /** 读者已知 + 历史累积推理 · 50-150 字 */
  whatIKnow?: string;
  /** 读者还不知 / 在猜 / 在悬念 · 50-150 字 */
  whatImWondering?: string;
  /** 角色在读者认知里的核心理解 · 一句话 50-100 字 */
  keyUnderstanding?: string;
}

/**
 * 一条角色状态记录（dexie row）。
 *
 * 失败 fallback（CA §4.3 Q3 决议）：
 * - 提取成功 → `snapshot` 是合法对象
 * - 提取失败（LLM JSON 非法 / 网络 / 取消）→ `snapshot = null` 且 `extractionError` 写入原因
 *   UI 据此显式区分"未提取"（无 row）vs"提取了但失败"（有 row + null）
 */
export interface CharacterStateRecord {
  id?: number;
  projectId: number;
  /** 1-based 与 ChapterMeta.index 对齐。 */
  chapterIndex: number;
  /** 角色全名，优先来自 N1.2 人物 Bible（防别名漂移）。 */
  characterName: string;
  /** 失败时为 null，附 `extractionError` 说明。 */
  snapshot: CharacterSnapshot | null;
  /** 仅在 snapshot=null 时填，描述失败原因。 */
  extractionError?: string;
  /** 来源章节版本：草稿（novel.6）或润色（novel.7）。 */
  sourceArtifactNodeId: 'novel.6' | 'novel.7';
  ts: number;
  /** 上游章节被用户修订后置 true，UI 显示黄徽提醒重跑。 */
  stale: boolean;
}

// ─── helpers ──────────────────────────────────────────────────────

/**
 * 写入或更新一条角色状态。
 *
 * 唯一性约束：`(projectId, chapterIndex, characterName)` 三元组。
 * 已存在则 update，不存在则 add。`ts` 由本函数自动注入当前时间戳。
 *
 * 不变量 I-1：本函数不调任何 LLM / fetch（纯 IO）。
 */
export async function upsertCharacterState(
  rec: Omit<CharacterStateRecord, 'id' | 'ts'>,
): Promise<number> {
  const ts = Date.now();
  // 先按复合键查 existing
  const existing = await db.characterStates
    .where('[projectId+chapterIndex+characterName]')
    .equals([rec.projectId, rec.chapterIndex, rec.characterName])
    .first();
  if (existing?.id != null) {
    await db.characterStates.update(existing.id, { ...rec, ts });
    return existing.id;
  }
  return (await db.characterStates.add({ ...rec, ts })) as number;
}

/**
 * 列出某章节所有角色的状态快照。
 *
 * 用于 N3.1 prompt 注入"上一章末状态"（CA §3.5）以及
 * CharacterBible UI 单章节 hover 详情。
 */
export async function listChapterStates(
  projectId: number,
  chapterIndex: number,
): Promise<CharacterStateRecord[]> {
  return db.characterStates
    .where('[projectId+chapterIndex]')
    .equals([projectId, chapterIndex])
    .toArray();
}

/**
 * 列出某角色跨全部章节的时间线（按 chapterIndex 升序）。
 *
 * 用于 CharacterTimelineView 横向时间线渲染。
 */
export async function listCharacterTimeline(
  projectId: number,
  characterName: string,
): Promise<CharacterStateRecord[]> {
  const rows = await db.characterStates
    .where('[projectId+characterName]')
    .equals([projectId, characterName])
    .toArray();
  return rows.sort((a, b) => a.chapterIndex - b.chapterIndex);
}

/**
 * 用户修订第 fromChapter 章后调用：把该章及以后所有 row 标记为 stale。
 *
 * 返回标记的条数（用于 UI 提示"X 条状态已过期"）。
 */
export async function markStateStale(
  projectId: number,
  fromChapter: number,
): Promise<number> {
  return db.characterStates
    .where('projectId')
    .equals(projectId)
    .and((r) => r.chapterIndex >= fromChapter && !r.stale)
    .modify({ stale: true });
}

/**
 * 清空某项目所有角色状态（项目删除 / 重置时使用）。
 *
 * 不主动调用；预留给项目级别的 reset 流程。
 */
export async function clearProjectStates(projectId: number): Promise<void> {
  await db.characterStates.where('projectId').equals(projectId).delete();
}
