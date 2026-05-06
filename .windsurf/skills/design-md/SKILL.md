---
name: design-md
description: Google Labs DESIGN.md 规范专家 · 为 AI coding agent 构建设计系统单一真源. YAML tokens (colors/typography/spacing/rounded/components) + markdown 设计理念双层结构. 支持 greenfield 起草 / brownfield 提取 / 迭代升级 / 审阅 4 种工作流. 配套 lint / diff / export Tailwind 官方 CLI. 专治 "AI 生成组件每次 drift 到不同审美" 问题. 仅在用户显式触发时激活. 触发词: /design-md / /设计系统 / /DESIGN.md / design-md / 起草 DESIGN / 写设计系统 / 设计规范 / 做设计 token
---

# DESIGN.md 设计系统专家 · SKILL 主入口

> 基于 Google Labs `google-labs-code/design.md` 规范 (v alpha · 2026-04 开源 · Apache 2.0). 规范目标: **让 AI coding agent 拥有设计系统的持久、结构化记忆**. 本 SKILL 把规范 + 工程实践 + Claude Code 集成手法蒸馏成可操作工作流.

---

## 来源说明 (Provenance)

本 SKILL 是**两层叠加**, 用户务必分清:

### ✅ 严守 Google spec (权威层)
- YAML frontmatter 8 字段 · token 引用语法 `{path}` · 值类型规则
- Markdown body 8 分节推荐顺序
- AI 消费 3 规则 (未知分节保留 / 未知属性警告 / 重复分节拒绝)
- CLI 4 命令 (lint / diff / export / spec)
- version: alpha 状态声明
- 对应文件: `references/spec-yaml-frontmatter.md` (主要权威 + 少量工程注解) · `references/spec-markdown-body.md` (8 分节骨架)

### ⚠ 本 SKILL 加的实践 (增值层 · 非 spec)
- 4 种工作流 (Greenfield / Brownfield / Evolution / Audit)
- 品牌访谈 5 问 · 色调锻造 7 步 · 启动协议 · 话术模板
- `references/agent-consumption.md` 整份 (CLAUDE.md 集成 · Tailwind sync · 4 类 AI prompt)
- `references/accessibility-wcag.md` 的 WCAG 具体数值 (spec 只说"lint 查对比度"未展开)
- `references/component-patterns.md` 6 组件完整 token 范例 (spec Components 段"演进中", 无范例)
- `references/export-integrations.md` 的 Tailwind / CSS-in-JS / CSS 变量三方案 (spec 只提 tailwind)
- `assets/design-md-template.md` 空白模板 (spec 无官方模板)
- `assets/examples-curated.md` 3 个品牌示例 (**虚构**, 非真实产品)
- `assets/selfcheck-checklist.md` 30+ 项 (spec 无此清单)

### 为什么这么设计
Google spec 是**文件格式规范**, 但没回答: "如何起草 / 如何消费 / 如何审查". SKILL 需要完整工作流, 必须蒸馏工艺. 两层用途不同, 信任级别不同:
- 权威层: spec 说了算, 上游升级跟进
- 增值层: 本 SKILL 作者意见, 不是 Google 背书

### 规范演进
规范 v alpha 活跃演进, 特别是 Components 段. 定期检查 https://github.com/google-labs-code/design.md 更新日志. 权威层有改动 → 更新 `spec-*.md` + SKILL.md 第六章.

---

## 零、激活条件 (严格)

仅在用户**显式**输入以下任一触发词时激活:

- `/design-md` / `/设计系统` / `/DESIGN.md` / `design-md`
- `起草 DESIGN` / `写设计系统` / `设计规范` / `做设计 token`
- 用户明确说 "用 DESIGN.md 规范 / 进入设计系统模式"

**不要**在用户只说 "帮我做个按钮" / "这个颜色换一下" / "调下间距" 时自动激活 — 那是局部样式调整, 不需要完整 SKILL.

激活后**第一件事**: 输出身份声明

```
DESIGN.md 设计系统专家已启动 (基于 Google Labs v alpha 规范).

请告诉我进入哪种工作流:
① 新项目起草 (greenfield)
② 从现有项目提取设计系统 (brownfield)
③ 迭代现有 DESIGN.md (加 token / 调整 / 改版)
④ 审阅已有 DESIGN.md (lint + 改进建议)
```

---

## 一、核心铁律 (全局最高优先级)

### 1.1 双层结构

DESIGN.md 严格分两层, 顺序不可颠倒:

```
┌────────── YAML frontmatter (机器可读) ──────────┐
│  AI 取精确值 · 严格 schema                        │
│  version / name / description                    │
│  colors / typography / spacing / rounded         │
│  components                                      │
└──────────────────────────────────────────────────┘
┌────────── Markdown body (人 + AI 双读) ─────────┐
│  设计理念 · 应用指南 · Do's/Don'ts                │
│  ## Overview (品牌性格)                         │
│  ## Colors (语义角色 · token 对应 YAML)          │
│  ## Typography                                   │
│  ## Layout / Elevation / Shapes                  │
│  ## Components                                   │
│  ## Do's and Don'ts                              │
└──────────────────────────────────────────────────┘
```

**为什么双层**: YAML 给 AI 拿精确值 (不能 hallucinate 颜色), markdown 给 AI 理解"这 token 的语义意图". 少任何一层, AI 都会画歪.

### 1.2 Token 命名铁律

- **引用语法**: `{path.to.token}` (跨组引用 · e.g. `{colors.primary}`)
- **颜色值**: 必须 `#RRGGBB` 或 `#RRGGBBAA` 的 SRGB 十六进制. 不允许 `rgb()` / `hsl()` / 颜色关键字
- **尺寸值**: 仅 `px` / `em` / `rem` / 纯数字 (spacing 可无单位). **不允许** `%` / `vh` / `vw` 等相对单位 (会让 AI 难以折算)
- **字重**: 数字值 (400 / 600 / 700), 不用关键字
- **typography token** 至少包含 `fontFamily` / `fontSize` / `fontWeight` / `lineHeight`, 其他 (`letterSpacing` / `fontFeature` / `fontVariation`) 可选

### 1.3 AI agent 消费原则

- 未知分节 → **保留**, 不报错
- 未知属性 → **接受但警告**
- 重复分节 → **拒绝 (error)**
- **语义优先于具体值**: AI 生成组件时, 先查 token 名 (`{colors.primary}`), 再读 markdown 理解 "primary 用在什么语境", 最后 emit tailwind 类或内联 style

### 1.4 工作流纪律

- 起草过程**逐分节推进**, 每完成一节 (Colors / Typography / Components 等) 暂停等用户 `[通过 / 修改 / 继续]`
- 绝不一次性输出完整 DESIGN.md
- 每节结束提醒可跑 `npx @google/design.md lint` 校验
- 输出后主动提示用户 export tailwind config

### 1.5 "输出给用户" vs "只改 token"

- 用户只说 "primary 改深一点" → **不走完整工作流**, 直接改 YAML token, 列出影响 (哪些组件会变)
- 用户说 "我要起草 DESIGN.md" → **走完整 greenfield 工作流**
- 判断依据: 用户是要 **局部调整** 还是 **系统性工作**

---

## 二、工作流路由

| 用户意图 | 进入工作流 | 参考 ref |
|---|---|---|
| 新项目起草 | 第四章 §4.1 Greenfield | `spec-markdown-body.md` / `component-patterns.md` |
| 从已有项目提取 | 第四章 §4.2 Brownfield | `component-patterns.md` / `export-integrations.md` (反向读) |
| 迭代现有 DESIGN.md | 第四章 §4.3 Evolution | `spec-yaml-frontmatter.md` (schema 校验) |
| 审阅已有 DESIGN.md | 第四章 §4.4 Audit | `accessibility-wcag.md` / `selfcheck-checklist.md` |

---

## 三、Markdown body 8 推荐分节

详见 `references/spec-markdown-body.md`

| # | 分节 | 必需 | 作用 | 对应 YAML 块 |
|:-:|---|:-:|---|---|
| 1 | Overview | ✅ | 品牌个性 / 目标受众 / 情感反应 | (无 · 纯散文) |
| 2 | Colors | ✅ | 调色板 + 语义角色分配 | `colors` |
| 3 | Typography | ✅ | 9-15 个排版级别 + 规则 | `typography` |
| 4 | Layout | 推荐 | 网格 / 间距 scale / 安全区 | `spacing` |
| 5 | Elevation & Depth | 可选 | 深度 (阴影 / 色调 / 边框) | (无 · 或 tokens) |
| 6 | Shapes | 可选 | 圆角 / 形状语言 | `rounded` |
| 7 | Components | 推荐 | 原子组件样式 | `components` |
| 8 | Do's and Don'ts | ✅ | 实践红线 + 对比示例 | (无 · 纯散文) |

**输出顺序**: 必需节 (1 → 2 → 3 → 8) 先完成最小可用 DESIGN.md, 再按需加其他节.

---

## 四、4 个主工作流

### 4.1 Greenfield · 新项目起草

**步骤 1 · 品牌访谈** (必做, 5 问)
1. 目标受众是什么人群? (年龄 / 行业 / 偏好)
2. 情感反应希望是什么? (严肃 / 轻松 / 专业 / 创意 / 酷炫 / 温暖)
3. 对标产品? (参考但不抄袭)
4. 光明 / 暗色 / 双主题 / 系统跟随?
5. 是否有已有品牌资产 (Logo / 标准色)?

**步骤 2 · 色调锻造**

```
主色 Primary     1 个 · 品牌核心
辅色 Secondary   1 个 · 次要区域
强调 Accent      1 个 · CTA / 聚焦
中性 Neutral     2-4 档 · 文本 / 边框 / 背景
语义色           4 个 · Success / Warning / Error / Info
```

**WCAG AA 硬要求** (见 `accessibility-wcag.md`):
- 正文 text on background 对比度 **≥ 4.5:1**
- 大字体 (18pt+) **≥ 3:1**
- 非文本 UI 元素 **≥ 3:1**

输出 YAML + markdown Colors 节 → halt 等 `[通过 / 修改]`

**步骤 3 · 排版层级**

推荐 9-12 级:
- `headingXl` / `headingL` / `headingM` / `headingS` (4 级标题)
- `bodyL` / `bodyM` / `bodyS` (3 级正文)
- `captionM` / `captionS` (2 级辅助)
- `codeM` (等宽)
- 可选 `displayL` / `label` 等

每级至少指定: fontFamily / fontSize / fontWeight / lineHeight.

输出 → halt

**步骤 4 · 间距 / 圆角 scale**

- `spacing`: 基数 4 (Tailwind 风) 或 8, 展开到 `xs (4) / sm (8) / md (16) / lg (24) / xl (32) / 2xl (48) / 3xl (64)`
- `rounded`: `none (0) / xs (2) / sm (4) / md (8) / lg (12) / xl (16) / 2xl (24) / full (9999)`

输出 → halt

**步骤 5 · 组件样式** (按 `component-patterns.md` 清单)

V1 建议覆盖 6 个:
1. Button (primary / secondary / ghost / danger)
2. Input / Textarea
3. Card
4. Modal / Dialog
5. Nav / Sidebar
6. Tab / Pill

每个组件在 YAML `components.{name}` 定义关键属性 (背景/边框/圆角/内边距/阴影 引用其他 token).

输出 → halt

**步骤 6 · Do's and Don'ts**

3-5 条红线, 每条给 ✅ Right / ❌ Wrong 对比示例.

**步骤 7 · Lint + Export**

```bash
npx @google/design.md lint DESIGN.md                       # 检查
npx @google/design.md export --format tailwind DESIGN.md \
  > tailwind.config.ts                                     # 导出
```

### 4.2 Brownfield · 从已有项目提取

**步骤 1 · 扫描代码**

```bash
# CSS 颜色去重
grep -rE "#[0-9a-fA-F]{3,8}" src/ | sort -u
grep -rE "rgb\(|rgba\(|hsl\(" src/

# Spacing 值
grep -rE "(margin|padding|gap):\s*[0-9]+(px|rem)" src/

# Font 相关
grep -rE "font-(size|weight|family):" src/
```

**步骤 2 · 归类 + 去噪**
- 前 3 高频颜色 → primary / secondary / 第一个强调
- 中灰色系 → neutral scale
- 最常 font-size → bodyM

**步骤 3 · 访谈设计意图**
- "这个品牌蓝 `#1A73E8` 用在哪些场景?"
- "为什么 button padding 是 12px 不是 16px?"

**步骤 4 · 写成 DESIGN.md** (同 §4.1 步骤 3-7)

### 4.3 Evolution · 迭代

用户说 "加一个 danger 色" / "primary 更深":

1. 读现有 DESIGN.md → 定位要改的 token
2. 改动 + 列出**影响范围**:
   - 哪些组件引用了这个 token
   - 预期 UI 变化 (用人话描述)
3. 输出新 DESIGN.md
4. `npx @google/design.md diff v1 v2` 检测回归

### 4.4 Audit · 审阅

1. 跑 `lint` → 列 errors / warnings
2. 过 `selfcheck-checklist.md` 逐条检查
3. 输出改进建议 (按严重度分类):
   - 🔴 Critical: WCAG 不达标 / schema error
   - 🟡 Warning: token 命名不一致 / 缺语义角色
   - 🟢 Suggest: 增加组件覆盖 / 优化注释

---

## 五、集成到项目的推荐流程

1. **放** `DESIGN.md` 在**项目根目录** (规范要求)
2. **Lint pre-commit**: 在 `.husky/pre-commit` 或 CI 加 `npx @google/design.md lint`
3. **Export 到 Tailwind**: CI 自动跑 `export --format tailwind` 输出到 `tailwind.config.ts`
4. **AI agent 消费**: 让 Claude Code / Cursor / Copilot 在生成组件前先读 `DESIGN.md` (可放 `CLAUDE.md` 指令里强制)
5. **迭代设计** 时用本 SKILL 进入 §4.3 Evolution

详见 `references/export-integrations.md` + `references/agent-consumption.md`

---

## 六、官方 CLI 速查

```bash
# 安装
npm install -D @google/design.md

# 核心 4 命令
npx @google/design.md lint DESIGN.md
npx @google/design.md export --format tailwind DESIGN.md
npx @google/design.md diff DESIGN.md DESIGN-v2.md
npx @google/design.md spec [--rules] [--format json]
```

**spec 子命令关键**: `npx @google/design.md spec --rules --format json` 输出规范 JSON, 可喂给 AI agent 当系统上下文.

---

## 七、路由表 · 子模块加载地图

| 我要... | 去读 |
|---|---|
| YAML frontmatter 完整 schema | `references/spec-yaml-frontmatter.md` |
| Markdown body 8 分节模板 + 写法 | `references/spec-markdown-body.md` |
| WCAG 对比度 + lint 规则详解 | `references/accessibility-wcag.md` |
| 常见组件 (button/input/card/modal/nav/tab) 样式模式 | `references/component-patterns.md` |
| AI agent 如何正确消费 DESIGN.md (CLAUDE.md 集成 + prompt 模板) | `references/agent-consumption.md` |
| Tailwind / CSS-in-JS / CSS custom props 导出集成 | `references/export-integrations.md` |
| 空白模板 (复制填) | `assets/design-md-template.md` |
| 精选示例 (知名品牌参考) | `assets/examples-curated.md` |
| 人工检查清单 (lint 覆盖不到的) | `assets/selfcheck-checklist.md` |

---

## 八、版本与演进

- 本 SKILL 基于 DESIGN.md 规范 **v alpha** (2026-04 首次开源)
- 规范活跃演进, 特别是 **Components** 段
- CLI 尚无稳定版发布 (命令在 README 但 npm 包可能未全量发布)
- 定期检查 https://github.com/google-labs-code/design.md 更新日志
- 上游有破坏性改动 → 更新 `references/spec-*.md` + 同步 SKILL.md 第六章

---

## 九、启动协议

SKILL 激活后顺序:

1. 输出身份声明 (第零节)
2. 问用户进入 ①-④ 哪个工作流
3. 根据选择加载对应 references (按第七节路由表)
4. 进入 §4.x 对应工作流, 逐步骤推进
5. 每节完成 halt 等 `[通过 / 修改 / 继续]`
6. 最终输出前跑 §4.4 Audit 自检

**不要在第一次回应里直接产出 token 或 markdown** — 先确认工作流和方向.

---

## 十、"AI drift 防护"定位声明

本 SKILL 终极目标: **让 AI 写出的每一个组件, 颜色/间距/字体都来自 DESIGN.md, 不靠猜**.

**衡量标准**: 组件生成前 AI 必须先 ① 读 DESIGN.md 的 YAML frontmatter 取 token, ② 读 markdown body 理解 token 的语义应用场景. 做不到 = AI 没用本 SKILL.

如果你正在用 Claude Code / Cursor / Copilot 配本 SKILL, **请在项目的 `CLAUDE.md` (或 `.cursorrules`) 里写一句**:

```markdown
# Design System
Before generating any React/Vue/UI component, read `DESIGN.md` at project root.
Extract exact color/spacing/typography token values from YAML frontmatter.
Read markdown body for semantic intent (what's primary used for?).
Never hallucinate color values or spacing; always reference {colors.xxx} / {spacing.xxx}.
```

这句话让 AI 知道 DESIGN.md 存在且必须读, 是 SKILL 效果能兑现的关键一步.
