// Run history viewer. Reads from IDB `runHistory` table populated by
// runStep / runR1Directive / runR9Verdict and the storyboard.2 unit loop.
//
// Two display modes:
//   • full         — most-recent N runs across the whole active project
//   • node-scoped  — only runs for a specific nodeId (used inside StepRow)

import { useEffect, useMemo, useState } from 'react';
import {
  History, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, Copy, Trash2,
} from 'lucide-react';
import {
  listRecentRuns, listRunsForNode, clearRunHistoryForProject,
  type RunRecord,
} from '../store/db';

export interface RunHistoryPanelProps {
  /** When provided, scope to this node only */
  nodeId?: string;
  /** Title override */
  title?: string;
  /** Default expanded state (default false for full mode, true for node-scoped) */
  defaultExpanded?: boolean;
  /** How many records to show */
  limit?: number;
}

export function RunHistoryPanel({
  nodeId, title, defaultExpanded, limit = 30,
}: RunHistoryPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? !!nodeId);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setBusy(true);
    (nodeId
      ? listRunsForNode(nodeId, { limit, projectId: 0 })
      : listRecentRuns({ limit, projectId: 0 })
    )
      .then((rows) => { if (live) setRecords(rows); })
      .catch((e) => console.warn('[runHistory] fetch failed:', e))
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [nodeId, limit, tick]);

  const stats = useMemo(() => summarize(records), [records]);

  return (
    <div className="card border border-border-subtle bg-canvas/40">
      <header
        className="px-3 py-2 flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-3.5 text-fg-muted" /> : <ChevronRight className="size-3.5 text-fg-muted" />}
        <History className="size-4 text-primary-400" />
        <span className="text-sm font-medium">
          {title ?? (nodeId ? `运行历史 · ${nodeId}` : '运行历史')}
        </span>
        <span className="text-xs text-fg-muted ml-1">
          {records.length === 0 ? '暂无' : (
            <>
              {records.length} 条 · 成功 {stats.done} · 错误 {stats.error}
              {stats.aborted > 0 && <> · 中止 {stats.aborted}</>}
              {stats.tokens > 0 && <> · {formatTokens(stats.tokens)} tk</>}
              {stats.cost > 0 && <> · ${stats.cost.toFixed(3)}</>}
            </>
          )}
        </span>
        <div className="flex-1" />
        <button
          className="btn-ghost px-2 py-1 text-xs"
          onClick={(e) => { e.stopPropagation(); setTick((t) => t + 1); }}
          title="刷新"
          disabled={busy}
        >
          <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
        </button>
        {!nodeId && records.length > 0 && (
          <button
            className="btn-ghost px-2 py-1 text-xs hover:text-danger"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm('清空当前项目的全部运行历史？此操作不可撤销。')) return;
              await clearRunHistoryForProject(0);
              setTick((t) => t + 1);
            }}
            title="清空当前项目历史"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </header>

      {expanded && (
        <div className="px-3 pb-3">
          {records.length === 0 ? (
            <div className="text-xs text-fg-muted py-2">尚未有运行记录</div>
          ) : (
            <ul className="space-y-1">
              {records.map((r) => (
                <RecordRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────── */

function summarize(records: RunRecord[]) {
  let done = 0, error = 0, aborted = 0;
  let tokens = 0, cost = 0;
  for (const r of records) {
    if (r.status === 'done') done++;
    else if (r.status === 'error') error++;
    else if (r.status === 'aborted') aborted++;
    if (r.tokens) tokens += r.tokens;
    if (r.cost) cost += r.cost;
  }
  return { done, error, aborted, tokens, cost };
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

function RecordRow({ r }: { r: RunRecord }) {
  const [open, setOpen] = useState(false);
  const Icon =
    r.status === 'done' ? CheckCircle2 :
    r.status === 'aborted' ? MinusCircle : XCircle;
  const tone =
    r.status === 'done' ? 'text-success' :
    r.status === 'aborted' ? 'text-fg-muted' : 'text-danger';
  const bg =
    r.status === 'done' ? 'border-border-subtle bg-surface/30' :
    r.status === 'aborted' ? 'border-border-subtle bg-surface/30' :
    'border-danger/30 bg-danger/5';
  return (
    <li className={`text-xs rounded border ${bg}`}>
      <div
        className="px-2 py-1.5 flex items-center gap-2 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className={`size-3.5 ${tone}`} />
        <span className="font-mono text-fg-secondary">{r.nodeId}</span>
        {r.unitIndex != null && <span className="text-fg-muted">UNIT {r.unitIndex}</span>}
        {r.title && <span className="text-fg-muted truncate">· {r.title}</span>}
        <div className="flex-1" />
        <span className="text-fg-muted">{formatTime(r.ts)}</span>
        <span className="text-fg-muted">{formatDuration(r.durationMs)}</span>
        {r.tokens != null && <span className="text-fg-muted">{formatTokens(r.tokens)} tk</span>}
        {r.cost != null && r.cost > 0 && <span className="text-fg-muted">${r.cost.toFixed(3)}</span>}
      </div>
      {open && (
        <div className="px-2 pb-2 border-t border-border-subtle text-[11px] space-y-1.5 bg-canvas/40">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-fg-secondary pt-2">
            <span>stage: <span className="text-fg-secondary">{r.stageId}</span></span>
            <span>step: <span className="text-fg-secondary">{r.stepIndex}</span></span>
            {r.model && <span>model: <span className="text-fg-secondary">{r.model}</span></span>}
            {r.temperature != null && <span>temp: <span className="text-fg-secondary">{r.temperature}</span></span>}
            {r.contentLength != null && <span>chars: <span className="text-fg-secondary">{r.contentLength}</span></span>}
            <span>id: <span className="text-fg-secondary">#{r.id}</span></span>
          </div>
          {r.error && (
            <div className="text-danger leading-relaxed">
              <span className="text-danger">error: </span>{r.error}
            </div>
          )}
          {r.contentSnapshot && (
            <details>
              <summary className="cursor-pointer text-fg-secondary hover:text-fg-primary">
                输出预览（前 4KB）
                <button
                  className="ml-2 text-fg-muted hover:text-fg-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(r.contentSnapshot ?? '');
                  }}
                  title="复制"
                >
                  <Copy className="inline size-3" />
                </button>
              </summary>
              <pre className="mt-1 p-2 bg-black/40 rounded text-fg-secondary max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono">
                {r.contentSnapshot}
              </pre>
            </details>
          )}
        </div>
      )}
    </li>
  );
}
