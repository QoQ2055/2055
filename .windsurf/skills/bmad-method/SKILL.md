---
name: bmad-method
description: BMAD-METHOD v6.3.0 方法论蒸馏版 (蒸馏自 https://github.com/bmad-code-org/BMAD-METHOD, 日期 2026-04-23). 用于 brownfield 重构 (如 CineForge 网页版从 Electron 迁移) 或 greenfield 新项目. 覆盖 4 阶段 (Analysis / Planning / Solutioning / Implementation) 共 30+ workflow (product-brief / create-prd / create-architecture / create-epics-and-stories / dev-story 等). 触发词:"按 BMAD 走" / "bmad-help" / "下一步做什么" / "写 PRD" / "出架构" / "分 story" / "做 project context" / "document project" / "DP" / "GPC" / "CP" / "CA" / "CE" / "DS"
---

# BMAD-METHOD 方法论 · CineForge Web 定制版

> ⚠️ **入仓残留问题提示（v0 蒸馏版）**：本 SKILL 为外部 LLM 对 BMAD 代码仓读后的个人蒸馏作品，未经上游官方背书。使用前请走瞅 https://github.com/bmad-code-org/BMAD-METHOD 核对术语与阶段依赖。原文中提及的 `feedback_workflow_l1l2l3.md` 在本仓中 **不存在**，CineForge Web 的实际反馈循环请以 `@C:\Users\QvQ\CascadeProjects\cineforge-web\AGENTS.md` 为准。

## 这 Skill 是什么

这是 **BMAD-METHOD v6.3.0 的蒸馏版本**, 由 Claude 读官方 repo 264 份 skill 文件后, 按**solo dev · brownfield(Electron→Web) · 中式 UX 对话**场景剪裁出的一份**方法论手册 + 关键模板参考**.

**源头**: https://github.com/bmad-code-org/BMAD-METHOD · MIT License · 最新版 v6.3.0
**本地本**: 本仓 `@C:\Users\QvQ\CascadeProjects\cineforge-web\.windsurf\skills\bmad-method\` 下仅保留本 SKILL.md + 4 份模板 + 2 份 workflow CSV；完整 264 份原始文件请去上游仓获取。

**为什么不装官方 npm 包**: 官方 `npx bmad-method install` 会往 `.claude/skills/` 铸 264 个 slash command. 本项目只需方法论指导不需全部 workflow 可触发, 故做蒸馏版.

---

## 核心信条 (读懂 BMAD 先读这)

1. **AI 不替你思考, AI 陪你思考**. BMAD 不是"输入需求自动出代码", 是 **facilitator** — 在 PRD/架构/story 每步做 structured elicitation 把你脑子里的东西挖出来并结构化.
2. **fresh chat per workflow**. 每个 workflow (product-brief / create-prd / create-architecture / etc.) **开新对话**. 禁止一个对话里连跑多 workflow — context bloat 会让质量下降.
3. **step-file architecture**. 每个 workflow 拆成 micro-files (step-01, step-02...). 一次只加载当前 step, 做完等用户按 Continue 才进下一步. **永不同时加载多个 step**.
4. **append-only document building**. PRD / Architecture / Stories 这类产物是**一步步追加**建起来的, 不是一次性写完再改. frontmatter 里 `stepsCompleted: []` 追踪状态.
5. **要 halt 就 halt**. 任何 step 里有 menu 让用户选项, 必须停下等输入. 不猜.

---

## 4 阶段 · 产品到代码的流水线

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ 1. Analysis  │──▶│ 2. Planning  │──▶│ 3. Solutioning│──▶│4. Implementation│
│   (理解 WHY) │   │   (定 WHAT)  │   │   (出 HOW)    │   │   (真写代码)   │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
   brainstorm         create-prd       create-architecture   create-story
   product-brief      validate-prd     create-epics-stories  dev-story
   document-project   create-ux-design check-impl-readiness  code-review
                                                             retrospective
```

每阶段下的 workflow 都是一个 slash-style skill. 阶段间有硬依赖 (CSV `before`/`after` 字段), 不能跳.

---

## Workflow 完整索引 · 按阶段

### 🔍 阶段 1 · Analysis (理解 WHY)

| 代号 | Workflow | 何时用 | 产出 |
|:---:|---|---|---|
| **DP** | `bmad-document-project` | **brownfield 首步**. 让 agent 扫你已有代码库生成 AI 友好文档 | project-knowledge/ 目录 |
| **GPC** | `bmad-generate-project-context` | brownfield 必做. 生成 LLM 优化的 `project-context.md` (AI coding 规则) | `project-context.md` |
| **BP** | `bmad-brainstorming` | 想法还没清晰时做发散 | brainstorming session 记录 |
| **MR** / **DR** / **TR** | `bmad-market-research` / `bmad-domain-research` / `bmad-technical-research` | 分别做市场 / 领域 / 技术可行性调研 | research 文档 |
| **CB** | `bmad-product-brief` | 想法清晰了, 出 1-2 页产品简报 | `product-brief.md` |
| **WB** | `bmad-prfaq` | 想法还不确定, 要压力测试(Amazon Working Backwards 法) | prfaq 文档 |

**brownfield 场景 (CineForge Web)**: 先 **DP → GPC**, 然后看情况决定跳 CB 还是直接进阶段 2.

---

### 📋 阶段 2 · Planning (定 WHAT)

| 代号 | Workflow | 何时用 | 依赖 | 产出 |
|:---:|---|---|---|---|
| **CP** | `bmad-create-prd` | **必做**. 做 PRD (产品需求文档) | CB(推荐) | `prd.md` |
| **VP** | `bmad-validate-prd` | CP 后, 独立对话验证 PRD 质量 | CP | PRD 验证报告 |
| **EP** | `bmad-edit-prd` | VP 报告有问题, 回来改 | VP | 更新的 PRD |
| **CU** | `bmad-create-ux-design` | UI 重的项目做 (CineForge Web 必做) | CP | UX 设计文档 |

**CineForge 路径**: `CP → VP → (EP) → CU`.

---

### 🏗 阶段 3 · Solutioning (出 HOW)

| 代号 | Workflow | 何时用 | 依赖 | 产出 |
|:---:|---|---|---|---|
| **CA** | `bmad-create-architecture` | **必做**. 做技术架构决策 | CP | `architecture.md` |
| **CE** | `bmad-create-epics-and-stories` | **必做**. 把 PRD+Arch 切成 epics/stories | CA | `epics/` + `stories/` 目录 |
| **IR** | `bmad-check-implementation-readiness` | **必做**. 跨对照 PRD/UX/架构/stories 有没有对不齐 | CE | readiness 报告 |

**没 IR 过关不能动代码**. 这是 BMAD 的硬闸.

---

### 🔨 阶段 4 · Implementation (真写代码)

两种路径:

#### 路径 A · 正式 sprint 循环 (推荐 · 长项目)
```
SP (sprint-planning) → CS (create-story) → VS (validate-story) → DS (dev-story) → CR (code-review) → 下一 CS ...
                                                                                     │
                                                                                     ↘ ER (retrospective) · epic 结束
```

| 代号 | Workflow | 做什么 |
|:---:|---|---|
| **SP** | `bmad-sprint-planning` | 按 epics/stories 出 sprint 计划 (sprint-status.yaml) |
| **CS** | `bmad-create-story` (action: create) | 从 sprint 里挑下一个 story, 塞上 dev notes 上下文 |
| **VS** | `bmad-create-story` (action: validate) | 独立对话验 story 够不够 dev 下嘴 |
| **DS** | `bmad-dev-story` | **真·写代码**. red-green-refactor. story 里有 halt 条件必须停 |
| **CR** | `bmad-code-review` | **另换一个 LLM** 做 code review (推荐: GPT/Gemini 做 CR 避免同模型盲区) |
| **CK** | `bmad-checkpoint-preview` | 人类 commit/branch/PR 审 |
| **QA** | `bmad-qa-generate-e2e-tests` | DS 完成后生成 E2E 自动化测试 |
| **ER** | `bmad-retrospective` | epic 结束做回顾 |
| **CC** | `bmad-correct-course` | 路子走歪了, 评估是重启 PRD / 重做架构 / 重切 stories |

#### 路径 B · Quick Dev (bug 修 / 小改动)
| 代号 | Workflow | 做什么 |
|:---:|---|---|
| **QQ** | `bmad-quick-dev` | 跳过 SP→CS→DS, **一步从 intent 到 code**. 适合 L1/L2 级改动 |

`QQ` 对应 CineForge 里小型修改场景（bug fix / 单点调整），跳过完整 PRD→Architecture→Story 流水线。

---

## Solo Dev · CineForge Web Brownfield 推荐路径

**场景**: 已有 Electron v1.2.0 在跑, 要做网页版. 产品形态=对话式 agent 类似 OiiOii. API Key 用户自带.

```
┌──── 新对话 1 ────┐
│  bmad-document-project (DP)                                 │
│  → agent 扫 E:\WorkFisher启动器\repo\ 生成 project-knowledge│
│  产出: project-knowledge/ 目录                              │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 2 ────┐
│  bmad-generate-project-context (GPC)                        │
│  → 总结 Electron 代码约束 / 模式 / AI coding 规则           │
│  产出: project-context.md                                   │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 3 ────┐
│  bmad-product-brief (CB)                                    │
│  → 结构化产品定位 (网页版 = OiiOii 模式 · 对话式 · agent)   │
│  产出: product-brief.md                                     │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 4 ────┐
│  bmad-create-prd (CP)                                       │
│  → 基于 brief 展开 PRD (功能 / 非功能需求 / 成功指标)       │
│  产出: prd.md                                               │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 5 ────┐
│  bmad-validate-prd (VP) — optional 但强烈推荐               │
│  → 独立对话验 PRD 是否扎实                                  │
│  产出: prd-validation-report.md                             │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 6 ────┐
│  bmad-create-ux-design (CU)                                 │
│  → 对话式 UI 流 · 画布导航 · agent skill 后端展示           │
│  产出: ux-design.md                                         │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 7 ────┐
│  bmad-create-architecture (CA)                              │
│  → Next.js 15 / PG / Redis / R2 / nginx / agent 架构        │
│  产出: architecture.md                                      │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 8 ────┐
│  bmad-create-epics-and-stories (CE)                         │
│  → 切 epics (认证 / 剧本 agent / V5 分镜 / 资产 / 画布)     │
│  产出: epics.md + stories/*.md                              │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 9 ────┐
│  bmad-check-implementation-readiness (IR)                   │
│  → 最后审 PRD/UX/Arch/Stories 有无矛盾                      │
│  产出: readiness-report.md (必须全绿才进阶段 4)             │
└──────┬──────────┘
       │
       ▼
┌──── 新对话 10+ ────┐
│  bmad-sprint-planning (SP) → 循环 CS → VS → DS → CR         │
│  每 story 都是一个新对话. 一个 epic 结束后 ER               │
└──────────────────────┘
```

**时间预估** (solo dev · 半天/对话节奏):
- 阶段 1-3 (DP→IR): **约 2-3 周纯规划**
- 阶段 4 story 循环: 看 epic 数 · CineForge 预估 8-12 个 epic · 每 epic 5-15 story · 总 50-150 story

---

## 每个 Workflow 的运行协议 (共用)

每个官方 BMAD skill 启动时都走这 6 步. 本项目没装官方, 但要遵循精神:

1. **Resolve workflow block** · 查项目根的 `_bmad/custom/<skill>.toml` 做自定义覆盖 (如有). 本项目可以简化, 直接用默认.
2. **Execute prepend steps** · 激活前置钩子
3. **Load persistent facts** · 载入贯穿整 workflow 的事实 (如 `project-context.md`)
4. **Load config** · 从 `_bmad/bmm/config.yaml` 读 user_name / communication_language / document_output_language / paths
5. **Greet the user** · 用 communication_language 问候
6. **Execute append steps** · 激活后置钩子

然后进入 workflow 主体 — step-01.md → step-02.md → ... 按顺序, 每步有 menu 等用户.

**Halt 条件** (永远优先):
- 菜单出现了 → 停
- 验证失败 → 停
- 需要额外依赖 → 停
- 3 次连续实现失败 → 停
- 必要配置缺失 → 停

---

## CineForge Web 项目特定配置

**这 skill 适用到 `E:\CineForge-Web\` 项目时, 默认 config**:

```yaml
# E:\CineForge-Web\_bmad\bmm\config.yaml (未来生成)
project_name: CineForge Web
user_name: [用户]
communication_language: zh-Hans  # 中文
document_output_language: zh-Hans  # 中文
user_skill_level: senior-dev  # solo dev 有 Electron 版本经验, 非新手
planning_artifacts: docs/planning/
implementation_artifacts: docs/stories/
project_knowledge: docs/project-knowledge/
```

**brownfield 锚点** (必须让每个 agent 知道):
- **已有产品**: `E:\WorkFisher启动器\repo\` (Electron v1.2.0)
- **已有服务端**: 150.158.54.16 (Docker: wf-nginx/wf-api/wf-postgres/wf-redis) · 复用不废
- **已有 SKILL**: 14 份 screenplay SKILL + V5 模板已在服务端 `/app/src/data/`
- **不动的模块**: 服务端 Phase 3 架构 (`/api/llm/contextual-generate` + screenplayBuilder.ts) 直接复用
- **产品形态**: 对话式 agent · 类 OiiOii · 用户自带 API Key · 画布=导航

**不适用的 BMAD workflow**:
- `bmad-market-research`/`bmad-domain-research` — 短剧市场已熟, 不做
- `bmad-prfaq` — 产品定位已确定, 不做
- `bmad-agent-tech-writer` 的多动作工作 — 按需再用

---

## 如何在本 Skill 加载后触发各 Workflow

本 skill 是**方法论手册**, 不是自动执行器. 用户在对话里说以下指令时, Claude 按照本文档里对应 workflow 的**精神**去执行 (即使官方 skill 包没装):

| 用户说 | Claude 做 |
|---|---|
| "开始 BMAD 第一步" / "bmad-help" | 看项目状态 (有无 product-brief.md/prd.md/architecture.md 等), 推荐下一步 |
| "做 project context" / "GPC" | 按 `references/templates/project-context-template.md` 格式生成 |
| "写产品简报" / "product brief" / "CB" | 按 product-brief workflow 5 阶段走 (intent / discovery / elicitation / draft / finalize) |
| "写 PRD" / "CP" | 按 create-prd workflow step-file 风格执行 |
| "出架构" / "CA" | 按 create-architecture workflow 做 |
| "分 epics 和 stories" / "CE" | 按 create-epics-and-stories 做 |
| "做 sprint planning" / "SP" | 生成 sprint-status.yaml |
| "dev 下一个 story" / "DS" | 按 dev-story workflow (10 step, red-green-refactor) 实施 |
| "code review" / "CR" | 对刚写的代码做 review (建议用户换个 LLM 进另一个对话做) |

**严格遵守**:
- 任何 workflow 开工前必须是**新对话** (L3 协议)
- 每个 workflow 产出一份文档到 `docs/planning/` 或 `docs/stories/`
- 产物用中文写 (`document_output_language=zh-Hans`)
- halt 条件全部遵守

---

## 参考索引

本 skill 的 `references/` 目录存放关键模板:

- `references/templates/project-context-template.md` — GPC 产出骨架
- `references/templates/prd-template.md` — PRD 产出骨架
- `references/templates/architecture-decision-template.md` — CA 产出骨架
- `references/templates/epics-template.md` — CE 产出骨架
- `references/workflow-catalog.csv` — BMAD 全部 31 个 workflow 官方描述 (CSV 原版)

扩展阅读 (非必读):
- 官方完整仓库临时副本: `C:\Users\Administrator\AppData\Local\Temp\bmad-method-clone\BMAD-METHOD\`
- 官方文档站: https://docs.bmad-method.org
- 每个 workflow 的详细 step-01/02/03... 在源仓库 `src/bmm-skills/<phase>/<skill>/steps/`

---

## FAQ · 常见问题

**Q: 为什么不直接 `npx bmad-method install`?**
A: 官方装法会把 264 个 skill 文件灌入 `.claude/skills/`, slash command 列表会非常长. 对 solo dev + 单项目而言, 蒸馏版 1 个 skill 更干净. 如果未来想升级, 删 `.claude/skills/bmad-method/` 后 `npx bmad-method install --modules bmm --tools claude-code --yes` 即可平滑切换.

**Q: 本 skill 会不会过时?**
A: 会. BMAD v6 还在快速迭代 (29 releases). 建议每 2-3 个月去 GitHub 看有无 major 更新, 决定是否重新蒸馏本 skill 或切官方装法. 当前版本: **v6.3.0 · 2026-04-10 发布**.

**Q: BMAD 和 CineForge 现有 L1/L2/L3 协议冲突吗?**
A: 不冲突, 互补:
- L1 (bug/micro-tweak) → 对应 BMAD `bmad-quick-dev` (QQ)
- L2 (模块内新功能) → 对应 BMAD `bmad-dev-story` 单 story 循环
- L3 (新模块/大重构) → 对应 BMAD 完整 4 阶段流水线
CineForge L3 的"新对话 + 设计备忘"正好是 BMAD 的"fresh chat per workflow"原则.

**Q: 为什么蒸馏? 直接读源仓库不就行了吗?**
A: 源仓库 589 文件 · 264 skill. 每次 Claude 对话都要花 ~30 分钟爬结构才能用. 蒸馏后本 SKILL.md 1 遍读懂方法论, 直接进入工作. 适合 solo dev 节奏.

---

## 给下次对话

如果你(Claude)被新对话加载了本 skill, 默认做法:
1. 先确认项目根是 `E:\CineForge-Web\` (或其他项目, 按情况)
2. 查 `docs/planning/` 目录看已有哪些产物 (project-context.md / product-brief.md / prd.md / architecture.md / epics.md)
3. 找出"缺的那一步", 建议用户**开新对话**执行对应 workflow
4. 如果所有前置产物都有了, 推荐进入阶段 4 的 story cycle
5. 永远**不要**在同一对话里连跑多个 workflow
