/**
 * /short-film route · MM1 PR-4 · 接入 LLM · MM1 PR-6 · mismatch 保护
 *
 * 演进路径：
 * - PR-2: FormatScaffoldPage 只读骨架（0 LLM）
 * - PR-4: 复用 /screenplay 八步工作台 + 进入时 setCtx({ formatId: 'narrative_short' })
 * - PR-6 (本次): 用 useScreenplayFormatRoute hook 替换无条件 setCtx ·
 *   不一致 + 已有产物时渲染 FormatMismatchBanner 让用户显式选择
 */
import { Screenplay } from './Screenplay';
import { FormatMismatchBanner } from '../components/FormatMismatchBanner';
import { useScreenplayFormatRoute } from '../hooks/useScreenplayFormatRoute';

const TARGET = 'narrative_short' as const;

export function ShortFilm() {
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
      title="叙事短片工作台 · 8 步法（5-10 分钟）"
      subtitle="单一核心事件 · 四段式结构 · 1-2 个主角 · 一次完整 A→B 弧光"
    />
  );
}
