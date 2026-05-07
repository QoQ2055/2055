# 快捷键应用指南

> **范围**：ui-v3 PR-1 MVP / PR-1B 实装。`Command Palette` + 全局快捷键 + 局部快捷键 + handbook modal。
>
> **核心组件**：
> - `src/components/CommandPalette.tsx` · Cmd+K / Ctrl+K 命令面板
> - `src/components/ShortcutHandbook.tsx` · ? 触发的手册 modal
> - `src/lib/shortcuts.ts` · `isEditingTarget` / `isCtrlOrCmd` 工具
> - `src/store/commandPalette.ts` / `src/store/shortcutHandbook.ts` · zustand state
>
> **挂载点**：`src/components/Layout.tsx` · 全局唯一 keydown 监听 + 2 个 modal 渲染。

---

## 当前快捷键清单（同步 ShortcutHandbook 内容）

| 键 | 范围 | 行为 | 输入态保护 |
|---|---|---|---|
| `Cmd+K` / `Ctrl+K` | 全局 | 打开命令面板 | ❌ 不保护 |
| `Cmd+S` / `Ctrl+S` | 全局 | 阻拦浏览器原生保存 + toast 提示已自动保存 | ❌ 不保护 |
| `?` (Shift+/) | 全局 | 打开快捷键手册 | ✅ input/textarea/select/contenteditable 内禁用 |
| `J` | /novel | 下一章节（selectedChapterIdx + 1） | ✅ 输入态禁用 |
| `K` | /novel | 上一章节（selectedChapterIdx − 1） | ✅ 输入态禁用 |
| `Esc` | modal 局部 | 关闭当前 modal/palette | N/A（modal 自管理） |

**不在清单内 = 不能用**。如果你需要新键，先读 § 决策树。

---

## 与浏览器/系统冲突表

> 严守 V3-I-2 · 不抢系统快捷键。下表标注"⚠ 抢"的键我们已 `preventDefault` · 应用内语义优先。

| 系统语义 | 是否抢 | 原因 |
|---|---|---|
| `Cmd+K` 浏览器地址栏聚焦 | ⚠ 抢 | 应用内命令面板优先级更高（开发者工具类应用通用约定） |
| `Cmd+S` 浏览器保存页面 | ⚠ 抢 | 用户期望 = 保存内容 · 我们已自动保存 · 弹 toast 解释 |
| `Cmd+C` / `Cmd+V` / `Cmd+X` | ✅ 不抢 | 系统剪贴板 · 永远不能抢 |
| `Cmd+Z` / `Cmd+Y` | ✅ 不抢 | input/textarea 撤销 · 不能抢 |
| `Cmd+A` | ✅ 不抢 | 全选 · 不能抢 |
| `Cmd+F` | ✅ 不抢 | 浏览器查找 · 不能抢（应用内搜索走 Cmd+K） |
| `Cmd+T` / `Cmd+W` / `Cmd+N` | ✅ 不抢 | 标签页 · 不能抢 |
| `Cmd+Shift+P` (mac) / `Ctrl+Shift+P` | 备选 | DevTools / 命令面板（暂未抢） |

---

## 决策树 · 我要加一个新快捷键

```
1. 新键是 modifier 组合（Cmd/Ctrl + X）吗？
   ├─ 是 → 查上面"冲突表" · 是否抢系统？
   │      ├─ 抢系统 → 写 PRD · 走完整 BMAD 流程（这是设计决策不是技术决策）
   │      └─ 不抢   → 走 § 实现路径 · 全局监听 · 任意上下文触发
   │
   └─ 否（裸字母键 / 符号键） → 必须做输入态保护
          ├─ 全局键    → Layout.tsx 监听 + isEditingTarget 守卫（如 ?）
          └─ 页面局部键 → 页面组件内 useEffect 监听 + 同上守卫（如 J/K）

2. 行为有副作用（写数据 / 调外部 API）吗？
   ├─ 是 → 必须有 toast 反馈（V3-I-4 不静默）· try/catch + console.error
   └─ 否 → 仅 UI state 变更 · 可省 toast

3. 与现有键有冲突吗？
   ├─ 同键不同范围（全局 vs 页面）→ OK · React tree 局部 useEffect 后注册者优先
   └─ 同键同范围 → ⚠ 拒绝 · 必须重选键
```

---

## 实现路径

### 全局键（Layout.tsx 注册）

```tsx
// src/components/Layout.tsx
useEffect(() => {
  function handler(e: KeyboardEvent) {
    if (isCtrlOrCmd(e, 'k')) {
      e.preventDefault();
      togglePalette();
      return;
    }
    if (e.key === '?' && !isEditingTarget(e)) {
      e.preventDefault();
      showHandbook();
      return;
    }
  }
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [togglePalette, showHandbook]);
```

**规则**：

- `isCtrlOrCmd(e, key)` · 检测 modifier 组合（Cmd 或 Ctrl 都接受）
- `isEditingTarget(e)` · 检测当前 focus 是否在 input/textarea/select/contenteditable
- modifier 键不需要 `isEditingTarget` 守卫（用户期望 Cmd+S 任意上下文都生效）
- 裸键必须配 `isEditingTarget` 守卫（避免抢用户输入）
- 永远 `e.preventDefault()` · 否则浏览器会做默认行为

### 页面局部键（页面组件 useEffect）

```tsx
// src/pages/Novel.tsx
useEffect(() => {
  if (chapters.length === 0) return; // 数据未到位时不注册
  function handler(e: KeyboardEvent) {
    if (isEditingTarget(e)) return;                       // 输入态保护
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return; // 仅纯键
    if (e.key.toLowerCase() === 'j') {
      e.preventDefault();
      setSelectedChapterIdx((cur) => Math.min(chapters.length, (cur ?? 0) + 1));
    }
  }
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [chapters.length]);
```

**规则**：

- 数据未到位时（如 chapters 为空）直接 return · 不注册 listener · 避免误触发
- 局部键应明确拒绝 modifier 组合（用户的 Cmd+J 应该交给浏览器或系统）
- 边界 clamp · 永远不让 state 越界

### 注册到 ShortcutHandbook

每加一个新键 · 必须同时：

1. 加到 `src/components/ShortcutHandbook.tsx` 的 `GROUPS` 数组对应 group
2. 加到本文件 § 当前快捷键清单
3. 写 commit message 注明（方便后续审计）

⚠ **不一致是 bug**：用户按 ? 看到的手册 vs 实际生效的键 · 必须 1:1 对应。

---

## Command Palette 加新命令

```tsx
// src/components/CommandPalette.tsx · COMMANDS 数组
{
  id: 'tools-new',
  label: '新命令名',
  description: '一句话描述',
  group: 'navigate' | 'tools',  // 仅 2 个 group · 不要新建
  icon: SomeLucideIcon,
  keywords: ['搜索关键词', 'fuzzy', 'aliases'],
  action: ({ navigate }) => navigate('/path'),
},
```

**规则**：

- 仅 2 个 group · 不要扩张（会让搜索结果分散）
- `keywords` 中文 + 英文都加 · 提升搜索命中率
- `action` 必须是同步路由跳转或简单 state 变更 · **不要**调外部 API 或写数据（命令面板是导航 · 不是操作）
- 如需"操作类命令"（如新建项目）· 走全局 dialog state（暂未实现 · 见 ui-v3 PR-1B 延后项）

---

## 已知限制 / 未实装项

| 项 | 状态 | 备注 |
|---|---|---|
| `/` focus 全局搜索 | ❌ 未实装 | 暂无全局搜索 input · 用 Cmd+K 替代 |
| `Cmd+Shift+P` 备用面板 | ❌ 未实装 | Cmd+K 已够用 |
| 命令面板模糊匹配 | ⚠ 弱 | 当前 substring · 后续可换 fuse.js / cmdk |
| "新建项目"命令 | ❌ 未实装 | 需要全局 dialog state · 留 ui-v3 PR-1C |
| "切换主题"命令 | ❌ 未实装 | settings store 暂无 theme 字段 · 留 ui-v4 |
| 自定义快捷键 | ❌ 未实装 | 用户无法改键位 · 当前 hard-coded |

---

## 测试清单（PR 内自检）

```
□ 新键已加到 ShortcutHandbook
□ 新键已加到本文档清单
□ 输入态保护已加（如适用）
□ modifier 组合冲突已查
□ vite build 无 TypeScript 错误
□ 手测：在 NewProjectDialog 标题 input 内按新键 → 应正常输入字符（裸键）
□ 手测：在 modal open 时按新键 → 行为符合预期（不冲突）
□ 手测：连按 5 次 → 不爆 console.error
```
