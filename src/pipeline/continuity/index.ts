/**
 * v8 epic · MM5 PR-4 · continuity LLM 提取层 · barrel
 *
 * 边界：
 *   - 本目录只做 LLM driver + 落库 · 不做 UI
 *   - UI（看板按钮 / 弹窗）放在 src/components/ContinuityDashboardPanel.tsx
 *   - dexie helpers 在 src/store/continuity/（被本目录消费）
 */
export type {
  ExtractContinuityOptions,
  ExtractContinuityResult,
} from './extractor';

export { extractContinuityFromChapter } from './extractor';
