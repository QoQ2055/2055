// PR-E · validator tests.
//
// Covers the narrow JSON Schema subset implemented in validate.ts:
//   type / required / properties / additionalProperties / enum / items /
//   minItems / minLength.
//
// Each Phase-1 tool gets at least one "shape ok" + one targeted negative case
// to catch regressions if the schemas drift.

import { describe, it, expect } from 'vitest';
import {
  formatIssues,
  parseAndValidateToolArgs,
  validateAgainstSchema,
} from '../validate';

describe('parseAndValidateToolArgs · happy paths (PR-E)', () => {
  it('save_step_output: minimal valid args', () => {
    const r = parseAndValidateToolArgs(
      'save_step_output',
      JSON.stringify({ stepId: 'screenplay.1', content: 'hello' }),
    );
    expect(r.ok).toBe(true);
  });

  it('save_step_output: with optional format + meta', () => {
    const r = parseAndValidateToolArgs(
      'save_step_output',
      JSON.stringify({
        stepId: 'storyboard.2.unit_3',
        content: '...',
        format: 'json',
        meta: { manual: true },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('transition_to_step: valid', () => {
    const r = parseAndValidateToolArgs(
      'transition_to_step',
      JSON.stringify({
        fromStepId: 'screenplay.1',
        toStepId: 'screenplay.2',
        reason: 'completed',
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('save_checkpoint: valid project-scope', () => {
    const r = parseAndValidateToolArgs(
      'save_checkpoint',
      JSON.stringify({ name: 'after-8-pass', scope: 'project' }),
    );
    expect(r.ok).toBe(true);
  });

  it('run_selfcheck: valid with 2 checks', () => {
    const r = parseAndValidateToolArgs(
      'run_selfcheck',
      JSON.stringify({
        artifactId: 'screenplay.1',
        checks: ['grounding', 'continuity'],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('update_continuity_table: valid upsert foreshadow', () => {
    const r = parseAndValidateToolArgs(
      'update_continuity_table',
      JSON.stringify({
        table: 'foreshadow',
        op: 'upsert',
        data: { title: 'red string', setupChapter: 3, status: 'planted', weight: 'major' },
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('update_continuity_table: valid delete', () => {
    const r = parseAndValidateToolArgs(
      'update_continuity_table',
      JSON.stringify({ table: 'world_rule', op: 'delete', rowId: '42' }),
    );
    expect(r.ok).toBe(true);
  });
});

describe('parseAndValidateToolArgs · error paths (PR-E)', () => {
  it('unknown tool name', () => {
    const r = parseAndValidateToolArgs('not_a_tool', '{}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toMatch(/unknown tool/);
  });

  it('malformed JSON', () => {
    const r = parseAndValidateToolArgs('save_step_output', '{ bad json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toMatch(/not valid JSON/);
  });

  it('missing required field', () => {
    const r = parseAndValidateToolArgs(
      'save_step_output',
      JSON.stringify({ stepId: 'x' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(formatIssues(r.issues)).toMatch(/content/);
      expect(formatIssues(r.issues)).toMatch(/missing required/);
    }
  });

  it('wrong type for required field', () => {
    const r = parseAndValidateToolArgs(
      'save_step_output',
      JSON.stringify({ stepId: 123, content: 'ok' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/stepId.*expected type string/);
  });

  it('enum violation (save_step_output.format)', () => {
    const r = parseAndValidateToolArgs(
      'save_step_output',
      JSON.stringify({ stepId: 'a.1', content: 'x', format: 'csv' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/format.*not in enum/);
  });

  it('additionalProperties=false rejects extra keys', () => {
    const r = parseAndValidateToolArgs(
      'transition_to_step',
      JSON.stringify({
        fromStepId: 'a',
        toStepId: 'b',
        bogus: true,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/additional property "bogus"/);
  });

  it('run_selfcheck: empty checks array fails minItems', () => {
    const r = parseAndValidateToolArgs(
      'run_selfcheck',
      JSON.stringify({ artifactId: 'a', checks: [] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/at least 1 item/);
  });

  it('run_selfcheck: bad dimension rejected', () => {
    const r = parseAndValidateToolArgs(
      'run_selfcheck',
      JSON.stringify({ artifactId: 'a', checks: ['grounding', 'syntax'] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/checks\/1.*not in enum/);
  });

  it('update_continuity_table: bad table enum rejected', () => {
    const r = parseAndValidateToolArgs(
      'update_continuity_table',
      JSON.stringify({ table: 'plot', op: 'upsert', data: {} }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/table.*not in enum/);
  });

  it('update_continuity_table: bad op enum rejected', () => {
    const r = parseAndValidateToolArgs(
      'update_continuity_table',
      JSON.stringify({ table: 'foreshadow', op: 'patch' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(formatIssues(r.issues)).toMatch(/op.*not in enum/);
  });
});

describe('validateAgainstSchema · direct (pre-parsed value)', () => {
  it('accepts pre-parsed valid value', () => {
    const r = validateAgainstSchema('save_checkpoint', {
      name: 'cp1',
      scope: 'step',
      stepId: 'screenplay.3',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects null where object expected', () => {
    const r = validateAgainstSchema('save_checkpoint', null);
    expect(r.ok).toBe(false);
  });

  it('rejects array where object expected', () => {
    const r = validateAgainstSchema('save_step_output', ['stepId', 'content']);
    expect(r.ok).toBe(false);
  });

  it('formatIssues joins issues with semicolons', () => {
    const r = validateAgainstSchema('save_step_output', {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const formatted = formatIssues(r.issues);
      expect(formatted).toMatch(/missing required property "stepId"/);
      expect(formatted).toMatch(/missing required property "content"/);
      expect(formatted.split(';')).toHaveLength(2);
    }
  });
});
