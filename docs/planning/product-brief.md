---
project: CineForge Web
stage: v3 (planning)
author: QvQ
date: 2026-05-06
audience: self + AI 协作者 (Cascade / Claude / Cursor / Copilot)
status: finalized
workflow: BMAD-METHOD · CB (bmad-product-brief) · 5 steps complete
related:
  - DESIGN.md v0.2.0-alpha (设计合约 · 已落地)
  - AGENTS.md (协作者导航 · 阶段 2.10)
  - CHANGELOG.md (Unreleased / 阶段 2.x · 11 阶段累积)
---

# CineForge Web · v3 Product Brief

## 1. One-line 定位（修正 README 的过时版）

CineForge 是 **单人创作者 + AI 协作的工作台**，承载 4 种创作模式：

- ✅ **短剧/剧本**（八步剧本→资产→分镜，dogfood 闭环已验证）
- 🚧 **小说**（v2 已成型 1867 行 / v3 收口）
- ✓ **改编**（六步原作→剧本派生）
- ✓ **特殊·分镜**（直接给简介出分镜）

底层基建（11 阶段累积）：题材锚点 / 方法论模块 / KB 三层注入 /
诊断-修改闭环 / 6 维评分卡 / token-driven 设计系统。

## 2. Problem · 我们解决什么

**v3 核心问题**：小说工作台代码已成型（1867 行），但 5 个具体缺口
让"完整跑通一部小说"卡在某个节点，每次都被迫退回手工 / 外部工具。

短剧线已经 dogfood 闭环过 ✓ —— v3 不是再加新模式，而是**把小说线
追平到同样的"能完整跑通一部作品"状态**。

## 3. Target User

| 谁 | 怎么用 |
|---|---|
| **未来的我（QvQ）** | 真正用工具写完一部 ≥ 10 章 / ≥ 5 万字小说 |
| **AI 协作者** | 读 README + AGENTS.md + DESIGN.md 30 秒上手；做缺口实现时按 surgical changes 推进 |

**不是用户**：第三方 SaaS 用户、收费客户、多人协作场景。
所有"市场信号"是推断而非证据；v3 仍是 for-self + AI-collaborator 项目。

## 4. Solution · v3 Scope（按价值密度排序）

### 4.0 · README 重写（**先做**，0.5 天）

把 `M0-M6` 路线图换成 `v2.0-2.10 已交付 + v3 计划`。给 brief 一致性
+ 做 4 个缺口时可互相引用。**杠杆点**：用 `/init` 工作流生成。

### 4.1 · 缺口 e · 导出（1 周 · 阻塞闭环出口）

- 小说: `.md` (单文件按章拼接) / `.docx` (用 docx.js 或简单 HTML→Word)
- 剧本: `.fdx` (Final Draft) / `.fountain` 业界标准
- 资产: 当前已有 .json，再加 .csv 平面表
- **接入点**: Home 页项目卡 + Novel/Screenplay 顶部 toolbar 加 `<Button>导出</Button>` 抽屉

### 4.2 · 缺口 d · 进度可视化（1 周 · 激励层）

- Novel 页加 ProgressDashboard 面板：章节完成度 grid / 字数曲线 /
  评分卡热力图（接 Phase 2.9 ScoreCard 历史栈）
- 不动业务逻辑，纯 view 组件 + dexie aggregate query

### 4.3 · 缺口 b · 角色 bible 跨章节追踪（2-3 周 · 长篇必需）

- 新增 dexie 表 `characterStates` (chapter × character → 状态快照)
- LLM step：每章生成后追加"角色状态变化"提取 prompt
- UI: Novel 页加 CharacterBible 面板，时间线视图

### 4.4 · 缺口 c · 章节衔接自然过渡（2 周 · 提质）

- 当前 chapter loop 只看自己章节，不看上一章末尾
- 改 compose.ts 给 chapter prompt 注入 `prevChapterTail` (最后 N 段)
- ScoreCard 加"衔接顺畅度"维度（v2.9 6 维 → v3 7 维）

### 4.5 · 缺口 a · 多卷 / 多季架构（4 周 · 长篇 ≥ 30 章必需，**最后做且条件触发**）

- dexie schema v4 → v5：projects 加 `volumes: { id, name, chapterRange }`
- Novel 页大纲层级：volume → chapter
- **慎做**：90% 的 v3 dogfood 大概率是 10-20 章中篇，多卷不阻塞最早闭环
- **触发条件**：Week 7 之前 dogfood 实际碰到"≥ 30 章 / 多季节奏"才做；否则推到 v4

## 5. Success Criteria（v3 何时结束）

| 指标 | 度量 |
|---|---|
| **小说线 dogfood 闭环** | QvQ 用工具完整产出 ≥ 10 章 / ≥ 5 万字小说，全程不退回手工或外部工具 |
| **README 时效性** | 阅读 README 后 30 秒内能说出当前 4 种模式 + 主要功能 |
| **5 缺口收口** | 缺口 e/d/b/c 完成；缺口 a 完成或明确推到 v4（如 dogfood 时未触发多卷需求） |
| **底层基建零回退** | DESIGN.md / ScoreCard / 评分系统 / 诊断闭环不被本次开发污染 |

## 6. Out of Scope（v3 明确不做）

| 项 | 理由 |
|---|---|
| 漫画分镜 / 播客 / 公众号新模式 | 当前 4 模式还没全收口，先把小说做完 |
| 部署上线 / SaaS 化 / 收费 | 项目定位是 for-self，多用户改造代价过大 |
| AI Agent 化（对话式创作伴侣） | v4+ 议题；v3 仍走 manifest-driven pipeline |
| 实时协作 / 多人编辑 | 同 SaaS 化 |
| 移动端 / 触屏适配 | 当前 1280px desktop-first，v3 不动 |

## 7. Risk Register

| 风险 | 缓解 |
|---|---|
| 5 缺口同时做 → 拖到 v4 | 严格按 e→d→b→c→a 顺序，每完成一个 commit + dogfood 一次 |
| 缺口 a (多卷) dexie schema 升级 | 单独写 architecture decision record，不与功能开发同步推进 |
| DESIGN.md V0.3+ 演进干扰功能开发 | v3 功能期内 DESIGN.md 冻结在 V0.2.0-alpha；V0.3 推到 v3 后 |
| dogfood 失败 = 工具仍在"理论可用"状态 | v3 完成态硬绑定到 ≥ 10 章 / ≥ 5 万字真实产出，无书无 v3 完结 |
| README 修了但 AI 协作者读时忽略 | AGENTS.md 已嵌入"读 DESIGN.md"硬约束；README 模仿同样硬约束句式 |

## 8. v3 路线图（粗）

```
Week 0     · 落 product-brief (本文档)
Week 0.5   · README 重写
Week 1     · 缺口 e · 导出
Week 2     · 缺口 d · 进度可视化
Week 3-5   · 缺口 b · 角色 bible
Week 6-7   · 缺口 c · 章节衔接
Week 8-11  · 缺口 a · 多卷架构（如 dogfood 触发需求；否则推 v4）
Week ?     · v3 dogfood: 写完一部 ≥ 10 章小说 → 收 v3
```

## 9. 下一步（按 BMAD）

1. ✅ **本文档 finalize 落盘** → `docs/planning/product-brief.md`
2. **新对话** 跑 BMAD `CP` (create-prd) → 选 1-2 个缺口出详细 PRD
3. README 重写（独立小动作，不需 PRD；可单独 quick-dev）
4. 缺口实现按 PRD 走，每完成一个用 BMAD `QQ` (quick-dev) 模式

---
*生成于 BMAD-METHOD · CB workflow · 5 step 全过 · v0.1 finalized · 2026-05-06*
