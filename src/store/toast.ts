/**
 * ui-v2 PR-2 · Toast 通知 zustand store
 *
 * 设计：
 *   • 全局唯一队列（fixed top-right 渲染 · 见 components/ui/feedback/Toast.tsx）
 *   • 4 种 kind：info / success / warning / error
 *   • 默认 4s 自动消失 · error 不自动消失（用户必须点 X 关闭）
 *   • 显式 toast.* helper · 不需要 hook · 任意位置可调用（替代 alert()）
 *
 * 不变量（V2-I-4 不变 · 不算 atom · 是 feedback 辅助组件）：
 *   • 不按 projectId 分桶（全局通知 · 切项目不清队列）
 *   • 不持久化（刷新页面清空 · localStorage 噪音少）
 *   • 不限制队列长度（用户感知期内不会爆 · 后续可加 max=5 LRU）
 *
 * 使用：
 *   import { toast } from '../store/toast';
 *   toast.error('保存失败：' + e.message);
 *   toast.success('导入完成');
 */

import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** 自动消失时间 ms · null = 不自动消失 */
  duration: number | null;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, opts?: { kind?: ToastKind; duration?: number | null }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, opts = {}) => {
    const id = Math.random().toString(36).slice(2, 10);
    const kind = opts.kind ?? 'info';
    const duration = opts.duration === undefined ? (kind === 'error' ? null : 4000) : opts.duration;
    const t: Toast = { id, kind, message, duration, createdAt: Date.now() };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (duration !== null && typeof window !== 'undefined') {
      window.setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Convenience helpers · 任意位置导入即用 · 无需 hook
 *
 * 示例：
 *   toast.error('网络错误')        // 不自动消失
 *   toast.success('已保存')        // 4s 后自动消失
 *   toast.info('xxx', null)        // 不自动消失
 *   toast.warning('xxx', 8000)     // 8s 后消失
 */
export const toast = {
  info: (message: string, duration?: number | null) =>
    useToast.getState().show(message, { kind: 'info', duration }),
  success: (message: string, duration?: number | null) =>
    useToast.getState().show(message, { kind: 'success', duration }),
  warning: (message: string, duration?: number | null) =>
    useToast.getState().show(message, { kind: 'warning', duration }),
  error: (message: string, duration?: number | null) =>
    useToast.getState().show(message, { kind: 'error', duration }),
};
