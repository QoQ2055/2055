---
project: fili-web
epic: gap-c-chapter-transition
stage: BMAD Stage 2 · CK (Checkpoint · Mechanical Verification)
prerequisite: architecture-gap-c-chapter-transition.md
date: 2026-05-07
status: locked · 实施只可补强不可弱化
---

# CK · gap-c · 章节衔接 · 机械验证套装

> 全部 grep / 文件命令 PowerShell 形式可直接 paste。每条**输入预期 + 实测命令** 完整。
> CK 是**机械化校验**，不允许人工裁量。任何 PR 偏离一项 → 必须 stop + 决策（修正 / 文档化 erratum / 回退）。

---

## §1 总览

| 指标 | 实测/估算 | 来源 |
|---|:---:|---|
| Red lines | 5 | CA §2 |
| Invariants | 7 | CA §3 |
| PR 数 | 4 | CA §4 |
| 单文件 cap | 250 行 | NFR-3 |
| 累积 src cap | **350** | NFR-3 |
| 累积 src 估算 | **~240** | CA §6 |
| 安全边距 | **+110**（vs gap-b 完工 -209）| 计算 |

---

## §2 红线 · grep 命令（每 PR 必跑）

### §2.1 R1 · 不动 N1.x / N2.x / N3.x prompt JSON

```powershell
git diff HEAD -- public/prompts/novel/*.json | Measure-Object -Line
```

**期**：Lines = 0

---

### §2.2 R2 · rollingContext.ts 核心算法不变

允许：
- 接口 `RollingContextOptions` add 一字段 `prevTailParagraphs?: number`
- 同文件末尾新增 `formatPrevChapterTail` 内部函数
- L177 与 L181 之间 push 一个 block

禁止：
- buildRollingContext 主流程（L91-181）的远距 / 近距 / cache 逻辑改动
- condenseFiveSegment / 任何现有 export 函数体改动
- 现有接口字段删除或重命名

**机械检查**：

```powershell
# 现有 export 列表 snapshot
Select-String -Path src/pipeline/rollingContext.ts -Pattern '^export (function|interface|type|const)' | ForEach-Object { $_.Line.Trim() }
```

**期**：与 PR 前 snapshot 比对 · `RollingContextOptions` 等接口名 0 删除 · `buildRollingContext` / `condenseFiveSegment` 等函数名 0 删除。

---

### §2.3 R3 · ScoreCard 现有 6 维实现 0 字符变化

```powershell
# 6 维字面量必须保留
Select-String -Path src/pipeline/scoreCard.ts -Pattern "'genre'|'method'|'kbRedline'|'craft'|'r1Align'|'userKbStyle'" | Measure-Object -Line
```

**期**：Lines ≥ PR 前 snapshot 数（add-only · 不删除）

**额外**：6 维各计算函数（如 `computeGenreScore`, `computeR1AlignScore` 等）函数体 git diff 须为 0：

```powershell
git diff HEAD -- src/pipeline/scoreCard.ts | Select-String -Pattern '^-\s+(?!\/\*|\/\/|\*)' | Measure-Object -Line
```

**期**：Lines = 0（任何 `-` 行都是 add-only 违反；允许的只是 `-//` 注释删除，但 PR 不应删注释）

---

### §2.4 R4 · gap-d / gap-b / gap-e 资产 0 diff

```powershell
git diff HEAD -- `
  src/store/projectAggregates.ts `
  src/store/dashboard.ts `
  src/components/ProgressDashboard.tsx `
  src/components/dashboard/ `
  src/store/characterStates.ts `
  src/store/characterBible.ts `
  src/components/CharacterBible.tsx `
  src/components/character/ `
  public/prompts/novel/8.json `
  src/pipeline/characterStates.ts `
  | Measure-Object -Line
```

**期**：Lines = 0

---

### §2.5 R5 · consistencyCheck.ts 不动

```powershell
git diff HEAD -- src/pipeline/consistencyCheck.ts | Measure-Object -Line
```

**期**：Lines = 0

---

## §3 不变量 · 验证命令

### I-1 · rollingContext.ts 增强不引入新 LLM 调用

```powershell
# PR-1 后 rollingContext.ts 中 chatStream 调用次数
(Select-String -Path src/pipeline/rollingContext.ts -Pattern 'chatStream\(').Count
```

**期**：与 PR 前相同（PR-1 前已有 condenseFiveSegment 内的调用 · 不动）

---

### I-2 · 第 7 维评分函数纯函数

```powershell
# computeTransitionScore 不能 import zustand
Select-String -Path src/pipeline/scoreCard.ts -Pattern "from '\.\./store/" -ErrorAction SilentlyContinue | ForEach-Object { '  ' + $_.Line.Trim() }
```

**期**：仅含 `from '../store/settings'`（type-only · 同 r1Align 维度模式），**0 含 store 状态读取**（如 `useProject` / `useDashboard`）

---

### I-3 · 第 1 章 transition score = null

**dev console 验证（PR-2 后）**：

```js
// 浏览器 console
(async () => {
  const m = await import('/src/pipeline/scoreCard.ts');
  const r = await m.computeTransitionScore({
    chapterIndex: 1,
    currentOpening: '第一章开篇文字...',
    prevChapterTail: undefined,
    settings: window.__zustandSettings.getState(),
  });
  console.log('ch1 result:', r); // 期望 { score: null, reason: '...第一章...' }
})();
```

**期**：`{ score: null, reason: /第一章/ }`

---

### I-4 · 0 新 localStorage key

```powershell
# 新文件中是否引入新 'flil:' 前缀 key
Get-ChildItem src -Recurse -File -Include '*.ts','*.tsx' -Newer (Get-Date '2026-05-07') | ForEach-Object {
  Select-String -Path $_.FullName -Pattern "name: 'flil:" -ErrorAction SilentlyContinue
} | ForEach-Object { '  ' + $_.Filename + ':' + $_.LineNumber }
```

**期**：0 hits（gap-c 不引入新 zustand persist）

---

### I-5 · SCORE_DIMENSIONS 仅 add

```powershell
# 6 维字面量 6 个仍存在
$old = @("'genre'","'method'","'kbRedline'","'craft'","'r1Align'","'userKbStyle'")
$found = (Select-String -Path src/pipeline/scoreCard.ts -Pattern ($old -join '|')).Count
Write-Host ("6 \u7ef4\u5b57\u9762\u91cf hits: " + $found + " (\u671f \u2265 6, \u900f\u589e\u5141\u8bb8)")
```

**期**：≥ 6（PR-2 后会因 ScoreDimension type union 等地方多次出现）

---

### I-6 · scoreCardWeights 兼容性

```powershell
# 旧 weights 不带 transition 时计算流程不破
Select-String -Path src/pipeline/useScoreCardController.ts -Pattern 'scoreCardWeights \?\? \{\}' | ForEach-Object { '  L' + $_.LineNumber }
```

**期**：≥ 1 hit（保留默认 fallback 模式）

**dev console 进一步验证（PR-3 后）**：旧用户 settings.scoreCardWeights = `{ genre: 1.5 }`（不带 transition）→ 章节评分仍跑 6 维 + transition 权重默认 1.0。

---

### I-7 · 0 新依赖

```powershell
git diff HEAD -- package.json package-lock.json | Measure-Object -Line
```

**期**：Lines = 0

---

## §4 PR DoD checklist

### §4.1 PR-1 · rollingContext.ts add prevTailParagraphs

| # | DoD | 验证 |
|:---:|---|---|
| 1 | `RollingContextOptions` 加 `prevTailParagraphs?: number` 字段 | grep `prevTailParagraphs` ≥ 2 hits |
| 2 | 新增 `formatPrevChapterTail` 内部函数 | grep `function formatPrevChapterTail` = 1 |
| 3 | tail-block 注入 L177 之后 | dev console 跑 `buildRollingContext({ chapters: [3 章原文], currentIndex: 4 })` 输出含 `## 上一章` |
| 4 | ch1 不出 block | currentIndex=1 输出**不含** `## 上一章` |
| 5 | 800 字截断生效 | 上一章 1500 字 → block 内容 ≤ 800 字 |
| 6 | vite 0 errors | `npx vite build` exit 0 |
| 7 | tsc baseline only | `npx tsc --noEmit` baseline = 1 (TS2688 node) |
| 8 | R2 grep | 现有接口 0 删除 |

est: +70 src

### §4.2 PR-2 · scoreCard.ts +7th dim transition

| # | DoD | 验证 |
|:---:|---|---|
| 1 | `ScoreDimension` add 'transition' | grep `'transition'` ≥ 2 hits |
| 2 | `SCORE_DIMENSIONS` 数组含 7 项 | `(Select-String -Pattern "'(genre|method|kbRedline|craft|r1Align|userKbStyle|transition)'").Count` ≥ 7 |
| 3 | `computeTransitionScore` 函数 export | grep `export.*computeTransitionScore` = 1 |
| 4 | TRANSITION_PROMPT inline | grep `TRANSITION_PROMPT` ≥ 2 (定义 + 调用) |
| 5 | ch1 → null | I-3 dev smoke 通 |
| 6 | JSON 解析失败 → null + reason | error path 单测 dev console |
| 7 | UI 自动出现第 7 维 cell | 浏览器实测 章节评分 grid 7 列 |
| 8 | 6 维计算 0 回归 | R3 grep |

est: +120 src

### §4.3 PR-3 · settings + UI 元数据

| # | DoD | 验证 |
|:---:|---|---|
| 1 | `settings.enableTransitionScoring: boolean` 默认 true | grep `enableTransitionScoring` = 设置 + 守卫 ≥ 2 hits |
| 2 | `LABEL_OF.transition = '衔接顺畅度'` | ScoreCardBadge.tsx grep |
| 3 | `DESC_OF.transition` 含描述（≥ 10 字）| grep |
| 4 | 章节卡 < 70 显示橙色徽章 | 浏览器实测 |
| 5 | 关闭 setting → 第 7 维 cell 隐藏 | 浏览器实测 toggle |
| 6 | Settings ScoreCardWeightSliders 7 维 slider | 浏览器实测 |
| 7 | I-6 兼容性 grep |  |

est: +50 src

### §4.4 PR-4 · dogfood-log + erratum（如适用）

| # | DoD | 验证 |
|:---:|---|---|
| 1 | dogfood-log.md 顶部追加 gap-c 节（newest first 约定）| 文件比对 |
| 2 | PR-by-PR 表（4 行 + 累积）| markdown 表 |
| 3 | 5 Q 决议落实点表 | markdown 表 |
| 4 | 累积 ledger 实测 vs cap 350 | 数字 |
| 5 | erratum 决议（若超线）| 仅适用时 |
| 6 | 0 src 改动 | `git diff HEAD -- src/ | Measure-Object -Line` = 0 |

est: +80 docs

---

## §5 Build & Test commands

### §5.1 vite

```powershell
$b = npx vite build 2>&1
$errs = ($b | Select-String '^error during build').Count
$mods = ($b | Select-String '(\d+) modules transformed').Matches.Groups[1].Value
Write-Host "vite errs=$errs / modules=$mods"
```

**期**：errs = 0 · modules = gap-b 后 1938 + gap-c 估 < 5（仅小函数 import）≈ 1940-1943

### §5.2 tsc

```powershell
$tsc = (npx tsc --noEmit -p . 2>&1 | Select-String -Pattern 'error TS').Count
Write-Host "tsc errors: $tsc (baseline 1)"
```

**期**：baseline = 1 (TS2688 node) · 不引入新 TS error

---

## §6 累积 ledger 公式

每 PR 完成后跑：

```powershell
$pr1 = (git show 593xxxxx --stat --pretty=format: src/pipeline/rollingContext.ts | Select-String '\d+ insertions').Matches.Groups[1].Value
# ... 类似汇总 PR-1..3
$cum = $pr1 + $pr2 + $pr3
Write-Host "PR-1..3 src ins: $cum / cap 350"
```

**Erratum 触发线**：

| 累计 src | 决策 |
|:---:|---|
| ≤ 350 | pass · 直接 dogfood-log 记录 |
| 351-420 | accept + dogfood-log §erratum 注 |
| 421-454 | PAUSE PR · 评估 cut SHOULD 项（FR-2.5 weight slider / FR-4.1 setting toggle） |
| ≥ 455 | rollback PR-3 SHOULD · 仅保 PR-1+PR-2 MUST 并 erratum 文档化 |

**对照 gap-d** 实测 508 / 350 = +45.1% 接受 · gap-c 估 240 / 350 = -31.4% **极宽裕**。

---

## §7 实施 session 启动 checklist

- [ ] PRD-gap-c 已 commit（`33f0cbf` ✅）
- [ ] CA-gap-c 已 commit（`59a7ddc` ✅）
- [ ] CK-gap-c commit（本文件）
- [ ] gap-b 完整 epic + 完成 push（`c4097e3` ✅）
- [ ] vite build 在 main 分支 0 errors（PR-1 起步前再跑一次）
- [ ] tsc baseline = 1
- [ ] dev server 在跑 / 可热加载

---

## §8 erratum protocol（gap-c 专用）

**触发条件**：累积 src > 420（接受线）。

**决议格式**（写入 dogfood-log 当 PR 节）：

```markdown
### Erratum 决议 · 累积 src N 超 420 接受线

**触发**：CK §6 协议规定 421-454 = PAUSE PR · 评估 cut SHOULD 项。
**决议**：[接受 / cut SHOULD-X / 回退 PR-Y]
**理由**：[1-3 句 · 含与 gap-b/gap-d 先例对比]
```

**预测**：gap-c 不会触发（估 240 / cap 350 · 安全边距 110）。但若 PR-2 LLM prompt 体量超估 50%（即 +180 src 而非 +120），可能触线。

---

## §9 CK 完成 · 进 Stage 4

| 阶段 | 状态 |
|---|---|
| Stage 1 Analysis | ✅ 预审计完成 |
| Stage 2.1 PRD | ✅ `33f0cbf` |
| Stage 2.2 CA | ✅ `59a7ddc` |
| **Stage 2.3 CK** | **本文件 · 待 commit** |
| Stage 4 PR-1..4 | 🔜 实施 |

→ commit + 启动 PR-1。
