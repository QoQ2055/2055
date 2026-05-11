// PR-E · handler: transition_to_step
//
// Advances the workflow if and only if (1) `args.fromStepId` matches the
// current runner step and (2) the transition is legal per the manifest.
// Both checks return ok=false (NOT throw) so the model can self-correct.

import type { ToolContext } from '../context';
import type { ToolResult, TransitionToStepArgs } from '../types';

export interface TransitionToStepResult {
  from: string;
  to: string;
  reason?: string;
}

export async function handleTransitionToStep(
  args: TransitionToStepArgs,
  ctx: ToolContext,
): Promise<ToolResult<TransitionToStepResult>> {
  const current = ctx.getCurrentStepId();
  if (current !== null && current !== args.fromStepId) {
    return {
      ok: false,
      message: `runner is on step "${current}", not "${args.fromStepId}"; refusing transition`,
    };
  }

  if (!ctx.isAdjacentTransition(args.fromStepId, args.toStepId)) {
    return {
      ok: false,
      message: `transition from "${args.fromStepId}" to "${args.toStepId}" is not adjacent in the manifest`,
    };
  }

  if (args.fromStepId === args.toStepId) {
    // Defensive: schema does not forbid it, but it would be a no-op + confuse
    // RunHistory. Reject loudly so the model picks a real next step.
    return {
      ok: false,
      message: 'fromStepId and toStepId are identical; no-op transition refused',
    };
  }

  try {
    ctx.setCurrentStepId(args.toStepId);
  } catch (e) {
    return {
      ok: false,
      message: `setCurrentStepId threw: ${(e as Error).message}`,
    };
  }

  return {
    ok: true,
    data: { from: args.fromStepId, to: args.toStepId, reason: args.reason },
    message: `transitioned ${args.fromStepId} → ${args.toStepId}`,
  };
}
