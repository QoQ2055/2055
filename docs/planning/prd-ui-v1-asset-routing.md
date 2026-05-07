# PRD · ui-v1-asset-routing epic

> **Stage 2.1 · Product Requirements Document** · 配套 preflight + CA + CK 三件套。
>
> 创建：2026-05-07 17:30 · 工程师 Cascade · 已通过用户 preflight 签字。

---

## §0 TL;DR

为 fili-web 加 2 个独立路由页面（`/methods` + `/lessons`）+ Sidebar 三组分隔 · 把 method modules 与 reflectorLessons 升级为侧栏可达的全局资产 · 与 `/kb` 平级。

3 PR · ~350 行 · ~2.5h Stage 3 实施。

---

## §1 用户故事

### US-1（method modules 页面）

```
As 任何 mode 的用户
I want 从侧栏点击 "方法论" 进入 /methods 页面
So that 我能浏览全部 74 个 method modules · 看每个的 summary / category / injectsTo
And 我能按 category 过滤 / 搜索关键字
And 我能点击进入查看完整 markdown
```

### US-2（lessons 页面）

```
As 启用了 v6 reflectorThresholds.enabled=true 的用户
I want 从侧栏点击 "Reflector Lessons" 进入 /lessons 页面
So that 我能跨项目看所有 lesson（pending / approved / rejected / committed）
And 我能审阅、批准、驳回、标记已 commit（与 Novel.tsx 内嵌 panel 同等能力）
```

### US-3（Sidebar 分组）

```
As 用户
I want 侧栏通用区分组（"工具" / "资产" / "设置"）
So that 入口有视觉层级 · 不再扁平 5 项
```

---

## §2 验收标准（Acceptance Criteria · AC）

### AC-1（路由 + 侧栏挂载）

```
□ AC-1.1 router.tsx 加 /methods 与 /lessons 两个 Route（与 /kb 同级）
□ AC-1.2 Layout.tsx 侧栏通用区加 "方法论" 与 "Reflector Lessons" 两个 NavItem
□ AC-1.3 两个新页面在所有 mode（original/adaptation/express/novel）下都能访问
□ AC-1.4 / 路由根 + 13 旧路由完全保留 · 0 修改
```

### AC-2（/methods 页面）

```
□ AC-2.1 进入 /methods · 自动加载 public/methods/manifest.json
□ AC-2.2 显示 74 个 modules 列表 · 每条卡片含：title / category 徽章 / summary / injectsTo / estimatedTokens
□ AC-2.3 顶部 tab：按 category 过滤（character / structure / writing / shot / asset / workflow / ...）
□ AC-2.4 顶部 tab：搜索框 · 按 title / summary 模糊匹配
□ AC-2.5 点卡片打开详情 modal（或侧滑）· 显示完整 markdown 内容（loadMethodModuleContent 复用）
□ AC-2.6 不支持启用 / 禁用 modules（启用走项目设置 · /methods 仅是浏览页）
□ AC-2.7 page 的视觉风格与 /kb 一致（tab + 列表 + 详情）
```

### AC-3（/lessons 页面）

```
□ AC-3.1 进入 /lessons · 自动加载所有 reflectorLessons row（不限项目）
□ AC-3.2 显示 4 类 status 计数（pending / approved / rejected / committed）
□ AC-3.3 status filter + signal type filter（与 ReflectorLessonsPanel 一致）
□ AC-3.4 可加 projectId filter（多项目时区分）
□ AC-3.5 点卡片打开 detail modal（复用 ReflectorLessonsPanel 现有 modal · DRY）
□ AC-3.6 modal 操作流（编辑 / 批准 / 驳回 / 标记已 commit）与 panel 等价
□ AC-3.7 V6 CK I-3 严守：page 不自动写 method module
□ AC-3.8 V6 CK I-6：独立 localStorage key 'flil:reflector-lessons-page:state'（与 panel 的 'flil:reflector-lessons:state' 区分）
```

### AC-4（Sidebar 分组）

```
□ AC-4.1 通用区从扁平 5 NavItem 升级为：
       工具：拆书分析 / 润色工坊 / 调试台
       资产：知识库 / 方法论 / Reflector Lessons
       设置：设置
□ AC-4.2 用 NavSectionLabel 视觉分隔（已有组件 · 复用）
□ AC-4.3 Mode-specific 区不动
```

### AC-5（构建 + 红线）

```
□ AC-5.1 vite build OK · 0 errors · ≤ 1948 modules（预计 +5 模块）
□ AC-5.2 R-UI-1 ~ R-UI-8 全守（preflight §6）
□ AC-5.3 现有 /kb / /analyzer / /refinery / /playground / /settings 行为 0 变化
□ AC-5.4 v5/v6 epic 落地资产（CharacterBible reader / ReflectorLessonsPanel modal）0 退化
```

---

## §3 不在范围（与 preflight §4 一致）

```
✗ Novel.tsx 1973 行拆解
✗ Home 项目卡 dashboard 升级
✗ 三栏布局
✗ Command Palette
✗ 数据资产仪表盘
✗ 项目模板系统
✗ Mode-bar 改造
✗ 移动端适配
```

---

## §4 设计方案

### 4.1 /methods 页面（PR-1）

**文件**：`src/pages/MethodModules.tsx`（NEW · ~120 行）

**视觉布局**：

```
┌─────────────────────────────────────────────────────────────────┐
│ [搜索框] [category: 全部▼ character | structure | ...]            │ ← 顶部 nav (sticky)
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────┐│
│ │ 卡片：MBTI 五步法     │ │ 卡片：Save the Cat   │ │ 卡片：...     ││
│ │ [character] 600 tk   │ │ [structure] 800 tk   │ │              ││ ← grid (2-3 列)
│ │ summary 一段...       │ │ summary 一段...       │ │              ││
│ │ → injectsTo: novel.1 │ │ → injectsTo: novel.2 │ │              ││
│ └─────────────────────┘ └─────────────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────────┘

点卡片 → 全屏 modal 显示完整 markdown（loadMethodModuleContent + MarkdownView）
```

**实现要点**：
- 复用 `loadMethodModuleManifest()` + `loadMethodModuleContent()`（已存在 · pipeline/methodModules.ts）
- 复用 `MarkdownView` 组件（已存在 · KnowledgeBase 也用）
- 不引入新依赖
- 视觉与 KnowledgeBase 一致（tab + 列表 + 详情）

### 4.2 /lessons 页面（PR-2）

**文件**：`src/pages/ReflectorLessons.tsx`（NEW · ~80 行）

**视觉布局**：

```
┌─────────────────────────────────────────────────────────────────┐
│ Reflector Lessons (全局)                                         │
│ X 待审 | Y 已批 | Z 已驳 | K 已 commit (按状态)                  │ ← 顶部 summary
├─────────────────────────────────────────────────────────────────┤
│ [status: pending▼] [signal: 全部▼] [project: 全部▼]              │ ← 过滤器
├─────────────────────────────────────────────────────────────────┤
│ [项目 A · 第 5 章] [scoreCard] [pending]            2 天前        │
│ lessonContent 预览 ...                                            │
│ 建议：anti-ai-flavor-rules                                       │
│ [详情] [批准] [驳回]                                              │
│ ─────────────────────────────────────                           │
│ [项目 B · 第 3 章] [readerLayer] [approved]         5 天前        │
│ ...                                                               │
└─────────────────────────────────────────────────────────────────┘

详情 modal · 复用 ReflectorLessonsPanel 现有 modal（PR-2 把 modal 提取为独立 export）
```

**实现要点**：
- 复用 `listLessonsByStatus` / `updateLessonStatus`（已存在 · store/reflectorLessons.ts）
- 升级查询：加 `listAllLessons()` 跨项目查询（store 加 1 个 helper · ~10 行）
- 升级 ReflectorLessonsPanel：把 ReflectorLessonModal 改为 named export · page 复用
- 独立 zustand store 'flil:reflector-lessons-page:state'（含 projectFilter）

### 4.3 Sidebar 分组（PR-3）

**文件**：`src/components/Layout.tsx`（MOD · +15 行）

**当前**：

```tsx
<NavSectionLabel>通用</NavSectionLabel>
<NavItem to="/kb" icon={<BookOpen ... />}>知识库</NavItem>
<NavItem to="/analyzer" icon={<FileSearch ... />}>拆书分析</NavItem>
<NavItem to="/refinery" icon={<Wand2 ... />}>润色工坊</NavItem>
<NavItem to="/playground" icon={<FlaskConical ... />}>调试台</NavItem>
<NavItem to="/settings" icon={<SettingsIcon ... />}>设置</NavItem>
```

**改为**：

```tsx
<NavSectionLabel>工具</NavSectionLabel>
<NavItem to="/analyzer" icon={<FileSearch ... />}>拆书分析</NavItem>
<NavItem to="/refinery" icon={<Wand2 ... />}>润色工坊</NavItem>
<NavItem to="/playground" icon={<FlaskConical ... />}>调试台</NavItem>

<NavSectionLabel>资产</NavSectionLabel>
<NavItem to="/kb" icon={<BookOpen ... />}>知识库</NavItem>
<NavItem to="/methods" icon={<Brain ... />}>方法论</NavItem>          {/* PR-1 */}
<NavItem to="/lessons" icon={<Lightbulb ... />}>Reflector Lessons</NavItem>  {/* PR-2 */}

<NavSectionLabel>设置</NavSectionLabel>
<NavItem to="/settings" icon={<SettingsIcon ... />}>设置</NavItem>
```

新增 lucide-react 图标：`Brain`（已用 · ReflectorLessonsPanel）+ `Lightbulb`（NEW）。

---

## §5 数据流

### 5.1 /methods 数据流

```
浏览器加载 /methods
  ↓
useEffect: loadMethodModuleManifest()         (网络 1 次 · 缓存)
  ↓
manifest.modules[] (74 项)
  ↓
组件 state: filteredModules (按 category + search 过滤)
  ↓
点卡片 → setSelectedId(id)
  ↓
useEffect: loadMethodModuleContent(id)         (网络 1 次)
  ↓
markdown 内容 → 渲染 MarkdownView
```

### 5.2 /lessons 数据流

```
浏览器加载 /lessons
  ↓
useEffect: listAllLessons() (NEW · cross-project)
  ↓
db.reflectorLessons.toArray()
  ↓
组件 state: filteredLessons (status + signalType + projectId 过滤)
  ↓
点卡片 → setSelectedLessonId(id)
  ↓
ReflectorLessonModal mount (复用)
  ↓
modal action → updateLessonStatus
  ↓
re-load (refresh++)
```

---

## §6 性能考虑

| 操作 | 预估开销 | 备注 |
|---|---|---|
| `/methods` 初次加载 manifest | < 50 ms | 74 modules · ~20 KB JSON |
| `/methods` 点卡片加载 markdown | < 100 ms | 单文件 · 平均 5-10 KB |
| `/lessons` 初次扫表 | < 100 ms | dexie indexed scan · 单项目 < 100 lessons 估算 |
| Sidebar 渲染 | 0 ms 增量 | 仅多 2 NavItem |

**风险**：用户跨多项目积累 1000+ lessons 后 · `/lessons` 全表扫描可能 > 500 ms · 需分页（v2 优化）· 本 PR 不优化（用户实际未到这量级）。

---

## §7 错误处理

| 错误 | 处理 |
|---|---|
| `loadMethodModuleManifest()` 失败 | 显示"加载失败"+ 重试按钮（与 /kb 一致）|
| `loadMethodModuleContent(id)` 404 | modal 显示"内容未找到"|
| `db.reflectorLessons` 表不存在（v6 未启用）| /lessons 显示"启用 v6 reflector 后将显示" |
| 用户跨 mode 访问 | 不限制 · 全可访问（任何 mode 都看到 method modules / lessons）|

---

## §8 兼容性

| 旧用户 | 新用户 |
|---|---|
| ✅ 现有侧栏入口（"知识库" / "拆书" / "润色" / "调试" / "设置"）位置不变 | ✅ 看到 8 个入口（5 旧 + 2 新 + 1 项目首页）|
| ✅ 现有 13 路由 path 不变 | ✅ 多 2 路由（/methods / /lessons）|
| ✅ Novel.tsx 内嵌 MethodModulePanel / ReflectorLessonsPanel 仍工作 | ✅ 同时也能从 /methods / /lessons 全局浏览 |
| ✅ v5 reader viewMode 不变 | ✅ 不影响 |
| ✅ v6 reflectorThresholds 默认 enabled=false 不变 | ✅ 不影响 |

**Dexie schema**：v7 不变（本 epic 不涉及存储）。

---

## §9 测试策略

```
□ Manual：
  □ 启用 dev · 确认侧栏 8 个入口（含 2 新）
  □ 点 "方法论" → /methods · 看到 74 modules · 可过滤 / 搜索
  □ 点卡片 → modal 显示 markdown
  □ 点 "Reflector Lessons" → /lessons
     - v6 disabled 时：显示"启用 v6 后将显示"
     - 启用后：跑 1 次 N3.2 polish · 看 lesson 出现
  □ 切回 Novel.tsx · 内嵌 panel 仍工作（R-UI-1 守住）
  □ 路由直接 URL：localhost:5173/methods / /lessons 访问

□ Build：
  □ npx vite build · 0 errors · 1948 ± 1 modules
  □ tsc --noEmit · 0 errors

□ Regression（红线验证）：
  □ git diff src/store/db.ts → 0 行（R-UI-3）
  □ git diff src/store/characterStates.ts → 0 行（R-UI-4）
  □ git diff src/store/reflectorLessons.ts → 仅 +1 helper（R-UI-5）
  □ git diff public/prompts/manifest.json → 0 行（R-UI-7）
  □ Novel.tsx Reflector hook 仍工作（R-UI-1）
```

---

## §10 PR 拆分（与 preflight §3.1 一致）

| PR | 内容 | 文件 | 行数 | 时间 |
|:---:|---|---|:---:|:---:|
| **PR-1** | /methods 页面 + 路由 + NavItem | `src/pages/MethodModules.tsx` (NEW) + `router.tsx` (MOD) + `Layout.tsx` (MOD · 仅加 NavItem) | ~180 | ~60 min |
| **PR-2** | /lessons 页面 + 路由 + NavItem + panel modal export | `src/pages/ReflectorLessons.tsx` (NEW) + `router.tsx` (MOD) + `Layout.tsx` (MOD) + `ReflectorLessonsPanel.tsx` (MOD · modal 升级 export) + `store/reflectorLessons.ts` (MOD · listAllLessons helper) | ~140 | ~50 min |
| **PR-3** | Sidebar 分组重构 + dogfood log | `Layout.tsx` (MOD · NavSectionLabel 重组) + `dogfood-log.md` (MOD) | ~50 | ~30 min |

**总计**：3 PR · 5 src 文件 + 1 doc · ~370 行 · ~2.5h。

---

## §11 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|:---:|:---:|---|
| ReflectorLessonsPanel modal 提取破坏 v6 PR-2 | 低 | 中 | PR-2 测试 panel 仍能 mount + 操作 |
| Sidebar 分组改动影响 mode-aware 显示 | 低 | 低 | A3 仅加 NavSectionLabel · 不动 mode-specific 区 |
| /lessons 全表扫慢 | 低 | 低 | 当前 < 100 lessons · 不优化 · v2 epic 加分页 |
| 用户加 method module 后 /methods 不刷新 | 低 | 低 | manifest 模块缓存 · 用户重启 dev 即可 |

---

## §12 PR-3 dogfood 项

```
□ UV1-D-1：从侧栏点 "方法论" → /methods 加载 OK · 74 卡片显示
□ UV1-D-2：点卡片 → modal 显示 markdown
□ UV1-D-3：搜索 + category 过滤生效
□ UV1-D-4：从侧栏点 "Reflector Lessons" → /lessons 加载 OK
□ UV1-D-5：v6 disabled 时显示"启用后..."提示
□ UV1-D-6：v6 启用 + 跑 N3.2 触发 lesson 后 · /lessons 看到 row
□ UV1-D-7：modal 操作（编辑 / 批准 / 驳回 / 标记 commit）等价于 Novel.tsx 内嵌 panel
□ UV1-D-8：所有 mode（original / adaptation / express / novel）下侧栏都有这两个入口
□ UV1-D-9：现有 /kb / /analyzer 等访问 0 退化
□ UV1-D-10：Novel.tsx 内嵌 panel 仍工作（R-UI-1 验证）
```

---

## §13 用户签字

```
□ 用户签字（PRD）：[ ] 接受 / [ ] 拒绝 / [ ] 调整范围

签字方式：
  - "ok" / "continue" / "go" → 进入 Stage 2.2 写 CA
  - "调整：[具体方向]" → 我修订 PRD
  - "暂停" → 保留 PRD · 改天继续
```
