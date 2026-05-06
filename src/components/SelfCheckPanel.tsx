// Renders a SelfCheckReport with severity badges, summary and actions.
// Used in Pipeline.tsx and Express.tsx as a per-node QA panel.

import { useRef, useState } from 'react';
// per-issue 修订已废弃, 改为顶部一键修复全部
import {
  ShieldCheck, ShieldAlert, ShieldX, Loader2, RefreshCw,
  ChevronDown, ChevronRight, X, Wand2, Check, Undo2,
} from 'lucide-react';
import type { SelfCheckReport, Severity, Verdict } from '../pipeline/selfCheck';
import { runFixAllIssues, runTargetedSelfCheck } from '../pipeline/selfCheck';
import { runHybridFix } from '../pipeline/hybridFix';
import { buildFixContextPreamble } from '../pipeline/fixContext';
import type { NodeArtifact, ArtifactMap } from '../pipeline/types';
import type { SettingsState } from '../store/settings';
import { useProject } from '../store/project';

export interface SelfCheckPanelProps {
  artifact: NodeArtifact;
  settings: SettingsState;
  /** 当前已存在的报告（来自 artifact.meta.selfCheck）；若不存在，仅渲染按钮 */
  report?: SelfCheckReport;
  /** 写回 artifact.meta.selfCheck 的回调；调用方负责 upsertArtifact */
  onReportUpdate: (report: SelfCheckReport | null) => void;
  /** 可选：打开「上下文自检」后传入全局 artifacts，用于 storyboard.2 检查时注入 sb.1/assets */
  contextArtifacts?: ArtifactMap;
  /** 可选：提供后启用「逐 issue AI 辅助修订」，用于写回 artifact.content */
  onArtifactPatch?: (newContent: string) => void;
}

interface FixState {
  status: 'fixing' | 'preview' | 'confirming' | 'error';
  preview: string;
  error?: string;
}

/* B+C 迭代修复状态机 */
interface IterHistoryRow {
  round: number;
  count: number;       // 该轮重检后 actionable issue 数
  verdict: Verdict;    // 该轮重检后 verdict
  accepted: boolean;   // 是否被守门接受 (严格优于当前 best)
  note?: string;       // 重检失败等说明
}
type IterState =
  | { kind: 'running'; phase: 'fixing' | 'checking'; round: number; previewLen: number; history: IterHistoryRow[] }
  | {
      kind: 'review';
      history: IterHistoryRow[];
      bestContent: string;
      bestReport: SelfCheckReport;
      bestCount: number;
      bestVerdict: Verdict;
      originalContent: string;
      originalReport: SelfCheckReport | null;
      originalCount: number;
      reviewConfirming: boolean;
    }
  | { kind: 'no-improvement'; history: IterHistoryRow[]; reason: string }
  | { kind: 'error'; error: string; history: IterHistoryRow[] };

const MAX_ITERATIONS = 5;
const STALL_LIMIT = 2; // 连续 N 轮未接受则提前退出

function actionableCount(r: SelfCheckReport): number {
  return r.issues.filter((i) => i.severity !== 'info').length;
}
function verdictRank(v: Verdict | undefined): number {
  return v === 'pass' ? 3 : v === 'warn' ? 2 : 1; // fail / undefined 当 1
}
function shortPatchType(t: string): string {
  if (t === 'search-replace') return 'SR';
  if (t === 'jsonpatch') return 'JP';
  if (t === 'block') return 'BLK';
  if (t === 'rewrite-all') return 'ALL';
  return t;
}

export function SelfCheckPanel({
  artifact, settings, report, onReportUpdate, contextArtifacts, onArtifactPatch,
}: SelfCheckPanelProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>('');
  const [expanded, setExpanded] = useState(true);
  // B+C 迭代修复状态机
  const [iter, setIter] = useState<IterState | null>(null);
  const iterAbortRef = useRef<AbortController | null>(null);
  // 应用后快照 + 回滚 (仅用于评审通过写回后的 "还原原产物")
  const [snapshot, setSnapshot] = useState<{
    content: string;
    report: SelfCheckReport | null;
    prevActionableCount: number;
  } | null>(null);

  /**
   * B+C 迭代修复:
   * - 最多 MAX_ITERATIONS 轮
   * - 每轮跨 fix → recheck
   * - 守门: 仅当新 (issueCount 下降) OR (verdict 提升) 才接受为新 best
   * - 遇 verdict=pass 提前停; 连续 STALL_LIMIT 轮未接受也提前停
   * - 最终 best 仅当优于原产物才进入 review (等待用户确认应用)
   */
  async function startIteration() {
    if (!onArtifactPatch || !report) return;
    if (iter?.kind === 'running') return;
    const origCount = actionableCount(report);
    if (origCount === 0) return;

    const original = {
      content: artifact.content,
      report,
      count: origCount,
      verdict: report.verdict,
    };
    let best = { ...original };

    const ac = new AbortController();
    iterAbortRef.current = ac;
    const history: IterHistoryRow[] = [];
    let stalledStreak = 0;

    setError('');
    setIter({ kind: 'running', phase: 'fixing', round: 1, previewLen: 0, history: [] });

    // 拼装修复专用的项目知识层 preamble（题材锚点 / KB / 方法模块 / R1）。
    // 全迭代复用同一份 preamble（项目上下文不变）。
    let extraPreamble = '';
    try {
      const proj = useProject.getState();
      extraPreamble = await buildFixContextPreamble({
        nodeId: artifact.nodeId,
        project: proj.ctx,
        artifacts: proj.artifacts,
        enableKbInjection: settings.enableKbInjection,
        enableEditorialRounds: settings.enableEditorialRounds,
      });
    } catch (e) {
      console.warn('[SelfCheckPanel] buildFixContextPreamble failed (修复仍会继续，仅未注入项目知识层):', e);
    }

    for (let round = 1; round <= MAX_ITERATIONS; round++) {
      if (ac.signal.aborted) break;

      // Phase 1: Fix 当前 best.content + best.report.issues (hybrid patch plan)
      setIter({ kind: 'running', phase: 'fixing', round, previewLen: 0, history: [...history] });
      let fixedContent: string;
      let fixNote = '';
      try {
        const fixRes = await runHybridFix({
          artifact: { ...artifact, content: best.content },
          issues: best.report.issues,
          settings,
          extraSystemPreamble: extraPreamble,
          signal: ac.signal,
          onDelta: (_chunk, full) => {
            setIter((s) =>
              s?.kind === 'running'
                ? { ...s, previewLen: full.length }
                : s,
            );
          },
        });
        fixedContent = fixRes.revised;
        // 记录本轮 patch 类型分布 供 history pill tooltip 展示
        const types = fixRes.applied.map((a) => a.type);
        const counts = types.reduce<Record<string, number>>((acc, t) => {
          acc[t] = (acc[t] ?? 0) + 1;
          return acc;
        }, {});
        const summary = Object.entries(counts)
          .map(([t, n]) => `${shortPatchType(t)}×${n}`)
          .join(' ');
        const failedN = fixRes.failed.length;
        const skippedN = fixRes.skipped.length;
        fixNote = [
          summary || '无可应用 patch',
          failedN ? ` · 失败 ${failedN}` : '',
          skippedN ? ` · LLM跳过 ${skippedN}` : '',
        ].join('');
      } catch (e: any) {
        if (ac.signal.aborted) break;
        setIter({ kind: 'error', error: e?.message ?? String(e), history });
        iterAbortRef.current = null;
        return;
      }
      if (ac.signal.aborted) break;

      // Phase 2: Recheck 修订后产物
      setIter({ kind: 'running', phase: 'checking', round, previewLen: fixedContent.length, history: [...history] });
      let newReport: SelfCheckReport | null = null;
      try {
        const checkRes = await runTargetedSelfCheck({
          artifact: { ...artifact, content: fixedContent },
          settings,
          signal: ac.signal,
          contextArtifacts: settings.enableSelfCheckContext ? contextArtifacts : undefined,
        });
        newReport = checkRes.report;
      } catch (e: any) {
        if (ac.signal.aborted) break;
        setIter({ kind: 'error', error: e?.message ?? String(e), history });
        iterAbortRef.current = null;
        return;
      }
      if (ac.signal.aborted) break;

      if (!newReport) {
        // 重检未返回合法 JSON: 该轮不接受
        history.push({ round, count: best.count, verdict: best.verdict, accepted: false, note: `重检返回不可解析 · ${fixNote}` });
        stalledStreak++;
      } else {
        const newCount = actionableCount(newReport);
        const newVerdict = newReport.verdict;
        const better =
          newCount < best.count ||
          verdictRank(newVerdict) > verdictRank(best.verdict);
        history.push({ round, count: newCount, verdict: newVerdict, accepted: better, note: fixNote });
        if (better) {
          best = { content: fixedContent, report: newReport, count: newCount, verdict: newVerdict };
          stalledStreak = 0;
        } else {
          stalledStreak++;
        }
        if (newVerdict === 'pass') break;
      }
      if (stalledStreak >= STALL_LIMIT) break;
    }

    iterAbortRef.current = null;

    // 收尾: 判定 best 是否严格优于原产物
    const improved =
      best.count < original.count ||
      verdictRank(best.verdict) > verdictRank(original.verdict);

    if (ac.signal.aborted && !improved) {
      setIter(null);
      return;
    }

    if (improved) {
      setIter({
        kind: 'review',
        history,
        bestContent: best.content,
        bestReport: best.report,
        bestCount: best.count,
        bestVerdict: best.verdict,
        originalContent: original.content,
        originalReport: original.report,
        originalCount: original.count,
        reviewConfirming: false,
      });
    } else {
      setIter({
        kind: 'no-improvement',
        history,
        reason: ac.signal.aborted
          ? '已中断: 迭代过程中未能改善原产物'
          : '迭代结束: 未能改善原产物 (可能 issue 需要人工介入)',
      });
    }
  }

  function abortIteration() {
    iterAbortRef.current?.abort();
  }

  function requestReviewApply() {
    setIter((s) => (s?.kind === 'review' ? { ...s, reviewConfirming: true } : s));
  }

  function cancelReviewConfirm() {
    setIter((s) => (s?.kind === 'review' ? { ...s, reviewConfirming: false } : s));
  }

  function applyBest() {
    if (!iter || iter.kind !== 'review' || !onArtifactPatch) return;
    setSnapshot({
      content: iter.originalContent,
      report: iter.originalReport,
      prevActionableCount: iter.originalCount,
    });
    onArtifactPatch(iter.bestContent);
    onReportUpdate(iter.bestReport);
    setIter(null);
  }

  function discardIteration() {
    setIter(null);
  }

  function rollback() {
    if (!snapshot || !onArtifactPatch) return;
    onArtifactPatch(snapshot.content);
    onReportUpdate(snapshot.report);
    setSnapshot(null);
  }

  function dismissSnapshot() {
    setSnapshot(null);
  }

  async function run() {
    if (running) return;
    setRunning(true); setError('');
    try {
      const res = await runTargetedSelfCheck({
        artifact,
        settings,
        contextArtifacts: settings.enableSelfCheckContext ? contextArtifacts : undefined,
      });
      if (res.report) {
        onReportUpdate(res.report);
      } else {
        setError('模型未返回合法 JSON 报告，请重试或检查网络');
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  if (!report && !running && !error) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <button onClick={run} className="btn-outline" title="对该节点产物做结构化诊断">
          <ShieldCheck className="size-3.5" /> 自检
        </button>
        <span className="text-zinc-500">未检测 · 点击检查反装饰 / 结构 / 一致性</span>
      </div>
    );
  }

  return (
    <div className={`card border ${verdictBorder(report?.verdict)} bg-zinc-950/40`}>
      <header
        className="px-3 py-2 flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-3.5 text-zinc-500" /> : <ChevronRight className="size-3.5 text-zinc-500" />}
        <VerdictIcon verdict={report?.verdict} running={running} />
        <span className="text-sm font-medium">
          自检 · {report?.verdict ?? (running ? '检查中…' : '失败')}
        </span>
        {report && (
          <span className="text-xs text-zinc-500 ml-1">
            · {report.issues.length} 项 · {Math.round(report.durationMs)}ms
            {report.tokens != null && ` · ${report.tokens} tok`}
          </span>
        )}
        <div className="flex-1" />
        <button
          className="btn-ghost px-2 py-1 text-xs"
          onClick={(e) => { e.stopPropagation(); run(); }}
          disabled={running}
          title="重新自检"
        >
          {running ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </button>
      </header>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {error && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1.5">
              {error}
            </div>
          )}
          {report && (
            <>
              {report.summary && (
                <div className="text-xs text-zinc-300 leading-relaxed">{report.summary}</div>
              )}
              {report.issues.length === 0 ? (
                <div className="text-xs text-emerald-400">✔ 无问题命中</div>
              ) : (
                <>
                {/* 顶部·一键迭代修复 (B+C) */}
                {onArtifactPatch && report.issues.some((i) => i.severity !== 'info') && !iter && (
                  <button
                    className="btn-primary px-3 py-1.5 text-xs w-full justify-center bg-violet-600 hover:bg-violet-500 border-violet-500"
                    onClick={startIteration}
                    title={`迭代修复: 最多 ${MAX_ITERATIONS} 轮, 每轮内部跑「fix → 重检」并守门, 仅保留改善版本; 直到 verdict=pass 或停滞`}
                  >
                    <Wand2 className="size-3.5" /> 一键 AI 迭代修复 ({report.issues.filter((i) => i.severity !== 'info').length} 项 · ≤ {MAX_ITERATIONS} 轮)
                  </button>
                )}

                {/* 迭代中: 进度条 + 历史 pills + 中断 */}
                {iter?.kind === 'running' && (
                  <div className="rounded border border-violet-500/30 bg-violet-500/5 px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-violet-200">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span className="font-medium">
                        第 {iter.round}/{MAX_ITERATIONS} 轮 · {iter.phase === 'fixing' ? 'AI 修复中' : '重新自检中'}
                      </span>
                      {iter.phase === 'fixing' && iter.previewLen > 0 && (
                        <span className="text-zinc-500">{iter.previewLen} 字流入</span>
                      )}
                      <div className="flex-1" />
                      <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={abortIteration}>
                        中断
                      </button>
                    </div>
                    {iter.history.length > 0 && (
                      <IterHistory rows={iter.history} />
                    )}
                  </div>
                )}

                {/* 迭代结束: review 块 (有改善, 等待用户确认应用) */}
                {iter?.kind === 'review' && (
                  <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-emerald-100">
                      <ShieldCheck className="size-3.5 text-emerald-300" />
                      <span className="font-medium">
                        迭代完成 · {iter.originalCount} → {iter.bestCount} 项 ·
                        verdict {iter.originalReport?.verdict ?? '?'} → {iter.bestVerdict}
                      </span>
                      <span className="text-zinc-400">
                        ({iter.history.length} 轮, 改动 {(approxChangedRatio(iter.originalContent, iter.bestContent) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <IterHistory rows={iter.history} />
                    {!iter.reviewConfirming ? (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-zinc-400">已自动选取最佳轮次, 是否覆盖原产物?</span>
                        <div className="flex-1" />
                        <button
                          className="btn-primary px-2 py-0.5 text-[11px]"
                          onClick={requestReviewApply}
                          title="确认采用最佳轮次的修订内容"
                        >
                          <Check className="size-3" /> 应用
                        </button>
                        <button
                          className="btn-ghost px-2 py-0.5 text-[11px]"
                          onClick={discardIteration}
                          title="放弃所有迭代结果, 维持原产物"
                        >
                          <X className="size-3" /> 放弃
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px]">
                        <ShieldAlert className="size-3.5 text-amber-300" />
                        <span className="text-amber-100">
                          确认用最佳轮次内容覆盖原产物? 原内容会被替换 (仍可通过下方"回滚"还原)。
                        </span>
                        <div className="flex-1" />
                        <button
                          className="btn-primary px-2 py-0.5 text-[11px]"
                          onClick={applyBest}
                        >
                          <Check className="size-3" /> 确认替换
                        </button>
                        <button
                          className="btn-ghost px-2 py-0.5 text-[11px]"
                          onClick={cancelReviewConfirm}
                        >
                          <X className="size-3" /> 取消
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 迭代结束: 无任何改善 */}
                {iter?.kind === 'no-improvement' && (
                  <div className="rounded border border-zinc-600/40 bg-zinc-800/30 px-2 py-1.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <ShieldX className="size-3.5 text-zinc-400" />
                      <span>{iter.reason}</span>
                      <div className="flex-1" />
                      <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={discardIteration}>
                        <X className="size-3" /> 关闭
                      </button>
                    </div>
                    {iter.history.length > 0 && <IterHistory rows={iter.history} />}
                  </div>
                )}

                {/* 迭代过程出错 */}
                {iter?.kind === 'error' && (
                  <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-3.5 text-rose-300" />
                      <span className="font-medium">迭代失败</span>
                      <div className="flex-1" />
                      <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={startIteration}>
                        <RefreshCw className="size-3" /> 重试
                      </button>
                      <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={discardIteration}>
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="text-rose-300/80 break-all">{iter.error}</div>
                    {iter.history.length > 0 && <IterHistory rows={iter.history} />}
                  </div>
                )}

                {snapshot && (() => {
                  const newCount = report
                    ? report.issues.filter((i) => i.severity !== 'info').length
                    : 0;
                  const regressed = newCount > snapshot.prevActionableCount;
                  return (
                    <div
                      className={`flex items-center gap-2 text-[11px] rounded border px-2 py-1.5 ${
                        regressed
                          ? 'text-rose-100 bg-rose-500/15 border-rose-500/40'
                          : 'text-emerald-100 bg-emerald-500/10 border-emerald-500/30'
                      }`}
                    >
                      {regressed ? (
                        <ShieldAlert className="size-3.5 text-rose-300" />
                      ) : (
                        <ShieldCheck className="size-3.5 text-emerald-300" />
                      )}
                      <span>
                        {regressed
                          ? `⚠️ 修订后问题反而增加: ${snapshot.prevActionableCount} → ${newCount}. 建议回滚到原产物.`
                          : `✓ 修订生效: ${snapshot.prevActionableCount} → ${newCount} 项问题 (快照仍保留, 随时可回滚)`}
                      </span>
                      <div className="flex-1" />
                      <button
                        className={`px-2 py-0.5 text-[11px] ${regressed ? 'btn-primary bg-rose-600 hover:bg-rose-500 border-rose-500' : 'btn-outline'}`}
                        onClick={rollback}
                        title="还原为修订前的产物与报告"
                      >
                        <Undo2 className="size-3" /> 回滚
                      </button>
                      <button
                        className="btn-ghost px-2 py-0.5 text-[11px]"
                        onClick={dismissSnapshot}
                        title="关闭提示 (快照会丢弃)"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })()}
                <ul className="space-y-1.5">
                  {report.issues.map((issue, idx) => (
                    <li
                      key={idx}
                      className={`text-xs rounded px-2 py-1.5 border ${severityStyle(issue.severity)}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold ${severityText(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span className="font-medium text-zinc-200">{issue.tag}</span>
                        {issue.locator && (
                          <span className="text-zinc-500 text-[10px]">@ {issue.locator}</span>
                        )}
                      </div>
                      <div className="mt-1 text-zinc-300 leading-relaxed">{issue.detail}</div>
                      {issue.suggestion && (
                        <div className="mt-1 text-zinc-400">
                          <span className="text-zinc-500">建议: </span>
                          {issue.suggestion}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── FixPreview · 单 issue 修订流式预览 ─────────────────────── */

function FixPreview({
  state, original, onRequestApply, onConfirmApply, onCancelConfirm, onDismiss, onRetry,
}: {
  state: FixState;
  original: string;
  onRequestApply: () => void;
  onConfirmApply: () => void;
  onCancelConfirm: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (state.status === 'error') {
    return (
      <div className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
        <div className="flex items-center gap-2">
          <span className="font-medium">修订失败</span>
          <div className="flex-1" />
          <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={onRetry}>
            <RefreshCw className="size-3" /> 重试
          </button>
          <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={onDismiss}>
            <X className="size-3" />
          </button>
        </div>
        <div className="mt-1 text-rose-300/80 break-all">{state.error}</div>
      </div>
    );
  }

  const streaming = state.status === 'fixing';
  const confirming = state.status === 'confirming';
  const delta = state.preview.length - original.length;
  const sign = delta > 0 ? '+' : '';
  // 估算改动幅度: 1 - (公共前缀 + 公共后缀) / max(原文长, 修订长). O(n) 快简估算.
  const changedRatio = streaming ? 0 : approxChangedRatio(original, state.preview);
  const ratioLabel = `${(changedRatio * 100).toFixed(1)}%`;
  const ratioColor =
    changedRatio < 0.05 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
    : changedRatio < 0.25 ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
    : 'text-rose-300 bg-rose-500/15 border-rose-500/40';
  const isHighRisk = changedRatio >= 0.25;
  return (
    <div className="mt-2 rounded border border-violet-500/30 bg-violet-500/5 px-2 py-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <Wand2 className="size-3 text-violet-300" />
        <span className="font-medium text-violet-200">
          {streaming ? '修订中…' : confirming ? '等待确认' : '修订预览'}
        </span>
        <span className="text-zinc-500">
          · {state.preview.length} 字 ({sign}{delta} vs 原文)
        </span>
        {!streaming && (
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${ratioColor}`}
            title="改动幅度 ≈ 1 - (前后缀共享长 / 总长). 越低越接近外科手术, 越高越可能有重写风险"
          >
            Δ {ratioLabel}
          </span>
        )}
        <div className="flex-1" />
        {state.status === 'preview' && (
          <>
            <button
              className="btn-primary px-2 py-0.5 text-[11px]"
              onClick={onRequestApply}
              title="点击后需要二次确认才会写回 artifact"
            >
              <Check className="size-3" /> 应用
            </button>
            <button
              className="btn-ghost px-2 py-0.5 text-[11px]"
              onClick={onRetry}
              title="重新生成"
            >
              <RefreshCw className="size-3" />
            </button>
            <button
              className="btn-ghost px-2 py-0.5 text-[11px]"
              onClick={onDismiss}
              title="放弃"
            >
              <Undo2 className="size-3" />
            </button>
          </>
        )}
        {streaming && (
          <span className="text-zinc-500 animate-pulse">流式接收中…</span>
        )}
      </div>
      <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300 bg-zinc-950/60 rounded px-2 py-1.5">
        {state.preview || '（等待 LLM 输出…）'}
      </pre>
      {confirming && (
        <div
          className={`mt-2 rounded border px-2 py-1.5 text-[11px] ${
            isHighRisk
              ? 'border-rose-500/50 bg-rose-500/15'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className={`size-3.5 ${isHighRisk ? 'text-rose-300' : 'text-amber-300'}`} />
            <span className={isHighRisk ? 'text-rose-100' : 'text-amber-100'}>
              {isHighRisk
                ? `⚠️ 高风险修订 — 改动幅度 ${ratioLabel}, LLM 可能改写了无关区域. 建议先点「重试」或在预览区人工检查后再确认.`
                : `确认用此修订版本替换原产物全文？原内容将被覆盖不可撤销。`}
            </span>
            <div className="flex-1" />
            <button
              className={`px-2 py-0.5 text-[11px] ${isHighRisk ? 'btn-outline' : 'btn-primary'}`}
              onClick={onConfirmApply}
              title="以修订全文覆盖原产物"
            >
              <Check className="size-3" /> 确认替换
            </button>
            <button
              className="btn-ghost px-2 py-0.5 text-[11px]"
              onClick={onCancelConfirm}
              title="取消确认，返回预览"
            >
              <X className="size-3" /> 取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── IterHistory · 迭代历史 pills ─────────────────────────────── */

function IterHistory({ rows }: { rows: IterHistoryRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px]">
      {rows.map((r, i) => {
        const tone =
          r.verdict === 'pass'
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
            : r.verdict === 'warn'
            ? 'bg-amber-500/15 border-amber-500/35 text-amber-200'
            : 'bg-rose-500/15 border-rose-500/35 text-rose-200';
        return (
          <span
            key={i}
            className={`px-1.5 py-0.5 rounded border font-mono ${tone} ${r.accepted ? '' : 'opacity-60'}`}
            title={r.note ?? (r.accepted ? '守门通过 (改善)' : '守门未通过 (未改善)')}
          >
            #{r.round}: {r.count}项 {r.verdict}{r.accepted ? ' ✓' : ' —'}
          </span>
        );
      })}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────── */

/**
 * O(n) 估算两段字符串"中间不一致区域"占总长比例。
 * 不是真正的 Levenshtein, 但对"外科手术修订 vs 整体重写"两类极端 case 区分度足够：
 *   - 外科手术: 改动只发生在中间一小段 → ratio ≈ 改动长 / 总长 (低)
 *   - 整体重写: 几乎没有公共前后缀 → ratio → 1 (高)
 */
function approxChangedRatio(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a || !b) return 1;
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  const maxLen = Math.max(aLen, bLen);
  let prefix = 0;
  const prefMax = Math.min(aLen, bLen);
  while (prefix < prefMax && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++;
  let suffix = 0;
  const suffMax = Math.min(aLen, bLen) - prefix;
  while (
    suffix < suffMax &&
    a.charCodeAt(aLen - 1 - suffix) === b.charCodeAt(bLen - 1 - suffix)
  ) suffix++;
  const changedLenA = aLen - prefix - suffix;
  const changedLenB = bLen - prefix - suffix;
  // 取更大的一边作为"中间被改的体积"; 加上长度差额已经隐含在两边的差里
  const changedLen = Math.max(changedLenA, changedLenB);
  return Math.min(1, changedLen / maxLen);
}

function VerdictIcon({ verdict, running }: { verdict?: Verdict; running: boolean }) {
  if (running) return <Loader2 className="size-4 text-brand-400 animate-spin" />;
  if (verdict === 'pass') return <ShieldCheck className="size-4 text-emerald-500" />;
  if (verdict === 'warn') return <ShieldAlert className="size-4 text-amber-500" />;
  if (verdict === 'fail') return <ShieldX className="size-4 text-rose-500" />;
  return <ShieldCheck className="size-4 text-zinc-500" />;
}

function verdictBorder(v?: Verdict): string {
  if (v === 'pass') return 'border-emerald-500/30';
  if (v === 'warn') return 'border-amber-500/40';
  if (v === 'fail') return 'border-rose-500/40';
  return 'border-zinc-800';
}

function severityStyle(s: Severity): string {
  if (s === 'critical') return 'border-rose-500/40 bg-rose-500/5';
  if (s === 'major')    return 'border-amber-500/40 bg-amber-500/5';
  if (s === 'minor')    return 'border-zinc-700 bg-zinc-900/40';
  return 'border-zinc-800 bg-zinc-950/40';
}

function severityText(s: Severity): string {
  if (s === 'critical') return 'text-rose-300';
  if (s === 'major')    return 'text-amber-300';
  if (s === 'minor')    return 'text-zinc-300';
  return 'text-zinc-500';
}
