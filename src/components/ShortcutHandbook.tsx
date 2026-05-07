/**
 * ui-v3 PR-1B · 快捷键手册 Modal
 *
 * 触发：Layout.tsx 全局 keydown · 按 ? (Shift+/) · 仅在非 input focus 时
 *
 * 内容：
 *   • 全局快捷键 4 条：Cmd+K · ? · Cmd+S · Esc
 *   • Novel 页快捷键 2 条：J · K
 *
 * 不变量：
 *   • V3-I-7 / DESIGN.md ⑥：kbd 用 border + text-fg-muted · 不用纯色块
 *   • V3-I-2 不抢系统快捷键：本 modal 不注册任何键 · 仅展示
 *   • V2-I-3/4：不动 6 atoms · 不加第 7 atom · 本组件是 page-level component
 */

import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useShortcutHandbook } from '../store/shortcutHandbook';
import { Button } from './ui/Button';

interface ShortcutEntry {
  keys: string[]; // 例如 ['Cmd', 'K'] 或 ['Ctrl', 'K']
  desc: string;
}

interface ShortcutGroup {
  title: string;
  hint?: string;
  entries: ShortcutEntry[];
}

const isMac =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test(navigator.userAgent);

const mod = isMac ? 'Cmd' : 'Ctrl';

const GROUPS: ShortcutGroup[] = [
  {
    title: '全局',
    hint: '可在任意页面使用',
    entries: [
      { keys: [mod, 'K'], desc: '打开命令面板（搜索 + 跳转）' },
      { keys: ['?'], desc: '显示本快捷键手册' },
      { keys: [mod, 'S'], desc: '提示已自动保存（无需手动）' },
      { keys: ['Esc'], desc: '关闭弹层 / 退出当前 modal' },
    ],
  },
  {
    title: '小说工坊',
    hint: '仅在 /novel 页面生效',
    entries: [
      { keys: ['J'], desc: '下一章节（章节编辑视图）' },
      { keys: ['K'], desc: '上一章节（章节编辑视图）' },
    ],
  },
];

export function ShortcutHandbook() {
  const { open, hide } = useShortcutHandbook();

  // Esc 关闭（局部监听 · 不与全局 Esc 冲突）
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        hide();
      }
    }
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [open, hide]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={hide}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-handbook-title"
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <Keyboard className="size-4 text-fg-muted" />
          <div id="shortcut-handbook-title" className="font-semibold text-sm flex-1">
            快捷键手册
          </div>
          <Button variant="ghost" iconOnly size="sm" onClick={hide} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-auto p-4 space-y-5 text-sm">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="font-semibold text-fg-primary">{group.title}</h3>
                {group.hint && (
                  <span className="text-xs text-fg-muted">· {group.hint}</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {group.entries.map((entry, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-1"
                  >
                    <span className="text-fg-secondary">{entry.desc}</span>
                    <span className="flex gap-1 shrink-0">
                      {entry.keys.map((k, idx) => (
                        <kbd
                          key={idx}
                          className="px-2 py-0.5 text-tight-xs font-mono border border-border-subtle rounded text-fg-muted bg-surface/50"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div className="pt-2 border-t border-border-subtle text-tight-xs text-fg-muted">
            提示：在输入框 / textarea 内时全局快捷键自动禁用 · 仅 {mod}+S / {mod}+K 类组合键仍生效。
          </div>
        </div>
      </div>
    </div>
  );
}
