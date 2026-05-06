// ChapterScoreCardSlot · v2 阶段 2.9
//
// 章节预览专用：对单章正文做 6 维评分，不写回 artifact（章节层级不持久化），
// 仅在内存里维护"当前章节 + 上一次"两份分数，用于 before/after 对比。
//
// 使用场景：novel.3.1 / 3.2 的章节预览面板（PreviewModal）。
// 触发：text/chapterKey 变化时自动跑 4 维（skipLlm:true）；按钮可重算（含 LLM）。

import { useEffect, useRef, useState } from 'react';
import { useProject } from '../store/project';
import { useSettings } from '../store/settings';
import {
  runScoreCard,
  DEFAULT_DIMENSION_WEIGHTS,
  type ScoreCard,
  type DimensionWeights,
} from '../pipeline/scoreCard';
import type { NodeArtifact, StageId } from '../pipeline/types';
import { ScoreCardBadge } from './ScoreCardBadge';

interface Props {
  /** 当前章节正文（变化即触发自动 4 维评分） */
  text: string;
  /** 章节稳定标识；同一个 chapterKey 下 text 变化会保留 previous 用于 delta */
  chapterKey: string;
  /** 评分时挂的 nodeId（影响题材/方法论锚点的查表） */
  nodeId: string;
  /** stageId 与 nodeId 匹配，如 'novel' */
  stageId: StageId;
}

interface MemoState {
  current?: ScoreCard;
  previous?: ScoreCard;
  history: ScoreCard[];
}

export function ChapterScoreCardSlot({ text, chapterKey, nodeId, stageId }: Props) {
  const enabled = useSettings((s) => s.enableScoreCard !== false);
  const [state, setState] = useState<MemoState>({ history: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // 避免 effect 内的并发请求：用 ref 锁
  const inFlight = useRef(false);
  // 切章节时清空 previous（避免跨章节误对比）
  const lastChapterKeyRef = useRef(chapterKey);

  useEffect(() => {
    if (lastChapterKeyRef.current !== chapterKey) {
      lastChapterKeyRef.current = chapterKey;
      setState({ history: [] });
    }
  }, [chapterKey]);

  const compute = async (skipLlm: boolean) => {
    if (inFlight.current) return;
    if (!text || text.trim().length < 50) return; // 太短不评
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const project = useProject.getState();
      const settings = useSettings.getState();
      // 合成章节级 artifact（不持久化）：仅供 runScoreCard 使用
      const synthetic: NodeArtifact = {
        nodeId,
        stageId,
        index: 0,
        title: `chapter:${chapterKey}`,
        format: 'text',
        content: text,
        durationMs: 0,
        ts: Date.now(),
        meta: { syntheticChapterKey: chapterKey },
      };
      const weights: DimensionWeights = {
        ...DEFAULT_DIMENSION_WEIGHTS,
        ...(settings.scoreCardWeights ?? {}),
      };
      const card = await runScoreCard({
        artifact: synthetic,
        project: project.ctx,
        artifacts: project.artifacts,
        settings,
        weights,
        skipLlm,
      });
      setState((prev) => {
        // previous = 旧的 current（如有）；history 累积最近 5 条
        const nextHistory = prev.current
          ? [...prev.history, prev.current].slice(-5)
          : prev.history;
        return {
          current: card,
          previous: prev.current,
          history: nextHistory,
        };
      });
    } catch (e: any) {
      console.warn('[ChapterScoreCardSlot] runScoreCard failed', e);
      setError(e?.message ?? String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // 自动 4 维（text / chapterKey 变化）
  useEffect(() => {
    if (!enabled) return;
    void compute(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, chapterKey, enabled, nodeId]);

  if (!enabled) return null;

  return (
    <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950/40 shrink-0">
      <ScoreCardBadge
        card={state.current}
        previous={state.previous}
        history={state.history}
        busy={busy}
        error={error}
        onRecompute={(opts) => compute(!!opts?.skipLlm)}
      />
    </div>
  );
}
