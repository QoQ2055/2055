# Changelog · cineforge-web

本仓库的 v2 资料库阶段（2026 春）系列改动记录。条目按"阶段编号 + 主题"组织，
每条都给出动机、关键文件、用户视角的变化。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 但不严格遵循 SemVer——
本仓库目前是单部署的工具型 webapp，节奏以"阶段"为粒度。

---

## [Unreleased] · v2 阶段 2.x（2026-05）

### 阶段 2.7 · 全仓 simplify 扫描（dead-code elimination）

**动机**：一年多迭代下来，部分早期脚手架函数 / 调试工具 / 兼容映射已经没人调用，
继续留着会让新手读代码时浪费精力辨别"这是真要用的还是历史遗留"。

**配套**：
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\.windsurf\workflows\simplify.md` —
  新建 `/simplify` 工作流文件，定义"扫描 → 分类 → 落地"三步骤 + 风险阈值。

**删除内容（14 处共约 100 行）**：
- 14 个完全无引用的 export（含 1 个仅服务于已删函数的内部 helper）
- 2 个随上述删除而成为 orphan 的 import

| 名称 | 文件 | 类别 |
|------|------|------|
| `hasAnyGenreAnchor` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\components\GenreAnchorPreview.tsx` | helper |
| `CHAPTER_CHUNK_NORMALIZE` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\components\normalizePresets.ts` | preset const |
| `exportActiveProjectFile` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\projectExport.ts` | API |
| `liveToNode` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\projectExport.ts` | 内部 helper（cascade） |
| `getStoryboardPlan` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\storyboardPlan.ts` | helper |
| `estimateRollingCharCount` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\rollingContext.ts` | helper |
| `approxTokensFromText` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\llm\cost.ts` | helper |
| `clearMethodModuleCache` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\methodModules.ts` | debug util |
| `clearManifestCache` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\manifest.ts` | debug util |
| `findStep` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\manifest.ts` | helper |
| `getUserKbDoc` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\userKb.ts` | helper |
| `clearUserKbFeedbackForProject` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\userKb.ts` | helper |
| `legacyAdaptationTypeToSource` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\data\projectTaxonomy.ts` | 兼容映射 |
| `isReflectionRecommended` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\reflection.ts` | helper |
| `getKbIdsForNode` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\kb.ts` | helper |
| `findRecommendation` | `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\methodModuleRecommend.ts` | helper |

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
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\db.ts` — Dexie 升至 v4，新增
  `liveRefinementUndo` 表 + 复合索引 `[chapterIndex+source]`；导出 `LiveRefinementUndoEntry`
  类型与 4 个 helper（`liveRefinementUndoAll/Push/PopLast/Clear`）。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pages\Novel.tsx` — `PreviewModal` 内
  撤销栈从 in-memory 升级为 db 持久化：mount 时按 `(chapterIndex, source)`
  从 db 加载、apply 时 `push`、undo 时 `popLast`。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\project.ts` — `resetAll()` 同步
  调用 `liveRefinementUndoClear()`。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\projectArchive.ts` — `archiveCurrent()`/
  `startNewActive()`/`loadFromDb()` 三处项目切换点同步清空撤销栈。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\store\projectExport.ts` —
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
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\bookAnalyzer.ts` — 新增
  `BookAnalysisStage1` 类型 + `runBookAnalysisStage1()`（轻量框架扫描，~4k token）+
  `runBookAnalysisStage2()`（基于 stage1 + system prompt 增强的深度方法论提炼，
  默认启用 V4 Thinking）。原 `runBookAnalysis()` 保留为向后兼容入口。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pages\Analyzer.tsx` — 新增"分析模式"
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
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\chapterValidation.ts` — 新建。
  纯前端规则检测，毫秒级返回。覆盖 7 类问题：
  1. **`genre.mustAvoid`**（error）— 题材锚点禁忌词命中
  2. **`craft.aiFlavor`**（warning）— AI 套话黑名单（16 词）
  3. **`pace.lengthShort/Long`**（info）— 与平台目标字数偏离 ≥ 50% / ≥ 80%
  4. **`pace.dialogueRatio`**（warning）— 与题材建议的对话占比偏离 > 18 个百分点
  5. **`pace.paragraphSize`**（info）— 平均段落字数偏离题材建议 > 100% / 60%
  6. **`pace.endingHook`**（warning）— 启用爽文 / 悬疑节奏类模块时检测章末钩子
  7. **`genre.mustInclude`**（info）— 单章题材必备元素覆盖率 < 20%
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\components\ChapterValidationPanel.tsx` —
  新建。按 severity 分组显示，命中证据 / 修复建议；干净时折叠为一行徽章。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pages\Novel.tsx` —
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
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\methodModules.ts` —
  `MethodModuleItem` 类型扩展 `genreCompat?: { recommended; incompatible; warnOnEnable }`；
  新增 `validateMethodModuleGenres()` 校验函数 + `GenreCompatIssue` 类型。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\public\methods\manifest.json` —
  给 12 个核心模块填上 `genreCompat`（覆盖结构骨架 / 世界观 / 节奏 / 角色四类）。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\methodModuleRecommend.ts` —
  新增 `applyGenreCompatToRecommendations()` 后处理：incompatible 命中 → 分数压到 ≤25 +
  reason 前缀 `⛔ 与题材[X]冲突：`；warnOnEnable → 分数 -15；recommended → 分数 +5。
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\components\MethodModulePanel.tsx` —
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
- `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pipeline\refinement.ts` 与
  `@C:\Users\QvQ\CascadeProjects\cineforge-web\src\components\RefinementToolPanel.tsx`。
- 独立调试页 `/refinery`（`@C:\Users\QvQ\CascadeProjects\cineforge-web\src\pages\Refinery.tsx`），
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
