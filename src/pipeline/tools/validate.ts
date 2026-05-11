// PR-E · Phase 1 step 3/5 · runtime JSON Schema validator (narrow subset).
//
// Why hand-written:
//   - deepseek.ts comments: "Zero extra deps". ajv (~120 KB) is overkill for
//     5 flat schemas whose keyword footprint is < 10 distinct keywords.
//   - The covered subset is exactly what registry.ts uses:
//        type ∈ {object, string, number, integer, boolean, array}
//        properties / required / additionalProperties (for object)
//        enum / items / minItems / minLength (for array/string)
//
// Out of scope (we intentionally do NOT implement):
//   - $ref, allOf/anyOf/oneOf, conditional schemas, format keyword,
//     pattern, multipleOf, deep generic recursion guards.
//   If a future tool needs these, swap in ajv (PR follow-up).
//
// Error reporting:
//   Returns a flat list of human-readable issues. The dispatcher serializes
//   them into the tool result's `message` so the model can self-correct.

import type { ToolName } from './types';
import { isToolName, TOOL_REGISTRY } from './registry';

export interface ValidationIssue {
  /** JSON pointer-ish path, e.g. "/checks/0" or "/" for the root. */
  path: string;
  message: string;
}

export type ValidateResult<T> =
  | { ok: true; data: T; issues?: never }
  | { ok: false; issues: ValidationIssue[]; data?: never };

// ─── primitives ─────────────────────────────────────────────────────────────

function typeOfJsonValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function pushIssue(out: ValidationIssue[], path: string, message: string): void {
  out.push({ path: path || '/', message });
}

// ─── schema-driven validation ────────────────────────────────────────────────

interface SchemaNode {
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  items?: SchemaNode;
  minItems?: number;
  minLength?: number;
  // (anything else is silently ignored — see "Out of scope" above)
}

function validateValue(value: unknown, schema: SchemaNode, path: string, out: ValidationIssue[]): void {
  // 1. type check (with light coercion-free semantics — integer must be int)
  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOfJsonValue(value);
    const ok = expected.some((t) => {
      if (t === 'integer') return actual === 'number' && Number.isInteger(value);
      if (t === 'number') return actual === 'number';
      return t === actual;
    });
    if (!ok) {
      pushIssue(out, path, `expected type ${expected.join('|')}, got ${actual}`);
      return; // structural mismatch → stop drilling
    }
  }

  // 2. enum
  if (schema.enum) {
    const inSet = schema.enum.some((e) => deepEqual(e, value));
    if (!inSet) {
      const pretty = schema.enum.map((e) => JSON.stringify(e)).join(', ');
      pushIssue(out, path, `value ${JSON.stringify(value)} not in enum [${pretty}]`);
    }
  }

  // 3. object recursion
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const knownKeys = Object.keys(schema.properties ?? {});

    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in obj)) {
          pushIssue(out, `${path}/${req}`, `missing required property "${req}"`);
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const k of Object.keys(obj)) {
        if (!knownKeys.includes(k)) {
          pushIssue(out, `${path}/${k}`, `additional property "${k}" not allowed`);
        }
      }
    }

    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in obj) {
          validateValue(obj[k], sub, `${path}/${k}`, out);
        }
      }
    }
  }

  // 4. array recursion
  if (schema.type === 'array' && Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      pushIssue(out, path, `expected at least ${schema.minItems} item(s), got ${value.length}`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        validateValue(value[i], schema.items, `${path}/${i}`, out);
      }
    }
  }

  // 5. string minLength (used by a future tool; harmless when absent)
  if (schema.type === 'string' && typeof value === 'string' && typeof schema.minLength === 'number') {
    if (value.length < schema.minLength) {
      pushIssue(out, path, `string shorter than minLength ${schema.minLength}`);
    }
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      const arrA = a as unknown[];
      const arrB = b as unknown[];
      if (arrA.length !== arrB.length) return false;
      return arrA.every((v, i) => deepEqual(v, arrB[i]));
    }
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Parse a model-emitted tool_call.arguments JSON string and validate it
 * against the registered schema for `name`. Returns a typed envelope.
 *
 * Note: the `data` field is typed `unknown` here — call sites should narrow
 * via `ToolArgsMap[name]` after `ok === true`. Dispatcher does this.
 */
export function parseAndValidateToolArgs(
  name: string,
  rawArgsJson: string,
): ValidateResult<unknown> {
  if (!isToolName(name)) {
    return {
      ok: false,
      issues: [{ path: '/', message: `unknown tool "${name}"` }],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgsJson || '{}');
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          path: '/',
          message: `arguments are not valid JSON: ${(e as Error).message}`,
        },
      ],
    };
  }

  return validateAgainstSchema(name, parsed);
}

/**
 * Lower-level entry point used by tests + non-LLM call paths. Skips
 * JSON.parse; takes a pre-parsed value.
 */
export function validateAgainstSchema(
  name: ToolName,
  value: unknown,
): ValidateResult<unknown> {
  const schema = TOOL_REGISTRY[name].function.parameters as SchemaNode;
  const issues: ValidationIssue[] = [];
  validateValue(value, schema, '', issues);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, data: value };
}

/** Pretty-print a list of issues into one human-readable string. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((i) => `${i.path}: ${i.message}`).join('; ');
}
