# FLIL 影语 · 网页启动器（M0–M4 + 方案 B 增强）

> 把 `F:\下载文件\八步\` 下的 14 份 deepseek prompt payload 装配成一条**纯前端**短剧 AI 流水线。
> 当前版本：**M0 脚手架 + M1 LLM + M2 manifest 串联 + M3 剧本工作台 + M4 资产工作台**。
> 后续：M5 分镜逐单元循环 / M6 ZIP 导出。

## 功能（已完成）

- ✅ **M0** Vite + React 18 + TS + Tailwind 暗色 UI / Hash 路由 / 零后端
- ✅ **M1** 设置页（API Key 一键测试连通）+ 调试台（单步流式调试任一 prompt）
- ✅ **M1** IndexedDB（Dexie）schema、token / 价格估算
- ✅ **M2** manifest 驱动的 pipeline 引擎：
  - `pipeline/manifest.ts`：加载 `public/prompts/manifest.json`
  - `pipeline/interpolate.ts`：`{{path | filter:arg}}` 插值 + `applyProjectContext()`（替换硬编码"仙侠爱情/5分钟"为用户输入）
  - `pipeline/compose.ts`：上游产物自动注入（screenplay 步骤拼"上游产物"段；assets 把剧本喂给扫描器+引擎；storyboard.1 自动 paragraphize 成 `{paragraphIndex, assetList}`）
  - `pipeline/runner.ts`：单步执行 + JSON 校验 + abort 信号
  - `pipeline/paragraphize.ts`：剧本切段（§1, §2, …）
- ✅ **M2** 流水线页 `/pipeline`：项目上下文输入 + 三阶段 14 步可视面板 + **单步运行 / 从此起跑到阶段末 / 跑完整阶段** + 实时流式预览 + 复制 / 清除产物
- ✅ **M3** 剧本工作台 `/screenplay`（八步法专用）：
  - 顶部 DAG 横向流程条，状态色点（idle/running/done/passed/stale/error）+ 一键全跑
  - 每步「**通过 / 修改 / 重跑 / 自检 / 从此跑到 S8**」5 大动作
  - **修改**：内嵌全屏编辑器，保存后下游自动 stale；**重跑**清产物并立即重新跑
  - **自检**：复用 Step 8 医生 system 做单步定向诊断 → 解析 JSON 渲染严重度徽章
  - 硬约束实时校验（logline ≤80 字 / Step 7 总字 3000-3600 / 场次 8-10 / 累计 300s±10% …）
  - markdown 美观渲染（react-markdown + remark-gfm 自定义样式）；Step 8 自动美化 JSON
  - 「修改」即把下游 stale 标记并清掉 passed；自动级联通过下一步可在设置里关
- ✅ **M4** 资产工作台 `/assets`（gate-then-parallel）：
  - 顶部完整性扫描闸卡（assets.1，markdown 渲染）+「全跑（扫描→并发）」「三路并发（保持扫描）」按钮
  - **真并发**：`Promise.all([roles, scenes, props])` 同时调三路引擎，流式输出独立、互不干扰
  - 三 Tab：角色 / 场景 / 道具，每 Tab 卡片矩阵（grid 1/2/3 列响应式）
  - 每张卡：name / category 徽章 / belongsTo / 视觉锚点 / 戏剧功能 / aiPrompt 预览
  - 一键 **复制 AI 文生图 prompt**（即可粘进 Midjourney / SD / 即梦）；**JSON** 复制整张卡 schema
  - **展开全部字段**：把任意 schema 键值表平铺出来，材质 / 工艺 / 装饰 / 机制等都看得到
  - 宽容 JSON 解析（`pipeline/jsonLoose.ts`）：去 ```json``` 围栏、去尾逗号、不完整数组也能尽量抢救对象
- ✅ **方案 B** 从 ShadowScript 影语项目沉淀的 9 篇 S 级知识库（KB）+ 编辑部 R1/R9：
  - `public/kb/`：去 AI 味注册表 / 视觉风格库（30 种）/ 117 运镜库 / 14 情绪 FACS 三维对照 / 打斗三幕 + 相机锁定 / 质量增强词 / 关键分镜图引擎 / 道具方法论
  - `pipeline/kb.ts`：按 nodeId → KB 自动注入（剧本写作步注「去 AI 味」；分镜步注「运镜+质量+情绪+打斗」；资产步注「风格库+道具」），自带 4KB 压缩
  - **R1 总编**（`/screenplay` DAG 最前的 👑 R1）：在 Step 1 之前生成 JSON 创作指令书（主题锚定/受众/题材/钩子/红线/节拍策略），自动注入到下游 8 步 system 头
  - **R9 总编**（DAG 最后的 ⚖ R9）：Step 8 之后做 4 维度评分（主题/受众/商业/指令书对齐）+ 4 级裁决（APPROVED / REVISION_MINOR / REVISION_MAJOR / REJECTED）+ 关键问题表（可点 → Step N 跳转）
  - 「**一键全跑**」自动覆盖 R1 → S1..S8 → R9
  - 设置页双开关 `enableKbInjection` / `enableEditorialRounds`，按需关闭以省 token
  - 新增 `/kb` 页：浏览全部 KB 内容，按类别（写作/视觉/镜头/打斗/资产）分类
- ✅ **改编模式**（adaptation）：从原作（小说/网文 / 旧剧本翻拍）出发的双轨流水线
  - 新建项目对话框分模式：原创 vs 改编（含改编类型二选一）
  - **S0 原作摄入** `/intake`：分块粘贴（支持「整本一键切章」按 `第 X 章 / Chapter X / ##` 启发式切分）→ 逐块流式摘要为 JSON（brief/beats/characters/standoutLines/notes）→ 一键合成 **改编档案 masterDocument**（logline/themes/mainCharacters/beatSheet/worldRules/standoutLines/adaptationRisks）
  - **R1' 改编指令书**：在原创 R1 字段基础上新增 `adaptationStrategy` (FAITHFUL/RESTRUCTURE/LOOSELY_INSPIRED) + `mustKeep` + `mustCut` + `riskList` (含 ip/length/violence/sex/culture/OOC/logic 7 类风险)
  - 改编模式下 S1..S8 的 system prompt 自动注入：`ADAPTATION_ADDENDUM`（档案优先硬律）+ S0 档案摘要 + R1' 指令书 — 模型不再看原文，仅看结构化档案
  - **R9' 改编终审**：在原创 4 维度基础上新增 `fidelityScore`（原作忠实度）/ `originalityScore`（再创作灵气）+ `ipRiskCheck`（PASS/WARN/FAIL）三维度
  - 项目档案随 IndexedDB 持久化（含原文 chunks），载入即可继续

## 快速开始

```powershell
cd C:\Users\QvQ\CascadeProjects\cineforge-web

# 1) 装依赖
npm install

# 2) 把 F:\下载文件\八步\*.txt 转成 public/prompts/**/*.json + manifest.json
npm run import:prompts
# 或自定义源目录：
# node scripts/import-prompts.mjs "F:\下载文件\八步"

# 3) 启动开发服务
npm run dev
# → http://127.0.0.1:5173
```

打开后：

1. 点左侧「**设置**」→ 填 DeepSeek API Key → 点「测试连通」应得到 `✅ 连通成功`。
2. 点左侧「**调试台**」→ 顶部下拉切换任一 prompt（剧本 1-8 / 资产 1-4 / 分镜 1-2）→ 「运行」流式输出。

## 目录结构

```
FLIL-web/
├── public/prompts/              # 由 scripts/import-prompts.mjs 生成
│   ├── manifest.json
│   ├── screenplay/  1..8.json
│   ├── assets/      1..4.json
│   └── storyboard/  1..2.json
├── scripts/
│   └── import-prompts.mjs       # 把 .txt 转 .json 并写 manifest
└── src/
    ├── main.tsx · router.tsx · index.css
    ├── components/Layout.tsx
    ├── pages/
    │   ├── Home.tsx             # 项目列表（占位）
    │   ├── Settings.tsx         # API Key / 模型 / 温度
    │   ├── Playground.tsx       # M1：单步调试任一 prompt
    │   └── Project.tsx          # M3 占位
    ├── llm/
    │   ├── deepseek.ts          # OpenAI 兼容 SSE 流式 fetch
    │   └── cost.ts              # token/价格估算
    └── store/
        ├── settings.ts          # zustand + persist
        └── db.ts                # dexie schema
```

## 安全说明

- API Key 仅写入浏览器 `localStorage`（key=`FLIL.settings`），**永不上传任何服务器**
- 所有产物落 IndexedDB（库名 `FLIL`），可在 DevTools → Application → IndexedDB 查看/清空
- 部署到任意静态托管（Vercel/Netlify/GitHub Pages/本地 file://）均可

## 路线图

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 脚手架 + Tailwind + 路由 + Dexie | ✅ |
| M1 | DeepSeek SSE 流式 + 设置页 + 调试台 | ✅ |
| M2 | 读取 manifest.json + `{{}}` 模板插值器 | ⏳ |
| M3 | 八步剧本工作台（DAG + 流式 + 通过/修改/重跑） | ⏳ |
| M4 | 资产闸 + 三路并行 + JSON 校验 + 资产卡渲染 | ⏳ |
| M5 | 分镜单元规划 + 并发循环 + Phase G 自检 | ⏳ |
| M6 | ZIP 打包导出 / 项目导入 | ⏳ |
