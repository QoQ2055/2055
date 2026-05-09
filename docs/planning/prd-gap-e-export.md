---
project: 影语 FLIL
prdId: v3-gap-e-export
gapCode: e
stage: v3 (planning)
author: QvQ
date: 2026-05-06
audience: self + AI 协作者 (Cascade / Claude / Cursor / Copilot)
status: final
finalizedAt: 2026-05-06
workflow: BMAD-METHOD · CP (bmad-create-prd)
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
nextWorkflow: BMAD-METHOD · CA (bmad-create-architecture)
inputDocuments:
  - docs/planning/product-brief.md           # CB 产物 · v3 路线
  - DESIGN.md                                # v0.2.0-alpha 设计合约
  - AGENTS.md                                # 阶段 2.10 现状 + Dexie v4
  - CHANGELOG.md                             # v2.0-2.10 时间线
related:
  - docs/planning/architecture-gap-e-export.md   # CA 阶段产物（未生成）
  - docs/planning/prd-gap-e-export-validation.md # VP 阶段产物（未生成）
---

# PRD · v3 缺口 e · 导出（Export）

> 本文档由 BMAD-METHOD `bmad-create-prd` (CP) workflow 8 步逐步生成，
> 每步 halt 等用户 Continue 后追加。`stepsCompleted` 实时反映已落盘章节。

## §0 上下文（与 product-brief 对齐）

### 0.1 项目当前态（v2 阶段 2.10）

影语 FLIL 已交付 11 阶段累积底层基建（详见
`@C:\Users\QvQ\CascadeProjects\fili-web\CHANGELOG.md`）：

- 4 种创作模式（短剧 ✅ dogfood 闭环 / 改编 ✓ / 特殊·分镜 ✓ / 小说 🚧 v3 收口）
- 题材锚点 (15 题材) / 24 方法论模块 / 21 篇静态 KB / 用户 KB 库
- 6 维评分卡 (阶段 2.9) / 诊断-修改闭环 (阶段 2.8)
- token-driven 设计系统 v0.2.0-alpha (阶段 2.10)
- Dexie v4 schema (`projects` / `artifacts` / `liveArtifacts` / `liveRefinementUndo` / `userKbDocs` / `runHistory`)

### 0.2 v3 主轴

> 把小说线追平到短剧线 dogfood 闭环水平（`product-brief.md` §2）。
> 不加新模式，**收口 5 个具体缺口**：e（导出，本 PRD）→ d → b → c → a。

### 0.3 缺口 e 在排序中的位置

按价值密度排序（`product-brief.md` §4），缺口 e **优先级最高 / 排第一**：

| Week | 缺口 | 阻塞性 |
|:---:|---|---|
| **1** | **e · 导出（本 PRD）** | **阻塞 dogfood 闭环出口** |
| 2 | d · 进度可视化 | 激励层 |
| 3-5 | b · 角色 bible | 长篇必需 |
| 6-7 | c · 章节衔接 | 提质 |
| 8-11 | a · 多卷架构 | 条件触发，可推 v4 |

### 0.4 范围（brief §4.1 原话锁定）

| 维度 | 当前态 | 缺口 e 目标 |
|---|---|---|
| 小说 | 章节落 IDB liveArtifacts，无单文件导出 | `.md` 单文件按章拼接 + `.docx`（docx.js 或 HTML→Word） |
| 剧本 | 落 `screenplay.7` artifact，无业界标准格式 | `.fdx`（Final Draft XML）+ `.fountain` |
| 资产 | 已有 `.json` | 新增 `.csv` 平面表（`.json` 保留） |
| 接入点 | 仅 Home 卡有 `.flil.json` 项目包导出 | + Novel toolbar + Screenplay toolbar 各加 `<Button>导出</Button>` 抽屉 |

### 0.5 surgical 红线（贯穿全 PRD · 5 条不可破）

1. **不动 Dexie schema**（brief §7 风险册 / 留缺口 a 多卷架构 dexie v4→v5 升级窗口）。
2. **不动 `.flil.json` 项目包格式**（`@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts:25` 的 `FLIL_SCHEMA = 'flil/project/v1'`）。本次新增的"创作产物级"导出与"开发者归档级"项目包**正交**——是两套独立产物，不共用文件名 / 不共用入口逻辑。
3. **不动 Screenplay 顶部 `exportToAssets()` 跨阶段跳转**（`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Screenplay.tsx:69-76`）。该按钮是"导出到资产工作台"的页内 navigate('/assets')，**与文件导出同名异义**。本次 Screenplay toolbar 新增按钮**必须用不同 label / icon 避歧义**（建议「下载剧本…」+ `FileDown` icon）。
4. **DESIGN.md token 硬约束**（AGENTS.md 行为硬约束 ②）：所有新 UI 走 `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ui\` 的 `<Button>` `<Modal>` 原子 + `bg-surface` `text-fg-primary` `text-body-m` 等语义类，禁 `bg-[#xxx]` `p-[7px]` 任何 arbitrary value。新加 drawer 按 DESIGN.md `components.modal.drawer.width = 420px` 落盘。
5. **Karpathy 4**（AGENTS.md 行为硬约束 ①）：surgical / simplicity-first / goal-driven。.docx 路线**优先选 HTML→Word blob 零依赖路线**（brief §4.1 已暗示），`docx.js` 仅在零依赖路线无法满足 NFR 时退而求其次（决策见 §5）。

---

## §1 Problem · 我们要解决什么

### 1.1 卡点位置

> "完整跑通一部小说 / 剧本"在 dogfood 闭环的**最后一公里**断了——
> 创作内容已经落 `liveArtifacts` IDB，但**离开浏览器进入投稿/投递/盘点流程**没有出口。

具体三个失败场景（按 brief §5 的 dogfood 收尾态推演）：

**场景 A · 小说投稿失败**
QvQ 用工具写完 ≥ 10 章 / ≥ 5 万字小说（v3 dogfood 收尾态硬指标），想发到番茄 / 起点 / 微信读书征文活动——
现状：只能逐章打开 PreviewModal 复制粘贴，10 章 = 10 次操作；或者导 `.flil.json`（含 manifest / passed / stale 全套元数据，**对编辑/平台无意义且暴露内部结构**）。

**场景 B · 剧本投递失败**
短剧线 dogfood 已闭环（`product-brief.md` §1），但 `screenplay.7` 终稿是 markdown 格式——
现状：投制片方时业界默认 `.fdx`（Final Draft）或 `.fountain`，markdown 不被剧本会议室软件识别；用户被迫手工转换或退回 Final Draft 桌面版重打。

**场景 C · 资产盘点失败**
拍摄前要给美术 / 道具 / 服装组发"角色×场景×道具"清单，制片人习惯 Excel 排序、过滤、分组——
现状：`/assets` 工作台只能导 `.json`，制片人打不开；用户被迫手工把 JSON 粘到 Excel 重排表头。

### 1.2 根因

影语 FLIL 长期只把"导出"理解为**开发者维度的项目归档**（`.flil.json`，给协作 AI 接力 / 跨设备同步用），**从未支持"创作者维度的产物交付"**（成品文件给外部读者 / 平台 / 同事用）。两个维度长期混淆，brief §4.1 第一次明确分离。

### 1.3 不解决的代价

- v3 dogfood 收尾态（≥ 10 章 / ≥ 5 万字 / 全程不退手工）**直接破功**——只要用户最后一步必须复制粘贴，brief §5 的成功指标就不达标。
- 缺口 d/b/c/a 都建立在"小说线 dogfood 跑得通"的前提上。e 不破，后面 4 个缺口全是空中楼阁。
- 短剧线虽然已经"闭环"，但实际上还有最后一公里隐性退路（用户每次都默默回 Final Draft 重打），这个隐性退路也通过本 PRD 一并堵上。

---

## §2 Goals / Non-Goals

### 2.1 Goals（按业务优先级）

| ID | 目标 | 度量 | 关联 brief |
|:---:|---|---|---|
| **G1** | 小说可一键导出 `.md`（按章拼接单文件） | 10 章 5 万字小说导出 ≤ 2s 完成、文件 ≤ 500KB、章节顺序 100% 与 IDB 一致 | §4.1 |
| **G2** | 小说可一键导出 `.docx`（HTML→Word 零依赖路线优先） | 同 G1 体量下 ≤ 5s；Word 2016+ 打开正常显示标题层级 + 段落 | §4.1 |
| **G3** | 剧本可一键导出 `.fdx`（Final Draft 8.x 兼容 XML） | Final Draft 桌面版（任意版本 ≥ 8）打开无错误、人物 / 场景头 / 动作 / 对白识别正确 | §4.1 |
| **G4** | 剧本可一键导出 `.fountain`（标准 1.0） | 任一 fountain 解析器（Highland / Beat / Slugline）打开正常 | §4.1 |
| **G5** | 资产可导出 `.csv` 平面表（`.json` 保留共存） | 行=资产、列=分类/属性，Excel / Numbers 直接识别 UTF-8 BOM 中文 | §4.1 |
| **G6** | 三处接入点统一抽屉式选单（Home 项目卡 + Novel toolbar + Screenplay toolbar） | DESIGN.md drawer token 合规（420px / floating elevation / 16px 圆角）；3 处共用 1 个 `<ExportDrawer>` 组件 | §4.1 |
| **G7** | 100% 纯前端、零网络、零服务端依赖 | Network 面板观察导出操作期间无任何外发请求；浏览器离线状态可用 | brief §6 / 项目"零后端"定位 |

> **G1–G5 = 6 种产物格式**（包含已有 `.json` 共 6 种），**G6 = UX 接入**，**G7 = 架构红线**。

### 2.2 Non-Goals · v3 缺口 e 明确不做

| 项 | 理由 |
|---|---|
| **PDF 直接生成** | 用户拿到 .docx 后用 Word/WPS 自行 Export PDF 已是行业标准链路；自带 PDF 引擎（pdf-lib / jspdf）会引入 ~300KB+ 依赖且中文字体嵌入复杂 |
| **EPUB / MOBI 电子书** | brief §6 已划入 v3 out-of-scope；v3 dogfood 终态是"投稿稿"非"电子书" |
| **格式回流（.fdx / .fountain → 内部 artifacts）** | 改编 / 摄入流程已通过 `/intake` 处理，不与本次导出共用通道 |
| **导出后云上传 / 邮件分享 / 二维码** | brief §6 排除 SaaS 化；纯前端定位下用户自取浏览器下载文件足够 |
| **格式预览（导出前在浏览器内渲染 .docx / .fdx）** | 用户对自己写的内容心里有数，浏览器内 .docx renderer 体积过大；改 brief §4.1 接入点保持"点 → 选 → 下载"三步即可 |
| **多文件打包 zip（按章一文件 + 总集）** | 单文件已满足投稿场景；多文件 zip 引入 jszip ~100KB 依赖、UX 复杂度上升、收益低 |
| **`.flil.json` 项目包格式变更** | red-line 2 · 与本次导出**正交**，独立编号独立演化 |
| **多卷分卷导出（按 volume 拆文件）** | 缺口 a 触发后再补，本 PRD 范围内**全书一文件**即可（dogfood 10-20 章中篇） |
| **Dexie schema 升级** | red-line 1 · 任何"导出还要落表/记录历史"的需求一律推后；导出是无副作用读操作 |

### 2.3 Goals / Non-Goals 之间的边界检查

- ✅ G1–G5 都可在 5 条 surgical 红线下实现（§0.5）
- ✅ 6 种格式中 5 种为新增（md/docx/fdx/fountain/csv），1 种保留（json）；**全部为输出方向**，不引入解析回流
- ✅ G6 的"统一抽屉"= 1 个 `<ExportDrawer>` 组件，DESIGN.md `components.modal.drawer.width = 420px`、`borderRadius = 0`、`transition = transform 240ms` 直接对应

---

## §3 Users & Use-Cases

### 3.1 Primary Persona · QvQ（创作者本人 / dogfood 主体）

| 维度 | 描述 |
|---|---|
| 身份 | 单人创作者，影语 FLIL 唯一真实用户（brief §3 / §6 已锁定 for-self 定位） |
| 设备 | Windows 桌面 + Chrome / Edge，1280px desktop-first（DESIGN.md spacing.roles.contentMaxWidth） |
| 已有习惯 | Final Draft 桌面版 / Word / Excel / Numbers 都能用；不写命令行；不愿装 npm 包做格式转换 |
| 触达 影语 FLIL 的频次 | v3 dogfood 期间预计每周 2-4 次，每次 1-3 小时 |
| **关键期望** | "我刚写完一部小说 / 一个剧本 / 一组资产，**点一下就能拿到能直接投出去的文件**"——成功定义就是**离开浏览器后这个文件能用** |
| **关键厌恶** | "复制粘贴 10 章"、"装一堆插件转格式"、"打开 .flil.json 看到一坨 manifest 字段一脸懵"、"按钮叫导出但其实是页内跳转" |

> **AI 协作者**（Cascade / Claude / Cursor / Copilot）不作为本 PRD 的 user persona——
> 他们是**实现侧的 reader**（按 PRD 写代码），不是**功能侧的 user**。但他们对 PRD
> 的可读性 / 引用规范 / token 硬约束敏感，影响在 §6 UX 章节（接入点设计）和 §5 NFR
> 章节（surgical 验证可由 AI 自动跑）中体现。

### 3.2 Use-Cases（按发生频次排序）

#### U1 · 小说投稿 · "完整一本小说一键导出 .md/.docx"

- **触发**：QvQ 在 Novel 工作台写完一部 ≥ 10 章小说（draftMeta.completedChapters 全勾），打算投番茄 / 起点 / 微信读书征文活动。
- **现状**（无本 PRD）：逐章打开 PreviewModal 复制粘贴到 Word，10 章 ≈ 30 分钟手工操作；或导 `.flil.json` 后再手写脚本拼章——**违背 brief §5 "全程不退回手工"硬指标**。
- **目标流程**（本 PRD 落地后）：
  1. 在 `/novel` 工作台顶部 toolbar 点 `<Button>导出</Button>`
  2. 抽屉滑出，选「整本小说 · Markdown」或「整本小说 · Word (.docx)」
  3. 浏览器弹下载对话框，文件名 `<项目名>_<YYYYMMDD-HHMM>.md`（或 `.docx`）
  4. 拖进 Word / 番茄编辑器，标题层级（# 章 / ## 节）和段落正常
- **成功判定**：单次操作 ≤ 4 次点击 / ≤ 5 秒等待 / 离线可跑 / Word 2016+ 打开 .docx 标题层级正确显示。
- **关键 FR**：FR-1（.md 拼装）、FR-2（.docx HTML→Word 路线）、FR-6（章节顺序锁定）、FR-7（文件命名规范）。

#### U2 · 剧本投递 · "Final Draft / Fountain 业界标准格式"

- **触发**：QvQ 用短剧 / 改编模式产出最终剧本（`screenplay.7` 或 `adapt.6` artifact），需要发给制片方 / 导演 / 编剧会议室协作。
- **现状**（无本 PRD）：`screenplay.7` 是 markdown，制片方拿到要么手工转 `.fdx` 要么退回 Final Draft 桌面版重打——**短剧线"已闭环"实际上有这个隐性退路**，本 PRD 一并堵上。
- **目标流程**（本 PRD 落地后）：
  1. 在 `/screenplay`（或 `/adapt`）工作台顶部 toolbar 点 `<Button>下载剧本…</Button>`（与现有 `<Download>导出到资产` 按钮区分，避免红线 #3 歧义）
  2. 抽屉选「Final Draft (.fdx)」或「Fountain (.fountain)」
  3. 文件名 `<项目名>_<YYYYMMDD-HHMM>.fdx`（或 `.fountain`）
  4. Final Draft 桌面版 / Highland / Beat / Slugline 任一打开正常显示场景头 / 动作 / 人物 / 对白 / 转场。
- **成功判定**：Final Draft 8.x+ 打开无解析错误（即不弹"This file is corrupt"或"Unsupported version"对话框）；fountain 文件用任一开源解析器 round-trip 后语义无丢失。
- **关键 FR**：FR-3（.fdx XML 生成）、FR-4（.fountain 标准 1.0 编码）、FR-8（剧本元素分类映射规则）。

#### U3 · 资产盘点 · "csv 给制片人/美术组排表"

- **触发**：QvQ 用 `/assets` 工作台产出角色 / 场景 / 道具三类资产后，要发给美术 / 服装 / 道具组做拍摄准备表，对方习惯 Excel / Numbers 排序过滤。
- **现状**（无本 PRD）：`/assets` 只能导 `.json`，制片人打不开；用户被迫手工把 JSON 复制到 Excel 重排表头。
- **目标流程**（本 PRD 落地后）：
  1. 在 `/assets` 工作台顶部 toolbar（或 Home 项目卡 / 抽屉中）点「资产 · CSV」
  2. 文件名 `<项目名>_assets_<YYYYMMDD-HHMM>.csv`，UTF-8 with BOM（中文 Excel 直接识别）
  3. 双击 `.csv` 用系统默认 Excel / Numbers 打开，列头 = 资产分类 / 名称 / 描述 / 视觉风格 / 关联场次
- **成功判定**：Excel 2016+ / Numbers (Mac) 打开中文不乱码；列分隔正确；行数 = artifact 实际资产条目数。
- **关键 FR**：FR-5（.csv 平面化 + UTF-8 BOM + 列头规范）、FR-9（资产 .json → .csv 的字段映射）。

### 3.3 边界 Use-Case（明确 *不* 在本 PRD 范围）

| Use-Case | 现有解 | 备注 |
|---|---|---|
| **项目跨设备同步 / AI 接力** | 现有 `.flil.json` 项目包（`@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts`） | 红线 #2 · 不动；本 PRD 与此正交 |
| **导出后云上传 / 邮件分享** | 用户浏览器另存 → 自己上传 | brief §6 排除 SaaS 化 |
| **导出后 PDF 转换** | 用户在 Word/WPS 里 Export PDF | §2.2 Non-Goal · 体积 / 中文字体嵌入复杂 |
| **多卷分卷分文件导出** | 全书一文件够 dogfood 用 | 缺口 a 触发后再补 |
| **导出文件再回流为 artifact** | `/intake` 摄入流程已覆盖原作回流 | §2.2 Non-Goal · 不引入解析回流 |

### 3.4 Use-Case ↔ Goal 矩阵

| | G1 .md | G2 .docx | G3 .fdx | G4 .fountain | G5 .csv | G6 抽屉 | G7 离线 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **U1 小说投稿** | ✓ | ✓ | | | | ✓ | ✓ |
| **U2 剧本投递** | | | ✓ | ✓ | | ✓ | ✓ |
| **U3 资产盘点** | | | | | ✓ | ✓ | ✓ |

**矩阵结论**：3 条 use-case 横向覆盖 G1–G5 全部 5 种新格式，G6（抽屉）/ G7（离线）作为基础设施被 3 条全覆盖。**无 goal 悬空**（每个 G 都至少被 1 条 U 触发），**无 use-case 无解**（每条 U 都至少有 1 个 G 兜底）。

---

## §4 Functional Requirements (FR)

> 11 条 FR 覆盖：5 种新格式（FR-1~5）+ 跨格式约束（FR-6 顺序 / FR-7 命名 / FR-8 剧本映射 / FR-9 资产映射 / FR-10 失败兜底）+ UI 契约（FR-11）。
> 每条 FR 以 `Source / Target / Rule / Edge` 4 段表述，便于 §7 acceptance criteria 直接绑定。

### FR-1 · 小说 → `.md`（按章拼接单文件）

- **Source**：
  - 优先 `project.artifacts['novel.7'].meta.chapterContents: Record<number, string>`（润色版，定义在 `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\novelLoop.ts:317-333` `NovelChapterLoopMeta`）
  - 回退 `project.artifacts['novel.6'].meta.chapterContents`（草稿版）
  - 章节标题：同 meta 的 `chapterTitles: Record<number, string>`
  - 兜底标题：`第 ${index} 章`（`novelLoop.ts:259` 已有同款逻辑）
- **Target**：单个 `text/markdown` Blob，UTF-8 编码（无 BOM，`.md` 不需要）。
- **Rule**：
  ```markdown
  # <ctx.name>

  > 导出于 YYYY-MM-DD HH:MM · 共 N 章 · 约 M 字

  ## 第 1 章 · <chapterTitles[1]>

  <chapterContents[1]>

  ## 第 2 章 · <chapterTitles[2]>

  <chapterContents[2]>

  ...
  ```
  - 项目名 `# <ctx.name>` 用 H1（与 README "影语 FLIL" 同款）。
  - 每章 H2 起头，章号格式 **统一中文化**「第 N 章」（不用阿拉伯数字 chapter 头）。
  - 章节正文按 `meta.chapterContents` 原样输出（不做 markdown 二次转义；用户写的就是 markdown）。
  - 章与章之间空 1 行；章内段落保留 `\n\n` 分段。
- **Edge**：
  - 若 `novel.7` 与 `novel.6` 都缺失：抽屉禁用此项，灰显 + tooltip「请先完成章节草稿（N3.1）」。
  - 若部分章节缺失（draftMeta.completedChapters 不连续）：仍按已有章节导出，文件头 `> ⚠ 注：第 X 章缺失（共 Y 章未完成）` 警告横幅。
  - 若 `meta.chapterContents` 为 `undefined`（旧 artifact 格式）但 `content` 字段存在：直接导出 `content`（已经是按章拼接的 markdown，见 `novelLoop.ts:11`「content 字段保存 assembled markdown」）。

### FR-2 · 小说 → `.docx`（HTML→Word 零依赖路线优先）

- **Source**：与 FR-1 完全相同（同 `chapterContents` / `chapterTitles`）。
- **Target**：单个 Word 可识别的 `.docx` 文件。
- **Rule** —— 路线决策：
  - **首选 · MHTML / Word HTML 路线**：构造 `<html><head><meta charset="utf-8"><title>...</title></head><body><h1>...</h1>...</body></html>` 字符串，blob `type: 'application/vnd.ms-word; charset=utf-8'`，扩展名 `.docx`，Word 2016+ 可直接打开（Word 接受 HTML 作为 .docx 容器，是历史兼容路径）。**零 npm 依赖**。
  - **退路 · `docx` npm 包**（仅当首选路线在 acceptance test 中 Word 打开警告"是否转换格式"且用户体验受损时启用）：~150KB 依赖，生成真正的 OOXML zip 包，需评估 §5 NFR 中"产物体积"约束。本次 PRD 不预先纳入依赖；CA 阶段评估实际效果后做最终决策。
  - 标题层级映射：项目名 → `<h1>`；章节 → `<h2>`；正文段落 → `<p>`；章节间 `<hr/>`。
- **Edge**：
  - 中文字体：HTML 里写 `<meta charset="UTF-8">` + `<style>body { font-family: 'Microsoft YaHei', 'PingFang SC', serif; }</style>`，避免 Word 默认衬线英文字体导致中文乱排。
  - 与 FR-1 共用同一兜底逻辑（部分章节缺失警告 / 数据形态回退）。

### FR-3 · 剧本 → `.fdx`（Final Draft 8.x XML）

- **Source**：
  - 优先 `project.artifacts['screenplay.7'].content`（最终剧本 markdown）
  - 回退 `project.artifacts['adapt.6'].content`（改编最终稿）
  - 选择规则与 `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Assets.tsx:47-51` 一致：
    ```ts
    project.artifacts['screenplay.7'] ? 'screenplay.7'
    : project.artifacts['adapt.6'] ? 'adapt.6'
    : null
    ```
- **Target**：Final Draft 8 兼容 XML，扩展名 `.fdx`，blob `type: 'application/xml'`。
- **Rule**：标准 fdx 骨架（最小可识别集）：
  ```xml
  <?xml version="1.0" encoding="UTF-8" standalone="no" ?>
  <FinalDraft DocumentType="Script" Template="No" Version="1">
    <Content>
      <Paragraph Type="Scene Heading"><Text>INT. 茶馆 - 日</Text></Paragraph>
      <Paragraph Type="Action"><Text>男主推门而入。</Text></Paragraph>
      <Paragraph Type="Character"><Text>男主</Text></Paragraph>
      <Paragraph Type="Dialogue"><Text>来一壶龙井。</Text></Paragraph>
      <Paragraph Type="Transition"><Text>CUT TO:</Text></Paragraph>
    </Content>
  </FinalDraft>
  ```
  - 5 种 `Paragraph Type`：`Scene Heading` / `Action` / `Character` / `Dialogue` / `Transition`（覆盖 short-drama 90%+ 元素）。其余罕见类型（Parenthetical / Shot）**不在本 FR 范围**，归并为 Action。
  - 元素分类规则见 **FR-8**（与 fountain 共用一套 markdown→element 映射）。
  - XML 转义 `<` `>` `&` `'` `"` 五字符（不依赖 DOM API；纯字符串 replace 实现）。
- **Edge**：
  - 若 `screenplay.7` 与 `adapt.6` 都缺失：抽屉项灰显 + tooltip「请先在 `/screenplay` 或 `/adapt` 完成最终剧本」。
  - markdown 中无法清晰判断为 5 类元素之一的行（如纯描述性中文）→ 默认归 `Action`，不丢内容。

### FR-4 · 剧本 → `.fountain`（Fountain 1.0 标准）

- **Source**：与 FR-3 完全相同。
- **Target**：纯文本 `text/plain; charset=utf-8`，扩展名 `.fountain`。
- **Rule**：Fountain 1.0 语法编码（参考 https://fountain.io/syntax）：
  ```fountain
  Title: <ctx.name>
  Author: QvQ
  Draft date: 2026-05-06

  ===

  INT. 茶馆 - 日

  男主推门而入。

  男主
  来一壶龙井。

  > CUT TO:
  ```
  - **Title page** (`Title:` / `Author:` / `Draft date:`)：可选但建议包含。
  - **场景头**：以 `INT.` / `EXT.` / `EST.` / `内` / `外` 开头的整行（FR-8 详细识别规则）。
  - **人物名**：单行全大写英文 / 上下文判断为人物名的中文行。
  - **对白**：紧跟人物名后的一行或多行文本。
  - **转场**：`> CUT TO:` 等以 `>` 起头。
  - **动作**：默认所有非以上类型的行。
- **Edge**：
  - 与 FR-3 共用 Source / element 映射；只是序列化目标不同（XML vs plain text）。

### FR-5 · 资产 → `.csv`（UTF-8 with BOM · 中文 Excel 友好）

- **Source**：3 个 artifact 的 JSON 数组：
  - `project.artifacts['assets.2'].content`（角色 / `parseLooseArray` 解析，见 `@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Assets.tsx:9`）
  - `project.artifacts['assets.3'].content`（场景）
  - `project.artifacts['assets.4'].content`（道具）
- **Target**：单个 `.csv` 文件，UTF-8 with BOM（`\uFEFF` 前缀），blob `type: 'text/csv; charset=utf-8'`。
- **Rule**：
  - 一个 csv = 三类资产合并表，第一列固定 `分类`（取值「角色」/「场景」/「道具」），后续列动态合并三类的字段集（参考 FR-9 字段映射）。
  - 若用户偏好"分文件"，进入 §2.2 Non-Goal 范畴，本 PRD 拒绝。
  - 列分隔符 `,`，行分隔符 `\r\n`（Windows Excel 默认期望）。
  - 含 `,` `"` `\n` 的字段值用双引号包裹，内部 `"` 转义为 `""`（RFC 4180）。
  - 列头行：`分类,名称,描述,视觉风格,关联场次,...`（按 FR-9 列出固定列序）。
- **Edge**：
  - 若三个 stage 全缺：抽屉项灰显 + tooltip「请先在 `/assets` 跑完三路引擎」。
  - 若部分缺（如只跑了角色）：仍导出已有部分，列头不变（缺失列留空）。
  - 若 `parseLooseArray` 抛错（artifact 内容损坏）：toast 报警 + 跳过损坏 stage，**不阻塞其他 stage 导出**。

### FR-6 · 章节顺序锁定（小说 .md / .docx 共用）

- **Rule**：导出时按 chapter index **数字升序**遍历 `chapterContents`，与 `@C:\Users\QvQ\CascadeProjects\fili-web\src\pipeline\novelLoop.ts:270` `chapters.sort((a, b) => a.index - b.index)` 同款逻辑。
- **不允许**按 `Object.keys()` 默认枚举顺序输出（IE/老 Edge 兼容性已不是问题，但显式 sort 是 surgical 防御）。
- **跨卷场景**（缺口 a 触发后）：本 PRD 不处理，仅按 chapter index 全局升序；多卷分隔交给缺口 a。

### FR-7 · 文件命名规范（6 种格式共用）

- **格式**：`<safeName>_<YYYYMMDD-HHMM>.<ext>`，与 `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts:113-126` `packageToBlob` 一致（**复用同款时间戳 helper**）。
- **`safeName`** = `ctx.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64)`（同 `projectExport.ts:116`）。
- **资产专用插入 `_assets`**：`<safeName>_assets_<stamp>.csv`（与 FR-5 一致）。
- **扩展名映射**：`.md` / `.docx` / `.fdx` / `.fountain` / `.csv`（共 5 种新增；`.flil.json` 不动）。
- **不冲突**：所有新扩展名都与现有 `.flil.json` 不同，OS 文件管理器一眼可分。

### FR-8 · 剧本元素分类映射规则（FR-3 / FR-4 共用）

> markdown → fdx Paragraph Type / fountain element 的统一识别表。
> screenplay.7 markdown 由 `@C:\Users\QvQ\CascadeProjects\fili-web\public\prompts\screenplay\7.json` prompt 输出，影语 FLIL 历史 prompt 习惯输出**带 markdown 装饰的剧本式文本**。

| 行模式（regex hint） | fdx Type | fountain encoding | 备注 |
|---|---|---|---|
| `^#{1,3}\s*(?:第\s*\d+\s*场\|场\s*\d+)` 或 `^(?:INT\|EXT\|EST)\.\s+` 或 `^[内外]\s` | Scene Heading | 整行原样输出（fountain 自动识别 INT/EXT 起头） | 场景头 |
| `^[A-Z\u4e00-\u9fa5]{1,8}[:：]` 单行 + 下一行不为空 | Character + Dialogue | 大写名 + 下一行 | 中文人物对白：「李三：你好」拆为 `李三` + `你好` |
| `^>\s+` 或 `^(?:CUT TO\|FADE OUT\|DISSOLVE)` | Transition | `> CUT TO:` 等 fountain 转场前缀 | 转场 |
| 其余非空行 | Action | 直接输出 | 动作 / 描述 |
| 空行 | （分隔） | 保留 | 段落分隔 |

- **不识别**：Parenthetical（如 `（怒）`）、Shot（如 `特写`） → 归并 Action，不丢内容。
- **降级保证**：识别失败时 100% 走 Action 兜底，不会丢任何 markdown 字符。

### FR-9 · 资产 `.json` → `.csv` 字段映射（FR-5 落地）

- **csv 列序固定**：
  ```
  分类,名称,描述,视觉风格,提示词,关联场次,备注
  ```
  - `分类`（必填）：「角色」/「场景」/「道具」
  - `名称`（必填）：JSON 中的 `name` 字段
  - `描述`：JSON 中的 `description` / `desc` / `summary`（按字段优先级取第一个非空）
  - `视觉风格`：JSON 中的 `style` / `visualStyle` / `lookAndFeel`
  - `提示词`：JSON 中的 `prompt` / `tflowPrompt`（AI 文生图 prompt，本身就是资产工作台核心产物）
  - `关联场次`：JSON 中的 `scenes` / `appearances` 数组 → `;` 分号连接
  - `备注`：JSON 中的 `notes` / `extra` / 任何未映射字段 → `key=value;` 形式串联（兜底无字段丢失）
- **空字段策略**：留空，不写 `null` 或 `undefined`（Excel 视空白）。
- **多类型场景**（如某条资产同时是角色 + 道具）：按出现的 stage 重复成 2 行，分别记 `分类=角色` / `分类=道具`。

### FR-10 · 失败 / 部分缺失场景的统一兜底

| 场景 | 行为 |
|---|---|
| 抽屉打开时数据完全缺失 | 该项 disabled + tooltip 解释（如「请先完成章节草稿」） |
| 数据部分缺失（如 5/10 章节） | 抽屉项可点；导出文件头加一行 `> ⚠ 注：仅含 N 章（共 M 章）`；不阻塞 |
| 解析异常（如 assets.2 JSON 损坏） | toast.error("CSV 导出：角色列表损坏，已跳过该分类")；其他分类继续导出 |
| Blob 创建失败（极少见） | toast.error 弹原始 error message；不静默失败 |
| 浏览器拒绝下载（弹窗拦截器） | 日志告知用户需允许下载；按 `@C:\Users\QvQ\CascadeProjects\fili-web\src\store\projectExport.ts:128-139` `downloadBlob` 复用同款机制 |

### FR-11 · `<ExportDrawer>` 组件契约（G6 落地 / DESIGN.md token 合规）

- **位置**：新建 `@C:\Users\QvQ\CascadeProjects\fili-web\src\components\ExportDrawer.tsx`
- **Props**：
  ```ts
  interface ExportDrawerProps {
    open: boolean;
    onClose: () => void;
    /** 决定显示哪些导出项；3 处入口都传 'all'，子页面入口可传子集 */
    scope: 'all' | 'novel' | 'screenplay' | 'assets';
    /** 数据源：传 archived projectId 走 db.artifacts；传 'live' 走 useProject().artifacts */
    source: { type: 'live' } | { type: 'archived'; projectId: number };
  }
  ```
- **DESIGN.md token 强约束**（行为硬约束 ②）：
  - drawer 容器走 `components.modal.drawer.width = 420px` + `transition: transform 240ms cubic-bezier(0.16,1,0.3,1)`；
  - 每条导出项卡片走 `components.card.variants.flat`（嵌入抽屉内不需再抬升）；
  - 按钮一律 `<Button>` 原子 + `variant="primary" | "outline"`；
  - 文字层级：抽屉头 `text-heading-m` / 项目标题 `text-heading-s` / 描述 `text-body-s text-fg-secondary`；
  - 禁 `bg-[#xxx]` `p-[7px]` 任何 arbitrary value（红线 #4 + AGENTS.md ②）。
- **3 处入口（FR-11.1 / FR-11.2 / FR-11.3）**：
  - **FR-11.1 Home 项目卡 `<Download>` icon**：`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Home.tsx:242-250` 当前 `handleExportArchived(p.id)` **保留**（向下兼容 `.flil.json` 一键导出）；新增 `handleOpenExportDrawer(p.id)` 调用，把现有 `<Download>` icon 行为改为：
    - **单击 → 弹抽屉**（含 `.flil.json` + 5 种新格式 6 选项）
    - 旧"直接下载 .flil.json"行为退化为抽屉中的一项（命名「项目包 (.flil.json) · 含 manifest 全套元数据」）
    - 这是为数不多的"行为变更"，需在 acceptance criteria 中显式覆盖。
  - **FR-11.2 Novel toolbar 新增 `<Button>导出</Button>`**：插入位置见 §6 章节（Step 6 落盘）；scope='novel'；仅显示 `.md` / `.docx`。
  - **FR-11.3 Screenplay toolbar 新增 `<Button>下载剧本…</Button>`**：与现有「导出到资产」`<Download>` icon 物理隔离（红线 #3）；scope='screenplay'；仅显示 `.fdx` / `.fountain`。
- **复用边界**：3 处共用一个 `ExportDrawer` 组件 + 一个 `useExportActions(source)` hook 封装 6 种格式的"组装 → blob → download"逻辑。FR-1~5 各自一个纯函数（`buildNovelMd` / `buildNovelDocx` / `buildScreenplayFdx` / ...），可独立单测。

### FR 矩阵 · 全 Goal / Use-Case 覆盖度自检

|  | FR-1 | FR-2 | FR-3 | FR-4 | FR-5 | FR-6 | FR-7 | FR-8 | FR-9 | FR-10 | FR-11 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| G1 .md | ★ | | | | | ✓ | ✓ | | | ✓ | ✓ |
| G2 .docx | | ★ | | | | ✓ | ✓ | | | ✓ | ✓ |
| G3 .fdx | | | ★ | | | | ✓ | ✓ | | ✓ | ✓ |
| G4 .fountain | | | | ★ | | | ✓ | ✓ | | ✓ | ✓ |
| G5 .csv | | | | | ★ | | ✓ | | ✓ | ✓ | ✓ |
| G6 抽屉 | | | | | | | | | | | ★ |
| G7 离线 | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | | ✓ |

★ = 主要承载；✓ = 间接依赖 / 跨格式约束

**自检结论**：每个 G 都至少 1 个 ★ FR 主承载；FR-6/7/8/9 作为跨格式约束被多 G 引用；FR-10/11 作为基础设施被全 G 覆盖。**无 FR 悬空 / 无 G 无对应 FR**。

---

## §5 Non-Functional Requirements (NFR)

> 9 个 NFR 类别，每条给可测阈值 / 验证手段。
> 阈值取保守值，目的是"不破当前基线 + 给 dogfood 留余量"。

### NFR-1 · 性能（导出耗时）

| 场景 | 输入规模 | P95 阈值 | 验证手段 |
|---|---|---|---|
| 小说 `.md` 导出 | 10 章 / 5 万字 | **≤ 2 秒** 从点击到浏览器弹下载对话框 | `performance.now()` 包住 build → blob → download，dogfood 期间 console.log 实测 |
| 小说 `.docx` 导出（HTML 路线） | 同上 | **≤ 5 秒** | 同上；HTML 字符串拼装 + Blob 编码占主要时间 |
| 剧本 `.fdx` / `.fountain` | screenplay.7 ~3-8K 字 | **≤ 1 秒** | 同上 |
| 资产 `.csv` | 30-100 条资产合计 | **≤ 0.5 秒** | 同上 |
| 抽屉打开 → 首屏可交互 | n/a | **≤ 200ms** | DESIGN.md `components.modal.drawer.transition = 240ms` 与之 budget 对齐 |

> **降级容忍**：≥ 50 章 / ≥ 30 万字超长篇导出耗时翻倍 OK（缺口 a 触发后再优化），不影响 v3 收尾态。

### NFR-2 · 产物体积（不引入 npm 重依赖）

- **首选路线零新增依赖**（Karpathy "Simplicity First"，红线 #5）：
  - FR-1 `.md` / FR-3 `.fdx` / FR-4 `.fountain` / FR-5 `.csv` · 全部纯字符串拼接 + `new Blob`，**0 KB 新增依赖**。
  - FR-2 `.docx` · Word HTML 容器路线 · **0 KB 新增依赖**。
- **若启用退路** `docx` npm 包（仅 NFR 不达标时），约束：
  - 必须 lazy import（`await import('docx')`）—— 不进 main chunk。
  - vendor chunk 增量 ≤ 200 KB gzip。
  - 否则触发 §9 风险 R-2，回退首选路线 + 接受体验损失。
- **当前 build 基线**（AGENTS.md §"验证"）：1911 modules / ~3s。本 PRD 落地后期望基线 modules 数变化 ≤ +10（仅新增本仓 `.ts` 源文件，无外部 npm 包）。

### NFR-3 · 离线 / 零网络（G7 落地）

- 导出操作全程**禁止任何网络请求**（含字体、CDN、telemetry）。
- 验证：DevTools Network 面板录制导出全过程 → 0 个 outbound request。
- 浏览器离线状态（DevTools `offline` checkbox 勾选）下点击导出 → 全 6 种格式仍可成功下载。
- DESIGN.md 中的字体（Inter / Source Han Serif SC）已通过 `system-ui` fallback 不依赖 CDN（typography.fontFamilies），与本 NFR 对齐。

### NFR-4 · 可访问性（a11y）

- **键盘导航**：抽屉打开后 `Tab` 顺序覆盖：关闭 X → 6 个导出项 → 关闭 X 循环；`Esc` 关闭抽屉（DESIGN.md `Modal 必须有 close iconBtn + Esc 关闭`）。
- **焦点管理**：抽屉打开时焦点移到第一个导出项；关闭时焦点回到触发按钮（`<Button>导出</Button>`）。
- **ARIA**：抽屉容器 `role="dialog" aria-modal="true" aria-labelledby="export-drawer-title"`。
- **disabled 项 tooltip**：FR-10 中"该项 disabled" 必须用 `aria-disabled="true"` + `title=` + 视觉灰显（不靠纯颜色，DESIGN.md "语义色不单靠颜色"原则）。
- **不强制**：屏幕阅读器深度优化（screen reader narration）—— for-self 项目，persona §3.1 不依赖屏幕阅读器；但不主动破坏。

### NFR-5 · 浏览器兼容（与项目现状对齐）

- **目标**：Chrome 110+ / Edge 110+（与 README 部署目标一致；为 desktop-first 1280px 用户）。
- **不目标**：IE / 老 Edge / Safari 14- / 移动端（与 brief §6 Out-of-Scope 一致）。
- **依赖的现代 API**：`Blob` / `URL.createObjectURL` / `<a download>` / `\u FEFF` BOM —— 全部 Chromium 80+ 支持，无 polyfill 需求。

### NFR-6 · 国际化与编码

- **全部产物 UTF-8 编码**：`.md` / `.fountain` 无 BOM；`.csv` **with BOM**（中文 Excel 强制要求）；`.docx` HTML meta charset；`.fdx` XML declaration。
- **中文友好**：FR-9 csv 表头中文（`分类,名称,描述...`）；FR-1/2 章节标题保留中文「第 N 章」（FR-1 Rule 已锁）。
- **不做**：英文翻译版 / 多语言切换（v3 范围外）。

### NFR-7 · 代码维护（surgical changes 验证）

- **新增文件预期清单**（AI 协作者实施时不应超出此清单 ≥ 2 个文件）：
  - `src/components/ExportDrawer.tsx` · UI 组件
  - `src/store/exportFormats.ts` · 6 个纯函数 `buildNovelMd` / `buildNovelDocx` / `buildScreenplayFdx` / `buildScreenplayFountain` / `buildAssetsCsv` / `buildScreenplayElements`（FR-8 共用 helper）
  - `src/store/exportFormats.test.ts`（可选）· 单测 fixture
- **修改文件预期清单**（surgical 边界）：
  - `src/pages/Home.tsx` · 仅替换 1 处 onClick + 引入 `<ExportDrawer>` state（FR-11.1）
  - `src/pages/Novel.tsx` · 仅顶部 toolbar 加 1 个 `<Button>` + 引入 state（FR-11.2，§6 详）
  - `src/pages/Screenplay.tsx` · 同上（FR-11.3）
- **不修改**：`src/store/db.ts` / `src/store/projectExport.ts` / `src/pipeline/**` / `src/components/ui/**`（DESIGN.md token 不变）。
- **TS strict 通过**：`noUnusedLocals` / `noUnusedParameters` 现状已开启，本 PRD 落地后零新增 TS error。
- **单文件软目标 ≤ 800 行**（AGENTS.md §"Coding style"）：`ExportDrawer.tsx` 预期 ≤ 250 行；`exportFormats.ts` 预期 ≤ 400 行。

### NFR-8 · 验证回归（build / type-check / dogfood smoke）

落地后必须通过 3 道回归（AGENTS.md §"验证"）：

```powershell
# 1. 构建通过（基线 1911 modules / ~3s · 不允许 ≥ 5% 退化）
npx vite build 2>&1 | Select-String -Pattern '^error|built'

# 2. 类型检查（pre-existing @types/node 缺失警告允许；不允许新增 error）
npx tsc --noEmit -p .

# 3. dogfood smoke：
#    a) Home 项目卡 <Download> → 抽屉弹出 → 选 .md → 下载文件 → Word 打开 → 标题层级正确
#    b) /novel toolbar <Button>导出</Button> → 抽屉 → .docx → 下载 → Word 2016 打开无格式警告
#    c) /screenplay toolbar <Button>下载剧本…</Button> → .fdx → Final Draft 打开 → 5 类元素识别正确
#    d) /assets → .csv → Excel 打开 → 中文不乱码 + 列序与 FR-9 一致
```

### NFR-9 · 数据安全 / 隐私（red-line 1 + brief §安全）

- **零 IDB 写**：导出全程仅读 `liveArtifacts` / `db.artifacts` / `db.projects`，不调任何 `bulkPut` / `add` / `update` / `delete`。验证：导出前后 `db.artifacts.count()` / `db.runHistory.count()` 不变。
- **零 localStorage 写**：不污染 `FLIL.settings` / `FLIL.passed` 等 zustand 持久化键。
- **零 LLM 调用**：导出是无 AI 操作，不调 `chatStream` / 不消耗 DeepSeek tokens。
- **API Key 不暴露**：导出文件中**不含**任何 `apiKey` / 环境变量 / 内部路径（与 `.flil.json` 项目包不同——后者也不含 key，但本 PRD 进一步明确"无 manifest 元数据泄漏"）。

### NFR 自检 · Goal 覆盖度

| Goal | 关联 NFR |
|---|---|
| G1–G5 | NFR-1 性能 + NFR-2 体积 + NFR-6 编码 + NFR-7 维护 |
| G6 抽屉 | NFR-1 抽屉打开延迟 + NFR-4 a11y + NFR-7 (`ExportDrawer.tsx`) |
| G7 离线 | NFR-3 零网络 + NFR-5 浏览器兼容 |
| 5 条 surgical 红线 | NFR-2 + NFR-7 + NFR-9 三重锁定（不引依赖 / 不动 schema / 不写 IDB） |

---

## §6 UX 接入点设计

> 本节把 FR-11.1/2/3 三处入口的**具体插入位置 / 抽屉布局 / DESIGN.md token 落到具体类名**全部钉死。
> 落地 AI 协作者不应再做"创作型设计决策"，只做机械翻译。

### 6.1 `<ExportDrawer>` 抽屉布局（共用）

```
┌─────────────────────────────────── 420px 宽 (drawerWidth) ──┐
│  导出                                                  ✕   │  ← header (text-heading-m)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  scope='novel' 时显示 2 项 / 'screenplay' 时 2 项 /         │
│  'assets' 时 1 项 / 'all' 时 6 项                          │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ 整本小说 · Markdown                          [↓]  │     │  ← card.flat
│  │ .md · 按章拼接 · 适合粘贴到番茄/起点                │     │  text-body-s text-fg-secondary
│  │ 共 10 章 · 约 5 万字                              │     │  text-caption-m text-fg-muted
│  └───────────────────────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────┐     │
│  │ 整本小说 · Word (.docx)                       [↓] │     │
│  │ HTML 容器 · Word 2016+ 兼容                        │     │
│  └───────────────────────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────┐     │
│  │ 剧本 · Final Draft (.fdx)                     [↓] │     │
│  │ 业界标准 · Final Draft 8.x+                        │     │
│  └───────────────────────────────────────────────────┘     │
│  ...                                                        │
│                                                             │
│  ─────────────────────────────────────                      │
│  项目包 (.flil.json) · 含 manifest 全套元数据    [↓]        │  ← scope='all' 才显示
│  仅推荐：跨设备同步 / AI 协作接力                           │  灰显 hint
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                              [关闭]         │  footer (右对齐 outline 按钮)
└─────────────────────────────────────────────────────────────┘
```

**布局规范**：

| 元素 | DESIGN.md token | 具体类名（项目现有 utility） |
|---|---|---|
| 抽屉容器 | `components.modal.drawer.width = 420px` `borderRadius = 0` `transition = transform 240ms` | 复用现有 Modal 抽屉样式（如已有则继承；若无则按 token 新建） |
| Header 标题「导出」 | `typography.scales.headingM` | `text-heading-m` |
| 关闭 X | `components.button.variants.iconOnly` | `<Button iconOnly variant="ghost"><X /></Button>` |
| 导出项卡 | `components.card.variants.flat` + `borderRadius = rounded.roles.card (12px)` | `card`（项目现有 utility） |
| 卡片内主标题 | `typography.scales.headingS` | `text-heading-s` |
| 卡片内描述 | `typography.scales.bodyS` + `text.secondary` | `text-body-s text-fg-secondary` |
| 卡片内 metadata | `typography.scales.captionM` + `text.muted` | `text-caption-m text-fg-muted` |
| 下载箭头 icon | lucide `Download` size-4 | `<Download className="size-4 text-fg-secondary" />` |
| 间距：卡间 | `spacing.roles.stackMd = 12px` | `space-y-3` |
| 间距：抽屉 padding | `components.modal.container.paddingX/Y = insetXl/insetLg` | `px-6 py-4` |

### 6.2 三处入口

#### 6.2.1 Home 项目卡（FR-11.1）

**当前态**（`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Home.tsx:242-250`）：

```tsx
<Button
  iconOnly
  onClick={() => p.id != null && handleExportArchived(p.id)}
  disabled={busy}
  title="导出 .flil.json"
  aria-label="导出"
>
  <Download className="size-3.5" />
</Button>
```

**新态**：

```tsx
<Button
  iconOnly
  onClick={() => p.id != null && setExportDrawer({ projectId: p.id })}
  disabled={busy}
  title="导出…"
  aria-label="导出"
>
  <Download className="size-3.5" />
</Button>

{/* 顶级 state · 抽屉单实例 · 与 NewProjectDialog 同级 */}
<ExportDrawer
  open={!!exportDrawer}
  onClose={() => setExportDrawer(null)}
  scope="all"
  source={{ type: 'archived', projectId: exportDrawer?.projectId ?? -1 }}
/>
```

- **行为变更点**（已在 FR-11.1 明牌、§7 acceptance 双重覆盖）：单击 `<Download>` icon 不再立即下载 `.flil.json`，改为弹抽屉。`.flil.json` 退化为抽屉中第 6 项（scope='all' 末尾）。
- **`handleExportArchived` 函数保留**（向下兼容潜在用户脚本 / 后续 BMAD CK checkpoint），但前端不再有按钮路径调用。

#### 6.2.2 Novel toolbar（FR-11.2）

**当前态**（`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Novel.tsx:412-505`）：

`<header>` 右侧 `<div className="flex items-center gap-2">` 内由左到右当前是：
1. Best-of-N 开关 (line 429-475)
2. hardGate 开关 (line 477-497)
3. chainBusy 时的「中止」按钮 (line 498-502)
4. `<Link to="/">` 项目首页 (line 503)

**新态**：在第 4 项（项目首页）**之前**插入「导出」按钮：

```tsx
{/* 紧邻项目首页之前，便于「写完 → 导出 → 离开」鼠标轨迹 */}
<Button
  variant="outline"
  size="sm"
  onClick={() => setExportDrawerOpen(true)}
  disabled={chainBusy}
  title="导出小说为 .md / .docx"
>
  <Download className="size-4" /> 导出
</Button>

<ExportDrawer
  open={exportDrawerOpen}
  onClose={() => setExportDrawerOpen(false)}
  scope="novel"
  source={{ type: 'live' }}
/>
```

- **图标**：用 lucide `Download`（与 Home 卡一致；novel 工作台无与 Download 冲突的现存按钮 —— grep 验证 Novel.tsx 无 Download import）。
- **位置选择理由**：项目首页是"离开"动作，导出是"完成 → 出口"动作；二者邻近 = 鼠标轨迹"完成 → 导出 → 离开"自然顺滑，符合 U1 触发场景。
- **disabled 条件**：`chainBusy`（正在跑 LLM 时禁导出，避免数据中间态）。

#### 6.2.3 Screenplay toolbar（FR-11.3）

**当前态**（`@C:\Users\QvQ\CascadeProjects\fili-web\src\pages\Screenplay.tsx:309-339`）：

`<header>` 右侧 `<div className="flex items-center gap-2">` 内由左到右：
1. chainBusy 时「停止」(line 311) ←→ 非 busy 时下面三项：
2. **`<Download className="size-4" /> 导入剧本`**（line 314-320）—— **注意：此处 `Download` icon 实际用于"导入"**（pre-existing 命名不一致，与本 PRD scope 无关，**本 PRD 不动**）
3. `<Box className="size-4" /> 进入资产阶段`（line 322-328，artifact 存在时显示）
4. 一键全跑 `<Play>` (line 330-335)

**冲突澄清** —— 红线 #3 实测：
- 现有"导出到资产"按钮**实际用 `<Box>` icon + 标签「进入资产阶段」**，与本 PRD 不冲突。
- 但 line 314-320 的「导入剧本」按钮**复用了 `Download` icon**——这意味着我们的新「下载剧本」按钮**不能再用 `Download`**，否则同页面 2 个 `<Download>` icon 一个表示"导入"一个表示"导出"造成视觉混淆。

**新态**：在第 3 项（进入资产阶段）**之后**、第 4 项（一键全跑）**之前**插入「下载剧本…」按钮：

```tsx
{(project.artifacts['screenplay.7'] || (isAdapt && project.artifacts['adapt.6'])) && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setExportDrawerOpen(true)}
    title="下载剧本为 .fdx (Final Draft) 或 .fountain"
  >
    <FileDown className="size-4" /> 下载剧本…
  </Button>
)}

<ExportDrawer
  open={exportDrawerOpen}
  onClose={() => setExportDrawerOpen(false)}
  scope="screenplay"
  source={{ type: 'live' }}
/>
```

- **图标**：lucide `FileDown`（明确不同于 `Download`，避免 line 314 视觉冲突）。
- **标签**：「下载剧本…」三连点暗示"会弹抽屉让你选格式"，与 macOS / Windows GUI 习惯一致。
- **可见性**：与现有「进入资产阶段」共享条件 `screenplay.7 || (isAdapt && adapt.6)`——无最终剧本时不可见，避免空抽屉。
- **新增 lucide import**：`FileDown` 加入 line 3-7 import 列表。

### 6.3 抽屉项卡片状态机

每张导出项卡有 3 种状态：

| 状态 | 触发条件 | 视觉 | 交互 |
|---|---|---|---|
| **enabled** | 数据齐全 | 卡片正常 + 主标题 + 描述 + 计数 metadata + `<Download>` icon | hover 抬升 (DESIGN.md `card.variants.interactive`) · click → 触发 build & download |
| **partial** | 数据不全（如 5/10 章） | 卡片正常 + 黄色 `<AlertTriangle>` icon + tooltip「仅含 N 章（共 M 章）」 | 仍可 click，按 FR-10 含警告横幅 |
| **disabled** | 数据完全缺失 | 整卡 `opacity-50 cursor-not-allowed` + tooltip「请先完成 …」 | click 无响应；`aria-disabled="true"` |

> **降级保证**：抽屉打开后**至少有 1 项 enabled** —— 若 scope='novel' 但小说一章未写，2 项 disabled 抽屉空虚——按 NFR-4 a11y 仍可用，但 §7 acceptance 给定"降级 UX 测试"要求测此情形不崩。

### 6.4 关闭与回归

- **关闭路径 3 种**（DESIGN.md modal 必备）：右上角 `<X>` / 点击 overlay / `Esc`
- **关闭后焦点回归**：触发按钮（NFR-4 已锁）
- **下载完成后**：抽屉**保持打开**（用户可能想连续导多种格式）；toast「✓ 已下载 <filename>」（复用项目现有 toast 模式；若无 toast 系统则 `console.log` 兜底）
- **关闭抽屉时未做下载**：纯 noop，不污染任何 state

### 6.5 token 落地速查（AI 协作者直接拷）

```tsx
// 抽屉容器
<div role="dialog" aria-modal="true" aria-labelledby="export-drawer-title"
     className="fixed inset-y-0 right-0 w-[420px] bg-bg-surface border-l border-border-default
                shadow-floating transition-transform duration-240">

  {/* header */}
  <header className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
    <h2 id="export-drawer-title" className="text-heading-m">导出</h2>
    <Button iconOnly variant="ghost" onClick={onClose} aria-label="关闭">
      <X className="size-4" />
    </Button>
  </header>

  {/* body */}
  <div className="px-6 py-4 space-y-3">
    {items.map(item => (
      <button key={item.id}
              className="card w-full text-left p-4 hover:elevation-floating transition"
              onClick={item.onClick}
              disabled={item.disabled}
              aria-disabled={item.disabled}
              title={item.tooltip}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-heading-s">{item.title}</div>
            <div className="text-body-s text-fg-secondary mt-1">{item.subtitle}</div>
            <div className="text-caption-m text-fg-muted mt-1">{item.metadata}</div>
          </div>
          <Download className="size-4 text-fg-secondary mt-1" />
        </div>
      </button>
    ))}
  </div>

  {/* footer */}
  <footer className="absolute bottom-0 inset-x-0 px-6 py-3 border-t border-border-subtle flex justify-end">
    <Button variant="outline" onClick={onClose}>关闭</Button>
  </footer>
</div>
```

> 上述代码示例是**契约**而非最终实现；AI 协作者落地时按 DESIGN.md token 翻译，不允许引入 arbitrary value。`shadow-floating` / `elevation-floating` 等 utility 若不存在，按 DESIGN.md `elevation.themes.dark.floating` 在 `tailwind.config.ts` 补 utility（属红线 #5 之外的"必要扩展"，CA 阶段决议）。

---

## §7 Acceptance Criteria（验收准则）

> 8 条 AC，全部可执行。每条标注关联的 FR/NFR。
> AC 通过 = 本 PRD 落地完成 = `stepsCompleted` 在实施阶段（CA→CK→IMPL→VP）后可进入收口。

### AC-1 · 6 种格式 happy-path 各成功 1 次（FR-1~5）

**Given** 一个 dogfood 项目：≥ 10 章已润色小说 + 已完成的 screenplay.7 + 已跑完三路引擎的资产
**When** 在 Home 卡 / Novel toolbar / Screenplay toolbar 三处分别打开抽屉，依次点 6 种导出项
**Then** 浏览器各下载 1 个文件，分别为：
- `<safeName>_<stamp>.md` · 用 VS Code 打开 · 章序与 IDB chapterContents 完全一致
- `<safeName>_<stamp>.docx` · 用 Word 2016+ 打开 · H1 项目名 / H2 章节正确显示 · 中文不乱码
- `<safeName>_<stamp>.fdx` · 用 Final Draft 8.x+ 打开 · 不弹"file is corrupt"
- `<safeName>_<stamp>.fountain` · 用 Highland / Beat 任一打开 · 场景头/动作/对白/转场识别正确
- `<safeName>_assets_<stamp>.csv` · 用 Excel 2016+ 打开 · 中文不乱码 · 列序 = `分类,名称,描述,视觉风格,提示词,关联场次,备注`
- `<safeName>_<stamp>.flil.json` · 与本 PRD 落地前导出对比 · **byte-for-byte 一致**（红线 #2 反向证明）

### AC-2 · partial-data 降级（FR-10）

**Given** 仅 5/10 章节已润色（`novel.7.meta.completedChapters = [1,2,3,4,5]`）
**When** 在 Novel toolbar 抽屉中点 `.md` 导出
**Then**：
- 文件成功下载（不阻塞）
- 文件首行警告 `> ⚠ 注：仅含 5 章（共 10 章未完成）`
- 章节按 1→5 升序输出（FR-6）
- 抽屉项卡片显示 `<AlertTriangle>` 黄色 icon + tooltip「仅含 5 章（共 10 章）」（§6.3 partial 态）

### AC-3 · disabled 态正确（FR-10 · §6.3 disabled）

**Given** 一个空项目（无 novel.6 / 无 screenplay.7 / 无 assets.2-4）
**When** 打开 Home 卡抽屉（scope='all'）
**Then**：
- 5 项格式卡片全部 `aria-disabled="true"` + opacity-50 + 各自 tooltip 提示
- 仅 `.flil.json` 项目包项 enabled（项目元数据可单独导出）
- click disabled 项无响应 / 不触发任何下载 / 不报错

### AC-4 · Home 行为变更覆盖（FR-11.1）

**Given** 一个旧用户（v2 阶段 2.10 习惯）在 Home 卡单击 `<Download>` icon
**When** PR 落地后再次单击
**Then**：
- 不立即下载 `.flil.json`（**行为变更**）
- 弹出抽屉，6 项可选
- 抽屉中第 6 项「项目包 (.flil.json) · 含 manifest 全套元数据」单击 → 触发与原行为 byte-for-byte 一致的 `.flil.json` 下载（AC-1 第 6 子项已隐含验证）

### AC-5 · 离线可用（NFR-3 · G7）

**Given** Chrome DevTools 勾选 `Network → Offline`
**When** 重复 AC-1 全部 6 种导出
**Then**：
- 6 种格式全部成功下载
- DevTools Network 面板录制 = **0 个 outbound request**
- 浏览器 console 无 fetch error / no CORS error

### AC-6 · 性能阈值达标（NFR-1）

**Given** 10 章 / 5 万字小说 dogfood 项目
**When** 在抽屉中点 `.md` 导出，控制台 `performance.now()` 包住 build → blob → download 全过程
**Then**：
- `.md` 导出耗时 P95 ≤ 2 秒
- `.docx` 导出耗时 P95 ≤ 5 秒
- 抽屉打开 → 首屏可交互 ≤ 200ms
- 测量样本 ≥ 5 次（避免单次抖动）

### AC-7 · 数据零副作用（NFR-9）

**Given** 导出前 IDB 状态快照：
```js
const before = {
  artifacts: await db.artifacts.count(),
  liveArtifacts: await db.liveArtifacts.count(),
  runHistory: await db.runHistory.count(),
  projects: await db.projects.count(),
};
```
**When** 完成 AC-1 全部 6 种导出
**Then** 导出后快照与导出前 **完全一致**：
```js
const after = ...;
console.assert(JSON.stringify(before) === JSON.stringify(after));
// localStorage 也不变
console.assert(localStorage.getItem('FLIL.settings') === before.settings);
```

### AC-8 · 构建与类型零退化（NFR-8）

**Given** 本 PRD 实施完成（`src/components/ExportDrawer.tsx` + `src/store/exportFormats.ts` + 3 处页面 patch 落盘）
**When** 运行 `npx vite build` 与 `npx tsc --noEmit -p .`
**Then**：
- vite build：modules 数 ≤ 1921（基线 1911 + 10 冗余）/ 总耗时 ≤ 3.15s（基线 ~3s + 5%）/ 0 error
- tsc：除 pre-existing `@types/node` 缺失警告外无新增 error
- 不引入新 npm 依赖（`package.json` diff 仅版本号无新增）

---

## §8 Success Metrics（成功度量）

> 单人 for-self 项目 = **不依赖埋点 / telemetry / 后端**。
> 全部度量手段 = "用户日记 + dogfood 实测计时 + git commit 节奏"。

### 8.1 业务度量（绑定 brief §5 dogfood 收尾态）

| 度量 | 目标 | 失败响应 |
|---|---|---|
| **小说 dogfood 一次性导出** | ≥ 10 章 / ≥ 5 万字 用 `.md` 1 次操作完成投稿稿 | 若仍需手工拼章 → 触发 §9 R-1 修复 |
| **剧本 dogfood Final Draft 兼容** | 1 部短剧 `.fdx` 文件在 Final Draft 桌面版打开，0 错误对话框 | 失败 → 退回 .fountain；若 .fountain 也错 → 触发 R-3 |
| **资产 csv 制片人友好** | 1 份 `.csv` 在 Excel 2016+ 打开后，无需手工调列即可分组排序 | 失败 → 调整 FR-9 字段映射，迭代 v3.1 |
| **Home 行为变更接受度** | dogfood 期间 0 次"找不到怎么导 .flil.json"困惑（自评） | 失败 → 抽屉文案加亲和提示或回退 D 路线（§6 menu D） |

### 8.2 实施度量（验证落地工艺）

| 度量 | 目标 | 备注 |
|---|---|---|
| **代码量预算** | 新增 ≤ 800 行 / 修改 ≤ 100 行 | NFR-7 surgical 验证 |
| **PR 提交节奏** | 1 周内（v3 路线 Week 1 限定） | brief §4 排序 e=Week 1 |
| **回归无破坏** | 旧 4 模式（短剧 / 改编 / 特殊 / 小说）dogfood path 全通过 smoke | NFR-8 |
| **AI 协作者上手时间** | Cascade / Claude 读完本 PRD + DESIGN.md + AGENTS.md ≤ 10 分钟可写第一行代码 | brief §3 audience |

### 8.3 度量收集机制

- **业务度量**：v3 dogfood 期间每完成一种导出，在 `docs/dogfood-log.md`（如不存在则本次创建）追加一条 `<日期> <格式> <项目名> <耗时> <问题>`，作为 brief §5 收尾态硬指标的输入。
- **实施度量**：依靠 `git diff --stat` + `npx vite build` 输出 + AGENTS.md §"验证"3 步走，**不引入额外工具链**。

---

## §9 Risks & Mitigations（风险登记册）

> 4 项风险，按"破坏性 × 概率"排序。每条给监控指标 + 触发缓解方案。

### R-1 · `.docx` Word 兼容性不确定（**高破坏 × 中概率**）

- **风险描述**：Word HTML 容器路线（FR-2 首选）虽是行业历史路径，但 Word 2016+ 在打开 `.docx` 扩展名 + HTML 内容时**可能弹"是否转换格式"对话框**，影响 AC-1 happy-path。
- **触发条件**：用户在 Word 中看到对话框 → 点"是" → 内容仍可读但格式可能丢失（如标题层级降级为普通段落）。
- **监控**：AC-1 第 2 子项 dogfood 实测；若对话框出现 **≥ 2 次/3 次测试**，即触发缓解。
- **缓解方案**：
  - L1（首选）：调整 HTML meta 标签（加 `<!--[if gte mso 9]>` MSO 条件注释），多数情况可消除对话框。
  - L2（退路）：启用 NFR-2 中预案——`docx` npm 包 lazy import，生成真正 OOXML zip。代价：~150KB gzip vendor chunk。
  - L3（兜底）：把 G2 .docx 降级为 v3.1 目标，本 PRD 仅交付 G1 .md。需 §10 范围调整。

### R-2 · Final Draft 版本兼容性碎片（**中破坏 × 中概率**）

- **风险描述**：FR-3 fdx 骨架基于"Final Draft 8.x"，但用户实际可能拿到 FD 7 / 9 / 10 / 12 任一版本。8.x 之外版本对 `<FinalDraft Version="1">` 属性敏感度未知。
- **监控**：U2 dogfood 实测中至少 1 次拿真实 FD 桌面版打开。
- **缓解方案**：
  - L1：fdx 骨架提供 `Version="1"` 默认值；若 FD 9+ 报错，调整为 `Version="2"` 或 `Version="3"` 试错（前端常量切换，无依赖）。
  - L2：FR-4 .fountain 是兜底路径——任何 fountain 解析器都比 fdx 鲁棒。建议 §6 抽屉将 .fountain 排在 .fdx 之上引导用户优先选 .fountain。
  - L3：放弃 .fdx，仅交付 .fountain，G3 → v3.1。

### R-3 · Word 中文字体在不同 OS 上的回退（**低破坏 × 高概率**）

- **风险描述**：FR-2 HTML 路线设 `font-family: 'Microsoft YaHei', 'PingFang SC', serif`。Windows / macOS 各有一字体，但 Linux + Office 365 网页版可能字体回退为 Arial → 中文渲染异常。
- **监控**：本 PRD 持有 dogfood 实测仅 Windows + Word 桌面版。
- **缓解方案**：dogfood 阶段不必处理（QvQ persona 是 Windows 桌面）；外部分享时若收到反馈再加 `<style>@font-face</style>` 嵌入字体（违反 NFR-3 离线零依赖，仅 v3.x 后续考虑）。

### R-4 · 抽屉打开破坏现有 Home / Novel / Screenplay 状态（**高破坏 × 低概率**）

- **风险描述**：3 处页面引入 `<ExportDrawer>` + 新 useState 后，可能与现有复杂 state（chainBusy / runStates / abortRef / Best-of-N / hardGate）产生意外副作用。
- **监控**：NFR-8 dogfood smoke 4 步 + 旧 4 模式回归 smoke。
- **缓解方案**：
  - L1：`<ExportDrawer>` props **完全独立**，不读 / 不写任何现有 state（hooks 内自闭）。
  - L2：3 处插入仅 1 个 `useState<boolean>` + 1 个 `<ExportDrawer>` JSX，不修改任何现有 onClick / handlerName，做到 PR diff "纯 add line"无 modify line。
  - L3：CK checkpoint 阶段（实施前）执行 BMAD validate 反向引用扫描确保 surgical。

### R-5 · BMAD-METHOD workflow 自身偏离（**低破坏 × 低概率**）

- **风险描述**：本 PRD 由 CP workflow 8 步生成。若后续 CA / VP / CK / IMPL 任一环节偏离 BMAD 信条 #5（halt），可能导致"PRD 写得严格但实施时漂移"。
- **缓解方案**：本 PRD 在 frontmatter `related` 已预占 `architecture-gap-e-export.md` + `prd-gap-e-export-validation.md` 两个 BMAD 阶段产物路径。CA 阶段必须读本 PRD §4-§7 而不重新设计。

---

## §10 Out-of-Scope（明确不做清单 · 收口检查）

> 收口本 PRD 明牌的"不做项"，便于 CK / VP 阶段拦截 scope creep。
> 与 §2.2 / §3.3 重复但更细，作为 PRD 终篇的 single-source-of-truth。

### 10.1 格式范围外

| 不做 | 理由 | 推迟到 |
|---|---|---|
| **PDF 直接生成** | 中文字体嵌入复杂 + 200KB+ 依赖；用户 .docx → Word Export PDF 是行业标准链路 | 用户自行处理 |
| **EPUB / MOBI 电子书** | brief §6 已划入 v3 out-of-scope | v3.x 之后 |
| **`.txt` 纯文本** | `.md` 已可被 .txt 阅读器打开 | 永不 |
| **`.rtf`** | 字段碎片严重，Word 已用 .docx | 永不 |
| **`.epub`** | 需要打包 zip + manifest，引入 jszip 依赖（NFR-2 拒绝） | v3.x 之后 |
| **`.html`（独立浏览器查看）** | `.md` 在 影语 FLIL 内的 PreviewModal 已可视 | 永不 |

### 10.2 流程范围外

| 不做 | 理由 |
|---|---|
| **导出后云上传 / 邮件分享** | brief §6 排除 SaaS 化 |
| **导出预览（浏览器内 .docx 渲染）** | 体积大 / UX 收益低 |
| **多卷分卷分文件** | 缺口 a 多卷架构触发后再补 |
| **多文件 zip 打包（按章一文件）** | 引入 jszip ~100KB 依赖 |
| **导出前格式转换确认对话框** | 单人项目，"点 → 选 → 下载"三步够 |
| **导出后回流为 artifact** | `/intake` 已覆盖原作回流 |
| **批量导出多项目** | dogfood 1 项目 1 次足够 |

### 10.3 数据模型范围外

| 不做 | 理由 |
|---|---|
| **Dexie schema 升级** | 红线 #1 · 缺口 a 多卷再升级 |
| **`.flil.json` 格式变更** | 红线 #2 · 与新格式正交 |
| **artifact 字段补全** | 不为导出回头补 prompt 输出格式 |
| **导出历史记录持久化** | NFR-9 零 IDB 写硬约束 |

### 10.4 UX 范围外

| 不做 | 理由 |
|---|---|
| **移动端响应式** | brief §6 desktop-first |
| **i18n 多语言界面** | 中文 single-language v3 |
| **抽屉宽度自定义** | DESIGN.md 锁 420px |
| **键盘 shortcut（如 `Ctrl+E` 直开抽屉）** | NFR-4 a11y 仅要求 Tab/Esc，不强制 shortcut |
| **导出项排序自定义 / 收藏置顶** | YAGNI |

### 10.5 收口承诺

> 本 PRD 落地后，影语 FLIL 在"导出"维度的能力图谱：
>
> - **创作者交付层（本 PRD 新增）**：`.md` / `.docx` / `.fdx` / `.fountain` / `.csv` 五种业界标准产物
> - **开发者归档层（保留不动）**：`.flil.json` 项目包（v1 schema）
>
> 两层物理隔离 / 入口共生 / 文件名前缀不冲突。
>
> v3 路线下 **不再追加新格式**。任何"加一种格式"提案都触发 v3.x 或 v4 PRD 重启。

---

## §11 引用对齐自检（finalize 收口）

> 落地 AI 协作者读 PRD 时最容易踩"前后引用不一致"的雷。本节做一次性交叉验证。

### 11.1 编号体系完整性

| 体系 | 总数 | 范围 | 反向引用次数 |
|---|---|---|---|
| **G**（Goal） | 7 | G1–G7 | §2.1 定义 → §2.3 / §3.4 / §4 矩阵 / §5 NFR 自检 引用 |
| **U**（Use-Case） | 3 | U1–U3 | §3.2 定义 → §3.4 / §4 矩阵 引用 |
| **FR**（Functional Requirement） | 11 | FR-1–FR-11（FR-11 含 11.1/11.2/11.3 子节） | §4 定义 → §6 UX / §7 AC 引用 |
| **NFR** | 9 | NFR-1–NFR-9 | §5 定义 → §7 AC / §8 度量 引用 |
| **AC**（Acceptance Criteria） | 8 | AC-1–AC-8 | §7 定义 → §8 度量 / §9 风险 引用 |
| **R**（Risk） | 5 | R-1–R-5 | §9 定义 → §7 AC-1 / §8 度量 引用 |
| **红线** | 5 | §0.5 #1–#5 | 全文反复绑定（FR-7 / FR-11 / NFR-2 / NFR-7 / NFR-9 / R-4 / §10.5） |

**自检**：编号无跳号 / 无重复；§4 矩阵覆盖 G1–G7 × FR-1–FR-11；§5 矩阵覆盖 G × NFR；§7 AC 8 条覆盖 G1–G7（G1/G2 → AC-1+AC-2+AC-6 / G3/G4 → AC-1 / G5 → AC-1 / G6 → AC-3+AC-4 / G7 → AC-5）。

### 11.2 代码引用一致性

PRD 全文引用代码位置共 **14 处**（grep `@C:\\`）。AI 协作者落地时若发现行号偏移，需以**符号锚点**（函数名 / 组件名 / 标识符）为准，而非行号：

| 引用 | 锚点（行号偏移容忍后用此定位） |
|---|---|
| `src/store/projectExport.ts:25` | `FLIL_SCHEMA = 'flil/project/v1'` 常量 |
| `src/store/projectExport.ts:113-126` | `packageToBlob` 函数 |
| `src/store/projectExport.ts:128-139` | `downloadBlob` 函数 |
| `src/pages/Home.tsx:107-117` / `Home.tsx:242-250` | 项目卡 `<Button iconOnly>` `<Download>` 渲染处 |
| `src/pages/Novel.tsx:412-505` | `<header>` 顶部 toolbar |
| `src/pages/Novel.tsx:259` `:270` | `chapter title` 默认值 + `chapters.sort` |
| `src/pages/Screenplay.tsx:69-76` / `:309-339` | `exportToAssets()` 函数 + 顶部 toolbar |
| `src/pages/Screenplay.tsx:3-7` | lucide import 列表（`FileDown` 待加） |
| `src/pages/Assets.tsx:9` `:47-51` | `parseLooseArray` import + 剧本来源选择 |
| `src/pipeline/novelLoop.ts:11` `:317-333` | `assembled markdown` comment + `NovelChapterLoopMeta` 接口 |

**验证手段**：CA 阶段开始前，AI 协作者应运行：

```powershell
Get-Content -Path 'docs/planning/prd-gap-e-export.md' | Select-String '@C:\\'
# 对每条结果用 grep_search 验证锚点存在
```

### 11.3 术语一致性

| 术语 | 在本 PRD 中的唯一含义 | 易混淆别名（已在 PRD 中校正） |
|---|---|---|
| **导出（export）** | 创作者交付层 · 5 种新格式（.md/.docx/.fdx/.fountain/.csv） | ❌ 不指 `.flil.json` 项目包 ❌ 不指 Screenplay "导出到资产"页内跳转 ❌ 不指"导入剧本"按钮（其图标恰为 `Download`） |
| **项目包** | `.flil.json` v1 schema · 开发者归档层 | ❌ 不简称为"导出" |
| **抽屉** | `<ExportDrawer>` 单一组件 · 420px DESIGN.md token | ❌ 不指 Modal / Dialog |
| **缺口 e** | brief §4 中的"导出"缺口 · 本 PRD 唯一 scope | ❌ 不指任何其他 v3 缺口（a/b/c/d 各有未来 PRD） |
| **dogfood** | brief §5 收尾态 · ≥ 10 章 / ≥ 5 万字 / 全程不退手工 | 与本 PRD 8.1 业务度量同义 |

### 11.4 BMAD workflow 衔接

| 阶段 | workflow | 入口产物 | 出口产物 | 状态 |
|---|---|---|---|---|
| **CB · 创意简报** | `bmad-create-brief` | (idea seeds) | `docs/planning/product-brief.md` | ✅ 已交付 |
| **CP · 创建 PRD** | `bmad-create-prd` | brief | **本 PRD** | ✅ 已 finalize |
| **CA · 创建架构** | `bmad-create-architecture` | brief + PRD | `docs/planning/architecture-gap-e-export.md` | ⏳ 推荐下一步 |
| **VP · 验证 PRD** | `bmad-validate-prd` | PRD + brief | `docs/planning/prd-gap-e-export-validation.md` | 可选并行 |
| **CK · 实施前 checkpoint** | `bmad-create-checkpoint` | PRD + Architecture | checkpoint memo | CA 后 |
| **IMPL · 实施** | (no workflow · code) | PRD + Architecture + Checkpoint | PR 落盘 + AC-1..8 验证 | CK 后 |
| **VR · 验证落地** | `bmad-validate-release` | PR + AC | release memo | IMPL 后 |

---

## §12 收尾承诺

> 本 PRD 1034 行已 finalize，覆盖 v3 缺口 e 「导出」全部范围。
> 与 brief / DESIGN / AGENTS 在以下硬约束上**完全对齐**：

- ✅ brief §4.1 范围（小说 .md/.docx · 剧本 .fdx/.fountain · 资产 .csv）逐条落到 G1–G5 + FR-1–FR-5
- ✅ brief §5 dogfood 收尾态（≥ 10 章 / ≥ 5 万字 / 全程不退手工）绑定 §8.1 业务度量 + AC-1 / AC-6 阈值
- ✅ brief §6 Out-of-Scope（无 SaaS / 无后端 / desktop-first / for-self）写进 §10.1–§10.4
- ✅ brief §7 风险册（不动 Dexie / 不动 .flil.json / 不动 token）固化为 §0.5 五条红线 + NFR-9 + R-4
- ✅ AGENTS.md 行为硬约束 ① surgical → §0.5 红线 #5 + NFR-7 + R-4 三重锁定
- ✅ AGENTS.md 行为硬约束 ② DESIGN.md token → §6.1 / §6.5 token 速查 + FR-11 强约束
- ✅ DESIGN.md `components.modal.drawer.width = 420px` → §6.1 / §6.5 / FR-11 一致绑定
- ✅ AGENTS.md §"验证" 3 步走 → NFR-8 / AC-8 完整继承

> v3 路线 Week 1 排序点（brief §4 排第一）已通过本 PRD finalize 进入实施轨道。
> CA 阶段入口可立即开启：`/bmad-create-architecture` 输入 = brief + 本 PRD。

### 推荐下一步

**首选 · CA workflow**：
```
/bmad-create-architecture
inputs:
  - docs/planning/product-brief.md
  - docs/planning/prd-gap-e-export.md  ← 本 PRD
output:
  - docs/planning/architecture-gap-e-export.md
focus:
  - FR-2 docx 路线最终决策（HTML 容器 vs docx npm）
  - FR-8 markdown→剧本元素识别器实现路径
  - FR-9 资产 JSON 字段映射的 schema 锁定
  - §6 抽屉 utility 缺失补全方案（shadow-floating / elevation-floating）
```

**并行可选 · VP workflow**（独立验证 PRD 自身完备性）：
```
/bmad-validate-prd
inputs:
  - docs/planning/prd-gap-e-export.md
output:
  - docs/planning/prd-gap-e-export-validation.md
checks:
  - Goal/FR/NFR/AC 矩阵无悬空
  - 代码引用锚点全部存活
  - 红线在全文有反向绑定
```

---

<!-- BMAD CP · 8 步全部完成 · status: final · 下一步 → CA / VP -->
