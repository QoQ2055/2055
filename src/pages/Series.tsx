import { FormatScaffoldPage } from '../components/FormatScaffoldPage';
import { SERIES_FORMAT } from '../data/formats';

/**
 * /series route · MM1 PR-2 骨架页（0 LLM）
 *
 * 双阶段串行（季度规划 → 逐集 8 步）· 阶段一仅做一次 · 阶段二每集独立循环 ·
 * 强依赖 MM5 epic v8 schema 的 4 张连续性表（伏笔 / 角色弧光 / 世界观规则 / 节奏诊断）。
 */
export function Series() {
  return <FormatScaffoldPage manifest={SERIES_FORMAT} />;
}
