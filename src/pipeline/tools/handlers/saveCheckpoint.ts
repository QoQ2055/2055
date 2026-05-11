// PR-E · handler: save_checkpoint
//
// Defers persistence to ctx.saveCheckpoint. This handler only enforces the
// conditional-required rule the JSON Schema cannot express on its own:
//   scope === 'step' ⇒ stepId is required.

import type { ToolContext } from '../context';
import type { SaveCheckpointArgs, ToolResult } from '../types';

export interface SaveCheckpointResult {
  id: string;
  name: string;
  scope: SaveCheckpointArgs['scope'];
  stepId?: string;
}

export async function handleSaveCheckpoint(
  args: SaveCheckpointArgs,
  ctx: ToolContext,
): Promise<ToolResult<SaveCheckpointResult>> {
  if (args.scope === 'step' && !args.stepId) {
    return {
      ok: false,
      message: 'scope="step" requires stepId',
    };
  }

  try {
    const id = await Promise.resolve(
      ctx.saveCheckpoint({
        name: args.name,
        description: args.description,
        scope: args.scope,
        stepId: args.scope === 'step' ? args.stepId : undefined,
      }),
    );
    return {
      ok: true,
      data: {
        id,
        name: args.name,
        scope: args.scope,
        stepId: args.scope === 'step' ? args.stepId : undefined,
      },
      message: `checkpoint "${args.name}" saved as ${id}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `saveCheckpoint threw: ${(e as Error).message}`,
    };
  }
}
