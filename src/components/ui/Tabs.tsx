import * as React from 'react';

/**
 * Design system Tabs · DESIGN.md components.tab
 *
 * 同页内多视图切换。两套视觉变体：
 * - `underline` 默认，下划线高亮（DESIGN.md tab.item）
 * - `pill`      圆胶囊高亮（DESIGN.md tab.pill），用于过滤芯片
 *
 * **使用边界**:
 * - 同一上下文的多视图（如 Pipeline 的 stages tabs / Settings 分组）
 * - 不要切换不相关页面（用 NavItem）
 * - 同一页 ≤ 1 套主 tabs；二级 tabs 可用 pill
 *
 * 不依赖外部 Tab 库，受控组件。
 */

export interface TabItem<V extends string = string> {
  value: V;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** 右上角小角标（数字 / 状态点） */
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps<V extends string = string> {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  variant?: 'underline' | 'pill';
  size?: 'sm' | 'md';
  className?: string;
  /** ARIA label，给 tablist 用 */
  ariaLabel?: string;
}

export function Tabs<V extends string = string>({
  items, value, onChange, variant = 'underline', size = 'md', className = '', ariaLabel,
}: TabsProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={
        variant === 'underline'
          ? `flex items-end gap-1 border-b border-border-subtle ${className}`.trim()
          : `flex items-center gap-1.5 ${className}`.trim()
      }
    >
      {items.map((item) => {
        const active = item.value === value;
        const baseHeight = size === 'sm' ? 'h-8' : 'h-9';
        const baseFont = size === 'sm' ? 'text-body-s' : 'text-body-m';

        if (variant === 'pill') {
          const cls = [
            'inline-flex items-center gap-1.5 rounded-pill px-3 transition-colors font-medium',
            size === 'sm' ? 'h-7 text-caption-m' : 'h-8 text-body-s',
            active
              ? 'bg-primary-500 text-fg-on-primary'
              : 'bg-elevated text-fg-secondary hover:text-fg-primary',
            item.disabled && 'opacity-50 cursor-not-allowed',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={item.disabled}
              className={cls}
              onClick={() => onChange(item.value)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge}
            </button>
          );
        }

        // underline variant
        const cls = [
          'inline-flex items-center gap-2 px-3 transition-colors font-medium border-b-2',
          baseHeight, baseFont,
          active
            ? 'text-primary-400 border-primary-500'
            : 'text-fg-secondary border-transparent hover:text-fg-primary',
          item.disabled && 'opacity-50 cursor-not-allowed',
        ].filter(Boolean).join(' ');
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={cls}
            onClick={() => onChange(item.value)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
