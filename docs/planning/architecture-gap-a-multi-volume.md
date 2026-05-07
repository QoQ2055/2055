---
project: fili-web
epic: gap-a-multi-volume
stage: BMAD Stage 2 · CA (Architecture)
prerequisite: prd-gap-a-multi-volume.md
date: 2026-05-07
status: **draft · 条件触发**（CA 已写但 PRD 触发条件未满足，CK 后暂停实施）
related:
  - prd-gap-a-multi-volume.md（5 Open Q + 触发门 C-1..C-4）
  - prd-gap-b-character-bible.md（schema v5 add-only 先例）
  - architecture-gap-c-chapter-transition.md（rollingContext 增强先例）
---

# CA · gap-a · 多卷架构 · 架构与决议

> 本文档决议 PRD 5 Open Q + 锁定 schema v5→v6 add-only 路径。**CA 已写不等于实施 · PRD §1.3 触发条件未达前不进 CK 阶段**。

---

## 0. 架构总览（一图概念）

```
┌─────────────────────────────────────────────────────────────┐
│ Dexie schema v5 → v6 （PR-1 add-only · CK §2 R1 守约）         │
│   v1-v5 stores 字符串保持 0 变更                                │
│   add: volumes 表 · 复合主键 [projectId+index]                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
N2.1 分卷规划 LLM step 完成（runStep · 已存在 · 不改）
       │
       │ 触发 PR-2 · 解析 markdown → upsertVolumes(projectId, parsed)
       ▼
┌─────────────────────────────────────────────────────────────┐
│ volumes 表 first-class 持久化                                  │
│   按 projectId 索引 · 按 index 1-based 排序                     │
└─────────────────────────────────────────────────────────────┘
       │
       ├─→ ChapterList（PR-3）按 volumes.chapterRange 分组渲染
       ├─→ ProgressDashboard（PR-4）顶部 chip 行（每卷一个）
       └─→ rollingContext（PR-4 子项）跨卷判断 → "⚠ 跨卷过渡"标记

红线守护：
  R1 v1-v5 schema 0 字符变化（gap-b 经验）
  R2 N2.1 / N2.2 / N3.x prompt JSON 0 改动
  R3 gap-d / gap-b / gap-c 资产 0 diff（仅在指定锚点 add-only）
  R4 consistencyCheck.ts 不动
  R5 现有 VolumeMeta + parseVolumePlan + runVolumeLoop 不破（PR-2 仅在调用层增强）
```

---

## 1. 5 Open Question 决议（**Source of Truth**）

### Q1 · volumes 表主键设计？

**决议**：**复合主键 `[projectId+index]` + 双索引**（不用 UUID）。

**理由**：

```@C:/Users/QvQ/CascadeProjects/fili-web/src/store/db.ts:182
characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
```

gap-b PR-1 已证明此模式：
- 主键 `++id` 自增 · 复合索引 `[projectId+xxx]` 用于按项目查询
- 跨表 ref（chapter ↔ volume）通过 chapterIndex 范围匹配（不需要 UUID 关联）
- 主键 `[projectId+index]` 唯一约束防止同项目同卷号重复

**volumes 表 schema**（PR-1 落地）：

```ts
volumes: '++id, projectId, ts, [projectId+index], [projectId+chapterStart]'
//        ↑     ↑           ↑                      ↑
//        主键   按项目      按项目+卷号唯一查找    按起始章节反查所属卷
```

**否决 UUID**：(a) gap-b 已确立复合主键先例 · 一致性优先；(b) 跨表 ref 在 v3 体量内不需要稳定 ID。

---

### Q2 · N2.1 重跑时 volumes 表清写 vs merge？

**决议**：**clean wipe + toast 警告**（不做 smart merge）。

**理由**：
- gap-b PR-3 经验：`markStateStale` 后 `rerunStaleStates` 是清写覆盖，dogfood 未发现问题
- smart merge 需要保 `status` 字段（哪些卷已完成），但 `status` 实际从 chapters 推导（已完成章节数 vs 卷范围），**不需要存**
- merge 增加 ~80 src + 不一致风险 · 不值得
- 触发时序：用户重跑 N2.1 = 用户主动重新规划 → 卷边界本来就该 reset

**toast 措辞**（PR-2 落地）：
> "检测到 N2.1 重跑 · 已根据新分卷规划重置 N 卷数据 · 章节内容不受影响"

**否决 smart merge**：复杂度 vs 收益不对等。

---

### Q3 · 章节列表分组组件 = 现有 list 改 vs 新组件？

**决议**：**ChapterList in-place 改 + 加可选 volumes prop**（不抽新组件）。

**实测**：

```@C:/Users/QvQ/CascadeProjects/fili-web/src/pages/Novel.tsx:1137-1156
function ChapterList({
  chapters, draftMeta, polishMeta, filter, setFilter, ...
}) { ... }
```

**Path**：

1. ChapterList 接口 add `volumes?: VolumeRecord[]` 可选参
2. body 改造：
   ```tsx
   {volumes && volumes.length > 0 ? (
     volumes.map(vol => <VolumeGroup vol={vol} chapters={visibleInRange(vol)} ...>)
   ) : (
     visible.map(c => <ChapterRow ...>)  // 现有平铺保留为 fallback
   )}
   ```
3. 新增内部 `<VolumeGroup>` 渲染（折叠 header + 章节子列表）

**估算**：~80 src（含 VolumeGroup ~50 + 接入 ~30）。

**否决抽新组件**：
- 现有 ChapterList 内含 filter / 批准 / 撤销 / bulk 操作，**抽离会撕裂关联逻辑**
- in-place 改 + fallback 设计 = 0 回归保证

**单文件大小风险**：Novel.tsx 当前 1970 行，PR-3 后 +80 = ~2050 行，**接近但仍在容忍线**（v3 已多次 > 1900）。CK §4.3 单文件 cap 250 仅适用**新文件**，对 Novel.tsx 这种 god file 不适用（gap-b PR-3 / gap-c PR-3 都已确立）。

---

### Q4 · ProgressDashboard 卷 chip 加在哪？

**决议**：**body 顶部新增 chip 行 wrapper div**（不动现有 3 view）。

**实测**：

```@C:/Users/QvQ/CascadeProjects/fili-web/src/components/ProgressDashboard.tsx:70-100
{!collapsed && (
  <div id="progress-dashboard-body" ...>
    <div>
      <div className="text-xs text-fg-muted mb-1">章节完成度</div>
      <ChapterCompletionGrid ... />
    </div>
    <div>
      <div className="text-xs text-fg-muted mb-1">字数曲线</div>
      <WordCountTrend ... />
    </div>
    <div>
      <div className="text-xs text-fg-muted mb-1">评分卡热力图</div>
      <ScoreHeatmap ... />
    </div>
  </div>
)}
```

**注入位点**：在 L75 第一个 `<div>` 之前 add：

```tsx
<div>
  <div className="text-xs text-fg-muted mb-1">分卷进度</div>
  <VolumeChipRow volumes={volumes} aggregates={aggregates} />
</div>
```

**新组件**：`src/components/dashboard/VolumeChipRow.tsx`（PR-4 落地，~70 行）。

**风险**：CK §2 R3 红线"gap-d 资产不动" — 需要 erratum 决议。

**Erratum**：

> CK §2 R3（gap-d 资产 0 diff）允许的 add-only 例外：
> - ProgressDashboard.tsx body 内**add wrapper div**（不修现有 3 个 view 的 div / 类名 / props）
> - dashboard/ 目录 add 新文件 VolumeChipRow.tsx（add-only · 不修现有 4 个 view 文件）
>
> 此 erratum **预先批准** · 仅适用 gap-a · 实施时如发现需改现有 view → 必须停 PR 重新评估。

---

### Q5 · 跨卷过渡判断方式？

**决议**：**显式查 volumes 表**（接 `volumes?: VolumeRecord[]` prop · 不依赖 idx 推导）。

**理由**：
- chapter idx 推导假设每卷固定章数（不成立 · 第一卷可能 15 章 · 第二卷 20 章）
- volumes 表在 PR-1 后即可作为 prop 传入 buildRollingContext
- formatPrevChapterTail 增强逻辑简单（PR-4 落地，~10 行）：

```ts
// rollingContext.ts formatPrevChapterTail 内
function findVolumeOf(idx: number, vols?: VolumeRecord[]): VolumeRecord | undefined {
  return vols?.find(v => v.chapterStart <= idx && idx <= v.chapterEnd);
}

const isCrossVolume = volumes
  && findVolumeOf(prevChapter.index, volumes)?.index !== findVolumeOf(currentIndex, volumes)?.index;

const headerSuffix = isCrossVolume ? '【⚠ 跨卷过渡】' : '【⚠ 本章开头需自然衔接】';
```

**否决 idx 推导**：精度差 · 跨卷算错 = 提示词错位 = LLM 误导。

---

## 2. 红线 final-list（CK §2 收紧）

| # | 红线 | grep guard |
|:---:|---|---|
| **R1** | v1-v5 schema 0 字符变化 | `git diff HEAD -- src/store/db.ts` 仅含 v6 add 行（v1-v5 块 0 字符 diff） |
| **R2** | N1.x / N2.x / N3.x prompt JSON 0 改动 | `git diff HEAD -- public/prompts/novel/*.json` 0 lines |
| **R3** | gap-d / gap-b / gap-c **现有产物** 0 diff（**例外** Q4 erratum）| 见 §3 R3 详细 grep |
| **R4** | consistencyCheck.ts 不动 | `git diff HEAD -- src/pipeline/consistencyCheck.ts` 0 lines |
| **R5** | novelLoop.ts VolumeMeta + parseVolumePlan + runVolumeLoop **现有实现** 0 字符变化 | `git diff HEAD -- src/pipeline/novelLoop.ts` 仅 add 行（function 体不动） |

### §3 R3 详细 grep（含 Q4 erratum）

```powershell
# A. gap-d / gap-b / gap-c 严格 0 diff 的文件
git diff HEAD -- `
  src/store/projectAggregates.ts `
  src/store/dashboard.ts `
  src/store/characterStates.ts `
  src/store/characterBible.ts `
  src/components/CharacterBible.tsx `
  src/components/character/ `
  public/prompts/novel/8.json `
  src/pipeline/characterStates.ts `
  src/pipeline/scoreCard.ts `
  | Measure-Object -Line
# 期：0

# B. ProgressDashboard.tsx 允许 add-only（Q4 erratum）
# - 现有 3 个 view 渲染 0 字符变化（grep 验证）
git diff HEAD -- src/components/ProgressDashboard.tsx | Select-String '^-(?!--)'
# 期：0 删除行（add-only）

# C. dashboard/ 子目录 · 现有 4 个文件 0 diff，仅 add VolumeChipRow.tsx
git diff HEAD -- `
  src/components/dashboard/ChapterCompletionGrid.tsx `
  src/components/dashboard/WordCountTrend.tsx `
  src/components/dashboard/ScoreHeatmap.tsx `
  | Measure-Object -Line
# 期：0
```

---

## 3. 不变量 final-list（7 条）

| ID | Invariant | 验证 |
|:---:|---|---|
| **I-1** | volumes 表 add-only 模式（Dexie v5 无此表 → v6 加）| db.ts:174 v5 stores 字符串 0 字符变化；v6 stores 仅含 v5 + volumes 行 |
| **I-2** | upsertVolumes 不调 LLM | grep 新增 dexie helpers 中 0 个 `chatStream\(` 调用 |
| **I-3** | runScoreCard / 任何评分维度 0 修改（gap-c 红线传承）| `git diff HEAD -- src/pipeline/scoreCard.ts` = 0 |
| **I-4** | rollingContext.ts 增强 add-only（formatPrevChapterTail 加 isCrossVolume 分支）| 函数签名 add 一可选参；现有逻辑保留为 fallback |
| **I-5** | ChapterList 加 volumes prop = 可选 | volumes 缺失时回退现有平铺渲染（0 回归保证）|
| **I-6** | VolumeChipRow 是纯 props 视图 | 0 zustand 读取（与 gap-d ChapterCompletionGrid 同模式）|
| **I-7** | 0 新 npm 依赖 | `git diff HEAD -- package.json package-lock.json` = 0 |

---

## 4. PR 拆分 final（**Source of Truth**）

| PR | 范围 | est src | DoD |
|:---:|---|:---:|---|
| **PR-1** | Dexie v6 + volumes 表 + helpers (`upsertVolumes`, `listVolumes`, `clearVolumes`) + dev smoke | ~180 | (1) v5→v6 migration 5 步 smoke 通过；(2) `upsertVolumes` / `listVolumes` 单元正确；(3) v1-v5 stores 字符串 0 字符变化；(4) vite 0 errors / tsc baseline |
| **PR-2** | runStep('novel.2.1') 完成 hook + 自动 upsertVolumes + clean wipe + toast 警告 | ~100 | (1) N2.1 完成自动写表（grep parseVolumePlan 调用）；(2) 重跑 toast 显示；(3) parseVolumePlan 失败 → console.warn + 不阻塞 N2.2 |
| **PR-3** | ChapterList add volumes prop + VolumeGroup 内部组件 + Novel.tsx 调用接入 | ~120 | (1) 章节列表按卷折叠/展开；(2) volumes 缺失时平铺 fallback；(3) 卷标题行显示完成度；(4) 0 现有交互回归 |
| **PR-4** | dashboard/VolumeChipRow.tsx + ProgressDashboard 顶部接入 + rollingContext 跨卷标注（FR-5）| ~110 | (1) 顶部 chip 行 7 项每卷状态；(2) 点击 chip 滚到该卷；(3) rollingContext 跨卷时输出 `【⚠ 跨卷过渡】`；(4) volumes 缺失时 chip 行隐藏 |
| **PR-5** | dogfood-log gap-a 节追加 + erratum（如适用）| ~80 docs · 0 src | dogfood-log.md 顶部追加 gap-a 节（newest first 约定）|
| **累计 src** | | **~510** | （cap 600，安全边距 90）|

---

## 5. 实施细节锚点

### 5.1 PR-1 · Dexie v6 schema 改动定位

**文件**：`src/store/db.ts`（280 行 · v5 stores 不动）

**新增内容**：

```ts
// L185 之后（v5 块结束之后）add v6 块
this.version(6).stores({
  projects: '++id, name, createdAt, status',
  artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
  liveArtifacts: '&nodeId, stageId, ts',
  runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
  userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
  userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
  liveRefinementUndo: '++id, ts, [chapterIndex+source]',
  characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
  // gap-a v6 新增：
  volumes: '++id, projectId, ts, [projectId+index], [projectId+chapterStart]',
});
```

**新增 export**：

```ts
volumes!: Table<VolumeRecord, number>;

export interface VolumeRecord {
  id?: number;
  projectId: number;
  index: number;          // 1-based, 与 N2.1 卷号一致
  name: string;           // 卷名
  themeSummary?: string;  // 卷主题摘要
  chapterStart: number;   // 起始章节 idx (含)
  chapterEnd: number;     // 终止章节 idx (含)
  ts: number;
}

export async function upsertVolumes(projectId: number, vols: Omit<VolumeRecord, 'id' | 'projectId' | 'ts'>[]): Promise<void>;
export async function listVolumes(projectId: number): Promise<VolumeRecord[]>;
export async function clearVolumes(projectId: number): Promise<void>;
```

### 5.2 PR-2 · N2.1 后处理 hook 位置

需找 `runStep` 完成回调点 / 或在 `runner.ts` 中 add 后处理 hook。

实施时 grep：

```powershell
Select-String -Path src/pipeline -Pattern "stage.*'novel'.*nodeId.*'2.1'" -Include '*.ts'
```

**注入策略**：runner 完成 + nodeId === 'novel.2.1' → trigger upsertVolumes（同 gap-b PR-3 N3.2 后处理模式）。

### 5.3 PR-3 · ChapterList volumes 分组

**位点**：`Novel.tsx` L1137 ChapterList function

**改动**：

```tsx
function ChapterList({ chapters, ..., volumes }: {
  ...,
  volumes?: VolumeRecord[];
}) {
  ...
  const visible = chapters.filter(...);

  // gap-a 分组渲染
  if (volumes && volumes.length > 0) {
    return (
      <div className="rounded border border-border-subtle">
        {/* 现有 toolbar 保留 */}
        ...
        {volumes.map(vol => (
          <VolumeGroup
            key={vol.index}
            vol={vol}
            chapters={visible.filter(c => c.index >= vol.chapterStart && c.index <= vol.chapterEnd)}
            // 透传所有现有 row props
          />
        ))}
      </div>
    );
  }

  // fallback 平铺（现有逻辑）
  return /* existing render */;
}
```

### 5.4 PR-4 · VolumeChipRow + 跨卷过渡

**新文件**：`src/components/dashboard/VolumeChipRow.tsx`（~70 行）

**接入**：`ProgressDashboard.tsx` L75 之前 add wrapper div

**rollingContext 增强**：`rollingContext.ts` `RollingContextOptions` add `volumes?: VolumeRecord[]` · `formatPrevChapterTail` 接 isCrossVolume 标志生成 header

---

## 6. 估算 vs Cap

| 指标 | 实测/估算 | Cap |
|---|:---:|:---:|
| 累积 src 行 | **~510** | 600 (NFR-3) |
| 单文件 ≤ | db.ts +60 / Novel.tsx +130 / VolumeChipRow.tsx 70 | 250 ✅（god file Novel.tsx 例外）|
| PR 数 | 5 | — |
| 新依赖 | **0** | 0 ✅ |
| Schema 变更 | **v5→v6 add-only** | 单向门 + dev smoke 强制 |
| Prompt JSON 变更 | **0** | 0 ✅ |

**Erratum 预计**（CK §6）：
- ≤ 600 → pass
- 601-720 → accept + 文档化
- 721-779 → PAUSE 评估 cut FR-4 SHOULD 项
- ≥ 780 → rollback PR-4 SHOULD（仅保 PR-1+2+3 MUST）

---

## 7. CK 输入清单

CK 阶段需机械化的内容（CA 已结构化）：

- 5 红线 · grep 命令（§2）
- 7 不变量 · 验证命令（§3）
- 5 PR DoD 详表（§4）
- Q4 erratum 预批准
- 累积 ledger 公式 + 触发线（§6）

---

## 8. CA 完成 · 5 Q 全决议

| Q | 决议 | 文档锚点 |
|:---:|---|---|
| Q1 | 复合主键 `[projectId+index]` + `[projectId+chapterStart]` 反查 | §1 Q1 / §5.1 |
| Q2 | clean wipe + toast 警告 | §1 Q2 |
| Q3 | ChapterList in-place 加 volumes prop + VolumeGroup 内部组件 | §1 Q3 / §5.3 |
| Q4 | ProgressDashboard body 顶部 chip 行 + Q4 erratum 预批准 | §1 Q4 / §2.3 R3 |
| Q5 | 显式查 volumes 表（不 idx 推导）| §1 Q5 / §5.4 |

---

## 9. 状态 · CA 完成但**实施暂停**

PRD §1.3 触发条件 C-1..C-4 当前**全部未满足**。CA 已写不进 CK 实施。

**重启实施**触发：用户 dogfood 中遇到 ≥ 25 章 + 跨卷需求 → 启动 BMAD Stage 2.3 CK + Stage 4 PR-1..5。

CA 已结构化所有决议，**未来实施 session 5 分钟内可启动**。
