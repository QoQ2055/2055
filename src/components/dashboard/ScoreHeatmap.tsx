// ScoreHeatmap · gap-d FR-4
// 评分卡热力图 · 行 = 评分维度，列 = 章节序号 · 纯 view (CK I-5)
//
// 颜色映射 (CA §3.5)：
//   null → 灰  / score < 0.6 → 红→黄  / 0.6-0.85 → 黄→绿  / ≥ 0.85 → 绿→深绿
//
// 维度自适应行高 (CA §0.5 Q3)：维度 ≤ 6 → 32px / > 6 → 24px
// 章节 > 30 → 启用 overflow-x-auto

import clsx from 'clsx';
import type { ChapterAggregate, ScoreCardMatrix } from '../../store/projectAggregates';

const CELL_W = 32;
const SCROLL_THRESHOLD = 30;

export interface ScoreHeatmapProps {
  matrix: ScoreCardMatrix | null;
  chapters: ChapterAggregate[];
  onCellClick(chapterIndex: number, dimensionIdx: number): void;
}

function scoreToColor(score: number | null): string {
  if (score === null) return 'rgb(229 231 235)'; // slate-200
  const s = Math.max(0, Math.min(1, score));
  if (s < 0.6) {
    // 红 → 黄
    const t = s / 0.6;
    return `rgb(252, ${Math.round(165 + t * 90)}, 165)`;
  }
  if (s < 0.85) {
    // 黄 → 绿
    const t = (s - 0.6) / 0.25;
    return `rgb(${Math.round(252 - t * 178)}, ${Math.round(211 + t * 11)}, ${Math.round(77 + t * 51)})`;
  }
  // 绿 → 深绿
  const t = (s - 0.85) / 0.15;
  return `rgb(${Math.round(74 - t * 30)}, ${Math.round(222 - t * 30)}, ${Math.round(128 - t * 28)})`;
}

export function ScoreHeatmap(props: ScoreHeatmapProps) {
  const { matrix, chapters, onCellClick } = props;

  if (!matrix || matrix.dimensions.length === 0 || chapters.length === 0) {
    return (
      <div className="text-sm text-slate-400 px-2 py-3" aria-label="评分卡热力图 · 暂无数据">
        暂无评分卡数据（在章节预览面板里跑评分卡后会显示）
      </div>
    );
  }

  const cellH = matrix.dimensions.length > 6 ? 24 : 32;
  const overflowX = chapters.length > SCROLL_THRESHOLD;
  const totalW = CELL_W * chapters.length;
  const totalH = cellH * matrix.dimensions.length;

  return (
    <div
      className={clsx('flex gap-2', overflowX && 'overflow-x-auto')}
      role="region"
      aria-label={`评分卡热力图 · ${matrix.dimensions.length} 维度 · ${chapters.length} 章节`}
    >
      {/* 维度标签列 */}
      <div className="flex flex-col text-[10px] text-slate-500 select-none" style={{ paddingTop: 0 }}>
        {matrix.dimensions.map((dim) => (
          <div
            key={dim}
            className="flex items-center pr-1 truncate"
            style={{ height: cellH, lineHeight: cellH + 'px' }}
            title={dim}
          >
            {dim}
          </div>
        ))}
      </div>
      {/* 矩阵 SVG */}
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width={totalW}
        height={totalH}
        className="flex-shrink-0"
      >
        {matrix.dimensions.map((dim, dIdx) =>
          chapters.map((c, cIdx) => {
            const score = matrix.values[cIdx]?.[dIdx] ?? null;
            const issues = matrix.issueLists[cIdx]?.[dIdx] ?? null;
            const tip =
              `第 ${c.chapterIndex} 章 · ${dim} · 评分 ${score !== null ? score.toFixed(2) : '—'}` +
              (issues && issues.length > 0 ? ' · ' + issues.length + ' 个问题' : '');
            return (
              <rect
                key={`${dIdx}-${cIdx}`}
                x={cIdx * CELL_W}
                y={dIdx * cellH}
                width={CELL_W - 1}
                height={cellH - 1}
                fill={scoreToColor(score)}
                onClick={() => onCellClick(c.chapterIndex, dIdx)}
                className="cursor-pointer transition hover:brightness-110"
                aria-label={tip}
              >
                <title>{tip}</title>
              </rect>
            );
          })
        )}
      </svg>
    </div>
  );
}
