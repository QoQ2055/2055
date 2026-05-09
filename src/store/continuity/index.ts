/**
 * v8 epic · MM5 PR-1 · 多模态连续性层 · barrel re-export
 *
 * 4 张 add-only 表 + 各自的 dexie helpers · 后续 epic 通过本 barrel 统一引入。
 *
 * 边界（CK I-3 关注点分离）：
 *   - 本目录仅做 IO + 类型 · 不调 LLM · 不依赖 React
 *   - LLM-driven 提取逻辑放在 src/pipeline/continuity/（后续 PR 引入）
 *   - UI 组件放在 src/components/Continuity*.tsx（后续 PR 引入）
 */

export type {
  ForeshadowRow,
  ForeshadowStatus,
  ForeshadowWeight,
  CharacterArcRow,
  WorldRuleRow,
  WorldRuleSeverity,
  RhythmDiagnosticRow,
} from './types';

export {
  addForeshadow,
  listForeshadows,
  listForeshadowsByStatus,
  listForeshadowsBySetupChapter,
  updateForeshadow,
  clearProjectForeshadows,
} from './foreshadows';

export {
  addCharacterArc,
  listCharacterArc,
  findCharacterArcEpoch,
  listAllCharacterArcs,
  updateCharacterArc,
  clearProjectCharacterArcs,
} from './characterArcs';

export {
  addWorldRule,
  listWorldRules,
  listWorldRulesByDomain,
  appendWorldRuleViolation,
  updateWorldRule,
  clearProjectWorldRules,
} from './worldRules';

export {
  upsertRhythmDiagnostic,
  listChapterRhythm,
  listAllRhythm,
  clearProjectRhythm,
} from './rhythmDiagnostics';
