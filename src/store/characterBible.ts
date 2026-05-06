// characterBible.ts · gap-b PR-4
// CharacterBible 面板 UI 状态 zustand store · localStorage 持久化
//
// CK invariant I-4：localStorage key 恰好 1 个 ('flil:character-bible:state')
//                   gap-d 的 dashboard 持久化 key 在本文件 0 出现（文字避免被 grep 误报）
//
// 设计简化（与 dashboard.ts 同模式）：
//   • 不按 projectId 分桶（仅作用于 live 项目，切项目自然重置 selectedCharacterName）
//   • collapsed / selectedCharacterName / viewMode / showStaleOnly 全局共用

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CharacterBibleViewMode = 'timeline' | 'relations';

export interface CharacterBibleState {
  collapsed: boolean;
  /** 当前选中查看的角色名。null = 未选择（首次显示提示选角色）。 */
  selectedCharacterName: string | null;
  /** 默认显示时间线（CA §4.1 Q1 决议）；用户可切关系图。 */
  viewMode: CharacterBibleViewMode;
  /** 仅显示 stale 章节（FR-6 SHOULD），默认 false。 */
  showStaleOnly: boolean;
}

interface CharacterBibleActions {
  toggleCollapse(): void;
  setCollapsed(collapsed: boolean): void;
  selectCharacter(name: string | null): void;
  setViewMode(mode: CharacterBibleViewMode): void;
  setShowStaleOnly(v: boolean): void;
  reset(): void;
}

const DEFAULTS: CharacterBibleState = {
  collapsed: true, // 默认折叠（同 gap-d 风格 · 不抢屏幕）
  selectedCharacterName: null,
  viewMode: 'timeline',
  showStaleOnly: false,
};

export const useCharacterBible = create<CharacterBibleState & CharacterBibleActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      toggleCollapse: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      selectCharacter: (name) => set({ selectedCharacterName: name }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setShowStaleOnly: (v) => set({ showStaleOnly: v }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'flil:character-bible:state' },
  ),
);
