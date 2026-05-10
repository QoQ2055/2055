/**
 * /feature-film route · MM1 PR-5 · 接入 LLM · MM1 PR-6 · mismatch 保护
 * 与 ShortFilm 同模式 · 仅 TARGET 与 title/subtitle 不同。
 */
import { Screenplay } from './Screenplay';
import { FormatMismatchBanner } from '../components/FormatMismatchBanner';
import { useScreenplayFormatRoute } from '../hooks/useScreenplayFormatRoute';

const TARGET = 'feature' as const;

export function FeatureFilm() {
  const { mismatch } = useScreenplayFormatRoute(TARGET);
  if (mismatch) {
    return (
      <FormatMismatchBanner
        currentFormatId={mismatch.currentFormatId}
        targetFormatId={TARGET}
        onConfirmSwitch={mismatch.onConfirmSwitch}
      />
    );
  }
  return (
    <Screenplay
      stageId="screenplay"
      totalSteps={8}
      stepLabel="S"
      title="电影长片工作台 · 8 步法（75-120 分钟）"
      subtitle="多线索结构 · 主角完整 Want/Need/Arc · 5-7 个戏剧节点"
    />
  );
}
