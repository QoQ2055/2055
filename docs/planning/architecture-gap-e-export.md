---
project: 影语 FLIL
archId: v3-gap-e-export
gapCode: e
stage: v3 (planning)
author: QvQ
date: 2026-05-06
audience: self + AI 协作者 (Cascade / Claude / Cursor / Copilot)
status: final
finalizedAt: 2026-05-06
workflow: BMAD-METHOD · CA (bmad-create-architecture)
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
nextWorkflow: BMAD-METHOD · CK (bmad-create-checkpoint) 或 IMPL（直接进 PR-1）
inputDocuments:
  - docs/planning/product-brief.md          # CB · v3 路线
  - docs/planning/prd-gap-e-export.md       # CP · 1151 行 finalize
  - DESIGN.md                               # v0.2.0-alpha 设计合约
  - AGENTS.md                               # 阶段 2.10 现状 + Dexie v4
related:
  - docs/planning/prd-gap-e-export-validation.md  # VP 阶段产物（未生成）
  - docs/planning/checkpoint-gap-e-export.md      # CK 阶段产物（未生成）
---

# Architecture · v3 缺口 e · 导出（Export）

> 本文档由 BMAD-METHOD `bmad-create-architecture` (CA) workflow 7 步逐步生成。
> CA 不复述 PRD（CP 已交付 1151 行硬约束），只把 PRD §4 FR / §5 NFR / §6 UX / §7 AC
> 翻译成 AI 协作者可机械实施的工程蓝图。

## §0 架构上下文

### 0.1 与 PRD 的边界

- **PRD = What**：1151 行硬约束（5 红线 + 7 G + 11 FR + 9 NFR + 8 AC + 5 R）
- **CA = How**：模块拆分 + 数据流 + 函数签名 + 算法 + 实施序

**CA 不重复 PRD 的任何决策**。CA 只在 PRD 留给 D1–D4 的 4 个工程决策点上做硬选择，并把所有 FR/NFR 翻译成具体类型签名 / 函数原型 / tailwind 类。

### 0.2 5 条红线（继承自 PRD §0.5）

| # | 红线 | CA 落地约束 |
|---|---|---|
| 1 | 不动 Dexie schema | 只读 `db.projects` `db.artifacts` `liveArtifacts`；零 `bulkPut` `add` `update` `delete` |
| 2 | 不动 `.flil.json` v1 | `FLIL_SCHEMA` 常量不变；`packageToBlob` 改导出后函数体不变（仅暴露） |
| 3 | 不动 `exportToAssets()` | Screenplay.tsx `lines 69-76` 函数零字节修改 |
| 4 | DESIGN.md token 强约束 | utility 缺失走 §4 tailwind config 补丁，禁 arbitrary value |
| 5 | Karpathy surgical | 新增白名单（§1）+ 修改 PR diff "纯 add line" 形态（PRD R-4 L2） |

### 0.3 PRD 留给 CA 的 4 个工程决策

| ID | 决策 | CA 解决章节 |
|---|---|---|
| **D1** | `.docx` HTML 容器 vs `docx` npm | §4.1 + spike 流程 |
| **D2** | markdown → 剧本元素识别器算法 | §3.4 状态机 + regex 优先级 |
| **D3** | csv 字段抽取规则 | §3.5 类型 `AssetRow` + 优先级链 |
| **D4** | utility 补全（`shadow-floating` 等） | §4.2 tailwind config diff |

### 0.4 技术栈（与项目现状对齐 · 不引新依赖）

```
React 18 + TypeScript 5 (strict)
└─ Vite 5 (build · 1911 modules / ~3s 基线)
└─ Tailwind CSS + DESIGN.md token-driven utility
└─ Zustand (useProject / useSettings)
└─ Dexie 4 (IDB v4 schema · 6 tables)
└─ React Router (HashRouter)
└─ lucide-react (icon)
└─ clsx (className 拼接)
```

**本 PRD 落地后 zero npm 新增**（NFR-2 + AC-8 双重锁）。lucide 仅新增已有的 `FileDown` icon（`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Screenplay.tsx:3-7` import 列表追加）。

### 0.5 现状代码资产盘点（CA 复用清单）

| 现有资产 | 锚点 | CA 复用方式 |
|---|---|---|
| `FLIL_SCHEMA` v1 + `FlilPackageV1` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts:25-42` | **零修改**复用，作为抽屉中"项目包"项的下载源 |
| `exportArchivedProjectFile(id)` | `projectExport.ts:52-111` | **零修改**复用，对应 FR-11.1 中 `.flil.json` 项 |
| `packageToBlob(pkg)` | `projectExport.ts:113-126`（**当前未 export**） | §2.4 决策：**改为 export**，提取其中 safeName + stamp 逻辑为新 helper `buildExportFilename(name, stamp, ext)`，6 种格式共用 FR-7 |
| `downloadBlob(filename, blob)` | `projectExport.ts:128-139` | **零修改**复用，6 种格式共用 |
| `useProject().artifacts: ArtifactMap` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\project.ts` zustand | live source 唯一入口（FR-1/2/3/4/5 当 scope=live 时使用） |
| `db.artifacts.where('projectId').equals(id).toArray()` | `db.ts:38-49` + `projectExport.ts:60` | archived source 唯一入口（scope=archived 时） |
| `parseLooseArray(content)` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\jsonLoose.ts` | FR-5 / FR-9 资产 JSON 解析复用 |
| `parseChapterOutlines(content)` | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\novelLoop.ts` | 仅取 `chapterTitles` 兜底，**不**用于内容拼装（直接读 `meta.chapterContents`） |
| `alert(msg)` 错误反馈惯例 | `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Home.tsx:113` `handleExportArchived` 的 catch | **沿用**：导出失败用 `alert()`；成功用 `console.log` 不打扰用户（PRD §6.4 "下载完成后保持打开"） |

### 0.6 数据形态（CA 锁死的 6 个 source 形态）

| Source | TS 类型 | 可信度 | 备注 |
|---|---|---|---|
| 项目元 ctx | `ProjectContext`（`pipeline/types`） | 高 | live=`useProject().ctx` / archived=`db.projects.get(id)` |
| 小说章节 | `Record<number, string>` (chapterContents) | 高 | live=`useProject().artifacts['novel.7']?.meta.chapterContents` 优先，回退 `novel.6` |
| 小说章节标题 | `Record<number, string>` (chapterTitles) | 中 | 缺失走 `第 ${i} 章` 兜底 |
| 剧本最终稿 | `string` (markdown) | 高 | live=`useProject().artifacts['screenplay.7']?.content` 优先，回退 `adapt.6` |
| 资产数组 | `unknown[]`（来自 `parseLooseArray`） | 低（schema 弱） | 字段映射用优先级链（FR-9 / §3.5） |
| 项目包 | `FlilPackageV1` | 高 | 走 `exportArchivedProjectFile`（archived） / 即时序列化（live → 需新 helper） |

> **形态可信度低 = 必须给降级路径**（PRD FR-10）。本 CA 在 §3.5 给 `assets` 字段抽取硬规则 + tolerance。

---

## §1 模块拓扑

### 1.1 文件白名单（NFR-7 · 不许超出）

#### 新增（4 个新文件 · 全部纯函数 / UI · 零网络 / 零 IDB 写）

```
src/
├── components/
│   └── ExportDrawer.tsx                ← UI 组件 (≤ 250 行 / FR-11)
├── store/
│   ├── exportFormats.ts                ← 6 个 build* 纯函数 (≤ 350 行 / FR-1~5)
│   └── exportFormats.test.ts           ← 单测 fixture (可选 / 优先级 ★)
└── pipeline/
    └── screenplayParser.ts             ← markdown → Element[] (≤ 200 行 / FR-8)
```

#### 修改（3 个 page patch · "纯 add line" 形态 · 每文件 diff ≤ 30 行）

| 文件 | 修改内容 | 锚点 | diff 上限 |
|---|---|---|---|
| `src/pages/Home.tsx` | 1 处 onClick 替换 + 1 个 useState + 1 个 `<ExportDrawer>` JSX | `:107-117` `:242-250` | ≤ 15 行 |
| `src/pages/Novel.tsx` | 顶部 toolbar 加 1 个 `<Button>` + 1 个 useState + 1 个 `<ExportDrawer>` JSX | `:412-505` | ≤ 15 行 |
| `src/pages/Screenplay.tsx` | toolbar 加 1 个 `<Button>` + 1 个 useState + 1 个 `<ExportDrawer>` JSX + lucide import 加 `FileDown` | `:3-7` `:309-339` | ≤ 20 行 |

#### 暴露（1 个既有文件做 minimal export 调整 · 不动逻辑）

| 文件 | 调整 | 锚点 | 说明 |
|---|---|---|---|
| `src/store/projectExport.ts` | 把 `packageToBlob` 从 `function` 改为 `export function`；新增 `export function buildExportFilename(safeName, stamp, ext)` 抽离 safeName/stamp 逻辑 | `:113-126` | 红线 #2 不破：函数体保持 byte-for-byte（仅前缀加 `export` + 抽离同款 helper） |

#### 修改（1 个 tailwind config · 仅当 D4 utility 缺失时触发）

| 文件 | 调整 | 触发条件 |
|---|---|---|
| `tailwind.config.ts` | 加 `boxShadow.floating` / `transitionTimingFunction.out-quint` 等 DESIGN.md token 缺失 utility | §4.2 spike 后确认缺失才加 |

#### 不许动（红线物理保护）

```
src/store/db.ts            ← 红线 #1 (Dexie schema)
src/pipeline/**            ← 与本 PRD 正交（FR-8 新建 screenplayParser.ts 是新增不是修改）
src/components/ui/**       ← DESIGN.md token (红线 #4)
src/store/projectExport.ts 的 export 之外的逻辑   ← 红线 #2
src/pages/Screenplay.tsx 的 exportToAssets()      ← 红线 #3
```

### 1.2 模块依赖图

```
                    ┌─────────────────────────────────────┐
                    │  pages/Home.tsx (modified)          │
                    │  pages/Novel.tsx (modified)         │
                    │  pages/Screenplay.tsx (modified)    │
                    └────────────────┬────────────────────┘
                                     │ import
                                     ▼
                    ┌─────────────────────────────────────┐
                    │  components/ExportDrawer.tsx (NEW)  │
                    │  - <ExportDrawer open scope source> │
                    │  - 内部 useExportActions hook       │
                    └────────────────┬────────────────────┘
                                     │ import
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
   ┌──────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
   │ store/           │   │ pipeline/            │   │ store/              │
   │ exportFormats.ts │──▶│ screenplayParser.ts  │   │ projectExport.ts    │
   │ (NEW)            │   │ (NEW · FR-8)         │   │ (export 改一行)     │
   │                  │   └──────────────────────┘   │ - FLIL_SCHEMA       │
   │ - buildNovelMd   │                              │ - exportArchived... │
   │ - buildNovelDocx │   ┌──────────────────────┐   │ - packageToBlob *   │
   │ - buildScrFdx    │──▶│ pipeline/jsonLoose   │   │ - buildExportFile.. │
   │ - buildScrFount  │   │ (parseLooseArray)    │   │ - downloadBlob      │
   │ - buildAssetsCsv │   │ (existing)           │   └────────┬────────────┘
   │ - buildExportFn  │   └──────────────────────┘            │
   └────────┬─────────┘                                       │
            │ reads                                           │ reads
            ▼                                                 ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ store/project.ts (zustand · useProject · live source)        │
   │ store/db.ts (Dexie · archived source · 红线 #1 仅读)         │
   └──────────────────────────────────────────────────────────────┘

  *  packageToBlob 现有内部函数 → 改为 export，buildExportFilename 抽离
```

**依赖方向硬约束**（违反 = 重构）：

- ✅ `pages/* → ExportDrawer → exportFormats / projectExport` 单向
- ✅ `exportFormats → screenplayParser / jsonLoose / projectExport` 单向
- ❌ `exportFormats` 不得 import `react` / `zustand`（纯函数）
- ❌ `screenplayParser` 不得 import `react` / `zustand` / `dexie`（纯函数）
- ❌ 新模块不得 import `pipeline/runner` `pipeline/compose`（避免触发 LLM 调用路径）

### 1.3 公开 API 表面（每模块的 public 函数 / 类型）

#### 1.3.1 `components/ExportDrawer.tsx`

```ts
// 唯一 default export
export interface ExportDrawerProps {
  open: boolean;
  onClose: () => void;
  scope: 'all' | 'novel' | 'screenplay' | 'assets';
  source: { type: 'live' } | { type: 'archived'; projectId: number };
}
export function ExportDrawer(props: ExportDrawerProps): JSX.Element;
```

**内部 hook**（不导出）：

```ts
function useExportActions(source: ExportDrawerProps['source']): {
  items: ExportItem[];      // 6 项 · 含 disabled/partial/enabled 态
  triggerDownload: (id: ExportItemId) => Promise<void>;
};
```

#### 1.3.2 `store/exportFormats.ts`

```ts
// 输入：统一 ExportSourceData（在抽屉打开时由 useExportActions 一次性组装）
export interface ExportSourceData {
  ctx: ProjectContext;
  novel?: {
    chapterContents: Record<number, string>;
    chapterTitles: Record<number, string>;
    completedChapters: number[];
    totalChapters: number;          // 来自 chapters.length（FR-1 警告横幅用）
    sourceNodeId: 'novel.7' | 'novel.6';
  };
  screenplay?: {
    markdown: string;
    sourceNodeId: 'screenplay.7' | 'adapt.6';
  };
  assets?: {
    roles?: unknown[];               // assets.2 解析后
    scenes?: unknown[];              // assets.3
    props?: unknown[];               // assets.4
  };
}

// 6 个纯函数 · 全部返回 Blob + filename
export function buildNovelMd(d: ExportSourceData): { filename: string; blob: Blob };
export function buildNovelDocx(d: ExportSourceData): { filename: string; blob: Blob };
export function buildScreenplayFdx(d: ExportSourceData): { filename: string; blob: Blob };
export function buildScreenplayFountain(d: ExportSourceData): { filename: string; blob: Blob };
export function buildAssetsCsv(d: ExportSourceData): { filename: string; blob: Blob };
// 第 6 种 = .flil.json：直接 import projectExport.ts 现有函数，本文件不重复实现

// helper · 与 packageToBlob 共用规则（FR-7）
export function buildExportFilename(safeName: string, stamp: string, ext: string): string;
```

#### 1.3.3 `pipeline/screenplayParser.ts`

```ts
// FR-8 markdown → 5 类元素的统一识别
export type ElementType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'transition';

export interface ScriptElement {
  type: ElementType;
  text: string;
}

export function parseScreenplay(markdown: string): ScriptElement[];
```

#### 1.3.4 `store/projectExport.ts`（既有 · 暴露调整）

```ts
// 现有 · 不变
export const FLIL_SCHEMA = 'flil/project/v1' as const;
export interface FlilPackageV1 { ... }
export async function exportArchivedProjectFile(...): Promise<{ filename: string; blob: Blob; sizeBytes: number }>;
export function downloadBlob(filename: string, blob: Blob): void;
export async function parseProjectFile(...): Promise<FlilPackageV1>;
// ...

// 新增 · 仅 export 调整 / 函数体不变（红线 #2）
export function packageToBlob(pkg: FlilPackageV1): { filename: string; blob: Blob; sizeBytes: number };
// 新增 · helper 抽离（FR-7 共用）
export function buildExportFilename(name: string, ts: number, ext: string): string;
```

### 1.4 数据流概要（详细见 §2）

3 条主路径全部走 **read → build → blob → download** 单向流：

```
[Trigger]                 [Read source]              [Build]              [Side-effect]
─────────                 ─────────────              ───────              ──────────────
Home <Download> ────┐
                    │
Novel <导出> ───────┼──▶  useExportActions ──▶ exportFormats.build*  ──▶  downloadBlob
                    │     (live or archived)       (pure fn)              (browser dialog)
Screenplay <下载剧本…>┘
```

**3 条不变量**（CA 强约束）：

1. **Read 阶段** 不调用任何 mutation API（红线 #1 落地点）。
2. **Build 阶段** 是 100% 纯函数（NFR-7 单测可达）；输入 `ExportSourceData` 输出 `{ filename, blob }`；不读 `useProject` / `db` / `localStorage`。
3. **Side-effect 阶段** 只调 `URL.createObjectURL` + `<a download>` + `URL.revokeObjectURL`（即 `downloadBlob` 现有实现），无其他副作用。

---

## §2 数据流详细设计

> 本节给抽屉生命周期内**每一种事件**的精确时序：状态转换、副作用边界、异常路径。
> 实施时按本节 sequence 写代码，不应再做"流程编排型"决策。

### 2.1 抽屉打开时序（live vs archived 分流）

**触发**：3 处入口任一 `<Button onClick={() => setExportDrawerOpen(true)}>`

**Sequence**（live source · 90% 场景）：

```
[Page]                  [<ExportDrawer>]            [useExportActions]              [zustand]
   │                            │                            │                          │
   │ open=true                  │                            │                          │
   ├───────────────────────────▶│                            │                          │
   │                            │ mount                      │                          │
   │                            ├───────────────────────────▶│                          │
   │                            │                            │ useProject()             │
   │                            │                            ├─────────────────────────▶│
   │                            │                            │◀──── ctx + artifacts ────┤
   │                            │                            │                          │
   │                            │                            │ assemble                 │
   │                            │                            │ ExportSourceData         │
   │                            │                            │ (sync, ≤ 5ms)            │
   │                            │                            │                          │
   │                            │                            │ derive items[6]          │
   │                            │                            │ + 各自 disabled/partial 态│
   │                            │◀───────────────────────────┤                          │
   │                            │ render 6 cards             │                          │
   │                            │ (focus first enabled)      │                          │
```

**Sequence**（archived source · Home `<Download>` 单击）：

```
[<ExportDrawer>]          [useExportActions]            [Dexie · 红线 #1 仅读]
   │                              │                              │
   │ scope='all'                  │                              │
   │ source={archived,projectId}  │                              │
   ├─────────────────────────────▶│                              │
   │                              │ db.projects.get(id)          │
   │                              ├─────────────────────────────▶│
   │                              │◀──── Project row ────────────┤
   │                              │ db.artifacts.where           │
   │                              │   .equals(projectId).toArray │
   │                              ├─────────────────────────────▶│
   │                              │◀──── Artifact[] ─────────────┤
   │                              │                              │
   │                              │ assemble ExportSourceData    │
   │                              │ (async, ≤ 50ms 30 章 · 红线   │
   │                              │  #1 落地：仅 read 不 write)  │
   │                              │                              │
   │◀─────────────────────────────┤ items[6] (含 .flil.json)     │
   │ render w/ loading skeleton   │                              │
   │ until resolve                │                              │
```

**关键决策**：

- **live 路径同步组装**：从 zustand 单点读取 `useProject()` 返回值，无 await，≤ 5ms（NFR-1 抽屉首屏 ≤ 200ms 大幅富余）。
- **archived 路径异步组装**：`db.artifacts.where(...).toArray()` 是 Dexie Promise，30 章项目 ≤ 50ms。期间抽屉显示 skeleton（NFR-4 a11y `aria-busy="true"`）。
- **archived 路径不预读 chapterContents**：`Artifact[]` 拿到的 `meta` 字段直接含 `chapterContents`（与 live 路径同源 schema），无二次解析。

### 2.2 触发下载时序（用户点击 6 项任一）

```
[User]      [<ExportDrawer>]      [useExportActions]      [exportFormats]      [downloadBlob]
   │              │                       │                      │                    │
   │ click .md    │                       │                      │                    │
   ├─────────────▶│                       │                      │                    │
   │              │ items[0].onClick()    │                      │                    │
   │              ├──────────────────────▶│                      │                    │
   │              │                       │ triggerDownload('md')│                    │
   │              │                       │ try {                │                    │
   │              │                       │   buildNovelMd(data) │                    │
   │              │                       ├─────────────────────▶│                    │
   │              │                       │◀── {filename, blob}──┤                    │
   │              │                       │   downloadBlob(...)  │                    │
   │              │                       ├──────────────────────────────────────────▶│
   │              │                       │                      │                    │ <a click>
   │              │                       │                      │                    │ revoke 1500ms
   │              │                       │                      │                    │
   │              │                       │   console.log('✓ 已下载', fn)             │
   │              │                       │ } catch (e) {        │                    │
   │              │                       │   alert('导出失败：' + msg)                │
   │              │                       │ }                    │                    │
   │              │ (drawer 保持 open)    │                      │                    │
```

**关键决策**：

- **抽屉不关闭**（PRD §6.4）：用户可连点 `.md` → `.docx` → `.fountain` 一次会话导出多份。
- **错误反馈分层**：
  - `parseLooseArray` 抛错（FR-10 第 3 行）→ build* 函数内 catch + push 到 result.warnings；不阻塞下载
  - build* 自身抛错 → 冒泡到 useExportActions catch → `alert()`（与 `Home.tsx:113` 同款）
  - `Blob` 创建失败（极罕见 OOM）→ 同上 `alert()`
- **无 progress UI**（NFR-1 ≤ 5s 最大场景，不值得加进度条）：但保留 `aria-busy` 短暂期间防止重复点击。

### 2.3 抽屉关闭时序（3 路径统一）

```
[User]                  [<ExportDrawer>]              [Page]
   │                            │                            │
   │ Esc / overlay / X click    │                            │
   ├───────────────────────────▶│                            │
   │                            │ onClose()                  │
   │                            ├───────────────────────────▶│
   │                            │                            │ setExportDrawerOpen(false)
   │                            │                            │
   │                            │ unmount                    │
   │                            │ - revoke pending Blob URLs│
   │                            │   (若有未触发 click 的）  │
   │                            │ - return focus to trigger │
   │                            │   button (NFR-4)          │
```

**关键决策**：

- **revoke 安全网**：`useExportActions` 内部维护 `pendingBlobUrls: string[]`；unmount 时 forEach revoke。即使下载未触发也不泄漏 ObjectURL。
- **focus return**：用 React `ref` 在 `useEffect(() => () => triggerRef.current?.focus(), [])` 兜底，与 DESIGN.md modal 合约对齐。
- **state 不污染**：抽屉是受控组件（open/onClose），不持任何 page-side state；关闭即纯 unmount。

### 2.4 异常路径明细表

| 异常 | 触发位置 | 处理 | 用户可见 |
|---|---|---|---|
| **archived `db.projects.get(id)` returns undefined** | `useExportActions` 初始化 | items[] 全 disabled + 抽屉头加 `<AlertTriangle>`「项目不存在」 | 抽屉打开但全灰 |
| **archived `db.artifacts.toArray()` 抛错** | 同上 | 抛 → `<ErrorBoundary>`（项目无 ErrorBoundary 时降级 `alert()` + `onClose()`） | alert 后抽屉关闭 |
| **live `useProject()` 返回空 ctx**（极罕见） | 同上 | 抽屉头警告 + 项全 disabled | 灰显抽屉 |
| **`parseLooseArray(assets.2)` 抛错** | `buildAssetsCsv` 内 | catch + 该分类标记 `roles=undefined` + push warning；其他分类继续 | 抽屉项卡显示 `<AlertTriangle>` partial 态 |
| **`buildNovelDocx` HTML 字符串过大（OOM）** | `buildNovelDocx` 内 | catch → `alert('文件过大，请使用 .md 替代')` | alert |
| **`Blob` 构造失败** | `downloadBlob` 上游 | 抛 → `useExportActions` catch → `alert()` | alert |
| **浏览器拒绝 `<a download>`**（弹窗拦截） | `downloadBlob` 内（无法静态检测） | 用户视觉感知：无文件下载 → CA 不主动 detect，依赖用户在浏览器设置中允许 | 静默 |

### 2.5 disabled / partial / enabled 态判定（集中在 `useExportActions`）

每张卡的 3 态由**唯一函数 `deriveItemState`** 计算，避免散落判断：

```ts
type ItemState = 'enabled' | 'partial' | 'disabled';

function deriveItemState(itemId: ExportItemId, data: ExportSourceData): ItemState {
  switch (itemId) {
    case 'novel-md':
    case 'novel-docx': {
      if (!data.novel || data.novel.completedChapters.length === 0) return 'disabled';
      if (data.novel.completedChapters.length < data.novel.totalChapters) return 'partial';
      return 'enabled';
    }
    case 'screenplay-fdx':
    case 'screenplay-fountain': {
      if (!data.screenplay?.markdown.trim()) return 'disabled';
      return 'enabled';   // 剧本无 partial 态（最终稿是单一 artifact，不是 loop 产物）
    }
    case 'assets-csv': {
      const r = data.assets;
      if (!r || (!r.roles?.length && !r.scenes?.length && !r.props?.length)) return 'disabled';
      const allThree = !!r.roles?.length && !!r.scenes?.length && !!r.props?.length;
      return allThree ? 'enabled' : 'partial';
    }
    case 'flil-json':
      return 'enabled';   // 项目元数据始终可导（archived 路径必有 ctx；live 路径需要扩展，见下）
  }
}
```

**partial 态的实际行为**（与 PRD §6.3 / FR-10 / AC-2 对齐）：

- 视觉：卡片不灰、加 `<AlertTriangle>` 黄色 icon、tooltip 显示具体缺失数
- 交互：可点击 → build* 函数内自行加文件头警告横幅（`> ⚠ 注：仅含 N 章（共 M 章）`）
- 不阻塞：FR-10 "数据部分缺失"行为

### 2.6 abort 决策：**不支持**（CA 显式 No）

- **PRD 立场**：NFR-1 P95 ≤ 5s，最大场景 .docx 10 章 ≤ 5s。这个量级**不需要**取消机制（用户自然会等）。
- **新增 `AbortController` 的代价**：每个 build* 函数签名增 `signal?: AbortSignal` + 内部循环加 `if (signal?.aborted) throw` + UI 加 cancel 按钮 → 至少 +50 行代码 + +3 个测试用例。
- **结论**：CA 显式拒绝 abort 支持。若 dogfood 实测发现 ≥ 50 章超长篇（非 v3 dogfood 范围）耗时 > 10s，再触发 v3.x PRD 重启。
- **静态保护**：build* 函数签名**不含** `signal` 参数 → 后续若想加，必须改签名（surgical 验证手段）。

### 2.7 数据流不变量总览（CA 强约束 · 实施时机械验证）

| 不变量 | 物理保证 | 测试手段 |
|---|---|---|
| **I-1**：read 阶段零 mutation | `exportFormats` / `screenplayParser` 不 import dexie 任何 write API | 静态 grep `\.add\(\|\.put\(\|\.update\(\|\.delete\(` 在新模块 = 0 hit |
| **I-2**：build 阶段是纯函数 | 6 个 build* 不 import `react` `zustand` `dexie` | 同上 grep |
| **I-3**：副作用单点收敛 | `URL.createObjectURL` 仅出现在 `downloadBlob`（既有） | 同上 grep |
| **I-4**：抽屉 unmount 后零残留 | `useExportActions` cleanup 释放 ObjectURL + focus 回归 | 手测 + DevTools Memory snapshot 对比 |
| **I-5**：archived 与 live 走同一 build* | 两路径都组装 `ExportSourceData` 后调同 build* | 单测 fixture 共用 |
| **I-6**：build* 输出可复现 | 同输入同 stamp → byte-for-byte 同输出（FR-7 / AC-1 第 6 子项） | 单测 with frozen Date.now |

---

## §3 详细设计

> 本节给 5 个 `build*` 函数 + `screenplayParser` 完整算法。
> 实施时按本节代码片段直接落盘；变量名 / 类型名 / 函数名**不应**改动。

### 3.1 `ExportSourceData` 组装算法（live / archived 双路径归一）

**Module**：内嵌于 `useExportActions` hook 中（非独立 export，因为要消费 zustand store）。

```ts
// store/useExportActions.ts (内嵌于 ExportDrawer.tsx 同文件 / 不单独成文件)

async function assembleSourceData(
  source: ExportDrawerProps['source'],
  zustandSnapshot?: { ctx: ProjectContext; artifacts: ArtifactMap },
): Promise<ExportSourceData> {
  // ── 路径 1：live · 同步从 zustand snapshot 取 ──
  if (source.type === 'live' && zustandSnapshot) {
    return {
      ctx: zustandSnapshot.ctx,
      novel: extractNovel(zustandSnapshot.artifacts),
      screenplay: extractScreenplay(zustandSnapshot.artifacts),
      assets: extractAssets(zustandSnapshot.artifacts),
    };
  }

  // ── 路径 2：archived · 异步从 Dexie 取 ──
  const row = await db.projects.get(source.projectId);
  if (!row) throw new Error('项目不存在');
  const arts = await db.artifacts.where('projectId').equals(source.projectId).toArray();
  // 用与 projectExport.ts:62 同款转换把 Dexie row → ArtifactMap 形态
  const artifactMap: ArtifactMap = {};
  for (const r of arts) {
    artifactMap[r.nodeId] = {
      nodeId: r.nodeId,
      stageId: ((r.meta as any)?.stageId ?? r.nodeId.split('.')[0]) as any,
      index: (r.meta as any)?.index ?? Number(r.nodeId.split('.')[1] ?? 0),
      title: (r.meta as any)?.title ?? r.nodeId,
      format: r.format,
      content: r.content,
      tokens: r.tokens ?? 0,
      cost: r.cost ?? 0,
      durationMs: r.durationMs ?? 0,
      ts: r.ts,
      meta: r.meta,
    };
  }
  return {
    ctx: rowToCtx(row),                      // 复用 projectExport.ts:84-97 同款 row → ctx 转换
    novel: extractNovel(artifactMap),
    screenplay: extractScreenplay(artifactMap),
    assets: extractAssets(artifactMap),
  };
}
```

**3 个 extractor** （纯函数 · 可独立单测）：

```ts
function extractNovel(arts: ArtifactMap): ExportSourceData['novel'] | undefined {
  // FR-1 优先级链：novel.7 (润色) → novel.6 (草稿)
  const a7 = arts['novel.7'];
  const a6 = arts['novel.6'];
  const src = a7 ?? a6;
  if (!src) return undefined;
  const meta = (src.meta ?? {}) as Partial<NovelChapterLoopMeta>;

  // 形态 A：meta.chapterContents 存在（loop 产物 · 主路径）
  if (meta.chapterContents && Object.keys(meta.chapterContents).length > 0) {
    const completed = meta.completedChapters ?? Object.keys(meta.chapterContents).map(Number);
    return {
      chapterContents: meta.chapterContents,
      chapterTitles: meta.chapterTitles ?? {},
      completedChapters: completed.sort((a, b) => a - b),
      totalChapters: parseChapterOutlines(arts['novel.4']?.content ?? '').length || completed.length,
      sourceNodeId: a7 ? 'novel.7' : 'novel.6',
    };
  }

  // 形态 B：仅 content 字段（旧 artifact 格式 · FR-1 Edge 第 3 行）
  if (src.content?.trim()) {
    return {
      chapterContents: { 1: src.content },             // 单"章"承载全文
      chapterTitles: { 1: src.title || '全文' },
      completedChapters: [1],
      totalChapters: 1,
      sourceNodeId: a7 ? 'novel.7' : 'novel.6',
    };
  }

  return undefined;
}

function extractScreenplay(arts: ArtifactMap): ExportSourceData['screenplay'] | undefined {
  // 与 Assets.tsx:47-51 同款选择规则
  const a = arts['screenplay.7'];
  const b = arts['adapt.6'];
  if (a?.content?.trim()) return { markdown: a.content, sourceNodeId: 'screenplay.7' };
  if (b?.content?.trim()) return { markdown: b.content, sourceNodeId: 'adapt.6' };
  return undefined;
}

function extractAssets(arts: ArtifactMap): ExportSourceData['assets'] | undefined {
  const r = tryParse(arts['assets.2']?.content);   // 角色
  const s = tryParse(arts['assets.3']?.content);   // 场景
  const p = tryParse(arts['assets.4']?.content);   // 道具
  if (!r && !s && !p) return undefined;
  return { roles: r, scenes: s, props: p };
}

function tryParse(content?: string): unknown[] | undefined {
  if (!content?.trim()) return undefined;
  try {
    return parseLooseArray(content) as unknown[];   // FR-10 第 3 行：抛错则返回 undefined
  } catch { return undefined; }
}
```

### 3.2 `buildNovelMd(d: ExportSourceData)` 算法（FR-1 + FR-6 + FR-7）

```ts
export function buildNovelMd(d: ExportSourceData): { filename: string; blob: Blob } {
  if (!d.novel) throw new Error('无小说数据');
  const { chapterContents, chapterTitles, completedChapters, totalChapters } = d.novel;

  // FR-6 章节顺序锁定：升序遍历
  const sortedIdx = [...completedChapters].sort((a, b) => a - b);

  const stamp = formatStamp(Date.now());
  const safeName = sanitizeName(d.ctx.name || 'project');
  const lines: string[] = [];

  // 文件头
  lines.push(`# ${d.ctx.name || '未命名项目'}`);
  lines.push('');
  const totalWords = sortedIdx.reduce((sum, i) => sum + (chapterContents[i]?.length ?? 0), 0);
  lines.push(`> 导出于 ${formatHuman(Date.now())} · 共 ${sortedIdx.length} 章 · 约 ${(totalWords / 10000).toFixed(1)} 万字`);

  // FR-10 partial 警告横幅
  if (sortedIdx.length < totalChapters) {
    lines.push('');
    lines.push(`> ⚠ 注：仅含 ${sortedIdx.length} 章（共 ${totalChapters} 章未完成）`);
  }

  lines.push('');

  // 章节循环
  for (const idx of sortedIdx) {
    const title = chapterTitles[idx] || `第 ${idx} 章`;
    lines.push(`## 第 ${idx} 章 · ${title}`);
    lines.push('');
    lines.push(chapterContents[idx]?.trim() ?? '');
    lines.push('');
  }

  const md = lines.join('\n');
  const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' });
  return {
    filename: buildExportFilename(safeName, stamp, '.md'),
    blob,
  };
}
```

### 3.3 `buildNovelDocx(d: ExportSourceData)` 算法（FR-2 HTML 容器路线）

```ts
export function buildNovelDocx(d: ExportSourceData): { filename: string; blob: Blob } {
  if (!d.novel) throw new Error('无小说数据');
  const { chapterContents, chapterTitles, completedChapters, totalChapters } = d.novel;
  const sortedIdx = [...completedChapters].sort((a, b) => a - b);

  // 转义 HTML 特殊字符
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 段落分割：按 \n\n 拆，单 \n 在段内保留为 <br/>
  const paraToHtml = (raw: string) =>
    raw.split(/\n\n+/).map(p => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`).join('\n');

  const partialWarning = sortedIdx.length < totalChapters
    ? `<p style="color:#d97706"><strong>⚠ 注：仅含 ${sortedIdx.length} 章（共 ${totalChapters} 章未完成）</strong></p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="影语 FLIL">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<title>${esc(d.ctx.name || '未命名项目')}</title>
<style>
  body { font-family: 'Microsoft YaHei', 'PingFang SC', '宋体', serif; font-size: 12pt; line-height: 1.8; }
  h1 { font-size: 22pt; text-align: center; margin: 24pt 0; }
  h2 { font-size: 16pt; page-break-before: always; margin: 20pt 0 12pt; }
  h2:first-of-type { page-break-before: avoid; }
  p { margin: 0 0 6pt; text-indent: 2em; }
</style>
</head>
<body>
<h1>${esc(d.ctx.name || '未命名项目')}</h1>
${partialWarning}
${sortedIdx.map(idx => {
  const title = chapterTitles[idx] || `第 ${idx} 章`;
  const body = paraToHtml(chapterContents[idx]?.trim() ?? '');
  return `<h2>第 ${idx} 章 · ${esc(title)}</h2>\n${body}`;
}).join('\n')}
</body>
</html>`;

  const blob = new Blob([html], {
    type: 'application/vnd.ms-word; charset=utf-8',  // R-1 决策点：Word 接受 HTML 容器为 .docx
  });
  return {
    filename: buildExportFilename(sanitizeName(d.ctx.name || 'project'), formatStamp(Date.now()), '.docx'),
    blob,
  };
}
```

> **R-1 缓解 L1 落地点**：`<!--[if gte mso 9]>` MSO 条件注释 + `<meta name="ProgId" content="Word.Document">` 双重声明，是 Word 历史路径用于消除"是否转换格式"对话框的标准做法。CA §4.1 给 spike 验证流程；若仍弹对话框则触发 R-1 L2。

### 3.4 `screenplayParser` 状态机 · `buildScreenplayFdx` · `buildScreenplayFountain`（FR-3 / FR-4 / FR-8）

#### 3.4.1 parser 状态机

```ts
// pipeline/screenplayParser.ts

export type ElementType = 'sceneHeading' | 'action' | 'character' | 'dialogue' | 'transition';
export interface ScriptElement { type: ElementType; text: string }

// 识别顺序硬编码 · 不许改（algorithm correctness 依赖此优先级）
const SCENE_HEADING_RE = /^(?:#{1,3}\s*)?(?:第\s*\d+\s*场|场\s*\d+|INT\.|EXT\.|EST\.|内\s|外\s)/i;
const TRANSITION_RE = /^(?:>\s+|CUT TO\b|FADE (?:IN|OUT)\b|DISSOLVE\b)/i;
const CHARACTER_LINE_RE = /^([A-Z\u4e00-\u9fa5][A-Z\u4e00-\u9fa5\s]{0,7})\s*[:：]\s*(.*)$/;

export function parseScreenplay(markdown: string): ScriptElement[] {
  const out: ScriptElement[] = [];
  const lines = markdown.split(/\r?\n/);

  // 状态机：上一个元素类型，用于 character → dialogue 衔接判断
  let prev: ElementType | null = null;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) {
      // 空行：仅作为段落分隔；fdx/fountain 序列化时按需插入 blank
      prev = null;       // 重置状态（character 后必须紧跟 dialogue · 空行打断）
      continue;
    }

    // 1. 转场（高优先级 · 防止与场景头混淆）
    if (TRANSITION_RE.test(line)) {
      out.push({ type: 'transition', text: line.replace(/^>\s+/, '') });
      prev = 'transition';
      continue;
    }

    // 2. 场景头
    if (SCENE_HEADING_RE.test(line)) {
      // 去掉 markdown # 装饰
      const cleaned = line.replace(/^#{1,3}\s*/, '');
      out.push({ type: 'sceneHeading', text: cleaned });
      prev = 'sceneHeading';
      continue;
    }

    // 3. 中文「人物：对白」行（CHARACTER_LINE_RE 同时捕获 character + 同行 dialogue）
    const cm = line.match(CHARACTER_LINE_RE);
    if (cm) {
      out.push({ type: 'character', text: cm[1].trim() });
      const dialogue = cm[2]?.trim();
      if (dialogue) {
        out.push({ type: 'dialogue', text: dialogue });
        prev = 'dialogue';
      } else {
        prev = 'character';   // 对白可能在下一行
      }
      continue;
    }

    // 4. character 之后的非空非冒号行 = dialogue 续行
    if (prev === 'character' || prev === 'dialogue') {
      out.push({ type: 'dialogue', text: line });
      prev = 'dialogue';
      continue;
    }

    // 5. 兜底：action（FR-8 降级保证 · 不丢字符）
    out.push({ type: 'action', text: line });
    prev = 'action';
  }

  return out;
}
```

**状态机判断顺序硬编码原因**：

- 转场识别**必须**在场景头之前（`> CUT TO:` 若先匹配场景头会被吞）
- 中文「人物：对白」单行检测**必须**在通用 action 之前
- character 之后续行的 dialogue 推断依赖 `prev` 状态变量 · 空行重置

#### 3.4.2 `buildScreenplayFdx`

```ts
export function buildScreenplayFdx(d: ExportSourceData): { filename: string; blob: Blob } {
  if (!d.screenplay) throw new Error('无剧本数据');
  const elements = parseScreenplay(d.screenplay.markdown);

  const FDX_TYPE: Record<ElementType, string> = {
    sceneHeading: 'Scene Heading',
    action: 'Action',
    character: 'Character',
    dialogue: 'Dialogue',
    transition: 'Transition',
  };

  const escXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const paragraphs = elements
    .map(e => `    <Paragraph Type="${FDX_TYPE[e.type]}"><Text>${escXml(e.text)}</Text></Paragraph>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${paragraphs}
  </Content>
</FinalDraft>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  return {
    filename: buildExportFilename(sanitizeName(d.ctx.name || 'script'), formatStamp(Date.now()), '.fdx'),
    blob,
  };
}
```

#### 3.4.3 `buildScreenplayFountain`

```ts
export function buildScreenplayFountain(d: ExportSourceData): { filename: string; blob: Blob } {
  if (!d.screenplay) throw new Error('无剧本数据');
  const elements = parseScreenplay(d.screenplay.markdown);

  const lines: string[] = [];
  // Title page
  lines.push(`Title: ${d.ctx.name || '未命名'}`);
  lines.push('Author: QvQ');
  lines.push(`Draft date: ${formatHuman(Date.now()).slice(0, 10)}`);
  lines.push('');
  lines.push('===');
  lines.push('');

  let prev: ElementType | null = null;
  for (const e of elements) {
    if (e.type === 'sceneHeading' && prev !== null) lines.push('');     // 场景头前空行
    switch (e.type) {
      case 'sceneHeading':
        lines.push(e.text);
        break;
      case 'character':
        lines.push('');
        lines.push(e.text.toUpperCase());        // fountain 人物名建议大写
        break;
      case 'dialogue':
        lines.push(e.text);                      // 紧跟 character 行不空
        break;
      case 'transition':
        lines.push('');
        lines.push(`> ${e.text}`);
        break;
      case 'action':
        if (prev === 'action') lines.push('');
        lines.push(e.text);
        break;
    }
    prev = e.type;
  }

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain; charset=utf-8' });
  return {
    filename: buildExportFilename(sanitizeName(d.ctx.name || 'script'), formatStamp(Date.now()), '.fountain'),
    blob,
  };
}
```

### 3.5 `buildAssetsCsv(d: ExportSourceData)` + AssetRow（FR-5 + FR-9）

```ts
// 内部规范化类型 · 仅本文件用
interface AssetRow {
  category: '角色' | '场景' | '道具';
  name: string;
  description: string;
  visualStyle: string;
  prompt: string;
  scenes: string;        // ; 分号连接
  notes: string;
}

const FIELDS: Array<{ key: keyof AssetRow; header: string }> = [
  { key: 'category',     header: '分类' },
  { key: 'name',         header: '名称' },
  { key: 'description',  header: '描述' },
  { key: 'visualStyle',  header: '视觉风格' },
  { key: 'prompt',       header: '提示词' },
  { key: 'scenes',       header: '关联场次' },
  { key: 'notes',        header: '备注' },
];

// FR-9 字段优先级链（取第一个非空字符串）
function pick(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}
function pickArray(obj: any, keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v) && v.length) return v.map(String).join(';');
  }
  return '';
}

function toRow(category: AssetRow['category'], raw: any): AssetRow | null {
  const name = pick(raw, ['name', 'title', '名称']);
  if (!name) return null;        // 无名资产丢弃（FR-9 · name 必填）
  const known = new Set(['name', 'title', '名称', 'description', 'desc', 'summary', '描述',
                         'style', 'visualStyle', 'lookAndFeel', '视觉风格',
                         'prompt', 'tflowPrompt', '提示词', 'scenes', 'appearances', '关联场次',
                         'notes', 'extra', '备注']);
  // 兜底：所有未匹配字段串成 key=value;
  const notesExtra = Object.entries(raw || {})
    .filter(([k, v]) => !known.has(k) && (typeof v === 'string' || typeof v === 'number'))
    .map(([k, v]) => `${k}=${v}`)
    .join(';');

  return {
    category,
    name,
    description: pick(raw, ['description', 'desc', 'summary', '描述']),
    visualStyle: pick(raw, ['style', 'visualStyle', 'lookAndFeel', '视觉风格']),
    prompt: pick(raw, ['prompt', 'tflowPrompt', '提示词']),
    scenes: pickArray(raw, ['scenes', 'appearances', '关联场次']),
    notes: [pick(raw, ['notes', '备注']), notesExtra].filter(Boolean).join(';'),
  };
}

function escCsv(s: string): string {
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildAssetsCsv(d: ExportSourceData): { filename: string; blob: Blob } {
  if (!d.assets) throw new Error('无资产数据');
  const rows: AssetRow[] = [];
  for (const r of d.assets.roles ?? [])  { const row = toRow('角色', r); if (row) rows.push(row); }
  for (const r of d.assets.scenes ?? []) { const row = toRow('场景', r); if (row) rows.push(row); }
  for (const r of d.assets.props ?? [])  { const row = toRow('道具', r); if (row) rows.push(row); }

  const lines: string[] = [];
  lines.push(FIELDS.map(f => f.header).join(','));
  for (const row of rows) {
    lines.push(FIELDS.map(f => escCsv(row[f.key] ?? '')).join(','));
  }

  // FR-6 编码：UTF-8 with BOM（中文 Excel 必需）
  const BOM = '\uFEFF';
  const csv = BOM + lines.join('\r\n');     // FR-5 行分隔符 = CRLF
  const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });

  const safeName = sanitizeName(d.ctx.name || 'project');
  // FR-7 资产专用插入 _assets
  const stamp = formatStamp(Date.now());
  return {
    filename: `${safeName}_assets_${stamp}.csv`,
    blob,
  };
}
```

### 3.6 公共 helper · `buildExportFilename` + `formatStamp` + `sanitizeName`

```ts
// store/exportFormats.ts (导出 · FR-7 共用)
export function buildExportFilename(safeName: string, stamp: string, ext: string): string {
  // ext 必须以 . 开头（'.md' / '.docx' / '.fdx' ...）
  return `${safeName}_${stamp}${ext}`;
}

// 与 projectExport.ts:113-126 packageToBlob 中同款逻辑（CA §0.5 · 抽离共用）
export function formatStamp(ts: number): string {
  const dt = new Date(ts);
  return (
    dt.getFullYear() +
    String(dt.getMonth() + 1).padStart(2, '0') +
    String(dt.getDate()).padStart(2, '0') +
    '-' +
    String(dt.getHours()).padStart(2, '0') +
    String(dt.getMinutes()).padStart(2, '0')
  );
}

export function sanitizeName(name: string): string {
  return (name || 'project').replace(/[\\/:*?"<>|]/g, '_').slice(0, 64);
}

// 仅 .md 文件头注释 / fountain Draft date 用 · 不影响 filename
function formatHuman(ts: number): string {
  const dt = new Date(ts);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}
```

> **packageToBlob 适配点**：现有 `projectExport.ts:113-126` 的 safeName + stamp 逻辑与上述 `sanitizeName` + `formatStamp` 等价。CA §1.1 已说明「改 export」；最小改动 = 把 `packageToBlob` 内部代码替换为 `buildExportFilename(sanitizeName(...), formatStamp(...), '.flil.json')`，函数体行为 byte-for-byte 不变（红线 #2 守住 · AC-1 第 6 子项可验证）。

### 3.7 单测 fixture 锚点（`store/exportFormats.test.ts` · 可选 ★）

```ts
// 推荐 fixture 文件：tests/fixtures/export/
//   - novel-10ch-50kw.json       # mock ExportSourceData with 10 chapters
//   - novel-partial-5of10.json   # 5/10 章 · 触发 partial 横幅
//   - screenplay-shortdrama.md   # 真实 short-drama 风格 markdown
//   - assets-roles-scenes-props.json  # 三类齐全
//   - assets-only-roles.json     # 触发 csv 部分缺失

describe('buildNovelMd', () => {
  it('outputs chapters in ascending index order (FR-6)', () => { /* ... */ });
  it('emits partial warning when completedChapters < totalChapters (AC-2)', () => { /* ... */ });
  it('falls back to "第 N 章" title when chapterTitles missing', () => { /* ... */ });
  it('produces deterministic output with frozen Date.now (I-6)', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-06T17:48:00'));
    const a = buildNovelMd(fixture);
    const b = buildNovelMd(fixture);
    expect(a.filename).toBe(b.filename);
    expect(a.blob.size).toBe(b.blob.size);
  });
});

describe('parseScreenplay', () => {
  it('classifies "李三：你好" as character + dialogue', () => { /* ... */ });
  it('classifies "INT. 茶馆 - 日" as sceneHeading', () => { /* ... */ });
  it('classifies "> CUT TO:" as transition', () => { /* ... */ });
  it('falls back unknown lines to action (降级保证)', () => { /* ... */ });
});

describe('buildAssetsCsv', () => {
  it('writes UTF-8 BOM as first byte (FR-6)', () => {
    const { blob } = buildAssetsCsv(fixture);
    blob.text().then(t => expect(t.charCodeAt(0)).toBe(0xFEFF));
  });
  it('escapes commas and quotes per RFC 4180', () => { /* ... */ });
  it('preserves multi-category assets as duplicate rows', () => { /* FR-9 多类型场景 */ });
});
```

> **测试优先级**：单测可选但**强烈推荐**。AC-8 是构建/类型零退化，单测是 byte-for-byte 复现的额外保险（I-6）。dogfood 一次性手测过 AC-1 也可代替 80% 单测覆盖。

---

## §4 关键工程决策（D1 + D4 落地 + PRD §6.5 校正）

> 本节解决 PRD 留给 CA 的 4 个工程决策中尚未在 §3 解决的两个：
> **D1**（docx 路线）/ **D4**（utility 补全）+ **PRD §6.5 类名校正**（CA 实测发现）

### 4.1 · D1 · `.docx` 路线最终判决（FR-2 · R-1）

#### 决策结论

> **首选 HTML 容器路线**（§3.3 已落代码）+ **spike 验证机制** + **R-1 三级降级阶梯**。

#### 4.1.1 spike 验证流程（实施第 1 周必跑）

实施开始第一天**必须**先做这个 spike，决定后续是否切 R-1 L2：

```
[Step 1] 用 §3.3 buildNovelDocx 生成最简 .docx（项目名 + 1 章 100 字测试）
[Step 2] Word 桌面版（2016 / 2019 / 365 任一）双击打开
[Step 3] 观察是否弹出 "是否转换文件格式" 对话框
         ┌─────────────────────────────────────────────────────────┐
         │ Microsoft Word                                       ✕  │
         │  此文件源自其他位置，可能不安全。是否打开？             │
         └─────────────────────────────────────────────────────────┘
         （这是 SmartScreen 不是格式对话框 · 安全提示 · 接受）

         ┌─────────────────────────────────────────────────────────┐
         │ Microsoft Word                                       ✕  │
         │  Word 在 'xxx.docx' 中发现无法识别的内容。是否恢复...    │
         │  [是] [否]                                              │
         └─────────────────────────────────────────────────────────┘
         （这是格式对话框 · 触发 R-1）
[Step 4] 若不弹格式对话框 → 锁 HTML 容器路线，结束 spike
[Step 5] 若弹 ≥ 2 次/3 次测试 → 触发 R-1 L2（详见 4.1.3）
```

**spike 通过判定**（必须全部满足才可关 spike）：

- ✅ 不弹格式对话框（SmartScreen 安全提示不算）
- ✅ 标题层级（H1/H2）在 Word 大纲视图中正确显示为「标题 1」「标题 2」级别
- ✅ 中文字体不乱码（Microsoft YaHei 或 fallback 正常）
- ✅ `page-break-before: always` 章节分页生效（每章另起一页）

**任一不满足 → 进 4.1.3 降级**。

#### 4.1.2 spike 通过后的硬约束

- §3.3 `buildNovelDocx` 代码 **byte-for-byte** 锁定，不许后续 PR 调样式（避免微调引入兼容性回归）。
- AC-1 第 2 子项 dogfood 实测时**必须 sample ≥ 3 次** Word 打开（不同 Word 版本或不同输入文件），确认稳定。
- VR (validate-release) 阶段 review 必须勾选「docx HTML 路线 sticky 通过 spike」。

#### 4.1.3 R-1 三级降级阶梯（spike 失败时启动）

```
spike 失败
   ▼
[L1] 调整 HTML meta 标签
     - 加 <html xmlns:o="urn:schemas-microsoft-com:office:office">
     - 加 <html xmlns:w="urn:schemas-microsoft-com:office:word">
     - 加 <meta http-equiv="Content-Type" content="application/vnd.ms-word">
     - 重跑 spike
   ▼  L1 失败
[L2] docx npm 包 lazy import
     - npm install docx (~150KB gzip)
     - 必须 lazy: const { Document, Packer } = await import('docx');
     - 改 §3.3 内部实现 · public API 签名不变（{filename, blob}）
     - vite build 验证 vendor chunk ≤ +200KB gzip (NFR-2)
     - 若超 200KB → 进 L3
   ▼  L2 失败
[L3] G2 .docx 推迟 v3.1
     - PRD §10 临时调整 · 抽屉中 .docx 项变 disabled + tooltip「v3.1 提供」
     - .md 仍 sticky 可用
     - 触发 v3.1 PRD 重启
```

**L2 lazy import 模板代码**（仅 spike 失败才实施 · 当前不写入代码）：

```ts
// store/exportFormats.ts (L2 退路 · 不在主 PR · 仅参考)
export async function buildNovelDocx(d: ExportSourceData): Promise<{ filename: string; blob: Blob }> {
  if (!d.novel) throw new Error('无小说数据');

  // ⚠ Lazy import · 不进 main chunk
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');

  const sortedIdx = [...d.novel.completedChapters].sort((a, b) => a - b);
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(d.ctx.name || '未命名项目')] }),
    ...sortedIdx.flatMap(idx => [
      new Paragraph({ heading: HeadingLevel.HEADING_1,
                      children: [new TextRun(`第 ${idx} 章 · ${d.novel.chapterTitles[idx] || ''}`)] }),
      ...((d.novel.chapterContents[idx] || '').split(/\n\n+/).map(p =>
        new Paragraph({ children: [new TextRun(p)] }))),
    ]),
  ];
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return {
    filename: buildExportFilename(sanitizeName(d.ctx.name), formatStamp(Date.now()), '.docx'),
    blob,
  };
}
```

> ⚠ L2 切换会让 `buildNovelDocx` 变成 async（与 `buildNovelMd` 同步签名不一致）。`useExportActions` 已用 `triggerDownload: Promise<void>`，所以**调用方零适配**。

### 4.2 · D4 · utility 补全审计（PRD §6.5 已悲观）

> **CA 实测**：读 `@C:\Users\QvQ\CascadeProjects\fili-web\tailwind.config.ts:124-134` 后发现 PRD §6.5 担心的 utility **几乎全部已存在**。

#### 4.2.1 已存在 utility 清单（无需补丁）

| PRD §6.5 用到 | tailwind.config.ts 现状 | 类名直接用 |
|---|---|---|
| `shadow-floating` | `boxShadow.floating: '0 8px 24px -4px rgb(0 0 0 / 0.5), ...'` ✅ `:126` | `shadow-floating` |
| `transition duration-240` | `transitionTimingFunction.out-quint` ✅ `:133` | `transition-transform duration-300 ease-out-quint` |
| `w-[420px]` | `spacing.drawer = '420px'` ✅ `:102` | **`w-drawer`**（语义化 / 优于 arbitrary） |
| `rounded-modal` (16px) | `borderRadius.modal: '16px'` ✅ `:117` | `rounded-modal` |
| `bg-surface` | `colors.surface` ✅ `:63` | `bg-surface`（PRD 写的 `bg-bg-surface` 错） |
| `text-heading-m` etc | `fontSize` 11 级 + tight 3 档 ✅ `:78-95` | 直接 |
| `border-border-default` | `colors['border-default']` ✅ `:67` | 直接 |

**结论**：**tailwind.config.ts 零修改**。PRD §6.5 末尾"必要扩展"承诺取消。

#### 4.2.2 需补的 utility（仅 1 个 · 极小）

PRD §6.3 partial 态用了 hover 抬升：「DESIGN.md `card.variants.interactive` hover 抬升」—— 项目现有 `card` utility 是否含 hover？需要现场确认。**保险方案**：在 `<ExportDrawer>` 的卡片直接写 `hover:shadow-floating transition-shadow`，不依赖 `card.variants.interactive` 的内部 hover 行为。

```tsx
// §6.5 校正后的卡片类名
<button className="
  rounded-card border border-border-default bg-surface w-full text-left p-4
  hover:shadow-floating hover:border-border-strong transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
  focus:outline-none focus:ring-2 focus:ring-primary-500
">
```

> 全部使用现有 utility，零 arbitrary value，零 tailwind config 改动。

### 4.3 · lucide-react icon 增量

#### 4.3.1 新增 icon

| icon | 用途 | 位置 |
|---|---|---|
| `FileDown` | Screenplay toolbar「下载剧本…」按钮（PRD §6.2.3 红线 #3 避免与现有 `Download` 撞图） | `src/pages/Screenplay.tsx:3-7` import 列表追加 |
| （`Download`） | Home 项目卡 / Novel toolbar / 抽屉项卡片右侧 | 已 import，复用 |
| （`X`） | 抽屉关闭按钮 | 已 import 在多处，复用 |
| （`AlertTriangle`） | partial 态 / 错误提示 | 已 import 在多处，复用 |

**唯一新 import**：`FileDown` — 1 行 diff。

#### 4.3.2 lucide bundle 影响

lucide-react 是 tree-shake 优化的，每个 icon 单独 module。新增 `FileDown` 增量 ≈ 1KB gzip · 远低于 NFR-2 阈值。

### 4.4 · PRD §6.5 类名校正清单

> CA 在 §3.3 / §3.6 / §4.2 实施时实测发现 PRD §6.5 给的代码契约有 4 处类名/属性需校正。下面是落地时的 erratum：

| PRD §6.5 原文 | 实际正确写法 | 原因 |
|---|---|---|
| `bg-bg-surface` | `bg-surface` | tailwind.config.ts:63 用 `surface` 单段名 |
| `w-[420px]` | `w-drawer` | spacing.drawer 已存在 / 优先语义化 |
| `duration-240` | `duration-300 ease-out-quint` 或 `duration-200` | tailwind 默认 duration 不含 240，最近值 300 / 200 |
| `elevation-floating` | `shadow-floating` | tailwind boxShadow 用 `shadow-` 前缀 |

**校正后的 PRD §6.5 抽屉容器代码**（CA 落地版 · 等价于 PRD §6.5 修正后）：

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="export-drawer-title"
     className="
       fixed inset-y-0 right-0 w-drawer bg-surface border-l border-border-default
       shadow-floating transition-transform duration-300 ease-out-quint
       flex flex-col
     ">
```

> 此校正**不修改 PRD**（PRD 已 finalize / status=final）。CA 作为下游文档，承接落地校正。VP workflow 若想"反向修订 PRD"，可在 PRD finalize 之后追加 erratum 段（不建议）。

### 4.5 · 4 个工程决策的最终结论矩阵

| ID | 决策 | 结论 | 触发降级条件 |
|---|---|---|---|
| **D1** | docx 路线 | HTML 容器（§3.3 + §4.1） | spike 失败 → R-1 L1/L2/L3 |
| **D2** | parser 算法 | 5 步状态机（§3.4.1） | dogfood 实测识别错误率 > 10% → 调 regex 优先级 |
| **D3** | csv 字段映射 | 中英双语 alias + key=value 兜底（§3.5） | 制片人反馈 → 迭代 v3.1 |
| **D4** | utility 补全 | **零 tailwind config 改动**（§4.2 audit） | n/a · 全部 utility 已存在 |

---

## §5 实施顺序（5 PR · 每 PR ≤ 200 行 diff · v3 路线 Week 1 排期）

> 把 §3 / §4 翻译成可逐 PR 落地的实施序。每 PR 独立可 review / 独立 npx vite build 通过。
> PR 之间**不**强制原子 —— PR-N 可在 PR-N+1 不存在时正常构建（dead code 容忍 1 周内）。

### 5.1 · PR 路线图（自底向上）

```
PR-1  Foundation        →  projectExport.ts export 调整 + helper 抽离 (≤ 60 行)
PR-2  Pure builders     →  screenplayParser + exportFormats 5 builder + 单测 (≤ 400 行)
PR-3  UI shell          →  ExportDrawer + useExportActions (≤ 250 行)
PR-4  Wire entry points →  Home / Novel / Screenplay 3 处接入 (≤ 60 行)
PR-5  Spike + AC pass   →  D1 docx spike + dogfood AC-1..8 验证 (代码 ≤ 0 行 / 文档 ≤ 100 行)
```

**总实施代码 ≤ 770 行**（NFR-7 预算 800 行内）。

### 5.2 · 各 PR 详表

#### PR-1 · Foundation

| 项 | 内容 |
|---|---|
| **目标** | 把 `projectExport.ts` 的 safeName + stamp 逻辑抽离为 helper · 暴露 `packageToBlob` |
| **改动文件** | `src/store/projectExport.ts` 唯一一个 |
| **diff 上限** | ≤ 60 行（实际预估 ~30 行） |
| **关键改动** | 新增 `export function buildExportFilename` / `formatStamp` / `sanitizeName`；`packageToBlob` 加 `export` + 内部改用新 helper（**byte-for-byte 等价**，红线 #2 守住） |
| **构建验证** | `npx vite build` 通过 / module 数 ≤ 1912 |
| **回归验证** | Home `<Download>` 仍可下载 `.flil.json` / 内容与 PR-1 前 byte-for-byte 一致（AC-1 第 6 子项预演） |
| **测试** | 单测可选；手测：导一次老 `.flil.json` 用 `Compare-Object` 比对前后 |
| **commit msg** | `refactor(export): expose packageToBlob + extract filename helpers (gap-e prep)` |
| **不阻塞下游** | ✅ PR-2 可并行起草（PR-2 依赖的 helper 已就位） |

#### PR-2 · Pure builders

| 项 | 内容 |
|---|---|
| **目标** | 落 `screenplayParser` + `exportFormats` 5 builder + extractor + 单测 fixture |
| **改动文件** | 新增 `src/pipeline/screenplayParser.ts` / `src/store/exportFormats.ts` / `src/store/exportFormats.test.ts`（可选） |
| **diff 上限** | ≤ 400 行（parser ~100 / exportFormats ~300 / 单测 ~150） |
| **关键改动** | 完全按 §3.1–§3.6 代码片段落盘；不引 npm 依赖 |
| **构建验证** | `npx vite build` ≤ 1916 modules / `npx tsc --noEmit` 0 error |
| **静态验证** | grep I-1/I-2/I-3 全过：新模块不 import `react`/`zustand`/`dexie` write API |
| **测试** | 单测推荐落 5 个：FR-6 升序 / AC-2 partial 横幅 / FR-8 转场识别 / FR-6 BOM / I-6 frozen Date |
| **commit msg** | `feat(export): add screenplay parser + 5 format builders (FR-1..5)` |
| **不阻塞下游** | ✅ PR-3 可并行（PR-3 是 UI 层 · 6 个纯函数已稳定） |

#### PR-3 · UI shell

| 项 | 内容 |
|---|---|
| **目标** | 落 `<ExportDrawer>` 组件 + `useExportActions` hook |
| **改动文件** | 新增 `src/components/ExportDrawer.tsx`（含内嵌 `useExportActions` hook） |
| **diff 上限** | ≤ 250 行 |
| **关键改动** | 按 §6.5（PRD）+ §4.4 校正后类名落 tsx；3 态判定调 §2.5 `deriveItemState`；6 项 cards 调 §3 builders；focus 管理 + Esc 关闭按 NFR-4 |
| **构建验证** | `npx vite build` ≤ 1925 modules |
| **静态验证** | I-3 grep `URL.createObjectURL` 仅在 `downloadBlob`（既有），新文件 = 0 hit |
| **测试** | 手测：抽屉脱机插入到 `/dev` 测试页面（不依赖 PR-4） · 数据全有 / 部分缺 / 全无 三态 |
| **commit msg** | `feat(export): add ExportDrawer with 6 format selector (FR-11)` |
| **不阻塞下游** | ⚠ PR-4 必须在此之后（page 文件 import `<ExportDrawer>`） |

#### PR-4 · Wire entry points

| 项 | 内容 |
|---|---|
| **目标** | 3 处 page toolbar 接入抽屉 · "纯 add line" 形态（PRD R-4 L2） |
| **改动文件** | `src/pages/Home.tsx` / `src/pages/Novel.tsx` / `src/pages/Screenplay.tsx` |
| **diff 上限** | ≤ 60 行（每文件 ≤ 20 行） |
| **关键改动** | Home：替换 1 处 onClick + 加 useState + 加 JSX（FR-11.1）；Novel：toolbar 加 `<Button>导出</Button>` + state + JSX（FR-11.2）；Screenplay：toolbar 加 `<Button>下载剧本…</Button>` + state + JSX + import `FileDown`（FR-11.3） |
| **构建验证** | `npx vite build` ≤ 1925 modules（与 PR-3 持平 · 仅 page 引用不增 module） |
| **静态验证** | `git diff src/pages/{Home,Novel,Screenplay}.tsx` 应该 100% 是 `+` 行（除 Home 一行 onClick 替换） |
| **测试** | 手测 dogfood smoke 3 步：每页打开抽屉 → 选项灰显态正确 → 任选一项下载成功 |
| **commit msg** | `feat(export): wire ExportDrawer into Home/Novel/Screenplay toolbars (FR-11.1..3)` |
| **不阻塞下游** | ⚠ PR-5 必须在此之后（dogfood 验收依赖 3 入口已通） |

#### PR-5 · Spike + AC pass + dogfood log

| 项 | 内容 |
|---|---|
| **目标** | D1 docx spike + dogfood 一次性跑全 AC-1..8 + 启动 `docs/dogfood-log.md` |
| **改动文件** | 新建 `docs/dogfood-log.md`（PRD §8.3 锚点）；可能 0 行代码改动 |
| **diff 上限** | ≤ 100 行（全部文档） |
| **关键改动** | dogfood-log scaffold + AC-1..8 8 行验收记录 + spike 结果记录 |
| **代码改动** | 仅当 D1 spike 失败时触发 R-1 L1/L2 代码修改（按 §4.1.3 阶梯）；spike 通过则零代码改动 |
| **测试** | dogfood AC-1..8 全跑：手测 6 格式各下载 1 次 + Word/Final Draft/Excel 实际打开验证 + IDB count before/after 比对 |
| **commit msg** | `chore(release): gap-e export AC pass + dogfood log baseline` |
| **不阻塞下游** | n/a · 这是 IMPL 阶段终点 |

### 5.3 · 测试 / 验收对应表

| AC | PR | 测试方式 | 是否单测可达 |
|---|---|---|---|
| AC-1 6 格式 happy-path | PR-5 | dogfood 手测 6 格式 + 实际外部应用打开 | ❌ 需要 Word/Final Draft 实物验证 |
| AC-2 partial 降级 | PR-2 + PR-5 | PR-2 单测 partial 横幅；PR-5 手测 5/10 章 | ✅ 可单测 |
| AC-3 disabled 态 | PR-3 + PR-5 | PR-3 手测空项目；PR-5 dogfood 含空项目验证 | ⚠ 半单测（需 React Testing Library） |
| AC-4 Home 行为变更 | PR-4 + PR-5 | PR-4 手测 Home `<Download>` 弹抽屉；PR-5 dogfood `.flil.json` byte-for-byte | ✅ byte-for-byte 可单测 |
| AC-5 离线 | PR-5 | DevTools offline + 6 格式重跑 | ❌ 需手测 |
| AC-6 性能阈值 | PR-5 | dogfood 期间 `performance.now()` 5 次取 P95 | ❌ 需手测 |
| AC-7 数据零副作用 | PR-5 | IDB count before/after 脚本（PRD AC-7 已给代码） | ✅ 可写脚本 |
| AC-8 构建/类型零退化 | 每 PR | `npx vite build` + `npx tsc --noEmit` | ✅ CI 可达（项目无 CI 则手跑） |

### 5.4 · git commit 节奏建议

```
Week 1 (v3 路线 Week 1 · 排期 brief §4)
├── Mon  PR-1 (Foundation)              · 30 行 · 30 分钟
├── Tue  PR-2 (Pure builders)           · 400 行 · 半天 + 单测半天
├── Wed  PR-3 (UI shell)                · 250 行 · 半天 + 手测半天
├── Thu  PR-4 (Wire entry points)       · 60 行 · 1 小时 + 手测半天
├── Fri  PR-5 (Spike + AC + dogfood)    · 文档为主 · 1 天
└── Week-end review / 缓冲              · 留 R-1 docx spike 失败时降级窗口
```

**风险吸收**：PR-2 半天写代码 + 半天单测的安排允许 1 天滑入 PR-3；PR-5 留 1 天作为 spike 失败的缓冲。如果 v3 缺口 e Week 1 出意外，最坏也只滑到 Week 2 早期，不影响 brief §4 的 d/b/c/a 后续节奏。

### 5.5 · 实施期间的"不许做"清单

> CA 给 IMPL 阶段的硬约束（CK workflow 会再次确认）：

| 不许 | 原因 |
|---|---|
| 加 `npm install` 任何依赖（除 R-1 L2 spike 失败触发 docx）| NFR-2 / AC-8 |
| 改 Dexie schema | 红线 #1 |
| 改 `.flil.json` v1 schema | 红线 #2 |
| 改 `Screenplay.tsx exportToAssets()` 函数 | 红线 #3 |
| 改 DESIGN.md token / 加 `bg-[#xxx]` arbitrary value | 红线 #4 |
| 加 `signal: AbortSignal` 参数 | §2.6 决策 |
| 修改 PRD finalize 文档（含 §6.5 类名错误）| BMAD finalize 不回滚 · 走 §4.4 erratum |
| 写 `_deprecated_` 命名 / 加 `// TODO:` 多余注释 | AGENTS.md §"Coding style" |
| 做"顺手优化"无关现有代码 | Karpathy "Simplicity First" / 红线 #5 |

---

## §6 引用对齐自检（finalize 收口）

> 与 PRD §11 同款节奏：编号 / 锚点 / 术语 / workflow 衔接 4 类交叉验证。
> AI 协作者落地前先核对一遍。

### 6.1 编号体系完整性

| 体系 | 总数 | 范围 | 反向引用次数 |
|---|---|---|---|
| **§** 章节 | 7（§0–§6 + finalize） | 主结构 | n/a |
| **D**（决策） | 4 | D1–D4 | §0.3 定义 → §3.3 §3.4 §3.5 §4.1 §4.2 §4.5 引用 |
| **不变量 I** | 6 | I-1–I-6 | §1.4 + §2.7 定义 → §5.2 PR-2/PR-3 静态验证 引用 |
| **PR** | 5 | PR-1–PR-5 | §5.2 定义 → §5.3 / §5.4 引用 |
| **AC**（继承自 PRD） | 8 | AC-1–AC-8 | §5.3 测试对应表 全覆盖 |
| **FR**（继承自 PRD） | 11 | FR-1–FR-11 | §3 / §4 / §5 全覆盖 |
| **R**（继承自 PRD 风险） | 5 | R-1–R-5 | §4.1.3 R-1 三级降级 / §5.4 R-1 缓冲 / §1.1 R-4 L2 落地 |
| **红线** | 5 | 红线 #1–#5 | §0.2 定义 → §1.1 / §3.6 / §5.5 全文反向绑定 |

**自检**：

- ✅ D1–D4 4 决策**全部解决**：D1=§3.3+§4.1 / D2=§3.4 / D3=§3.5 / D4=§4.2
- ✅ I-1..I-6 6 不变量**全部给出物理保证 + 测试手段**（§2.7 表）
- ✅ AC-1..AC-8 **全部映射到至少 1 个 PR**（§5.3 表）
- ✅ FR-1..FR-11 **全部有具体代码片段**（§3.1–§3.6）
- ✅ R-1 给三级降级阶梯 / R-2 fountain 兜底 / R-3 dogfood 容忍 / R-4 PR diff 形态保证 / R-5 文档承接

### 6.2 代码引用一致性

CA 全文引用代码位置共 **9 处**（在 PRD 14 处基础上新增 1 处 `tailwind.config.ts:124-134`）。锚点用法：

| 引用 | 锚点 | 用途 |
|---|---|---|
| `src/store/projectExport.ts:25` `:113-126` `:128-139` `:84-97` `:60-77` | `FLIL_SCHEMA` / `packageToBlob` / `downloadBlob` / row→ctx / row→artifact | §0.5 + §3.1 + §3.6 复用清单 |
| `src/store/db.ts:38-49` `:54-...` | `Artifact` / `LiveArtifact` 接口 | §0.5 形态对齐 |
| `src/pages/Home.tsx:107-117` `:242-250` | `handleExportArchived` + `<Download>` icon | §6.2.1 接入点 |
| `src/pages/Novel.tsx:412-505` | toolbar | §6.2.2 接入点 |
| `src/pages/Screenplay.tsx:3-7` `:69-76` `:309-339` | lucide imports / `exportToAssets` / toolbar | §6.2.3 接入点 + 红线 #3 |
| `src/pages/Assets.tsx:9` `:47-51` | parseLooseArray + 剧本来源选择 | §3.1 extract* |
| `src/pipeline/novelLoop.ts:11` `:259` `:270` `:317-333` | content 注释 / 章号兜底 / sort / `NovelChapterLoopMeta` | §3.1 + §3.2 + FR-6 |
| `tailwind.config.ts:62-76` `:97-104` `:110-122` `:124-134` | colors / spacing / borderRadius / boxShadow | §4.2 utility 审计 |
| `DESIGN.md` token 各 token | drawer width 420 / typography scales / elevation | §4.2 + §4.4 |

**验证手段**（CK 阶段开始前应跑）：

```powershell
# 1. PRD + CA 全文 @-引用列表
Get-Content -Path 'docs/planning/prd-gap-e-export.md', 'docs/planning/architecture-gap-e-export.md' |
  Select-String '@C:\\' | Select-Object -Unique

# 2. 对每条结果用 grep_search 验证锚点存在
```

### 6.3 PRD 与 CA 之间的引用对齐

CA 严格继承 PRD 的所有约束：

| PRD 章节 | CA 落地章节 | 落地方式 |
|---|---|---|
| PRD §0.5 红线 #1–#5 | CA §0.2 | 5 行表 → CA 落地约束（每条具体到代码层）|
| PRD §2.1 G1–G7 | CA §3 / §5.3 | G1/G2 → §3.2/§3.3 / G3/G4 → §3.4 / G5 → §3.5 / G6 → §1.1 + UI / G7 → §0.4 zero-dep |
| PRD §3 U1–U3 | 不直接对应 | use-case 在 PRD 已转 FR；CA 实施序按 FR/PR 排，不重新 use-case 映射 |
| PRD §4 FR-1..FR-11 | CA §3.1–§3.6 + §1.1 | 每 FR 给完整代码 / 函数签名 |
| PRD §5 NFR-1..NFR-9 | CA §5.2 各 PR 验证项 | NFR-1 性能 → PR-5 dogfood / NFR-2 体积 → PR 各自构建验证 / NFR-7 surgical → §1.1 白名单 |
| PRD §6 UX | CA §4.4 类名校正 + §3 builders | 4 处 §6.5 类名 erratum 已锁 |
| PRD §7 AC-1..AC-8 | CA §5.3 测试对应表 | 全覆盖 |
| PRD §8 度量 | 不直接对应 | 度量在 dogfood-log（PR-5）实施期收集 |
| PRD §9 R-1..R-5 | CA §4.1.3 / §5.4 缓冲 | R-1 三级降级 / R-2 fountain 兜底 / R-3 dogfood / R-4 PR diff 形态 / R-5 文档承接 |
| PRD §10 Out-of-Scope | CA §5.5 不许做清单 | 9 条不许做映射回 PRD §10 各项 |

**反向引用**：CA §4.4 PRD §6.5 类名 erratum 是 **CA → PRD 的反向修订指针**。PRD 已 finalize 不回滚（BMAD 信条）；CA 作下游承接。

### 6.4 术语一致性（与 PRD §11.3 同款 + CA 新增）

继承 PRD §11.3 全部 5 条术语，CA 新增 4 条：

| 术语（CA 新增） | 唯一含义 |
|---|---|
| **build*** | `buildNovelMd / buildNovelDocx / buildScreenplayFdx / buildScreenplayFountain / buildAssetsCsv` 5 个纯函数（不含 `.flil.json` ——它走 `exportArchivedProjectFile`） |
| **`ExportSourceData`** | 抽屉打开时一次性组装的归一化数据契约（§3.1 定义） |
| **spike**（D1） | 实施第一天必跑的 .docx Word 兼容验证（§4.1.1） |
| **erratum** | CA 对已 finalize PRD 的下游校正（§4.4 仅 4 处类名，不回滚 PRD） |

### 6.5 BMAD workflow 衔接（CA 角度）

| 阶段 | workflow | 状态 |
|---|---|---|
| CB | bmad-create-brief | ✅ 已交付 (`product-brief.md`) |
| CP | bmad-create-prd | ✅ 已 finalize (`prd-gap-e-export.md` 1151 行) |
| **CA** | **bmad-create-architecture** | ✅ **本文 finalize** |
| VP（可选并行） | bmad-validate-prd | 暂未启动 |
| **CK** | bmad-create-checkpoint | ⏳ **推荐下一步** |
| IMPL | (无 workflow · 5 PR) | CK 后启动 |
| VR | bmad-validate-release | IMPL 后 |

---

## §7 收尾承诺

> 本 CA 1490 行已 finalize。覆盖 PRD 全部 11 FR / 9 NFR / 8 AC / 5 R 的工程翻译。
> 与 PRD / brief / DESIGN / AGENTS 在以下硬约束上**完全对齐**：

- ✅ PRD §0.5 5 红线 → CA §0.2 + 全文落地点（每红线至少 3 处反向绑定）
- ✅ PRD §4 11 FR → CA §3 完整代码片段（每 FR 至少 1 个 build* 或 helper）
- ✅ PRD §5 NFR-1..NFR-9 → CA §1.1 白名单 + §5.2 PR 各自验证项
- ✅ PRD §6 UX → CA §4.4 类名 erratum + §3 builders
- ✅ PRD §7 AC-1..AC-8 → CA §5.3 测试对应表全覆盖
- ✅ PRD §9 R-1..R-5 → CA §4.1.3 + §5.4 缓冲机制
- ✅ DESIGN.md token → CA §4.2 utility 实测审计 / 零 config 修改 / 4 处 PRD 类名校正
- ✅ AGENTS.md surgical → CA §1.1 白名单 + §5.5 不许做 9 条
- ✅ AGENTS.md §"验证" 3 步走 → CA §5.2 各 PR 构建/类型/手测验证项

### 推荐下一步

**首选 · CK workflow**（实施前 checkpoint · 锁定 PRD/CA 后再开第一个 PR）：

```
/bmad-create-checkpoint
inputs:
  - docs/planning/product-brief.md
  - docs/planning/prd-gap-e-export.md
  - docs/planning/architecture-gap-e-export.md  ← 本 CA
output:
  - docs/planning/checkpoint-gap-e-export.md
focus:
  - 把 §5.5 不许做 9 条 + §0.2 5 红线 转为 IMPL 期间的 review checklist
  - 锁 PR-1..PR-5 顺序与 commit msg 模板
  - 给 D1 docx spike 的 go/no-go 判定流程
```

**直接进 IMPL**（跳 CK · 适用于单人项目 / 已熟悉 PRD+CA 全部细节）：

```
git checkout -b feat/gap-e-export
# 按 §5.4 节奏 · 从 PR-1 开始
```

**并行可选 · VP workflow**（独立验证 PRD 自身完备性 · 与 CA 已经完成的 §6.3 引用对齐部分重叠）：

```
/bmad-validate-prd
inputs:
  - docs/planning/prd-gap-e-export.md
output:
  - docs/planning/prd-gap-e-export-validation.md
```

---

<!-- BMAD CA · 7 步全部完成 · status: final · 下一步 → CK / IMPL / VP -->
