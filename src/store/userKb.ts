/**
 * 资料库 v2 —— 用户上传 / 沉淀的知识资料层。
 *
 * 与现有静态 KB（`pipeline/kb.ts` + `public/kb/*.md`）的区别：
 *  - 静态 KB：内置的写作 / 视觉 / 改编红线，启动时从 manifest.json 加载，全用户共享，
 *    在 NODE_KB_MAP 里硬编码哪些节点注入哪些 KB。
 *  - 用户 KB（本模块）：用户自己上传的爆款要点 / 范文 / 反例 / 偏好汇总，存在 Dexie，
 *    账号级（跨项目共享），项目通过 `Project.userKbDocIds` 多选绑定，
 *    按 `type` 分发到对应 prompt 节点。
 *
 * 两个层正交不冲突：在 compose.ts 注入时先注入静态 KB，再注入用户 KB（标题区分）。
 */

import { db } from './db';

/* ───────────────────────────────────────────────────────────────────
 * 类型定义
 * ─────────────────────────────────────────────────────────────────── */

/**
 * 用户上传资料的种类。
 * - `trend`：爆款 / 趋势要点（影响题材选择 / 情绪点 / 反转方式）。注入 N1.1 / N2.1 / N3.1。
 * - `sample`：范文样本（few-shot）。注入 N3.1 / N3.2。
 * - `antiPattern`：反面教材 / 套路黑名单。注入 N3.2 默认润色 + de_ai 模式。
 * - `styleGuide`：风格指南（手写或由 feedback 自动汇总）。全节点。
 * - `worldHardSchema`：世界观硬骨架 / 术语锁。注入 N1.1 / N3.1（防术语漂移）。
 * - `voiceCard`：人物声纹卡。注入 N1.2 + N3.1。
 * - `bookAnalysis`：拆书分析结果（可迁移写作方法论）。注入规划节点 N1.* / N2.*，
 *   不注入执行节点 N3.*（避免上下文过载）。来源：/analyzer 页面。
 */
export type UserKbDocType =
  | 'trend'
  | 'sample'
  | 'antiPattern'
  | 'styleGuide'
  | 'worldHardSchema'
  | 'voiceCard'
  | 'bookAnalysis';

export interface UserKbDoc {
  id?: number;
  /** 类型决定注入到哪个 prompt 节点 */
  type: UserKbDocType;
  /** 用户可读标题，例如「2026 年 4 月爆款要点」「我喜欢的范文 5 段」 */
  title: string;
  /** 来源标识 */
  source: 'upload' | 'manual' | 'auto-summary';
  /** 原始上传的文件名（仅 source='upload' 时有） */
  sourceFilename?: string;
  /** 原始上传内容（.md / .txt 文本）。如果 source='manual'，与 structuredJson 的字符串形式相同 */
  rawContent: string;
  /**
   * LLM 提炼后的结构化 JSON 字符串（按 type 不同 schema）。
   * - trend：{ hotTropes, emotionPeaks, reversalTypes, userExplicitLikes, userExplicitDislikes }
   * - sample：{ samples: [{ excerpt, techniques: [{ id, name, explanation }] }] }
   * - antiPattern：{ patterns: [string] }
   * - styleGuide：自由 markdown
   * - worldHardSchema：{ powerSystem, geography, factions, vocabularyLock, tabooList }
   * - voiceCard：{ characters: [{ name, mbtiType, mantras, forbiddenWords, syntaxStyle, emotionMapping, samples }] }
   */
  structuredJson: string;
  /** 标签（自由），便于筛选 */
  tags: string[];
  /** 是否启用（false ⇒ 即使被项目绑定也不注入，相当于软删除） */
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  /** LLM 提炼时使用的 prompt id 与耗时 token，便于审计 */
  extractMeta?: {
    promptId: string;
    tokens?: number;
    cost?: number;
    durationMs?: number;
    model?: string;
  };
}

/**
 * 用户对生成章节的反馈记录（P2 偏好闭环）。
 * 多条 feedback 攒起来后通过 `summarize-feedback` prompt 汇总成一份
 * `UserKbDoc(type='styleGuide', source='auto-summary')`。
 */
export interface UserKbFeedback {
  id?: number;
  projectId: number;
  /** 章节索引（小说）或 step 序号（其他场景） */
  chapterIndex: number;
  /** 节点 id，方便区分草稿 / 润色 */
  nodeId: string;
  /** 主要问题分类（多选） */
  issues: Array<
    | 'dialogue_stiff'        // 对话太书面
    | 'inner_monologue_heavy' // 心理戏太多
    | 'pacing_slow'           // 节奏拖
    | 'ai_cliche'             // AI 套话太多
    | 'character_flat'        // 人物扁平 / 全员同声
    | 'plot_hole'             // 剧情漏洞
    | 'foreshadow_miss'       // 伏笔没收 / 强行收
    | 'tone_drift'            // 调性漂移
    | 'word_count'            // 字数 / 信息密度问题
    | 'other'
  >;
  /** 用户写的文字理由（可选） */
  reason?: string;
  /** 用户从章节里高亮的负样本片段（可选，最多 2KB） */
  highlightedExcerpt?: string;
  createdAt: number;
}

/* ───────────────────────────────────────────────────────────────────
 * UserKbDoc CRUD
 * ─────────────────────────────────────────────────────────────────── */

export async function listUserKbDocs(opts: {
  type?: UserKbDocType;
  enabledOnly?: boolean;
} = {}): Promise<UserKbDoc[]> {
  let rows = await db.userKbDocs.orderBy('createdAt').reverse().toArray();
  if (opts.type) rows = rows.filter((r) => r.type === opts.type);
  if (opts.enabledOnly) rows = rows.filter((r) => r.enabled);
  return rows;
}

export async function createUserKbDoc(
  doc: Omit<UserKbDoc, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const now = Date.now();
  return (await db.userKbDocs.add({
    ...doc,
    createdAt: now,
    updatedAt: now,
  })) as number;
}

export async function updateUserKbDoc(
  id: number,
  patch: Partial<Omit<UserKbDoc, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.userKbDocs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteUserKbDoc(id: number): Promise<void> {
  await db.userKbDocs.delete(id);
  // Note: 我们不主动清理 Project.userKbDocIds 里指向已删 doc 的悬空引用——
  // 注入层在 loadUserKbForProject 里会自动跳过不存在的 id。
}

/**
 * 给定项目，返回它绑定的 + 启用的全部 UserKbDoc。
 * 自动跳过：① 不存在的 id（悬空引用）② enabled=false 的 doc。
 */
export async function listUserKbDocsForProject(
  bindingIds: number[] | undefined,
): Promise<UserKbDoc[]> {
  if (!bindingIds || bindingIds.length === 0) return [];
  const rows = await db.userKbDocs.bulkGet(bindingIds);
  return rows.filter((r): r is UserKbDoc => r != null && r.enabled);
}

/* ───────────────────────────────────────────────────────────────────
 * UserKbFeedback CRUD
 * ─────────────────────────────────────────────────────────────────── */

export async function recordUserKbFeedback(
  fb: Omit<UserKbFeedback, 'id' | 'createdAt'>,
): Promise<number> {
  return (await db.userKbFeedback.add({
    ...fb,
    createdAt: Date.now(),
  })) as number;
}

export async function listUserKbFeedback(opts: {
  projectId?: number;
  limit?: number;
} = {}): Promise<UserKbFeedback[]> {
  const { projectId, limit = 200 } = opts;
  let rows: UserKbFeedback[];
  if (projectId != null) {
    rows = await db.userKbFeedback.where('projectId').equals(projectId).reverse().sortBy('createdAt');
  } else {
    rows = await db.userKbFeedback.orderBy('createdAt').reverse().toArray();
  }
  return rows.slice(0, limit);
}

export async function deleteUserKbFeedback(id: number): Promise<void> {
  await db.userKbFeedback.delete(id);
}

/** P9-G 批量删除反馈条目 */
export async function bulkDeleteUserKbFeedback(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.userKbFeedback.bulkDelete(ids);
}

/* ───────────────────────────────────────────────────────────────────
 * 显示用工具：type → 中文标签 / 简介
 * ─────────────────────────────────────────────────────────────────── */

export const USER_KB_TYPE_META: Record<UserKbDocType, {
  label: string;
  shortLabel: string;
  description: string;
  /** 该类型注入到哪些节点（仅显示用，实际注入由 compose.ts 决定） */
  injectsTo: string[];
  /** 该类型由哪个 prompt 提炼（用于上传后自动调 LLM） */
  extractPromptId: string;
}> = {
  trend: {
    label: '📊 趋势资料库',
    shortLabel: '趋势',
    description: '爆款要点 / 当下市场热点 / 用户偏好趋势。影响题材、情绪点、反转方式选择。',
    injectsTo: ['N1.1 世界观', 'N2.1 分卷规划', 'N3.1 章节草稿'],
    extractPromptId: 'kb.extract-trend',
  },
  sample: {
    label: '📝 范文库',
    shortLabel: '范文',
    description: '你欣赏的范文段落（few-shot）。LLM 自动挖空 + 标注关键技法。',
    injectsTo: ['N3.1 章节草稿', 'N3.2 润色'],
    extractPromptId: 'kb.extract-sample',
  },
  antiPattern: {
    label: '🚫 反例库',
    shortLabel: '反例',
    description: '套路黑名单 / 烂俗桥段。N3.2 润色（含去 AI 化）会主动避开。',
    injectsTo: ['N3.2 润色'],
    extractPromptId: 'kb.extract-anti-pattern',
  },
  styleGuide: {
    label: '💔 偏好汇总',
    shortLabel: '偏好',
    description: '由你的章节反馈自动汇总，或手动编写。全节点注入。',
    injectsTo: ['全部 novel 节点'],
    extractPromptId: 'kb.summarize-feedback',
  },
  worldHardSchema: {
    label: '🗺 世界硬骨架',
    shortLabel: '世界',
    description: '世界观 / 术语锁 / 派系等硬数据。防术语漂移。',
    injectsTo: ['N1.1 世界观', 'N3.1 章节草稿'],
    extractPromptId: 'kb.extract-world-schema',
  },
  voiceCard: {
    label: '🎭 声纹卡',
    shortLabel: '声纹',
    description: '人物专属说话方式（口头禅 / 句式 / 禁用词）。防全员同声。',
    injectsTo: ['N1.2 人物 bible', 'N3.1 章节草稿'],
    extractPromptId: 'kb.extract-voice-card',
  },
  bookAnalysis: {
    label: '🔍 拆书分析',
    shortLabel: '拆书',
    description: '从参考作品提炼的可迁移写作方法论（世界观/角色/剧情维度 + 核心工艺原则）。来源：/analyzer。',
    injectsTo: ['N1.* 世界观/人物', 'N2.* 分卷分章'],
    extractPromptId: 'analyzer.book-analysis', // 由 /analyzer 页面直接生成，不走 extract-* 流程
  },
};

export const USER_KB_FEEDBACK_ISSUE_META: Record<UserKbFeedback['issues'][number], string> = {
  dialogue_stiff: '对话太书面 / 没有人味',
  inner_monologue_heavy: '心理戏太多 / 主角像哲学家',
  pacing_slow: '节奏拖 / 强行填字数',
  ai_cliche: 'AI 套话 / 机械连词',
  character_flat: '人物扁平 / 全员同声',
  plot_hole: '剧情漏洞 / 逻辑不通',
  foreshadow_miss: '伏笔没收 / 强行回收',
  tone_drift: '调性漂移 / 风格不一致',
  word_count: '字数 / 信息密度问题',
  other: '其他',
};
