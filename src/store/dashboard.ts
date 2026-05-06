// dashboard.ts · gap-d FR-6
// 用于 ProgressDashboard 的轻量 zustand store · localStorage 持久化
//
// CK invariant I-4：localStorage key 恰好 1 个 ('flil:dashboard:state')
//
// 设计简化（vs CA §1.3 草案）：
//   • 不按 projectId 分桶（dashboard 仅作用于 live 项目，切项目时 fresh state 即可）
//   • collapsed / selectedChapterIndex 全局共用

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DashboardState {
  collapsed: boolean;
  /** 章节序号（1-based，对齐 ChapterMeta.index）。null = 未选择 */
  selectedChapterIndex: number | null;
}

interface DashboardActions {
  toggleCollapse(): void;
  setCollapsed(collapsed: boolean): void;
  selectChapter(chapterIndex: number | null): void;
  reset(): void;
}

const DEFAULTS: DashboardState = {
  collapsed: true, // 默认折叠（CA §4.1 决议：不抢屏幕）
  selectedChapterIndex: null,
};

export const useDashboard = create<DashboardState & DashboardActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      toggleCollapse: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      selectChapter: (chapterIndex) => set({ selectedChapterIndex: chapterIndex }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'flil:dashboard:state' },
  ),
);
