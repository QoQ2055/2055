// PR-F · Phase 1 step 4/5 · chatStream tool-call loop wrapper.
//
// Why a separate file (not inlined into chatStream):
//   - chatStream is the low-level SSE driver (single round-trip).
//   - The tool-call loop adds an orthogonal concern: dispatch handlers +
//     re-prompt. Mixing them would bloat chatStream and force unrelated
//     callers (every Best-of-N candidate, every selfCheck, etc.) to drag in
//     ToolContext + dispatcher dependencies.
//   - This file is the integration seam consumed by runner.ts (PR-F+).
//
// Behaviour contract:
//   - Calls chatStream up to `maxRounds` times (default 5).
//   - After each call, if the model emitted tool_calls, dispatcher executes
//     them in parallel via dispatchToolCallsToMessages, appends the
//     resulting role:'tool' messages, and loops back.
//   - Returns as soon as the model emits NO tool_calls (final answer).
//   - If the cap is hit while the model still wants more tools, marks the
//     result `truncated: true`. The last assistant content (which may be
//     empty if the model emitted only tool_calls in that round) is returned
//     verbatim — the caller decides whether to surface a UI warning or
//     auto-finalize via a follow-up call.
//   - Aborts cleanly when `opts.signal` is aborted; thrown error propagates.

import { chatStream } from './deepseek';
import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  ToolCall,
  ToolChoice,
  ToolDefinition,
} from './deepseek';
import { dispatchToolCallsToMessages } from '../pipeline/tools/dispatch';
import type { ToolContext } from '../pipeline/tools/context';
import type { ToolResult } from '../pipeline/tools/types';

export interface ChatStreamWithToolsOptions
  extends Omit<ChatRequest, 'tools' | 'tool_choice'> {
  /** Tool definitions exposed to the model. Required. */
  tools: ToolDefinition[];
  /** Tool selection policy (default: API decides, normally 'auto'). */
  tool_choice?: ToolChoice;
  /** IO context for the dispatcher. Required. */
  ctx: ToolContext;
  /**
   * Hard ceiling on round-trips (initial call + tool-reply rounds).
   * Default: 5. Set to 1 to disable looping (acts like plain chatStream
   * but still routes through this helper for telemetry uniformity).
   */
  maxRounds?: number;
  /** Fires at the START of each round (1-indexed). */
  onRoundStart?: (round: number) => void;
  /**
   * Fires AFTER the dispatcher executes the round's tool_calls, with the
   * per-call ToolResult envelopes in the same order as `tool_calls`.
   */
  onToolResults?: (round: number, results: ToolResult[]) => void;
}

export interface ToolDispatchRecord {
  round: number;
  call: ToolCall;
  result: ToolResult;
}

export interface ChatStreamWithToolsResult extends ChatResult {
  /** Total rounds executed (== roundResults.length). */
  rounds: number;
  /** Per-round raw ChatResult (read-only telemetry). */
  roundResults: ChatResult[];
  /** Every tool call dispatched, flattened in round-then-call order. */
  toolDispatches: ToolDispatchRecord[];
  /** Summed usage across rounds (best-effort; only populated if any round reported usage). */
  totalUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /**
   * True iff the loop exited because `maxRounds` was hit while the model
   * still emitted tool_calls. The caller may inspect `roundResults.at(-1).toolCalls`
   * to see what the model wanted next.
   */
  truncated: boolean;
}

/**
 * Drive a tool-calling conversation to completion (or a hard cap).
 *
 * The caller owns `opts.messages` — this function does NOT mutate it. A
 * local working copy is used to append assistant + tool messages each round.
 */
export async function chatStreamWithTools(
  opts: ChatStreamWithToolsOptions,
): Promise<ChatStreamWithToolsResult> {
  const {
    ctx,
    tools,
    tool_choice,
    maxRounds = 5,
    onRoundStart,
    onToolResults,
    messages: initialMessages,
    ...rest
  } = opts;

  if (!Number.isInteger(maxRounds) || maxRounds < 1) {
    throw new Error(`chatStreamWithTools: maxRounds must be a positive integer (got ${maxRounds})`);
  }
  if (!tools || tools.length === 0) {
    throw new Error('chatStreamWithTools: at least one tool definition is required');
  }

  // Local working copy; never mutate caller's array.
  const messages: ChatMessage[] = [...initialMessages];
  const roundResults: ChatResult[] = [];
  const toolDispatches: ToolDispatchRecord[] = [];
  let truncated = false;
  let lastRes: ChatResult | null = null;

  for (let round = 1; round <= maxRounds; round++) {
    if (rest.signal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    onRoundStart?.(round);

    lastRes = await chatStream({
      ...rest,
      messages,
      tools,
      tool_choice,
    });
    roundResults.push(lastRes);

    const calls = lastRes.toolCalls ?? [];

    if (calls.length === 0) {
      // No tool calls → model has finalized. Done.
      break;
    }

    if (round >= maxRounds) {
      // Cap reached while model still wants more tools. Stop without
      // dispatching this round's calls (dispatching them would have no
      // outlet — we cannot loop again).
      truncated = true;
      break;
    }

    // Echo the assistant message (with tool_calls) into the conversation
    // exactly as the API expects on replay.
    messages.push({
      role: 'assistant',
      content: lastRes.content ?? '',
      tool_calls: calls,
    });

    // Dispatch in parallel; append result messages.
    const toolMsgs = await dispatchToolCallsToMessages(calls, ctx);
    messages.push(...toolMsgs);

    // Decode envelopes for the callback / telemetry. dispatcher already
    // JSON-stringified them; parse defensively (parse failure ⇒ ok:false).
    const results: ToolResult[] = toolMsgs.map((m) => parseEnvelope(m.content));
    for (let i = 0; i < calls.length; i++) {
      toolDispatches.push({ round, call: calls[i], result: results[i] });
    }
    onToolResults?.(round, results);
  }

  // Lastly_res is guaranteed set: loop ran at least once (maxRounds >= 1).
  // TS narrowing helper:
  if (!lastRes) {
    throw new Error('chatStreamWithTools: invariant violation (no rounds executed)');
  }

  const totalUsage = sumUsage(roundResults);
  return {
    ...lastRes,
    rounds: roundResults.length,
    roundResults,
    toolDispatches,
    truncated,
    ...(totalUsage ? { totalUsage } : {}),
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function parseEnvelope(jsonStr: string): ToolResult {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && typeof parsed.ok === 'boolean') {
      return parsed as ToolResult;
    }
    return { ok: false, message: 'tool result envelope missing "ok" boolean' };
  } catch {
    return { ok: false, message: 'tool result envelope is not valid JSON' };
  }
}

function sumUsage(results: ChatResult[]): ChatStreamWithToolsResult['totalUsage'] {
  let any = false;
  let prompt = 0;
  let completion = 0;
  let total = 0;
  for (const r of results) {
    if (!r.usage) continue;
    any = true;
    prompt += r.usage.prompt_tokens ?? 0;
    completion += r.usage.completion_tokens ?? 0;
    total += r.usage.total_tokens ?? 0;
  }
  if (!any) return undefined;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  };
}
