---
project: fili-web
epic: gap-b-character-bible
stage: BMAD Stage 2 · CK (Checkpoint · 机械验证套装)
author: QvQ + Cascade
date: 2026-05-06
status: draft
related:
  - prd-gap-b-character-bible.md
  - architecture-gap-b-character-bible.md
  - checkpoint-gap-d-progress-dashboard.md (CK 风格基线)
  - .windsurf/workflows/dogfood-check.md (PR 自查仪式)
---

# Checkpoint · v3 缺口 b · 角色 Bible 跨章节追踪

> **本 CK 的目的**：把 CA 的 4 红线 / 7 不变量 / 累积 ledger / 5 PR DoD 全部转成**可机械执行的 PowerShell grep + checklist**。每个 PR 合入前必须全绿，红色立即回退。

---

## §0 与 PRD / CA 的契约

| 来源 | 已锁定 | CK 提供 |
|---|---|---|
| PRD §3 FR-1..6 | 6 类功能 | DoD checklist (§6) |
| PRD §4 NFR-3 | 累积 cap 700 / 单文件 ≤ 250 | 每 PR ledger 校验 (§4) |
| PRD §4 NFR-4 | 4 红线领域 | 4 grep 命令 (§2) |
| CA §0.5 Q1-Q5 决议 | 5 个 | 在 PR 对应 DoD 内验证 |
| CA §2.5 不变量 I-1..I-7 | 7 个 | 7 grep 命令 (§3) |
| CA §5.2 PR-1..5 | 5 个 | 单 PR 详 DoD (§6.1-5) |

---

## §1 Stage 0 · Pre-flight 健康基线（每 PR 入口）

每个 PR 开工前先记录基线，PR 合入后对比看 delta：

```powershell
# 基线 1：build modules
$mods = (npx vite build 2>&1 | Select-String -Pattern '(\d+) modules transformed').Matches.Groups[1].Value
Write-Host "vite modules: $mods (cap +50)"

# 基线 2：build time
Measure-Command { npx vite build 2>&1 | Out-Null } | Select-Object TotalSeconds
# 期望：≤ 4.0s（gap-b 引入新文件较多，比 gap-d 3.5s 略宽）

# 基线 3：tsc 错误（pre-existing baseline = 1: TS2688 node types 缺失）
$err = (npx tsc --noEmit -p . 2>&1 | Select-String -Pattern 'error TS').Count
Write-Host "tsc errors: $err (baseline 1, cap +0)"

# 基线 4：bundle 体积
ls dist/assets/*.js | Sort-Object Length -Desc | Select-Object -First 1 Name, @{N='KB';E={[math]::Round($_.Length/1024,1)}}
# 期望：gzip ≤ 360 KB（gap-d 实测 353.59 KB，gap-b 加 ~10 KB 上限）
```

---

## §2 Stage 1 · 4 红线 grep（**任何一条 ≠ 期望 = PR 拒绝合入**）

### §2.1 红线 #1 · v1-v4 Dexie schema 不变（**最高严重度**）

```powershell
# 抽 src/store/db.ts 中 v1-v4 stores 字符串差异
$diff = git diff main...HEAD -- src/store/db.ts
$diff | Select-String -Pattern '^[+-]\s*this\.version\(([1-4])\)' 
# 期望：empty（不能动现有 version 调用）

$diff | Select-String -Pattern '^[+-]\s*(projects|liveArtifacts|liveRefinementUndo|userKbDocs|userKbFeedback|runHistory|artifacts):'
# 期望：empty（不能改任何已存在 stores 的索引定义）

$diff | Select-String -Pattern '^\+\s*this\.version\(5\)'
# 期望：恰好 1 hit（必须有 v5 add）
```

### §2.2 红线 #2 · N1.2 / N3.2 prompt 文件不变

```powershell
# N1.2 人物 Bible prompt
git diff main...HEAD -- 'public/prompts/novel/1.2*' 'public/prompts/novel/N1.2*'
# 期望：empty

# N3.2 章节润色 prompt
git diff main...HEAD -- 'public/prompts/novel/3.2*' 'public/prompts/novel/N3.2*'
# 期望：empty

# manifest.json 中 novel.2 / novel.7 step 配置不变
$mf = git diff main...HEAD -- public/methods/manifest.json
$mf | Select-String -Pattern '^[+-].*"id":\s*"novel\.(2|7)"'
# 期望：empty（仅可加 novel.8，不动 2/7）
```

### §2.3 红线 #3 · `consistencyCheck.ts` 不变（CA 复用基础）

```powershell
git diff main...HEAD -- src/pipeline/consistencyCheck.ts
# 期望：empty
```

### §2.4 红线 #4 · gap-d 资产不变

```powershell
git diff main...HEAD -- `
  src/store/projectAggregates.ts `
  src/store/dashboard.ts `
  src/components/ProgressDashboard.tsx `
  src/components/dashboard/
# 期望：empty（gap-d 0 回归）
```

---

## §3 Stage 2 · 7 不变量 grep

### §3.1 I-1 · `src/store/characterStates.ts` 不调 LLM

```powershell
Select-String -Path src/store/characterStates.ts -Pattern 'runStep|fetch\(|runStepBestOfN|callLLM' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//' }
# 期望：empty（dexie helper 纯 IO）
```

### §3.2 I-2 · `src/pipeline/characterStates.ts` 不直读 zustand

```powershell
Select-String -Path src/pipeline/characterStates.ts -Pattern 'useProject\(|useDashboard\(|useSettings\(|useCharacterBible\(' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//|^\s*import' }
# 期望：empty（pipeline 纯函数，接 ArtifactMap 参数）
```

### §3.3 I-3 · UI 子组件 props-only

```powershell
Select-String -Path 'src/components/character/*.tsx' -Pattern 'useProject|useDashboard|useSettings|useCharacterBible' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//' }
# 期望：empty（CharacterTimelineView / CharacterRelationGraph 纯 props）
```

### §3.4 I-4 · 仅 1 个新 localStorage key + gap-d key 不动

```powershell
# 新 key 恰好 1 hit
Select-String -Path src/store/characterBible.ts -Pattern 'flil:character-bible:state' | Where-Object { $_.Line -notmatch '^\s*//' }
# 期望：1 hit

# gap-d 的 key 不能在新文件中出现
Select-String -Path src/store/characterBible.ts,src/store/characterStates.ts,src/components/CharacterBible.tsx,'src/components/character/*.tsx' -Pattern 'flil:dashboard:state' -ErrorAction SilentlyContinue
# 期望：empty
```

### §3.5 I-5 · v5 schema 仅 add（与红线 #1 互证）

详见 §2.1 grep 结果同时满足。**额外**：

```powershell
# v5 stores 块必须包含 v4 全部 7 个表 + 新增 characterStates
$v5Block = (Get-Content src/store/db.ts -Raw) -split 'this\.version\(5\)' | Select-Object -Last 1
$expectedTables = @('projects','artifacts','liveArtifacts','runHistory','userKbDocs','userKbFeedback','liveRefinementUndo','characterStates')
foreach ($t in $expectedTables) {
  if ($v5Block -notmatch "$($t):") { Write-Error "v5 缺表: $t" }
}
# 期望：无 Write-Error 触发
```

### §3.6 I-6 · `runCharacterStateExtraction` 失败不破 N3.2

```powershell
# novelLoop.ts 中 novel.7 完成后调用必须包 try/catch
Select-String -Path src/pipeline/novelLoop.ts -Pattern 'runCharacterStateExtraction' -Context 3,3
# 人工验：上下文必须有 try { ... } catch { ... } 包裹（grep 后人眼审）
# 失败时不能 throw 给上游 N3.2 流程
```

人工核对要点：
- ✅ 调用前 `if (settings.enableCharacterStateExtraction)` 守卫
- ✅ 整段 try/catch
- ✅ catch 块内 `console.warn` + 写 runHistory，不重抛

### §3.7 I-7 · 0 新 npm 依赖

```powershell
git diff main...HEAD -- package.json package-lock.json
# 期望：empty（gap-b 0 新依赖）
```

---

## §4 Stage 3 · 累积 ledger（PR 合入后立即跑）

### §4.1 各 PR cap 与累积 cap

| PR | 估行 | PR cap | 累积估 | 累积 cap | 累积 ⌈cap × 1.20⌉ (erratum 接受线) | 累积 ⌈cap × 1.30⌉ (回退线) |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| PR-1 | 152 | 200 | 152 | 200 | 240 | 260 |
| PR-2 | 198 (excl. 80 prompt md) | 220 | 350 | 420 | 504 | 546 |
| PR-3 | 43 | 70 | 393 | 490 | 588 | 637 |
| PR-4 | 393 | 470 | 786 | 700 | **840** | **910** |
| PR-5 | 50 (excl. 80 dogfood-log md) | 100 | 836 | 700 | **840** | **910** |

⚠ **注意**：CA 已识别 PR-4 之后累积超 PRD cap 700。CK §8 erratum 协议覆盖此预知偏差。

### §4.2 累积 src 行数测量（每 PR 合入后跑）

```powershell
# 仅统计 gap-b 文件白名单的实际 src 行数（排除 prompt md + dogfood-log）
$gapBSrc = @(
  'src/store/db.ts',                                 # M (仅算 +12 净增)
  'src/store/characterStates.ts',                    # A
  'src/store/characterBible.ts',                     # A
  'src/pipeline/characterStates.ts',                 # A
  'src/components/CharacterBible.tsx',               # A
  'src/components/character/CharacterTimelineView.tsx',  # A
  'src/components/character/CharacterRelationGraph.tsx', # A
  'src/store/settings.ts',                           # M
  'src/pipeline/novelLoop.ts',                       # M
  'src/pages/Novel.tsx'                              # M
)
$total = 0
foreach ($f in $gapBSrc) {
  if (Test-Path $f) {
    $diffLines = (git diff main...HEAD -- $f | Select-String -Pattern '^\+[^+]').Count
    $total += $diffLines
    Write-Host ("{0,-55} +{1}" -f $f, $diffLines)
  }
}
Write-Host ("=== 累积 gap-b src 净增: $total / cap 700 ===")
```

### §4.3 单文件 ≤ 250 行硬上限

```powershell
foreach ($f in $gapBSrc) {
  if (Test-Path $f) {
    $lines = (Get-Content $f | Measure-Object -Line).Lines
    if ($lines -gt 250) { Write-Warning "$f 单文件 $lines 行 > 250 cap" }
  }
}
```

---

## §5 Stage 4 · 性能 / Build smoke

### §5.1 vite build 健康

```powershell
$build = npx vite build 2>&1
$mods = ($build | Select-String '(\d+) modules transformed').Matches.Groups[1].Value
$errs = ($build | Select-String '^\[error\]|^error during build').Count
Write-Host "modules=$mods errs=$errs"
# 期望：modules ≤ 1980（gap-d 后 1932 + gap-b 加 ~10 文件 ≈ 1942-1965 实际）
# 期望：errs = 0
```

### §5.2 tsc strict 0 新错误

```powershell
$tscErrs = (npx tsc --noEmit -p . 2>&1 | Select-String -Pattern 'error TS').Count
Write-Host "tsc errors: $tscErrs (baseline 1)"
# 期望：恰好 1（仅 pre-existing TS2688 node types）
```

### §5.3 bundle 体积

```powershell
$mainJs = ls dist/assets/*.js | Sort-Object Length -Desc | Select-Object -First 1
$gzipKB = [math]::Round($mainJs.Length / 1024, 1)
Write-Host "main bundle: $gzipKB KB"
# 期望：≤ 365 KB（gap-d 后 353.59 KB + gap-b 加 ~10 KB）
```

### §5.4 a11y aria-label 计数

```powershell
$aria = (Select-String -Path 'src/components/CharacterBible.tsx','src/components/character/*.tsx' -Pattern 'aria-label').Count
Write-Host "aria-label hits: $aria (cap ≥ 8)"
# 期望：≥ 8（CharacterBible toolbar + Timeline cells + RelationGraph nodes）
```

---

## §6 Stage 5 · 各 PR DoD checklist

### §6.1 PR-1 · Dexie v5 + characterStates store

- [ ] `src/store/db.ts` v5 stores 块包含 v1-v4 全 7 表 + characterStates（§3.5 I-5 grep 全绿）
- [ ] §2.1 红线 #1 grep empty
- [ ] `src/store/characterStates.ts` exports：types + 5 helpers (`upsertCharacterState / listChapterStates / listCharacterTimeline / markStateStale / clearProjectStates`)
- [ ] §3.1 I-1 grep empty（不调 LLM）
- [ ] **CA §4.5 Q5 决议 · 5 步 dev console smoke 全绿**：
  - [ ] **Step 1**：用 v4 现有项目打开 app（不清 IndexedDB）
  - [ ] **Step 2**：观察 console，无 dexie 升级 error
  - [ ] **Step 3**：`db.projects.toArray()` 与升级前条数 + 内容一致
  - [ ] **Step 4**：`db.characterStates.toArray()` → `[]`（空数组）
  - [ ] **Step 5**：手动 `await upsertCharacterState({...})` → `await listChapterStates(p, 1)` 读出一致
- [ ] tsc 0 新 error / vite build 通过
- [ ] PR-1 commit message 含 "gap-b PR-1" 标签

### §6.2 PR-2 · LLM step + extraction logic

- [ ] `public/prompts/novel/3.3-character-state-extract.md` 含 6 个变量插值点 + 严格 JSON schema
- [ ] `public/methods/manifest.json` 加 novel.8 step（仅追加，§2.2 红线 #2 grep empty）
- [ ] `src/pipeline/characterStates.ts` exports `runCharacterStateExtraction / rerunStaleStates`
- [ ] §3.2 I-2 grep empty（不直读 zustand）
- [ ] §2.3 红线 #3 grep empty（不动 consistencyCheck.ts）
- [ ] **dev console 验证**：
  - [ ] **正常 case**：mock chapter content + N1.2 → 调 runCharacterStateExtraction → JSON 解析成功 → dexie 写入 ≥ 1 条
  - [ ] **parseFailed case**：mock LLM 返回非法 JSON → 验证 stub entry 写入（snapshot=null + extractionError）
  - [ ] **no-Bible case**：删 N1.2 → 验证 warning + 纯文本提取继续
- [ ] §3.7 I-7 grep empty（0 新依赖）

### §6.3 PR-3 · settings + auto-trigger + N3.1 inject

- [ ] `src/store/settings.ts` 加 `enableCharacterStateExtraction: boolean`（默认 false · FR-2.6）
- [ ] `src/pipeline/novelLoop.ts` 在 N3.2 完成后包 try/catch 调 runCharacterStateExtraction
- [ ] §3.6 I-6 人工核对：try/catch + settings 守卫 + 不重抛
- [ ] N3.1 草稿循环 prompt vars 含 `prevChapterStateSummary`（截断 ≤ 1500 字）
- [ ] **dev console 验证**：
  - [ ] settings 开 → N3.2 完成 → console 看到 novel.8 自动跑 → dexie 写入
  - [ ] settings 关 → N3.2 完成 → 无 novel.8 调用
  - [ ] N3.1 第 2 章草稿生成时 prompt 含上一章状态摘要
- [ ] §2.4 红线 #4 grep empty（gap-d 资产 0 改）

### §6.4 PR-4 · CharacterBible UI

- [ ] `src/components/CharacterBible.tsx` 容器 ≤ 250 行
- [ ] `src/components/character/CharacterTimelineView.tsx` 渲染 5 维度 × N 章节 SVG 矩阵
- [ ] `src/components/character/CharacterRelationGraph.tsx` 渲染圆 + 连线（手撸 SVG · 0 图论库）
- [ ] `src/store/characterBible.ts` zustand persist key = `flil:character-bible:state`（§3.4 I-4 grep 1 hit）
- [ ] gap-d 的 `flil:dashboard:state` 不在任何 gap-b 新文件出现（§3.4）
- [ ] §3.3 I-3 grep empty（子组件 props-only）
- [ ] `src/pages/Novel.tsx` 在 ProgressDashboard 之后插入 `<CharacterBible projectId={projectId} />`（CA §4.1 Q1 决议）
- [ ] §5.4 a11y aria-label ≥ 8 hits
- [ ] **浏览器手测**：
  - [ ] 选角色 dropdown → timeline 渲染
  - [ ] click 时间线格子 → 跳到该章节预览
  - [ ] toggle 到 RelationGraph → 圆 + 连线显示
  - [ ] 失败章节红色 + tooltip 显示 extractionError

### §6.5 PR-5 · stale + 重跑 + dogfood-log

- [ ] `src/pipeline/characterStates.ts` 加 `markStateStale` 调用点（用户改 N 章触发器）
- [ ] CharacterBible UI 显示 stale 黄色徽章
- [ ] "批量重跑 stale" 按钮 → `rerunStaleStates` 正确批处理
- [ ] **浏览器手测**：
  - [ ] 修第 5 章 → 第 5..end 黄徽
  - [ ] 点批量重跑 → 完成后 stale 全部 false
- [ ] `docs/dogfood-log.md` 追加 gap-b 段（**不覆盖 gap-d 段**）：epic 总览表 + PR-1..5 验证表 + 累积 ledger 实测 vs 估算 vs cap + erratum 决议（如适用）+ open follow-ups
- [ ] §4.2 累积 src 测量：实测 ≤ 840（cap × 1.20 erratum 接受线）

---

## §7 Stage 6 · Rollback 策略

### §7.1 单 PR rollback（PR-2 / PR-3 / PR-4 / PR-5 简单）

```powershell
git revert <PR-N-merge-commit>
```

### §7.2 PR-1 schema 回退（**最高风险 · 特殊处理**）

⚠ **Dexie 升级后无法软回退**：用户已升级到 v5 的 IndexedDB 不能 downgrade。

策略：
1. 如 PR-1 合入后发现 schema 设计错（如索引选错），**新发 PR-1.1**：用 v6 修正（add only）
2. PR-1 自身不 revert，而是 v6 forward fix
3. 或者：PR-1 合入前在 dev 多人多浏览器 dogfood 至少 24h

PR-1 合入 = 单向门，**6.1 § 5 步 smoke 全绿是入场券**。

### §7.3 epic 整体回退

如 gap-b 整个 epic 决定放弃：

```powershell
# 软回退：禁用 settings 默认值（保留代码与表，用户不可见）
# 改 src/store/settings.ts: enableCharacterStateExtraction: false 强制 + UI 隐藏开关
# Dexie 表保留（无害空表）

# 硬回退：revert 全部 5 PR
git revert <PR-5..PR-1 merge commits>
# v5 schema 字符串保留（dexie 不报错），但 characterStates 永远不写入
```

---

## §8 Erratum 协议（**累积超 cap 时使用**）

### §8.1 触发条件

| 累积 src 实测 | cap 700 | 决议 |
|:---:|:---:|:---:|
| ≤ 700 | 100% | ✅ 通过 |
| 701-839 | +20% 内 | ⚠ **接受偏差**·dogfood-log 记录详细原因 |
| 840-909 | +20% ~ +30% | 🟡 PR 暂停·人工评审 trade-off：(a) 砍 PR-5 SHOULD 项 (b) 接受 (c) 折中 |
| ≥ 910 | +30% | 🔴 强制回退·删除最后 1-2 PR 的 add 项·重新规划 |

### §8.2 erratum 文档要求

CA §1.1 已预知 PR-4 之后累积估算 786 → +12.3%（落在 §8.1 第 2 段"接受偏差"内）。

dogfood-log 必须记录：
1. 实测累积 vs CA 估算 vs PRD cap 三列
2. 偏差百分比
3. 偏差归因（哪些 PR 超 cap、超多少、为什么）
4. 决议（接受 / 砍项 / 回退）+ 决策时点

### §8.3 vs gap-d 对比

```
gap-d 实测：508 / cap 350 = +45%（远超 +30% 红线 → 实际触发了 erratum 但仍接受）
gap-b 估算：786 / cap 700 = +12% （在 +20% 接受线内 · 预期顺利通过）
```

---

## §9 一键验证脚本（PR 入口跑）

```powershell
# === gap-b CK 全套验证 ===
Write-Host '=== §2 红线 ==='
git diff main...HEAD -- src/store/db.ts | Select-String '^[+-]\s*this\.version\(([1-4])\)|^[+-]\s*(projects|liveArtifacts|liveRefinementUndo|userKbDocs|userKbFeedback|runHistory|artifacts):' | ForEach-Object { Write-Warning "红线 #1: $_" }
git diff main...HEAD -- 'public/prompts/novel/1.2*' 'public/prompts/novel/N1.2*' 'public/prompts/novel/3.2*' 'public/prompts/novel/N3.2*' | Where-Object { $_ } | ForEach-Object { Write-Warning "红线 #2: prompt 改" }
git diff main...HEAD -- src/pipeline/consistencyCheck.ts | Where-Object { $_ } | ForEach-Object { Write-Warning "红线 #3: consistencyCheck 改" }
git diff main...HEAD -- src/store/projectAggregates.ts src/store/dashboard.ts src/components/ProgressDashboard.tsx src/components/dashboard/ | Where-Object { $_ } | ForEach-Object { Write-Warning "红线 #4: gap-d 资产改" }

Write-Host '=== §3 不变量 ==='
$inv1 = (Select-String -Path src/store/characterStates.ts -Pattern 'runStep|fetch\(|callLLM' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//' }).Count
$inv2 = (Select-String -Path src/pipeline/characterStates.ts -Pattern 'useProject\(|useDashboard\(|useSettings\(|useCharacterBible\(' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//|^\s*import' }).Count
$inv3 = (Select-String -Path 'src/components/character/*.tsx' -Pattern 'useProject|useDashboard|useSettings|useCharacterBible' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//' }).Count
$inv4 = (Select-String -Path src/store/characterBible.ts -Pattern 'flil:character-bible:state' -ErrorAction SilentlyContinue | Where-Object { $_.Line -notmatch '^\s*//' }).Count
$inv7 = (git diff main...HEAD -- package.json package-lock.json | Measure-Object -Line).Lines
Write-Host "I-1=$inv1 (=0) I-2=$inv2 (=0) I-3=$inv3 (=0) I-4=$inv4 (=1) I-7=$inv7 (=0)"

Write-Host '=== §4 累积 src ==='
$gapBSrc = @('src/store/db.ts','src/store/characterStates.ts','src/store/characterBible.ts','src/pipeline/characterStates.ts','src/components/CharacterBible.tsx','src/components/character/CharacterTimelineView.tsx','src/components/character/CharacterRelationGraph.tsx','src/store/settings.ts','src/pipeline/novelLoop.ts','src/pages/Novel.tsx')
$total = 0; foreach ($f in $gapBSrc) { if (Test-Path $f) { $total += (git diff main...HEAD -- $f | Select-String '^\+[^+]').Count } }
Write-Host "累积 src 净增: $total / cap 700 / 接受线 840 / 回退线 910"

Write-Host '=== §5 build smoke ==='
$buildOK = (npx vite build 2>&1 | Select-String 'built in').Count
$tscErr = (npx tsc --noEmit -p . 2>&1 | Select-String 'error TS').Count
Write-Host "vite ok=$buildOK / tsc errs=$tscErr (baseline 1)"
```

---

## §10 PR 合入流程

```
┌─ feature/gap-b-pr-N branch
│   ├─ 实施 + commit (符合 CA §5.4 commit 命名)
│   ├─ 跑 §1 pre-flight 记基线
│   ├─ 跑 §2 红线 grep（必全 empty）
│   ├─ 跑 §3 不变量 grep（必全期望值）
│   ├─ 跑 §4 累积 ledger（≤ 接受线 840）
│   ├─ 跑 §5 build smoke（modules / tsc / bundle / a11y）
│   ├─ 完成 §6.N PR-N 专属 DoD checklist
│   └─ 跑 §9 一键脚本最终汇报
├─ merge to main
└─ 用户在浏览器实测确认（见 §6.N 浏览器手测项）
    └─ 失败 → §7 rollback
    └─ 成功 → 下一 PR
```

---

> **CK 版本**：v0.1 (2026-05-06) · 基线 4 红线 / 7 不变量 / 5 PR DoD / erratum 协议 / rollback 策略全锁。
> **vs gap-d CK 关键差异**：(1) PR-1 schema 升级单向门 + 5 步 smoke；(2) 红线领域从 0 涨到 4；(3) erratum 协议预设（gap-d 是事后才补）；(4) rollback 含 schema 不可降级提示。
