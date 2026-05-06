// Single-step runner: load payload → compose messages → call DeepSeek (streaming)
// → validate → return NodeArtifact.

import { chatStream } from '../llm/deepseek';
import { estimateCost } from '../llm/cost';
import type { SettingsState } from '../store/settings';
import { loadPayload } from './manifest';
import { composeMessages } from './compose';
import { recordRun } from '../store/db';
// composeMessages / loadPayload 在 phase2 loop 调试日志中复用
import type {
  ArtifactMap,
  ManifestStep,
  NodeArtifact,
  ProjectContext,
  StageId,
} from './types';
import {
  parseStoryboardPlan,
  type ParsedPlan,
  type PlannedUnit,
} from './storyboardPlan';
import { resolveTemperature, resolveStop, restoreStopMarker, resolveModel } from './decodingRecipe';

export interface RunStepOptions {
  stageId: StageId;
  step: ManifestStep;
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
  userOverride?: string;
  /** storyboard.2 单元生成时由循环器注入 */
  unitContext?: { unit: PlannedUnit; plan: ParsedPlan };
  /**
   * Decoding override — bypasses both decoding recipe and stage-tier defaults.
   * Used by Best-of-N to apply temperature jitter across parallel candidates,
   * and by any future caller that needs precise temperature control.
   */
  temperatureOverride?: number;
}

export async function runStep(opts: RunStepOptions): Promise<NodeArtifact> {
  const { stageId, step, project, artifacts, settings, signal, onDelta, userOverride, unitContext } = opts;

  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  const t0 = Date.now();
  // Per-node decoding recipe: explicit override > recipe table > stage tier.
  const temperature = typeof opts.temperatureOverride === 'number'
    ? opts.temperatureOverride
    : resolveTemperature(stageId, step.id, settings);
  const stop = resolveStop(step.id);
  const { model: resolvedModel, tier: modelTier } = resolveModel(step.id, settings);

  try {
    const payload = await loadPayload(step);
    const messages = await composeMessages({
      stageId, step, payload, project, artifacts, userOverride,
      enableKbInjection: settings.enableKbInjection,
      enableEditorialRounds: settings.enableEditorialRounds,
      unitContext,
    });

    // ── DeepSeek V4 ext: thinking strategy + response_format (per-step opt-in) ──
    // Default behaviour (no thinkingStrategy / no responseFormat fields on step):
    //   - thinking: omitted entirely, server uses its own default (back-compat)
    //   - JSON nodes (outFormat === 'json'): auto-upgrade to response_format=json_object
    //     unless explicitly opted out via step.responseFormat === 'text'.
    const thinkingReq =
      step.thinkingStrategy === 'enabled'
        ? { enabled: true as const, ...(step.thinkingEffort ? { effort: step.thinkingEffort } : {}) }
        : step.thinkingStrategy === 'disabled'
        ? { enabled: false as const }
        : undefined;
    const responseFormatReq: 'text' | 'json_object' | undefined =
      step.responseFormat ?? (step.outFormat === 'json' ? 'json_object' : undefined);

    const res = await chatStream({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: resolvedModel,
      messages,
      temperature,
      max_tokens: settings.maxTokens,
      stop,
      signal,
      onDelta,
      ...(thinkingReq ? { thinking: thinkingReq } : {}),
      ...(responseFormatReq ? { responseFormat: responseFormatReq } : {}),
    });
    // OpenAI-compatible: stop marker is stripped on hit. Re-append if any
    // node has an active stop sequence and finishReason indicates a hit.
    res.content = restoreStopMarker(res.content, res.finishReason, stop);

    // basic validation per outFormat
    if (step.outFormat === 'json') {
      try {
        const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        JSON.parse(stripped);
      } catch (e: any) {
        throw new Error(`输出不是合法 JSON：${e.message ?? e}`);
      }
    }

    const durationMs = res.durationMs ?? (Date.now() - t0);
    // Fire-and-forget run-history record
    recordRun({
      projectId: 0,
      nodeId: step.id,
      stageId,
      stepIndex: step.index,
      title: step.title,
      ts: Date.now(),
      status: 'done',
      durationMs,
      tokens: res.usage?.total_tokens,
      cost: estimateCost(res.usage),
      contentLength: res.content.length,
      contentSnapshot: res.content.length > 4096 ? res.content.slice(0, 4096) + '…' : res.content,
      unitIndex: unitContext?.unit?.unitIndex,
      model: resolvedModel,
      temperature,
    }).catch(() => {});

    return {
      nodeId: step.id,
      stageId,
      index: step.index,
      title: step.title,
      format: step.outFormat,
      content: res.content,
      tokens: res.usage?.total_tokens,
      cost: estimateCost(res.usage),
      durationMs,
      ts: Date.now(),
      meta: {
        modelTier,
        modelUsed: resolvedModel,
      },
    };
  } catch (e: any) {
    const aborted = signal?.aborted;
    recordRun({
      projectId: 0,
      nodeId: step.id,
      stageId,
      stepIndex: step.index,
      title: step.title,
      ts: Date.now(),
      status: aborted ? 'aborted' : 'error',
      durationMs: Date.now() - t0,
      error: e?.message ?? String(e),
      unitIndex: unitContext?.unit?.unitIndex,
      model: resolvedModel,
      temperature,
    }).catch(() => {});
    throw e;
  }
}

/* ─── storyboard.2 Phase E-G 逐单元循环器 ─────────────────────────── */

/** storyboard.2 artifact 的 meta 在循环器中的额外字段（断点续跑核心持久化） */
export interface Phase2LoopMeta {
  phase2Loop: true;
  unitCount: number;
  /** 已成功的 unitIndex（按完成顺序追加；幂等） */
  completedUnits: number[];
  /** 每单元的最终产出文本（按 unitIndex 索引） */
  unitContents: Record<number, string>;
  /** 失败单元（不阻断整体；用户可触发重试） */
  failedUnits: Array<{ unitIndex: number; error: string; retries: number }>;
  /** 累计 token / cost（跨多次续跑累加，方便看总成本） */
  cumulativeTokens?: number;
  cumulativeCost?: number;
}

export interface RunStoryboardPhase2Options {
  step: ManifestStep;                   // storyboard.2
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  signal?: AbortSignal;
  /** 是否从已有 artifact 的 meta 续跑（默认 true）。false 时全量重跑覆盖 */
  resume?: boolean;
  /** 仅跑指定 unitIndex（用于「只重跑失败单元」场景）。空/undef = 跑所有未完成 */
  onlyUnits?: number[];
  /** 每个单元的流式增量；包含 unitIndex 与全文 */
  onUnitDelta?: (unitIndex: number, full: string) => void;
  /** 单元开始 */
  onUnitStart?: (unit: PlannedUnit, total: number) => void;
  /** 单元完成 */
  onUnitDone?: (unit: PlannedUnit, content: string, total: number) => void;
  /** 单元失败（不抛错，循环继续） */
  onUnitFailed?: (unit: PlannedUnit, error: string, retries: number) => void;
  /** 每完成一个单元（成功或失败）后回调一次中间 artifact，调用方应 upsertArtifact 持久化 */
  onProgress?: (intermediate: NodeArtifact) => void;
}

export async function runStoryboardPhase2Loop(opts: RunStoryboardPhase2Options): Promise<NodeArtifact> {
  const {
    step, project, artifacts, settings, signal,
    onUnitDelta, onUnitStart, onUnitDone, onUnitFailed, onProgress,
  } = opts;
  const resume = opts.resume !== false;   // 默认 true
  const onlyUnits = opts.onlyUnits && opts.onlyUnits.length ? new Set(opts.onlyUnits) : null;

  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  const sb1 = artifacts['storyboard.1'];
  if (!sb1) throw new Error('storyboard.2 需要 storyboard.1（Phase A-D 单元规划）的输出，请先运行 storyboard.1');

  const plan = parseStoryboardPlan(sb1.content);
  if (!plan.units.length) {
    throw new Error('未能从 storyboard.1 解析到任何 UNIT 块；请检查其输出是否符合「## UNIT N」格式');
  }

  // 解析诊断（同前）
  const diag = {
    source: plan.source,
    totalUnits: plan.units.length,
    paragraphsParsed: plan.paragraphs.size,
    peaks: plan.peaks.length,
    warnings: plan.warnings ?? [],
    units: plan.units.map((u) => ({
      i: u.unitIndex,
      sceneId: u.sceneId,
      sectionRefs: u.sectionRefs,
      durationSec: u.durationSec,
      sceneType: u.sceneType,
      hasEntry: !!u.plannedEntryState,
      summary: u.summary?.slice(0, 30),
    })),
  };
  // eslint-disable-next-line no-console
  console.info('[storyboard.2] parsed plan from storyboard.1:', diag);
  if (plan.source === 'markdown') {
    // eslint-disable-next-line no-console
    console.warn(
      '[storyboard.2] storyboard.1 没有附带 <plan-json> 块，已退化到 markdown 解析。' +
      '强烈建议重跑 storyboard.1（已自动注入 JSON 输出契约）。',
    );
  }
  const unitsWithRefs = plan.units.filter((u) => u.sectionRefs.length > 0);
  if (unitsWithRefs.length === 0) {
    throw new Error(
      `[storyboard.2] storyboard.1 输出格式异常：解析到 ${plan.units.length} 个 UNIT，` +
      '但全部缺失 sectionRefs（§N 引用）。请重跑 storyboard.1。',
    );
  }
  if (unitsWithRefs.length < plan.units.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[storyboard.2] ${plan.units.length - unitsWithRefs.length} 个 UNIT 缺失 sectionRefs，` +
      '这些 unit 将拿不到原文上下文（可能输出无关内容）',
    );
  }

  // ───── 续跑状态读取 ─────────────────────────────────────────────
  const existing = artifacts[step.id];
  const existingMeta = (existing?.meta ?? {}) as Partial<Phase2LoopMeta>;
  const isResumable = resume && existing && existingMeta.phase2Loop === true;

  const completedSet = new Set<number>(isResumable && Array.isArray(existingMeta.completedUnits)
    ? existingMeta.completedUnits : []);
  const unitContents: Record<number, string> = isResumable && existingMeta.unitContents
    ? { ...existingMeta.unitContents } : {};
  let failedUnits: Phase2LoopMeta['failedUnits'] = isResumable && Array.isArray(existingMeta.failedUnits)
    ? [...existingMeta.failedUnits] : [];
  let cumulativeTokens = isResumable ? (existingMeta.cumulativeTokens ?? 0) : 0;
  let cumulativeCost = isResumable ? (existingMeta.cumulativeCost ?? 0) : 0;

  const t0 = performance.now();
  const total = plan.units.length;

  // ───── 决定本次要跑的单元 ────────────────────────────────────────
  let unitsToRun = plan.units.filter((u) => {
    if (onlyUnits) return onlyUnits.has(u.unitIndex);
    // 默认：跳过已完成的
    return !completedSet.has(u.unitIndex);
  });

  if (unitsToRun.length === 0) {
    // 边界：onlyUnits 显式给出但已全部完成 → 真的无事可做（保留早退）
    if (onlyUnits) {
      // eslint-disable-next-line no-console
      console.info('[storyboard.2] 指定的单元均已完成，无需运行');
      return assembleArtifact({
        step, plan, unitContents, completedUnits: [...completedSet],
        failedUnits, cumulativeTokens, cumulativeCost, durationMs: 0,
      });
    }
    // 默认续跑模式下全部 N 个单元已完成 = 用户在产物完成后再次点「运行」
    // 期望语义：重新生成（而非静默无操作）。自动转为全量重跑。
    // eslint-disable-next-line no-console
    console.info('[storyboard.2] 全部单元已完成，自动转为全量重跑（resume:false 等价行为）');
    completedSet.clear();
    for (const k of Object.keys(unitContents)) delete unitContents[Number(k)];
    failedUnits = [];
    cumulativeTokens = 0;
    cumulativeCost = 0;
    unitsToRun = [...plan.units];
  }

  // eslint-disable-next-line no-console
  console.info(`[storyboard.2] 本次将运行 ${unitsToRun.length}/${total} 个单元${
    isResumable && completedSet.size > 0 ? `（已跳过 ${completedSet.size} 个已完成单元）` : ''
  }`);

  // ───── 主循环（错误隔离 + 增量持久化） ────────────────────────────
  for (const unit of unitsToRun) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    onUnitStart?.(unit, total);

    // 调试：对首末 unit 打印 user 消息样本
    if (unit.unitIndex === 1 || unit.unitIndex === plan.units[plan.units.length - 1].unitIndex) {
      try {
        const dbgPayload = await loadPayload(step);
        const dbgMsgs = await composeMessages({
          stageId: 'storyboard', step,
          payload: dbgPayload,
          project, artifacts,
          unitContext: { unit, plan },
        });
        const userMsg = dbgMsgs.find((m) => m.role === 'user')?.content ?? '';
        // eslint-disable-next-line no-console
        console.debug(
          `[storyboard.2] unit ${unit.unitIndex}/${total} user message (first 1200 chars):\n${userMsg.slice(0, 1200)}${userMsg.length > 1200 ? '\n…[truncated]' : ''}`,
        );
      } catch { /* ignore */ }
    }

    try {
      const art = await runStep({
        stageId: 'storyboard',
        step,
        project,
        artifacts,
        settings,
        signal,
        unitContext: { unit, plan },
        onDelta: (_chunk, full) => onUnitDelta?.(unit.unitIndex, full),
      });

      // 成功：写入产物 + 标记完成 + 移出 failedUnits
      unitContents[unit.unitIndex] = art.content.trim();
      completedSet.add(unit.unitIndex);
      failedUnits = failedUnits.filter((f) => f.unitIndex !== unit.unitIndex);
      cumulativeTokens += art.tokens ?? 0;
      cumulativeCost += art.cost ?? 0;

      onUnitDone?.(unit, art.content, total);

      // 增量持久化：通知调用方把当前累积 artifact 写回 store
      const intermediate = assembleArtifact({
        step, plan, unitContents, completedUnits: [...completedSet],
        failedUnits, cumulativeTokens, cumulativeCost,
        durationMs: performance.now() - t0,
      });
      onProgress?.(intermediate);
    } catch (e: any) {
      // abort 立刻冒泡（用户主动停止）
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        throw e;
      }
      // 其他错误：隔离到 failedUnits，循环继续
      const errStr = e?.message ?? String(e);
      const prev = failedUnits.find((f) => f.unitIndex === unit.unitIndex);
      const retries = (prev?.retries ?? 0) + 1;
      failedUnits = failedUnits.filter((f) => f.unitIndex !== unit.unitIndex);
      failedUnits.push({ unitIndex: unit.unitIndex, error: errStr, retries });
      // eslint-disable-next-line no-console
      console.error(`[storyboard.2] unit ${unit.unitIndex} 失败 (第 ${retries} 次):`, errStr);
      onUnitFailed?.(unit, errStr, retries);

      const intermediate = assembleArtifact({
        step, plan, unitContents, completedUnits: [...completedSet],
        failedUnits, cumulativeTokens, cumulativeCost,
        durationMs: performance.now() - t0,
      });
      onProgress?.(intermediate);
    }
  }

  return assembleArtifact({
    step, plan, unitContents, completedUnits: [...completedSet],
    failedUnits, cumulativeTokens, cumulativeCost,
    durationMs: performance.now() - t0,
  });
}

/** 由当前 unitContents + plan 拼出完整 artifact；缺失单元留占位符以便人读 */
function assembleArtifact(p: {
  step: ManifestStep;
  plan: ParsedPlan;
  unitContents: Record<number, string>;
  completedUnits: number[];
  failedUnits: Phase2LoopMeta['failedUnits'];
  cumulativeTokens: number;
  cumulativeCost: number;
  durationMs: number;
}): NodeArtifact {
  const segments = p.plan.units.map((u) => {
    const content = p.unitContents[u.unitIndex];
    const failed = p.failedUnits.find((f) => f.unitIndex === u.unitIndex);
    if (content) {
      return [
        `<!-- UNIT ${u.unitIndex} · scene=${u.sceneId} · ${u.summary} -->`,
        `## UNIT ${u.unitIndex}`,
        '',
        content.trim(),
      ].join('\n');
    }
    if (failed) {
      return [
        `<!-- UNIT ${u.unitIndex} · 失败 (重试 ${failed.retries} 次) -->`,
        `## UNIT ${u.unitIndex} ⚠ 失败`,
        '',
        `> ${failed.error}`,
        '',
        '_（请在 UI 中点「重跑失败单元」）_',
      ].join('\n');
    }
    return [
      `<!-- UNIT ${u.unitIndex} · 待生成 -->`,
      `## UNIT ${u.unitIndex} · 待生成`,
      '',
      `_（${u.summary || '未生成'}）_`,
    ].join('\n');
  });

  const meta: Phase2LoopMeta = {
    phase2Loop: true,
    unitCount: p.plan.units.length,
    completedUnits: p.completedUnits.slice().sort((a, b) => a - b),
    unitContents: p.unitContents,
    failedUnits: p.failedUnits,
    cumulativeTokens: p.cumulativeTokens,
    cumulativeCost: p.cumulativeCost,
  };

  return {
    nodeId: p.step.id,
    stageId: 'storyboard',
    index: p.step.index,
    title: p.step.title,
    format: p.step.outFormat,
    content: segments.join('\n\n---\n\n'),
    tokens: p.cumulativeTokens,
    cost: p.cumulativeCost,
    durationMs: p.durationMs,
    ts: Date.now(),
    meta: meta as unknown as NodeArtifact['meta'],
  };
}
