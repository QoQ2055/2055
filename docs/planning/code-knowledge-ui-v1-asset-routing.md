# Code Knowledge · ui-v1-asset-routing epic

> **Stage 2.3 · CK · 不变量** · 配套 preflight + PRD + CA。
>
> 创建：2026-05-07 17:40 · 工程师 Cascade · Stage 2 最后一个文档。

---

## §0 TL;DR

定义本 epic **8 个不变量** + **2 红线（v6 epic 复用）** · 实施期间持续守住。每 PR 落地后必须验证全部不变量。

---

## §1 不变量列表

| # | 不变量 | 类型 | 验证方式 | 优先级 |
|:---:|---|:---:|---|:---:|
| **I-1** | router.tsx 13 旧 path 完全保留 · 仅追加 2 新 path | 路由 | git diff `[ \{ ]path: '/X'` 旧行 = 0 改动 | 高 |
| **I-2** | Layout.tsx 现有 NavItem `to` 路径 0 修改 | 视觉 | git diff `to=` 旧行 = 0 修改（仅追加 / 重排）| 高 |
| **I-3** | Novel.tsx 内嵌 MethodModulePanel + ReflectorLessonsPanel 仍 mount + 工作 | UI | grep 文件 + dogfood Phase 4 实测 | 高 |
| **I-4** | Dexie schema (db.ts) 0 修改 | 存储 | git diff src/store/db.ts = 0 行 | 高 |
| **I-5** | v5 readerLayer schema (characterStates.ts) 0 修改 | v5 资产 | git diff src/store/characterStates.ts = 0 行 | 高 |
| **I-6** | v6 reflectorLessons schema (reflectorLessons.ts) 仅 +1 helper · 不改现有 export | v6 资产 | git diff schema 行 = 0 · 仅 +listAllLessons | 高 |
| **I-7** | settings.reflectorThresholds 默认 enabled=false 0 修改 | v6 决策 | git diff settings.ts reflectorThresholds = 0 行 | 高 |
| **I-8** | 现有 prompts/manifest.json novel.9 注册 0 修改 | v6 决策 | git diff prompts/manifest.json = 0 行 | 高 |

---

## §2 不变量详解

### I-1 · router.tsx 13 旧 path 完全保留

**约束**：`@C:/Users/QvQ/CascadeProjects/fili-web/src/router.tsx:21-34` 13 个 path 字符串值不能改。本 epic 仅在它们后面追加 `methods` 和 `lessons` 两个新 Route。

**理由**：
- 用户书签 / URL 直达可能依赖
- 项目数据保存 lastVisitedRoute 时存储路径字符串

**违反样例**（坏）：

```diff
- { path: 'methods', element: <MethodModules /> },
+ { path: 'method-modules', element: <MethodModules /> },  // 改了 path 字符串 → 用户书签失效
```

**验证**：

```powershell
git diff src/router.tsx | Select-String "^- *\{ path:" | Measure-Object Line
# 应该 = 0
```

### I-2 · Layout.tsx 现有 NavItem `to` 路径 0 修改

**约束**：`@C:/Users/QvQ/CascadeProjects/fili-web/src/components/Layout.tsx:82-86` 5 个现有 NavItem 的 `to` 属性不能改。允许：
- 重排顺序（PR-3）
- 加 NavSectionLabel 分组（PR-3）
- 加新 NavItem（PR-1/2）

**理由**：
- 用户视觉记忆
- 现有 active state matching 依赖路径

### I-3 · Novel.tsx 内嵌 panels 仍工作

**约束**：v5 / v6 epic 落地的 `MethodModulePanel`（v3 资产）+ `ReflectorLessonsPanel`（v6 PR-2）仍能在 Novel.tsx 内 mount 并工作。

**理由**：
- 项目级面板有独立价值（"当前项目的 active modules / pending lessons"）
- 全局页面 ≠ 项目级浏览
- R-UI-1（preflight §6）

**风险**：PR-2 把 `ReflectorLessonModal` 改 export · 必须不破坏 panel 内调用。

**验证**：

```powershell
# 1. grep 仍引用
Select-String 'src/pages/Novel.tsx' -Pattern 'MethodModulePanel|ReflectorLessonsPanel' | Measure-Object Line
# 应该 ≥ 2

# 2. dogfood：进 Novel 页面 · 展开两个面板 · 操作正常
```

### I-4 · Dexie schema 0 修改

**约束**：本 epic 不动 `src/store/db.ts`（v7 stores 字符串完全保留）。

**理由**：
- 本 epic 是 UI 层 · 不涉及存储
- v6 epic 刚落地 v7 schema · 不该再改

**验证**：

```powershell
git diff src/store/db.ts | Measure-Object Line
# 应该 = 0
```

### I-5 · v5 readerLayer schema 0 修改

**约束**：本 epic 不动 `src/store/characterStates.ts`（v5 epic readerLayer 4 字段 schema 完全保留）。

**理由**：v5 epic 已签字落地 · 本 epic 仅 UI 层。

**验证**：

```powershell
git diff src/store/characterStates.ts | Measure-Object Line
# 应该 = 0
```

### I-6 · v6 reflectorLessons schema 仅 +1 helper

**约束**：`src/store/reflectorLessons.ts` 改动**只允许**：
- ✅ 加 `listAllLessons()` 1 个新 export helper（CA §1.5）
- ❌ 不改现有 ReflectorLesson interface
- ❌ 不改 LessonStatus / SignalType 类型
- ❌ 不改 listLessonsByStatus / listLessonsByChapter / updateLessonStatus / upsertReflectorLesson 任何函数

**理由**：v6 epic schema 已签字落地。

**违反样例**（坏）：

```diff
- export interface ReflectorLesson {
+ export interface ReflectorLesson<T = void> {  // 加泛型 → 破坏 v6 schema
```

**验证**：

```powershell
# 仅检查 ReflectorLesson interface / type 定义行 0 改动
git diff src/store/reflectorLessons.ts | Select-String "^[\-+] *export (interface ReflectorLesson|type LessonStatus|type SignalType|async function listLessonsByStatus|async function listLessonsByChapter|async function updateLessonStatus|async function upsertReflectorLesson)" | Measure-Object Line
# 应该 = 0
```

### I-7 · settings.reflectorThresholds 默认值 0 修改

**约束**：`src/store/settings.ts` 的 `reflectorThresholds` 默认值（preflight §6 R-UI-6 列出 5 字段）0 修改。

**理由**：v6 epic 决定 enabled=false 是 opt-in 设计 · 不能因为 UI 升级"顺便启用"。

**验证**：

```powershell
git diff src/store/settings.ts | Select-String "reflectorThresholds" | Measure-Object Line
# 应该 = 0（本 epic 不动 settings）
```

### I-8 · prompts/manifest.json novel.9 注册 0 修改

**约束**：`public/prompts/manifest.json` 0 修改。本 epic UI 层 · 不涉及 prompt。

**验证**：

```powershell
git diff public/prompts/manifest.json | Measure-Object Line
# 应该 = 0
```

---

## §3 红线（与 preflight §6 一致 + epic 间复用）

| # | 红线 | 来源 epic | 本 epic 状态 |
|:---:|---|---|:---:|
| **R-UI-1** | 不删 Novel.tsx 内嵌 panels | preflight | ✅ 严守（I-3 验证）|
| **R-UI-2** | 不动 13 旧路由 path | preflight | ✅ 严守（I-1 验证）|
| **R-UI-3** | 不动 Dexie schema | preflight | ✅ 严守（I-4 验证）|
| **R-UI-4** | 不动 v5 readerLayer | preflight | ✅ 严守（I-5 验证）|
| **R-UI-5** | 不动 v6 reflectorLessons schema | preflight | ✅ 严守（I-6 验证）|
| **R-UI-6** | 不动 settings.reflectorThresholds 默认值 | preflight | ✅ 严守（I-7 验证）|
| **R-UI-7** | 不动 prompts/manifest.json | preflight | ✅ 严守（I-8 验证）|
| **R-UI-8** | 保持 simplify "clean 状态"（无 dead code / 长文件 / 重复 logic）| preflight | ✅ 严守 |
| **R-V6-1** | reflectorLessons 表 add-only（v6 CK I-2）| v6 | ✅ 复用（本 epic 不改 schema）|
| **R-V6-2** | parseReflectorResponse 不抛错（v6 CK I-1）| v6 | ✅ 不影响（本 epic 不改 reflector pipeline）|

**核心**：本 epic 是 UI 层补充 · 不动数据 / 不动 prompt / 不动 pipeline · 红线友好。

---

## §4 不变量在每 PR 的验证

### PR-1 验证清单

```
□ I-1：git diff router.tsx 仅追加 2 行（imports）+ 1 行 (Route) · 0 修改旧 path
□ I-2：git diff Layout.tsx 仅追加 1-2 行 · 0 修改现有 NavItem
□ I-3：grep MethodModulePanel 在 Novel.tsx ≥ 1
□ I-4：git diff db.ts = 0
□ I-5：git diff characterStates.ts = 0
□ I-6：git diff reflectorLessons.ts = 0（PR-1 不改）
□ I-7：git diff settings.ts = 0
□ I-8：git diff prompts/manifest.json = 0
□ Build：vite build 0 errors · 1948 ± 1 modules
```

### PR-2 验证清单

```
□ I-1：git diff router.tsx 累积 +3 + 3 = 6 行 imports + Route · 0 修改旧 path
□ I-2：git diff Layout.tsx 累积 +2 + 2 = 4 行 NavItem
□ I-3：grep ReflectorLessonsPanel 在 Novel.tsx ≥ 1（modal export 不破坏 mount）
□ I-4 ~ I-8：与 PR-1 一致 · 仍 0 修改
□ I-6：git diff reflectorLessons.ts 仅 +listAllLessons function（10 行内）
□ Build：vite build 0 errors
□ R-UI-1 验证：Novel.tsx 内嵌 ReflectorLessonsPanel modal 仍能弹出 + 操作
```

### PR-3 验证清单

```
□ I-1 ~ I-8：与 PR-2 一致 · 0 修改累积资产
□ I-2：Layout.tsx 重组 · 现有 NavItem to 路径 0 改动 · 仅顺序变 + 加 NavSectionLabel
□ Build：vite build 0 errors
□ Layout 重组后视觉验证：3 组分隔清晰
```

---

## §5 dogfood 验证清单（CK 红线复测）

```
□ U1: 启动 dev · 进 / · 看到侧栏 8 入口（含 2 新 + 3 组分隔）
□ U2: 点 "方法论" → /methods · 加载 74 cards · 过滤 / 搜索生效
□ U3: 点卡片 → modal 显示 markdown · 关闭 OK
□ U4: 点 "Reflector Lessons" → /lessons · v6 disabled 显示提示 / 启用后看 lessons
□ U5: 进 Novel 页面 · 展开 MethodModulePanel · 仍能选 modules（R-UI-1）
□ U6: 进 Novel 页面 · 展开 ReflectorLessonsPanel · modal 仍能弹出（R-UI-1）
□ U7: 跨 4 个 mode 切换 · 侧栏 3 组分隔显示一致
```

---

## §6 实施期间警示

```
🚨 警示 1：PR-2 改 ReflectorLessonsPanel modal 为 export 时
       必须确认 panel 内 <ReflectorLessonModal ... /> 调用不变
       否则破坏 R-UI-1 + I-3

🚨 警示 2：PR-3 重组 Layout.tsx 时
       必须保留所有现有 NavItem 的 to 属性 + label 文字
       仅允许：顺序变 + 加 NavSectionLabel
       否则破坏 I-2

🚨 警示 3：每 PR 后必须跑 vite build
       不能积累 PR · 一次性大跑（违反 simplify 工作流原则）

🚨 警示 4：本 epic 完成后跑 simplify §1.1 扫描
       验证未引入新 dead exports
       否则破坏 R-UI-8
```

---

## §7 用户签字

```
□ 用户签字（CK · Stage 2 最后一个文档）：[ ] 接受 / [ ] 拒绝 / [ ] 调整范围

签字方式：
  - "ok" / "continue" / "go" → commit Stage 2 三件套 · 进入 Stage 3 实施 PR-1
  - "调整：[具体方向]" → 修订 CK
```

---

## §8 8 不变量速查表（贴在工作区）

```
┌─────────────────────────────────────────────────────────┐
│ ui-v1-asset-routing CK 8 不变量                          │
├─────────────────────────────────────────────────────────┤
│ I-1 router.tsx 13 旧 path 不改                          │
│ I-2 Layout.tsx 现有 NavItem to 不改                     │
│ I-3 Novel.tsx 内嵌 panels 仍工作                        │
│ I-4 db.ts 0 改                                           │
│ I-5 characterStates.ts 0 改                             │
│ I-6 reflectorLessons.ts 仅 +listAllLessons              │
│ I-7 settings.reflectorThresholds 默认值 0 改             │
│ I-8 prompts/manifest.json 0 改                          │
└─────────────────────────────────────────────────────────┘
```
