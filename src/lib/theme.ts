/**
 * ui-v4 PR-1 · 主题应用工具
 *
 * 三档主题模式（settings.theme）：
 *   • 'light'  → 移除 html.dark · 使用 :root 变量
 *   • 'dark'   → 添加 html.dark · 使用 .dark 变量
 *   • 'system' → 监听 matchMedia('(prefers-color-scheme: dark)') 自动切换
 *
 * **设计**：
 *   • CSS 变量已就位（src/index.css :root + .dark 双套）· 仅切 html.dark class
 *   • main.tsx 启动时 install() 一次（避 FOUC · 在 React 渲染前）
 *   • Layout.tsx 内 useThemeEffect() 订阅 settings.theme 变化 + system change
 *   • 持久化由 settings.ts 的 zustand persist 自动完成（localStorage）
 *
 * **不变量**：
 *   • V3-I-1 路由不动 · 仅修改 documentElement.classList
 *   • V3-I-4 不静默 · matchMedia 不可用降级 'light' + console.warn
 *   • DESIGN.md ① · 不引入新 hex · 仅在已有 token 之间切换
 */

import { useEffect } from 'react';
import { useSettings, type ThemeMode } from '../store/settings';

const DARK_CLASS = 'dark';

function getSystemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    console.warn('[theme] matchMedia not supported · fallback to dark', e);
    return true; // 项目默认 dark · 回退保持一致
  }
}

/** 返回当前 theme 应解析为的物理主题（实际是亮还是暗） */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return getSystemPrefersDark() ? 'dark' : 'light';
}

/** 立即把 theme mode 应用到 <html> · 副作用函数 · 调用方负责时机 */
export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
  // color-scheme meta 与之同步（让浏览器原生控件 · 滚动条 · 表单也跟随）
  root.style.colorScheme = resolved;
}

/**
 * main.tsx 启动时调一次 · 在 React render 前安装初始主题（避 FOUC）
 *
 * 直接读 localStorage 'FLIL.settings' · 因为 zustand persist 异步 hydrate ·
 * 等到 React 渲染时已经晚了一帧。
 */
export function installInitialTheme(): void {
  let mode: ThemeMode = 'dark'; // 默认（与 index.html `class="dark"` 对齐）
  try {
    const raw = localStorage.getItem('FLIL.settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const t = parsed?.state?.theme;
      if (t === 'light' || t === 'dark' || t === 'system') {
        mode = t;
      }
    }
  } catch (e) {
    console.warn('[theme] read FLIL.settings failed · use default dark', e);
  }
  applyTheme(mode);
}

/**
 * React hook · 订阅 settings.theme + system change · 实时同步 html.dark
 *
 * 用法：Layout.tsx 顶层调一次（单实例 · 不嵌套）
 */
export function useThemeEffect(): void {
  const theme = useSettings((s) => s.theme);

  // 主题模式变化 → 立即 apply
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // system 模式时 · 监听 prefers-color-scheme 变化
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);
}
