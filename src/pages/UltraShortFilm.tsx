import { FormatScaffoldPage } from '../components/FormatScaffoldPage';
import { ULTRASHORT_FORMAT } from '../data/formats';

/**
 * /ultrashort-film route · MM1 PR-2 骨架页（0 LLM）
 *
 * 双路径互斥（What-If 高概念 / How-to-Tell 视听形式）· tab 切换展示 ·
 * 进入 LLM 流程前必须先选定路径。
 */
export function UltraShortFilm() {
  return <FormatScaffoldPage manifest={ULTRASHORT_FORMAT} />;
}
