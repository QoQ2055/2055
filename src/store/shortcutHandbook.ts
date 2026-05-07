/**
 * ui-v3 PR-1B · 快捷键手册 modal 状态管理
 *
 * 简易开/关 store · 由 Layout.tsx 全局快捷键 ? 触发
 * 与 commandPalette 拆开 · 因为两者互斥（按 ? 时 palette 关闭）
 */

import { create } from 'zustand';

interface ShortcutHandbookState {
  open: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

export const useShortcutHandbook = create<ShortcutHandbookState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
