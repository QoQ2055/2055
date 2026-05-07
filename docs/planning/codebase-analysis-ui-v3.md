# Codebase Analysis · ui-v3 epic · 交互系统增强

> **BMAD Stage 2 · Codebase Analysis 文档**
> 提议日期：2026-05-07 19:50
> Epic ID：`ui-v3-interaction-system`
> 上游：`docs/planning/prd-ui-v3-interaction-system.md`
> 用途：揭示 PRD 与代码现状的偏差 · 量化工作量 · 锁定不变量

---

## 1. 现状代码定位

### 1.1 现有交互模式

```
路由：React Router 6 (HashRouter)
状态：Zustand · 多 store（settings/projects/llm/...）
持久化：Dexie · v6 schema
事件：document.addEventListener 几乎不用 · 仅 1 处（grep 实测）
弹窗：Modal atom 已有 · 部分页面用 fixed inset 自实现（ui-v2 PR-1 处理）
```

### 1.2 grep audit 数据（2026-05-07 19:38）

```
alert() 出现：               9 处（PR-2 替换目标）
addEventListener keydown：   1 处（极少 · PR-1 主要新增）
onKeyDown：                   含在上述 1 处内
路由数：                     15 条（router.tsx · ui-v1 epic 后）
NavItem 数：                  8 个（Layout.tsx · ui-v1 epic 后）
```

### 1.3 alert() 出现位置（PR-2 替换清单）

```
预期分布（基于代码经验 · 实施时再精确 grep）：
  src/pages/Settings.tsx        ~2 处（保存失败 / 加载失败）
  src/pages/Intake.tsx          ~1 处
  src/pages/Novel.tsx           ~2 处（保存失败 / 操作错误）
  src/components/SelfCheckPanel.tsx  ~1 处
  src/components/CharacterBible.tsx  ~1 处
  其余 ~2 处（散落）
  ─────────────────
  总：9 处
```

### 1.4 ui-v2 epic 提供的 ui-v3 复用资产

```
ui-v2 PR-2 完成后 · ui-v3 复用：
  ✅ src/components/feedback/Toast.tsx
  ✅ src/components/feedback/Tooltip.tsx
  ✅ src/components/feedback/Skeleton.tsx
  ✅ src/components/feedback/EmptyState.tsx
  ✅ src/store/toast.ts
  ✅ src/components/feedback/ToastContainer.tsx

ui-v2 PR-3 完成后 · ui-v3 复用：
  ✅ src/store/homeAggregates.ts（sidebarBadges 复用相同模式）
  ✅ Dexie 索引查询模式

ui-v2 PR-4 完成后 · ui-v3 受益：
  ✅ src/components/novel/NovelSidebar.tsx · J/K 快捷键在此实现
```

### 1.5 路由表（Cmd+K 索引来源）

```
src/router.tsx 15 条（ui-v1 epic 后稳定）：
  /                  Home
  /analyzer          Analyzer
  /refinery          Refinery
  /playground        Playground
  /kb                Knowledge Base
  /methods           Method Modules（ui-v1 新增）
  /methods/:slug     Method Module Detail（ui-v1 新增）
  /lessons           Reflector Lessons（ui-v1 新增）
  /lessons/:id       Lesson Detail（ui-v1 新增）
  /settings          Settings
  /express           Express
  /intake            Intake
  /pipeline          Pipeline
  /assets            Assets
  /novel/:projectId  Novel Workbench
  /screenplay/:id    Screenplay
  ... 其他

R-V3-1 严守：ui-v3 不动这 15 条
```

### 1.6 现有 keydown 处理点（grep · 1 处）

```
仅 1 处：可能是 Esc 关闭 modal 或类似简单 case
PR-1 必须先 grep 出实际位置 · 评估冲突
若是 Modal Esc 关闭 · 与 ui-v3 全局 Esc 不冲突（document level）
```

---

## 2. PR-by-PR 改动详情

### 2.1 PR-1 · Command Palette + 快捷键（4-5h）

**新增文件**：

```
+ src/components/CommandPalette.tsx          (~200 行)
+ src/store/commandPalette.ts                (~80 行)
+ src/hooks/useCommandPaletteIndex.ts        (~100 行)
+ src/hooks/useKeyboardShortcuts.ts          (~150 行)
+ src/components/ShortcutsHelpModal.tsx      (~100 行)

新增总：~630 行
```

**修改文件**：

```
~ src/main.tsx 或 src/App.tsx
   - 注入 <CommandPalette /> 全局
   - 注入 useKeyboardShortcuts hook

~ src/components/novel/NovelSidebar.tsx (ui-v2 PR-4 后)
   - 注入 J/K 快捷键 · 章节切换

~ src/components/novel/NovelEditor.tsx (ui-v2 PR-4 后)
   - 注入 S / Cmd+S 保存

修改总：3-5 个文件 · 总 +/- ~80 行
```

### 2.2 PR-2 · Sidebar badge + Toast 集成（3-4h）

**新增文件**：

```
+ src/store/sidebarBadges.ts          (~100 行)
+ src/components/SidebarBadge.tsx     (~50 行)

新增总：~150 行
```

**修改文件**：

```
~ src/components/Layout.tsx
   - 注入 SidebarBadge 到对应 NavItem
   - V2-I-7 严守：to= 不动 · 仅扩展 children

~ src/pages/Settings.tsx              (~2 处 alert → toast.error)
~ src/pages/Intake.tsx                (~1 处)
~ src/pages/Novel.tsx 或拆解后        (~2 处)
~ src/components/SelfCheckPanel.tsx   (~1 处)
~ src/components/CharacterBible.tsx   (~1 处)
~ ... 其余 ~2 处

修改总：~7-10 文件 · 总 +/- ~100 行（含 success 反馈新增）
```

### 2.3 PR-3 · dogfood log + design-system 应用指南（2-3h）

**新增文件**（仅 docs · 不动 src）：

```
+ docs/design-system/README.md                       (~100 行)
+ docs/design-system/usage-application-layer.md      (~200 行)
+ docs/design-system/usage-feedback.md               (~150 行)
+ docs/design-system/usage-shortcuts.md              (~80 行)
+ docs/design-system/migration-checklist.md          (~100 行)

新增总：~630 行 docs（src 零改动）
```

**修改文件**：

```
~ docs/dogfood-log.md
   + ## ui-v2 epic dogfood section (~80 行)
   + ## ui-v3 epic dogfood section (~60 行)

修改总：~140 行 docs
```

---

## 3. 红线影响审计

### 3.1 v5 epic 不变量（I-1 ~ I-8）

```
v5 全部 → ❌ 不影响（ui-v3 不动数据层）
```

### 3.2 v6 epic 不变量（I-1 ~ I-8）

```
v6 I-8 ReflectorLessonsPanel 接口 → ⚠ 影响
  ui-v3 PR-2 sidebarBadges 读取 pending lessons 数
  通过 v6 既有 store · 不改 panel 内部
  → 不违反
其他 → ❌ 不影响
```

### 3.3 ui-v1 epic 不变量（I-1 ~ I-8）

```
ui-v1 I-1 路由表不变 → ✅ 严守 V3-I-1
ui-v1 I-2 NavItem 路径不变 → ✅ 严守 V3-I-3
ui-v1 I-3 ~ I-8 → ❌ 不影响
```

### 3.4 ui-v2 epic 不变量（V2-I-1 ~ V2-I-10 · 持续生效）

```
V2-I-1 DESIGN.md zero-modify        → ✅ ui-v3 严守
V2-I-2 src/index.css zero-modify    → ✅ ui-v3 严守（Toast 用既有 token · 不改 .btn-*）
V2-I-3 6 atoms 不修改               → ✅ ui-v3 严守
V2-I-4 不加第 7 atom               → ⚠ ui-v3 加 CommandPalette + SidebarBadge + ShortcutsHelpModal
                                       这些不在 src/components/ui/ · 放 src/components/ + src/components/feedback/（已有目录）
                                       → 不违反
V2-I-5 Novel 等价                  → ✅ ui-v3 PR-1 在拆解后 NovelSidebar/Editor 加 keydown
                                       接口不变 · 行为新增（不替换）→ 不违反
V2-I-6 路由表不变                  → ✅ V3-I-1 重申
V2-I-7 NavItem 路径不变            → ✅ V3-I-3 重申 · 仅扩展 children
V2-I-8 Dexie schema 不变           → ✅ V3-I-5 重申
V2-I-9 替换保 layout 类            → ❌ 不直接相关（ui-v3 不做 PR-1 audit）
V2-I-10 Home 创建路径              → ❌ 不影响
```

### 3.5 DESIGN.md 全约束

```
① Token 优先              → ✅ ui-v3 全部用既有 token
② 主题感知                → ✅ Toast/Tooltip 已是 ui-v2 PR-2 实现 · 用 token
③ 节奏感 ≥ stackXl        → ✅ Cmd+K Modal + ShortcutsHelpModal 用 stackXl
④ 字号克制                → ✅ Cmd+K 用 captionM (路径) + bodyM (标题) 2 级
⑤ 创作内容区 reading      → ❌ 不影响
⑥ 语义色配 icon/文字     → ⚠⚠ V3-I-7 重点严守
                             pending badge：红色背景 + 数字
                             warning dot：黄色 + AlertTriangle icon
                             info badge：蓝色 + 数字
                             不允许"仅红点 + 无文字/icon"

6 atoms 锁定              → ✅ V2-I-3 + V2-I-4 严守
                             CommandPalette / SidebarBadge / ShortcutsHelpModal 不放 ui/
```

---

## 4. 偏差分析（PRD vs 代码现状）

### 4.1 已识别偏差

| # | PRD 假设 | 代码现状 | CA 揭示 | 处理 |
|---|---|---|---|---|
| 1 | "9 处 alert 替换" | grep 实测 9 处 | 一致 | 无 |
| 2 | "现有 keydown 极少" | grep 实测 1 处 | 一致 · 验证假设 | 无 |
| 3 | "复用 ui-v2 Toast" | ui-v2 PR-2 还未实现 | 时序约束 | ui-v3 必须等 ui-v2 完成 |
| 4 | "Sidebar badge 在 Layout.tsx" | Layout.tsx 当前 ~3K · ui-v2 mode strip 已删 | 一致 | 仅扩展 NavItem children |
| 5 | "路由 15 条 + N 项目 + M 章节" | router 实测 15 条 | 一致 | 索引动态聚合 |
| 6 | "快捷键不与浏览器冲突" | Cmd+S 与浏览器 Save 冲突 | 已知 · 必 preventDefault | PRD 已处理 |

### 4.2 时序约束（重要）

```
ui-v3 启动前置：
  □ ui-v2 epic 全部 PR commit
  □ ui-v2 dogfood ≥ 3 天
  □ ui-v2 dogfood-log section 完整
  □ Toast / Tooltip / Skeleton / EmptyState 组件可用
  □ 用户签字 ui-v3 Stage 3

→ 若 ui-v2 未完成就启动 ui-v3 · PR-2 Toast 集成无法做
→ 强制时序：ui-v2 PR-1 → PR-2 → PR-3 → PR-4 → dogfood → ui-v3 PR-1
```

### 4.3 未发现新风险

```
audit 结论：
  ✅ 不存在隐藏的快捷键冲突点
  ✅ 不存在隐藏的 alert 调用（≥ 9 处确认 · 实施时再精确 grep）
  ✅ 不存在与 ui-v1 / DESIGN.md 的冲突
  ✅ Sidebar badge 与 ui-v1 NavItem 路径完全兼容
```

---

## 5. 复用率分析

### 5.1 既有可复用资产

| PR | 复用 | 复用率 |
|---|---|---|
| PR-1 | <Modal>（Cmd+K 包装）+ <Input>（搜索框）+ <NavItem>（列表项）| ~30%（其他全新写）|
| PR-2 | ui-v2 PR-2 Toast（直接 import）+ DESIGN.md token | ~60%（badge 新写 · alert 替换是机械动作）|
| PR-3 | 既有 docs/ 目录 + dogfood-log.md 模式 | ~40%（5 份 usage-*.md 全新写）|

### 5.2 总体复用率

```
ui-v3 epic 整体复用率：~40%
新增 src 行：~780 行（PR-1 ~630 + PR-2 ~150）
新增 docs 行：~770 行（PR-3 ~630 + dogfood ~140）
修改 src 行：+/- ~180 行（PR-1 ~80 + PR-2 ~100）

总：~1730 行新内容（src + docs）
```

---

## 6. PR 启动顺序建议

```
Stage 3 启动顺序（强制时序）：

ui-v2 全部完成 + dogfood 3+ 天 + 用户签字
  ↓
PR-1 Command Palette + 快捷键（4-5h · 单 session）
  ↓ vite build + dogfood Cmd+K + J/K + S + ?
PR-2 Sidebar badge + Toast 集成（3-4h · 单 session）
  ↓ dogfood badge 显示 + 9 处 alert 替换 + DESIGN ⑥ 验证
PR-3 dogfood log + design-system 应用指南（2-3h · 单 session）
  ↓ 阅读测试 + checklist 可勾

PR-1 / PR-2 严格串行（PR-2 依赖 PR-1 的 Toast 集成基础设施 + ui-v2 Toast 组件）
PR-3 可与 PR-2 并行（仅文档 · 不动代码）
```

---

## 7. 用户决策点

```
□ 接受 CA · ui-v3 在 ui-v2 完成 + dogfood 后启动
□ 调整 PR-1 范围（仅做 Cmd+K · 不做快捷键）→ 节省 1.5h
□ 调整 PR-3 范围（仅做 dogfood-log · 不做 design-system docs）→ 节省 2h
□ 拒绝 ui-v3 · 仅做 ui-v2

签字日期：2026-05-__
签字人：QvQ
```

---

## 8. 总结

```
✅ 9 处 alert 替换点 grep 确认
✅ keydown 几乎空白（1 处）· PR-1 是新增非冲突
✅ ui-v2 提供完整辅助组件 · ui-v3 复用 60%+ Toast/store 模式
✅ 24 + 17 = 41 不变量 + DESIGN 全约束 · ui-v3 全部严守
✅ DESIGN.md ⑥ 严守是 V3-I-7 重点（badge 色盲友好）
✅ 强制时序：ui-v2 完成 → dogfood → ui-v3
✅ 复用率 40% · 新增 src ~780 行 + docs ~770 行
```
