// useScoreCardController · v2 阶段 2.9
//
// 给"渲染 ScoreCardBadge 的页面/组件"提供一致的控制器：
//   - 自动触发：artifact.ts 变化（新版本生成 / 修改后 upsert）且无对应分数时，
//     立即跑前 4 维（skipLlm: true，免费、< 10ms）。
//   - 手动触发：暴露 recompute({ skipLlm? }) 给"重算"按钮，默认带 LLM。
//
// 评分结果通过 applyScoreCardToArtifact 写到 artifact.meta.scoreCard +
// scoreCardHistory[]，由 project.upsertArtifact 持久化。
//
// 不在 Hook 里渲染——只控制状态。UI 渲染交给 ScoreCardBadge。

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runScoreCard,
  applyScoreCardToArtifact,
  DEFAULT_DIMENSION_WEIGHTS,
  type DimensionWeights,
} from '../pipeline/scoreCard';
import { useProject } from '../store/project';
import { useSettings } from '../store/settings';
import type { NodeArtifact } from '../pipeline/types';

interface ControllerState {
  busy: boolean;
  error?: string;
}

export interface ScoreCardController extends ControllerState {
  /** 手动触发评分。skipLlm 默认 false（含 LLM 2 维） */
  recompute: (opts?: { skipLlm?: boolean }) => Promise<void>;
}

/**
 * @param artifact   待评产物；undefined 时控制器静默不动作
 * @param enabled    全局开关（一般来自 settings.enableScoreCard）
 */
export function useScoreCardController(
  artifact: NodeArtifact | undefined,
  enabled: boolean = true,
): ScoreCardController {
  const [state, setState] = useState<ControllerState>({ busy: false });
  // 用 ref 防止 useEffect 重入（当 recompute 触发 upsertArtifact，
  // 父组件重渲染传入新 artifact 引用，但 ts 不变；ref 用作锁）
  const inFlightRef = useRef(false);

  const recompute = useCallback(
    async (opts: { skipLlm?: boolean } = {}) => {
      if (!artifact) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setState({ busy: true });
      try {
        const project = useProject.getState();
        const settings = useSettings.getState();
        const weights: DimensionWeights = {
          ...DEFAULT_DIMENSION_WEIGHTS,
          ...(settings.scoreCardWeights ?? {}),
        };
        const card = await runScoreCard({
          artifact,
          project: project.ctx,
          artifacts: project.artifacts,
          settings,
          weights,
          skipLlm: opts.skipLlm,
        });
        const updated = applyScoreCardToArtifact(artifact, card);
        project.upsertArtifact(updated);
        setState({ busy: false });
      } catch (e: any) {
        console.warn('[useScoreCardController] runScoreCard failed', e);
        setState({ busy: false, error: e?.message ?? String(e) });
      } finally {
        inFlightRef.current = false;
      }
    },
    // 仅依赖 artifact 引用；nodeId/ts 变化时 React 自然给新 artifact，回调随之更新。
    // 不显式列 nodeId/ts 是为了少一次重创建——上面用了 inFlightRef 兜底。
    [artifact],
  );

  // 自动触发 4-dim 评分：artifact 出现 / 版本更新 / 没分时
  useEffect(() => {
    if (!enabled || !artifact) return;
    const existing = (artifact.meta as any)?.scoreCard;
    // 已经有评分且评分时间 ≥ artifact ts，跳过（避免重复评同一版）
    if (existing && existing.ts >= artifact.ts) return;
    recompute({ skipLlm: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact?.nodeId, artifact?.ts, enabled]);

  return {
    busy: state.busy,
    error: state.error,
    recompute,
  };
}

/** 从 artifact 解构出 ScoreCardBadge 需要的展示数据（previous / history）。 */
export function readScoreCardFromArtifact(artifact?: NodeArtifact) {
  if (!artifact) return { card: undefined, previous: undefined, history: undefined };
  const meta = (artifact.meta as any) ?? {};
  const card = meta.scoreCard;
  const history = (meta.scoreCardHistory ?? []) as any[];
  // previous = history 末尾（applyScoreCardToArtifact 会把上一份压入 history）
  const previous = history.length > 0 ? history[history.length - 1] : undefined;
  return { card, previous, history };
}
