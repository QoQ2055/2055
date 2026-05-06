import type { Config } from 'tailwindcss';

// Source of truth: DESIGN.md (project root) v0.1.1-alpha
// Phase 2 sync: 把 DESIGN.md frontmatter token 翻译到 Tailwind utilities。
// - Static palettes (primary/secondary/neutral/semantic) 直接 hex 暴露
// - Theme-aware semantic tokens (canvas/surface/fg-*/etc.) 走 CSS 变量，
//   切主题靠 <html class="dark"> 单点开关，变量定义见 src/index.css
// 1206 处既有 bg-zinc-X / text-zinc-X 不破坏 (Tailwind 默认色保留)
// 173 处 bg-brand-X 不破坏 (brand 别名保留)
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        reading: ['"Source Han Serif SC"', 'Georgia', '"Songti SC"', '"PingFang SC"', 'serif'],
      },
      colors: {
        // ── 静态调色板 (DESIGN.md colors.{primary,secondary,neutral}) ──
        primary: {
          50:  '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12',
          DEFAULT: '#f97316',
        },
        secondary: {
          400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488',
          DEFAULT: '#14b8a6',
        },
        // V0.2 新增：暴露 neutral (warm stone) 全 11 段，补充 hover 强调态边缘色阶
        // 原本只靠 canvas/surface/elevated 语义 token，neutral-600/700 诸如这种中段色无对应
        neutral: {
          50:  '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
          400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c',
          800: '#292524', 900: '#1c1917', 950: '#0c0a09',
        },
        // 向后兼容别名：现存 173 处 bg-brand-X 不动
        brand: {
          50:  '#fff7ed', 100: '#ffedd5', 400: '#fb923c',
          500: '#f97316', 600: '#ea580c', 700: '#c2410c',
        },
        // ── 语义色 (DESIGN.md colors.semantic.{success,warning,danger,info}) ──
        success: {
          DEFAULT: '#10b981', hover: '#059669', active: '#047857',
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0',
        },
        warning: {
          DEFAULT: '#f59e0b', hover: '#d97706', active: '#b45309',
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
        },
        danger: {
          DEFAULT: '#e11d48', hover: '#be123c', active: '#9f1239',
          50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3',
        },
        info: {
          DEFAULT: '#3b82f6', hover: '#2563eb', active: '#1d4ed8',
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
        },
        // ── 主题感知 token (src/index.css 注入 CSS 变量；<html class="dark"> 切换) ──
        canvas:    'rgb(var(--cf-bg-canvas)        / <alpha-value>)',
        surface:   'rgb(var(--cf-bg-surface)       / <alpha-value>)',
        elevated:  'rgb(var(--cf-bg-elevated)      / <alpha-value>)',
        overlay:   'rgb(var(--cf-bg-overlay)       / <alpha-value>)',
        'border-subtle':  'rgb(var(--cf-border-subtle)  / <alpha-value>)',
        'border-default': 'rgb(var(--cf-border-default) / <alpha-value>)',
        'border-strong':  'rgb(var(--cf-border-strong)  / <alpha-value>)',
        'fg-primary':     'rgb(var(--cf-text-primary)     / <alpha-value>)',
        'fg-secondary':   'rgb(var(--cf-text-secondary)   / <alpha-value>)',
        'fg-muted':       'rgb(var(--cf-text-muted)       / <alpha-value>)',
        'fg-on-primary':  'rgb(var(--cf-text-on-primary)  / <alpha-value>)',
        'action-primary':         'rgb(var(--cf-action-primary)        / <alpha-value>)',
        'action-primary-hover':   'rgb(var(--cf-action-primary-hover)  / <alpha-value>)',
        'action-primary-active':  'rgb(var(--cf-action-primary-active) / <alpha-value>)',
      },
      // DESIGN.md typography.scales · 11 级 + reading + V0.2 tight 3 档
      fontSize: {
        'display-l':    ['40px', { lineHeight: '1.15', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'heading-xl':   ['28px', { lineHeight: '1.2',  letterSpacing: '-0.015em', fontWeight: '700' }],
        'heading-l':    ['22px', { lineHeight: '1.3',  fontWeight: '600' }],
        'heading-m':    ['18px', { lineHeight: '1.35', fontWeight: '600' }],
        'heading-s':    ['15px', { lineHeight: '1.4',  fontWeight: '600' }],
        'body-l':       ['16px', { lineHeight: '1.65' }],
        'body-m':       ['14px', { lineHeight: '1.55' }],
        'body-s':       ['13px', { lineHeight: '1.5'  }],
        'body-reading': ['17px', { lineHeight: '1.85', letterSpacing: '0.01em' }],
        'caption-m':    ['12px', { lineHeight: '1.4',  letterSpacing: '0.01em', fontWeight: '500' }],
        'label-m':      ['11px', { lineHeight: '1.3',  letterSpacing: '0.08em', fontWeight: '600' }],
        'code-m':       ['13px', { lineHeight: '1.55' }],
        // V0.2 新增 · 紧凑字号（非 uppercase）
        'tight-2xs':    ['9px',  { lineHeight: '1.3',  fontWeight: '500' }],
        'tight-xs':     ['10px', { lineHeight: '1.35', fontWeight: '500' }],
        'tight-sm':     ['11px', { lineHeight: '1.4',  fontWeight: '500' }],
      },
      // DESIGN.md spacing.roles 中页面级别 · 不动 atomic 0/1/2/...
      spacing: {
        'page-x':    '24px',
        'page-x-lg': '32px',
        'page-y':    '32px',
        'sidebar':   '240px',
        'drawer':    '420px',
        'modal':     '560px',
      },
      maxWidth: {
        'content': '1280px',
        'reading': '720px',
      },
      // DESIGN.md rounded.roles · 语义化别名（atomic Tailwind 默认保留）
      borderRadius: {
        'button':   '6px',
        'icon-btn': '8px',
        'pill':     '9999px',
        'input':    '8px',
        'card':     '12px',
        'panel':    '12px',
        'modal':    '16px',
        'image':    '12px',
        'avatar':   '9999px',
        'chip':     '6px',
        'badge':    '9999px',
      },
      // DESIGN.md elevation.themes · 暗+亮各一套，类名后缀区分
      boxShadow: {
        'raised':         '0 1px 2px 0 rgb(0 0 0 / 0.25)',
        'floating':       '0 8px 24px -4px rgb(0 0 0 / 0.5), 0 2px 6px -2px rgb(0 0 0 / 0.375)',
        'lifted':         '0 16px 48px -8px rgb(0 0 0 / 0.65), 0 4px 12px -2px rgb(0 0 0 / 0.5)',
        'raised-light':   '0 1px 2px 0 rgb(12 10 9 / 0.08), 0 1px 1px -1px rgb(12 10 9 / 0.04)',
        'floating-light': '0 8px 24px -4px rgb(12 10 9 / 0.15), 0 2px 6px -2px rgb(12 10 9 / 0.08)',
        'lifted-light':   '0 16px 48px -8px rgb(12 10 9 / 0.2),  0 4px 12px -2px rgb(12 10 9 / 0.12)',
      },
      transitionTimingFunction: {
        'out-quint': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
