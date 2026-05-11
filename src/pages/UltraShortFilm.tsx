/**
 * /ultrashort-film route · MM1 PR-7 · 接入 LLM
 *
 * 与 short/feature/series 不同 · ultrashort 有 3 步双路径工作流（What-If / How-to-Tell）·
 * 不能简单复用 Screenplay 8 步组件。本路由：
 *
 *   1. 复用 useScreenplayFormatRoute('concept_short') 做 mismatch 保护（与 PR-6 一致）
 *   2. 渲染分支：
 *      - ctx.ultrashortMode 未设 → <UltrashortPathSelector /> 让用户选 path
 *      - 已设 → <UltrashortRunner mode={...} /> 三步 LLM 工作台
 *   3. Runner 提供"切换路径"回调：清 ultrashort.* artifact + 清 ctx.ultrashortMode
 *
 * 体量：~80 LOC · 职责单一 · 复用 PathSelector + Runner 两个独立组件。
 */
import { useProject } from '../store/project';
import { FormatMismatchBanner } from '../components/FormatMismatchBanner';
import { UltrashortPathSelector } from '../components/UltrashortPathSelector';
import { UltrashortRunner } from '../components/UltrashortRunner';
import { useScreenplayFormatRoute } from '../hooks/useScreenplayFormatRoute';

const TARGET = 'concept_short' as const;

export function UltraShortFilm() {
  const { mismatch } = useScreenplayFormatRoute(TARGET);
  const ctx = useProject((s) => s.ctx);
  const setCtx = useProject((s) => s.setCtx);
  const clearStage = useProject((s) => s.clearStage);

  // 1. format mismatch banner（与 PR-6 三路由同模式）
  if (mismatch) {
    return (
      <FormatMismatchBanner
        currentFormatId={mismatch.currentFormatId}
        targetFormatId={TARGET}
        onConfirmSwitch={mismatch.onConfirmSwitch}
      />
    );
  }

  // 2. 未选路径 → PathSelector
  if (!ctx.ultrashortMode) {
    return <UltrashortPathSelector />;
  }

  // 3. 已选路径 → Runner
  return (
    <UltrashortRunner
      mode={ctx.ultrashortMode}
      onSwitchPath={() => {
        // 清 ultrashort.* artifact (因为不同 path 的 step 1 prompt 输出形态完全不同)
        clearStage('ultrashort');
        // 重置 ultrashortMode → 触发 PathSelector 重新渲染
        setCtx({ ultrashortMode: undefined });
      }}
    />
  );
}
