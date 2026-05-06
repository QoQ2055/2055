# CineForge Web  影语 FLIL

> **单人创作者 + AI 协作工作台**，承载 4 种创作模式  纯前端零后端  浏览器本地存储

CineForge 把 DeepSeek API 包装成 manifest 驱动的多阶段创作流水线，
配套静态 KB / 用户 KB / 方法论模块三层知识注入，
输出剧本 / 资产 / 分镜 / 小说 / 拆书报告。

## 4 种创作模式

| 模式 | 路径 | 主要工作台 | 状态 |
|---|---|---|---|
| **短剧 / 剧本** | `/screenplay` 八步法  `/assets`  `/pipeline` 分镜 | DAG + R1/R9 编辑部 + 评分卡 + 自检 | ✅ dogfood 闭环已验证 |
| **小说** | `/novel` 设定  大纲  章节循环 | 题材锚点 + 方法论模块 + 6 维评分 + 撤销栈 | 🚧 v3 收口（5 缺口待补） |
| **改编** | `/intake` 摄入  `/adapt` A1-A6 派生  `/assets` | S0 档案 + R1' 改编指令书 + R9' 终审 | ✅ 完整可用 |
| **特殊分镜** | `/express` 简介  分镜规划  单元 | 跳过剧本，直接出分镜 | ✅ 完整可用 |

通用工具（任何模式可用）：

- **`/kb`** 知识库浏览（21 篇静态 KB + 用户 KB 库）
- **`/analyzer`** 拆书分析师（两阶段法）
- **`/refinery`** 6 件套章节润色工具
- **`/playground`** 单 prompt 流式调试

## 快速开始

```powershell
cd C:\Users\QvQ\CascadeProjects\cineforge-web

# 1) 装依赖
npm install

# 2) 把 F:\下载文件\八步\*.txt 转成 public/prompts/**/*.json + manifest.json
npm run import:prompts

# 3) 启动开发服务
npm run dev
#  http://127.0.0.1:5173
```

打开后：

1. 点左侧「**设置**」 填 DeepSeek API Key  测试连通应得到 `✅ 连通成功`
2. 点「**项目**」「新建项目」选模式  进入对应工作台
3. 写不动时点「**调试台**」单步调试任一 prompt

## 协作合约（AI 协作者必读）

按读取顺序：

| 文档 | 角色 |
|---|---|
| `@AGENTS.md` | 协作者导航 + 行为硬约束 + 目录速查 + Dexie schema |
| `@DESIGN.md` | 设计系统单一真源（v0.2.0-alpha  token / 双主题 / 7 原子组件） |
| `@docs/planning/product-brief.md` | v3 路线图（5 缺口排序 / dogfood 收尾态） |
| `@CHANGELOG.md` | v2.0-2.10 完整时间线（11 阶段累积） |
| `@.windsurf/rules/karpathy-guidelines.md` | Karpathy 4 原则（always_on 行为约束） |

## 已交付能力（v2.0  2.10  11 阶段）

完整时间线见 `@CHANGELOG.md`。最近 5 阶段：

- **2.10** DESIGN.md 设计系统全量重塑（C 档位  暗+亮双主题  7 原子组件）
- **2.9** AI 综合评分卡 ScoreCard（6 维加权 + 历史 sparkline）
- **2.8** 诊断  一键修改闭环（修复路径接入项目知识层）
- **2.7** 全仓 simplify 扫描（dead-code elimination）
- **2.6** 润色撤销栈持久化（Dexie liveRefinementUndo）

底层基建：题材锚点（15 题材） / 24 方法论模块 / 21 篇静态 KB /
用户 KB 库 / 6 维评分卡 / 诊断-修改闭环 / token-driven 设计系统。

## v3 计划

**主轴**：把小说线追平到短剧线 dogfood 闭环水平。

按价值密度排序的 5 缺口（详见 `@docs/planning/product-brief.md`）：

```
0  README 重写               0.5 天  本文档
1  缺口 e  导出             1 周    阻塞闭环出口（小说.md/.docx + 剧本.fdx/.fountain）
2  缺口 d  进度可视化        1 周    章节 grid + 字数曲线 + 评分热力图
3  缺口 b  角色 bible        2-3 周  跨章节状态追踪
4  缺口 c  章节衔接          2 周    prevChapterTail 注入 + 衔接顺畅度评分维
5  缺口 a  多卷架构          4 周    条件触发，可推 v4
?   v3 dogfood:  10 章 /  5 万字真实小说产出  收 v3
```

## 目录结构

```
cineforge-web/
 DESIGN.md                       # 设计系统 v0.2.0-alpha
 AGENTS.md                       # 协作者导航
 CHANGELOG.md                    # 时间线
 docs/planning/                  # BMAD 产物（product-brief / prd / architecture）
 .windsurf/                      # AI 工作流 / 规则 / skills
    rules/                      # always_on / model_decision 规则
    skills/                     # design-md / bmad-method 等大型 skill 本地副本
    workflows/                  # /init /simplify /memory slash 命令
 public/
    prompts/manifest.json       # 主流水线节点定义
    methods/manifest.json       # 24 个方法论模块
    kb/                         # 21 篇静态 KB
 scripts/                        # import-prompts.mjs / smoke-novel.mjs
 src/
     components/                 # 27 文件 + ui/ 7 个原子组件
     data/                       # 静态分类 + 题材锚点
     hooks/                      # 自定义 React Hooks
     llm/                        # deepseek SSE 流式 client
     pages/                      # 12 个路由页
     pipeline/                   # 29 文件  runner / compose / 评分 / 自检
     store/                      # zustand + Dexie v4 schema
```

## 技术栈

- **前端**：React 18 + TypeScript 5 + Vite
- **样式**：TailwindCSS（DESIGN.md token-driven） + lucide-react
- **状态**：Zustand + Dexie (IndexedDB) v4 schema
- **LLM**：DeepSeek（OpenAI 兼容 SSE 流式）
- **路由**：react-router 6 (HashRouter)

## 安全说明

- API Key 仅写入浏览器 `localStorage`（key = `FLIL.settings`），**永不上传任何服务器**
- 所有产物落 IndexedDB（库名 `FLIL`），可在 DevTools  Application  IndexedDB 查看/清空
- 部署到任意静态托管（Vercel / Netlify / GitHub Pages / 本地 `file://`）均可
- 项目级别 `.flil.json` 导入导出在 Home 页

## License

私有项目（无正式 license）。