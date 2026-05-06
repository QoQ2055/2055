// Asset ↔ storyboard consistency panel.
// Pure static report (no LLM call); shows unknown names, unmentioned assets,
// per-unit mention map. Re-evaluates on demand or whenever artifacts change.

import { useMemo, useState } from 'react';
import {
  Network, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import {
  buildConsistencyReport,
  type ConsistencyReport,
  type ConsistencyIssue,
  type EntityKind,
} from '../pipeline/consistencyCheck';
import type { ArtifactMap } from '../pipeline/types';

export interface ConsistencyPanelProps {
  artifacts: ArtifactMap;
}

export function ConsistencyPanel({ artifacts }: ConsistencyPanelProps) {
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // 用 tick 强制重新计算（持久化结果不必，廉价）
  const report = useMemo<ConsistencyReport>(
    () => buildConsistencyReport({ artifacts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artifacts, tick],
  );

  const blocking = report.issues.filter((i) => i.severity !== 'info');
  const infos = report.issues.filter((i) => i.severity === 'info');
  const visible = showInfo ? report.issues : blocking;

  const tone =
    report.verdict === 'pass' ? 'border-success/30'
    : report.verdict === 'warn' ? 'border-warning/40'
    : 'border-danger/40';

  return (
    <div className={`card border ${tone} bg-canvas/40`}>
      <header
        className="px-3 py-2 flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="size-3.5 text-fg-muted" /> : <ChevronRight className="size-3.5 text-fg-muted" />}
        <Network className="size-4 text-primary-400" />
        <span className="text-sm font-medium">资产 ↔ 分镜 一致性</span>
        <VerdictBadge v={report.verdict} />
        <span className="text-xs text-fg-muted ml-1">
          · {blocking.length} 项问题
          {infos.length > 0 && <> · {infos.length} 项提示</>}
        </span>
        <div className="flex-1" />
        <button
          className="btn-ghost px-2 py-1 text-xs"
          onClick={(e) => { e.stopPropagation(); setTick((t) => t + 1); }}
          title="重新校验"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </header>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-xs text-fg-secondary leading-relaxed">{report.summary}</div>

          {/* 三类计数条 */}
          <div className="flex flex-wrap gap-1.5 text-tight-sm">
            <KindChip kind="character" count={report.assetCount.character} />
            <KindChip kind="scene" count={report.assetCount.scene} />
            <KindChip kind="prop" count={report.assetCount.prop} />
            <span className="text-fg-muted">|</span>
            <span className="text-fg-muted">分镜 {report.storyboardUnits} unit</span>
          </div>

          {visible.length === 0 ? (
            <div className="text-xs text-success flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> 所有提及均能在资产中找到，无未登记角色
            </div>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((issue, idx) => (
                <IssueRow key={idx} issue={issue} />
              ))}
            </ul>
          )}

          {infos.length > 0 && (
            <button
              className="text-tight-sm text-fg-muted hover:text-fg-secondary underline-offset-2 hover:underline"
              onClick={() => setShowInfo((v) => !v)}
            >
              {showInfo ? '隐藏' : '显示'} {infos.length} 项 info（未被分镜引用的资产）
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────── */

function VerdictBadge({ v }: { v: ConsistencyReport['verdict'] }) {
  const map = {
    pass: 'bg-success/15 text-success border-success/30',
    warn: 'bg-warning/15 text-warning border-warning/30',
    fail: 'bg-danger/15 text-danger border-danger/30',
  } as const;
  return (
    <span className={`text-tight-xs px-1.5 py-0.5 rounded border font-bold uppercase ${map[v]}`}>
      {v}
    </span>
  );
}

function KindChip({ kind, count }: { kind: EntityKind; count: number }) {
  const label = kind === 'character' ? '角色' : kind === 'scene' ? '场景' : '道具';
  return (
    <span className={`px-1.5 py-0.5 rounded border ${count === 0 ? 'border-border-default text-fg-muted' : 'border-border-default text-fg-secondary'}`}>
      {label} {count}
    </span>
  );
}

function IssueRow({ issue }: { issue: ConsistencyIssue }) {
  const sevStyle =
    issue.severity === 'critical' ? 'border-danger/40 bg-danger/5' :
    issue.severity === 'major' ? 'border-warning/40 bg-warning/5' :
    issue.severity === 'minor' ? 'border-border-default bg-surface/40' :
    'border-border-subtle bg-canvas/40';
  const sevText =
    issue.severity === 'critical' ? 'text-danger' :
    issue.severity === 'major' ? 'text-warning' :
    issue.severity === 'minor' ? 'text-fg-secondary' : 'text-fg-muted';
  const Icon =
    issue.severity === 'info' ? Info :
    issue.severity === 'critical' ? AlertTriangle : AlertTriangle;
  const kindLabel =
    issue.entityKind === 'character' ? '角色' :
    issue.entityKind === 'scene' ? '场景' : '道具';
  return (
    <li className={`text-xs rounded px-2 py-1.5 border ${sevStyle}`}>
      <div className="flex items-center gap-2">
        <Icon className={`size-3.5 ${sevText}`} />
        <span className={`text-tight-xs uppercase font-bold ${sevText}`}>{issue.severity}</span>
        <span className="text-fg-muted text-tight-xs">{kindLabel}</span>
        <span className="font-medium text-fg-primary">「{issue.name}」</span>
        {issue.unitIndex != null && (
          <span className="text-fg-muted text-tight-xs">@ UNIT {issue.unitIndex}{issue.count && issue.count > 1 ? ` ×${issue.count}` : ''}</span>
        )}
      </div>
      <div className="mt-1 text-fg-secondary leading-relaxed">{issue.detail}</div>
      {issue.suggestion && (
        <div className="mt-1 text-fg-secondary">
          <span className="text-fg-muted">建议: </span>{issue.suggestion}
        </div>
      )}
    </li>
  );
}
