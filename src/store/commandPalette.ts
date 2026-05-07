/**
 * ui-v3 PR-1 · Command Palette 全局状态（zustand）
 *
 * 职责：
 *   • open/close state
 *   • query (用户输入搜索词)
 *   • selectedIndex (键盘导航 ArrowUp/ArrowDown)
 *
 * 设计不变量（V3-I-1 路由不动 · V3-I-5 Dexie 不动）：
 *   • 本 store 不触发任何路由修改 · 仅暴露 open 状态
 *   • 路由跳转由 CommandPalette 组件内调用 useNavigate() 完成
 *   • 本 store 不持久化（非设置项 · 纯交互态 · 刷新后重置）
 *
 * 与既有 store 关系（V3-I-4 不静默吞错）：
 *   • 命令 action 出错 → 由 CommandPalette 组件捕获 + Toast 提示
 *   • 本 store 不做 try/catch · 保持 state 简单
 */

import { create } from 'zustand';

interface CommandPaletteState {
  open: boolean;
  query: string;
  selectedIndex: number;

  /** 打开面板（自动清空 query · 重置 selectedIndex） */
  openPalette: () => void;
  /** 关闭面板（不清空 query · 下次打开可复用？MVP 不保留 · 关闭时清空） */
  closePalette: () => void;
  /** 切换（Cmd+K / Ctrl+K 触发） */
  togglePalette: () => void;

  setQuery: (q: string) => void;
  setSelectedIndex: (i: number) => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  query: '',
  selectedIndex: 0,

  openPalette: () => set({ open: true, query: '', selectedIndex: 0 }),
  closePalette: () => set({ open: false, query: '', selectedIndex: 0 }),
  togglePalette: () =>
    set((s) =>
      s.open
        ? { open: false, query: '', selectedIndex: 0 }
        : { open: true, query: '', selectedIndex: 0 },
    ),

  setQuery: (q) => set({ query: q, selectedIndex: 0 }),
  setSelectedIndex: (i) => set({ selectedIndex: i }),
}));
