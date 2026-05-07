/**
 * ui-v5 PR-1 · 全局项目创建 / 改编 wizard 对话框状态
 *
 * 把 Home.tsx 局部 useState（dialogOpen / wizardOpen / wizardSourceType）提升到全局 ·
 * 让 Command Palette 能从任意路由调起"新建项目"。
 *
 * **解锁项**：ui-v3 PR-1B 文档里标记的最后一个延后项·
 * "新建项目"命令（前两个：导出 / 切换主题 已分别在 gap-e PR-2 / ui-v4 PR-1 解锁）
 *
 * **不变量**：
 *   • V3-I-1 路由不动 · Cmd+K 命令仅 navigate('/') 跳既有路径
 *   • V3-I-4 不静默 · 切到 / 后 setTimeout(0) 触发 open · React render 周期内完成
 *   • V2-I-3/4 6 atoms 不动 · NewProjectDialog 仍渲染在 Home 内（业务 callback 跨页面太复杂）
 *
 * **设计要点**（与 gap-e PR-2 ExportDrawer 模式一致 · 但 dialog 仍由 Home 渲染）：
 *   1. Cmd+K "新建项目" → navigate('/') + setTimeout(0) openCreate
 *   2. Home mount 后从 store 读 createOpen · 不再持有本地 useState
 *   3. Home 内 callback（handleCreate / handleAdaptSubmit）保持不动 · 仅替换 setOpen → store.closeAll
 *
 * **wizard 改编 sourceType**：
 *   • Home 持有 handleStartAdaptWizard 时传 sourceType
 *   • 命令面板可直接调 openWizard(sourceType) · 但 sourceType 字符串依赖 NewProjectDialog
 *     枚举 · 默认 'novel_long'（长篇小说改编）· 命令面板暂不细分（保留默认即可）
 */

import { create } from 'zustand';

interface ProjectDialogState {
  /** 新建项目对话框 */
  createOpen: boolean;
  /** 改编 intake wizard */
  wizardOpen: boolean;
  /** wizard 进入时的 sourceType（'novel_long' 等 · 由 NewProjectDialog 传入） */
  wizardSourceType: string;
  openCreate: () => void;
  openWizard: (sourceType: string) => void;
  closeAll: () => void;
}

export const useProjectDialog = create<ProjectDialogState>((set) => ({
  createOpen: false,
  wizardOpen: false,
  wizardSourceType: 'novel_long',
  openCreate: () => set({ createOpen: true, wizardOpen: false }),
  openWizard: (sourceType) =>
    set({ createOpen: false, wizardOpen: true, wizardSourceType: sourceType }),
  closeAll: () => set({ createOpen: false, wizardOpen: false }),
}));
