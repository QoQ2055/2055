// PR-G · Phase 1 step 5/5 · Tool-call observability store.
//
// Single global zustand store that captures the timeline of tool-call activity
// for the active runner pass. UI components (ToolCallStatusBar, future
// inspector panels) subscribe to render progress; buildToolContext binds
// `recordToolCall` and round/dispatch callbacks into here so the model's
// tool loop is observable end-to-end without coupling pipeline code to React.
//
// Design notes:
//   - Bounded ring buffer (max 200 entries) so a runaway loop cannot OOM the
//     browser. Oldest entries are dropped FIFO.
//   - Pure in-memory (NOT persisted). On reload the log is empty by design;
//     run history & artifacts are the durable trail.
//   - All mutators are no-throw — failures inside observability MUST never
//     break the tool loop itself (handlers depend on this).

import { create } from 'zustand';

export interface ToolCallLogEntry {
  /** Monotonic per-store id (not a UUID). */
  id: number;
  /** ISO timestamp of when the entry was recorded. */
  ts: number;
  /** Round index (1-based) of the chatStreamWithTools loop. */
  round: number;
  /** Tool name as emitted by the model. */
  name: string;
  /** True iff handler returned ok:true. */
  ok: boolean;
  /** Short human-readable status / error message. */
  message?: string;
  /** Wall-clock duration (ms). */
  durationMs: number;
  /** Truncated args preview for inspection (max ~512 chars JSON). */
  argsPreview?: string;
}

export interface ToolCallLogStore {
  /** Currently in-progress run id; null when idle. */
  activeRunId: string | null;
  /** Round currently in flight (0 when idle). */
  currentRound: number;
  /** Total rounds observed in this run. */
  rounds: number;
  /** Total tool dispatches observed in this run. */
  totalCalls: number;
  /** Total failed dispatches in this run. */
  failedCalls: number;
  /** Recent entries (most recent last). Bounded to MAX_ENTRIES. */
  entries: ToolCallLogEntry[];

  /** Begin a new run scope; resets counters and clears entries. */
  beginRun: (runId: string) => void;
  /** Mark a round as starting. */
  startRound: (round: number) => void;
  /** Append an entry. Hard-coded no-throw. */
  recordEntry: (e: Omit<ToolCallLogEntry, 'id' | 'ts'>) => void;
  /** Mark the current run as ended (clears activeRunId). */
  endRun: () => void;
  /** Wipe the store (used by tests / project switch). */
  reset: () => void;
}

const MAX_ENTRIES = 200;

let _idCounter = 0;
function nextId(): number {
  _idCounter = (_idCounter + 1) | 0;
  if (_idCounter <= 0) _idCounter = 1;
  return _idCounter;
}

export const useToolCallLog = create<ToolCallLogStore>((set) => ({
  activeRunId: null,
  currentRound: 0,
  rounds: 0,
  totalCalls: 0,
  failedCalls: 0,
  entries: [],

  beginRun: (runId) =>
    set({
      activeRunId: runId,
      currentRound: 0,
      rounds: 0,
      totalCalls: 0,
      failedCalls: 0,
      entries: [],
    }),

  startRound: (round) =>
    set((s) => ({
      currentRound: round,
      rounds: Math.max(s.rounds, round),
    })),

  recordEntry: (e) =>
    set((s) => {
      const entry: ToolCallLogEntry = {
        id: nextId(),
        ts: Date.now(),
        ...e,
      };
      const next = [...s.entries, entry];
      while (next.length > MAX_ENTRIES) next.shift();
      return {
        entries: next,
        totalCalls: s.totalCalls + 1,
        failedCalls: s.failedCalls + (e.ok ? 0 : 1),
      };
    }),

  endRun: () => set({ activeRunId: null, currentRound: 0 }),

  reset: () =>
    set({
      activeRunId: null,
      currentRound: 0,
      rounds: 0,
      totalCalls: 0,
      failedCalls: 0,
      entries: [],
    }),
}));

/** Convenience selector for the status bar. */
export function selectToolCallSummary(s: ToolCallLogStore): {
  active: boolean;
  round: number;
  totalCalls: number;
  failedCalls: number;
  lastEntry?: ToolCallLogEntry;
} {
  return {
    active: s.activeRunId != null,
    round: s.currentRound,
    totalCalls: s.totalCalls,
    failedCalls: s.failedCalls,
    lastEntry: s.entries.length ? s.entries[s.entries.length - 1] : undefined,
  };
}
