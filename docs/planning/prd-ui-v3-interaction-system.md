# PRD · ui-v3 epic · 交互系统增强（Command Palette + 快捷键 + Sidebar badge + Toast 集成 + design-system 应用指南）

> **BMAD Stage 2 · PRD 文档**
> 提议日期：2026-05-07 19:40
> Epic ID：`ui-v3-interaction-system`
> 上游：`docs/planning/preflight-ui-v2-v3-visual-ux-overhaul.md`（v2 修正版 · commit 3a1cd5b）
> 工作量预估：**~10-12h**
> 状态：⏳ 等待用户 Stage 2 签字
> 启动前置：**ui-v2 epic 完成 + dogfood ≥ 3 天**（PR-2 复用 ui-v2 Toast / PR-2 接 ui-v2 homeAggregates）
> 同期生效不变量：v5 8 + v6 8 + ui-v1 8 + DESIGN.md 全约束 + V2-I-1 ~ V2-I-10（持续）+ V3-I-1 ~ V3-I-7 = 38+ 条

---

## 1. 用户故事（User Stories）

### US-1 · 全局快速跳转
```
作为用户，
我希望按 Cmd+K（或 Ctrl+K）打开命令面板，
模糊搜索任意路由 / 项目 / 章节 / lesson / method module，
直接跳转 · 不需要点击多层菜单。

验收：
  ✅ Cmd+K / Ctrl+K 全局触发（按 OS 自适应）
  ✅ 索引：15 路由 + N 项目 + M 章节 + lessons + method modules
  ✅ 模糊搜索响应 < 50ms
  ✅ 显示 recent 历史（最近 5 个跳转）
  ✅ Esc 关闭 · Enter 确认
```

### US-2 · 键盘提速
```
作为重度用户（QvQ），
我希望用键盘快捷键执行常见操作：
J/K 上下章节切换 · / focus search · S 保存 · ? 显示快捷键手册
以减少鼠标依赖、提升写作专注度。

验收：
  ✅ Novel 页面 J/K 章节切换无回归
  ✅ 全局 / 按键 focus 当前页搜索框（若有）
  ✅ Novel 页 S 触发保存（与 Cmd+S 双绑）
  ✅ ? 显示快捷键手册 modal
  ✅ 不与浏览器原生冲突（避开 Ctrl+W/T/N/R）
  ✅ Modal / input focus 时自动禁用全局快捷键（避免冲突）
```

### US-3 · 状态可见性
```
作为用户，
我希望 sidebar 直接显示状态：
- pending lessons 数（红色 badge）
- unread artifacts 数（蓝色 badge）
- API key 警告（黄色 dot · 未配时）
不需要进入子页才知道有事要处理。

验收：
  ✅ sidebar NavItem 右侧显示数字 badge（≥1 时）
  ✅ ≥ 10 显示 "9+"（避免占太宽）
  ✅ 点击跳转对应页 · badge 立即更新
  ✅ DESIGN.md ⑥规则严守：badge 必须配 icon 或文字 · 不只靠颜色
```

### US-4 · 反馈一致性
```
作为用户，
我希望操作反馈统一：
- 成功：绿色 Toast（"已保存"等）· 自动 3s 消失
- 失败：红色 Toast（不自动消失 · 手动关）+ console.error
- 警告：橙色 Toast
不希望某些地方 alert · 某些地方 inline error · 某些地方静默。

验收：
  ✅ 9 处 alert() 全部替换为 toast.error / toast.warning
  ✅ 关键操作（保存 / 删除 / 完成）加 toast.success 反馈
  ✅ console.error 保留（不静默吞错）
  ✅ Toast 使用 ui-v2 PR-2 既定组件 · 不重写
```

### US-5 · design system 应用指南
```
作为开发者（QvQ + 未来贡献者），
我希望有一份"裸 className → 6 atoms 替换"指南，
当看到 Button.tsx 注释 "Phase 4 重做页面时按需替换" 时知道怎么做。

验收：
  ✅ docs/design-system/ 目录创建
  ✅ usage-application-layer.md（PR-1 替换范例 + 反例）
  ✅ usage-feedback.md（Toast/Tooltip/Skeleton 用法）
  ✅ usage-shortcuts.md（Cmd+K + 快捷键手册）
  ✅ migration-checklist.md（裸 className → 6 atoms 检查表）
```

---

## 2. 设计方案

### 2.1 PR 拆分（3 PR）

```
PR-1 · Command Palette + 快捷键系统（4-5h）
PR-2 · Sidebar status badge + Toast 全站集成（3-4h）
PR-3 · dogfood log + design-system 应用指南（2-3h）

总：9-12h（含 buffer · 实际 10-12h）
```

### 2.2 PR-1 详细方案：Command Palette + 快捷键

#### Command Palette

**新增组件**：

```
+ src/components/CommandPalette.tsx (~200 行)
+ src/store/commandPalette.ts (~80 行 · zustand · open / recent / index)
+ src/hooks/useCommandPaletteIndex.ts (~100 行 · 聚合索引)
```

**触发**：
```
Cmd+K (macOS) / Ctrl+K (Windows/Linux) · 全局
Esc · 关闭
```

**索引内容**（动态聚合）：
```
1. 路由（静态 15 条）：
   "首页 /"、"分析师 /analyzer"、"精炼 /refinery"、...
   "方法库 /methods"、"反馈课程 /lessons"、"设置 /settings"

2. 项目（Dexie 查询）：
   "项目：[名称]" → 跳转 Novel/Pipeline/Screenplay 模式选择
   按 lastAccessAt 排序

3. 章节（当前项目）：
   "章节：第 N 章 [标题]" → 跳转 Novel/?ch=N
   仅当当前在 Novel 页时显示

4. Lessons（pending）：
   "课程：[lesson title]" → 跳转 /lessons/[id]

5. Method Modules：
   "模组：[module name]" → 跳转 /methods/[slug]

6. 动作（commands）：
   "新建项目"、"切换主题"、"打开设置"、"显示快捷键手册"

最大显示 50 条 · 模糊搜索匹配排序
```

**风格**（DESIGN.md 复用）：
```
- 用 <Modal size="lg"> 包装（既有 atom）
- 顶部 <Input> 搜索框
- 列表项用 NavItem 风格（既有 atom）
- elevation: floating
- 圆角 16px (DESIGN.md modal)
- 入场：translate-y + opacity transition 200ms
```

**搜索算法**：
```
- 自研模糊搜索（不引 fuse.js · 减依赖）
- 算法：subsequence match · 高亮匹配字符
- 分组显示：路由 / 项目 / 章节 / lessons / 模组 / 动作
- recent 历史持久化到 localStorage（最近 10 条）
```

#### 键盘快捷键

**新增组件**：
```
+ src/hooks/useKeyboardShortcuts.ts (~150 行)
+ src/components/ShortcutsHelpModal.tsx (~100 行 · ? 触发)
```

**全局快捷键**：
```
Cmd+K / Ctrl+K  · 打开 Command Palette
?              · 显示快捷键手册（仅在无 input focus 时）
Esc            · 关闭 modal / palette / drawer
```

**Novel 页快捷键**：
```
J          · 下一章节
K          · 上一章节
Cmd+S      · 保存（与浏览器 Save Page 冲突 · 必须 preventDefault）
S          · 保存（仅在无 input focus 时）
```

**实现细节**：
```
- 监听 document keydown
- 检测 e.target 是否在 input/textarea/contenteditable 内
  · 若是 · 仅响应 modifier key 组合（Cmd+K / Cmd+S）
  · 若否 · 响应所有快捷键
- Modal / Palette open 时禁用全局（除 Esc）
- 快捷键手册 ? 显示分组列表 + 各键作用
```

### 2.3 PR-2 详细方案：Sidebar badge + Toast 集成

#### Sidebar status badge

**新增组件**：
```
+ src/store/sidebarBadges.ts (~100 行 · 聚合 unread / pending / warning)
+ src/components/SidebarBadge.tsx (~50 行)
```

**修改 Layout.tsx**（V2-I-7 严守 NavItem 路径不动 · 仅扩展 children）：
```tsx
<NavItem to="/lessons">
  <BookOpen className="size-4" />
  反馈课程
  {pendingLessons > 0 && (
    <SidebarBadge variant="danger" count={pendingLessons} />
  )}
</NavItem>
```

**Badge 设计**（DESIGN.md ⑥严守）：
```
- 用 token semantic.danger / warning / info（不裸色）
- 配 icon 或文字 · 不只靠颜色（色盲友好）
  · pending: 红色背景 + 数字（数字本身是文字）
  · warning: 黄色背景 + AlertTriangle icon
  · info: 蓝色背景 + 数字
- ≥ 10 显示 "9+"
- 圆角 full（DESIGN.md badge full）
- 字号 captionM（11px）
```

**badge 类型**：
```
1. /lessons 路径 · pending lessons 数（v6 epic ReflectorLessonsPanel.tsx 计算）
2. /settings 路径 · API key 未配警告（仅 warning dot · 无数字）
3. /methods 路径 · 新增 module 数（v7+ 可选 · 此 epic 不做）
```

#### Toast 全站集成

**接 ui-v2 PR-2 既有 Toast**：
```
import { useToast } from '@/components/feedback';

const toast = useToast();

// 替换 9 处 alert
- alert('保存失败');
+ toast.error('保存失败');
+ console.error('save failed', err);  // 必须保留

// 加 success 反馈
+ toast.success('已保存', { duration: 3000 });
```

**替换清单**（grep 结果 9 处 · CA 详列）：
```
~ src/pages/Settings.tsx          (~2 处 alert)
~ src/pages/Intake.tsx            (~1 处)
~ src/pages/Novel.tsx             (~2 处 · 需在 ui-v2 PR-4 后做)
~ src/components/SelfCheckPanel.tsx (~1 处)
~ src/components/CharacterBible.tsx (~1 处)
~ ... 剩余 ~2 处
```

**新增 success 反馈点**（estimated 10-15 处）：
```
+ 项目创建成功
+ 章节保存成功
+ N3.1 / N3.2 / N3.3 完成
+ 设置保存成功
+ Lesson 接受 / 拒绝
+ ... 等
```

### 2.4 PR-3 详细方案：dogfood log + design-system 应用指南

#### docs/design-system/ 目录

**新增文档**（不动 src · 仅 docs）：

```
+ docs/design-system/README.md (~100 行 · 总览 + 索引)
+ docs/design-system/usage-application-layer.md (~200 行)
   - 裸 className → 6 atoms 替换范例
   - 错例：误改 layout 类
   - 错例：variant 误判（一页面 ≥ 2 个 primary）
   - 决策树：button 何时改 link

+ docs/design-system/usage-feedback.md (~150 行)
   - Toast 4 类型 + 触发场景
   - Tooltip 4 方向 + a11y
   - Skeleton 3 variants + 何时用
   - EmptyState 用法

+ docs/design-system/usage-shortcuts.md (~80 行)
   - Cmd+K Command Palette 操作
   - 全局 / Novel 快捷键列表
   - 与浏览器冲突表
   - Modal/input focus 时禁用规则

+ docs/design-system/migration-checklist.md (~100 行)
   - 裸 className → 6 atoms 检查表（可勾）
   - 哪些类是 layout（保留）哪些是 design（替换）
   - PR-1 audit 流程
```

#### dogfood-log 增量

```
~ docs/dogfood-log.md
   + ## ui-v2 epic dogfood section
     · PR-1 应用层 audit dogfood
     · PR-2 辅助组件 dogfood
     · PR-3 Home dashboard dogfood
     · PR-4 Novel.tsx 拆解 dogfood
     · 累积 ledger（24 + 17 = 41 不变量审计）
   + ## ui-v3 epic dogfood section
     · PR-1 Command Palette + 快捷键 dogfood
     · PR-2 Sidebar badge + Toast 集成 dogfood
     · 累积 ledger（41 + 7 = 48 不变量审计）
```

---

## 3. 数据流（无变化）

```
ui-v3 不动数据层：
  ✅ Dexie schema 不动（V2-I-8 持续 · V3-I-5 重申）
  ✅ zustand store 接口不动（仅新增 commandPalette + sidebarBadges）
  ✅ LLM 调用不动
  ✅ pipeline 不动
  ✅ 路由表不动（Cmd+K 仅是 navigation shortcut · V3-I-1）
```

---

## 4. 性能考虑

| 项 | 目标 | 措施 |
|---|---|---|
| Cmd+K 响应 | < 50ms | 索引懒加载 + useMemo |
| 快捷键响应 | < 16ms | document.addEventListener · 单实例 |
| Sidebar badge | < 100ms | useMemo + Dexie count() · 不取数据 |
| Toast 渲染 | < 16ms | React.memo + key by id |
| Command Palette 索引 | 限 50 条 | 模糊搜索后 truncate |

---

## 5. 错误处理

```
Cmd+K 失败：
  ✅ 索引为空时显示 EmptyState（"没有可搜索内容"）
  ✅ Dexie 查询失败 fallback 到仅静态路由

快捷键失败：
  ✅ 浏览器原生冲突时 e.preventDefault()（如 Cmd+S）
  ✅ Modal/input focus 检测失败时静默不响应（不报错）

Sidebar badge 失败：
  ✅ Dexie 查询失败 silently（不显示 badge）
  ✅ console.error 保留

Toast 集成：
  ✅ 9 处 alert 替换都加 console.error
  ✅ 不静默吞错
```

---

## 6. 兼容性

| 维度 | 兼容性 | 说明 |
|---|:---:|---|
| 浏览器 | ✅ | 与 ui-v2 持平（Chrome 90+ / Firefox 88+ / Safari 14+）|
| 旧路由 | ✅ | URL 不变 · Cmd+K 仅是 shortcut |
| 旧用户数据 | ✅ | localStorage / IndexedDB 完全不动 |
| ui-v2 epic | ✅ | 复用 Toast / Skeleton / EmptyState · 接口稳定 |
| Cmd+S 浏览器原生 | ✅ | preventDefault 不打断 |

---

## 7. 测试策略

```
PR-1 · Command Palette + 快捷键：
  ✅ Cmd+K + Ctrl+K 双绑测试（macOS / Windows）
  ✅ 索引完整性（路由 / 项目 / 章节 / lesson / module）
  ✅ 模糊搜索准确性（"sett" → "settings"）
  ✅ recent 历史持久化（refresh 后保留）
  ✅ 快捷键不与浏览器冲突（Cmd+S preventDefault）
  ✅ Modal/input focus 时全局快捷键禁用
  ✅ ? 显示快捷键手册

PR-2 · Sidebar badge + Toast 集成：
  ✅ pending lessons 数 badge 显示 + 点击后清零
  ✅ ≥ 10 显示 "9+"
  ✅ DESIGN.md ⑥规则严守（color + icon/text）
  ✅ 9 处 alert 全部替换为 toast
  ✅ console.error 全部保留
  ✅ success 反馈 10-15 处覆盖

PR-3 · docs：
  ✅ docs/design-system/ 目录创建
  ✅ 4 份 usage-*.md 内容完整
  ✅ migration-checklist 可勾选
  ✅ dogfood-log section 累积 ledger 准确
```

---

## 8. 风险评估

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| 1 | Cmd+K 与浏览器原生冲突 | 🟡 mid | preventDefault + 测试主流浏览器 |
| 2 | 快捷键 Modal focus 检测错误 | 🟡 mid | 手测 · 边界 case 列出 |
| 3 | Sidebar badge 性能差（每次 render 查 Dexie）| 🟡 mid | useMemo + 节流（500ms 节流）|
| 4 | Toast 替换破坏 alert 阻塞行为 | 🟠 high | 逐处审 · 若需阻塞用 Modal |
| 5 | DESIGN.md ⑥ 违反（badge 仅靠颜色）| 🟠 high | code review 红线 + V3-I-7 严守 |
| 6 | recent 历史 localStorage 跨设备同步 | 🟢 low | 不解决（单设备体验已足）|
| 7 | 工作量超估 | 🟢 low | 已含 25% buffer |

---

## 9. dogfood 验证计划

```
PR-1 完成后 dogfood：
  □ Cmd+K 全局触发 · 索引 ≥ 30 条（路由 + 项目 + lessons + modules）
  □ 模糊搜索"sett" → 高亮 "Settings" 第一位
  □ Esc 关闭 · Enter 跳转
  □ recent 历史 refresh 后保留
  □ J/K 章节切换在 Novel 页正常
  □ S / Cmd+S 保存正常
  □ ? 快捷键手册显示
  □ Modal/input focus 时全局快捷键禁用

PR-2 完成后 dogfood：
  □ pending lessons 数 badge 显示
  □ 点击 /lessons 后 pending 减少 · badge 立即更新
  □ API key 未配时 /settings dot 显示
  □ DESIGN.md ⑥规则手测：色盲模式下仍可识别 badge 类型
  □ 9 处 alert 全部 toast 化（grep 验证 alert() 计数 == 0）
  □ success 反馈在保存 / 删除 / 完成处显示

PR-3 完成后 dogfood：
  □ docs/design-system/ 4 份 usage-*.md 阅读测试
  □ migration-checklist 可勾选（markdown 渲染正确）
  □ dogfood-log ui-v2 / ui-v3 section 累积 ledger 准确
```

---

## 10. 跨 epic 依赖

```
依赖（ui-v3 之前完成）：
  ✅ ui-v2 epic（必须先完成）
     - PR-2 提供 Toast 组件（ui-v3 PR-2 直接 import）
     - PR-3 提供 homeAggregates store（ui-v3 PR-2 sidebarBadges 复用同模式）
     - PR-4 拆解 Novel.tsx（ui-v3 PR-1 J/K 快捷键在 NovelSidebar 实现更易）
  ✅ ui-v1 epic（已完成 · /methods + /lessons 路由是 Cmd+K 索引来源）
  ✅ DESIGN.md（已存在 · 复用 token + 6 atoms）

被依赖（ui-v3 完成后）：
  ⏳ 未来 ACE epic 可在 Cmd+K 加"Curator: ..."动作
  ⏳ 未来 v7+ epic 可在 sidebar 加 reader counter badge
  ⏳ design-vN epic（如未来）可基于 docs/design-system/ 扩展
```

---

## 11. 用户签字栏

```
□ Stage 2 PRD 接受 · 进入 CA + CK 起草后 ui-v3 实施
□ Stage 2 PRD 修改：[修改点]
□ Stage 2 PRD 拒绝 · 不启动 ui-v3 epic

签字日期：2026-05-__
签字人：QvQ
```

### 11.1 签字后行动

```
立即（本 session 或下次）：
  1. 起草 docs/planning/codebase-analysis-ui-v3.md（~250 行）
  2. 起草 docs/planning/code-knowledge-ui-v3.md（~250 行 · 7 不变量）
  3. 用户签字后等 ui-v2 完成 + dogfood ≥ 3 天 · 才启动 ui-v3 PR-1

PR 启动前置：
  - ui-v2 PR-1 ~ PR-4 全部 commit
  - ui-v2 dogfood-log section 完整
  - 用户签字 ui-v3 Stage 3
```

---

## 12. 与 ui-v2 epic 的关系

```
共同动机：用户原诉求"视觉简陋 + 操作简陋"
分工：
  ui-v2 = 应用层贯彻 + 信息架构（治"视觉简陋"）
  ui-v3 = 交互系统增强（治"操作简陋"）

时间序：
  ui-v2 → dogfood 3+ 天 → 用户主观验证 → ui-v3 启动
  （避免连续大改造同时进 dogfood · 用户脑负荷过大）

复用：
  ui-v3 PR-2 复用 ui-v2 PR-2 的 Toast 组件
  ui-v3 PR-2 复用 ui-v2 PR-3 的 store 模式（sidebarBadges 类比 homeAggregates）
  ui-v3 PR-1 受益于 ui-v2 PR-4（Novel.tsx 拆解后 J/K 快捷键更易实现）

不变量传递：
  V2-I-1 ~ V2-I-10 在 ui-v3 期间持续生效
  V3-I-1 ~ V3-I-7 与 V2-I-* 不冲突 · 累积保护
```
