# 精选示例 · 不同风格的 DESIGN.md 参考

> ⚠ **来源**: 本文件是 **design-md SKILL 的自创层**, **不是** Google 官方示例库.
> 3 个品牌 (NightShade / PaperNote / ClearSystem) 是**虚构**的教学用例, 不对应任何真实产品.
> 风格方向参考但不抄袭 Linear / Notion / Stripe 等, 具体 token 值是本 SKILL 作者杜撰.
> 用法: 看结构 + 学风格组合, **不要**把这里的 hex 值直接抄到真项目.

---

## 1. Example · 暗色霓虹 (类 Linear / Arc)

**风格**: 深色背景 + 紫/蓝霓虹强调 + 克制

```markdown
---
version: alpha
name: NightShade
description: 暗色霓虹开发者工具设计系统

colors:
  primary: "#0a0a0f"
  secondary: "#141420"
  accent: "#7c3aed"
  neutral50:  "#fafafa"
  neutral100: "#e4e4e7"
  neutral300: "#a1a1aa"
  neutral500: "#71717a"
  neutral700: "#3f3f46"
  neutral900: "#09090b"
  success: "#10b981"
  warning: "#f59e0b"
  error:   "#ef4444"
  info:    "#3b82f6"

typography:
  headingXl: { fontFamily: "Inter", fontSize: "40px", fontWeight: 700, lineHeight: 1.2 }
  headingL:  { fontFamily: "Inter", fontSize: "32px", fontWeight: 700, lineHeight: 1.25 }
  headingM:  { fontFamily: "Inter", fontSize: "24px", fontWeight: 600, lineHeight: 1.3 }
  headingS:  { fontFamily: "Inter", fontSize: "20px", fontWeight: 600, lineHeight: 1.4 }
  bodyL:     { fontFamily: "Inter", fontSize: "18px", fontWeight: 400, lineHeight: 1.6 }
  bodyM:     { fontFamily: "Inter", fontSize: "16px", fontWeight: 400, lineHeight: 1.5 }
  bodyS:     { fontFamily: "Inter", fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  captionM:  { fontFamily: "Inter", fontSize: "12px", fontWeight: 400, lineHeight: 1.4 }
  codeM:     { fontFamily: "JetBrains Mono", fontSize: "14px", fontWeight: 400, lineHeight: 1.6 }

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
  sm: "4px"
  md: "6px"       # 小一点, 更锐利
  lg: "10px"
  xl: "14px"
  full: "9999px"

components:
  button:
    backgroundColor: "{colors.accent}"
    color: "#ffffff"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.2}"
    borderRadius: "{rounded.md}"
    fontSize: "{typography.bodyS.fontSize}"
    fontWeight: 500
  
  input:
    backgroundColor: "{colors.secondary}"
    borderColor: "{colors.neutral700}"
    borderRadius: "{rounded.md}"
    paddingX: "{spacing.3}"
    paddingY: "{spacing.2}"
    color: "{colors.neutral50}"
    focusBorderColor: "{colors.accent}"
  
  card:
    backgroundColor: "{colors.secondary}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.6}"
---

# NightShade

## Overview
**NightShade** 是给开发者的团队协作工具. 目标用户: 软件工程师、产品经理, 25-40 岁, 注重效率和专注.

设计情感: 暗色 · 锐利 · 专业 · 低分贝 · 不打扰.

视觉参考: Linear (动画和微交互) / Arc (顶栏收敛).

主题偏好: **单一暗色**.

## Colors
基于"深色底 + 单一紫色强调"原则.

- **Primary (`{colors.primary}`):** 主背景, 深到几乎纯黑
- **Secondary (`{colors.secondary}`):** 卡片 / 侧栏
- **Accent (`{colors.accent}`):** CTA / 焦点 · 用得要省, 每页不超过 3 处
- **Neutral:** 灰度 scale, 50 最亮 (主文本), 900 最暗

### 颜色禁忌
- 不用红/橙作装饰 (只语义警告)
- 不在大面积用 accent

## Typography
Inter + JetBrains Mono. body 16px, 行高 1.5.

## Components
### Button
primary (accent 底) / secondary (边框) / ghost (无底无框).

## Do's and Don'ts
✅ 所有颜色走 token.  
✅ 按钮每页 ≤ 1 个主 CTA.  
❌ 不装饰性 emoji.  
❌ 不 drop shadow (暗色下不可见).
```

---

## 2. Example · 温暖纸感 (类 Notion)

**风格**: 米白 + 深墨 + 单一砖红强调 + 温度感

```markdown
---
version: alpha
name: PaperNote
description: 温暖纸感的笔记类工具设计系统

colors:
  primary: "#1A1C1E"          # 深墨 (文本)
  secondary: "#F7F5F2"        # 米白 (背景)
  accent: "#B8422E"           # 砖红 (CTA 唯一)
  neutral50:  "#FAFAF8"
  neutral100: "#ECE8E1"
  neutral300: "#B8B0A5"
  neutral500: "#6C6457"
  neutral700: "#3D362B"
  neutral900: "#1A1611"
  success: "#2E7D32"
  warning: "#F57C00"
  error:   "#C62828"
  info:    "#0288D1"

typography:
  # 衬线标题 + 无衬线正文
  headingXl: { fontFamily: "Lora", fontSize: "48px", fontWeight: 600, lineHeight: 1.2 }
  headingL:  { fontFamily: "Lora", fontSize: "36px", fontWeight: 600, lineHeight: 1.25 }
  headingM:  { fontFamily: "Lora", fontSize: "24px", fontWeight: 500, lineHeight: 1.3 }
  bodyL:     { fontFamily: "Source Sans 3", fontSize: "18px", fontWeight: 400, lineHeight: 1.7 }
  bodyM:     { fontFamily: "Source Sans 3", fontSize: "16px", fontWeight: 400, lineHeight: 1.6 }
  bodyS:     { fontFamily: "Source Sans 3", fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  captionM:  { fontFamily: "Source Sans 3", fontSize: "13px", fontWeight: 400, lineHeight: 1.5 }
  codeM:     { fontFamily: "IBM Plex Mono", fontSize: "14px", fontWeight: 400, lineHeight: 1.6 }

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
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"

components:
  button:
    backgroundColor: "{colors.accent}"
    color: "{colors.neutral50}"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.2}"
    borderRadius: "{rounded.md}"
  
  card:
    backgroundColor: "{colors.neutral50}"
    borderRadius: "{rounded.lg}"
    padding: "{spacing.6}"
    shadow: "0 1px 3px rgba(0,0,0,0.08)"
---

# PaperNote

## Overview
阅读和写作工具. 目标用户: 作家 / 记者 / 长文读者. 设计情感: 纸感 · 温暖 · 安静 · 让人想多读.

## Colors
调色板只 4 个主色:
- **Primary (墨 `#1A1C1E`):** 标题和正文
- **Secondary (米 `#F7F5F2`):** 页面底
- **Tertiary/Accent (砖红 `#B8422E`):** 交互唯一驱动
- **Neutral (石灰 `#F7F5F2`):** 辅助

## Do's and Don'ts
✅ 衬线字体用在标题.  
✅ 行高宽松 (1.6+).  
❌ 不用强饱和色 (破坏纸感).  
❌ 不做暗色版 (这是纸的审美).
```

---

## 3. Example · 简约中性 (类 Stripe / GitHub 公共版)

**风格**: 白底 + 黑字 + 单蓝强调 + 极简

```markdown
---
version: alpha
name: ClearSystem
description: 极简中性企业工具设计系统

colors:
  primary: "#1976D2"          # 企业蓝
  secondary: "#F5F5F5"
  accent: "#1976D2"           # 同主色, 不多加色
  neutral50:  "#FFFFFF"
  neutral100: "#F9FAFB"
  neutral300: "#D1D5DB"
  neutral500: "#6B7280"
  neutral700: "#374151"
  neutral900: "#111827"
  success: "#16A34A"
  warning: "#D97706"
  error:   "#DC2626"
  info:    "#0284C7"

typography:
  headingXl: { fontFamily: "Inter", fontSize: "36px", fontWeight: 700, lineHeight: 1.2 }
  headingL:  { fontFamily: "Inter", fontSize: "28px", fontWeight: 600, lineHeight: 1.25 }
  headingM:  { fontFamily: "Inter", fontSize: "20px", fontWeight: 600, lineHeight: 1.3 }
  bodyM:     { fontFamily: "Inter", fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  bodyS:     { fontFamily: "Inter", fontSize: "13px", fontWeight: 400, lineHeight: 1.5 }
  captionM:  { fontFamily: "Inter", fontSize: "12px", fontWeight: 500, lineHeight: 1.4 }
  codeM:     { fontFamily: "Menlo", fontSize: "13px", fontWeight: 400, lineHeight: 1.6 }

spacing:
  "0": 0
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"

rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"        # 克制, 不要软萌

components:
  button:
    backgroundColor: "{colors.primary}"
    color: "{colors.neutral50}"
    paddingX: "{spacing.4}"
    paddingY: "{spacing.2}"
    borderRadius: "{rounded.md}"
    fontSize: "{typography.bodyM.fontSize}"
    fontWeight: 500
---

# ClearSystem

## Overview
企业后台 / 仪表盘 / 工具类. 目标用户: 企业员工, 求快求准.

设计情感: 简 · 准 · 不抢眼.

## Do's and Don'ts
✅ 每页 1 个主色 CTA.  
✅ 信息密度优先.  
❌ 不用复杂装饰.  
❌ 不加动画做"有趣".
```

---

## 4. 示例对比矩阵

| 维度 | NightShade | PaperNote | ClearSystem |
|---|---|---|---|
| 主题 | 单一暗色 | 单一亮色 | 单一亮色 |
| 主色 | 紫 #7c3aed | 墨 #1A1C1E | 蓝 #1976D2 |
| 背景 | 深 #0a0a0f | 米白 #F7F5F2 | 纯白 #FFFFFF |
| 标题字体 | Inter | Lora (衬线) | Inter |
| 正文字号 | 16px | 16-18px | 14px |
| 圆角 | 6-14px (锐利) | 8-16px (柔和) | 4-8px (极简) |
| 强调色用法 | 克制 (每页 <3) | 唯一 (每页 <2) | 只主 CTA |
| 动效 | 快速微交互 | 轻柔 fade | 极简或无 |

---

## 5. 如何选择风格

| 产品类型 | 推荐方向 | 参考示例 |
|---|---|---|
| 创作工具 (剧本/写作/编曲) | 暗色 + 单色强调 | NightShade |
| 阅读/笔记/日记 | 温暖纸感 | PaperNote |
| 企业后台 / 工具 | 简约中性 | ClearSystem |
| 消费社交 (抖音/小红书风) | 不在本 SKILL 推荐列 (过于视觉驱动, 需要另一套 spec) | - |

---

## 6. 影语 FLIL-Web 推荐

**影语 FLIL-Web 属于"创作工具"**, 推荐**暗色霓虹** 风格 (类 NightShade, 但 accent 用更暖的紫/粉色调, 和 "短剧/戏剧" 氛围搭).

具体参见本 SKILL 工作流应用时, 用 §4.1 Greenfield 流程结合 影语 FLIL-Web 的具体品牌访谈结果生成.

---

## 7. 原文资源

Google 官方并没维护示例库, 但社区有:
- `VoltAgent/awesome-design-md` (GitHub) — 社区贡献的 DESIGN.md 示例集, 本 SKILL 未来升级时可 sync

本文件的 3 个示例是本 SKILL 作者 (Claude) 按规范**虚构**的 — 风格有所参考但不是任何真实产品的 DESIGN.md. 仅作学习用.
