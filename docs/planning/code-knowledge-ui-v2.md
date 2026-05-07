# Code Knowledge · ui-v2 epic · 应用层贯彻 + 信息架构升级

> **BMAD Stage 2 · Code Knowledge 文档**
> 提议日期：2026-05-07 19:35
> Epic ID：`ui-v2-application-layer-overhaul`
> 上游：`docs/planning/codebase-analysis-ui-v2.md`
> 用途：定义 epic 期间不可变契约 · 锁定 10 不变量 · 提供机械化验证方法

---

## 1. 不变量清单（V2-I-1 ~ V2-I-10）

### V2-I-1 · DESIGN.md 不修改

```yaml
描述: docs/DESIGN.md 在 ui-v2 epic 期间 zero-modify
检测: git diff DESIGN.md   # 应输出空
违反影响: 破坏 design system 规范 · 用户对色彩/字体/spacing 心智失效
修正动作: 立即 git checkout DESIGN.md
回退: 删除任何修改 commit
关系: PRD R-V2-1 · preflight v2 §10.1
```

### V2-I-2 · src/index.css token 配方不修改

```yaml
描述: src/index.css 中 .btn-* / @apply token 配方 zero-modify
检测: git diff src/index.css   # 应输出空
违反影响: 6 atoms 视觉行为变化 · 全站 button/card/modal 渲染异常
修正动作: 立即 git checkout src/index.css
回退: 删除任何修改 commit
关系: PRD R-V2-2 · DESIGN.md ① "Token 优先"
例外: 若 PR-2 辅助组件需要新 token · 必须 add-only · 在末尾追加 · 不改既有
```

### V2-I-3 · 6 atoms 实现不修改

```yaml
描述: src/components/ui/{Button,Input,Textarea,Card,Modal,NavItem,Tabs}.tsx zero-modify
检测: |
  git diff --stat src/components/ui/  # 仅 index.ts 可加 export · 其他文件不动
违反影响: 已知 6 atoms 接口变化 · ui-v1 + 既有所有页面回归测试失败
修正动作: 立即 git checkout 对应文件
回退: 删除任何修改 commit
关系: PRD R-V2-3 · DESIGN.md "6 atoms 锁定 · 不要造第 7 个"
```

### V2-I-4 · 不新增第 7 个 atom

```yaml
描述: src/components/ui/ 目录下不新增 .tsx 文件（除 index.ts）
       辅助组件（Toast/Tooltip/Skeleton/EmptyState）必须放 src/components/feedback/
检测: |
  ls src/components/ui/*.tsx   # 应保持 7 个文件（含 NavSectionLabel 在 NavItem.tsx 内）
违反影响: 破坏 DESIGN.md 6 atoms 锁定 · 长期组件爆炸
修正动作: 移动新 atom 到 src/components/feedback/
回退: 移动文件 + 删除原文件
关系: PRD R-V2-4 · preflight v2 §10.1
```

### V2-I-5 · Novel.tsx 拆解功能等价

```yaml
描述: |
  PR-4 Novel.tsx 拆解后 · 所有 props/接口/state 流向不变
  内嵌 panels（CharacterBible / MethodModulePanel / ReflectorLessonsPanel / ProgressDashboard）路径保留
检测: |
  完整 dogfood 章节流程：
  - 创建项目 → 写 N3.1 → 跑 N3.2 → 跑 N3.3 → CharacterBible → ReflectorLessons
  - 所有功能行为完全等价
违反影响: 用户写作流程中断 · 数据丢失风险（state 流向错乱）
修正动作: 立即回滚 PR-4 commit
回退: git revert <PR-4-commit>
关系: PRD R-V2-5 · ui-v1 R-UI-1
```

### V2-I-6 · 路由表不变

```yaml
描述: src/router.tsx 路由表保持 15 条（13 + ui-v1 新增 2）· 不删 不改 path
检测: |
  grep -c "path:" src/router.tsx   # 应保持 == 当前数（基线在 PR-1 起算）
违反影响: 已 bookmark 的 URL 失效 · ui-v1 epic I-1 违反
修正动作: 恢复 router.tsx
回退: git checkout src/router.tsx
关系: PRD R-V2-6 · ui-v1 CK I-1
```

### V2-I-7 · NavItem 路径不变

```yaml
描述: src/components/Layout.tsx 中 8 个 NavItem 的 to= 属性保持
       （/ /analyzer /refinery /playground /kb /methods /lessons /settings）
检测: |
  grep "to=" src/components/Layout.tsx | wc -l   # 应 ≥ 8
  diff 替换前后 · path 列表完全一致
违反影响: 用户右侧栏导航中断 · ui-v1 I-2 违反
修正动作: 恢复 Layout.tsx 的 to= 属性
回退: git checkout src/components/Layout.tsx
关系: PRD R-V2-7 · ui-v1 CK I-2
```

### V2-I-8 · Dexie schema 不变

```yaml
描述: src/store/db.ts 不升级 schema · 保持 v6
检测: |
  grep "version(" src/store/db.ts   # 应保持当前最高版本号 == v6 (= 7 in dexie counter)
  git diff src/store/db.ts          # stores 字符串不变
违反影响: 用户既有数据迁移异常 · v5/v6 epic CK I-2 违反
修正动作: 恢复 db.ts
回退: git checkout src/store/db.ts
关系: PRD R-V2-8 · v5/v6 CK
```

### V2-I-9 · 应用层替换保持非 design 类

```yaml
描述: |
  PR-1 替换裸 className 为 6 atoms 时 · 必须保留 className 中的非 design 类：
    - layout 类（mt-4 / flex-1 / gap-2 等）
    - responsive 类（sm:hidden / md:flex 等）
    - 第三方库类（如 react-syntax-highlighter）
检测: |
  PR-1 commit diff 中 · className 减号行的非 design 部分必须出现在加号行
  示例：
    - className="px-4 py-2 bg-orange-500 mt-4 flex-1"
    + <Button variant="primary" className="mt-4 flex-1">
违反影响: 替换后 layout 错位 · 视觉回归
修正动作: 补回非 design 类
回退: git revert + 重新 audit
关系: PRD R-V2-9 · DESIGN.md ① "Token 优先"
```

### V2-I-10 · Home dashboard 不破坏项目创建/选择路径

```yaml
描述: |
  PR-3 Home 升级后 · 用户仍可：
  - 看到所有项目列表（Hero 区或独立 section）
  - 创建新项目（按钮可达）
  - 切换项目（点击跳转）
检测: |
  dogfood 验证：
  - 新用户首次访问 Home · 看到"+ 新建项目"CTA
  - 已有项目用户 · 能看到所有项目并切换
违反影响: 用户无法创建/切换项目 · 核心流程中断
修正动作: 恢复 Home 项目创建/选择 UI
回退: git revert PR-3 commit
关系: PRD R-V2 + preflight v2 §10.1
```

---

## 2. 关系矩阵

```
不变量             ｜ v5 8 ｜ v6 8 ｜ ui-v1 8 ｜ DESIGN.md ｜ 备注
─────────────────────────────────────────────────────────────────
V2-I-1 DESIGN      ｜  -   ｜  -   ｜   -    ｜    ★      ｜ 严守 design 规范
V2-I-2 index.css   ｜  -   ｜  -   ｜   -    ｜    ★      ｜ 严守 token 配方
V2-I-3 6 atoms 实现 ｜  -   ｜  -   ｜   -    ｜    ★      ｜ 严守组件锁定
V2-I-4 不加 atom    ｜  -   ｜  -   ｜   -    ｜    ★      ｜ 严守组件锁定
V2-I-5 Novel 等价   ｜  *   ｜  *   ｜  R-UI-1 ｜   -      ｜ * v5 reader tab + v6 ReflectorPanel
V2-I-6 路由表       ｜  -   ｜  -   ｜  I-1   ｜   -      ｜ ui-v1 严守
V2-I-7 NavItem      ｜  -   ｜  -   ｜  I-2   ｜   -      ｜ ui-v1 严守
V2-I-8 Dexie        ｜  I-2 ｜  I-2 ｜   -    ｜   -      ｜ v5/v6 add-only
V2-I-9 替换保 layout ｜  -   ｜  -   ｜   -    ｜    ★      ｜ 应用层细节
V2-I-10 Home 创建   ｜  -   ｜  -   ｜   -    ｜   -      ｜ 用户路径

★ 最高优先级 · 任一违反即冻结 epic
```

---

## 3. 验证方法（机械化）

### 3.1 PR-1 完成后

```bash
# 不变量检测脚本（可写入 .windsurf/workflows/verify-ui-v2.md）

# V2-I-1: DESIGN.md zero-modify
git diff DESIGN.md
# 期望：空输出

# V2-I-2: src/index.css 不破坏（仅可 add-only）
git diff src/index.css
# 期望：仅有 + 行 · 无 - 行（除非删 stale comment）

# V2-I-3: 6 atoms 实现不动
git diff src/components/ui/Button.tsx src/components/ui/Input.tsx src/components/ui/Textarea.tsx src/components/ui/Card.tsx src/components/ui/Modal.tsx src/components/ui/NavItem.tsx src/components/ui/Tabs.tsx
# 期望：空输出

# V2-I-4: 不加 atom
ls src/components/ui/*.tsx | wc -l
# 期望：== 7 (基线)

# V2-I-9: 替换保 layout 类（手动 review 每 PR-1 commit）
git diff <PR-1-commit> | grep '^-.*className=' -A 1
# 验证 - 行的 layout 类是否在 + 行出现

# 应用层替换效果验证
grep -r '<button[^>]*className=' src/ --include='*.tsx' | wc -l
# 期望：< 30（从 97 → < 30 · 30% 残留是 disabled / icon-only / link 等合理保留）
```

### 3.2 PR-2 完成后

```bash
# V2-I-4: 辅助组件目录隔离
ls src/components/feedback/*.tsx
# 期望：≥ 4 文件（Toast/Tooltip/Skeleton/EmptyState）

# 辅助组件不引新 token
grep -E 'rgb\(|#[0-9a-f]{3,6}' src/components/feedback/*.tsx
# 期望：空输出（仅用 token class）

# Toast 接 console.error（不静默）
grep 'console.error' src/store/toast.ts
# 期望：≥ 1 处
```

### 3.3 PR-3 完成后

```bash
# V2-I-10: Home 创建路径
grep -E '新建项目|new project|create project' src/pages/Home.tsx src/components/home/*.tsx
# 期望：≥ 1 处

# Home 文件大小
du -k src/pages/Home.tsx
# 期望：≤ 6K（从 12K → 拆为多组件）

# home/ 目录组件数
ls src/components/home/*.tsx | wc -l
# 期望：== 5 (HeroSection/RecentActivity/ProgressHeatmap/TodoList/Recommendations)
```

### 3.4 PR-4 完成后

```bash
# V2-I-5: Novel.tsx 大小
du -k src/pages/Novel.tsx
# 期望：≤ 10K（从 89K → ~5K）

# novel/ 目录组件数
ls src/components/novel/*.tsx | wc -l
# 期望：== 5 (NovelHeader/NovelSidebar/NovelEditor/NovelPanels/NovelStepRunner)

# 内嵌 panels 路径检查
grep -E 'CharacterBible|MethodModulePanel|ReflectorLessonsPanel|ProgressDashboard' src/components/novel/NovelPanels.tsx
# 期望：4 个组件 import + 使用 都在 NovelPanels.tsx

# 单文件 < 400 行
wc -l src/components/novel/*.tsx
# 期望：每文件 < 400
```

### 3.5 epic 完成后（dogfood）

```
□ V2-D-1: vite build 0 errors · 1945+ modules
□ V2-D-2: 24 不变量 + DESIGN 全约束 全保（机械化脚本通过）
□ V2-D-3: dogfood 完整章节流程无回归
□ V2-D-4: <button className= 计数从 97 → < 30
□ V2-D-5: <input className= 计数从 18 → < 5
□ V2-D-6: alert(...) 计数从 5-10 → 0
□ V2-D-7: Home dashboard 5 区块全显示 + 数据准确
□ V2-D-8: Novel.tsx 拆解后 React DevTools 无 unnecessary re-render
□ V2-D-9: 用户主观评估"视觉一致性 ≥ 8/10"（vs ui-v2 之前的 5/10）
□ V2-D-10: 用户主观评估"反馈及时性 ≥ 8/10"（toast / skeleton 加分）
```

---

## 4. 实施警示

### 4.1 PR-1 audit 易踩雷点

```
⚠ 雷点 1: <button> 不只是 button · 有些是 link 伪装
  示例：<button onClick={() => navigate('/x')} className="...">link 文字</button>
  应处理：评估是否改为 <Link to="/x"> 或保留 <Button>

⚠ 雷点 2: variant 误判
  primary CTA · 一个页面 ≤ 1 个（DESIGN.md ② Don'ts）
  PR-1 audit 时若发现一个页面有 5 个 primary button · 必须重新分配 variant

⚠ 雷点 3: disabled / loading 状态保留
  替换前后 · disabled / loading prop 必须保留
  原 native button：<button disabled={!ready}>
  替换后：<Button disabled={!ready}> 或 <Button loading={running}>

⚠ 雷点 4: focus / keyboard 行为
  替换后 focus ring + keyboard nav 必须工作
  Button 组件已包含 · 但 audit 时验证是否被自定义 className 覆盖
```

### 4.2 PR-2 易踩雷点

```
⚠ 雷点 1: Toast 与 alert() 行为差异
  alert() 是阻塞同步 · Toast 是异步非阻塞
  替换时若代码逻辑依赖"用户必须先看到错误才能继续"· 需用 Modal 替代 · 不是 Toast

⚠ 雷点 2: console.error 不能省
  toast.error('保存失败') 不能替代 console.error('save failed', err)
  错误堆栈必须保留在 console（开发者调试）

⚠ 雷点 3: Tooltip 与 a11y
  Tooltip 应用 aria-describedby · 不能仅靠 hover
  键盘 focus 时也应显示
```

### 4.3 PR-3 易踩雷点

```
⚠ 雷点 1: 数据聚合性能
  Home 每次访问都跑聚合 · 必须 useMemo
  否则切换页面卡顿

⚠ 雷点 2: 时段欢迎语本地化
  早上好 / 下午好 / 晚上好 · 用 new Date().getHours()
  注意时区（用户 OS 时区即可 · 无需后端）

⚠ 雷点 3: Empty state（新用户）
  无项目时显示 EmptyState + "+ 新建项目" CTA
  不能渲染空 dashboard
```

### 4.4 PR-4 易踩雷点（最关键）

```
⚠ 雷点 1: state 流向（最危险）
  Novel.tsx 89K 中 · state 可能跨 sub-component 流动
  拆解前必须用 React DevTools 摸清所有 useState / useReducer / zustand subscribe
  拆解后 props 接口必须保持

⚠ 雷点 2: useEffect 依赖丢失
  拆解后 · useEffect 依赖数组可能丢失某些变量
  React 19 的 react-compiler 会警告 · 但不一定准
  必须手动 review 每个 useEffect

⚠ 雷点 3: 内嵌 panel 路径
  CharacterBible / MethodModulePanel / ReflectorLessonsPanel / ProgressDashboard
  必须仍在 NovelPanels.tsx 内（接口不变）
  拆解破坏路径 = ui-v1 R-UI-1 违反 = 全 epic 失败

⚠ 雷点 4: LLM step 触发
  N3.1 / N3.2 / N3.3 触发逻辑 · v6 reflector hook 都在 NovelStepRunner.tsx
  拆解时不能动 prompt manifest / runner 调用
```

---

## 5. dogfood 验证清单

```
PR-1 完成后 dogfood：
  □ 启动 dev · 进 Screenplay 页 · 视觉与 ui-v2 之前一致 + 风格统一
  □ 进 Intake 页 · 同上
  □ Top 6 文件 button focus ring · disabled · loading 全测
  □ vite build 0 errors

PR-2 完成后 dogfood：
  □ Toast 4 类型显示（success/warning/danger/info）+ 自动消失 / 手动关
  □ Tooltip 4 方向（top/right/bottom/left）显示
  □ Skeleton 在 /methods + /lessons 加载时显示
  □ EmptyState 在新用户首次访问 /methods + /lessons 显示

PR-3 完成后 dogfood：
  □ Home 5 区块全显示
  □ Hero 时段欢迎语正确（早/午/晚/深夜）
  □ 项目创建 + 切换路径正常
  □ 推荐 method modules 准确（基于使用频率）
  □ 数据聚合 < 200ms（console.time 验证）

PR-4 完成后 dogfood（最关键）：
  □ Novel 完整流程：创建 → 写 N3.1 → 跑 N3.2 → 跑 N3.3
  □ CharacterBible 内嵌面板 · reader / timeline / relations 三 tab 都正常
  □ MethodModulePanel 内嵌 · module 选择 + injectsTo 显示正常
  □ ReflectorLessonsPanel 内嵌 · pending lessons + 详情 modal 正常
  □ ProgressDashboard 内嵌 · 章节进度 grid 正常
  □ 章节切换 / 拖拽排序 / 保存 / 删除 全测
  □ vite build 0 errors
  □ React DevTools 无 unnecessary re-render
  □ V2-I-5（Novel 等价）+ V2-I-3（6 atoms 不动）严守
```

---

## 6. 后续 epic 依赖契约

```
ui-v3 epic（紧接启动）：
  → ui-v3 PR-2 复用 ui-v2 PR-2 的 Toast 组件（接口稳定）
  → ui-v3 PR-2 Sidebar badge 接 ui-v2 PR-3 的 homeAggregates store
  → ui-v3 必须严守 V2-I-1 ~ V2-I-10（这些不变量持续生效）

v7 epic（layer 2 readerLayer counter）：
  → v7 在 NovelPanels.tsx 内嵌的 CharacterBible 上加 reader counter
  → 拆解后 · v7 改动局限在 src/components/CharacterBible.tsx · 不需碰 Novel.tsx
  → ui-v2 PR-4 拆解大幅降低了 v7 实施风险

ACE Layer 2/3 epic（自动 Curator）：
  → 在 NovelStepRunner.tsx 加自动 Curator 调用
  → 拆解后 · 改动局限 · 不需碰整个 Novel.tsx
  → ui-v2 PR-4 拆解为 ACE Layer 2/3 铺路

design-vN epic（如未来需要改 design system）：
  → 必须先冻结 ui-v2 / ui-v3 epic
  → 重新启动 design-vN preflight + Stage 2 + 用户重新签字
  → V2-I-1 / V2-I-2 / V2-I-3 在 design-vN epic 期间豁免（仅此 epic）
```

---

## 7. 总结

```
✅ 10 不变量定义清晰 · 全部机械化可验证
✅ 与 v5 / v6 / ui-v1 / DESIGN.md 全约束兼容
✅ 4 个 PR 易踩雷点提前列出
✅ dogfood 清单覆盖所有 PR
✅ 后续 epic 契约清晰（ui-v3 / v7 / ACE Layer 2/3 / design-vN）
✅ Stage 2 三件套（PRD + CA + CK）齐全 · 等用户签字进 Stage 3 PR-1
```
