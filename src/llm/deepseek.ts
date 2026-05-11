// DeepSeek (OpenAI-compatible) streaming client.
// Uses fetch + ReadableStream + SSE manual parsing. Zero extra deps.

export interface ChatMessage {
  /**
   * 'tool' role added (OpenAI tool-call protocol). When `role === 'tool'`,
   * `tool_call_id` MUST be the id of the assistant's preceding tool_call,
   * and `content` is the JSON-stringified tool execution result.
   */
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Required when role === 'tool'. Pairs the result with the tool_call.id. */
  tool_call_id?: string;
  /**
   * Present on assistant messages that requested tool execution. The runner
   * MUST replay the previous assistant message *with* this field intact when
   * looping back, otherwise the API rejects the trailing tool messages.
   */
  tool_calls?: ToolCall[];
  /** Optional name (mostly used by legacy function-role messages). */
  name?: string;
}

/**
 * OpenAI-compatible tool definition (DeepSeek V4 supports this verbatim).
 * `parameters` is a JSON Schema object describing the tool arguments.
 * Build via zod -> json-schema or hand-written constants in PR-D.
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool-call payload returned by the model. `arguments` is the model-emitted
 * JSON string (NOT pre-parsed) - the runner is responsible for JSON.parse +
 * zod validation. id is opaque (e.g. 'call_abc123') and must be echoed back
 * verbatim in the next round's tool message tool_call_id.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * tool_choice forms (OpenAI compatible):
 *  - 'auto'      : model decides freely (default when tools provided)
 *  - 'none'      : disable tool use even if tools are present
 *  - 'required'  : force at least one tool call
 *  - {type:'function', function:{name}} : force a specific tool
 */
export type ToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } };

export interface ChatRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /**
   * Stop sequences. The OpenAI-compatible spec returns content WITHOUT the
   * matched stop string; the runner is responsible for re-appending the
   * marker if the downstream parser needs it (see runner.ts STOP_RECIPE).
   */
  stop?: string[];
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  // ─────────── DeepSeek V4 extensions (all optional, 100% back-compat) ───────────
  /**
   * Enable DeepSeek V4 Thinking Mode via `extra_body.thinking`.
   * - When `enabled: true`, `temperature` / `top_p` / `*_penalty` parameters
   *   become INEFFECTIVE on the API side; this client will strip them from
   *   the request body to avoid confusion.
   * - `effort` controls reasoning depth: `'high'` (default) or `'max'`.
   *   `'low'` / `'medium'` are mapped to `'high'` server-side anyway.
   * Reference: docs/internal-notes/deepseek-v4-tuning-guide.md §2.
   */
  thinking?: { enabled: boolean; effort?: 'high' | 'max' };
  /**
   * Force JSON output via OpenAI-compatible `response_format`.
   * Use `'json_object'` for strict JSON outputs (avoids prompt-engineered
   * JSON failure modes in extractKb / consistencyCheck etc).
   */
  responseFormat?: 'text' | 'json_object';
  /**
   * Streaming callback for V4 Thinking-Mode reasoning content (chain-of-thought).
   * Only fires when `thinking.enabled === true` and the API returns a
   * `delta.reasoning_content` field. Without this callback the reasoning
   * stream is still accumulated into `ChatResult.reasoningContent`.
   */
  onReasoningDelta?: (chunk: string, full: string) => void;
  // ─────────── Tool-calling (PR-C, Phase 1) ───────────
  /**
   * OpenAI-compatible tool definitions to expose to the model. When set,
   * the model may emit `tool_calls` instead of (or alongside) plain content.
   * The runner is responsible for executing handlers and appending
   * `role: 'tool'` messages on the next round (see PR-F).
   */
  tools?: ToolDefinition[];
  /** Tool selection policy. Defaults to 'auto' on the API side when omitted. */
  tool_choice?: ToolChoice;
  /**
   * Streaming callback for tool_call deltas. Receives the full accumulated
   * tool_calls array on every delta (cheap to compare-and-update UI). Only
   * fires when the API emits `delta.tool_calls`. Final aggregated calls are
   * also returned in `ChatResult.toolCalls`.
   */
  onToolCallDelta?: (calls: ToolCall[]) => void;
}

export interface ChatResult {
  content: string;
  finishReason: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  durationMs: number;
  /**
   * V4 Thinking-Mode chain-of-thought, only populated when `req.thinking.enabled`
   * is true AND the API returned `delta.reasoning_content`. Otherwise `undefined`.
   */
  reasoningContent?: string;
  /**
   * Aggregated tool_calls emitted by the model in this round. `undefined`
   * when the model did not request any tool. When present, the runner MUST
   * dispatch handlers, then loop back with role:'tool' messages.
   */
  toolCalls?: ToolCall[];
}

export async function chatStream(req: ChatRequest): Promise<ChatResult> {
  const t0 = performance.now();
  const url = req.baseUrl.replace(/\/+$/, '') + '/v1/chat/completions';

  // ── Build request body with V4 extensions ──
  const thinkingEnabled = req.thinking?.enabled === true;
  // Per V4 spec, when Thinking Mode is enabled, sampling params are ignored.
  // Strip them to avoid silent confusion (and to make request bodies easier
  // to read in network tabs).
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    max_tokens: req.max_tokens ?? 8192,
    stream: true,
    ...(req.stop && req.stop.length ? { stop: req.stop } : {}),
    ...(req.tools && req.tools.length ? { tools: req.tools } : {}),
    ...(req.tool_choice !== undefined ? { tool_choice: req.tool_choice } : {}),
  };
  if (!thinkingEnabled) {
    body.temperature = req.temperature ?? 0.7;
  }
  if (req.thinking !== undefined) {
    // Use DeepSeek-native `extra_body` envelope (OpenAI-compatible passthrough).
    body.extra_body = {
      thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' },
      ...(thinkingEnabled && req.thinking.effort
        ? { reasoning_effort: req.thinking.effort }
        : {}),
    };
  }
  if (req.responseFormat && req.responseFormat !== 'text') {
    body.response_format = { type: req.responseFormat };
  }

  const res = await fetch(url, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`DeepSeek HTTP ${res.status}: ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  let reasoningFull = '';
  let finishReason: string | null = null;
  let usage: ChatResult['usage'];
  /**
   * tool_calls accumulator. Indexed by `delta.tool_calls[].index` (NOT array
   * push) because OpenAI streams arguments fragment-by-fragment and may emit
   * them out of order across multiple deltas (in practice always in-order
   * but the spec allows interleaving for parallel tool calls).
   */
  const toolCallsAcc: Record<number, ToolCall> = {};

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const choice = json.choices?.[0];
        const delta = choice?.delta;
        // V4 Thinking-Mode chain-of-thought stream (separate from normal content).
        const reasoning: string = delta?.reasoning_content ?? '';
        if (reasoning) {
          reasoningFull += reasoning;
          req.onReasoningDelta?.(reasoning, reasoningFull);
        }
        const contentDelta: string = delta?.content ?? '';
        if (contentDelta) {
          full += contentDelta;
          req.onDelta?.(contentDelta, full);
        }
        // Tool-call streaming (OpenAI tool-call protocol). Each delta carries
        // a partial fragment per index; we accumulate id / name / arguments.
        const toolCallsDelta: Array<{
          index?: number;
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }> | undefined = delta?.tool_calls;
        if (toolCallsDelta && toolCallsDelta.length > 0) {
          for (const tc of toolCallsDelta) {
            const tcIdx = typeof tc.index === 'number' ? tc.index : 0;
            if (!toolCallsAcc[tcIdx]) {
              toolCallsAcc[tcIdx] = {
                id: tc.id ?? '',
                type: 'function',
                function: { name: '', arguments: '' },
              };
            }
            if (tc.id) toolCallsAcc[tcIdx].id = tc.id;
            if (tc.function?.name) toolCallsAcc[tcIdx].function.name += tc.function.name;
            if (tc.function?.arguments) {
              toolCallsAcc[tcIdx].function.arguments += tc.function.arguments;
            }
          }
          if (req.onToolCallDelta) {
            req.onToolCallDelta(
              Object.keys(toolCallsAcc)
                .map((k) => Number(k))
                .sort((a, b) => a - b)
                .map((i) => toolCallsAcc[i]),
            );
          }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (json.usage) usage = json.usage;
      } catch {
        // ignore malformed sse line
      }
    }
  }

  // Aggregate tool_calls (sorted by index for stable ordering).
  const toolCallsArray: ToolCall[] = Object.keys(toolCallsAcc)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((i) => toolCallsAcc[i])
    // Defensive filter: drop entries that never received a function name
    // (rare API edge-case where a delta announces an index but never fills it).
    .filter((tc) => tc.function.name.length > 0);

  return {
    content: full,
    finishReason,
    usage,
    durationMs: performance.now() - t0,
    ...(reasoningFull ? { reasoningContent: reasoningFull } : {}),
    ...(toolCallsArray.length > 0 ? { toolCalls: toolCallsArray } : {}),
  };
}
