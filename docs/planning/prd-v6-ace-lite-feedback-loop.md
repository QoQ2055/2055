---
project: fili-web
epic: v6-ace-lite-feedback-loop
stage: BMAD Stage 2 · PRD only (CA + CK pending follow-up sessions)
author: QvQ + Cascade
date: 2026-05-07
audience: 自己（QvQ）+ AI 协作者（Cascade）
status: draft · 5 决策点已签字 · 等评审
workflow: BMAD-METHOD · QQ short-form PRD
related:
  - preflight-v6-ace-lite-feedback-loop.md（v6 设计基础 · 5 决策点已签字 2026-05-07 16:33）
  - public/methods/agentic-context-engineering.md（batch-15 · ACE 三角色方法论）
  - public/methods/dual-layer-archive-method.md（batch-12 · 双层信号源）
  - prd-v5-dual-layer-archive.md（v5 epic 已完成 · readerLayer 提供信号）
  - public/prompts/novel/3.3.json（v5 N3.3 prompt · v6 不改）
  - src/pipeline/scoreCard.ts（信号源 · v6 不改）
  - src/pipeline/consistencyCheck.ts（信号源 · v6 不改）
  - src/pipeline/characterStates.ts（信号源 · v6 不改）
red_line_exemption: 无（v6 = 0 红线豁免）
---

# v6 epic · ACE-lite 反馈闭环

## 0. TL;DR

让 fili-web 的"自动失败信号"（ScoreCard 低分 / consistencyCheck 硬伤 / readerLayer 长期 stale / 用户 dogfood 反馈）**不再止步于"显示给用户"**，而是触发 **Reflector LLM step (novel.9)** 提炼"具体改进 lesson" → 写入 `reflectorLessons` Dexie 表（v7 add-only）→ UI **ReflectorLessonsPanel** 列出 pending lessons → 用户 **人工审阅 + git commit** 把高质量 lesson 追加到对应 method module 的 "common pitfalls" 段。

这是 ACE 三角色（Generator / Reflector / Curator）中 **Layer 1 浅集成** 路径：
- **Generator**：复用现有 N3.1/N3.2/N3.3（100% 复用）
- **Reflector**：新建 novel.9 LLM step（v6 主交付）
- **Curator**：用户人工审阅 + 手动 commit（不自动改 method modules · 守住所有红线）

预计：~10 小时 / 3 PR / src 增量 ≤ 250 行 / 0 现有 prompt JSON 修改 / 1 NEW prompt（novel.9）/ Dexie v6 → v7 add-only / **0 红线豁免**。

---

## 1. Context · 为什么现在做

### 1.1 当前痛点（v5 epic 完成后发现）

QvQ 长篇写作（v5 epic 已落地 readerLayer 后）观察到：

- **失败信号孤立**：ScoreCard 第 5 章某维度 < 5 分 · 用户看到 · 然后呢？下次写 N+1 章 · LLM 还会犯同样错
- **consistencyCheck 硬伤反复**：检测到"主角左手开锁"（与 N1.2 Bible "左手残疾"矛盾）· 第 N+1 章再次"左手吃饭"
- **readerLayer 伏笔失效**：第 5 章 whatImWondering = "X 的身世" · 第 8/9/10 章未揭晓 · readerLayer 持续显示"在猜" · 但 LLM 不知道"伏笔积压"
- **dogfood-log 反馈不进 prompt**：用户记录"第 7 章节奏太赶" · 第 12 章再赶
- **method modules 设计偏静态**：74 个模块全人工维护 · 每个项目应有的"专属 pitfalls"无处累积

→ 缺一个**从失败到学习**的回路：信号 → 提炼 → 应用

### 1.2 ACE 论文给出的解决方案

`public/methods/agentic-context-engineering.md`（batch-15 · arXiv 2510.04618）核心：

```
Generator   →   Reflector   →   Curator
  写章节         反思失败          整理写回

ACE 实证：
  AppWorld agent benchmark：+12.3%（vs ICL）· +14.8%（无 ground-truth）
  financial benchmark：+10.9% offline · +6.2% online
  
关键 caveat：依赖可靠 feedback signals
  → fili-web 已有：ScoreCard / consistencyCheck / readerLayer / dogfood
```

### 1.3 v5 epic 已铺路的部分

```
v5 epic（dual-layer-archive · 已完成）落地：
  ✅ readerLayer 4 字段（whatISaw/whatIKnow/whatImWondering/keyUnderstanding）
  ✅ characterStates 累积每章状态
  ✅ schema fallback 友好（v6 epic 0 风险触碰 v5 不变量）

→ v6 直接复用 v5：
   - readerLayer 跨章节变化是 Reflector 关键信号
   - 第 5 章 whatImWondering 在第 8/9/10 章不变 → 触发"伏笔积压"lesson
```

### 1.4 为什么是 v6 而不是 v7+/gap-x

按 epic 编号：
- ✅ gap-a / gap-b / gap-c / gap-d / gap-e / gap-f / v5 = 已落地或部分落地
- 🆕 **v6 = ACE Layer 1 浅集成**（本 epic）
- 🟡 v7 = ACE Layer 2（v5 readerLayer 加 helpful/harmful counter）· 见 §15 Q5 决策
- 🔴 v8/v9 = ACE Layer 3（自动 Curator）· 远期

**v6 优先于 v7/v8/9 的理由**：
- v6 完整守红线（0 豁免）· v7+ 触红线
- v6 工程量 ~10h · v8/9 大工程 ~25h
- v6 验证 Reflector 价值（lesson 质量）· 验证后再决定要不要 v7+
- 渐进式 · 失败可立即回退（仅一个新 LLM step）

### 1.5 现有可复用资产（**preflight 已审计**）

| 资产 | 路径 | 复用方式 |
|---|---|---|
| ScoreCard 7 维 | `src/pipeline/scoreCard.ts` | **只读** · 不加新维度（R2 严守）|
| consistencyCheck 输出 | `src/pipeline/consistencyCheck.ts` | **只读** · 提取硬伤数组 |
| characterStates 表 | `src/store/db.ts` v5 schema | **只读** · 抓 readerLayer 跨章变化 |
| novel pipeline runStep | `src/pipeline/runner.ts` | 调用新 novel.9 step（gap-d R4 不触碰）|
| settings store | `src/store/settings.ts` | add-only 加 reflectorThresholds |
| dogfood-log.md | `docs/dogfood-log.md` | 记录 lesson 审阅历史 |
| .gitignore 规则 | `.gitignore`（v5 已加例外）| 复制模式 · 加 novel.9 例外 |

→ **不重造** ScoreCard / consistencyCheck / pipeline / persistence / settings 任何一个。

---

## 2. User Stories

### 2.1 主线 (MUST)

> **US-1**：作为写到第 8 章的 QvQ · 我跑 N3.2 章节润色后 · 系统检测到 ScoreCard 某维度 < 6 → 自动跑 Reflector LLM step (novel.9) · 提炼出 lesson "本章主角心理描写过于直白 · 缺少身体语言铺垫 · 建议下一章试用 anti-ai-flavor-rules 第 3 段技巧" · 落入 reflectorLessons 表 · status='pending'。

> **US-2**：我打开 Novel 页 ReflectorLessonsPanel（独立面板 · 默认折叠）· 看到 "3 pending lessons" · 展开后每条 lesson 一行（章节序号 + 信号类型 + lesson 预览 + 建议 method module）。

> **US-3**：我点击 lesson 详情 · 看到完整 100-300 字 lesson · 编辑文字 · 点 "批准" → status='approved'。

> **US-4**：我手动打开 `public/methods/anti-ai-flavor-rules.md` · 把 lesson 加到 "common pitfalls" 段 · git commit · 在 ReflectorLessonsPanel 点 "标记已 commit" → status='committed'。

> **US-5**：未来我写第 12 章 · LLM 在 N3.1 草稿读到 method module（含已 committed 的 pitfall）· 主动避免该错误。

### 2.2 次线 (SHOULD)

> **US-6**：批量操作：我点 "全选 reject" 把不喜欢的批量驳回。

> **US-7**：阈值调整：我在 settings 调高 `scoreCardMin`（默认 6 → 5）· 减少 reflector 触发频率。

> **US-8**：dogfood-log.md "Reflector lessons" 子区自动追加 lesson 历史（按 status 分组）。

### 2.3 不做 (OUT)

> **OUT-1**：自动写入 method modules → 留 v8/v9 epic（保护 prompt 系统）  
> **OUT-2**：v5 readerLayer 加 helpful/harmful counter → 留 v7 epic（5 决策点 Q5 签字 不一起做）  
> **OUT-3**：跨项目共享 lessons → 留远期 epic（隐私 + IP 风险评估）  
> **OUT-4**：实时反馈 LLM（Reflector 输出立即注入下一章 prompt）→ 红线 R1 完全保护现有 prompt JSON  
> **OUT-5**：自动检测 method module 冲突 → 用户审阅环节兜底  
> **OUT-6**：Reflector 多 epoch 优化 → 保持单次提炼 · 简化  

---

## 3. Goals & Non-Goals

### 3.1 Goals

- ✅ 新建 novel.9 prompt（NEW · 不改现有 N3.x · 不豁免 R1）
- ✅ 新建 `src/pipeline/reflector.ts`（Reflector LLM step + JSON 解析）
- ✅ 新建 `src/store/reflectorLessons.ts`（CRUD + Dexie row 类型）
- ✅ Dexie v6 → v7 add-only（仅加 reflectorLessons 表）
- ✅ settings 加 reflectorThresholds（默认 disabled · opt-in）
- ✅ novelLoop 加 reflector 触发 hook（N3.2 完成后 · 阈值满足时）
- ✅ ReflectorLessonsPanel UI（独立面板 · 默认折叠 · 5 决策点 Q3 签字）
- ✅ dogfood-log.md "Reflector lessons" 子区
- ✅ vite errs=0 / dexie 旧 row 兼容 / 0 现有红线触碰

### 3.2 Non-Goals

- ❌ 不改现有 prompt JSON（N1.x / N2.x / N3.1 / N3.2 / N3.3）
- ❌ 不改 ScoreCard 维度
- ❌ 不改 pipeline/runner.ts
- ❌ 不改 v5 readerLayer schema
- ❌ 不自动写入 method modules（人工 Curator）
- ❌ 不修改 method modules 的现有内容
- ❌ 不改 CharacterTimelineView / CharacterRelationGraph 视觉

---

## 4. Reflector LLM step 设计

### 4.1 novel.9 prompt 结构（NEW · `public/prompts/novel/9.json`）

```jsonc
{
  "messages": [
    {
      "role": "system",
      "content": "你是叙事流水线的 Reflector 角色。职责：从【失败信号】+【本章正文】提炼 1 条具体可行的改进 lesson。\n\n## 输出格式（严格 JSON · 不写其它文字）\n{\n  \"lessonContent\": \"<100-300 字 · 具体到段落/角色/情节 · 含原因 + 改进 hint>\",\n  \"suggestedModule\": \"<method-module-id · 从 active modules 中选>\"\n}\n\n## lesson 要求\n- 不写泛泛建议（如 \"提升章节质量\"）\n- 必须含：哪个段落/角色/情节出问题 + 失败原因 + 下一章改进 hint\n- 字数控制：100-300 字\n- suggestedModule 从用户当前启用的 method modules 中选\n\n## 失败信号类型\n- scoreCard：某维度分数偏低（含具体维度名 + 分数）\n- consistencyCheck：硬伤列表（含矛盾点描述）\n- readerLayer：whatImWondering 跨 N 章不变（伏笔积压）\n- userFeedback：用户 dogfood 主观反馈\n\n## 行为约束\n- JSON 必须可被 JSON.parse 直接解析\n- 不臆测：信号没说的 · 不发挥"
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

### 4.2 reflector.ts pipeline（NEW · `src/pipeline/reflector.ts`）

```ts
// 主函数
export async function runReflector(opts: RunReflectorOpts): Promise<RunReflectorResult>;

// 触发条件检测
function shouldTriggerReflector(
  chapterIndex: number,
  signals: FailureSignals,
  thresholds: ReflectorThresholds,
): boolean;

// 信号收集（从 ScoreCard / consistencyCheck / readerLayer / userFeedback）
async function collectFailureSignals(
  projectId: number,
  chapterIndex: number,
  source: 'novel.6' | 'novel.7',
): Promise<FailureSignals>;

// LLM 调用 + JSON 解析
async function callReflectorLLM(
  signals: FailureSignals,
  chapterContent: string,
  activeModuleIds: string[],
  step: ManifestStep,
  ctx: PipelineContext,
): Promise<{ lessonContent: string; suggestedModule: string | null }>;

// 解析容错（与 v5 characterStates parseExtractionResponse 同模式）
function parseReflectorResponse(content: string): ReflectorLesson | null;
```

### 4.3 触发集成点（`src/pipeline/novelLoop.ts`）

```ts
// 在现有 N3.2 章节润色完成后追加：
if (settings.reflectorThresholds.enabled) {
  const signals = await collectFailureSignals(projectId, chapterIndex, 'novel.7');
  if (shouldTriggerReflector(chapterIndex, signals, settings.reflectorThresholds)) {
    runReflector({ ... }).catch((e) => console.warn('[v6] reflector failed:', e));
    // 不阻塞 novelLoop · 失败容忍
  }
}
```

### 4.4 触发阈值（来自 settings.reflectorThresholds）

```ts
{
  enabled: false,                        // 总开关 · 默认 disabled（Q2 ✅）
  scoreCardMin: 6,                       // < 6 触发
  consistencyCheckTriggerOnAny: true,    // 有任意硬伤即触发
  readerLayerStaleChapterCount: 5,       // whatImWondering 5 章不变触发
  userFeedbackEnabled: true,             // dogfood 标记触发
}
```

---

## 5. reflectorLessons schema 设计（Dexie v7）

### 5.1 ReflectorLesson 类型（NEW · `src/store/reflectorLessons.ts`）

```ts
export type LessonStatus = 'pending' | 'approved' | 'rejected' | 'committed';
export type SignalType = 'scoreCard' | 'consistencyCheck' | 'readerLayer' | 'userFeedback';

export interface ReflectorLesson {
  id?: number;
  projectId: number;
  chapterIndex: number;
  signalType: SignalType;
  /** Reflector LLM 提炼的 lesson · 100-300 字。 */
  lessonContent: string;
  /** 建议写入哪个 method module · null = LLM 没建议。 */
  suggestedModule: string | null;
  status: LessonStatus;
  /** 用户 commit 后填 · 形如 "anti-ai-flavor-rules:L120-130" */
  committedTo: string | null;
  /** 用户审阅时的备注（可选）。 */
  reviewNote: string | null;
  ts: number;
  /** 触发 lesson 的原始信号 · 调试用。 */
  signalContext: {
    scoreCardScores?: Record<string, number>;
    consistencyIssues?: string[];
    staleChapterRange?: [number, number];
    userFeedbackText?: string;
  };
}

// 5 个 helpers
export async function upsertReflectorLesson(rec: Omit<ReflectorLesson, 'id' | 'ts'>): Promise<number>;
export async function listLessonsByStatus(projectId: number, status: LessonStatus): Promise<ReflectorLesson[]>;
export async function listLessonsByChapter(projectId: number, chapterIndex: number): Promise<ReflectorLesson[]>;
export async function updateLessonStatus(id: number, newStatus: LessonStatus, opts?: { committedTo?: string; reviewNote?: string }): Promise<void>;
export async function clearProjectLessons(projectId: number): Promise<void>;
```

### 5.2 Dexie v7 stores 升级（`src/store/db.ts`）

```ts
// v6 stores 字符串完全保留（CK I-3 严守）+ 仅追加 reflectorLessons 表
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

→ **v1-v6 stores 字符串 0 行修改**（CK 红线 R3 / R8 严守 · 仅 append）。

---

## 6. ReflectorLessonsPanel UI 设计（5 决策点 Q3 ✅ a 独立面板）

### 6.1 位置 · `src/components/ReflectorLessonsPanel.tsx`

```
位置：Novel 页 · 在 CharacterBible 之后追加（独立面板 · 不嵌入）
默认状态：collapsed=true（与 CharacterBible 同模式）
localStorage key：'flil:reflector-lessons:state'
```

### 6.2 视觉结构

```
┌─ ReflectorLessonsPanel ──────────────────────────────┐
│ [icon] Reflector 待审阅 (3 pending · 1 approved · 5 committed)   [▼/▲]
│
│ [展开后]
│ ┌─ Toolbar ─────────────────────────────────────────┐
│ │ Status: [pending ▼] [approved] [rejected] [committed] │
│ │ Signal: [all ▼] [scoreCard] [consistencyCheck] ...    │
│ │ Actions: [全选 approve] [全选 reject] [清空 rejected]│
│ └────────────────────────────────────────────────────┘
│
│ ┌─ Lesson 列表 ──────────────────────────────────────┐
│ │ [章节 5] [scoreCard] [2 hours ago]
│ │ "本章主角心理描写过于直白 · 缺少身体语言铺垫..."
│ │ Suggested: anti-ai-flavor-rules
│ │ [审阅详情] [批准] [驳回]
│ │ ─────────────────────────────────────────────────
│ │ [章节 8] [readerLayer] [10 min ago]
│ │ "X 的身世伏笔已在第 5 章布下 · 8 章未揭..."
│ │ Suggested: dual-layer-archive-method
│ │ [审阅详情] [批准] [驳回]
│ └────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────┘
```

### 6.3 详情 modal

```
当用户点 [审阅详情]：
  modal 显示：
    - 完整 lessonContent（可编辑 textarea）
    - signalContext（只读 · 调试参考）
    - 建议 method module（下拉选 · 可改）
    - reviewNote（用户备注 · 可填）
    
  Actions:
    [保存修改] · 仅更新 lessonContent / suggestedModule / reviewNote · 不改 status
    [批准]    · status='approved' + 关 modal
    [驳回]    · status='rejected' + 关 modal
    [取消]    · 关 modal · 不变
    
  approved 后 modal 多一个 button:
    [打开 method module 文件]
      → 在 IDE 右键提示中开 vscode://...
      → 用户手动添加 lesson + commit
      → 回 panel 点 "标记已 commit" + 输入 committedTo 字符串
```

### 6.4 fallback / 边缘 case

```
- pending 数 = 0 时：panel 仍渲染 · summary 显示 "无待审阅"
- 切换 status filter 时：列表 re-fetch · 不卡顿
- enabled=false 时：panel 显示 italic "Reflector 未开启 · 启用 settings.reflectorThresholds.enabled"
- LLM 调用失败：lesson 不入库 · 仅 console.warn · 不阻塞用户
```

---

## 7. Constraints · 红线全清单

### 7.1 全 8 条红线对 v6 epic 的影响

| # | 红线 | 来源 | v6 状态 |
|:---:|---|---|:---:|
| R1 | 不改 `public/prompts/novel/*.json` | gap-c P1 | ✅ **不豁免** · novel.9 是 NEW · 现有 N3.x 0 改动 |
| R2 | 不改 ScoreCard 维度 | gap-c | ✅ 不影响（仅读取）|
| R3 | Dexie v1-v6 stores 0 变更 | dexie 兼容 | ✅ 完全遵守（v7 add-only · stores 字符串保留）|
| R4 | 不改 `pipeline/runner.ts` | gap-d | ✅ 不影响（runStep 已通用）|
| R5 | gap-b CharacterTimelineView 视觉风格 | gap-b PR-3 | ✅ 不影响（独立面板 · 不嵌入）|
| R6 | 不删 / 不弱化既有 tests | testing | ✅ 不影响（v6 全 add-only） |
| R7 | v5 readerLayer 全可选（CK I-1）| v5 epic | ✅ 严守（仅读取）|
| R8 | v6 stores 字符串 = v5（CK I-3）| v5 epic | ✅ 严守（v7 stores 字符串 = v6 + 1 新表）|

### 7.2 v6 epic 红线声明

```
v6 epic 是"红线友好"的纯加法 epic：
  ✅ 0 现有文件红线豁免
  ✅ 仅新建：novel.9 / reflector.ts / reflectorLessons.ts / ReflectorLessonsPanel.tsx
  ✅ 仅 add-only：db.ts (+v7) / settings.ts (+thresholds) / manifest.json (+novel.9 注册)
  ✅ 不强制启用（默认 disabled · 用户主动开）

签字：preflight §10.2 · 用户 2026-05-07 16:33 · 5 决策点全推荐确认。
```

---

## 8. Boundary · 不做的事

| # | 项目 | 理由 | 留给 |
|:---:|---|---|---|
| B-1 | 自动写入 method modules | 守护 prompt 系统（避免 ACE context collapse 风险） | v8/v9 epic |
| B-2 | v5 readerLayer 加 helpful/harmful counter | Q5 签字"不一起做" | v7 epic |
| B-3 | 跨项目共享 lessons | 隐私 + IP 风险 | 远期 |
| B-4 | 实时反馈 LLM（lesson 立即注入下一章 prompt）| R1 完全保护现有 prompt | 永远不动 / 远期豁免 |
| B-5 | 自动 method module 冲突检测 | 用户审阅兜底 | 远期（gap-i+）|
| B-6 | Reflector 多 epoch 优化 | 保持简单 · 单次提炼 | 远期 |
| B-7 | 修改现有 prompt JSON（N1.x / N2.x / N3.x）| R1 严守 | 永远不动 |
| B-8 | 修改 ScoreCard 维度 | R2 严守 | 远期（gap-h）|

---

## 9. Phasing & PR Plan

### 9.1 总览

```
v6 epic = 3 PR · 顺序串行 · 每 PR 后用户审阅
预计：~5 小时（不含 Stage 2 docs ~120 min · 不含用户 dogfood）
代码增量：≤ 250 行
```

### 9.2 PR-1 · schema + Reflector pipeline（核心）

```
范围：~120 min · ~150 行
  ├─ public/prompts/novel/9.json                NEW    ~30 行
  ├─ public/prompts/manifest.json               MOD    +5 行（注册 novel.9）
  ├─ src/pipeline/reflector.ts                  NEW    ~80 行
  ├─ src/store/reflectorLessons.ts              NEW    ~70 行
  ├─ src/store/db.ts                            MOD    +13 行（v7 stores · CK I-3）
  ├─ src/store/settings.ts                      MOD    +8 行（reflectorThresholds）
  ├─ src/pipeline/novelLoop.ts                  MOD    +15 行（trigger reflector hook）
  └─ .gitignore                                 MOD    +1 行（novel/9.json 例外）

总计：~150 行 src · ~30 行 prompt · 0 行 docs
验证：
  □ pnpm tsc 通过 · vite build errs=0
  □ dexie v6→v7 自动迁移 · 旧 row 兼容
  □ reflector LLM 跑一次 · lesson 入 reflectorLessons 表
  □ settings disabled 时 · novelLoop 不触发 reflector
commit: feat(v6): PR-1 ACE-lite Reflector pipeline + reflectorLessons schema (Dexie v7)
```

### 9.3 PR-2 · ReflectorLessonsPanel UI

```
范围：~120 min · ~120 行
  ├─ src/components/ReflectorLessonsPanel.tsx       NEW    ~100 行
  ├─ src/store/reflectorLessonsPanel.ts             NEW    ~25 行（zustand store · localStorage 持久化）
  └─ src/components/Novel.tsx                       MOD    +5 行（mount panel）

总计：~120 行 src
验证：
  □ vite build errs=0
  □ panel 默认折叠 · 展开后显示 lessons 列表
  □ status filter 正常工作（pending / approved / rejected / committed）
  □ 详情 modal 编辑 + 批准 / 驳回操作正确更新 status
  □ enabled=false 时 panel 显示 italic 提示
commit: feat(v6): PR-2 ReflectorLessonsPanel UI (independent panel · human curator)
```

### 9.4 PR-3 · dogfood log + 文档收尾

```
范围：~30 min · ~50 行 docs
  └─ docs/dogfood-log.md                          MOD    +50 行（v6 epic 完成 section）

总计：~50 行 docs · 0 src
验证：见 §10
commit: docs(v6): PR-3 dogfood log + lessons learned (v6 epic complete · awaiting user dogfood)
```

### 9.5 阶段间断点

```
Stage 2（PRD + CA + CK）完成 · 用户审阅 → 签字 PR plan → 进 Stage 3.1
PR-1 完成 · 用户启动 dev · 验证 dexie v7 + reflector LLM 跑通 → 签字 → 进 PR-2
PR-2 完成 · 用户验证 UI 视觉 + 审阅流程 → 签字 → 进 PR-3
PR-3 完成 · v6 epic 落地 · 进入 cool-down + dogfood
```

---

## 10. Success Criteria

### 10.1 功能验收

```
□ novel.9 prompt 加载成功（manifest 注册 · runStep 调用 OK）
□ Reflector LLM 提炼 lesson 100-300 字 · suggestedModule 在 active modules 中
□ reflectorLessons row 入库（v7 schema）
□ ReflectorLessonsPanel 默认折叠 · 展开后显示
□ pending / approved / rejected / committed 4 状态 UI 切换正确
□ 详情 modal 编辑 + 批准 / 驳回 · status 正确更新
□ enabled=false 时 panel italic 提示 · 不触发 reflector
□ user 手动 commit lesson 到 method module · panel 标记 committed 后 row.committedTo 填值
```

### 10.2 工程验收

```
□ vite errs=0 / vite warnings 不增加
□ pnpm tsc 通过（types 兼容）
□ dexie v6 旧 row 在 v7 schema 下可读 · 无 upgrade error
□ src 增量 ≤ 250 行（PR-1 ~150 + PR-2 ~120）
□ 0 现有 prompt JSON 修改（gap-c R1 完全保护 · 仅 NEW novel.9）
□ R2/R3/R4/R5/R6/R7/R8 全部遵守
□ pipeline/scoreCard.ts / consistencyCheck.ts / characterStates.ts 0 行修改
```

### 10.3 dogfood 验收（QvQ 长篇 ≥ 5 章）

```
□ 用户开启 settings.reflectorThresholds.enabled=true
□ 跑一次 N3.2 章节润色 · 触发 reflector
□ Reflector LLM 输出 lesson · 落入 reflectorLessons 表
□ 用户在 Panel 中看到 pending lesson
□ 用户审阅 + 批准 + 手动 commit 到 method module · 标记 committed
□ 用户主观感受：lesson 质量 ≥ 70% pass review（≥ 1 月跨度评估）
□ 累积 ≥ 10 lessons committed 后 · 主观写作体验改善（核心动机验收）
```

---

## 11. Risks · 风险登记册

### 11.1 高风险（无）

预审计无高风险（preflight §8.1 · v6 是红线友好 + 用户审阅）。

### 11.2 中风险

| ID | 风险 | 概率 | 影响 | 缓解 |
|:---:|---|:---:|:---:|---|
| R-M1 | Reflector LLM lesson 质量低 / 太泛 | 中 | 中 | system 强约束 100-300 字具体 hint · prompt 多次迭代 |
| R-M2 | 信号阈值过敏 · 每章触发 reflector | 中 | 中 | 默认 disabled · 阈值可调 · 用户审阅兜底 |
| R-M3 | 用户审阅疲劳 · pending 积压 | 中 | 低 | UI max-N 提示 · 自动驳回最旧 · 不强制 |
| R-M4 | v7 dexie 升级触发用户数据迁移异常 | 低 | 高 | add-only · 仅追加表 · 0 字段改动 · v6 完成后双向回滚测试 |

### 11.3 低风险

| ID | 风险 | 缓解 |
|:---:|---|---|
| R-L1 | Reflector lesson 与现有 method module 冲突 | 用户审阅时人工判断 |
| R-L2 | suggestedModule 字段建议错位 | 用户审阅时改 · 不强制采纳 |
| R-L3 | dogfood-log.md 增长过快 | 用户主动 commit · 自然控制 |
| R-L4 | tokens 增加 ~15-20%（reflector 调用）| settings disabled 时 0 影响 · 用户开启后可调阈值 |

---

## 12. Dependencies

### 12.1 上游

- **v5 epic 已完成**（readerLayer 提供主要信号源）
- **batch-15 ACE method module 已落地**（方法论文档）
- **preflight §10.2 5 决策点已签字**（2026-05-07 16:33）
- **dual-layer-archive-method.md** 已落地（batch-12 · 2026-05-07）

### 12.2 下游（v6 unblock）

- **v7 epic（layer 2 · readerLayer 加 counter）**：等 v6 完成 · 验证 reflector lesson 质量 ≥ 1 月
- **v8/v9 epic（layer 3 · 自动 Curator）**：等 v7 完成 · 验证人工审阅成本是否可降
- **gap-h epic（交叉验证）**：与 v6 正交 · 可并行（gap-h 用 v5 readerLayer · v6 用 reflector）

---

## 13. Dogfood Plan

### 13.1 准备（PR-1 完成后）

```
1. dev 环境 dexie schema 自动升级 v6 → v7
2. 在 settings 启用 enabled=true
3. 找一个 ≥ 5 章项目 · 章节有低分（ScoreCard < 6）
```

### 13.2 实操（PR-2 完成后）

```
1. 跑 N3.2 润色 · 等待 reflector LLM 输出（~10s）
2. 打开 ReflectorLessonsPanel · 看到 pending lesson
3. 点详情 modal · 阅读 lesson 内容
4. 编辑 / 批准 / 驳回
5. 手动打开 suggestedModule 文件 · 加 pitfall 段
6. git diff + commit method module · 在 panel 点 "标记已 commit"
```

### 13.3 主观评估（PR-3 dogfood-log 增量补充）

```
□ Reflector lesson 质量（pass review rate · 应 ≥ 70%）
□ 信号阈值适当（不过敏 · 不漏报）
□ 审阅 UX 流畅（不疲劳）
□ 累积 ≥ 10 lessons committed 后 · 感受写作改善
□ tokens 增加可接受（settings 阈值调节后 · 应 < 20%）
```

---

## 14. Out-of-Band Notes

### 14.1 与 ACE 论文的差异

```
ACE 论文：
  - Curator 是 LLM（可自动）
  - 每个 epoch 自动整合
  - 适用于代码生成 / 财务分析（有 ground-truth）

v6 epic（fili-web 浅集成）：
  - Curator 是用户（人工）
  - 每条 lesson 单独审阅
  - 适用于小说创作（弱 ground-truth · 主观体验）

→ v6 是 ACE 思想的"安全版" · 牺牲自动化保留控制权
→ 验证 1 月后再决定是否升级 layer 2/3
```

### 14.2 与 self-evolving-auditor 方法论的对应

```
self-evolving-auditor 是产品功能层方法论（"审核员越用越懂"）
v6 epic 是引擎层实现（Reflector + 用户 Curator）
ACE 论文是算法层方法论（Generator + Reflector + Curator 三角色）

→ 三层正交 · 互补
→ v6 epic 把 self-evolving-auditor 的产品愿景落地为代码
→ batch-15 ACE module 是算法基础
```

### 14.3 与 standing instructions 的关系

```
1. ✅ 不影响 Seedance 2.0 关注（不同领域）
2. 🟡 v6 epic 已用户主动启动（5 决策点签字）· 不违反"暂停"约定
3. ✅ push 网络协议保持
```

---

## 15. Open Questions（已签字 · 此处仅作记录）

| # | 问题 | 决策 | 时间 |
|:---:|---|---|---|
| Q1 | v6 epic 启动？ | ✅ 启动 | preflight §10.2 · 2026-05-07 16:33 |
| Q2 | settings 默认 disabled？ | ✅ 是（opt-in）| 同上 |
| Q3 | UI 面板位置？ | a · 独立面板 | 同上 |
| Q4 | novel.9 prompt 进版本库？ | ✅ 是（与 v5 同模式）| 同上 |
| Q5 | v6 同时升级 layer 2 readerLayer counter？ | 🟡 留 v7 | 同上 |

---

## 16. PRD 自检

```
□ frontmatter 完整（含 red_line_exemption: 无）
□ §0 TL;DR 一段话覆盖动机 + 范围 + 工程量
□ §1 Context 含痛点 + ACE 方法论 + v5 铺路 + 优先级 + 复用资产
□ §2 User Stories 含 MUST(5) / SHOULD(3) / OUT(6)
□ §3 Goals & Non-Goals 明确
□ §4 Reflector LLM step 设计（prompt + pipeline + trigger + 阈值）
□ §5 reflectorLessons schema 设计（v7 add-only）
□ §6 UI 设计（位置 / 视觉 / modal / fallback）
□ §7 Constraints 红线全清单 + 0 豁免声明
□ §8 Boundary 不做的事
□ §9 Phasing & PR Plan（3 PR · ≤ 250 行）
□ §10 Success Criteria 三段（功能 / 工程 / dogfood）
□ §11 Risks 高 / 中 / 低
□ §12 Dependencies（上游 / 下游）
□ §13 Dogfood Plan
□ §14 Out-of-Band（ACE 差异 / 方法论对应 / standing instructions）
□ §15 Open Questions（已签字记录）
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v6 epic 的 BMAD Stage 2 PRD · 描述目标 / 范围 / 红线 / PR 拆分。
**下游**：CA（codebase-analysis-v6-ace-lite-feedback-loop.md）+ CK（code-knowledge-v6-ace-lite-feedback-loop.md）+ PR-1/2/3 实施。
