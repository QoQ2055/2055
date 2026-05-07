/**
 * ui-v3 PR-1C · ConfirmDialog 状态管理 + Promise API
 *
 * 替代浏览器原生 confirm() · 全站统一 token 配色 · 不阻塞 UI 主线程。
 *
 * **API**：
 *   const ok = await confirm({
 *     title: '删除项目',
 *     message: '此操作不可撤销',
 *     confirmLabel: '删除',
 *     danger: true,
 *   });
 *   if (!ok) return;
 *
 * **设计要点**：
 *   • 同时只能开 1 个 ConfirmDialog · 后续 ask 会等前一个 resolve（Promise 排队由调用方负责）
 *   • Esc / 点遮罩 / 取消按钮 → resolve(false)
 *   • Enter / 确认按钮 → resolve(true)
 *   • danger=true · 确认按钮用 Button variant="danger" 红色（DESIGN.md ⑥ 语义色）
 *
 * **不变量**：
 *   • V2-I-4 不加第 7 atom：ConfirmDialog 是 feedback 类 page-level component（同 Toast/Tooltip）
 *   • V3-I-4 不静默：调用方拒绝时返回 false · 不抛 · 不吞错
 *   • DESIGN.md ⑥：danger 变体强调危险操作 · 颜色 + 文字双通道
 */

import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  /** 详细说明 · 可多行（用 \n 分隔） · 留空则仅 title */
  message?: string;
  /** 确认按钮文字 · 默认"确认" */
  confirmLabel?: string;
  /** 取消按钮文字 · 默认"取消" */
  cancelLabel?: string;
  /** 危险操作（删除 / 清空 / 不可撤销）· 确认按钮用 danger variant */
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  accept: () => void;
  reject: () => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      // 若已有未 resolve 的 confirm · 直接 reject 旧的（同时只允许 1 个）
      const prev = get().resolve;
      if (prev) prev(false);
      set({ open: true, options, resolve });
    }),
  accept: () => {
    const { resolve } = get();
    resolve?.(true);
    set({ open: false, options: null, resolve: null });
  },
  reject: () => {
    const { resolve } = get();
    resolve?.(false);
    set({ open: false, options: null, resolve: null });
  },
}));

/** 便捷调用：`if (!await confirm({ title, danger: true })) return` */
export const confirm = (options: ConfirmOptions) =>
  useConfirm.getState().ask(options);
