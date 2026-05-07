/**
 * gap-e PR-2 · 全局导出抽屉状态
 *
 * 把 PR-1 的 3 处局部 useState 提升到全局 zustand · 让：
 *   • Home / Novel / Screenplay toolbar 仍能触发（show('all'/'novel'/'screenplay')）
 *   • Command Palette 能调起（解锁 ui-v3 PR-1B 延后项"跨组件操作类命令"）
 *   • 任何后续入口都可一行接入（无需 props drilling）
 *
 * **设计**：
 *   • 单实例 · Layout 顶层挂全局 ExportDrawer · 同一时刻只 1 个抽屉
 *   • mode 由调用方决定显示顺序（all/novel/screenplay）
 *   • ctx + artifacts 由 Layout 内部从 useProject 读取 · store 不持有项目数据（避免双源）
 *
 * **不变量**：
 *   • V3-I-4 不静默：错误仍由 ExportDrawer 内 toast.error 处理
 *   • V2-I-3/4 6 atoms 不动 · ExportDrawer 仍是 page-level component
 */

import { create } from 'zustand';
import type { ExportMode } from '../components/ExportDrawer';

interface ExportDrawerState {
  open: boolean;
  mode: ExportMode;
  show: (mode?: ExportMode) => void;
  hide: () => void;
}

export const useExportDrawer = create<ExportDrawerState>((set) => ({
  open: false,
  mode: 'all',
  show: (mode = 'all') => set({ open: true, mode }),
  hide: () => set({ open: false }),
}));
