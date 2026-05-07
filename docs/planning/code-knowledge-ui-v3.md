# Code Knowledge · ui-v3 epic · 交互系统增强

> **BMAD Stage 2 · Code Knowledge 文档**
> 提议日期：2026-05-07 19:55
> Epic ID：`ui-v3-interaction-system`
> 上游：`docs/planning/codebase-analysis-ui-v3.md`
> 用途：定义 epic 期间不可变契约 · 锁定 7 不变量 · 提供机械化验证方法

---

## 1. 不变量清单（V3-I-1 ~ V3-I-7）

### V3-I-1 · Command Palette 不改路由表

```yaml
描述: |
  Command Palette 仅是 navigation shortcut · 不增删 router.tsx 中任何路由
  Cmd+K 跳转的目的地必须已在 router.tsx 注册
检测: |
  grep -c "path:" src/router.tsx  # 应保持 == 当前数（基线在 ui-v2 完成时）
  diff src/router.tsx@ui-v3-start src/router.tsx@ui-v3-end  # 期望空
违反影响: 路由耦合到 Command Palette · 维护噩梦 · ui-v1 I-1 违反
修正动作: 移除新增路由 · 通过既有路径跳转
关系: PRD R-V3-1 · ui-v1 CK I-1 · V2-I-6
```

### V3-I-2 · 快捷键不与浏览器原生冲突

```yaml
描述: |
  快捷键必须避开或主动 preventDefault 浏览器原生动作：
  避开：Ctrl+W (关闭 tab) · Ctrl+T (新 tab) · Ctrl+N (新窗口) · Ctrl+R (刷新)
  接管：Ctrl+S / Cmd+S (Save Page · ui-v3 用作保存) · Cmd+K (Find Address Bar 部分浏览器)
检测: |
  PR-1 useKeyboardShortcuts.ts 中所有键位列表
  对比浏览器原生键位表（Chrome / Firefox / Safari）
  审查：Ctrl+S / Cmd+K 必须 e.preventDefault()
违反影响: 用户体验破坏 · 浏览器关闭 / 刷新 / 新 tab 误触发
修正动作: 添加 preventDefault · 或换用其他键位
关系: PRD R-V3-2
```

### V3-I-3 · Sidebar badge 不改 NavItem 路径

```yaml
描述: |
  PR-2 Sidebar badge 仅在 NavItem 内扩展 children · 不改 to= 属性
  Layout.tsx 8 个 NavItem 的 path 全部保持
检测: |
  diff src/components/Layout.tsx@ui-v3-start src/components/Layout.tsx@ui-v3-end
  审查：to= 行无变化 · 仅 children 内多了 <SidebarBadge>
  grep "to=" src/components/Layout.tsx | wc -l  # 应 == 8
违反影响: ui-v1 I-2 + V2-I-7 违反 · 用户已 bookmark 的导航失效
修正动作: 恢复 to= · 仅扩展 children
关系: PRD R-V3-3 · ui-v1 CK I-2 · V2-I-7
```

### V3-I-4 · Toast 替换不静默吞错

```yaml
描述: |
  PR-2 替换 alert() → toast.error() 时 · 必须保留或新增 console.error()
  错误堆栈不能丢失（开发者调试需要）
检测: |
  PR-2 commit diff 中：每个 toast.error() 同 commit / 邻近行必有 console.error()
  示例：
    - alert('save failed: ' + err.message);
    + console.error('save failed', err);
    + toast.error(`保存失败：${err.message}`);
违反影响: 错误堆栈丢失 · debug 困难 · v6 R-V3-4 违反
修正动作: 补回 console.error
关系: PRD R-V3-4 · ui-v2 CK V2-I-9（替换保 layout 的精神延伸）
```

### V3-I-5 · Dexie schema 不变

```yaml
描述: src/store/db.ts 不升级 schema · 保持 v6（==dexie counter 7）
检测: |
  grep "version(" src/store/db.ts   # 应保持当前最高版本号
  diff src/store/db.ts              # stores 字符串不变
违反影响: 用户数据迁移异常 · v5/v6/V2-I-8 违反
修正动作: 恢复 db.ts
回退: git checkout src/store/db.ts
关系: PRD R-V3-5 · v5/v6 CK · V2-I-8
```

### V3-I-6 · design-system docs 不改 src/* 代码

```yaml
描述: |
  PR-3 仅新增 docs/design-system/ + 修改 docs/dogfood-log.md
  不修改任何 src/* 文件
检测: |
  PR-3 commit diff 中：所有 +/- 行必须在 docs/ 路径下
  审查：git diff <PR-3-commit> -- src/  # 期望空输出
违反影响: 文档 PR 越界改代码 · code review 红线
修正动作: 拆分代码改动到独立 commit / PR
关系: PRD R-V3-6
```

### V3-I-7 · Sidebar badge 遵守 DESIGN.md ⑥规则（语义色配 icon 或文字）

```yaml
描述: |
  Sidebar badge 必须满足色盲友好：
  - pending lessons 数字 badge：红色背景 + 数字文本（数字本身即文字 ✓）
  - API key 警告 dot：黄色背景 + AlertTriangle icon（icon 提供非颜色信号 ✓）
  - info badge：蓝色背景 + 数字文本 ✓
  禁止：仅红/黄/蓝点 · 无任何 icon / 文字
检测: |
  PR-2 SidebarBadge.tsx 实现审查：
  - 必须有 children prop（数字 / icon）
  - 不允许 <span className="bg-red-500 size-2 rounded-full" /> 这种纯色点
  色盲模拟测试：使用 Chrome DevTools Rendering > Emulate vision deficiencies
违反影响: 色盲用户无法识别 · DESIGN.md ⑥ 违反
修正动作: 给 badge 加 icon 或文字
关系: PRD R-V3-7 · DESIGN.md ⑥ "语义色不单靠颜色"
```

---

## 2. 关系矩阵

```
不变量             ｜ v5 8 ｜ v6 8 ｜ ui-v1 8 ｜ ui-v2 10 ｜ DESIGN.md ｜ 备注
──────────────────────────────────────────────────────────────────────────────
V3-I-1 路由不变    ｜  -   ｜  -   ｜  I-1   ｜  V2-I-6   ｜    -      ｜ 三重保护
V3-I-2 快捷键非冲突 ｜  -   ｜  -   ｜   -    ｜    -      ｜    -      ｜ ui-v3 独有
V3-I-3 NavItem 路径 ｜  -   ｜  -   ｜  I-2   ｜  V2-I-7   ｜    -      ｜ 三重保护
V3-I-4 不静默吞错  ｜  -   ｜  *   ｜   -    ｜  V2-I-9   ｜    -      ｜ 错误堆栈
V3-I-5 Dexie       ｜ I-2  ｜ I-2  ｜   -    ｜  V2-I-8   ｜    -      ｜ 四重保护
V3-I-6 docs 不改 src ｜ -  ｜  -   ｜   -    ｜    -      ｜    -      ｜ ui-v3 独有
V3-I-7 badge ⑥规则  ｜  -   ｜  -   ｜   -    ｜    -      ｜    ★      ｜ 色盲友好

★ 最高优先级
* v6 epic 错误堆栈保留精神
```

---

## 3. 验证方法（机械化）

### 3.1 PR-1 完成后

```bash
# V3-I-1: 路由表不变
git diff src/router.tsx
# 期望：空输出

grep -c "path:" src/router.tsx
# 期望：== ui-v2 完成时基线（15 条）

# V3-I-2: 快捷键不与浏览器冲突
# 审查：useKeyboardShortcuts.ts 所有键位
grep -E "key === '|metaKey|ctrlKey" src/hooks/useKeyboardShortcuts.ts
# 期望：每个 Cmd+S / Ctrl+S 后必有 preventDefault()

# Cmd+K 索引性能
# 实测：dev tools console.time
# 期望：< 50ms

# Modal/input focus 检测
grep -E "tagName.*INPUT|TEXTAREA|contentEditable" src/hooks/useKeyboardShortcuts.ts
# 期望：≥ 1 处（focus 检测逻辑）

# 全局监听单实例
grep "addEventListener" src/hooks/useKeyboardShortcuts.ts
grep "removeEventListener" src/hooks/useKeyboardShortcuts.ts
# 期望：成对出现（cleanup）
```

### 3.2 PR-2 完成后

```bash
# V3-I-3: NavItem 路径不变
diff <(git show ui-v3-start:src/components/Layout.tsx | grep "to=") \
     <(grep "to=" src/components/Layout.tsx)
# 期望：空（仅 children 不同 · path 不变）

# V3-I-4: console.error 保留
git log -p ui-v3-start..HEAD -- 'src/**/*.tsx' | grep -E "^\+.*toast.error|^\+.*console.error"
# 期望：每个 toast.error 行附近必有 console.error 行

# alert 计数
grep -c '\balert(' src/**/*.tsx src/**/*.ts
# 期望：== 0（从 9 → 0）

# success 反馈数
grep -c 'toast.success' src/**/*.tsx src/**/*.ts
# 期望：≥ 10（PRD 估 10-15 处）

# V3-I-7: badge 色盲友好
# 审查：SidebarBadge.tsx 必须有 children
grep -E "children|<.*Icon|<span>" src/components/SidebarBadge.tsx
# 期望：children prop 存在 + 接受 icon 或文字

# 色盲模拟手测
# Chrome DevTools > Rendering > Emulate vision deficiencies > Achromatopsia
# dogfood 验证：badge 仍可识别（数字 / icon 可见）
```

### 3.3 PR-3 完成后

```bash
# V3-I-6: docs 不改 src
git diff <PR-3-base>..HEAD -- 'src/'
# 期望：空输出

# docs/design-system/ 完整性
ls docs/design-system/*.md | wc -l
# 期望：== 5（README + 4 份 usage-*.md + migration-checklist）

# dogfood-log 累积
grep -c "## ui-v" docs/dogfood-log.md
# 期望：≥ 4（v5 + v6 + ui-v1 + ui-v2 + ui-v3 = 5 个 epic section）
```

### 3.4 epic 完成后（dogfood）

```
□ V3-D-1: vite build 0 errors
□ V3-D-2: 24 + 17 + 7 = 48 不变量 + DESIGN 全约束 全保
□ V3-D-3: Cmd+K 索引完整 · 模糊搜索准确 · recent 历史持久化
□ V3-D-4: J/K + S + Cmd+S + ? 全部正常 · 不与浏览器冲突
□ V3-D-5: Sidebar badge 色盲模式下仍可识别（DESIGN.md ⑥ 严守）
□ V3-D-6: 9 处 alert → 0（grep 验证）
□ V3-D-7: success 反馈 ≥ 10 处覆盖
□ V3-D-8: docs/design-system/ 5 份 docs 完整 · migration-checklist 可勾
□ V3-D-9: dogfood-log ui-v3 section 累积 ledger 准确
□ V3-D-10: 用户主观评估"操作流畅度 ≥ 8/10"（vs ui-v3 之前的 5/10）
```

---

## 4. 实施警示

### 4.1 PR-1 易踩雷点

```
⚠ 雷点 1: keydown 监听冲突
  document.addEventListener('keydown') 多个组件挂载多个 listener
  必须用 hook 单实例 + cleanup
  否则切换页面 listener 不释放 · 内存泄漏

⚠ 雷点 2: Modal/input focus 检测边界 case
  contenteditable 元素也算输入
  Novel.tsx 编辑器是 contenteditable · J/K 不能在编辑时触发章节切换
  检测：e.target.isContentEditable || tagName in ['INPUT', 'TEXTAREA']

⚠ 雷点 3: Cmd+K 在 Safari 与 Find 冲突
  Safari 没有 Cmd+K Find 默认 · 但部分浏览器有
  必须 e.preventDefault() · 同时不阻断 Cmd+F (Find)

⚠ 雷点 4: Command Palette 索引懒加载
  首次打开 · Dexie 查询不能阻塞 UI
  用 useEffect + Promise · 显示 Skeleton（ui-v2 PR-2 复用）

⚠ 雷点 5: recent 历史 localStorage 限额
  localStorage 5MB 限额 · 不能无限累积
  限制 recent 10 条 · LRU 淘汰

⚠ 雷点 6: ShortcutsHelpModal 触发 ?
  Shift+/ = ? · 只在无 input focus 时响应
  避免在 textarea 输入 ? 触发 modal
```

### 4.2 PR-2 易踩雷点

```
⚠ 雷点 1: alert 替换破坏阻塞行为
  if (saveFailed) { alert(...); return; } 是阻塞流程
  toast.error() 是非阻塞 · return 必须显式
  替换前后逻辑等价：
    - alert('保存失败'); return;
    + console.error('save failed', err);
    + toast.error('保存失败');
    + return;

⚠ 雷点 2: console.error 不能省（V3-I-4）
  toast.error('保存失败：' + err.message) 不能替代 console.error('save failed', err)
  err 对象包含堆栈 · 字符串 message 丢堆栈

⚠ 雷点 3: success 反馈不能滥用
  每次 setState 都 toast.success 会爆屏
  仅在用户主动操作（保存 / 删除 / 完成）后反馈
  不在自动保存（onBlur）后反馈（用户没期待）

⚠ 雷点 4: Sidebar badge 性能
  每次 render 重新查 Dexie 会卡
  用 zustand store + useEffect 订阅变化
  不在 Layout.tsx render 时直接 db.lessons.where().count()

⚠ 雷点 5: V3-I-7 严守（色盲友好）
  最常见违反：<span className="bg-red-500 size-2 rounded-full" />（仅红点）
  正确：<span className="bg-red-500 px-1.5 rounded-full text-white text-xs">{count}</span>
  或：<span className="bg-yellow-500 ..."><AlertTriangle className="size-3" /></span>
```

### 4.3 PR-3 易踩雷点

```
⚠ 雷点 1: V3-I-6 严守（不改 src）
  PR-3 应仅改 docs/ · 任何 src/ 改动必须 split 到独立 PR
  code review 时审：git diff -- 'src/' 应空

⚠ 雷点 2: docs/design-system/ 与 DESIGN.md 关系
  DESIGN.md = design system 规范（不可改 · V2-I-1）
  docs/design-system/ = 应用指南（可改 · 是用法手册）
  必须明确区分 · 不能让人误以为 docs/design-system/ 是 DESIGN.md 的扩展

⚠ 雷点 3: dogfood-log 累积 ledger 准确性
  ui-v3 完成后 · ledger = v5 8 + v6 8 + ui-v1 8 + ui-v2 10 + ui-v3 7 = 41 条
  + DESIGN.md 全约束 ★ 标记
  数错就违反 BMAD 累积一致性
```

---

## 5. dogfood 验证清单

```
PR-1 完成后 dogfood：
  □ Cmd+K (macOS) + Ctrl+K (Windows) 双绑测试
  □ 索引：路由 15 + 项目 N + 章节 M + lessons + modules + 动作
  □ 模糊搜索准确性："set" → "Settings" 第一位
  □ recent 历史 refresh 后保留（localStorage）
  □ Esc 关闭 · Enter 跳转
  □ J 下章 / K 上章（在 Novel 页 + 非 input focus）
  □ S 保存（仅非 input focus）+ Cmd+S 保存（任何时候）
  □ ? 显示快捷键手册（仅非 input focus）
  □ Modal/CommandPalette open 时全局快捷键禁用（除 Esc）
  □ contenteditable 焦点时 J/K 不响应（编辑章节内容）
  □ vite build 0 errors

PR-2 完成后 dogfood：
  □ pending lessons 数 badge 显示在 /lessons NavItem
  □ ≥ 10 显示 "9+"
  □ 点击 /lessons 进入后 · pending 减少 · badge 立即更新
  □ API key 未配 · /settings dot 显示
  □ 配上 API key 后 · dot 消失
  □ Chrome DevTools > Rendering > Emulate vision deficiencies > Achromatopsia
    → badge 仍可识别（数字 / icon 可见）
  □ 9 处 alert 全部 toast 化（grep 'alert(' 计数 == 0）
  □ console.error 全部保留（git log diff 验证）
  □ success 反馈在保存 / 删除 / 完成处显示（10-15 处）
  □ Toast 复用 ui-v2 PR-2 既有组件 · 风格一致

PR-3 完成后 dogfood：
  □ docs/design-system/ 5 份 docs 创建
  □ usage-application-layer.md 阅读测试（PR-1 范例 + 反例清晰）
  □ usage-feedback.md 阅读测试（Toast/Tooltip/Skeleton 用法清晰）
  □ usage-shortcuts.md 阅读测试（键位列表 + 冲突表）
  □ migration-checklist.md 可勾选（GitHub markdown 任务列表语法）
  □ dogfood-log.md ui-v2 + ui-v3 section 累积 ledger 准确
  □ git diff -- 'src/' 应空（V3-I-6）
```

---

## 6. 后续 epic 依赖契约

```
未来 ACE Layer 2/3 epic：
  → 可在 Cmd+K 加 "Curator: 重新整理" 动作
  → 通过 commands 数组扩展索引（接口稳定）
  → V3-I-1 严守：不增 router

未来 v7+ epic（layer 2 readerLayer counter）：
  → 可在 sidebar 加 reader counter badge
  → 复用 SidebarBadge 组件 + sidebarBadges store
  → V3-I-3 严守：to= 不改 · 仅 children 扩展

未来 design-vN epic：
  → 必须基于 docs/design-system/ 应用指南扩展
  → 不冻结 DESIGN.md（V2-I-1）就不能动 design-system 规范
  → docs/design-system/ 是应用层指南 · 与 DESIGN.md 规范分离
```

---

## 7. 总结

```
✅ 7 不变量定义清晰 · 全部机械化可验证
✅ 与 v5 / v6 / ui-v1 / ui-v2 / DESIGN.md 全约束兼容（41 → 48 累积）
✅ 3 个 PR 易踩雷点提前列出
✅ dogfood 清单覆盖所有 PR + DESIGN.md ⑥ 色盲友好严守
✅ 后续 epic 契约清晰（ACE Layer 2/3 / v7 / design-vN）
✅ 强制时序：ui-v2 完成 → dogfood 3+ 天 → ui-v3 启动
✅ Stage 2 ui-v3 三件套（PRD + CA + CK）齐全 · 等用户签字
```
