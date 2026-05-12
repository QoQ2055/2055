// PR-F · tool-call loop wrapper tests.
//
// Strategy: mock global fetch to replay N synthetic SSE streams in sequence
// (one per round). Verify:
//   - Round count terminates correctly when model stops emitting tool_calls.
//   - Assistant + tool messages are appended in the correct order so the
//     NEXT round's request body contains them.
//   - Per-round + total usage aggregation.
//   - maxRounds cap surfaces `truncated: true` without dispatching the
//     final round's tool_calls.
//   - Abort signal honored between rounds.
//   - Caller's `messages` array is not mutated.
//   - onRoundStart / onToolResults fire with correct arguments.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatStreamWithTools } from '../chatStreamWithTools';
import type { ToolDefinition } from '../deepseek';
import type { ToolContext } from '../../pipeline/tools/context';

// ── SSE mocking infrastructure ──────────────────────────────────────────────

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(chunks[i++]));
    },
  });
}

function sseData(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n`;
}
function delta(d: Record<string, unknown>, finishReason: string | null = null): string {
  return sseData({ choices: [{ delta: d, finish_reason: finishReason }] });
}
const DONE = 'data: [DONE]\n';

interface RoundScript {
  /** Plain content emitted by this round (concatenated as one delta). */
  content?: string;
  /** Tool calls emitted by this round. Each becomes a single SSE delta. */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  /** Optional usage usage block on the final delta. */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function buildRoundResponse(script: RoundScript): Response {
  const chunks: string[] = [];
  if (script.content) {
    chunks.push(delta({ content: script.content }));
  }
  if (script.toolCalls && script.toolCalls.length > 0) {
    for (let i = 0; i < script.toolCalls.length; i++) {
      const tc = script.toolCalls[i];
      chunks.push(
        delta({
          tool_calls: [
            {
              index: i,
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            },
          ],
        }),
      );
    }
  }
  // finish_reason + optional usage on the terminal SSE event.
  const finalPayload: Record<string, unknown> = {
    choices: [{ delta: {}, finish_reason: script.toolCalls?.length ? 'tool_calls' : 'stop' }],
  };
  if (script.usage) finalPayload.usage = script.usage;
  chunks.push(sseData(finalPayload));
  chunks.push(DONE);
  return new Response(makeSseStream(chunks), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

// ── fixtures ────────────────────────────────────────────────────────────────

const SAVE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'save_step_output',
    description: 'persist step output',
    parameters: {
      type: 'object',
      properties: { stepId: { type: 'string' }, content: { type: 'string' } },
      required: ['stepId', 'content'],
      additionalProperties: false,
    },
  },
};

const BASE_REQ = {
  baseUrl: 'https://api.test',
  apiKey: 'sk-test',
  model: 'deepseek-chat',
  messages: [
    { role: 'system' as const, content: 'You are helpful.' },
    { role: 'user' as const, content: 'Please save step 1.' },
  ],
};

function makeMockCtx(): ToolContext {
  return {
    projectId: 1,
    getStepMeta: () => ({ stageId: 'screenplay', index: 1, title: 'S1', format: 'markdown' }),
    upsertArtifact: () => {},
    getCurrentStepId: () => null,
    setCurrentStepId: () => {},
    isAdjacentTransition: () => true,
    saveCheckpoint: () => 'cp_x',
    enqueueSelfcheck: () => 'sc_x',
    continuity: {
      foreshadow: { upsert: async () => ({ id: 1 }), remove: async () => {} },
      character_arc: { upsert: async () => ({ id: 1 }), remove: async () => {} },
      world_rule: { upsert: async () => ({ id: 1 }), remove: async () => {} },
      rhythm_diagnostic: { upsert: async () => ({ id: 1 }), remove: async () => {} },
    },
  };
}

// ── fetch mock ──────────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function scriptResponses(rounds: RoundScript[]): void {
  for (const r of rounds) {
    fetchSpy.mockResolvedValueOnce(buildRoundResponse(r));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('chatStreamWithTools · happy paths', () => {
  it('zero tools needed: single round, content returned, rounds=1', async () => {
    scriptResponses([{ content: 'all done' }]);
    const ctx = makeMockCtx();
    const r = await chatStreamWithTools({
      ...BASE_REQ,
      tools: [SAVE_TOOL],
      ctx,
    });
    expect(r.rounds).toBe(1);
    expect(r.content).toBe('all done');
    expect(r.toolDispatches).toHaveLength(0);
    expect(r.truncated).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('one tool call → tool dispatched → second round returns final content', async () => {
    scriptResponses([
      {
        toolCalls: [
          { id: 'call_1', name: 'save_step_output', arguments: '{"stepId":"a.1","content":"hi"}' },
        ],
      },
      { content: 'saved!' },
    ]);
    const ctx = makeMockCtx();
    const upsertSpy = vi.spyOn(ctx, 'upsertArtifact');
    const r = await chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx });
    expect(r.rounds).toBe(2);
    expect(r.content).toBe('saved!');
    expect(r.toolDispatches).toHaveLength(1);
    expect(r.toolDispatches[0].result.ok).toBe(true);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it('parallel tool calls in one round are all dispatched before next round', async () => {
    scriptResponses([
      {
        toolCalls: [
          { id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a.1","content":"x"}' },
          { id: 'c2', name: 'save_step_output', arguments: '{"stepId":"a.2","content":"y"}' },
        ],
      },
      { content: 'both saved' },
    ]);
    const ctx = makeMockCtx();
    const upsertSpy = vi.spyOn(ctx, 'upsertArtifact');
    const r = await chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx });
    expect(r.toolDispatches).toHaveLength(2);
    expect(r.toolDispatches.map((d) => d.call.id)).toEqual(['c1', 'c2']);
    expect(upsertSpy).toHaveBeenCalledTimes(2);
  });

  it('appends correct assistant + tool messages on round 2 request body', async () => {
    scriptResponses([
      {
        toolCalls: [
          { id: 'call_X', name: 'save_step_output', arguments: '{"stepId":"a.1","content":"x"}' },
        ],
      },
      { content: 'done' },
    ]);
    await chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx: makeMockCtx() });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const round2Body = JSON.parse((fetchSpy.mock.calls[1][1] as { body: string }).body);
    // Must include: original 2 messages + assistant (with tool_calls) + tool message
    expect(round2Body.messages).toHaveLength(4);
    const asst = round2Body.messages[2];
    expect(asst.role).toBe('assistant');
    expect(asst.tool_calls).toBeDefined();
    expect(asst.tool_calls[0].id).toBe('call_X');
    const toolMsg = round2Body.messages[3];
    expect(toolMsg.role).toBe('tool');
    expect(toolMsg.tool_call_id).toBe('call_X');
    const envelope = JSON.parse(toolMsg.content);
    expect(envelope.ok).toBe(true);
  });

  it('aggregates totalUsage across rounds', async () => {
    scriptResponses([
      {
        toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a.1","content":"x"}' }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      },
      {
        content: 'done',
        usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230 },
      },
    ]);
    const r = await chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx: makeMockCtx() });
    expect(r.totalUsage).toEqual({
      prompt_tokens: 300,
      completion_tokens: 50,
      total_tokens: 350,
    });
  });

  it('onRoundStart fires once per round, 1-indexed', async () => {
    scriptResponses([
      { toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a","content":"x"}' }] },
      { content: 'done' },
    ]);
    const seen: number[] = [];
    await chatStreamWithTools({
      ...BASE_REQ,
      tools: [SAVE_TOOL],
      ctx: makeMockCtx(),
      onRoundStart: (n) => seen.push(n),
    });
    expect(seen).toEqual([1, 2]);
  });

  it('onToolResults fires only on rounds that had tool_calls', async () => {
    scriptResponses([
      { toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a","content":"x"}' }] },
      { content: 'done' },
    ]);
    const calls: Array<{ round: number; n: number }> = [];
    await chatStreamWithTools({
      ...BASE_REQ,
      tools: [SAVE_TOOL],
      ctx: makeMockCtx(),
      onToolResults: (round, results) => calls.push({ round, n: results.length }),
    });
    expect(calls).toEqual([{ round: 1, n: 1 }]);
  });
});

describe('chatStreamWithTools · truncation + caps', () => {
  it('hits maxRounds=2 cap when model keeps calling tools', async () => {
    scriptResponses([
      { toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a","content":"x"}' }] },
      { toolCalls: [{ id: 'c2', name: 'save_step_output', arguments: '{"stepId":"b","content":"y"}' }] },
    ]);
    const r = await chatStreamWithTools({
      ...BASE_REQ,
      tools: [SAVE_TOOL],
      ctx: makeMockCtx(),
      maxRounds: 2,
    });
    expect(r.truncated).toBe(true);
    expect(r.rounds).toBe(2);
    // The 2nd round's tool_calls are NOT dispatched (no outlet to feed back).
    expect(r.toolDispatches).toHaveLength(1);
    expect(r.toolDispatches[0].call.id).toBe('c1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('rejects maxRounds < 1', async () => {
    await expect(
      chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx: makeMockCtx(), maxRounds: 0 }),
    ).rejects.toThrow(/positive integer/);
  });

  it('rejects empty tools array', async () => {
    await expect(
      chatStreamWithTools({ ...BASE_REQ, tools: [], ctx: makeMockCtx() }),
    ).rejects.toThrow(/at least one tool/);
  });

  it('maxRounds=1 acts like single-shot (no loop)', async () => {
    scriptResponses([{ content: 'one-shot' }]);
    const r = await chatStreamWithTools({
      ...BASE_REQ,
      tools: [SAVE_TOOL],
      ctx: makeMockCtx(),
      maxRounds: 1,
    });
    expect(r.rounds).toBe(1);
    expect(r.truncated).toBe(false);
    expect(r.content).toBe('one-shot');
  });
});

describe('chatStreamWithTools · invariants', () => {
  it('does NOT mutate the caller-provided messages array', async () => {
    scriptResponses([
      { toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a","content":"x"}' }] },
      { content: 'done' },
    ]);
    const callerMsgs = [...BASE_REQ.messages];
    const snapshot = JSON.stringify(callerMsgs);
    await chatStreamWithTools({
      ...BASE_REQ,
      messages: callerMsgs,
      tools: [SAVE_TOOL],
      ctx: makeMockCtx(),
    });
    expect(JSON.stringify(callerMsgs)).toBe(snapshot);
    expect(callerMsgs).toHaveLength(2);
  });

  it('aborted signal before first round throws AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      chatStreamWithTools({
        ...BASE_REQ,
        tools: [SAVE_TOOL],
        ctx: makeMockCtx(),
        signal: controller.signal,
      }),
    ).rejects.toThrow(/abort/i);
  });

  it('aborted between rounds throws AbortError (no further fetch)', async () => {
    const controller = new AbortController();
    fetchSpy.mockImplementationOnce(async () =>
      buildRoundResponse({
        toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a","content":"x"}' }],
      }),
    );
    // After 1st response, the test aborts before the 2nd fetch should happen.
    fetchSpy.mockImplementationOnce(async () => {
      throw new Error('should not be called');
    });
    const ctx = makeMockCtx();
    // We abort right after the first dispatch by hooking onToolResults.
    await expect(
      chatStreamWithTools({
        ...BASE_REQ,
        tools: [SAVE_TOOL],
        ctx,
        signal: controller.signal,
        onToolResults: () => controller.abort(),
      }),
    ).rejects.toThrow(/abort/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('failed tool result still loops (model can self-correct on next round)', async () => {
    // 1st round: model emits a call with bad args (schema violation).
    // dispatcher returns ok:false; loop continues to 2nd round where model
    // emits the corrected version. 3rd round returns final content.
    scriptResponses([
      { toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"oops":true}' }] },
      {
        toolCalls: [
          { id: 'c2', name: 'save_step_output', arguments: '{"stepId":"a","content":"fixed"}' },
        ],
      },
      { content: 'recovered' },
    ]);
    const ctx = makeMockCtx();
    const r = await chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx });
    expect(r.rounds).toBe(3);
    expect(r.toolDispatches).toHaveLength(2);
    expect(r.toolDispatches[0].result.ok).toBe(false);
    expect(r.toolDispatches[1].result.ok).toBe(true);
    expect(r.content).toBe('recovered');
  });

  it('roundResults preserves per-round content + finishReason', async () => {
    scriptResponses([
      {
        content: 'thinking…',
        toolCalls: [{ id: 'c1', name: 'save_step_output', arguments: '{"stepId":"a","content":"x"}' }],
      },
      { content: 'final' },
    ]);
    const r = await chatStreamWithTools({ ...BASE_REQ, tools: [SAVE_TOOL], ctx: makeMockCtx() });
    expect(r.roundResults).toHaveLength(2);
    expect(r.roundResults[0].content).toBe('thinking…');
    expect(r.roundResults[0].finishReason).toBe('tool_calls');
    expect(r.roundResults[1].content).toBe('final');
    expect(r.roundResults[1].finishReason).toBe('stop');
  });

  it('forwards tool_choice into request body', async () => {
    scriptResponses([{ content: 'ok' }]);
    await chatStreamWithTools({
      ...BASE_REQ,
      tools: [SAVE_TOOL],
      tool_choice: 'required',
      ctx: makeMockCtx(),
    });
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body);
    expect(body.tool_choice).toBe('required');
    expect(body.tools).toHaveLength(1);
  });
});
