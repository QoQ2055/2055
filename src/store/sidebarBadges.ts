/**
 * ui-v3 PR-2 · Sidebar status badge 数据聚合
 *
 * 职责：
 *   • pendingLessons : 当前活动项目（projectId=0 = live）的待审核 reflector lessons 数
 *   • lastRefreshTs  : 最近一次 refresh 时间戳（仅用于诊断）
 *
 * 刷新策略（不依赖 dexie-react-hooks · 项目无该依赖）：
 *   1. Layout mount 时启动 10s 轮询（成本 trivial · IndexedDB 索引查询 < 5ms）
 *   2. 项目切换时 Layout 监听 ctx 变化主动 refresh
 *   3. 暴露 refresh() 供 ReflectorLessonsPanel approve/reject 后立即调用
 *
 * 不变量：
 *   • V3-I-4 不静默吞错：refresh() 出错 console.error · 不抛
 *   • V3-I-5 Dexie schema 不动：仅读 listLessonsByStatus 既有 API
 */

import { create } from 'zustand';
import { listLessonsByStatus } from './reflectorLessons';

interface SidebarBadgesState {
  pendingLessons: number;
  lastRefreshTs: number;
  /** 重新查询所有 badge 数据源 · 通常由 Layout 周期 / 切项目时调用 */
  refresh: () => Promise<void>;
}

export const useSidebarBadges = create<SidebarBadgesState>((set) => ({
  pendingLessons: 0,
  lastRefreshTs: 0,
  refresh: async () => {
    try {
      // projectId=0 = live (current active project)
      const lessons = await listLessonsByStatus(0, 'pending');
      set({ pendingLessons: lessons.length, lastRefreshTs: Date.now() });
    } catch (e) {
      // V3-I-4 · 不静默吞错
      console.error('[sidebarBadges] refresh failed', e);
    }
  },
}));
