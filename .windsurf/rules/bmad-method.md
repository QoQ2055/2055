---
trigger: model_decision
description: BMAD-METHOD v6.3.0 方法论蒸馏（来自外部 LLM 个人作品，非官方背书；使用前请核对上游）。覆盖 4 阶段 30+ workflow（Analysis / Planning / Solutioning / Implementation），用于 brownfield 重构或 greenfield 新项目。仅在用户显式触发时激活——触发词包括「按 BMAD 走」、「bmad-help」、「下一步做什么」、「写 PRD」、「出架构」、「分 story」、「做 project context」、「document project」，以及代号 DP / GPC / CP / CA / CE / DS / QQ。**用户只是问技术问题或写普通代码时不要激活**。
---

# BMAD-METHOD 方法论 · 入口规则

> ⚠️ **来源警告**：本 SKILL 是外部 LLM 对 BMAD 上游代码仓蒸馏的个人版本，
> **未经官方背书**。原文还引用了本仓不存在的 `feedback_workflow_l1l2l3.md`。
> 使用前应去 https://github.com/bmad-code-org/BMAD-METHOD 核对术语与阶段依赖。
>
> 完整方法论位于：
> `@C:\Users\QvQ\CascadeProjects\cineforge-web\.windsurf\skills\bmad-method\SKILL.md`
> 模板与 workflow 索引位于 `references/` 子目录。

## 激活规则

只有在用户消息**明确含**以下任一关键词时，才进入 BMAD 模式：

- 命令式：`bmad-help`、`按 BMAD 走`、`走 BMAD 流程`、阶段代号（**DP/GPC/CB/CP/VP/CU/CA/CE/CK/QA/SP/CS/DS/CR/QQ** 等）
- 意图式：「下一步做什么」、「写 PRD」、「出架构」、「分 story / split story」、「做 project context」、「document project」、「greenfield 起步」、「brownfield 重构怎么开」

**不要**在以下情况自动激活：

- 用户问"怎么写 React 组件" / "这个 bug 怎么修"——直接答即可，不需要走 PRD 流程
- 用户问"项目结构是什么"——读 AGENTS.md 直接答
- 用户已经在某个具体 feature 的实现里——走 surgical change，不要塞 BMAD 流程

## 激活后第一步

1. 读 `@C:\Users\QvQ\CascadeProjects\cineforge-web\.windsurf\skills\bmad-method\SKILL.md` 全文。
2. 根据用户场景判断当前阶段（Analysis / Planning / Solutioning / Implementation）。
3. 输出"BMAD 助手已启动，建议路径：[阶段 → workflow 链]"，**询问用户在哪个阶段**，
   等回复后再进入对应 workflow 的 step-01。
4. **每个 workflow 一次新对话**——在当前对话里跑多个 workflow 是反 BMAD 信条的（核心信条 §2）。

## 与本项目的关系

CineForge Web 已经过 brownfield 阶段（v2 资料库改造），当前在 v2 阶段 2.x 增量演进。
适合的 BMAD 入口主要是：

- **QQ**（quick-dev）：bug 修复 / 小改动
- **CB**（product-brief）：评估某个新阶段（如未来的 v3）值不值得做
- **CA**（create-architecture）：技术选型重大变更前

完整 PRD/Architecture 流水线对当前增量任务**过重**，慎用。
