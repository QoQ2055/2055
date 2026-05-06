// 剧本医生面板（Script Doctor Panel）
// 嵌入到 Express.tsx / ManualInjectDialog.tsx 等导入剧本入口下方。
//
// 工作流：
//   1) 用户点「🩺 启动质检」 → 流式调用诊断 LLM
//   2) 解析成功 → 渲染严重度色块报告 + 类别过滤 + 「应用医生改写」按钮
//   3) 点「应用医生改写」 → 第二次 LLM 调用，流式预览
//   4) 用户点「应用到原文」 → 回调 onAcceptRewrite 把改写版回写到上游
//
// 完全可选：用户可以始终跳过。

import { useMemo, useRef, useState } from 'react';
import {
  Stethoscope, Loader2, Sparkles, AlertTriangle, CheckCircle2, X,
  ChevronDown, ChevronRight, RotateCcw, FileText,
} from 'lucide-react';
import clsx from 'clsx';
import {
  runDoctorDiagnose, runDoctorRewrite,
  verdictColor, severityColor,
  type DoctorReport, type IssueSeverity, type IssueCategory,
} from './screenplayDoctor';
import { useSettings } from '../store/settings';

interface Props {
  /** 待诊断的剧本（通常是 normalize 后的预览或原始 draft） */
  script: string;
  /** 用户接受改写版时的回调；面板会传完整 markdown 全文 */
  onAcceptRewrite: (rewritten: string) => void;
  /** 父级正在做其他操作时禁用启动按钮 */
  disabled?: boolean;
  /** 紧凑样式（在 ManualInjectDialog 内部使用，去掉外边距） */
  compact?: boolean;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'diagnosing'; streamed: string }
  | { kind: 'diagnosed'; report: DoctorReport; rawOutput: string; parseError?: string }
  | { kind: 'parse_failed'; rawOutput: string; parseError: string }
  | { kind: 'rewriting'; report: DoctorReport; streamed: string }
  | { kind: 'rewritten'; report: DoctorReport; rewritten: string }
  | { kind: 'error'; msg: string };

export function ScreenplayDoctorPanel(p: Props) {
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [filter, setFilter] = useState<IssueSeverity | 'all'>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [showRaw, setShowRaw] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /* ── 启动诊断 ─────────────────────────────────────────── */

  async function startDiagnose() {
    if (!p.script.trim()) {
      setPhase({ kind: 'error', msg: '剧本为空，无法质检' });
      return;
    }
    if (!settings.apiKey) {
      setPhase({ kind: 'error', msg: '未配置 API Key（请到「设置」填入）' });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ kind: 'diagnosing', streamed: '' });
    setExpandedIssues(new Set());
    setFilter('all');

    try {
      const res = await runDoctorDiagnose({
        script: p.script,
        settings: { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model },
        signal: ctrl.signal,
        onDelta: (_, full) => setPhase({ kind: 'diagnosing', streamed: full }),
      });
      if (ctrl.signal.aborted) return;

      if (res.report) {
        setPhase({ kind: 'diagnosed', report: res.report, rawOutput: res.rawOutput, parseError: res.parseError });
      } else {
        setPhase({
          kind: 'parse_failed',
          rawOutput: res.rawOutput,
          parseError: res.parseError ?? '未知解析错误',
        });
      }
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      setPhase({ kind: 'error', msg: `质检失败：${e?.message ?? e}` });
    }
  }

  /* ── 启动改写 ─────────────────────────────────────────── */

  async function startRewrite() {
    if (phase.kind !== 'diagnosed') return;
    const report = phase.report;
    if (!settings.apiKey) {
      setPhase({ kind: 'error', msg: '未配置 API Key' });
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ kind: 'rewriting', report, streamed: '' });

    try {
      const res = await runDoctorRewrite({
        script: p.script,
        report,
        settings: { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model },
        signal: ctrl.signal,
        onDelta: (_, full) => setPhase({ kind: 'rewriting', report, streamed: full }),
      });
      if (ctrl.signal.aborted) return;
      setPhase({ kind: 'rewritten', report, rewritten: res.rewritten });
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      setPhase({ kind: 'error', msg: `改写失败：${e?.message ?? e}` });
    }
  }

  /* ── 控制 ─────────────────────────────────────────────── */

  function stop() { abortRef.current?.abort(); }
  function reset() { abortRef.current?.abort(); setPhase({ kind: 'idle' }); }
  function acceptRewrite() {
    if (phase.kind !== 'rewritten') return;
    p.onAcceptRewrite(phase.rewritten);
    setPhase({ kind: 'idle' });
  }

  function toggleIssue(i: number) {
    setExpandedIssues((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  /* ── 派生 ─────────────────────────────────────────────── */

  const report =
    phase.kind === 'diagnosed' || phase.kind === 'rewriting' || phase.kind === 'rewritten'
      ? phase.report
      : null;

  const filteredIssues = useMemo(() => {
    if (!report) return [];
    if (filter === 'all') return report.issues.map((it, i) => ({ it, i }));
    return report.issues
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.severity === filter);
  }, [report, filter]);

  const counts = useMemo(() => {
    if (!report) return { high: 0, mid: 0, low: 0, total: 0 };
    let high = 0, mid = 0, low = 0;
    for (const it of report.issues) {
      if (it.severity === 'high') high++;
      else if (it.severity === 'mid') mid++;
      else low++;
    }
    return { high, mid, low, total: report.issues.length };
  }, [report]);

  /* ── 渲染 ─────────────────────────────────────────────── */

  const wrapCls = clsx(
    'border rounded-md overflow-hidden',
    p.compact ? '' : 'mt-3',
    phase.kind === 'idle' && 'border-border-subtle bg-surface/30',
    phase.kind === 'diagnosing' && 'border-cyan-500/40 bg-cyan-500/5',
    phase.kind === 'diagnosed' && report && verdictColor(report.overall).cls.replace(/text-\S+/, ''),
    phase.kind === 'parse_failed' && 'border-danger/40 bg-danger/5',
    phase.kind === 'rewriting' && 'border-violet-500/40 bg-violet-500/5',
    phase.kind === 'rewritten' && 'border-success/40 bg-success/5',
    phase.kind === 'error' && 'border-danger/40 bg-danger/5',
  );

  return (
    <div className={wrapCls}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-border-subtle/70 flex items-center justify-between gap-2">
        <div className="text-[12px] inline-flex items-center gap-1.5 font-medium">
          <Stethoscope className="size-3.5 text-cyan-400" />
          剧本医生质检
          {report && (
            <span className={clsx(
              'ml-2 px-2 py-0.5 rounded text-[10px] border',
              verdictColor(report.overall).cls,
            )}>
              {verdictColor(report.overall).label}
            </span>
          )}
          {report && (
            <span className="ml-2 text-[10px] text-fg-muted">
              共 {counts.total} 条问题（
              {counts.high > 0 && <span className="text-danger">高 {counts.high}</span>}
              {counts.high > 0 && (counts.mid > 0 || counts.low > 0) && ' · '}
              {counts.mid > 0 && <span className="text-warning">中 {counts.mid}</span>}
              {counts.mid > 0 && counts.low > 0 && ' · '}
              {counts.low > 0 && <span className="text-fg-secondary">低 {counts.low}</span>}
              {counts.total === 0 && <span className="text-success">无问题</span>}
              ）
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(phase.kind === 'diagnosing' || phase.kind === 'rewriting') && (
            <button className="text-[10px] px-2 py-0.5 rounded border border-border-default text-fg-secondary hover:bg-elevated" onClick={stop}>
              <X className="size-3 inline" /> 停止
            </button>
          )}
          {(phase.kind === 'diagnosed' || phase.kind === 'parse_failed' || phase.kind === 'rewritten' || phase.kind === 'error') && (
            <button className="text-[10px] px-2 py-0.5 rounded border border-border-default text-fg-secondary hover:text-fg-primary hover:bg-elevated" onClick={reset} title="重置面板">
              <RotateCcw className="size-3 inline" />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}

      {phase.kind === 'idle' && (
        <div className="px-3 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-fg-secondary">
            将对剧本做 7 维度审阅（戏剧结构 / 人物动机 / 场次 / 台词 / 场景头 / 遗漏 / 节奏），输出问题清单与修改建议。
          </div>
          <button
            className="px-3 py-1.5 rounded border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 text-xs inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
            onClick={startDiagnose}
            disabled={p.disabled || !p.script.trim()}
          >
            <Stethoscope className="size-3.5" /> 启动质检
          </button>
        </div>
      )}

      {phase.kind === 'diagnosing' && (
        <div className="px-3 py-2">
          <div className="text-[11px] text-cyan-300 inline-flex items-center gap-1.5 mb-1.5">
            <Loader2 className="size-3 animate-spin" /> 医生分析中… {phase.streamed.length} 字
          </div>
          <pre className="text-[10px] font-mono text-fg-muted whitespace-pre-wrap break-words max-h-32 overflow-auto bg-canvas/50 rounded p-2 border border-border-subtle">
            {phase.streamed || '…'}
          </pre>
        </div>
      )}

      {phase.kind === 'diagnosed' && report && (
        <div>
          {/* summary */}
          <div className="px-3 py-2 border-b border-border-subtle/70">
            <div className="text-[10px] text-fg-muted mb-1">总评</div>
            <div className="text-[11px] text-fg-primary leading-relaxed">{report.summary}</div>
          </div>

          {/* filter */}
          {report.issues.length > 0 && (
            <div className="px-3 py-1.5 border-b border-border-subtle/70 flex items-center gap-1.5 text-[10px]">
              <span className="text-fg-muted">过滤：</span>
              {(['all', 'high', 'mid', 'low'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={clsx(
                    'px-1.5 py-0.5 rounded border transition-colors',
                    filter === k
                      ? 'border-zinc-500 bg-zinc-700 text-fg-primary'
                      : 'border-border-subtle text-fg-secondary hover:bg-elevated',
                  )}
                >
                  {k === 'all' ? `全部 ${counts.total}` :
                   k === 'high' ? `高 ${counts.high}` :
                   k === 'mid' ? `中 ${counts.mid}` :
                   `低 ${counts.low}`}
                </button>
              ))}
              <span className="ml-auto text-fg-muted">点击展开详情</span>
            </div>
          )}

          {/* issues */}
          <div className="max-h-80 overflow-auto">
            {filteredIssues.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-fg-muted text-center">
                {report.issues.length === 0
                  ? <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> 医生未发现明显问题</span>
                  : '当前过滤无匹配项目'}
              </div>
            ) : filteredIssues.map(({ it, i }) => {
              const c = severityColor(it.severity);
              const expanded = expandedIssues.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleIssue(i)}
                  className={clsx(
                    'block w-full text-left border-b border-border-subtle/40 last:border-b-0 px-3 py-2 hover:bg-elevated/30 transition-colors',
                    c.bg,
                  )}
                >
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronDown className="size-3 text-fg-muted flex-none" /> : <ChevronRight className="size-3 text-fg-muted flex-none" />}
                    <span className={clsx('inline-block size-2 rounded-full flex-none', c.dot)} />
                    <span className={clsx('text-[10px] uppercase font-mono flex-none', c.text)}>{it.severity}</span>
                    <span className="text-[11px] text-fg-secondary flex-none">{it.category}</span>
                    <span className="text-[10px] text-fg-muted flex-none">@ {it.location}</span>
                    <span className="text-[11px] text-fg-primary truncate ml-1">{it.description}</span>
                  </div>
                  {expanded && (
                    <div className="mt-1.5 ml-7 space-y-1 text-[11px]">
                      <div className="text-fg-secondary"><span className="text-fg-muted">问题：</span>{it.description}</div>
                      <div className="text-success/90"><span className="text-fg-muted">建议：</span>{it.suggestion}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* actions */}
          <div className="px-3 py-2 border-t border-border-subtle/70 flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded border border-violet-500/50 text-violet-300 hover:bg-violet-500/10 text-xs inline-flex items-center gap-1.5 disabled:opacity-40"
              onClick={startRewrite}
              disabled={report.issues.length === 0}
              title={report.issues.length === 0 ? '没有问题需要改写' : '调用医生改写一次（独立 LLM 调用，会重新计费）'}
            >
              <Sparkles className="size-3.5" /> 应用医生改写（再发一次 LLM）
            </button>
            <button
              className="text-xs px-2 py-1 rounded border border-border-default text-fg-secondary hover:bg-elevated"
              onClick={reset}
            >
              仅查看不改
            </button>
            <span className="ml-auto text-[10px] text-fg-muted">
              提示：改写不会自动覆盖，会先预览
            </span>
          </div>

          {/* parseError 警告（兜底解析成功但有问题） */}
          {phase.parseError && (
            <div className="px-3 py-1.5 border-t border-warning/30 bg-warning/5 text-[10px] text-warning">
              <AlertTriangle className="size-3 inline mr-1" /> 解析提示：{phase.parseError}（已使用兜底解析，建议核对原始输出）
              <button className="ml-2 underline" onClick={() => setShowRaw((v) => !v)}>{showRaw ? '隐藏' : '显示'}原始输出</button>
              {showRaw && (
                <pre className="mt-1 text-[10px] font-mono text-fg-secondary whitespace-pre-wrap break-words max-h-32 overflow-auto bg-canvas/50 rounded p-2 border border-warning/20">
                  {phase.rawOutput}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {phase.kind === 'parse_failed' && (
        <div className="px-3 py-2 text-[11px]">
          <div className="text-danger inline-flex items-center gap-1.5 mb-1">
            <AlertTriangle className="size-3.5" /> 医生输出无法解析为 JSON：{phase.parseError}
          </div>
          <div className="text-fg-secondary mb-1.5">原始输出（可重试）：</div>
          <pre className="text-[10px] font-mono text-fg-secondary whitespace-pre-wrap break-words max-h-40 overflow-auto bg-canvas/50 rounded p-2 border border-border-subtle">
            {phase.rawOutput || '(空)'}
          </pre>
          <div className="mt-2 flex gap-2">
            <button className="text-xs px-2 py-1 rounded border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10" onClick={startDiagnose}>
              重试质检
            </button>
            <button className="text-xs px-2 py-1 rounded border border-border-default text-fg-secondary hover:bg-elevated" onClick={reset}>
              关闭
            </button>
          </div>
        </div>
      )}

      {phase.kind === 'rewriting' && (
        <div className="px-3 py-2">
          <div className="text-[11px] text-violet-300 inline-flex items-center gap-1.5 mb-1.5">
            <Loader2 className="size-3 animate-spin" /> 医生改写中… {phase.streamed.length} 字
          </div>
          <pre className="text-[10px] font-mono text-fg-secondary whitespace-pre-wrap break-words max-h-72 overflow-auto bg-canvas/50 rounded p-2 border border-border-subtle">
            {phase.streamed || '…'}
          </pre>
        </div>
      )}

      {phase.kind === 'rewritten' && (
        <div>
          <div className="px-3 py-2 border-b border-border-subtle/70 text-[11px] text-success inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" /> 改写完成 · {phase.rewritten.length.toLocaleString()} 字（原 {p.script.length.toLocaleString()} 字）
          </div>
          <pre className="px-3 py-2 text-[10px] font-mono text-fg-primary whitespace-pre-wrap break-words max-h-72 overflow-auto">
            {phase.rewritten}
          </pre>
          <div className="px-3 py-2 border-t border-border-subtle/70 flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded border border-success/50 text-success hover:bg-success/10 text-xs inline-flex items-center gap-1.5"
              onClick={acceptRewrite}
            >
              <FileText className="size-3.5" /> 应用到原文
            </button>
            <button className="text-xs px-2 py-1 rounded border border-border-default text-fg-secondary hover:bg-elevated" onClick={reset}>
              丢弃改写
            </button>
            <span className="ml-auto text-[10px] text-fg-muted">
              将覆盖上方剧本输入框，原文不会保留
            </span>
          </div>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="px-3 py-2 text-[11px] text-danger inline-flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" /> {phase.msg}
          <button className="ml-2 text-fg-secondary underline hover:text-fg-primary" onClick={reset}>关闭</button>
        </div>
      )}
    </div>
  );
}
