// PR-E · Phase 1 step 3/5 · tool dispatcher.
//
// Glue layer: ToolCall (from chatStream) -> parse+validate args ->
// route to typed handler -> serialize ToolResult back as a tool message
// payload that runner.ts (PR-F) can append to the next round.
//
// Invariants:
//   - dispatchToolCall NEVER throws. Every failure path returns
//     { ok: false, ... } so the LLM can self-correct.
//   - Unknown tool names, JSON parse errors, schema mismatches, and handler
//     exceptions all surface as structured ToolResult envelopes.
//   - The arguments parsing happens exactly once per call (no double-parse
//     in handler + dispatcher).

import type { ChatMessage, ToolCall } from '../../llm/deepseek';
import type { ToolContext } from './context';
import {
  handleRunSelfcheck,
  handleSaveCheckpoint,
  handleSaveStepOutput,
  handleTransitionToStep,
  handleUpdateContinuityTable,
} from './handlers';
import { isToolName } from './registry';
import type {
  RunSelfcheckArgs,
  SaveCheckpointArgs,
  SaveStepOutputArgs,
  ToolName,
  ToolResult,
  TransitionToStepArgs,
  UpdateContinuityTableArgs,
} from './types';
import { formatIssues, parseAndValidateToolArgs } from './validate';

/**
 * Single tool-call dispatch entry. Returns the structured ToolResult.
 * Caller should normally use `dispatchToolCallsToMessages` instead, which
 * converts results into the role:'tool' chat messages that the next round
 * needs.
 */
export async function dispatchToolCall(
  call: ToolCall,
  ctx: ToolContext,
): Promise<ToolResult> {
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const result = await _dispatch(call, ctx);
  const durationMs =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;

  // Audit hook (best-effort; failure inside hook is swallowed).
  try {
    ctx.recordToolCall?.({
      name: call.function.name,
      args: (() => {
        try {
          return JSON.parse(call.function.arguments || '{}');
        } catch {
          return call.function.arguments;
        }
      })(),
      ok: result.ok,
      message: result.message,
      durationMs,
    });
  } catch {
    // never re-throw from audit
  }

  return result;
}

async function _dispatch(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const name = call.function.name;

  if (!isToolName(name)) {
    return {
      ok: false,
      message: `unknown tool "${name}" — not registered in PR-D registry`,
    };
  }

  const parsed = parseAndValidateToolArgs(name, call.function.arguments);
  if (!parsed.ok) {
    return {
      ok: false,
      message: `invalid arguments for ${name}: ${formatIssues(parsed.issues)}`,
    };
  }

  // Narrowing: post-validate the data shape matches the args type for `name`.
  // The validator already structurally checked it; the cast is sound.
  try {
    switch (name as ToolName) {
      case 'save_step_output':
        return await handleSaveStepOutput(parsed.data as SaveStepOutputArgs, ctx);
      case 'transition_to_step':
        return await handleTransitionToStep(parsed.data as TransitionToStepArgs, ctx);
      case 'save_checkpoint':
        return await handleSaveCheckpoint(parsed.data as SaveCheckpointArgs, ctx);
      case 'run_selfcheck':
        return await handleRunSelfcheck(parsed.data as RunSelfcheckArgs, ctx);
      case 'update_continuity_table':
        return await handleUpdateContinuityTable(
          parsed.data as UpdateContinuityTableArgs,
          ctx,
        );
      default: {
        // Exhaustiveness guard. If a new tool is added to ToolName, this
        // unreachable branch becomes a compile error.
        const _exhaustive: never = name as never;
        return {
          ok: false,
          message: `dispatcher missing case for tool "${_exhaustive as string}"`,
        };
      }
    }
  } catch (e) {
    return {
      ok: false,
      message: `handler ${name} threw unexpectedly: ${(e as Error).message}`,
    };
  }
}

/**
 * Convenience: dispatch every tool call in parallel and convert each result
 * into a `role: 'tool'` ChatMessage suitable for the next chatStream round.
 *
 * Order of returned messages exactly matches the input `calls` order.
 *
 * The tool message content is a JSON-stringified envelope `{ok, data, message}`
 * — this is what the model is expected to consume on the next round. Keep
 * the envelope shape stable; system prompts depend on it.
 */
export async function dispatchToolCallsToMessages(
  calls: ToolCall[],
  ctx: ToolContext,
): Promise<ChatMessage[]> {
  const results = await Promise.all(calls.map((c) => dispatchToolCall(c, ctx)));
  return calls.map((c, i) => ({
    role: 'tool' as const,
    tool_call_id: c.id,
    content: JSON.stringify(results[i]),
  }));
}
