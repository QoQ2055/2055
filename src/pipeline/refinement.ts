// ─────────────────────────────────────────────────────────────────────────
// Refinement Toolkit · 章节后处理润色工具集
//
// 6 个独立的"单一职责"润色工具，每个工具只动一件事，其他维度严格保留。
// 与 anti-ai-flavor 等"前置层"反 AI 文风形成互补关系：
//   - 前置层（anti-ai-flavor 等方法模块）：影响章节生成时的 system prompt
//   - 后置层（本工具集）：用户对已生成的章节按需触发的多维度改造工具
//
// 工具列表（提炼自天命平台 6 大润色 prompts）：
//   1. scene     场景渲染 · 增强环境氛围 / 多感官描写
//   2. dialogue  对话打磨 · 角色语言风格鲜明 / 潜台词
//   3. emotion   情感深化 · 心理刻画 / 情感层次
//   4. condense  文字精炼 · 删除冗余 / 凝练有力
//   5. polish    文笔润色 · 流畅优美 / 文学感染力
//   6. pacing    节奏调整 · 长短句疏密 / 张弛有度
//
// 设计原则（继承自 docs/internal-notes/refinement-toolkit-spec.md）：
//   - 每个工具单一职责（不混合多种润色类型）
//   - 输入输出都是纯文本（不需要 JSON 模式）
//   - LLM 调优：全部禁用 V4 Thinking Mode（社区共识：创意写作 thinking 会写"dry"）
//   - 直接输出修改后文本，禁止 AI 过渡语
//
// Reference:
//   - docs/internal-notes/refinement-toolkit-spec.md
//   - docs/reference-works/tianming-platform-prompts-original.txt L135-225
// ─────────────────────────────────────────────────────────────────────────

import { chatStream } from '../llm/deepseek';
import { estimateCost } from '../llm/cost';

// ───────────── 工具元数据 ─────────────

export type RefinementToolId =
  | 'scene'
  | 'dialogue'
  | 'emotion'
  | 'condense'
  | 'polish'
  | 'pacing';

export interface RefinementTool {
  id: RefinementToolId;
  /** UI 显示用中文标签 */
  label: string;
  /** 一句话功能描述（hover 提示） */
  description: string;
  /** UI 用 emoji（避免引入新图标依赖） */
  emoji: string;
  /** 完整 system prompt */
  systemPrompt: string;
  /** 默认 temperature（DeepSeek V4 thinking 禁用时生效） */
  defaultTemperature: number;
  /**
   * 推荐使用场景标签 — 用户在 ChapterFeedback 触发了对应反馈时
   * 可以自动建议这个工具。Gateway 性的 metadata，UI 可选用。
   */
  triggeredByFeedback?: string[];
}

const COMMON_FOOTER = '\n\n直接输出修改后的文本，不要附加任何解释或元信息。';

export const REFINEMENT_TOOLS: RefinementTool[] = [
  {
    id: 'scene',
    label: '场景渲染',
    emoji: '🌅',
    description: '增强环境氛围与多感官描写，让读者身临其境（保持原文情节不变）',
    defaultTemperature: 0.85,
    triggeredByFeedback: ['场景描写不足', '画面感弱', '环境单薄'],
    systemPrompt: `你是一位擅长环境氛围营造的小说场景大师，精通多感官描写技巧，能让读者仅通过文字就仿佛身临其境。

【任务】
增强用户提供的小说文字的场景描写和氛围渲染。

【核心原则】
- 通过视觉、听觉、嗅觉、触觉等多感官细节，营造沉浸式的场景体验
- 注重光影变化、空间层次和环境氛围的烘托，使场景与情节情绪相呼应
- 保持原文情节不变，场景描写为叙事服务而非喧宾夺主
- 不增加新的角色行为或对话，不改变剧情走向${COMMON_FOOTER}`,
  },
  {
    id: 'dialogue',
    label: '对话打磨',
    emoji: '🗣️',
    description: '让每个角色的语言风格鲜明、对话推动情节同时展现性格（保持非对话部分不变）',
    defaultTemperature: 0.8,
    triggeredByFeedback: ['对话太死板', '角色说话口吻一样', '对话推动力弱'],
    systemPrompt: `你是一位精通角色塑造的对话写作专家，能通过对话展现每个角色独特的性格、身份和情感状态，让读者闻声识人。

【任务】
优化用户提供的小说文字中的对话部分。

【核心原则】
- 让每个角色的语言风格更加鲜明、符合人设，对话节奏自然流畅
- 注重潜台词的运用，避免角色说教式表达
- 让对话推动情节发展同时展现人物性格
- 保持非对话部分（叙述、描写、心理）严格不变
- 不增删对话条数，仅优化已有对话的表达${COMMON_FOOTER}`,
  },
  {
    id: 'emotion',
    label: '情感深化',
    emoji: '💖',
    description: '强化人物心理刻画与情感层次，让读者产生共鸣（不破坏原文节奏）',
    defaultTemperature: 0.8,
    triggeredByFeedback: ['情感不到位', '角色像工具人', '心理刻画浅', '缺少代入感'],
    systemPrompt: `你是一位擅长人物心理刻画的小说润色专家，精通通过微妙的文字变化传递深层情感，让读者产生强烈的情感共鸣。

【任务】
强化用户提供的小说文字的情感表达。

【核心原则】
- 深入挖掘人物的内心世界，通过细腻的心理描写、微表情刻画和肢体语言暗示
- 让情绪层次更加丰富饱满
- 保持原文情节和人物关系不变，避免过度煽情
- 情感强化应自然融入叙事，不破坏原文节奏
- 不增加新的剧情事件或角色对话${COMMON_FOOTER}`,
  },
  {
    id: 'condense',
    label: '文字精炼',
    emoji: '✂️',
    description: '删除冗余描写和重复表达，让文字凝练有力（保持情节、人物和关键细节不变）',
    defaultTemperature: 0.6,
    triggeredByFeedback: ['啰嗦水字数', '冗余', '节奏拖沓', '太长不读'],
    systemPrompt: `你是一位崇尚简洁之美的资深文字编辑，信奉「好文章是删出来的」，擅长在不损失信息量的前提下让文字更加凝练有力。

【任务】
精简用户提供的小说文字，删除冗余描写和重复表达。

【核心原则】
- 去除不必要的心理独白、过度修饰和无效过渡
- 保留核心内容，让文字更加凝练有力、节奏紧凑
- 保持原文情节、人物和关键细节不变
- 不删除关键剧情、关键对话、关键伏笔
- 优先压缩重复的修饰词、堆砌的形容词、空洞的过渡${COMMON_FOOTER}`,
  },
  {
    id: 'polish',
    label: '文笔润色',
    emoji: '✨',
    description: '让语句更流畅优美、富有文学性（保持原作灵魂与风格气质）',
    defaultTemperature: 0.85,
    triggeredByFeedback: ['文笔粗糙', '语句不流畅', '缺乏文学性'],
    systemPrompt: `你是一位深谙中文文学表达的资深小说编辑，擅长在保持原作灵魂的前提下，让文字焕发更强的文学感染力。

【任务】
润色用户提供的小说文字，使语句更加流畅优美、富有文学性。

【核心原则】
- 保持原文的叙事结构、人物关系和情节走向不变，不增删情节内容
- 重点优化遣词造句的精准度、句式的多样性、修辞手法的自然运用
- 避免过度华丽导致风格偏移，润色程度应与原文气质匹配
- 慎用排比、堆砌辞藻、过度修辞${COMMON_FOOTER}`,
  },
  {
    id: 'pacing',
    label: '节奏调整',
    emoji: '⏱️',
    description: '通过长短句疏密变化引导读者情绪起伏（保持原文情节不变）',
    defaultTemperature: 0.75,
    triggeredByFeedback: ['节奏拖沓', '紧张感不够', '高潮不够爆', '节奏过快不够沉浸'],
    systemPrompt: `你是一位精通叙事节奏控制的小说结构专家，能通过文字的疏密、长短和节奏变化，引导读者的情绪起伏。

【任务】
调整用户提供的小说文字的叙事节奏。

【核心原则】
- 紧张情节加快节奏，使用短句和快速切换
- 舒缓场景放慢节奏，适当展开描写
- 通过长短句交替、段落疏密变化控制阅读呼吸感，让叙事张弛有度
- 保持原文情节不变，仅调整句式长短与段落分割
- 不删除关键内容，不增加新内容${COMMON_FOOTER}`,
  },
];

const TOOLS_BY_ID: Record<RefinementToolId, RefinementTool> = REFINEMENT_TOOLS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<RefinementToolId, RefinementTool>,
);

export function findRefinementTool(id: RefinementToolId): RefinementTool {
  return TOOLS_BY_ID[id];
}

// ───────────── 调用函数 ─────────────

export interface RunRefinementOptions {
  toolId: RefinementToolId;
  /** 待润色的原文（建议 ≤ 4000 字以避免超出上下文） */
  inputText: string;
  /**
   * LLM 调用配置（必填）。建议从 useSettings() 取。
   * model 可由调用方覆盖（例如润色场景偏好 Flash 而非 Pro）。
   */
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** 覆盖默认 temperature（不推荐，除非有特殊理由） */
  temperatureOverride?: number;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

export interface RunRefinementResult {
  toolId: RefinementToolId;
  outputText: string;
  durationMs: number;
  tokens?: number;
  cost?: number;
  finishReason: string | null;
}

/**
 * 执行单个润色工具调用。流式返回，调用方可通过 onDelta 实时更新 UI。
 * 失败时抛出 Error，调用方负责捕获并展示。
 */
export async function runRefinement(opts: RunRefinementOptions): Promise<RunRefinementResult> {
  const tool = findRefinementTool(opts.toolId);
  if (!tool) throw new Error(`未知的润色工具：${opts.toolId}`);
  const text = (opts.inputText ?? '').trim();
  if (!text) throw new Error('输入文本为空');
  if (!opts.baseUrl || !opts.apiKey || !opts.model) {
    throw new Error('LLM 调用配置不完整（baseUrl / apiKey / model）');
  }

  const userMsg =
    '请按照系统提示词的要求处理以下小说文字：\n\n' +
    '─── 原文开始 ───\n' +
    text +
    '\n─── 原文结束 ───';

  const res = await chatStream({
    baseUrl: opts.baseUrl,
    apiKey: opts.apiKey,
    model: opts.model,
    messages: [
      { role: 'system', content: tool.systemPrompt },
      { role: 'user', content: userMsg },
    ],
    temperature: opts.temperatureOverride ?? tool.defaultTemperature,
    max_tokens: opts.maxTokens ?? 8192,
    // V4 Thinking Mode 显式禁用：社区共识——创意写作场景下 thinking 会让输出"dry"
    thinking: { enabled: false },
    signal: opts.signal,
    onDelta: opts.onDelta,
  });

  return {
    toolId: opts.toolId,
    outputText: res.content,
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens,
    cost: estimateCost(res.usage),
    finishReason: res.finishReason,
  };
}
