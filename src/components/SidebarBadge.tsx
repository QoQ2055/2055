/**
 * ui-v3 PR-2 · Sidebar status badge
 *
 * 一个小尺寸 pill / dot · 叠在 NavItem 右侧 · 用于提示该路径有待办：
 *   • danger  · 红 + 数字   · pending lessons / 未读告警
 *   • warning · 黄 + icon   · 配置缺失（如 API key 未配）
 *   • info    · 蓝 + 数字   · 新内容 / 增量
 *
 * 不变量（DESIGN.md ⑥ 严守 + V3-I-3）：
 *   • 用 token semantic.danger/warning/info bg 与 fg · 不裸色
 *   • 配 icon 或文字 · 不只靠颜色（色盲友好）
 *   • ≥ 10 显示 "9+"
 *   • caption-m 字号（11px）· 圆角 full
 *   • 不修改 NavItem 内部 · 通过外层 relative wrapper + absolute 定位
 *
 * 使用：
 *   <div className="relative">
 *     <NavItem ...>...</NavItem>
 *     <SidebarBadge variant="danger" count={pendingCount} />
 *   </div>
 */

import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

type Variant = 'danger' | 'warning' | 'info';

interface SidebarBadgeProps {
  variant: Variant;
  /** 数字模式（variant=danger / info）· 0 时不渲染 */
  count?: number;
  /** dot 模式（无数字 · 仅圆点）· variant=warning 时常用 */
  dot?: boolean;
  /** 强制隐藏（条件渲染语义糖） */
  hidden?: boolean;
  className?: string;
}

const VARIANT_CLASS: Record<Variant, string> = {
  // V3-I-7 / DESIGN.md ⑥：用 semantic token + 黑/白对比文字（项目无 fg-on-* 系列 · text-white/canvas 是基础色非裸 hex）
  danger: 'bg-danger text-white',
  warning: 'bg-warning text-canvas',
  info: 'bg-info text-white',
};

export function SidebarBadge({
  variant, count, dot = false, hidden = false, className = '',
}: SidebarBadgeProps) {
  if (hidden) return null;

  // 数字 0 / undefined → 不渲染（除非 dot 模式）
  if (!dot && (count == null || count <= 0)) return null;

  const display = dot
    ? null
    : count! >= 10
      ? '9+'
      : String(count);

  if (dot) {
    return (
      <span
        className={clsx(
          'absolute right-2 top-1/2 -translate-y-1/2 size-2 rounded-full pointer-events-none',
          VARIANT_CLASS[variant],
          className,
        )}
        aria-label={variant === 'warning' ? '需要配置' : '提示'}
        role="status"
      />
    );
  }

  return (
    <span
      className={clsx(
        'absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center',
        'min-w-4 h-4 px-1 rounded-full text-tight-xs font-semibold leading-none',
        'pointer-events-none',
        VARIANT_CLASS[variant],
        className,
      )}
      aria-label={`${count} 项待处理`}
      role="status"
    >
      {variant === 'warning' && <AlertTriangle className="size-2.5 mr-0.5" />}
      {display}
    </span>
  );
}
