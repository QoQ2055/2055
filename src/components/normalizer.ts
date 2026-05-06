// AI 格式归一化器：把用户粘贴的脏输入转成下游可消费的格式。
// 方案 A 通用器 + 方案 C 专用 prompt 二合一。

import { chatStream } from '../llm/deepseek';
import type { SettingsState } from '../store/settings';

export interface NormalizeConfig {
  /** 目标格式描述 / schema（注入到 system prompt 的 [TARGET FORMAT] 段） */
  schema: string;
  /** 1-2 个范例（注入到 [EXAMPLES] 段） */
  examples?: string;
  /** 完全覆盖默认 system prompt（方案 C） */
  customSystemPrompt?: string;
  /** 输出上限 */
  maxTokens?: number;
  /** temperature；默认 0.2，格式转换不需要发挥 */
  temperature?: number;
}

const DEFAULT_SYSTEM = `你是一个严格的格式归一化器（format normalizer）。
你的唯一任务：把用户粘贴的【原始输入】转换为【目标格式】描述的形态。

绝对约束：
1. 不做二次创作 / 不增删信息 / 不改变叙事内容；只改格式与结构。
2. 输出必须是【纯净内容本体】 —— 不要 markdown 代码围栏（除非目标格式就是 markdown 且要求围栏）、不要前后说明文字、不要 "好的，以下是…"。
3. 若【原始输入】内容完全不符合目标领域（如让你输出剧本但输入是菜谱），输出单行 ERROR: <原因> 并停止。
4. 若【原始输入】信息不足，缺什么就留空字段或 TODO，不要凭空捏造。
5. 严格遵循【目标格式】中的字段名、层级、JSON 合法性。`;

export interface NormalizeOptions {
  raw: string;
  config: NormalizeConfig;
  settings: Pick<SettingsState, 'baseUrl' | 'apiKey' | 'model'>;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

export interface NormalizeResult {
  content: string;
  durationMs: number;
  tokens: number;
  /** 模型自报无法处理时为 true */
  rejected?: boolean;
  rejectReason?: string;
}

export async function normalizeContent(opts: NormalizeOptions): Promise<NormalizeResult> {
  const { raw, config, settings, signal, onDelta } = opts;

  const system = config.customSystemPrompt ?? buildDefaultSystem(config);
  const user = `【原始输入】\n${raw}\n\n现在请输出转换后的内容。`;

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: config.temperature ?? 0.2,
    max_tokens: config.maxTokens ?? 8192,
    signal,
    onDelta,
  });

  let content = stripFence(res.content.trim());
  let rejected = false;
  let rejectReason: string | undefined;

  // 模型自报无法处理
  const m = content.match(/^ERROR\s*:\s*(.+)$/m);
  if (m && content.length < 200) {
    rejected = true;
    rejectReason = m[1].trim();
  }

  return {
    content,
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens ?? 0,
    rejected,
    rejectReason,
  };
}

function buildDefaultSystem(c: NormalizeConfig): string {
  const parts = [DEFAULT_SYSTEM, '\n\n[TARGET FORMAT]\n' + c.schema];
  if (c.examples) parts.push('\n\n[EXAMPLES]\n' + c.examples);
  return parts.join('');
}

/** 移除模型可能加上的 ```json / ```markdown 围栏 */
function stripFence(s: string): string {
  const fence = /^```(?:json|markdown|md|text)?\s*\n([\s\S]*?)\n```$/i;
  const m = s.match(fence);
  return m ? m[1].trim() : s;
}
