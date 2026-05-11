// PR-E · handler: update_continuity_table
//
// Routes upsert/delete to one of the 4 MM5 dexie helpers via
// ctx.continuity[table]. The handler enforces the conditional-required
// rules the JSON Schema cannot express:
//   - op='upsert'  ⇒ data is required (and table-specific required keys present)
//   - op='delete'  ⇒ rowId is required and numeric
//
// Row-level field validation is delegated to the IO impl (PR-F) because the
// 4 row schemas are complex (status enum / weight enum / chapter > 0 ...).
// The handler performs only the SHARED narrowing here; impl tightens per-table.

import type { ToolContext } from '../context';
import { getContinuityTableIO } from '../context';
import type { ContinuityTable, ToolResult, UpdateContinuityTableArgs } from '../types';

export interface UpdateContinuityTableResult {
  table: ContinuityTable;
  op: UpdateContinuityTableArgs['op'];
  rowId?: number;
}

function parseNumericRowId(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function handleUpdateContinuityTable(
  args: UpdateContinuityTableArgs,
  ctx: ToolContext,
): Promise<ToolResult<UpdateContinuityTableResult>> {
  const io = getContinuityTableIO(ctx, args.table);

  if (args.op === 'delete') {
    const rowId = parseNumericRowId(args.rowId);
    if (rowId === null) {
      return {
        ok: false,
        message: 'op="delete" requires a numeric rowId (string of a positive integer)',
      };
    }
    try {
      await io.remove(rowId);
    } catch (e) {
      return { ok: false, message: `${args.table}.remove threw: ${(e as Error).message}` };
    }
    return {
      ok: true,
      data: { table: args.table, op: 'delete', rowId },
      message: `deleted ${args.table}#${rowId}`,
    };
  }

  // op === 'upsert'
  if (!args.data || typeof args.data !== 'object') {
    return {
      ok: false,
      message: 'op="upsert" requires a non-empty data object',
    };
  }

  const rowId = args.rowId !== undefined ? parseNumericRowId(args.rowId) : null;
  if (args.rowId !== undefined && rowId === null) {
    return {
      ok: false,
      message: 'rowId, when provided, must be a positive integer string',
    };
  }

  try {
    const { id } = await io.upsert(args.data, ctx.projectId, rowId ?? undefined);
    return {
      ok: true,
      data: { table: args.table, op: 'upsert', rowId: id },
      message: `upserted ${args.table}#${id}`,
    };
  } catch (e) {
    return { ok: false, message: `${args.table}.upsert threw: ${(e as Error).message}` };
  }
}
