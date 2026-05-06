# AGENTS.md · cineforge-web 协作者导航

> Last refreshed: 2026-05-06 · 对应 CHANGELOG `Unreleased / 阶段 2.9`（最新一项是 ScoreCard 评分卡）
> 此文件给 AI 协作者（Cascade / Claude / Cursor / Copilot）和后加入的人类读。
> README.md 面向部署 / 演示，AGENTS.md 面向写代码。

> **行为硬约束**：写代码前先读 `@C:\Users\QvQ\CascadeProjects\cineforge-web\.windsurf\rules\karpathy-guidelines.md`
> （Karpathy 四原则：Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution）。
> 该文件为 `always_on` 规则，每次会话默认注入。

---

## 一句话定位

纯前端、零后端、单部署的影视 / 网络小说 **AI 流水线工作台**——
把 DeepSeek API 包装成 manifest 驱动的多阶段创作流水线，配套静态 KB / 用户 KB /
方法论模块三层知识注入，输出剧本 / 资产 / 分镜 / 小说 / 拆书报告。

---

## 快速开始

```powershell
# 安装
npm install

# 开发 (http://127.0.0.1:5173)
npm run dev

# 构建（含 tsc -b）
npm run build

# 预览构建产物
npm run preview

# 一次性脚本：把 F:\下载文件\八步\ 下的 prompt .txt 转换为 public/prompts/*.json + manifest
npm run import:prompts

# 命令行 smoke 测试小说流水线（需要 DEEPSEEK_API_KEY 环境变量）
npm run smoke:novel
```

**首次拉仓**：`npm install` → `npm run import:prompts` → `npm run dev` → 在 `/settings` 填 API Key。

---

## 目录速查

```
.windsurf/workflows/    AI 工作流（/init, /simplify 等 slash 命令源文件）
docs/                   架构参考 + 内部 spec + prompt 原稿存档（不参与构建）
public/
  prompts/manifest.json    主流水线节点定义（screenplay / assets / storyboard / novel）
  methods/manifest.json    24 个方法论模块（MBTI / Save the Cat / 七要点言情 …）
  kb/                      9 篇静态 KB（去 AI 味 / 视觉风格 / 117 运镜 / 14 情绪 / 打斗三幕 …）
scripts/                Node 脚本：import-prompts.mjs / smoke-novel.mjs
src/
  components/  (24 文件)  React 组件（面板 + 对话框 + 校验器 UI）
  data/        (2 文件)   静态分类（题材 / 平台 / 调性 / 受众 / 视觉风格 …）+ 题材锚点
  llm/         (3 文件)   deepseek SSE 流式 client + cost 估算 + extractKb（用户 KB JSON 抽取）
  pages/       (12 文件)  路由对应页（每个 1 页）
  pipeline/    (26 文件)  manifest / 节点编排 / 注入合成 / 自检 / Best-of-N / 反思 / 拆书 / 校验
  store/       (6 文件)   zustand state + Dexie schema + 项目归档 / 导入导出 / 用户 KB
```

---

## 路由 → 页面（13 个）

| 路径 | 页面 | 角色 |
|------|------|------|
| `/` | `Home.tsx` | 项目列表 + 新建 / 载入 / 删除 |
| `/intake` | `Intake.tsx` | S0 原作摄入（改编模式专用） |
| `/screenplay` | `Screenplay.tsx` | 八步剧本工作台（DAG + 通过/修改/重跑/自检） |
| `/adapt` | `Adapt.tsx`（同文件） | 改编模式的剧本工作台变体 |
| `/assets` | `Assets.tsx` | 资产工作台（角色/场景/道具，gate-then-parallel） |
| `/kb` | `KnowledgeBase.tsx` | 浏览静态 KB + **用户 KB 库**管理 |
| `/pipeline` | `Pipeline.tsx` | 全节点单步调试视图（manifest 驱动） |
| `/express` | `Express.tsx` | 快速分镜模式（题材 + 钩子直出） |
| `/novel` | `Novel.tsx` | **小说模式工作台**（N1.x → N3.x 大纲+章节循环） |
| `/refinery` | `Refinery.tsx` | 6 件套润色工具调试床 |
| `/analyzer` | `Analyzer.tsx` | 拆书分析师（单步 / 两阶段法） |
| `/playground` | `Playground.tsx` | 单 prompt 流式调试 |
| `/settings` | `Settings.tsx` | API Key / 模型 / 温度 / KB 注入开关 / 反思阈值 |

---

## 架构骨架

### 数据流

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ User input      │ →→  │ useProject       │ →→  │ Dexie (FLIL database)   │
│ (page forms)    │     │ (zustand)        │     │  - liveArtifacts (active)│
└─────────────────┘     │  ctx / passed /  │     │  - artifacts (archived)  │
                        │  stale / hydrated│     │  - projects (meta)       │
                        └──────────────────┘     │  - userKbDocs / Feedback │
                                                 │  - runHistory            │
                                                 │  - liveRefinementUndo    │
                                                 └─────────────────────────┘
```

- **Live project**：用户当前在编辑的项目。`ctx` 持久化到 localStorage（轻），
  `artifacts` 持久化到 IDB `liveArtifacts` 表（重）。
- **项目切换**：`projectArchive.ts` 的 `archiveCurrent()` / `loadFromDb()` /
  `startNewActive()` 三个入口；切换时 `liveArtifacts` 与 `liveRefinementUndo`
  会同步清空。

### Dexie schema 演化

当前 **v4**（`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\db.ts:133-164`）：

| 版本 | 新增 |
|------|------|
| v1 | `projects`, `artifacts` |
| v2 | `liveArtifacts`, `runHistory` |
| v3 | `userKbDocs`, `userKbFeedback` |
| v4 | `liveRefinementUndo` |

**升级规则**：只追加，不修改已有 schema。每个版本调用 `this.version(N).stores({...})`
列出**所有**表（不是增量）。

### 流水线模型（manifest 驱动）

入口：`public/prompts/manifest.json` 列出所有节点（如 `screenplay.1`, `novel.3.1`）。
每节点指向 `public/prompts/<stage>/<n>.json`，字段：
- `system` / `user` 模板（含 `{{ctx.xxx}}` 插值）
- `temperature`, `max_tokens`
- 可选 `thinkingStrategy` / `thinkingEffort` / `responseFormat`（V4 Thinking 升级后）

`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\runner.ts` 是单步执行器；
`compose.ts` 负责把上游产物 + 三层知识注入到 system 头部。

### 三层知识注入（按优先级从硬到软）

1. **静态 KB**（`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\kb.ts`）：
   `public/kb/*.md` → 按 nodeId 白名单注入。例：所有章节生成节点注「去 AI 味」。
2. **方法论模块**（`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\methodModules.ts`）：
   24 个写作方法（Save the Cat / MBTI 五步 / 七要点言情 / 三密度审查 …）。
   用户在 `MethodModulePanel` 选择启用，按 `manifest.injectsTo` 决定注入哪些节点。
   含 `genreCompat` 兼容矩阵（recommended / incompatible / warnOnEnable）。
3. **用户 KB**（`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\userKb.ts`）：
   `UserKbDocType` 共 7 类（trend / sample / antiPattern / styleGuide /
   worldHardSchema / voiceCard / bookAnalysis）。用户在 `/kb` 上传，由
   `extractKb.ts` 抽 JSON，按 type 注入到对应规划节点。

外加：**题材锚点**（`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\data\projectTaxonomy.ts`
中的 `GENRE_ANCHORS`）— 15 个核心题材的 `mustInclude` / `mustAvoid` / `worldRules` /
`pronounUsage` / `paragraphLength` / `dialogueRatio` / `rhythmRequirement`。
由 `compose.ts` 合并多题材后注入 prompt。

### 小说模式特有循环（v3）

`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\novelLoop.ts`：
- `runNovelVolumeLoop`（N2.2 分卷）
- `runNovelChapterDraftLoop`（N3.1 章节草稿）
- `runNovelChapterPolishLoop`（N3.2 章节润色）

章节预览（PreviewModal）集成：
- `RefinementToolPanel`（6 件套润色 + 选区 + 持久化撤销栈）
- `ChapterValidationPanel`（题材 mustAvoid / AI 套话 / 长度 / 对话比 / 钩子等 7 类纯前端规则）

---

## 常见任务 → 看哪里

| 任务 | 入口文件 |
|------|---------|
| 新增一个 prompt 节点 | `public/prompts/manifest.json` + `public/prompts/<stage>/N.json` |
| 调整 prompt 模板插值变量 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\interpolate.ts` |
| 改注入逻辑（哪个节点进哪个 KB） | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\compose.ts` + `kb.ts` |
| 新增 deepseek 客户端选项（thinking/responseFormat 等） | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\llm\deepseek.ts` |
| Dexie schema 升级 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\db.ts` 加 `this.version(N+1)` |
| 新增方法论模块 | `public/methods/manifest.json` 加条目 + `public/methods/<id>.md` 写内容 |
| 调整方法论推荐评分 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\methodModuleRecommend.ts` |
| 新增 / 调整章节自动校验规则 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\chapterValidation.ts` |
| 新增题材锚点 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\data\projectTaxonomy.ts` 的 `GENRE_ANCHORS` |
| 调整 V4 Thinking strategy 默认 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\runner.ts` |
| 项目导入 / 导出格式 | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\projectExport.ts`（FLIL_SCHEMA） |
| 调整修复期注入的知识层（KB / 题材锚点 / R1 / 方法论） | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\fixContext.ts` |
| 给 SelfCheckPanel 之外的页面接"诊断 → 修复"闭环 | 参考 `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\components\ChapterValidationPanel.tsx`（构造临时 NodeArtifact + buildFixContextPreamble + runFixAllIssues） |

---

## 重要约定

### Coding style

- TypeScript strict（`noUnusedLocals`, `noUnusedParameters` 启用）。
- 中文注释 OK；UI 文案中文。
- 不要加 emoji 到代码 / 注释里（除非已有约定，如 PreviewModal 的徽章里）。
- 单文件 ≤ 800 行是软目标；现存超的（Novel.tsx, NewProjectDialog.tsx）暂不强行拆，
  但新功能不要再往里堆。

### Prompt 注入分层（不要打破）

`compose.ts` 拼接顺序固定（从硬到软）：
```
[creation_constraints] → [genre_anchor] → [static_KB] → [method_modules]
  → [user_KB] → [original prompt system] → [upstream artifacts]
```
新加注入项时找到对应层，不要插队。

### 路径引用

文档中引用代码用绝对路径 + 行号：`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\foo.ts:12-34`。
不要用 workspace-relative 路径。

### 验证

任何改动落地前必须 `npx vite build` 通过：
```powershell
npx vite build 2>&1 | Select-String -Pattern '^error|built'
```
当前基线：1911 modules / ~3s。

`npx tsc --noEmit -p .` 会报 1 处无关错误（`Cannot find type definition file for 'node'`），
是 pre-existing 的 `@types/node` 缺失，不阻塞构建。

### Slash 命令

- `/init` — 刷新本文件（`@.windsurf\workflows\init.md`）
- `/simplify` — 全仓 dead-code 扫描 + 清理（`@.windsurf\workflows\simplify.md`）

### Rules / Skills 索引（`.windsurf/rules/`）

每条规则一个文件，前置 `trigger:` 决定激活档位。新增/修改前先读
`@C:\Users\QvQ\CascadeProjects\cineforge-web\.windsurf\rules\` 目录全文。

| 文件 | trigger | 来源 / 类别 | 一句话摘要 |
|---|---|---|---|
| `karpathy-guidelines.md` | `always_on` | Skill · `andrej-karpathy-skills` | Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution（每会话注入，trivial 任务可放宽） |
| `coding-standards.md` | `always_on` | 项目自有 | TS strict / 中文注释 / 路径引用规范 / 单文件 ≤ 800 行 |
| `design-md.md` | `model_decision` | Skill · `design-md`（Google Labs 蒸馏） | DESIGN.md 设计系统专家入口；显式触发（`/design-md`、「写设计系统」等）后读 `@.windsurf\skills\design-md\SKILL.md` 全文 |
| `bmad-method.md` | `model_decision` | Skill · `bmad-method`（v0 蒸馏，**非官方**） | BMAD 4 阶段 30+ workflow 入口；显式触发（`bmad-help`、「写 PRD」、「DP/GPC/CP/CA」等代号）后读 `@.windsurf\skills\bmad-method\SKILL.md` |

> **接入新 skill 流程**：
> - **行为/纪律类（高频通用）**：原文写入 `.windsurf/rules/<id>.md`，`trigger: always_on`，
>   总数 ≤ 3 条（system 头预算线）。
> - **方法论/工作流类（低频专项，文件大）**：完整内容放 `.windsurf/skills/<id>/`（含 references/assets），
>   `.windsurf/rules/<id>.md` 只写一份 ≤ 1 KB 的触发器（`trigger: model_decision`，描述里写明触发关键词），
>   agent 命中后再去读 skills 目录下的 SKILL.md 全文。本表每加一条新增一行。

---

## 当前阶段（v2 资料库 + DeepSeek V4 升级）

完整时间线见 `@C:\Users\QvQ\CascadeProjects\cineforge-web\CHANGELOG.md`。本轮（2026-05）已完成：

- **2.0** 题材锚点系统（15 题材）+ DeepSeek V4 Thinking Mode 接入
- **2.1** 拆书分析师（`/analyzer`）+ 保存到 KB
- **2.2** 6 件套润色工具（`/refinery` + Novel PreviewModal 集成）
- **2.3** 题材-模块兼容矩阵（manifest `genreCompat` + UI 警示）
- **2.4** 章节自动校验（7 类纯前端规则）
- **2.5** 拆书两阶段法（Stage 1 框架扫描 → 用户复核 → Stage 2 深度方法论）
- **2.6** 润色撤销栈持久化（Dexie v4 `liveRefinementUndo` 表）
- **2.7** 全仓 simplify 扫描（删除 14 处死代码）
- **2.8** 诊断 → 一键修改闭环（修复路径接入 KB / 题材锚点 / 方法论 / R1 指令书；Screenplay 接 SelfCheckPanel；章节校验加 AI 一键修订）
- **2.9** AI 综合评分卡 ScoreCard（6 维加权 + 历史 sparkline + before/after delta；前 4 维前端规则自动跑、后 2 维 LLM 按需重算；Pipeline / Screenplay / Novel 章节预览三处接入；settings 开关 + 权重滑块）

---

## 不要做什么（避坑）

- ❌ 直接改 Dexie 已有 version 的 stores 定义 → 会导致老用户数据丢失。改 schema 必须新增 version。
- ❌ 把 `artifacts` 写入 localStorage（曾经的设计） → 大项目会爆 5MB 配额。已强制走 IDB。
- ❌ 在 prompt 里硬编码"仙侠爱情/5 分钟"等示例 → 用 `{{ctx.xxx}}` 插值（`interpolate.ts`）。
- ❌ 给方法论模块加重叠的 `injectsTo` 而不更新 `conflictsWith` → 启用多个会 token 爆炸。
- ❌ 调用 `chatStream` 时不传 `signal` → 用户无法 abort。所有 UI 入口都建立 `AbortController`。
- ❌ 在 React 组件里直接 `useProject.getState()` 读 ctx 用于渲染 → 不会触发 rerender。
  渲染场景用 `useProject((s) => s.ctx)`，事件回调里才用 `getState()`。
