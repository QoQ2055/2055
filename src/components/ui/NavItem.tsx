import * as React from 'react';
import { NavLink, type NavLinkProps } from 'react-router-dom';

/**
 * Design system NavItem · DESIGN.md components.nav.item
 *
 * 侧栏 / 顶栏路由级入口，封装 react-router NavLink 的 active 态样式。
 * Active 用 primary 系（暗 primary.400 / 亮 primary.700）+ 12% alpha 背景。
 *
 * **使用边界**:
 * - 仅用于路由跳转（NavLink 语义）
 * - 不要塞功能按钮（功能用 <Button>）
 * - height 固定 32px（DESIGN.md 锁定，保侧栏密度）
 *
 * 当前 Layout.tsx 已用 inline className 实现等价样式；本组件给 Phase 4
 * 重做 Layout 或新增 nav 区块（顶栏 / 二级 nav）时复用。
 */

type Size = 'sm' | 'md';

export interface NavItemProps extends Omit<NavLinkProps, 'className' | 'children'> {
  size?: Size;
  /** 前置 icon (lucide-react 等) */
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-7 px-2 text-body-s gap-1.5',
  md: 'h-8 px-3 text-body-m gap-2',
};

export function NavItem({
  size = 'md', icon, className = '', children, ...rest
}: NavItemProps) {
  return (
    <NavLink
      {...rest}
      className={({ isActive }) => {
        const base = `inline-flex items-center rounded-sm font-medium transition-colors ${SIZE_CLASS[size]}`;
        const state = isActive
          ? 'bg-primary-500/10 text-primary-400 font-semibold'
          : 'text-fg-secondary hover:bg-elevated hover:text-fg-primary';
        return `${base} ${state} ${className}`.trim();
      }}
    >
      {icon}
      <span className="truncate">{children}</span>
    </NavLink>
  );
}

/** 侧栏分组标签（"通用"那种），label-m 排版 (DESIGN.md sectionLabel) */
export function NavSectionLabel({
  className = '', ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-3 pt-4 pb-1 text-label-m uppercase text-fg-muted ${className}`.trim()}
      {...rest}
    />
  );
}
