# 导出集成 · Tailwind / CSS-in-JS / CSS Custom Properties

> DESIGN.md 是单一真源. 本文档讲如何把 YAML tokens 变成**实际的 CSS 代码**供组件引用. 3 种主流集成方案.

---

## 1. Tailwind CSS (最推荐)

### 1.1 自动导出

```bash
npx @google/design.md export --format tailwind DESIGN.md > tailwind.config.ts
```

### 1.2 生成的 tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    // extend 模式: 保留 Tailwind 默认, 扩自己的
    extend: {
      colors: {
        primary: '#120b19',
        secondary: '#1f1529',
        accent: '#c084fc',
        neutral: {
          50: '#f4edf8',
          100: '#e2d5eb',
          300: '#9b84ad',
          500: '#6e5a80',
          700: '#3d2f4d',
          900: '#0a0612',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#0ea5e9',
      },
      spacing: {
        // 注意: Tailwind 4 基数自带 1-96, 这里只补 DESIGN.md 有但 Tailwind 没有的
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        full: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        'body-s': ['14px', { lineHeight: '1.5' }],
        'body-m': ['16px', { lineHeight: '1.5' }],
        'body-l': ['18px', { lineHeight: '1.6' }],
        'heading-s': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-m': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-l': ['32px', { lineHeight: '1.25', fontWeight: '700' }],
        'heading-xl': ['40px', { lineHeight: '1.2', fontWeight: '700' }],
        'caption-m': ['12px', { lineHeight: '1.4' }],
        'code-m': ['14px', { lineHeight: '1.6', fontFamily: 'Menlo' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 1.3 组件里使用

```tsx
// ✅ 正确: 引用 tailwind 类 (由 DESIGN.md 导出)
<button className="bg-accent text-neutral-900 px-4 py-2 rounded-md text-body-m font-semibold hover:opacity-90">
  开始破题
</button>

// ❌ 错误: hard-code
<button className="bg-purple-500 text-white px-[17px] py-[9px] rounded hover:bg-purple-600">
  开始破题
</button>
```

### 1.4 自动化 sync

`package.json`:
```json
{
  "scripts": {
    "design:sync": "npx @google/design.md export --format tailwind DESIGN.md > tailwind.config.ts",
    "design:lint": "npx @google/design.md lint DESIGN.md",
    "predev": "npm run design:sync && npm run design:lint",
    "prebuild": "npm run design:sync && npm run design:lint"
  }
}
```

每次 `npm run dev` 或 `build` 前自动 sync. 你改 DESIGN.md → 下次启动自动生效.

### 1.5 注意事项

- Tailwind v3 vs v4 语法略不同 (v4 是 `@theme { ... }` 在 CSS 里)
- `export` 命令目前默认 v3 config. v4 用户需要改 output
- `content:` 路径要正确, 否则 purge 掉自定义类

---

## 2. CSS Custom Properties (原生, 无依赖)

### 2.1 生成 CSS 变量

(暂时无官方 CLI 的 `--format css`, 手动实现 · V1 推荐)

```typescript
// scripts/gen-css-vars.ts (solo dev 写一次就够)
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';

const designMd = readFileSync('DESIGN.md', 'utf8');
const yaml = designMd.split('---')[1];       // 提取 YAML frontmatter
const tokens = parse(yaml);

let css = ':root {\n';

// Colors
for (const [key, val] of Object.entries(tokens.colors || {})) {
  if (typeof val === 'string') {
    css += `  --color-${key}: ${val};\n`;
  }
}

// Spacing
for (const [key, val] of Object.entries(tokens.spacing || {})) {
  css += `  --space-${key}: ${val};\n`;
}

// Rounded
for (const [key, val] of Object.entries(tokens.rounded || {})) {
  css += `  --radius-${key}: ${val};\n`;
}

// Typography (展开成 --font-*-size, --font-*-weight 等)
for (const [key, val] of Object.entries(tokens.typography || {})) {
  if (typeof val === 'object' && val !== null) {
    const t = val as Record<string, unknown>;
    if (t.fontSize) css += `  --font-${key}-size: ${t.fontSize};\n`;
    if (t.fontWeight) css += `  --font-${key}-weight: ${t.fontWeight};\n`;
    if (t.lineHeight) css += `  --font-${key}-line-height: ${t.lineHeight};\n`;
  }
}

css += '}\n';
writeFileSync('src/styles/tokens.css', css);
```

### 2.2 生成的 tokens.css

```css
:root {
  /* Colors */
  --color-primary: #120b19;
  --color-secondary: #1f1529;
  --color-accent: #c084fc;
  --color-neutral50: #f4edf8;
  --color-neutral500: #6e5a80;
  --color-neutral900: #0a0612;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #0ea5e9;
  
  /* Spacing */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* Rounded */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* Typography */
  --font-body-m-size: 16px;
  --font-body-m-weight: 400;
  --font-body-m-line-height: 1.5;
  /* ... */
}
```

### 2.3 使用

```tsx
<button style={{
  backgroundColor: 'var(--color-accent)',
  color: 'var(--color-neutral900)',
  paddingInline: 'var(--space-4)',
  paddingBlock: 'var(--space-2)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-body-m-size)',
  fontWeight: 600,
}}>
  开始破题
</button>
```

### 2.4 何时选这方案

- 不用 Tailwind (或不想依赖框架)
- 项目小, 组件少
- 要支持运行时主题切换 (双主题在 CSS 变量很容易)

---

## 3. CSS-in-JS (styled-components / emotion)

### 3.1 用 theme provider

```typescript
// src/theme.ts
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';

const tokens = parse(readFileSync('DESIGN.md', 'utf8').split('---')[1]);

export const theme = {
  colors: tokens.colors,
  spacing: tokens.spacing,
  rounded: tokens.rounded,
  typography: tokens.typography,
};

export type Theme = typeof theme;
```

### 3.2 ThemeProvider 包裹应用

```tsx
import { ThemeProvider } from 'styled-components';
import { theme } from './theme';

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

### 3.3 组件里

```tsx
import styled from 'styled-components';

const Button = styled.button`
  background-color: ${p => p.theme.colors.accent};
  color: ${p => p.theme.colors.neutral900};
  padding: ${p => p.theme.spacing['2']} ${p => p.theme.spacing['4']};
  border-radius: ${p => p.theme.rounded.md};
  font-size: ${p => p.theme.typography.bodyM.fontSize};
`;
```

### 3.4 何时选

- 已有 styled-components / emotion 生态
- 组件密集需要 props 驱动样式
- 需要 JS 动态切换主题 (如 A/B 测试)

**CineForge V1 不推荐 CSS-in-JS**: 额外 runtime 开销, solo dev 用 Tailwind 最快.

---

## 4. 混合策略 (实战推荐)

```
1. DESIGN.md 定 tokens
   ↓
2. 导 tailwind.config.ts (组件主要用 Tailwind)
   ↓
3. 同时导 tokens.css (全局 CSS 变量, 用于第三方库集成 / 特殊场景内联)
   ↓
4. 特殊 dynamic 值 (如 agent 状态色) 用 CSS 变量
```

例: Agent 消息气泡颜色随状态变:
```tsx
<div style={{
  borderLeftColor: `var(--color-${status === 'error' ? 'error' : 'accent'})`
}}>
  ...
</div>
```

这种动态场景 Tailwind 表达不好, 走 CSS 变量.

---

## 5. 多主题支持

### 5.1 DESIGN.md 命名 suffix 方案

```yaml
colors:
  primary: "#f4edf8"       # 亮主题
  primaryDark: "#120b19"   # 暗主题
```

然后 tokens.css:
```css
:root {
  --color-primary: #f4edf8;
}

[data-theme="dark"] {
  --color-primary: #120b19;
}
```

切换:
```tsx
<html data-theme="dark">
```

### 5.2 等上游 v beta 原生支持

Spec 会加 `themes` 顶层字段:
```yaml
themes:
  light:
    colors: { primary: "#..." }
  dark:
    colors: { primary: "#..." }
```

未来迁移成本低, 现在先用 5.1.

---

## 6. 构建时 vs 运行时

| 方案 | 构建时 | 运行时 | 适合 |
|---|:-:|:-:|---|
| Tailwind | ✓ (CSS purge) | - | 静态主题 · 最优性能 |
| CSS Custom Props | ✓ | ✓ (可动态改) | 需要主题切换 |
| CSS-in-JS | - | ✓ (JS runtime) | 组件密集 · 需要 JS 驱动样式 |

CineForge V1: **Tailwind + 少量 CSS Custom Props** (动态状态色).

---

## 7. 集成 check list (部署前)

- [ ] `tailwind.config.ts` 从 DESIGN.md 自动生成
- [ ] `tokens.css` 作为 `src/styles/tokens.css` 被 `index.css` 导入
- [ ] `package.json` 有 `design:sync` / `design:lint` scripts
- [ ] `predev` / `prebuild` hook 调用 sync + lint
- [ ] ESLint 规则禁 hard-coded 颜色 (可选)
- [ ] README 写明 "改设计系统改 DESIGN.md, 不要改 tailwind.config.ts"
- [ ] CLAUDE.md / .cursorrules 里嵌入"读 DESIGN.md"指令

做齐这 7 条, AI 生成组件的一致性能到 95%+.

---

## 8. 常见问题

**Q: tailwind.config.ts 导出后我手改了, 再 sync 会覆盖吗?**  
A: 会. 规则: `tailwind.config.ts` 是 derived artifact, 不要手改. 改 DESIGN.md.

**Q: Tailwind v4 的 `@theme` 语法支持吗?**  
A: spec 目前输出 v3. v4 用户用 CSS custom props 方案更稳, 或等 spec 更新.

**Q: 字体文件 (web font) 怎么管?**  
A: DESIGN.md 不管字体加载, 只定义 fontFamily 栈. 字体加载走 `@font-face` 或 Google Fonts link, 放全局 CSS.

**Q: 暗黑模式用户偏好怎么检测?**  
A: `@media (prefers-color-scheme: dark)` + JS 读 `matchMedia`. DESIGN.md 管 token, 切换逻辑在应用层.
