---
description: PR 自查 / dogfood 流程 — vite build + tsc + 红线扫描 + bundle/累积 src 行数对比 + 输出表格。来源：gap-e epic PR-1..5 反复手工跑 5 遍同一仪式。
---

`/dogfood-check` 让 Cascade 走完 fili-web 项目的标准 PR self-check，最后产出 markdown 表格汇报。**Cascade 不修代码，只采集证据**。修代码请用户决策后另行 commit。

参考：`@C:\Users\QvQ\CascadeProjects\fili-web\docs\dogfood-log.md` 已有的 PR-1..5 表格格式。

---

## Step 1 · 获取基线（baseline）

回滚 commit 范围由用户提供，否则默认 `main`。读取以下 baseline：

- `vite build` modules: 来源 `AGENTS.md` 或 `dogfood-log.md` 最近一次记录（参考值 ~1926）
- `tsc --noEmit -p .` errors: baseline 1 (pre-existing TS2688)
- bundle gzip: 参考 `dogfood-log.md` 最近 PR
- 红线 4 条: 详见 Step 3

---

## Step 2 · 跑 build + tsc

// turbo
```powershell
npx vite build 2>&1 | Select-String -Pattern 'modules transformed|built in|gzip:' | ForEach-Object { $_.Line }
```

// turbo
```powershell
npx tsc --noEmit -p . 2>&1 | Select-Object -Last 5
```

记录：
- modules transformed（vs baseline）
- build time（秒）
- bundle size raw / gzip
- tsc 错误总数（vs baseline 1）

---

## Step 3 · 红线扫描（4 条）

// turbo
```powershell
Write-Host '--- 红线 #1: Dexie schema diff ---'; git diff main...HEAD -- src/store/db.ts | Select-String -Pattern '^[+-].*version\(|^[+-].*stores\(' | Select-Object -First 10
Write-Host '--- 红线 #2: FlilPackageV1 保留 hits ---'; (Get-ChildItem src -Recurse -File -Include '*.ts','*.tsx' | Select-String -Pattern 'FlilPackageV1' | Measure-Object).Count
Write-Host '--- 红线 #3: exportToAssets diff ---'; git diff main...HEAD -- 'src/store/exportToAssets*'
Write-Host '--- 红线 #4: arbitrary tailwind value 新增 ---'; git diff main...HEAD -- '*.tsx' '*.ts' | Select-String -Pattern '^\+.*\[(?:#|rgb|w-\d|h-\d|p-\d)' | Select-Object -First 5
```

判定：
- 红线 #1 期望 0 改动（除非用户显式说"动 schema"）
- 红线 #2 期望 ≥ 3 hits（不许全删）
- 红线 #3 期望 0 diff
- 红线 #4 期望 0 hits

---

## Step 4 · 累积 src 行数对比

// turbo
```powershell
Write-Host '=== src/ 净增行数 vs main ==='
git diff --stat main...HEAD -- src/ | Select-Object -Last 1
Write-Host '=== 各 PR 修改文件清单 ==='
git diff --name-status main...HEAD -- src/ | Select-Object -First 30
```

如果有 `docs/checkpoint-*.md` (CK 文件) 包含累积 cap 配额（如 NFR-7 ≤ 800 行），列出当前累积是否超 cap。

---

## Step 5 · bundle size delta

// turbo
```powershell
Write-Host '=== dist 上次 build 文件 ==='; Get-ChildItem dist/assets -Filter '*.js' -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1024,2)}} -First 3
```

vs `dogfood-log.md` 最近 PR 的 raw / gzip 数字对比。

---

## Step 6 · 输出 markdown 表格

按 `dogfood-log.md` 现有 PR 节的格式产出：

```markdown
## PR-X · <title>

### Headless verification (YYYY-MM-DD)

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| vite build modules | <N> | <baseline> | ✅/❌ |
| build time | <s>s | <cap>s | ✅/❌ |
| tsc 新增 error | <N> | 0 | ✅/❌ |
| bundle gzip | <KB> | n/a | info |
| 红线 #1 Dexie | <hits> | 0 | ✅/❌ |
| 红线 #2 FlilPackageV1 | <hits> | ≥3 | ✅/❌ |
| 红线 #3 exportToAssets | <diff> | 0 | ✅/❌ |
| 红线 #4 arbitrary | <hits> | 0 | ✅/❌ |
| 累积 src 行数 | <N> | <cap> | ✅/❌/⚠ |
```

---

## Step 7 · 决策提示

- 全 ✅ → 提示用户 "PR-X PASS, ready to commit dogfood-log entry"
- 任一 ❌ → 列出失败项 + 建议下一步（rebase / 撤改 / 加 erratum 记录）
- 🟡 / ⚠（cap 超出但有 erratum 解释）→ 提示用户在 commit msg 注明 erratum

**Cascade 不自动 commit dogfood-log**，等用户确认后再修 `docs/dogfood-log.md`。
