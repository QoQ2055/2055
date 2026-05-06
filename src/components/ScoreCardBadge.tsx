// ScoreCardBadge · v2 阶段 2.9
//
// 紧凑横条 + 展开抽屉 + 5 次历史 sparkline。
// 输入 artifact.meta.scoreCard / scoreCardHistory 与父级触发评分回调。
// 数据/算法在 src/pipeline/scoreCard.ts；本组件只做展示与触发。

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ChevronDown, ChevronUp, RefreshCw, Loader2, Gauge,
  TrendingUp, TrendingDown, Minus, AlertTriangle, AlertOctagon, Info,
} from 'lucide-react';
import {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_LABELS,
  SCORE_DIMENSION_LONG_LABELS,
  scoreCardDelta,
  type ScoreCard,
  type ScoreDimension,
  type DimensionScore,
} from '../pipeline/scoreCard';

interface Props {
  /** 当前评分（artifact.meta.scoreCard） */
  card?: ScoreCard;
  /** 上一次评分（用于 delta；artifact.meta.scoreCardHistory 末尾） */
  previous?: ScoreCard;
  /** 历史栈（最近 N 次，用于 sparkline；不含当前 card） */
  history?: ScoreCard[];
  /** 重新评分；不传则不显示重算按钮 */
  onRecompute?: (opts: { skipLlm?: boolean }) => Promise<void> | void;
  /** 评分进行中（外部状态） */
  busy?: boolean;
  /** 紧凑模式默认折叠 */
  defaultOpen?: boolean;
  /** 错误信息（评分失败时） */
  error?: string;
}

function scoreColor(score: number): { fg: string; bg: string; border: string } {
  if (score >= 85) return { fg: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40' };
  if (score >= 70) return { fg: 'text-sky-300',     bg: 'bg-sky-500/15',     border: 'border-sky-500/40' };
  if (score >= 55) return { fg: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/40' };
  return                  { fg: 'text-rose-300',    bg: 'bg-rose-500/15',    border: 'border-rose-500/40' };
}

function deltaIcon(delta?: number) {
  if (delta == null || Math.abs(delta) < 1) return <Minus className="size-3 text-zinc-500" />;
  if (delta > 0) return <TrendingUp className="size-3 text-emerald-400" />;
  return <TrendingDown className="size-3 text-rose-400" />;
}

function deltaText(delta?: number): string {
  if (delta == null || Math.abs(delta) < 1) return '';
  return delta > 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`;
}

function severityIcon(sev: 'major' | 'minor' | 'info') {
  if (sev === 'major') return <AlertOctagon className="size-3 text-rose-400" />;
  if (sev === 'minor') return <AlertTriangle className="size-3 text-amber-400" />;
  return <Info className="size-3 text-blue-400" />;
}

/** 6 维子分迷你横条 */
function MiniDimBar({
  d, ds, delta,
}: { d: ScoreDimension; ds: DimensionScore; delta?: number }) {
  const c = scoreColor(ds.score);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px]',
        c.border, c.bg,
      )}
      title={`${SCORE_DIMENSION_LONG_LABELS[d]}：${ds.score}${ds.inactive ? '（不适用）' : ''}${delta != null && Math.abs(delta) >= 1 ? ` · 变化 ${deltaText(delta)}` : ''}`}
    >
      <span className="text-zinc-400">{SCORE_DIMENSION_LABELS[d]}</span>
      <span className={clsx('font-mono', ds.inactive ? 'text-zinc-500' : c.fg)}>
        {ds.inactive ? '—' : ds.score}
      </span>
      {!ds.inactive && delta != null && Math.abs(delta) >= 1 && (
        <span className={clsx('font-mono', delta > 0 ? 'text-emerald-300' : 'text-rose-300')}>
          {deltaText(delta)}
        </span>
      )}
    </span>
  );
}

/** 历史 sparkline（≤ 5 个点，纯 SVG） */
function SparkLine({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const w = 80, h = 18;
  const max = Math.max(100, ...scores);
  const min = Math.min(0, ...scores);
  const range = max - min || 1;
  const stepX = w / (scores.length - 1);
  const points = scores
    .map((s, i) => `${i * stepX},${h - ((s - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {scores.map((s, i) => (
        <circle key={i} cx={i * stepX} cy={h - ((s - min) / range) * h} r="1.5" fill="currentColor" />
      ))}
    </svg>
  );
}

/** 单维度详情卡（抽屉展开后） */
function DimensionDetail({
  d, ds, delta,
}: { d: ScoreDimension; ds: DimensionScore; delta?: number }) {
  const c = scoreColor(ds.score);
  return (
    <div className={clsx('rounded border px-2.5 py-1.5', c.border, c.bg)}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-medium text-zinc-200">{SCORE_DIMENSION_LONG_LABELS[d]}</span>
        <span className={clsx('font-mono', c.fg)}>
          {ds.inactive ? '—' : ds.score}
        </span>
        {!ds.inactive && delta != null && Math.abs(delta) >= 1 && (
          <span className={clsx('font-mono text-[11px] inline-flex items-center gap-0.5',
            delta > 0 ? 'text-emerald-300' : 'text-rose-300')}>
            {deltaIcon(delta)} {deltaText(delta)}
          </span>
        )}
        {ds.inactive && (
          <span className="text-[10px] text-zinc-500">（不适用 / 无数据）</span>
        )}
      </div>
      {ds.summary && (
        <div className="mt-1 text-[11px] text-zinc-400">{ds.summary}</div>
      )}
      {ds.issues.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {ds.issues.map((iss, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
              <span className="mt-0.5">{severityIcon(iss.severity)}</span>
              <div className="flex-1 min-w-0">
                <div>
                  {iss.message}
                  <span className="ml-2 text-[10px] text-zinc-500 font-mono">−{iss.penalty}</span>
                </div>
                {iss.evidence && iss.evidence.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {iss.evidence.map((ev, j) => (
                      <span key={j} className="text-[10px] px-1 py-0 rounded bg-zinc-900/70 border border-zinc-700/50 font-mono text-zinc-400 max-w-full truncate" title={ev}>
                        {ev}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScoreCardBadge({
  card, previous, history, onRecompute, busy, defaultOpen = false, error,
}: Props) {
  const [expanded, setExpanded] = useState(defaultOpen);

  const delta = useMemo(() => scoreCardDelta(card!, previous), [card, previous]);
  const totalC = card ? scoreColor(card.total) : null;

  // sparkline 数据：history(旧 → 新) + previous + current
  const sparkData = useMemo(() => {
    const arr: number[] = [];
    if (history) arr.push(...history.map((h) => h.total));
    if (previous && (history?.length ?? 0) === 0) arr.push(previous.total);
    if (card) arr.push(card.total);
    return arr;
  }, [card, previous, history]);

  if (!card) {
    // 没评分过：只显示一个触发按钮
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900/30 px-3 py-1.5 flex items-center gap-2 text-[11px]">
        <Gauge className="size-3.5 text-zinc-500" />
        <span className="text-zinc-400">尚未评分</span>
        {onRecompute && (
          <button
            type="button"
            onClick={() => onRecompute({})}
            disabled={busy}
            className="ml-auto text-[11px] px-2 py-0.5 rounded border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 inline-flex items-center gap-1 disabled:opacity-50"
            title="计算评分（含 LLM 维度）"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Gauge className="size-3" />}
            计算评分
          </button>
        )}
        {error && (
          <span className="text-[11px] text-rose-300 ml-2">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(
      'rounded-md border px-3 py-2 space-y-2',
      totalC?.border, totalC?.bg,
    )}>
      {/* ── 紧凑横条 ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Gauge className={clsx('size-4', totalC?.fg)} />
        <span className="text-[12px] font-medium text-zinc-200">综合评分</span>
        <span className={clsx('text-[18px] font-mono font-bold', totalC?.fg)}>
          {card.total}
        </span>
        <span className="text-[11px] text-zinc-500">/ 100</span>

        {delta.total != null && Math.abs(delta.total) >= 1 && (
          <span className={clsx(
            'text-[11px] font-mono inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
            delta.total > 0
              ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
              : 'text-rose-300 bg-rose-500/10 border border-rose-500/30',
          )}>
            {deltaIcon(delta.total)} {deltaText(delta.total)}
            <span className="text-zinc-500 ml-1">vs 上次</span>
          </span>
        )}

        {!card.llmEvaluated && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/50 text-zinc-400">
            仅前 4 维（LLM 待评）
          </span>
        )}

        {sparkData.length >= 2 && (
          <span className="text-zinc-500" title={`最近 ${sparkData.length} 次评分轨迹`}>
            <SparkLine scores={sparkData} />
          </span>
        )}

        <span className="ml-auto inline-flex items-center gap-1">
          {onRecompute && (
            <button
              type="button"
              onClick={() => onRecompute({})}
              disabled={busy}
              className="text-[11px] px-1.5 py-0.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-300 inline-flex items-center gap-1 disabled:opacity-50"
              title="重新评分（含 LLM 维度）"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              重算
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] px-1.5 py-0.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-400 inline-flex items-center gap-1"
            title={expanded ? '折叠' : '展开详情'}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? '收起' : '详情'}
          </button>
        </span>
      </div>

      {/* ── 6 维迷你子分（始终显示） ────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SCORE_DIMENSIONS.map((d) => (
          <MiniDimBar
            key={d}
            d={d}
            ds={card.dimensions[d]}
            delta={delta.byDimension[d]}
          />
        ))}
      </div>

      {/* ── 错误提示 ──────────────────────────────────────── */}
      {error && (
        <div className="text-[11px] text-rose-300 px-2 py-1 rounded bg-rose-500/5 border border-rose-500/30">
          {error}
        </div>
      )}

      {/* ── 展开抽屉：每维度详情 ─────────────────────────── */}
      {expanded && (
        <div className="pt-1 space-y-1.5">
          {SCORE_DIMENSIONS.map((d) => (
            <DimensionDetail
              key={d}
              d={d}
              ds={card.dimensions[d]}
              delta={delta.byDimension[d]}
            />
          ))}
          <div className="text-[10px] text-zinc-500 italic mt-1">
            综合分 = 6 维加权平均（默认等权）。延后维度 = 不计入分母。前 4 维纯前端规则；R1 / 风格由 LLM 评判，未配置数据时显示「不适用」。
          </div>
        </div>
      )}
    </div>
  );
}
