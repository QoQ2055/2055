/**
 * ui-v2 PR-2 · Tooltip 辅助组件
 *
 * 设计（V2-I-3 ★ 6 atoms 锁定 + V2-I-4 ★ 不加第 7 atom）：
 *   • Tooltip 不算 atom · 是 feedback 辅助组件 · 放 components/ui/feedback/ 隔离
 *   • 渲染层用现有 token：bg-elevated / border-border-default / fg-primary
 *   • 不用第三方依赖（避免 bundle 增加）· 纯 CSS hover + group
 *
 * a11y（V2-I-8）：
 *   • aria-describedby 关联（如果 children 是 button/input · 用户可读屏获知 tip）
 *   • title 同步保留（兼容键盘焦点 + 旧工具）
 *
 * 使用：
 *   <Tooltip text="保存到云端">
 *     <Button variant="primary"><Save /></Button>
 *   </Tooltip>
 *
 * 不变量：
 *   • 不替代原生 title 浏览器气泡（浏览器原生气泡仍工作 · Tooltip 是补充）
 *   • 不强制集成所有 title=（surgical · 用户感知后扩展）
 */

import { useId, useState } from 'react';
import clsx from 'clsx';

export interface TooltipProps {
  /** Tooltip 内容（字符串 · 不支持 JSX 复杂内容 · 复杂场景用 Modal） */
  text: string;
  /** 子元素：触发悬浮的元素（必须是单一 ReactElement） */
  children: React.ReactNode;
  /** 位置：top（默认）/ bottom / left / right */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** 显示延迟 ms（默认 300） */
  delay?: number;
  /** 是否禁用 tooltip（仍渲染 children） */
  disabled?: boolean;
  /** 额外 className（加到外层 wrapper） */
  className?: string;
}

const POSITION_CLASS: Record<NonNullable<TooltipProps['position']>, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-1',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1',
  left:   'right-full top-1/2 -translate-y-1/2 mr-1',
  right:  'left-full top-1/2 -translate-y-1/2 ml-1',
};

export function Tooltip({
  text,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  if (disabled || !text) {
    return <>{children}</>;
  }

  let timer: number | undefined;

  const handleEnter = () => {
    if (typeof window === 'undefined') return;
    timer = window.setTimeout(() => setOpen(true), delay);
  };
  const handleLeave = () => {
    if (timer) window.clearTimeout(timer);
    setOpen(false);
  };

  return (
    <span
      className={clsx('relative inline-flex', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <span aria-describedby={open ? tipId : undefined}>{children}</span>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className={clsx(
            'absolute z-50 px-2 py-1 rounded',
            'bg-elevated border border-border-default',
            'text-fg-primary text-tight-xs whitespace-nowrap',
            'shadow-lg pointer-events-none',
            'animate-in fade-in duration-100',
            POSITION_CLASS[position],
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
