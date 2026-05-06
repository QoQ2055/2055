import * as React from 'react';

/**
 * Design system Input · DESIGN.md components.input
 *
 * 封装 src/index.css 的 `.input / .input-sm / .input-error` 配方。
 *
 * **使用边界**:
 * - 仅用于**表单字段**（搜索 / 短文本 / 数字 / 邮箱等）
 * - 长文本用 `<Textarea>`，不要给 `.input` 改 height
 * - 展示 artifact ID / 路径用 `<code>` 排版，不要把它套进 input
 */

type Size = 'sm' | 'md';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 尺寸，默认 md (h-9 px-3) */
  size?: Size;
  /** error=true 时套用 `.input-error`（红边框 + 红焦点环） */
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', error = false, className = '', ...rest },
  ref,
) {
  const cls = ['input', size === 'sm' && 'input-sm', error && 'input-error', className]
    .filter(Boolean)
    .join(' ');
  return <input ref={ref} className={cls} aria-invalid={error || undefined} {...rest} />;
});
