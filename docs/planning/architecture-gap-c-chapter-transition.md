---
project: fili-web
epic: gap-c-chapter-transition
stage: BMAD Stage 2 · CA (Architecture)
prerequisite: prd-gap-c-chapter-transition.md
date: 2026-05-07
status: draft · 5 Open Q 决议
---

# CA · gap-c · 章节衔接自然过渡 · 架构与决议

> 本文档**只写架构、决议、PR DoD**。不重复 PRD 的 user stories / FR。
> 5 Open Q 全部基于代码实测决议（非推测）。

---

## 0. 架构总览（一图概念）

```
N3.1 章节草稿循环（novelLoop.ts · 已存在 · 不动）
       │
       │ 调用 buildRollingContext({ chapters, currentIndex, ... })
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ rollingContext.ts （PR-1 增强 · add-only）                          │
│   • 远距区五段摘要（L130-150 · 不改）                                 │
│   • 近距区原文 5 章（L176-177 · 不改）                                │
│   • ★ 上一章末尾 N 段（PR-1 新增 block · 注入 L177 之后 / L181 之前）│
└──────────────────────────────────────────────────────────────────┘
       │
       │ rolling 字符串 → userOverride 注入 N3.1 prompt 的 {{ rollingContext }}
       ▼
LLM 生成本章草稿 → 落入 artifacts['novel.6'].meta.chapterContents[N]
       │
       ▼
ScoreCard 评分（chapterScoreCardSlot.tsx · 已存在 · 自动遍历 SCORE_DIMENSIONS）
       │
       │ 加 transition 维度（PR-2 · scoreCard.ts add-only）
       ▼
┌──────────────────────────────────────────────────────────────────┐
│ scoreCard.ts （PR-2）                                             │
│   • SCORE_DIMENSIONS 数组 add 'transition'                        │
│   • computeTransitionScore(chapter, prevChapter) · 新 LLM 函数     │
│   • Settings.scoreCardWeights add 'transition' 默认 1.0          │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
UI 自动渲染（ScoreCardBadge.tsx L271 / Settings.tsx L212 已遍历 SCORE_DIMENSIONS）
       │
       ▼
ChapterScoreCardSlot 章节卡：< 70 时第 7 维 cell 橙色 + tooltip
```

---

## 1. 5 Open Question 决议（**Source of Truth**）

### Q1 · `prevTailParagraphs` 默认值？

**决议**：**默认 3 段**。

**理由**：
- 3 段 ≈ 200-500 中文字 · 足够 LLM 识别"末尾画面 / 情绪 / 留白"
- 上限 800 字硬截断（PRD FR-1.4）保护 token
- DeepSeek 实测：上下文 < 1000 token 时聚焦最强；> 2000 token 时易分散

**配置面**：`buildRollingContext({ prevTailParagraphs?: number })`，0 = 关闭注入。

---

### Q2 · 注入路径选择？

**决议**：**rollingContext.ts 增强（不写 wrapper · 不动 N3.1 prompt JSON）**。

**实测注入点**：

```@C:/Users/QvQ/CascadeProjects/fili-web/src/pipeline/rollingContext.ts:174-181
out.push('');
out.push(`## 近距区 · 最近 ${recent.length} 章原文`);
out.push(recentParts.join('\n').trim());
// ★ PR-1 新增 block 在此处插入 ★
return {
  rolling: out.join('\n').trim(),
  condensed: false,
};
```

**Block 格式**（PR-1 输出标准）：

```
## 上一章（第 4 章 · "夜色"）末尾 3 段【⚠ 本章开头需自然衔接】

[最后第 3 段]

[最后第 2 段]

[最后 1 段]

> 衔接提示：开头宜自然承接上述末尾画面 / 情绪 / 时空，避免硬切。
```

**不选 alt 路径的理由**：

| Alt 路径 | 否决理由 |
|---|---|
| 包装层（新建 `injectTransitionFocus.ts` 包 buildRollingContext）| 增加调用栈深度 + 多个 Novel.tsx 调用点都要替换 |
| 升级 N3.1 prompt JSON 加新 section | **撞 PRD NFR-4 红线**（不动 prompt JSON）|
| compose.ts 改 | compose.ts 仅做消息组装，不知道 chapterIndex / 上一章原文，要改的话需扩接口 → 比 rollingContext 内增改面更大 |

---

### Q3 · 第 7 维 LLM 评分 prompt 位置？

**决议**：**inline 在 scoreCard.ts**（不独立 prompt JSON 文件）。

**实测先例**：scoreCard.ts 现有 `r1Align` 与 `userKbStyle` 两维度均 inline prompt 模板（不在 `public/prompts/`）。

**Inline prompt 草稿**（PR-2 落地，~30 行）：

```ts
const TRANSITION_PROMPT = (prevTail: string, currentOpening: string) => `
你是网络小说衔接评审师。请评估"本章开头"与"上一章末尾"的衔接顺畅度。

## 上一章末尾（最后 200-300 字）
${prevTail.slice(-300)}

## 本章开头（前 200-300 字）
${currentOpening.slice(0, 300)}

## 评分维度
- 时空衔接：地点 / 时间过渡是否自然
- 情绪衔接：人物情绪是否合理延续
- 视点衔接：POV 切换是否流畅
- 节奏衔接：开头节奏是否承上启下

## 输出格式（严格 JSON · 无 markdown）
{ "score": 0-100, "reason": "一句话评价（≤ 30 字）" }

≥ 80 = 自然 / 60-80 = 可改 / < 60 = 硬切
`;
```

**否决独立 JSON**：增加 manifest 复杂度（loadManifest）+ runner 路径开销 vs 收益不成正比；inline 维度自包含 + 易调试。

---

### Q4 · ScoreCard UI 渲染机制？

**决议**：**0 改动**（UI 已自动遍历 SCORE_DIMENSIONS）。

**实测证据**：

```@C:/Users/QvQ/CascadeProjects/fili-web/src/components/ScoreCardBadge.tsx:271
{SCORE_DIMENSIONS.map((d) => (
```

```@C:/Users/QvQ/CascadeProjects/fili-web/src/components/ScoreCardBadge.tsx:291
{SCORE_DIMENSIONS.map((d) => (
```

```@C:/Users/QvQ/CascadeProjects/fili-web/src/pages/Settings.tsx:212
function ScoreCardWeightSliders() {
```

→ PR-2 加 `'transition'` 进 `SCORE_DIMENSIONS` 数组，**章节评分 UI + Settings 权重 slider 自动出现**。

**唯一 UI 改动**（PR-3）：维度元数据补全（中文标签 + 描述 tooltip），位置 `ScoreCardBadge.tsx` `LABEL_OF` / `DESC_OF` 字典 add-only（每个 ~5 行）。

---

### Q5 · N3.6/N3.7 polish 流是否同步增强？

**决议**：**不做**（自然解决）。

**实测**：仅 `3.1.json` 含 `{{ rollingContext }}` · `3.2.json` 不用 · 整个 N3.x 唯有章节草稿用 rollingContext。

**含义**：
- N3.1 草稿生成 → rollingContext 增强直接生效（PR-1）
- N3.7 章节润色循环 → 不通过 rollingContext，由 ScoreCard 第 7 维**事后**评估衔接质量（PR-2）
- 评分 < 70 → 章节卡橙色徽章提示用户**手动**调整开头（人在回路）

→ 自动改写润色阶段开头是 OUT（PRD §5）· gap-c 实施面无需碰 polish 流。

---

## 2. 红线 final-list（CK §2 收紧）

| # | 红线 | grep guard |
|:---:|---|---|
| **R1** | N1.x / N2.x / N3.x prompt JSON 字符串不变 | `git diff HEAD -- public/prompts/novel/*.json \| Measure-Object -Line` 期 0 |
| **R2** | rollingContext.ts **核心算法**不变（buildRollingContext 主流程 / condenseFiveSegment / cache 逻辑）| 仅在 L177 与 L181 之间追加 block；`buildRollingContext` 接口仅 add `prevTailParagraphs?` 可选参 · 0 删除 |
| **R3** | ScoreCard 现有 6 维实现不变（genre / method / kbRedline / craft / r1Align / userKbStyle 任一计算函数 0 字符变化）| 6 维各自函数体 git diff 须为 0 |
| **R4** | gap-d / gap-b / gap-e 资产不变 | `git diff HEAD -- src/store/projectAggregates.ts src/components/dashboard/ src/store/characterStates.ts src/components/CharacterBible.tsx src/components/character/ src/store/characterBible.ts public/prompts/novel/8.json src/pipeline/characterStates.ts` 期 0 |
| **R5** | `consistencyCheck.ts` 不动 | `git diff HEAD -- src/pipeline/consistencyCheck.ts` 期 0 |

---

## 3. 不变量（CK §3）

| ID | Invariant | 验证 |
|:---:|---|---|
| **I-1** | rollingContext.ts 不调 LLM（**新增 block 是纯字符串拼接**）| `git diff HEAD -- src/pipeline/rollingContext.ts` 不引入 `chatStream` 新调用（现有 condenseFiveSegment 调用是 6 维相关 · 不算违规）|
| **I-2** | 第 7 维 prompt 不读 zustand（与 `r1Align`/`userKbStyle` 同纯函数模式）| computeTransitionScore 形参只接 `prevTail / currentOpening / settings`，不 import store |
| **I-3** | 第 1 章特殊处理：score = null + reason | dev console 跑 currentIndex=1 → 返回 null |
| **I-4** | 0 新 localStorage key | grep `flil:` 新文件 hits 须复用现有 settings key |
| **I-5** | SCORE_DIMENSIONS 仅 add | grep `'genre','method','kbRedline','craft','r1Align','userKbStyle'` 6 个字面量字符 0 字符变化 |
| **I-6** | scoreCardWeights 默认 1.0 等权 · transition 缺省时不破坏 6 维计算 | useScoreCardController.ts L58 `?? {}` 行为保持 |
| **I-7** | 0 新 npm 依赖 | `git diff HEAD -- package.json package-lock.json` 期 0 |

---

## 4. PR 拆分 final（**Source of Truth**）

| PR | 范围 | est src | DoD |
|:---:|---|:---:|---|
| **PR-1** | rollingContext.ts add prevTailParagraphs option + tail-block 注入 + dev smoke | ~70 | (1) `buildRollingContext({ prevTailParagraphs: 3 })` 输出含 ★ block; (2) ch1 → 不出 block; (3) 段截断 800 字 cap; (4) 接口仅 add 可选参 0 删除; (5) vite build 0 errors |
| **PR-2** | scoreCard.ts add 'transition' dim + computeTransitionScore (LLM inline prompt) + 调用接入 | ~120 | (1) SCORE_DIMENSIONS 加 1 项; (2) ch1 score=null; (3) JSON 解析失败 → score=null + reason; (4) ScoreCardBadge / Settings UI 第 7 维自动出现; (5) 6 维计算 0 回归 |
| **PR-3** | settings.ts add `enableTransitionScoring` + ScoreCardBadge LABEL_OF/DESC_OF 补全 + ChapterScoreCardSlot 橙色徽章联动 | ~50 | (1) settings 默认 true; (2) UI 中文标签"衔接顺畅度"; (3) 章节卡 < 70 显示橙色; (4) 关闭 setting → 第 7 维隐藏 |
| **PR-4** | dogfood-log gap-c 节追加 + erratum（如适用）| ~80 docs · 0 src | dogfood-log.md 顶部追加 gap-c 节（PR-by-PR 表 + 累积 ledger + 5 Q 决议落实点）|
| **累计 src** | | **~240** | （cap 350，安全边距 110）|

---

## 5. 实施细节锚点

### 5.1 PR-1 · rollingContext.ts 改动定位

**文件**：`src/pipeline/rollingContext.ts`（279 行 · 主流程不动）

**接口签名**：`RollingContextOptions` add 一字段：

```ts
/** 在近距区原文之后追加"上一章末尾 N 段"显式标注 block。
 *  默认 3。0 = 不注入；> 0 = 注入；遇到 currentIndex === 1（无上一章）自动跳过。 */
prevTailParagraphs?: number;
```

**新增内部函数**（同文件末尾，~50 行）：

```ts
function formatPrevChapterTail(
  prevChapter: ChapterRecord | undefined,
  paragraphs: number,
  maxChars: number,
): string;
```

**注入位点**：`buildRollingContext` body L177 之后, L181 之前 push 一个新 block。

### 5.2 PR-2 · scoreCard.ts 改动定位

**文件**：`src/pipeline/scoreCard.ts`

**位点 1**（L24-30 类型 add-only）：

```ts
export type ScoreDimension =
  | 'genre' | 'method' | 'kbRedline' | 'craft'
  | 'r1Align' | 'userKbStyle'
  | 'transition'; // ★ PR-2
```

**位点 2**（L32 数组 add）：

```ts
export const SCORE_DIMENSIONS: ScoreDimension[] = [
  'genre', 'method', 'kbRedline', 'craft', 'r1Align', 'userKbStyle',
  'transition', // ★ PR-2
];
```

**位点 3**（同文件 ~120 行新增）：computeTransitionScore + dispatcher 接入。

### 5.3 PR-3 · UI 元数据 + Settings

**位点 1** · `ScoreCardBadge.tsx` LABEL_OF / DESC_OF 字典：add `transition: '衔接顺畅度'` + 描述。

**位点 2** · `settings.ts` 默认值：`enableTransitionScoring: true`。

**位点 3** · `ChapterScoreCardSlot.tsx`：复用现有"低分橙色徽章"机制（gap-d hasIssue 模式参考）。

---

## 6. 估算 vs Cap

| 指标 | 实测/估算 | Cap |
|---|:---:|:---:|
| 累积 src 行 | **~240** | 350 (NFR-3) |
| 单文件 ≤ | rollingContext.ts +70 / scoreCard.ts +120 | 250 ✅ |
| PR 数 | 4 | — |
| 新依赖 | **0** | 0 ✅ |
| 新 LLM step | **0**（复用现有 chatStream 调用模式）| — |
| Schema 变更 | **0** | 0 ✅ |
| Prompt JSON 变更 | **0** | 0 ✅ |

**对比 gap-b**（916 / 700 cap = +30.9%）vs **gap-c 估**（240 / 350 cap = -31.4%）→ 风险预算大幅充裕。

---

## 7. CK Stage 输入清单

CK 阶段需机械化的内容（CA 已结构化）：

- 5 红线 · grep 命令（§2）
- 7 不变量 · grep 命令（§3）
- 4 PR DoD（§4）
- 累积 ledger 公式（§6）
- erratum 触发线：cap 350 / 接受线 420 / 回退线 455（按 gap-d / gap-b 同公式 +20% / +30%）

---

## 8. CA 完成 · 5 Q 全决议

| Q | 决议 | 文档锚点 |
|:---:|---|---|
| Q1 | prevTailParagraphs 默认 3，0-800 char cap | §1 Q1 |
| Q2 | rollingContext.ts 内增强（不动 prompt JSON）| §1 Q2 / §5.1 |
| Q3 | LLM 评分 inline 在 scoreCard.ts | §1 Q3 |
| Q4 | UI 0 改动（自动渲染 SCORE_DIMENSIONS）| §1 Q4 / §5.3 |
| Q5 | 不同步 N3.7 polish（自然解决）| §1 Q5 |

→ 进 BMAD Stage 2.3 CK。
