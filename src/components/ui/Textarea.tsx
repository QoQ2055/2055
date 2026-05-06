import * as React from 'react';

/**
 * Design system Textarea · DESIGN.md components.input.sizes.textarea
 *
 * 封装 src/index.css 的 `.textarea` 配方（min-h-24 + 可垂直拉伸）。
 *
 * **使用边界**:
 * - 用于多行文本输入（KB 注入、prompt 编辑、章节草稿等）
 * - 不要靠 rows 控制高度，用 className 加 `min-h-X` / `max-h-X` 覆盖
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** error=true 时套用 `.input-error`（红边框 + 红焦点环） */
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error = false, className = '', ...rest },
  ref,
) {
  const cls = ['textarea', error && 'input-error', className].filter(Boolean).join(' ');
  return <textarea ref={ref} className={cls} aria-invalid={error || undefined} {...rest} />;
});
