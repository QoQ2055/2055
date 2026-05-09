import { FormatScaffoldPage } from '../components/FormatScaffoldPage';
import { FEATURE_FORMAT } from '../data/formats';

/**
 * /feature-film route · MM1 PR-2 骨架页（0 LLM）
 *
 * 后续 PR 接入 LLM-driven 流水线 · 复用 /screenplay 的 R1/R9 编辑部 + 自检 + 评分卡。
 */
export function FeatureFilm() {
  return <FormatScaffoldPage manifest={FEATURE_FORMAT} />;
}
