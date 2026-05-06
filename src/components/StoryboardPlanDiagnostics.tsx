// storyboard.1 (Phase A-D) 解析诊断面板
// 在 storyboard.1 跑完后展示：解析来源徽标 / 单元数 / 戏份分布 / 时长合计 vs 目标 /
// 警告列表。让用户在跑 storyboard.2 前一眼看出"是否对齐"。

import { useMemo } from 'react';
import {
  CheckCircle2, AlertTriangle, AlertCircle, Database, FileText, Clock, Layers,
} from 'lucide-react';
import clsx from 'clsx';
import {
  parseStoryboardPlan,
  normalizeSceneType,
  SCENE_TYPES,
  type SceneType,
  type ParsedPlan,
} from '../pipeline/storyboardPlan';
import type { NodeArtifact } from '../pipeline/types';

interface Props {
  /** storyboard.1 artifact；undefined 时不渲染 */
  artifact?: NodeArtifact;
  /** 目标总时长（秒），来自 ProjectContext.durationMin × 60；用于偏差对比 */
  targetDurationSec?: number;
  /** 紧凑模式（在 Pipeline 等空间紧的位置使用） */
  compact?: boolean;
}

const SCENE_TYPE_COLORS: Record<SceneType, string> = {
  '文戏':    'bg-sky-500',
  '快文戏':  'bg-cyan-500',
  '武戏':    'bg-rose-500',
  '动作非武': 'bg-amber-500',
  '环境':    'bg-emerald-500',
};

const SCENE_TYPE_TEXT: Record<SceneType, string> = {
  '文戏':    'text-sky-300',
  '快文戏':  'text-cyan-300',
  '武戏':    'text-rose-300',
  '动作非武': 'text-amber-300',
  '环境':    'text-emerald-300',
};

export function StoryboardPlanDiagnostics({ artifact, targetDurationSec, compact }: Props) {
  const plan = useMemo<ParsedPlan | null>(() => {
    if (!artifact) return null;
    try { return parseStoryboardPlan(artifact.content); }
    catch { return null; }
  }, [artifact?.content]);

  if (!plan) return null;

  const totalUnits = plan.units.length;
  const totalDuration = plan.units.reduce((s, u) => s + (u.durationSec || 0), 0);
  const target = targetDurationSec ?? plan.meta.totalSec;
  const driftPct = target ? Math.round(((totalDuration - target) / target) * 100) : 0;
  const driftSeverity: 'ok' | 'warn' | 'bad' =
    !target ? 'ok'
    : Math.abs(driftPct) <= 15 ? 'ok'
    : Math.abs(driftPct) <= 30 ? 'warn'
    : 'bad';

  // 戏份分布
  const sceneCount: Record<string, number> = {};
  let unknownCount = 0;
  for (const u of plan.units) {
    const t = normalizeSceneType(u.sceneType);
    if (t) sceneCount[t] = (sceneCount[t] ?? 0) + 1;
    else unknownCount += 1;
  }
  const distribution = SCENE_TYPES
    .map((t) => ({ type: t, count: sceneCount[t] ?? 0 }))
    .filter((d) => d.count > 0);

  const warnings = plan.warnings ?? [];
  const warnSeverity: 'ok' | 'warn' | 'bad' =
    warnings.length === 0 ? 'ok'
    : warnings.some((w) => /缺 sectionRefs|未声明/.test(w)) ? 'bad'
    : 'warn';

  return (
    <div
      className={clsx(
        'card p-3.5 border-zinc-800 space-y-3',
        warnSeverity === 'bad' && 'border-rose-500/40 bg-rose-500/5',
        warnSeverity === 'warn' && 'border-amber-500/30 bg-amber-500/5',
        warnSeverity === 'ok' && plan.source === 'json' && 'border-emerald-500/20 bg-emerald-500/[0.03]',
      )}
    >
      {/* 顶部：来源徽标 + 关键指标 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <SourceBadge source={plan.source} />
          <Stat icon={<Layers className="size-3.5" />} label="单元" value={String(totalUnits)} />
          <Stat
            icon={<Clock className="size-3.5" />}
            label="时长"
            value={
              target
                ? `${totalDuration}s / ${target}s · ${driftPct >= 0 ? '+' : ''}${driftPct}%`
                : `${totalDuration}s`
            }
            severity={driftSeverity}
          />
          {plan.paragraphs.size > 0 && (
            <Stat icon={<FileText className="size-3.5" />} label="段" value={String(plan.paragraphs.size)} />
          )}
          {plan.peaks.length > 0 && (
            <Stat icon={<AlertCircle className="size-3.5" />} label="峰" value={String(plan.peaks.length)} />
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">
          {warnings.length > 0 ? `${warnings.length} 警告` : '无警告'}
        </span>
      </div>

      {/* 戏份分布 */}
      {distribution.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span>戏份分布</span>
            {unknownCount > 0 && (
              <span className="text-amber-400">⚠ {unknownCount} 个 sceneType 不在标准枚举</span>
            )}
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
            {distribution.map((d) => (
              <div
                key={d.type}
                className={clsx(SCENE_TYPE_COLORS[d.type], 'transition-all')}
                style={{ width: `${(d.count / totalUnits) * 100}%` }}
                title={`${d.type}: ${d.count} 单元`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px]">
            {distribution.map((d) => (
              <span key={d.type} className={clsx('inline-flex items-center gap-1', SCENE_TYPE_TEXT[d.type])}>
                <span className={clsx('inline-block size-2 rounded-sm', SCENE_TYPE_COLORS[d.type])} />
                {d.type} <span className="text-zinc-500">{d.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 警告列表 */}
      {warnings.length > 0 && !compact && (
        <details className="text-[11px]" open={warnSeverity === 'bad'}>
          <summary
            className={clsx(
              'cursor-pointer select-none inline-flex items-center gap-1 font-medium',
              warnSeverity === 'bad' ? 'text-rose-300' : 'text-amber-300',
            )}
          >
            {warnSeverity === 'bad'
              ? <AlertCircle className="size-3.5" />
              : <AlertTriangle className="size-3.5" />}
            {warnSeverity === 'bad' ? '关键问题（建议先修复再跑分镜.2）' : '提示（不阻断）'} · {warnings.length}
          </summary>
          <ul className="mt-1.5 space-y-0.5 ml-4 text-zinc-400 list-disc">
            {warnings.slice(0, 12).map((w, i) => (
              <li key={i} className={/缺 sectionRefs|未声明/.test(w) ? 'text-rose-400' : ''}>
                {w}
              </li>
            ))}
            {warnings.length > 12 && (
              <li className="text-zinc-600">…还有 {warnings.length - 12} 条（详见浏览器 Console）</li>
            )}
          </ul>
        </details>
      )}
      {warnings.length > 0 && compact && (
        <div className={clsx('text-[10px] flex items-center gap-1', warnSeverity === 'bad' ? 'text-rose-400' : 'text-amber-400')}>
          {warnSeverity === 'bad' ? <AlertCircle className="size-3" /> : <AlertTriangle className="size-3" />}
          {warnings.length} 条诊断（展开 storyboard.1 节点查看）
        </div>
      )}
    </div>
  );
}

/* ── 子组件 ──────────────────────────────────────────────────────── */

function SourceBadge({ source }: { source?: 'json' | 'markdown' }) {
  if (source === 'json') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-medium">
        <Database className="size-3" /> JSON 结构化
      </span>
    );
  }
  if (source === 'markdown') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-300 bg-amber-500/10 font-medium" title="storyboard.1 未输出 <plan-json> 块；建议重跑">
        <AlertTriangle className="size-3" /> Markdown 兜底
      </span>
    );
  }
  return null;
}

function Stat(p: {
  icon: React.ReactNode;
  label: string;
  value: string;
  severity?: 'ok' | 'warn' | 'bad';
}) {
  const tone =
    p.severity === 'bad' ? 'text-rose-300'
    : p.severity === 'warn' ? 'text-amber-300'
    : 'text-zinc-200';
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
      {p.icon}
      <span>{p.label}</span>
      <span className={clsx('font-mono', tone)}>{p.value}</span>
    </span>
  );
}

/** 紧凑外层徽标版：仅 source + 单元数 + 警告数；用于卡片角标 */
export function StoryboardPlanBadge({ artifact }: { artifact?: NodeArtifact }) {
  const plan = useMemo(() => {
    if (!artifact) return null;
    try { return parseStoryboardPlan(artifact.content); } catch { return null; }
  }, [artifact?.content]);
  if (!plan) return null;
  const wlen = plan.warnings?.length ?? 0;
  const hasCritical = (plan.warnings ?? []).some((w) => /缺 sectionRefs|未声明/.test(w));
  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <SourceBadge source={plan.source} />
      <span className="text-zinc-500">{plan.units.length} 单元</span>
      {wlen > 0 && (
        <span className={clsx('flex items-center gap-0.5', hasCritical ? 'text-rose-400' : 'text-amber-400')}>
          {hasCritical ? <AlertCircle className="size-3" /> : <AlertTriangle className="size-3" />}
          {wlen}
        </span>
      )}
      {wlen === 0 && plan.source === 'json' && (
        <CheckCircle2 className="size-3 text-emerald-400" />
      )}
    </span>
  );
}
