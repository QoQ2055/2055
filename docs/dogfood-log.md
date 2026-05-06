# Dogfood Log · v3 gap-e Export

> 由 PRD §8.3 + CK §6.1 Step C 触发创建。每个 PR merge 后追加一节。
> AC-1..AC-8 evidence 在 PR-5 阶段集中记录。

---

## Baseline · 2026-05-06 · 实测 vs 文档

> 本节是 IMPL 启动前的当前态快照（CK §6.1 Step A 输出）。
> 后续 PR-N 退化判定基于本节 baseline。

### Build baseline（`npx vite build` 实测）

| 指标 | 实测值 | CK §1.5 文档值 | 差异 |
|---|---|---|---|
| **modules transformed** | **1926** | 1911 | **+15 (drift)** |
| **build time** | **3.02s** | ~3s | 一致 |
| **index-\*.js raw size** | **1,033.93 KB** | 未记录 | 新基准 |
| **index-\*.js gzip size** | **350.60 KB** | 未记录 | 新基准 |
| **index-\*.css raw size** | 49.29 KB | 未记录 | 新基准 |
| **index-\*.css gzip size** | 8.08 KB | 未记录 | 新基准 |

**Baseline drift erratum**：CK §1.5 写的"1911 modules"来自 AGENTS.md 文本，但今天实测 1926。
项目自 AGENTS.md 写就以来累积增加了 ~15 个 module（与本 PRD 无关，是其他 PR 的影响）。

按 BMAD finalize-no-rollback 原则，CK §1.5 finalize 文档不修改。
**实施期间各 PR 模块数上限以 delta 思维计算**（CK §1.5 各值 + 15）：

| PR | CK §1.5 写的上限 | **实际有效上限**（+15）|
|:---:|:---:|:---:|
| baseline | 1911 | **1926** |
| PR-1 | ≤ 1912 | **≤ 1927** |
| PR-2 | ≤ 1916 | **≤ 1931** |
| PR-3 | ≤ 1925 | **≤ 1940** |
| PR-4 | ≤ 1925 | **≤ 1940** |
| PR-5 | ≤ 1925 | **≤ 1940** |

build time 上限不变：≤ 3.15s（baseline 3.02s + 5%，与 CK §1.5 一致）。

### IDB count baseline（待填 · 浏览器 DevTools console）

```js
// 在浏览器打开 https://<your-app-url> 后，DevTools console 跑：
const before = {
  artifacts: await db.artifacts.count(),
  liveArtifacts: await db.liveArtifacts.count(),
  runHistory: await db.runHistory.count(),
  projects: await db.projects.count(),
};
console.log(JSON.stringify(before, null, 2));
```

**实测填这里**（PR-1 之前完成）：

```json
{
  "artifacts": <待填>,
  "liveArtifacts": <待填>,
  "runHistory": <待填>,
  "projects": <待填>
}
```

> AC-7 验收：IMPL 完成后再跑同样脚本，得 `after`。要求 `before === after`（红线 #1 / NFR-9）。

### git baseline

- branch: `feat/gap-e-export`（新建）
- main HEAD at branch creation: `55b3366` (`docs(planning): finalize BMAD stage 2 ...`)
- planning artifacts on main: brief / PRD / CA / CK · 全 status=final

---

## PR-1 · Foundation（projectExport.ts export 调整）

**Status**: ✅ done · `dd64ae2` · 2026-05-06

### diff stat

```
src/store/projectExport.ts | +24 / -8
```

### 落地

- Add `export function sanitizeName(name)`
- Add `export function formatStamp(ts)`
- Add `export function buildExportFilename(safeName, stamp, ext)`
- `function packageToBlob` → `export function packageToBlob`
- `packageToBlob` 内部改用 3 helper · byte-for-byte 等价

### 验证

| 项 | 结果 |
|---|---|
| vite build | 1926 modules · 2.98s · 无 error |
| tsc | 0 新增 error（pre-existing TS2688 容忍） |
| 红线 #1 #2 #4 | 全过 |

### 坑

- **Erratum #2**：CK §2.1 `-5` 删除上限不现实，实测最小 -8（多行 stamp 表达式 collapse）。已写入 commit msg。
- **Network**：GitHub push SSL handshake 持续失败，本地 2 个 commit 待推。

---

## PR-2 · Pure builders（screenplayParser + exportFormats）

**Status**: ✅ done · `ae285fa` · 2026-05-06

### diff stat

```
src/pipeline/screenplayParser.ts | +106 (94 raw lines + headers, cap 200)
src/store/exportFormats.ts       | +361 (322 raw lines + headers, cap 350+)
2 files changed, 467 insertions(+), 0 deletions(-)
```

### 落地

- `screenplayParser.ts` · 5 状态机（recognition order hardcoded per CA §3.4.1）
- `exportFormats.ts` · 5 pure builders（FR-1..5）+ 3 extractors（FR-9）+ ExportSourceData 接口
- 单测 file 跳过（CK §2.2 已标 ★ 可选）—— PR-5 dogfood 阶段做 AC-2/I-6 手测

### 验证

| 项 | 结果 |
|---|---|
| vite build | 1926 modules · 2.96s（新模块 tree-shaken 待 PR-3 import） |
| tsc | 0 新增 error |
| I-1/I-2 grep | 0 hit ✅ |
| I-3 grep | 2 self-doc 注释 hit · 0 actual call ✅ |
| 红线 #4 | 0 hit ✅ |

### 坑

- `exportFormats.ts` 实际 322 行，commit 显示 361 因含尾部空行 + commit 头注释。仍在 350 cap 边缘 —— 后续若加东西需注意。
- D1 docx spike 待 PR-2 完成后启动（**下一步可选 · CK §3 SOP**），但也可先 PR-3 完成 UI 后再统一 spike。

---

## D1 docx spike report

**Status**: ⏳ pending（PR-2 落盘后触发）

按 CK §3.5 模板填写：

```markdown
### Result
- [ ] PASS · HTML container locked
- [ ] FAIL → L1 success
- [ ] FAIL → L2 success (docx npm)
- [ ] FAIL → L3 (G2 deferred to v3.1)

### Test environment
- OS:
- Word version:
- Spike fixture:

### Judgments
- S-1 (no format dialog): /
- S-2 (heading hierarchy): /
- S-3 (Chinese encoding): /
- S-4 (page break): /

### Time spent
- L1 retries:
- Resolution path:
```

---

## PR-3 · UI shell（ExportDrawer + useExportActions）

**Status**: ✅ done · `2ec16a4` · 2026-05-06

### diff stat

```
src/components/ExportDrawer.tsx | +288 (264 raw lines, cap 250 + erratum #3 +14)
```

### 落地

- 420px 右侧 drawer · DESIGN.md token-only（w-drawer / shadow-floating / bg-surface / bg-overlay / border-border-default / text-heading-m / text-body-s / text-body-m / text-fg-primary / text-fg-muted / btn-icon）
- 6 项 export 卡 · 3 态（enabled/partial/disabled）· deriveItemState 含 scope + source 双过滤
- 内嵌 `useExportActions`：live=sync zustand / archived=async Dexie read + reuse PR-2 extractors
- a11y: role=dialog / aria-modal / Esc / backdrop click / disabled aria

### 验证

| 项 | 结果 |
|---|---|
| vite build | 1926 modules · 2.98s（drawer 待 PR-4 引用后进 bundle） |
| tsc | 0 新增 error |
| I-3 URL.createObjectURL 直调 | 0 hit ✅（走 downloadBlob 既有副作用收敛点） |
| 红线 #4 arbitrary value | 0 hit ✅ |

### 坑

- **Erratum #3**：CK §2.3 行数上限 250 → 实测 264（+14）。原因：hook + UI + deriveItemState + a11y 全部 inline 在单文件（白名单只允 4 新文件，不许拆）。+14 是物理最小。已写入 commit msg。

---

## PR-4 · Wire entry points（Home + Novel + Screenplay）

**Status**: ✅ done · `a98583a` · 2026-05-06

### diff stat

```
src/pages/Home.tsx       | +12 / -2
src/pages/Novel.tsx      | +8  / -1
src/pages/Screenplay.tsx | +12 / -1
3 files changed, 32 insertions(+), 4 deletions(-)
```

### 落地

- Home：onClick 切到 setExportDrawerProjectId / 加 useState / `<ExportDrawer scope=all source=archived>`
- Novel：加 Download lucide / 加 ExportDrawer 导入 + useState / toolbar 加 `<button>导出</button>` / `<ExportDrawer scope=novel source=live>`
- Screenplay：加 `FileDown` lucide（红线 #3 disambiguation）/ ExportDrawer 导入 + useState / toolbar 加 `<button>下载剧本…</button>` / `<ExportDrawer scope=screenplay source=live>`
- exportToAssets / 进入资产阶段 完全未触（red-line #3 grep 0 hit）

### 验证

| 项 | 结果 |
|---|---|
| vite build | 1929 modules（baseline 1926 +3）/ 3.06s |
| tsc | 0 新增 error |
| 红线 #3 grep | 0 hit ✅ |
| 红线 #4 grep | 0 hit ✅ |
| 累积白名单 | 100% 匹配 CK §1.3 ✅ |

### 坑

- **Erratum #4**：CK §2.4 各文件删除上限 `-0/-1` 不可行 · 实测 -2/-1/-1 · git "邻行插入" 物理下限 -1。已写入 commit msg。
- **Erratum #5**：累积 src/ 实施代码 **811 行**，NFR-7 cap 800 · +11 行。来源：完整 invariant doc + a11y handler + 5 builder + parser + extractor。已记录本节。
- **Pre-existing 6 个 IDE-only StageId mismatch errors**：在 Screenplay.tsx L121/181/253/260/472/513，根 tsconfig.json 不报，IDE TS server 用 tsconfig.app.json 报。**与 PR-4 无关**，PR-4 未触这些行。建议作为独立技术债登记。
- **Network**：GitHub push SSL handshake 仍失败，本地累计 7 个 commit 待推。

---

## PR-5 · Spike + AC pass + dogfood log

**Status**: ⏳ pending

### AC-1..AC-8 verification（待填）

```
AC-1 [ ] 6 formats happy-path: <evidence>
AC-2 [ ] partial degradation: <evidence>
AC-3 [ ] disabled state: <evidence>
AC-4 [ ] Home behavior change + .flil.json byte-for-byte: <evidence>
AC-5 [ ] offline (DevTools Network → Offline): <evidence>
AC-6 [ ] performance P95 thresholds: <numbers>
AC-7 [ ] IDB count before == after: <before/after>
AC-8 [ ] vite build modules ≤ 1940 / tsc 0 error / 0 new deps: <numbers>
```

---

<!-- dogfood-log.md · IMPL Day 1 baseline 完成 · 后续 PR 追加节 -->
