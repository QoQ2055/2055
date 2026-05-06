---
project: fili-web
epic: gap-b-character-bible
stage: BMAD Stage 2 · PRD only (CA + CK pending follow-up sessions)
author: QvQ + Cascade
date: 2026-05-06
audience: 自己（QvQ）+ AI 协作者（Cascade）
status: draft · 待评审
workflow: BMAD-METHOD · QQ short-form PRD
related:
  - product-brief.md §4.3 缺口 b 角色 bible 跨章节追踪
  - prd-gap-d-progress-dashboard.md（PRD 风格基线）
  - prd-gap-e-export.md（PRD 风格基线）
  - src/pipeline/consistencyCheck.ts（已有角色提取机制 · 复用基础）
  - src/pipeline/novelLoop.ts（章节循环架构 · 注入点）
---

# gap-b · 角色 Bible 跨章节追踪

## 0. TL;DR

让 Novel 模式在每章生成后**自动提取角色状态变化**（关系 / 情感 / 能力 / 关键事件），存入新 Dexie 表 `characterStates`，UI 提供 **CharacterBible 时间线面板**。解决"长篇写到第 N 章时，主角对某配角的态度演变断片 / 旧设定被遗忘"。

预计：2-3 周 / 5 PR / 累积 src 增量 ≤ 700 行 / Dexie schema v4 → v5 / **新 LLM step**（"角色状态提取"）/ 复用 `consistencyCheck.ts` 角色提取机制。

---

## 1. Context · 为什么现在做

### 1.1 当前痛点（来自 v3 dogfood 经验）

QvQ 写长篇小说时（≥ 10 章）反复遇到：

- **角色态度演变断片**：第 3 章主角讨厌 X，第 8 章突然欣赏 X，中间过渡缺失
- **旧设定遗忘**：N1.2 人物 Bible 写了"主角左手残疾"，第 12 章用左手开锁了
- **关系网失序**：A 与 B 在第 5 章已经撕破脸，第 9 章作者忘了又让他们友好对话
- **prompt 上下文不足**：novel.6 章节草稿循环只看 `prevChapterTail`（最后 N 段），跨章节角色状态不可用

### 1.2 为什么 gap-b 而非 gap-c (章节衔接)

按 product-brief.md §4 价值密度：
- gap-d (Dashboard) ✅ 已完成
- **gap-b (角色 Bible 追踪)**：长篇必需，2-3 周 → **解决"长篇能完整跑通"的核心障碍**
- gap-c (章节衔接 prevChapterTail 注入): 1 周, 提质，但不解决"角色态度演变"问题
- gap-a (多卷): 后期，条件触发

**gap-b 优先于 gap-c 的理由**：gap-c 是"段落级"衔接，gap-b 是"章节级"角色一致性。gap-c 解决的问题（自然过渡）实际由 gap-b 的角色状态可见后变得简单（用户能看到上一章人物状态再写）。

### 1.3 现有可复用资产（**预审计发现**）

| 资产 | 路径 | 复用方式 |
|---|---|---|
| **角色实体提取** | `src/pipeline/consistencyCheck.ts` (L215 `extractCharacterMentions`, L139 `buildAssetIndex`) | 直接调用，知道哪些角色出现在某章节 |
| **EntityKind 类型** | `src/pipeline/consistencyCheck.ts` (L17) | 共用 'character' kind |
| **N1.2 人物 Bible artifact** | `project.artifacts['novel.2']` | 提取 baseline 角色定义（姓名/性别/性格 etc.）|
| **章节内容存储** | `artifact.meta.chapterContents[idx]` (gap-d 已验证) | 给 LLM 喂当前章节文本 |
| **runStep 流水线** | `src/pipeline/runner.ts` `runStep()` | 调用新 LLM step |
| **artifact.meta 持久化** | gap-d / scoreCard 都用过 | 状态结果挂在 artifact.meta 备查 |

→ **不重造** 角色提取 / LLM 调用 / 持久化机制。

---

## 2. User Stories

### 2.1 主线 (MUST)

> **US-1**：作为写到第 8 章的 QvQ，我点 N3.2 章节润色后，系统自动提取本章每个出场角色的状态变化（关系层 / 情感层 / 能力层 / 关键事件），存到 `characterStates`。我看到日志里"已记录主角对配角 X 的态度从 厌恶→中立"。

> **US-2**：我打开 Novel 页 CharacterBible 面板，选择"主角"，看到时间线视图：第 1 章 → 第 8 章每个状态快照（关系网 / 情绪 / 能力变化），按章节横向滚动。

> **US-3**：我准备写第 9 章，启动 N3.1 草稿前打开 CharacterBible，**Cascade 把"截至第 8 章主角的最新状态摘要"自动注入 prompt** 让 LLM 知道当下角色状况。

### 2.2 次线 (SHOULD)

> **US-4**：我手动修订第 5 章中的角色行为，触发"重跑状态提取"按钮 → 该章及之后所有章节的状态被标记为 `stale`，提示我重跑。

> **US-5**：我导出 CharacterBible 为 markdown（接 gap-e ExportDrawer），用于离线参考。

### 2.3 不做 (OUT)

> 不做：自动修订前文不一致 / AI 生成"角色应如何说话" / 跨项目角色复用 / 角色立绘生成（那是 image-prompt-craft skill 的领域）。

---

## 3. Functional Requirements

### FR-1 · Dexie schema v5 · `characterStates` 表

| # | 描述 | 优先级 |
|---|---|---|
| FR-1.1 | 新增 v5 schema：`characterStates: '++id, projectId, chapterIndex, characterName, [projectId+chapterIndex], [projectId+characterName]'` | MUST |
| FR-1.2 | 字段：`{ id, projectId, chapterIndex, characterName, snapshot: CharacterSnapshot, sourceArtifactNodeId, ts, stale: boolean }` | MUST |
| FR-1.3 | `CharacterSnapshot` 结构：`{ relations: Record<string, string>, emotion?: string, abilities?: string[], keyEvents?: string[], summary?: string }` | MUST |
| FR-1.4 | 不破坏 v4 数据；migration step：v4→v5 仅追加表，零现有数据迁移 | MUST |
| FR-1.5 | 提供 dexie helper 函数：`upsertCharacterState / listChapterStates(projectId, chapterIndex) / listCharacterTimeline(projectId, characterName) / markStateStale(projectId, fromChapter)` | MUST |

### FR-2 · 新 LLM step · `novel.8` 角色状态提取

| # | 描述 | 优先级 |
|---|---|---|
| FR-2.1 | 在 manifest（`public/methods/manifest.json`）加 `novel.8` step：`{ id: 'novel.8', title: 'N3.3 角色状态提取', prompt: 'novel/3.3-character-state-extract.md', outFormat: 'json', ... }` | MUST |
| FR-2.2 | Prompt 文件 `public/prompts/novel/3.3-character-state-extract.md`：输入当前章节内容 + N1.2 人物 Bible + 截至上一章的状态摘要；输出 JSON 数组 `[{ characterName, snapshot }]` | MUST |
| FR-2.3 | 触发时机：novel.7 章节润色完成后**自动**追加（参考 gap-d 的 chapterContents 已就绪状态） | MUST |
| FR-2.4 | 失败容错：LLM 返回非法 JSON / 无角色 → 不阻塞 novel.7 完成；记录到 `runHistory` 且 UI 显示警告 | MUST |
| FR-2.5 | 单次调用 token 预算：≤ 4000 input + 1500 output（参考 N3 阶段平均章节字数）| SHOULD |
| FR-2.6 | settings 新增开关：`enableCharacterStateExtraction: boolean`（默认 false，避免老用户被动产生 token 费用）| MUST |

### FR-3 · `extractCharacterMentions` 复用接口

| # | 描述 | 优先级 |
|---|---|---|
| FR-3.1 | 新增 `src/pipeline/characterStates.ts`，导出 `runCharacterStateExtraction(opts: RunCharacterStateOpts): Promise<CharacterSnapshot[]>` | MUST |
| FR-3.2 | 实现内部：先用 `extractCharacterMentions(chapterContent, charactersFromBible)` 找出场角色，再调 LLM 单次 batch 提取所有 snapshot（避免 N 次 LLM call）| MUST |
| FR-3.3 | 输出后调 `upsertCharacterState` 持久化 | MUST |

### FR-4 · CharacterBible UI 面板

| # | 描述 | 优先级 |
|---|---|---|
| FR-4.1 | 新增 `src/components/CharacterBible.tsx`：主组件，吃 `projectId` 与 `selectedCharacter` props | MUST |
| FR-4.2 | 子组件 `CharacterTimelineView.tsx`：时间线（横向 章节序号 vs 纵向 维度），每格显示状态快照摘要 | MUST |
| FR-4.3 | 子组件 `CharacterRelationGraph.tsx`：关系图（圆 + 连线 · 用 SVG 手撸，不引图论库）| SHOULD |
| FR-4.4 | 顶部 toolbar：角色选择下拉 + "重新提取本章"按钮 + "标记 stale 从此处"按钮 | MUST |
| FR-4.5 | 接入 Novel 页：在 ProgressDashboard 下方加 collapsible CharacterBible 面板（默认折叠） | MUST |

### FR-5 · Prompt 上下文注入（让 N3.1 草稿见到角色状态）

| # | 描述 | 优先级 |
|---|---|---|
| FR-5.1 | 修改 `src/pipeline/novelLoop.ts` 中 N3.1 草稿循环：构造每章 prompt 时，调 `listChapterStates(projectId, chapterIndex - 1)` 取上一章末状态，作为新变量 `{{ characterStateSummary }}` 注入 | MUST |
| FR-5.2 | 默认行为：注入；用户可在 settings 关闭（同 enableCharacterStateExtraction 开关）| MUST |
| FR-5.3 | 注入预算：截断 ≤ 1500 字（避免 token 爆炸） | MUST |

### FR-6 · stale 状态标记 + UX

| # | 描述 | 优先级 |
|---|---|---|
| FR-6.1 | 用户手动修第 N 章 → 触发 `markStateStale(projectId, fromChapter: N)` → 该章及后续 stale=true | MUST |
| FR-6.2 | UI 显示 stale 状态视觉标记（黄色徽章）| MUST |
| FR-6.3 | 用户可点"批量重跑 stale 章节"按钮触发批处理 | SHOULD |

---

## 4. Non-Functional Requirements

### NFR-1 · 性能

- **每章状态提取 LLM 调用**：≤ 30s（依赖外部 API，与 ScoreCard 同档）
- **CharacterTimelineView 首渲染**：50 章 × 8 角色 → ≤ 300ms
- **`listCharacterTimeline` Dexie 查询**：50 章数据 → ≤ 50ms（用 [projectId+characterName] 复合索引）

### NFR-2 · Token 经济性

- 状态提取 step 默认**关闭**，需用户显式开启（settings 切换）
- 开启后每章净增 ~5500 token（input + output）
- 提供"仅运行最近 N 章"选项避免长篇全量重跑

### NFR-3 · 代码量

- **累积 src 增量 ≤ 700 行**（gap-b > gap-d 因业务面更广 · 但 < 800 行 NFR-7 cap）
- 单文件 ≤ 250 行
- **0 新 npm 依赖**

### NFR-4 · 红线（**禁止改动 · 注意 vs gap-d 红线变化**）

- ❌ 不动 v1-v4 schema（仅追加 v5 表，**migration 仅 add，零字段修改**）
- ❌ 不动 N1.2 人物 Bible 现有 prompt
- ❌ 不动 N3.2 章节润色现有 prompt
- ❌ 不动 ConsistencyPanel / consistencyCheck.ts 现有逻辑（仅作为 import 复用）
- ❌ 不动 gap-d 已交付的 ProgressDashboard / projectAggregates / dashboard store

### NFR-5 · 测试

- **手测优先**（vs vitest）：本仓 0 vitest，gap-d PR-4 已确立"manual smoke in dev console"惯例
- 浏览器 E2E：长篇项目 ≥ 5 章 → 开启状态提取 → 看到 timeline → 验 prompt 注入 → 修第 3 章 → 验 stale → 重跑

---

## 5. Out of Scope（v3 gap-b 明确不做）

| 项 | 原因 |
|---|---|
| AI 自动修订前文不一致 | 高风险、需要确切对前文有破坏性修改的能力，留 v4 |
| 角色立绘 / 形象生成 | image-prompt-craft skill 领域，独立 epic |
| 跨项目角色复用 | userKbDocs 已有"角色维度"，足够 |
| 多语言 i18n | 项目 v3 仍中文 only |
| 自动剧情转折建议 | 需要"AI 编辑"能力，超出范围 |
| 移动端布局 | desktop-first |

---

## 6. Success Criteria（gap-b 何时算完）

| 指标 | 度量 |
|---|---|
| **dogfood 通过** | QvQ 用 ≥ 10 章长篇项目，开启状态提取，每章自动跑、状态准确（人工抽 3 章核对）、N3.1 草稿能看到上一章状态、修订触发 stale 正确 |
| **代码量** | 累积 src ≤ 700 / 单文件 ≤ 250 / 0 新 deps / Dexie v4 → v5 仅 add |
| **零回归** | gap-d 仍工作、N1/N2/N3 流水线全部通过、ConsistencyPanel 不破 |
| **build 健康** | vite build modules 增量 ≤ 50 / build time ≤ 4s / tsc 0 新 error |

---

## 7. Risks + Mitigation

| Risk | Severity | Mitigation |
|---|:---:|---|
| **R1**：Dexie v4 → v5 schema 升级在用户已有 v4 IndexedDB 上是否安全 | 🔴 **高** | 严格"仅 add 表，零字段修改"；gap-b PR-1 必须包含 dev console 手测：v4 项目打开 → 数据完整、新增 v5 表存在 |
| **R2**：LLM 状态提取质量不稳定（JSON 格式 / 角色名不一致 / 关系含糊）| 🟡 中 | (a) prompt 强 schema 约束 + Few-shot Example；(b) JSON 解析失败容错 → 标 unknown；(c) UI 显示原始 LLM 输出供调试 |
| **R3**：长篇项目（≥ 30 章 × 10 角色 = 300 entries）UI 性能 | 🟡 中 | timeline 虚拟滚动 / 角色切换 lazy load / Dexie 复合索引 |
| **R4**：用户忘开 settings → 状态从未提取，timeline 空 | 🟡 中 | 首次进 N3 阶段时显式"是否开启状态追踪？"提示（一次性 dialog） |
| **R5**：状态提取 prompt 注入到 novel.6 草稿 → token 爆炸 | 🟢 低 | FR-5.3 预算 ≤ 1500 字截断；token 监控接 settings 现有 maxTokens 体系 |
| **R6**：用户在多项目间切换，characterStates 隔离 | 🟢 低 | 复合索引 [projectId+chapterIndex] 保证；切项目时 dashboard 类似清空 |
| **R7**：N1.2 人物 Bible 缺失 → 状态提取无 baseline | 🟡 中 | 提取时先检查 Bible，缺失则降级（用纯章节内容提取，警告用户）|

---

## 8. Phase Plan · PR 拆分（**初稿 · CA 阶段细化**）

| PR | 范围 | 估行数 | 依赖 | 可独立合入？ |
|:---:|---|:---:|---|:---:|
| **PR-1** | Dexie schema v5 + types + dexie helpers (`src/store/db.ts` +50 / `src/store/characterStates.ts` ~120) | ~170 | — | ✅ schema add 不破坏现有 |
| **PR-2** | LLM step + prompt 文件（`public/prompts/novel/3.3-character-state-extract.md` + `public/methods/manifest.json` + `src/pipeline/characterStates.ts` ~150）| ~200 | PR-1 | ❌ 依赖 PR-1 表 |
| **PR-3** | settings 开关 + N3.2 完成后自动触发 step（`src/pipeline/novelLoop.ts` +40 / `src/store/settings.ts` +10）| ~50 | PR-2 | ❌ |
| **PR-4** | CharacterBible UI 面板（CharacterBible.tsx ~120 / CharacterTimelineView.tsx ~100 / CharacterRelationGraph.tsx ~90 / Novel 页接入 +6）| ~320 | PR-3 | ❌ |
| **PR-5** | stale 标记 + 重跑批处理 + dogfood-log entry（src 改动 ~40 + docs ~80）| ~120 / 80 docs | PR-4 | ❌ |
| **累积 src** | | **~740** | | ⚠ 接近 NFR-3 cap 700（CK 阶段细化） |

每 PR 跑 `/dogfood-check` workflow（已建好）。

---

## 9. Open Questions（待 CA / 用户决策）

1. **Q1**：CharacterBible 在 Novel 页位置 = ProgressDashboard 下方折叠 vs 独立 Tab？（CA §4.x 决议）
2. **Q2**：`characterStates.snapshot.relations` 的 schema 是 freeform `Record<string, string>` 还是受限枚举（friend/enemy/neutral/lover/family）？（CA §3.x 决议）
3. **Q3**：状态提取失败的 fallback：写入 `null` 留空 vs 不写入留 missing？（影响 timeline 渲染）
4. **Q4**：N1.2 人物 Bible 缺失时的降级行为：纯章节文本提取 vs 拒绝运行？
5. **Q5**：是否需要 v5 schema 完整 migration 测试 fixture（v4 数据夹 → upgrade → 验证完整性）？

---

## 10. References

- **product-brief.md §4.3**：缺口 b 原始 scope 描述
- **prd-gap-d-progress-dashboard.md**：PRD 风格基线（gap-d 164 行 / gap-b 估 ~400 行 因范围 3x）
- **现有 ConsistencyPanel + consistencyCheck.ts 生态**：
  - `src/pipeline/consistencyCheck.ts` (核心逻辑 · 复用 extractCharacterMentions / buildAssetIndex)
  - `src/components/ConsistencyPanel.tsx` (UI 范例)
- **现有 ScoreCard 生态**（结构类比）：
  - `src/pipeline/scoreCard.ts` (LLM step 模式 · gap-b 新 step 类比)
  - `src/hooks/useScoreCardController.ts` (controller 模式)
- **gap-d Progress Dashboard**：`docs/planning/architecture-gap-d-progress-dashboard.md`（CA 风格基线）

---

## Appendix · BMAD 后续阶段（**本 PRD 不写，待后续 session**）

- **CA (Architecture)**：`docs/planning/architecture-gap-b-character-bible.md`
  - 决定 dexie 索引设计、CharacterSnapshot 详细结构、prompt schema、UI 布局（Q1-Q5 决议）
  - characterStates.ts 算法详解（ extractCharacterMentions 集成）
  - 升级 gap-d 文件白名单 grep（不能动 ProgressDashboard / projectAggregates）

- **CK (Checkpoint)**：`docs/planning/checkpoint-gap-b-character-bible.md`
  - 红线 grep（v4 schema 不动 / N1.2 prompt 不动 / N3.2 prompt 不动 / consistencyCheck.ts 不动 / gap-d artifacts 不动）
  - 累积 ledger（5 PR 各自 cap 与累积 cap 700）
  - schema migration 验证脚本 / 5 不变量 grep

- **Stage 3-4 (Implementation)**：5 PR · 每 PR 跑 `/dogfood-check`

---

> **版本**：v0.1 (draft 2026-05-06) · 待 QvQ + Cascade 评审，评审后进 BMAD Stage 2 CA。
> **关键差异 vs gap-d**：本 epic 触碰 **schema / prompt / pipeline 三大红线领域**（gap-d 全是 0），需要更严格的 CA + CK 把关。
