// PR-E · handler: save_step_output
//
// Persists a step's output as a NodeArtifact via ctx.upsertArtifact.
//
// Behaviour contract:
//   - Looks up step metadata (stageId / index / title / default format) via
//     ctx.getStepMeta(stepId). Returns ok=false with a clear message if the
//     stepId is not in the manifest (lets the model self-correct).
//   - `args.format` overrides the manifest default when provided.
//   - `args.meta` is merged into the NodeArtifact.meta as-is.
//   - durationMs is set to 0 (the LLM call's wall time is owned by runner.ts;
//     this tool only records "model emitted output for step X").

import type { NodeArtifact } from '../../types';
import type { ToolContext } from '../context';
import type { SaveStepOutputArgs, ToolResult } from '../types';

export interface SaveStepOutputResult {
  nodeId: string;
  stageId: string;
  index: number;
  bytes: number;
}

export async function handleSaveStepOutput(
  args: SaveStepOutputArgs,
  ctx: ToolContext,
): Promise<ToolResult<SaveStepOutputResult>> {
  const meta = ctx.getStepMeta(args.stepId);
  if (!meta) {
    return {
      ok: false,
      message: `step "${args.stepId}" not found in active manifest`,
    };
  }

  const format = args.format ?? meta.format;

  const artifact: NodeArtifact = {
    nodeId: args.stepId,
    stageId: meta.stageId,
    index: meta.index,
    title: meta.title,
    format,
    content: args.content,
    durationMs: 0,
    ts: Date.now(),
    ...(args.meta ? { meta: args.meta } : {}),
  };

  try {
    await ctx.upsertArtifact(artifact);
  } catch (e) {
    return {
      ok: false,
      message: `upsertArtifact threw: ${(e as Error).message}`,
    };
  }

  return {
    ok: true,
    data: {
      nodeId: artifact.nodeId,
      stageId: artifact.stageId,
      index: artifact.index,
      bytes: args.content.length,
    },
    message: `saved ${args.content.length} chars to ${args.stepId}`,
  };
}
