---
project: fili-web
epic: gap-b-character-bible
stage: BMAD Stage 2 · CA (Component Architecture)
author: QvQ + Cascade
date: 2026-05-06
status: draft
related:
  - prd-gap-b-character-bible.md (上游需求)
  - architecture-gap-d-progress-dashboard.md (CA 风格参考)
  - architecture-gap-e-export.md (CA 风格 + 大型 epic 参考)
  - product-brief.md §4.3
---

# Architecture · v3 缺口 b · 角色 Bible 跨章节追踪

---

## §0 架构上下文

### 0.1 与 PRD 的边界

| 来源 | 给定 | 留给 CA |
|---|---|---|
| PRD §3 FR-1..6 | 6 类功能需求 | 拆分到 7 文件 + 函数签名 + 算法 |
| PRD §4 NFR-1..5 | 性能 / token / 行数 / 红线 / 测试 | 检验机制（red-line grep + 累积 ledger）|
| PRD §9 Q1-Q5 | 5 个 Open Question | **本 CA §4 给出最终决议** |
| PRD §8 PR-1..5 | 5 个 PR 草拆 | §5 详表 + 各 PR cap |

### 0.2 4 条红线（继承自 PRD §4 NFR-4 · gap-b 强约束）

> **机械验证 grep**（`/dogfood-check` 已封装可扩）：

```
红线 #1 · v1-v4 Dexie schema 不变  git diff main...HEAD -- src/store/db.ts | grep -E '^[+-]\s*(this\.version\(([1-4])|projects:|liveArtifacts:|liveRefinementUndo:|userKbDocs:|userKbFeedback:|runHistory:|artifacts:)' → 期望 0
红线 #2 · N1.2 / N3.2 prompt 不变  git diff main...HEAD -- 'public/prompts/novel/1.2*' 'public/prompts/novel/3.2*' → 期望 empty
红线 #3 · consistencyCheck.ts 不变  git diff main...HEAD -- src/pipeline/consistencyCheck.ts → 期望 empty
红线 #4 · gap-d 资产不变             git diff main...HEAD -- 'src/store/projectAggregates.ts' 'src/store/dashboard.ts' 'src/components/ProgressDashboard.tsx' 'src/components/dashboard/' → 期望 empty
```

**红线触碰 = PR 拒绝合入**。

### 0.3 技术栈（**0 新依赖**）

| 层 | 选型 | 来源 |
|---|---|---|
| Schema migration | Dexie 内建 `version(5).stores({...})` | 现有 db.ts pattern |
| LLM 调用 | 复用 `runStep()` (`src/pipeline/runner.ts`) | gap-e 验证过 |
| 角色提取 | **复用** `extractCharacterMentions` + `buildAssetIndex` (`src/pipeline/consistencyCheck.ts`) | **不重造** |
| 状态持久化 | dexie `characterStates` 表（v5 add） | 新增 |
| UI 渲染 | React + Tailwind + 手撸 SVG（同 gap-d） | gap-d 验证过 |
| 状态管理 | zustand (CharacterBible 控制器) | gap-d settings.ts 模式 |
| 类型 | TypeScript strict | 项目通用 |

**禁止引入**：图论 / vis / d3 / chart 库 / 任何额外 npm 依赖。

### 0.4 现状代码资产盘点（CA 复用清单）

| 资产 | 路径 / 行号 | 用途 |
|---|---|---|
| `EntityKind` type | `src/pipeline/consistencyCheck.ts:17` | 复用 'character' kind |
| `extractCharacterMentions` | `src/pipeline/consistencyCheck.ts:215` | 找出场角色（vocab + 词典）|
| `buildAssetIndex` | `src/pipeline/consistencyCheck.ts:139` | 从 N1.2 等 artifacts 抽角色清单 |
| `runStep` | `src/pipeline/runner.ts` | LLM 调用 / 流式 / 错误处理 |
| `useProject().artifacts['novel.2']` | N1.2 人物 Bible artifact | 状态提取 baseline |
| `meta.chapterContents` | `NovelChapterLoopMeta` (novelLoop.ts:317) | 章节正文 lookup |
| `recordRun` | `src/store/db.ts` | LLM 调用日志 |
| settings.enableScoreCard pattern | `src/store/settings.ts:enableScoreCard` | 类比 enableCharacterStateExtraction |
| `ProgressDashboard.tsx` 结构 | gap-d 交付 | 类比 collapsible 容器 |

### 0.5 Open Questions 一行答案（**§4 详述**）

| Q | 决议 |
|---|---|
| Q1 UI 位置 | **ProgressDashboard 下方 collapsible 容器**（同视觉语言，不抢 sidebar）|
| Q2 relations schema | **混合**：`{ type: RelationType (enum 8 值), note?: string }` |
| Q3 失败 fallback | **写 stub entry**：`{ snapshot: null, extractionError: string }` 让 UI 显式"尝试过但失败" |
| Q4 N1.2 缺失降级 | **纯文本提取 + warning**（不拒绝运行 · 兼容已导入项目）|
| Q5 v5 migration test fixture | **必要**：PR-1 含 dev console smoke：v4 项目 → 升 v5 → 验数据完整 + 新表存在 |

---

## §1 模块拓扑

### 1.1 文件白名单（NFR-3 cap ≤ 700 行 累积 / 单文件 ≤ 250 行）

| # | 文件 | 类型 | 估行数 | PR |
|:---:|---|:---:|:---:|:---:|
| 1 | `src/store/db.ts` | M 修改 | +12 / -0 (v5 schema add) | PR-1 |
| 2 | `src/store/characterStates.ts` | A 新增 · dexie helpers + types | ~140 | PR-1 |
| 3 | `public/prompts/novel/3.3-character-state-extract.md` | A 新增 prompt | ~80 (md) | PR-2 |
| 4 | `public/methods/manifest.json` | M 修改 | +18 / -0 (novel.8 step) | PR-2 |
| 5 | `src/pipeline/characterStates.ts` | A 新增 · LLM step + extraction | ~180 | PR-2 |
| 6 | `src/store/settings.ts` | M 修改 | +8 / -0 (新开关) | PR-3 |
| 7 | `src/pipeline/novelLoop.ts` | M 修改 | +35 / -0 (注入 + 触发) | PR-3 |
| 8 | `src/components/CharacterBible.tsx` | A 容器 | ~130 | PR-4 |
| 9 | `src/components/character/CharacterTimelineView.tsx` | A view | ~110 | PR-4 |
| 10 | `src/components/character/CharacterRelationGraph.tsx` | A view (SHOULD) | ~95 | PR-4 |
| 11 | `src/store/characterBible.ts` | A · zustand store | ~50 | PR-4 |
| 12 | `src/pages/Novel.tsx` | M | +8 / -0 (接入) | PR-4 |
| 13 | `src/pipeline/characterStates.ts` (stale 扩展) | M | +30 / -0 | PR-5 |
| 14 | `src/components/CharacterBible.tsx` (stale UI) | M | +20 / -0 | PR-5 |
| | **累积 src** | | **~916** | |
| | **累积 src 排除 prompt md** | | **~836** | ⚠ **超 PRD NFR-3 cap 700 by +136 (+19%)** |

⚠ **CA 阶段已识别累积超 cap**：
- 来源：UI（PR-4: 343 行）+ 业务逻辑（PR-2: 180 行）+ schema/dexie helper（PR-1: 152 行）
- **CK §4 必须预设 erratum 协议接受 +20% 偏差**（参考 gap-d 实测 +7% 偏差经验）
- 实施时若超 +30%（>910），暂停 PR-5 回头精简

### 1.2 模块依赖图

```
src/pages/Novel.tsx (M, PR-4)
    ├→ src/components/ProgressDashboard.tsx (R · gap-d 不动)
    └→ src/components/CharacterBible.tsx (A, PR-4)
        ├→ src/store/characterBible.ts (A · zustand · PR-4)
        ├→ src/store/characterStates.ts (A · dexie helpers · PR-1)
        └→ src/components/character/
            ├→ CharacterTimelineView.tsx (A · pure view · PR-4)
            └→ CharacterRelationGraph.tsx (A · pure view · PR-4)

src/pipeline/novelLoop.ts (M, PR-3)
    └→ 触发: src/pipeline/characterStates.ts.runCharacterStateExtraction
        ├→ 复用: src/pipeline/consistencyCheck.ts.extractCharacterMentions (R)
        ├→ 复用: src/pipeline/consistencyCheck.ts.buildAssetIndex (R)
        ├→ 复用: src/pipeline/runner.ts.runStep (R)
        ├→ 输入: useProject().artifacts['novel.2'] (人物 Bible · R)
        ├→ 输入: NovelChapterLoopMeta.chapterContents (R)
        └→ 输出: src/store/characterStates.ts.upsertCharacterState (A)

src/store/db.ts (M, PR-1)
    └→ 增 v5 stores({ characterStates: '++id, ...' })

src/store/settings.ts (M, PR-3)
    └→ 增 enableCharacterStateExtraction: boolean
```

`R` = read-only 复用 / `A` = add 新增 / `M` = modify 修改。

### 1.3 公开 API 表面

#### `src/store/characterStates.ts` (PR-1)

```ts
import { db } from './db';

export type RelationType =
  | 'friend' | 'enemy' | 'neutral' | 'lover'
  | 'family' | 'mentor' | 'rival' | 'unknown';

export interface CharacterRelation {
  type: RelationType;        // §4.2 决议：enum 主类型
  note?: string;             // freeform 描述（"暗恋未表白" / "为父复仇"）
}

export interface CharacterSnapshot {
  /** characterName -> relation；只记**有关系的** */
  relations: Record<string, CharacterRelation>;
  emotion?: string;          // "复杂矛盾" / "释然"
  abilities?: string[];      // "新学剑法xx" / "失去左眼视力"
  keyEvents?: string[];      // "目睹师父之死" / "突破筑基期"
  summary?: string;          // 一句话本章末状态
}

export interface CharacterStateRecord {
  id?: number;
  projectId: number;
  chapterIndex: number;      // 1-based · 与 ChapterMeta.index 对齐
  characterName: string;
  /** §4.3 决议：失败时 = null，附 extractionError */
  snapshot: CharacterSnapshot | null;
  extractionError?: string;
  sourceArtifactNodeId: 'novel.6' | 'novel.7';   // 哪个版本提取的（草稿 / 润色）
  ts: number;
  /** §4.6 stale 标记 · 上游修订时为 true */
  stale: boolean;
}

// ─── helpers ──────────────────────────────────────────
export async function upsertCharacterState(
  rec: Omit<CharacterStateRecord, 'id' | 'ts'>
): Promise<number>;

export async function listChapterStates(
  projectId: number, chapterIndex: number
): Promise<CharacterStateRecord[]>;

export async function listCharacterTimeline(
  projectId: number, characterName: string
): Promise<CharacterStateRecord[]>;   // 按 chapterIndex 升序

export async function markStateStale(
  projectId: number, fromChapter: number
): Promise<number>;   // 返回标记的条数

export async function clearProjectStates(projectId: number): Promise<void>;
```

#### `src/pipeline/characterStates.ts` (PR-2 · LLM step + extraction)

```ts
import type { ArtifactMap } from './types';
import type { CharacterSnapshot } from '../store/characterStates';

export interface RunCharacterStateOpts {
  projectId: number;
  chapterIndex: number;
  artifacts: ArtifactMap;             // 含 novel.2 (Bible) + novel.6/7 (chapter)
  source: 'novel.6' | 'novel.7';      // 提取草稿 or 润色版
  signal?: AbortSignal;               // 用户取消支持
  /** 上一章末状态（用于 LLM 看演变）· 上游主入口构造 */
  previousChapterStates?: Array<{ characterName: string; snapshot: CharacterSnapshot }>;
}

export interface RunCharacterStateResult {
  ok: true;
  extractedCount: number;
  charactersFound: string[];
  durationMs: number;
} | {
  ok: false;
  error: string;
  parseFailed?: boolean;          // LLM 输出非法 JSON
  charactersFound?: string[];     // 找到角色但 LLM 失败
};

/** 主入口：提取 + 持久化 + 返回结果 */
export async function runCharacterStateExtraction(
  opts: RunCharacterStateOpts
): Promise<RunCharacterStateResult>;

/** 批量重跑指定项目某区间章节（FR-6 stale 重跑用）*/
export async function rerunStaleStates(
  projectId: number, fromChapter: number, artifacts: ArtifactMap
): Promise<{ runs: number; failures: number }>;
```

#### `src/store/characterBible.ts` (PR-4 · zustand store)

```ts
interface CharacterBibleState {
  collapsed: boolean;
  selectedCharacterName: string | null;
  showStaleOnly: boolean;            // 仅显示 stale 章节（FR-6 SHOULD）
}

interface CharacterBibleActions {
  toggleCollapse(): void;
  selectCharacter(name: string | null): void;
  setShowStaleOnly(v: boolean): void;
  reset(): void;
}

export const useCharacterBible = create<CharacterBibleState & CharacterBibleActions>()(
  persist(
    (set) => ({ ... }),
    { name: 'flil:character-bible:state' }   // I-4 单 key
  )
);
```

#### `src/components/CharacterBible.tsx` (PR-4 · 容器)

```ts
export interface CharacterBibleProps {
  projectId: number;
}

export function CharacterBible(props: CharacterBibleProps): JSX.Element;
// 内部：useEffect 加载 listCharacterTimeline + listChapterStates
// 子组件：CharacterTimelineView (default) / CharacterRelationGraph (toggle)
// 顶部 toolbar：角色 dropdown + 模式切换 + "重跑" / "标 stale 从此处" 按钮
```

#### `src/components/character/CharacterTimelineView.tsx` (PR-4)

```ts
export interface CharacterTimelineViewProps {
  /** 单个角色的全部章节快照（按 chapterIndex 升序）*/
  records: CharacterStateRecord[];
  /** 总章数（含未提取章节，UI 显示 gap）*/
  totalChapters: number;
  selectedChapterIndex: number | null;
  onSelectChapter(idx: number): void;
}

export function CharacterTimelineView(props): JSX.Element;
// 渲染：横向时间线（章节序号 X 轴）+ 纵向维度（关系/情感/能力/事件）
// 每格 hover 显示完整快照；click 跳章节
// stale 章节黄色徽章
// 失败章节灰色 + extractionError tooltip
```

### 1.4 数据流概要（详见 §2）

```
[novel.7 章节润色完成]
    └→ (settings.enableCharacterStateExtraction === true) 触发
        ↓
runCharacterStateExtraction({ projectId, chapterIndex, artifacts, source: 'novel.7' })
    ├→ extractCharacterMentions(chapterContent, biblesVocab)
    │     → 找出场角色 namesInChapter
    ├→ buildAssetIndex(artifacts) → 全角色清单 allCharacters
    │     (FR-7 / Q4 决议) novel.2 缺失 → 仅用 namesInChapter
    ├→ listChapterStates(projectId, chapterIndex - 1)
    │     → previousChapterStates (LLM 看演变)
    ├→ runStep(novel.8 prompt 注入: chapterContent + Bible + previousStates)
    │     → LLM 输出 JSON 数组
    ├→ JSON.parse 容错 (parseFailed → §4.3 stub)
    └→ for each: upsertCharacterState(...)
        ↓ Dexie write
    返回 { ok, extractedCount, ... }
        ↓ UI 自动 re-render（zustand subscribe）

[用户打开 CharacterBible 面板]
    └→ useEffect 加载 listCharacterTimeline(projectId, selectedCharacter)
        ↓
    渲染 CharacterTimelineView records={...}
```

---

## §2 数据流详细设计

### 2.1 章节生成 → 状态提取 时序

```
1. N3.2 polish 完成 → assembleChapterArtifact(...)
2. 检查 settings.enableCharacterStateExtraction
   ├─ false → END（跳过本节）
   └─ true → 继续
3. 调 runCharacterStateExtraction({...})
   3.1  artifacts = useProject.getState().artifacts
   3.2  source = 'novel.7'（润色优先）or 'novel.6'（仅草稿时）
   3.3  await listChapterStates(projectId, chapterIndex - 1) → previousStates
   3.4  await runStep(novel.8 prompt)
   3.5  解析 + upsert
4. UI 通过 zustand 订阅，自动 re-render CharacterBible
5. 失败时：runHistory 记一行 + UI 红色徽章
```

NFR-1 要求 ≤ 30s（含 LLM 调用 + ≤ 2 次 IDB 写入）。

### 2.2 stale 标记传播时序

```
用户在 PreviewModal 修改第 N 章 → triggers chapter content change
    ↓
（触发点：existing flow + 新增 hook）
    ↓
markStateStale(projectId, fromChapter: N)
    ↓
Dexie batch update: where('projectId').equals(p).and(c => c.chapterIndex >= N).modify({stale: true})
    ↓
zustand 通知 CharacterBible re-render → 第 N..end 章节显示 stale 黄色徽章
    ↓
用户点 "批量重跑 stale" → rerunStaleStates(projectId, fromChapter, artifacts)
```

### 2.3 N3.1 草稿循环注入上一章状态时序

```
runNovelChapterDraftLoop 第 N 章生成 prompt
    ↓
（新增 step）
const states = await listChapterStates(projectId, N - 1);
const summary = formatStatesAsBriefSummary(states);   // ≤ 1500 字截断 (FR-5.3)
prompt += '\n\n## 截至上一章的角色状态\n' + summary;
    ↓
继续既有 runStep 流程
```

### 2.4 n1.2 缺失降级时序（Q4 决议）

```
runCharacterStateExtraction 入口
    ↓
const bible = artifacts['novel.2'];
if (!bible) {
  warn: console.warn + UI banner "未配置 N1.2 人物 Bible，仅用本章文本提取"
  bible = null  // signal 给 LLM 不要参考
}
↓
prompt 模板分支：有 Bible 注入对照；无则只用 chapterContent
↓
正常继续
```

### 2.5 不变量（CA 强约束 · CK 机械验证）

| ID | 不变量 | 验证 grep |
|:---:|---|---|
| I-1 | `characterStates.ts` 不调 LLM（dexie helper 纯 IO） | `Select-String src/store/characterStates.ts -Pattern 'runStep\|fetch\|runStepBestOfN'` → 0 |
| I-2 | `pipeline/characterStates.ts` 不直读 zustand（接 ArtifactMap props）| `Select-String src/pipeline/characterStates.ts -Pattern 'useProject\|useDashboard\|useSettings'` → 0（除非显式 import 类型）|
| I-3 | UI 子组件 props-only（同 gap-d I-5）| `Select-String src/components/character/*.tsx -Pattern 'useProject\|useDashboard\|useSettings\|useCharacterBible'` → 0 |
| I-4 | 仅 1 个新 localStorage key (`flil:character-bible:state`)，gap-d 的 key 不动 | grep `flil:dashboard:state` 在 characterBible.ts → 0 |
| I-5 | v5 schema **仅 add**：v1-v4 stores 字符串 0 字符变更 | git diff 红线 #1 |
| I-6 | `runCharacterStateExtraction` 失败不破 N3.2 流程（封装 try/catch） | 代码审查 + manual smoke：故意构造非法 chapter content 验证 |
| I-7 | 0 新依赖 | `git diff package.json package-lock.json` → 0 |

---

## §3 详细设计

### 3.1 Dexie v5 schema 升级

```ts
// src/store/db.ts  (PR-1 · +12 行)

// v5: 闃舵 b 路 瑙掕壊 bible 璺ㄧ珷鑺傝拷韪?
this.version(5).stores({
  // v4 鎵€鏈夎〃淇濇寔 0 鎴愬瓧鏀瑰彉锛堢孩绾?#1锛?
  projects: '++id, name, createdAt, status',
  artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
  liveArtifacts: '&nodeId, stageId, ts',
  runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
  userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
  userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
  liveRefinementUndo: '++id, ts, [chapterIndex+source]',
  // 新增 character_states · 复合索引支持快速 chapter lookup + character timeline
  characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
});
```

⚠ **migration 注意**：Dexie 自动处理 v4 → v5（add only）。**绝不写 v1-v4 string**。

### 3.2 LLM prompt schema (`public/prompts/novel/3.3-character-state-extract.md`)

```markdown
# 系统消息

你是小说角色状态追踪器。任务：分析【当前章节】内容，对比【上一章末状态】+【人物 Bible】，
为每个出场角色提取一份**当前章节末状态快照**。输出 **严格 JSON 数组**。

# 输入

## 人物 Bible（N1.2 · 可能缺失）
{{ artifacts.novel.2.content }}

## 上一章末状态（按角色名）
{{ previousChapterStates }}

## 当前章节内容（第 {{ chapterIndex }} 章）
{{ currentChapterContent }}

# 输出 schema（严格遵守）

```json
[
  {
    "characterName": "<姓名>",
    "snapshot": {
      "relations": { "<其他角色名>": { "type": "friend|enemy|neutral|lover|family|mentor|rival|unknown", "note": "<≤30字>" } },
      "emotion": "<≤20字 · 可省>",
      "abilities": ["<≤30字 · 可省，最多 5 项>"],
      "keyEvents": ["<≤40字 · 可省，最多 3 项>"],
      "summary": "<≤80字 · 一句话章末状态>"
    }
  }
]
```

# 规则

1. 仅记录【本章实际出场】角色，未出场不输出
2. relations 仅记**变化或新增的**关系（vs 上一章）
3. abilities / keyEvents 仅记**本章变化**
4. 角色名优先使用 N1.2 中的全名（防别名漂移）
5. 如本章无显著状态变化，仍输出该角色一条仅含 summary 的 entry
6. 严格 JSON · 不许带任何 markdown / 注释
```

### 3.3 `extractCharacterMentions` 集成（PR-2 algorithm）

```ts
// src/pipeline/characterStates.ts

import { extractCharacterMentions, buildAssetIndex } from './consistencyCheck';

async function detectCharactersInChapter(
  chapterContent: string,
  artifacts: ArtifactMap
): Promise<{ characters: string[]; bible: string | null }> {
  const bible = artifacts['novel.2']?.content ?? null;

  // 复用 buildAssetIndex 抽 Bible 角色清单
  const assetIndex = buildAssetIndex(artifacts);
  const charactersFromBible = assetIndex
    .filter((a) => a.kind === 'character')
    .map((a) => a.name);

  // 复用 extractCharacterMentions 找本章实际出场
  const vocab = new Set(charactersFromBible);
  const { mentions } = extractCharacterMentions(chapterContent, vocab);
  const charactersInChapter = Array.from(mentions.keys()).filter((n) => mentions.get(n)! > 0);

  return { characters: charactersInChapter, bible };
}
```

### 3.4 `runCharacterStateExtraction` 主算法

```ts
export async function runCharacterStateExtraction(
  opts: RunCharacterStateOpts
): Promise<RunCharacterStateResult> {
  const t0 = Date.now();
  const { projectId, chapterIndex, artifacts, source } = opts;

  // 1. 读章节内容
  const chapterArt = artifacts[source];
  const chapterMeta = (chapterArt?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const chapterContent = chapterMeta.chapterContents?.[chapterIndex];
  if (!chapterContent) {
    return { ok: false, error: `第 ${chapterIndex} 章 ${source} 内容缺失` };
  }

  // 2. 找出场角色（复用 consistencyCheck）
  const { characters, bible } = await detectCharactersInChapter(chapterContent, artifacts);
  if (characters.length === 0) {
    return { ok: false, error: '本章未识别到任何角色（可能 N1.2 缺失或角色名不在 Bible）' };
  }

  // 3. 取上一章状态（如有）
  const previousStates = chapterIndex > 1
    ? await listChapterStates(projectId, chapterIndex - 1)
    : [];

  // 4. 调 LLM
  let llmOutput: string;
  try {
    const result = await runStep({
      stepId: 'novel.8',
      promptVars: {
        chapterIndex,
        currentChapterContent: chapterContent,
        previousChapterStates: formatPreviousStatesForPrompt(previousStates),
        biblePresent: bible ? 'yes' : 'no',
      },
      signal: opts.signal,
    });
    llmOutput = result.content;
  } catch (e: unknown) {
    return { ok: false, error: 'LLM 调用失败：' + String(e), charactersFound: characters };
  }

  // 5. 解析 JSON
  let parsed: Array<{ characterName: string; snapshot: CharacterSnapshot }>;
  try {
    parsed = JSON.parse(extractJsonBlock(llmOutput));
  } catch {
    // §4.3 决议：parseFailed → 为每个 character 写 stub stub entry
    for (const name of characters) {
      await upsertCharacterState({
        projectId, chapterIndex, characterName: name,
        snapshot: null, extractionError: 'LLM 输出非法 JSON',
        sourceArtifactNodeId: source, stale: false,
      });
    }
    return { ok: false, error: 'LLM 输出非法 JSON', parseFailed: true, charactersFound: characters };
  }

  // 6. 持久化
  for (const item of parsed) {
    await upsertCharacterState({
      projectId, chapterIndex, characterName: item.characterName,
      snapshot: item.snapshot, sourceArtifactNodeId: source, stale: false,
    });
  }

  return {
    ok: true,
    extractedCount: parsed.length,
    charactersFound: parsed.map((p) => p.characterName),
    durationMs: Date.now() - t0,
  };
}
```

### 3.5 N3.1 prompt 注入 `prevChapterStateSummary`（PR-3）

```ts
// src/pipeline/novelLoop.ts  (PR-3 · +35 行 大致)

async function buildChapterDraftPromptVars(
  chapterIndex: number,
  ctx: ProjectContext,
  settings: SettingsState,
  // 新增参数
  characterStateSummary: string | null,
) {
  // ... existing 逻辑 ...

  // 新增（受 settings.enableCharacterStateExtraction 控制）
  if (characterStateSummary) {
    promptVars.prevChapterStateSummary = characterStateSummary;
  }
}

// 调用方（runNovelChapterDraftLoop 内）
const summary = settings.enableCharacterStateExtraction
  ? formatStatesAsBriefSummary(
      await listChapterStates(projectId, chapterIndex - 1),
      1500   // FR-5.3 cap
    )
  : null;
```

### 3.6 CharacterTimelineView 渲染（PR-4）

```tsx
// 横轴：章节序号 1..totalChapters
// 纵轴：4 维度（关系 / 情感 / 能力 / 事件）+ 1 行 summary

const cellW = 28;
const cellH = 24;
const dimensions = ['关系', '情感', '能力', '事件', '一句话'] as const;

return (
  <div className="overflow-x-auto">
    <svg width={totalChapters * cellW} height={dimensions.length * cellH}>
      {dimensions.map((dim, dIdx) =>
        Array.from({ length: totalChapters }, (_, i) => {
          const ch = i + 1;
          const rec = records.find((r) => r.chapterIndex === ch);
          const fill = !rec ? GRAY_NOT_RUN
            : rec.snapshot === null ? RED_FAILED
            : rec.stale ? YELLOW_STALE
            : GREEN_OK;
          // 单元格内容文字摘要 ...
          return (
            <g key={`${dim}-${ch}`} onClick={() => onSelectChapter(ch)}>
              <rect ... fill={fill} aria-label={...} />
              <text ... > {extractDimensionText(rec, dim)} </text>
            </g>
          );
        })
      )}
    </svg>
  </div>
);
```

---

## §4 关键工程决策（PRD §9 Q1-Q5 最终决议）

### 4.1 Q1 · UI 位置 = **ProgressDashboard 下方 collapsible 容器**

**理由**：
- 与 gap-d ProgressDashboard 同视觉语言（rounded border + 顶部 chevron toggle）
- 默认折叠不抢屏幕（CharacterBible 信息密度大，展开才用）
- 不抢 N3.1/N3.2 现有 sidebar
- 改 Novel.tsx 仅 +8 行（同 gap-d wire 模式）

**实施**：在 N3 区域 ProgressDashboard 之后插入 `<CharacterBible projectId={projectId} />`。

**未来升级路径**：如果 dogfood 实测信息密度太大，CK 阶段可改 L4 独立 Tab；当前不预投资。

### 4.2 Q2 · relations schema = **Mixed**：`{ type: enum, note?: string }`

**理由**：
- 纯 freeform `Record<string, string>` → LLM 输出漂移（"师徒"/"师生"/"亦师亦友" 同义不同写）
- 纯 enum → 信息丢失（同样是 friend，但"生死之交"vs"点头之交"差远了）
- Mixed → enum 给主类型稳定性，note 给细节自由度

**enum 8 值**：friend / enemy / neutral / lover / family / mentor / rival / unknown

**Prompt 约束**：在 §3.2 schema 部分明确列出，LLM 必须从 8 值选

### 4.3 Q3 · 失败 fallback = **写 stub entry**

**理由**：
- null/missing 难区分（用户看 timeline 不知道是"没运行"还是"运行了失败"）
- stub entry 含 `snapshot: null + extractionError` → UI 红色 + tooltip 显具体错因
- 占用一条 dexie row（成本极小，长篇 50 章 × 8 角色 × 50% 失败 = 200 条 = 几 KB）

### 4.4 Q4 · N1.2 缺失降级 = **纯文本提取 + warning**

**理由**：
- 拒绝运行 → 用户体验差（"为什么我不能用这个功能？"）
- 纯文本提取 → 漏角色多但能用
- warning → 让用户知道为什么不准，引导他完善 N1.2

**实施**：
- `detectCharactersInChapter` 检测 `artifacts['novel.2']`，缺失时用 fallback 词典（chapter content 本身的高频专名扫描）
- UI banner："建议先完成 N1.2 人物 Bible 以提高识别精度"

### 4.5 Q5 · v5 migration test fixture = **必要**

**理由**：
- Dexie `add only` 操作官方文档说幂等，但**用户实际数据**比 docs 多样
- gap-b R1 是 🔴 高严重度风险
- PR-1 必须含 dev console smoke：
  1. 用 v4 数据的现有项目打开 app
  2. 升 v5（自动）
  3. 验证旧数据完整（projects/artifacts 等条数 + 内容不变）
  4. 验证 characterStates 表存在且为空
  5. 写一条 character state → 读出一致

### 4.6 决策矩阵汇总

| Q | 决议 | 影响文件 | 影响 PR |
|:---:|---|---|:---:|
| Q1 UI 位置 | 顶部 collapsible（同 gap-d）| Novel.tsx + CharacterBible.tsx | PR-4 |
| Q2 relations | enum + note | characterStates.ts (types) + 3.3 prompt | PR-1, PR-2 |
| Q3 失败 fallback | stub entry | runCharacterStateExtraction (algorithm) | PR-2 |
| Q4 Bible 缺失 | 纯文本 + warning | detectCharactersInChapter + UI banner | PR-2, PR-4 |
| Q5 migration test | dev console smoke | PR-1 dogfood checklist | PR-1 |

---

## §5 实施顺序

### 5.1 PR 路线图（自底向上 · 5 PR）

```
PR-1 (data layer)        → db.ts v5 + characterStates.ts (types + dexie helpers)
PR-2 (LLM step)          → 3.3 prompt + manifest + pipeline/characterStates.ts
PR-3 (settings + auto)   → settings 开关 + novel.7 完成后 auto-trigger + N3.1 prompt 注入
PR-4 (UI)                → CharacterBible + Timeline + RelationGraph + Novel wire
PR-5 (stale + dogfood)   → stale 标记 + 重跑 + dogfood-log + erratum
```

### 5.2 各 PR 详表

| PR | 文件 | 估行 | Cap | 验收 |
|:---:|---|:---:|:---:|---|
| **PR-1** | M `db.ts` (+12) + A `characterStates.ts` (140) | 152 | 200 | dev console smoke：v4 → v5 升级 5 步全 ✅（§4.5）+ tsc 0 新 error |
| **PR-2** | A `3.3-character-state-extract.md` (80 md) + M `manifest.json` (+18) + A `pipeline/characterStates.ts` (180) | 278 | 300 | dev console：模拟 chapter content → 调 runStep → 验 JSON 解析 + dexie write 一致 |
| **PR-3** | M `settings.ts` (+8) + M `novelLoop.ts` (+35) | 43 | 70 | dev console：开 enableCharacterStateExtraction → 运行 N3.2 → 自动跑 novel.8 + 持久化；N3.1 prompt 含 prevChapterStateSummary |
| **PR-4** | A `CharacterBible.tsx` (130) + A `CharacterTimelineView.tsx` (110) + A `CharacterRelationGraph.tsx` (95) + A `characterBible.ts` (50) + M `Novel.tsx` (+8) | 393 | 470 | 浏览器：选角色 → 看 timeline → click 跳章 → relation graph 切换 |
| **PR-5** | M `pipeline/characterStates.ts` (+30) + M `CharacterBible.tsx` (+20) + dogfood-log (+~80) | 50 + 80 docs | 100 | 修第 N 章 → stale 黄徽 → 批量重跑成功 |
| **累积 src** | (排除 prompt md 80 行) | **756** | **PRD cap 700** | ⚠ +56 / +8% · 详见 §1.1 erratum 协议 |

### 5.3 测试 / 验收对应表

| 测试 | 目标 | PR |
|---|---|:---:|
| Dexie smoke (v4 → v5) | §4.5 决议 5 步 | PR-1 |
| `upsertCharacterState` IO | dexie helpers 正确写读 | PR-1 |
| `runCharacterStateExtraction` 正常 case | 5 章节 mock + 8 角色 → JSON 解析正确 | PR-2 |
| `runCharacterStateExtraction` parseFailed | 故意构造非法 JSON → §4.3 stub entry | PR-2 |
| `runCharacterStateExtraction` no-Bible | 删 N1.2 → 纯文本提取 + warning | PR-2 |
| auto-trigger after N3.2 | settings 开 → N3.2 完成 → 自动 novel.8 | PR-3 |
| N3.1 prompt 注入 | runNovelChapterDraftLoop 第 2 章 → prompt 含 prevChapterStateSummary | PR-3 |
| CharacterTimelineView 渲染 | 12 章 × 5 角色 → 正常 + stale + failed 状态 ✅ | PR-4 |
| CharacterRelationGraph 渲染 | 主角 + 5 关系 → 圆 + 连线正常 | PR-4 |
| stale 标记 | 修第 5 章 → 第 5..end 黄徽 | PR-5 |
| 批量重跑 stale | 跑 5..end → all stale → false | PR-5 |

### 5.4 git commit 节奏

```
PR-1：单 commit
  feat(character-bible): add Dexie v5 schema + characterStates store (gap-b PR-1)

PR-2：3 个 commit
  feat(character-bible): add novel.8 character state extraction prompt (gap-b)
  feat(character-bible): wire novel.8 into manifest + pipeline (gap-b)
  feat(character-bible): add runCharacterStateExtraction with reuse of consistencyCheck (gap-b)

PR-3：2 个 commit
  feat(character-bible): add enableCharacterStateExtraction settings (gap-b)
  feat(character-bible): auto-trigger novel.8 after N3.2 + inject prevState into N3.1 prompt (gap-b)

PR-4：3 个 commit
  feat(character-bible): add CharacterTimelineView + CharacterRelationGraph view components (gap-b)
  feat(character-bible): add CharacterBible container + characterBible store (gap-b)
  feat(novel): wire CharacterBible into N3 stage (gap-b)

PR-5：2 个 commit
  feat(character-bible): add stale marking + batch re-run (gap-b)
  docs(dogfood): record gap-b epic completion (PR-5)
```

每 commit 跑 `/dogfood-check` workflow。

---

## §6 风险 vs PRD §7 的差异（CA 视角补充）

| PRD R | CA 验证 / 调整 |
|:---:|---|
| R1 schema 升级安全 (🔴 高) | §4.5 + PR-1 5 步 dev console smoke 强制；CK 加红线 #1 grep 防止 v1-v4 stores 被改 |
| R2 LLM 质量 | §3.2 prompt 严格 schema + Few-shot；§3.4 容错完整（parseFailed → stub）|
| R3 长篇性能 | §1.3 复合索引 [projectId+characterName]；CharacterTimelineView SVG 单层渲染 |
| R4 用户忘开 settings | §0.5 Q4 决议 + UI banner；PR-3 加首次进 N3 时一次性提示 |
| R5 token 爆炸 | §3.5 截断 1500 字；FR-5.3 |
| R6 多项目隔离 | §3.1 复合索引 [projectId+chapterIndex] 保证 |
| R7 Bible 缺失降级 | §4.4 决议：纯文本 + warning |

---

## §7 后续 BMAD 阶段

- **CK (Checkpoint)**：`docs/planning/checkpoint-gap-b-character-bible.md`（次 session 写）
  - 4 红线 grep 命令（机械验证 §0.2）
  - 7 不变量 grep（§2.5）
  - 累积 ledger（5 PR 各 PR cap + 累积 700 cap + erratum 协议）
  - PR-1 schema migration 5 步 smoke checklist
  - rollback 策略（schema 回退尤其关键）

- **Stage 3-4 (Implementation)**：5 PR 按 §5.4 commit 节奏执行
  - 多 session：每 session 1-2 PR
  - 每 PR 后跑 `/dogfood-check`

---

> **版本**：v0.1 (2026-05-06) · CA 决议 5 个 Open Question · 路线锁定 · 累积估算 ⚠ +8% over PRD cap（已预设 erratum 协议，远低于 gap-d 实测 +45%）。
> **vs gap-d 关键差异提醒**：本 epic 触碰 schema / prompt / pipeline 三大红线领域。CK 阶段必须重点设计 v5 migration smoke + LLM 质量 fallback grep。
