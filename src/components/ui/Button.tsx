import * as React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Design system Button · DESIGN.md components.button
 *
 * 这是 Phase 3.1 引入的 token 驱动按钮组件，封装 src/index.css 里的
 * `.btn-primary / -secondary / -outline / -ghost / -danger / -icon` 配方。
 *
 * **使用边界**:
 * - **新代码**: 一律用 `<Button>`，不要再写 `<button className="btn-primary">`
 * - **现存代码**: 不要主动迁移（surgical changes 原则）。Phase 4 重做页面时按需替换。
 * - **不要**用它做 link 跳转（用 `<Link>` + 自定义样式或这里加 `as` prop V2）。
 *
 * **变体边界**（DESIGN.md 锁定 6 个，不要造第 7 个）:
 * - `primary`   主 CTA，每个页面 ≤ 1 个
 * - `secondary` 副 CTA（teal accent），可与 primary 并列
 * - `outline`   次要操作（边框 + 透明背景）
 * - `ghost`     最低视觉权重（无边框无背景，仅 hover 显出）
 * - `danger`    破坏性操作（删除、取消）
 * - `iconOnly`  无文字单 icon 按钮，正方形 32×32
 */

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  outline:   'btn-outline',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 视觉变体，默认 primary */
  variant?: Variant;
  /** 尺寸，默认 md (h-8 px-4 text-body-m) */
  size?: Size;
  /** loading=true 时显示 spinner 并 disable 按钮 */
  loading?: boolean;
  /** 单 icon 模式：正方形 32×32，忽略 variant/size，使用 .btn-icon 配方 */
  iconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, iconOnly = false, disabled, className = '', children, type, ...rest },
  ref,
) {
  const baseCls = iconOnly
    ? 'btn-icon'
    : [VARIANT_CLASS[variant], SIZE_CLASS[size]].filter(Boolean).join(' ');
  const cls = className ? `${baseCls} ${className}` : baseCls;

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : children}
    </button>
  );
});
