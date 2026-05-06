---
project: fili-web
epic: gap-d-progress-dashboard
stage: BMAD Stage 2 · CA (Component Architecture)
author: QvQ + Cascade
date: 2026-05-06
status: draft
related:
  - prd-gap-d-progress-dashboard.md (上游需求)
  - architecture-gap-e-export.md (CA 风格参考)
  - product-brief.md §4.2
---

# Architecture · v3 缺口 d · 进度可视化（Progress Dashboard）

---

## §0 架构上下文

### 0.1 与 PRD 的边界

| 来源 | 给定 | 留给 CA |
|---|---|---|
| PRD §3 FR-1..6 | 6 类功能需求 | 拆分到具体 5 文件 + 函数签名 |
| PRD §4 NFR-1..5 | 性能 / 视觉 / 行数 / 红线 / 测试 | 检验机制（red-line grep + 累积 行数 ledger）|
| PRD §9 Q1-Q4 | 4 个 Open Question | **本 CA §4 给出最终决议** |
| PRD §8 PR-1..4 | 4 个 PR 草拆 | §5 详表 + 各 PR cap + 顺序 |

### 0.2 4 条红线（继承自 PRD §4 NFR-4）

> **机械验证 grep**（`/dogfood-check` 已封装）：

```
红线 #1 · Dexie schema       git diff main...HEAD -- src/store/db.ts | grep -E '^[+-].*version\(|stores\(' → 期望 0 hits
红线 #2 · scoreCard.ts       git diff main...HEAD -- src/pipeline/scoreCard.ts → 期望 empty
红线 #3 · pipeline 无改动    git diff main...HEAD -- 'src/pipeline/*' | grep -v 'test' → 期望 empty
红线 #4 · 仅 Novel 页接入    git diff main...HEAD -- 'src/pages/{Home,Screenplay,Original}.tsx' → 期望 empty
```

**红线触碰 = PR 拒绝合入。** 由 `/dogfood-check` workflow 自动检测。

### 0.3 技术栈（**全部已有，0 新依赖**）

| 层 | 选型 | 来源 |
|---|---|---|
| UI 渲染 | React + Tailwind + clsx | 项目现有 |
| 图表 | **手撸 SVG**（path / rect / circle） | 与 `ScoreCardBadge.tsx` 一致风格 |
| 状态 | zustand | 现有 6 个 store |
| 持久化 | localStorage | 现有 settings.ts pattern |
| 数据 | Dexie 聚合查询（**read-only**）| 现有 `db.ts` v4 |
| 类型 | TypeScript strict | 项目通用 |

**禁止引入**：recharts / d3 / chart.js / canvas / html2canvas / 任何 chart 库。

### 0.4 现状代码资产盘点（CA 复用清单）

| 资产 | 行数 | 用途 |
|---|:---:|---|
| `src/pipeline/scoreCard.ts` | 511 | scoreCardHistory 数组源 (`MAX_HISTORY = 5`) |
| `src/components/ScoreCardBadge.tsx` | 280 | **复用 detail 弹窗**（FR-4.6） |
| `src/components/ChapterScoreCardSlot.tsx` | 114 | 挂载点参考 |
| `src/store/project.ts` | 247 | 项目 / 章节读取 API |
| `src/store/settings.ts` | 72 | zustand + localStorage 范式参考 |
| `src/pages/Novel.tsx` | 1867 | N3 阶段接入点（L677-697 N3.1 区域附近）|

### 0.5 Open Questions 一行答案

| Q | 答案（详见 §4） |
|---|---|
| Q1 位置 | **顶部 collapsible**（默认折叠 48px / 展开 ≤ 600px）|
| Q2 完成度判定 | **chapter.body 字数 ≥ 1000 = 完成 / > 0 = 进行中 / = 0 = 未开始**（manifest 状态做次级辅助）|
| Q3 热力图维度 | **自适应行高 + 列向滚动**（≥ 30 章节启用）|
| Q4 i18n | **中文硬编码**（与现有页面一致）|

---

## §1 模块拓扑

### 1.1 文件白名单（NFR-3 cap ≤ 350 行 累积 / 单文件 ≤ 200 行）

| # | 文件 | 类型 | 估行数 | PR |
|:---:|---|:---:|:---:|:---:|
| 1 | `src/store/projectAggregates.ts` | A 新增 | ~110 | PR-1 |
| 2 | `src/components/dashboard/ChapterCompletionGrid.tsx` | A 新增 | ~70 | PR-2 |
| 3 | `src/components/dashboard/WordCountTrend.tsx` | A 新增 | ~80 | PR-2 |
| 4 | `src/components/dashboard/ScoreHeatmap.tsx` | A 新增 | ~90 | PR-2 |
| 5 | `src/components/ProgressDashboard.tsx` | A 新增 | ~80 | PR-3 |
| 6 | `src/store/dashboard.ts` | A 新增 | ~40 | PR-3 |
| 7 | `src/pages/Novel.tsx` | M 修改 | +6 / -0 | PR-3 |
| | **累积** | | **~476** | |

⚠ **超 PRD NFR-3 cap (350) 累积估算**：实际编码可能精简 25-30%（参考 gap-e CA 估 vs 实际偏差）。**不作 erratum 提前申报**，等 PR-3 合入后看实测决定是否需要 erratum。

### 1.2 模块依赖图

```
src/pages/Novel.tsx  (M)
    ↓ 引用
src/components/ProgressDashboard.tsx  (A)
    ↓ 引用
    ├→ src/store/dashboard.ts             (A · zustand store)
    ├→ src/store/projectAggregates.ts     (A · dexie helper)
    └→ src/components/dashboard/
        ├→ ChapterCompletionGrid.tsx      (A · 纯 view)
        ├→ WordCountTrend.tsx             (A · 纯 view)
        └→ ScoreHeatmap.tsx               (A · 纯 view)
                ↓ 复用（不修改）
            src/components/ScoreCardBadge.tsx  (R)
```

`R` = read-only 复用 / `A` = add 新增 / `M` = modify 修改。

### 1.3 公开 API 表面

#### `src/store/projectAggregates.ts`

```ts
export interface ProjectAggregates {
  projectId: string;
  totalChapters: number;
  completedChapters: number;       // body.length >= 1000
  inProgressChapters: number;      // 0 < body.length < 1000
  notStartedChapters: number;      // body.length === 0
  chapters: ChapterAggregate[];    // 按 chapterIndex 升序
  scoreCardMatrix: ScoreCardMatrix | null;  // null = 无评分历史
  wordCountStats: { mean: number; median: number; min: number; max: number };
}

export interface ChapterAggregate {
  chapterId: string;
  chapterIndex: number;
  title: string;
  wordCount: number;
  status: 'completed' | 'in-progress' | 'not-started';
  scoreCardAvg: number | null;     // 6+ 维度均分 / null = 无评分
  scoreCardIssueCount: number;     // issue 数 / 0 = 健康
  isOutlier: boolean;              // 字数 < 50% 均值 或 > 200% 均值
}

export interface ScoreCardMatrix {
  dimensions: string[];                       // ['动机一致性', '对话自然度', ...]
  values: (number | null)[][];                // [chapter][dimension] · null = 该章节无该维度
  issueLists: (string[] | null)[][];          // hover 详情用
}

export async function getProjectAggregates(projectId: string): Promise<ProjectAggregates>;
```

#### `src/store/dashboard.ts`

```ts
interface DashboardState {
  collapsedByProject: Record<string, boolean>;   // localStorage 持久化
  layoutByProject: Record<string, 'vertical' | 'horizontal'>;
  selectedChapterId: string | null;              // 跨 project 共享当前选中
}

interface DashboardActions {
  toggleCollapse(projectId: string): void;
  setLayout(projectId: string, layout: 'vertical' | 'horizontal'): void;
  selectChapter(chapterId: string | null): void;
}

export const useDashboard = create<DashboardState & DashboardActions>()(...);
```

localStorage key：`flil:dashboard:state` (整体 state, 单 key, 与 settings.ts 风格一致)

#### `src/components/dashboard/<X>.tsx`（3 子组件统一形态）

```ts
// ChapterCompletionGrid
interface ChapterCompletionGridProps {
  chapters: ChapterAggregate[];
  selectedChapterId: string | null;
  onSelectChapter(id: string): void;
}

// WordCountTrend
interface WordCountTrendProps {
  chapters: ChapterAggregate[];
  meanWordCount: number;
  targetWordCount?: number;        // 可选 · 来自 settings
  onSelectChapter(id: string): void;
}

// ScoreHeatmap
interface ScoreHeatmapProps {
  matrix: ScoreCardMatrix;
  chapters: ChapterAggregate[];    // 需要 chapter title 给 hover
  onCellClick(chapterId: string, dimensionIdx: number): void;
}
```

#### `src/components/ProgressDashboard.tsx`

```ts
export interface ProgressDashboardProps {
  projectId: string;
}

export function ProgressDashboard(props: ProgressDashboardProps): JSX.Element;
```

容器内部用 useMemo + `getProjectAggregates(projectId)` 获取数据，传 props 给 3 子组件。

### 1.4 数据流概要（详见 §2）

```
[Novel.tsx N3 区]
    └→ <ProgressDashboard projectId={...} />
        ↓ on mount + on projectId change
        getProjectAggregates(projectId)         // dexie aggregate
        ↓ 返回 ProjectAggregates
        ├→ <ChapterCompletionGrid chapters={...} />
        ├→ <WordCountTrend chapters={...} mean={...} />
        └→ <ScoreHeatmap matrix={...} chapters={...} />

[ScoreHeatmap onCellClick]
    └→ openScoreCardBadge(chapterId)            // 复用现有弹窗机制
```

---

## §2 数据流详细设计

### 2.1 Dashboard 首次加载时序

```
1. Novel.tsx 渲染 N3 阶段时
2. 判断当前 projectId 存在 → mount <ProgressDashboard projectId={current} />
3. ProgressDashboard 内 useEffect:
   3.1  setIsLoading(true)
   3.2  await getProjectAggregates(projectId)
   3.3  setData(aggregates) + setIsLoading(false)
4. zustand `useDashboard` 同步读取 collapsed/layout state
5. 渲染：
   - 折叠态 → 仅 toolbar + 一句话摘要
   - 展开态 → 3 子组件按 layout 排版
```

NFR-1 要求 ≤ 200ms 首次渲染：`getProjectAggregates` 必须 ≤ 100ms（详见 §3.1）。

### 2.2 用户折叠 / 展开 时序

```
点击 toolbar 折叠按钮
    ↓
useDashboard.toggleCollapse(projectId)
    ↓
zustand state 更新 + 触发 localStorage 写入（debounce 200ms）
    ↓
ProgressDashboard 根据新 state 重渲染（CSS transition 200ms）
```

### 2.3 章节选中时序（grid / trend / heatmap 共享 state）

```
用户在 grid 点击单元格
    ↓
ChapterCompletionGrid.onSelectChapter(chapterId)
    ↓
useDashboard.selectChapter(chapterId)         // 全局 state
    ↓
WordCountTrend / ScoreHeatmap 同步高亮该章节
    ↓
（次级）跳转：useNavigate('/novel?chapter=' + chapterId)  // 可选
```

### 2.4 ScoreCard 弹窗复用时序

```
用户在 heatmap 点击 (chapter, dimension)
    ↓
ScoreHeatmap.onCellClick(chapterId, dimensionIdx)
    ↓
ProgressDashboard 触发现有 ScoreCardBadge 弹窗
    ↓
复用 src/components/ScoreCardBadge.tsx 的 open API（已存在）
```

⚠ 若 `ScoreCardBadge` 没有 imperative open API，需要在 PR-3 加一个最小适配（≤ 10 行）。

### 2.5 不变量（CA 强约束）

| ID | 不变量 | 验证 |
|:---:|---|---|
| I-1 | `getProjectAggregates` 永远 read-only（仅 .toArray / .where） | grep `db.put / db.add / db.update` → 在 projectAggregates.ts 应 0 hits |
| I-2 | dashboard 不引入新 npm 包 | `package.json` diff = 0 |
| I-3 | dashboard 不调用 LLM API | grep `runStep / runStepBestOfN / fetch.*api` 在 dashboard 文件 → 0 |
| I-4 | localStorage key 恰好一个 (`flil:dashboard:state`) | grep `localStorage.setItem` 在 store/dashboard.ts → 1 |
| I-5 | 3 子组件 props 100% 由父传递（无自己读 zustand）| 子组件 import zustand → 0 |

---

## §3 详细设计

### 3.1 `getProjectAggregates` 算法

```ts
export async function getProjectAggregates(projectId: string): Promise<ProjectAggregates> {
  // 1. 一次查全章节（dexie .where + sortBy）
  const chapters = await db.chapters
    .where('projectId').equals(projectId)
    .sortBy('chapterIndex');                     // ≤ 50ms

  // 2. 一次查全 artifacts (含 scoreCardHistory)
  const artifacts = await db.artifacts
    .where('projectId').equals(projectId)
    .toArray();                                   // ≤ 30ms

  // 3. 内存聚合（O(n))
  const wordCounts = chapters.map(c => c.body?.length ?? 0);
  const mean = wordCounts.reduce((a, b) => a + b, 0) / Math.max(wordCounts.length, 1);
  const sorted = [...wordCounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

  // 4. 每章节聚合
  const chapterAggs = chapters.map(c => buildChapterAggregate(c, artifacts, mean));

  // 5. ScoreCard 矩阵
  const matrix = buildScoreCardMatrix(chapters, artifacts);

  // 6. 完成度统计
  const completed = chapterAggs.filter(c => c.status === 'completed').length;
  const inProgress = chapterAggs.filter(c => c.status === 'in-progress').length;
  return { projectId, totalChapters: chapters.length, completedChapters: completed, ... };
}
```

**性能预期**：50 章 / 10 评分历史 / Chromium → ≤ 100ms（NFR-1 达标）。

### 3.2 `buildChapterAggregate` 完成度判定

```ts
function buildChapterAggregate(c: Chapter, artifacts: Artifact[], mean: number): ChapterAggregate {
  const wordCount = c.body?.length ?? 0;

  let status: 'completed' | 'in-progress' | 'not-started';
  if (wordCount === 0) status = 'not-started';
  else if (wordCount >= 1000) status = 'completed';     // §0.5 Q2 决议
  else status = 'in-progress';

  // ScoreCard 取该章节最新评分（scoreCardHistory[0]）
  const artifact = artifacts.find(a => a.chapterId === c.id && a.kind === 'chapter-final');
  const latestScore = artifact?.meta?.scoreCard;
  const scoreCardAvg = latestScore ? avgOfDimensions(latestScore.dimensions) : null;
  const scoreCardIssueCount = latestScore?.issues?.length ?? 0;

  // 字数离群判定
  const isOutlier = wordCount > 0 && (wordCount < mean * 0.5 || wordCount > mean * 2);

  return { chapterId: c.id, chapterIndex: c.chapterIndex, ..., scoreCardAvg, scoreCardIssueCount, isOutlier };
}
```

### 3.3 `ChapterCompletionGrid` 渲染算法

```tsx
// 自适应列数：容器宽度 / 单元格目标尺寸 (32px) → 列数 (clamp 5-12)
const columns = Math.min(12, Math.max(5, Math.floor(containerWidth / 36)));

return (
  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
    {chapters.map(c => (
      <button
        key={c.chapterId}
        onClick={() => onSelectChapter(c.chapterId)}
        className={clsx(
          'aspect-square rounded text-[10px] flex items-center justify-center transition',
          STATUS_COLORS[c.status],                              // gray / amber / green
          c.scoreCardIssueCount > 0 && 'ring-2 ring-red-400',   // 评分异常红环
          c.isOutlier && 'border-2 border-yellow-500',          // 字数离群黄边
          selectedChapterId === c.chapterId && 'ring-4 ring-blue-500',
        )}
        title={`${c.title} · ${c.wordCount} 字 · 评分 ${c.scoreCardAvg?.toFixed(1) ?? '—'}`}
      >
        {c.chapterIndex + 1}
      </button>
    ))}
  </div>
);
```

### 3.4 `WordCountTrend` SVG 路径

```tsx
// 将字数序列转为 SVG path
const xs = chapters.map((_, i) => i / Math.max(chapters.length - 1, 1));   // 0..1
const ys = chapters.map(c => c.wordCount / Math.max(maxWordCount, 1));     // 0..1

const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x * W} ${(1 - ys[i]) * H}`).join(' ');

return (
  <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
    <path d={path} stroke="rgb(59 130 246)" fill="none" strokeWidth="2" />
    <line x1="0" x2={W} y1={(1 - mean / maxWordCount) * H} y2={(1 - mean / maxWordCount) * H}
          stroke="gray" strokeDasharray="4" />
    {chapters.filter(c => c.isOutlier).map(c => (
      <circle key={c.chapterId} cx={...} cy={...} r="4" fill="red" />
    ))}
  </svg>
);
```

### 3.5 `ScoreHeatmap` 矩阵 + 颜色映射

```tsx
function scoreToColor(score: number | null): string {
  if (score === null) return 'rgb(243 244 246)';                 // 灰
  if (score < 0.6) return `rgb(252 ${Math.round(165 + score * 90)} 165)`;  // 红→黄
  if (score < 0.85) return `rgb(${Math.round(252 - (score - 0.6) * 200)} 211 77)`;  // 黄→绿
  return `rgb(${Math.round(74 - (score - 0.85) * 75)} ${Math.round(222 - (score - 0.85) * 30)} 128)`;  // 绿→深绿
}

// 维度自适应行高 + 列向滚动 (§0.5 Q3 决议)
const cellW = 32, cellH = matrix.dimensions.length > 6 ? 24 : 32;
const totalW = cellW * chapters.length;
const overflowX = chapters.length > 30;  // 滚动条触发阈值

return (
  <div className={clsx('overflow-x-auto', overflowX && 'max-w-full')}>
    <svg viewBox={`0 0 ${totalW} ${cellH * matrix.dimensions.length}`}>
      {matrix.dimensions.map((dim, dIdx) =>
        chapters.map((c, cIdx) => (
          <rect
            key={`${dim}-${c.chapterId}`}
            x={cIdx * cellW} y={dIdx * cellH} width={cellW} height={cellH}
            fill={scoreToColor(matrix.values[cIdx][dIdx])}
            onClick={() => onCellClick(c.chapterId, dIdx)}
            ...
          />
        ))
      )}
    </svg>
  </div>
);
```

---

## §4 关键工程决策（PRD §9 Q1-Q4 最终决议）

### 4.1 Q1 · Dashboard 位置 = **顶部 collapsible**

**理由**：
- N3 sidebar 已挤（5 panels，PRD R4），加 dashboard 视觉过载
- 顶部 collapsible 默认折叠 = 0 视觉破坏
- 展开态独立于现有 panel，不冲突

**实施**：放在 Novel.tsx N3 阶段的 step header 下方（L676 附近，N3.1 控件上方）。

### 4.2 Q2 · 完成度 = **字数阈值为主，manifest 状态为辅**

**理由**：
- chapter.body 字数最直接、最不依赖 pipeline 状态机
- 1000 字阈值是经验启发（短篇章节最低字数）
- manifest 状态太依赖 step-by-step 执行历史，丢 idempotency

**阈值**：
- 0 字 → not-started
- 0-1000 字 → in-progress
- ≥ 1000 字 → completed

**调整路径**：实施后若实际数据偏差，CK 阶段可再调阈值（不属红线）。

### 4.3 Q3 · 热力图维度 = **自适应行高 + 列向滚动**

**理由**：
- 不同 ScoreCard 配置下维度数 5-10 不等
- 自适应避免信息丢失
- 列向滚动（章节方向）对 50+ 章项目更友好

**实施**：
- 维度 ≤ 6 → 行高 32px
- 维度 > 6 → 行高 24px
- 章节 > 30 → 启用 overflow-x-auto

### 4.4 Q4 · i18n = **不做 · 中文硬编码**

**理由**：
- 项目 v3 仍为 for-self 中文项目（product-brief §3）
- 加 i18n 占位会增加 PR 复杂度，违反 NFR-3 行数 cap
- 后续若真做多语言，是独立 epic

### 4.5 决策矩阵汇总

| Q | 决议 | 影响文件 |
|:---:|---|---|
| Q1 位置 | 顶部 collapsible | Novel.tsx (FR-5.1) |
| Q2 完成度 | 字数 ≥ 1000 = 完成 | projectAggregates.ts (§3.2) |
| Q3 热力图 | 自适应行高 + 滚动 | ScoreHeatmap.tsx (§3.5) |
| Q4 i18n | 中文硬编码 | 全部 |

---

## §5 实施顺序

### 5.1 PR 路线图（自底向上）

```
PR-1 (data layer)      → projectAggregates.ts + types
PR-2 (view components) → 3 子组件（ChapterCompletionGrid / WordCountTrend / ScoreHeatmap）
PR-3 (integration)     → ProgressDashboard 容器 + dashboard zustand store + Novel.tsx 接入
PR-4 (dogfood + docs)  → dogfood-log entry + 测试 + erratum（如有）
```

### 5.2 各 PR 详表

| PR | 文件 | 估行 | Cap | 验收 |
|:---:|---|:---:|:---:|---|
| **PR-1** | + `src/store/projectAggregates.ts` (110) | 110 | 200 | unit test：空数据 / 完整数据 / 部分完整 3 case · 性能 ≤ 100ms |
| **PR-2** | + `src/components/dashboard/{ChapterCompletionGrid, WordCountTrend, ScoreHeatmap}.tsx` (240) | 240 | 200/file | 3 子组件分别 storybook-style 渲染验证（无业务） |
| **PR-3** | + `src/components/ProgressDashboard.tsx` (80) + `src/store/dashboard.ts` (40) + M `src/pages/Novel.tsx` (+6) | 126 | 200 | 浏览器手测：N3 区出现 dashboard / 折叠展开 / click 跳章 / heatmap click 弹 ScoreCard |
| **PR-4** | M `docs/dogfood-log.md` (~80) | docs only | n/a | 表格汇报全部 ✅ / 累积行数 ledger / erratum 记录 |
| **累积 src** | | **476** | **350 (cap)** | ⚠ 实施时若超 cap，PR-3 后做 erratum 处理 |

### 5.3 测试 / 验收对应表

| 测试 | 目标 | PR |
|---|---|:---:|
| Unit · `getProjectAggregates` 空 | 0 章 → totalChapters=0 / matrix=null | PR-1 |
| Unit · `getProjectAggregates` 满 | 12 章 / 6 维 ScoreCard / 完整数据 → matrix 12x6 / mean 正确 | PR-1 |
| Unit · `getProjectAggregates` 部分 | 5 章中 2 无 body / 3 无 ScoreCard → status / null 正确 | PR-1 |
| Unit · `useDashboard.toggleCollapse` | localStorage 写入正确 + 跨 project 隔离 | PR-3 |
| 浏览器 · NFR-1 性能 | DevTools Performance · 首次渲染 ≤ 200ms | PR-3 |
| 浏览器 · 折叠/展开 | 视觉过渡平滑 / 状态持久 | PR-3 |
| 浏览器 · grid click → trend / heatmap 高亮联动 | 跨子组件 state 同步 | PR-3 |
| 浏览器 · heatmap click → ScoreCardBadge 弹窗 | 复用机制工作 | PR-3 |

### 5.4 git commit 节奏

```
PR-1：单 commit
  feat(dashboard): add projectAggregates dexie helper (gap-d FR-data)

PR-2：3 个 commit（每子组件一个）
  feat(dashboard): add ChapterCompletionGrid view component (gap-d FR-2)
  feat(dashboard): add WordCountTrend view component (gap-d FR-3)
  feat(dashboard): add ScoreHeatmap view component (gap-d FR-4)

PR-3：2 个 commit
  feat(dashboard): add ProgressDashboard container + dashboard store (gap-d FR-1, FR-6)
  feat(novel): wire ProgressDashboard into N3 stage (gap-d FR-5)

PR-4：1 个 commit
  docs(dogfood): record gap-d epic completion + erratum (if any)
```

每 commit 跑 `/dogfood-check`（已建好），保证渐进 PASS。

---

## §6 风险 vs PRD §7 的差异（CA 视角补充）

| PRD R | CA 验证 / 调整 |
|:---:|---|
| R1 ScoreCard 数据格式不统一 | §3.2 已含 null 容错；buildScoreCardMatrix 跳过 null 维度 |
| R2 长项目 grid 拥挤 | §3.3 列数 clamp 5-12 + grid 高度自适应 |
| R3 dexie 慢 | §3.1 一次查全 + 内存聚合（不分页） |
| R4 N3 sidebar 挤 | §4.1 选顶部 collapsible，不抢 sidebar |
| R5 与 gap-e 冲突 | gap-e 在 toolbar / gap-d 在 step header 下，物理分离 |

---

## §7 后续 BMAD 阶段

- **CK (Checkpoint)**：`docs/planning/checkpoint-gap-d-progress-dashboard.md`
  - 完整红线 grep 命令清单
  - 累积 src 行数 ledger（PR-1 / PR-2 / PR-3 / PR-4 各阶段实测 vs cap）
  - 5 不变量（I-1..I-5）的运行时 / 编译时验证手段
  - PR 间合并回退策略
  - **不**重写 §3 算法（CK 不重复 CA）

- **Stage 3-4 (Implementation)**：按 §5.4 commit 节奏执行 4 PR

---

> **版本**：v0.1 (2026-05-06) · CA 决议 4 个 Open Question · 路线锁定 · 累积估算 ⚠ 超 cap 25%（PR-3 后看实测决定 erratum）。
