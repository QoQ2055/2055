import * as React from 'react';
import { X } from 'lucide-react';

/**
 * Design system Modal · DESIGN.md components.modal
 *
 * 封装 src/index.css 的 `.modal-container` 配方 + bg-overlay token。
 * 保持与现有 NewProjectDialog/ManualInjectDialog/UserKbUploadDialog 的极简模式
 * （fixed inset 条件渲染，无 portal），但加上 ESC + backdrop 点击关闭 + a11y。
 *
 * **使用边界**:
 * - 阻断主流的临时上下文（确认 / 编辑 / 浏览）
 * - 不要把核心流程步骤塞模态——流程要落到独立 page
 * - 大模态（≥ 90vh）考虑改用 Drawer 或 page
 *
 * **size 边界**（modal-container 默认 max-w-modal=560px）:
 * - `sm`   max-w-sm  · 确认对话框
 * - `md`   max-w-modal=560px · 默认
 * - `lg`   max-w-3xl · NewProjectDialog 这种带表单的
 * - `xl`   max-w-5xl · 大型预览（PreviewModal 类）
 */

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-modal',  // 560px
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** ESC 键是否关闭，默认 true。处理 form 时可设 false 防误触 */
  closeOnEsc?: boolean;
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdrop?: boolean;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
  /** 模态语义 label，给 screen reader 用 */
  ariaLabel?: string;
}

export function Modal({
  open, onClose, closeOnEsc = true, closeOnBackdrop = true, size = 'md',
  className = '', children, ariaLabel,
}: ModalProps) {
  React.useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEsc, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4 backdrop-blur-[2px]"
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div className={`modal-container w-full ${SIZE_CLASS[size]} max-h-[92vh] flex flex-col ${className}`.trim()}>
        {children}
      </div>
    </div>
  );
}

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否显示右上角 close 按钮（默认 true） */
  showClose?: boolean;
  onClose?: () => void;
}

export function ModalHeader({
  showClose = true, onClose, className = '', children, ...rest
}: ModalHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-3 border-b border-border-default shrink-0 ${className}`.trim()}
      {...rest}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {showClose && onClose && (
        <button
          type="button"
          className="btn-icon -mr-1.5 shrink-0"
          onClick={onClose}
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function ModalTitle({ className = '', ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-heading-m text-fg-primary ${className}`.trim()} {...rest} />;
}

export function ModalDescription({ className = '', ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-body-s text-fg-muted mt-1 ${className}`.trim()} {...rest} />;
}

export function ModalBody({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex-1 overflow-auto px-5 py-4 ${className}`.trim()} {...rest} />;
}

export function ModalFooter({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-end gap-2 px-5 py-3 border-t border-border-default shrink-0 ${className}`.trim()}
      {...rest}
    />
  );
}
