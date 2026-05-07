# Codebase Analysis · ui-v1-asset-routing epic

> **Stage 2.2 · CA** · 配套 preflight + PRD + CK 三件套。
>
> 创建：2026-05-07 17:35 · 工程师 Cascade · 已通过 preflight + PRD 签字。

---

## §0 TL;DR

定位 fili-web 现有代码 · 找出本 epic 三 PR 需要的精确切入点。复用率高（90%+ 复用现有组件 / loader / store）· 改动局部 · 风险低。

---

## §1 现有代码全景（与 epic 相关）

### 1.1 路由层（router.tsx · 39 行）

```@C:/Users/QvQ/CascadeProjects/fili-web/src/router.tsx:1-39
import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { Playground } from './pages/Playground';
import { Pipeline } from './pages/Pipeline';
import { Screenplay, Adapt } from './pages/Screenplay';
import { Assets } from './pages/Assets';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Intake } from './pages/Intake';
import { Express } from './pages/Express';
import { Novel } from './pages/Novel';
import { Refinery } from './pages/Refinery';
import { Analyzer } from './pages/Analyzer';

export const router = createHashRouter([...]);
```

**13 个 Route**：`/` `/intake` `/screenplay` `/adapt` `/assets` `/kb` `/pipeline` `/express` `/novel` `/refinery` `/analyzer` `/playground` `/settings` + `/*` 兜底。

**改动点**：
- `+2 imports`（MethodModules / ReflectorLessons）
- `+2 children Routes`

### 1.2 Sidebar（Layout.tsx · ~95 行）

`@C:/Users/QvQ/CascadeProjects/fili-web/src/components/Layout.tsx:65-87`：当前结构 = 项目首页 + mode-specific (动态) + 通用 5 项。

**改动点**：
- `+1 lucide icon`（`Lightbulb` · 'Brain' 已用）
- `+5 NavItem`（重组 5 → 7：3 工具 + 3 资产 + 1 设置 · 加 NavSectionLabel × 2）

### 1.3 Pages 层（src/pages/）

```
现有 12 page tsx：
  Home / Intake / Screenplay (含 Adapt) / Assets / KnowledgeBase / Pipeline /
  Express / Novel / Refinery / Analyzer / Playground / Settings

新增 2 page：
  MethodModules.tsx     (PR-1)
  ReflectorLessons.tsx  (PR-2)
```

### 1.4 KnowledgeBase.tsx（参考模板 · 186 行）

`@C:/Users/QvQ/CascadeProjects/fili-web/src/pages/KnowledgeBase.tsx`：

```
模式：
  - 顶部 nav.border-b 含 TabButton 组（user / feedback / builtin）
  - 主区根据 tab 切换：UserKbLibrary / FeedbackInsights / BuiltinKbView
  - BuiltinKbView 内：左侧分类列表 + 右侧 markdown 预览
  - 用 loadKbManifest / loadKbContent 异步加载
  - MarkdownView 渲染

复用度：
  - PR-1 完全复用此模式（tabs by category + 列表 + markdown 详情）
  - 视觉与导航语义完全一致
```

### 1.5 Store 层

`@C:/Users/QvQ/CascadeProjects/fili-web/src/store/reflectorLessons.ts`（131 行 · v6 epic）：

```
现有 export：
  L19  type LessonStatus = 'pending' | 'approved' | 'rejected' | 'committed'
  L21  type SignalType = 'scoreCard' | 'consistencyCheck' | 'readerLayer' | 'userFeedback'
  L32  interface ReflectorLesson
  L67  upsertReflectorLesson(...)
  L79  listLessonsByStatus(projectId, status)        ← projectId 必填
  L95  listLessonsByChapter(projectId, chapterIndex) ← projectId 必填
  L111 updateLessonStatus(id, newStatus, patch?)
  L129 clearProjectLessons(projectId)
```

**改动点（PR-2）**：
- `+1 helper`：`listAllLessons(): Promise<ReflectorLesson[]>` · 跨项目（用于 /lessons page）

### 1.6 Pipeline 层

`@C:/Users/QvQ/CascadeProjects/fili-web/src/pipeline/methodModules.ts`：

```
现有 export（PR-1 复用）：
  - loadMethodModuleManifest(): Promise<MethodModuleManifest>
  - loadMethodModuleContent(id): Promise<string>
  - MethodModuleItem 类型
  - MethodModuleManifest 类型

不需新增 · 全部复用。
```

### 1.7 Components 层

```
现有可复用：
  - MarkdownView  (参考 KnowledgeBase 用法)
  - NavItem / NavSectionLabel  (Layout 同款)
  - ReflectorLessonsPanel.tsx  内含 ReflectorLessonModal · PR-2 提取为 named export

不需新增 · 仅升级 ReflectorLessonsPanel modal 导出。
```

---

## §2 各 PR 详细 codebase 切入点

### 2.1 PR-1 · /methods 独立页面

#### 2.1.1 NEW · `src/pages/MethodModules.tsx`（~120 行）

**imports**：

```typescript
import { useEffect, useMemo, useState } from 'react';
import { Brain, Search, X } from 'lucide-react';
import {
  loadMethodModuleManifest,
  loadMethodModuleContent,
  type MethodModuleItem,
  type MethodModuleManifest,
} from '../pipeline/methodModules';
import { MarkdownView } from '../components/MarkdownView';
```

**结构骨架**：

```typescript
export function MethodModules() {
  const [manifest, setManifest] = useState<MethodModuleManifest | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    loadMethodModuleManifest().then(setManifest).catch(...);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setContentLoading(true);
    loadMethodModuleContent(selectedId).then(setContent).finally(...);
  }, [selectedId]);

  const filtered = useMemo(() => /* category + search filter */, [manifest, search, activeCategory]);
  const categories = useMemo(() => /* extract unique */, [manifest]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 search + categories tabs */}
      {/* grid of cards */}
      {/* selected modal */}
    </div>
  );
}
```

#### 2.1.2 MOD · `src/router.tsx`（+3 行）

```typescript
import { MethodModules } from './pages/MethodModules';   // L+
// ...
{ path: 'methods', element: <MethodModules /> },          // L+
```

#### 2.1.3 MOD · `src/components/Layout.tsx`（+2 行 NavItem · 在 PR-3 final 重组前先放 "通用" 区）

```typescript
import { Brain, ... } from 'lucide-react';                 // L+
// ...
<NavItem to="/methods" icon={<Brain className="size-4" />}>方法论</NavItem>  // L+
```

**注**：PR-1 先简单加在通用区末尾 · PR-3 再做分组重构（避免 PR-1 + PR-3 改 Layout 同位置冲突）。

### 2.2 PR-2 · /lessons 独立页面

#### 2.2.1 NEW · `src/pages/ReflectorLessons.tsx`（~80 行）

**imports**：

```typescript
import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import {
  listAllLessons,
  updateLessonStatus,
  type ReflectorLesson,
  type LessonStatus,
  type SignalType,
} from '../store/reflectorLessons';
import { ReflectorLessonModal } from '../components/ReflectorLessonsPanel';  // PR-2 升级 export
```

**结构骨架**：

```typescript
export function ReflectorLessons() {
  const [lessons, setLessons] = useState<ReflectorLesson[]>([]);
  const [statusFilter, setStatusFilter] = useState<LessonStatus | 'all'>('all');
  const [signalFilter, setSignalFilter] = useState<SignalType | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<number | 'all'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    listAllLessons()
      .then((all) => setLessons(applyFilters(all, statusFilter, signalFilter, projectFilter)))
      .catch(...);
  }, [statusFilter, signalFilter, projectFilter, refresh]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 summary（4 类 status 计数）*/}
      {/* 过滤器（status / signal / project）*/}
      {/* 列表（卡片）*/}
      {/* 详情 modal · 复用 ReflectorLessonModal */}
    </div>
  );
}
```

#### 2.2.2 MOD · `src/store/reflectorLessons.ts`（+~10 行）

```typescript
/**
 * 列出所有项目的 lessons（供 /lessons page · PR-2 加）。
 */
export async function listAllLessons(): Promise<ReflectorLesson[]> {
  return await db.reflectorLessons.toArray();
}
```

#### 2.2.3 MOD · `src/components/ReflectorLessonsPanel.tsx`（modal 导出 · ~+5 行）

当前 `ReflectorLessonModal` 是文件内 `function` · 改为 `export function ReflectorLessonModal(...)` · 同时调用方改为 named import。

```diff
- function ReflectorLessonModal(props: ReflectorLessonModalProps): JSX.Element {
+ export function ReflectorLessonModal(props: ReflectorLessonModalProps): JSX.Element {
+ export interface ReflectorLessonModalProps {
+   lesson: ReflectorLesson;
+   onClose(): void;
+   onUpdated(): void;
+ }
```

（实际 props interface 已存在 · 仅加 export · 这里写 +5 行是估算）

#### 2.2.4 MOD · `src/router.tsx`（+3 行）

```typescript
import { ReflectorLessons } from './pages/ReflectorLessons';   // L+
// ...
{ path: 'lessons', element: <ReflectorLessons /> },             // L+
```

#### 2.2.5 MOD · `src/components/Layout.tsx`（+1 行 NavItem · 通用区末尾）

```typescript
import { Lightbulb, ... } from 'lucide-react';
// ...
<NavItem to="/lessons" icon={<Lightbulb className="size-4" />}>Reflector Lessons</NavItem>
```

### 2.3 PR-3 · Sidebar 分组 + dogfood log

#### 2.3.1 MOD · `src/components/Layout.tsx`（重组 ~+15 行）

**改动模式**（替换 `通用` section · `@C:/Users/QvQ/CascadeProjects/fili-web/src/components/Layout.tsx:81-86`）：

```diff
- <NavSectionLabel>通用</NavSectionLabel>
- <NavItem to="/kb" icon={<BookOpen className="size-4" />}>知识库</NavItem>
- <NavItem to="/analyzer" icon={<FileSearch className="size-4" />}>拆书分析</NavItem>
- <NavItem to="/refinery" icon={<Wand2 className="size-4" />}>润色工坊</NavItem>
- <NavItem to="/playground" icon={<FlaskConical className="size-4" />}>调试台</NavItem>
- <NavItem to="/methods" icon={<Brain className="size-4" />}>方法论</NavItem>
- <NavItem to="/lessons" icon={<Lightbulb className="size-4" />}>Reflector Lessons</NavItem>
- <NavItem to="/settings" icon={<SettingsIcon className="size-4" />}>设置</NavItem>
+ <NavSectionLabel>工具</NavSectionLabel>
+ <NavItem to="/analyzer" icon={<FileSearch className="size-4" />}>拆书分析</NavItem>
+ <NavItem to="/refinery" icon={<Wand2 className="size-4" />}>润色工坊</NavItem>
+ <NavItem to="/playground" icon={<FlaskConical className="size-4" />}>调试台</NavItem>
+
+ <NavSectionLabel>资产</NavSectionLabel>
+ <NavItem to="/kb" icon={<BookOpen className="size-4" />}>知识库</NavItem>
+ <NavItem to="/methods" icon={<Brain className="size-4" />}>方法论</NavItem>
+ <NavItem to="/lessons" icon={<Lightbulb className="size-4" />}>Reflector Lessons</NavItem>
+
+ <NavSectionLabel>设置</NavSectionLabel>
+ <NavItem to="/settings" icon={<SettingsIcon className="size-4" />}>设置</NavItem>
```

#### 2.3.2 MOD · `docs/dogfood-log.md`（+~80 行）

在文件顶部加 ui-v1-asset-routing epic section（按倒序追加约定）。

---

## §3 复用度 / 新增度评估

| 依赖 | 复用 | 新增 |
|---|:---:|:---:|
| `loadMethodModuleManifest` / `loadMethodModuleContent` | ✅ 100% | 0 |
| `MarkdownView` 组件 | ✅ 100% | 0 |
| `MethodModuleItem` / `MethodModuleManifest` 类型 | ✅ 100% | 0 |
| `listLessonsByStatus` / `updateLessonStatus` | ✅ ~80% | `listAllLessons` (+1 helper) |
| `ReflectorLessonModal` | ✅ 100% | 仅 export 升级 |
| `NavItem` / `NavSectionLabel` | ✅ 100% | 0 |
| `lucide-react Brain` 图标 | ✅ 已用 | 0 |
| `lucide-react Lightbulb` 图标 | 0 | +1 import |

**净复用率：~90%**。

---

## §4 风险点

### 4.1 ReflectorLessonsPanel modal export 升级（PR-2）

**风险**：当前 `ReflectorLessonModal` 是 inline 在 ReflectorLessonsPanel.tsx 内部 · 改为 named export 不能动 panel 自己的引用。

**缓解**：
- panel 内部仍调用 `<ReflectorLessonModal ... />`（不变）
- 仅在文件加 `export` 关键字 + props interface 也 export
- 改动 < 5 行 · 极小

**测试**：PR-2 完成后 · 进 Novel.tsx 内嵌 panel 验证 modal 仍能 mount + 操作。

### 4.2 Layout.tsx 三 PR 累积改动

**风险**：PR-1/2/3 都改 Layout.tsx · 可能 git rebase 冲突。

**缓解**：
- PR-1 / PR-2 仅 append NavItem 到 "通用" 区末尾（最小改动）
- PR-3 集中重组（替换整个 "通用" 区 · 加分组）
- 每 PR 独立 commit + push · 不批量改

### 4.3 categories 列表硬编码 vs 动态

**问题**：methods/manifest.json 的 modules[].category 字段值列表（character / structure / writing / shot / asset / workflow / ... 共 7+）· 应从 manifest 动态提取。

**决策**：MethodModules.tsx 的 categories 列表用 `useMemo(() => Array.from(new Set(manifest.modules.map(m => m.category))), [manifest])` 动态提取 · 不硬编码。

---

## §5 测试 / 验证策略

| 验证 | 命令 | 期望 |
|---|---|---|
| build | `npx vite build` | 0 errors · 1948 ± 1 modules |
| 路由 | hash router URL `localhost:5173/#/methods` | 正常加载 |
| 路由 | hash router URL `localhost:5173/#/lessons` | 正常加载 |
| 红线 R-UI-3 | `git diff src/store/db.ts` | 0 行 |
| 红线 R-UI-4 | `git diff src/store/characterStates.ts` | 0 行 |
| 红线 R-UI-5 | `git diff src/store/reflectorLessons.ts` | 仅 +1 helper |
| 红线 R-UI-7 | `git diff public/prompts/manifest.json` | 0 行 |
| 红线 R-UI-1 | grep `MethodModulePanel\|ReflectorLessonsPanel` 在 Novel.tsx | 仍存在 |

---

## §6 PR 文件清单（最终）

### PR-1（~180 行）

| 文件 | 类型 | 行数 |
|---|---|:---:|
| `src/pages/MethodModules.tsx` | NEW | ~120 |
| `src/router.tsx` | MOD | +3 |
| `src/components/Layout.tsx` | MOD | +2 |

### PR-2（~140 行）

| 文件 | 类型 | 行数 |
|---|---|:---:|
| `src/pages/ReflectorLessons.tsx` | NEW | ~80 |
| `src/store/reflectorLessons.ts` | MOD | +10 (listAllLessons) |
| `src/components/ReflectorLessonsPanel.tsx` | MOD | +5 (modal export) |
| `src/router.tsx` | MOD | +3 |
| `src/components/Layout.tsx` | MOD | +2 |

### PR-3（~50 行）

| 文件 | 类型 | 行数 |
|---|---|:---:|
| `src/components/Layout.tsx` | MOD | ~+15 (重组分组) |
| `docs/dogfood-log.md` | MOD | +~80 |

---

## §7 实施顺序

```
Stage 3.1 PR-1：
  1. 写 src/pages/MethodModules.tsx（~120 行）
  2. 改 src/router.tsx（+3 行）
  3. 改 src/components/Layout.tsx（+2 行 NavItem）
  4. npx vite build 验证
  5. git commit "feat(ui-v1): PR-1 /methods page"
  6. git push（与 standing instruction 一致）

Stage 3.2 PR-2：
  1. 改 src/store/reflectorLessons.ts（+listAllLessons）
  2. 改 src/components/ReflectorLessonsPanel.tsx（modal export）
  3. 写 src/pages/ReflectorLessons.tsx（~80 行）
  4. 改 src/router.tsx（+3 行）
  5. 改 src/components/Layout.tsx（+2 行 NavItem）
  6. npx vite build 验证
  7. 验证 Novel.tsx 内嵌 panel 仍工作（R-UI-1）
  8. git commit "feat(ui-v1): PR-2 /lessons page"
  9. git push

Stage 3.3 PR-3：
  1. 改 src/components/Layout.tsx（重组分组 · 替换通用 section）
  2. 改 docs/dogfood-log.md（+~80 行 epic section）
  3. npx vite build 验证
  4. git commit "feat(ui-v1): PR-3 sidebar grouping + dogfood log"
  5. git push
```

---

## §8 用户签字

```
□ 用户签字（CA）：[ ] 接受 / [ ] 拒绝 / [ ] 调整范围

签字方式：
  - "ok" / "continue" → 进入 Stage 2.3 写 CK
  - "调整：[具体方向]" → 修订 CA
```
