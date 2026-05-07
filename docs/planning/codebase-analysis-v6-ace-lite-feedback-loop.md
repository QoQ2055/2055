---
project: fili-web
epic: v6-ace-lite-feedback-loop
stage: BMAD Stage 2 · CA (Codebase Analysis)
author: QvQ + Cascade
date: 2026-05-07
status: draft · 修正 PRD §4-§6 局部偏差
workflow: BMAD-METHOD · post-PRD codebase audit
related:
  - prd-v6-ace-lite-feedback-loop.md（被本文档修正的对象）
  - preflight-v6-ace-lite-feedback-loop.md（5 决策点签字）
---

# v6 epic · CA · Codebase Analysis

## 0. TL;DR

PRD 主体准确（v6 epic 大部分是 NEW 文件 · 偏差风险低）。仅在 §4-§6 引用的若干 **类型字段 / 输出结构 / 触发位置** 存在局部偏差。本 CA 修正 4 处偏差并给出 PR-1/2/3 准确文件清单。

**结论**：v6 epic 仍可执行；实际改动量 ~265 行（PRD 估 250 · 略超）；CA §3 的 diff 预览全部基于实际代码现状。

---

## 1. PRD 偏差修正

### 1.1 ScoreCard 维度数（PRD §0/§1.1 偏差）

```
PRD §0 / §1.1 写"ScoreCard 7 维分数"

实际现状（src/pipeline/scoreCard.ts）：
  ScoreCard.dimensions: Record<ScoreDimension, DimensionScore>
  
  7 个维度（gap-c 加 transition 后）：
    ├─ genre / method / kbRedline / craft / r1Align / userKbStyle / transition
    └─ 其中 r1Align / userKbStyle / transition 部分 LLM 评估
  
PRD 写"7 维"正确。但需要明确 ScoreCard.dimensions 是 Record（不是数组）。

→ 修正：reflector signal 收集时用 Object.entries(scoreCard.dimensions) 遍历
```

### 1.2 ConsistencyReport 不是 issue 数组（PRD §4.2 偏差）

```
PRD §4.2 reflector.ts 收集 consistencyCheck 信号时
  signal = ConsistencyIssue[]  // ❌

实际现状（src/pipeline/consistencyCheck.ts）：
  ConsistencyReport {
    ts, assetCount, storyboardUnits, knownNames, mentions,
    issues: ConsistencyIssue[],   // ★ 真正的 issues 在这里
    verdict: 'pass' | 'warn' | 'fail',  // ★ 三档总结
  }

→ 修正：collectFailureSignals 应取 report.issues + report.verdict
       触发条件：report.verdict !== 'pass' OR report.issues.length > 0
```

### 1.3 novelLoop polish 入口名（PRD §4.3 偏差）

```
PRD §4.3 写"在现有 N3.2 章节润色完成后追加"

实际现状（src/pipeline/novelLoop.ts）：
  function runNovelChapterPolishLoop(opts: RunNovelChapterPolishOptions)
  内部已调用 runCharacterStateExtraction（gap-b · novel.7 source）

→ 修正：v6 reflector 触发点 = runCharacterStateExtraction 调用之后
       同位置追加 if (settings.reflectorThresholds.enabled) { runReflector(...) }
       不阻塞 polish loop（与 character state extraction 同模式）
```

### 1.4 prompt manifest 结构（PRD §5.1 / §9.2 偏差）

```
PRD §5.1 / §9.2 写"public/prompts/manifest.json +5 行（注册 novel.9）"

实际现状（public/prompts/manifest.json）：
  {
    "version": "1.0",
    "stages": [
      {
        "id": "novel",
        "steps": [
          { "id": "novel.0", ... },
          ... 8 个 step ...
        ]
      }
    ]
  }
  
注册 novel.9 step 实际行数：~10 行（含 id/index/title/prompt/outFormat/sysLen/usrLen 字段）

→ 修正：novel manifest 注册 ~10 行（不是 5 行）· 整体行数估算 +5
```

---

## 2. 实际文件清单（v6 涉及）

### 2.1 改动 / 新建文件（11 个）

| # | 文件路径 | 类型 | 行数 | 阶段 |
|:---:|---|:---:|:---:|---|
| F1 | `public/prompts/novel/9.json` | NEW prompt | ~30 | PR-1 |
| F2 | `public/prompts/manifest.json` | MOD | +10 (注册 novel.9 step) | PR-1 |
| F3 | `src/pipeline/reflector.ts` | NEW pipeline | ~85 | PR-1 |
| F4 | `src/store/reflectorLessons.ts` | NEW store | ~75 | PR-1 |
| F5 | `src/store/db.ts` | MOD | +13 (v7 stores · CK I-3) | PR-1 |
| F6 | `src/store/settings.ts` | MOD | +12 (reflectorThresholds + 默认值 + 注释) | PR-1 |
| F7 | `src/pipeline/novelLoop.ts` | MOD | +18 (trigger reflector hook · 同 character state extraction 模式) | PR-1 |
| F8 | `.gitignore` | MOD | +1 (`!public/prompts/novel/9.json`) | PR-1 |
| F9 | `src/components/ReflectorLessonsPanel.tsx` | NEW UI | ~110 | PR-2 |
| F10 | `src/store/reflectorLessonsPanel.ts` | NEW store | ~25 | PR-2 |
| F11 | `src/components/Novel.tsx` | MOD | +5 (mount panel) | PR-2 |
| F12 | `docs/dogfood-log.md` | MOD | +50 (v6 epic 完成 section) | PR-3 |

**总计**：~265 行 · PR-1 ~165 / PR-2 ~140 / PR-3 ~50（含 docs）。
代码增量：~265 行（略超 PRD 估 250 · CA §1.4 修正 +10 + UI store +25 是合理范围）。

### 2.2 不需要改的文件（验证清单）

| 文件 | 不改理由 |
|---|---|
| `public/prompts/novel/3.1.json` | gap-c R1 严守 |
| `public/prompts/novel/3.2.json` | gap-c R1 严守 |
| `public/prompts/novel/3.3.json` | v5 已改 · v6 不再动 |
| `public/prompts/novel/{0,1.1,1.2,1.3,2.x}.json` | gap-c R1 严守 |
| `src/pipeline/scoreCard.ts` | gap-c R2 · 仅读取 |
| `src/pipeline/consistencyCheck.ts` | 仅读取 ConsistencyReport |
| `src/pipeline/characterStates.ts` (pipeline) | v5 CK I-5 严守 · 仅读取 |
| `src/pipeline/runner.ts` | gap-d 红线 R4 |
| `src/components/character/CharacterTimelineView.tsx` | gap-b PR-3 R5 |
| `src/components/CharacterBible.tsx` | v5 已改 · v6 不再动 |

---

## 3. 改动详情（diff 预览）

### 3.1 F1 · `public/prompts/novel/9.json` (NEW · ~30 行)

```jsonc
{
  "messages": [
    {
      "role": "system",
      "content": "你是叙事流水线的 Reflector 角色...（PRD §4.1 完整 system 文本）"
    },
    {
      "role": "user",
      "content": "## 本章正文（第 {{ chapterIndex }} 章）\n{{ chapterContent | truncate:3000 }}\n\n## 失败信号\n{{ failureSignals | json }}\n\n## 当前启用的 method modules\n{{ activeModuleIds | join:',' }}\n\n请输出 lesson JSON。"
    }
  ],
  "temperature": 0.4,
  "max_tokens": 600,
  "stream": false
}
```

### 3.2 F2 · `public/prompts/manifest.json` (+10 行)

```jsonc
// 在 novel stage 的 steps 数组末尾追加（与 novel.0/1.1/2.x/3.x 同结构）
{
  "id": "novel.9",
  "index": 9,
  "title": "Reflector · 失败反思 lesson 提炼",
  "prompt": "prompts/novel/9.json",
  "outFormat": "json",
  "sysLen": 800,
  "usrLen": 200
}
```

### 3.3 F3 · `src/pipeline/reflector.ts` (NEW · ~85 行)

```ts
// 类型 + 5 个核心函数
export interface RunReflectorOpts { /* project / artifacts / settings / projectId / chapterIndex / source / signal */ }
export type RunReflectorResult = { ok: true; lessonId: number } | { ok: false; error: string };
export interface FailureSignals { /* scoreCardScores? / consistencyIssues? / staleChapterRange? / userFeedbackText? */ }
export interface ReflectorThresholds { enabled: boolean; scoreCardMin: number; ... }

export async function runReflector(opts: RunReflectorOpts): Promise<RunReflectorResult>;
export function shouldTriggerReflector(signals: FailureSignals, thresholds: ReflectorThresholds): boolean;
async function collectFailureSignals(projectId: number, chapterIndex: number, source: 'novel.6' | 'novel.7', artifacts: ArtifactMap): Promise<FailureSignals>;
async function callReflectorLLM(signals: FailureSignals, chapterContent: string, activeModuleIds: string[], step: ManifestStep, ctx: PipelineContext): Promise<{ lessonContent: string; suggestedModule: string | null }>;
function parseReflectorResponse(content: string): { lessonContent: string; suggestedModule: string | null } | null;
```

→ **完全独立模块** · 不修改现有 pipeline 任何文件（除 novelLoop hook）。

### 3.4 F4 · `src/store/reflectorLessons.ts` (NEW · ~75 行)

```ts
// 完全 PRD §5.1 设计 · 5 个 helpers
export type LessonStatus = 'pending' | 'approved' | 'rejected' | 'committed';
export type SignalType = 'scoreCard' | 'consistencyCheck' | 'readerLayer' | 'userFeedback';
export interface ReflectorLesson { /* PRD §5.1 完整字段 */ }

export async function upsertReflectorLesson(rec: Omit<ReflectorLesson, 'id' | 'ts'>): Promise<number>;
export async function listLessonsByStatus(projectId: number, status: LessonStatus): Promise<ReflectorLesson[]>;
export async function listLessonsByChapter(projectId: number, chapterIndex: number): Promise<ReflectorLesson[]>;
export async function updateLessonStatus(id: number, newStatus: LessonStatus, opts?: { committedTo?: string; reviewNote?: string }): Promise<void>;
export async function clearProjectLessons(projectId: number): Promise<void>;
```

### 3.5 F5 · `src/store/db.ts` (+13 行 · v7)

```ts
// 在 v6 stores 块之后追加（v6 stores 字符串完全保留 · CK I-3 严守）
this.version(7).stores({
  projects: '++id, name, createdAt, status',
  artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
  liveArtifacts: '&nodeId, stageId, ts',
  runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
  userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
  userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
  liveRefinementUndo: '++id, ts, [chapterIndex+source]',
  characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
  // ★ v7 NEW
  reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts, [projectId+status], [projectId+chapterIndex]',
});
```

→ **v1-v6 stores 0 字符串变更 · 仅追加 1 表 · CK I-3 严守**。

### 3.6 F6 · `src/store/settings.ts` (+12 行)

```ts
// 在 SettingsState interface 内追加（与 enableCharacterStateExtraction 同模式）
/** v6 epic · ACE-lite Reflector 阈值 · 默认 disabled · opt-in。 */
reflectorThresholds: {
  enabled: boolean;
  scoreCardMin: number;
  consistencyCheckTriggerOnAny: boolean;
  readerLayerStaleChapterCount: number;
  userFeedbackEnabled: boolean;
};

// DEFAULTS 内追加
reflectorThresholds: {
  enabled: false,                     // CK I-4 默认 disabled
  scoreCardMin: 6,
  consistencyCheckTriggerOnAny: true,
  readerLayerStaleChapterCount: 5,
  userFeedbackEnabled: true,
},
```

### 3.7 F7 · `src/pipeline/novelLoop.ts` (+18 行)

```ts
// 在 runNovelChapterPolishLoop 内 · 已有的 runCharacterStateExtraction 调用之后追加：

// v6 epic · ACE-lite Reflector hook（默认 disabled · settings 控制）
if (settings.reflectorThresholds.enabled) {
  try {
    const { runReflector } = await import('./reflector');
    runReflector({
      project,
      artifacts,
      settings,
      projectId: PROJECT_ID,
      chapterIndex,
      source: 'novel.7',
      signal,
    }).catch((e) => console.warn('[v6] reflector failed:', e));
    // 不阻塞 polish loop · 与 character state extraction 同模式
  } catch (e) {
    console.warn('[v6] reflector hook failed:', e);
  }
}
```

→ **add-only · 不修改现有逻辑 · 默认 disabled 时 0 影响**。

### 3.8 F8 · `.gitignore` (+1 行)

```diff
  public/prompts/*
  !public/prompts/.gitkeep
  # v5 epic · gap-c R1 豁免 · 仅 N3.3 prompt 进版本库（CK I-6）
  # 说明：父目录用 /* 模式 · 子目录例外才能生效（git ignore 规则）
  !public/prompts/novel/
  public/prompts/novel/*
  !public/prompts/novel/3.3.json
+ !public/prompts/novel/9.json
```

### 3.9 F9 · `src/components/ReflectorLessonsPanel.tsx` (NEW · ~110 行)

```tsx
// PRD §6 完整设计：
//   - Header (collapsed + summary)
//   - Toolbar (status filter / signal filter / batch actions)
//   - Lesson list (each row: chapter + signalType + preview + suggestedModule + actions)
//   - Detail modal (full lessonContent edit + status update)
//   - Empty state / disabled state fallback
```

### 3.10 F10 · `src/store/reflectorLessonsPanel.ts` (NEW · ~25 行)

```ts
// zustand store · localStorage 持久化（与 useCharacterBible 同模式）
export const useReflectorLessonsPanel = create<...>()(persist(
  (set) => ({
    collapsed: true,
    statusFilter: 'pending' as LessonStatus | 'all',
    signalTypeFilter: 'all' as SignalType | 'all',
    selectedLessonId: null as number | null,
    toggleCollapse: () => set((s) => ({ collapsed: !s.collapsed })),
    setStatusFilter: (s) => set({ statusFilter: s }),
    setSignalTypeFilter: (s) => set({ signalTypeFilter: s }),
    selectLesson: (id) => set({ selectedLessonId: id }),
  }),
  { name: 'flil:reflector-lessons:state' },  // CK I-6 类似（独立 localStorage key）
));
```

### 3.11 F11 · `src/components/Novel.tsx` (+5 行)

```tsx
// 在 CharacterBible mount 之后追加
import { ReflectorLessonsPanel } from './ReflectorLessonsPanel';

// JSX
<CharacterBible />
<ReflectorLessonsPanel />  // ★ v6 NEW · 独立面板（5 决策点 Q3 ✅ a）
```

---

## 4. 红线审计

### 4.1 全 8 条红线对 v6 epic 的影响

| # | 红线 | v6 状态 | 实测证据 |
|:---:|---|:---:|---|
| R1 (gap-c) | 不改 `public/prompts/novel/*.json` | ✅ **不豁免** | git diff prompts/novel/ → 仅 NEW 9.json · 现有 0 改动 |
| R2 (gap-c) | 不改 ScoreCard 维度 | ✅ 不影响 | scoreCard.ts diff = 0 |
| R3 (CK #1) | Dexie v1-v6 stores 0 变更 | ✅ 完全遵守 | v7 stores 字符串 = v6 + 1 新表 |
| R4 (gap-d #4) | 不改 runner.ts | ✅ 不影响 | runner.ts diff = 0 |
| R5 (gap-b PR-3) | CharacterTimelineView 视觉风格保持 | ✅ 不影响 | 独立面板 · 不嵌入 |
| R6 (testing) | 不删 / 不弱化既有 tests | ✅ 不影响 | 0 测试改动 |
| R7 (v5 CK I-1) | readerLayer 字段全可选 | ✅ 严守 | 仅读取 readerLayer |
| R8 (v5 CK I-3) | v6 stores 字符串 = v5 | ✅ 严守 | v7 内 v6 段字符串 = v5 段 |

### 4.2 关键差异 vs v5 epic

```
v5 epic：
  ✗ 触发 gap-c R1 豁免（仅 3.3.json system content）
  ✓ 严守其它红线

v6 epic：
  ✓ 0 红线豁免（NEW prompt + NEW pipeline + NEW UI · 无修改现有受保护文件）
  ✓ 完全 add-only · "纯加法" epic
```

---

## 5. 不变量候选（CK 来源）

```
I-1 · novel.9（Reflector）prompt 输出 strict JSON · 含 lessonContent + suggestedModule
       理由：reflector.ts parseReflectorResponse 必须 deterministic

I-2 · reflectorLessons 表 add-only · v7 stores 字符串 = v6 stores + 1 新表
       理由：CK 红线 R3 / R8 严守

I-3 · v6 epic 不自动写入任何 method module · 100% 用户手动 commit
       理由：保护 prompt 系统 · 防止 ACE context collapse 风险

I-4 · settings.reflectorThresholds.enabled 默认 false
       理由：v6 epic 是 opt-in · 不破坏现有用户体验

I-5 · 现有 prompt JSON（N1.x / N2.x / N3.1 / N3.2 / N3.3）0 行修改
       理由：gap-c R1 不豁免

I-6 · ReflectorLessonsPanel 是新独立面板 · 不嵌入 CharacterBible
       理由：避免与 v5 reader viewMode 冲突 · 保持各自纯净

I-7 · scoreCard.ts / consistencyCheck.ts / characterStates.ts pipeline 层 0 行修改
       理由：仅作为信号源被 reflector.ts 读取

I-8 · novel.9 LLM 调用失败时 · novelLoop polish 不阻塞 · console.warn 即可
       理由：reflector 是辅助功能 · 不应破坏主流程
```

---

## 6. PR 拆分细化（修正 PRD §9）

### 6.1 PR-1 · schema + Reflector pipeline（核心）

```
范围：~165 行 · 8 文件
  ├─ F1  public/prompts/novel/9.json                     NEW    ~30 行
  ├─ F2  public/prompts/manifest.json                    MOD    +10 行
  ├─ F3  src/pipeline/reflector.ts                       NEW    ~85 行
  ├─ F4  src/store/reflectorLessons.ts                   NEW    ~75 行
  ├─ F5  src/store/db.ts                                 MOD    +13 行
  ├─ F6  src/store/settings.ts                           MOD    +12 行
  ├─ F7  src/pipeline/novelLoop.ts                       MOD    +18 行
  └─ F8  .gitignore                                      MOD    +1 行

总计：~244 行（含 NEW 文件全文）· 净增 ~56 行（PR diff 视角 · 不计 NEW 文件全文行数）
验证：
  □ pnpm tsc 通过 · vite build errs=0
  □ dexie v6→v7 自动迁移 · 旧 row 兼容
  □ reflector LLM 跑一次 · lesson 入 reflectorLessons 表
  □ settings disabled 时 · novelLoop 不触发 reflector
commit: feat(v6): PR-1 ACE-lite Reflector pipeline + reflectorLessons schema (Dexie v7)
```

### 6.2 PR-2 · ReflectorLessonsPanel UI

```
范围：~140 行 · 3 文件
  ├─ F9  src/components/ReflectorLessonsPanel.tsx       NEW    ~110 行
  ├─ F10 src/store/reflectorLessonsPanel.ts             NEW    ~25 行
  └─ F11 src/components/Novel.tsx                       MOD    +5 行

总计：~140 行
验证：
  □ vite build errs=0
  □ panel 默认折叠 · 展开后显示 lessons 列表
  □ status / signalType filter 正常工作
  □ 详情 modal 编辑 + 批准 / 驳回 · status 正确更新
  □ enabled=false 时 panel 显示 italic 提示
commit: feat(v6): PR-2 ReflectorLessonsPanel UI (independent panel · human curator)
```

### 6.3 PR-3 · dogfood log + 文档

```
范围：~50 行 · 1 文件
  └─ F12 docs/dogfood-log.md                            MOD    +50 行 (v6 epic section)

commit: docs(v6): PR-3 dogfood log + lessons learned (v6 epic complete · awaiting user dogfood)
```

---

## 7. 风险更新（vs PRD §11）

### 7.1 PRD R-M4（dexie 升级异常）→ 实际风险归零

```
PRD 担心：v6 → v7 schema 升级 upgrade error 风险

实际审计：
  □ v7 stores 字符串 = v6 stores + 1 新表
  □ reflectorLessons 是首次出现 · 不冲突
  □ dexie 不需 upgrade fn
  □ 旧 row 完全兼容（reflectorLessons.length = 0 即可）

→ 风险等级：低 → 0（消除）
```

### 7.2 新风险（CA 新增）

| ID | 风险 | 概率 | 影响 | 缓解 |
|:---:|---|:---:|:---:|---|
| R-M5 | reflector.ts 在 novelLoop 内 dynamic import 失败 | 低 | 中 | F7 用 try/catch · console.warn · 不阻塞 |
| R-M6 | F11 Novel.tsx mount 顺序错（在 CharacterBible 之前）| 低 | 低 | 视觉测试 · CK I-6 独立面板 |
| R-L5 | F8 .gitignore 例外不生效 | 低 | 中 | git check-ignore 验证（与 v5 同流程）|

---

## 8. 验证计划

### 8.1 PR-1 验收

```
□ pnpm tsc 通过
□ pnpm build 通过 · errs=0
□ dev 启动 · dexie 自动从 v6 迁移到 v7 · console 无 error
□ settings.reflectorThresholds 出现在 store · 默认 enabled=false
□ 手动开 enabled=true · 跑一次 N3.2 polish · 看 console 是否触发 runReflector
□ reflectorLessons 表查询正常（dexie 控制台）
□ git diff prompts/novel/ 只显示 9.json（CK I-5 验证）
```

### 8.2 PR-2 验收

```
□ vite build errs=0
□ Novel 页 ReflectorLessonsPanel 默认折叠
□ 展开 · 显示 "无待审阅" / lesson 列表
□ status filter 切换 · 列表正确刷新
□ 详情 modal 编辑 · 保存修改不改 status
□ 批准 / 驳回 · status 正确更新
□ enabled=false 时 · panel 显示 italic 提示
□ R5 验证：CharacterTimelineView 视觉与 v5 一致
```

### 8.3 PR-3 dogfood 验收

```
□ QvQ 实跑 N3.2 polish（≥ 5 章项目）· 至少 1 章触发 reflector
□ Reflector LLM 输出 lesson 100-300 字 · suggestedModule 在 active modules 中
□ 用户在 Panel 中编辑 lesson + 批准 + 标记 committed
□ 用户主观评估：lesson 质量（pass review rate）
□ tokens 增加监控（应 < 20%）
```

---

## 9. CA 自检

```
□ §1 PRD 偏差全部修正（4 处 · ScoreCard 维度 / ConsistencyReport / polish 入口 / manifest 行数）
□ §2 实际文件清单准确（11 改 / 新建 + 10 不改）
□ §3 每个 F 文件的 diff 预览可执行
□ §4 红线审计含 0 豁免声明
□ §5 不变量候选 8 条（CK 来源）
□ §6 PR-1/2/3 行数细化
□ §7 风险更新（R-M4 消除 / R-M5/6/L5 新增）
□ §8 验证计划三段（PR-1/2/3）
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v6 epic 的 BMAD Stage 2 CA · 修正 PRD §4-§6 局部偏差并给出准确文件清单。
**下游**：CK（code-knowledge-v6-ace-lite-feedback-loop.md）+ PR-1/2/3 实施。
