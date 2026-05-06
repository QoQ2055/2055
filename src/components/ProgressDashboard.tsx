// ProgressDashboard · gap-d FR-1 + FR-5
// Novel 页 N3 阶段顶部 collapsible 面板（CA §4.1 决议）。
// 内部 useMemo getProjectAggregates(artifacts) → 传 props 给 3 个子 view。
//
// 状态来源：
//   • artifacts → useProject().artifacts (live project)
//   • collapsed / selectedChapterIndex → useDashboard()
//
// CK invariant：I-1 (children 不读 store) ✅ — 容器读 store，子组件纯 props。

import { useMemo } from 'react';
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import { useProject } from '../store/project';
import { useDashboard } from '../store/dashboard';
import { getProjectAggregates } from '../store/projectAggregates';
import { ChapterCompletionGrid } from './dashboard/ChapterCompletionGrid';
import { WordCountTrend } from './dashboard/WordCountTrend';
import { ScoreHeatmap } from './dashboard/ScoreHeatmap';

export function ProgressDashboard() {
  const artifacts = useProject((s) => s.artifacts);
  const collapsed = useDashboard((s) => s.collapsed);
  const toggleCollapse = useDashboard((s) => s.toggleCollapse);
  const selectedChapterIndex = useDashboard((s) => s.selectedChapterIndex);
  const selectChapter = useDashboard((s) => s.selectChapter);

  const aggregates = useMemo(() => getProjectAggregates(artifacts), [artifacts]);

  const summary = useMemo(() => {
    const a = aggregates;
    if (a.totalChapters === 0) return '暂无章节';
    return `共 ${a.totalChapters} 章 · 已完成 ${a.completedChapters} · 进行中 ${a.inProgressChapters} · 平均 ${Math.round(a.wordCountStats.mean)} 字`;
  }, [aggregates]);

  const hasOutlier = aggregates.chapters.some((c) => c.isOutlier);
  const hasIssue = aggregates.chapters.some((c) => c.scoreCardIssueCount > 0);

  return (
    <section
      className="rounded border border-border-subtle bg-surface-1"
      aria-label="进度可视化面板"
    >
      {/* Header bar */}
      <button
        type="button"
        onClick={toggleCollapse}
        aria-expanded={!collapsed}
        aria-controls="progress-dashboard-body"
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2 transition focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        <span className="flex items-center gap-2 font-medium">
          <BarChart3 className="size-4 text-sky-500" />
          进度可视化
          <span className="text-xs text-fg-muted font-normal ml-2">{summary}</span>
          {hasOutlier && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-700">
              字数离群
            </span>
          )}
          {hasIssue && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-700">
              评分异常
            </span>
          )}
        </span>
        {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>
      {/* Body */}
      {!collapsed && (
        <div
          id="progress-dashboard-body"
          className={clsx('px-3 py-3 space-y-4 border-t border-border-subtle')}
        >
          <div>
            <div className="text-xs text-fg-muted mb-1">章节完成度</div>
            <ChapterCompletionGrid
              chapters={aggregates.chapters}
              selectedChapterIndex={selectedChapterIndex}
              onSelectChapter={selectChapter}
            />
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">字数曲线</div>
            <WordCountTrend
              chapters={aggregates.chapters}
              meanWordCount={aggregates.wordCountStats.mean}
              selectedChapterIndex={selectedChapterIndex}
              onSelectChapter={selectChapter}
            />
          </div>
          <div>
            <div className="text-xs text-fg-muted mb-1">评分卡热力图</div>
            <ScoreHeatmap
              matrix={aggregates.scoreCardMatrix}
              chapters={aggregates.chapters}
              onCellClick={(chapterIndex /* , dimensionIdx */) => selectChapter(chapterIndex)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
