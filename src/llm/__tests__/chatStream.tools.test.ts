// PR-C · chatStream SDK-layer tool-calling tests.
// Mocks fetch to replay synthetic OpenAI SSE streams and asserts:
//   1. tools / tool_choice are forwarded into the request body (透传)
//   2. delta.tool_calls fragments are accumulated by `index` (id / name / arguments)
//   3. onToolCallDelta callback fires with the running aggregate
//   4. final ChatResult.toolCalls is sorted by index and excludes nameless entries
//   5. existing non-tool path remains 100% back-compat (no toolCalls field emitted)
//
// Zero network IO. Pure unit test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatStream, type ToolDefinition, type ToolCall } from '../deepseek';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a ReadableStream that emits `chunks` as UTF-8 bytes (one push per chunk). */
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

/** Helper: turn a JS object into one SSE data line (no trailing newline). */
function sseData(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n`;
}

function deltaChunk(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return sseData({
    choices: [{ delta, finish_reason: finishReason }],
  });
}

const DONE_CHUNK = 'data: [DONE]\n';

const BASE_REQ = {
  baseUrl: 'https://api.deepseek.test',
  apiKey: 'sk-test',
  model: 'deepseek-chat',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

const SAMPLE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'save_step_output',
    description: 'persist step output to project store',
    parameters: {
      type: 'object',
      properties: { stepId: { type: 'string' }, content: { type: 'string' } },
      required: ['stepId', 'content'],
    },
  },
};

// ── mock fetch ──────────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockSseResponse(chunks: string[]): void {
  fetchSpy.mockResolvedValue(
    new Response(makeSseStream([...chunks, DONE_CHUNK]), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }),
  );
}

function readBody(): Record<string, unknown> {
  const call = fetchSpy.mock.calls[0];
  return JSON.parse((call?.[1] as { body: string }).body);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('chatStream · tools forwarding (PR-C)', () => {
  it('forwards tools + tool_choice into request body verbatim', async () => {
    mockSseResponse([deltaChunk({ content: 'done' }, 'stop')]);

    await chatStream({
      ...BASE_REQ,
      tools: [SAMPLE_TOOL],
      tool_choice: 'required',
    });

    const body = readBody();
    expect(body.tools).toEqual([SAMPLE_TOOL]);
    expect(body.tool_choice).toBe('required');
  });

  it('omits tools / tool_choice when not provided (back-compat body shape)', async () => {
    mockSseResponse([deltaChunk({ content: 'ok' }, 'stop')]);

    await chatStream(BASE_REQ);

    const body = readBody();
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
  });

  it('forwards specific tool_choice {type:"function", function:{name}} object', async () => {
    mockSseResponse([deltaChunk({ content: 'x' }, 'stop')]);

    await chatStream({
      ...BASE_REQ,
      tools: [SAMPLE_TOOL],
      tool_choice: { type: 'function', function: { name: 'save_step_output' } },
    });

    expect(readBody().tool_choice).toEqual({
      type: 'function',
      function: { name: 'save_step_output' },
    });
  });
});

describe('chatStream · tool_calls SSE accumulation (PR-C)', () => {
  it('accumulates arguments fragments across multiple deltas by index', async () => {
    // OpenAI-style streaming: id comes in the first delta, name partial,
    // then arguments arrives in tiny fragments.
    mockSseResponse([
      deltaChunk({
        tool_calls: [
          {
            index: 0,
            id: 'call_abc',
            type: 'function',
            function: { name: 'save_step', arguments: '' },
          },
        ],
      }),
      deltaChunk({
        tool_calls: [{ index: 0, function: { name: '_output' } }],
      }),
      deltaChunk({
        tool_calls: [{ index: 0, function: { arguments: '{"stepId":' } }],
      }),
      deltaChunk({
        tool_calls: [{ index: 0, function: { arguments: '"screenplay.r1","content":"ok"}' } }],
      }),
      deltaChunk({}, 'tool_calls'),
    ]);

    const result = await chatStream(BASE_REQ);

    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]).toMatchObject({
      id: 'call_abc',
      type: 'function',
      function: {
        name: 'save_step_output',
        arguments: '{"stepId":"screenplay.r1","content":"ok"}',
      },
    });
    expect(result.finishReason).toBe('tool_calls');
  });

  it('separates multiple parallel tool_calls by index and sorts ascending', async () => {
    mockSseResponse([
      // index 1 announced first (out-of-order is legal per spec)
      deltaChunk({
        tool_calls: [
          { index: 1, id: 'call_b', type: 'function', function: { name: 'tool_B', arguments: '{}' } },
        ],
      }),
      deltaChunk({
        tool_calls: [
          { index: 0, id: 'call_a', type: 'function', function: { name: 'tool_A', arguments: '' } },
        ],
      }),
      deltaChunk({
        tool_calls: [{ index: 0, function: { arguments: '{"k":1}' } }],
      }),
      deltaChunk({}, 'tool_calls'),
    ]);

    const result = await chatStream(BASE_REQ);

    expect(result.toolCalls).toHaveLength(2);
    // Sorted by index ascending: A (idx 0) then B (idx 1)
    expect(result.toolCalls![0].function.name).toBe('tool_A');
    expect(result.toolCalls![0].function.arguments).toBe('{"k":1}');
    expect(result.toolCalls![1].function.name).toBe('tool_B');
  });

  it('invokes onToolCallDelta on every delta with running aggregate', async () => {
    const calls: ToolCall[][] = [];
    mockSseResponse([
      deltaChunk({
        tool_calls: [
          { index: 0, id: 'c1', type: 'function', function: { name: 'fn', arguments: '{"' } },
        ],
      }),
      deltaChunk({
        tool_calls: [{ index: 0, function: { arguments: 'x":1}' } }],
      }),
      deltaChunk({}, 'tool_calls'),
    ]);

    await chatStream({
      ...BASE_REQ,
      onToolCallDelta: (snapshot) => calls.push(JSON.parse(JSON.stringify(snapshot))),
    });

    // Called exactly once per delta that carried tool_calls (2 in this script).
    expect(calls).toHaveLength(2);
    expect(calls[0][0].function.arguments).toBe('{"');
    expect(calls[1][0].function.arguments).toBe('{"x":1}');
  });

  it('filters out tool_calls entries that never received a function name', async () => {
    // Pathological / defensive: a delta announces index 0 with only an id,
    // and never delivers the name. Such ghost entries must be dropped from
    // the final aggregate so downstream dispatch does not crash on empty name.
    mockSseResponse([
      deltaChunk({
        tool_calls: [{ index: 0, id: 'ghost', type: 'function' }],
      }),
      deltaChunk({
        tool_calls: [
          { index: 1, id: 'real', type: 'function', function: { name: 'real_tool', arguments: '{}' } },
        ],
      }),
      deltaChunk({}, 'tool_calls'),
    ]);

    const result = await chatStream(BASE_REQ);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].function.name).toBe('real_tool');
  });

  it('returns no toolCalls field when stream is pure content (back-compat)', async () => {
    mockSseResponse([
      deltaChunk({ content: 'hello ' }),
      deltaChunk({ content: 'world' }, 'stop'),
    ]);

    const result = await chatStream(BASE_REQ);
    expect(result.content).toBe('hello world');
    expect(result.finishReason).toBe('stop');
    expect(result.toolCalls).toBeUndefined();
  });

  it('accepts mixed content + tool_calls in same stream (rare but legal)', async () => {
    mockSseResponse([
      deltaChunk({ content: 'thinking…' }),
      deltaChunk({
        tool_calls: [
          { index: 0, id: 'c1', type: 'function', function: { name: 'fx', arguments: '{}' } },
        ],
      }),
      deltaChunk({}, 'tool_calls'),
    ]);

    const result = await chatStream(BASE_REQ);
    expect(result.content).toBe('thinking…');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].function.name).toBe('fx');
  });
});
