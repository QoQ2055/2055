/**
 * v8 epic · MM1 PR-2 · multi-format expansion · barrel
 *
 * 4 份 format manifest 统一出口 · 后续 PR 通过 ALL_FORMATS 数组渲染导航 / 索引等。
 */
export type {
  FormatStep,
  FormatPath,
  FormatPhase,
  FormatManifest,
} from './types';

export { FEATURE_FORMAT } from './feature';
export { SHORT_FORMAT } from './short';
export { ULTRASHORT_FORMAT } from './ultrashort';
export { SERIES_FORMAT } from './series';

import { FEATURE_FORMAT } from './feature';
import { SHORT_FORMAT } from './short';
import { ULTRASHORT_FORMAT } from './ultrashort';
import { SERIES_FORMAT } from './series';
import type { FormatManifest } from './types';

/** 全部 4 份 manifest · 用于导航 / 索引页 / 路由派生。 */
export const ALL_FORMATS: ReadonlyArray<FormatManifest> = [
  FEATURE_FORMAT,
  SHORT_FORMAT,
  ULTRASHORT_FORMAT,
  SERIES_FORMAT,
] as const;

/** 按 id 查询 manifest（路由组件使用）。 */
export function getFormatManifest(id: FormatManifest['id']): FormatManifest {
  switch (id) {
    case 'feature':    return FEATURE_FORMAT;
    case 'short':      return SHORT_FORMAT;
    case 'ultrashort': return ULTRASHORT_FORMAT;
    case 'series':     return SERIES_FORMAT;
  }
}
