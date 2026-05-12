// PR-G · Phase 1 step 5/5 · Tool-call status bar.
//
// Lightweight always-mountable strip that surfaces the active tool-call loop
// from `useToolCallLog`. When idle (no active runId) the component renders
// nothing — zero visual cost. While a run is active it shows:
//   - current round number
//   - total / failed dispatches
//   - last entry's name + ok/error indicator
//
// Design constraints:
//   - No hard dependency on a specific stage / page; can be mounted globally.
//   - Pure read-only; no actions (kill / cancel UI is owned by the runner).
//   - Tailwind classes only (consistent with the rest of fili-web).
//   - Accessible: role="status" + aria-live="polite".

import { useToolCallLog, selectToolCallSummary } from '../store/toolCallLog';

export interface ToolCallStatusBarProps {
  /** When provided, hides the bar even if a run is active. */
  hidden?: boolean;
  /** Tailwind class overrides for the outer wrapper. */
  className?: string;
}

export function ToolCallStatusBar({ hidden, className }: ToolCallStatusBarProps) {
  const summary = useToolCallLog(selectToolCallSummary);

  if (hidden || !summary.active) return null;

  const lastOk = summary.lastEntry?.ok ?? true;
  const lastName = summary.lastEntry?.name ?? '–';
  const lastMsg = summary.lastEntry?.message;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        'flex items-center gap-3 rounded-md border bg-slate-50 px-3 py-1.5 text-xs text-slate-700 ' +
        'dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 ' +
        (className ?? '')
      }
      data-testid="tool-call-status-bar"
    >
      <span
        className={
          'inline-block h-2 w-2 rounded-full ' +
          (lastOk ? 'bg-emerald-500' : 'bg-rose-500') +
          ' animate-pulse'
        }
        aria-hidden="true"
      />
      <span className="font-medium">工具调用</span>
      <span className="opacity-70">·</span>
      <span>
        第 <strong>{summary.round || 1}</strong> 轮
      </span>
      <span className="opacity-70">·</span>
      <span>
        共 <strong>{summary.totalCalls}</strong> 次
        {summary.failedCalls > 0 ? (
          <span className="text-rose-600 dark:text-rose-400">
            （{summary.failedCalls} 失败）
          </span>
        ) : null}
      </span>
      {summary.lastEntry ? (
        <>
          <span className="opacity-70">·</span>
          <span className="truncate max-w-xs" title={lastMsg ?? lastName}>
            最近：<code className="font-mono text-[11px]">{lastName}</code>
            {!lastOk && lastMsg ? (
              <span className="ml-1 text-rose-600 dark:text-rose-400">— {lastMsg}</span>
            ) : null}
          </span>
        </>
      ) : null}
    </div>
  );
}

export default ToolCallStatusBar;
