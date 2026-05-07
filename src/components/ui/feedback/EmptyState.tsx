/**
 * ui-v2 PR-2 · EmptyState 空数据占位
 *
 * 设计（V2-I-3 / V2-I-4 不变 · 不算 atom）：
 *   • 统一空数据展示：icon + 标题 + 副文 + 可选 CTA
 *   • 替代散落的 "无匹配项目" / "尚未生成" / "暂无内容" div
 *   • 用户感知：发现 list/page 为空时 · 知道下一步该做什么
 *
 * 使用：
 *   <EmptyState
 *     icon={FileText}
 *     title="尚未生成方案"
 *     description="完成 S1 步骤后会自动生成"
 *     action={<Button onClick={runS1}>立即生成</Button>}
 *   />
 *
 *   // 简化版
 *   <EmptyState title="无匹配项" />
 *
 * 不变量：
 *   • title 必填（无 title 不应该用 EmptyState）
 *   • icon 可选 · 但建议加（视觉锚点）
 *   • 不替代 error 状态（错误用 Toast / inline danger banner）
 */

import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface EmptyStateProps {
  /** 标题（必填 · 描述空状态本质 e.g. "尚无章节" "无搜索结果"） */
  title: string;
  /** 副文（可选 · 引导下一步） */
  description?: string;
  /** Lucide 图标（可选 · 视觉锚点） */
  icon?: LucideIcon;
  /** CTA（可选 · 通常是 <Button> ） */
  action?: React.ReactNode;
  /** 紧凑模式（小 padding · 适合 panel 内）· 默认 false（适合 page 中央） */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={clsx(
        'flex flex-col items-center text-center',
        compact ? 'py-6 gap-2' : 'py-12 gap-3',
        className,
      )}
    >
      {Icon && (
        <Icon className={clsx('text-fg-muted', compact ? 'size-6' : 'size-10')} />
      )}
      <div className={clsx('font-medium text-fg-primary', compact ? 'text-tight-sm' : 'text-body-m')}>
        {title}
      </div>
      {description && (
        <div className={clsx('text-fg-secondary leading-relaxed max-w-md', compact ? 'text-tight-xs' : 'text-tight-sm')}>
          {description}
        </div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
