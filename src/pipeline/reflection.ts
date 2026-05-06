// 一次跑通的 Reflection / Critic 闭环
//
// 设计动机
// ─────────
// 现有 selfCheck.ts + hybridFix.ts 已实现"诊断 + 修复"双阶段，但需要用户
// 手动点两次按钮才会触发。本模块把它们串成"事后立即自检 → 若不达标自动
// 修复"的单轮闭环 reflectionLoop()，调用方一行代码即可启用。
//
// 工作流
// ───────
//   1. 调用方完成 runStep（或 runStepBestOfN）后，把产物丢给 reflectionLoop
//   2. 内部跑 runTargetedSelfCheck，得到结构化 report
//   3. 若 verdict === 'fail' 或 critical/major 数 ≥ 阈值，跑 runHybridFix
//   4. 修复结果再跑一次 self-check（可选，由 maxLoops 控制；默认 1 轮）
//   5. 返回最终产物 + 完整 report 历史
//
// 与既有流水线的关系
// ───────────────────
// • 完全 opt-in；现有 runStep 调用路径不被打断
// • 不修改 selfCheck / hybridFix 的任何内部逻辑
// • 不修改 prompt 模板
// • 修复后的 artifact.content 与原 artifact 同 schema，下游无感

import type { SettingsState } from '../store/settings';
import type { NodeArtifact, ArtifactMap } from './types';
import { runTargetedSelfCheck, type SelfCheckReport, type Verdict } from './selfCheck';
import { runHybridFix } from './hybridFix';

/* ───────────────────────────────────────────────────────────────────
 * 触发阈值
 * ─────────────────────────────────────────────────────────────────── */

/** 默认：哪些节点开启 reflection 自动闭环 */
export const REFLECTION_NODES: ReadonlySet<string> = new Set([
  // ── 视觉 / 结构关键节点（最容易出格式错且代价大）
  'storyboard.1',  // plan-json 完整性
  'storyboard.2',  // 11 字段顺序 + 双区结构
  'assets.1',      // 资产扫描覆盖率
  // ── 剧本场次关键节点
  'screenplay.7',  // 场景写作
  'adapt.6',       // 镜像剧本
  // ── 小说节点：开启反 AI 腔 / 三密度自检自动修
  'novel.6',       // 章节草稿
]);

/** 默认触发修复的判据 */
export interface TriggerPolicy {
  /** verdict ∈ 触发集 → 触发修复。默认 ['fail'] */
  triggerOn: Verdict[];
  /** critical 数量 ≥ 此值即使 verdict 不在 triggerOn 也修复。默认 1 */
  criticalThreshold: number;
  /** major 数量 ≥ 此值即触发修复。默认 3 */
  majorThreshold: number;
}

const DEFAULT_POLICY: TriggerPolicy = {
  triggerOn: ['fail'],
  criticalThreshold: 1,
  majorThreshold: 3,
};

/* ───────────────────────────────────────────────────────────────────
 * Result types
 * ─────────────────────────────────────────────────────────────────── */
export interface ReflectionStage {
  /** 第几轮（1-based） */
  loop: number;
  /** 自检报告 */
  report: SelfCheckReport;
  /** 是否触发了修复 */
  triggeredFix: boolean;
  /** 修复应用的 patch 数 / 失败 patch 数（仅当 triggeredFix） */
  appliedCount?: number;
  failedCount?: number;
  fixDurationMs?: number;
}

export interface ReflectionResult {
  /** 最终产物（如未触发任何修复，==原 artifact） */
  finalArtifact: NodeArtifact;
  /** 是否经过修复 */
  modified: boolean;
  /** 各轮自检 + 修复明细 */
  stages: ReflectionStage[];
  totalDurationMs: number;
}

/* ───────────────────────────────────────────────────────────────────
 * 主入口
 * ─────────────────────────────────────────────────────────────────── */
export interface ReflectionLoopOptions {
  artifact: NodeArtifact;
  settings: SettingsState;
  /** 用于 storyboard.2 等节点注入上下文产物（与 runTargetedSelfCheck 一致） */
  contextArtifacts?: ArtifactMap;
  signal?: AbortSignal;
  /** 最大循环次数（每轮 = 一次 check + 可能的 fix）。默认 1，最多 2 */
  maxLoops?: number;
  /** 触发策略覆写（可选） */
  policy?: Partial<TriggerPolicy>;
  /** 自检流式增量回调（每轮独立） */
  onCheckDelta?: (loop: number, chunk: string, full: string) => void;
  /** 修复流式增量回调（每轮独立） */
  onFixDelta?: (loop: number, chunk: string, full: string) => void;
}

export async function reflectionLoop(opts: ReflectionLoopOptions): Promise<ReflectionResult> {
  const policy: TriggerPolicy = { ...DEFAULT_POLICY, ...(opts.policy ?? {}) };
  const maxLoops = Math.max(1, Math.min(2, opts.maxLoops ?? 1));

  const t0 = performance.now();
  const stages: ReflectionStage[] = [];
  let current: NodeArtifact = opts.artifact;
  let modified = false;

  for (let loop = 1; loop <= maxLoops; loop++) {
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');

    // ─── 1. Self-check ────────────────────────────────────────
    const checkRes = await runTargetedSelfCheck({
      artifact: current,
      settings: opts.settings,
      contextArtifacts: opts.contextArtifacts,
      signal: opts.signal,
      onDelta: opts.onCheckDelta ? (c, f) => opts.onCheckDelta!(loop, c, f) : undefined,
    });
    const report = checkRes.report;
    if (!report) {
      // 自检失败但不阻塞 — 直接返回当前产物
      console.warn(`[reflection] loop ${loop}: self-check returned null report; aborting loop`);
      break;
    }

    // ─── 2. 决策：是否触发修复 ─────────────────────────────────
    const trigger = shouldTriggerFix(report, policy);
    const stage: ReflectionStage = { loop, report, triggeredFix: trigger };

    if (!trigger) {
      stages.push(stage);
      // 已经 pass / warn 内可接受 — 提前结束
      break;
    }

    // ─── 3. Hybrid fix ───────────────────────────────────────
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const fixT0 = performance.now();
    try {
      const fix = await runHybridFix({
        artifact: current,
        issues: report.issues,
        settings: opts.settings,
        signal: opts.signal,
        onDelta: opts.onFixDelta ? (c, f) => opts.onFixDelta!(loop, c, f) : undefined,
      });
      stage.appliedCount = fix.applied.length;
      stage.failedCount = fix.failed.length;
      stage.fixDurationMs = performance.now() - fixT0;

      if (fix.revised && fix.revised !== current.content) {
        current = {
          ...current,
          content: fix.revised,
          ts: Date.now(),
          meta: {
            ...(current.meta ?? {}),
            reflection: {
              modifiedByReflection: true,
              loops: loop,
              lastReportVerdict: report.verdict,
              lastReportIssueCount: report.issues.length,
            },
          },
        };
        modified = true;
      }
    } catch (e: any) {
      // 修复失败不阻塞流程；记录错误并跳出
      console.error('[reflection] hybridFix failed:', e?.message ?? e);
      stage.fixDurationMs = performance.now() - fixT0;
      stages.push(stage);
      break;
    }
    stages.push(stage);
    // 若 maxLoops > 1，下一轮会再 check 修复后产物
  }

  return {
    finalArtifact: current,
    modified,
    stages,
    totalDurationMs: performance.now() - t0,
  };
}

function shouldTriggerFix(report: SelfCheckReport, policy: TriggerPolicy): boolean {
  if (policy.triggerOn.includes(report.verdict)) return true;
  let critical = 0;
  let major = 0;
  for (const issue of report.issues) {
    if (issue.severity === 'critical') critical++;
    else if (issue.severity === 'major') major++;
  }
  if (critical >= policy.criticalThreshold) return true;
  if (major >= policy.majorThreshold) return true;
  return false;
}

