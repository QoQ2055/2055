// DeepSeek (OpenAI-compatible) streaming client.
// Uses fetch + ReadableStream + SSE manual parsing. Zero extra deps.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (json.usage) usage = json.usage;
      } catch {
        // ignore malformed sse line
      }
    }
  }

  return {
    content: full,
    finishReason,
    usage,
    durationMs: performance.now() - t0,
    ...(reasoningFull ? { reasoningContent: reasoningFull } : {}),
  };
}
