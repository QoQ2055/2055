// PR-D · Phase 1 step 2/5 · tool type definitions (pure types, zero runtime).
//
// Boundary:
//   - This file ONLY contains TS interfaces & string-literal unions.
//   - JSON Schema constants live in `./registry.ts` (kept in sync via tests).
//   - Runtime validation & handlers come in PR-E.
//   - Wire-up into runner.ts comes in PR-F.

import type { OutFormat } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tool name registry (single source of truth for the 5 Phase-1 tools).
// Adding a new tool means: extend ToolName + ToolArgsMap + registry.ts schema.
// ─────────────────────────────────────────────────────────────────────────────

export type ToolName =
  | 'save_step_output'
  | 'transition_to_step'
  | 'save_checkpoint'
  | 'run_selfcheck'
  | 'update_continuity_table';

export const TOOL_NAMES: readonly ToolName[] = [
  'save_step_output',
  'transition_to_step',
  'save_checkpoint',
  'run_selfcheck',
  'update_continuity_table',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. save_step_output · persist a step's output artifact to the project store.
//    Replaces the old "model emits free text → runner manually parses" path
//    for steps that need structured persistence (storyboard.2 units, MM5 etc).
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveStepOutputArgs {
  /** Step id matching ManifestStep.id, e.g. "screenplay.1" or "storyboard.2.unit_3". */
  stepId: string;
  /** Raw output content. Markdown / JSON-string / plain text. */
  content: string;
  /** Output format hint (defaults to inherited ManifestStep.outFormat). */
  format?: OutFormat;
  /**
   * Optional metadata. Forwarded into NodeArtifact.meta verbatim. Use for
   * self-check reports, manual flags, mirroredFrom, etc.
   */
  meta?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. transition_to_step · advance the workflow to the next step.
//    Lets the model gate progression on its own completion signal instead of
//    relying solely on stop-sequence parsing.
// ─────────────────────────────────────────────────────────────────────────────

export interface TransitionToStepArgs {
  /** The step the model just finished. Must match the current runner step. */
  fromStepId: string;
  /** The next step to enter. Runner validates manifest adjacency. */
  toStepId: string;
  /** Human-readable rationale (logged to RunHistory for audit). */
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. save_checkpoint · named snapshot for resumable workflows.
//    Scope=project freezes ALL artifacts; scope=step freezes only the named step.
// ─────────────────────────────────────────────────────────────────────────────

export type CheckpointScope = 'project' | 'step';

export interface SaveCheckpointArgs {
  /** User-visible checkpoint name. Unique within a project. */
  name: string;
  description?: string;
  scope: CheckpointScope;
  /** Required when scope='step'. Ignored otherwise. */
  stepId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. run_selfcheck · enqueue a self-check pass over an artifact.
//    Does NOT execute synchronously — handler returns a request id; PR-G UI
//    surfaces progress. Allowed checks mirror selfCheck.ts dimensions.
// ─────────────────────────────────────────────────────────────────────────────

export type SelfcheckDimension = 'grounding' | 'continuity' | 'pacing' | 'cliche';

export const SELFCHECK_DIMENSIONS: readonly SelfcheckDimension[] = [
  'grounding',
  'continuity',
  'pacing',
  'cliche',
] as const;

export interface RunSelfcheckArgs {
  /** Target artifact id (nodeId in current schema). */
  artifactId: string;
  /** Dimensions to check. At least one required. */
  checks: SelfcheckDimension[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. update_continuity_table · upsert / delete a row in one of the MM5 tables.
//    Maps to src/store/continuity/{foreshadows,characterArcs,worldRules,
//    rhythmDiagnostics}.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type ContinuityTable =
  | 'foreshadow'
  | 'character_arc'
  | 'world_rule'
  | 'rhythm_diagnostic';

export const CONTINUITY_TABLES: readonly ContinuityTable[] = [
  'foreshadow',
  'character_arc',
  'world_rule',
  'rhythm_diagnostic',
] as const;

export type ContinuityOp = 'upsert' | 'delete';

export interface UpdateContinuityTableArgs {
  table: ContinuityTable;
  op: ContinuityOp;
  /**
   * Row id. Required for delete. Optional for upsert: if absent the handler
   * MUST generate a new id and treat the call as an insert.
   */
  rowId?: string;
  /**
   * Row payload. Required for upsert. Must conform to the table's row schema
   * (validated by the handler against MM5 ForeshadowRow / CharacterArcRow /
   * WorldRuleRow / RhythmDiagnosticRow). Ignored for delete.
   */
  data?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolArgsMap · static lookup from tool name to its argument type. Used by
// PR-E/PR-F dispatcher to keep handler signatures type-safe end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolArgsMap {
  save_step_output: SaveStepOutputArgs;
  transition_to_step: TransitionToStepArgs;
  save_checkpoint: SaveCheckpointArgs;
  run_selfcheck: RunSelfcheckArgs;
  update_continuity_table: UpdateContinuityTableArgs;
}

/**
 * Standard envelope for handler results (PR-E will implement). Defined here
 * so registry / future dispatcher can reference it without circular import.
 *
 * `ok=false` means the handler refused to execute (validation / business
 * rule). It is NOT a thrown error — runner.ts in PR-F serializes the envelope
 * back to the model as a tool message so the model can self-correct.
 */
export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  /** Short human-readable reason. Surfaced to the model verbatim. */
  message?: string;
}
