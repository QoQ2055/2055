/**
 * ui-v2 PR-2 · feedback 辅助组件 barrel
 *
 * 与 6 atoms 隔离（V2-I-3 / V2-I-4 不变）：
 *   • atoms 目录：src/components/ui/{Button,Input,Textarea,Card,Modal,NavItem,Tabs}.tsx
 *   • feedback 目录：src/components/ui/feedback/*
 *
 * 当前包含：
 *   • ToastContainer  全局 Toast 队列（在 Layout 渲染一次 · 通过 store/toast.ts 调用）
 *   • Tooltip         hover 气泡（替代原生 title · a11y 友好）
 *   • Skeleton + SkeletonText  加载占位符（替代手写 animate-pulse）
 *   • EmptyState      空数据展示（替代散落的"暂无内容" div）
 *
 * 使用：参考各文件顶部 JSDoc。
 */

export { ToastContainer } from './Toast';
export { Tooltip, type TooltipProps } from './Tooltip';
export { Skeleton, SkeletonText, type SkeletonProps } from './Skeleton';
export { EmptyState, type EmptyStateProps } from './EmptyState';
