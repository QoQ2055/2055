/**
 * v6 epic · ReflectorLessonsPanel UI 状态 zustand store · localStorage 持久化
 *
 * CK invariant I-6：localStorage key 独立（'flil:reflector-lessons:state'）
 *                   不复用 useCharacterBible（避免 v5 reader viewMode 与 v6 reflector 概念混淆）
 *
 * 设计简化（与 useCharacterBible 同模式）：
 *   • 不按 projectId 分桶（仅作用于 live 项目，切项目自然重置 filters）
 *   • collapsed / statusFilter / signalTypeFilter / selectedLessonId 全局共用
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LessonStatus, SignalType } from './reflectorLessons';

export type StatusFilter = LessonStatus | 'all';
export type SignalTypeFilter = SignalType | 'all';

export interface ReflectorLessonsPanelState {
  collapsed: boolean;
  statusFilter: StatusFilter;
  signalTypeFilter: SignalTypeFilter;
  /** 当前打开详情 modal 的 lesson id · null = 关闭。 */
  selectedLessonId: number | null;
}

interface ReflectorLessonsPanelActions {
  toggleCollapse(): void;
  setCollapsed(collapsed: boolean): void;
  setStatusFilter(s: StatusFilter): void;
  setSignalTypeFilter(s: SignalTypeFilter): void;
  selectLesson(id: number | null): void;
  reset(): void;
}

const DEFAULTS: ReflectorLessonsPanelState = {
  collapsed: true, // 默认折叠（同 CharacterBible 风格 · 不抢屏幕）
  statusFilter: 'pending',
  signalTypeFilter: 'all',
  selectedLessonId: null,
};

export const useReflectorLessonsPanel = create<ReflectorLessonsPanelState & ReflectorLessonsPanelActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      toggleCollapse: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setSignalTypeFilter: (signalTypeFilter) => set({ signalTypeFilter }),
      selectLesson: (selectedLessonId) => set({ selectedLessonId }),
      reset: () => set(DEFAULTS),
    }),
    { name: 'flil:reflector-lessons:state' }, // CK I-6 独立 localStorage key
  ),
);
