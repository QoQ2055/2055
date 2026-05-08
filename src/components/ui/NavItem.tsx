import * as React from 'react';
import { NavLink, type NavLinkProps } from 'react-router-dom';
import { prefetchRoute } from '../../router.prefetch';

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
  /**
   * Studio Calm A.4 · 折叠态：仅显示 icon · children 文本以 title 提示出现
   * V2-I-3 兼容扩展 · 默认 false 时行为完全等同旧版 · 不影响既有调用
   */
  collapsed?: boolean;
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-7 px-2 text-body-s gap-1.5',
  md: 'h-8 px-3 text-body-m gap-2',
};

const SIZE_CLASS_COLLAPSED: Record<Size, string> = {
  sm: 'h-7 w-7 justify-center',
  md: 'h-8 w-8 justify-center',
};

export function NavItem({
  size = 'md', icon, className = '', children, collapsed = false, ...rest
}: NavItemProps) {
  // 折叠态文本作为 title（仅当 children 是 string）· 提供悬停提示
  const titleText = collapsed && typeof children === 'string' ? children : undefined;

  // ui-v6 PR-8 · hover 触发路由 chunk 预取 · 真实点击时已 cached · 消除 fallback 闪现
  // 仅当 to 是字符串路径时触发（router.prefetch 注册表用字符串 key）
  // 兼容用户传入的 onMouseEnter（如有 · 先调用我们的 prefetch · 再调用用户的）
  const userOnMouseEnter = rest.onMouseEnter;
  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const to = rest.to;
      if (typeof to === 'string') {
        prefetchRoute(to);
      }
      userOnMouseEnter?.(e);
    },
    [rest.to, userOnMouseEnter],
  );

  return (
    <NavLink
      {...rest}
      onMouseEnter={handleMouseEnter}
      title={titleText}
      className={({ isActive }) => {
        const base = collapsed
          ? `inline-flex items-center rounded-sm font-medium transition-colors ${SIZE_CLASS_COLLAPSED[size]}`
          : `inline-flex items-center rounded-sm font-medium transition-colors ${SIZE_CLASS[size]}`;
        const state = isActive
          ? 'bg-primary-500/10 text-primary-400 font-semibold'
          : 'text-fg-secondary hover:bg-elevated hover:text-fg-primary';
        return `${base} ${state} ${className}`.trim();
      }}
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
    </NavLink>
  );
}

/** 侧栏分组标签（"通用"那种），label-m 排版 (DESIGN.md sectionLabel) */
export interface NavSectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Studio Calm A.4 · 折叠态：渲染为分隔线 · 隐藏文字 */
  collapsed?: boolean;
}
export function NavSectionLabel({
  className = '', collapsed = false, children, ...rest
}: NavSectionLabelProps) {
  if (collapsed) {
    return (
      <div className={`mx-2 my-2 border-t border-border-subtle ${className}`.trim()} {...rest} />
    );
  }
  return (
    <div
      className={`px-3 pt-4 pb-1 text-label-m uppercase text-fg-muted ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
