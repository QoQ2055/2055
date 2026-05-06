/**
 * 资料库 v2 · LLM 提炼 helper
 *
 * 把用户上传的原始内容（爆款要点 / 范文 / 反例 / 反馈合集）通过对应的
 * `public/prompts/kb/*.json` prompt 调一次 LLM，得到结构化 JSON。
 *
 * 不走 manifest.ts / runner.ts 的主流水线（避免污染 runHistory + 触发 chain
 * 自动联动），独立调 chatStream 即可。
 */

import { chatStream, type ChatMessage } from './deepseek';
import { parseLooseJson } from '../pipeline/jsonLoose';
import { useSettings } from '../store/settings';
import type { UserKbDocType } from '../store/userKb';
import { USER_KB_TYPE_META } from '../store/userKb';

/** 加载 kb prompt（独立缓存，不与主 manifest payload cache 干扰） */
const _kbPromptCache = new Map<string, RawKbPrompt>();

interface RawKbPrompt {
  id: string;
  title?: string;
  description?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

function resolveAsset(p: string): string {
  return './' + p.replace(/^\.?\/?/, '');
}

async function loadKbPrompt(filename: string): Promise<RawKbPrompt> {
  const cached = _kbPromptCache.get(filename);
  if (cached) return cached;
  const res = await fetch(resolveAsset(`prompts/kb/${filename}`));
  if (!res.ok) throw new Error(`无法加载 KB prompt: ${filename} (HTTP ${res.status})`);
  const j = (await res.json()) as RawKbPrompt;
  _kbPromptCache.set(filename, j);
  return j;
}

/** {{ var }} 简化插值（与主 interpolate.ts 逻辑独立，避免循环依赖） */
function interpolate(tmpl: string, vars: Record<string, string | number>): string {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

/* ───────────────────────────────────────────────────────────────────
 * 类型 → prompt 文件名映射
 * ─────────────────────────────────────────────────────────────────── */

const TYPE_TO_PROMPT_FILE: Record<UserKbDocType, string | null> = {
  trend: 'extract-trend.json',
  sample: 'extract-sample.json',
  antiPattern: 'extract-anti-pattern.json',
  styleGuide: 'summarize-feedback.json', // 仅 source='auto-summary' 时用
  worldHardSchema: 'extract-world-schema.json',
  voiceCard: 'extract-voice-card.json',
  // bookAnalysis 由 /analyzer 页面直接生成结构化 JSON，不需 LLM 提取
  bookAnalysis: null,
};

export interface ExtractResult {
  /** LLM 提炼后的结构化 JSON（已 parse） */
  structured: any;
  /** 原始 LLM 文本（含 ``` 包裹），调试用 */
  rawText: string;
  /** 调用元信息 */
  meta: {
    promptId: string;
    tokens?: number;
    cost?: number;
    durationMs: number;
    model: string;
  };
}

export interface ExtractOptions {
  type: UserKbDocType;
  /** 原始上传内容（trend / sample / antiPattern 用） */
  rawContent?: string;
  /** 反馈条数（仅 styleGuide / summarize-feedback 用） */
  feedbackCount?: number;
  /** 反馈 JSON 字符串（仅 styleGuide 用） */
  feedbackJson?: string;
  /** 中断信号 */
  signal?: AbortSignal;
  /** 流式增量回调（可选，UI 可显示打字效果） */
  onDelta?: (chunk: string, full: string) => void;
}

/**
 * 调用对应 KB prompt 提炼用户上传资料。
 * 返回结构化 JSON + 调用元信息。
 *
 * 使用示例：
 *   const r = await extractUserKbDoc({ type: 'trend', rawContent: fileText });
 *   if (r.structured.summary) { ...保存到 db... }
 */
export async function extractUserKbDoc(opts: ExtractOptions): Promise<ExtractResult> {
  const promptFile = TYPE_TO_PROMPT_FILE[opts.type];
  if (!promptFile) {
    throw new Error(`资料类型 ${opts.type} 暂未启用 LLM 提炼（P3+ 阶段计划）。请使用「手动新建」。`);
  }

  const settings = useSettings.getState();
  if (!settings.apiKey) {
    throw new Error('请先在 设置 中配置 API Key 才能调用 LLM 提炼');
  }

  const prompt = await loadKbPrompt(promptFile);

  // 插值变量
  const vars: Record<string, string | number> = {
    rawContent: opts.rawContent ?? '',
    feedbackCount: opts.feedbackCount ?? 0,
    feedbackJson: opts.feedbackJson ?? '',
  };

  const messages: ChatMessage[] = prompt.messages.map((m) => ({
    role: m.role,
    content: interpolate(m.content, vars),
  }));

  // 提炼任务用 lite 模型即可（结构化抽取，对创意要求低；可省钱）
  const model = settings.modelLite || settings.model;

  const result = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model,
    messages,
    temperature: 0.1, // 提炼任务要稳定不发散
    max_tokens: settings.maxTokens,
    signal: opts.signal,
    onDelta: opts.onDelta,
  });

  let structured: any;
  try {
    structured = parseLooseJson(result.content);
  } catch (e: any) {
    throw new Error(
      `LLM 输出无法解析为 JSON。模型可能没遵循 prompt。原始输出前 200 字：\n${result.content.slice(0, 200)}\n\n解析错误：${e?.message ?? e}`,
    );
  }

  if (structured == null || typeof structured !== 'object') {
    throw new Error(`LLM 输出解析后不是对象（实际是 ${typeof structured}）`);
  }

  return {
    structured,
    rawText: result.content,
    meta: {
      promptId: USER_KB_TYPE_META[opts.type].extractPromptId,
      tokens: result.usage?.total_tokens,
      durationMs: result.durationMs,
      model,
    },
  };
}

/* ───────────────────────────────────────────────────────────────────
 * 注入层：把已保存的 UserKbDoc 渲染成 system prompt 段
 * ─────────────────────────────────────────────────────────────────── */

import type { UserKbDoc } from '../store/userKb';

/** 单条 doc 渲染到 prompt 的最大字符（防爆 token） */
const PER_DOC_MAX_CHARS = 1500;

/**
 * 把 UserKbDoc 数组按 type 分组，渲染为可注入的 system 文本段。
 * 输出格式与现有 buildKbPreamble 类似，标题区分静态 vs 用户 KB。
 *
 * 注入点：compose.ts → buildSystemPreamble；按节点 id 决定注入哪些 type。
 */
export function buildUserKbPreamble(
  docs: UserKbDoc[],
  opts: { nodeId?: string } = {},
): string {
  if (docs.length === 0) return '';

  // 按 type 分组（保留每组内 createdAt 降序，最新的优先）
  const groups = new Map<UserKbDocType, UserKbDoc[]>();
  for (const d of docs) {
    if (!d.enabled) continue;
    const arr = groups.get(d.type) ?? [];
    arr.push(d);
    groups.set(d.type, arr);
  }

  const parts: string[] = [];
  parts.push('# 用户资料库（项目绑定，请优先遵循）');

  // 渲染顺序：trend → styleGuide → antiPattern → sample → worldHardSchema → voiceCard
  const ORDER: UserKbDocType[] = [
    'trend', 'bookAnalysis', 'styleGuide', 'antiPattern', 'sample', 'worldHardSchema', 'voiceCard',
  ];

  for (const type of ORDER) {
    const arr = groups.get(type);
    if (!arr || arr.length === 0) continue;
    const meta = USER_KB_TYPE_META[type];
    parts.push(`\n## 【${meta.shortLabel}】${meta.label}`);
    for (const d of arr) {
      let text: string;
      try {
        const parsed = JSON.parse(d.structuredJson);
        text = renderStructuredForType(type, parsed);
      } catch {
        // structuredJson 解析失败：fallback 到 rawContent 截断
        text = d.rawContent;
      }
      if (text.length > PER_DOC_MAX_CHARS) {
        text = text.slice(0, PER_DOC_MAX_CHARS) + '\n…（已截断）';
      }
      parts.push(`### ${d.title}\n${text}`);
    }
  }

  parts.push('\n---\n（以上为用户上传资料；下方为本步具体职责。）\n');
  void opts; // nodeId 暂未使用，留作未来按节点定制渲染深度
  return parts.join('\n');
}

/** 按 type 把结构化 JSON 渲染成 markdown 短文本（仅取关键字段） */
function renderStructuredForType(type: UserKbDocType, parsed: any): string {
  switch (type) {
    case 'trend':
      return renderTrend(parsed);
    case 'styleGuide':
      return renderStyleGuide(parsed);
    case 'antiPattern':
      return renderAntiPattern(parsed);
    case 'sample':
      return renderSample(parsed);
    case 'bookAnalysis':
      return renderBookAnalysis(parsed);
    default:
      return JSON.stringify(parsed, null, 2);
  }
}

/**
 * 拆书分析的 markdown 渲染。重点输出「可迁移方法论」与「位置洞察」，
 * 原始 5 大模块（worldview/characters/plot/positionInsights/methodology）都以紧凑
 * 变体输出，作为规划节点的背景参考。
 * Schema: src/pipeline/bookAnalyzer.ts → BookAnalysisResult
 */
function renderBookAnalysis(p: any): string {
  const lines: string[] = [];
  if (p?.bookMeta?.title || p?.bookMeta?.author || p?.bookMeta?.genre) {
    const meta = [p.bookMeta.title, p.bookMeta.author, p.bookMeta.genre].filter(Boolean).join(' · ');
    lines.push(`**参考作品**：${meta}`);
  }
  // 核心方法论优先（最有价值）
  if (p?.methodology) {
    const m = p.methodology;
    lines.push('\n**核心方法论提炼**：');
    if (m.hookFormula) lines.push(`- 钩子配方：${m.hookFormula}`);
    if (m.conflictModel) lines.push(`- 冲突模型：${m.conflictModel}`);
    if (m.rhythmSignature) lines.push(`- 节奏签名：${m.rhythmSignature}`);
    if (Array.isArray(m.coreCraftPrinciples) && m.coreCraftPrinciples.length) {
      lines.push('- 核心工艺原则：');
      m.coreCraftPrinciples.slice(0, 8).forEach((s: string, i: number) => {
        lines.push(`  ${i + 1}. ${s}`);
      });
    }
  }
  // 三大维度摘要（不输出全文，避免 token 超限）
  if (p?.worldview?.coreRules) {
    lines.push(`\n**世界观 · 核心规则**：${p.worldview.coreRules}`);
  }
  if (p?.characters?.protagonistDesign) {
    lines.push(`\n**角色 · 主角设计**：${p.characters.protagonistDesign}`);
  }
  if (p?.plot?.macroStructure) {
    lines.push(`\n**剧情 · 宏观结构**：${p.plot.macroStructure}`);
  }
  if (p?.plot?.pacingControl) {
    lines.push(`\n**剧情 · 节奏控制**：${p.plot.pacingControl}`);
  }
  // 位置洞察（只取前 3 条）
  if (Array.isArray(p?.positionInsights) && p.positionInsights.length) {
    lines.push('\n**位置洞察**：');
    p.positionInsights.slice(0, 3).forEach((ins: any) => {
      const tag = ins.tag ?? '?';
      const tip = ins.transferableTechnique ?? '';
      if (tip) lines.push(`- [${tag}] ${tip}`);
    });
  }
  return lines.join('\n');
}

function renderTrend(p: any): string {
  const lines: string[] = [];
  if (p.summary) lines.push(`**总览**：${p.summary}`);
  const groups: Array<[string, string[] | undefined]> = [
    ['热门题材切入', p.hotTropes],
    ['强情绪节点', p.emotionPeaks],
    ['强反转方式', p.reversalTypes],
    ['人设类型', p.characterTypes],
    ['结局方式', p.endingTypes],
    ['用户明确喜欢', p.userExplicitLikes],
    ['用户明确不喜欢', p.userExplicitDislikes],
    ['平台约束', p.platformHints],
  ];
  for (const [label, arr] of groups) {
    if (Array.isArray(arr) && arr.length) {
      lines.push(`- **${label}**：${arr.map((s) => `「${s}」`).join('、')}`);
    }
  }
  return lines.join('\n');
}

function renderStyleGuide(p: any): string {
  const lines: string[] = [];
  if (p.summary) lines.push(`**用户偏好概括**：${p.summary}`);
  if (Array.isArray(p.writingRulesForLLM) && p.writingRulesForLLM.length) {
    lines.push('\n**给 LLM 的硬指令**：');
    p.writingRulesForLLM.forEach((rule: string, i: number) => {
      lines.push(`${i + 1}. ${rule}`);
    });
  }
  if (Array.isArray(p.explicitDislikes) && p.explicitDislikes.length) {
    lines.push('\n**明确禁忌**：');
    p.explicitDislikes.slice(0, 10).forEach((s: string) => lines.push(`- ${s}`));
  }
  if (Array.isArray(p.explicitLikes) && p.explicitLikes.length) {
    lines.push('\n**明确偏好**：');
    p.explicitLikes.slice(0, 8).forEach((s: string) => lines.push(`- ${s}`));
  }
  return lines.join('\n');
}

function renderAntiPattern(p: any): string {
  const lines: string[] = [];
  if (p.summary) lines.push(`**禁忌总览**：${p.summary}`);
  if (Array.isArray(p.categories)) {
    for (const cat of p.categories) {
      lines.push(`\n**${cat.name}**`);
      if (Array.isArray(cat.patterns)) {
        cat.patterns.slice(0, 12).forEach((pat: any) => {
          if (typeof pat === 'string') {
            lines.push(`- ${pat}`);
          } else if (pat?.pattern) {
            const alt = pat.betterAlternative ? `（建议：${pat.betterAlternative}）` : '';
            lines.push(`- ${pat.pattern}${alt}`);
          }
        });
      }
    }
  }
  return lines.join('\n');
}

function renderSample(p: any): string {
  const lines: string[] = [];
  if (p.summary) lines.push(`**风格定位**：${p.summary}`);
  if (Array.isArray(p.globalTechniques) && p.globalTechniques.length) {
    lines.push('\n**关键技法**：');
    p.globalTechniques.slice(0, 12).forEach((t: any) => {
      lines.push(`- **${t.name}**（${(t.applyTo || []).join('/')}）：${t.explanation}`);
    });
  }
  if (Array.isArray(p.samples) && p.samples.length) {
    lines.push('\n**范文片段（few-shot，请学技法不抄字）**：');
    p.samples.slice(0, 3).forEach((s: any, i: number) => {
      lines.push(`> 片段 ${i + 1}：${(s.excerpt ?? '').slice(0, 300)}`);
      if (s.notes) lines.push(`  · ${s.notes}`);
    });
  }
  return lines.join('\n');
}
