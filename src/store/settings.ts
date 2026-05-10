import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SettingsState {
  baseUrl: string;
  apiKey: string;
  /**
   * ui-v4 epic · 主题模式 · 'system' 跳随系统 prefers-color-scheme
   * 默认 'dark' 保持与原 index.html `class="dark"` 行为一致
   */
  theme: ThemeMode;
  /**
   * Standard model — used for the majority of nodes (大纲 / 角色 / 一般写作).
   * Backwards-compatible default for any node that doesn't have a per-tier
   * override resolved from MODEL_RECIPE.
   */
  model: string;
  /**
   * Optional flagship model — high-quality, expensive. Routed to creative-
   * critical nodes (破题 / 章节正文 / 大场景) by MODEL_RECIPE if non-empty.
   * Empty string ⇒ falls back to `model`.
   */
  modelFlagship: string;
  /**
   * Optional lite model — cheap & fast. Routed to structured extraction /
   * scanning nodes (资产扫描 / plan-json / 工具型节点) by MODEL_RECIPE if
   * non-empty. Empty string ⇒ falls back to `model`.
   */
  modelLite: string;
  temperatureScreenplay: number;
  temperatureAssets: number;
  maxTokens: number;
  concurrency: number;
  autoChain: boolean;
  retryMax: number;
  enableKbInjection: boolean;       // 增强知识库注入到 system
  enableEditorialRounds: boolean;   // R1 创作指令书 + R9 总编裁决
  enableSelfCheck: boolean;         // 节点完成后允许一键自检（不自动跑，只显示按钮）
  enableSelfCheckContext: boolean;  // storyboard.2 自检时是否注入 sb.1 / assets 上下文（提高一致性检查准确度，耗 token）
  enableScoreCard: boolean;         // 节点产出后显示 6 维评分（前 4 维自动跑，LLM 维度按需重算）
  /** gap-b · N3.2 润色完成后自动提取角色状态、N3.1 草稿注入上一章状态摘要。默认 false 避免被动产生 token 费用。 */
  enableCharacterStateExtraction: boolean;
  /**
   * MM5 PR-5 · N3.2 润色完成后自动提取连续性元素（伏笔 / 角色弧光 / 世界观规则 / 节奏诊断）
   * · 落入 v8 4 表 · 看板自动反映。fire-and-forget 不阻塞主流程。
   * · 默认 false （避免被动产生 token 费用 · CK I-4 opt-in）。
   */
  enableContinuityExtraction: boolean;
  /** gap-c · 第 7 维 transition 衔接顺畅度评分（仅当提供上一章原文时起作用）。默认 true。 */
  enableTransitionScoring: boolean;
  scoreCardWeights?: Partial<{      // 7 维度自定义权重（默认等权 1.0），缺省 = 等权
    genre: number;
    method: number;
    kbRedline: number;
    craft: number;
    r1Align: number;
    userKbStyle: number;
    transition: number;
  }>;
  /**
   * v6 epic · ACE-lite Reflector 触发阈值。默认 enabled=false（CK v6 I-4 · opt-in）。
   * N3.2 润色完成后 · 若 enabled · 检查信号阈值满足时触发 novel.9 Reflector LLM step。
   */
  reflectorThresholds: {
    enabled: boolean;
    scoreCardMin: number;                 // ScoreCard 任一维度 < 此值触发
    consistencyCheckTriggerOnAny: boolean; // ConsistencyReport 含 issues 即触发
    readerLayerStaleChapterCount: number; // readerLayer.whatImWondering 跨 N 章不变触发
    userFeedbackEnabled: boolean;
  };
  set: (patch: Partial<SettingsState>) => void;
  setTheme: (theme: ThemeMode) => void;
  reset: () => void;
}

const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  // ui-v4 · 默认 dark · 保持与 index.html `class="dark"` 行为堆叠不退化
  theme: 'dark' as ThemeMode,
  model: 'deepseek-chat',
  modelFlagship: '',
  modelLite: '',
  temperatureScreenplay: 0.8,
  temperatureAssets: 0.2,
  maxTokens: 16384,
  concurrency: 3,
  autoChain: true,
  retryMax: 2,
  enableKbInjection: true,
  enableEditorialRounds: true,
  enableSelfCheck: true,
  enableSelfCheckContext: true,
  enableScoreCard: true,
  enableCharacterStateExtraction: false,
  enableContinuityExtraction: false,
  enableTransitionScoring: true,
  scoreCardWeights: undefined,
  // v6 epic · ACE-lite Reflector 默认 disabled（CK I-4 · 用户主动 opt-in）
  reflectorThresholds: {
    enabled: false,
    scoreCardMin: 6,
    consistencyCheckTriggerOnAny: true,
    readerLayerStaleChapterCount: 5,
    userFeedbackEnabled: true,
  },
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      setTheme: (theme) => set({ theme }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'FLIL.settings' },
  ),
);
