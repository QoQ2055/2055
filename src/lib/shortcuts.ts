/**
 * ui-v3 PR-1B · 快捷键工具函数
 *
 * 核心 API：
 *   • isEditingTarget(e) · 判断当前焦点是否在 input/textarea/contenteditable
 *     用于决定全局快捷键是否禁用（避免抢用户输入）
 *   • isModifierShortcut(e) · 判断是否带 Cmd/Ctrl modifier
 *     即使在输入态也允许 Cmd+S / Cmd+K 这类组合键触发
 */

export function isEditingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

export function isModifierShortcut(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

/** 同时判断是 Cmd（mac）或 Ctrl（其它）+ key · 不区分大小写 */
export function isCtrlOrCmd(e: KeyboardEvent, key: string): boolean {
  if (!isModifierShortcut(e)) return false;
  return e.key.toLowerCase() === key.toLowerCase();
}
