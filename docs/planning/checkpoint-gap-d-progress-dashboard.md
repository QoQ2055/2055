---
project: fili-web
epic: gap-d-progress-dashboard
stage: BMAD Stage 2 · CK (Checkpoint · 机械验证清单)
author: QvQ + Cascade
date: 2026-05-06
status: draft
related:
  - prd-gap-d-progress-dashboard.md (FR / NFR 来源)
  - architecture-gap-d-progress-dashboard.md (设计依据)
---

# Checkpoint · v3 缺口 d · Progress Dashboard

> **CK 不重复 CA**。本文档全部是**可机械执行**的 grep 命令、行数 ledger、退出条件清单。配合 `/dogfood-check` workflow 跑。

---

## §0 Mission · CK 在做什么

| 角色 | 职责 |
|---|---|
| **PRD** | 用户视角的需求 |
| **CA** | 设计师视角的实施方案 |
| **CK（本文）** | **裁判视角**的合格判定 — 每个 PR 跑哪些命令、看哪些数 |

**铁律**：本 CK 通过 = PR 可合并。本 CK 任意 ❌ 项 = PR 不可合并（除非 erratum 显式声明）。

---

## §1 文件白名单（**严格执行**）

### 1.1 允许触碰的 7 个文件

| # | 路径 | 操作 | 行数 cap | PR |
|:---:|---|:---:|:---:|:---:|
| 1 | `src/store/projectAggregates.ts` | A | ≤ 200 | PR-1 |
| 2 | `src/components/dashboard/ChapterCompletionGrid.tsx` | A | ≤ 200 | PR-2 |
| 3 | `src/components/dashboard/WordCountTrend.tsx` | A | ≤ 200 | PR-2 |
| 4 | `src/components/dashboard/ScoreHeatmap.tsx` | A | ≤ 200 | PR-2 |
| 5 | `src/components/ProgressDashboard.tsx` | A | ≤ 200 | PR-3 |
| 6 | `src/store/dashboard.ts` | A | ≤ 100 | PR-3 |
| 7 | `src/pages/Novel.tsx` | M | +10 / -0 (硬限) | PR-3 |

外加：
- `docs/dogfood-log.md` (M / docs only / PR-4 唯一)

### 1.2 白名单验证 grep

```powershell
# 列出 PR 改动的所有 src/* 文件
git diff --name-only main...HEAD -- 'src/' 'docs/' | Sort-Object

# 期望：仅出现上述 8 个文件路径，多一个 = 红线触碰
```

---

## §2 红线 grep（**4 条 · 任一命中 = PR 拒绝**）

### 红线 #1 · Dexie schema 未改

```powershell
git diff main...HEAD -- src/store/db.ts | Select-String -Pattern '^[+-].*(?:version\(|stores\()'
# 期望：empty
```

### 红线 #2 · `scoreCard.ts` 业务逻辑未改

```powershell
git diff main...HEAD -- src/pipeline/scoreCard.ts
# 期望：empty
```

### 红线 #3 · pipeline 整体未改

```powershell
git diff main...HEAD -- 'src/pipeline/' | Select-String -Pattern '^[+-]' | Select-String -NotMatch '\.test\.'
# 期望：empty
```

### 红线 #4 · 仅 Novel 页接入

```powershell
git diff main...HEAD --name-only -- 'src/pages/' | Where-Object { $_ -ne 'src/pages/Novel.tsx' }
# 期望：empty
```

### 红线汇总（一键）

```powershell
# /dogfood-check 已封装，下面是手动版
$r1 = (git diff main...HEAD -- src/store/db.ts | Select-String -Pattern '^[+-].*(?:version\(|stores\()' | Measure-Object).Count
$r2 = (git diff main...HEAD -- src/pipeline/scoreCard.ts | Measure-Object -Line).Lines
$r3 = (git diff main...HEAD -- 'src/pipeline/' | Select-String -Pattern '^[+-]' | Select-String -NotMatch '\.test\.' | Measure-Object).Count
$r4 = (git diff main...HEAD --name-only -- 'src/pages/' | Where-Object { $_ -ne 'src/pages/Novel.tsx' } | Measure-Object).Count
Write-Host "红线 #1: $r1 / #2: $r2 / #3: $r3 / #4: $r4 (全 0 = PASS)"
```

---

## §3 不变量 grep（**CA §2.5 的 5 条 · 编译时验证**）

### I-1 · `projectAggregates.ts` 100% read-only

```powershell
Select-String -Path src/store/projectAggregates.ts -Pattern 'db\.\w+\.(?:put|add|update|delete|clear|bulkPut|bulkAdd)'
# 期望：empty (零写操作)
```

### I-2 · 0 新依赖

```powershell
git diff main...HEAD -- package.json package-lock.json | Select-String -Pattern '^\+\s*"[^"]+":\s*"[\^~]?\d'
# 期望：empty (无新增 dependency)
```

### I-3 · dashboard 不调 LLM

```powershell
$dashboardFiles = @('src/store/dashboard.ts','src/store/projectAggregates.ts','src/components/ProgressDashboard.tsx','src/components/dashboard/*.tsx')
Select-String -Path $dashboardFiles -Pattern 'runStep|runStepBestOfN|fetch\([''"]https' -ErrorAction SilentlyContinue
# 期望：empty
```

### I-4 · 仅 1 个 localStorage key

```powershell
Select-String -Path src/store/dashboard.ts -Pattern 'localStorage\.(?:setItem|getItem|removeItem)'
# 期望：恰好 ≤ 4 hits（1 set + 1 get + persist middleware 内部，主入口 1 个 key）
# 同时确认 key 为 'flil:dashboard:state'
Select-String -Path src/store/dashboard.ts -Pattern 'flil:dashboard:state'
# 期望：恰好 1 hit
```

### I-5 · 子组件 props-only（不直接读 zustand）

```powershell
Select-String -Path 'src/components/dashboard/*.tsx' -Pattern 'useDashboard|useProject|useSettings'
# 期望：empty (3 子组件全部纯 props，子组件不依赖 zustand)
```

### 不变量一键验证

```powershell
$inv1 = (Select-String -Path src/store/projectAggregates.ts -Pattern 'db\.\w+\.(?:put|add|update|delete|clear|bulkPut|bulkAdd)' -ErrorAction SilentlyContinue | Measure-Object).Count
$inv2 = (git diff main...HEAD -- package.json package-lock.json | Select-String -Pattern '^\+\s*"[^"]+":\s*"[\^~]?\d' | Measure-Object).Count
# inv3-5 类似拼接
Write-Host "I-1: $inv1 / I-2: $inv2 / I-3: $inv3 / I-4: $inv4 (key='flil:dashboard:state') / I-5: $inv5"
```

---

## §4 累积行数 ledger（**NFR-3 cap 350 · CA 估 476 · 实测见 PR-N 表格**）

### 4.1 各 PR 配额

| PR | 文件 | CA 估 | Cap | 实测（IMPL 时填）|
|:---:|---|:---:|:---:|:---:|
| PR-1 | projectAggregates.ts | 110 | 150 | _填_ |
| PR-2 | dashboard/CompletionGrid.tsx | 70 | 100 | _填_ |
| PR-2 | dashboard/WordCountTrend.tsx | 80 | 110 | _填_ |
| PR-2 | dashboard/ScoreHeatmap.tsx | 90 | 130 | _填_ |
| PR-3 | ProgressDashboard.tsx | 80 | 100 | _填_ |
| PR-3 | dashboard.ts | 40 | 70 | _填_ |
| PR-3 | Novel.tsx (+) | 6 | 10 | _填_ |
| **累积** | | **476** | **PRD 350 / CA-recognized 480** | _填_ |

### 4.2 cap 超出处理协议

```
情况 A：PR 单文件超 §4.1 cap
  → 必须：commit msg 加 erratum 节，说明超 cap 原因（如：完整 SVG path 算法不可拆 / a11y handler 必加）
  → 拒绝可接受："写得啰嗦"、"拷贝了示例"、"加了打印调试"

情况 B：累积 src 增量超 PRD NFR-3 cap (350)
  → 必须：在该 PR commit msg 加 erratum 节
  → CA 已预警 estimate 476（25% 偏差），属可接受范围
  → 实测若 ≥ 550 (CA + 15%) → 暂停 PR-3 / PR-4，回头精简

情况 C：实测 ≤ CA 估算
  → 不处理 · CK §4.1 实测列填实数 + 在 dogfood-log 标 ✅
```

### 4.3 实测命令

```powershell
# 全 PR 累积
$total = 0
@('src/store/projectAggregates.ts','src/components/dashboard/ChapterCompletionGrid.tsx','src/components/dashboard/WordCountTrend.tsx','src/components/dashboard/ScoreHeatmap.tsx','src/components/ProgressDashboard.tsx','src/store/dashboard.ts') | ForEach-Object {
  if (Test-Path $_) {
    $l = (Get-Content $_ | Measure-Object -Line).Lines
    Write-Host ("{0,-60} {1,4}" -f $_, $l)
    $total += $l
  }
}
$novelDelta = (git diff --shortstat main...HEAD -- src/pages/Novel.tsx) -replace '.*?(\d+) insertion.*?(\d+) deletion.*','$1-$2'
Write-Host "Novel.tsx 增量: $novelDelta (cap +10)"
Write-Host "累积 src 行数: $total / cap 350 (CA 估 476)"
```

---

## §5 build / tsc / a11y 验证

### 5.1 build

```powershell
npx vite build 2>&1 | Select-String -Pattern 'modules transformed|built in|gzip:'
# 期望：modules ≤ baseline (最近 dogfood-log 记录) + 30 / time ≤ 3.5s / 0 error
```

### 5.2 tsc

```powershell
npx tsc --noEmit -p . 2>&1 | Select-String -Pattern 'error' | Measure-Object
# 期望：count ≤ 1 (即 baseline 的 pre-existing TS2688)
# 任何新错误 = PR 拒绝
```

### 5.3 a11y（dashboard 是交互组件）

| 元素 | 必有 attr |
|---|---|
| ChapterCompletionGrid 单元格 | `aria-label="第 N 章 · 已完成 · X 字"` + role="button" |
| WordCountTrend SVG circles | `aria-label` for outliers |
| ScoreHeatmap 单元格 | `aria-label="第 N 章 · 维度 D · 评分 X"` |

```powershell
# 检查每个交互元素至少 1 个 aria-label / role
Select-String -Path 'src/components/dashboard/*.tsx' -Pattern 'aria-label' | Measure-Object
# 期望：≥ 6 hits (3 子组件各至少 2 个交互层)
```

---

## §6 PR 退出条件 checklist

每 PR 合入前**逐条勾选**：

### PR-1 · projectAggregates.ts

- [ ] 文件白名单：仅触碰 `src/store/projectAggregates.ts` + tests
- [ ] 行数 ≤ 150 (cap)
- [ ] 红线 #1-#4 全 0
- [ ] 不变量 I-1（read-only）✅
- [ ] 不变量 I-2（0 新 deps）✅
- [ ] tsc 0 新 error
- [ ] vitest unit test 3 case (空 / 完整 / 部分) PASS
- [ ] 性能：单次 `getProjectAggregates(50ch)` ≤ 100ms（手测 console.time）
- [ ] commit msg 含 `(gap-d FR-data)` tag

### PR-2 · 3 view components

- [ ] 文件白名单：仅 `src/components/dashboard/*.tsx`
- [ ] 单文件 ≤ 表 §4.1 cap（CompletionGrid 100 / Trend 110 / Heatmap 130）
- [ ] 累积本 PR ≤ 340
- [ ] 红线 #1-#4 全 0
- [ ] 不变量 I-3（无 LLM）✅
- [ ] 不变量 I-5（不直读 zustand）✅
- [ ] a11y：3 文件累积 aria-label ≥ 6
- [ ] tsc 0 新 error
- [ ] vite build modules 增量 ≤ 15 (3 view 组件)
- [ ] 3 个 commit（每组件 1 个）

### PR-3 · 容器 + store + Novel 接入

- [ ] 文件白名单：`ProgressDashboard.tsx` / `dashboard.ts` / `Novel.tsx (+10)`
- [ ] 各文件行数 ≤ §4.1 cap
- [ ] Novel.tsx 净增 ≤ 10 行
- [ ] 红线 #1-#4 全 0
- [ ] 不变量 I-4（恰好 1 localStorage key 'flil:dashboard:state'）✅
- [ ] 浏览器手测 5 项（dashboard 出现 / 折叠展开 / click 跳章 / heatmap click 弹窗 / 状态持久）全 PASS
- [ ] 性能：DevTools Performance 首次渲染 ≤ 200ms
- [ ] tsc 0 新 error
- [ ] vite build 总 modules 累积 ≤ baseline + 30
- [ ] 2 个 commit (容器 + Novel wire)

### PR-4 · dogfood-log + erratum

- [ ] 仅触碰 `docs/dogfood-log.md`
- [ ] 表格汇报全部填实测数据
- [ ] 累积 src 实测 / cap / Δ 三列齐全
- [ ] 5 不变量 ✅ 状态
- [ ] 4 红线 ✅ 状态
- [ ] erratum 节（如累积超 cap 25%+ 必填）
- [ ] dogfood 用户故事验证：QvQ 真用 dashboard 完成 PRD US-1/US-2/US-3 三件事

---

## §7 回退策略

### 7.1 单 PR 回退

```powershell
# 任一 PR 进入合入后发现严重问题
git revert <commit-sha>
# 或拆分 partial revert：保留 view 组件，撤回 Novel.tsx wire
git revert -n <wire-commit-sha>
git checkout HEAD -- src/components/dashboard/  # 保留组件
git commit -m "revert(novel): partial revert gap-d dashboard wire (KEEP components)"
```

### 7.2 整 epic 回退

```powershell
# v3.x.x 发版后发现 dashboard 引发回归
# 推送回退：保留 .windsurf/skills/image-prompt-craft（独立 skill 不动）+ 保留 PRD/CA/CK docs
git revert <PR-1-sha>..<PR-4-sha> --strategy-option=ours
# 注：PRD/CA/CK docs 不回退（用于未来再开 epic）
```

### 7.3 dexie 数据回退

**不需要**。CK §3 I-1 保证 dashboard 全 read-only，无 dexie 数据污染。

---

## §8 erratum 模板（commit msg 格式）

若任意 cap / 红线 / 不变量超出且必须接受：

```
<type>(<scope>): <subject>

[正文]

ERRATA:
- 项: 累积 src cap 350 → 实测 412 (Δ +62 / +18%)
- 原因: SVG outlier circle 渲染算法 + 自适应行高完整实现 不可再拆
- 影响范围: 仅本 epic / 不传染其他模块
- 后续: gap-d 完成后跑 simplify 工作流尝试压缩
```

erratum 必须有：项 / 原因 / 范围 / 后续。否则 reject。

---

## §9 后续 BMAD 阶段

- **Stage 3 (Solutioning)**：可选 · CA + CK 已足够指导，gap-d 不做单独 SOL
- **Stage 4 (Implementation)**：4 PR 按 CA §5.4 commit 节奏执行
- **每 PR 后**跑 `/dogfood-check`（已建好）→ 自动验证 §2 红线 + §5 build/tsc

---

> **版本**：v0.1 (2026-05-06) · 与 PRD/CA 同步 · 4 PR 退出条件全锁定。**实施时严格按 §6 checklist 勾选**。
