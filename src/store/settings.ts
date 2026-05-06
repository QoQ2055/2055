import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsState {
  baseUrl: string;
  apiKey: string;
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
  set: (patch: Partial<SettingsState>) => void;
  reset: () => void;
}

const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
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
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    { name: 'FLIL.settings' },
  ),
);
