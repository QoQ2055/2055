# 老代码迁移清单 · 裸 className → atom

> **使用场景**：你打开了一个老页面（PR-1 之前的代码）· 想做"顺手清理" · 不确定改哪些 / 不改哪些。
>
> 本文档提供**机械化判断流程**。逐项执行 · 不需要额外创造性。

---

## 第一原则 · 边界

| 改 | 不改 |
|---|---|
| 视觉相关的 className（颜色 / 字体 / 圆角 / 阴影 / focus / hover） | 布局相关的 className（flex / grid / size / spacing / position） |
| 裸 button / input / textarea / nav link | div / span / section · 即使套了视觉 class（除非是卡片用 token 自定义） |
| 直接色 hex / Tailwind palette（`bg-blue-600` 等） | semantic token（`bg-primary-500` / `bg-success` 等） |
| 业务文字 / 标题 / 列表 | 行为逻辑（onClick / onSubmit / state） |

**永远不改**：

- 业务逻辑（即使逻辑很丑也不在本 PR 改）
- 数据结构 / Dexie schema（V3-I-5）
- 路由表（V3-I-1）
- 6 atom 实现（V2-I-3）
- NavItem 实现（V3-I-3）

---

## 扫描命令（PowerShell · windows）

### 找裸色直接 hex

```powershell
Get-ChildItem src -Recurse -Include '*.ts','*.tsx' | Select-String -Pattern 'bg-(blue|red|green|yellow|gray|slate|zinc|neutral|stone)-\d'
```

### 找裸 button 用直接色

```powershell
Get-ChildItem src -Recurse -Include '*.tsx' | Select-String -Pattern '<button[^>]*className="[^"]*bg-(blue|red|green|orange|yellow)'
```

### 找裸 input / textarea 手写视觉

```powershell
Get-ChildItem src -Recurse -Include '*.tsx' | Select-String -Pattern '<(input|textarea)[^>]*className="[^"]*(bg-|border-|rounded)'
```

### 找仍在用 alert()

```powershell
Get-ChildItem src -Recurse -Include '*.ts','*.tsx' | Select-String -Pattern '(?<![a-zA-Z\.])alert\('
```

### 找仍在用 confirm()

```powershell
Get-ChildItem src -Recurse -Include '*.ts','*.tsx' | Select-String -Pattern '(?<![a-zA-Z\.])confirm\('
```

---

## 逐项判断流程

### Step 1 · 是 button / input / textarea / 路由 link 之一吗？

```
是 → 进 Step 2（必须改 atom）
否 → 进 Step 5（视觉调整）
```

### Step 2 · 行为是不是单纯路由跳转？

```
是 → 改 <NavItem to="/...">  · 不进 Step 3
否 → 进 Step 3
```

### Step 3 · 选 atom 类型

```
button · onClick → <Button variant="..." size="...">
input  type=text/number/email/search → <Input>
textarea / 多行 → <Textarea>
```

参考 [`usage-application-layer.md`](./usage-application-layer.md) § 决策树。

### Step 4 · 选 variant / size

```
variant：
├─ 主操作（页面 ≤ 1 个）→ primary
├─ 次操作               → secondary
├─ 危险操作（删除）      → danger
├─ 极弱操作（关闭 X）    → ghost
└─ 仅边框               → outline

size：
├─ panel 内嵌 / table   → sm
├─ form / dialog 默认   → md
└─ Hero CTA             → lg
```

### Step 5 · div / span 视觉调整

```
你看到的裸色：
├─ bg-blue-* / text-red-* 等 Tailwind palette
│   → 改 semantic token：bg-primary-500 / text-danger / ...
│
├─ 自定义 hex (#xxx)
│   → 不应该出现 · 改 token · 如不存在 token · 写 PRD 推 design epic
│
└─ 已是 token (bg-canvas / text-fg-primary)
    → ✅ 不改
```

---

## 常见替换样例

### 样例 1 · 裸 close 按钮

**Before**：

```tsx
<button
  onClick={onClose}
  className="p-1 hover:bg-gray-700 rounded"
  aria-label="关闭"
>
  <X className="size-4" />
</button>
```

**After**：

```tsx
<Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label="关闭">
  <X className="size-4" />
</Button>
```

### 样例 2 · 裸 search input

**Before**：

```tsx
<input
  type="text"
  value={q}
  onChange={(e) => setQ(e.target.value)}
  placeholder="搜索..."
  className="w-full px-3 py-1.5 bg-surface border border-border-subtle rounded text-fg-primary"
/>
```

**After**：

```tsx
<Input
  type="text"
  value={q}
  onChange={(e) => setQ(e.target.value)}
  placeholder="搜索..."
  className="w-full"
/>
```

### 样例 3 · alert → toast

**Before**：

```tsx
try {
  await save();
} catch (e) {
  alert('保存失败：' + (e as Error).message);
}
```

**After**：

```tsx
try {
  await save();
  toast.success('已保存');
} catch (e) {
  toast.error('保存失败：' + (e as Error).message);
  console.error('[savePage] failed', e);  // V2-I-9
}
```

### 样例 4 · 误用 .input class 在 select

**Before**：

```tsx
<select className="input">
  <option value="a">A</option>
</select>
```

**After**（保留 raw select · 但补 token class）：

```tsx
<select className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5">
  <option value="a">A</option>
</select>
```

（不做 Select atom · V2-I-4）

---

## PR 切片建议

不要在一个 PR 里改 20 个文件 · 风险大且 review 困难。建议：

| PR 大小 | 修改文件数 | 修改控件数 | 提交粒度 |
|---|---|---|---|
| 小 | 1-3 | ≤ 10 | 单 commit |
| 中 | 4-8 | 10-30 | 每文件 1 commit |
| 大 | ≥ 9 | ≥ 30 | 必须拆分 PR |

每次 commit 后 `npx vite build` · 0 errors 才能继续。

---

## 自检清单（PR 提交前必走）

```
□ git diff · 确认没有改动行为逻辑（onClick handler / state / API call 都不动）
□ Select-String 扫描裸色 · 无新增匹配
□ Select-String 扫描 alert · 无新增匹配
□ npx vite build · 0 errors
□ 视觉 review · 与同类已迁移页面一致
□ 6 atoms 文件未被修改（git diff src/components/ui/Button.tsx 等 · 应为空）
□ NavItem 实现未被修改
□ commit message 标注：refactor(ui-v?  PR-?): 文件名 · X 控件 atom 化
```

---

## 已知"看似该改但不该改"的边界

| 现象 | 决策 | 理由 |
|---|---|---|
| `<select className="input">` | 不直接改 | .input class 不会生效 · 但改成 select atom 违反 V2-I-4 · 改成 raw + token 即可 |
| `<a className="text-primary-500 underline">` | 不改 | a 标签不是 atom · 用 token 已合规 |
| `<div className="size-2 bg-success rounded-full">` | 不改 | 这是状态点 · 是装饰性 dom · 没必要走 component |
| `<button className="btn-primary">` | 可保留 | btn-primary 是 src/index.css 的 token 配方 · 等价于 Button atom · 但**新代码**统一走 atom |
| 多处用 `console.warn` 而非 `console.error` | 不改 | warn / error 区分有业务含义 · 不是 V2-I-9 范围 |
