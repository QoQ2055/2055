// projectAggregates.ts · gap-d FR-data
// 纯同步函数，按 ArtifactMap 计算 Novel 项目的章节聚合数据，
// 供 ProgressDashboard / ChapterCompletionGrid / WordCountTrend / ScoreHeatmap 消费。
//
// 设计原则（来自 CA §1.3 + §3.1 + invariant I-1）：
//   • 纯函数：不接持久层 / 不调 LLM / 不读 zustand，只吃 artifacts 入参。
//   • 章节来源：parseChapterOutlines(artifacts['novel.4'].content) → ChapterMeta[]。
//   • Body lookup：artifact.meta.chapterContents[chapterIndex]，润色 (novel.7) > 草稿 (novel.6) > 空。
//   • ScoreCard 矩阵：PR-1 返回 null（占位）；PR-2 ScoreHeatmap 实施时同步对接 ChapterScoreCardSlot
//     的存储位置（current/previous 经 hook 注入，可能在 artifact.meta 上独立索引）。

import { parseChapterOutlines, type ChapterMeta, type NovelChapterLoopMeta } from '../pipeline/novelLoop';
import type { ArtifactMap } from '../pipeline/types';

export interface ProjectAggregates {
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  notStartedChapters: number;
  chapters: ChapterAggregate[];
  scoreCardMatrix: ScoreCardMatrix | null;
  wordCountStats: { mean: number; median: number; min: number; max: number };
}

export interface ChapterAggregate {
  /** 1-based · 来自 ChapterMeta.index */
  chapterIndex: number;
  title: string;
  /** body.length（润色优先 > 草稿） */
  wordCount: number;
  bodySource: 'polish' | 'draft' | 'none';
  status: 'completed' | 'in-progress' | 'not-started';
  /** 维度均分；null = 该章节无评分 */
  scoreCardAvg: number | null;
  scoreCardIssueCount: number;
  /** 字数 < 50% mean 或 > 200% mean（且 wordCount > 0） */
  isOutlier: boolean;
}

export interface ScoreCardMatrix {
  dimensions: string[];
  /** [chapterIdx][dimensionIdx] · null = 该章节缺该维度评分 */
  values: (number | null)[][];
  /** hover 显示用的问题清单 */
  issueLists: (string[] | null)[][];
}

const COMPLETED_THRESHOLD = 1000;

export function getProjectAggregates(artifacts: ArtifactMap): ProjectAggregates {
  // 1. 解析章节大纲
  const outlineArt = artifacts['novel.4'];
  const chapters: ChapterMeta[] = outlineArt ? parseChapterOutlines(outlineArt.content) : [];

  // 2. 取 draft / polish meta（chapterContents 在 meta 上）
  const draftMeta = (artifacts['novel.6']?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const polishMeta = (artifacts['novel.7']?.meta ?? {}) as Partial<NovelChapterLoopMeta>;

  // 3. body lookup（润色 > 草稿 > 空）
  const lookupBody = (chapterIndex: number): { content: string; source: 'polish' | 'draft' | 'none' } => {
    const polish = polishMeta.chapterContents?.[chapterIndex];
    if (polish) return { content: polish, source: 'polish' };
    const draft = draftMeta.chapterContents?.[chapterIndex];
    if (draft) return { content: draft, source: 'draft' };
    return { content: '', source: 'none' };
  };

  // 4. 字数统计
  const wordCounts = chapters.map((c) => lookupBody(c.index).content.length);
  const sum = wordCounts.reduce((a, b) => a + b, 0);
  const mean = wordCounts.length === 0 ? 0 : sum / wordCounts.length;
  const sorted = [...wordCounts].sort((a, b) => a - b);
  const median = sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)] ?? 0;
  const min = sorted.length === 0 ? 0 : sorted[0] ?? 0;
  const max = sorted.length === 0 ? 0 : sorted[sorted.length - 1] ?? 0;

  // 5. 每章节聚合
  const chapterAggs = chapters.map((c) => buildChapterAggregate(c, lookupBody(c.index), mean));

  // 6. ScoreCard 矩阵 (PR-1 占位 · PR-2 接入)
  const matrix: ScoreCardMatrix | null = null;

  // 7. 完成度统计
  const completed = chapterAggs.filter((c) => c.status === 'completed').length;
  const inProgress = chapterAggs.filter((c) => c.status === 'in-progress').length;
  const notStarted = chapterAggs.length - completed - inProgress;

  return {
    totalChapters: chapters.length,
    completedChapters: completed,
    inProgressChapters: inProgress,
    notStartedChapters: notStarted,
    chapters: chapterAggs,
    scoreCardMatrix: matrix,
    wordCountStats: { mean, median, min, max },
  };
}

function buildChapterAggregate(
  chapter: ChapterMeta,
  body: { content: string; source: 'polish' | 'draft' | 'none' },
  mean: number,
): ChapterAggregate {
  const wordCount = body.content.length;

  let status: ChapterAggregate['status'];
  if (wordCount === 0) status = 'not-started';
  else if (wordCount >= COMPLETED_THRESHOLD) status = 'completed';
  else status = 'in-progress';

  const isOutlier = wordCount > 0 && mean > 0 && (wordCount < mean * 0.5 || wordCount > mean * 2);

  return {
    chapterIndex: chapter.index,
    title: chapter.title,
    wordCount,
    bodySource: body.source,
    status,
    // PR-1: ScoreCard 占位（PR-2 接入 ChapterScoreCardSlot 数据源）
    scoreCardAvg: null,
    scoreCardIssueCount: 0,
    isOutlier,
  };
}
