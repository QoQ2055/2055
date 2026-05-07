# Preflight · ui-v2 + ui-v3 · 视觉 + UX 大改造（修正版 v2）

> **BMAD Stage 0 · preflight 文档**
> 提议日期：2026-05-07 19:05（v2 修正版 · 替代 fdf4a9a 中 v1）
> 提议者：Cascade
> 用户诉求：原话「网页视觉太过于简陋，你有提升前端视觉感受和操作感受的方案吗」
> 预计工作量：**~20-24h**（v1 估 23-28h · v2 减 3-4h · 因 token 系统已成熟无需扩充）
> 状态：⏳ 等待用户 Stage 0 v2 签字
> v1 → v2 修正原因：**v1 漏读 DESIGN.md 30K（825 行）+ src/index.css 7K · 误判"design system 缺失"**
> 同期生效不变量：v5 8 + v6 8 + ui-v1 8 = 24 条 · 全部必须严守
> 新增需保护：**DESIGN.md 全部硬约束**（6 atoms 锁定 / token 优先 / 11 级 typography / 4 档 elevation 等）

---

## ⚠ 修正声明（v1 → v2）

v1（commit fdf4a9a · 历史保留）的 §2 现状审计有 4 处误判：

| # | v1 写的 | 真相 | v2 修正 |
|---|---|---|---|
| 1 | "design token 扩充：色阶/阴影/圆角" | DESIGN.md 已成熟 + token 完整（暖橙+warm stone / 4 语义色 / 11 级 typo / 4 档 elevation / 圆角分档）| 删 PR-1 token 扩充 · 改为「应用层 audit + 替换裸 className → 6 atoms」|
| 2 | "shadcn/ui 选接 5 组件（Toast/Dialog/Tooltip/Popover/Skeleton）" | DESIGN.md 锁定 6 atoms · 「不要造第 7 个」是硬约束。Dialog ≈ Modal（已存在）· Popover 待评估 | 仅可加 Toast / Tooltip / Skeleton（6 atoms 之外的辅助组件 · 不冲突）· 删 Dialog/Popover · shadcn 仅按需"复制粘贴" · 不引入完整 shadcn 体系 |
| 3 | "Button variants 不全" | Button 已 5 variants（primary/secondary/outline/ghost/danger）+ iconOnly · 已齐 | 删此判断 |
| 4 | "色阶单调 / 缺细节" | 暖橙 primary + warm stone neutral 是品牌底调 · 精心调过（DESIGN.md 562-564 有解释）| 真症状：**应用层未充分体现 design system** · 不是 system 缺失 |

---

## 1. 用户诉求与解读

### 1.1 原话

> 第一：左侧小说创作 · DSAD 标题无用去除 → ✅ 已立即修（commit 427386c）
> 第二：网页视觉太过于简陋，你有提升前端视觉感受和操作感受的方案吗

### 1.2 关键词解码（v2 修正）

| 用户原词 | v1 解读（误）| v2 解读（正）|
|---|---|---|
| **简陋** | "design system 缺失" | **应用层未充分用 design system + 缺辅助组件 + 缺信息聚合 + 缺微动画/反馈** |
| **视觉感受** | "颜色 / 字体 / 空间不足" | **页面排版/留白节奏不一致 + Empty state 简陋 + 微动画零** |
| **操作感受** | "缺快捷键" | **路径长 + 无 Cmd+K + 无 Toast + 无 Skeleton + 无 status badge** |

### 1.3 出发点 vs 落地点（v2）

```
出发点：用户主观体验差 → "简陋"
落地点：在 DESIGN.md 既有体系内 · 推动 3 件事：
   A. 应用层贯彻（页面充分用 6 atoms · 不写裸 className）
   B. 辅助组件补全（6 atoms 之外：Toast / Tooltip / Skeleton）
   C. 信息架构升级（Home dashboard / Novel.tsx 拆解 / Sidebar badge / Command Palette）
约束：
   - 24 不变量全保（v5/v6/ui-v1）
   - DESIGN.md 全部硬约束严守（6 atoms 锁定 / token 优先 / typography 11 级 / 4 档 elevation）
   - Dexie schema 不动
```

---

## 2. 现状审计（v2 重写）

### 2.1 视觉系统：**已成熟** ✅

DESIGN.md 825 行 + src/index.css 7K 构成的 design system：

```
✅ 颜色：
   - 暖橙 primary 5 阶 · warm stone neutral 8 阶
   - 4 语义色（success #10b981 / warning #f59e0b / danger #e11d48 / info #3b82f6）
   - 语义角色 token（bg.canvas / surface / elevated · text.primary / secondary / muted）
   - 双主题（dark/light）通过 CSS 变量切换

✅ Typography 11 级阶梯：
   headingXl 28px / L 22px / M 18px / S 15px
   bodyL 16px / M 14px / S 13px
   bodyReading 17px serif（创作长文专用 · 读 720px 限宽）
   captionM 12px · labelM 11px upper · codeM 13px mono

✅ Spacing：
   inset (内 padding) + stack (元素间) 双语义
   主板块间距 ≥ stackXl (24px) · 列表 stackSm (8px)
   pageMarginX 24-32px · contentMaxWidth 1280px · readingMaxWidth 720px

✅ 圆角分档：
   button 6px / icon 方钮 8px / badge full
   input 8px / card 12px / modal 16px

✅ Elevation 4 档：
   flat（嵌入容器）/ raised（卡片浮起）/ floating（modal）/ lifted（顶层警告）
   暗主题 border 主 + 阴影辅 · 亮主题反之
```

### 2.2 组件层：**6 atoms 锁定** ⚠

```
现有 6 atoms（DESIGN.md 锁定 · "不要造第 7 个"）:
  ✅ Button (5 variants + iconOnly)：primary / secondary / outline / ghost / danger / iconOnly
  ✅ Input + Textarea
  ✅ Card + Card{Header,Title,Description,Body,Footer}
  ✅ Modal + Modal{Header,Title,Description,Body,Footer}
  ✅ NavItem + NavSectionLabel
  ✅ Tabs

应用层短板（这才是"简陋"真因）:
  ❌ 多处页面写裸 <button className="..."> 没用 <Button>
  ❌ 多处页面写裸 <div className="bg-white shadow rounded">  没用 <Card>
  ❌ 多处 modal 用 div + fixed overlay 自实现 · 没用 <Modal>
  ❌ form 控件用 native <input> 没用 <Input>
  ❌ Button.tsx:11-12 注释明确："Phase 4 重做页面时按需替换" → 这就是 ui-v2 PR-1 范围！

辅助组件缺口（6 atoms 之外 · 不冲突）:
  ❌ Toast（错误/成功反馈）· DESIGN.md 未涵盖
  ❌ Tooltip（hover 提示）
  ❌ Skeleton（loading 占位）
  ❌ Command Palette（Cmd+K）
  ❌ Empty state 组件
```

### 2.3 信息架构

```
现有：
  ✅ 路由 15 条（13 + ui-v1 新增 2）
  ✅ Sidebar 三组分隔（工具 / 资产 / 设置 · ui-v1 epic 落地）
  ✅ ProgressDashboard（gap-d epic · 项目内）
  ✅ /methods + /lessons（ui-v1 epic）

短板：
  ❌ Home 是项目列表 · 缺全局 dashboard（最近活动 / 待办 / 推荐）
  ❌ Novel.tsx 89K 单文件（已知技术债 · ui-v2 epic 计划）
  ❌ Sidebar 无 status badge（pending lessons / unread / API key 警告）
  ❌ Breadcrumb 缺失
```

### 2.4 交互模式

```
现有：
  ✅ React Router 6 hash router
  ✅ Zustand store · Dexie 持久化

短板：
  ❌ 无快捷键系统
  ❌ 无 Command Palette（Cmd+K）
  ❌ 无 Toast 通知（错误用 alert / inline · 成功无反馈）
  ❌ 无 Skeleton loading
  ❌ 无 hover/focus 微动画 token 应用（DESIGN.md 未明确动画规范 · 可补）
```

---

## 3. epic 拆分原则

### 3.1 边界划分（v2 微调）

```
ui-v2（应用层贯彻 + 信息架构）：
  - PR-1：应用层 audit + 替换裸 className → 6 atoms（Phase 4 重做页面）
  - PR-2：辅助组件补全（Toast / Tooltip / Skeleton · 6 atoms 之外）
  - PR-3：Home dashboard 重构
  - PR-4：Novel.tsx 拆解
  → 任务性质：贯彻既有 design system + 信息架构升级
  → 不动 DESIGN.md / src/index.css token 系统
  → 不需 LLM · 不动 schema

ui-v3（交互系统）：
  - PR-1：Command Palette + 快捷键
  - PR-2：Sidebar status badge + Toast 系统集成
  - PR-3：dogfood log + design-system 应用指南（不是新设计 · 是用法手册）
  → 任务性质：新功能 + 体验补全
  → 不动 DESIGN.md / src/index.css token 系统
  → 不需 LLM · 不动 schema
```

### 3.2 为何分两 epic（同 v1）

```
✅ ui-v2 是「重构」性质 · 改既有页面/组件 · 风险高
✅ ui-v3 是「新增」性质 · 加新功能 · 风险低
✅ 分开后 ui-v2 完成可独立 dogfood · 再启动 ui-v3
✅ BMAD 文档 epic-bound 清晰
```

---

## 4. ui-v2 epic preflight（v2 重写）

### 4.1 epic 概要

| 字段 | 值 |
|---|---|
| Epic ID | `ui-v2-application-layer-overhaul`（v2 改名 · 反映"应用层贯彻"性质）|
| 范围 | 应用层 audit + 辅助组件补全 + Home + Novel 拆解 |
| 工作量 | **~10-12h**（v1 估 13-16h · v2 减 3-4h）|
| PR 数 | 4 个 |
| 红线必保 | R-V2-1 ~ R-V2-10（v2 加 2 条 · 详见 4.3）|
| 用户感知 | UI 一致性提升 + 反馈及时 + Home 信息聚合 + Novel 文件可维护 |

### 4.2 PR 拆分（v2 重写）

#### PR-1 · 应用层 audit + 替换裸 className → 6 atoms（~3-4h）
```
目标：贯彻 DESIGN.md "Token 优先 · 永不写裸值" 第①规则

执行：
  1. grep 全仓 <button className="..."> · 替换为 <Button variant="...">
  2. grep 全仓 fixed overlay 模态自实现 · 替换为 <Modal>
  3. grep 全仓 native <input> · 替换为 <Input>
  4. grep 全仓 native <textarea> · 替换为 <Textarea>
  5. grep 全仓 div + bg-white + shadow · 评估替换为 <Card>

预期影响：
  - 替换点估计 30-50 处（多页面）
  - 不动 6 atoms 实现 · 仅替换调用方
  - vite build 0 errors（功能等价）
  - 视觉一致性立即提升

不做：
  - 不修改 6 atoms 本身
  - 不扩 Button 第 6 个 variant（违反 DESIGN.md 锁定）
  - 不写新 atom 组件
```

#### PR-2 · 辅助组件补全（Toast / Tooltip / Skeleton）（~2-3h）
```
目标：补 6 atoms 之外的辅助组件（DESIGN.md 未涵盖 · 不冲突锁定）

新增组件（src/components/ui/ 目录但非 atoms）:
  + src/components/feedback/Toast.tsx + src/store/toast.ts
  + src/components/feedback/Tooltip.tsx
  + src/components/feedback/Skeleton.tsx
  + src/components/feedback/EmptyState.tsx（empty list 通用占位 + illustration）

约束：
  - 全部用 DESIGN.md 既有 token（不引新 token）
  - Toast 用 token semantic.success/warning/danger/info
  - Tooltip 用 token elevation.floating + bg.surface
  - Skeleton 用 token bg.elevated + animate-pulse
  - 不替代 6 atoms · 不与之冲突

整合点：
  ~ 替换 5-10 处 alert / inline error → Toast
  ~ /methods + /lessons 列表 loading → Skeleton
  ~ 关键 button hover 加 Tooltip 说明
  ~ Empty state 通用化
```

#### PR-3 · Home dashboard 重构（~3-4h · 不变）
```
现 Home 是项目列表 · 升级为 dashboard 风格：
  - Hero 区：欢迎语 + 当前正在写的项目 + 快捷动作
  - 最近活动：最近 7 天 artifacts 时间线
  - 进度热图：所有项目章节完成度 grid（复用 ChapterCompletionGrid）
  - 待办：pending lessons / 未配 API key / 缺章节大纲
  - 推荐：基于使用频率推荐 method modules

影响文件：
  ~ src/pages/Home.tsx（12K → 拆为多组件）
  + src/components/home/HeroSection.tsx
  + src/components/home/RecentActivity.tsx
  + src/components/home/ProgressHeatmap.tsx
  + src/components/home/TodoList.tsx
  + src/components/home/Recommendations.tsx
  + src/store/homeAggregates.ts
```

#### PR-4 · Novel.tsx 拆解（~3-4h · 风险最高 · 不变）
```
89K 文件拆为：
  - src/pages/Novel.tsx（< 200 行 · layout + 组合）
  - src/components/novel/NovelHeader.tsx（< 150 行）
  - src/components/novel/NovelSidebar.tsx（< 250 行）
  - src/components/novel/NovelEditor.tsx（< 400 行）
  - src/components/novel/NovelPanels.tsx（< 300 行 · 内嵌 CharacterBible / MethodModulePanel / ReflectorLessonsPanel）
  - src/components/novel/NovelStepRunner.tsx（< 300 行）

R-V2-5 严守：所有内嵌 panel 路径不变（ui-v1 R-UI-1 严守）
```

### 4.3 ui-v2 红线（v2 加 2 条）

```
R-V2-1: 不修改 DESIGN.md（如需改 design system · 必须重新启动 design-vN epic 单独签字）
R-V2-2: 不修改 src/index.css token 配方（.btn-primary / .btn-secondary 等）
R-V2-3: 不修改 6 atoms 实现（Button / Input / Textarea / Card / Modal / NavItem / Tabs）
R-V2-4: 不新增第 7 个 atom（DESIGN.md 锁定）· 辅助组件放 src/components/feedback/ 与 atoms 隔离
R-V2-5: Novel.tsx 拆解后所有功能行为完全等价 · 内嵌 panel 路径保留（ui-v1 R-UI-1）
R-V2-6: 不动 router.tsx 路由表（CK I-1）
R-V2-7: 不动 Sidebar NavItem 路径（ui-v1 CK I-2）
R-V2-8: 不动 Dexie schema（v5/v6 CK）
R-V2-9: 应用层替换必须保持 className 包含的非 design 类不丢失（如 layout / responsive）
R-V2-10: PR-1 grep audit 必须穷尽 · 漏一处即认定 R-V2-9 违反
```

### 4.4 ui-v2 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| Novel.tsx 拆解破坏功能 | 🟠 high | 单独 PR · vite build + 逐功能手测 · 可回滚 |
| 应用层替换漏掉某处 | 🟡 mid | grep 双重 audit + dogfood 时全站走查 |
| 辅助组件与 6 atoms 风格不一致 | 🟡 mid | 强制用既有 token · code review 时审 |
| Home dashboard 数据聚合性能 | 🟡 mid | useMemo + Dexie 索引 |
| 工作量超估 | 🟢 low | 已含 30% buffer |

---

## 5. ui-v3 epic preflight（v2 微调）

### 5.1 epic 概要

| 字段 | 值 |
|---|---|
| Epic ID | `ui-v3-interaction-system` |
| 范围 | Command Palette + 快捷键 + Sidebar badge + Toast 集成 + design-system 应用指南 |
| 工作量 | **~10-12h** |
| PR 数 | 3 个 |
| 红线必保 | R-V3-1 ~ R-V3-7（v2 加 1 条）|

### 5.2 PR 拆分（v2 微调）

#### ui-v3 PR-1 · Command Palette + 快捷键（~4-5h · 不变）
```
+ src/components/CommandPalette.tsx（Cmd+K / Ctrl+K）
+ src/hooks/useKeyboardShortcuts.ts
+ src/store/commandPalette.ts（recent 历史）
~ src/components/Layout.tsx（注入 hook）
~ src/pages/Novel.tsx（章节 J/K 快捷键）

DESIGN.md 复用：
  - Command Palette 用 Modal 既有 atoms 包装（Modal floating + bg.surface + size.lg）
  - 列表项用 NavItem 风格
```

#### ui-v3 PR-2 · Sidebar badge + Toast 全站集成（~3-4h · 微调）
```
Sidebar status badge:
  - pending lessons 数（用 semantic.danger token + 不只靠颜色 · 加 icon）
  - unread artifacts 数
  - API key 警告（dot + 文字 · DESIGN.md ⑥规则严守 · 色盲友好）

Toast 全站集成（接 PR-2 ui-v2 的 Toast 组件）:
  - 替换 5-10 处 alert / inline error
  - 加 success 反馈（保存 / 删除 / 完成）
  - 注意：Toast 组件本身在 ui-v2 PR-2 落地 · 此 PR 仅集成

新增 store:
  + src/store/sidebarBadges.ts（聚合 unread）
```

#### ui-v3 PR-3 · dogfood log + design-system 应用指南（~2-3h · 改名）
```
不是新设计 · 是 DESIGN.md 应用指南：
  + docs/design-system/usage-application-layer.md（PR-1 audit 范例 + 反例）
  + docs/design-system/usage-feedback.md（Toast / Tooltip / Skeleton 用法）
  + docs/design-system/usage-shortcuts.md（Cmd+K + 快捷键手册）
  + docs/design-system/migration-checklist.md（裸 className → 6 atoms 检查表）

dogfood-log:
  ~ docs/dogfood-log.md 加 ui-v2 / ui-v3 epic section
```

### 5.3 ui-v3 红线（v2 加 1 条）

```
R-V3-1: Command Palette 不改路由表（CK I-1）· 仅是 navigation shortcut
R-V3-2: 快捷键不与浏览器原生冲突
R-V3-3: Sidebar badge 不改 NavItem 路径（ui-v1 CK I-2）
R-V3-4: Toast 替换 alert 不静默吞错（console.error 保留）
R-V3-5: Dexie schema 不变
R-V3-6: design-system docs 不改 src/* 代码
R-V3-7: Sidebar badge 必须遵守 DESIGN.md ⑥规则（语义色不单靠颜色 · 必须配 icon 或文字）
```

---

## 6. 跨 epic 共同关切

### 6.1 不变量审计（v5 8 + v6 8 + ui-v1 8 + DESIGN.md 强约束）

| 不变量来源 | 影响 ui-v2/v3 吗 | 措施 |
|---|---|---|
| **v5 epic** I-1 ~ I-8 | ❌ 不影响 | 视觉/交互层不动数据层 |
| **v6 epic** I-1 ~ I-8 | ❌ 不影响 | I-3 严守 |
| **ui-v1 epic** I-1 路由不变 | ⚠ 影响 | R-V2-6 严守 |
| **ui-v1 epic** I-2 NavItem 路径 | ⚠ 影响 | R-V2-7 + R-V3-3 严守 |
| **ui-v1 epic** I-3 ~ I-8 | ❌ 不影响 | / |
| **DESIGN.md** 6 atoms 锁定 | ⚠ 强影响 | R-V2-3 + R-V2-4 严守 |
| **DESIGN.md** Token 优先 | ⚠ 强影响 | R-V2-1 + R-V2-2 严守 |
| **DESIGN.md** 4 档 elevation | ⚠ 影响 | 辅助组件必须用 floating/lifted |
| **DESIGN.md** ⑥语义色配 icon | ⚠ 影响 | R-V3-7 严守 |

**结论**：24 不变量 + DESIGN.md 全约束 全保 · ui-v1 I-1/I-2 + DESIGN 6 atoms/token 重点监控

### 6.2 兼容性

```
✅ 旧浏览器：与现有持平
✅ 旧用户数据：localStorage / IndexedDB 完全不动
✅ 旧路由：URL 不变 · bookmark 兼容
✅ 旧 dogfood-log：累加 section · 不改既有
✅ DESIGN.md 现有用法点：PR-1 audit 仅替换 · 不破坏既有
```

---

## 7. 工作量分摊（v2 修正）

```
ui-v2 epic：~10-12h（v1 估 13-16h · 减 3-4h）
  PR-1：3-4h（应用层 audit · 替换裸 className 30-50 处）
  PR-2：2-3h（辅助组件 Toast/Tooltip/Skeleton/EmptyState）
  PR-3：3-4h（Home dashboard）
  PR-4：3-4h（Novel.tsx 拆解 · 风险最高）

ui-v3 epic：~10-12h
  PR-1：4-5h（Command Palette + 快捷键）
  PR-2：3-4h（Sidebar badge + Toast 集成）
  PR-3：2-3h（dogfood + design-system 应用指南）

总计：20-24h（v1 估 23-28h · 减 3-4h）
跨 session：3-5 个
```

---

## 8. Open Questions（v2 修正）

| # | 问题 | 默认答 | 用户可改 |
|---|---|---|---|
| Q1 | PR-1 audit 替换全做 vs 渐进做？ | 全做（一次性贯彻 · 避免长期混在）| 可分章批做 |
| Q2 | Toast 用自研 vs sonner？ | 自研（用 DESIGN.md token · 一致性最强）| 可换 sonner（外部依赖）|
| Q3 | Tooltip 用 Radix UI vs 自研？ | 自研（仅 hover · 不需要复杂 a11y · 减依赖）| 可换 Radix |
| Q4 | Skeleton 风格 shimmer 还是 pulse？ | pulse（DESIGN.md animate-pulse 既有 token）| 可加 shimmer |
| Q5 | Home dashboard 替代项目列表 vs 共存？ | 替代 | 可保留项目列表 tab |
| Q6 | Novel.tsx 拆解粒度（4 vs 6 文件）？ | 6 文件（每 < 400 行）| 可粗 4 文件 |
| Q7 | Command Palette 触发键 Cmd+K vs Ctrl+K？ | 双绑（OS 自适应）| / |
| Q8 | 快捷键 J/K vs ↑↓ ? | J/K（Notion/GitHub 同款）| 可改 ↑↓ |
| Q9 | Sidebar badge 数量 cap（10+ → "9+"）？ | 是（≥10 显示 "9+"）| 可改 99+ cap |
| Q10 | design-system 应用指南放 docs/design-system/ vs DESIGN.md 内？ | 独立目录（DESIGN.md 是规范 · 应用指南是用法）| 可合并 |

---

## 9. 用户签字栏（v2 重新签字）

### 9.1 签字格式

```
□ Stage 0 v2 preflight 接受 · 进入 Stage 2 双份 PRD/CA/CK 起草
□ Stage 0 v2 preflight 修改：[修改点]
□ Stage 0 v2 preflight 拒绝 · 不启动 ui-v2/v3

签字日期：2026-05-__
签字人：QvQ
```

### 9.2 签字后 Cascade 行动

```
立即（本 session 或下次）：
  1. 起草 docs/planning/prd-ui-v2-application-layer-overhaul.md（~400 行）
  2. 起草 docs/planning/codebase-analysis-ui-v2.md（~300 行）
     - 重点：grep 全仓裸 className 出现位置 · 量化替换工作量
  3. 起草 docs/planning/code-knowledge-ui-v2.md（10 不变量 · ~300 行）
  4. 起草 docs/planning/prd-ui-v3-interaction-system.md（~350 行）
  5. 起草 docs/planning/codebase-analysis-ui-v3.md（~250 行）
  6. 起草 docs/planning/code-knowledge-ui-v3.md（7 不变量 · ~250 行）
  7. 等用户分别签字 ui-v2 / ui-v3 Stage 2

跨 session：
  8. ui-v2 PR-1 ~ PR-4 逐个落地
  9. ui-v2 dogfood ≥ 3 天
  10. ui-v3 PR-1 ~ PR-3 逐个落地
  11. ui-v3 dogfood ≥ 3 天
  12. 双 epic 完整 dogfood-log section + close
```

---

## 10. 不变量预声明（v2 修正）

### ui-v2 epic 预定义 10 不变量（V2-I-1 ~ V2-I-10）

```
V2-I-1: DESIGN.md 不修改（design system 规范保持）
V2-I-2: src/index.css token 配方不修改
V2-I-3: 6 atoms 实现不修改 · 不新增第 7 个 atom
V2-I-4: 路由表不变（router.tsx · 15 条）
V2-I-5: NavItem 路径不变（Layout.tsx · 8 入口）
V2-I-6: Dexie schema 不变（v6 → 不升级 v7）
V2-I-7: Novel.tsx 拆解后功能等价 · 内嵌 panels 路径保留
V2-I-8: 应用层替换保持非 design 类（layout / responsive）不丢失
V2-I-9: 辅助组件放 src/components/feedback/ 与 atoms 隔离
V2-I-10: Home dashboard 不破坏项目创建/选择路径
```

### ui-v3 epic 预定义 7 不变量（V3-I-1 ~ V3-I-7）

```
V3-I-1: Command Palette 不改路由表 · 仅是 navigation shortcut
V3-I-2: 快捷键不与浏览器原生冲突
V3-I-3: Sidebar badge 不改 NavItem 路径
V3-I-4: Toast 替换 alert 不静默吞错
V3-I-5: Dexie schema 不变
V3-I-6: design-system 应用指南不改 src/* 代码
V3-I-7: Sidebar badge 遵守 DESIGN.md ⑥规则（语义色配 icon 或文字 · 色盲友好）
```

---

## 11. v1 → v2 关键改动汇总

```
删除（v1 有 · v2 删）：
  - "design token 扩充"（PR-1 v1 范围）
  - "shadcn/ui 选接 5 组件"（违反 6 atoms 锁定）
  - "Button variants 不全"（误判 · Button 已齐）
  - "色阶单调"（误判 · 暖橙 + warm stone 是品牌底调）

新增（v1 无 · v2 加）：
  - "应用层 audit + 替换裸 className → 6 atoms"（新 PR-1）
  - "辅助组件补全（Toast/Tooltip/Skeleton/EmptyState）"（新 PR-2）
  - V2-I-1 ~ V2-I-3（DESIGN.md / index.css / 6 atoms 不动）
  - V2-I-9（辅助组件目录隔离）
  - V3-I-7（Sidebar badge 色盲友好）
  - R-V2-9 + R-V2-10（应用层替换约束）

不变（v1 = v2）：
  - 双 epic 拆分（ui-v2 + ui-v3）
  - PR-3 Home dashboard
  - PR-4 Novel.tsx 拆解
  - ui-v3 PR-1 Command Palette + 快捷键
  - 24 不变量审计

工作量：
  - v1：23-28h
  - v2：20-24h（减 3-4h · 因 token 扩充被删）
```

---

> **下一步**：等待用户对 §9.1 v2 签字。
> 默认推荐：**接受 v2**（已修正 4 处偏差 · 与 DESIGN.md 全约束对齐）。
> 若用户对 §8 Q1-Q10 有偏好 · 在签字前指出。
