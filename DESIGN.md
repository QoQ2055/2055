---
version: 1.0.0-alpha
name: CineForge Web
description: AI 辅助剧本与小说工作台 · 暖橙 + warm stone 中性色 · 创作工具温度
status: alpha

# ════════════════════════════════════════════════
#  COLORS
# ════════════════════════════════════════════════
colors:
  primary:
    50:  '#fff7ed'
    100: '#ffedd5'
    200: '#fed7aa'
    300: '#fdba74'
    400: '#fb923c'
    500: '#f97316'
    600: '#ea580c'
    700: '#c2410c'
    800: '#9a3412'
    900: '#7c2d12'

  secondary:
    400: '#2dd4bf'
    500: '#14b8a6'
    600: '#0d9488'

  accent: null

  neutral:
    50:  '#fafaf9'
    100: '#f5f5f4'
    200: '#e7e5e4'
    300: '#d6d3d1'
    400: '#a8a29e'
    500: '#78716c'
    600: '#57534e'
    700: '#44403c'
    800: '#292524'
    900: '#1c1917'
    950: '#0c0a09'

  semantic:
    success:        '#10b981'
    successHover:   '#059669'
    successActive:  '#047857'
    warning:        '#f59e0b'
    warningHover:   '#d97706'
    warningActive:  '#b45309'
    danger:         '#e11d48'
    dangerHover:    '#be123c'
    dangerActive:   '#9f1239'
    info:           '#3b82f6'
    infoHover:      '#2563eb'
    infoActive:     '#1d4ed8'

  themes:
    dark:
      bg.canvas:        '{colors.neutral.950}'
      bg.surface:       '{colors.neutral.900}'
      bg.elevated:      '{colors.neutral.800}'
      bg.overlay:       '#0c0a09e6'
      border.subtle:    '{colors.neutral.900}'
      border.default:   '{colors.neutral.800}'
      border.strong:    '{colors.neutral.700}'
      text.primary:     '{colors.neutral.50}'
      text.secondary:   '{colors.neutral.400}'
      text.muted:       '{colors.neutral.500}'
      text.onPrimary:   '#ffffff'
      action.primary:        '{colors.primary.500}'
      action.primaryHover:   '{colors.primary.400}'
      action.primaryActive:  '{colors.primary.600}'
      action.secondary:      '{colors.secondary.500}'
      action.secondaryHover: '{colors.secondary.400}'
      focus.ring:       '{colors.primary.500}'

    light:
      bg.canvas:        '{colors.neutral.50}'
      bg.surface:       '#ffffff'
      bg.elevated:      '{colors.neutral.100}'
      bg.overlay:       '#0c0a09b3'
      border.subtle:    '{colors.neutral.100}'
      border.default:   '{colors.neutral.200}'
      border.strong:    '{colors.neutral.300}'
      text.primary:     '{colors.neutral.900}'
      text.secondary:   '{colors.neutral.600}'
      text.muted:       '{colors.neutral.500}'
      text.onPrimary:   '#ffffff'
      action.primary:        '{colors.primary.600}'
      action.primaryHover:   '{colors.primary.500}'
      action.primaryActive:  '{colors.primary.700}'
      action.secondary:      '{colors.secondary.600}'
      action.secondaryHover: '{colors.secondary.500}'
      focus.ring:       '{colors.primary.500}'

# ════════════════════════════════════════════════
#  TYPOGRAPHY
# ════════════════════════════════════════════════
typography:
  fontFamilies:
    sans:    ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif']
    mono:    ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
    reading: ['Source Han Serif SC', 'Georgia', 'Songti SC', 'PingFang SC', 'serif']

  scales:
    displayL:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '40px'
      fontWeight: 700
      lineHeight: '1.15'
      letterSpacing: '-0.02em'
    headingXl:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '28px'
      fontWeight: 700
      lineHeight: '1.2'
      letterSpacing: '-0.015em'
    headingL:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '22px'
      fontWeight: 600
      lineHeight: '1.3'
    headingM:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '18px'
      fontWeight: 600
      lineHeight: '1.35'
    headingS:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '15px'
      fontWeight: 600
      lineHeight: '1.4'
    bodyL:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '16px'
      fontWeight: 400
      lineHeight: '1.65'
    bodyM:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '14px'
      fontWeight: 400
      lineHeight: '1.55'
    bodyS:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '13px'
      fontWeight: 400
      lineHeight: '1.5'
    bodyReading:
      fontFamily: '{typography.fontFamilies.reading}'
      fontSize:   '17px'
      fontWeight: 400
      lineHeight: '1.85'
      letterSpacing: '0.01em'
    captionM:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '12px'
      fontWeight: 500
      lineHeight: '1.4'
      letterSpacing: '0.01em'
    labelM:
      fontFamily: '{typography.fontFamilies.sans}'
      fontSize:   '11px'
      fontWeight: 600
      lineHeight: '1.3'
      letterSpacing: '0.08em'
    codeM:
      fontFamily: '{typography.fontFamilies.mono}'
      fontSize:   '13px'
      fontWeight: 400
      lineHeight: '1.55'

# ════════════════════════════════════════════════
#  SPACING
# ════════════════════════════════════════════════
spacing:
  none:  '0'
  xs:    '4px'
  sm:    '8px'
  md:    '12px'
  lg:    '16px'
  xl:    '24px'
  2xl:   '32px'
  3xl:   '48px'
  4xl:   '64px'
  5xl:   '96px'

  roles:
    insetXs:    '{spacing.xs}'
    insetSm:    '{spacing.sm}'
    insetMd:    '{spacing.md}'
    insetLg:    '{spacing.lg}'
    insetXl:    '{spacing.xl}'
    inset2xl:   '{spacing.2xl}'
    stackXs:    '{spacing.xs}'
    stackSm:    '{spacing.sm}'
    stackMd:    '{spacing.md}'
    stackLg:    '{spacing.lg}'
    stackXl:    '{spacing.xl}'
    stack2xl:   '{spacing.2xl}'
    stack3xl:   '{spacing.3xl}'
    pageMarginX:     '{spacing.xl}'
    pageMarginXLg:   '{spacing.2xl}'
    pageMarginY:     '{spacing.2xl}'
    contentMaxWidth: '1280px'
    readingMaxWidth: '720px'
    sidebarWidth:    '240px'
    drawerWidth:     '420px'
    modalWidth:      '560px'

# ════════════════════════════════════════════════
#  ROUNDED
# ════════════════════════════════════════════════
rounded:
  none: '0'
  xs:   '4px'
  sm:   '6px'
  md:   '8px'
  lg:   '12px'
  xl:   '16px'
  2xl:  '24px'
  full: '9999px'
  roles:
    button:   '{rounded.sm}'
    iconBtn:  '{rounded.md}'
    pill:     '{rounded.full}'
    input:    '{rounded.md}'
    card:     '{rounded.lg}'
    panel:    '{rounded.lg}'
    modal:    '{rounded.xl}'
    image:    '{rounded.lg}'
    avatar:   '{rounded.full}'
    chip:     '{rounded.sm}'
    badge:    '{rounded.full}'

# ════════════════════════════════════════════════
#  ELEVATION (主题感知)
# ════════════════════════════════════════════════
elevation:
  themes:
    dark:
      flat:
        boxShadow:  'none'
        background: '{colors.themes.dark.bg.surface}'
        border:     '1px solid {colors.themes.dark.border.subtle}'
      raised:
        boxShadow:  '0 1px 2px 0 #00000040'
        background: '{colors.themes.dark.bg.surface}'
        border:     '1px solid {colors.themes.dark.border.default}'
      floating:
        boxShadow:  '0 8px 24px -4px #00000080, 0 2px 6px -2px #00000060'
        background: '{colors.themes.dark.bg.elevated}'
        border:     '1px solid {colors.themes.dark.border.default}'
      lifted:
        boxShadow:  '0 16px 48px -8px #000000a6, 0 4px 12px -2px #00000080'
        background: '{colors.themes.dark.bg.elevated}'
        border:     '1px solid {colors.themes.dark.border.strong}'
    light:
      flat:
        boxShadow:  'none'
        background: '{colors.themes.light.bg.surface}'
        border:     '1px solid {colors.themes.light.border.subtle}'
      raised:
        boxShadow:  '0 1px 2px 0 #0c0a0914, 0 1px 1px -1px #0c0a090a'
        background: '{colors.themes.light.bg.surface}'
        border:     '1px solid {colors.themes.light.border.default}'
      floating:
        boxShadow:  '0 8px 24px -4px #0c0a0926, 0 2px 6px -2px #0c0a0914'
        background: '#ffffff'
        border:     '1px solid {colors.themes.light.border.default}'
      lifted:
        boxShadow:  '0 16px 48px -8px #0c0a0933, 0 4px 12px -2px #0c0a091f'
        background: '#ffffff'
        border:     '1px solid {colors.themes.light.border.strong}'

# ════════════════════════════════════════════════
#  COMPONENTS
# ════════════════════════════════════════════════
components:
  button:
    base:
      fontFamily:    '{typography.fontFamilies.sans}'
      fontWeight:    700
      borderRadius:  '{rounded.roles.button}'
      transition:    'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease'
      focusRing:     '0 0 0 2px {colors.themes.dark.focus.ring}40'
    sizes:
      sm:
        fontSize:  '{typography.scales.bodyS.fontSize}'
        height:    '28px'
        paddingX:  '{spacing.md}'
        gap:       '{spacing.xs}'
      md:
        fontSize:  '{typography.scales.bodyM.fontSize}'
        height:    '32px'
        paddingX:  '{spacing.lg}'
        gap:       '{spacing.sm}'
      lg:
        fontSize:  '{typography.scales.bodyL.fontSize}'
        height:    '40px'
        paddingX:  '{spacing.xl}'
        gap:       '{spacing.sm}'
    variants:
      primary:
        bgDark:        '{colors.themes.dark.action.primary}'
        bgDarkHover:   '{colors.themes.dark.action.primaryHover}'
        bgDarkActive:  '{colors.themes.dark.action.primaryActive}'
        bgLight:       '{colors.themes.light.action.primary}'
        bgLightHover:  '{colors.themes.light.action.primaryHover}'
        bgLightActive: '{colors.themes.light.action.primaryActive}'
        text:          '#ffffff'
      secondary:
        bgDark:        '{colors.themes.dark.action.secondary}'
        bgDarkHover:   '{colors.themes.dark.action.secondaryHover}'
        bgLight:       '{colors.themes.light.action.secondary}'
        bgLightHover:  '{colors.themes.light.action.secondaryHover}'
        text:          '#ffffff'
      outline:
        bg:            'transparent'
        borderDark:    '{colors.themes.dark.border.default}'
        borderLight:   '{colors.themes.light.border.default}'
        textDark:      '{colors.themes.dark.text.primary}'
        textLight:     '{colors.themes.light.text.primary}'
        bgDarkHover:   '{colors.themes.dark.bg.elevated}'
        bgLightHover:  '{colors.themes.light.bg.elevated}'
      ghost:
        bg:            'transparent'
        textDark:      '{colors.themes.dark.text.secondary}'
        textLight:     '{colors.themes.light.text.secondary}'
        bgDarkHover:   '{colors.themes.dark.bg.elevated}'
        bgLightHover:  '{colors.themes.light.bg.elevated}'
      danger:
        bg:            '{colors.semantic.danger}'
        bgHover:       '{colors.semantic.dangerHover}'
        bgActive:      '{colors.semantic.dangerActive}'
        text:          '#ffffff'
      iconOnly:
        height:        '32px'
        width:         '32px'
        paddingX:      '0'
        borderRadius:  '{rounded.roles.iconBtn}'

  input:
    base:
      fontFamily:    '{typography.fontFamilies.sans}'
      fontSize:      '{typography.scales.bodyM.fontSize}'
      lineHeight:    '{typography.scales.bodyM.lineHeight}'
      borderRadius:  '{rounded.roles.input}'
      borderWidth:   '1px'
      transition:    'border-color 120ms ease, box-shadow 120ms ease'
    sizes:
      sm:
        height:   '28px'
        paddingX: '{spacing.sm}'
        paddingY: '{spacing.xs}'
      md:
        height:   '36px'
        paddingX: '{spacing.md}'
        paddingY: '{spacing.sm}'
      textarea:
        minHeight: '96px'
        paddingX:  '{spacing.md}'
        paddingY:  '{spacing.sm}'
    states:
      default:
        bgDark:           '{colors.themes.dark.bg.surface}'
        bgLight:          '{colors.themes.light.bg.surface}'
        borderDark:       '{colors.themes.dark.border.default}'
        borderLight:      '{colors.themes.light.border.default}'
        textDark:         '{colors.themes.dark.text.primary}'
        textLight:        '{colors.themes.light.text.primary}'
        placeholderDark:  '{colors.themes.dark.text.muted}'
        placeholderLight: '{colors.themes.light.text.muted}'
      focus:
        borderDark:  '{colors.themes.dark.action.primary}'
        borderLight: '{colors.themes.light.action.primary}'
        ring:        '{colors.themes.dark.focus.ring}40'
      error:
        border:      '{colors.semantic.danger}'
        ring:        '{colors.semantic.danger}40'
      disabled:
        opacity:     0.5
        cursor:      'not-allowed'

  card:
    base:
      borderRadius:  '{rounded.roles.card}'
      padding:       '{spacing.roles.insetLg}'
    variants:
      default:
        elevation:        '{elevation.themes.dark.raised}'
      interactive:
        elevation:        '{elevation.themes.dark.raised}'
        elevationHover:   '{elevation.themes.dark.floating}'
        cursor:           'pointer'
        transition:       'box-shadow 160ms ease, border-color 120ms ease'
      flat:
        elevation:        '{elevation.themes.dark.flat}'
      headerStack:
        gap:              '{spacing.roles.stackMd}'

  modal:
    overlay:
      bgDark:         '{colors.themes.dark.bg.overlay}'
      bgLight:        '{colors.themes.light.bg.overlay}'
      backdropFilter: 'blur(2px)'
      transition:     'opacity 160ms ease'
    container:
      borderRadius:   '{rounded.roles.modal}'
      elevation:      '{elevation.themes.dark.floating}'
      maxWidth:       '{spacing.roles.modalWidth}'
      paddingX:       '{spacing.roles.insetXl}'
      paddingY:       '{spacing.roles.insetLg}'
      transition:     'opacity 160ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1)'
    header:
      gap:            '{spacing.roles.stackMd}'
      paddingBottom:  '{spacing.roles.stackMd}'
      borderBottom:   '1px solid {colors.themes.dark.border.subtle}'
    body:
      paddingY:       '{spacing.roles.insetLg}'
      gap:            '{spacing.roles.stackMd}'
    footer:
      paddingTop:     '{spacing.roles.stackMd}'
      gap:            '{spacing.roles.stackSm}'
      borderTop:      '1px solid {colors.themes.dark.border.subtle}'
    drawer:
      width:          '{spacing.roles.drawerWidth}'
      borderRadius:   '0'
      transition:     'transform 240ms cubic-bezier(0.16,1,0.3,1)'

  nav:
    sidebar:
      width:        '{spacing.roles.sidebarWidth}'
      bgDark:       '{colors.themes.dark.bg.surface}'
      bgLight:      '{colors.themes.light.bg.surface}'
      borderRight:  '1px solid {colors.themes.dark.border.subtle}'
      paddingY:     '{spacing.roles.insetLg}'
      paddingX:     '{spacing.roles.insetSm}'
    item:
      base:
        height:        '32px'
        paddingX:      '{spacing.md}'
        gap:           '{spacing.sm}'
        borderRadius:  '{rounded.sm}'
        fontSize:      '{typography.scales.bodyM.fontSize}'
        fontWeight:    500
      states:
        default:
          textDark:    '{colors.themes.dark.text.secondary}'
          textLight:   '{colors.themes.light.text.secondary}'
          bg:          'transparent'
        hover:
          bgDark:      '{colors.themes.dark.bg.elevated}'
          bgLight:     '{colors.themes.light.bg.elevated}'
          textDark:    '{colors.themes.dark.text.primary}'
          textLight:   '{colors.themes.light.text.primary}'
        active:
          bgDark:      '{colors.primary.500}1f'
          bgLight:     '{colors.primary.500}14'
          textDark:    '{colors.primary.400}'
          textLight:   '{colors.primary.700}'
          fontWeight:  600
    sectionLabel:
      typography:    '{typography.scales.labelM}'
      colorDark:     '{colors.themes.dark.text.muted}'
      colorLight:    '{colors.themes.light.text.muted}'
      paddingX:      '{spacing.md}'
      paddingTop:    '{spacing.lg}'
      paddingBottom: '{spacing.xs}'

  tab:
    container:
      gap:           '{spacing.xs}'
      borderBottom:  '1px solid {colors.themes.dark.border.subtle}'
      paddingX:      '0'
    item:
      base:
        height:        '36px'
        paddingX:      '{spacing.md}'
        gap:           '{spacing.sm}'
        fontSize:      '{typography.scales.bodyM.fontSize}'
        fontWeight:    500
        borderBottom:  '2px solid transparent'
        transition:    'color 120ms ease, border-color 120ms ease'
      states:
        default:
          textDark:    '{colors.themes.dark.text.secondary}'
          textLight:   '{colors.themes.light.text.secondary}'
        hover:
          textDark:    '{colors.themes.dark.text.primary}'
          textLight:   '{colors.themes.light.text.primary}'
        active:
          textDark:    '{colors.primary.400}'
          textLight:   '{colors.primary.700}'
          borderBottom:'2px solid {colors.primary.500}'
    pill:
      borderRadius: '{rounded.roles.pill}'
      paddingX:     '{spacing.md}'
      height:       '28px'
      fontSize:     '{typography.scales.captionM.fontSize}'
      states:
        default:
          bgDark:    '{colors.themes.dark.bg.elevated}'
          bgLight:   '{colors.themes.light.bg.elevated}'
        active:
          bgDark:    '{colors.primary.500}'
          bgLight:   '{colors.primary.600}'
          text:      '#ffffff'
---

# CineForge Web · Design System

## Overview

CineForge 是面向单人创作者的 AI 辅助剧本与小说工作台。设计系统采用 **暖橙
+ 中性温暖灰（warm stone）** 双色调，配以友好圆角与舒展行高，给"创作型工具"
该有的温度感——让用户在长时间凝视屏幕时不被工程师工业风的灰冷压迫。

同时保留**信息密集**与**长文阅读**两套排版心智：节点 / artifact / 路径用
sans 紧凑排版（bodyM / captionM / codeM），小说章节 / KB 长文用 reading
（serif）+ 大行高 + 限宽，让创作内容呈现"接近一本书"的质感。

主要场景：剧本八步流水线 / 小说工作台 / 资产编排 / 静态 + 用户 KB 浏览。
双主题（暗 / 亮）通过 CSS 变量切换，主题感知由 token 系统统一驱动。

---

## Colors

> 品牌底调：暖橙 `primary.500` 是 CineForge 核心识别色，承担 CTA / 进度 /
> 聚焦。中性侧选 **warm stone**（比 zinc 偏暖 8°）——配合橙 primary，给创作
> 工具应有的"温度感"，避开纯灰冷的工程师审美。

### 语义角色（组件只引用语义 token，不直接引用色阶）

| 角色 | 用途 | dark 取值 | light 取值 |
|---|---|---|---|
| `bg.canvas` | 页面最底层 | neutral.950 | neutral.50 |
| `bg.surface` | 卡片 / 面板 | neutral.900 | white |
| `bg.elevated` | hover / 选中 | neutral.800 | neutral.100 |
| `border.default` | 默认边框 | neutral.800 | neutral.200 |
| `text.primary` | 主要正文 | neutral.50 | neutral.900 |
| `text.secondary` | 次要说明 | neutral.400 | neutral.600 |
| `text.muted` | 占位 / metadata | neutral.500 | neutral.500 |
| `action.primary` | 主 CTA | primary.500 | primary.600 |
| `action.secondary` | 副 CTA / 强调 | secondary.500 | secondary.600 |
| `focus.ring` | 焦点环 | primary.500 | primary.500 |

### 语义 4 角色

| token | 用途 | 视觉 |
|---|---|---|
| `semantic.success` | 通过 / 完成 / 积极 | `#10b981` 翡翠 |
| `semantic.warning` | 提醒 / 缓警 | `#f59e0b` 琥珀 |
| `semantic.danger`  | 错误 / 删除 | `#e11d48` 玫瑰 |
| `semantic.info`    | 中性提示 / 链接 | `#3b82f6` 海蓝 |

### 颜色禁忌

- ❌ 不要用 `bg-rose-500` `text-emerald-400` 这种**直接色阶**（违反 token 化）
- ❌ 不要在亮主题用 `#000` 阴影（必须用 `neutral.950 + alpha`，否则发灰）
- ❌ 不要把语义色当装饰色用（`success` 只表示"通过"，不要用作"绿色按钮"）
- ✅ **语义色必须配 icon 或文字**——色盲用户不能只靠纯色判断状态。
  例：badge 写"已通过 ✓ Pass"，不要纯绿点。

---

## Typography

CineForge 同时承载**创作内容**（小说 / 剧本正文）与**工程界面**（节点 /
artifact / 路径），排版阶梯需要兼顾"阅读舒展"与"信息密度"两种心智。

### 11 级阶梯使用决策

| 场景 | 用什么 |
|---|---|
| 项目列表 / 大型页面标题 | `headingXl` (28px) |
| 工作台主板块标题 | `headingL` (22px) |
| 卡片 / 模态 / 抽屉标题 | `headingM` (18px) |
| 子小节、面板分组 | `headingS` (15px) |
| KB 文档 / 分析师输出 | `bodyL` (16px / 1.65) |
| 通用 UI 文字、按钮、表单值 | `bodyM` (14px / 1.55) |
| Hint、表单旁注 | `bodyS` (13px / 1.5) |
| **小说章节 / 长文预览** | `bodyReading` (17px serif / 1.85) |
| Badge / metadata | `captionM` (12px) |
| 表单大写 label / tab 标签 | `labelM` (11px upper + tracking) |
| Artifact ID / 路径 / 代码 | `codeM` (13px mono) |

### Do's

- 正文 ≥ `bodyM`（不要再降到 sm 以下当主信息）
- 同一卡片内 ≤ 3 级文字尺寸
- 段落 lineHeight ≥ 1.5；阅读区 ≥ 1.65

### Don'ts

- 不要把 `captionM` 当正文用——它只配 metadata
- 不要在按钮里同时用 sans + mono 混排
- `displayL` 全仓不超过 3 处（hero / 空状态 / 重大里程碑）

---

## Layout

### 间距哲学

`inset` (元素内部 padding) 与 `stack` (元素之间 gap/margin) 严格分语义角色，
不靠 atomic 数字判断。详见前置 YAML `spacing.roles`。

### 页面框架

```
┌── pageMarginY (32px) ──────────────────┐
│                                         │
│  pageMarginX (24/32px)                 │
│  ┌────────────────────────────────┐    │
│  │  contentMaxWidth (1280px)      │    │
│  │                                │    │
│  │  阅读区: readingMaxWidth 720    │    │
│  │  Sidebar: 240px (固定)          │    │
│  │  Drawer:  420px                │    │
│  │  Modal:   560px                │    │
│  └────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 节奏规则

- **主板块间距 ≥ stackXl (24px)**——这是"创作工具温度"最关键的视觉动作
- 列表行 / 紧密信息区允许 stackSm (8px)
- 大段空状态用 inset2xl + stack3xl

---

## Elevation & Depth

### 4 档层级

| 角色 | 用途 |
|---|---|
| **flat** | 嵌入容器内、不抬起。列表行、表单字段。 |
| **raised** | 卡片"贴在画布上"。项目卡 / 节点卡 / KB 卡。 |
| **floating** | 浮起以吸引注意。模态 / 抽屉 / popover。 |
| **lifted** | 顶部 z 层。全屏模态 / 关键警告。 |

### 关键约束

- 暗主题：以**边框 + 表面色**为主、阴影为辅（暗色阴影几乎不可见）
- 亮主题：以**阴影**为主、边框为辅（双层阴影才显轻盈）
- 深度严格递增：父 floating + 子 lifted ✓；反过来 ❌
- 暗主题永不丢 border，亮主题阴影颜色必须用 `neutral.950 + alpha`

---

## Shapes

| 元素 | 圆角 |
|---|---|
| 按钮 | 6px (`rounded.roles.button`) |
| icon 方钮 | 8px |
| Badge / pill | full |
| 输入框 | 8px |
| 卡片 / 面板 | 12px |
| 模态 / 抽屉 | 16px |
| 头像 / 状态点 | full |

整体比 Tailwind 默认上调一档软化，避开技术冷感。

---

## Components

### 6 个原子的角色边界

| 组件 | 用途 | 不要 |
|---|---|---|
| **Button** | 触发动作 | 不要用 div + onClick 假装按钮 |
| **Input** | 表单字段 | 不要把 input 当 display 用（用 codeM 排版） |
| **Card** | 自包含信息单元 | 不要把整页面当 card 套 |
| **Modal** | 阻断主流的临时上下文 | 不要把核心步骤塞 modal |
| **Drawer** | 侧滑详情 | 不要 drawer 套 drawer |
| **Nav 侧栏 item** | 路由级别入口 | 不要塞功能按钮 |
| **Tab** | 同页内多视图切换 | 不要切换不相关页面 |

### 关键细节

- Button 默认 fontWeight **700**——保品牌橙 primary.500 同时在
  WCAG"大字粗体 14pt"标准下达 3:1 合规
- Button 只 6 个 variant（primary / secondary / outline / ghost / danger / iconOnly）——不造第 7 个
- Card hover 必须从 raised 升到 floating（视觉反馈）
- Modal 必须有 close iconBtn + Esc 关闭
- Tab 高亮**只用 primary 系**（暗 primary.400 / 亮 primary.700 + 底部 primary.500 2px border）

---

## Do's and Don'ts

### ① Token 优先 · 永不写裸值

```tsx
// ❌ Wrong
<button className="bg-[#f97316] text-white rounded-[6px]">运行</button>
// ✅ Right
<button className="btn-primary">运行</button>
```

### ② 主题感知 · 不要写死 dark:/light: 前缀

```tsx
// ❌ Wrong（绕过 token）
<div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
// ✅ Right（语义类自动跟主题）
<div className="bg-surface text-primary">
```

例外：装饰插画允许，需 `// design-md: decorative` 注释。

### ③ 节奏感 · 主板块间距 ≥ stackXl (24px)

```tsx
// ❌ Wrong
<div className="space-y-2">
  <ProjectInfoCard />
  <PipelineProgress />
</div>
// ✅ Right
<div className="space-y-6">    {/* 24px */}
  <ProjectInfoCard />
  <PipelineProgress />
</div>
```

### ④ 字号克制 · 同面板内 ≤ 3 级

```tsx
// ❌ Wrong（5 级混用）
<Card>
  <h2 className="text-2xl">Project</h2>
  <p className="text-base">Description</p>
  <span className="text-sm">Tags</span>
  <code className="text-xs">id-x9k</code>
  <small className="text-[10px]">3d ago</small>
</Card>
// ✅ Right（3 级：headingM / bodyM / captionM）
<Card>
  <h2 className="text-heading-m">Project</h2>
  <p className="text-body-m">Description</p>
  <div className="flex gap-2 text-caption text-muted">
    <span>Tags</span>
    <code className="font-mono">id-x9k</code>
    <span>3d ago</span>
  </div>
</Card>
```

### ⑤ 创作内容区 · 必须用 reading 排版 + readingMaxWidth

```tsx
// ❌ Wrong
<div className="text-sm leading-normal">{chapter.content}</div>
// ✅ Right
<article className="text-body-reading leading-reading max-w-reading mx-auto text-primary">
  {chapter.content}
</article>
```

适用：Novel 章节 / PreviewModal 长文 / KB / Analyzer。

### ⑥ 语义色不单靠颜色

```tsx
// ❌ Wrong（仅靠绿色判断）
<span className="size-2 rounded-full bg-success" />
// ✅ Right（颜色 + icon + 文字）
<Badge tone="success">
  <CheckIcon className="size-3" /> 已通过
</Badge>
```

---

## Versioning

- **v0.1.1-alpha** (本次落盘 · 2026-05-06): 初版抽取自 brownfield 现状，6 节齐全，双主题就位，Audit P0 全过
- 后续迭代走 SKILL §4.3 Evolution 流程：先 diff → 影响分析 → halt → 改 token → re-export Tailwind
- 改 token **务必同步 Phase 2 重新生成 `tailwind.config.ts` + `src/index.css`** 以保证 UI 一致性

> 编写任何 React / UI 组件前先读本文件。颜色 / 间距 / 字体一律从 token 取，
> 禁止 hardcode 或 arbitrary value（`bg-[#xxx]` `p-[7px]`）。
> 这是 AI agent (Cascade / Claude Code / Cursor / Copilot) 不在每次生成时
> drift 到不同审美的唯一防线。
