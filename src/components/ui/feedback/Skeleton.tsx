/**
 * ui-v2 PR-2 · Skeleton 加载占位符
 *
 * 设计（V2-I-3 / V2-I-4 不变 · 不算 atom）：
 *   • 替代直接用 `animate-pulse` + bg-gray 自实现的占位符
 *   • 统一 token：bg-elevated（DESIGN.md elevation 1）+ animate-pulse
 *   • 3 种预设：text / circle / box · 满足 90% 场景
 *
 * 使用：
 *   // 单行文本占位
 *   <Skeleton variant="text" className="w-3/4" />
 *
 *   // 圆形头像
 *   <Skeleton variant="circle" className="size-10" />
 *
 *   // 矩形卡片
 *   <Skeleton variant="box" className="h-32 w-full" />
 *
 *   // 多行文本
 *   <SkeletonText lines={3} />
 *
 * 不变量：
 *   • aria-busy=true · 屏幕阅读器知道在加载（V2-I-8）
 *   • 不是 spinner · spinner 留给 Loader2 lucide icon（按钮内或单点 loading）
 *   • Skeleton 用于"区域级"占位（list / card / panel）
 */

import clsx from 'clsx';

export interface SkeletonProps {
  /** 形状：text（默认 · 文本行）/ circle（圆形）/ box（矩形） */
  variant?: 'text' | 'circle' | 'box';
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text:   'h-4 rounded',
  circle: 'rounded-full',
  box:    'rounded-md',
};

export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="加载中"
      className={clsx(
        'animate-pulse bg-elevated',
        VARIANT_CLASS[variant],
        className,
      )}
    />
  );
}

/**
 * 多行文本占位（最常见 list/article 场景）
 *
 * @example
 *   <SkeletonText lines={3} />  // 3 行 · 最后一行 60% 宽
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="加载中" className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={clsx('w-full', i === lines - 1 && lines > 1 && 'w-3/5')}
        />
      ))}
    </div>
  );
}
