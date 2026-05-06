---
project: CineForge Web
ckId: v3-gap-e-export
gapCode: e
stage: v3 (planning · checkpoint)
author: QvQ
date: 2026-05-06
audience: self + AI 协作者 (Cascade / Claude / Cursor / Copilot)
status: final
finalizedAt: 2026-05-06
workflow: BMAD-METHOD · CK (bmad-create-checkpoint)
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/planning/product-brief.md              # CB · v3 路线
  - docs/planning/prd-gap-e-export.md           # CP · 1151 行 finalize
  - docs/planning/architecture-gap-e-export.md  # CA · 1551 行 finalize
relatedOutputs:
  - docs/dogfood-log.md                         # IMPL PR-5 阶段创建
nextWorkflow: IMPL (PR-1 / git branch feat/gap-e-export)
---

# Checkpoint · v3 缺口 e · 导出（Export）

> 本文档由 BMAD-METHOD `bmad-create-checkpoint` (CK) workflow 5 步生成。
> CK 不复述 PRD/CA，把 PRD §0.5 红线 + CA §5.5 不许做 + CA §1.1 白名单 + CA §2.7 invariant
> **转成可勾选 / 可机械验证的清单**。IMPL 阶段直接复用本文档作 review checklist。

## §0 Checkpoint 上下文

### 0.1 上游 finalize 状态确认（CK 启动前置条件）

| 上游产物 | 状态 | 行数 | finalize 日期 | 引用关键 |
|---|---|---|---|---|
| `@C:\Users\QvQ\CascadeProjects\fili-web\docs\planning\product-brief.md` | ✅ final | 137 | 2026-05-06 | v3 5 缺口排序 |
| `@C:\Users\QvQ\CascadeProjects\fili-web\docs\planning\prd-gap-e-export.md` | ✅ final | 1151 | 2026-05-06 | 11 FR + 9 NFR + 8 AC + 5 R |
| `@C:\Users\QvQ\CascadeProjects\fili-web\docs\planning\architecture-gap-e-export.md` | ✅ final | 1551 | 2026-05-06 | 4 D + 6 invariant + 5 PR |

**验证命令**（CK 落盘前执行）：

```powershell
Select-String -Path 'docs/planning/*.md' -Pattern 'status:\s*final' |
  Select-Object Path, Line
```

**期望输出**：3 行 `status: final`（brief 无 status 字段，但 PRD/CA 必须 final）。

### 0.2 CK 角色定位 · 清单 not 叙述

CK 与 PRD/CA 的形态差异：

| | PRD (CP) | CA | CK |
|---|---|---|---|
| 主体 | What 叙述 | How 蓝图 | Gate 清单 |
| 行数 | 1151 | 1551 | 350-450 |
| 主结构 | §1-§10 章节 | §0-§5 + 代码片段 | 可勾选 ✅/❌ 项 |
| finalize 后 | 不回滚 | 不回滚 | 不回滚 |
| 服务对象 | 决策者 + AI 实施者 | AI 实施者 | AI 实施者每次开 PR 前 |

### 0.3 IMPL 启动条件（CK finalize 即解锁）

> **以下 4 项全部满足，IMPL 才能开 PR-1**。任一不满足 → 回退到对应 workflow。

- ✅ **C-1** brief / PRD / CA 三份文档全部 status=final（§0.1 验证通过）
- ✅ **C-2** 本 CK 文档 status=final（self-reference · Step 5 落盘后达成）
- ✅ **C-3** 当前 git working tree clean（`git status` 无 uncommitted changes）—— 防止本地脏代码污染 PR-1
- ✅ **C-4** `npx vite build` 当前基线通过（1911 modules / ~3s）—— PR-1 必须从干净基线开起

---

## §1 IMPL Pre-flight Checklist（22 项 · IMPL Day 1 必勾）

> 以下 22 项是 IMPL 第一次开 PR-1 前**必须勾选**的清单。
> 每项给出"如何验证"（命令 / grep / 手测）。
> AI 协作者实施时按本节自检；若任一未通过即停 + 回报。

### 1.1 红线 5 条 · 验证项（PRD §0.5 / CA §0.2）

#### 红线 #1 · 不动 Dexie schema

- ✅ **R1.1** 当前 Dexie schema 是 v4（`@C:\Users\QvQ\CascadeProjects\fili-web\src\store\db.ts` 内 `version(4)` 是最新）
- ✅ **R1.2** 整个 IMPL 期间**不调用** `db.version(N)` `bulkPut` `add` `update` `delete` `clear`（除既有 `projectExport.ts` / `projectArchive.ts` 既有调用）

**验证命令**：

```powershell
# IMPL 完成后跑：新增/修改文件中不应出现 Dexie write API
git diff main...HEAD -- 'src/components/ExportDrawer.tsx' 'src/store/exportFormats.ts' 'src/pipeline/screenplayParser.ts' |
  Select-String -Pattern '\.bulkPut\(|\.add\(|\.update\(|\.delete\(|\.clear\(|\.version\('

# 期望：0 hit
```

#### 红线 #2 · 不动 `.flil.json` v1 schema

- ✅ **R2.1** `FLIL_SCHEMA = 'flil/project/v1'` 常量值不变（仅可改 `function` → `export function` 暴露）
- ✅ **R2.2** `FlilPackageV1` interface 字段无增减
- ✅ **R2.3** `packageToBlob` 函数体 byte-for-byte 等价（仅前缀 `export` + 内部改用 helper）

**验证命令**：

```powershell
# PR-1 落盘后跑：导出一个旧项目，与 PR-1 之前导出对比
# 1) 在 PR-1 之前导出某项目 → save as before.flil.json
# 2) PR-1 落盘后导出同项目 → save as after.flil.json
# 3) 排除 exportedAt 时间戳后对比
$before = Get-Content before.flil.json -Raw | ConvertFrom-Json
$after  = Get-Content after.flil.json  -Raw | ConvertFrom-Json
$before.exportedAt = $after.exportedAt = 0
( $before | ConvertTo-Json -Depth 99 ) -eq ( $after | ConvertTo-Json -Depth 99 )

# 期望：True
```

#### 红线 #3 · 不动 `Screenplay.tsx exportToAssets()`

- ✅ **R3.1** `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Screenplay.tsx:69-76` `exportToAssets` 函数零字节修改
- ✅ **R3.2** 该函数对应的 toolbar 按钮（`<Box>` icon + 「进入资产阶段」label）零字节修改

**验证命令**：

```powershell
git diff main...HEAD -- 'src/pages/Screenplay.tsx' |
  Select-String -Pattern 'exportToAssets|进入资产阶段'

# 期望：0 hit (函数体和 label 在 diff 中均无出现)
```

#### 红线 #4 · DESIGN.md token 强约束

- ✅ **R4.1** 新增 / 修改文件中 0 个 `bg-[#xxx]` `p-[7px]` `text-[14.5px]` 等 arbitrary value
- ✅ **R4.2** 新增 utility 全部使用 tailwind.config.ts 已有 token（`bg-surface` / `w-drawer` / `shadow-floating` / `text-heading-m` 等）

**验证命令**：

```powershell
# 实施期间 grep arbitrary value (含 -[ 模式)
git diff main...HEAD -- '*.tsx' '*.ts' |
  Select-String -Pattern '"\s*[a-z-]+-\[[^\]]+\]"' |
  Select-String -NotMatch -Pattern '^[+-]{3}'

# 期望：0 hit
```

#### 红线 #5 · Karpathy surgical（"纯 add line"形态）

- ✅ **R5.1** `git diff --stat main...HEAD` 显示 **新增/修改文件 ≤ 7 个**（CA §1.1 白名单：4 新 + 3 改）
- ✅ **R5.2** `src/pages/{Home,Novel,Screenplay}.tsx` 三文件的 diff **删除行 ≤ 1**（仅 Home.tsx 一行 onClick 替换；Novel/Screenplay 0 删除）
- ✅ **R5.3** 总实施代码 ≤ 800 行（NFR-7 预算）

**验证命令**：

```powershell
# 文件数 / 行数统计
git diff --stat main...HEAD

# Home / Novel / Screenplay 删除行
git diff --numstat main...HEAD -- 'src/pages/Home.tsx' 'src/pages/Novel.tsx' 'src/pages/Screenplay.tsx'
# 输出 3 行：<added>\t<deleted>\t<filename>
# 期望：Home.tsx deleted ≤ 1 / Novel.tsx deleted = 0 / Screenplay.tsx deleted = 0
```

### 1.2 9 不许做（CA §5.5）· grep 验证命令

| # | 不许 | grep 验证命令（PowerShell） | 期望 |
|---|---|---|---|
| 1 | 加 npm 依赖 | `git diff main...HEAD -- package.json \| Select-String '"[a-z-]+"\s*:'` | 0 hit（除非 R-1 L2 触发 docx） |
| 2 | 改 Dexie schema | 见 R1.2 命令 | 0 hit |
| 3 | 改 .flil.json v1 | 见 R2.3 byte-for-byte | True |
| 4 | 改 exportToAssets() | 见 R3.1 命令 | 0 hit |
| 5 | 加 arbitrary value | 见 R4.1 命令 | 0 hit |
| 6 | 加 AbortSignal 参数 | `git diff main...HEAD \| Select-String 'signal\?:\s*AbortSignal'` | 0 hit |
| 7 | 改 PRD finalize 文档 | `git diff main...HEAD -- docs/planning/prd-gap-e-export.md docs/planning/architecture-gap-e-export.md` | 0 hit |
| 8 | 加 `_deprecated_` / `// TODO:` | `git diff main...HEAD \| Select-String 'TODO\\|_deprecated_'` | 0 hit（容忍既有 TODO 不动） |
| 9 | 顺手优化无关代码 | 看 §1.4 文件白名单是否被超出 | 见 1.4 |

### 1.3 文件白名单（CA §1.1）· git status 期望

> IMPL 完成后 `git status` 看到的 modified/new 文件**必须**完全等于下表。任何 extra 文件 → 触发 reject。

#### 期望新增（4 + 1 可选 = 5 文件）

```
new file:   src/components/ExportDrawer.tsx          ≤ 250 行
new file:   src/store/exportFormats.ts                ≤ 350 行
new file:   src/pipeline/screenplayParser.ts          ≤ 200 行
new file:   src/store/exportFormats.test.ts           可选 ≤ 150 行
new file:   docs/dogfood-log.md                       PR-5 创建
```

#### 期望修改（4 文件）

```
modified:   src/store/projectExport.ts                ≤ 30 行 diff (PR-1)
modified:   src/pages/Home.tsx                        ≤ 15 行 diff (PR-4)
modified:   src/pages/Novel.tsx                       ≤ 15 行 diff (PR-4)
modified:   src/pages/Screenplay.tsx                  ≤ 20 行 diff (PR-4)
```

#### 期望不修改（5 类硬约束）

```
未修改:     src/store/db.ts                          ← 红线 #1
未修改:     src/store/projectExport.ts 的现有逻辑     ← 红线 #2 (仅加 export)
未修改:     src/pages/Screenplay.tsx exportToAssets() ← 红线 #3
未修改:     src/components/ui/**                     ← 红线 #4 (DESIGN.md token)
未修改:     tailwind.config.ts                       ← CA §4.2 audit 结论
```

**验证命令**：

```powershell
git diff --name-status main...HEAD | Sort-Object

# 期望（按字典序）：
# A   docs/dogfood-log.md                      (PR-5)
# A   docs/planning/checkpoint-gap-e-export.md (本文)
# M   src/pages/Home.tsx                       (PR-4)
# M   src/pages/Novel.tsx                      (PR-4)
# M   src/pages/Screenplay.tsx                 (PR-4)
# A   src/components/ExportDrawer.tsx          (PR-3)
# A   src/pipeline/screenplayParser.ts         (PR-2)
# A   src/store/exportFormats.test.ts          (PR-2 可选)
# A   src/store/exportFormats.ts               (PR-2)
# M   src/store/projectExport.ts               (PR-1)
```

### 1.4 6 invariant 静态验证（CA §2.7）

> CA §2.7 定义的 I-1..I-6 在 PR-2 / PR-3 落盘后**必须**通过 grep 验证。

| Invariant | 验证命令（PowerShell） | 期望 |
|---|---|---|
| **I-1** read 阶段零 mutation | `Select-String -Path 'src/components/ExportDrawer.tsx', 'src/store/exportFormats.ts', 'src/pipeline/screenplayParser.ts' -Pattern '\.add\(\|\.put\(\|\.update\(\|\.delete\(\|\.bulkPut\('` | 0 hit |
| **I-2** build 阶段纯函数 | `Select-String -Path 'src/store/exportFormats.ts', 'src/pipeline/screenplayParser.ts' -Pattern "from\s+'react'\|from\s+'zustand'\|from\s+'dexie'"` | 0 hit |
| **I-3** 副作用单点收敛 | `Select-String -Path 'src/components/ExportDrawer.tsx', 'src/store/exportFormats.ts', 'src/pipeline/screenplayParser.ts' -Pattern 'URL\.createObjectURL'` | 0 hit |
| **I-4** unmount 零残留 | 手测：DevTools Memory snapshot 抽屉打开/关闭前后 ObjectURL 数对比 | 抽屉关闭后无残留 |
| **I-5** archived/live 同 build* | code review 确认 `assembleSourceData` 两路径都返回 `ExportSourceData` 类型 | 走 §3.1 同款类型 |
| **I-6** build* 输出可复现 | 单测 with `vi.useFakeTimers()`（CA §3.7 已给）| frozen Date 下 byte-for-byte 等 |

### 1.5 NFR baseline 锁定

> IMPL 开始前的当前 baseline 数值，PR-N 完成后必须**不退化**。

| NFR | baseline | 各 PR 完成后约束 | 验证命令 |
|---|---|---|---|
| NFR-2 模块数 | **1911 modules** | PR-1 ≤ 1912 / PR-2 ≤ 1916 / PR-3 ≤ 1925 / PR-4 ≤ 1925 / PR-5 ≤ 1925 | `npx vite build 2>&1 \| Select-String 'modules transformed'` |
| NFR-2 build 时间 | **~3s** | 各 PR ≤ 3.15s（5% 退化容忍）| 同上输出末尾 `built in X.XXs` |
| NFR-2 vendor chunk | （记录当前值）| 不增加（除 R-1 L2 触发 docx ≤ +200KB gzip）| `npx vite build` 后看 dist 输出表 |
| NFR-7 总实施代码 | 0（基线）| 累计 ≤ 800 行 | `git diff --shortstat main...HEAD` |
| NFR-9 IDB count | （IMPL 前快照）| IMPL 完成后**完全等同** | 浏览器 console 跑 PRD AC-7 脚本 |

**baseline 采集命令**（CK finalize 后、PR-1 之前跑 1 次）：

```powershell
# 1. 模块数 + build 时间
npx vite build 2>&1 | Tee-Object -FilePath logs/baseline-build.log

# 2. IDB count 快照（浏览器 DevTools console 中）
# const before = {
#   artifacts: await db.artifacts.count(),
#   liveArtifacts: await db.liveArtifacts.count(),
#   runHistory: await db.runHistory.count(),
#   projects: await db.projects.count(),
# };
# console.log(JSON.stringify(before));
# 把输出粘到 docs/dogfood-log.md baseline 节
```

---

## §2 PR Launch Checklist · 5 PR 各自门槛

> 每 PR 给 4 段：**pre-launch gate** / **diff 上限** / **commit msg lock** / **exit gate**。
> 任一 gate 不通过 = 不许 merge。AI 协作者按本节 PR 顺序逐个开。

### 2.1 PR-1 · Foundation（projectExport.ts export 调整）

#### Pre-launch gate（开 PR 前必满足）

- ✅ §0.3 C-1..C-4 全部通过
- ✅ §1.5 baseline 已采集（写入 `docs/dogfood-log.md`）
- ✅ 已读 CA §3.6 `buildExportFilename` / `formatStamp` / `sanitizeName` 完整签名
- ✅ 当前 git branch = `feat/gap-e-export`（不是 main）

#### Diff 上限（机械验证）

| 文件 | 上限 | 类型 |
|---|---|---|
| `src/store/projectExport.ts` | +30 / -5 | M (modified) |
| 其他文件 | 0 行变更 | - |

```powershell
# 验证命令
git diff --numstat HEAD~1 -- 'src/store/projectExport.ts'
# 期望：<added> ≤ 30, <deleted> ≤ 5

git diff --numstat HEAD~1 | Where-Object { $_ -notmatch 'src/store/projectExport.ts' -and $_ -ne '' }
# 期望：空（无其他文件改动）
```

#### Commit msg lock

```
refactor(export): expose packageToBlob + extract filename helpers (gap-e prep)

- Add: export function buildExportFilename(safeName, stamp, ext)
- Add: export function formatStamp(ts)
- Add: export function sanitizeName(name)
- Change: function packageToBlob -> export function packageToBlob
- Change: packageToBlob internal uses buildExportFilename helper (byte-for-byte equivalent)

Refs: PRD prd-gap-e-export.md FR-7 / CA architecture-gap-e-export.md §3.6
Red-line #2 守住: .flil.json byte-for-byte 等价（手测 before/after.flil.json）
```

#### Exit gate（合入 main 前必满足）

- ✅ `npx vite build` 通过 / modules ≤ 1912 / 时间 ≤ 3.15s
- ✅ `npx tsc --noEmit -p .` 0 新增 error
- ✅ 红线 #2 byte-for-byte 验证通过（§1.1 R2.3 命令）
- ✅ 手测：Home `<Download>` 仍可下 `.flil.json` 且能 import 回（功能回归）
- ✅ commit msg 与 lock 模板字面一致（除日期、commit hash）

---

### 2.2 PR-2 · Pure builders（screenplayParser + exportFormats + 单测）

#### Pre-launch gate

- ✅ PR-1 已 merge
- ✅ 已读 CA §3.1 / §3.2 / §3.3 / §3.4 / §3.5 / §3.6 全部代码片段
- ✅ 已读 CA §2.7 6 invariant + §3.4.1 parser 状态机识别顺序硬编码理由

#### Diff 上限

| 文件 | 上限 | 类型 |
|---|---|---|
| `src/store/exportFormats.ts` | +350 / -0 | A (new) |
| `src/pipeline/screenplayParser.ts` | +200 / -0 | A (new) |
| `src/store/exportFormats.test.ts` | +150 / -0 | A (new · 可选 ★) |
| 其他文件 | 0 行变更 | - |

```powershell
git diff --shortstat HEAD~1
# 期望：3 files changed, ~700 insertions(+), 0 deletions(-)
# (无单测则 2 files / ~550 insertions)
```

#### Commit msg lock

```
feat(export): add screenplay parser + 5 format builders (FR-1..5)

New files:
- src/pipeline/screenplayParser.ts: 5-state machine for FR-8 markdown→element mapping
- src/store/exportFormats.ts: 5 pure functions buildNovelMd / buildNovelDocx /
  buildScreenplayFdx / buildScreenplayFountain / buildAssetsCsv + extractors
- src/store/exportFormats.test.ts (optional): 5 unit tests for FR-6/AC-2/I-6

I-1/I-2/I-3 invariants verified: no Dexie writes / no react/zustand imports /
no URL.createObjectURL in new modules.

Refs: CA architecture-gap-e-export.md §3.1-§3.7
```

#### Exit gate

- ✅ `npx vite build` 通过 / modules ≤ 1916 / 时间 ≤ 3.15s
- ✅ `npx tsc --noEmit -p .` 0 新增 error
- ✅ I-1/I-2/I-3 grep 验证全过（§1.4 表）
- ✅ 单测（如写）全部通过（`npx vitest run`）
- ✅ 新增 npm 依赖 = 0（`git diff package.json` 无新增）

---

### 2.3 PR-3 · UI shell（ExportDrawer + useExportActions）

#### Pre-launch gate

- ✅ PR-2 已 merge
- ✅ 已读 CA §1.3.1 `<ExportDrawer>` props 接口 + §2.5 `deriveItemState` + §4.4 PRD §6.5 类名 erratum
- ✅ 确认 lucide-react 已 import 的 icon 列表：`Download` / `X` / `AlertTriangle`（已存在 · 复用）

#### Diff 上限

| 文件 | 上限 | 类型 |
|---|---|---|
| `src/components/ExportDrawer.tsx` | +250 / -0 | A (new · 含内嵌 useExportActions hook) |
| 其他文件 | 0 行变更 | - |

```powershell
git diff --shortstat HEAD~1
# 期望：1 file changed, ~250 insertions(+), 0 deletions(-)
```

#### Commit msg lock

```
feat(export): add ExportDrawer with 6 format selector (FR-11)

- 420px right drawer with DESIGN.md token (w-drawer / shadow-floating /
  ease-out-quint / bg-surface)
- 6 export item cards with 3-state (enabled/partial/disabled) deriveItemState
- A11y: aria-modal=true / Esc to close / focus trap / focus return
- Internal useExportActions hook: live (sync zustand) + archived (async Dexie read)
- DESIGN.md class corrections per CA §4.4 erratum (4 items)

Refs: CA §1.3 §2.1-§2.5 §3.1 §4.4 / PRD §6.1-§6.5 (with erratum)
```

#### Exit gate

- ✅ `npx vite build` 通过 / modules ≤ 1925 / 时间 ≤ 3.15s
- ✅ `npx tsc --noEmit -p .` 0 新增 error
- ✅ I-3 grep 验证：`URL.createObjectURL` 不在 ExportDrawer.tsx 中（仅在既有 `downloadBlob`）
- ✅ 手测：抽屉脱机插入到 `/dev` 路由或 storybook 样板 · 3 态切换正确 · Esc 关闭 · focus 回归
- ✅ 类名 audit：grep `bg-\[\|p-\[\|text-\[` 在新文件 = 0 hit（红线 #4）

---

### 2.4 PR-4 · Wire entry points（Home + Novel + Screenplay 接入）

#### Pre-launch gate

- ✅ PR-3 已 merge
- ✅ 已读 CA §6.2.1 / §6.2.2 / §6.2.3 PRD 接入点完整 tsx 范例
- ✅ 已读 PRD R-4 L2 "纯 add line"形态约束

#### Diff 上限

| 文件 | 上限 | 类型 | 删除行上限 |
|---|---|---|---|
| `src/pages/Home.tsx` | +15 / -1 | M | **唯一允许 -1**（onClick 替换） |
| `src/pages/Novel.tsx` | +15 / -0 | M | **必须 0** |
| `src/pages/Screenplay.tsx` | +20 / -0 | M | **必须 0**（含 lucide import 加 `FileDown`） |
| 其他文件 | 0 行变更 | - | - |

```powershell
git diff --numstat HEAD~1 -- 'src/pages/Home.tsx' 'src/pages/Novel.tsx' 'src/pages/Screenplay.tsx'
# 期望（按 added\tdeleted\tfilename 顺序）：
# 15  1  src/pages/Home.tsx       (上限)
# 15  0  src/pages/Novel.tsx
# 20  0  src/pages/Screenplay.tsx
```

#### Commit msg lock

```
feat(export): wire ExportDrawer into Home/Novel/Screenplay toolbars (FR-11.1..3)

- Home.tsx: replace 1 onClick (handleExportArchived → setExportDrawer state),
  add useState + <ExportDrawer scope='all'> JSX (FR-11.1, behavior change AC-4)
- Novel.tsx: add <Button>导出</Button> + state + <ExportDrawer scope='novel'>
  before <Link to="/">项目首页 (FR-11.2)
- Screenplay.tsx: add <Button><FileDown/> 下载剧本…</Button> + state +
  <ExportDrawer scope='screenplay'>; new lucide import FileDown
  (FR-11.3, red-line #3 icon disambiguation)

PR diff form: 50 lines added / 1 line deleted (Home onClick only)

Refs: CA §6.2 / PRD §6.2.1-§6.2.3
```

#### Exit gate

- ✅ `npx vite build` 通过 / modules ≤ 1925 / 时间 ≤ 3.15s
- ✅ `npx tsc --noEmit -p .` 0 新增 error
- ✅ 红线 #3 grep 验证：`exportToAssets` / `进入资产阶段` 不在 diff 中（§1.1 R3.1 命令）
- ✅ R5.2 删除行验证通过（Home ≤ 1 / Novel = 0 / Screenplay = 0）
- ✅ 手测 dogfood smoke 3 步：Home 抽屉打开 → Novel 抽屉打开 → Screenplay 抽屉打开（任选一个 enabled 项下载成功）

---

### 2.5 PR-5 · Spike + AC pass + dogfood-log 启动

#### Pre-launch gate

- ✅ PR-4 已 merge
- ✅ 已读 §3 D1 docx spike gate（本 CK 文档下一章）
- ✅ 已准备 dogfood 项目：≥ 10 章已润色小说 + 已完成 screenplay.7 + 已跑完三路引擎的资产
- ✅ 已准备测试软件：Word 2016+ / Final Draft 8.x+ / Excel 2016+

#### Diff 上限

| 文件 | 上限 | 类型 |
|---|---|---|
| `docs/dogfood-log.md` | +100 / -0 | A (new) |
| 代码改动（spike 通过） | 0 行 | - |
| 代码改动（spike 失败 R-1 L1） | ≤ 30 行 in `src/store/exportFormats.ts` | M |
| 代码改动（spike 失败 R-1 L2） | ≤ 60 行 in `src/store/exportFormats.ts` + `package.json` 加 docx | M |

#### Commit msg lock

```
chore(release): gap-e export AC pass + dogfood log baseline

- D1 docx spike result: <PASS / FAIL → R-1 L1 / R-1 L2>
- AC-1..AC-8 manual verification:
  AC-1 ✅/❌ 6 formats happy-path
  AC-2 ✅/❌ partial degradation
  AC-3 ✅/❌ disabled state
  AC-4 ✅/❌ Home behavior change + .flil.json byte-for-byte
  AC-5 ✅/❌ offline (DevTools Network → Offline)
  AC-6 ✅/❌ performance P95 thresholds
  AC-7 ✅/❌ IDB count before == after
  AC-8 ✅/❌ vite build modules ≤ 1925 / tsc 0 error / 0 new deps

- New: docs/dogfood-log.md (PRD §8.3 anchor for future export entries)

Refs: PRD AC-1..AC-8 / CA §5.2 PR-5 / CA §4.1 D1 spike
```

#### Exit gate

- ✅ AC-1..AC-8 全部 ✅（dogfood-log.md 中每条记录 evidence）
- ✅ D1 spike 决定：spike 通过 → 锁 §3.3 HTML 容器路线 / spike 失败 → 触发 §3 D1 spike gate L1/L2/L3
- ✅ `git diff --shortstat main...HEAD` 累计 ≤ 800 行（NFR-7）
- ✅ `git diff --name-status main...HEAD` 与 §1.3 期望白名单完全匹配（含 dogfood-log.md）

---

### 2.6 PR 之间的硬约束（5 PR 全局）

| 约束 | 验证 | 违反处理 |
|---|---|---|
| 顺序：PR-1 → 2 → 3 → 4 → 5 | git log 顺序 | 不许并行；任一跳过 → 回滚 |
| 每 PR 独立可 build | 每 PR 落盘 commit 后 `npx vite build` 通过 | 失败 → 回退该 PR |
| 每 PR commit msg = lock 模板 | grep 各 PR commit msg | 偏离 → amend |
| 累计文件清单 = §1.3 白名单 | `git diff --name-status main...HEAD` | extra 文件 → reject |
| 累计代码量 ≤ 800 行 | `git diff --shortstat main...HEAD` | 超 → 回退最近 PR |
| 不引入 npm 依赖（除 R-1 L2）| `git diff package.json` | 偏离 → reject |

---

## §3 D1 · docx spike gate（CA §4.1 落地）

> 本节是 D1 docx 路线决策的"实操 SOP"。spike 不是可选的——是 PR-2 落盘后的**强制 gate**。
> spike 通过 → 锁 HTML 容器路线 / 失败 → 触发降级阶梯。

### 3.1 spike 时机

```
[CK finalize]    [baseline]    [PR-1]    [PR-2]    [SPIKE GATE]    [PR-3]    [PR-4]    [PR-5]
                                            └────────►◄────────┘
                                              spike 发生在此处
```

- ✅ **触发条件**：PR-2 commit 落盘（`buildNovelDocx` 实现可用）
- ✅ **结束条件**：spike 通过判定 4 项全 ✅ → 锁路线 / 任一不通过 → 走降级
- ✅ **不许跳过**：PR-3 不许在 spike 完成前开始（PR-3 依赖 buildNovelDocx 可用 · 需 spike 锁定路线）
- ⏱ **预计耗时**：通过 30 分钟 / 失败 + L1 重试 1-2 小时 / 失败 + L2 半天

### 3.2 spike 5 步流程

```
[Step 1] 准备最简 fixture
  在浏览器 DevTools console 调 buildNovelDocx：
  ─────────────────────────────────────────────
  const { buildNovelDocx } = await import('/src/store/exportFormats.ts');
  const fix = {
    ctx: { name: 'Spike 测试' },
    novel: {
      chapterContents: { 1: '这是测试段落 1。\n\n这是测试段落 2。' },
      chapterTitles: { 1: '测试章节' },
      completedChapters: [1],
      totalChapters: 1,
      sourceNodeId: 'novel.7',
    },
  };
  const { filename, blob } = buildNovelDocx(fix);
  // 触发下载
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  ─────────────────────────────────────────────

[Step 2] 双击 .docx 文件 · 用 Word 桌面版打开
  - Word 2016 / 2019 / 365 任一
  - macOS Word 16 也可（macOS Pages 不算）

[Step 3] 观察是否弹出格式对话框
  - SmartScreen 安全提示（"此文件源自其他位置"）→ 接受 · 不算失败
  - 格式恢复对话框（"Word 在 'xxx.docx' 中发现无法识别的内容"）→ 失败 · 触发降级

[Step 4] 检查 4 项通过判定（详 §3.3）

[Step 5] 写 spike 报告到 docs/dogfood-log.md（详 §3.5）
```

### 3.3 spike 通过判定（4 项必全 ✅）

| # | 判定项 | 检查方法 | 通过标准 |
|---|---|---|---|
| **S-1** | 不弹格式对话框 | Word 双击打开 | 直接进入文档视图，无对话框 |
| **S-2** | 标题层级正确 | Word 视图 → 大纲 | "Spike 测试" = 标题 1 / "第 1 章 · 测试章节" = 标题 2 |
| **S-3** | 中文不乱码 | 直接看正文 | "这是测试段落 1。这是测试段落 2。" 显示为中文 |
| **S-4** | 章节分页生效 | 多章 fixture 测一次（用 ≥ 2 章 fixture 重跑 step 1） | 第 2 章在新页 |

**4 项全 ✅** → spike 通过。**任一 ❌** → 进 §3.4 降级。

### 3.4 失败降级决策树（CA §4.1.3 SOP 化）

```
spike 失败
   ▼
┌──────────────────────────────────────────────────────┐
│ 哪一项失败？                                          │
└──────────────────────────────────────────────────────┘
   ▼
   ├── S-1 弹格式对话框？
   │     ▼
   │     [L1 尝试 · 1 小时]
   │     在 buildNovelDocx 的 HTML 模板中加：
   │     - <html xmlns:o="urn:schemas-microsoft-com:office:office">
   │     - <html xmlns:w="urn:schemas-microsoft-com:office:word">
   │     - <meta http-equiv="Content-Type" content="application/vnd.ms-word">
   │     重跑 Step 1-3
   │     └── 通过 → 锁定 + 修改提交（PR-5 内 ≤ 30 行 diff）
   │     └── 仍失败 → L2
   │
   ├── S-2 标题层级未识别？
   │     ▼
   │     [L1 尝试 · 30 分钟]
   │     检查 <h1> / <h2> 标签是否被剥离；
   │     可能 Word 把 inline style 的 font-size 当文档元素而非标题。
   │     给 <h1> / <h2> 加 mso-style-name 属性：
   │     - <h1 style="mso-style-name:'Title';">
   │     - <h2 style="mso-style-name:'Heading 1';">
   │     └── 通过 → 锁定
   │     └── 仍失败 → L2
   │
   ├── S-3 中文乱码？
   │     ▼
   │     [L1 必通]
   │     验证 <meta charset="UTF-8"> 在 HTML 第一个 meta；
   │     验证字体栈包含 'Microsoft YaHei' / 'PingFang SC'；
   │     若仍乱 → Windows 缺中文字体（极不可能）→ 跳 L3
   │
   └── S-4 章节不分页？
         ▼
         [L1 尝试]
         CSS `page-break-before: always` 是 W3C 标准，Word 应识别。
         若不识别，加 mso-specific：
         <h2 style="mso-page-break-before:always; page-break-before:always;">
         └── 通过 → 锁定
         └── 仍失败 → 接受不分页（功能可用即可）

[L2 触发条件]
   - L1 任一项 1 小时内未通过 → L2
   - dogfood log 写明哪项触发

[L2 实施 · 0.5 ~ 1 天]
   1. npm install docx (~150KB gzip)
   2. 替换 buildNovelDocx 为 CA §4.1.3 lazy import 模板
   3. 函数签名变 async（OK · useExportActions 已用 Promise）
   4. npx vite build 验证 vendor chunk 增量 ≤ 200KB gzip
   5. 重跑 Step 1-3 验证 S-1..S-4 全 ✅

[L3 触发条件]
   - L2 vendor chunk > 200KB gzip
   - 或 L2 仍弹对话框 / 标题不识别（极罕见）

[L3 实施]
   - 抽屉中 .docx 项变 disabled + tooltip「v3.1 提供」
   - PRD §10 范围调整 + v3.1 PRD 重启
   - dogfood log 记录"G2 推迟"决策依据
   - PR-5 commit msg 写明 G2 推迟
```

### 3.5 spike 报告模板（写入 `docs/dogfood-log.md`）

```markdown
## D1 docx spike report · YYYY-MM-DD HH:MM

### Result
- [ ] PASS · HTML container locked
- [ ] FAIL → L1 success
- [ ] FAIL → L2 success (docx npm)
- [ ] FAIL → L3 (G2 deferred to v3.1)

### Test environment
- OS: Windows 11 / macOS xx / ...
- Word: 2019 / 365 / Mac 16 / ...
- Spike fixture: 1 chapter / 2 chapter / ...

### Judgments
- S-1 (no format dialog): ✅/❌ <evidence>
- S-2 (heading hierarchy): ✅/❌ <Word outline screenshot or text>
- S-3 (Chinese encoding): ✅/❌
- S-4 (page break): ✅/❌

### Time spent
- L1 retries: <count> · <minutes>
- Resolution path: HTML / L1 patch / L2 docx / L3

### If PASS
- Locked path: §3.3 buildNovelDocx byte-for-byte HTML container
- PR-5 code change: 0 lines

### If FAIL → L1
- Patches applied: <list of HTML changes>
- PR-5 code change: ≤ 30 lines in src/store/exportFormats.ts

### If FAIL → L2
- npm install docx version: <version>
- Vendor chunk delta: <KB gzip>
- PR-5 code change: ~60 lines + package.json
```

---

## §4 Daily Self-Check（IMPL 期间每日 5+5 项）

> AI 协作者 / 你自己每个工作日开工前 5 项 + 收工前 5 项快速 self-check。
> 任一不通过 → 停 + 回报。

### 4.1 开工前（5 项 · ≤ 5 分钟）

```powershell
# 1. 确认上一 PR 已 merge / 当前 branch 正确
git status
git log --oneline -5
# 期望：on branch feat/gap-e-export · last commit = 上一 PR commit msg

# 2. working tree clean
git status --short
# 期望：空输出

# 3. 当前 build 通过
npx vite build 2>&1 | Select-String -Pattern '^error|✓ built' | Select-Object -First 3
# 期望：✓ built · 无 error

# 4. tsc 通过
npx tsc --noEmit -p . 2>&1 | Measure-Object | Select-Object -ExpandProperty Count
# 期望：0 行（即 0 error · pre-existing @types/node 警告除外）

# 5. 文档锚点未漂移（每周一次即可）
Select-String -Path 'docs/planning/architecture-gap-e-export.md' -Pattern '@C:\\' |
  ForEach-Object { $_.Line.Substring($_.Line.IndexOf('@')) -replace ':\d+(-\d+)?', '' } |
  Select-Object -Unique |
  Where-Object { -not (Test-Path -Path ($_ -replace '@', '')) }
# 期望：空（所有 @ 锚点指向的文件存在）
```

### 4.2 收工前（5 项 · ≤ 5 分钟）

```powershell
# 1. build 仍通过
npx vite build 2>&1 | Select-String -Pattern '^error' | Measure-Object | Select-Object -ExpandProperty Count
# 期望：0

# 2. tsc 仍通过
npx tsc --noEmit -p . 2>&1 | Select-String -Pattern 'error TS' | Measure-Object | Select-Object -ExpandProperty Count
# 期望：0

# 3. 红线 grep（依据当前 PR）
# 例如 PR-2 收工：
Select-String -Path 'src/components/ExportDrawer.tsx', 'src/store/exportFormats.ts', 'src/pipeline/screenplayParser.ts' -Pattern '\.bulkPut\(|\.add\(|\.update\(|\.delete\(' -List
# 期望：空

# 4. commit msg 字面 vs lock 模板比对
git log -1 --pretty=%B
# 期望：与 §2.X commit msg lock 完全一致

# 5. push
git push origin feat/gap-e-export
# 期望：成功 · 远端 commit hash 与本地一致
```

### 4.3 异常处理 playbook（5 个常见问题）

| 异常 | 立即处理 | 不许做 |
|---|---|---|
| `npx vite build` 失败 | 1) 看 error 行号 / 2) 回退最近一个 commit `git reset --soft HEAD~1` / 3) 修复 / 4) 重 commit | 不许 force push / 不许跳过 build 直接 push |
| `npx tsc` 0 error 退化 | 1) `npx tsc --noEmit -p . 2>&1 \| more` 看具体 error / 2) 修复（不允许加 `as any` 绕过 · 加 `// @ts-expect-error` 也不行） | 不许加 `// eslint-disable` 隐藏 / 不许 ignore tsconfig |
| 红线 grep 命中 | 1) 看命中位置 / 2) 评估是否真的违反 / 3) 若违反 → 回退该改动 / 4) 若误报 → CK 文档加 grep 排除规则（次日做） | 不许"妥协一次" |
| commit msg 偏离 lock | `git commit --amend -m "<lock 模板>"` （未 push 时）| 不许 push 后再 amend（rewrite history） |
| 误改 db.ts / projectExport.ts 现有逻辑 | 1) `git diff -- src/store/db.ts src/store/projectExport.ts` 确认 / 2) `git checkout HEAD -- <file>` 回退 / 3) 重新只改允许的部分 | 不许 commit 含此类改动 |

### 4.4 周末 review（每 PR merge 后 1 次 · ≤ 15 分钟）

```powershell
# 1. 累计 diff 全景
git diff --stat main...feat/gap-e-export

# 2. 文件白名单 audit
git diff --name-status main...feat/gap-e-export | Sort-Object
# 比对 §1.3 期望白名单

# 3. 累计代码量 audit
git diff --shortstat main...feat/gap-e-export
# 期望：≤ 800 行 insertions(+)

# 4. invariant 全过 grep
# I-1: dexie write API 不在新文件
# I-2: react/zustand 不在 exportFormats / screenplayParser
# I-3: URL.createObjectURL 不在新文件

# 5. 今日 dogfood log（每 PR merge 后追加 1 行）
# 写入 docs/dogfood-log.md，记录该 PR 的：完成时间 / 实测耗时 / 遇到的坑
```

---

## §5 引用对齐自检（finalize 收口）

> 与 PRD §11 / CA §6 同款节奏，CK 形态更紧凑。

### 5.1 编号体系

| 体系 | 总数 | 范围 |
|---|---|---|
| **§** 章节 | 7（§0–§6） |
| **C**（启动条件） | 4 | C-1–C-4 |
| **R*.\*** 红线验证项 | 11 | R1.1/1.2 + R2.1-3 + R3.1/2 + R4.1/2 + R5.1-3 |
| **S** spike 判定 | 4 | S-1–S-4 |
| **PR** | 5 | PR-1–PR-5 |
| **不许做** | 9 | §1.2 表 |
| **invariant**（继承 CA） | 6 | I-1–I-6 |
| **AC**（继承 PRD） | 8 | AC-1–AC-8（PR-5 commit msg 含全部）|

**自检**：编号无跳号；C-1..C-4 → §0.3 / R*.\* → §1.1 / S-1..S-4 → §3.3 / PR-1..5 → §2 / I-1..I-6 grep → §1.4 / 9 不许做 → §1.2。

### 5.2 上游对齐（CK ↔ PRD/CA）

| 上游 | CK 落地 |
|---|---|
| PRD §0.5 红线 #1–#5 | §1.1 R1.\*..R5.\* (11 验证项) + §1.2 9 不许做 |
| PRD §5 NFR baseline | §1.5 (modules/build/vendor/lines/IDB) |
| PRD §7 AC-1..AC-8 | §2.5 PR-5 commit msg 强制写 8 行 evidence |
| CA §1.1 文件白名单 | §1.3 git diff --name-status 期望 |
| CA §2.7 6 invariant | §1.4 grep 命令表 |
| CA §4.1 D1 spike | §3 完整 SOP（5 步 + 4 判定 + L1/L2/L3 决策树）|
| CA §5.5 9 不许做 | §1.2 含每条 grep 验证 |

### 5.3 命令脚本可执行性

CK 全文 PowerShell 命令共 **18 处**（grep `\`\`\`powershell`）。所有命令满足：

- ✅ 不依赖任何外部工具（除 git / npx / Select-String / Test-Path 这些 Windows 自带或 Node 自带）
- ✅ 无 ADR / 无云调用 / 离线可跑
- ✅ 副作用仅限于产生输出 + 写入 `docs/dogfood-log.md`

### 5.4 BMAD workflow 衔接（CK 角度）

| 阶段 | workflow | 状态 |
|---|---|---|
| CB | bmad-create-brief | ✅ 已交付 |
| CP | bmad-create-prd | ✅ finalize (1151 行) |
| CA | bmad-create-architecture | ✅ finalize (1551 行) |
| **CK** | **bmad-create-checkpoint** | ✅ **本文 finalize** |
| **IMPL** | (无 workflow · 5 PR) | ⏳ **下一步** |
| VR | bmad-validate-release | IMPL 后 |

---

## §6 收尾承诺 · IMPL 启动入口

> 本 CK ~880 行已 finalize。把 PRD §0.5 + CA §5.5 + CA §1.1 + CA §2.7 + CA §4.1
> 全部转为 PowerShell 可执行清单。AI 协作者从此**不需要再读 PRD / CA 全文做决策**——
> 按本 CK 文档 §1–§4 逐条勾选即可完成 IMPL。

### 6.1 启动 IMPL 的第一组命令（拷贝即用）

```powershell
# ── Step A · 当前态确认（§0.3 C-1..C-4） ──────────────
git status                                                  # working tree clean
Select-String -Path 'docs/planning/*.md' -Pattern 'status:\s*final' |
  Select-Object Path, Line                                  # 期望 3+ 行
npx vite build 2>&1 | Tee-Object -FilePath logs/baseline-build.log

# ── Step B · 创建 feature branch ───────────────────────
git checkout -b feat/gap-e-export
git push -u origin feat/gap-e-export                        # 占位远端 branch

# ── Step C · 创建 dogfood-log baseline ────────────────
@"
# Dogfood Log · v3 gap-e export

## Baseline · $(Get-Date -Format 'yyyy-MM-dd HH:mm')
- vite build modules: <从 logs/baseline-build.log 拷>
- vite build time: <同上>
- IDB count snapshot:
  - artifacts: <浏览器 console 跑 db.artifacts.count() 后填>
  - liveArtifacts: <同上>
  - runHistory: <同上>
  - projects: <同上>
"@ | Out-File -FilePath docs/dogfood-log.md -Encoding utf8

git add docs/dogfood-log.md
git commit -m "chore(export): bootstrap dogfood log with baseline (gap-e)"
git push

# ── Step D · 进入 PR-1 ────────────────────────────────
# 现在按 §2.1 PR-1 的 pre-launch gate 逐条勾选 → 写代码 → exit gate → push
```

### 6.2 IMPL 期间的 3 份必读

| 顺序 | 文档 | 何时读 |
|---|---|---|
| 1 | **本 CK §2.X**（当前 PR 章节） | 每开新 PR 前 5 分钟 |
| 2 | **CA §3.\*** （当前 PR 涉及代码片段） | 写代码时按需查 |
| 3 | **本 CK §4** | 每日开工前 5 分钟 + 收工前 5 分钟 |

> PRD 全文不需要再读。CA §0–§2 不需要再读（已在 CK §1.\* 浓缩）。**只读 CK + 必要的 CA 代码片段**就够。

### 6.3 IMPL 完成后的 hand-off 给 VR

PR-5 merge 完毕后，给 VR (`bmad-validate-release`) workflow 的 hand-off 包：

```
inputs:
  - docs/planning/checkpoint-gap-e-export.md  ← 本 CK
  - docs/dogfood-log.md                       ← PR-5 阶段累积
  - git log --oneline main...feat/gap-e-export
  - git diff --stat main...feat/gap-e-export

VR 关键检查项：
  - AC-1..AC-8 dogfood-log 中证据完整
  - PR-1..5 commit msg 与 §2 lock 字面一致
  - §1.3 文件白名单 + 累计代码量 ≤ 800 行
  - §3 spike 报告完整
  - 红线 #1..#5 grep 全过
```

### 6.4 推荐下一步

**首选 · IMPL 立即启动**：

```powershell
# 直接拷上面 §6.1 Step A-D 命令到 PowerShell
# 然后按 §2.1 PR-1 pre-launch gate 开始写代码
```

**可选 · 先 git push 三份 planning 产物**（当前未 push）：

```powershell
git status                          # 确认 brief + PRD + CA + CK 已 commit
git push origin main                # 把 planning 文档同步到远端，作为 IMPL 之前的"快照"
```

**不推荐 · 起 VP workflow**：CK §5.2 已含上游对齐自检，VP 边际价值低。仅当你想多一道独立验证再考虑。

---

<!-- BMAD CK · 5 步全部完成 · status: final · 下一步 → IMPL (PR-1) -->
