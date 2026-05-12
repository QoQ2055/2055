// PR-G · toolCallLog store unit tests.

import { afterEach, describe, expect, it } from 'vitest';
import { useToolCallLog, selectToolCallSummary } from '../toolCallLog';

afterEach(() => {
  useToolCallLog.getState().reset();
});

describe('useToolCallLog', () => {
  it('starts idle', () => {
    const s = useToolCallLog.getState();
    expect(s.activeRunId).toBeNull();
    expect(s.entries).toEqual([]);
    expect(s.totalCalls).toBe(0);
    expect(s.failedCalls).toBe(0);
  });

  it('beginRun resets counters and entries', () => {
    const s = useToolCallLog.getState();
    s.beginRun('run-1');
    s.startRound(1);
    s.recordEntry({ round: 1, name: 'save_step_output', ok: true, durationMs: 12 });
    s.recordEntry({ round: 1, name: 'run_selfcheck', ok: false, message: 'oops', durationMs: 3 });
    expect(useToolCallLog.getState().totalCalls).toBe(2);
    expect(useToolCallLog.getState().failedCalls).toBe(1);

    s.beginRun('run-2');
    const after = useToolCallLog.getState();
    expect(after.activeRunId).toBe('run-2');
    expect(after.entries).toEqual([]);
    expect(after.totalCalls).toBe(0);
    expect(after.failedCalls).toBe(0);
  });

  it('recordEntry appends entries and tracks failures', () => {
    const s = useToolCallLog.getState();
    s.beginRun('r');
    s.recordEntry({ round: 1, name: 'a', ok: true, durationMs: 1 });
    s.recordEntry({ round: 1, name: 'b', ok: false, message: 'bad', durationMs: 2 });
    s.recordEntry({ round: 2, name: 'c', ok: true, durationMs: 3 });
    const next = useToolCallLog.getState();
    expect(next.entries.map((e) => e.name)).toEqual(['a', 'b', 'c']);
    expect(next.totalCalls).toBe(3);
    expect(next.failedCalls).toBe(1);
    expect(next.entries.every((e) => typeof e.id === 'number' && e.id > 0)).toBe(true);
    expect(next.entries.every((e) => typeof e.ts === 'number')).toBe(true);
  });

  it('caps entries at MAX_ENTRIES (200)', () => {
    const s = useToolCallLog.getState();
    s.beginRun('r');
    for (let i = 0; i < 250; i++) {
      s.recordEntry({ round: 1, name: `t${i}`, ok: true, durationMs: 0 });
    }
    const cur = useToolCallLog.getState();
    expect(cur.entries.length).toBe(200);
    expect(cur.totalCalls).toBe(250);
    // Oldest dropped → first remaining is t50.
    expect(cur.entries[0].name).toBe('t50');
    expect(cur.entries[199].name).toBe('t249');
  });

  it('startRound updates currentRound and rounds high-water mark', () => {
    const s = useToolCallLog.getState();
    s.beginRun('r');
    s.startRound(1);
    expect(useToolCallLog.getState().currentRound).toBe(1);
    expect(useToolCallLog.getState().rounds).toBe(1);
    s.startRound(3);
    expect(useToolCallLog.getState().currentRound).toBe(3);
    expect(useToolCallLog.getState().rounds).toBe(3);
    s.startRound(2); // out-of-order does not regress high-water
    expect(useToolCallLog.getState().rounds).toBe(3);
    expect(useToolCallLog.getState().currentRound).toBe(2);
  });

  it('endRun clears activeRunId without losing history', () => {
    const s = useToolCallLog.getState();
    s.beginRun('r');
    s.recordEntry({ round: 1, name: 'a', ok: true, durationMs: 0 });
    s.endRun();
    const cur = useToolCallLog.getState();
    expect(cur.activeRunId).toBeNull();
    expect(cur.entries.length).toBe(1);
  });

  it('selectToolCallSummary surfaces the latest entry', () => {
    const s = useToolCallLog.getState();
    s.beginRun('r');
    s.startRound(2);
    s.recordEntry({ round: 2, name: 'ping', ok: false, message: 'x', durationMs: 1 });
    const sel = selectToolCallSummary(useToolCallLog.getState());
    expect(sel.active).toBe(true);
    expect(sel.round).toBe(2);
    expect(sel.totalCalls).toBe(1);
    expect(sel.failedCalls).toBe(1);
    expect(sel.lastEntry?.name).toBe('ping');
  });
});
