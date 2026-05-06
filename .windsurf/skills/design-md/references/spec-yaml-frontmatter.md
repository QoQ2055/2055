# YAML Frontmatter · 完整 Schema 参考

> 基于 google-labs-code/design.md spec v alpha (2026-04). 本文档是规范的**穷尽说明** + 工程实践注解.

---

## 1. 顶层 8 字段

```yaml
---
version: alpha               # 可选. 当前只有 "alpha" 一个值
name: <string>               # 必需. 设计系统名字 (e.g. "CineForge Dark")
description: <string>        # 可选. 一句话描述
colors: { ... }              # 推荐. 调色板 tokens
typography: { ... }          # 推荐. 排版 tokens
rounded: { ... }             # 可选. 圆角 tokens
spacing: { ... }             # 可选. 间距 tokens
components: { ... }          # 可选. 组件级样式
---
```

### 最小合法 YAML

```yaml
---
name: MyApp
---
```

就这一行合法. 但基本没用 (AI 消费不到任何东西). 实际最小可用要有 `colors` + `typography`.

---

## 2. `colors` 详解

### 2.1 值类型

**仅接受 `#RRGGBB` 或 `#RRGGBBAA` 十六进制**. 不允许:
- ❌ `rgb(26, 115, 232)` (不是 hex)
- ❌ `hsl(220 80% 50%)` (不是 hex)
- ❌ `red` / `blue` / 其他关键字
- ❌ `#RGB` 3 位简写 (必须 6 位或 8 位)

### 2.2 命名约定 (非强制但推荐)

```yaml
colors:
  # 品牌色
  primary: "#1A1C1E"
  secondary: "#6C7278"
  accent: "#B8422E"
  
  # 中性 scale (4-6 档)
  neutral50:  "#F7F5F2"
  neutral100: "#E5E1DC"
  neutral300: "#B8B0A5"
  neutral500: "#6C6457"
  neutral700: "#3D362B"
  neutral900: "#1A1611"
  
  # 语义色
  success: "#2E7D32"
  warning: "#F57C00"
  error:   "#C62828"
  info:    "#0288D1"
  
  # 组件特定 (可选)
  buttonBg:      "#1A73E8"
  buttonBgHover: "#1557B0"
```

### 2.3 跨组引用

colors 可以被 `components.*` 里引用:

```yaml
colors:
  primary: "#1A73E8"
components:
  button:
    backgroundColor: "{colors.primary}"  # 引用, 不重复
```

**引用必须用 `{path.to.token}` 语法**, 不能裸 hex 重复.

### 2.4 双主题 (光明 + 暗色)

规范 v alpha **无原生双主题支持**. 临时方案:
- **方案 α**: 写两份 DESIGN.md (`DESIGN.md` 光明 / `DESIGN-dark.md` 暗色)
- **方案 β**: 单份 DESIGN.md, colors 里加 `-dark` 后缀 (`primaryDark: "#..."`), markdown 里说明使用场景
- **方案 γ**: 等上游 v beta 支持 (预计有 `themes` 顶层字段)

本 SKILL 推荐方案 β (单文件可管理).

---

## 3. `typography` 详解

### 3.1 必需字段

每个 token 至少有:
```yaml
typography:
  bodyM:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"   # 或无单位 1.5
```

### 3.2 可选字段

```yaml
typography:
  displayL:
    fontFamily: "Inter"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"       # 可选
    fontFeature: "'ss01' on"       # 可选 · font-feature-settings
    fontVariation: "'wght' 800"    # 可选 · font-variation-settings (变体字重)
```

### 3.3 推荐 scale (9-12 级)

```yaml
typography:
  # 大标题/展示 (可选, 只有落地页等用)
  displayL: { fontSize: "72px", fontWeight: 800, lineHeight: 1.1 }
  displayM: { fontSize: "56px", fontWeight: 700, lineHeight: 1.15 }
  
  # 标题 (必备 4 级)
  headingXl: { fontSize: "40px", fontWeight: 700, lineHeight: 1.2 }
  headingL:  { fontSize: "32px", fontWeight: 700, lineHeight: 1.25 }
  headingM:  { fontSize: "24px", fontWeight: 600, lineHeight: 1.3 }
  headingS:  { fontSize: "20px", fontWeight: 600, lineHeight: 1.4 }
  
  # 正文 (必备 3 级)
  bodyL: { fontSize: "18px", fontWeight: 400, lineHeight: 1.6 }
  bodyM: { fontSize: "16px", fontWeight: 400, lineHeight: 1.5 }
  bodyS: { fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  
  # 辅助
  captionM: { fontSize: "12px", fontWeight: 400, lineHeight: 1.4 }
  labelM:   { fontSize: "14px", fontWeight: 500, lineHeight: 1.4 }
  
  # 等宽 (代码 · 数字表格)
  codeM: { fontFamily: "Menlo, Consolas, monospace", fontSize: "14px", fontWeight: 400, lineHeight: 1.6 }
```

### 3.4 lineHeight 两种写法

- **带单位** (`"24px"`): 绝对行高, 不随字号变
- **无单位** (`1.5`): 乘数, 24px = fontSize × 1.5

推荐**小字号用乘数**, 大字号用绝对 px (视觉更稳).

---

## 4. `spacing` 详解

### 4.1 值类型

允许 `px` / `em` / `rem` / **纯数字** (作 px 解释).

### 4.2 推荐 scale (Tailwind 4 基数风)

```yaml
spacing:
  "0": 0
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
  "24": "96px"
```

### 4.3 替代 scale (8 基数 · Material 风)

```yaml
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"
```

**选一种风格坚持**, 不要混用.

---

## 5. `rounded` 详解

### 5.1 推荐 scale

```yaml
rounded:
  none: 0
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
  full: "9999px"   # 全圆
```

### 5.2 用途

- `xs-sm`: 小控件 (checkbox / tag / chip)
- `md`: 默认 button / input / card
- `lg-xl`: 大卡片 / modal
- `full`: 徽章 / avatar / pill button

---

## 6. `components` 详解

### 6.1 基本结构

```yaml
components:
  <componentName>:
    <property>: <value | {token.ref}>
```

### 6.2 常见组件 token 示例

**Button**:
```yaml
components:
  button:
    backgroundColor: "{colors.primary}"
    color: "{colors.neutral50}"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.2}"
    borderRadius: "{rounded.md}"
    fontSize: "{typography.bodyM.fontSize}"
    fontWeight: "{typography.bodyM.fontWeight}"
    hoverBackgroundColor: "{colors.primaryHover}"  # 或直接 hex
```

**Input**:
```yaml
  input:
    backgroundColor: "{colors.neutral50}"
    borderColor: "{colors.neutral300}"
    borderWidth: "1px"
    borderRadius: "{rounded.md}"
    paddingX: "{spacing.3}"
    paddingY: "{spacing.2}"
    placeholderColor: "{colors.neutral500}"
    focusBorderColor: "{colors.primary}"
```

**Card**:
```yaml
  card:
    backgroundColor: "{colors.neutral50}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.6}"
    shadow: "0 1px 3px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.04)"
```

### 6.3 components 字段命名不强制

规范对 components 子属性名没有固定 schema. 规则:
- 用**语义化**命名 (`backgroundColor` 不是 `bg`)
- 常见属性 camelCase
- 嵌套状态 (hover/focus/disabled) 用前缀: `hoverBackgroundColor`

### 6.4 规范声明 "components 段演进中"

Google spec 明确 components 字段**会变**. 保险做法:
- V1 只定 6 个核心组件 (button / input / card / modal / nav / tab)
- 等规范 v beta 再扩展

---

## 7. token 引用深度 + 循环保护

### 7.1 允许多层引用

```yaml
colors:
  primary: "#1A73E8"
components:
  button:
    backgroundColor: "{colors.primary}"  # 1 级
  buttonPrimary:
    backgroundColor: "{components.button.backgroundColor}"  # 2 级
```

### 7.2 循环引用非法

```yaml
# ❌ 会被 lint 拒绝
components:
  a: { bg: "{components.b.bg}" }
  b: { bg: "{components.a.bg}" }
```

### 7.3 引用不存在的 token

```yaml
# ❌ lint 会报 error
components:
  button:
    color: "{colors.doesntExist}"
```

---

## 8. 完整示例 (CineForge 风格, 仅作 schema demo)

```yaml
---
version: alpha
name: CineForge Dark
description: 创剧 CineForge 暗夜霓虹设计系统, 短剧创作者专用

colors:
  # 品牌
  primary: "#120b19"       # 深紫近黑 · 主背景
  secondary: "#1f1529"     # 深紫 · 次级面板
  accent: "#c084fc"        # 霓虹紫 · CTA / highlight
  
  # 中性
  neutral50:  "#f4edf8"
  neutral100: "#e2d5eb"
  neutral300: "#9b84ad"
  neutral500: "#6e5a80"
  neutral700: "#3d2f4d"
  neutral900: "#0a0612"
  
  # 语义
  success: "#22c55e"
  warning: "#f59e0b"
  error:   "#ef4444"
  info:    "#0ea5e9"

typography:
  headingXl: { fontFamily: "Inter", fontSize: "40px", fontWeight: 700, lineHeight: 1.2 }
  headingL:  { fontFamily: "Inter", fontSize: "32px", fontWeight: 700, lineHeight: 1.25 }
  headingM:  { fontFamily: "Inter", fontSize: "24px", fontWeight: 600, lineHeight: 1.3 }
  headingS:  { fontFamily: "Inter", fontSize: "20px", fontWeight: 600, lineHeight: 1.4 }
  bodyL:     { fontFamily: "Inter", fontSize: "18px", fontWeight: 400, lineHeight: 1.6 }
  bodyM:     { fontFamily: "Inter", fontSize: "16px", fontWeight: 400, lineHeight: 1.5 }
  bodyS:     { fontFamily: "Inter", fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  captionM:  { fontFamily: "Inter", fontSize: "12px", fontWeight: 400, lineHeight: 1.4 }
  codeM:     { fontFamily: "Menlo, Consolas, monospace", fontSize: "14px", fontWeight: 400, lineHeight: 1.6 }

spacing:
  "0": 0
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"

rounded:
  none: 0
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"

components:
  button:
    backgroundColor: "{colors.accent}"
    color: "{colors.neutral900}"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.2}"
    borderRadius: "{rounded.md}"
    fontSize: "{typography.bodyM.fontSize}"
    fontWeight: 600
  
  input:
    backgroundColor: "{colors.secondary}"
    borderColor: "{colors.neutral500}"
    borderRadius: "{rounded.md}"
    paddingX: "{spacing.3}"
    paddingY: "{spacing.2}"
    color: "{colors.neutral50}"
    placeholderColor: "{colors.neutral500}"
    focusBorderColor: "{colors.accent}"
  
  card:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.6}"
    shadow: "0 0 20px rgba(192, 132, 252, 0.1)"
---
```

---

## 9. 常见错误

| 错误 | 症状 | 修正 |
|---|---|---|
| 裸 hex 不走 token | `button.bg: "#1A73E8"` 重复了 colors.primary | 改 `{colors.primary}` |
| 颜色值格式错 | `color: "rgb(26,115,232)"` | 改 hex `#1A73E8` |
| lineHeight 混用 | 同 scale 一些有单位一些没 | 统一 (推荐大字号有单位, 小字号无单位) |
| fontSize 用 rem | `fontSize: "1rem"` (规范允许但不推荐) | 改 px (AI 更容易精确计算) |
| 循环引用 | A → B → A | 打断循环 |
| 缺必需字段 | typography 没 fontSize | 补上 |
| 重复 section | YAML 里两个 `colors:` | 合并或删一个 |

---

## 10. Schema 未来演进 (v beta 预期)

Google spec 会增加的字段 (观察 repo issues):
- `themes` 顶层字段 (双主题原生支持)
- `animation` (缓动曲线 / 时长 tokens)
- `zIndex` (层叠 scale)
- `breakpoint` (响应式断点)

本 SKILL 会跟进. 目前这些用 markdown 文字写在 body 里即可.
