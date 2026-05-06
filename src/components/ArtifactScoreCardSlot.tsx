// ArtifactScoreCardSlot · v2 阶段 2.9
//
// 把"评分控制器 + UI Badge + settings 开关"封装成可复用槽位。
// 在 Pipeline / Screenplay / 章节预览等任何"产出后想看分数"的位置插入即可。

import { useSettings } from '../store/settings';
import { ScoreCardBadge } from './ScoreCardBadge';
import {
  useScoreCardController,
  readScoreCardFromArtifact,
} from '../hooks/useScoreCardController';
import type { NodeArtifact } from '../pipeline/types';

interface Props {
  artifact: NodeArtifact;
  /** 默认折叠详情；某些位置（如最终交付节点）可以默认展开 */
  defaultOpen?: boolean;
}

export function ArtifactScoreCardSlot({ artifact, defaultOpen }: Props) {
  const enabled = useSettings((s) => s.enableScoreCard !== false);
  const { busy, error, recompute } = useScoreCardController(artifact, enabled);
  if (!enabled) return null;
  const { card, previous, history } = readScoreCardFromArtifact(artifact);
  return (
    <ScoreCardBadge
      card={card}
      previous={previous}
      history={history}
      busy={busy}
      error={error}
      onRecompute={recompute}
      defaultOpen={defaultOpen}
    />
  );
}
