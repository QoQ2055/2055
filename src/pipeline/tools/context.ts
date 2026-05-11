// PR-E · Phase 1 step 3/5 · ToolContext interface (IO injection seam).
//
// Why a context object instead of importing zustand / dexie inside handlers:
//   1. Handlers stay pure & synchronously-mockable for unit tests.
//   2. Real wiring (zustand store + dexie tables + runner manifest lookup)
//      is deferred to PR-F where runner.ts builds the ctx once per chat loop.
//   3. Server / CLI / future Tauri shell can supply alternative ctx impls.

import type {
  CharacterArcRow,
  ForeshadowRow,
  ForeshadowStatus,
  ForeshadowWeight,
  RhythmDiagnosticRow,
  WorldRuleRow,
  WorldRuleSeverity,
} from '../../store/continuity';
import type { NodeArtifact, OutFormat, StageId } from '../types';
import type { ContinuityTable, SelfcheckDimension, CheckpointScope } from './types';

// ─── per-handler IO surface ─────────────────────────────────────────────────

export interface ArtifactIO {
  /** Idempotent upsert into the active project. */
  upsertArtifact: (a: NodeArtifact) => void | Promise<void>;
  /** Look up the manifest metadata for a step id (needed by save_step_output). */
  getStepMeta: (stepId: string) =>
    | { stageId: StageId; index: number; title: string; format: OutFormat }
    | undefined;
}

export interface WorkflowIO {
  getCurrentStepId: () => string | null;
  setCurrentStepId: (id: string) => void;
  /**
   * Returns true iff `toStepId` is a legal successor of `fromStepId` per the
   * manifest. PR-F will implement this against the active manifest; PR-E
   * tests provide a stub.
   */
  isAdjacentTransition: (fromStepId: string, toStepId: string) => boolean;
}

export interface CheckpointRecord {
  /** Opaque id assigned by the store (uuid / nanoid / dexie auto-increment). */
  id: string;
  name: string;
  description?: string;
  scope: CheckpointScope;
  stepId?: string;
  ts: number;
}

export interface CheckpointIO {
  /** Persist a checkpoint. Returns the assigned id. */
  saveCheckpoint: (
    cp: Omit<CheckpointRecord, 'id' | 'ts'>,
  ) => Promise<string> | string;
}

export interface SelfcheckRequest {
  /** Opaque request id (handler picks the format; uuid or counter). */
  id: string;
  artifactId: string;
  checks: SelfcheckDimension[];
  ts: number;
}

export interface SelfcheckIO {
  /**
   * Enqueue a self-check pass. Returns the request id immediately; results
   * are surfaced via UI / future tool callbacks (out of scope for PR-E).
   */
  enqueueSelfcheck: (
    req: Omit<SelfcheckRequest, 'id' | 'ts'>,
  ) => Promise<string> | string;
}

// ─── continuity table IO ─────────────────────────────────────────────────────
//
// We expose a normalized 4-way `op` surface (upsert / remove) rather than
// re-exporting the 30+ specific dexie helpers. The handler routes by
// `args.table`. Real ctx in PR-F builds these by binding the dexie helpers.

export interface ContinuityRowUpsert {
  /** Continuity row id (numeric dexie auto-increment). Returned by handler. */
  id: number;
}

export interface ContinuityTableIO<TRow> {
  /**
   * `data` is the model-emitted payload (Record<string, unknown> from the
   * tool args). Implementation MUST validate against TRow's required fields
   * before writing — see handlers/updateContinuityTable.ts for the
   * shared narrowing helpers.
   */
  upsert: (data: Record<string, unknown>, projectId: number, rowId?: number) => Promise<ContinuityRowUpsert>;
  remove: (id: number) => Promise<void>;
  /** Used by tests / future tools. Optional in real impl. */
  _rowKind?: () => TRow; // phantom for TS only (never called)
}

export interface ContinuityIO {
  foreshadow: ContinuityTableIO<ForeshadowRow>;
  character_arc: ContinuityTableIO<CharacterArcRow>;
  world_rule: ContinuityTableIO<WorldRuleRow>;
  rhythm_diagnostic: ContinuityTableIO<RhythmDiagnosticRow>;
}

// Re-exports for handler convenience (callers don't need to import from store/).
export type {
  CharacterArcRow,
  ForeshadowRow,
  ForeshadowStatus,
  ForeshadowWeight,
  RhythmDiagnosticRow,
  WorldRuleRow,
  WorldRuleSeverity,
};

// ─── aggregate ──────────────────────────────────────────────────────────────

export interface ToolContext extends ArtifactIO, WorkflowIO, CheckpointIO, SelfcheckIO {
  /** Active project id (passed into continuity row upserts). */
  projectId: number;
  continuity: ContinuityIO;
  /**
   * Optional audit hook. Dispatcher invokes once per tool call, BEFORE
   * serializing the result back to the model. Implementations may write to
   * RunHistory / telemetry / console; failure must NOT throw.
   */
  recordToolCall?: (
    info: {
      name: string;
      args: unknown;
      ok: boolean;
      message?: string;
      durationMs: number;
    },
  ) => void;
}

// ─── helper: lookup by table name (typed) ────────────────────────────────────

export function getContinuityTableIO(
  ctx: ToolContext,
  table: ContinuityTable,
): ContinuityTableIO<unknown> {
  // Cast is safe: the 4 keys exactly match the ContinuityTable union.
  return ctx.continuity[table] as ContinuityTableIO<unknown>;
}
