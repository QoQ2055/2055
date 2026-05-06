# AI Agent 如何正确消费 DESIGN.md

> 本文档是 design-md SKILL 里**最重要**的一篇 · 解决 "DESIGN.md 写了但 AI 生成组件时不读 / 读不对" 的问题. 目标: 让 Claude Code / Cursor / Copilot 等 AI coding agent 每次生成 UI 都**严格引用 DESIGN.md token**, 不 drift 到 default Tailwind / Material.

---

## 1. 问题陈述

### 1.1 AI 默认行为 (差)

用户说 "给我做个登录按钮", AI 直接生成:

```tsx
<button className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
  登录
</button>
```

这有 3 个问题:
1. `bg-blue-500` 是 Tailwind 默认蓝, 不是本项目的 `accent`
2. `px-4 py-2` 是 Tailwind 默认间距, 可能和 spacing scale 对不上
3. `rounded-md` 可能不符合 shapes 语义 (本项目 button 是 `rounded.lg`?)

**AI 没读 DESIGN.md** 的结果 = 通用审美 = 和产品气质脱节.

### 1.2 想要的行为

AI 先读 DESIGN.md:
```yaml
colors:
  accent: "#c084fc"
spacing:
  "4": "16px"
rounded:
  md: "8px"
components:
  button:
    backgroundColor: "{colors.accent}"
    ...
```

然后生成:
```tsx
<button style={{
  backgroundColor: 'var(--color-accent)',
  paddingInline: 'var(--space-4)',
  paddingBlock: 'var(--space-2)',
  borderRadius: 'var(--radius-md)',
}}>
  登录
</button>
```

或用 Tailwind 已导出的 theme:
```tsx
<button className="bg-accent px-4 py-2 rounded-md">登录</button>
```

(`bg-accent` 是通过 `tailwind.config.ts` 从 DESIGN.md export 来的)

---

## 2. 核心机制: 让 AI 总是读 DESIGN.md

### 2.1 机制 α · CLAUDE.md 强制指令 (最有效)

Claude Code 每次启动都读项目根的 `CLAUDE.md`. 在里面写死规则:

```markdown
# CLAUDE.md · Project-Level Rules

## Design System (MUST FOLLOW)

This project has a canonical design system defined in `DESIGN.md` at the repo root.

**Before generating any UI component (React/Vue/HTML), you MUST:**

1. Read `DESIGN.md` YAML frontmatter to get exact token values
2. Read `DESIGN.md` markdown body, especially `## Components` and `## Do's and Don'ts` sections
3. When generating colors: always reference `{colors.xxx}` tokens, never hard-code hex like "#1A73E8"
4. When generating spacing: always reference `{spacing.xxx}` tokens, never hard-code "16px"
5. When generating typography: always reference `{typography.xxx}` tokens

**If DESIGN.md does not define a token you need:**
- Stop. Ask the user: "This component needs a token for X, but DESIGN.md doesn't have one. Should we add it, or use an existing token?"
- Never guess/fabricate values

**Enforcement**: before emitting component code, verify every color/spacing/radius value in the output traces back to a DESIGN.md token via {path.to.token} reference or its Tailwind/CSS-var export.
```

把这段**直接塞入项目 CLAUDE.md**, 每次 Claude Code 启动就生效.

### 2.2 机制 β · Cursor Rules (`.cursorrules`)

Cursor 用户:

```
# .cursorrules

Always read DESIGN.md at project root before generating UI components.
Follow the YAML tokens and markdown guidance strictly.
Never hard-code colors/spacing/typography; always reference tokens.
When a token is missing, ask the user to decide rather than guessing.
```

### 2.3 机制 γ · Copilot 指令 (`.github/copilot-instructions.md`)

```markdown
# Copilot Instructions

This repo uses a DESIGN.md single-source-of-truth design system.

When generating React components:
- Reference DESIGN.md tokens via Tailwind classes (e.g. `bg-accent`, not `bg-blue-500`)
- Read DESIGN.md `## Components` section for component-specific rules
```

---

## 3. 让 AI 真的能"查" DESIGN.md

规则写了, 但 AI 会不会真的去读? 保障方法:

### 3.1 方法 α · 放项目根, 文件名全大写

AI coding agent 扫描项目时优先看全大写的根文件 (README.md / CLAUDE.md / DESIGN.md / LICENSE). 文件**必须**叫 `DESIGN.md` 不是 `design.md` 或 `design-system.md`.

### 3.2 方法 β · CLAUDE.md 里直接引用关键片段

不要只说"读 DESIGN.md", 在 CLAUDE.md 里嵌入关键 token:

```markdown
## Current Design Tokens (sync with DESIGN.md)

### Colors
- primary: #120b19 (deep purple background)
- accent: #c084fc (neon purple · CTA only)
- neutral50: #f4edf8 (main text)
- neutral500: #6e5a80 (borders · placeholder)

### Spacing (base 4)
xs=4 sm=8 md=16 lg=24 xl=32 2xl=48

### Rounded
sm=4px md=8px lg=12px

See DESIGN.md for full spec including components and do/don't.
```

这样 AI 在 CLAUDE.md 就能直接拿到常用 token, 不用每次 grep DESIGN.md.

**缺点**: 要同步两处. 自动化: CI 跑 `npx @google/design.md export --format markdown > CLAUDE-tokens.md` 自动同步.

### 3.3 方法 γ · `spec` CLI 输出喂 agent

```bash
npx @google/design.md spec --rules --format json
```

输出规范 JSON, 可塞入 agent system prompt (对 API 调用场景).

---

## 4. Tailwind 导出使 AI 有 "正确的类名可选"

### 4.1 问题

AI 不知道项目里 `bg-accent` 这类自定义类是否存在, 经常 fallback 到 `bg-purple-500`.

### 4.2 解法

导出 Tailwind config 把 DESIGN.md 的 token 变成**真实可用的 Tailwind 类**:

```bash
npx @google/design.md export --format tailwind DESIGN.md > tailwind.config.ts
```

生成:

```typescript
export default {
  theme: {
    colors: {
      primary: '#120b19',
      secondary: '#1f1529',
      accent: '#c084fc',
      neutral: {
        50: '#f4edf8',
        // ...
      },
    },
    spacing: {
      '1': '4px',
      '2': '8px',
      // ...
    },
    borderRadius: {
      sm: '4px',
      md: '8px',
      // ...
    },
  },
}
```

现在 AI 生成 `bg-accent` 是**合法**的 Tailwind 类, IDE 会补全, 不会 fallback.

### 4.3 自动化

放 `package.json`:
```json
{
  "scripts": {
    "design:sync": "npx @google/design.md export --format tailwind DESIGN.md > tailwind.config.ts",
    "design:lint": "npx @google/design.md lint DESIGN.md",
    "prebuild": "npm run design:sync && npm run design:lint"
  }
}
```

每次 build 前自动同步.

---

## 5. 提示 AI 的 4 条 "系统 prompt 模板"

### 5.1 通用组件生成 prompt

```
You are generating a [ComponentName] React component.

STEP 1: Read /DESIGN.md (the authoritative design system).
STEP 2: From YAML frontmatter, extract these exact token values:
  - Colors used by [ComponentName]
  - Spacing used
  - Typography used
  - Rounded values used
STEP 3: From markdown body, read:
  - The "## Components > [ComponentName]" section (if exists)
  - The "## Do's and Don'ts" section
STEP 4: Generate the component code. Every color/spacing/radius/font must be a Tailwind class corresponding to the token (e.g. `bg-accent`, not `bg-purple-500`).
STEP 5: If DESIGN.md is missing a token you need, STOP and ask the user before guessing.

Output the component code only. No explanation.
```

### 5.2 颜色选择 prompt

```
User wants to use a [purpose] color (e.g. "a color to show 'danger'").

DO NOT pick a color from your training data.
INSTEAD:
1. Read /DESIGN.md YAML `colors` section.
2. Find the semantic color matching [purpose]:
   - "danger" → {colors.error}
   - "neutral" → {colors.neutral500}
   - "cta" → {colors.accent}
3. Reference it as `{colors.xxx}` token.

If no matching semantic color exists in DESIGN.md, STOP and ask: "DESIGN.md doesn't have a [purpose] color. Should we add `colors.xxx` or use an existing color?"
```

### 5.3 间距选择 prompt

```
User wants spacing (padding/margin/gap) of size [S/M/L].

DO NOT guess px values.
INSTEAD:
1. Read /DESIGN.md YAML `spacing` section.
2. Map the requested size:
   - "S" → {spacing.2} or {spacing.3}
   - "M" → {spacing.4}
   - "L" → {spacing.6} or {spacing.8}
3. Output as Tailwind class (`p-4`, `gap-6`) or CSS var.
```

### 5.4 违规自纠 prompt

```
Your previous output contained hard-coded values:
- [line N]: `bg-[#1A73E8]` → should be {colors.primary}
- [line N]: `px-[17px]` → should be a spacing scale value

Rewrite the component. Reference DESIGN.md tokens only.
```

---

## 6. 检测 AI 是否真在遵守

### 6.1 静态检测 · lint 规则

可在 eslint 加规则禁止 hard-coded 颜色/间距:

```js
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
        message: 'Use design tokens from DESIGN.md instead of hex colors.',
      },
    ],
  },
};
```

(需要根据具体语法微调, 但思路是拦截 AI 滑过去的 hard-coded 值.)

### 6.2 运行时检测 · CSS-in-JS warning

如果用 styled-components / emotion, 写个 wrapper 拦截非 token 值:

```ts
function assertToken(value: string) {
  if (!value.startsWith('var(--') && !value.includes('{')) {
    console.warn(`Non-token value used: ${value}`);
  }
}
```

### 6.3 人工检测 · PR review checklist

PR 模板里加一条:
```
- [ ] All new UI code references DESIGN.md tokens (no hard-coded colors/spacing/typography)
```

---

## 7. 常见 AI drift 模式 · 如何破

| AI 坏习惯 | 破法 |
|---|---|
| 用 Tailwind 默认调色 (`bg-blue-500`) | 确保 tailwind.config.ts 从 DESIGN.md export, IDE 补全时就只有自定义类 |
| 写字号说 "16px" | system prompt 强调: "Never hard-code px; always reference {typography.xxx} or Tailwind class" |
| 忽视 `## Do's and Don'ts` | CLAUDE.md 把 Don'ts 抄一份 (重复 = 更重的权重) |
| 新增了 DESIGN.md 没定义的颜色 | lint + PR review 双保险 |
| 生成 8 个按钮变体, 但 DESIGN.md 只定义了 4 个 | Prompt 明确 "只用 DESIGN.md `components.button` 定义的变体, 要新变体先改 DESIGN.md" |

---

## 8. 极简起步清单 (给 solo dev)

V1 最小努力配置 AI 消费 DESIGN.md:

1. ✅ 项目根放 `DESIGN.md`
2. ✅ 项目根放 `CLAUDE.md`, 内含 §2.1 那段强制指令
3. ✅ `package.json` 加 `"design:sync"` script 跑 tailwind export
4. ✅ `tailwind.config.ts` 从 export 生成
5. ⬜ (可选) ESLint 规则拦截 hard-coded
6. ⬜ (可选) PR template 加 checklist

前 4 条**必做**, 5-6 是 V2+ 加强.

---

## 9. 和本 SKILL 的互补

本 SKILL (design-md) 负责**起草和维护 DESIGN.md**.

本文档负责**让 AI 在起草完后真的遵守 DESIGN.md**.

两件事缺一不可:
- 只起草不消费 → DESIGN.md 成了装饰
- 只要求消费没好规范 → AI 不知道怎么遵守

本 SKILL 激活后在 §4.1 Greenfield 步骤 7 "Lint + Export" 之后, 会主动提醒: "现在做完 DESIGN.md 了, 去配一下 CLAUDE.md 强制 AI 消费, 参见 `references/agent-consumption.md`".
