// ChapterCompletionGrid · gap-d FR-2
// 章节完成度 grid · 纯 view 组件 · 不读 zustand / 不调 LLM (CK invariant I-5)
//
// 颜色编码：
//   not-started → 灰  / in-progress → 琥珀  / completed → 绿
//   评分异常（issueCount > 0） → 红色描边
//   字数离群（isOutlier） → 黄色边框
//   选中态 → 蓝色厚环

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { ChapterAggregate } from '../../store/projectAggregates';

const STATUS_BG: Record<ChapterAggregate['status'], string> = {
  'not-started': 'bg-slate-200 text-slate-500',
  'in-progress': 'bg-amber-300 text-amber-900',
  completed: 'bg-emerald-400 text-emerald-900',
};

const CELL_TARGET_PX = 36; // CA §3.3 容器自适应基准
const COL_MIN = 5;
const COL_MAX = 12;

export interface ChapterCompletionGridProps {
  chapters: ChapterAggregate[];
  selectedChapterIndex: number | null;
  onSelectChapter(chapterIndex: number): void;
}

export function ChapterCompletionGrid(props: ChapterCompletionGridProps) {
  const { chapters, selectedChapterIndex, onSelectChapter } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(8);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const cols = Math.min(COL_MAX, Math.max(COL_MIN, Math.floor(w / CELL_TARGET_PX)));
      setColumns(cols);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (chapters.length === 0) {
    return (
      <div className="text-sm text-slate-400 px-2 py-3" aria-label="章节完成度 · 暂无数据">
        暂无章节大纲（请先完成 N2.2 单卷分章）
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="grid"
      aria-label={`章节完成度 grid · 共 ${chapters.length} 章`}
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {chapters.map((c) => {
        const isSelected = selectedChapterIndex === c.chapterIndex;
        const hasIssue = c.scoreCardIssueCount > 0;
        const tip = `第 ${c.chapterIndex} 章${c.title ? ' · ' + c.title : ''} · ${c.wordCount} 字 · 评分 ${c.scoreCardAvg !== null ? c.scoreCardAvg.toFixed(1) : '—'}${hasIssue ? ' · ' + c.scoreCardIssueCount + ' 个问题' : ''}${c.isOutlier ? ' · 字数离群' : ''}`;
        return (
          <button
            key={c.chapterIndex}
            type="button"
            role="gridcell"
            aria-label={tip}
            aria-selected={isSelected}
            onClick={() => onSelectChapter(c.chapterIndex)}
            title={tip}
            className={clsx(
              'aspect-square rounded text-[10px] font-medium flex items-center justify-center transition',
              STATUS_BG[c.status],
              hasIssue && 'ring-2 ring-rose-500',
              c.isOutlier && 'border-2 border-yellow-500',
              isSelected && 'ring-4 ring-sky-500 z-10',
              'hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-400',
            )}
          >
            {c.chapterIndex}
          </button>
        );
      })}
    </div>
  );
}
