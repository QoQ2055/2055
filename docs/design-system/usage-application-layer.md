# 应用层 atom 应用指南

> **范围**：ui-v2 epic 实装的 6 个 atom + 应用层的"裸 className → atom"替换决策。
>
> **6 atoms**（V2-I-3 锁定）：
>
> | atom | 文件 | 用途 |
> |---|---|---|
> | `Button` | `src/components/ui/Button.tsx` | 按钮（5 variant × 3 size + iconOnly + loading） |
> | `Input` | `src/components/ui/Input.tsx` | 单行表单输入 |
> | `Textarea` | `src/components/ui/Textarea.tsx` | 多行表单输入 |
> | `NavItem` | `src/components/ui/NavItem.tsx` | 路由跳转链接（V2-I-7 仅路由 · 不塞按钮） |
> | `NavSectionLabel` | 同上 | sidebar 分组标签 |
> | `Tabs` | （如已存在） | 详见 DESIGN.md |
>
> **不在清单内 = 不是 atom**。Toast / Tooltip / Skeleton / EmptyState / SidebarBadge / CommandPalette / ShortcutHandbook 都是 page-level component（V2-I-4）。

---

## 决策树 · 我看到一段裸 className

```
1. 这是 layout class 还是 design class？
   ├─ layout (flex / grid / size / spacing / position)
   │   → ✅ 保留 · 不是 atom 范围
   │
   └─ design (颜色 / 字体 / 圆角 / 阴影 / focus ring)
       └─ 2. 这是 button / input / textarea / nav 之一吗？
           ├─ 是 → ✅ 必须改 atom（见下表）
           └─ 否 → 3. 是 modal / panel / card 之一吗？
                  ├─ 是 → ⚠ 不是 atom · 但应用 token（bg-canvas / border-border-subtle）
                  └─ 否 → 走 docs/design-system/migration-checklist.md 逐项核对
```

---

## button 决策树

```
我有一个 onClick 行为 · 视觉是按钮吗？
├─ 是 · 但只是 icon 没有文字 → <Button variant="ghost" iconOnly>
├─ 是 · 主操作（一页面 ≤ 1 个）  → <Button variant="primary">
├─ 是 · 次要操作                → <Button variant="secondary">
├─ 是 · 危险操作（删除 / 清空）  → <Button variant="danger">
├─ 是 · 极弱操作（关闭 / 取消）  → <Button variant="ghost">
└─ 否 · 只是路由跳转            → <NavItem to="/path">

按钮的尺寸：
├─ 内嵌于 panel header / form         → size="sm"  (h-7)
├─ 主操作 / dialog 底部                → size="md"  (h-9 默认)
└─ Hero / CTA / 大按钮                 → size="lg"  (h-11)

迷思 · 不要这样做：
✗ 同一页面 2 个 variant="primary"      · 主次失衡
✗ 用 <a className="btn-primary">       · 应该用 NavItem 或 Link + Button as
✗ 给 Button 加自定义 bg- / text- class · 破坏 variant 语义
✗ 用 <div onClick> 代替 button         · a11y 死亡
```

### 错例 · 真实修复

**Before**（违反 token 优先）：

```tsx
<button
  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
  onClick={handleSave}
>保存</button>
```

**After**：

```tsx
<Button variant="primary" onClick={handleSave}>保存</Button>
```

**Before**（误用 layout class 当 design）：

```tsx
<button className="btn-ghost text-xs" onClick={onClose}>关闭</button>
```

**After**（保留 · 仍合规）· `btn-ghost` 是 `src/index.css` 内的 token-based 配方 · 等价于 `<Button variant="ghost" size="sm">`. 两种写法都接受 · 但**新代码统一走 atom**。

---

## input / textarea 决策树

```
1. 单行还是多行？
   ├─ 单行（包括 type=number / email / search） → <Input>
   └─ 多行 / 富文本                              → <Textarea>

2. 大小？
   ├─ 紧凑场景（panel / table / inline edit） → size="sm"  (h-7 px-2.5)
   └─ 表单 / dialog                            → 默认（h-9 px-3）
                                                · Textarea 无 size · min-h-24

3. 错误态？
   ├─ 校验失败 / 红边框 → error={true}（自动套 .input-error）
   └─ 正常             → 不传 error
```

### 关键 anti-pattern

```tsx
// ✗ 错例 1：把 .input class 用在 div / span / select
<select className="input">  // 不会生效 · select 不是 input

// ✗ 错例 2：手写 bg-surface border-border-subtle ...
<input className="bg-surface border border-border-subtle rounded px-2 py-1.5" />
// → 改 <Input size="sm">

// ✗ 错例 3：给 Input 加 height
<Input className="h-12" />  // 破坏 atom 内置 sizing · 应该用 size 属性

// ✓ 正例：通过 className 加 layout · 不动 design
<Input className="w-full" />
<Input className="flex-1" />
<Textarea className="min-h-32" />  // Textarea 显式允许覆盖 min-h
```

---

## select 怎么办？（V2-I-4 不加第 7 atom）

项目刻意**不**做 Select atom。原生 `<select>` 配 token 配方即可：

```tsx
<select
  className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
  value={v}
  onChange={(e) => setV(e.target.value)}
>
  <option value="a">A</option>
</select>
```

**为什么不做 Select atom**：

1. 原生 select 的 a11y / 触屏 / 键盘导航是免费的 · 自定义 dropdown 必然劣化
2. 新增第 7 atom 会引入"选择什么"的决策成本（Combobox? Listbox? Multi-select?）· 不如让需求驱动（v8+ 真有需求再做）
3. 视觉上原生 select 在暗主题下不够漂亮 · 但项目优先功能完整 · 视觉接受

---

## NavItem 边界（V2-I-7）

**NavItem 仅做路由跳转**。

```tsx
// ✓ 正例
<NavItem to="/lessons" icon={<Lightbulb />}>反馈课程</NavItem>

// ✗ 错例：塞功能按钮
<NavItem to="#" onClick={handleSomething}>...</NavItem>

// ✓ 加 badge 的正确姿势（V3-I-3 不动 NavItem）
<div className="relative">
  <NavItem to="/lessons" icon={<Lightbulb />}>反馈课程</NavItem>
  <SidebarBadge variant="danger" count={pendingCount} />
</div>
```

---

## token 速查（详见 DESIGN.md）

| 场景 | token class |
|---|---|
| 主背景 | `bg-canvas` |
| 卡片 / panel 背景 | `bg-surface` |
| hover / 高亮背景 | `bg-elevated` |
| 主文字 | `text-fg-primary` |
| 次文字 | `text-fg-secondary` |
| 弱文字 / placeholder | `text-fg-muted` |
| 边框默认 | `border-border-subtle` |
| 边框强调 | `border-border-default` |
| 主品牌色 | `text-primary-500` / `bg-primary-500/10` |
| 成功 | `text-success` / `bg-success/10` |
| 警告 | `text-warning` / `bg-warning/10` |
| 危险 | `text-danger` / `bg-danger/10` |
| 信息 | `text-info` / `bg-info/10` |

**不要写**：`bg-blue-600` / `text-red-500` / `border-gray-700` 等 Tailwind 默认色 · 这是裸色（违反 DESIGN.md ①）。

---

## 测试清单（PR 内自检）

```
□ Select-String -Pattern '<button[^>]*className="[^"]*bg-' src/   → 无新增匹配
□ Select-String -Pattern '<input[^>]*className="[^"]*bg-' src/    → 无新增匹配
□ Select-String -Pattern '<textarea[^>]*className="[^"]*bg-' src/ → 无新增匹配
□ Select-String -Pattern 'bg-(blue|red|green|yellow|gray|slate|zinc)-' src/ → 无新增匹配
□ vite build 无 TypeScript 错误
□ 视觉 review · 与同类页面风格一致（focus ring / hover bg / disabled opacity）
```
