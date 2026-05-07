# Preflight · ui-v2 + ui-v3 · 视觉系统 + UX 大改造（合并 epic）

> **BMAD Stage 0 · preflight 文档**
> 提议日期：2026-05-07 18:50
> 提议者：Cascade
> 用户诉求：原话「网页视觉太过于简陋，你有提升前端视觉感受和操作感受的方案吗」
> 预计工作量：**~25-30h**（跨 4-6 个 session · 用户已签字「同时启动 ui-v2 + ui-v3」）
> 状态：⏳ 等待用户 Stage 0 签字
> 后续阶段：Stage 2 拆分 PRD/CA/CK 双份（每 epic 一份）→ Stage 3 PR 实施
> 同期生效不变量：v5 8 + v6 8 + ui-v1 8 = 24 条 · 全部必须严守

---

## 1. 用户诉求与解读

### 1.1 原话

> 第一：左侧小说创作 · DSAD 标题无用去除 → ✅ 已立即修（commit 待）
> 第二：网页视觉太过于简陋，你有提升前端视觉感受和操作感受的方案吗

### 1.2 关键词解码

| 用户原词 | 解读 | 改造维度 |
|---|---|---|
| **简陋** | 视觉无层次 · 配色单调 · 缺细节打磨 | 视觉系统层 |
| **视觉感受** | 颜色 / 字体 / 空间 / 阴影 / 微动画 | 视觉系统层 + 组件库层 |
| **操作感受** | 输入流畅 / 反馈及时 / 路径短 / 快捷键 | 交互系统层 |

### 1.3 出发点 vs 落地点

```
出发点：用户主观体验差 → "简陋"
落地点：分层改造 · 不动底层数据 · 仅升级 UI 表达层
约束：24 不变量全保 + dogfood-log 一致性 + Dexie schema 不动
```

---

## 2. 现状审计

### 2.1 视觉系统

```
现有资产：
  ✅ Tailwind CSS（按 design token 驱动）
  ✅ tailwind.config.ts ~7K · 已定义 primary / canvas / fg-* / border-subtle
  ✅ Lucide icons（充裕）
  ✅ design token 命名规范：text-body-m / text-caption-m / size-N

短板：
  ❌ 色阶单调：仅 primary 一色 + neutral 灰阶 · 无 accent / success / warning 多色
  ❌ 阴影几乎不用 · 卡片扁平 · 无层次感
  ❌ 圆角一刀切（rounded-md 通用）· 缺 chip/card/modal 三档
  ❌ 留白偏紧（p-2 / p-3）· 信息密度高 · 透不过气
  ❌ 微动画零 · transition-all 极少 · 切换硬
  ❌ Empty state 多为纯文字 · 无 illustration · 像未完成
  ❌ Skeleton loading 缺失 · 仅 Loader2 spinner
  ❌ Toast 系统缺失 · 错误用 alert / inline error · 成功无反馈
```

### 2.2 组件库

```
现有资产：
  ✅ src/components/ui.tsx（统一原子组件 NavItem / NavSectionLabel / Button / Card 等）
  ✅ 自研组件（CharacterBible / ReflectorLessonsPanel 等业务组件 · 风格一致）

短板：
  ❌ Button variants 不全（缺 ghost / outline / danger / icon-only）
  ❌ Card hover/active 状态弱 · 无 lift effect
  ❌ Modal 风格朴素 · 无 backdrop blur · 无入场动画
  ❌ Form 控件用 native（input/select/textarea 浏览器默认样式）
  ❌ 无 Tooltip / Popover / 通用 Dialog 组件
  ❌ 无 Command Palette（Cmd+K 全局搜索）
```

### 2.3 信息架构

```
现有资产：
  ✅ 路由 15 条（13 + ui-v1 新增 2）
  ✅ Sidebar 三组分隔（工具 / 资产 / 设置）
  ✅ ProgressDashboard（gap-d epic · 项目内 dashboard）
  ✅ /methods + /lessons 全局浏览（ui-v1 epic）

短板：
  ❌ Home 页是项目列表 · 缺全局 dashboard（最近活动 / 待办 / 推荐）
  ❌ Novel.tsx 89K 单文件（289 行/4500+ 字 · 难维护 · 已知技术债）
  ❌ Sidebar 无 status badge（pending lessons 数 / unread 数）
  ❌ Breadcrumb 缺失 · 多层路由不易定位
```

### 2.4 交互模式

```
现有资产：
  ✅ React Router 6 · hash router
  ✅ Zustand store 全局状态
  ✅ Dexie 持久化

短板：
  ❌ 无快捷键系统（J/K 上下章 · S 保存 · / search · ? 帮助）
  ❌ 无 Command Palette（Cmd+K）· 路径长
  ❌ 无 Toast 通知 · 错误反馈生硬
  ❌ 无操作 undo（除 liveRefinementUndo · 仅润色作用域）
  ❌ 缺动画反馈（保存 / 删除 / 完成 步骤）
```

---

## 3. epic 拆分原则

### 3.1 边界划分

```
ui-v2（视觉系统 + 信息架构）：
  - Phase 1：design token 扩充
  - Phase 2：组件库升级（含 shadcn/ui 选接）
  - Phase 3：信息架构（Home dashboard + Novel.tsx 拆解）
  → 任务性质：基础设施 + 重构 · 影响面广
  → 不需 LLM · 不动 schema

ui-v3（交互系统）：
  - Phase 4：交互层（Command Palette + 快捷键 + Toast + Skeleton）
  - Phase 5：design system docs（一致性长期）
  → 任务性质：新功能 + 体验补全 · 不动既有逻辑
  → 不需 LLM · 不动 schema
```

### 3.2 为何分两 epic 而非合一

```
✅ ui-v2 是「重构」性质 · 改既有页面/组件 · 风险高 · 需逐 PR 验证
✅ ui-v3 是「新增」性质 · 加新功能 · 风险低 · 可批量
✅ 分开后 · ui-v2 完成可独立 dogfood + 用户验证视觉 · 再启动 ui-v3
✅ 单 epic 25h+ 跨 5+ session 风险高 · 拆开后每 epic ~12-15h
✅ BMAD 文档 epic-bound · 每 epic 一份 PRD/CA/CK · dogfood-log section 也清晰
```

### 3.3 为何不延迟 ui-v3

```
用户口头明确「同时启动 ui-v2 + ui-v3」· 不希望分两次决策
本 preflight 一次性覆盖两 epic 范围 + 红线 + 风险
Stage 2 时拆双份 PRD/CA/CK · Stage 3 PR 时 ui-v2 完成后再启动 ui-v3
```

---

## 4. ui-v2 epic preflight

### 4.1 epic 概要

| 字段 | 值 |
|---|---|
| Epic ID | `ui-v2-information-architecture-overhaul` |
| 范围 | Phase 1（token）+ Phase 2（组件库）+ Phase 3（Home + Novel 拆解）|
| 工作量 | **~13-16h** |
| PR 数 | 4 个（PR-1 token / PR-2 组件库 / PR-3 Home / PR-4 Novel 拆解）|
| 红线必保 | R-V2-1 ~ R-V2-8（见 4.3）|
| 用户感知 | UI 立即"精致"很多 · Home 有信息聚合 · Novel 文件可维护 |

### 4.2 PR 拆分

#### PR-1 · design token 扩充（~3-4h）
```
新增 src/styles/tokens.css 或扩 tailwind.config.ts:
  - 色阶：primary 5阶 + accent + success/warning/danger 各 3 阶
  - 阴影：shadow-sm / md / lg / xl 4 档
  - 圆角：rounded-chip(2px) / rounded-card(8px) / rounded-modal(16px)
  - 字体：layered text-display/title/body/caption
  - 中文字体栈："PingFang SC" / "思源黑体" / system-ui
  - 微动画 token：transition-fast(150ms) / -base(200ms) / -slow(300ms)

升级 src/components/ui.tsx:
  - Button variants: primary / ghost / outline / danger / icon-only
  - Card: hover lift（transform 1px + shadow 升 1 档）
  - Typography 组件：H1 / H2 / H3 / Body / Caption（标准化）

影响文件：
  ~ tailwind.config.ts
  ~ src/components/ui.tsx
  ~ src/styles/index.css（如有）
  + src/styles/tokens.css（新增）
  + src/components/typography.tsx（新增 · 可选）
```

#### PR-2 · shadcn/ui 选接（~3-4h）
```
选接 5 个组件：
  - Toast（替代 alert / inline error · ui-v3 也用）
  - Dialog（升级 modal · backdrop blur + animation）
  - Tooltip（鼠标 hover 提示）
  - Popover（替代 dropdown）
  - Skeleton（替代 Loader2 · 提升感知速度）

不引入：
  - shadcn Button（已有 ui.tsx Button · 不替）
  - shadcn Form（侵入太深）
  - shadcn Table（无需）

影响文件：
  + src/components/ui/toast.tsx 等（shadcn 复制粘贴）
  + src/components/ui/index.ts（统一 export）
  ~ 现有 modal 用法点（10-15 处）替换为新 Dialog
  ~ 现有 alert 用法点（5-10 处）替换为 Toast
```

#### PR-3 · Home dashboard 重构（~4-5h）
```
现 Home 是项目列表 · 升级为 dashboard 风格：
  - Hero 区：欢迎语 + 当前正在写的项目 + 快捷动作
  - 最近活动：最近 7 天 artifacts 操作时间线
  - 进度热图：所有项目的章节完成度 grid
  - 待办：pending lessons / 未配 API key / 缺章节大纲
  - 推荐：基于使用频率推荐 method modules

影响文件：
  ~ src/pages/Home.tsx（12K → 拆为多组件）
  + src/components/home/HeroSection.tsx
  + src/components/home/RecentActivity.tsx
  + src/components/home/ProgressHeatmap.tsx
  + src/components/home/TodoList.tsx
  + src/components/home/Recommendations.tsx
  + src/store/homeAggregates.ts（聚合查询）
```

#### PR-4 · Novel.tsx 拆解（~3-4h · 风险最高）
```
89K 文件拆为：
  - src/pages/Novel.tsx（< 200 行 · 仅 layout + 组合）
  - src/components/novel/NovelHeader.tsx（< 150 行 · 顶部 toolbar）
  - src/components/novel/NovelSidebar.tsx（< 250 行 · 章节列表）
  - src/components/novel/NovelEditor.tsx（< 400 行 · 编辑器）
  - src/components/novel/NovelPanels.tsx（< 300 行 · 右侧面板组合 · 内嵌 CharacterBible / MethodModulePanel / ReflectorLessonsPanel）
  - src/components/novel/NovelStepRunner.tsx（< 300 行 · LLM step 触发）

R-V2 红线：所有内嵌 panel 路径不变（CK ui-v1 R-UI-1 严守）
影响文件：
  ~ src/pages/Novel.tsx（89K → 多文件 < 400 行）
  + src/components/novel/*.tsx（5 个新文件）
```

### 4.3 ui-v2 红线

```
R-V2-1: design token 扩充必须向后兼容 · 所有现有 className 不破坏
R-V2-2: shadcn/ui 仅选接 · 不全套引入 · 不替换现有 ui.tsx 组件
R-V2-3: Home dashboard 必须保留项目创建/选择功能（用户依赖路径）
R-V2-4: Novel.tsx 拆解后 · 所有现有功能行为完全等价（functional parity）
R-V2-5: Novel.tsx 拆解后 · 所有内嵌 panel 路径保留（ui-v1 R-UI-1 严守）
R-V2-6: 不动 router.tsx 路由表（CK I-1 严守）
R-V2-7: 不动 Sidebar NavItem 路径（ui-v1 CK I-2 严守）
R-V2-8: 不动 Dexie schema（v5/v6 CK 严守）
```

### 4.4 ui-v2 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| Novel.tsx 拆解破坏功能 | 🟠 high | PR-4 单独提交 · vite build 后逐功能验证 · 可回滚 |
| shadcn/ui 与现有 ui.tsx 风格冲突 | 🟡 mid | PR-2 选接 5 个 · 隔离命名空间 · 风格 audit |
| Home dashboard 数据聚合性能 | 🟡 mid | homeAggregates.ts 用 useMemo + Dexie 索引 |
| design token 扩充影响现有 className | 🟡 mid | 仅扩充 · 不删现有 · 添加新 token 不冲突 |
| 工作量超估 | 🟢 low | 已含 30% buffer |

---

## 5. ui-v3 epic preflight

### 5.1 epic 概要

| 字段 | 值 |
|---|---|
| Epic ID | `ui-v3-interaction-system` |
| 范围 | Phase 4（交互层）+ Phase 5（design system docs）|
| 工作量 | **~10-12h** |
| PR 数 | 3 个（PR-1 Command Palette + 快捷键 / PR-2 Sidebar badge + Toast / PR-3 dogfood + docs）|
| 红线必保 | R-V3-1 ~ R-V3-6（见 5.3）|
| 用户感知 | Cmd+K 直达任意页 · 快捷键提速 · 反馈及时 · 系统手册可查 |

### 5.2 PR 拆分

#### ui-v3 PR-1 · Command Palette + 快捷键（~4-5h）
```
新增组件：
  - src/components/CommandPalette.tsx（Cmd+K / Ctrl+K 触发）
  - 索引内容：路由 15 条 + 项目 N 个 + 章节 M 个 + lessons + method modules
  - 模糊搜索 + recent 历史 + 分组显示

新增快捷键 hooks：
  - src/hooks/useKeyboardShortcuts.ts
  - 全局快捷键：J/K 上下章节 · / focus search · S 保存 · ? 显示快捷键
  - 局部快捷键：Esc 关 modal · Enter 确认

影响文件：
  + src/components/CommandPalette.tsx
  + src/hooks/useKeyboardShortcuts.ts
  + src/store/commandPalette.ts（recent 历史持久化）
  ~ src/components/Layout.tsx（注入 hook）
  ~ src/pages/Novel.tsx（注入章节快捷键）
```

#### ui-v3 PR-2 · Sidebar badge + Toast 系统（~3-4h）
```
新增 Sidebar status badge：
  - pending lessons 数（红色小圆 + 数字）
  - unread artifacts 数（如 N3.x 有新 run）
  - API key 警告（如未配）
  
全站 Toast 替换：
  - 升级 src/store/toast.ts（zustand）
  - 替换 5-10 处 alert / inline error → toast
  - 替换 success 反馈（保存 / 删除 / 完成）

影响文件：
  + src/store/toast.ts（zustand toast queue）
  + src/components/ToastContainer.tsx（如 PR-2 ui-v2 没接）
  ~ src/components/Layout.tsx（badge 显示）
  ~ src/store/sidebarBadges.ts（聚合 unread 数）
  ~ 多处替换 alert / inline error
```

#### ui-v3 PR-3 · dogfood log + design system docs（~2-3h）
```
新增文档：
  - docs/design-system/README.md（设计系统总览）
  - docs/design-system/colors.md（色阶用法）
  - docs/design-system/typography.md（字体层级）
  - docs/design-system/components.md（组件用法 + 截图）
  - docs/design-system/shortcuts.md（快捷键手册）

补充 dogfood-log:
  - docs/dogfood-log.md 增 ui-v2 epic section
  - docs/dogfood-log.md 增 ui-v3 epic section
  - 每 PR 验证条目 + 累积 ledger + 红线审计
```

### 5.3 ui-v3 红线

```
R-V3-1: Command Palette 不破坏现有路由表（CK I-1）· 仅是导航快捷
R-V3-2: 快捷键不与浏览器原生冲突（避开 Ctrl+W / Ctrl+T 等）
R-V3-3: Sidebar badge 不改 NavItem 路径（ui-v1 CK I-2）
R-V3-4: Toast 系统替换 alert · 但保留功能等价（不静默吞错）
R-V3-5: 不动 Dexie schema（v5/v6 CK 严守）
R-V3-6: design system docs 不修改任何 src/* 代码
```

### 5.4 ui-v3 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| Cmd+K 索引量大性能差 | 🟡 mid | 使用 fuse.js 模糊搜索 · 限 500 条 · 异步加载 |
| 快捷键冲突浏览器 | 🟡 mid | 仅用单字母 + 安全组合（Cmd+K / J/K / / / S）|
| Toast 替换破坏既有错误处理 | 🟠 high | 逐处 audit · 不静默吞 error · 保留 console.error |
| Sidebar badge 数据聚合性能 | 🟢 low | useMemo + Dexie 索引 |

---

## 6. 跨 epic 共同关切

### 6.1 24 不变量审计（v5 8 + v6 8 + ui-v1 8）

| 不变量来源 | 影响 ui-v2/v3 吗 | 措施 |
|---|---|---|
| **v5 epic** I-1 ~ I-8（schema / readerLayer / fallback）| ❌ 不影响 | 视觉/交互层不动数据层 |
| **v6 epic** I-1 ~ I-8（reflector / 阈值 / I-3 method module zero-modify）| ❌ 不影响 | I-3 严守（design system docs 不动 method module）|
| **ui-v1 epic** I-1 路由不变 | ⚠ 影响 | R-V2-6 严守 |
| **ui-v1 epic** I-2 NavItem 路径 | ⚠ 影响 | R-V2-7 + R-V3-3 严守 |
| **ui-v1 epic** I-3 method module zero-modify | ❌ 不影响 | / |
| **ui-v1 epic** I-4 ~ I-8 | ❌ 不影响 | / |

**结论**：24 不变量全保 · 仅 ui-v1 I-1/I-2 需重点监控

### 6.2 兼容性

```
✅ 旧浏览器：Tailwind / shadcn 都现代浏览器优先 · 与现有持平
✅ 旧用户数据：localStorage / IndexedDB 完全不动
✅ 旧路由：URL 不变 · bookmark 兼容
✅ 旧 dogfood-log：累加 section · 不改既有
```

---

## 7. 工作量分摊

### 7.1 总预算

```
ui-v2 epic：~13-16h
  PR-1：3-4h（design token + Button/Card/Typography）
  PR-2：3-4h（shadcn 选接 5 组件）
  PR-3：4-5h（Home dashboard）
  PR-4：3-4h（Novel.tsx 拆解 · 风险最高）

ui-v3 epic：~10-12h
  PR-1：4-5h（Command Palette + 快捷键）
  PR-2：3-4h（Sidebar badge + Toast）
  PR-3：2-3h（dogfood + design system docs）

总计：23-28h（合用户预期 25-30h）
跨 session：4-6 个（每 session 4-5h）
```

### 7.2 推荐节奏

```
Session A（本 session 后）：
  - Stage 0 preflight 用户签字
  - Stage 2 双份 PRD/CA/CK 起草
  - 用户分别签字 ui-v2 / ui-v3 Stage 2

Session B（最近）：
  - ui-v2 PR-1 design token + Button/Card
  - ui-v2 PR-2 shadcn 选接

Session C：
  - ui-v2 PR-3 Home dashboard

Session D：
  - ui-v2 PR-4 Novel.tsx 拆解（风险最高 · 单独 session）

Session E（dogfood ≥ 3 天后）：
  - ui-v3 PR-1 Command Palette + 快捷键

Session F：
  - ui-v3 PR-2 Sidebar badge + Toast
  - ui-v3 PR-3 dogfood + design system docs
```

---

## 8. 决策点 / Open Questions

| # | 问题 | 默认答 | 用户可改 |
|---|---|---|---|
| Q1 | shadcn/ui 选接 5 组件够吗？ | 是（Toast/Dialog/Tooltip/Popover/Skeleton）| 可加 Tabs / Accordion |
| Q2 | 中文字体栈用 PingFang/思源还是更倾向 Inter？ | PingFang SC + 思源黑体（中文项目优先）| 可改 Inter + Noto Sans CJK |
| Q3 | Home dashboard 是否替代项目列表 vs 共存？ | 替代（升级为 dashboard）| 可保留项目列表 tab |
| Q4 | Novel.tsx 拆解粒度（4 文件 vs 6 文件）？ | 6 文件（每文件 < 400 行）| 可粗粒度 4 文件 |
| Q5 | Command Palette 触发键 Cmd+K vs Ctrl+K？ | 双绑（按 OS 自适应）| / |
| Q6 | 快捷键 J/K 章节切换 · 与 vim 用户偏好相符吗？ | 是（业界 Notion/GitHub 都用）| 可改 ↑↓ |
| Q7 | Toast 系统是用 shadcn Toast 还是 sonner？ | shadcn Toast（与 PR-2 一致）| 可换 sonner |
| Q8 | design system docs 用 Markdown 还是 Storybook？ | Markdown（轻量 · 与现有 docs/ 一致）| 可加 Storybook |

---

## 9. 用户签字栏

### 9.1 签字格式

```
□ Stage 0 preflight 接受 · 进入 Stage 2 双份 PRD/CA/CK 起草
□ Stage 0 preflight 修改：[修改点]
□ Stage 0 preflight 拒绝 · 不启动 ui-v2/v3

签字日期：2026-05-__
签字人：QvQ
```

### 9.2 签字后 Cascade 行动

```
立即：
  1. 起草 docs/planning/prd-ui-v2-information-architecture.md（~400 行）
  2. 起草 docs/planning/codebase-analysis-ui-v2.md（~300 行）
  3. 起草 docs/planning/code-knowledge-ui-v2.md（8 不变量 · ~300 行）
  4. 起草 docs/planning/prd-ui-v3-interaction-system.md（~350 行）
  5. 起草 docs/planning/codebase-analysis-ui-v3.md（~250 行）
  6. 起草 docs/planning/code-knowledge-ui-v3.md（6 不变量 · ~250 行）
  7. 等用户分别签字 ui-v2 / ui-v3 Stage 2

跨 session：
  8. ui-v2 PR-1 ~ PR-4 逐个落地（每个 PR commit + 我自检 + 用户验证）
  9. ui-v2 dogfood ≥ 3 天 · 用户主观验证
  10. ui-v3 PR-1 ~ PR-3 逐个落地
  11. ui-v3 dogfood ≥ 3 天
  12. 双 epic 完整 dogfood-log section + close
```

---

## 10. 不变量预声明（Stage 2 时正式定义）

### ui-v2 epic 预定义 8 不变量（V2-I-1 ~ V2-I-8）

```
V2-I-1: 路由表不变（router.tsx · 15 条路由保持）
V2-I-2: NavItem 路径不变（Layout.tsx · 8 入口 path 保持）
V2-I-3: Dexie schema 不变（v6 → 不升级到 v7）
V2-I-4: Novel.tsx 拆解后所有功能行为等价（functional parity）
V2-I-5: 内嵌 panels 路径保留（CharacterBible / MethodModulePanel / ReflectorLessonsPanel）
V2-I-6: design token 仅扩充 · 不删既有
V2-I-7: shadcn 选接 5 组件 · 不替换 ui.tsx 既有
V2-I-8: Home dashboard 不破坏项目创建/选择路径
```

### ui-v3 epic 预定义 6 不变量（V3-I-1 ~ V3-I-6）

```
V3-I-1: Command Palette 不改路由表 · 仅是 navigation shortcut
V3-I-2: 快捷键不与浏览器原生冲突
V3-I-3: Sidebar badge 不改 NavItem 路径
V3-I-4: Toast 替换 alert · 不静默吞错（console.error 保留）
V3-I-5: Dexie schema 不变
V3-I-6: design system docs 不改 src/* 代码（CK I-3 类比）
```

---

> **下一步**：等待用户对 §9.1 签字。
> 默认推荐：**接受**（plan 已审视 24 不变量 · 风险标注清晰 · 工作量符合用户预期）。
> 若用户对 §8 的 Q1-Q8 有偏好 · 在签字前指出。
