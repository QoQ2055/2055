// PR-D · structural tests for the tool registry.
//
// What this verifies (and what it intentionally does NOT verify):
//   ✓ Every ToolName in `types.ts` has a matching registry entry.
//   ✓ TOOL_REGISTRY keys exactly match TOOL_NAMES (no orphans either side).
//   ✓ Each ToolDefinition obeys the shape required by the deepseek.ts API:
//     {type:'function', function:{name, description, parameters}} where
//     `parameters` is a JSON Schema object with type:'object' + properties.
//   ✓ Each schema declares `required` and lists only declared properties.
//   ✓ Enum unions in schemas match the corresponding TS string-literal unions.
//   ✓ Tool name strings are unique (no copy-paste duplicates).
//   ✓ getTool / isToolName behave correctly.
//
//   ✗ It does NOT validate that an LLM-emitted argument JSON conforms to
//     the schema at runtime — that is PR-E's `validate.ts` job.

import { describe, it, expect } from 'vitest';
import {
  ALL_TOOLS,
  TOOL_REGISTRY,
  TOOL_SAVE_STEP_OUTPUT,
  TOOL_TRANSITION_TO_STEP,
  TOOL_SAVE_CHECKPOINT,
  TOOL_RUN_SELFCHECK,
  TOOL_UPDATE_CONTINUITY_TABLE,
  getTool,
  isToolName,
} from '../registry';
import {
  TOOL_NAMES,
  CONTINUITY_TABLES,
  SELFCHECK_DIMENSIONS,
  type ToolName,
} from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function getSchema(toolName: ToolName): Record<string, unknown> {
  return TOOL_REGISTRY[toolName].function.parameters as Record<string, unknown>;
}

function getProps(toolName: ToolName): Record<string, unknown> {
  return getSchema(toolName).properties as Record<string, unknown>;
}

function getRequired(toolName: ToolName): readonly string[] {
  return (getSchema(toolName).required ?? []) as readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
describe('tool registry · structural integrity (PR-D)', () => {
  it('TOOL_NAMES, TOOL_REGISTRY, and ALL_TOOLS agree on the 5 Phase-1 tools', () => {
    expect(TOOL_NAMES).toEqual([
      'save_step_output',
      'transition_to_step',
      'save_checkpoint',
      'run_selfcheck',
      'update_continuity_table',
    ]);
    expect(Object.keys(TOOL_REGISTRY).sort()).toEqual([...TOOL_NAMES].sort());
    expect(ALL_TOOLS).toHaveLength(TOOL_NAMES.length);
    // ALL_TOOLS preserves canonical order
    expect(ALL_TOOLS.map((t) => t.function.name)).toEqual([...TOOL_NAMES]);
  });

  it('every ToolDefinition obeys the OpenAI-compatible shape', () => {
    for (const name of TOOL_NAMES) {
      const def = TOOL_REGISTRY[name];
      expect(def.type).toBe('function');
      expect(def.function.name).toBe(name);
      expect(def.function.description.length).toBeGreaterThan(20);
      const params = def.function.parameters as Record<string, unknown>;
      expect(params.type).toBe('object');
      expect(params).toHaveProperty('properties');
      expect(params).toHaveProperty('required');
      expect(Array.isArray(params.required)).toBe(true);
    }
  });

  it('tool function.name strings are unique (no copy-paste dupes)', () => {
    const seen = new Set<string>();
    for (const def of ALL_TOOLS) {
      expect(seen.has(def.function.name)).toBe(false);
      seen.add(def.function.name);
    }
  });

  it('schema.required only references properties that exist in schema.properties', () => {
    for (const name of TOOL_NAMES) {
      const props = Object.keys(getProps(name));
      for (const req of getRequired(name)) {
        expect(props).toContain(req);
      }
    }
  });

  it('exported constants match the registry lookup', () => {
    expect(TOOL_SAVE_STEP_OUTPUT).toBe(TOOL_REGISTRY.save_step_output);
    expect(TOOL_TRANSITION_TO_STEP).toBe(TOOL_REGISTRY.transition_to_step);
    expect(TOOL_SAVE_CHECKPOINT).toBe(TOOL_REGISTRY.save_checkpoint);
    expect(TOOL_RUN_SELFCHECK).toBe(TOOL_REGISTRY.run_selfcheck);
    expect(TOOL_UPDATE_CONTINUITY_TABLE).toBe(TOOL_REGISTRY.update_continuity_table);
  });
});

describe('tool registry · per-tool required field assertions (PR-D)', () => {
  it('save_step_output requires stepId + content', () => {
    expect([...getRequired('save_step_output')].sort()).toEqual(['content', 'stepId']);
  });

  it('save_step_output.format enum matches OutFormat union', () => {
    const format = getProps('save_step_output').format as Record<string, unknown>;
    expect(format.enum).toEqual(['markdown', 'json', 'text']);
  });

  it('transition_to_step requires fromStepId + toStepId', () => {
    expect([...getRequired('transition_to_step')].sort()).toEqual(['fromStepId', 'toStepId']);
  });

  it('save_checkpoint requires name + scope', () => {
    expect([...getRequired('save_checkpoint')].sort()).toEqual(['name', 'scope']);
  });

  it('save_checkpoint.scope enum is [project, step]', () => {
    const scope = getProps('save_checkpoint').scope as Record<string, unknown>;
    expect(scope.enum).toEqual(['project', 'step']);
  });

  it('run_selfcheck requires artifactId + checks (min 1 item)', () => {
    expect([...getRequired('run_selfcheck')].sort()).toEqual(['artifactId', 'checks']);
    const checks = getProps('run_selfcheck').checks as Record<string, unknown>;
    expect(checks.type).toBe('array');
    expect(checks.minItems).toBe(1);
    const items = checks.items as Record<string, unknown>;
    expect(items.enum).toEqual([...SELFCHECK_DIMENSIONS]);
  });

  it('update_continuity_table requires table + op', () => {
    expect([...getRequired('update_continuity_table')].sort()).toEqual(['op', 'table']);
  });

  it('update_continuity_table.table enum matches CONTINUITY_TABLES (4 MM5 tables)', () => {
    const table = getProps('update_continuity_table').table as Record<string, unknown>;
    expect(table.enum).toEqual([...CONTINUITY_TABLES]);
  });

  it('update_continuity_table.op enum is [upsert, delete]', () => {
    const op = getProps('update_continuity_table').op as Record<string, unknown>;
    expect(op.enum).toEqual(['upsert', 'delete']);
  });
});

describe('tool registry · helpers (PR-D)', () => {
  it('getTool returns the matching definition', () => {
    expect(getTool('save_step_output').function.name).toBe('save_step_output');
    expect(getTool('update_continuity_table').function.name).toBe('update_continuity_table');
  });

  it('getTool throws on an unknown name (defensive cast escape hatch)', () => {
    expect(() => getTool('definitely_not_a_tool' as ToolName)).toThrow(/Unknown tool/);
  });

  it('isToolName accepts all 5 canonical names and rejects others', () => {
    for (const name of TOOL_NAMES) {
      expect(isToolName(name)).toBe(true);
    }
    expect(isToolName('save_step_output_v2')).toBe(false);
    expect(isToolName('')).toBe(false);
    expect(isToolName('SaveStepOutput')).toBe(false); // case sensitive
  });
});
