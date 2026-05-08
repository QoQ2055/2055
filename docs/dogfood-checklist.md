# Dogfood 自测清单（2026-05-08 ui-v6 PR-7 push 节点 · commit pending）

> 本文档汇总 2026-05-07/08 三 session 内完成的 15 个 PR 的所有 US-* 用户手测场景。最新六节：⑧ ui-v6 PR-1 Studio Calm A.1-A.4 (4 commit) · ⑨ ui-v6 PR-2 动效闭环 (1 commit) · ⑩ ui-v6 PR-3 Studio Calm C.1+C.2 (2 commit) · ⑪ ui-v6 PR-5 /lessons + /kb hero header (1 commit) · ⑫ token sweep bg-surface-N + brand-N (2 commit) · ⑬ ui-v6 PR-7 bundle code-split (1 commit)。
>
> 来源：`docs/dogfood-log.md` 各 PR 节的"dogfood 用户手测项"。本文档是**单页可勾选汇总** · 跑完后把结果写回 `dogfood-log.md` 对应 PR 节的 erratum 子节。
>
> **跑完顺序建议**：① 启动 `npm run dev` → ② 顶部 epic 总览快速跑一遍 → ③ 重点跑标记"必测"的 US 子项 → ④ 发现 bug 立即停 + 反馈给 AI 协作者。

---

## 启动准备

```powershell
cd C:\Users\QvQ\CascadeProjects\fili-web
npm run dev
# → http://127.0.0.1:5173
```

打开浏览器 DevTools（F12）· 准备：

- [ ] Console 面板（看 console.error / warn 是否有新增）
- [ ] Network 面板（验证导出离线 / 0 outbound）
- [ ] Application → IndexedDB → fili-web → artifacts（验证导出零 IDB 写）

---

## ① ui-v3 PR-1 MVP · Command Palette · commit `64fc359`

### US-CP1 · 触发 + 关闭

- [ ] Cmd+K（mac）或 Ctrl+K（win）→ 命令面板从顶部弹出
- [ ] 输入"小说" → 命中"小说工坊" → ↑↓ 选中 → Enter → URL 变化为 `/novel`
- [ ] 再次 Cmd+K → 输入"home" → Enter → URL 变 `/`
- [ ] Cmd+K → Esc → 关闭 · 不路由跳转
- [ ] Cmd+K → 点遮罩外 → 关闭

### US-CP2 · 输入态例外

- [ ] 在 NewProjectDialog 标题 input 内按 Cmd+K → 仍打开命令面板（modifier 例外）
- [ ] 在 NovelSettingsDialog textarea 内按 Cmd+K → 同上

### US-CP3 · sidebar 触发按钮

- [ ] sidebar 底部 "⌘K 命令面板" 按钮 → 点击 → 命令面板打开
- [ ] 该按钮 hover 状态有 `text-fg-muted → text-fg-secondary` 切换

### US-CP4 · 不变量回归

- [ ] 11 个 nav/tools 命令全部跳转正常（首页/小说/剧本/改编/知识库/拆书/润色/调试/方法论/lessons/设置）
- [ ] Toast 仍可用
- [ ] vite build 0 errors（实测：`npx vite build`）

---

## ② ui-v3 PR-1B · 完整快捷键 + Handbook · commit `394977b` + `29cbe7b`

### US-S1 · 全局快捷键

- [ ] Cmd+S / Ctrl+S → 浏览器原生"保存页面"对话框**不弹** · 屏幕右上角 toast"已自动保存 · 所有改动实时持久化到本地 IndexedDB"
- [ ] ?（Shift+/）→ 快捷键手册 modal 弹出 · 显示全局组（Cmd+K / ? / Cmd+S / Esc）+ Novel 组（J / K）
- [ ] 在 input 内按 ? → 应正常输入 "?" 字符 · 不弹手册
- [ ] 手册 Esc 或点遮罩 → 关闭
- [ ] mac 显示 "Cmd" · Windows 显示 "Ctrl"（UA 自适应）

### US-S2 · Novel 页 J/K（必测）

前置：进入有 ≥ 2 章的 novel 项目（跑到 N3.1 完成）

- [ ] 不点 input · 按 J → selectedChapterIdx +1（左侧章节列表高亮变化）
- [ ] 连按 J 到末章 → **不超过 chapters.length**
- [ ] 按 K → -1 · 连按到第 1 章**不跌破 1**
- [ ] 在 Best-of-N input focus 时按 J → 应正常输入 "j" · 不切章节
- [ ] Cmd+J 或 Shift+J → 不切章节（仅纯 J 触发）

---

## ③ ui-v3 PR-2 · Sidebar Status Badge · commit `8b16d3b`

### US-B1 · /lessons pending badge

前置：在某项目内触发 reflector lessons（或手动构造 N3 lessons pending）

- [ ] 不在 /lessons 页 → sidebar "Reflector Lessons" 右侧显示**红色数字 badge**
- [ ] ≥ 10 显示 "9+"
- [ ] 进入 /lessons · approve 一条 → badge 数立即 -1（**不需等 10s 轮询**）
- [ ] approve/reject 全部 → badge 自动消失（count=0 不渲染）

### US-B2 · /settings warning dot

- [ ] 清空 settings.apiKey → /settings 项右侧出现**黄色圆点**
- [ ] 配置 key 保存 → 圆点立即消失

### US-B3 · 切项目刷新

- [ ] 项目 A 有 pending lessons · 项目 B 无 → sidebar 显示 A 的 badge
- [ ] 切到 B → ≤ 1s 内 badge 消失

---

## ④ ui-v3 PR-1C · ConfirmDialog · commit `434946a` + `86f8305`

### US-C1 · 基础交互

- [ ] /home 删除一个历史项目 → 弹**红色** ConfirmDialog · 确认按钮"删除"是 danger 红色
- [ ] Esc → 关闭 · 项目未删
- [ ] 再次 → Enter → 关闭 · 项目已删 + toast 反馈
- [ ] 再次 → 点遮罩外 → 关闭 · 项目未删
- [ ] /home 点归档（**普通操作**）→ 确认按钮"归档"是 primary **蓝色**（非红）

### US-C3 · 全站 17 处迁移完整性（必测 · 抽测 5 处）

抽测以下 5 处 · 全部应弹 ConfirmDialog（**不弹浏览器原生**）：

- [ ] /home 删除历史项目
- [ ] /home 归档活动项目
- [ ] /novel toolbar "撤销所有章节批准状态"
- [ ] /express clearAll
- [ ] /screenplay 清理遗留 screenplay.* 产物

### US-C4 · 不变量

- [ ] alert() 全站 0 个真实调用：
      ```powershell
      Get-ChildItem src -Recurse -Include '*.ts','*.tsx' | Select-String -Pattern '(?<![a-zA-Z\.])alert\('
      → 仅注释引用 · 0 真实调用
      ```
- [ ] confirm() 全站 0 个真实调用（仅 store/confirm.ts API）：
      ```powershell
      Get-ChildItem src -Recurse -Include '*.ts','*.tsx' | Select-String -Pattern '(?<![a-zA-Z\.])confirm\('
      → 仅 src/store/confirm.ts + src/components/ConfirmDialog.tsx + Layout.tsx 注释 + Home.tsx 4 处 await confirm({...})
      ```

---

## ⑤ gap-e PR-1 · 创作产物导出 · commit `e66b584`

### US-E1 · 小说 .md / .docx（必测）

前置：进入 ≥ 2 章已完成的 novel 项目

- [ ] /novel toolbar 点"导出…" → 抽屉从右滑入 · 宽 420px · 6 项 · "小说 · Markdown" 在最上
- [ ] 点 ".md" → 浏览器下载 `<项目名>-YYYYMMDD.md`
- [ ] 用 VSCode 打开 → 标题层级正确（# h1 项目名 · ## h2 第 N 章）· 段落空行
- [ ] 文件头有"导出于 ... · 共 N 章 · 约 M 字 · 润色稿/草稿"
- [ ] 点 ".docx" → 下载 → 用 **Word 2016+ 打开** → 标题样式正确 · 中文不乱排 · 章节间分页
- [ ] **如 Word 提示"是否转换格式"** → 记 erratum（启用 docx.js 退路）

### US-E2 · 剧本 .fdx / .fountain（必测）

前置：进入有 screenplay.7（或 adapt.6）的项目

- [ ] /screenplay toolbar 点"下载剧本…"（FileDown icon · 与"进入资产阶段"区分）
- [ ] 点 ".fdx" → 用 Final Draft 8/9/10/11 打开 → **5 类元素识别正确**（场景头/动作/人物/对白/转场）
- [ ] **如启发式分类失误**（人物→action 等）→ 记 erratum（gap-e PR-3 调启发式）
- [ ] 点 ".fountain" → 用 Highland / Trelby / Fountain VSCode 插件打开 → 同上 + Title page 正确

### US-E3 · 资产 .csv（必测）

前置：进入有 assets.2/3/4 任一的项目

- [ ] /home 或 /screenplay 点导出 → 选 "资产清单 · Excel" → 下载
- [ ] 用 **Microsoft Excel 桌面版**（不是 Office 365 Web）打开
- [ ] 中文不乱码（BOM 起作用）
- [ ] 第一列"分类"取值"角色 / 场景 / 道具"
- [ ] 列头"分类,名称,描述,视觉风格,关联场次,其他属性"
- [ ] 含逗号 / 引号的字段正确转义

### US-E4 · disabled + 错误处理

- [ ] 新建空项目 → /home "导出…"按钮**本身**应 disabled
- [ ] 仅 novel.6 无 .7 → 小说 .md/.docx 启用 · 文件头标"草稿"· 剧本 .fdx/.fountain disabled
- [ ] 故意损坏 assets.2 content（dev console 写非 JSON）→ 点 .csv → 仅跳过 .2 · 仍导出 .3/.4
- [ ] console.error 有 `[exportFormats] parseLooseArray failed` 痕迹

### US-E5 · 不变量回归

- [ ] /screenplay "进入资产阶段"按钮（exportToAssets · navigate('/assets')）仍工作
- [ ] /home 历史项目 Download icon 导出 .flil.json 仍工作
- [ ] DevTools Network · 录制导出全过程 → **0 outbound request**
- [ ] DevTools IDB · 导出前后 `db.artifacts.count()` **不变**

---

## ⑥ gap-e PR-2 · ExportDrawer 全局 + Cmd+K 联动 · commit `991646d`

### US-EE1 · Cmd+K 调起导出（必测）

- [ ] 任意页面 Cmd+K → 输入"导出"或"export"或"md" → 命中 3 条 actions 类命令
- [ ] 选"导出产物…" Enter → 抽屉滑入（mode='all'）
- [ ] "导出小说…" → mode='novel'·小说类排在最上
- [ ] "下载剧本…" → mode='screenplay'·剧本类排在最上

### US-EE2 · 工具栏与命令面板联动

- [ ] /novel toolbar "导出…"按钮 → 抽屉打开
- [ ] **不关闭**抽屉 · Cmd+K → 命令面板叠在抽屉之上正常工作（z-index 不冲突）
- [ ] 切换路由（/novel → /home）→ 抽屉**仍显示**（全局挂载 · 不卸载）

### US-EE3 · 单实例

- [ ] 任意页面打开抽屉 → 关闭后再次点击/Cmd+K → 抽屉重新打开（不卡死）

---

## ⑦ ui-v4 PR-1 · 主题切换 · commit `b0b39da`

### US-T1 · Cmd+K 切换主题（必测）

- [ ] Cmd+K → "亮"或"light" → Enter → 整个 UI 立即变亮 + toast"已切换到亮色主题"
- [ ] Cmd+K → "暗" → Enter → 变暗
- [ ] Cmd+K → "系统"或"system" → Enter → toast"主题已设为跟随系统"

### US-T2 · Settings segment

- [ ] /settings 顶部"主题外观"区块 · 3 档按钮（亮色/暗色/跟随系统）
- [ ] 当前选中态用 primary tint 高亮
- [ ] 点其它档 → 立即生效

### US-T3 · FOUC 验证（关键体验）

- [ ] 设 theme='light' → **刷新页面**（Ctrl+R）→ 第一帧就是亮色 · **不应闪一下暗色再变亮**
- [ ] 反之 light → 设 dark → 刷新 → 第一帧暗

### US-T4 · System 模式实时跟随

- [ ] 设 theme='system'
- [ ] 在 OS 切换主题（mac 系统偏好/Win 设置）→ fili **不刷新页面**也应实时跟随 · ≤ 200ms

### US-T5 · 持久化

- [ ] 设 theme='light' → 关闭浏览器标签页 → 重新打开 fili → 主题保持 light（不退化到 dark）

---

## ⑧ ui-v6 PR-1 · Studio Calm A.1-A.4 · commits `4a9ba58` `fe30f17` `c3fd315` `2053f1d`

### US-A1 · Modal 微动效（必测）

- [ ] Cmd+K 打开命令面板 → 面板 fade + 微 scale 进场（150ms · 不刺眼）
- [ ] ? 打开快捷键手册 → 进场动效一致
- [ ] 删除归档项目 → ConfirmDialog 进场动效一致
- [ ] 任意 NewProjectDialog / AdaptIntakeWizard 等使用 Modal atom 的地方 → 进场动效一致
- [ ] 系统开启"减少动态效果"（mac/Win 辅助功能）→ 刷新 → 4 modal 瞬现无动效（prefers-reduced-motion 兜底）

### US-A2 · Home 重排（必测）

- [ ] / 路由 · header 顶部看到 ✦ 'Filmcraft Studio' uppercase 装饰
- [ ] 有产物的活动项目 · ActiveProjectCard 背景有 mode accent 微渐变 · 数字栏（产物/原作章节/分钟）大字 mono 显示带分隔线
- [ ] 4 mode counts 紧凑卡片在 active 卡片**下方**（不再在底部）
- [ ] 4 个 QuickActionCard 已变为紧凑工具条（横向 icon + label · 不再两行）
- [ ] 历史项目 hover · 行底色微变 · 行高比 v5 高
- [ ] 底部不再出现重复的 mode counts grid
- [ ] 整页 max-w 拓宽 · 间距加大 · 视觉密度 -25%

### US-A3 · Novel toolbar 收纳（必测）

前置：进入任意 novel 项目

- [ ] 顶部 toolbar 默认仅看到"中止 / 导出 / 项目首页 + 齿轮按钮"
- [ ] 点击齿轮 → 展开折叠区 · 看到完整 Best-of-N + 反思裁判 + 硬批准闸控件 · 折叠区有 fade+scale 进场动效
- [ ] 开启 Best-of-N + 反思 + 硬批准闸 → 关闭折叠区（再点齿轮）→ toolbar 出现 "🎯 ×3 反思" + "🛡 硬闸" 两个状态徽章
- [ ] aria-expanded 切换：DevTools 选中齿轮按钮 · aria-expanded="true/false" 跟随
- [ ] 不影响实际运行：Best-of-N 开启时 N1.1 仍并行 N 候选 + LLM 裁判（功能不动）

### US-A4 · Sidebar 折叠 Cmd+B（必测）

- [ ] 任意页面按 Cmd+B → sidebar 从 w-sidebar (224px) 平滑过渡到 w-14 (56px) · 仅 icon · 200ms
- [ ] 再按 Cmd+B → 展开
- [ ] 折叠态 hover 任意 NavItem → 出现 title 提示文字
- [ ] 折叠态 NavSectionLabel "工具/资产/设置" 字消失 · 改为短分隔线
- [ ] 折叠态底部命令面板按钮变为 icon-only · 仍可点击调起命令面板
- [ ] 折叠态点 sidebar 顶部 PanelLeft icon → 展开
- [ ] 展开态点 PanelLeftClose icon → 折叠
- [ ] 设折叠态 → 关闭浏览器标签 → 重开 fili → sidebar 仍折叠（`cf-sidebar-collapsed` localStorage 持久化）
- [ ] ? 快捷键手册 → 看到 "Cmd+B 折叠 / 展开侧边栏" 新条目

---

## ⑨ ui-v6 PR-2 · 动效闭环 · commit `b50dfcd`

> A.1 盲点修补 + ExportDrawer keyframe 实装 · 7 个 hand-rolled modal/drawer 全覆盖

### US-A5 · 6 个 hand-rolled modal 动效（必测）

逐个触发以下 modal · 应**统一**有 fade + 微 scale + translateY 150ms 进场（与 A.1 4 个 Modal atom 一致）：

- [ ] Home → 右上角 + 改编卡 / Cmd+K「新建项目」→ **NewProjectDialog**
- [ ] 改编流程 → 摄入向导 → **AdaptIntakeWizard**
- [ ] 任意流水线节点 →「手动注入」按钮（如 R1 / S0 等）→ **ManualInjectDialog**
- [ ] Novel 读章 → 章节卡 →「不满意」按钮 → **ChapterFeedbackButton modal**
- [ ] /lessons 任意条目 →「待审阅 lessons」编辑 → **ReflectorLessonsPanel modal**
- [ ] /kb 上传资料按钮 → **UserKbUploadDialog**
- [ ] 系统开启"减少动态效果"→ 6 modal 全部瞬现无动效

### US-A6 · ExportDrawer 滑入动效（必测）

- [ ] Cmd+K → 输 "导出" → 选小说 / 剧本 / 资产 → ExportDrawer 从右侧 **200ms 弹性滑入**（之前是瞬时出现 · bug 修复）
- [ ] 遮罩同步 fade-in（`anim-modal-backdrop` 150ms）
- [ ] 关闭 drawer（点遮罩 / X）→ 立即消失（无退场动效 · 与 atom Modal 一致）
- [ ] 系统开启"减少动态效果"→ drawer 瞬现无滑入

### US-A7 · 不变量回归

- [ ] DESIGN.md 14 个 token 0 增删（仅 `@layer utilities` 加 keyframe + utility）
- [ ] 6 atom API 0 破坏（仅给 hand-rolled className 追加 utility class）
- [ ] 路由 / dexie schema / 业务逻辑 0 改

---

## ⑩ ui-v6 PR-3 · Studio Calm C.1 + C.2 · commits `d30bf15` `1d5fd9a`

### US-A8 · Screenplay header 紧凑化 + 状态徽章（必测）

前置：进入任意 screenplay 项目（或 adapt 改编模式）

- [ ] header padding 比 v5 紧凑（py-3 · 不再 py-4）
- [ ] 副标题一行显示「项目：N · 概念：C · D 分钟」+（未配 API Key 时）⚠ 警告
- [ ] **不再有独立的 ctx mini-bar 行**（原 L385 那行已删除 · 视觉密度 -1 行）
- [ ] header 右侧工具区前出现状态徽章组：
  - [ ] 始终可见：`{改编|剧本} · N 步` 浅灰徽章
  - [ ] settings.enableEditorialRounds = ON → 多一个 `📝 R1↔R9` primary 蓝徽章
  - [ ] hover 徽章 → tooltip 解释
- [ ] 改长项目名 / 长概念至溢出 → header 不破版 · 副标题正确 truncate（`min-w-0 + truncate`）

### US-A9 · Settings 视觉重排（必测）

前置：访问 /settings

- [ ] 顶部 hero header · 左侧 10×10 圆角图标徽章（SettingsIcon · primary tint 背景）+ 右侧标题与隐私提示
- [ ] 4 个 section heading 各带 lucide 图标：
  - [ ] 🎨 Palette · 主题外观
  - [ ] 🔑 KeyRound · DeepSeek API
  - [ ] 🔧 Workflow · 流水线默认
  - [ ] ✨ Sparkles · 增强模式
- [ ] 容器宽度变宽（max-w-4xl · 比之前 max-w-3xl 更舒展）
- [ ] 测试连通：
  - [ ] 配 OK 的 API Key + Base URL → 测试连通 → 结果 pre **绿色边框 + 绿色背景 + 绿色文字**（success token）
  - [ ] 故意配错 Key → 测试连通 → 结果 pre **红色边框 + 红色背景 + 红色文字**（danger token）

### US-A10 · 不变量回归

- [ ] Settings 页所有现有功能不变（API Key / 温度 / KB / 评分卡权重等仍可调可保存）
- [ ] Screenplay 仍可一键全跑 / 单步重跑 / 导入剧本 / 下载剧本 / 进入资产阶段
- [ ] 路由 / dexie schema / atom API / token 0 改

---

## ⑪ ui-v6 PR-5 · /lessons + /kb hero header 对称 · commit `fa7f0e7`

### US-A11 · 三页 hero 视觉对称（必测）

前置：依次访问 `/settings` · `/lessons` · `/kb`

- [ ] 三个页面顶部都出现 hero header 行：
  - [ ] 左侧 size-10 圆角图标徽章（`rounded-xl` · primary tint 背景 · 同色阶 border）
  - [ ] 徽章内 lucide 图标：Settings · BookOpenCheck · Library
  - [ ] 右侧主标题（text-2xl/3xl bold）+ 副标题（text-fg-secondary）
- [ ] 三个 hero 视觉权重一致：徽章尺寸 / 圆角 / 内边距 / 主副标题层级 完全对齐
- [ ] `/lessons` 标题右侧有状态计数徽章组（lessons 总数 / 最近 7 天新增）
- [ ] `/kb` 副标题正确说明三层（全局 KB / 用户 KB / 项目 KB）职能
- [ ] 窄屏（<768px）三个 hero 不破版 · 副标题 truncate 而非换行后挤压徽章

### US-A12 · 不变量回归

- [ ] `/lessons` 原有功能不变（lessons 列表 / 详情 / 删除 / 标签筛选 等仍可用）
- [ ] `/kb` 原有功能不变（全局/用户/项目三层切换 / 上传 / 绑定 等仍可用）
- [ ] DESIGN.md 14 token 0 增删（仅消费现有 primary / fg / border token）
- [ ] 6 atom API 0 破坏 · 路由 0 改 · dexie schema 0 改 · 业务逻辑 0 改

---

## ⑫ token sweep · bg-surface-N + brand-N 失效 class 修复 · commits `3e582ca` `ed716b6`

> **背景**：`bg-surface-1/2/3` 与 `brand-200/300/800/900` 在 `tailwind.config.cjs` 中 **不存在** · 之前 27 + 33 = 60 处使用都被 Tailwind 静默丢弃 → 视觉降级（无背景 / 继承父色）。本节确认修复后这些位置**真的能看到**正确颜色。

### US-A13 · bg-surface-N 修复（必测）

前置：依次访问下列页面 · 仔细观察卡片层级是否有"明明是不同层 surface 却看着一样"的现象。

- [ ] `/analyzer` 页（拆书工作台）
  - [ ] 章节结构卡 / 位置洞察卡 / 动作栏 → 卡片底色（surface）与抬起卡（surface-elevated）有可见层级差
  - [ ] 不应该出现"卡片完全透明 · 直接看到外层背景"的位置
- [ ] 角色 Bible 抽屉（任意 novel 项目内打开）
  - [ ] 角色卡片 / 关系网格底色正确渲染
- [ ] Progress Dashboard（任意 novel 项目内打开）
  - [ ] 各 section 卡片底色按层级区分
- [ ] ReflectorLessons 面板（侧栏抽屉）
  - [ ] lessons 列表条目底色正确渲染（不是透明）

### US-A14 · brand-N 修复（必测）

前置：依次触发下列含 brand-N 用法的 UI · 确认主色阶（primary 蓝）真实出现。

- [ ] **AdaptIntakeWizard**（剧本/改编入口 → 改编模式 4 步向导）
  - [ ] 当前步骤指示条 · 已完成步骤 checkmark · 高亮的"下一步"按钮 → 全部呈品牌蓝
- [ ] **ChapterFeedbackButton**（novel 章节 → 反馈按钮 → modal → 负样本片段）
  - [ ] "标记为负样本片段"按钮 hover/active 态有明显蓝色边框 + 浅蓝背景
- [ ] **FeedbackInsights**（章节反馈汇总面板）
  - [ ] 选中的 feedback 卡片 / 当前查看详情指示器 → 蓝色边框/背景
- [ ] **GenreAnchorPreview**（题材锚点预览 · novel 设定面板）
  - [ ] 紧凑模式徽章 / 完整模式高亮锚点 → 蓝色色阶
- [ ] **MarkdownView**（任何 markdown 渲染处 · 如 lessons 详情）
  - [ ] inline `code` / blockquote 边条 / 链接 → 配色不再是黑白灰
- [ ] **RefinementToolPanel**（章节润色工具集面板）
  - [ ] 选中的润色维度按钮 / 当前操作进度 → 品牌蓝
- [ ] **UserKbBindingPanel**（/kb → 用户 KB → 绑定面板）
  - [ ] 已选条目 checkmark + 高亮边框 → 蓝色
- [ ] **UserKbLibrary**（/kb → 用户 KB 主面板）
  - [ ] 当前激活的筛选 chip / 选中文档卡 → 蓝色
- [ ] **UserKbUploadDialog**（/kb → 上传按钮）
  - [ ] 拖放区 hover 态 / "提炼中"进度指示 / 主操作按钮 → 蓝色
- [ ] **/analyzer 动作栏 + 章节结构 + 位置洞察** → 主操作按钮 / 选中态 → 蓝色
- [ ] **/assets**（资产工作台） → 完整性扫描进度条 / 三路并发指示器 / 当前查看资产卡 → 蓝色
- [ ] **/express 快速分镜**（题材选择 + 选项按钮）→ 选中题材按钮 / 选中选项按钮 → 蓝色
- [ ] **/intake 章节编辑器** → 当前编辑章节高亮 / 摘要视图主标题 → 蓝色

### US-A15 · 不变量回归

```powershell
# 验证 0 残留
Get-ChildItem src -Recurse -Include *.tsx,*.ts | Select-String -Pattern 'bg-surface-[123]\b' | Measure-Object | % Count
→ 0
Get-ChildItem src -Recurse -Include *.tsx,*.ts | Select-String -Pattern 'brand-(200|300|800|900)\b' | Measure-Object | % Count
→ 0
```

- [ ] 跑上面两条 → 都返回 0
- [ ] DESIGN.md 14 token 0 增删 · `tailwind.config.cjs` 0 改
- [ ] 6 atom API 0 破坏 · 路由 0 改 · dexie schema 0 改 · 业务逻辑 0 改
- [ ] 视觉**回归**：所有改过的文件原本"能看见"的颜色仍然在；新"看见"的颜色都是 token 矩阵正确的同色阶平移

---

## ⑬ ui-v6 PR-7 · bundle code-split / vendor + route lazy · commit pending

### US-A16 · 路由 lazy 切换体验（必测）

前置：已跑过 `npm run build && npm run preview` 或者 `npm run dev`（dev 也走相同 lazy 行为）

- [ ] 首次访问 `/`（Home）→ 看到 Home 内容 · 中间不应卡死或白屏 >300ms（vendor 已加载就不会闪 fallback）
- [ ] 用 sidebar 点击切到 `/novel` → 短暂闪现"加载中..."（128 KB chunk · 中速网络 200-500ms）→ 显示 Novel
- [ ] 同一会话内再次切回 `/novel` → 不再闪现 fallback（已缓存 + parsed）
- [ ] 依次切 `/screenplay` → `/adapt` → 第二次不闪 fallback（两个共享同 chunk · dedup 验证）
- [ ] 切到 `/settings` `/lessons` `/kb` `/analyzer` `/assets` `/intake` `/express` `/refinery` `/playground` `/methods` `/pipeline` 全部加载成功 · 0 console 报错
- [ ] DevTools Network 面板：访问 Home 时仅下载 vendor-* + index + Home 几个 chunk · 不应一次性下 1 MB+

### US-A17 · 不变量回归

```powershell
# 0 eager 引用 pages/* 外露（防止 lazy 失效）
Get-ChildItem src -Recurse -Include *.ts,*.tsx | Where-Object { $_.FullName -notlike '*router.tsx' } | Select-String -Pattern "from\s+['""].*pages/(Home|Settings|Playground|Pipeline|Screenplay|Assets|KnowledgeBase|Intake|Express|Novel|Refinery|Analyzer|MethodModules|ReflectorLessons)['""]" | Measure-Object | % Count
→ 0
```

- [ ] 跑上面验证 → 返回 0
- [ ] 路由路径 0 改（14 条 + index + catch-all 都在）
- [ ] DESIGN.md 14 token 0 增删 · 6 atom API 0 破坏
- [ ] dexie schema 0 改 · 业务逻辑 0 改
- [ ] vite build 0 errors · 入口 index.js < 60 KB · 任何路由 chunk < 600 KB

---

## 总体不变量回归（所有 PR 共同检查）

跑完上面 13 节后 · 最后一并检查：

```powershell
# 6 atoms API 0 破坏（实现可有兼容扩展 · API 不破）
# ui-v6 PR-1 后 NavItem 加了可选 collapsed prop · 默认 false 等同旧版 · 调用方零改动
# Modal atom 仅在 className 加 anim-modal-* utility · API 不变
# 验证方式：检查既有 NavItem / Modal 调用方仍可不传 collapsed / 不带 anim class 工作
grep -r "NavItem\b" src/ --include="*.tsx" | grep -v "collapsed=" | head
→ 大量旧调用 · 仍正常渲染（默认 collapsed=false）

# Dexie schema 0 修改
git diff origin/main..HEAD -- src/store/db.ts
→ 应无输出

# 路由 0 修改（router.tsx）
git diff origin/main..HEAD -- src/router.tsx
→ 应无输出

# DESIGN.md token 0 增删（V2-I-2）
# index.css L14-L49 14 个 --cf-* token · ui-v6 PR-1 仅在 @layer utilities 加 keyframes & utility class
git diff origin/main..HEAD -- src/index.css | Select-String '\-\-cf\-'
→ 应无输出（无 token 行变更）

# vite build 通过
npx vite build
→ 0 errors · ~3-5s

# Console 没有新增 .error / .warn（运行 30min 各种交互后）
DevTools Console → 仅业务正常打印 · 无 stack trace
```

---

## 反馈格式（提交给 AI 协作者）

跑完后告诉我：

```
Pass: US-XX · 全通过
Issue: US-XX · 步骤 N · 实际看到 Y · 期望 Z · 截图（如有）
Idea: US-XX · 建议加 Z 功能 / 改 W 行为
```

我会按反馈优先级开 PR：

- **Issue** 立即开 erratum PR · 标 `fix(...)` 修复
- **Idea** 评估后写入 `docs/planning/` 或下个 epic 范围
- 全 Pass → 关闭 dogfood checklist · 进入下一阶段（gap-a multi-volume 触发评估 / ui-v5 / 业务 epic）
