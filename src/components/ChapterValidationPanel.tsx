/**
 * 章节自动校验面板（v2 阶段 2.4）
 *
 * 在 Novel 页 PreviewModal 的章节预览场景下使用。
 * 输入：章节正文 + ProjectContext + 已启用模块 id。
 * 输出：可折叠的问题清单，按 severity 分组配色。
 *
 * 依赖纯前端规则（src/pipeline/chapterValidation.ts），不调用 LLM。
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import { ShieldCheck, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import {
  validateChapter,
  summarizeIssues,
  type ValidationIssue,
  type ValidationSeverity,
} from '../pipeline/chapterValidation';
import type { ProjectContext } from '../pipeline/types';

interface Props {
  /** 章节正文 */
  text: string;
  ctx?: Partial<ProjectContext>;
  enabledModuleIds?: string[];
  /** 默认展开（章节预览场景默认 true） */
  defaultOpen?: boolean;
}

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
}: Props) {
  const issues = useMemo(
    () => validateChapter({ text, ctx, enabledModuleIds }),
    [text, ctx, enabledModuleIds],
  );
  const summary = useMemo(() => summarizeIssues(issues), [issues]);

  const isClean = issues.length === 0;

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
