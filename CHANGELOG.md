# Changelog · fili-web

本仓库的 v2 资料库阶段（2026 春）系列改动记录。条目按"阶段编号 + 主题"组织，
每条都给出动机、关键文件、用户视角的变化。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 但不严格遵循 SemVer——
本仓库目前是单部署的工具型 webapp，节奏以"阶段"为粒度。

---

## [Unreleased] · v2 阶段 2.x（2026-05）

### 阶段 2.10 · DESIGN.md 设计系统全量重塑（C 档位）

**动机**：现存 1206 处 `bg-zinc-X`、173 处 `bg-brand-X`、各种散乱 amber/rose/emerald 状态色——
"工程师密集型"工业风让创作工具失去温度感。同时缺失双主题、token 化、AI agent
"防 drift"机制。引入 `design-md` skill（Google Labs DESIGN.md 规范蒸馏版）走完整 5
Phase 路线图，把 UI 从硬编码迁移到 token 系统。

**Phase 路线图（全部完成，跨 6 commits）**：

| Phase | 交付 | commit |
|---|---|---|
| 0 · 扫码 | grep 现状颜色/间距/字体 | (内含分析) |
| 1 · 起草 DESIGN.md | YAML token + Markdown 规范，6 节逐节 halt + Audit | `56751ae` |
| 2 · token 同步 | tailwind.config.ts + src/index.css CSS 变量 + AGENTS.md 硬约束 | `d1fda6e` |
| 3 · 6 原子组件 | `src/components/ui/` Button/Input/Textarea/Card/Modal/NavItem/Tabs | `2ae7398` |
| 4 · 13 页面 token 化 | Home/Layout/Settings 重塑 + 10 页批量替换 | `ef73db4` `28099ba` |
| 5 · 全仓回归 | 23 components 批量补齐 + audit 报告 | `e78cc90` `本次` |

**关键设计决策**：

- **风格 C · 创作工具温度**（Notion/Figma/Arc 风），暖橙 `#f97316` primary
  锁定 + 中性切到 warm stone（比 zinc 偏暖 8°）
- **暗+亮双主题**：`<html class="dark">` 切换；CSS 变量 `--cf-bg-canvas` 等
  统一驱动；现版默认暗主题，亮主题 token 已就位
- **WCAG AA 合规**：button fontWeight 700 + 大字 14pt 标准 → 暗主题白字
  on primary.500 达 3:1（保品牌识别同时合规）
- **薄壳组件**：6 个原子组件 `<Button>` `<Card>` 等只是 `.btn-primary` 等
  className 配方的类型化包装，**不强制迁移**现存代码（surgical changes）

**全仓替换统计**（共 4 commits）：

```
src/pages       10 个文件 + 805 处替换 (Home + Layout + Settings 重塑 + 7 页批量)
src/components  23 个文件 + 968 处替换 (Phase 5 补齐隐藏债务)
ui/ 新增         7 个文件 +517 行   (Button/Input/Textarea/Card/Modal/NavItem/Tabs)
DESIGN.md       1 个文件 +791 行    (project root, v0.1.1-alpha)
tailwind.config 25 行 → 116 行      (token 全套)
src/index.css   30 行 → 154 行      (CSS 变量 + 9 组件配方 + 8 utility class)
合计            ≈ 1900+ 处单点修改
```

**业务逻辑零变化**：runner / compose / scoreCard / db.ts schema / 13 路由 / 所有
state / hooks / props / onClick 全部 0 行修改。任何用户都能正常用所有现有功能。

**剩余技术债（acceptable，留 V0.2 evolution 处理）**：

- 24 处 zinc-600/700 边缘色阶（hover 强调态等，无 token 直接对应）
- 76 处 brand-200/300/500（tailwind 中 brand=primary 别名，**视觉等价**）
- 49 处 amber/rose/emerald 100/200 浅色阶（无 token 对应）
- 333 处 `text-[10px]` `text-[11px]` 紧凑字号（DESIGN.md 设计真空——
  V0.2 应补 `text-tight-xs/sm/2xs` 非 uppercase token）

**关键文件**：

- `@C:\Users\QvQ\CascadeProjects\fili-web\DESIGN.md` — 设计系统单一真源 v0.1.1-alpha
- `@C:\Users\QvQ\CascadeProjects\fili-web\tailwind.config.ts` — token export
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\index.css` — CSS 变量 + 组件配方
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ui\` — 6 原子组件
- `@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\rules\design-md.md` — skill 触发器

**用户视角变化（你打开浏览器能看到的）**：

- 整体节奏更松（主板块间距升档）；标题层级更清晰（heading-xl 28px tracking-tight）
- 状态色统一（success/warning/danger 三档），按钮加粗 (font-bold + h-8)
- 侧栏 active 态改用 primary.500 12% 背景 + 加粗（之前是 zinc-800 块）
- 长文阅读区已就位 `prose-reading` class（serif + 720px 限宽 + 1.85 行高）
  — Phase 6 evolution 时给小说章节挂上去

---

### 阶段 2.9 · AI 综合评分卡 ScoreCard（6 维 + 加权 + 历史轨迹）

**动机**：用户在生成 / 改编 / 修改之后只能"凭感觉"判断质量，缺一个**直观、可对比**
的量化反馈：哪个维度变好了、哪个变差了、和上次比是+5 还是−12。同时已有的诊断/修复
闭环只输出「pass | warn | fail」三档，太粗。

**改动**：

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\scoreCard.ts` — 新建评分引擎。
  6 维度、加权平均（inactive 自动从分母剔除）、`runScoreCard` 主入口、
  `applyScoreCardToArtifact` 把分数 + 上一份压栈到 `meta.scoreCard / scoreCardHistory`。
  - 前 4 维（前端规则，<10ms）：`genre`（题材锚点匹配）/ `method`（方法论模块特征）/
    `kbRedline`（违禁词、强制词、比例）/ `craft`（可读性、重复度、段落节奏）。
  - 后 2 维（LLM，~1k tokens）：`r1Align`（R1 创作指令书对齐）/ `userKbStyle`（用户 KB
    范文风格契合），合并成 1 次 LLM 调用，无 R1/KB 时自动 `inactive`。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\scoreCardModuleChecks.ts` — 新建。
  方法论模块 → 正则规则注册表，覆盖 8 个高用量模块，给 `method` 维度提供"模块特征是否落地"
  的量化判据。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ScoreCardBadge.tsx` — 新建紧凑横条
  + 展开抽屉 + sparkline UI。一行展示总分 / delta / 6 维子分 / 重算 / 详情；展开后看
  每维度的 issue 列表 + evidence 片段。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\hooks\useScoreCardController.ts` — 新建复用
  Hook：artifact 版本变化时**自动跑前 4 维**（skipLlm，无 token 成本）；`recompute`
  暴露给"重算"按钮触发完整 6 维。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ArtifactScoreCardSlot.tsx` — 新建。
  把 Hook + Badge + settings 开关封装为可插拔槽位，给 artifact 级页面用。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ChapterScoreCardSlot.tsx` — 新建。
  章节预览专用：不写回 artifact，仅在内存里维护 current/previous 两份分数，用于
  novel.3.1 / 3.2 章节修订前后对比。
- 三个触发点接入：
  - `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Pipeline.tsx` — StepRow 节点产出后
    SelfCheckPanel 上方插入 `ArtifactScoreCardSlot`。
  - `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Screenplay.tsx` — 八步工作台
    SelfCheckPanel 上方插入 `ArtifactScoreCardSlot`。
  - `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Novel.tsx` — 章节预览面板内
    `displayBody` 下方插入 `ChapterScoreCardSlot`，章节修订（handleRefineApply）后
    自动重评，自然形成 before/after。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\settings.ts` — 新增
  `enableScoreCard: boolean`（默认 true）+ `scoreCardWeights?: Partial<...>`（缺省 = 等权 1.0）。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Settings.tsx` — 新增评分开关 +
  6 维权重滑块（0..2，0 = 不计入分母，>1 = 放大影响）+ 全部重置按钮。

**触发逻辑**：
- 自动 = 4 维（skipLlm:true，零 token，<10ms）：artifact.ts 变化即跑。
- 手动 = 6 维（含 LLM）：用户点 Badge 上的「重算」按钮。
- 历史 = 最近 5 次评分入 `scoreCardHistory`，用于 sparkline + delta。

**不动什么**：runner / compose / R9 全部不变；评分是**只读旁路**，失败也不影响主流程。

**验证**：`npx vite build` ✓（1918 modules）。

---

### 阶段 2.8 · 诊断 → 一键修改闭环（修复路径接入项目知识层）

**动机**：之前 `runIssueFix` / `runFixAllIssues` / `runHybridFix` 三个修复函数都只看
"产物原文 + issue 列表"，**完全不注入** KB / 题材锚点 / 方法论模块 / R1 指令书——
跟生成阶段（compose.ts）走完整三层注入是**严重不对称**的，典型表现：修复后产物
可能违反题材 mustAvoid，或丢失启用方法论模块要求的结构。同时 Screenplay 八步
工作台只有诊断展示（DoctorVerdict）、缺一键修改入口；章节预览的纯前端校验也只
展示问题，不触发 LLM 修订。

**改动**：

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\fixContext.ts` — 新建。
  导出 `buildFixContextPreamble(opts)`，按节点 + 项目状态拼装修复专用 system 前导：
  R1' compact 指令书 → 静态 KB → 用户 KB → 题材锚点 → 方法论模块。复用 compose.ts
  里既有的 `loadKbForNode` / `loadMethodModulesForNode` / `buildGenreAnchorPreamble` /
  `userKbTypesForNode`（后两者本次顺手 export 出来），不重复造轮子。

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\selfCheck.ts` /
  `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\hybridFix.ts` —
  三个修复函数（`runIssueFix` / `runFixAllIssues` / `runHybridFix`）都新增可选
  `extraSystemPreamble?: string` 参数；存在时拼接在原 system 之前。
  **后向兼容**：参数可选，老调用方零改动。

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\SelfCheckPanel.tsx` —
  迭代修复开始时一次性构建 preamble，全轮复用（项目上下文不变）；每轮 `runHybridFix`
  调用都带上。任何用 SelfCheckPanel 的页面（Pipeline / Screenplay）都自动受益。

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Screenplay.tsx` —
  把 doctor report 从本地 state（`doctorByNode`）迁到 `artifact.meta.selfCheck`
  （与 Pipeline 页对齐），用 `<SelfCheckPanel>` **完全替代** `<DoctorVerdict>`。
  收益：八步剧本工作台现在每一步都有完整的"诊断 → 多轮迭代修复 → 守门 → 预览 → 应用 → 回滚"闭环。
  删除 deprecated `DoctorVerdict` 函数（约 40 行死代码）。

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ChapterValidationPanel.tsx` —
  新增可选三件套 props：`nodeId` / `chapterTitle` / `onApplyRevised`。同时给齐时显示
  "🪄 AI 一键修订（N 项）"按钮：内部把 `ValidationIssue[]` 转成 `SelfCheckIssue[]`，
  构造临时 `NodeArtifact`，调 `buildFixContextPreamble + runFixAllIssues`，流式展示
  字数进度，完成后通过回调写回章节。**纯前端规则 + LLM 修订**首次形成闭环。

- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Novel.tsx` — 章节预览面板
  调用上面新增的 props，复用现有 `handleRefineApply`（自动入 Dexie 撤销栈），
  AI 修订与 6 件套润色共享同一份 undo 持久化机制。

**未做（明确不在范围）**：

- **Refinery 页面**：本身就是修复工具（6 件套润色），无独立的"诊断"环节，复用现有 UX 即可。
- **Analyzer 页面**：拆书产出结构化报告，不是创作产物，没有"诊断 → 修复"的语义。
- **Express 页面**：已有 `ScreenplayDoctorPanel` 闭环，不重复；后续可考虑统一到 fixContext。
- **`runDoctorRewrite`（screenplayDoctor.ts）注入 fixContext**：剧本医生是独立的
  二阶段工艺（diagnose + rewrite），与 selfCheck 的 patch 路径不重叠；下轮再统一。

**验证**：`npx vite build` ✓ 1912 modules / 2.98s。
TypeScript 严格类型通过；现有 6 处 pre-existing StageId 警告（`invalidateFrom` 参数
类型窄于 StageId）不在本次范围，未顺手修。

---

### 阶段 2.7 · 全仓 simplify 扫描（dead-code elimination）

**动机**：一年多迭代下来，部分早期脚手架函数 / 调试工具 / 兼容映射已经没人调用，
继续留着会让新手读代码时浪费精力辨别"这是真要用的还是历史遗留"。

**配套**：
- `@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\workflows\simplify.md` —
  新建 `/simplify` 工作流文件，定义"扫描 → 分类 → 落地"三步骤 + 风险阈值。

**删除内容（14 处共约 100 行）**：
- 14 个完全无引用的 export（含 1 个仅服务于已删函数的内部 helper）
- 2 个随上述删除而成为 orphan 的 import

| 名称 | 文件 | 类别 |
|------|------|------|
| `hasAnyGenreAnchor` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\GenreAnchorPreview.tsx` | helper |
| `CHAPTER_CHUNK_NORMALIZE` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\normalizePresets.ts` | preset const |
| `exportActiveProjectFile` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts` | API |
| `liveToNode` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts` | 内部 helper（cascade） |
| `getStoryboardPlan` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\storyboardPlan.ts` | helper |
| `estimateRollingCharCount` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\rollingContext.ts` | helper |
| `approxTokensFromText` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\llm\cost.ts` | helper |
| `clearMethodModuleCache` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\methodModules.ts` | debug util |
| `clearManifestCache` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\manifest.ts` | debug util |
| `findStep` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\manifest.ts` | helper |
| `getUserKbDoc` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\userKb.ts` | helper |
| `clearUserKbFeedbackForProject` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\userKb.ts` | helper |
| `legacyAdaptationTypeToSource` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\data\projectTaxonomy.ts` | 兼容映射 |
| `isReflectionRecommended` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\reflection.ts` | helper |
| `getKbIdsForNode` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\kb.ts` | helper |
| `findRecommendation` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\methodModuleRecommend.ts` | helper |

清理的 orphan imports：`liveArtifactsAll`（projectExport.ts）/ `hasGenreAnchor`（GenreAnchorPreview.tsx）/ `ArtifactMap`（storyboardPlan.ts）。

**未做**（留待人工判断）：
- ~24 个"USED INTERNAL"的 export（在自身文件内被调用，但未被外部 import）。
  可以 `export` → 局部，但风险高于收益（部分是有意保留的扩展点）。
- 长文件拆分（Novel.tsx ~1900 行 / projectExport.ts ~280 行 / refinement.ts 等）—
  属于 refactor 范畴，不在 simplify 工作流自动化范围。

**验证**：`npx vite build` ✓ 1911 modules / 2.97s（与清理前数量一致：vite 按模块数算，
不计每模块大小；产物体积下降约 2-3 KB minified）。

---

### 阶段 2.6 · 润色工具撤销栈持久化

**问题**：PreviewModal 内的 6 件套润色工具有"应用 / 撤销"两步操作，
但撤销栈仅存于 React state，关闭 modal / 刷新 / 切换章节即丢失。
用户连续应用 3 次润色后想回滚到第 1 次状态时只能整章重写。

**改动**：
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\db.ts` — Dexie 升至 v4，新增
  `liveRefinementUndo` 表 + 复合索引 `[chapterIndex+source]`；导出 `LiveRefinementUndoEntry`
  类型与 4 个 helper（`liveRefinementUndoAll/Push/PopLast/Clear`）。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Novel.tsx` — `PreviewModal` 内
  撤销栈从 in-memory 升级为 db 持久化：mount 时按 `(chapterIndex, source)`
  从 db 加载、apply 时 `push`、undo 时 `popLast`。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\project.ts` — `resetAll()` 同步
  调用 `liveRefinementUndoClear()`。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectArchive.ts` — `archiveCurrent()`/
  `startNewActive()`/`loadFromDb()` 三处项目切换点同步清空撤销栈。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts` —
  `importAsActiveProject()` 同步清空。

**用户视角**：
- 关闭 PreviewModal、刷新浏览器、切回 N3.1 / N3.2 章节，撤销按钮上的次数
  仍然保留；继续点击可逐步回到该章最早的草稿。
- 切换 / 新建 / 导入项目时栈被自动清空，不会污染新项目。

---

### 阶段 2.5 · 拆书两阶段法（Two-Stage Book Analysis）

**动机**：单步拆书在 16k token 预算内常出现"框架对了但技法浮于表面"或"技法很深但框架自相矛盾"的两难。
Decompose-then-Recompose 流派把这两个目标拆到两个独立调用里，可在同样 token 下显著提升质量。

**改动**：
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\bookAnalyzer.ts` — 新增
  `BookAnalysisStage1` 类型 + `runBookAnalysisStage1()`（轻量框架扫描，~4k token）+
  `runBookAnalysisStage2()`（基于 stage1 + system prompt 增强的深度方法论提炼，
  默认启用 V4 Thinking）。原 `runBookAnalysis()` 保留为向后兼容入口。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Analyzer.tsx` — 新增"分析模式"
  单/双开关，两阶段模式下显示独立 `Stage 1` / `Stage 2` 按钮。Stage 1 完成后
  额外渲染可编辑的"框架扫描结果"面板（全书定位 / 宏观骨架 / 节奏签名 /
  冲突模型 / 各章功能 / Stage 2 焦点问题），用户可手工修订后再触发 Stage 2。

**用户视角**：
- 默认仍是"单步快速"。需要更高质量时切换到"两阶段法"。
- Stage 1 用时通常 5–10s，输出后可即刻人工干预；Stage 2 才用 thinking，输出
  原本的完整 `BookAnalysisResult`，结构与单步一致，不影响"保存到 KB"流程。

---

### 阶段 2.4 · 章节自动校验

**问题**：章节生成完毕后，能否符合题材锚点 / 节奏配方等的判定全靠用户肉眼，
对长篇连载尤其费眼。

**改动**：
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\chapterValidation.ts` — 新建。
  纯前端规则检测，毫秒级返回。覆盖 7 类问题：
  1. **`genre.mustAvoid`**（error）— 题材锚点禁忌词命中
  2. **`craft.aiFlavor`**（warning）— AI 套话黑名单（16 词）
  3. **`pace.lengthShort/Long`**（info）— 与平台目标字数偏离 ≥ 50% / ≥ 80%
  4. **`pace.dialogueRatio`**（warning）— 与题材建议的对话占比偏离 > 18 个百分点
  5. **`pace.paragraphSize`**（info）— 平均段落字数偏离题材建议 > 100% / 60%
  6. **`pace.endingHook`**（warning）— 启用爽文 / 悬疑节奏类模块时检测章末钩子
  7. **`genre.mustInclude`**（info）— 单章题材必备元素覆盖率 < 20%
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ChapterValidationPanel.tsx` —
  新建。按 severity 分组显示，命中证据 / 修复建议；干净时折叠为一行徽章。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Novel.tsx` —
  `PreviewModal` 在章节预览场景下自动渲染 `ChapterValidationPanel`，
  贴在正文下方。

**用户视角**：
- 在 N3.1 / N3.2 预览章节时，正文下方多出一栏"章节自动校验"。
- 顶部直接显示 `error / warning / info` 数字徽章；展开后给出每条具体问题与修复建议。
- 不调用 LLM，零成本，无网络延迟。

---

### 阶段 2.3 · 题材-模块兼容矩阵

**问题**：方法论模块库快速膨胀到 24 个，题材覆盖参差。用户启用"超自然网文综合包" + "硬科幻"题材会导致输出严重违和，但 UI 之前没有任何提示。

**改动**：
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\methodModules.ts` —
  `MethodModuleItem` 类型扩展 `genreCompat?: { recommended; incompatible; warnOnEnable }`；
  新增 `validateMethodModuleGenres()` 校验函数 + `GenreCompatIssue` 类型。
- `@C:\Users\QvQ\CascadeProjects\fili-web\public\methods\manifest.json` —
  给 12 个核心模块填上 `genreCompat`（覆盖结构骨架 / 世界观 / 节奏 / 角色四类）。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\methodModuleRecommend.ts` —
  新增 `applyGenreCompatToRecommendations()` 后处理：incompatible 命中 → 分数压到 ≤25 +
  reason 前缀 `⛔ 与题材[X]冲突：`；warnOnEnable → 分数 -15；recommended → 分数 +5。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\MethodModulePanel.tsx` —
  顶部新增题材兼容警示横幅（已启用模块发生冲突时红/黄横幅 + 一键关闭）；
  每条模块根据题材匹配显示 `Ban 题材冲突` / `ShieldAlert 兼容弱` / `CheckCircle2 题材契合`
  徽章；已启用 + 冲突时模块卡片整体红框。

**用户视角**：
- 选择题材后，方法论列表里能直接看到哪些模块"题材契合"、哪些"题材冲突"。
- "一键应用推荐"自动跳过 incompatible 模块（因分数已被压低）。
- 冲突仍可手动启用——最终决策权在用户，UI 只做信息提示。

---

### 阶段 2.2 · 章节级润色工具集（6 件套 + Refinery 测试床）

> 已在更早 commit 完成。要点回顾：
- 6 个单一职责工具：场景细化 / 对话增厚 / 情绪强化 / 精简冗赘 / 文风润色 / 节奏调整。
- `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\refinement.ts` 与
  `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\RefinementToolPanel.tsx`。
- 独立调试页 `/refinery`（`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Refinery.tsx`），
  支持链式应用 + 选区优先 + 撤销。
- Novel 页 `PreviewModal` 已集成（章节预览场景）。

---

### 阶段 2.1 · 拆书分析师 + 保存到 KB

> 已在更早 commit 完成。要点回顾：
- 新建 `Analyzer` 页（`/analyzer`）：章节标签法 + V4 Thinking + 流式 JSON。
- `bookAnalyzer.ts` 输出可迁移的 worldview / characters / plot /
  positionInsights / methodology 五大维度。
- 结果可一键保存为 `UserKbDoc(type='bookAnalysis')`，由 `extractKb.ts` 渲染为
  markdown 注入 N1.* / N2.* 规划节点。

---

### 阶段 2.0 · 题材锚点系统 + DeepSeek V4 Thinking 升级

> 已在更早 commit 完成。要点回顾：
- 15 个核心题材的 `GenreAnchor`（worldRules / pronounUsage / mustInclude /
  mustAvoid / paragraphLength / dialogueRatio / rhythmRequirement）。
- `compose.ts` 在 prompt preamble 注入 anchor 合并结果。
- `deepseek.ts` 支持 V4 Thinking Mode（thinking strategy / effort /
  responseFormat / 流式 reasoning_content）。

---

## 兼容性说明

- **Dexie**：从 v3 → v4 仅追加 `liveRefinementUndo` 表，**无破坏性 schema 变更**。
  老用户首次升级后该表自动创建，已有数据不受影响。
- **manifest.json**：`genreCompat` 字段为 optional，不存在时视为"全题材通用"。
  老的 `MethodModuleItem` 加载逻辑无需调整。
- **`runBookAnalysis()`**：保留为单步入口，签名未改；新两阶段函数为新增。

## 调试 / 验证

- 类型检查（不含 `@types/node` 缺失项）：`npx tsc --noEmit -p .`
- 生产构建：`npx vite build` （当前 1911 modules / ~3s 完成）
- DexieDB 迁移测试：在 DevTools → Application → IndexedDB → `FLIL` 删除整个数据库后
  打开应用即可走全新 v4 schema。
