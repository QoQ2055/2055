// WordCountTrend · gap-d FR-3
// 字数累积曲线 · 纯 view 组件 · 手撸 SVG（不引 chart 库）· 无 zustand (CK I-5)
//
// 渲染：
//   • 蓝线：每章字数（折线）
//   • 灰虚线：平均字数（水平基线）
//   • 绿虚线：目标字数（如有 targetWordCount）
//   • 红点：离群章节（isOutlier）
//   • hover 显示数值；click 跳章节

import clsx from 'clsx';
import type { ChapterAggregate } from '../../store/projectAggregates';

const W = 480;
const H = 140;
const PAD_X = 24;
const PAD_Y = 16;

export interface WordCountTrendProps {
  chapters: ChapterAggregate[];
  meanWordCount: number;
  targetWordCount?: number;
  selectedChapterIndex: number | null;
  onSelectChapter(chapterIndex: number): void;
}

export function WordCountTrend(props: WordCountTrendProps) {
  const { chapters, meanWordCount, targetWordCount, selectedChapterIndex, onSelectChapter } = props;

  if (chapters.length === 0) {
    return (
      <div className="text-sm text-slate-400 px-2 py-3" aria-label="字数曲线 · 暂无数据">
        暂无章节数据可展示曲线
      </div>
    );
  }

  const wcs = chapters.map((c) => c.wordCount);
  const yMax = Math.max(meanWordCount, targetWordCount ?? 0, ...wcs, 1);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const xAt = (i: number) =>
    PAD_X + (chapters.length === 1 ? innerW / 2 : (i / (chapters.length - 1)) * innerW);
  const yAt = (v: number) => PAD_Y + (1 - v / yMax) * innerH;

  const linePath = chapters
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(c.wordCount).toFixed(2)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-32"
      role="img"
      aria-label={`字数曲线 · 共 ${chapters.length} 章 · 平均 ${Math.round(meanWordCount)} 字${targetWordCount ? ' · 目标 ' + targetWordCount : ''}`}
    >
      {/* mean baseline */}
      {meanWordCount > 0 && (
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={yAt(meanWordCount)}
          y2={yAt(meanWordCount)}
          stroke="rgb(148 163 184)"
          strokeDasharray="4 3"
          strokeWidth="1"
        />
      )}
      {/* target baseline */}
      {targetWordCount && targetWordCount > 0 && (
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={yAt(targetWordCount)}
          y2={yAt(targetWordCount)}
          stroke="rgb(34 197 94)"
          strokeDasharray="6 3"
          strokeWidth="1"
        />
      )}
      {/* line */}
      <path d={linePath} stroke="rgb(59 130 246)" strokeWidth="2" fill="none" />
      {/* dots */}
      {chapters.map((c, i) => {
        const cx = xAt(i);
        const cy = yAt(c.wordCount);
        const isSel = selectedChapterIndex === c.chapterIndex;
        return (
          <circle
            key={c.chapterIndex}
            cx={cx}
            cy={cy}
            r={isSel ? 5 : c.isOutlier ? 4 : 2.5}
            className={clsx('cursor-pointer transition', isSel && 'drop-shadow-md')}
            fill={c.isOutlier ? 'rgb(239 68 68)' : 'rgb(59 130 246)'}
            stroke={isSel ? 'rgb(14 165 233)' : 'transparent'}
            strokeWidth="2"
            onClick={() => onSelectChapter(c.chapterIndex)}
            aria-label={`第 ${c.chapterIndex} 章 · ${c.wordCount} 字${c.isOutlier ? ' · 离群' : ''}`}
          >
            <title>{`第 ${c.chapterIndex} 章 · ${c.wordCount} 字`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
