/**
 * ui-v3 PR-1C · ConfirmDialog · 全局确认对话框
 *
 * 渲染：Layout.tsx 全局挂载 · 单实例 · 由 useConfirm store 驱动
 * 触发：业务代码 await confirm({ title, message, danger?: true })
 *
 * 交互：
 *   • Esc / 点遮罩 / 取消按钮 → reject (false)
 *   • Enter / 确认按钮          → accept (true)
 *   • Tab 焦点循环（最简实现 · 浏览器默认）
 *   • 打开时自动 focus 确认按钮（用户多数场景按 Enter 即可）
 *
 * 不变量：
 *   • V3-I-7 / DESIGN.md ⑥：danger 用 Button variant="danger" · 颜色+文字双通道
 *   • V2-I-3 / V2-I-4：复用 Button atom · 不动 6 atoms · 本组件是 page-level
 */

import { useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useConfirm } from '../store/confirm';
import { Button } from './ui/Button';

export function ConfirmDialog() {
  const open = useConfirm((s) => s.open);
  const options = useConfirm((s) => s.options);
  const accept = useConfirm((s) => s.accept);
  const reject = useConfirm((s) => s.reject);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // 打开时聚焦确认按钮 + Esc / Enter 监听
  useEffect(() => {
    if (!open) return;
    confirmBtnRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        reject();
      } else if (e.key === 'Enter') {
        // 仅当焦点不在 textarea / 多行输入时触发（confirm 内无此控件 · 简化）
        e.stopPropagation();
        accept();
      }
    }
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [open, accept, reject]);

  if (!open || !options) return null;

  const Icon = options.danger ? AlertTriangle : HelpCircle;
  const iconColor = options.danger ? 'text-danger' : 'text-fg-muted';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 anim-modal-backdrop"
      onClick={reject}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={options.message ? 'confirm-dialog-message' : undefined}
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg max-w-md w-full shadow-xl anim-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header + title */}
        <div className="flex items-start gap-3 p-4 border-b border-border-subtle">
          <Icon className={`size-5 mt-0.5 shrink-0 ${iconColor}`} />
          <div className="flex-1 min-w-0">
            <div
              id="confirm-dialog-title"
              className="font-semibold text-sm text-fg-primary"
            >
              {options.title}
            </div>
            {options.message && (
              <div
                id="confirm-dialog-message"
                className="mt-1.5 text-tight-sm text-fg-secondary whitespace-pre-line break-words leading-relaxed"
              >
                {options.message}
              </div>
            )}
          </div>
        </div>

        {/* footer · 按钮 */}
        <div className="flex justify-end gap-2 p-3 bg-surface/30 rounded-b-lg">
          <Button variant="ghost" size="sm" onClick={reject}>
            {options.cancelLabel ?? '取消'}
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={options.danger ? 'danger' : 'primary'}
            size="sm"
            onClick={accept}
          >
            {options.confirmLabel ?? '确认'}
          </Button>
        </div>
      </div>
    </div>
  );
}
