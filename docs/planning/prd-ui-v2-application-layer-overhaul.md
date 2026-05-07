# PRD · ui-v2 epic · 应用层贯彻 + 信息架构升级

> **BMAD Stage 2 · PRD 文档**
> 提议日期：2026-05-07 19:15
> 提议者：Cascade
> Epic ID：`ui-v2-application-layer-overhaul`
> 上游文档：`docs/planning/preflight-ui-v2-v3-visual-ux-overhaul.md`（v2 修正版 · commit 3a1cd5b）
> 工作量预估：**~11-14h**（v2 preflight 估 10-12h · CA audit 后上调 +1-2h）
> 状态：⏳ 等待用户 Stage 2 签字
> 同期生效不变量：v5 8 + v6 8 + ui-v1 8 + DESIGN.md 全约束 + V2-I-1 ~ V2-I-10 = 31+ 条

---

## 1. 用户故事（User Stories）

### US-1 · 视觉一致性（核心动机）
```
作为用户，
我希望全站按钮 / 输入框 / 模态视觉一致，
不希望某些页面用 6 atoms 风格、另一些页面用裸 className 风格，
以减少视觉跳跃感、提升专业度。

验收：
  ✅ vite build 后全站走查 · 无明显风格断裂
  ✅ Top 6 页面（Screenplay/Intake/Assets/Novel/Pipeline/SelfCheck）button 风格统一
  ✅ DESIGN.md ① "Token 优先 · 永不写裸值" 在新代码中 100% 贯彻
```

### US-2 · 反馈及时性
```
作为用户，
我希望保存 / 删除 / 完成等操作有 Toast 反馈，
错误用红色 Toast 替代生硬的 alert(),
loading 用 Skeleton 替代干瘪的 spinner,
以减少操作焦虑。

验收：
  ✅ 5-10 处 alert / inline error 替换为 Toast
  ✅ /methods + /lessons 列表加载用 Skeleton
  ✅ 关键 button hover 显示 Tooltip 说明
```

### US-3 · Home 信息聚合
```
作为用户，
我希望打开 fili-web 第一眼看到 dashboard：
最近写了什么 / 还有什么待办 / 项目进度如何 / 推荐做什么，
而不是干巴巴的项目列表。

验收：
  ✅ Home 页加载后 · 看到 5 个区块（Hero / 最近活动 / 进度热图 / 待办 / 推荐）
  ✅ 项目创建/选择路径仍可达（Hero 区或独立按钮）
  ✅ 数据聚合 < 200ms（useMemo + Dexie 索引）
```

### US-4 · Novel.tsx 可维护性
```
作为开发者（QvQ），
我希望 Novel.tsx 不再是 89K 单文件，
拆为多个 < 400 行的组件，
以降低后续维护成本（v7+ epic 的 readerLayer counter 也要在这里改）。

验收：
  ✅ 拆解后无单文件 > 400 行
  ✅ 所有现有功能行为完全等价
  ✅ 内嵌 panel（CharacterBible / MethodModulePanel / ReflectorLessonsPanel）路径保留
  ✅ vite build 0 errors · 手测无回归
```

---

## 2. 设计方案

### 2.1 PR 拆分（4 PR）

```
PR-1 · 应用层 audit + 替换裸 className → 6 atoms（5-6h · 重 audit）
PR-2 · 辅助组件补全（Toast/Tooltip/Skeleton/EmptyState · 2-3h）
PR-3 · Home dashboard 重构（3-4h）
PR-4 · Novel.tsx 拆解（3-4h · 风险最高）

总：13-17h（含 buffer · 实际 11-14h）
```

### 2.2 PR-1 详细方案：应用层 audit

**audit 范围**：基于 CA 阶段 grep 数据

| 文件 | button | input | textarea | overlay | 优先级 |
|---|:---:|:---:|:---:|:---:|---|
| `Screenplay.tsx` | 19 | 1 | 0 | 1 | P0（最大）|
| `Intake.tsx` | 15 | 4 | 0 | 0 | P0 |
| `Assets.tsx` | 10 | 2 | 0 | 1 | P1 |
| `Novel.tsx` | 10 | 1 | 0 | 0 | P1（PR-4 拆时再做）|
| `Pipeline.tsx` | 8 | 0 | 0 | 0 | P1 |
| `SelfCheckPanel.tsx` | 7 | 0 | 0 | 0 | P2 |
| `ScreenplayDoctorPanel.tsx` | 7 | 0 | 0 | 0 | P2 |
| 其余 9 个文件 | 21 | 10 | 2 | 8 | P2 |

**替换映射规则**（DESIGN.md 锁定）：

```
裸 <button className="..."> 替换决策树：
  - 主 CTA（primary action） → <Button variant="primary">
  - 副 CTA（cancel / 次要）  → <Button variant="secondary">
  - 危险操作（删除 / 取消）  → <Button variant="danger">
  - 表格/列表内次要操作      → <Button variant="ghost">
  - icon-only 单图标按钮     → <Button iconOnly>
  - 无文字 + 无 icon         → 评估是否应改为 link

裸 <input className="..."> → <Input>（保留 type/value/onChange/placeholder）
裸 <textarea className="..."> → <Textarea>
fixed inset overlay 自实现 modal → <Modal>（保留 onClose/title/footer）
```

**例子**：
```tsx
// before
<button
  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
  onClick={save}
>
  保存
</button>

// after
<Button variant="primary" onClick={save}>保存</Button>
```

**audit 流程**（每文件）：
```
1. grep 当前文件 <button className=
2. 逐处分析当前 className 的 variant 意图
3. 替换为 <Button variant="..."> · 保留非 design 类（layout/responsive）
4. import { Button } from '../components/ui'（已有 import 跳过）
5. vite build 验证
6. 视觉手测（dev server）
```

### 2.3 PR-2 详细方案：辅助组件补全

**新增组件**（`src/components/feedback/`）：

#### `Toast.tsx` + `useToast.ts`
```tsx
// 用法
const toast = useToast();
toast.success('已保存', { duration: 3000 });
toast.error('保存失败：网络错误', { duration: 0 }); // 不自动消失

// 风格
- 用 DESIGN.md token：
  - success: bg.surface + border.success + text.primary + icon CheckCircle2
  - warning: bg.surface + border.warning + text.primary + icon AlertTriangle
  - danger:  bg.surface + border.danger  + text.primary + icon XCircle
  - info:    bg.surface + border.info    + text.primary + icon Info
- 位置：右下 fixed · max-width 360px · 圆角 12px (DESIGN.md card 12px)
- 入场：translate-x + opacity transition 200ms
- elevation: floating
```

#### `Tooltip.tsx`
```tsx
// 用法
<Tooltip content="保存当前章节 (Ctrl+S)">
  <Button iconOnly><Save /></Button>
</Tooltip>

// 风格
- 用 DESIGN.md token：bg.elevated + text.primary + captionM (12px)
- 触发：hover 500ms 延迟显示 · mouseleave 立即隐藏
- 位置：top（默认）· right · bottom · left 4 方向
- elevation: floating
```

#### `Skeleton.tsx`
```tsx
// 用法
<Skeleton variant="text" lines={3} />
<Skeleton variant="card" height={120} />
<Skeleton variant="circle" size={40} />

// 风格
- 用 DESIGN.md token：bg.elevated + animate-pulse
- 圆角与目标元素一致（text 4px / card 12px / circle full）
```

#### `EmptyState.tsx`
```tsx
// 用法
<EmptyState
  icon={<BookOpen className="size-12" />}
  title="还没有项目"
  description="创建第一个项目开始你的写作"
  action={<Button variant="primary">+ 新建项目</Button>}
/>

// 风格
- 用 DESIGN.md token：text.muted (icon) + headingS (title) + bodyM (desc)
- 居中 · padding stack3xl + inset2xl
- 用 DESIGN.md ① 节奏规则
```

**整合点**：

| 当前 | 替换为 | 文件 | 优先级 |
|---|---|---|---|
| `alert(...)` | `toast.error(...)` | 全仓 5-10 处 | P0 |
| inline 红色 div 错误 | `toast.error(...)` 或保留 | 全仓 ~5 处 | P1 |
| 列表 `<Loader2 spin />` | `<Skeleton variant="card" />` | /methods, /lessons | P1 |
| Empty 列表纯文字 | `<EmptyState />` | /methods, /lessons, Home | P1 |
| 关键 button 缺说明 | hover `<Tooltip>` | 5-10 处 | P2 |

### 2.4 PR-3 详细方案：Home dashboard

**当前 Home**：`src/pages/Home.tsx` 12K · 项目卡片列表 + 模式选择

**升级后 Home 结构**：

```
┌─────────────────────────────────────────────────┐
│ Hero Section                                    │
│  - 欢迎语：早上好/下午好/晚上好（按时段）        │
│  - 当前正在写的项目（最近一次访问 · 大卡片）     │
│  - 快捷动作：[继续写作] [+ 新项目] [打开命令栏]  │
├─────────────────────────────────────────────────┤
│ Recent Activity (最近活动 · 最近 7 天)          │
│  - artifact 操作时间线（写章节 / 跑 N3.x / etc.）│
│  - 点击跳转对应位置                              │
├─────────────────────────────────────────────────┤
│ Progress Heatmap (进度热图)                     │
│  - 所有项目章节完成度 grid（复用 ChapterCompletionGrid）│
├─────────────────────────────────────────────────┤
│ Todo List (待办)                                │
│  - pending lessons 数（点击跳 /lessons）         │
│  - 未配 API key（点击跳 /settings）              │
│  - 缺章节大纲的项目                              │
├─────────────────────────────────────────────────┤
│ Recommendations (推荐)                          │
│  - 基于使用频率推荐 3-5 个 method modules        │
│  - 点击跳 /methods                              │
└─────────────────────────────────────────────────┘
```

**新增文件**：

```
+ src/components/home/HeroSection.tsx (~120 行)
+ src/components/home/RecentActivity.tsx (~150 行)
+ src/components/home/ProgressHeatmap.tsx (~80 行 · 复用 ChapterCompletionGrid)
+ src/components/home/TodoList.tsx (~100 行)
+ src/components/home/Recommendations.tsx (~100 行)
+ src/store/homeAggregates.ts (~120 行 · Dexie 聚合查询)

~ src/pages/Home.tsx（12K → ~300 行 · 仅 layout）
```

**数据聚合策略**：
- `homeAggregates.ts` 用 Dexie `where().above(...)` 索引查询
- React `useMemo` 缓存聚合结果
- 目标：< 200ms 首屏渲染

### 2.5 PR-4 详细方案：Novel.tsx 拆解

**当前**：`src/pages/Novel.tsx` 89K · 单文件 · 已知技术债

**拆解后结构**（参考 v2 preflight）：

```
src/pages/Novel.tsx                       <  200 行（layout + 组合）
src/components/novel/
  NovelHeader.tsx                          < 150 行（顶部 toolbar · 项目名 / 章节切换 / 设置）
  NovelSidebar.tsx                         < 250 行（章节列表 · 拖拽排序）
  NovelEditor.tsx                          < 400 行（编辑器 · contenteditable + 保存）
  NovelPanels.tsx                          < 300 行（右侧面板组合 · 内嵌 CharacterBible / MethodModulePanel / ReflectorLessonsPanel）
  NovelStepRunner.tsx                      < 300 行（LLM step 触发 · N3.1/N3.2/N3.3 调度）

总：~1600 行 拆为 6 文件 · 平均 ~270 行/文件
```

**拆解原则**：
- 不动 props 接口（外部调用方零影响）
- 不动 state 流向（zustand store / React state 保持）
- 不动 LLM step 触发逻辑（v6 reflector hook 保留）
- 内嵌 panels 路径保留（ui-v1 R-UI-1 严守）

**风险缓解**：
- PR-4 单独 commit · 可回滚
- vite build 后 · 完整 dogfood 章节流程（创建 → 写 N3.1 → 跑 N3.2 → 跑 N3.3 → CharacterBible → ReflectorLessons）
- 所有 panel 展开/折叠状态保留

---

## 3. 数据流（无变化）

```
ui-v2 不动数据层：
  ✅ Dexie schema 不动（v5/v6 CK 严守）
  ✅ zustand store 接口不动（重构内部不动外部接口）
  ✅ LLM 调用不动（不改 prompt / 不改 manifest）
  ✅ pipeline 不动（v6 reflector hook 保留）
```

---

## 4. 性能考虑

| 项 | 目标 | 措施 |
|---|---|---|
| Home 首屏 | < 200ms | useMemo + Dexie 索引 |
| /methods 加载 | < 100ms | Skeleton 替代 spinner（感知加快）|
| Novel 章节切换 | 无回归 | 拆解后 React.memo 优化各 sub-component |
| 全站 hover/focus | < 16ms | DESIGN.md 既有 transition token |
| 应用层替换 | 零运行时开销 | 6 atoms 已经过性能优化 |

---

## 5. 错误处理

```
Toast 系统替换 alert：
  ✅ 错误用 toast.error · duration=0（不自动消失 · 用户手动关）
  ✅ console.error 保留（不静默吞错 · R-V3-4）
  ✅ 网络错误特殊处理：toast.error("网络错误 · 请检查代理 / API key") + 链接 /settings

Empty state：
  ✅ 列表为空时显示 EmptyState 组件 + CTA
  ✅ 数据加载失败时显示 EmptyState + 重试按钮
```

---

## 6. 兼容性

| 维度 | 兼容性 | 说明 |
|---|:---:|---|
| 浏览器 | ✅ | Chrome 90+ / Firefox 88+ / Safari 14+ · 与现有持平 |
| 旧用户数据 | ✅ | localStorage / IndexedDB 完全不动 |
| 旧路由 | ✅ | URL 不变 · bookmark 兼容 |
| 旧组件调用方 | ✅ | 6 atoms 接口不动 · 仅扩展用法 |
| 旧 dogfood-log | ✅ | 累加 section · 不改既有 |
| DESIGN.md | ✅ | 严格 add-only · 不改 token / 6 atoms 锁定 |

---

## 7. 测试策略

```
PR-1 · 应用层 audit：
  ✅ 每文件替换后跑 vite build · 0 errors
  ✅ 替换前后 dev server 视觉对比（截图 diff）
  ✅ 焦点 / 键盘导航 / disabled 状态手测
  ✅ grep audit：替换后裸 className 计数应大幅减少

PR-2 · 辅助组件：
  ✅ Storybook-like 测试页（src/playground 加 demo）
  ✅ Toast 4 类型 · Tooltip 4 方向 · Skeleton 3 variants 全测
  ✅ EmptyState 不同 icon/CTA 组合

PR-3 · Home dashboard：
  ✅ 数据聚合性能 console.time 测试
  ✅ Empty state（新用户无项目）+ 满 state（≥ 5 项目）测试
  ✅ Hero 区时段欢迎语手测

PR-4 · Novel.tsx 拆解：
  ✅ vite build 0 errors
  ✅ 完整 dogfood 章节流程（创建 → 写 → 跑 N3.x → 面板交互）
  ✅ React DevTools 检查组件树 · 无 unnecessary re-render
  ✅ 内嵌 panel 路径验证（ui-v1 R-UI-1）
```

---

## 8. 风险评估

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| 1 | Novel.tsx 拆解破坏功能 | 🟠 high | PR-4 单独 commit · 完整 dogfood · 可回滚 |
| 2 | 应用层替换漏掉某处 | 🟡 mid | grep 双重 audit + dogfood 时全站走查 |
| 3 | 应用层替换误改 layout 类 | 🟡 mid | 严守 R-V2-9（保非 design 类）· code review |
| 4 | 辅助组件与 6 atoms 风格不一致 | 🟡 mid | 强制 DESIGN.md token · code review |
| 5 | Home dashboard 聚合性能差 | 🟡 mid | useMemo + Dexie 索引 · 性能基线 |
| 6 | Toast 替换破坏既有错误处理 | 🟠 high | console.error 保留 · 逐处 audit |
| 7 | PR-1 工作量超预估 | 🟢 low | CA 数据已展示真实数 · PRD 已含 buffer |
| 8 | DESIGN.md 6 atoms 锁定违反 | 🔴 critical | R-V2-3 + R-V2-4 严守 · code review 红线 |

---

## 9. dogfood 验证计划

```
PR-1 完成后 dogfood：
  □ Top 6 文件视觉一致性（Screenplay/Intake/Assets/Novel/Pipeline/SelfCheck）
  □ 焦点 ring · disabled 状态 · loading 状态全测
  □ grep 验证：<button className= 计数 < 30（从 97 → < 30）

PR-2 完成后 dogfood：
  □ Toast 4 类型显示 + 自动消失 / 手动关
  □ Tooltip 4 方向显示
  □ Skeleton 在 /methods + /lessons 加载时显示
  □ EmptyState 在新用户首次访问 /methods + /lessons + Home 显示

PR-3 完成后 dogfood：
  □ Home 5 区块全显示
  □ Hero 欢迎语按时段切换
  □ 项目创建/选择路径可达
  □ 推荐 method modules 准确（基于使用频率）

PR-4 完成后 dogfood（最关键）：
  □ Novel 完整流程：创建 → 写 N3.1 → 跑 N3.2 → 跑 N3.3
  □ CharacterBible 内嵌面板正常
  □ MethodModulePanel 内嵌 + module 选择正常
  □ ReflectorLessonsPanel 内嵌 + 详情 modal 正常
  □ 章节切换 / 拖拽排序 / 保存 / 删除 全测
  □ vite build 0 errors
  □ React DevTools 无 unnecessary re-render
```

---

## 10. 跨 epic 依赖

```
依赖（ui-v2 之前完成）：
  ✅ ui-v1 epic（已完成 · /methods + /lessons 路由 + Sidebar 三组）
  ✅ DESIGN.md（已存在 · 不需改）

被依赖（ui-v2 完成后）：
  ⏳ ui-v3 epic 复用 PR-2 的 Toast 组件（PR-2 ui-v3 集成）
  ⏳ ui-v3 epic Sidebar badge 接 PR-3 ui-v2 的 homeAggregates
  ⏳ v7 epic 在拆解后的 Novel.tsx 上加 readerLayer counter（更易加）
  ⏳ ACE Layer 2/3 epic 在拆解后的 Novel.tsx 上加自动 Curator 调用
```

---

## 11. 用户签字栏

```
□ Stage 2 PRD 接受 · 进入 CA + CK 起草后 PR-1 实施
□ Stage 2 PRD 修改：[修改点]
□ Stage 2 PRD 拒绝 · 不启动 ui-v2 epic

签字日期：2026-05-__
签字人：QvQ
```

### 11.1 签字后行动

```
立即（本 session 或下次）：
  1. 起草 docs/planning/codebase-analysis-ui-v2.md（~300 行）
  2. 起草 docs/planning/code-knowledge-ui-v2.md（~300 行 · 10 不变量）
  3. 用户签字后启动 PR-1 实施

PR 实施顺序：
  PR-1（应用层 audit · 5-6h · 多 commit · 一文件一 commit）
  → PR-2（辅助组件 · 2-3h · 单 commit）
  → PR-3（Home dashboard · 3-4h · 单 commit）
  → PR-4（Novel.tsx 拆解 · 3-4h · 单 commit · 风险最高 · 单独 session）
```

---

## 12. PRD vs preflight 偏差（CA 阶段揭示）

```
v2 preflight 估 PR-1 工作量 3-4h
CA grep 实测：97 button + 18 input + 2 textarea + 10 overlay = 127 处替换点
实测工作量 5-6h（上调 +1.5-2h）

ui-v2 总：13-17h（v2 preflight 10-12h · 上调 +3-5h）
含 buffer 实际：11-14h

→ 用户在 §11 签字时已知此数据 · 决策成本透明
```
