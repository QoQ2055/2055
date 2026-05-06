---
description: 全仓库精简扫描——识别死代码 / 重复逻辑 / 过度抽象 / 过期注释，然后按"低风险优先"原则落地清理
---

本工作流面向 cineforge-web 仓库（React + TS + Dexie + Vite 单体应用）。
目标：在不改变行为的前提下，**让代码量下降、抽象密度上升、可读性提高**。

执行原则（任何步骤都要遵循）：
1. **不改变可观测行为**：UI 显示一致、API 调用顺序一致、Dexie schema 不动 / 仅追加。
2. **可逆性优先**：每一步落地后立刻 `npx vite build` 验证；失败立即回滚。
3. **小步提交**：每解决一类问题就跑一次 build，避免一次性几十处修改互相掩盖。
4. **保留有意识保留的 dead code**：`@deprecated` / `@internal` / 当前阶段未启用但即将使用的代码段，需要在评论中显式说明。

---

## Step 1 · 扫描：用脚本找出可疑点

### 1.1 未使用的 export
// turbo
```powershell
$exports = @{}
$usages = @{}
Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx | ForEach-Object {
  $path = $_.FullName
  $content = Get-Content $path -Raw -Encoding UTF8
  # 收集 export 名（function / const / type / interface / class / enum）
  $regex = [regex]'export\s+(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+(\w+)'
  foreach ($m in $regex.Matches($content)) {
    $name = $m.Groups[1].Value
    if (-not $exports.ContainsKey($name)) { $exports[$name] = @() }
    $exports[$name] += $path
  }
}
Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx | ForEach-Object {
  $content = Get-Content $_.FullName -Raw -Encoding UTF8
  foreach ($name in $exports.Keys) {
    # 简易引用判定：identifier 出现在 import { X } / X( / <X / X. / : X 等位置
    if ($content -match "\b$name\b") {
      if (-not $usages.ContainsKey($name)) { $usages[$name] = 0 }
      $usages[$name]++
    }
  }
}
$exports.Keys | Where-Object {
  ($usages[$_] -le 1) -or (-not $usages.ContainsKey($_))
} | Sort-Object | ForEach-Object { "$_  →  $($exports[$_] -join ',')" }
```

> 上面是粗扫，会有少量假阳性（同名变量、动态 import）。需要人工复核。

### 1.2 TODO / FIXME / XXX
// turbo
```powershell
Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx,*.md `
  | Select-String -Pattern '\b(TODO|FIXME|XXX|HACK)\b' `
  | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
```

### 1.3 极长文件（> 800 行）
// turbo
```powershell
Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx `
  | ForEach-Object { [pscustomobject]@{ Lines = (Get-Content $_.FullName).Count; File = $_.FullName } } `
  | Where-Object Lines -gt 800 `
  | Sort-Object Lines -Descending
```

### 1.4 重复字符串模式（候选抽取 helper）
关注 ≥ 3 次出现的多行模式，例：
- `replace(/^\`\`\`(?:json)?\s*|\s*\`\`\`$/g, '')` —— code fence 剥离
- `Math.random().toString(36).slice(...)` —— UID 生成
- `useState<T[]>([])` + `useEffect(() => { load(); }, [...])` —— 异步加载样板

### 1.5 每个文件的 import 行数 > 25 → 候选拆分
// turbo
```powershell
Get-ChildItem -Recurse -Path src -Include *.ts,*.tsx `
  | ForEach-Object {
    $imports = (Get-Content $_.FullName | Select-String -Pattern '^import' -SimpleMatch).Count
    if ($imports -gt 25) { "$($_.FullName)  →  $imports imports" }
  }
```

---

## Step 2 · 分类：把扫描结果分桶

| 桶 | 处理策略 |
|----|----------|
| **dead export**（无任何引用） | 直接删除；如果是公共类型可能后续会用，加 `@deprecated` 注释而非删 |
| **single-use export**（仅 1 处引用） | 评估是否值得 inline 到使用方 |
| **duplicated logic ≥ 3 次** | 抽取 helper；位置选最低的共同祖先目录 |
| **过期注释 / 注释式代码块** | 直接删 |
| **`any` / `as unknown as`** | 标记后人工处理（不在自动化范围） |
| **TODO without owner** | 列入 `progress.txt` 或 GitHub issue，注释里清理 |
| **>800 行文件** | 标记，不在本工作流自动拆分（人工设计） |

---

## Step 3 · 落地：按风险从低到高执行

按以下顺序，**每完成一组运行一次 `npx vite build`**：

1. 删除完全未使用的 export 与对应 import（dead-code-elimination）。
2. 删除注释式的死代码段（如 `// console.log(...)` / `/* OLD: ... */`）。
3. 删除过期 `// TODO`（已完成的 / 上下文已变的）。
4. 抽取重复 ≥ 3 次的字符串处理 / 状态机样板成 helper。
5. inline 仅 1 处使用且 < 5 行的 helper 函数（若 inline 后更易读）。

每一步落地后：
// turbo
```powershell
npx vite build 2>&1 | Select-String -Pattern 'error|built'
```

---

## Step 4 · 报告：写到本次会话末尾

输出格式：
```
- 删除 X 个 dead exports
- 删除 Y 处注释式死代码
- 抽取 Z 个 helper（命名 + 出处）
- 跳过的 N 处需人工判断的项（列出文件 + 行号 + 原因）
- 验证：vite build ✓ <module count> / <duration>
```

---

## 何时**不**应该用这个 workflow
- 正在做 feature 开发、有未提交改动时（先 stash）
- 大型重构（移动文件 / 重命名公共 API）—— 那是 refactor 而不是 simplify
- TS 严格模式升级 —— 单独走
