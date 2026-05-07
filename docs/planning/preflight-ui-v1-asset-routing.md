# Preflight · ui-v1-asset-routing epic

> **Stage 0 文档** · 等待用户签字后进入 Stage 2（PRD + CA + CK）。
>
> 创建时间：2026-05-07 17:25
> 工程师（Cascade）建议：本 epic 范围适中 · 风险低 · 可作为正式 epic 执行。

---

## §0 TL;DR

把 fili-web 已积累的 **74 个 method modules** 与 **v6 epic 引入的 reflectorLessons 表** 从"项目工作台内嵌面板"提升为"侧栏可达的独立页面" · 解决"用户辛苦累积的资产被埋没"的设计缺陷。

具体三件事（与之前 Lv1 三项对应）：
1. **A1 / `/methods` 独立页面**：方法论库浏览（74 modules）
2. **A2 / `/lessons` 独立页面**：Reflector lessons 全局列表（v6 epic 落地）
3. **A3 / Sidebar 分组**：通用区分"工具" / "资产" / "设置" 三组

预估范围：**~5 文件 · 约 350 行**（净改动 + ~250 行新文件 + ~50 行 mount）。
预估时间：**~5 小时**（preflight 30min + Stage 2 文档 2h + Stage 3 实施 2.5h）。

---

## §1 背景 · 当前状态分析

### 1.1 触发线索（用户对话 2026-05-07 17:06）

> 第二：请验证目前的程序流程，知识库，skill是否挂载到了网页。
> 第三：现在的网页，设计并不合理，再最后给我一个修改建议。

经过排查 · 发现：

```
路由 (router.tsx · 13 个)            侧栏挂载？      影响
─────────────────────────────────────────────────────────────────
/                Home                ✅ "项目"
/intake          Intake              ❌ defaultRoute 自动跳转
/screenplay      Screenplay          ❌ defaultRoute 自动跳转
/adapt           Adapt               ❌ 改编流水线内
/assets          Assets              ❌ 工作台按钮内
/express         Express             ❌ defaultRoute 自动跳转
/novel           Novel               ❌ defaultRoute 自动跳转
/pipeline        Pipeline            ❌ 与新建项目向导重复
/kb              KnowledgeBase       ✅ "知识库"
/analyzer        Analyzer            ✅ "拆书分析"
/refinery        Refinery            ✅ "润色工坊"
/playground      Playground          ✅ "调试台"
/settings        Settings            ✅ "设置"
```

**核心问题**：
- ❌ Method Modules（74 个 · 用户 v3 累计 50 个原创）：**只在 Novel.tsx 内嵌面板** · 原创 / 改编 / 分镜 mode 用户**完全访问不到**
- ❌ Reflector Lessons（v6 epic 落地）：**只在 Novel.tsx 内嵌面板** · 跨项目 / 历史 lesson 无法对比
- ✅ Knowledge Base：有独立路由 + 侧栏入口（`/kb`）· 是合格的"资产挂载"参考模式

### 1.2 资产可见度评估

| 资产 | 数量 | 当前可见度 | 问题严重度 |
|---|---|---|:---:|
| **Method Modules（方法论模块）** | 74 个 · 466 行 ACE method module 等 | ❌ 仅 Novel.tsx 内嵌 | 🔴 高 |
| **Reflector Lessons（v6 epic）** | 0（待用户 dogfood）→ 未来增长 | ❌ 仅 Novel.tsx 内嵌 | 🔴 高 |
| **Knowledge Base（builtin + user）** | builtin 6 + 用户上传 | ✅ /kb 独立页面 | ✅ 合格 |
| **Character Bible** | 跟项目走 | ❌ 仅 Novel.tsx 内嵌 | 🟡 中（按 v5 设计如此 · 可保留）|
| **ScoreCard / ConsistencyCheck** | 跟项目跟章节 | ❌ 内嵌 collapsible | 🟢 低（数据本就跟章节）|

**优先级**：Method Modules + Reflector Lessons 是"全局资产"（不依赖具体项目）· 必须有独立入口。Character Bible / ScoreCard 是"项目资产" · 内嵌合理。

### 1.3 用户当前痛点

```
痛点 1：用户花大量时间维护 method modules（v3 累积 50 个原创 · 6.5 万字）· 但只有"小说创作"用户能在 N3.x 看到这些方法
痛点 2：v6 epic 启动 reflector enabled=true 后 · lessons 在哪审？答：Novel.tsx 内嵌折叠面板（深处）
痛点 3：跨项目想"复习以前 lesson"· 没入口
痛点 4：原创 / 改编 / 分镜 mode 用户根本不知道有 method module 系统的存在
```

---

## §2 目标

### 2.1 一句话目标

把 method modules 与 reflectorLessons 升级为**侧栏可达的独立页面** · 与 `/kb` 平级 · 解决"资产被埋没"问题。

### 2.2 验收标准（用户视角）

```
□ V1: 任何 mode 下 · 用户都能从侧栏点击 "方法论" 进入 /methods 页面 · 看到 74 个 modules 列表 + 详情
□ V2: 任何 mode 下 · 用户都能从侧栏点击 "Reflector Lessons" 进入 /lessons 页面 · 看到全局 lessons 列表
□ V3: 通用区从扁平 5 入口升级为 "工具 / 资产 / 设置" 三组 · 视觉清晰
□ V4: 现有 Novel.tsx 内嵌的 MethodModulePanel 与 ReflectorLessonsPanel 保留（不删 · 仅升级为"快捷视图" · 详情走 /methods 与 /lessons）
□ V5: vite build OK · 0 errors
□ V6: 现有所有 v5 / v6 epic 资产不破坏（CharacterBible / Reflector hook 等）
```

---

## §3 范围（Stage 3 实施）

### 3.1 PR 拆分

| PR | 内容 | 文件数 | 行数 | 时间 |
|:---:|---|:---:|:---:|:---:|
| **PR-1** | `/methods` 独立页面 + 路由 + 侧栏入口 | 3 文件 | ~180 行 | ~60 min |
| **PR-2** | `/lessons` 独立页面 + 路由 + 侧栏入口 | 2 文件 | ~120 行 | ~50 min |
| **PR-3** | Sidebar 三组分隔 + dogfood log | 2 文件 | ~50 行 | ~30 min |

**总计**：3 PR · 5 文件（不重复）· ~350 行 · ~2.5h Stage 3 实施。

### 3.2 文件级范围（预估）

```
NEW（新建）：
  src/pages/MethodModules.tsx                 ~120 行（参考 KnowledgeBase.tsx 模式）
  src/pages/ReflectorLessons.tsx              ~80 行（复用 ReflectorLessonsPanel 逻辑）

MODIFIED（修改）：
  src/router.tsx                              +6 行（加 2 个 Route）
  src/components/Layout.tsx                   ~+30 行（加 2 个 NavItem + 3 个 NavSectionLabel 分组）
  docs/dogfood-log.md                         +~80 行（PR-3 文档）

PRESERVED（不动）：
  src/pages/Novel.tsx                         不动（保留内嵌面板）
  src/components/MethodModulePanel.tsx        不动（仍是项目级面板）
  src/components/ReflectorLessonsPanel.tsx    不动（仍是项目级面板 · 但升级为 props 化以让 page 复用）
```

### 3.3 复用 vs 新建决策

```
A1 · /methods 页面：
  现状：MethodModulePanel.tsx 是项目级面板（绑定到 ProjectContext · 显示 active modules）
  决策：NEW · 不复用面板（语义不同）
  理由：
    - 全局浏览 ≠ 项目级激活
    - /methods 应像 /kb 一样：列表 + 详情 + 分类筛选
    - 复用面板会引入大量"为什么这里也要选项目"的混乱

A2 · /lessons 页面：
  现状：ReflectorLessonsPanel.tsx 已 collapsible · 含 list + modal
  决策：NEW page 但**复用 panel 内部逻辑**
  理由：
    - 项目级面板（折叠 + 列表）与全局页面（分页 + 搜索）需求 ~80% 重叠
    - panel 抽出"内部表格组件"为独立 export · page 直接 mount

A3 · Sidebar 分组：
  现状：通用区扁平 5 NavItem
  决策：MOD · 在 Layout.tsx 加 NavSectionLabel
  理由：复用现有 NavSectionLabel 组件 · 不新建
```

### 3.4 三 PR 依赖与顺序

```
PR-1 ──► PR-2 ──► PR-3
 │        │        │
 │        │        └─ 仅依赖 PR-1/2 加好 NavItem · 重组 + dogfood log
 │        │
 │        └─ 依赖 PR-1 加好 /methods 路由模式（可参考）
 │
 └─ 独立可执行
```

---

## §4 不在范围（明确排除）

| 排除项 | 理由 | 后续 epic |
|---|---|---|
| **Novel.tsx 1973 行拆解（B2）** | 重大 refactor · 风险高 · 影响 v5/v6 epic 落地资产 | 待 ui-v2 epic（用户主动决定）|
| **Home 项目卡 dashboard 升级（B1）** | 范围大 · 与 v3 项目卡设计深度相关 | 待 ui-v2 epic |
| **三栏布局（C1）** | 全面 UX 改造 · 8-15h 投入 | 待 ui-v3 epic |
| **Command Palette（C2）** | 复杂特性 · 8-15h 投入 | 待 ui-v3 epic |
| **数据资产仪表盘（C3）** | 跨项目数据聚合 · 5-10h 投入 | 待 ui-v3 epic |
| **mode-bar 改造（B3）** | 语义模糊 · 与 mode-aware 设计哲学冲突 | 不推荐做 |
| **移动端适配** | 不在战略范围 | 永不 |

---

## §5 风险评估

### 5.1 技术风险

| 风险 | 概率 | 影响 | 缓解 |
|---|:---:|:---:|---|
| **/methods 页面与 v3 batch 累积冲突** | 低 | 低 | 仅读 manifest.json · 不写 |
| **/lessons 页面破坏 v6 ReflectorLessonsPanel** | 中 | 中 | PR-2 panel 改为"props-driven"· panel 仍工作 + page 也能用 |
| **Sidebar 分组动 Layout.tsx · 影响其它 mode 显示** | 低 | 中 | A3 仅加 NavSectionLabel · 不动 navItems mapping |
| **vite build 失败** | 低 | 低 | 每 PR 跑一次 build · 失败回滚 |
| **dexie schema 变更** | 0 | - | 本 epic 不动 schema |

### 5.2 项目风险

| 风险 | 概率 | 影响 | 缓解 |
|---|:---:|:---:|---|
| **范围蠕变到 Lv2** | 中 | 高（时间双倍）| §4 严格不在范围列表 |
| **打断 v5/v6 dogfood 节奏** | 中 | 中 | 本 epic 完成后 dogfood 资产更明显 · 实际加速 dogfood |
| **三 PR 不能一气呵成** | 低 | 低 | 每 PR 独立可 ship |

### 5.3 时间风险

```
预估总时长：5h（preflight 30min + Stage 2 docs 2h + Stage 3 实施 2.5h）
不确定区间：4-7h（如果遇 panel 复用问题 · PR-2 可能拖到 1.5h）
```

---

## §6 红线

```
R-UI-1：不删 src/pages/Novel.tsx 内嵌的 MethodModulePanel / ReflectorLessonsPanel
        理由：项目级面板有独立价值（"当前项目的 active modules"）· 不与全局页面冲突
        验证：grep MethodModulePanel / ReflectorLessonsPanel 仍引用

R-UI-2：不动 router.tsx 已有 13 个路由 path
        理由：用户书签 / URL 直达可能依赖
        允许：仅追加 2 个新路由（/methods / /lessons）

R-UI-3：不动 Dexie schema（v7 不动）
        理由：本 epic 是 UI 层 · 不涉及存储
        验证：src/store/db.ts diff = 0

R-UI-4：不动 v5 epic 的 readerLayer schema
        理由：v5 已签字落地
        验证：src/store/characterStates.ts diff = 0

R-UI-5：不动 v6 epic 的 reflectorLessons schema
        理由：v6 已签字落地
        验证：src/store/reflectorLessons.ts diff = 0

R-UI-6：不动 settings.reflectorThresholds 默认值
        理由：v6 epic 已决定 enabled=false（opt-in）
        验证：src/store/settings.ts reflectorThresholds.enabled diff = 0

R-UI-7：不动 prompts/manifest.json novel.9 注册
        理由：v6 epic 已落地 · 本 epic 不涉及 prompt
        验证：public/prompts/manifest.json diff = 0

R-UI-8：不破坏 simplify workflow 跑过的"仓库 clean"状态
        理由：本 epic 加新代码 · 不应引入 dead exports / 长文件 / 重复 logic
        验证：每 PR 后跑 simplify workflow 1.1 / 1.5 检查
```

---

## §7 交付物清单（Stage 2 + Stage 3）

### Stage 2（文档）

| 文档 | 路径 | 估行 |
|---|---|:---:|
| **PRD** | `docs/planning/prd-ui-v1-asset-routing.md` | ~300 行 |
| **CA** | `docs/planning/codebase-analysis-ui-v1-asset-routing.md` | ~250 行 |
| **CK** | `docs/planning/code-knowledge-ui-v1-asset-routing.md` | ~200 行 |

### Stage 3（代码 + 文档）

| PR | 交付物 | 行数 |
|:---:|---|:---:|
| **PR-1** | NEW `src/pages/MethodModules.tsx` + MOD `router.tsx` + MOD `Layout.tsx` | ~180 |
| **PR-2** | NEW `src/pages/ReflectorLessons.tsx` + MOD `router.tsx` + MOD `Layout.tsx` + (可能) MOD `ReflectorLessonsPanel.tsx`（props 化）| ~120 |
| **PR-3** | MOD `Layout.tsx`（分组）+ MOD `docs/dogfood-log.md`（dogfood log）| ~50 |

### 验证项

| 验证 | 期望 |
|---|---|
| `npx vite build` | 0 errors · ≤ 1948 modules（预计 +5 模块）|
| 路由数 | 13 → 15（+2）|
| 侧栏入口数 | 6 → 8（+2 资产入口）|
| 8 红线 | R-UI-1 ~ R-UI-8 全守 |

---

## §8 BMAD 流程映射

```
Stage 0 · preflight                        本文件                          ~30 min  ✅ 当前
Stage 1 · 用户签字                         你说"continue"或"ok"               -        ⏳
Stage 2.1 · PRD                            prd-ui-v1-asset-routing.md      ~30 min  ⏳
Stage 2.2 · CA                             codebase-analysis-...md         ~30 min  ⏳
Stage 2.3 · CK                             code-knowledge-...md            ~30 min  ⏳
Stage 2 · 用户签字                         你说"continue"或"ok"               -        ⏳
Stage 3.1 · PR-1                           commit + push                   ~60 min  ⏳
Stage 3.2 · PR-2                           commit + push                   ~50 min  ⏳
Stage 3.3 · PR-3                           commit + push                   ~30 min  ⏳

总：~5 小时
```

---

## §9 用户签字栏

```
□ 用户签字（本 preflight）：[ ] 接受 / [ ] 拒绝 / [ ] 调整范围

签字方式：
  - "ok" / "continue" / "go" → 进入 Stage 2 写 PRD/CA/CK
  - "调整：[具体方向]" → 我修订 preflight
  - "暂停" / "停" → 保留 preflight 文档 · 改天继续
  - "拒绝" → 删除 preflight 文档 · 不启动 epic
```

---

## §10 备注

- 本 epic 与 v5 / v6 epic 完全独立 · 不依赖任何未完成的 epic
- 与 simplify workflow 互补：本 epic 加新代码 · 但不污染 simplify 跑过的"clean 状态"
- 本 epic 不阻塞用户 dogfood v5/v6 · 完成后反而**加速** dogfood（资产可见度 ↑）
- 完成本 epic 后 · fili-web 自我进化能力评估：⭐⭐⭐⭐☆ → ⭐⭐⭐⭐☆+（资产可见度 ↑ 但层级未变）
