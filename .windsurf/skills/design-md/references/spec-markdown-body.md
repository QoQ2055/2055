# Markdown Body · 8 分节模板与写法

> YAML 给机器读, markdown 给人和 AI 读. 本文档详解 8 个推荐分节的**写作模板** + **每节应答的问题**. 目标: AI 生成组件时能根据 markdown 理解 token 的语义意图.

---

## 分节总表

| # | 分节 | 必需 | 长度 | 应答的核心问题 |
|:-:|---|:-:|:-:|---|
| 1 | Overview | ✅ | 100-200 字 | 这是给谁的? 什么气质? |
| 2 | Colors | ✅ | 200-400 字 | 每个 token 用在哪? 为什么选这色? |
| 3 | Typography | ✅ | 200-300 字 | 每个级别的使用场景 |
| 4 | Layout | 推荐 | 100-200 字 | 网格 / 间距哲学 |
| 5 | Elevation & Depth | 可选 | 100-200 字 | 怎么传达层次? |
| 6 | Shapes | 可选 | 50-150 字 | 圆角的语义 |
| 7 | Components | 推荐 | 300-600 字 | 每个组件的状态 / 使用语境 |
| 8 | Do's and Don'ts | ✅ | 200-400 字 | 3-5 条红线 + 对比 |

**所有分节用 `##` (h2) 开头**. 可选一个 `#` (h1) 作文档标题.

---

## 1. Overview

### 目的
告诉 AI "这是给谁的设计系统, 情感基调是什么". AI 拿这段理解整体气质, 生成组件时会 prime 到正确审美方向.

### 模板

```markdown
## Overview

**[产品名]** 是 [一句话定义]. 目标用户是 [人群描述].

设计情感基调: [3-5 个形容词, e.g. 专业 / 克制 / 暗色 / 有温度 / 带仪式感].

视觉参考 (意图不抄袭): [1-3 个对标产品, 说明对标哪一面]

主题偏好: [暗色主导 / 光明主导 / 双主题 / 系统跟随]
```

### 实例

```markdown
## Overview

**影语 FLIL** 是一个面向中国短剧创作者的剧本→分镜生产工具. 用户是竖屏短剧导演、编剧、独立创作团队 (年龄 25-40, 常用抖音/快手发行).

设计情感基调: 暗色 · 霓虹 · 专业 · 电影感 · 拒绝"轻量 SaaS"审美.

视觉参考: Linear (氛围色运用) · Arc browser (顶栏压缩) · Readwise Reader (长文本沉浸感). 不参考 Notion / ClickUp 类通用 SaaS.

主题偏好: **单一暗色主题**, 不做光明版. 光明版会破坏"创作的夜晚感".
```

### 写作要点

- **5-6 句话就够**, 别长篇
- **气质形容词要具体**, 不要 "好看" / "大气" 这类模糊词
- **对标别说"我要抄 Linear"**, 说 "参考 Linear 的 xxx 一面"
- **主题必明确**, 决定后续 colors 的取值

---

## 2. Colors

### 目的

**每个 color token 配一句语义说明**. AI 读到 `primary: "#1A73E8"` 要能从 markdown 知道 "primary 用在 CTA 按钮和激活状态", 而不是瞎猜.

### 模板

```markdown
## Colors

[1-2 句总体调色策略]

### 品牌色
- **Primary (`{colors.primary}`):** [用在哪些场景]
- **Secondary (`{colors.secondary}`):** [同]
- **Accent (`{colors.accent}`):** [同]

### 中性色 (Neutral Scale)
[1 句说明 scale 怎么用]
- **neutral50:** 最亮, 用于 [...]
- **neutral900:** 最暗, 用于 [...]
- 中间档按深浅平滑过渡

### 语义色
- **Success (`{colors.success}`):** 仅用于 [...]
- **Warning:** [...]
- **Error:** [...]
- **Info:** [...]

[可选] ### 颜色禁忌
- 不用 [...]
- [...]
```

### 实例

```markdown
## Colors

基于"暗夜霓虹"主题. 调色板遵循"深底 + 单一霓虹强调色"原则, 避免彩虹过载.

### 品牌色
- **Primary (`{colors.primary}` = #120b19):** 深紫近黑, 主背景色, 用于整站 body 背景和一级容器
- **Secondary (`{colors.secondary}` = #1f1529):** 深紫, 次级面板 (侧栏 / 卡片 / 模态框)
- **Accent (`{colors.accent}` = #c084fc):** 霓虹紫, 唯一的主动色, 仅用于 CTA 按钮 / 激活状态 / 焦点环. **不要**用作大面积背景.

### 中性色
浅到深 5 档, 50 最亮 (用于主要正文), 900 最暗 (用于深色 well/code block).
- **neutral50 (#f4edf8):** 主要正文
- **neutral300 (#9b84ad):** 次要正文 / 占位符
- **neutral500 (#6e5a80):** 边框 / 禁用文本
- **neutral900 (#0a0612):** 深度面板背景

### 语义色
只用于系统通知, 不用于装饰.
- **Success:** 保存成功 / 校验通过
- **Warning:** 配额即将用尽
- **Error:** API 失败 / 表单错误
- **Info:** 辅助说明

### 颜色禁忌
- ❌ 不用饱和红/橙 (与霓虹紫冲突, 破坏整体氛围)
- ❌ 不在正文区用 accent (只用于可交互元素)
- ❌ 不超过 3 个强调色并置 (视觉过载)
```

### 写作要点

- **每个 token 配 1 句语义**, 不多不少
- **强调"用在哪" + "不用在哪"**
- **引用 token 用 `{colors.xxx}` 语法**, markdown 和 YAML 双锚定
- **禁忌段是加分项**, 尤其对 AI 明显 (AI 看到禁忌会明确绕开)

---

## 3. Typography

### 目的

AI 看到 `bodyM` 不知道是不是正文默认. markdown 告诉它: "bodyM 是 ≥90% 情况下的正文默认".

### 模板

```markdown
## Typography

字体: [字体栈]
基数 + 比例: [基数 16px 1.25 比例 / Material scale / 自定义]

### 级别用途
- **displayL / displayM:** [落地页大标题等]
- **headingXl-S:** [4 级标题用法]
- **bodyL / bodyM / bodyS:** [正文三级]
- **captionM / labelM:** [辅助]
- **codeM:** [等宽场景]

### 规则
- [1-3 条跨级别规则]
```

### 实例

```markdown
## Typography

字体: `Inter, system-ui, sans-serif`. Inter 是主字体, 未加载时回退 system.  
基数: 16px = bodyM default. 向上 1.5 比例, 向下 0.875 比例.

### 级别用途
- **headingXl (40px):** 页面主标题 (只有首页和项目名有)
- **headingL (32px):** 大 section 标题
- **headingM (24px):** 对话卡片 / modal 标题
- **headingS (20px):** 小卡片标题 / 表单节标题
- **bodyL (18px):** agent 消息正文 (加大可读性)
- **bodyM (16px):** 默认正文 (表单 / 说明 / 项目列表)
- **bodyS (14px):** 次要正文 / 表格密集信息
- **captionM (12px):** 元信息 (时间戳 / 字数统计 / 版本号)
- **codeM:** 剧本面板 (等宽排版, 保留剧本格式感)

### 规则
- 标题必用非默认字重 (600+), 和 body 的 400 拉开层级
- `captionM` 不与 `bodyS` 并存于同一区域 (视觉太接近)
- 剧本面板强制 `codeM` 字体, 不用 body 字体 (保留"打字机感")
```

---

## 4. Layout

### 模板

```markdown
## Layout

### 间距哲学
基数 [4 / 8], scale [xs → xl].  
[1-2 句说明紧凑还是宽松]

### 网格
[固定宽度 / 流式 / 12 列网格 / 自适应] + max-width [值]

### 安全区
- 页面横向 padding: [值]
- 顶栏高度: [值]
- 侧栏宽度: [值]
```

### 实例

```markdown
## Layout

### 间距哲学
基数 4 (Tailwind 风), scale xs(4) / sm(8) / md(16) / lg(24) / xl(32) / 2xl(48) / 3xl(64).  
整体**偏紧凑** (短剧创作者常在小屏幕, 不浪费像素).

### 网格
三栏固定布局, 不用 12 列网格:
- 左窄栏 (图标导航): 60px 固定
- 中对话栏: 500px 固定, 最小 400px
- 右面板: flex-1 自适应剩余宽度

整站 max-width: 无限 (充分利用大屏)

### 安全区
- 页面横向 padding: 24px (=`{spacing.6}`)
- 顶栏高度: 60px
- 左栏宽度: 60px
- 中栏宽度: 500px (minmax 400px-600px)
```

---

## 5. Elevation & Depth

### 目的

在无 3D 的扁平设计里, 怎么让不同层级看起来不同 (modal 浮在 card 上方?).

### 模板

```markdown
## Elevation & Depth

深度策略: [阴影 / 色调差 / 边框]

### 层级
- Level 0 (平地): [colors.xxx] 背景, 无阴影
- Level 1: [...]
- Level 2: [...]
- Level 3: [...]
```

### 实例 (暗色主题)

```markdown
## Elevation & Depth

暗色主题下, **阴影不可见**, 所以用 **色调差 + 霓虹光晕** 传达层级:

### 层级
- **Level 0 (主背景):** `{colors.primary}` = #120b19, 完全无阴影
- **Level 1 (卡片 / 侧栏):** `{colors.secondary}` = #1f1529, 色调比 L0 提亮一档
- **Level 2 (modal / 浮层):** `{colors.secondary}` + 1px `{colors.neutral500}` 边框
- **Level 3 (主动元素 hover/focus):** accent 色内发光阴影 `0 0 20px rgba(192, 132, 252, 0.3)`

不用 box-shadow 模拟阳光下的阴影 — 暗夜霓虹体系里那是错位的.
```

---

## 6. Shapes

### 模板

```markdown
## Shapes

圆角哲学: [锐利 / 柔和 / 混合]

### Scale 语义
- `rounded.none / xs`: [...]
- `rounded.md`: [默认组件]
- `rounded.lg / xl`: [大容器]
- `rounded.full`: [徽章 / avatar]
```

### 实例

```markdown
## Shapes

混合: **控件柔和 (md-lg), 容器中等 (lg-xl)**, 不走 full-rounded 风潮 (那是移动端扁平设计, 不适合桌面创作工具).

### Scale 语义
- `rounded.none`: 分割线 / 表格
- `rounded.sm` (4px): 标签 / chip
- `rounded.md` (8px): 默认 — button / input / dropdown
- `rounded.lg` (12px): 卡片 / modal
- `rounded.xl` (16px): 大容器 / 对话气泡
- `rounded.full`: 仅头像
```

---

## 7. Components

### 目的

每个组件的 YAML token 定义在 `components.xxx`. markdown 告诉 AI **状态、语境、变体**.

### 模板

```markdown
## Components

### Button
**变体**: primary / secondary / ghost / danger
**状态**: default / hover / active / focus / disabled
**尺寸**: sm / md (default) / lg
**用法**:
- **primary**: 主 CTA, 每页最多一个
- **secondary**: 次要操作
- [...]
[何时不该用 button, 改用 link]

### Input
[同结构]

### Card
[同]

### Modal
[同]

...
```

### 实例

```markdown
## Components

### Button
**变体**: `primary` / `secondary` / `ghost` / `danger`  
**状态**: default / hover (accent 色加深 10%) / active (加深 20%) / focus (accent 色 2px outline) / disabled (opacity 0.5 + cursor not-allowed)  
**尺寸**: sm (28px 高) / md (36px, default) / lg (44px)

**用法**:
- **primary** (accent 背景): 主 CTA, **每页最多一个** (过多会稀释强调)
- **secondary** (neutral 边框, 透明底): 次要操作
- **ghost** (无边框无底, 只 accent 文字): 工具栏按钮 / 列表项操作
- **danger** (error 色背景): 破坏性操作, 如删除项目

**不要**用 button 做:
- 页面跳转 (用 link)
- 纯文本操作 (用 text link)

### Input / Textarea
**状态**: default (neutral500 边框) / hover (边框加深) / focus (accent 2px 边框 + 发光) / error (error 色边框 + 下方红字) / disabled  
**placeholder**: 用 neutral500, 不用占位文字欺骗交互

### Card
**嵌套深度最多 2 级**. Card 里放 Card 第三层视觉就乱.  
**阴影**: 暗色体系下**不用**, 靠 `{colors.secondary}` 色调提亮表达层级.

### Modal / Dialog
**最大宽度 600px** (超大阅读疲劳).  
**出现**: fade + slight scale, 200ms cubic-bezier(0.2, 0, 0, 1)  
**背景遮罩**: rgba(0,0,0,0.6) 确保 focus 在 modal

### Nav / Sidebar
**活动项**: accent 色左侧 3px 竖条 + 图标 accent, 不整块背景反白 (太重)

### Tab / Pill
**Tab**: 底部 2px accent 下划线标活动  
**Pill**: 用于筛选器, 活动态 accent 背景 + neutral900 文字
```

---

## 8. Do's and Don'ts

### 目的

**3-5 条硬红线**. AI 读到会明确规避.

### 模板

```markdown
## Do's and Don'ts

### ✅ Do
1. [...]
2. [...]
3. [...]

### ❌ Don't
1. [...]
2. [...]
3. [...]

### 对比示例
**正确**:
[描述或代码片段]

**错误**:
[描述或代码片段]
```

### 实例

```markdown
## Do's and Don'ts

### ✅ Do
1. 主 CTA 每页**只一个**, 用 primary button
2. 所有颜色都走 `{colors.xxx}` token, 不裸写 hex
3. 所有间距都走 `{spacing.xxx}` token, 不裸写 px
4. 暗色主题下用色调差 + 霓虹光晕表达层级, 不用阴影

### ❌ Don't
1. **不要**用彩虹色表达多分类 (同语义应同色)
2. **不要**在正文区用 accent (只用于交互元素)
3. **不要**做光明版主题 (破坏"创作夜晚感")
4. **不要**把 button 做成圆 pill (rounded.full), 除了头像

### 对比示例

**✅ 正确**:
```tsx
<button className="bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] rounded-[var(--radius-md)]">
  开始破题
</button>
```

**❌ 错误**:
```tsx
<button className="bg-purple-500 px-4 py-2 rounded">   {/* 颜色 hard-coded, 不走 token */}
  开始破题
</button>
<button className="bg-accent" style={{padding: '12px 18px'}}>  {/* 间距不走 scale */}
```
```

---

## 附录: 常犯写作错误

| 错误 | 症状 | 改法 |
|---|---|---|
| 分节过长 | Overview 500 字 | 砍到 150 字以内 |
| 用形容词水文 | "这个颜色很专业很高级" | 改具体: "用于主 CTA, 深蓝给'可靠'感" |
| Token 不引用 | markdown 里直接写 "#1A73E8" | 改 `{colors.primary}` |
| Do's / Don'ts 太泛 | "要保持一致" | 改具体: "所有 button 圆角必用 rounded.md" |
| 组件段缺状态 | 只说 default, 没说 hover/focus/disabled | 补全 5 状态 |
| Components 列太多 | 30+ 组件 | V1 只列 6 核心, 其他 V2 加 |

---

## 与 AI agent 的配合

AI 读 DESIGN.md 生成组件时会:
1. 先 parse YAML → 拿精确 token 值
2. 搜索当前需要生成的组件类型 (如 "Button") 对应的 `components.button` 段
3. 读 markdown `## Components` 节 "Button" 段理解变体 / 状态 / 语境
4. 读 `## Do's and Don'ts` 避开红线
5. 生成代码, 所有值都引 token

要让这 5 步都有效, markdown 必须写全. 省掉一个 AI 就瞎一只眼.
