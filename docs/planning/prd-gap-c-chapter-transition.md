---
project: fili-web
epic: gap-c-chapter-transition
stage: BMAD Stage 2 · PRD only
author: QvQ + Cascade
date: 2026-05-07
status: draft · 待评审
workflow: BMAD-METHOD · QQ short-form PRD
related:
  - product-brief.md §4.4 缺口 c 章节衔接自然过渡
  - prd-gap-b-character-bible.md（gap-b 同期参考）
  - prd-gap-d-progress-dashboard.md（PRD 风格基线）
  - src/pipeline/rollingContext.ts（已实现 · 复用基础）
  - src/pipeline/scoreCard.ts（6 维已实现 · 红线扩展）
---

# gap-c · 章节衔接自然过渡

## 0. TL;DR

让小说每章草稿 / 润色时**显式聚焦"上一章末尾"**，并通过 ScoreCard 第 7 维"衔接顺畅度"自动度量与告警。解决"章节开头硬切 / 与前章末断档 / 时间地点跳跃无过渡"。

预计：1.5-2 周 / 4 PR / 累积 src 增量 ≤ 350 行 / **0 prompt JSON 修改**（在 rollingContext.ts 注入层增强）/ ScoreCard `SCORE_DIMENSIONS` add-only。

---

## 1. Context · 为什么现在做

### 1.1 当前痛点（dogfood 经验）

QvQ 长篇写作（≥ 5 章）反复遇到：

- **章节开头硬切**：第 N 章末"主角推门走入夜色"，第 N+1 章开头"清晨的阳光照进窗户"——读者断片
- **空间 / 时间跳跃无过渡**：上一章在山林避雨，下一章直接进城，缺过渡段
- **情绪断档**：上一章末激烈打斗后情绪未消化，下一章开头平静日常突兀
- **配角谁出场谁离场未交代**：上一章有 A B C，下一章只有 A，B C 哪去了？
- **rollingContext 已注入但 LLM 没注意**：章节 5 章原文塞入 prompt 但 LLM 不知道哪里是"上一章末尾"，无视觉聚焦

### 1.2 为什么 gap-c 优先于 gap-a

按 product-brief.md §4 优先级：
- ✅ gap-e (导出) / ✅ gap-d (Dashboard) / ✅ gap-b (Character Bible)
- **gap-c (章节衔接 prevChapterTail · 1.5-2 周)** ← 现在
- gap-a (多卷 · 4 周 · **条件触发**) — dogfood 实际遇到 ≥ 30 章项目才做

gap-c 是"提质"epic（vs gap-b "解决核心障碍"），但相对 gap-a：
- 短得多（1.5-2 周 vs 4 周）
- 改动面小（注入层 + ScoreCard 加 1 维 vs schema v6 + Novel 页层级重构）
- 风险低（不破红线）

### 1.3 现有可复用资产（**预审计实测**）

| 资产 | 路径 | 复用方式 |
|---|---|---|
| **rollingContext** | `src/pipeline/rollingContext.ts` (`buildRollingContext` L91 + recent 区段) | 在结果末尾追加"## 上一章末尾"标注段，**不改主算法** |
| **ScoreCard 6 维** | `src/pipeline/scoreCard.ts:24-30` (`SCORE_DIMENSIONS` 数组) | add-only · 加 `transitionSmoothness` |
| **ScoreCard weights** | `src/store/settings.ts` `scoreCardWeights` (Partial 字典) | add-only · 新维度可选 weight |
| **N3.1 prompt {{ rollingContext }}** | `public/prompts/novel/3.1.json` user message | 现有变量 · 增强 rollingContext 输出即生效 · **不动 prompt JSON**（红线） |
| **gap-b 路径模式** | userOverride 注入 + settings 守卫 + try/catch（PR-3 范例） | 同模式开关 + 注入 |

→ **不重造**：rollingContext / ScoreCard / weights / 注入路径全复用。

---

## 2. User Stories

### 2.1 主线 (MUST)

> **US-1**：作为长篇 QvQ，我跑 N3.1 第 5 章草稿时，prompt 里看到（自动）：
> ```
> ## 上一章（第 4 章）末尾 3 段【⚠ 本章开头需自然衔接】
> [...原文最后 3 段...]
> ```
> 而不是只在 rolling 滚动文里和 5 章原文混杂。LLM 输出的第 5 章开头能自然承接末尾"夜色 / 推门"画面 / 情绪。

> **US-2**：作为 dogfooder，我看 ScoreCard 多了第 7 维"**衔接顺畅度** (transition)"，分数 ≤ 70 时章节卡显示橙色警告，提示我手动查看开头段。

> **US-3**：作为评分调权用户，我可在 settings `scoreCardWeights.transition` 自定义权重（默认 1.0 等权）。

### 2.2 次线 (SHOULD)

> **US-4**：第 1 章生成时，因无上一章，prompt 里"上一章末尾"段被替换为"(本书第一章 · 自由开篇)"占位文，不破坏 LLM 体验。

> **US-5**：N3.2 章节润色（mode='polish'）也接收 prevChapterTail 注入（与 N3.1 共享同 rollingContext 增强逻辑）。

### 2.3 不做 (OUT)

> 不做：跨章节自动重写前章末尾以适配本章 / AI 自动建议"如何过渡" / 给衔接打 pass-fail 硬闸（仅评分，不阻塞）/ 多卷边界过渡（gap-a 范畴）。

---

## 3. Functional Requirements

### FR-1 · rollingContext 增强 · 显式标注"上一章末尾"

| # | 描述 | 优先级 |
|---|---|---|
| FR-1.1 | 修改 `rollingContext.ts` `buildRollingContext` 输出 `rolling` 字符串：在 recent 区原文之后追加 `## 上一章（第 X 章）末尾 N 段【⚠ 本章开头需自然衔接】` 段 | MUST |
| FR-1.2 | "末尾 N 段"提取策略：拆 `\n\n` 为段落，取最后 `prevTailParagraphs` 段（默认 3，可配） | MUST |
| FR-1.3 | 第 1 章特殊处理：若无上一章，输出 `(本书第一章 · 自由开篇 · 无衔接要求)` 占位 | MUST |
| FR-1.4 | 截断保护：上一章末尾段总字数超 800 字时，截到 800 字（防 token 爆炸） | MUST |
| FR-1.5 | 配置接口：`buildRollingContext` 加可选 `prevTailParagraphs?: number` 参数（default 3） | SHOULD |
| FR-1.6 | 0 修改 N3.1 / N3.2 / N3.3 prompt JSON · 现有 `{{ rollingContext }}` 直接接收增强输出 | MUST |

### FR-2 · ScoreCard 第 7 维 `transition`

| # | 描述 | 优先级 |
|---|---|---|
| FR-2.1 | `src/pipeline/scoreCard.ts` `ScoreDimension` 加 `'transition'` 字面量（add-only，6 维不变） | MUST |
| FR-2.2 | `SCORE_DIMENSIONS` 数组追加 `'transition'`（第 7 项） | MUST |
| FR-2.3 | 维度类型 = LLM-driven（与 r1Align / userKbStyle 同档），按需触发 | MUST |
| FR-2.4 | 评分 prompt：以本章前 200 字 + 上一章末尾 200 字为输入，0-100 评分（≥ 80 优 / 60-80 中 / < 60 警告）| MUST |
| FR-2.5 | settings `scoreCardWeights.transition` 可选 number（默认等权 1.0）| SHOULD |
| FR-2.6 | 第 1 章自动跳过（无上一章 → score = null + reason='第一章无衔接对象'）| MUST |

### FR-3 · ScoreCard UI 显示第 7 维

| # | 描述 | 优先级 |
|---|---|---|
| FR-3.1 | ScoreCard 现有渲染组件（gap-d 已用） + 自动渲染第 7 维（无需新组件） | MUST |
| FR-3.2 | 评分 < 70 时章节卡显示橙色 transition 警告徽章（参考 gap-d hasIssue / hasOutlier 模式）| SHOULD |
| FR-3.3 | 第 7 维空值（第 1 章）UI 显示 "—" 不参与平均 | MUST |

### FR-4 · settings 开关（可选）

| # | 描述 | 优先级 |
|---|---|---|
| FR-4.1 | settings 加 `enableTransitionScoring: boolean`（默认 `true` · 与 6 维同档启用）| SHOULD |
| FR-4.2 | 关闭时第 7 维不计算且不显示（保持 6 维 UI 不变）| SHOULD |

---

## 4. Non-Functional Requirements

### NFR-1 · 性能

- rollingContext 输出增强：纯字符串拼接，**0 LLM 调用**，< 5ms
- ScoreCard 第 7 维 LLM 评分：≤ 8s（参考现有 r1Align 维度）
- 不影响 N3.1 / N3.2 主流程响应时间

### NFR-2 · Token 经济性

- 上一章末尾 N 段注入 ≤ 800 字（FR-1.4 cap），输入侧 ~1100 token 增量
- 第 7 维评分调用：input ~600 token + output ~150 token
- 整体每章 token 增量 < 5%

### NFR-3 · 代码量

- **累积 src 增量 ≤ 350 行**（vs gap-d 350 / gap-b 916 / 体量介于两者）
- 单文件 ≤ 250 行
- **0 新 npm 依赖**

### NFR-4 · 红线（**禁止改动**）

- ❌ 不动 N1.x / N3.x prompt JSON（同 gap-b 红线 #2 类比）
- ❌ 不动 `consistencyCheck.ts`（同 gap-b 红线 #3）
- ❌ 不动 `rollingContext.ts` **核心算法**（buildRollingContext 主流程 / condenseFiveSegment 等不变；仅追加 tail-marker 块）
- ❌ 不动 ScoreCard 现有 6 维实现（仅 add 7th）
- ❌ 不动 gap-d / gap-b / gap-e 资产

### NFR-5 · 测试

- **手测优先**（沿用 gap-d / gap-b 惯例）
- dev console 跑 `buildRollingContext` 验证 tail 段格式
- 浏览器实测：开新长篇项目 → 跑 N3.1 第 2 章 → 检查 prompt 含 tail 标注 → 出生章看 ScoreCard 第 7 维

---

## 5. Out of Scope

| 项 | 原因 |
|---|---|
| AI 自动重写前章末尾 | 高风险破坏前文，留 v4 |
| 跨卷过渡专用逻辑 | gap-a 范畴 |
| 衔接打硬闸（拒绝合并 / 阻塞）| ScoreCard 仅评分不阻塞，符合既有"提示而不强制"哲学 |
| ScoreCard UI 大改 | 复用现有 6 维渲染 + 第 7 维自动接入即可 |

---

## 6. Success Criteria

| 指标 | 度量 |
|---|---|
| **dogfood 通过** | QvQ 用 ≥ 5 章项目，开启第 7 维，每章自动跑、第 1 章特殊处理正常、章节开头明显比 v3 之前自然（人工抽 3 章对照）|
| **代码量** | 累积 src ≤ 350 / 单文件 ≤ 250 / 0 新 deps |
| **零回归** | gap-d / gap-b / gap-e 仍工作；6 维 ScoreCard 全部计算 / 显示正常 |
| **build 健康** | vite modules 增量 ≤ 20 / build 0 errors / tsc 0 新 error |

---

## 7. Risks + Mitigation

| Risk | Severity | Mitigation |
|---|:---:|---|
| **R1**：rollingContext.ts 改动破坏 novel.6 / novel.7 / 其他调用方 | 🟡 中 | (a) 仅追加 tail-marker 段，不改 buildRollingContext 接口；(b) PR-1 必须 dev console 实测多个章节场景验证 rollingContext 输出格式正确 |
| **R2**：第 7 维 LLM 评分质量不稳定 | 🟡 中 | (a) prompt 严格输出 schema（数字 + 一句话理由）；(b) 失败容错 → 评分 = null；(c) 用户可关闭 |
| **R3**：上一章末尾段提取错（拆段算法误判 markdown 标题）| 🟢 低 | 段拆策略保守：仅按 `\n\n` 分；过短段（< 50 字）合并；保留 markdown 完整 |
| **R4**：scoreCardWeights 加新字段不向后兼容 | 🟢 低 | `Partial<{...}>` 扩展 add-only · 旧 weights 继续工作 |
| **R5**：dogfood 实测 LLM 仍硬切（提示无效）| 🟡 中 | 改善 prompt 可被覆盖的 instruction 强度（FR-1.1 「⚠ 本章开头需自然衔接」用强提示词）；评估后必要时 PR-2 加专项 instruction |

---

## 8. Phase Plan · PR 拆分（**初稿 · CA 阶段细化**）

| PR | 范围 | 估行数 | 依赖 |
|:---:|---|:---:|---|
| **PR-1** | rollingContext.ts 增强 + 单元 dev smoke | ~70 | — |
| **PR-2** | ScoreCard 第 7 维 transition 维度（含 LLM prompt + 计算函数）| ~150 | — |
| **PR-3** | settings 开关 + ScoreCard 调用 + UI 警告徽章联动 | ~50 | PR-1 + PR-2 |
| **PR-4** | dogfood-log 追加 gap-c 节 + erratum（如适用）| ~80 docs · 0 src | PR-3 |
| **累积 src** | | **~270** | （cap 350，安全边距 80）|

每 PR 跑 `/dogfood-check` workflow。

---

## 9. Open Questions（待 CA 决议）

1. **Q1**：`prevTailParagraphs` 默认值？(2 / 3 / 5) — 取多少段最平衡？
2. **Q2**：rollingContext.ts 增强 vs 包装层 vs N3.1 prompt 升级，哪条路径最干净不破红线？
3. **Q3**：第 7 维 LLM 评分 prompt 是 inline 在 scoreCard.ts 还是独立 `prompts/scorecard/transition.json`？
4. **Q4**：ScoreCard UI 自动支持第 7 维渲染 vs 需要在 ChapterScoreCardSlot.tsx 显式扩展？（看现有 SCORE_DIMENSIONS 是否被遍历）
5. **Q5**：rollingContext 已经合并到 N3.6 / N3.7 prompt，是否影响 N3.6 章节草稿循环 / N3.7 润色循环 同步增强？

---

## 10. References

- **product-brief.md §4.4**：缺口 c 原始 scope（"改 compose.ts 给 chapter prompt 注入 prevChapterTail"）
- **prd-gap-b-character-bible.md**：PRD 风格基线 + userOverride 注入路径先例
- **rollingContext.ts**（279 行 · 已实现 buildRollingContext 主流程）
- **scoreCard.ts**（6 维 + LLM-driven r1Align/userKbStyle 维度）

---

## Appendix · BMAD 后续阶段（**本 PRD 不写 · 待 CA / CK / 实施 session**）

- **CA**：决议 5 Open Q + 锁住 rollingContext 增强位置 + ScoreDimension 加项位点 + 4 PR DoD 详表
- **CK**：4-5 红线 grep + 5-7 不变量 grep + 累积 ledger（350 cap） + 各 PR DoD checklist
- **Stage 3-4**：4 PR · 每 PR 跑 `/dogfood-check`

---

> **版本**：v0.1 (draft 2026-05-07) · 待 QvQ 评审，评审后进 BMAD Stage 2 CA。
> **gap-c vs gap-b 关键差异**：gap-c 是**提质 epic**（已有功能基础上加显式标注 + 第 7 维），不触碰 schema / prompt 红线；gap-b 是**新功能 epic**（schema v5 + 新 LLM step + 完整 UI 面板）。本 epic 风险显著低于 gap-b。
