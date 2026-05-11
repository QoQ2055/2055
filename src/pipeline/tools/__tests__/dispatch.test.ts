// PR-E · dispatcher + handler integration tests with a mock ToolContext.
//
// What is covered:
//   - Each of the 5 handlers via dispatchToolCall (happy + targeted failure).
//   - Conditional-required rules the JSON Schema cannot express
//     (save_checkpoint scope=step ⇒ stepId; update_continuity_table op=upsert ⇒ data).
//   - Unknown tool / bad JSON / schema violation → ok:false envelope, no throw.
//   - dispatchToolCallsToMessages produces well-formed role:'tool' messages.
//   - recordToolCall audit hook fires with correct metadata; failure inside
//     hook does not bubble out.
//
// Mock IO: a fully in-memory ToolContext (no zustand, no dexie).

import { describe, it, expect, vi } from 'vitest';
import {
  dispatchToolCall,
  dispatchToolCallsToMessages,
} from '../dispatch';
import type { ToolContext } from '../context';
import type { ToolCall } from '../../../llm/deepseek';

// ── mock factory ─────────────────────────────────────────────────────────────

interface MockCalls {
  artifactsUpserted: unknown[];
  stepIds: string[];
  checkpoints: unknown[];
  selfchecks: unknown[];
  continuityOps: Array<{ table: string; op: string; data?: unknown; id?: number }>;
  audit: unknown[];
}

interface MockOptions {
  /** When set, ctx.getStepMeta returns undefined for these ids. */
  unknownSteps?: string[];
  /** When set, override the adjacency check (default: true for all pairs). */
  adjacency?: (from: string, to: string) => boolean;
  /** When set, override current step id (default: null). */
  currentStepId?: string | null;
  /** When true, ctx.upsertArtifact throws on call. */
  throwOnUpsert?: boolean;
  /** When true, audit hook throws. */
  throwOnAudit?: boolean;
  /** When true, do NOT supply a recordToolCall hook (test ctx without audit). */
  omitAudit?: boolean;
}

function makeCtx(opts: MockOptions = {}): { ctx: ToolContext; calls: MockCalls } {
  const calls: MockCalls = {
    artifactsUpserted: [],
    stepIds: [],
    checkpoints: [],
    selfchecks: [],
    continuityOps: [],
    audit: [],
  };
  let currentStepId: string | null = opts.currentStepId ?? null;
  let cpCounter = 0;
  let scCounter = 0;
  let continuityRowCounter = 100;

  const continuityMock = (table: string) => ({
    upsert: async (data: Record<string, unknown>, _projectId: number, rowId?: number) => {
      const id = rowId ?? ++continuityRowCounter;
      calls.continuityOps.push({ table, op: 'upsert', data, id });
      return { id };
    },
    remove: async (id: number) => {
      calls.continuityOps.push({ table, op: 'remove', id });
    },
  });

  const ctx: ToolContext = {
    projectId: 1,
    getStepMeta: (stepId) => {
      if (opts.unknownSteps?.includes(stepId)) return undefined;
      return {
        stageId: 'screenplay',
        index: parseInt(stepId.split('.').pop() ?? '1', 10) || 1,
        title: `Step ${stepId}`,
        format: 'markdown',
      };
    },
    upsertArtifact: (a) => {
      if (opts.throwOnUpsert) throw new Error('idb full');
      calls.artifactsUpserted.push(a);
    },
    getCurrentStepId: () => currentStepId,
    setCurrentStepId: (id) => {
      currentStepId = id;
      calls.stepIds.push(id);
    },
    isAdjacentTransition: opts.adjacency ?? (() => true),
    saveCheckpoint: async (cp) => {
      const id = `cp_${++cpCounter}`;
      calls.checkpoints.push({ id, ...cp });
      return id;
    },
    enqueueSelfcheck: async (req) => {
      const id = `sc_${++scCounter}`;
      calls.selfchecks.push({ id, ...req });
      return id;
    },
    continuity: {
      foreshadow: continuityMock('foreshadow'),
      character_arc: continuityMock('character_arc'),
      world_rule: continuityMock('world_rule'),
      rhythm_diagnostic: continuityMock('rhythm_diagnostic'),
    },
    recordToolCall: opts.omitAudit
      ? undefined
      : (info) => {
          if (opts.throwOnAudit) throw new Error('audit blew up');
          calls.audit.push(info);
        },
  };

  return { ctx, calls };
}

function makeCall(name: string, args: Record<string, unknown>, id = 'call_test'): ToolCall {
  return {
    id,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('dispatch · save_step_output', () => {
  it('happy: writes artifact and returns ok with byte count', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('save_step_output', { stepId: 'screenplay.1', content: 'hello' }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(calls.artifactsUpserted).toHaveLength(1);
    expect((r.data as { bytes: number }).bytes).toBe(5);
  });

  it('failure: unknown stepId surfaces ok=false', async () => {
    const { ctx, calls } = makeCtx({ unknownSteps: ['ghost.0'] });
    const r = await dispatchToolCall(
      makeCall('save_step_output', { stepId: 'ghost.0', content: 'x' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not found in active manifest/);
    expect(calls.artifactsUpserted).toHaveLength(0);
  });

  it('failure: upsertArtifact throws → handler catches', async () => {
    const { ctx } = makeCtx({ throwOnUpsert: true });
    const r = await dispatchToolCall(
      makeCall('save_step_output', { stepId: 'screenplay.1', content: 'x' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/upsertArtifact threw: idb full/);
  });
});

describe('dispatch · transition_to_step', () => {
  it('happy: legal adjacent transition with no current step', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('transition_to_step', { fromStepId: 'a.1', toStepId: 'a.2' }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(calls.stepIds).toEqual(['a.2']);
  });

  it('failure: mismatched current step', async () => {
    const { ctx } = makeCtx({ currentStepId: 'b.1' });
    const r = await dispatchToolCall(
      makeCall('transition_to_step', { fromStepId: 'a.1', toStepId: 'a.2' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/runner is on step "b\.1"/);
  });

  it('failure: non-adjacent transition rejected', async () => {
    const { ctx } = makeCtx({ adjacency: () => false });
    const r = await dispatchToolCall(
      makeCall('transition_to_step', { fromStepId: 'a.1', toStepId: 'c.7' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not adjacent/);
  });

  it('failure: self-loop rejected', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('transition_to_step', { fromStepId: 'a.1', toStepId: 'a.1' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no-op transition refused/);
  });
});

describe('dispatch · save_checkpoint', () => {
  it('happy: project scope', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('save_checkpoint', { name: 'after-8', scope: 'project' }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(calls.checkpoints).toHaveLength(1);
    expect((r.data as { id: string }).id).toBe('cp_1');
  });

  it('happy: step scope with stepId', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('save_checkpoint', { name: 'cp', scope: 'step', stepId: 'screenplay.3' }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect((calls.checkpoints[0] as { stepId: string }).stepId).toBe('screenplay.3');
  });

  it('failure: step scope without stepId', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('save_checkpoint', { name: 'cp', scope: 'step' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/requires stepId/);
  });
});

describe('dispatch · run_selfcheck', () => {
  it('happy: enqueues and returns request id', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('run_selfcheck', {
        artifactId: 'screenplay.1',
        checks: ['grounding', 'continuity'],
      }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(calls.selfchecks).toHaveLength(1);
    expect((r.data as { requestId: string }).requestId).toBe('sc_1');
  });

  it('dedups duplicate checks and preserves canonical order', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('run_selfcheck', {
        artifactId: 'a',
        // model emits dupes + out-of-order
        checks: ['cliche', 'grounding', 'grounding', 'pacing'],
      }),
      ctx,
    );
    expect(r.ok).toBe(true);
    // canonical order: grounding, continuity, pacing, cliche → after filter:
    expect((r.data as { checks: string[] }).checks).toEqual(['grounding', 'pacing', 'cliche']);
  });
});

describe('dispatch · update_continuity_table', () => {
  it('happy: upsert without rowId assigns one', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('update_continuity_table', {
        table: 'foreshadow',
        op: 'upsert',
        data: { title: 'r', setupChapter: 1, status: 'planted', weight: 'major' },
      }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(calls.continuityOps).toHaveLength(1);
    expect(calls.continuityOps[0].op).toBe('upsert');
    expect((r.data as { rowId: number }).rowId).toBeGreaterThan(0);
  });

  it('happy: delete with rowId string', async () => {
    const { ctx, calls } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('update_continuity_table', { table: 'world_rule', op: 'delete', rowId: '7' }),
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(calls.continuityOps[0]).toEqual({ table: 'world_rule', op: 'remove', id: 7 });
  });

  it('failure: upsert without data rejected', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('update_continuity_table', { table: 'foreshadow', op: 'upsert' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/requires a non-empty data object/);
  });

  it('failure: delete without rowId rejected', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('update_continuity_table', { table: 'foreshadow', op: 'delete' }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/requires a numeric rowId/);
  });

  it('failure: delete with non-numeric rowId rejected', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('update_continuity_table', {
        table: 'foreshadow',
        op: 'delete',
        rowId: 'abc',
      }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/requires a numeric rowId/);
  });
});

describe('dispatch · cross-cutting', () => {
  it('unknown tool returns ok=false (no throw)', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(makeCall('not_a_tool', {}), ctx);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/unknown tool/);
  });

  it('bad JSON returns ok=false', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      {
        id: 'x',
        type: 'function',
        function: { name: 'save_step_output', arguments: '{not-json' },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/invalid arguments/);
  });

  it('schema violation returns ok=false', async () => {
    const { ctx } = makeCtx();
    const r = await dispatchToolCall(
      makeCall('save_step_output', { stepId: 123 }), // wrong type + missing content
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/invalid arguments for save_step_output/);
  });

  it('audit hook fires with correct metadata', async () => {
    const { ctx, calls } = makeCtx();
    await dispatchToolCall(
      makeCall('save_step_output', { stepId: 'a.1', content: 'x' }),
      ctx,
    );
    expect(calls.audit).toHaveLength(1);
    expect(calls.audit[0]).toMatchObject({
      name: 'save_step_output',
      ok: true,
    });
    expect((calls.audit[0] as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('audit hook throwing does NOT bubble out of dispatcher', async () => {
    const { ctx } = makeCtx({ throwOnAudit: true });
    const r = await dispatchToolCall(
      makeCall('save_step_output', { stepId: 'a.1', content: 'x' }),
      ctx,
    );
    expect(r.ok).toBe(true); // dispatch result unaffected
  });

  it('no audit hook configured is fine (optional)', async () => {
    const { ctx } = makeCtx({ omitAudit: true });
    const r = await dispatchToolCall(
      makeCall('save_step_output', { stepId: 'a.1', content: 'x' }),
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it('handler unexpected throw is caught and serialized', async () => {
    // Inject a handler-level throw via continuity mock.
    const { ctx } = makeCtx();
    (ctx.continuity.foreshadow.upsert as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockRejectedValue(new Error('boom'));
    const r = await dispatchToolCall(
      makeCall('update_continuity_table', {
        table: 'foreshadow',
        op: 'upsert',
        data: { x: 1 },
      }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/foreshadow\.upsert threw: boom/);
  });
});

describe('dispatchToolCallsToMessages', () => {
  it('returns one role:tool message per call in order', async () => {
    const { ctx } = makeCtx();
    const calls = [
      makeCall('save_step_output', { stepId: 'a.1', content: 'x' }, 'c1'),
      makeCall('run_selfcheck', { artifactId: 'a.1', checks: ['grounding'] }, 'c2'),
    ];
    const msgs = await dispatchToolCallsToMessages(calls, ctx);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('tool');
    expect(msgs[0].tool_call_id).toBe('c1');
    expect(msgs[1].tool_call_id).toBe('c2');
    // Content is JSON-stringified ToolResult envelope
    const parsed0 = JSON.parse(msgs[0].content);
    expect(parsed0.ok).toBe(true);
    expect(parsed0.data.nodeId).toBe('a.1');
  });

  it('failures still produce tool messages (no exception escapes)', async () => {
    const { ctx } = makeCtx();
    const msgs = await dispatchToolCallsToMessages(
      [makeCall('not_a_tool', {}, 'bad')],
      ctx,
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].tool_call_id).toBe('bad');
    const parsed = JSON.parse(msgs[0].content);
    expect(parsed.ok).toBe(false);
  });
});
