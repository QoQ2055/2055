---
project: fili-web
epic: gap-a-multi-volume
stage: BMAD Stage 2 · CK (Checkpoint · Mechanical Verification)
prerequisite: architecture-gap-a-multi-volume.md
date: 2026-05-07
status: **locked · 实施暂停**（PRD §1.3 触发条件未达，CK 已写但 Stage 4 不启动）
---

# CK · gap-a · 多卷架构 · 机械验证套装

> 全部 grep / 文件命令 PowerShell 形式可直接 paste。每条**输入预期 + 实测命令**完整。
> CK 是**机械化校验**，不允许人工裁量。任何 PR 偏离一项 → stop + 决策（修正 / 文档化 erratum / 回退）。
> **本 CK 写时未启动实施**：所有 grep 命令为"未来实施 session 直接 paste"用。当前 baseline 即 main `1817659`。

---

## §1 总览

| 指标 | 实测/估算 | 来源 |
|---|:---:|---|
| Red lines | 5 | CA §2 |
| Invariants | 7 | CA §3 |
| PR 数 | 5 | CA §4 |
| 单文件 cap | 250 行（god file Novel.tsx 例外）| NFR-3 |
| 累积 src cap | **600** | NFR-3 |
| 累积 src 估算 | **~510** | CA §6 |
| 安全边距 | **+90**（vs cap 600）| 计算 |
| Q4 erratum | **预批准** add-only into ProgressDashboard.tsx | CA §1 Q4 / §2.3 R3 |

---

## §2 红线 · grep 命令（每 PR 必跑）

### §2.1 R1 · v1-v5 schema 0 字符变化

```powershell
# v6 add 行允许；v1-v5 块（L136-184）字符串 0 字符变化
git diff HEAD -- src/store/db.ts | Select-String -Pattern '^[+\-]\s*this\.version\(' | ForEach-Object { $_.Line }
```

**期**：仅含 `+    this.version(6).stores({` 一行 add（v1-v5 行 0 出现）

**追加验证**：v5 stores 字符串字面量保留：

```powershell
Select-String -Path src/store/db.ts -Pattern "this\.version\(5\)\.stores" | Measure-Object -Line
```

**期**：≥ 1 hit（v5 块仍存在）

---

### §2.2 R2 · prompt JSON 0 改动

```powershell
git diff HEAD -- public/prompts/novel/*.json public/prompts/storyboard/*.json public/prompts/screenplay/*.json | Measure-Object -Line
```

**期**：Lines = 0

---

### §2.3 R3 · gap-d / gap-b / gap-c 资产 0 diff（含 Q4 erratum）

#### A. 严格 0 diff 文件

```powershell
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
```

**期**：Lines = 0

#### B. ProgressDashboard.tsx · Q4 erratum 允许 add-only

```powershell
# 仅 + 行（add-only · 0 删除）
git diff HEAD -- src/components/ProgressDashboard.tsx | Select-String -Pattern '^-(?!--)' | Measure-Object -Line
```

**期**：Lines = 0（无 - 行 = add-only · 现有 3 view 渲染 0 字符变化）

#### C. dashboard/ 现有 3 个 view 文件 0 diff

```powershell
git diff HEAD -- `
  src/components/dashboard/ChapterCompletionGrid.tsx `
  src/components/dashboard/WordCountTrend.tsx `
  src/components/dashboard/ScoreHeatmap.tsx `
  | Measure-Object -Line
```

**期**：Lines = 0

#### D. rollingContext.ts · 仅 add 跨卷分支

```powershell
# Q5 决议允许 formatPrevChapterTail 内加 isCrossVolume 分支
git diff HEAD -- src/pipeline/rollingContext.ts | Select-String -Pattern '^-(?!--)' | Measure-Object -Line
```

**期**：Lines ≤ 2（允许格式化变更，但函数主体 0 删除；> 2 = 重新评估）

---

### §2.4 R4 · consistencyCheck.ts 不动

```powershell
git diff HEAD -- src/pipeline/consistencyCheck.ts | Measure-Object -Line
```

**期**：Lines = 0

---

### §2.5 R5 · novelLoop.ts 现有函数 0 字符变化

```powershell
# parseVolumePlan / VolumeMeta / runVolumeLoop / parseChapterOutlines 等现有 export
# 仅允许 add（如 PR-2 add 后处理 hook · 但函数体不动）
git diff HEAD -- src/pipeline/novelLoop.ts | Select-String -Pattern '^-(?!--)' | Measure-Object -Line
```

**期**：Lines = 0（add-only · 严格 grep）

---

## §3 不变量 · 验证命令（7 条）

### I-1 · volumes 表 add-only

```powershell
# v5 stores 字符串完整保留
$v5 = (Select-String -Path src/store/db.ts -Pattern 'this\.version\(5\)\.stores').Count
$v6 = (Select-String -Path src/store/db.ts -Pattern 'this\.version\(6\)\.stores').Count
Write-Host ("v5 hits: $v5 (期 1) / v6 hits: $v6 (期 1)")
```

**期**：v5 = 1, v6 = 1

---

### I-2 · upsertVolumes 不调 LLM

```powershell
# upsertVolumes / listVolumes / clearVolumes 函数体内 0 chatStream 调用
$helpers = @('upsertVolumes', 'listVolumes', 'clearVolumes')
foreach ($fn in $helpers) {
  $c = Select-String -Path src/store/db.ts -Pattern "function $fn|export async function $fn" -Context 0,30 -ErrorAction SilentlyContinue
  if ($c) {
    $body = $c.Context.PostContext -join "`n"
    $hits = ([regex]::Matches($body, 'chatStream\(')).Count
    Write-Host "  $fn body chatStream hits: $hits (期 0)"
  }
}
```

**期**：每个函数 0 hits

---

### I-3 · scoreCard 评分维度 0 修改（gap-c 红线传承）

```powershell
git diff HEAD -- src/pipeline/scoreCard.ts | Measure-Object -Line
```

**期**：Lines = 0

---

### I-4 · rollingContext 增强 add-only（formatPrevChapterTail 加 isCrossVolume 分支）

```powershell
# 新增 volumes? 可选参 + isCrossVolume 内部判断
Select-String -Path src/pipeline/rollingContext.ts -Pattern 'volumes\?:|isCrossVolume|VolumeRecord' | ForEach-Object { '  L' + $_.LineNumber + ': ' + $_.Line.Trim() }
```

**期**（PR-4 后）：≥ 3 hits（接口 add + 内部判断 + 类型 import）

**追加**：现有 prevTailParagraphs 接口字段保留：

```powershell
Select-String -Path src/pipeline/rollingContext.ts -Pattern 'prevTailParagraphs' | Measure-Object -Line
```

**期**：≥ 2 hits（接口 + 默认值取用）

---

### I-5 · ChapterList 加 volumes prop = 可选 · fallback 平铺保留

**dev console 验证（PR-3 后）**：

打开 dev project 但**未跑 N2.1**（无 volumes 数据）→ Novel 页章节列表应显示**平铺**（非分组）。

**或 grep 验证**：

```powershell
Select-String -Path src/pages/Novel.tsx -Pattern 'volumes && volumes\.length > 0|volumes\?:' | Select-Object -First 4 | ForEach-Object { '  L' + $_.LineNumber }
```

**期**：≥ 1 hit（条件分支保留 fallback）

---

### I-6 · VolumeChipRow 是纯 props 视图

```powershell
# 0 zustand 读取（与 gap-d ChapterCompletionGrid 同模式）
Select-String -Path src/components/dashboard/VolumeChipRow.tsx -Pattern 'useProject|useDashboard|useSettings|useCharacterBible' -ErrorAction SilentlyContinue | Measure-Object -Line
```

**期**：Lines = 0

---

### I-7 · 0 新 npm 依赖

```powershell
git diff HEAD -- package.json package-lock.json | Measure-Object -Line
```

**期**：Lines = 0

---

## §4 PR DoD checklist

### §4.1 PR-1 · Dexie v6 + volumes 表 + helpers + dev smoke

| # | DoD | 验证 |
|:---:|---|---|
| 1 | db.ts add v6 stores 块（v1-v5 0 字符变化）| §2.1 R1 grep + I-1 |
| 2 | `VolumeRecord` interface export | grep `export interface VolumeRecord` = 1 |
| 3 | 三个 helpers export（`upsertVolumes` / `listVolumes` / `clearVolumes`）| grep `export async function (upsertVolumes\|listVolumes\|clearVolumes)` = 3 |
| 4 | dev console 5 步 smoke 通过 | 见 §4.1.1 详细 |
| 5 | vite 0 errors | `npx vite build` exit 0 |
| 6 | tsc baseline only | `npx tsc --noEmit` baseline = 1 (TS2688 node) |
| 7 | I-2 helpers 0 LLM 调用 | grep |
| 8 | I-7 0 deps | grep |

est: +180 src

#### §4.1.1 · v5→v6 migration 5 步 dev console smoke

```js
// 浏览器 dev console（PR-1 部署后）
(async () => {
  const log = (s, ok, msg) => console.log(`%c${ok ? '✅' : '❌'} ${s}`, `color:${ok ? '#10b981' : '#ef4444'}`, msg ?? '');

  const dbModule = await import('/src/store/db.ts');
  const db = dbModule.db;

  // Step 1: db version = 6
  log('1 db.verno=6', db.verno === 6, db.verno);

  // Step 2: volumes 表存在
  log('2 volumes table', !!db.volumes, db.volumes?.name);

  // Step 3: 写测试数据
  await dbModule.upsertVolumes(0, [
    { index: 1, name: '测试卷一', chapterStart: 1, chapterEnd: 10 },
    { index: 2, name: '测试卷二', chapterStart: 11, chapterEnd: 25 },
  ]);
  const all = await dbModule.listVolumes(0);
  log('3 upsert+list', all.length === 2, all);

  // Step 4: 复合主键约束（同 projectId+index 重复 = upsert 替换）
  await dbModule.upsertVolumes(0, [
    { index: 1, name: '测试卷一·改名', chapterStart: 1, chapterEnd: 12 },
  ]);
  const renamed = (await dbModule.listVolumes(0)).find(v => v.index === 1);
  log('4 upsert idempotent', renamed?.name === '测试卷一·改名' && renamed?.chapterEnd === 12, renamed);

  // Step 5: clearVolumes 清表
  await dbModule.clearVolumes(0);
  const empty = await dbModule.listVolumes(0);
  log('5 clearVolumes', empty.length === 0, empty.length);

  console.log('%c━━━ PR-1 v6 smoke 完成 ━━━', 'background:#10b981;color:white;padding:4px 8px');
})();
```

---

### §4.2 PR-2 · N2.1 完成自动 upsertVolumes + clean wipe + toast

| # | DoD | 验证 |
|:---:|---|---|
| 1 | runStep 完成 hook 触发 upsertVolumes | grep `upsertVolumes\(` 在 runner / novelLoop 调用 |
| 2 | 重跑 N2.1 → toast 警告显示 | 浏览器实测 |
| 3 | parseVolumePlan 失败 → console.warn + 不阻塞 | 错误路径单测 |
| 4 | 第一次跑 N2.1 → 自动写表 | dev console 验证 listVolumes |
| 5 | R1 / R2 / R5 grep 全 0 | §2 |

est: +100 src

---

### §4.3 PR-3 · ChapterList volumes 分组

| # | DoD | 验证 |
|:---:|---|---|
| 1 | ChapterList Props add `volumes?: VolumeRecord[]` | grep |
| 2 | volumes 缺失时 → 平铺 fallback | I-5 dev 验证 |
| 3 | volumes 提供时 → 按卷分组渲染 | 浏览器实测 |
| 4 | 卷标题行显示完成度 + 字数 + 评分 | 浏览器实测 |
| 5 | 现有 filter / 批准 / bulk 操作 0 回归 | 手测 |

est: +120 src

---

### §4.4 PR-4 · VolumeChipRow + ProgressDashboard + 跨卷过渡

| # | DoD | 验证 |
|:---:|---|---|
| 1 | dashboard/VolumeChipRow.tsx 新文件 (~70 行) | 文件存在 |
| 2 | ProgressDashboard body 顶部 add wrapper div | §2.3 R3-B add-only grep |
| 3 | 跨卷判断 in formatPrevChapterTail | I-4 grep |
| 4 | volumes 缺失时 chip 行隐藏 + 跨卷标识不出 | 浏览器实测 |
| 5 | 点击 chip 滚到该卷（SHOULD）| 手测 |
| 6 | I-3 scoreCard 0 修改 | grep |

est: +110 src

---

### §4.5 PR-5 · dogfood-log + erratum

| # | DoD | 验证 |
|:---:|---|---|
| 1 | dogfood-log.md 顶部追加 gap-a 节 | 文件比对 |
| 2 | PR-by-PR 表 + 累积 ledger | markdown |
| 3 | 5 Q 决议落实点表 | markdown |
| 4 | 估算精度复盘（vs gap-b/c/d）| markdown |
| 5 | erratum 决议（若超线）| 仅适用时 |
| 6 | 0 src 改动 | `git diff HEAD -- src/ | Measure-Object -Line` = 0 |

est: +80 docs · 0 src

---

## §5 Build & Test commands

### §5.1 vite

```powershell
$b = npx vite build 2>&1
$errs = ($b | Select-String '^error during build').Count
$mods = ($b | Select-String '(\d+) modules transformed').Matches.Groups[1].Value
Write-Host "vite errs=$errs / modules=$mods"
```

**期**：errs = 0 · modules = gap-c 后 1938 + gap-a 估 +5..10（VolumeChipRow.tsx + 内部组件）≈ 1943-1948

### §5.2 tsc

```powershell
$tsc = (npx tsc --noEmit -p . 2>&1 | Select-String -Pattern 'error TS').Count
Write-Host "tsc errors: $tsc (baseline 1)"
```

**期**：baseline = 1 (TS2688 node) · 不引入新 TS error

### §5.3 vitest（如有）

无新单元测试 · 沿用 v3 手测优先策略。

---

## §6 累积 ledger 公式 + 触发线

每 PR 完成后跑：

```powershell
$pr1 = (git show <sha-pr1> --stat --pretty=format: src/store/db.ts | Select-String '\d+ insertions').Matches.Groups[1].Value
# ... 类似汇总 PR-1..4
$cum = $pr1 + $pr2 + $pr3 + $pr4
Write-Host "PR-1..4 src ins: $cum / cap 600"
```

**Erratum 触发线**：

| 累计 src | 决策 |
|:---:|---|
| ≤ 600 | pass · 直接 dogfood-log 记录 |
| 601-720 | accept + dogfood-log §erratum 注 |
| 721-779 | PAUSE PR · 评估 cut FR-4 SHOULD 项（VolumeChipRow 滚动跳转 / 跨卷过渡 LOW 项）|
| ≥ 780 | rollback PR-4 SHOULD · 仅保 PR-1+2+3 MUST 并 erratum 文档化 |

**对照**：
- gap-d 实测 508 / 350 = +45.1% 接受
- gap-b 实测 916 / 700 = +30.9% 接受
- gap-c 实测 159 / 350 = **−54.6% 极宽裕**
- gap-a 估 510 / 600 = **−15% 安全**

---

## §7 实施 session 启动 checklist（条件触发后）

- [ ] PRD §1.3 触发条件 C-1..C-4 满足（≥ 3 项）
- [ ] PRD-gap-a 已 commit（`23154f9` ✅）
- [ ] CA-gap-a 已 commit（`1817659` ✅）
- [ ] CK-gap-a commit（本文件）
- [ ] gap-b / gap-c epic 完整 push（已确认）
- [ ] vite build 在 main 分支 0 errors（PR-1 起步前再跑一次）
- [ ] tsc baseline = 1
- [ ] 用户确认数据备份（schema v5→v6 单向门 · 强烈建议导出 artifacts JSON）

---

## §8 erratum protocol（gap-a 专用）

### §8.1 Q4 erratum · 预批准（CA §1 Q4）

允许 add-only into ProgressDashboard.tsx + dashboard/ 新增 VolumeChipRow.tsx，但：
- 现有 3 view 文件 0 字符变化（§2.3 R3-C）
- ProgressDashboard.tsx 0 删除行（§2.3 R3-B）

**实施时如发现需改现有 view → 必须停 PR 重新评估**。

### §8.2 累积 src 超 720 erratum

**触发条件**：累积 src > 720（接受线）。

**决议格式**（写入 dogfood-log gap-a 节）：

```markdown
### Erratum 决议 · 累积 src N 超 720 接受线

**触发**：CK §6 协议规定 721-779 = PAUSE PR · 评估 cut SHOULD 项。
**决议**：[接受 / cut SHOULD-X / 回退 PR-Y]
**理由**：[1-3 句 · 含与 gap-b/c/d 先例对比]
```

### §8.3 v5→v6 migration 失败 erratum

**触发条件**：PR-1 dev smoke 5 步任一失败。

**强制行动**：**立即停 PR-1**，根据失败步骤诊断：
- Step 1 失败（version != 6）→ schema 写法错误 / 重启 dev server 不重读
- Step 2 失败（volumes 表不存在）→ stores 字符串 typo
- Step 3 失败（upsertVolumes 写错）→ helper 实现 bug
- Step 4 失败（idempotent 失败）→ 复合主键 `[projectId+index]` 配置错误
- Step 5 失败（clearVolumes 失败）→ Dexie API 误用

修复后**必须重跑 5 步全部**（不能只跑失败的那步）。

---

## §9 状态 · CK 已写但**实施暂停**

| 阶段 | 状态 |
|---|:---:|
| Stage 1 Analysis | ✅ |
| Stage 2.1 PRD | ✅ `23154f9` |
| Stage 2.2 CA | ✅ `1817659` |
| **Stage 2.3 CK** | **本文件 · 待 commit** |
| Stage 4 PR-1..5 | ⏸ 触发条件未达 · 暂停 |

**重启实施**触发：用户 dogfood 中遇到 ≥ 25 章 + 跨卷需求 → §7 checklist 启动 → Stage 4 PR-1..5

CK 已机械化所有验证 · **未来实施 session 5 分钟内可启动 PR-1**。

---

## §10 总览 · v3 BMAD planning 全 epic 完结

| Epic | PRD | CA | CK | 实施 | dogfood |
|---|:---:|:---:|:---:|:---:|:---:|
| gap-e (导出) | ✅ | ✅ | ✅ | ✅ | ✅ |
| gap-d (Progress Dashboard) | ✅ | ✅ | ✅ | ✅ | ✅ |
| gap-b (Character Bible) | ✅ | ✅ | ✅ | ✅ | ✅ |
| gap-c (Chapter Transition) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **gap-a (Multi-Volume)** | ✅ | ✅ | **✅ 本文件** | ⏸ 触发 | ⏸ 触发 |

**v3 全 5 epic BMAD planning 完结** · 实施部分 4/5 done + 1 触发待启动。
