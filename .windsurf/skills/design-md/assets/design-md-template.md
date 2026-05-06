# DESIGN.md 空白模板 (复制填用)

> 复制下方所有内容到**项目根目录的 `DESIGN.md`**. 然后按注释填. 完成后跑 `npx @google/design.md lint DESIGN.md`.

---

```markdown
---
version: alpha
name: <你的设计系统名字 · e.g. "MyApp Dark">
description: <一句话描述 · e.g. "面向创作者的暗色优先设计系统">

colors:
  # ==== 品牌色 (3 个) ====
  primary: "#000000"      # TODO 替换 · 主背景 / 核心文本
  secondary: "#000000"    # TODO · 次级面板
  accent: "#000000"       # TODO · CTA / 强调
  
  # ==== 中性 scale (推荐 5-6 档) ====
  neutral50:  "#f5f5f5"   # TODO · 最亮 · 主正文
  neutral100: "#e5e5e5"   # TODO
  neutral300: "#a3a3a3"   # TODO · 边框 / 占位符
  neutral500: "#737373"   # TODO · 次要正文
  neutral700: "#404040"   # TODO
  neutral900: "#171717"   # TODO · 最暗 / 深面板
  
  # ==== 语义色 (4 个) ====
  success: "#22c55e"      # 可用默认
  warning: "#f59e0b"
  error:   "#ef4444"
  info:    "#3b82f6"

typography:
  # ==== 标题 4 级 (必需) ====
  headingXl:
    fontFamily: "Inter, system-ui, sans-serif"   # TODO 改字体栈
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
  headingL:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.25
  headingM:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  headingS:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  
  # ==== 正文 3 级 (必需) ====
  bodyL:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  bodyM:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  bodyS:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  
  # ==== 辅助 (推荐) ====
  captionM:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  labelM:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  
  # ==== 等宽 (可选) ====
  codeM:
    fontFamily: "Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6

spacing:
  # Tailwind 4 基数. 如要 8 基数 Material 风, 改 sm/md/lg/xl/2xl
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

rounded:
  none: 0
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "24px"
  full: "9999px"

components:
  # V1 最小 6 组件
  
  button:
    backgroundColor: "{colors.accent}"
    color: "{colors.neutral50}"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.2}"
    borderRadius: "{rounded.md}"
    fontSize: "{typography.bodyM.fontSize}"
    fontWeight: 600
  
  input:
    backgroundColor: "{colors.secondary}"
    borderColor: "{colors.neutral500}"
    borderWidth: "1px"
    borderRadius: "{rounded.md}"
    paddingX: "{spacing.3}"
    paddingY: "{spacing.2}"
    color: "{colors.neutral50}"
    placeholderColor: "{colors.neutral300}"
    focusBorderColor: "{colors.accent}"
  
  card:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.6}"
    # shadow: TODO (暗色主题无需, 浅色体系加)
  
  modal:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.xl}"
    padding: "{spacing.8}"
    maxWidth: "600px"
    overlayColor: "rgba(0, 0, 0, 0.6)"
  
  nav:
    backgroundColor: "{colors.primary}"
    itemHoverColor: "{colors.accent}"
    activeBorderColor: "{colors.accent}"
    activeBorderWidth: "3px"
  
  tab:
    underlineActiveColor: "{colors.accent}"
    underlineWidth: "2px"
    inactiveColor: "{colors.neutral300}"
---

# <项目名> Design System

## Overview

**<产品名>** 是 <一句话定义>. 目标用户是 <人群描述>.

设计情感基调: <3-5 个具体形容词, e.g. "暗色 · 霓虹 · 专业 · 电影感">.

视觉参考 (意图不抄袭): <1-3 个对标产品, 说明对标哪一面>.

主题偏好: <暗色主导 / 光明主导 / 双主题>.

## Colors

<1-2 句总体调色策略>

### 品牌色
- **Primary (`{colors.primary}`):** <用在哪些场景>
- **Secondary (`{colors.secondary}`):** <...>
- **Accent (`{colors.accent}`):** <用在什么语境 + 不用在哪>

### 中性色
<1 句说明 scale 怎么用>
- **neutral50:** 最亮, 主要正文
- **neutral300:** 边框 / 占位符
- **neutral500:** 次要正文 / 禁用
- **neutral700:** <...>
- **neutral900:** 最暗, 深面板背景

### 语义色
仅用于系统通知, 不装饰.
- **Success:** 保存成功 / 校验通过
- **Warning:** 配额警告
- **Error:** API 失败 / 表单错误
- **Info:** 辅助说明

### 颜色禁忌
- ❌ 不用 <...>
- ❌ 不在正文区用 <...>

## Typography

字体: <字体栈说明>  
基数: 16px = bodyM default. <说明 scale 比例>

### 级别用途
- **headingXl (40px):** <用途>
- **headingL (32px):** <用途>
- **headingM (24px):** <用途>
- **headingS (20px):** <用途>
- **bodyL (18px):** <用途>
- **bodyM (16px):** 默认正文
- **bodyS (14px):** <用途>
- **captionM (12px):** 元信息 (时间戳 / 字数统计)
- **labelM (14px):** 表单标签
- **codeM:** 等宽 / 代码 / 剧本

### 规则
- <1-3 条排版规则>

## Layout

### 间距哲学
基数 4 (Tailwind 风), scale xs(4)→2xl(96).  
<整体偏紧凑 / 宽松?>

### 网格
<固定 / 流式 / 三栏?> + max-width <值>

### 安全区
- 页面横向 padding: 24px (`{spacing.6}`)
- 顶栏高度: <值>
- 侧栏宽度: <值>

## Elevation & Depth

深度策略: <阴影 / 色调差 / 边框 / 混合?>

### 层级
- **Level 0 (主背景):** `{colors.primary}`, 无阴影
- **Level 1 (卡片 / 侧栏):** `{colors.secondary}`, 色调提亮
- **Level 2 (modal / 浮层):** `{colors.secondary}` + 1px 边框
- **Level 3 (主动 hover/focus):** accent 色发光阴影

## Shapes

圆角哲学: <锐利 / 柔和 / 混合?>

### Scale 语义
- `rounded.none`: 分割线 / 表格
- `rounded.sm` (4px): 标签 / chip
- `rounded.md` (8px): 默认 — button / input
- `rounded.lg` (12px): 卡片 / modal
- `rounded.xl` (16px): 大容器
- `rounded.full`: 仅头像

## Components

### Button
**变体**: primary / secondary / ghost / danger  
**状态**: default / hover / active / focus / disabled  
**尺寸**: sm (28px) / md (36px default) / lg (44px)

**用法**:
- **primary** (accent 底): 主 CTA, **每页最多一个**
- **secondary**: 次要操作
- **ghost**: 工具栏 / 列表项操作
- **danger**: 破坏性操作 (删除)

**不要**用 button 做: 页面跳转 (用 link), 纯文本操作 (用 text link)

### Input / Textarea
**状态**: default / hover (边框加深) / focus (accent 2px 边框) / error (error 色边框) / disabled  
**placeholder**: 用 neutral300, 不欺骗交互

### Card
**嵌套深度最多 2 级**.  
**阴影**: <暗色不用 / 浅色用 `{shadow.xxx}`>

### Modal / Dialog
**最大宽度 600px**.  
**动画**: fade + slight scale, 200ms ease-out.  
**遮罩**: rgba(0,0,0,0.6)

### Nav / Sidebar
**活动项**: accent 色左侧 3px 竖条 + 图标 accent.

### Tab
**活动态**: 底部 2px accent 下划线.

## Do's and Don'ts

### ✅ Do
1. 主 CTA 每页只一个
2. 所有颜色走 `{colors.xxx}` token, 不裸写 hex
3. 所有间距走 `{spacing.xxx}` token, 不裸写 px
4. <自定规则>

### ❌ Don't
1. 不用彩虹色表达多分类 (同语义同色)
2. 不在正文区用 accent
3. 不做光明版主题 (如果是暗色优先的项目)
4. <自定规则>

### 对比示例

**✅ 正确**:
```tsx
<button className="bg-accent px-4 py-2 rounded-md">
  开始
</button>
```

**❌ 错误**:
```tsx
<button className="bg-purple-500 px-4 py-2 rounded">
  开始
</button>
<!-- bg-purple-500 是 Tailwind 默认色, 不走 token -->
```
```

---

## 填完后

1. 跑 `npx @google/design.md lint DESIGN.md` 校验
2. 修所有 errors/warnings
3. 导出 Tailwind: `npx @google/design.md export --format tailwind DESIGN.md > tailwind.config.ts`
4. 项目根 `CLAUDE.md` 加强制消费指令 (见 SKILL `references/agent-consumption.md` §2.1)
5. 开始写组件
