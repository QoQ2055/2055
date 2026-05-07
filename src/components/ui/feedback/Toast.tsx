/**
 * ui-v2 PR-2 · Toast UI 容器
 *
 * 单例 ToastContainer · 在 Layout.tsx 渲染一次 · 监听 useToast store。
 *
 * 设计（V2-I-3 ★ 6 atoms 锁定 + V2-I-4 ★ 不加第 7 atom）：
 *   • Toast 不算 atom · 是 feedback 辅助组件 · 放 components/ui/feedback/ 隔离
 *   • 渲染层用现有 token：surface / border / success / warning / danger / action-primary
 *   • 不污染 src/index.css（V2-I-2）· 全部 utility class 完成
 *
 * a11y（V2-I-8）：
 *   • role="alert" + aria-live="assertive"（error）
 *   • role="status" + aria-live="polite"（其他）
 *   • 关闭按钮带 aria-label
 *
 * 色盲友好（DESIGN.md ⑥）：
 *   • 4 种 kind 都有 icon 区分（不仅靠颜色）：Info / CheckCircle / AlertTriangle / XCircle
 */

import { useToast } from '../../../store/toast';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import clsx from 'clsx';

const KIND_META = {
  info: {
    icon: Info,
    container: 'border-action-primary/40 bg-surface',
    iconColor: 'text-action-primary',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-success/40 bg-success/5',
    iconColor: 'text-success',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-warning/40 bg-warning/5',
    iconColor: 'text-warning',
  },
  error: {
    icon: XCircle,
    container: 'border-danger/40 bg-danger/5',
    iconColor: 'text-danger',
  },
} as const;

export function ToastContainer() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md pointer-events-none">
      {toasts.map((t) => {
        const meta = KIND_META[t.kind];
        const Icon = meta.icon;
        const isError = t.kind === 'error';
        return (
          <div
            key={t.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            className={clsx(
              'pointer-events-auto flex items-start gap-2 px-3 py-2 border rounded-md shadow-lg backdrop-blur-sm',
              'text-fg-primary',
              meta.container,
            )}
          >
            <Icon className={clsx('size-4 flex-none mt-0.5', meta.iconColor)} />
            <div className="flex-1 text-tight-sm whitespace-pre-line break-words leading-relaxed">
              {t.message}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-none p-0.5 rounded text-fg-muted hover:text-fg-primary hover:bg-elevated transition-colors"
              aria-label="关闭通知"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
