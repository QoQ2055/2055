// PR-E · handler: run_selfcheck
//
// Pure enqueue. Does NOT block on the self-check pass — that runs
// asynchronously and surfaces via UI in PR-G. Deduplicates the `checks`
// array (model may emit duplicates) before forwarding.

import type { ToolContext } from '../context';
import type { RunSelfcheckArgs, SelfcheckDimension, ToolResult } from '../types';
import { SELFCHECK_DIMENSIONS } from '../types';

export interface RunSelfcheckResult {
  requestId: string;
  artifactId: string;
  checks: SelfcheckDimension[];
}

export async function handleRunSelfcheck(
  args: RunSelfcheckArgs,
  ctx: ToolContext,
): Promise<ToolResult<RunSelfcheckResult>> {
  // Deduplicate while preserving canonical order.
  const set = new Set(args.checks);
  const checks = SELFCHECK_DIMENSIONS.filter((d) => set.has(d));
  if (checks.length === 0) {
    // schema enforces minItems=1 + enum, but be defensive: a tampered
    // arg list could slip a non-canonical value past schema in theory.
    return {
      ok: false,
      message: 'no recognized self-check dimensions after dedup',
    };
  }

  try {
    const requestId = await Promise.resolve(
      ctx.enqueueSelfcheck({ artifactId: args.artifactId, checks }),
    );
    return {
      ok: true,
      data: { requestId, artifactId: args.artifactId, checks },
      message: `enqueued ${checks.length} self-check dim(s) for ${args.artifactId}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `enqueueSelfcheck threw: ${(e as Error).message}`,
    };
  }
}
