import { FormatScaffoldPage } from '../components/FormatScaffoldPage';
import { SHORT_FORMAT } from '../data/formats';

/**
 * /short-film route · MM1 PR-2 骨架页（0 LLM）
 *
 * 与现有 /screenplay 的关系：/screenplay 是 fili-web 沉淀的内部 8 步剧本工作台 ·
 * /short-film 是山音 SKILL "叙事短片" 格式的 LAYER 1 直引入口 · 两者并存 ·
 * MM1 后续 PR 评估是否合并对齐。
 */
export function ShortFilm() {
  return <FormatScaffoldPage manifest={SHORT_FORMAT} />;
}
