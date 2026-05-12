// PR-G · Phase 1 step 5/5 · Real ToolContext factory.
//
// Binds the abstract IO surfaces declared in `./context.ts` to concrete
// production implementations:
//
//   ArtifactIO        → useProject (zustand) + manifest cache
//   WorkflowIO        → in-process workflow registry (until v9 epic adds a
//                       persisted workflow store)
//   CheckpointIO      → in-process queue (PR-G stub; persistence TBD)
//   SelfcheckIO       → in-process queue (PR-G stub; UI-observable)
//   ContinuityIO      → src/store/continuity dexie helpers (4 tables)
//   recordToolCall    → useToolCallLog observability store
//
// Test seam:
//   `buildToolContext` accepts an optional `overrides` bag so unit tests can
//   substitute in-memory fakes for any IO without touching production wiring.
//
// CK red-line #1: handlers MUST not reach back into zustand / dexie directly
// — they only see the ToolContext. This factory is the ONE place that knows
// about the concrete stores.

import type { Manifest, ManifestStep, NodeArtifact, StageId } from '../types';
import { listStage, loadManifest } from '../manifest';
import { useProject } from '../../store/project';
import { useToolCallLog } from '../../store/toolCallLog';
import {
  addCharacterArc,
  addForeshadow,
  addWorldRule,
  upsertRhythmDiagnostic,
  updateCharacterArc,
  updateForeshadow,
  updateWorldRule,
} from '../../store/continuity';
import { db } from '../../store/db';
import type {
  ArtifactIO,
  CheckpointIO,
  CheckpointRecord,
  ContinuityIO,
  ContinuityTableIO,
  SelfcheckIO,
  SelfcheckRequest,
  ToolContext,
  WorkflowIO,
} from './context';
import type {
  CharacterArcRow,
  ForeshadowRow,
  ForeshadowStatus,
  ForeshadowWeight,
  RhythmDiagnosticRow,
  WorldRuleRow,
  WorldRuleSeverity,
} from '../../store/continuity';

// ─── manifest-aware ArtifactIO ──────────────────────────────────────────────

interface ManifestStepIndex {
  byId: Map<string, { stageId: StageId; step: ManifestStep }>;
}

function indexManifest(manifest: Manifest): ManifestStepIndex {
  const byId = new Map<string, { stageId: StageId; step: ManifestStep }>();
  for (const stage of manifest.stages) {
    for (const step of listStage(manifest, stage.id)) {
      byId.set(step.id, { stageId: stage.id, step });
    }
  }
  return { byId };
}

function buildArtifactIO(index: ManifestStepIndex): ArtifactIO {
  return {
    upsertArtifact: (a: NodeArtifact) => {
      useProject.getState().upsertArtifact(a);
    },
    getStepMeta: (stepId: string) => {
      const hit = index.byId.get(stepId);
      if (!hit) return undefined;
      return {
        stageId: hit.stageId,
        index: hit.step.index,
        title: hit.step.title,
        format: hit.step.outFormat,
      };
    },
  };
}

// ─── WorkflowIO (in-process) ────────────────────────────────────────────────
//
// Until a persisted workflow store lands, the runner injects the *current*
// step id when calling `buildToolContext` and the manifest-derived adjacency
// table is the source of truth for transitions. Mutations via setCurrentStepId
// are visible to subsequent dispatches in the same loop but do NOT survive a
// page reload — by design.

export interface WorkflowState {
  currentStepId: string | null;
}

function buildWorkflowIO(
  state: WorkflowState,
  index: ManifestStepIndex,
  onChange?: (id: string) => void,
): WorkflowIO {
  return {
    getCurrentStepId: () => state.currentStepId,
    setCurrentStepId: (id: string) => {
      state.currentStepId = id;
      onChange?.(id);
    },
    isAdjacentTransition: (fromStepId, toStepId) => {
      const from = index.byId.get(fromStepId);
      const to = index.byId.get(toStepId);
      if (!from || !to) return false;
      // Same stage: index must increase by exactly 1 (forward-only).
      if (from.stageId === to.stageId) {
        return to.step.index === from.step.index + 1;
      }
      // Cross-stage: must be the FIRST step of a stage immediately after
      // the LAST step of from.stage in manifest order.
      // Heuristic: any first step of a different stage is allowed if the
      // last step of `from.stageId` is `from.stepId`. Stage ordering is the
      // manifest order.
      const stagesOrder: StageId[] = [];
      const stageLastIndex = new Map<StageId, number>();
      for (const sid of index.byId.values()) {
        if (!stagesOrder.includes(sid.stageId)) stagesOrder.push(sid.stageId);
        const cur = stageLastIndex.get(sid.stageId) ?? -1;
        if (sid.step.index > cur) stageLastIndex.set(sid.stageId, sid.step.index);
      }
      const fromIsLast = stageLastIndex.get(from.stageId) === from.step.index;
      const toIsFirst = to.step.index === 0;
      const fromOrd = stagesOrder.indexOf(from.stageId);
      const toOrd = stagesOrder.indexOf(to.stageId);
      return fromIsLast && toIsFirst && toOrd === fromOrd + 1;
    },
  };
}

// ─── CheckpointIO (in-process queue · PR-G stub) ────────────────────────────

const _checkpointQueue: CheckpointRecord[] = [];
let _cpCounter = 0;

function buildCheckpointIO(): CheckpointIO {
  return {
    saveCheckpoint: (cp) => {
      const id = `cp_${++_cpCounter}_${Date.now()}`;
      _checkpointQueue.push({ id, ts: Date.now(), ...cp });
      return id;
    },
  };
}

/** Test / inspector helper. Returns a snapshot copy. */
export function readCheckpointQueue(): CheckpointRecord[] {
  return _checkpointQueue.slice();
}
export function clearCheckpointQueue(): void {
  _checkpointQueue.length = 0;
  _cpCounter = 0;
}

// ─── SelfcheckIO (in-process queue · PR-G stub) ─────────────────────────────

const _selfcheckQueue: SelfcheckRequest[] = [];
let _scCounter = 0;

function buildSelfcheckIO(): SelfcheckIO {
  return {
    enqueueSelfcheck: (req) => {
      const id = `sc_${++_scCounter}_${Date.now()}`;
      _selfcheckQueue.push({ id, ts: Date.now(), ...req });
      return id;
    },
  };
}

export function readSelfcheckQueue(): SelfcheckRequest[] {
  return _selfcheckQueue.slice();
}
export function clearSelfcheckQueue(): void {
  _selfcheckQueue.length = 0;
  _scCounter = 0;
}

// ─── ContinuityIO bindings (dexie) ──────────────────────────────────────────

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function requireField(name: string, v: unknown): asserts v is NonNullable<typeof v> {
  if (v === null || v === undefined) {
    throw new Error(`continuity row missing required field: ${name}`);
  }
}

function buildForeshadowIO(): ContinuityTableIO<ForeshadowRow> {
  return {
    upsert: async (data, projectId, rowId) => {
      if (rowId !== undefined) {
        // Update path — patch a subset.
        const patch: Partial<ForeshadowRow> = {};
        if (typeof data.title === 'string') patch.title = data.title;
        if (typeof data.content === 'string') patch.content = data.content;
        if (typeof data.status === 'string') patch.status = data.status as ForeshadowStatus;
        if (typeof data.weight === 'string') patch.weight = data.weight as ForeshadowWeight;
        const setupChapter = asNumber(data.setupChapter);
        if (setupChapter !== null) patch.setupChapter = setupChapter;
        const payoffChapter = asNumber(data.payoffChapter);
        if (payoffChapter !== null) patch.payoffChapter = payoffChapter;
        if (typeof data.payoffNote === 'string') patch.payoffNote = data.payoffNote;
        if (typeof data.notes === 'string') patch.notes = data.notes;
        await updateForeshadow(rowId, patch);
        return { id: rowId };
      }
      const title = asString(data.title);
      const content = asString(data.content);
      const status = asString(data.status) as ForeshadowStatus | null;
      const weight = asString(data.weight) as ForeshadowWeight | null;
      const setupChapter = asNumber(data.setupChapter);
      requireField('title', title);
      requireField('content', content);
      requireField('status', status);
      requireField('weight', weight);
      requireField('setupChapter', setupChapter);
      const id = await addForeshadow({
        projectId,
        title: title!,
        content: content!,
        status: status!,
        weight: weight!,
        setupChapter: setupChapter!,
        payoffChapter: asNumber(data.payoffChapter) ?? undefined,
        payoffNote: typeof data.payoffNote === 'string' ? data.payoffNote : undefined,
        notes: typeof data.notes === 'string' ? data.notes : undefined,
      });
      return { id };
    },
    remove: async (id) => {
      await db.foreshadowTable.delete(id);
    },
  };
}

function buildCharacterArcIO(): ContinuityTableIO<CharacterArcRow> {
  return {
    upsert: async (data, projectId, rowId) => {
      if (rowId !== undefined) {
        const patch: Partial<CharacterArcRow> = {};
        const chapter = asNumber(data.chapter);
        if (chapter !== null) patch.chapter = chapter;
        if (typeof data.state === 'string') patch.state = data.state;
        if (typeof data.driver === 'string') patch.driver = data.driver;
        if (typeof data.evidence === 'string') patch.evidence = data.evidence;
        await updateCharacterArc(rowId, patch);
        return { id: rowId };
      }
      const characterName = asString(data.characterName);
      const epoch = asString(data.epoch);
      const chapter = asNumber(data.chapter);
      const state = asString(data.state);
      requireField('characterName', characterName);
      requireField('epoch', epoch);
      requireField('chapter', chapter);
      requireField('state', state);
      const id = await addCharacterArc({
        projectId,
        characterName: characterName!,
        epoch: epoch!,
        chapter: chapter!,
        state: state!,
        driver: typeof data.driver === 'string' ? data.driver : undefined,
        evidence: typeof data.evidence === 'string' ? data.evidence : undefined,
      });
      return { id };
    },
    remove: async (id) => {
      await db.characterArcTable.delete(id);
    },
  };
}

function buildWorldRuleIO(): ContinuityTableIO<WorldRuleRow> {
  return {
    upsert: async (data, projectId, rowId) => {
      if (rowId !== undefined) {
        const patch: Partial<WorldRuleRow> = {};
        if (typeof data.rule === 'string') patch.rule = data.rule;
        if (typeof data.severity === 'string') patch.severity = data.severity as WorldRuleSeverity;
        const chapter = asNumber(data.chapter);
        if (chapter !== null) patch.chapter = chapter;
        if (Array.isArray(data.violations)) {
          patch.violations = data.violations.filter((v): v is string => typeof v === 'string');
        }
        if (typeof data.notes === 'string') patch.notes = data.notes;
        await updateWorldRule(rowId, patch);
        return { id: rowId };
      }
      const domain = asString(data.domain);
      const rule = asString(data.rule);
      const severity = asString(data.severity) as WorldRuleSeverity | null;
      const chapter = asNumber(data.chapter);
      requireField('domain', domain);
      requireField('rule', rule);
      requireField('severity', severity);
      requireField('chapter', chapter);
      const id = await addWorldRule({
        projectId,
        domain: domain!,
        rule: rule!,
        severity: severity!,
        chapter: chapter!,
        violations: Array.isArray(data.violations)
          ? data.violations.filter((v): v is string => typeof v === 'string')
          : undefined,
        notes: typeof data.notes === 'string' ? data.notes : undefined,
      });
      return { id };
    },
    remove: async (id) => {
      await db.worldContinuityTable.delete(id);
    },
  };
}

function buildRhythmDiagnosticIO(): ContinuityTableIO<RhythmDiagnosticRow> {
  return {
    upsert: async (data, projectId, _rowId) => {
      // upsertRhythmDiagnostic uses (projectId, chapter, sceneIdx) as the
      // composite key; rowId is ignored.
      const chapter = asNumber(data.chapter);
      const sceneIdx = asNumber(data.sceneIdx);
      const tension = asNumber(data.tension);
      const emotion = asNumber(data.emotion);
      requireField('chapter', chapter);
      requireField('sceneIdx', sceneIdx);
      requireField('tension', tension);
      requireField('emotion', emotion);
      const id = await upsertRhythmDiagnostic({
        projectId,
        chapter: chapter!,
        sceneIdx: sceneIdx!,
        tension: tension!,
        emotion: emotion!,
        warnings: Array.isArray(data.warnings)
          ? data.warnings.filter((v): v is string => typeof v === 'string')
          : undefined,
        sceneLabel: typeof data.sceneLabel === 'string' ? data.sceneLabel : undefined,
      });
      return { id };
    },
    remove: async (id) => {
      await db.rhythmDiagnosticTable.delete(id);
    },
  };
}

function buildContinuityIO(): ContinuityIO {
  return {
    foreshadow: buildForeshadowIO(),
    character_arc: buildCharacterArcIO(),
    world_rule: buildWorldRuleIO(),
    rhythm_diagnostic: buildRhythmDiagnosticIO(),
  };
}

// ─── factory entry ──────────────────────────────────────────────────────────

export interface BuildToolContextOptions {
  /** Active dexie project id; passed verbatim to ContinuityIO upserts. */
  projectId: number;
  /** Pre-loaded manifest. If omitted, the factory will load it. */
  manifest?: Manifest;
  /** Initial currentStepId (PR-F runner usually injects the current step). */
  currentStepId?: string | null;
  /** Test overrides — mostly for unit tests of buildToolContext itself. */
  overrides?: Partial<{
    artifact: ArtifactIO;
    workflow: WorkflowIO;
    checkpoint: CheckpointIO;
    selfcheck: SelfcheckIO;
    continuity: ContinuityIO;
    recordToolCall: ToolContext['recordToolCall'];
  }>;
}

function defaultRecordToolCall(): NonNullable<ToolContext['recordToolCall']> {
  return (info) => {
    try {
      const argsPreview = (() => {
        try {
          const s = typeof info.args === 'string' ? info.args : JSON.stringify(info.args);
          return s.length > 512 ? s.slice(0, 509) + '...' : s;
        } catch {
          return undefined;
        }
      })();
      useToolCallLog.getState().recordEntry({
        round: useToolCallLog.getState().currentRound || 1,
        name: info.name,
        ok: info.ok,
        message: info.message,
        durationMs: info.durationMs,
        argsPreview,
      });
    } catch {
      // observability must never break the loop
    }
  };
}

function assemble(
  manifest: Manifest,
  opts: Omit<BuildToolContextOptions, 'manifest'>,
): ToolContext {
  const index = indexManifest(manifest);
  const workflowState: WorkflowState = { currentStepId: opts.currentStepId ?? null };
  const artifact = opts.overrides?.artifact ?? buildArtifactIO(index);
  const workflow = opts.overrides?.workflow ?? buildWorkflowIO(workflowState, index);
  const checkpoint = opts.overrides?.checkpoint ?? buildCheckpointIO();
  const selfcheck = opts.overrides?.selfcheck ?? buildSelfcheckIO();
  const continuity = opts.overrides?.continuity ?? buildContinuityIO();
  const recordToolCall = opts.overrides?.recordToolCall ?? defaultRecordToolCall();
  return {
    projectId: opts.projectId,
    ...artifact,
    ...workflow,
    ...checkpoint,
    ...selfcheck,
    continuity,
    recordToolCall,
  };
}

export async function buildToolContext(opts: BuildToolContextOptions): Promise<ToolContext> {
  const manifest = opts.manifest ?? (await loadManifest());
  return assemble(manifest, opts);
}

/** Helper for synchronous tests that supply a manifest directly. */
export function buildToolContextSync(
  manifest: Manifest,
  opts: Omit<BuildToolContextOptions, 'manifest'>,
): ToolContext {
  return assemble(manifest, opts);
}

// ─── module-level cleanup (test isolation) ──────────────────────────────────

/** Test helper: clear all in-memory queues + tool call log. */
export function _resetToolContextStubs(): void {
  clearCheckpointQueue();
  clearSelfcheckQueue();
  useToolCallLog.getState().reset();
}
