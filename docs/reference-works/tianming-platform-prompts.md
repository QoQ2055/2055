# 参考资料 · 天命网文 AI 创作平台 · 全套提示词库

> **归档日期**：2026-05-06
> **原始来源**：`F:\下载文件\AI技术分享\天命提示词(1).txt`（68 KB / 688 行 / 30 个独立 prompt）
> **原文位置**：`@docs/reference-works/tianming-platform-prompts-original.txt`（已复制全文）
> **性质**：⭐ **重磅资料** — 商业级网文 AI 平台的完整 prompt 工程蓝本，覆盖整条流水线
> **运行时状态**：❌ 不被加载 / ❌ 不立即落地（与 cineforge 体系存在结构性差异，需作为专项任务规划）
> **保留原因**：cineforge 当前体系的**重要补充蓝图**，含多个关键缺口的解决方案

---

## 一、内容总览

| 类别 | Prompt 数 | 提炼到 |
|---|---|---|
| **题材锚点配置（19 题材 × 12 字段）** | 19 | `@docs/internal-notes/genre-anchor-system-spec.md` ⭐⭐⭐ |
| 通用流水线（拆书 / 素材 / 设计 / 创作 / 初稿） | 5 | `@docs/internal-notes/novel-creation-pipeline-spec.md` |
| 润色工具集（场景/对话/情感/精炼/文笔/节奏） | 6 | `@docs/internal-notes/refinement-toolkit-spec.md` |
| 章节一致性校验 | 1 | `@docs/internal-notes/novel-creation-pipeline-spec.md` |

---

## 二、与 fili-web 现有体系的对照

| 天命模块 | cineforge 现状 | gap 严重度 |
|---|---|---|
| 拆书分析师（含结构锚点位置：黄金章/10%/50%/80%/结尾） | ❌ | ⭐⭐ |
| 素材设计师 | ⚠ 部分通过 KB doc | ⭐ |
| **小说设计师 5 子模块**（世界观/角色/势力/位置/剧情规则） | ⚠ `world-building-9-pillars` / `systems-analysis-six` 部分覆盖 | ⭐⭐ |
| **小说创作者 4 层**（战略大纲/分卷/章节/蓝图） | ⚠ `webfiction-pacing-pack` 部分覆盖 | ⭐⭐ |
| 小说初稿生成器（7 条硬约束） | ✅ 主流程 | — |
| **6 大润色 prompts** | ⚠ `anti-ai-flavor` 等覆盖部分 | ⭐⭐ |
| 章节一致性校验 | ⚠ ChapterFeedback 有点关联 | ⭐ |
| 🔴 **19 题材锚点系统** | ❌ **完全没有** | **⭐⭐⭐ 关键缺口** |

## 三、核心创新点提炼

### 3.1 题材锚点系统（cineforge 最大缺口）

cineforge 24 个方法模块**主要是叙事结构**（Save the Cat / Truby 22 / 雪花法），**不是题材风格规范**。天命的 19 题材锚点提供了"**写什么**"的答案，与现有"**怎么写**"形成双轴。

每个题材含 12 个标准化字段，最关键的两套硬约束：
- **必须包含** 5-6 项（题材必备爽点）
- **必须避免** 6-7 项（题材污染清单：如"修仙不允许混入科技"）

### 3.2 "人称运用"细粒度文法

每个题材独立设计：连续 3 句"我"开头需切换 / 多人场景必须用姓名 / 等。这是 cineforge 当前完全没有的文法层约束。

### 3.3 结构锚点位置（拆书）

把拆书任务按位置分层：黄金章 1-3 / 开篇 10% / 中段 50% / 高潮 80% / 结尾。工业化的拆书方法论。

### 3.4 4 层规划体系

战略大纲 → 分卷设计 → 章节规划 → 章节蓝图。每层有明确的**字段规范**和**回扣关系**（蓝图回扣章节，章节回扣分卷，分卷回扣大纲）。

### 3.5 5 子模块语义边界

世界观规则 / 角色规则 / 势力规则 / 位置规则 / 剧情规则 — 每个模块有明确的语义边界声明（"势力规则 ≠ 百科介绍" / "位置规则 ≠ 地理观光"等）。

### 3.6 字段长度精细控制

- 标签字段 1-12 字
- 一句话摘要 20-50 字
- 一般说明 40-120 字
- 描述性字段 80-160 字
- 结构/机制类 120-260 字

这种细粒度长度规范在 cineforge 当前完全没有。

---

## 四、关键观察 · 思想印证

天命的多处设计**印证了 cineforge 现有方向的正确性**：

| 天命做法 | cineforge 印证 |
|---|---|
| "禁止段落复读" / "禁止原地打转" / "禁止情节重置" | 与 `anti-ai-flavor` "反 AI 文风" 思想一致 |
| 角色姓名定义 + 引用规范 | 与 `plot-coherence-scaffold` 章节连续性思想一致 |
| 6 大润色分层 | 印证 `anti-ai-flavor` 应作为多层润色之一，而非唯一 |
| 字段必须服务长期主线，非一次性桥段 | 与 `truby-22-steps` / `harmon-story-circle` 等结构模块的"长期弧线"思想一致 |

---

## 五、未直接采纳的部分

| 内容 | 不直接采纳原因 |
|---|---|
| 具体 prompt 文本 | cineforge 流水线节点结构与天命不同，prompt 需重写而非套用 |
| 字段命名（如 `coreEvents` / `volumeEndHook`） | 应与 cineforge 现有 `pipeline/types.ts` 命名规范统一 |
| 19 个题材 prompt 的开头（"你是一位专业的 XX 写作助手"） | 与 cineforge 角色化 system prompt 设计原则可借鉴但不直接复用 |
| 章节一致性校验的 JSON 格式 | 待与 cineforge 现有 `ChapterFeedback` 数据结构整合 |

---

## 六、引用源

- 原文：`@docs/reference-works/tianming-platform-prompts-original.txt`
- 提炼手册（核心产出）：
  - ⭐⭐⭐ `@docs/internal-notes/genre-anchor-system-spec.md`（题材锚点系统蓝图）
  - `@docs/internal-notes/novel-creation-pipeline-spec.md`（流水线规范）
  - `@docs/internal-notes/refinement-toolkit-spec.md`（润色工具集）
- 关联：
  - `@docs/internal-notes/deepseek-v4-tuning-guide.md`（V4 调优）
  - `@docs/internal-notes/storyboard-template-spec.md`（分镜导出）
