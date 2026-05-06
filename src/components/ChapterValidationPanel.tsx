/**
 * 章节自动校验面板（v2 阶段 2.4）
 *
 * 在 Novel 页 PreviewModal 的章节预览场景下使用。
 * 输入：章节正文 + ProjectContext + 已启用模块 id。
 * 输出：可折叠的问题清单，按 severity 分组配色。
 *
 * 依赖纯前端规则（src/pipeline/chapterValidation.ts），不调用 LLM。
 */

import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ShieldCheck, AlertOctagon, AlertTriangle, Info,
  Wand2, Loader2, X,
} from 'lucide-react';
import {
  validateChapter,
  summarizeIssues,
  type ValidationIssue,
  type ValidationSeverity,
} from '../pipeline/chapterValidation';
import { runFixAllIssues, type SelfCheckIssue } from '../pipeline/selfCheck';
import { buildFixContextPreamble } from '../pipeline/fixContext';
import type { NodeArtifact, ProjectContext } from '../pipeline/types';
import { useProject } from '../store/project';
import { useSettings } from '../store/settings';

interface Props {
  /** 章节正文 */
  text: string;
  ctx?: Partial<ProjectContext>;
  enabledModuleIds?: string[];
  /** 默认展开（章节预览场景默认 true） */
  defaultOpen?: boolean;
  /** 章节所属节点 id（决定 KB / 用户 KB / 方法论注入白名单）。
   *  与 onApplyRevised 配合：两者都给才会显示「AI 一键修订」按钮。 */
  nodeId?: 'novel.3.1' | 'novel.3.2';
  /** 章节标题（构造临时 artifact 时用）。 */
  chapterTitle?: string;
  /** AI 修订完成后的回调；调用方负责把 revised 写回章节并加入撤销栈。 */
  onApplyRevised?: (revisedText: string) => void;
}

/** 把纯前端校验的 ValidationIssue 转成修复引擎期望的 SelfCheckIssue。 */
function toSelfCheckIssue(v: ValidationIssue): SelfCheckIssue {
  return {
    severity: v.severity === 'error' ? 'major' : v.severity === 'warning' ? 'minor' : 'info',
    tag: v.kind,
    detail:
      v.message +
      (v.evidence && v.evidence.length
        ? `（命中：${v.evidence.slice(0, 3).join('、')}）`
        : ''),
    suggestion: v.fixHint,
  };
}

type AiFixState =
  | { kind: 'idle' }
  | { kind: 'streaming'; previewLen: number }
  | { kind: 'error'; msg: string };

const SEVERITY_META: Record<ValidationSeverity, {
  label: string;
  icon: typeof AlertOctagon;
  badgeClass: string;
  rowClass: string;
}> = {
  error: {
    label: '错误',
    icon: AlertOctagon,
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    rowClass: 'border-rose-500/30 bg-rose-500/5',
  },
  warning: {
    label: '警告',
    icon: AlertTriangle,
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    rowClass: 'border-amber-500/30 bg-amber-500/5',
  },
  info: {
    label: '提示',
    icon: Info,
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    rowClass: 'border-blue-500/20 bg-blue-500/5',
  },
};

export function ChapterValidationPanel({
  text,
  ctx,
  enabledModuleIds,
  defaultOpen = true,
  nodeId,
  chapterTitle,
  onApplyRevised,
}: Props) {
  const issues = useMemo(
    () => validateChapter({ text, ctx, enabledModuleIds }),
    [text, ctx, enabledModuleIds],
  );
  const summary = useMemo(() => summarizeIssues(issues), [issues]);

  const isClean = issues.length === 0;
  const canAiFix = !isClean && !!nodeId && !!onApplyRevised;
  const [aiFix, setAiFix] = useState<AiFixState>({ kind: 'idle' });
  const aiAbortRef = useRef<AbortController | null>(null);

  async function startAiFix() {
    if (!canAiFix || !nodeId) return;
    if (aiFix.kind === 'streaming') return;
    aiAbortRef.current?.abort();
    const ac = new AbortController();
    aiAbortRef.current = ac;
    setAiFix({ kind: 'streaming', previewLen: 0 });
    try {
      const project = useProject.getState();
      const settings = useSettings.getState();
      // 修复仅需 nodeId / title / content / format，其它字段填稳态默认即可。
      const fakeArtifact: NodeArtifact = {
        nodeId,
        stageId: 'novel',
        index: 0,
        title: chapterTitle ?? '章节',
        format: 'markdown',
        content: text,
        durationMs: 0,
        ts: Date.now(),
      };
      let preamble = '';
      try {
        preamble = await buildFixContextPreamble({
          nodeId,
          project: project.ctx,
          artifacts: project.artifacts,
          enableKbInjection: settings.enableKbInjection,
          enableEditorialRounds: settings.enableEditorialRounds,
        });
      } catch (e) {
        console.warn('[ChapterValidationPanel] buildFixContextPreamble 失败，仍继续执行修订：', e);
      }
      const res = await runFixAllIssues({
        artifact: fakeArtifact,
        issues: issues.map(toSelfCheckIssue),
        settings,
        extraSystemPreamble: preamble,
        signal: ac.signal,
        onDelta: (_chunk, full) => {
          if (ac.signal.aborted) return;
          setAiFix({ kind: 'streaming', previewLen: full.length });
        },
      });
      if (ac.signal.aborted) return;
      onApplyRevised?.(res.revised);
      setAiFix({ kind: 'idle' });
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setAiFix({ kind: 'error', msg: e?.message ?? String(e) });
    }
  }

  function cancelAiFix() {
    aiAbortRef.current?.abort();
    setAiFix({ kind: 'idle' });
  }

  return (
    <details
      className="border-t border-zinc-800 bg-zinc-950/40 px-4 py-2 shrink-0"
      open={defaultOpen && !isClean}
    >
      <summary className="cursor-pointer text-xs select-none flex items-center gap-2 hover:text-zinc-100">
        {isClean ? (
          <ShieldCheck className="size-3.5 text-emerald-400" />
        ) : (
          <AlertTriangle className="size-3.5 text-amber-400" />
        )}
        <span className="text-zinc-300">章节自动校验</span>

        {isClean ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            ✓ 无明显问题
          </span>
        ) : (
          <>
            {summary.error > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-300">
                {summary.error} 错误
              </span>
            )}
            {summary.warning > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                {summary.warning} 警告
              </span>
            )}
            {summary.info > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300">
                {summary.info} 提示
              </span>
            )}
          </>
        )}

        <span className="ml-auto text-[10px] text-zinc-500">点击展开 / 收起</span>
      </summary>

      {canAiFix && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {aiFix.kind === 'idle' && (
            <button
              type="button"
              onClick={startAiFix}
              className="text-[11px] px-2 py-1 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 inline-flex items-center gap-1"
              title="把上面所有问题打包交给 LLM，结合题材锚点 / KB / 方法论一键修订；修订结果写回当前章节并入撤销栈"
            >
              <Wand2 className="size-3" /> AI 一键修订（{summary.error + summary.warning} 项）
            </button>
          )}
          {aiFix.kind === 'streaming' && (
            <>
              <span className="text-[11px] inline-flex items-center gap-1 text-violet-200">
                <Loader2 className="size-3 animate-spin" />
                AI 修订中… 已输出 {aiFix.previewLen} 字
              </span>
              <button
                type="button"
                onClick={cancelAiFix}
                className="text-[11px] px-2 py-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 inline-flex items-center gap-1"
              >
                <X className="size-3" /> 取消
              </button>
            </>
          )}
          {aiFix.kind === 'error' && (
            <>
              <span className="text-[11px] text-rose-300">AI 修订失败：{aiFix.msg}</span>
              <button
                type="button"
                onClick={() => setAiFix({ kind: 'idle' })}
                className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-400"
              >
                关闭
              </button>
            </>
          )}
        </div>
      )}

      {!isClean && (
        <div className="mt-2 space-y-1.5">
          {issues.map((it, idx) => {
            const meta = SEVERITY_META[it.severity];
            const Icon = meta.icon;
            return (
              <div
                key={idx}
                className={clsx(
                  'rounded border px-2.5 py-1.5 text-[11px] leading-relaxed',
                  meta.rowClass,
                )}
              >
                <div className="flex items-start gap-1.5">
                  <Icon className="size-3.5 shrink-0 mt-0.5 opacity-80" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={clsx(
                          'text-[9px] px-1 py-0 rounded border',
                          meta.badgeClass,
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[9px] px-1 py-0 rounded border border-zinc-700 text-zinc-400 font-mono">
                        {it.kind}
                      </span>
                      <span className="text-zinc-200">{it.message}</span>
                    </div>
                    {it.evidence && it.evidence.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {it.evidence.map((ev, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1 py-0 rounded bg-zinc-900/70 border border-zinc-700/50 font-mono text-zinc-400 max-w-full truncate"
                            title={ev}
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    )}
                    {it.fixHint && (
                      <div className="text-[10px] text-zinc-400 mt-0.5 italic">
                        » {it.fixHint}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-zinc-500 italic mt-1">
            💡 这是一组纯前端的轻量检查，不调用 LLM。错误通常需要立刻处理；警告 / 提示可结合调性自行取舍。
          </p>
        </div>
      )}
    </details>
  );
}
