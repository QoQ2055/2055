# Codebase Analysis · ui-v2 epic · 应用层贯彻 + 信息架构升级

> **BMAD Stage 2 · Codebase Analysis 文档**
> 提议日期：2026-05-07 19:25
> Epic ID：`ui-v2-application-layer-overhaul`
> 上游：`docs/planning/prd-ui-v2-application-layer-overhaul.md`
> 用途：揭示 PRD 与代码现状的偏差 · 量化工作量 · 锁定不变量

---

## 1. 现状代码定位

### 1.1 design system 资产

| 文件 | 大小 | 角色 |
|---|:---:|---|
| `DESIGN.md` | 30K · 825 行 | 设计系统规范（不可改 · V2-I-1）|
| `src/index.css` | 7K | token 配方实现（.btn-primary 等 · 不可改 · V2-I-2）|
| `tailwind.config.ts` | 7K | tailwind token 映射 |
| `src/components/ui/index.ts` | 0.7K | 6 atoms 统一 export |
| `src/components/ui/Button.tsx` | 2.5K | 5 variants + iconOnly |
| `src/components/ui/Input.tsx` | 1K | 表单输入 |
| `src/components/ui/Textarea.tsx` | 0.9K | 多行输入 |
| `src/components/ui/Card.tsx` | 2.6K | Card + 5 sub-components |
| `src/components/ui/Modal.tsx` | 4K | Modal + 5 sub-components |
| `src/components/ui/NavItem.tsx` | 2K | NavItem + NavSectionLabel |
| `src/components/ui/Tabs.tsx` | 3.4K | Tabs |

**总 atoms 行数**：~16.4K（src/components/ui/）+ 7K（src/index.css token 配方）= ~23.4K · 已成熟

### 1.2 应用层 audit 数据（grep 实测 2026-05-07 19:15）

#### 裸 className 总分布

```
<button className=    : 97 处
<input className=     : 18 处
<textarea className=  :  2 处
fixed inset overlay   : 10 处（自实现 modal）
─────────────────────────────────
总替换点              : 127 处
```

#### Top 12 文件 button 分布

| Rank | 文件 | button | 优先级 | 备注 |
|:---:|---|:---:|:---:|---|
| 1 | `src/pages/Screenplay.tsx` | 19 | P0 | 最大 audit 对象 |
| 2 | `src/pages/Intake.tsx` | 15 | P0 | 第二大 |
| 3 | `src/pages/Assets.tsx` | 10 | P1 | |
| 4 | `src/pages/Novel.tsx` | 10 | P1 | PR-4 拆解时合并做 |
| 5 | `src/pages/Pipeline.tsx` | 8 | P1 | |
| 6 | `src/components/SelfCheckPanel.tsx` | 7 | P2 | |
| 7 | `src/components/ScreenplayDoctorPanel.tsx` | 7 | P2 | |
| 8 | `src/pages/Settings.tsx` | 3 | P2 | |
| 9 | `src/components/ManualInjectDialog.tsx` | 3 | P2 | |
| 10 | `src/pages/Playground.tsx` | 2 | P3 | |
| 11 | `src/pages/Express.tsx` | 2 | P3 | |
| 12 | `src/components/FeedbackInsights.tsx` | 2 | P3 | |
| - | 其余 ~7 个文件 | 9 | P3 | 散落小处 |

**关键观察**：
- Top 6 文件占 **69 button**（71% · 重点 audit）
- 估每处 ~3 min（含分析 variant + 替换 + 视觉验证）
- Top 6 工作量：69 × 3 / 60 = **3.5h**
- 剩余 28 处工作量：~1.5h
- 加 input 18 处 × 2 min = ~0.6h
- 加 textarea 2 处 × 2 min ~0
- 加 overlay 10 处 × 5 min = ~0.8h
- **PR-1 总：5-6h**（v2 preflight 估 3-4h · 实际 +1.5-2h）

### 1.3 信息架构定位

| 文件 | 大小 | ui-v2 影响 |
|---|:---:|---|
| `src/router.tsx` | ~2K | ❌ 不动（V2-I-4）· 路由表保持 |
| `src/components/Layout.tsx` | ~3K | ⚠ 仅去 mode strip（已 commit 427386c）· ui-v2 不再动 |
| `src/pages/Home.tsx` | 12K · ~300 行 | ✅ PR-3 重写为 dashboard |
| `src/pages/Novel.tsx` | 89K · ~2200 行 | ✅ PR-4 拆解 |

### 1.4 内嵌 panels（PR-4 严守路径）

```
Novel.tsx 内嵌：
  - <CharacterBible projectId={...} />
  - <MethodModulePanel projectId={...} />
  - <ReflectorLessonsPanel projectId={...} />
  - <ProgressDashboard projectId={...} />（gap-d epic）

R-UI-1（ui-v1 严守）+ R-V2-5（PR-4 强约束）：
  - 这些 panel 接口不变
  - 路径不变（仍在 NovelPanels.tsx 内）
  - 用户体验完全等价
```

### 1.5 辅助组件目录现状

```
src/components/feedback/  （目前不存在 · ui-v2 PR-2 新建）
src/components/ui/        （6 atoms · ui-v2 不动）
src/components/dashboard/ （gap-d epic · ChapterCompletionGrid 等 · ui-v2 PR-3 复用）
src/components/home/      （目前不存在 · ui-v2 PR-3 新建）
src/components/novel/     （目前不存在 · ui-v2 PR-4 新建）
```

---

## 2. PR-by-PR 改动详情

### 2.1 PR-1 · 应用层 audit（5-6h）

**预期 commit 数**：~6（每 P0/P1 文件 1 commit · P2/P3 合并 1-2 commit）

```
commit 1: refactor(ui): Screenplay.tsx 19 button → <Button> (P0)
commit 2: refactor(ui): Intake.tsx 15 button → <Button> + 4 input → <Input> (P0)
commit 3: refactor(ui): Assets.tsx 10 button + 2 input + 1 modal (P1)
commit 4: refactor(ui): Pipeline.tsx 8 button (P1)
commit 5: refactor(ui): SelfCheck + ScreenplayDoctor 14 button (P2)
commit 6: refactor(ui): 剩余 9 文件 ~17 button + 12 input/textarea/overlay (P2/P3)

注：Novel.tsx 10 button 留待 PR-4 拆解时合并做（避免双修）
```

**改动文件清单**（精确）：

```
~ src/pages/Screenplay.tsx        (-19 button hardcoded · +imports + <Button>)
~ src/pages/Intake.tsx            (-15 button -4 input · +imports + <Button>/<Input>)
~ src/pages/Assets.tsx            (-10 button -2 input -1 overlay · +imports)
~ src/pages/Pipeline.tsx          (-8 button · +imports)
~ src/components/SelfCheckPanel.tsx       (-7 button · +imports)
~ src/components/ScreenplayDoctorPanel.tsx (-7 button · +imports)
~ src/pages/Settings.tsx          (-3 button · +imports)
~ src/components/ManualInjectDialog.tsx   (-3 button · +imports)
~ src/pages/Playground.tsx        (-2 button · +imports)
~ src/pages/Express.tsx           (-2 button · +imports)
~ src/components/FeedbackInsights.tsx     (-2 button · +imports)
~ ... 其余 ~7 文件 ~9 button + 12 input/textarea/overlay

总：~13-17 文件 · 总 +/- ~250 行（不算 import）
```

### 2.2 PR-2 · 辅助组件补全（2-3h）

**新增文件**：

```
+ src/components/feedback/Toast.tsx          (~120 行)
+ src/components/feedback/Tooltip.tsx        (~100 行)
+ src/components/feedback/Skeleton.tsx       (~80 行)
+ src/components/feedback/EmptyState.tsx     (~80 行)
+ src/components/feedback/index.ts           (~10 行 · 统一 export)
+ src/store/toast.ts                         (~60 行 · zustand toast queue)
+ src/components/feedback/ToastContainer.tsx (~40 行 · 全局挂载点)

新增总：~490 行
```

**修改文件**：

```
~ src/main.tsx 或 src/App.tsx（注入 ToastContainer 到根）
~ src/pages/*.tsx 中 5-10 处 alert / inline error → toast 调用
~ src/pages/MethodModules.tsx · /lessons 加 Skeleton
~ Home / /methods / /lessons Empty state
```

### 2.3 PR-3 · Home dashboard（3-4h）

**新增文件**：

```
+ src/components/home/HeroSection.tsx        (~120 行)
+ src/components/home/RecentActivity.tsx     (~150 行)
+ src/components/home/ProgressHeatmap.tsx    (~80 行 · 复用 ChapterCompletionGrid)
+ src/components/home/TodoList.tsx           (~100 行)
+ src/components/home/Recommendations.tsx    (~100 行)
+ src/store/homeAggregates.ts                (~120 行)

新增总：~670 行
```

**修改文件**：

```
~ src/pages/Home.tsx (12K → ~300 行 · 仅 layout · -800 行)
```

### 2.4 PR-4 · Novel.tsx 拆解（3-4h · 风险最高）

**新增文件**：

```
+ src/components/novel/NovelHeader.tsx       (~150 行)
+ src/components/novel/NovelSidebar.tsx      (~250 行)
+ src/components/novel/NovelEditor.tsx       (~400 行)
+ src/components/novel/NovelPanels.tsx       (~300 行)
+ src/components/novel/NovelStepRunner.tsx   (~300 行)
+ src/components/novel/index.ts              (~10 行)

新增总：~1410 行
```

**修改文件**：

```
~ src/pages/Novel.tsx (89K · ~2200 行 → ~200 行 · 仅 layout + 组合 · -2000 行)

净增（src）：1410 - 2000 = -590 行（重构后行数减少 · 因消除重复）
```

---

## 3. 红线影响审计

### 3.1 v5 epic 不变量（I-1 ~ I-8）

```
v5 I-1 readerLayer optional         → ❌ 不影响（不动 schema）
v5 I-2 dexie add-only               → ❌ 不影响
v5 I-3 N3.3 prompt zero-modify      → ❌ 不影响
v5 I-4 视觉契约保持                 → ⚠ 影响 · CharacterBible reader tab 在 NovelPanels 内嵌 · PR-4 严守接口
v5 I-5 ~ I-8                        → ❌ 不影响
```

### 3.2 v6 epic 不变量（I-1 ~ I-8）

```
v6 I-1 reflector schema             → ❌ 不影响
v6 I-2 dexie add-only               → ❌ 不影响
v6 I-3 method module zero-modify    → ❌ 不影响
v6 I-4 opt-in                       → ❌ 不影响
v6 I-5 N3.2 prompt zero-modify      → ❌ 不影响
v6 I-6 reflector 异步不阻塞         → ❌ 不影响
v6 I-7 schema fallback              → ❌ 不影响
v6 I-8 ReflectorLessonsPanel 接口   → ⚠ 影响 · PR-4 NovelPanels 复用此组件 · 接口不变
```

### 3.3 ui-v1 epic 不变量（I-1 ~ I-8）

```
ui-v1 I-1 路由表不变（15 条）       → ✅ 严守 V2-I-4
ui-v1 I-2 NavItem 路径不变（8 入口） → ✅ 严守 V2-I-5
ui-v1 I-3 method module zero-modify → ❌ 不影响
ui-v1 I-4 ~ I-8                     → ❌ 不影响
```

### 3.4 DESIGN.md 全约束

```
① Token 优先 · 永不写裸值     → ✅ PR-1 audit 正是为了贯彻此规则
② 主题感知                    → ✅ 6 atoms 既有 token · 不需改
③ 节奏感 ≥ stackXl            → ✅ Home dashboard PR-3 严守
④ 字号克制                    → ✅ 不引新字号 · 用既有 11 级阶梯
⑤ 创作内容区 reading 排版     → ✅ Novel.tsx 拆解时 NovelEditor 严守 readingMaxWidth 720px
⑥ 语义色配 icon/文字          → ✅ Toast 严守 · Sidebar badge ui-v3 严守

6 atoms 锁定                  → ✅ V2-I-3 + V2-I-4 严守 · 辅助组件目录隔离
```

---

## 4. 偏差分析（PRD vs 代码现状）

### 4.1 已识别偏差

| # | PRD 假设 | 代码现状 | CA 揭示 | 处理 |
|---|---|---|---|---|
| 1 | "PR-1 替换 30-50 处 → 6 atoms" | 实测 127 处替换点 | 偏差 +77-97 处 | PR-1 工作量上调 3-4h → 5-6h |
| 2 | "Top 6 页面" | grep 验证 = Screenplay/Intake/Assets/Novel/Pipeline/SelfCheck | 一致 | 无 |
| 3 | "Toast 替换 5-10 处 alert" | grep `alert(` 估 5-8 处 + inline error ~5 处 | 一致 | 无 |
| 4 | "Home.tsx 12K · 升级为 dashboard" | 实测 12.8K · 项目列表 + 模式选择 | 一致 | 无 |
| 5 | "Novel.tsx 89K 拆为 6 文件" | 实测 89K · ~2200 行 | 一致 | 无 |
| 6 | "辅助组件 4 个" | 当前 src/components/feedback/ 不存在 | 全新建 | 无 |

### 4.2 风险升级（CA 数据揭示）

```
CA 揭示 · PR-1 实际工作量 5-6h（vs PRD 估 3-4h）
ui-v2 总工作量：13-17h（vs preflight v2 估 10-12h · 上调 +3-5h）
含 buffer 实际：11-14h

→ Stage 2 签字时用户已知此数据 · 决策成本透明
→ 若用户希望快速 · 可选 a) 仅做 Top 6 文件（3.5h · 覆盖 71%）b) 全做（5-6h · 100%）
   建议：全做（71% 不够 · 一致性才是核心动机）
```

### 4.3 未发现新风险

```
audit grep 未发现：
  ✅ 不存在隐藏的 design system 违反（除已计入的 127 处）
  ✅ 不存在未文档化的 atom 组件
  ✅ 不存在跨 epic 冲突
```

---

## 5. 复用率分析

### 5.1 既有可复用资产

| PR | 复用 | 复用率 |
|---|---|---|
| PR-1 | 6 atoms（Button/Input/Textarea/Card/Modal/NavItem/Tabs）| 100%（仅替换调用 · 不写新组件）|
| PR-2 | DESIGN.md token + 6 atoms 内部模式 | ~50%（新组件用既有 token · 但实现新写）|
| PR-3 | ProgressDashboard / ChapterCompletionGrid（gap-d epic）+ Dexie store | ~30%（PR-3 主要新写）|
| PR-4 | CharacterBible / MethodModulePanel / ReflectorLessonsPanel | ~80%（拆解 · 不重写 panel）|

### 5.2 总体复用率

```
ui-v2 epic 整体复用率：~65%
新增 src 行：~2570 行（PR-1 ~250 + PR-2 ~490 + PR-3 ~670 + PR-4 ~1160 净）
减少 src 行：~2800 行（PR-3 Home -800 + PR-4 Novel -2000）
净 src 行变化：~-230 行（**重构后行数减少**）
```

---

## 6. PR 启动顺序建议

```
Stage 3 启动顺序：

PR-1 应用层 audit（5-6h · 多 commit · 一文件一 commit）
  ↓ vite build + 视觉手测
PR-2 辅助组件（2-3h · 单 commit）
  ↓ Storybook-like 测试
PR-3 Home dashboard（3-4h · 单 commit · 复用 PR-2 EmptyState/Skeleton）
  ↓ Empty / 满 state 手测
PR-4 Novel.tsx 拆解（3-4h · 单 commit · 风险最高 · 单独 session）
  ↓ 完整 dogfood 章节流程（关键）

PR-1 / PR-2 / PR-3 可并行启动
PR-4 必须最后做（依赖 PR-2 Toast / Skeleton / EmptyState）
```

---

## 7. 用户决策点

```
□ 接受 CA · 工作量上调（11-14h vs preflight 10-12h）· 全做
□ 仅做 Top 6 文件（3.5h · 覆盖 71%）· 接受不一致风险
□ 拒绝 PR-1 · 仅做 PR-2/3/4（节省 5-6h · 但用户原诉求"视觉一致"未解决）

签字日期：2026-05-__
签字人：QvQ
```

---

## 8. 总结

```
✅ DESIGN.md + 6 atoms 已成熟（不需改 design system）
⚠ 应用层 127 处替换点（远超 preflight 估算）
✅ PRD vs 代码偏差仅 1 项（PR-1 工作量）· CA 已修正
✅ 24 不变量 + DESIGN 全约束 · ui-v2 全部严守
✅ ui-v2 净 src 行 -230（重构后行数减少）
✅ 复用率 65% · 既有资产充分利用
```
