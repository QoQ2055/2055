# 反馈组件应用指南

> **范围**：ui-v2 PR-2 + ui-v3 PR-2 实装的反馈类组件。
>
> 这些组件**不是 atom**（V2-I-4 锁死在 6 个）· 它们是 page-level / app-level component · 但功能性很强 · 全站应用。
>
> | 组件 | 文件 | 用途 |
> |---|---|---|
> | `Toast` | `src/components/ui/feedback/Toast.tsx` + `src/store/toast.ts` | 临时通知 / 操作反馈 |
> | `Tooltip` | `src/components/ui/feedback/Tooltip.tsx` | 鼠标 hover 解释 |
> | `Skeleton` | `src/components/ui/feedback/Skeleton.tsx` | 加载占位 |
> | `EmptyState` | `src/components/ui/feedback/EmptyState.tsx` | 空数据引导 |
> | `SidebarBadge` | `src/components/SidebarBadge.tsx` | sidebar nav 上的待办计数 |

---

## 决策树 · 我要给用户一个反馈

```
反馈触发时机？
├─ 用户主动操作完成（保存 / 删除 / 提交）
│   ├─ 成功 → toast.success('已保存')
│   ├─ 警告 → toast.warning('部分失败')
│   └─ 失败 → toast.error('保存失败：' + e.message) + console.error
│
├─ 数据异步加载中
│   ├─ 占位整段 → <Skeleton variant="block" />
│   └─ 占位行   → <Skeleton variant="line" />
│
├─ 数据加载完是空的
│   └─ <EmptyState icon={X} title="..." description="..." action={...} />
│
├─ 鼠标 hover 想看更多说明
│   └─ <Tooltip content="...">{trigger}</Tooltip>
│
└─ 待办通知（不是当下操作 · 是后台状态）
    └─ <SidebarBadge variant="danger" count={...} />
```

---

## Toast · 临时通知

**何时用**：用户的某次操作完成（保存 / 删除 / 网络请求结束）· 或重要状态变化（已自动保存）。

**不要用 Toast**：

- 持续状态（如"配置缺失"）→ 用 SidebarBadge / EmptyState
- 需要用户决策（确认对话框）→ 用 modal（暂未做 ConfirmDialog atom · 现用原生 confirm）
- 详细错误信息 + 堆栈 → 配 toast.error 但堆栈走 console.error

### API（`src/store/toast.ts`）

```tsx
import { toast } from '../store/toast';

toast.success('已保存');                    // 4s 后自动消失
toast.info('已自动保存 · ...');              // 4s
toast.warning('部分章节生成失败', 8000);     // 自定义 8s
toast.error('网络错误：' + e.message);      // 不自动消失（用户必须点 X）

// duration=null · 永久（仅 error 默认行为）
toast.info('xxx', null);
```

### 4 类型语义

| 类型 | 颜色 | 默认时长 | 用例 |
|---|---|---|---|
| `success` | bg-success/5 + text-success | 4s | 保存成功 / 导入成功 / 操作完成 |
| `info` | bg-surface + text-action-primary | 4s | 中性提示（如已自动保存） |
| `warning` | bg-warning/5 + text-warning | 4s | 部分失败 / 需要注意但非错 |
| `error` | bg-danger/5 + text-danger | **null**（不消失）| 操作失败 / 网络错误 / 数据损坏 |

### Anti-pattern

```tsx
// ✗ 不要用 alert()
alert('保存失败');                 // 阻塞 UI · 视觉割裂

// ✓ 改用 toast
toast.error('保存失败：' + e.message);
console.error('save failed', err);  // V2-I-9 · 必须保留

// ✗ 不要用 toast 做"持续状态"提示
toast.warning('API key 未配置', null);  // 用户每次开页面都看到 · 烦

// ✓ 持续状态用 SidebarBadge
<SidebarBadge variant="warning" dot hidden={hasKey} />
```

---

## Tooltip · hover 解释

**何时用**：UI 太紧凑放不下解释文字 · 但用户可能想知道。

**不要用**：

- 主要交互必须的信息（用户可能在触屏上看不到 hover）
- 长段文字（超过 2 行）→ 用 popover / dialog

### 4 方向 · a11y 规则

```tsx
<Tooltip content="某个解释" side="top">
  <Button iconOnly><InfoIcon /></Button>
</Tooltip>
```

- `side`: `top` / `bottom` / `left` / `right`
- 触发：mouse hover 200ms · 移开关闭
- a11y：trigger 必须有 `aria-label` 或可见文字 · Tooltip 不替代 a11y

---

## Skeleton · 加载占位

**何时用**：异步数据 fetch · 等待时间 > 200ms · 用户已经在看屏幕。

**不要用**：

- 同步加载（瞬间完成 · skeleton 闪一下反而难受）
- 用户主动触发的耗时操作 → 用 Button loading state

### Variant

```tsx
<Skeleton variant="line" />        // 单行文字占位
<Skeleton variant="block" />       // 卡片 / 大块占位
<Skeleton variant="circle" />      // 头像 / icon 占位

// 多行
{[1,2,3].map((i) => <Skeleton key={i} variant="line" />)}
```

---

## EmptyState · 空数据引导

**何时用**：列表 / 表格 / 卡片区数据为空 · 用户需要"做点什么"才会有内容。

**不要用**：

- 永远不会有数据的区域（应该藏掉整块）
- 加载中（用 Skeleton）

### API

```tsx
<EmptyState
  icon={<BookOpen className="size-12 text-fg-muted" />}
  title="还没有项目"
  description="创建第一个项目开始你的小说生产流水线"
  action={<Button variant="primary" onClick={handleCreate}>新建项目</Button>}
/>
```

**写文案的原则**：

- title · 一句话陈述事实（"还没有 X"）
- description · 解释下一步该做什么（不是责备用户）
- action · 给一个直接 CTA 按钮（避免用户自己找入口）

---

## SidebarBadge · 后台待办通知

**何时用**：当某条 sidebar nav 路径下面有用户应该处理但还没看到的内容。

**不要用**：

- 当前已经在该页面（用户已经在看 · 不需要再提示）
- 需要立即响应的紧急事件 → 用 toast / modal

### 3 variant

```tsx
// 数字模式（pending 数）
<SidebarBadge variant="danger" count={pendingLessons} />  // 红 + 数字 · ≥10 显示 "9+"
<SidebarBadge variant="info"   count={newModules} />      // 蓝 + 数字（备用）

// dot 模式（无具体数字 · 仅"有问题"）
<SidebarBadge variant="warning" dot hidden={hasKey} />    // 黄圆点 · API key 未配
```

### V3-I-7 / DESIGN.md ⑥ 色盲友好

- `warning` 数字模式自带 AlertTriangle icon · 不仅靠颜色
- `danger` / `info` 数字本身就是文字内容 · 满足"双通道"
- `dot` 模式带 `aria-label` · 屏幕阅读器可读

---

## confirm() / ConfirmDialog 现状

**当前**：项目内 17 处 `confirm()` 调用（删除 / 清空 / 切项目等）。这是浏览器原生 confirm · 阻塞 + 视觉割裂。

**未实装**：ConfirmDialog atom 留给后续 epic（ui-v3 PR-1C 或 ui-v4）。

**临时规则**（在 ConfirmDialog 出来前）：

- 危险操作（删除 / 不可撤销）→ 沿用 `confirm()` · message 写清楚后果
- 非危险操作 → 用 toast 反馈即可 · 无需 confirm

---

## 测试清单（PR 内自检）

```
□ alert() · 全站 0 个真实调用（仅注释引用）
  Get-ChildItem src -Recurse -Include '*.ts','*.tsx' | Select-String '(?<![a-zA-Z\.])alert\('

□ Toast 4 种类型颜色对比 · 在亮 / 暗主题下都可读
□ Skeleton 出现 → 消失 · 不闪烁（确保 isLoading state 不抖动）
□ EmptyState · action 按钮直接可用 · 不需用户再找
□ SidebarBadge · 数据变化时立即更新（不等 10s 轮询）
□ console.error · 所有 toast.error 都配 console.error 双通道
```
