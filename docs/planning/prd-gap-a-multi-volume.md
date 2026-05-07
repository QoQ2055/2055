---
project: fili-web
epic: gap-a-multi-volume
stage: BMAD Stage 1+2 · Pre-audit + Conditional PRD
author: QvQ + Cascade
date: 2026-05-07
status: **draft · 条件触发**（dogfood 未达触发线时 PRD 仅备案，不进 CA/CK 实施）
related:
  - product-brief.md §4.5 缺口 a
  - prd-gap-b-character-bible.md（schema 变更先例）
  - prd-gap-c-chapter-transition.md（rollingContext 集成）
---

# gap-a · 多卷架构 · 条件触发 PRD

> **本文档与 gap-d / gap-b / gap-c 不同**：那三个 epic 是 v3 主线必交付；gap-a 是"等 dogfood 触发后再做"的备案 epic。本 PRD **不展开 CA / CK**，仅冻结：①范围澄清（vs brief 旧版）②触发线 ③估算 ④决策树。

---

## 0. TL;DR

让 fili-web 项目把"卷"从**派生数据**（每次 useMemo 解析 N2.1 markdown）升级为**first-class data**（Dexie 持久化），让 Novel 页章节列表按卷分组、Dashboard 出卷级进度、跨卷过渡复用 gap-c。

预计：3-4 周（vs brief 旧估 4 周）/ 4-5 PR / 累积 src ~560 / **schema v5 → v6**（gap-b 后续）/ **触发条件未满足时 PRD 仅备案**。

---

## 1. Context · 与 brief 的关键修订

### 1.1 brief 旧描述 vs 实测

product-brief.md §4.5 写：

> - dexie schema v4 → v5：projects 加 `volumes: { id, name, chapterRange }`
> - Novel 页大纲层级：volume → chapter

**实测修正**：

| brief 旧说法 | 2026-05-07 实测 | 修订 |
|---|---|---|
| schema v4→v5 加 volumes | 已升 v5（gap-b）· 当前**5**（无 volumes 表）| **v5→v6** add volumes 表 |
| Novel 页缺多卷大纲 | N2.1 / N2.2 prompt + parseVolumePlan + runVolumeLoop **已存在** | gap-a 不是从零做，是把"派生"升"持久化"+ 视图增强 |
| 4 周 | 已实现 ~40% 基础 | 修正 **3-4 周**（视 dogfood 反馈深度）|

### 1.2 当前已有 vs 缺失

**已实现** ✅：
- N2.1 分卷规划 LLM step + N2.2 单卷分章 LLM step
- `VolumeMeta` 类型 + `parseVolumePlan` + `parseChapterOutlines` 解析（markdown driven）
- `runVolumeLoop` 按卷批量跑分章
- Novel.tsx L603/L616 显示"已识别 N 卷 / X/N 卷完成"

**缺失** ❌（gap-a 范围）：
- 卷数据**持久化**到 Dexie（当前每次 useMemo 重解析）
- 卷**状态追踪**（哪些已完成 / stale / 字数 / 评分平均）
- Novel 页 N3 章节列表**按卷分组**视觉（折叠 / 展开）
- ProgressDashboard 加**卷级 progress badge**（gap-d 集成）
- 跨卷边界 prevChapterTail 处理（gap-c 集成）
- 卷重命名 / 章节跨卷迁移 UI

### 1.3 触发条件（**强制门**）

product-brief.md §4.5 原文：

> - **慎做**：90% 的 v3 dogfood 大概率是 10-20 章中篇，多卷不阻塞最早闭环
> - **触发条件**：Week 7 之前 dogfood 实际碰到"≥ 30 章 / 多季节奏"才做；否则推到 v4

**精确化触发线**（gap-a 启动门）：

| 条件 | 量化 |
|---|---|
| **C-1** dogfood 项目章数 | ≥ 25 章（贴近 30 但留 buffer） |
| **C-2** 跨卷需求 | dogfood 项目至少含 2 卷规划 |
| **C-3** 用户体感 | 至少 1 次反馈"按卷管理章节"诉求 |
| **C-4** v3 主线稳定 | gap-b + gap-c dogfood 验证 ≥ 1 周无 critical bug |

**满足 C-1 + (C-2 OR C-3) + C-4 = 启动 gap-a Stage 2 CA**。否则**推 v4**。

**当前实测（2026-05-07）**：
- C-1: ❌（dogfood 尚未启动）
- C-2: ❌
- C-3: ❌
- C-4: ❌

→ **当前 gap-a 不启动**，本 PRD 仅备案。

---

## 2. User Stories（条件触发后）

### 2.1 主线 (MUST)

> **US-1**：作为长篇 QvQ（≥ 25 章），我跑完 N2.1 分卷规划后，**自动**把卷信息（id / name / chapterRange / themeSummary）持久化到 Dexie，刷新页面不丢。

> **US-2**：在 Novel 页 N3 阶段，章节列表**按卷分组折叠**：
> ```
> ▼ 第一卷 · 落魄少年 · 1-15 章 · 已完成 12/15
>   - 第 1 章 · 风暴前夕 ...
>   - 第 2 章 ...
> ▶ 第二卷 · 江湖闯荡 · 16-30 章 · 草稿 0/15
> ```

> **US-3**：在 ProgressDashboard 加**卷级 progress badge**（每卷一个 chip）：「第 1 卷 12/15 ✅」「第 2 卷 0/15 ⏸」。

### 2.2 次线 (SHOULD)

> **US-4**：跨卷边界（卷 N 末尾 → 卷 N+1 开头）的 `prevChapterTail`（gap-c）特殊处理：标"⚠ 跨卷过渡"提醒 LLM 注意视角 / 时间跳跃。

> **US-5**：用户可手动**重命名卷** / **拖动章节跨卷迁移**（受多卷大纲约束）。

### 2.3 不做 (OUT)

| 项 | 原因 |
|---|---|
| AI 自动调整卷边界 | 高风险破坏前文，留 v4 |
| 多卷封面 / metadata 体系 | 出版导向，gap-e 范畴 |
| 卷级 ScoreCard 聚合 | gap-d Dashboard 已能做（卷过滤章节）|
| 多季节奏（season）模型 | brief 提到但实际是营销概念，技术上 = 多卷 |

---

## 3. Functional Requirements（草拆 · CA 阶段细化）

### FR-1 · Schema v5 → v6 加 volumes 表（**单向门**）

| # | 描述 | 优先级 |
|---|---|---|
| FR-1.1 | Dexie v6 add `volumes` table，主键 `[projectId+index]` | MUST |
| FR-1.2 | `VolumeRecord` 字段：projectId / index / name / chapterRange{start,end} / themeSummary / status / wordCount / avgScore / ts | MUST |
| FR-1.3 | v5→v6 migration 仅 add table，不改 v1-v5 任何 store | MUST |
| FR-1.4 | dev console 5 步 smoke 验证（同 gap-b PR-1 范例）| MUST |

### FR-2 · N2.1 完成自动写卷表

| # | 描述 | 优先级 |
|---|---|---|
| FR-2.1 | `runStep('novel.2.1')` 完成后调用 `parseVolumePlan` + `upsertVolumes(projectId, volumes)` | MUST |
| FR-2.2 | 解析失败 → fallback 从章节总数 + 平台默认推算单卷（如 100 章 = 3 卷）| SHOULD |
| FR-2.3 | 用户重跑 N2.1 → 重写 volumes 表（删旧 + 写新；保留 status 字段中可保的部分）| MUST |

### FR-3 · Novel.tsx 章节列表按卷分组

| # | 描述 | 优先级 |
|---|---|---|
| FR-3.1 | 章节列表组件 add 卷分组渲染（按 chapterIndex 落入 chapterRange）| MUST |
| FR-3.2 | 每卷可折叠 / 展开（默认全展开）| SHOULD |
| FR-3.3 | 卷标题行显示完成度 + 平均评分 + 总字数 | SHOULD |

### FR-4 · ProgressDashboard 卷级 progress

| # | 描述 | 优先级 |
|---|---|---|
| FR-4.1 | gap-d ProgressDashboard add 卷 chip 行（不动现有 3 个 view）| MUST |
| FR-4.2 | 点击 chip → 章节列表自动滚到该卷 | SHOULD |
| FR-4.3 | 卷 stale 状态显示（任一章节 stale → 卷 stale）| SHOULD |

### FR-5 · 跨卷边界 prevChapterTail（gap-c 集成）

| # | 描述 | 优先级 |
|---|---|---|
| FR-5.1 | rollingContext.ts 增强 formatPrevChapterTail：跨卷时 block 标题加"⚠ 跨卷过渡"标记 | SHOULD |
| FR-5.2 | （可选）跨卷时 prevTailParagraphs 默认增至 5 段（更多过渡空间）| LOW |

---

## 4. Non-Functional Requirements

### NFR-1 · Schema migration 安全

- v5→v6 仅 add table（add-only · 同 gap-b 红线模式）
- 旧用户打开 v6 数据库自动 upgrade 不丢数据
- dev console 5 步 smoke（同 gap-b PR-1 必跑）

### NFR-2 · 性能

- volumes 表读写 < 50ms（< 100 卷场景）
- 章节列表按卷分组渲染 < 16ms（无明显卡顿）

### NFR-3 · 代码量

- **累积 src 增量 ≤ 600**（精确化估算 ~560）
- 单文件 ≤ 250 行
- **0 新 npm 依赖**

### NFR-4 · 红线

- ❌ 不动 v1-v5 schema（gap-b 已定 v5）
- ❌ 不动 N2.1 / N2.2 / N3.x prompt JSON
- ❌ 不动 gap-c rollingContext 主流程（FR-5.1 仅在 formatPrevChapterTail add-only 增强）
- ❌ 不动 gap-d ProgressDashboard 现有 3 个 view（FR-4.1 仅 add 卷 chip 行）
- ❌ 不动 gap-b CharacterBible / characterStates

### NFR-5 · 测试

- 手测优先（沿用 v3 惯例）
- dogfood 验证：至少跑 2 卷项目（≥ 25 章）真实写作 1 周

---

## 5. Out of Scope

| 项 | 原因 |
|---|---|
| 跨卷角色弧线分析 | gap-b CharacterBible 已部分覆盖 |
| 卷间字数 / 节奏自动平衡 | 非必需，留 v4 |
| Volume revision history | 单向门 + 复杂 UI，留 v4 |
| Volume 出版包导出 | gap-e 已有导出，扩展可加 volume 过滤 = 微改动留 v4 |

---

## 6. Phase Plan · PR 草拆

| PR | 范围 | est src |
|:---:|---|:---:|
| **PR-1** | Dexie v6 + volumes 表 + helpers + dev smoke | ~180 |
| **PR-2** | N2.1 完成自动 upsertVolumes + fallback 推算 | ~100 |
| **PR-3** | Novel.tsx 章节列表按卷分组 + 卷标题行 UI | ~150 |
| **PR-4** | ProgressDashboard 卷 chip 行（FR-4）+ 跨卷过渡（FR-5）| ~80 |
| **PR-5** | dogfood-log + erratum（如适用）| ~80 docs |
| **累积** | | **~510 src + 80 docs** |

---

## 7. Open Questions（CA 阶段决议）

1. **Q1**：volumes 表主键 `[projectId+index]` vs UUID？影响 chapter ↔ volume 跨表 ref。
2. **Q2**：N2.1 重跑时 volumes 表清写 vs merge？合并能保 status 但风险数据不一致。
3. **Q3**：章节列表分组组件 = 现有 list 改 vs 新组件？
4. **Q4**：FR-4.1 卷 chip 加在 ProgressDashboard 顶部 vs 子 panel 切换？
5. **Q5**：跨卷过渡（FR-5）的"⚠ 跨卷"判断 = 简单 chapterIndex 范围 vs 显式查 volumes 表？

---

## 8. Risks + Mitigation

| Risk | Severity | Mitigation |
|---|:---:|---|
| **R1**：v5→v6 schema migration bug 破坏现有 dogfood 数据 | 🔴 高 | (a) PR-1 强制 5 步 dev console smoke；(b) 升 v6 前用户 export 全部 artifacts 备份；(c) 仅 add table（不改任何已有 store）|
| **R2**：volumes 与 chapters 数据不同步（重跑 N2.1 后章节越界）| 🟡 中 | (a) 按卷分组渲染容错"未归类章节"区段；(b) PR-3 强制 fallback "无卷分组"模式 |
| **R3**：UI 改动撞 ProgressDashboard / ChapterList | 🟡 中 | (a) FR-4.1 仅 add chip 行不动现有 view；(b) PR-3 章节列表按卷分组前先 grep 现有 selectors |
| **R4**：dogfood 触发条件主观 | 🟢 低 | C-1..C-4 量化阈值 · §1.3 |
| **R5**：累积 src 接近 cap 600 | 🟡 中 | gap-b 经验：实测 +30%，gap-a 估 510 + 30% buffer = 660 仍可接受（参考 gap-b erratum 先例）|

---

## 9. Success Criteria

| 指标 | 度量 |
|---|---|
| **dogfood 通过** | 用户用 ≥ 25 章项目，volumes 表自动写、章节列表按卷分组无 bug、Dashboard 卷 chip 显示正确 |
| **Schema 安全** | v5→v6 migration 5 步 smoke ALL PASS |
| **零回归** | gap-d / gap-b / gap-c 仍工作；现有 N2.1 / N2.2 LLM step 流程 0 改变 |
| **代码量** | 累积 src ≤ 600 / 单文件 ≤ 250 / 0 新 deps |

---

## 10. 决策树（gap-a 启动 Y/N）

```
当前 dogfood 反馈：
  ├─ 章数 ≥ 25 + 跨卷需求 + v3 主线稳定 1 周 → 启动 gap-a CA
  ├─ 章数 < 25 但有强烈"按卷管理"诉求 → 跳到 gap-a CA（视为 C-3 触发）
  ├─ 章数 < 25 且无诉求 → **推 v4**（不写 CA / CK）
  └─ v3 主线 critical bug 未修 → fix bug 优先，gap-a 等
```

---

## 11. References

- product-brief.md §4.5（修订过的 brief 内容）
- novelLoop.ts:35-...（VolumeMeta 已实现 · 复用基础）
- prd-gap-b-character-bible.md（schema 变更红线模式 · gap-a PR-1 直接复用 gap-b PR-1 验证流程）
- prd-gap-c-chapter-transition.md（rollingContext 增强先例 · gap-a FR-5 同模式）
- dogfood-log.md（gap-b/c/d 三 epic 记录 · gap-a PR-5 续写）

---

## Appendix · 与 v3 已交付 epic 关系图

```
v3 dogfood 闭环
  ┌────────────────────────────────────────────────────────────┐
  │ ✅ gap-e 导出（出版闭环）                                      │
  │ ✅ gap-d Progress Dashboard（进度可视化）                       │
  │ ✅ gap-b Character Bible（角色追踪）                           │
  │ ✅ gap-c Chapter Transition（章节衔接）                        │
  │ 🟡 gap-a Multi-Volume（多卷架构）← 本 PRD · 条件触发           │
  └────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       v3 → v4 转点
```

> **本 PRD 写作意图**：当 dogfood 触发条件满足时（≥ 25 章 + 跨卷需求），**5 分钟内**可读完此文档启动 BMAD Stage 2 CA。当前**仅备案**。
