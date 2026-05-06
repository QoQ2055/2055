// ─────────────────────────────────────────────────────────────────────────
// Book Analyzer · 网文拆书分析师
//
// 用户提供参考小说的若干章节（每章打"位置标签"），AI 输出可迁移的写作
// 方法论 — 覆盖世界观 / 角色 / 剧情三大维度 + 按位置的局部洞察 + 全书
// 核心方法论提炼。
//
// 关键创新（提炼自天命平台拆书分析师 prompt）：
//   1. 结构锚点位置标签法：让 AI 明确知道每章在全书的位置（黄金章 / 10% /
//      50% / 80% / 结尾 / AI 精华章），按位置应用不同分析框架。
//   2. 三维度方法论提炼：不复述原书情节，而是输出"为什么这样写有效"+
//      "如何在新作中复用"。
//   3. 两阶段法（与 docs/internal-notes/deepseek-v4-tuning-guide.md §6 呼应）：
//      本工具天然属于"解构"阶段（提取抽象模式），后续用户在新作中应用时
//      就是"重构"阶段。
//
// LLM 配置（按 docs/internal-notes/deepseek-v4-tuning-guide.md §1.2）：
//   - 推荐 V4 Pro + Thinking 启用 + 纯分析模式 prompt
//   - response_format = json_object（强制结构化输出）
//   - 调用方可通过 thinking 参数选择是否启用（默认 enabled）
//
// Reference:
//   - docs/internal-notes/novel-creation-pipeline-spec.md §2 (拆书分析阶段)
//   - docs/reference-works/tianming-platform-prompts-original.txt L1-21
// ─────────────────────────────────────────────────────────────────────────

import { chatStream } from '../llm/deepseek';
import { estimateCost } from '../llm/cost';

/** 应用于 3 个调用函数（single / stage1 / stage2）的公共出口解析：
 *  去除代码围栏 → trim → JSON.parse，失败报错拼接原始输出前 500 字。 */
function parseStrictJson<T>(raw: string, label: string): { value: T; stripped: string } {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) throw new Error(`${label} 返回为空`);
  const stripped = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try {
    return { value: JSON.parse(stripped) as T, stripped };
  } catch (e: any) {
    throw new Error(`${label} JSON 解析失败：${e?.message ?? e}\n\n原始输出（前 500 字）：${stripped.slice(0, 500)}`);
  }
}

// ───────────── 类型 ─────────────

/** 章节在参考小说中的位置标签（结构锚点） */
export type ChapterTag =
  | 'golden'        // 黄金章（开篇 1-3 章）：钩子 / 人设 / 世界观铺垫
  | 'arc-10'        // 开篇 10%：第一个冲突爆发 + 节奏升级
  | 'arc-50'        // 中段 50%：中段转折 + 矛盾深化
  | 'arc-80'        // 高潮 80%：高潮蓄力 + 情绪推进
  | 'finale'        // 结尾章：收尾 + 情感落点
  | 'aiPick';       // AI 精华章：高能场面 / 名场面写法

export interface ChapterTagMeta {
  id: ChapterTag;
  label: string;
  position: string;
  analysisFocus: string;
}

export const CHAPTER_TAGS: ChapterTagMeta[] = [
  { id: 'golden',  label: '黄金章',     position: '开篇 1-3 章',  analysisFocus: '钩子构建 / 人设建立 / 世界观铺垫' },
  { id: 'arc-10',  label: '开篇 10%',   position: '全书 ~10%',   analysisFocus: '第一个冲突爆发 + 节奏升级' },
  { id: 'arc-50',  label: '中段 50%',   position: '全书 ~50%',   analysisFocus: '中段转折 + 矛盾深化 + 节奏控制' },
  { id: 'arc-80',  label: '高潮 80%',   position: '全书 ~80%',   analysisFocus: '高潮蓄力 + 情绪推进 + 爆发手法' },
  { id: 'finale',  label: '结尾章',     position: '末章',        analysisFocus: '结局收尾 + 情感落点 + 主题升华' },
  { id: 'aiPick',  label: 'AI 精华章',  position: '高能场面',     analysisFocus: '名场面写法 / 高光时刻技巧' },
];

const TAG_BY_ID = CHAPTER_TAGS.reduce(
  (m, t) => ({ ...m, [t.id]: t }),
  {} as Record<ChapterTag, ChapterTagMeta>,
);

export function findChapterTag(id: ChapterTag): ChapterTagMeta {
  return TAG_BY_ID[id];
}

export interface ReferenceChapter {
  /** 用户给章节起的标题（"第一章·觉醒" 等，可选） */
  title?: string;
  /** 章节在参考小说中的位置标签 */
  tag: ChapterTag;
  /** 章节正文（用户粘贴的原文） */
  text: string;
}

export interface BookMeta {
  title?: string;
  author?: string;
  genre?: string;
}

/** 拆书分析的结构化输出 */
export interface BookAnalysisResult {
  bookMeta: BookMeta;
  /** 世界观维度的可迁移分析 */
  worldview: {
    summary: string;
    coreRules: string;
    tropesAndArchetypes: string;
  };
  /** 角色维度的可迁移分析 */
  characters: {
    protagonistDesign: string;
    castStructure: string;
    arcMethodology: string;
  };
  /** 剧情维度的可迁移分析 */
  plot: {
    macroStructure: string;
    pacingControl: string;
    foreshadowingAndPayoff: string;
    keyTurningPoints: string[];
  };
  /** 按位置标签的局部洞察 */
  positionInsights: Array<{
    tag: ChapterTag;
    chapterTitle?: string;
    whyItWorks: string;
    transferableTechnique: string;
  }>;
  /** 全书核心方法论提炼（最有价值的可迁移知识） */
  methodology: {
    hookFormula: string;
    conflictModel: string;
    rhythmSignature: string;
    coreCraftPrinciples: string[];
  };
}

// ───────────── Prompt 构造 ─────────────

const SYSTEM_PROMPT = `你是一位资深的网文拆书分析师，擅长从已有作品中提炼可迁移的写作方法论。

【核心任务】
从用户提供的参考小说章节中，提炼覆盖世界观、角色、剧情三大维度的可迁移写作方法论。

【上下文章节说明】
用户会提供若干章节，每章标题后附有位置标签，含义如下：
- [黄金章]：开篇 1-3 章，代表作者吸引读者的核心手法，重点分析钩子、人设建立、世界观铺垫
- [开篇 10%]：全书约 10% 处，分析第一个冲突爆发和节奏升级的方式
- [中段 50%]：全书约 50% 处，分析中段转折、矛盾深化和节奏控制
- [高潮 80%]：全书约 80% 处，分析高潮蓄力、情绪推进和爆发手法
- [结尾章]：末章，分析结局收尾方式和情感落点
- [AI 精华章]：基于热评和章节目录挑选的高能场面，重点分析名场面的写法技巧

【分析要求】
- 结合各章节来源标签，从对应结构位置理解作者的写作意图
- 提炼「为什么这样写有效」和「如何在新作中复用」两层信息
- 每个字段输出 200-500 字的深度分析
- 输出可直接作为新作创作参考的方法论，**而非复述原书情节**
- 严禁照搬原书的具体角色名 / 地名 / 事件描述（这些是个例，不是方法论）

【思维要求】
请以纯分析模式进行推理：
- 不使用角色第一人称内心独白，直接进行逻辑分析
- 先识别每章的"结构功能"，再提炼"达成功能的具体技法"
- 区分"普适方法"（可迁移）和"作者个人偏好"（难复用）

【输出格式】
严格输出 JSON 对象，schema 如下：
{
  "bookMeta": { "title": string, "author": string, "genre": string },
  "worldview": {
    "summary": "作品世界观的核心定位（80-150 字）",
    "coreRules": "作者建立世界观的核心规则与硬约束（200-400 字）",
    "tropesAndArchetypes": "使用的题材套路与原型（150-300 字）"
  },
  "characters": {
    "protagonistDesign": "主角设计方法论（外在目标 / 内在缺陷 / 成长弧）（200-400 字）",
    "castStructure": "配角结构与功能分配（150-300 字）",
    "arcMethodology": "角色弧线的设计方法（200-400 字）"
  },
  "plot": {
    "macroStructure": "全书宏观结构（三幕 / 多卷 / 螺旋等，200-400 字）",
    "pacingControl": "节奏控制手法（短句快推 / 长句沉浸 / 钩子密度等，200-400 字）",
    "foreshadowingAndPayoff": "伏笔与回收的设计（150-300 字）",
    "keyTurningPoints": ["关键转折点 1（从位置标签反推）", "关键转折点 2", "..."]
  },
  "positionInsights": [
    {
      "tag": "golden | arc-10 | arc-50 | arc-80 | finale | aiPick",
      "chapterTitle": "用户提供的章节标题（可选）",
      "whyItWorks": "这一位置的章节为什么这样写有效（200-400 字）",
      "transferableTechnique": "可以如何复用到新作（200-400 字）"
    }
  ],
  "methodology": {
    "hookFormula": "本作的钩子配方（开篇钩 / 章末钩 / 卷末钩的统一模式）（150-300 字）",
    "conflictModel": "本作的冲突模型（角色冲突 / 价值观冲突 / 系统冲突 等）（150-300 字）",
    "rhythmSignature": "本作的节奏签名（一句话总结识别度，如'三章一爽点 + 十章一反转'）（80-150 字）",
    "coreCraftPrinciples": [
      "本作最核心的可迁移工艺原则 1",
      "原则 2",
      "原则 3-5 条"
    ]
  }
}

【严禁】
- 把原书具体角色名 / 地名 / 物品名作为方法论的一部分（必须抽象化）
- 复述章节情节作为分析（必须提炼出"作者为什么这样写"）
- 输出超出 schema 之外的字段
- 把 JSON 包装在 markdown 代码块内（直接输出 JSON 对象）`;

function buildUserMessage(args: {
  bookMeta?: BookMeta;
  chapters: ReferenceChapter[];
}): string {
  const { bookMeta, chapters } = args;
  const parts: string[] = [];

  parts.push('# 参考小说基础信息');
  parts.push(`- 书名：${bookMeta?.title || '（用户未提供）'}`);
  parts.push(`- 作者：${bookMeta?.author || '（用户未提供）'}`);
  parts.push(`- 类型：${bookMeta?.genre || '（用户未提供）'}`);
  parts.push('');
  parts.push('# 参考章节正文');
  parts.push('');

  chapters.forEach((ch, i) => {
    const tag = findChapterTag(ch.tag);
    parts.push(`## 章节 ${i + 1} · ${ch.title || '（未命名）'} · [${tag.label}]`);
    parts.push(`**位置**：${tag.position}（${tag.analysisFocus}）`);
    parts.push('');
    parts.push('---');
    parts.push(ch.text);
    parts.push('---');
    parts.push('');
  });

  parts.push('# 任务');
  parts.push('请按 system prompt 中定义的 JSON schema 输出深度拆书分析。');
  parts.push('请特别注意：positionInsights 数组应该覆盖**所有用户提供的章节标签**，每个章节生成一条洞察。');

  return parts.join('\n');
}

// ───────────── 调用函数 ─────────────

export interface RunBookAnalysisOptions {
  bookMeta?: BookMeta;
  chapters: ReferenceChapter[];
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** 是否启用 V4 Thinking Mode（推荐启用，结构化分析受益最大）。默认 true */
  useThinking?: boolean;
  signal?: AbortSignal;
  /** 流式接收正式 JSON 输出 */
  onDelta?: (chunk: string, full: string) => void;
  /** 流式接收 V4 思维链（仅 useThinking=true 时） */
  onReasoningDelta?: (chunk: string, full: string) => void;
}

export interface RunBookAnalysisResult {
  result: BookAnalysisResult;
  rawJson: string;
  reasoningContent?: string;
  durationMs: number;
  tokens?: number;
  cost?: number;
}

/**
 * 执行拆书分析。流式返回 JSON（onDelta），完成后解析为结构化结果。
 * 失败时抛出 Error。
 */
export async function runBookAnalysis(opts: RunBookAnalysisOptions): Promise<RunBookAnalysisResult> {
  if (!opts.chapters || opts.chapters.length === 0) {
    throw new Error('请至少提供一个章节用于分析');
  }
  if (!opts.baseUrl || !opts.apiKey || !opts.model) {
    throw new Error('LLM 调用配置不完整（baseUrl / apiKey / model）');
  }

  const userMsg = buildUserMessage({ bookMeta: opts.bookMeta, chapters: opts.chapters });

  const useThinking = opts.useThinking !== false; // default true
  const res = await chatStream({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ],
    max_tokens: opts.maxTokens ?? 16384,
    // Thinking Mode 启用时 temperature 失效，由 deepseek.ts 自动处理
    thinking: useThinking ? { enabled: true, effort: 'high' } : { enabled: false },
    responseFormat: 'json_object',
    signal: opts.signal,
    onDelta: opts.onDelta,
    onReasoningDelta: opts.onReasoningDelta,
  });

  const { value: parsed, stripped } = parseStrictJson<BookAnalysisResult>(res.content ?? '', '模型');

  // 最小验证
  if (!parsed.worldview || !parsed.characters || !parsed.plot || !parsed.methodology) {
    throw new Error('输出 schema 不完整，缺少必填顶层字段');
  }

  return {
    result: parsed,
    rawJson: stripped,
    reasoningContent: res.reasoningContent,
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens,
    cost: estimateCost(res.usage),
  };
}

/* ─────────────────────────────────────────────────────────────────
 * v2 阶段 2.5 · 拆书两阶段法（Two-Stage Book Analysis）
 *
 * 思路对应 docs/internal-notes/deepseek-v4-tuning-guide.md §6：
 *   Stage 1 (Decompose / 解构)：先做轻量框架扫描，输出每章结构功能定位 +
 *     全书三维度的高层概要（≤ 6 字段，每字段 ≤ 200 字）。预算 ~2k token。
 *   Stage 2 (Recompose / 重构)：把 stage1 输出回灌到 system prompt 中作为
 *     "已确定的框架"，让模型把精力集中在"达成框架的具体技法"上，输出完整的
 *     BookAnalysisResult。
 *
 * 优势：
 *   - 同样的 token 预算下能拿到更深、更精确的方法论（思维链对齐）
 *   - 用户可在 Stage 1 后干预（增删章节、修订框架），节省返工
 *   - Stage 1 失败时仍可降级单阶段调用（runBookAnalysis）
 * ───────────────────────────────────────────────────────────────── */

/** Stage 1 框架扫描产物（轻量，可在 UI 上让用户复核 / 编辑） */
export interface BookAnalysisStage1 {
  /** 全书定位的一句话标签（如"系统流爽文 · 升级流 · 男频"） */
  bookPositioning: string;
  /** 全书宏观结构骨架（80-200 字） */
  macroSkeleton: string;
  /** 全书节奏签名（≤ 80 字） */
  rhythmSignature: string;
  /** 主线冲突模型（80-150 字） */
  conflictModel: string;
  /** 每章在全书结构中的功能定位（顺序与 chapters 输入对应） */
  chapterFunctions: Array<{
    tag: ChapterTag;
    chapterTitle?: string;
    /** 该章承担的结构功能（30-80 字，如"建立钩子 + 抛出主矛盾"） */
    structuralFunction: string;
  }>;
  /** Stage 2 应当重点深挖的 3-5 个问题（用于 stage 2 的 system prompt 注入） */
  stage2Focus: string[];
}

const STAGE1_SYSTEM_PROMPT = `你是网文拆书分析师。本次任务是「拆书两阶段法」的 **第一阶段：框架扫描**。

【目标】
快速识别全书的结构骨架与每章的结构功能，**不要做技法层面的深挖**——那是第二阶段的任务。

【输出原则】
- 全部字段都要简短克制（按 schema 字数上限），把 token 预算留给第二阶段
- 不要复述章节情节，只输出"该章在全书中干了什么活"
- 如果章节信息不足以判定，宁可输出"信息不足"也不要瞎编
- chapterFunctions 数组顺序必须与用户输入的章节顺序一致

【输出格式】
严格输出 JSON 对象：
{
  "bookPositioning": "全书一句话定位（如：玄幻 · 升级流 · 男频，≤ 30 字）",
  "macroSkeleton": "全书宏观结构骨架（80-200 字）",
  "rhythmSignature": "全书节奏签名（≤ 80 字）",
  "conflictModel": "主线冲突模型（80-150 字）",
  "chapterFunctions": [
    { "tag": "<ChapterTag>", "chapterTitle": "<可选>", "structuralFunction": "该章承担的结构功能（30-80 字）" }
  ],
  "stage2Focus": [
    "第二阶段应该深挖的问题 1（可执行的 how 类问题）",
    "问题 2",
    "...3-5 条"
  ]
}

【严禁】
- 输出超过 schema 的字段
- 把 JSON 包在 markdown 代码块内
- 输出任何具体角色 / 地名（这些在第二阶段才会被抽象成方法论）
`.trim();

function buildStage1UserMessage(args: {
  bookMeta?: BookMeta;
  chapters: ReferenceChapter[];
}): string {
  const { bookMeta, chapters } = args;
  const parts: string[] = [];
  parts.push('# 参考小说基础信息');
  parts.push(`- 书名：${bookMeta?.title || '（用户未提供）'}`);
  parts.push(`- 作者：${bookMeta?.author || '（用户未提供）'}`);
  parts.push(`- 类型：${bookMeta?.genre || '（用户未提供）'}`);
  parts.push('');
  parts.push('# 章节列表（按顺序）');
  chapters.forEach((ch, i) => {
    const tag = findChapterTag(ch.tag);
    parts.push(`## 章节 ${i + 1} · ${ch.title || '（未命名）'} · [${tag.label}]`);
    parts.push(`**位置**：${tag.position} · ${tag.analysisFocus}`);
    parts.push('');
    parts.push('---');
    parts.push(ch.text);
    parts.push('---');
    parts.push('');
  });
  parts.push('# 任务');
  parts.push('请按 system prompt 输出 Stage 1 框架扫描 JSON。');
  parts.push(`chapterFunctions 数组必须包含 ${chapters.length} 项，顺序与上方一致。`);
  return parts.join('\n');
}

export interface RunStage1Options {
  bookMeta?: BookMeta;
  chapters: ReferenceChapter[];
  baseUrl: string;
  apiKey: string;
  model: string;
  /** stage 1 默认不启用 thinking，节省时间 */
  useThinking?: boolean;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  onReasoningDelta?: (chunk: string, full: string) => void;
}

export interface RunStage1Result {
  result: BookAnalysisStage1;
  rawJson: string;
  reasoningContent?: string;
  durationMs: number;
  tokens?: number;
  cost?: number;
}

/** Stage 1：框架扫描（轻量、快速、可被用户干预） */
export async function runBookAnalysisStage1(opts: RunStage1Options): Promise<RunStage1Result> {
  if (!opts.chapters || opts.chapters.length === 0) {
    throw new Error('请至少提供一个章节用于分析');
  }
  if (!opts.baseUrl || !opts.apiKey || !opts.model) {
    throw new Error('LLM 调用配置不完整');
  }
  const userMsg = buildStage1UserMessage({ bookMeta: opts.bookMeta, chapters: opts.chapters });
  const useThinking = opts.useThinking === true; // default false（与 stage2 默认相反）

  const res = await chatStream({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    messages: [
      { role: 'system', content: STAGE1_SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ],
    max_tokens: 4096,
    thinking: useThinking ? { enabled: true, effort: 'high' } : { enabled: false },
    responseFormat: 'json_object',
    signal: opts.signal,
    onDelta: opts.onDelta,
    onReasoningDelta: opts.onReasoningDelta,
  });

  const { value: parsed, stripped } = parseStrictJson<BookAnalysisStage1>(res.content ?? '', 'Stage 1');
  if (!parsed.bookPositioning || !parsed.macroSkeleton || !Array.isArray(parsed.chapterFunctions)) {
    throw new Error('Stage 1 schema 不完整，缺少必填字段');
  }

  return {
    result: parsed,
    rawJson: stripped,
    reasoningContent: res.reasoningContent,
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens,
    cost: estimateCost(res.usage),
  };
}

/** 用 Stage 1 结果构建 Stage 2 注入段（放在 system 消息末尾） */
function buildStage2Preamble(stage1: BookAnalysisStage1): string {
  const lines: string[] = [];
  lines.push('# Stage 1 框架扫描结果（已确定，请勿改写）');
  lines.push(`- **全书定位**：${stage1.bookPositioning}`);
  lines.push(`- **宏观骨架**：${stage1.macroSkeleton}`);
  lines.push(`- **节奏签名**：${stage1.rhythmSignature}`);
  lines.push(`- **冲突模型**：${stage1.conflictModel}`);
  lines.push('');
  lines.push('## 各章结构功能定位');
  stage1.chapterFunctions.forEach((c, i) => {
    const tag = findChapterTag(c.tag)?.label ?? c.tag;
    lines.push(`${i + 1}. [${tag}] ${c.chapterTitle ?? '（未命名）'}：${c.structuralFunction}`);
  });
  if (stage1.stage2Focus.length > 0) {
    lines.push('');
    lines.push('## Stage 2 应重点深挖的问题');
    stage1.stage2Focus.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  }
  lines.push('');
  lines.push('# Stage 2 任务');
  lines.push('在上述框架已确定的前提下，深入挖掘"达成这些结构功能的具体写作技法"。');
  lines.push('避免重复 Stage 1 已经定调的内容，把分析重心放在 **how / why** 而非 **what**。');
  return lines.join('\n');
}

export interface RunStage2Options {
  bookMeta?: BookMeta;
  chapters: ReferenceChapter[];
  stage1: BookAnalysisStage1;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** stage 2 默认启用 thinking */
  useThinking?: boolean;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  onReasoningDelta?: (chunk: string, full: string) => void;
}

/**
 * Stage 2：在 Stage 1 框架已确定的前提下，输出完整的 BookAnalysisResult。
 * 注入 stage1 摘要为模型做"重构"导航。
 */
export async function runBookAnalysisStage2(opts: RunStage2Options): Promise<RunBookAnalysisResult> {
  if (!opts.chapters || opts.chapters.length === 0) {
    throw new Error('请至少提供一个章节用于分析');
  }
  if (!opts.baseUrl || !opts.apiKey || !opts.model) {
    throw new Error('LLM 调用配置不完整');
  }
  if (!opts.stage1) {
    throw new Error('Stage 2 需要 stage1 结果，请先运行 runBookAnalysisStage1');
  }

  const userMsg = buildUserMessage({ bookMeta: opts.bookMeta, chapters: opts.chapters });
  const stage1Preamble = buildStage2Preamble(opts.stage1);
  const useThinking = opts.useThinking !== false; // default true

  const res = await chatStream({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + stage1Preamble },
      { role: 'user', content: userMsg },
    ],
    max_tokens: opts.maxTokens ?? 16384,
    thinking: useThinking ? { enabled: true, effort: 'high' } : { enabled: false },
    responseFormat: 'json_object',
    signal: opts.signal,
    onDelta: opts.onDelta,
    onReasoningDelta: opts.onReasoningDelta,
  });

  const { value: parsed, stripped } = parseStrictJson<BookAnalysisResult>(res.content ?? '', 'Stage 2');
  if (!parsed.worldview || !parsed.characters || !parsed.plot || !parsed.methodology) {
    throw new Error('Stage 2 schema 不完整，缺少必填顶层字段');
  }

  return {
    result: parsed,
    rawJson: stripped,
    reasoningContent: res.reasoningContent,
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens,
    cost: estimateCost(res.usage),
  };
}
