// PR-G · buildToolContext factory tests.
//
// Strategy: hand-craft a Manifest object so we don't depend on fetch.
// dexie continuity tables run against fake-indexeddb (vitest setup).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildToolContextSync,
  _resetToolContextStubs,
  readCheckpointQueue,
  readSelfcheckQueue,
  clearCheckpointQueue,
  clearSelfcheckQueue,
} from '../buildToolContext';
import { db } from '../../../store/db';
import { useProject } from '../../../store/project';
import { useToolCallLog } from '../../../store/toolCallLog';
import { dispatchToolCall } from '../dispatch';
import type { Manifest } from '../../types';

// ── manifest fixture ─────────────────────────────────────────────────────────

function fixtureManifest(): Manifest {
  return {
    stages: [
      {
        id: 'screenplay',
        title: 'Screenplay',
        steps: [
          {
            id: 'screenplay.1',
            index: 0,
            title: 'Outline',
            prompt: 'prompts/sp1.json',
            outFormat: 'markdown',
          },
          {
            id: 'screenplay.2',
            index: 1,
            title: 'Treatment',
            prompt: 'prompts/sp2.json',
            outFormat: 'markdown',
          },
        ],
      },
      {
        id: 'storyboard',
        title: 'Storyboard',
        steps: [
          {
            id: 'storyboard.1',
            index: 0,
            title: 'Plan',
            prompt: 'prompts/sb1.json',
            outFormat: 'markdown',
          },
        ],
      },
    ],
  } as unknown as Manifest;
}

// ── shared cleanup ───────────────────────────────────────────────────────────

beforeEach(async () => {
  _resetToolContextStubs();
  clearCheckpointQueue();
  clearSelfcheckQueue();
  await db.foreshadowTable.clear();
  await db.characterArcTable.clear();
  await db.worldContinuityTable.clear();
  await db.rhythmDiagnosticTable.clear();
  useProject.setState({ artifacts: {}, passed: {}, stale: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── ArtifactIO ─────────────────────────────────────────────────────────────

describe('buildToolContext · ArtifactIO', () => {
  it('getStepMeta returns manifest entry', () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.getStepMeta('screenplay.1')).toEqual({
      stageId: 'screenplay',
      index: 0,
      title: 'Outline',
      format: 'markdown',
    });
    expect(ctx.getStepMeta('storyboard.1')?.stageId).toBe('storyboard');
  });

  it('getStepMeta returns undefined for unknown step', () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.getStepMeta('does.not.exist')).toBeUndefined();
  });

  it('upsertArtifact writes through useProject', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    ctx.upsertArtifact({
      nodeId: 'screenplay.1',
      stageId: 'screenplay',
      index: 0,
      title: 'Outline',
      format: 'markdown',
      content: 'hello',
      durationMs: 0,
      ts: Date.now(),
    });
    const stored = useProject.getState().artifacts['screenplay.1'];
    expect(stored?.content).toBe('hello');
  });
});

// ─── WorkflowIO ─────────────────────────────────────────────────────────────

describe('buildToolContext · WorkflowIO', () => {
  it('current step id round-trips through setter/getter', () => {
    const ctx = buildToolContextSync(fixtureManifest(), {
      projectId: 1,
      currentStepId: 'screenplay.1',
    });
    expect(ctx.getCurrentStepId()).toBe('screenplay.1');
    ctx.setCurrentStepId('screenplay.2');
    expect(ctx.getCurrentStepId()).toBe('screenplay.2');
  });

  it('isAdjacentTransition allows next-in-stage', () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.isAdjacentTransition('screenplay.1', 'screenplay.2')).toBe(true);
  });

  it('isAdjacentTransition rejects same-step / backwards / skip', () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.isAdjacentTransition('screenplay.1', 'screenplay.1')).toBe(false);
    expect(ctx.isAdjacentTransition('screenplay.2', 'screenplay.1')).toBe(false);
  });

  it('isAdjacentTransition allows last-of-stage → first-of-next-stage', () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.isAdjacentTransition('screenplay.2', 'storyboard.1')).toBe(true);
  });

  it('isAdjacentTransition rejects unknown step ids', () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.isAdjacentTransition('???', 'screenplay.1')).toBe(false);
    expect(ctx.isAdjacentTransition('screenplay.1', '???')).toBe(false);
  });
});

// ─── CheckpointIO / SelfcheckIO stubs ────────────────────────────────────────

describe('buildToolContext · checkpoint + selfcheck stubs', () => {
  it('saveCheckpoint enqueues with stable id and recoverable scope', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    const id = await ctx.saveCheckpoint({ name: 'cp1', scope: 'project' });
    expect(typeof id).toBe('string');
    const queue = readCheckpointQueue();
    expect(queue.length).toBe(1);
    expect(queue[0]).toMatchObject({ id, name: 'cp1', scope: 'project' });
    expect(queue[0].ts).toBeGreaterThan(0);
  });

  it('enqueueSelfcheck records dimensions verbatim', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    const id = await ctx.enqueueSelfcheck({
      artifactId: 'screenplay.1',
      checks: ['grounding', 'continuity'],
    });
    expect(typeof id).toBe('string');
    const q = readSelfcheckQueue();
    expect(q.length).toBe(1);
    expect(q[0].artifactId).toBe('screenplay.1');
    expect(q[0].checks).toEqual(['grounding', 'continuity']);
  });
});

// ─── ContinuityIO bindings ──────────────────────────────────────────────────

describe('buildToolContext · ContinuityIO', () => {
  it('foreshadow.upsert insert + update flow', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 7 });
    const ins = await ctx.continuity.foreshadow.upsert(
      {
        title: '神秘信物',
        content: '主角捡到吊坠',
        status: 'planted',
        weight: 'major',
        setupChapter: 1,
      },
      7,
    );
    expect(ins.id).toBeGreaterThan(0);
    const row = await db.foreshadowTable.get(ins.id);
    expect(row?.projectId).toBe(7);
    expect(row?.status).toBe('planted');

    const upd = await ctx.continuity.foreshadow.upsert(
      { status: 'resolved', payoffChapter: 4 },
      7,
      ins.id,
    );
    expect(upd.id).toBe(ins.id);
    const after = await db.foreshadowTable.get(ins.id);
    expect(after?.status).toBe('resolved');
    expect(after?.payoffChapter).toBe(4);
    expect(after?.title).toBe('神秘信物'); // unchanged
  });

  it('foreshadow.upsert rejects insert missing required fields', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 7 });
    await expect(
      ctx.continuity.foreshadow.upsert({ title: 'x' }, 7),
    ).rejects.toThrow(/missing required field/);
  });

  it('character_arc.upsert insert', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    const r = await ctx.continuity.character_arc.upsert(
      {
        characterName: '李白',
        epoch: 'opening',
        chapter: 1,
        state: '少年得志，恃才傲物',
      },
      1,
    );
    expect(r.id).toBeGreaterThan(0);
    const row = await db.characterArcTable.get(r.id);
    expect(row?.characterName).toBe('李白');
  });

  it('world_rule.upsert + remove', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 2 });
    const r = await ctx.continuity.world_rule.upsert(
      {
        domain: 'magic-system',
        rule: '凡人不可使用元神之力',
        severity: 'hard',
        chapter: 1,
      },
      2,
    );
    expect(r.id).toBeGreaterThan(0);
    await ctx.continuity.world_rule.remove(r.id);
    const after = await db.worldContinuityTable.get(r.id);
    expect(after).toBeUndefined();
  });

  it('rhythm_diagnostic.upsert uses composite key (replace on collision)', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 3 });
    const a = await ctx.continuity.rhythm_diagnostic.upsert(
      { chapter: 2, sceneIdx: 0, tension: 3, emotion: -1 },
      3,
    );
    const b = await ctx.continuity.rhythm_diagnostic.upsert(
      { chapter: 2, sceneIdx: 0, tension: 7, emotion: 2 },
      3,
    );
    expect(a.id).toBe(b.id); // same composite key => same row id
    const row = await db.rhythmDiagnosticTable.get(a.id);
    expect(row?.tension).toBe(7);
    expect(row?.emotion).toBe(2);
  });

  it('rhythm_diagnostic.upsert rejects when tension/emotion missing', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 3 });
    await expect(
      ctx.continuity.rhythm_diagnostic.upsert(
        { chapter: 1, sceneIdx: 0 },
        3,
      ),
    ).rejects.toThrow(/missing required field/);
  });
});

// ─── recordToolCall observability ───────────────────────────────────────────

describe('buildToolContext · recordToolCall → toolCallLog', () => {
  it('default recordToolCall pushes entry into useToolCallLog', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    expect(ctx.recordToolCall).toBeDefined();

    useToolCallLog.getState().beginRun('test');
    useToolCallLog.getState().startRound(1);
    ctx.recordToolCall!({
      name: 'save_step_output',
      args: { stepId: 'screenplay.1', content: 'hi' },
      ok: true,
      durationMs: 5,
    });
    const log = useToolCallLog.getState();
    expect(log.entries.length).toBe(1);
    expect(log.entries[0]).toMatchObject({
      round: 1,
      name: 'save_step_output',
      ok: true,
      durationMs: 5,
    });
    expect(log.entries[0].argsPreview).toContain('screenplay.1');
    expect(log.totalCalls).toBe(1);
  });

  it('recordToolCall failures do not throw out', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    // Force the underlying store to throw by mutating it temporarily.
    const orig = useToolCallLog.getState().recordEntry;
    useToolCallLog.setState({
      recordEntry: () => {
        throw new Error('boom');
      },
    });
    expect(() =>
      ctx.recordToolCall!({
        name: 'x',
        args: {},
        ok: false,
        message: 'fail',
        durationMs: 1,
      }),
    ).not.toThrow();
    // Restore
    useToolCallLog.setState({ recordEntry: orig });
  });

  it('overrides.recordToolCall replaces default', () => {
    const spy = vi.fn();
    const ctx = buildToolContextSync(fixtureManifest(), {
      projectId: 1,
      overrides: { recordToolCall: spy },
    });
    ctx.recordToolCall!({ name: 'z', args: {}, ok: true, durationMs: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ─── end-to-end via dispatcher ──────────────────────────────────────────────

describe('buildToolContext · dispatcher round-trip', () => {
  it('dispatchToolCall(save_step_output) writes artifact through real ctx', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 1 });
    const result = await dispatchToolCall(
      {
        id: 'tc1',
        type: 'function',
        function: {
          name: 'save_step_output',
          arguments: JSON.stringify({
            stepId: 'screenplay.1',
            content: '# outline',
          }),
        },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(useProject.getState().artifacts['screenplay.1']?.content).toBe('# outline');
  });

  it('dispatchToolCall(update_continuity_table) writes to dexie', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), { projectId: 9 });
    const result = await dispatchToolCall(
      {
        id: 'tc2',
        type: 'function',
        function: {
          name: 'update_continuity_table',
          arguments: JSON.stringify({
            table: 'foreshadow',
            op: 'upsert',
            data: {
              title: '断头线',
              content: '埋了忘收',
              status: 'broken',
              weight: 'critical',
              setupChapter: 3,
            },
          }),
        },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const rows = await db.foreshadowTable.where('projectId').equals(9).toArray();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('broken');
  });

  it('dispatchToolCall(transition_to_step) updates currentStepId via real ctx', async () => {
    const ctx = buildToolContextSync(fixtureManifest(), {
      projectId: 1,
      currentStepId: 'screenplay.1',
    });
    const result = await dispatchToolCall(
      {
        id: 'tc3',
        type: 'function',
        function: {
          name: 'transition_to_step',
          arguments: JSON.stringify({
            fromStepId: 'screenplay.1',
            toStepId: 'screenplay.2',
            reason: 'done',
          }),
        },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(ctx.getCurrentStepId()).toBe('screenplay.2');
  });
});
