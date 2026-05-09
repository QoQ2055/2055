# 组件样式模式 · 常见 6 组件的 token 设置参考

> ⚠ **来源**: 本文件大部分是 **design-md SKILL 的自创层**, **不是** Google spec 的 Components 权威定义.
> Google spec 的 `components` 段明示"**演进中**", 暂未提供标准命名/结构范例.
> 本文 6 组件 (button/input/card/modal/nav/tab) 的 token 命名 + 状态前缀 + React 集成片段, 是本 SKILL 作者按主流前端实践整理.
> 用法: 作参考起点, 具体字段按你项目需求增减. 规范 v beta Components 段定型后, 本文会跟进更新.

> V1 推荐覆盖 6 核心组件. 每个列: YAML token 最小集 + markdown 语境描述 + 状态 + 常见变体.

---

## 1. Button

### 1.1 YAML tokens (最小集)

```yaml
components:
  button:
    # 默认 (primary)
    backgroundColor: "{colors.accent}"
    color: "{colors.neutral900}"   # 深文字在 accent 亮底上
    paddingX: "{spacing.4}"        # 16px
    paddingY: "{spacing.2}"        # 8px
    borderRadius: "{rounded.md}"   # 8px
    fontSize: "{typography.bodyM.fontSize}"
    fontWeight: 600
    
    # 状态
    hoverBackgroundColor: "#b366f5"          # accent 加深 10%
    activeBackgroundColor: "#a44ce8"         # accent 加深 20%
    focusBorderColor: "{colors.accent}"
    focusBorderWidth: "2px"
    disabledOpacity: 0.5
    
    # 尺寸变体
    smPaddingX: "{spacing.3}"
    smPaddingY: "{spacing.1}"
    smFontSize: "{typography.bodyS.fontSize}"
    lgPaddingX: "{spacing.6}"
    lgPaddingY: "{spacing.3}"
    lgFontSize: "{typography.bodyL.fontSize}"
```

### 1.2 markdown 描述模板

```markdown
### Button

**变体**: primary (默认) / secondary / ghost / danger
**状态**: default / hover / active / focus / disabled
**尺寸**: sm (28px 高) / md (36px 默认) / lg (44px)

**primary** — 主 CTA, 每页最多一个.  
**secondary** — 次要操作, neutral 边框 + 透明底.  
**ghost** — 工具栏 / 列表项, 无边框无底, 只 accent 文字.  
**danger** — 破坏性操作 (删除 / 清空), error 色背景.

**不要**用 button 做: 页面跳转 (用 link), 纯文本操作 (用 text link).
```

### 1.3 React 实现片段

```tsx
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
};

// 所有 className 引用 Tailwind 导出的 token 类 (bg-accent 等)
```

---

## 2. Input / Textarea

### 2.1 YAML tokens

```yaml
components:
  input:
    backgroundColor: "{colors.secondary}"
    borderColor: "{colors.neutral500}"
    borderWidth: "1px"
    borderRadius: "{rounded.md}"
    paddingX: "{spacing.3}"
    paddingY: "{spacing.2}"
    color: "{colors.neutral50}"
    placeholderColor: "{colors.neutral300}"
    
    # 状态
    hoverBorderColor: "{colors.neutral300}"
    focusBorderColor: "{colors.accent}"
    focusBorderWidth: "2px"
    errorBorderColor: "{colors.error}"
    disabledBackgroundColor: "{colors.neutral900}"
    disabledColor: "{colors.neutral500}"
```

### 2.2 markdown 描述模板

```markdown
### Input / Textarea

**状态**: default / hover / focus / error / disabled
- default: neutral500 边框
- hover: 边框加深
- focus: **2px accent 边框** (比 default 线粗, 不变色而是加粗 + 光晕)
- error: error 色边框 + 下方红字错误提示
- disabled: 背景下沉到 neutral900, 文字 neutral500

**placeholder**: 用 neutral300, 保持 4.5:1+ 对比度. **不**用 placeholder 替代 label (可访问性灾难).

**尺寸**: 默认 36px 高 (和 button md 对齐). textarea 最小 2 行, 按内容自动扩.
```

### 2.3 错误提示布局

```
┌─────────────────────────┐
│ [Input focused · 红边]  │
└─────────────────────────┘
⚠ 必填 (captionM · error 色)
```

---

## 3. Card

### 3.1 YAML tokens

```yaml
components:
  card:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.6}"        # 24px
    # 暗色体系无阴影, 靠背景色调差
    
    # 可选: 边框变体
    borderColor: "{colors.neutral700}"
    borderWidth: "1px"
    
    # Hover (如卡片可点)
    hoverBackgroundColor: "#251835"   # 色调再提亮一点
    hoverBorderColor: "{colors.neutral500}"
```

### 3.2 markdown 描述模板

```markdown
### Card

容器组件. 层级:
- **Level 1** card (默认): `{colors.secondary}` 底, 无阴影
- **Level 2** nested card: 尽量避免 (视觉混乱). 若必须, 用更深 `{colors.primary}` 底 + neutral700 边框

**嵌套深度**: 最多 2 级. 超过考虑拆页.

**padding**: 默认 `{spacing.6}` (24px), 密集场景可降到 `{spacing.4}` (16px).

**可点击 card**: cursor: pointer + hoverBackgroundColor 过渡 200ms.
```

---

## 4. Modal / Dialog

### 4.1 YAML tokens

```yaml
components:
  modal:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.xl}"    # 16px, 比 card 略大
    padding: "{spacing.8}"          # 32px
    maxWidth: "600px"
    overlayColor: "rgba(0, 0, 0, 0.6)"
    
    # 动画
    animationDuration: "200ms"
    animationEasing: "cubic-bezier(0.2, 0, 0, 1)"
    
    # Header / Footer
    headerFontSize: "{typography.headingM.fontSize}"
    headerFontWeight: "{typography.headingM.fontWeight}"
    closeButtonColor: "{colors.neutral300}"
    closeButtonHoverColor: "{colors.neutral50}"
```

### 4.2 markdown 描述模板

```markdown
### Modal / Dialog

**出现方式**: 遮罩 fade-in + 对话框 slight scale (0.95 → 1.0), 200ms cubic-bezier(0.2, 0, 0, 1).

**尺寸**:
- 小 modal (确认对话框): maxWidth 400px
- 默认: maxWidth 600px
- 大 modal (详细表单): maxWidth 800px

**交互**:
- ESC 键关闭
- 点击遮罩关闭 (可选 · 破坏性操作时禁用, 防误关)
- Focus trap (tab 循环在 modal 内)
- 打开时 autofocus 第一个输入 (如有) 或关闭按钮

**关闭按钮**: 右上角 "×", neutral300, hover neutral50.

**Header / Footer**:
- Header: headingM 标题 + 副说明 (可选)
- Footer: 右对齐 button 组 (次操作 ghost + 主操作 primary)

**不要**: 嵌套 modal. 如确实要, 第二层变 drawer 或 sheet.
```

---

## 5. Nav / Sidebar

### 5.1 YAML tokens

```yaml
components:
  nav:
    backgroundColor: "{colors.primary}"       # 和 body 同色, 感觉"一体"
    itemColor: "{colors.neutral300}"
    itemHoverColor: "{colors.neutral50}"
    itemHoverBackgroundColor: "{colors.secondary}"
    activeColor: "{colors.accent}"
    activeBorderColor: "{colors.accent}"
    activeBorderWidth: "3px"
    activeBorderPosition: "left"              # left | bottom | right
    
    # Icon-only nav (影语 FLIL 左窄栏)
    iconOnlyWidth: "60px"
    iconSize: "24px"
    iconPaddingY: "{spacing.3}"
    
    # Full nav (含文字)
    fullWidth: "240px"
    itemPaddingX: "{spacing.4}"
    itemPaddingY: "{spacing.2}"
    itemFontSize: "{typography.bodyM.fontSize}"
```

### 5.2 markdown 描述模板

```markdown
### Nav / Sidebar

**变体**:
- **Icon-only** (60px 宽): 影语 FLIL 主导航, 纯图标, hover 出 tooltip
- **Full** (240px 宽): 未来子页面导航, 图标 + 文字

**活动态**:
- **左侧 3px 竖条 accent 色** (不整块背景, 太重)
- 图标变 accent
- 文字变 neutral50 (从 neutral300)

**Hover 态**:
- 背景变 `{colors.secondary}` (色调差)
- 文字变 neutral50

**顺序**: 最常用功能在上. 影语 FLIL 左栏: 首页 → 项目列表 → 资产库 → 回收站 → 新项目 (底部).
```

---

## 6. Tab / Pill

### 6.1 YAML tokens

```yaml
components:
  tab:
    # Tab (底部下划线型)
    inactiveColor: "{colors.neutral300}"
    inactiveHoverColor: "{colors.neutral50}"
    activeColor: "{colors.neutral50}"
    underlineColor: "{colors.accent}"
    underlineWidth: "2px"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.3}"
    fontSize: "{typography.bodyM.fontSize}"
    fontWeight: 500
    activeFontWeight: 600
    
    # Pill (填充背景型)
    pillInactiveBackgroundColor: "transparent"
    pillInactiveColor: "{colors.neutral300}"
    pillInactiveHoverBackgroundColor: "{colors.secondary}"
    pillActiveBackgroundColor: "{colors.accent}"
    pillActiveColor: "{colors.neutral900}"
    pillBorderRadius: "{rounded.full}"
    pillPaddingX: "{spacing.3}"
    pillPaddingY: "{spacing.1}"
```

### 6.2 markdown 描述模板

```markdown
### Tab / Pill

两种变体:
- **Tab** (下划线型): 主区域切换 (剧本/分镜/资产). 底部 2px accent 下划线标活动.
- **Pill** (胶囊型): 筛选器 / 状态切换. 活动态 accent 填充背景.

**Tab 选用**:
- 大区域切换, 各 tab 内容互斥
- 一行展示 ≤ 5 个

**Pill 选用**:
- 筛选 / 标签组
- 可多选 (tag) 或单选 (类型筛选)
- 一行可以多个

**不要**混用: 同一区域只用一种.
```

---

## 7. 其他组件 (V2+ 扩展时加)

以下在 V2 考虑, V1 先不定:

- Dropdown / Select (与 Input 相似)
- Tooltip
- Toast / Notification
- Progress / Spinner
- Avatar
- Badge / Tag
- Breadcrumb
- Pagination
- Skeleton (加载占位)
- DataTable (复杂, 最好引第三方)

---

## 8. 组件命名约定

### 8.1 YAML 里

```yaml
components:
  # 核心: 短词命名 (button / input / card / modal / nav / tab)
  button: { ... }
  
  # 变体: 用属性名前缀
  # 不推荐单独命名 buttonPrimary / buttonSecondary / buttonGhost
  # 推荐在同一 button 下用属性:
  #   primaryBackgroundColor / secondaryBackgroundColor / ghostColor
  button:
    primaryBackgroundColor: "{colors.accent}"
    secondaryBackgroundColor: "transparent"
    secondaryBorderColor: "{colors.neutral500}"
    ghostColor: "{colors.accent}"
    dangerBackgroundColor: "{colors.error}"
  
  # 状态: 状态名前缀 (hover/active/focus/disabled)
  #   hoverBackgroundColor / activeBackgroundColor / focusBorderColor
```

### 8.2 markdown body 里

组件标题用 `###`, 按组件名直接 (不加 "Component" 后缀):
```markdown
### Button
### Input
### Card
```

不用:
```markdown
### Button Component   ← 冗余
### ButtonGroup        ← V2 再加
```

---

## 9. Claude Code 生成组件的 checklist

AI 被要求"写一个 Card 组件"时, **必须**做的事:

1. ✅ 读 `DESIGN.md` YAML `components.card`
2. ✅ 读 `DESIGN.md` markdown `## Components > Card` 理解语境
3. ✅ 读 `DESIGN.md` markdown `## Do's and Don'ts` 看 card 相关禁忌
4. ✅ 所有样式值引 Tailwind 类 (从 tokens 导出) 或 CSS custom properties
5. ✅ 状态全覆盖 (如果 card 可交互: default / hover / focus)
6. ❌ 不 hard-code 任何 `#` / `px` / `rem` 值
7. ❌ 不新增 DESIGN.md 没定义的 token (如需, 先问用户)

漏任何一项 = AI 未正确消费 DESIGN.md.
