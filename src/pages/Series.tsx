/**
 * /series route · MM1 PR-5 · 接入 LLM · MM1 PR-6 · mismatch 保护
 *
 * 与 ShortFilm 同模式 · 仅 TARGET 与 title/subtitle 不同。
 *
 * 注意：剧集本质是"季度规划 + 逐集生成"双阶段 · 当前仅接季度级 8 步。
 * 逐集循环将在后续 MM1 PR 借鉴 N3.1 / N3.2 章节循环模式实现。
 */
import { Screenplay } from './Screenplay';
import { FormatMismatchBanner } from '../components/FormatMismatchBanner';
import { useScreenplayFormatRoute } from '../hooks/useScreenplayFormatRoute';

const TARGET = 'series' as const;

export function Series() {
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
      title="剧集工作台 · 8 步法（季度规划 + 分集结构）"
      subtitle="多集叙事 · 季度弧光 + 单集冲突 · 钩子 / 卡黑 / 集间悬念"
    />
  );
}
