---
project: fili-web
epic: gap-d-progress-dashboard
stage: BMAD Stage 2 · PRD only (CA + CK pending)
author: QvQ + Cascade
date: 2026-05-06
audience: 自己（QvQ）+ AI 协作者（Cascade / Claude / Cursor / Copilot）
status: draft · 待评审
workflow: BMAD-METHOD · QQ short-form PRD
related:
  - product-brief.md §4.2 缺口 d 进度可视化
  - prd-gap-e-export.md（gap-e PRD 风格参考）
  - architecture-gap-e-export.md（CA 风格参考，gap-d 之后再写）
  - checkpoint-gap-e-export.md（CK 风格参考，gap-d 之后再写）
---

# gap-d · Novel 页 ProgressDashboard

## 0. TL;DR

在 Novel 页右侧加一个**ProgressDashboard 面板**，让用户在长章节小说写作中**一眼看到**：章节完成进度 grid、字数累积曲线、章节评分卡热力图。**纯 view 组件 + dexie 聚合查询，零业务逻辑改动**。

预计：1 周 / 1 个 PR / 累积 src 增量 ≤ 350 行 / 0 dexie schema 改动 / 0 prompt manifest 改动。

---

## 1. Context · 为什么现在做

### 1.1 当前痛点（来自 v3 dogfood 经验）

QvQ 用 fili-web 写小说时（参见 `docs/dogfood-log.md` v2.x phase 历史），常见问题：

- **进度感知断裂**：章节列表是文字 list，写到 N3.2 第 7 章时，**看不到全局**：还有几章？前面哪几章字数偏低？哪章评分卡红了？
- **回看打断流**：要查全局进度必须回到 Home 卡片或翻 ScoreCard 历史栈，**打断当前写作流**
- **数据已存在但未呈现**：`scoreCard` 历史 / `chapter.body` 字数 / `manifest.steps[].status` 完成度 都在 dexie 里，但 UI 没聚合面板

### 1.2 为什么是 gap-d 而非别的

按 `product-brief.md §4` 价值密度：
- gap-e (导出) ✅ 已完成
- **gap-d (进度可视化)**：1 周 / 激励层 / 不动业务逻辑 → **风险最低，反馈最快**
- gap-b (角色 bible 跨章节追踪): 2-3 周, 需 dexie schema v5
- gap-c (章节衔接): 1 周, 需改 prompt compose
- gap-a (多卷): 条件触发，可能不做

**gap-d 是最小最快的下一步**，且**完全不动业务逻辑** = 极低回滚风险，符合 ADL `Stability > Novelty`。

---

## 2. User Stories

### 2.1 主线 (MUST)

> **US-1**：作为正在 Novel 模式写第 5 章的 QvQ，我打开 Novel 页就能在右侧面板看到"全 12 章中第 5 章"的视觉位置（grid），不必往回看 Home。

> **US-2**：作为想知道哪一章字数失衡的我，我看到字数曲线 → 第 3 章异常短（5000 字 vs 平均 12000 字）→ 我记下"回头补料"。

> **US-3**：作为关心质量的我，我看到评分卡热力图 → 第 7 章某模块（如"动机一致性"）热力色偏红 → 点击直接定位到 ScoreCard 详情。

### 2.2 次线 (SHOULD)

> **US-4**：面板默认折叠（节省屏幕空间），点击图标展开；折叠态显示一句话摘要："共 12 章 / 已完 5 章 / 平均 11200 字 / 评分卡均分 4.2"。

> **US-5**：面板状态（折叠/展开 + 选中章节）持久化到 localStorage，下次打开 Novel 页恢复。

### 2.3 不做 (OUT)

> 不做：编辑章节、删除章节、导出 dashboard 截图、分享 dashboard、跨项目对比。这些都是 dashboard 之外的功能，gap-d 严格 view-only。

---

## 3. Functional Requirements

### FR-1 · ProgressDashboard 容器组件

| # | 描述 | 优先级 |
|---|---|---|
| FR-1.1 | 新增 `src/components/ProgressDashboard.tsx`，导出 `<ProgressDashboard projectId={...} />` | MUST |
| FR-1.2 | 接受 `projectId: string` 作为唯一 prop（其他数据全部从 dexie 聚合）| MUST |
| FR-1.3 | 顶部 toolbar 含：折叠/展开按钮 + "刷新" 按钮（重新跑 dexie 聚合） | MUST |
| FR-1.4 | 折叠态高度 ≤ 48px，展开态高度自适应（建议 ≤ 600px） | SHOULD |
| FR-1.5 | 主内容区 3 个子组件横向 / 纵向布局可切换（默认纵向）| SHOULD |

### FR-2 · 章节完成度 grid

| # | 描述 | 优先级 |
|---|---|---|
| FR-2.1 | 新增 `src/components/dashboard/ChapterCompletionGrid.tsx` | MUST |
| FR-2.2 | grid 单元格：每个 chapter 一个方格，按 `chapterIndex` 排序 | MUST |
| FR-2.3 | 单元格颜色：未开始（灰）/ 进行中（黄）/ 已完成（绿）/ 评分异常（红描边） | MUST |
| FR-2.4 | 单元格 hover 显示：章节标题 + 字数 + ScoreCard 均分 | MUST |
| FR-2.5 | 单元格 click：跳转到 Novel 页对应 chapter 视图 | MUST |
| FR-2.6 | grid 列数：根据容器宽度自适应（5-12 列） | SHOULD |

### FR-3 · 字数累积曲线

| # | 描述 | 优先级 |
|---|---|---|
| FR-3.1 | 新增 `src/components/dashboard/WordCountTrend.tsx` | MUST |
| FR-3.2 | X 轴：章节序号 1, 2, 3, ...; Y 轴：字数 | MUST |
| FR-3.3 | 双系列：当前章节字数（蓝）+ 累积总字数（橙） | MUST |
| FR-3.4 | 横线：平均字数（灰虚线） + 目标字数（绿虚线，如设定）| SHOULD |
| FR-3.5 | 异常章节（字数 < 50% 平均 或 > 200% 平均）红点标注 | SHOULD |
| FR-3.6 | hover 显示数值；click 跳转到对应章节 | MUST |

### FR-4 · ScoreCard 热力图

| # | 描述 | 优先级 |
|---|---|---|
| FR-4.1 | 新增 `src/components/dashboard/ScoreHeatmap.tsx` | MUST |
| FR-4.2 | 矩阵：行 = ScoreCard 维度（如"动机一致性"、"对话自然度"等 6+ 维），列 = chapter 序号 | MUST |
| FR-4.3 | 单元格颜色：score 0-1 → 渐变（红 0.0 → 黄 0.6 → 绿 0.85 → 深绿 1.0） | MUST |
| FR-4.4 | 单元格内显示 score 数值（一位小数）| SHOULD |
| FR-4.5 | hover 显示完整维度名 + chapter 标题 + score 全文（如评分卡有 issue 列表）| MUST |
| FR-4.6 | click 单元格 → 打开对应 ScoreCard 详情（复用现有 `ScoreCardBadge` 弹窗）| MUST |

### FR-5 · Novel 页接入

| # | 描述 | 优先级 |
|---|---|---|
| FR-5.1 | 在 `src/pages/Novel.tsx` N3 阶段（章节生成）UI 区域加 `<ProgressDashboard projectId={projectId} />` | MUST |
| FR-5.2 | 位置：N3 阶段的右侧 sidebar（与现有 ScoreCard / ChapterFeedback 按钮同列）或顶部 collapsible | SHOULD（CA 决定）|
| FR-5.3 | 不动 N1 / N2 阶段 UI（gap-d 仅在章节阶段显示）| MUST |

### FR-6 · 状态持久化

| # | 描述 | 优先级 |
|---|---|---|
| FR-6.1 | 折叠状态 + 当前选中 chapter 通过 zustand store 管理 | MUST |
| FR-6.2 | localStorage key `flil:dashboard:state:<projectId>` 持久化 | MUST |
| FR-6.3 | 状态格式：`{ collapsed: boolean, selectedChapterId: string \| null, layout: 'vertical' \| 'horizontal' }` | MUST |

---

## 4. Non-Functional Requirements

### NFR-1 · 性能

- 首次渲染 ≤ 200ms（在 Chromium / 12 章 / 6 维 ScoreCard 场景）
- dexie 聚合查询单次 ≤ 100ms（不阻塞 UI）
- 折叠/展开动画 ≤ 200ms

### NFR-2 · 视觉

- 配色严格遵循 `DESIGN.md` token 系统（color/space/typography）
- 不引入新的 chart 库（用 SVG 手撸 + Tailwind，与现有 `ScoreCardBadge` 一致）
- 暗色模式兼容（参考 ScoreCardBadge 实现）

### NFR-3 · 代码量

- 累积 src 增量 ≤ **350 行**（gap-e 是 811 行，gap-d 应远低于）
- 单文件 ≤ 200 行（除非有 erratum 显式说明）
- 0 新 npm 依赖

### NFR-4 · 红线（**禁止改动**）

- ❌ Dexie schema (v4 不动)
- ❌ `scoreCard.ts` (511 行 业务逻辑零改)
- ❌ `manifest.json` / prompt 文件
- ❌ Home 页 / Screenplay 页 / Original 页（gap-d 仅 Novel 页）
- ❌ `runStep` / `novelLoop` / pipeline 任何文件

### NFR-5 · 测试

- ProgressDashboard / 3 子组件 各 1 个 vitest unit test 覆盖：渲染 + 空数据 + 数据完整 3 个 case
- E2E：在已有的 dogfood-log 流程后加 1 节"打开 Novel 页 → 看 dashboard 是否正确渲染"

---

## 5. Out of Scope（v3 gap-d 明确不做）

| 项 | 原因 |
|---|---|
| 跨项目 dashboard | 单项目 view 已足够 dogfood |
| 实时刷新（websocket）| 无服务端 |
| 导出 dashboard 截图 | 需 html2canvas 或类似库（违反 NFR-3 0 新依赖）|
| 自定义 chart 配色 | DESIGN.md token 已覆盖 |
| 移动端布局 | 项目 desktop-first |
| 章节排序拖动 | 改 dexie schema，违反 NFR-4 |

---

## 6. Success Criteria（gap-d 何时算完）

| 指标 | 度量 |
|---|---|
| **dogfood 通过** | QvQ 用真实小说项目（≥ 5 章）打开 Novel 页 → 看到 dashboard → 不写代码就能完成"识别字数失衡章 + 找评分异常章"两个任务 |
| **代码量达标** | 累积 src ≤ 350 行 / 0 新依赖 / 0 schema 改动 |
| **零回归** | gap-e 导出功能、N1/N2/N3 流水线、ScoreCard 弹窗 全部不破 |
| **build 健康** | vite build modules 增量 ≤ 30 / build time ≤ 3.5s / tsc 0 新增 error |

---

## 7. Risks + Mitigation

| Risk | Severity | Mitigation |
|---|:---:|---|
| **R1**：ScoreCard 历史数据格式不统一（v2.x 留下的旧格式） | 🟡 中 | dashboard 容错：缺 score 显示灰格；不渲染 NaN |
| **R2**：长项目（≥ 50 章）grid 视觉拥挤 | 🟡 中 | 自适应列数 + 滚动条（FR-2.6） |
| **R3**：dexie 聚合查询慢（章节多 + ScoreCard 历史栈大）| 🟢 低 | useMemo + queryKey 缓存 + 懒加载策略 |
| **R4**：N3 sidebar 位置已挤（已有 5 个 panel）| 🟡 中 | 默认折叠态 (FR-1.4)；CA 时再决定布局 |
| **R5**：与 gap-e 的 ExportDrawer 接入位置冲突 | 🟢 低 | gap-e 在 toolbar，gap-d 在 sidebar/collapsible，物理隔离 |

---

## 8. Phase Plan · PR 拆分（**初稿 · CA 阶段细化**）

| PR | 范围 | 估行数 | 依赖 |
|:---:|---|:---:|---|
| **PR-1** | dexie 聚合 helper（read-only）+ types：`src/store/projectAggregates.ts`（章节字数 / ScoreCard 矩阵 / 完成度统计）| ~120 | 无 |
| **PR-2** | 3 子组件：CompletionGrid / WordCountTrend / ScoreHeatmap，纯 view，吃 props | ~150 | PR-1 |
| **PR-3** | ProgressDashboard 容器 + zustand store + Novel 页接入 | ~80 | PR-2 |
| **PR-4** | dogfood-log 记录 + 测试 + erratum 处理 | docs only | PR-3 |

每 PR 跑 `/dogfood-check` workflow（已建好）。

---

## 9. Open Questions（待 CA / 用户决策）

1. **Q1**：ProgressDashboard 默认位置 = 右侧 sidebar 还是顶部 collapsible？(FR-5.2)
2. **Q2**：完成度判断逻辑 = 看 `manifest.step.status` 还是 `chapter.body` 字数 ≥ 阈值？
3. **Q3**：评分卡热力图维度数量动态（不同 ScoreCard 维度数不同）→ 行高自适应 还是固定 6 行截断？
4. **Q4**：折叠态摘要文案是否需要 i18n 占位？（项目当前中文 only）

---

## 10. References

- **product-brief.md §4.2**：缺口 d 原始 scope 描述
- **prd-gap-e-export.md**：PRD 风格基线（gap-e 是 1151 行，gap-d 因范围窄预估 ≤ 600 行）
- **现有 ScoreCard 生态**：
  - `src/pipeline/scoreCard.ts` (511 行，业务逻辑)
  - `src/components/ScoreCardBadge.tsx` (280 行，UI 弹窗 - **gap-d 复用此弹窗**)
  - `src/components/ChapterScoreCardSlot.tsx` (114 行，挂载点)
  - `src/hooks/useScoreCardController.ts` (90 行)
- **Novel.tsx 状态**：1867 行，三阶段（N1.1-1.2 / N2.1-2.3 / N3.1-3.2），gap-d 仅入 N3 区域

---

## Appendix · BMAD 后续阶段（**本 PRD 不写，待后续 session**）

- **CA (Architecture)**：`docs/planning/architecture-gap-d-progress-dashboard.md`
  - 决定 ProgressDashboard 的 zustand store 形状、dexie aggregate 接口、3 子组件 props 协议、Novel 页布局选择（FR-5.2）
- **CK (Checkpoint)**：`docs/planning/checkpoint-gap-d-progress-dashboard.md`
  - 红线 grep 列表、PR 拆分严格行数 cap、累积 NFR-3 cap、文件白名单、erratum 处理策略

---

> **版本**：v0.1 (draft 2026-05-06) · 待 QvQ + Cascade 评审，评审后进 BMAD Stage 2 CA。
