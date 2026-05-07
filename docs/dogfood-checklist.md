# Dogfood 自测清单（2026-05-08 push 节点 · commit `f883764`）

> 本文档汇总 2026-05-07/08 两 session 内完成的 6 个 PR 的所有 US-* 用户手测场景。
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

## 总体不变量回归（所有 PR 共同检查）

跑完上面 7 节后 · 最后一并检查：

```powershell
# 6 atoms 实现 0 修改
git diff origin/main..HEAD -- src/components/ui/Button.tsx src/components/ui/Input.tsx src/components/ui/Textarea.tsx src/components/ui/NavItem.tsx
→ 应无输出（push 后 origin/main = HEAD · 输出为空 = 0 修改）

# Dexie schema 0 修改
git diff origin/main..HEAD -- src/store/db.ts
→ 应无输出

# 路由 0 修改（router.tsx）
git diff origin/main..HEAD -- src/router.tsx
→ 应无输出

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
