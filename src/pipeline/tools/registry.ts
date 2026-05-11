// PR-D · Phase 1 step 2/5 · tool registry (hand-written JSON Schemas).
//
// Rationale for hand-written schemas (vs zod/json-schema):
//   - Project policy: deepseek.ts comments "Zero extra deps". Adding zod
//     (~12 KB gzipped) for 5 tools is over-engineering at this stage.
//   - Schemas are simple (flat objects with primitive properties).
//   - registry.test.ts keeps the TS interfaces in `types.ts` and the JSON
//     Schemas here in lock-step via structural assertions.
//
// When to revisit:
//   - When tool count > 15, or when schemas grow nested unions, refactor to
//     zod-first with a `toJsonSchema()` adapter. Tracked: long-horizon ledger.

import type { ToolDefinition } from '../../llm/deepseek';
import {
  CONTINUITY_TABLES,
  SELFCHECK_DIMENSIONS,
  TOOL_NAMES,
  type ToolName,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (JSON Schema draft-07 subset that DeepSeek + OpenAI both accept).
// Kept inline near the ToolDefinitions for readability — registry surface is
// a single barrel file.
// ─────────────────────────────────────────────────────────────────────────────

const SAVE_STEP_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    stepId: {
      type: 'string',
      description: 'Step id matching the manifest, e.g. "screenplay.1".',
    },
    content: {
      type: 'string',
      description: 'Raw output content (markdown / JSON-string / plain text).',
    },
    format: {
      type: 'string',
      enum: ['markdown', 'json', 'text'],
      description: 'Output format hint. Defaults to the step manifest value.',
    },
    meta: {
      type: 'object',
      description:
        'Optional metadata, forwarded into NodeArtifact.meta verbatim.',
      additionalProperties: true,
    },
  },
  required: ['stepId', 'content'],
} as const;

const TRANSITION_TO_STEP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fromStepId: {
      type: 'string',
      description: 'Step that just finished. Must match the current runner step.',
    },
    toStepId: {
      type: 'string',
      description: 'Next step to enter. Runner validates manifest adjacency.',
    },
    reason: {
      type: 'string',
      description: 'Why this transition is happening (logged to RunHistory).',
    },
  },
  required: ['fromStepId', 'toStepId'],
} as const;

const SAVE_CHECKPOINT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      description: 'User-visible checkpoint name. Unique within a project.',
    },
    description: { type: 'string' },
    scope: {
      type: 'string',
      enum: ['project', 'step'],
      description: 'project = freeze all artifacts; step = freeze one step only.',
    },
    stepId: {
      type: 'string',
      description: 'Required when scope=step. Ignored otherwise.',
    },
  },
  required: ['name', 'scope'],
} as const;

const RUN_SELFCHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    artifactId: {
      type: 'string',
      description: 'Target artifact id (NodeArtifact.nodeId).',
    },
    checks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'string',
        enum: [...SELFCHECK_DIMENSIONS],
      },
      description: 'Dimensions to self-check. At least one required.',
    },
  },
  required: ['artifactId', 'checks'],
} as const;

const UPDATE_CONTINUITY_TABLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    table: {
      type: 'string',
      enum: [...CONTINUITY_TABLES],
      description: 'One of the 4 MM5 continuity tables.',
    },
    op: {
      type: 'string',
      enum: ['upsert', 'delete'],
    },
    rowId: {
      type: 'string',
      description:
        'Required for delete. Optional for upsert (handler generates id when absent).',
    },
    data: {
      type: 'object',
      description:
        'Row payload. Required for upsert; ignored for delete. Handler validates against the table-specific row schema.',
      additionalProperties: true,
    },
  },
  required: ['table', 'op'],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ToolDefinition constants. The string `description` is exposed verbatim to
// the model — keep them short, declarative, and grounded in the codebase
// (do NOT promise behaviour the handler does not implement in PR-E).
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_SAVE_STEP_OUTPUT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'save_step_output',
    description:
      'Persist the current step\'s output to the project store as a NodeArtifact. Call when the step has produced its final content and you are ready to hand off to the next step.',
    parameters: SAVE_STEP_OUTPUT_SCHEMA as unknown as Record<string, unknown>,
  },
};

export const TOOL_TRANSITION_TO_STEP: ToolDefinition = {
  type: 'function',
  function: {
    name: 'transition_to_step',
    description:
      'Signal that the current step is complete and the workflow should advance to the next step. The runner will validate the transition against the manifest before honoring it.',
    parameters: TRANSITION_TO_STEP_SCHEMA as unknown as Record<string, unknown>,
  },
};

export const TOOL_SAVE_CHECKPOINT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'save_checkpoint',
    description:
      'Create a named checkpoint snapshot. Use after a high-effort step (e.g. screenplay 8-pass beats, storyboard plan) so the user can resume or branch later.',
    parameters: SAVE_CHECKPOINT_SCHEMA as unknown as Record<string, unknown>,
  },
};

export const TOOL_RUN_SELFCHECK: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_selfcheck',
    description:
      'Enqueue a self-check pass over an existing artifact across one or more dimensions (grounding / continuity / pacing / cliche). The runner returns immediately with a request id; results are surfaced asynchronously.',
    parameters: RUN_SELFCHECK_SCHEMA as unknown as Record<string, unknown>,
  },
};

export const TOOL_UPDATE_CONTINUITY_TABLE: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_continuity_table',
    description:
      'Upsert or delete a row in one of the 4 MM5 continuity tables (foreshadow / character_arc / world_rule / rhythm_diagnostic). Use to record durable side-information that downstream steps will read.',
    parameters: UPDATE_CONTINUITY_TABLE_SCHEMA as unknown as Record<string, unknown>,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate. Index by ToolName for typed dispatch (PR-E/PR-F).
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Readonly<Record<ToolName, ToolDefinition>> = {
  save_step_output: TOOL_SAVE_STEP_OUTPUT,
  transition_to_step: TOOL_TRANSITION_TO_STEP,
  save_checkpoint: TOOL_SAVE_CHECKPOINT,
  run_selfcheck: TOOL_RUN_SELFCHECK,
  update_continuity_table: TOOL_UPDATE_CONTINUITY_TABLE,
} as const;

/**
 * Convenience: all 5 tools as an array, in canonical order (matches TOOL_NAMES).
 * Pass to `chatStream({ tools: ALL_TOOLS, tool_choice: 'auto' })` to expose
 * every Phase-1 tool to the model.
 */
export const ALL_TOOLS: ToolDefinition[] = TOOL_NAMES.map((n) => TOOL_REGISTRY[n]);

/**
 * Look up a single tool by name. Throws on unknown name (caller should have
 * narrowed via ToolName already).
 */
export function getTool(name: ToolName): ToolDefinition {
  const tool = TOOL_REGISTRY[name];
  if (!tool) throw new Error(`Unknown tool: ${name as string}`);
  return tool;
}

/**
 * Type guard. Useful when validating an LLM-emitted tool_call.name before
 * dispatching to a handler.
 */
export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}
