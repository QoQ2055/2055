---
trigger: model_decision
description: DESIGN.md 设计系统专家（Google Labs v alpha 规范蒸馏）。仅在用户显式触发时激活——触发词包括 `/design-md`、`/设计系统`、`/DESIGN.md`、`design-md`、"起草 DESIGN"、"写设计系统"、"设计规范"、"做设计 token"、"DESIGN.md 模式"。覆盖 greenfield 起草 / brownfield 提取 / 迭代升级 / 审阅 4 种工作流；YAML tokens 双层结构 + 8 节 markdown 设计理念。**用户只是改单点样式（"按钮颜色调一下" / "这个间距大一点"）时不要激活**。
---

# DESIGN.md 设计系统专家 · 入口规则

> 这是触发器规则。**完整方法论与流程**（约 70 KB，含 6 reference + 3 asset 模板）位于：
>
> `@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\skills\design-md\SKILL.md`

## 激活规则

只有在用户消息**明确含**以下任一关键词时，才进入 DESIGN.md 模式：

- 命令式：`/design-md`、`/设计系统`、`/DESIGN.md`、`design-md`
- 意图式：「起草 DESIGN」、「写设计系统」、「设计规范」、「做设计 token」、「按 DESIGN.md 规范走」、「进入设计系统模式」

**不要**在以下情况自动激活：

- 用户只想改单个组件颜色 / 间距 / 圆角
- 用户问"这个按钮怎么写"——是局部样式问题，直接回答即可
- 用户问"项目里的颜色是怎么定的"——是描述性问题，直接读 Tailwind 配置回答

## 激活后第一步

读 `@C:\Users\QvQ\CascadeProjects\fili-web\.windsurf\skills\design-md\SKILL.md` 全文，
按其中「零、激活条件」的协议输出身份声明 + 4 工作流菜单（greenfield / brownfield / 迭代 / 审阅），
等待用户选择编号后再进入对应章节。

## 与本项目的关系

本项目目前**没有** DESIGN.md，UI 走 Tailwind + shadcn/ui 即兴风格。如用户希望沉淀
设计系统单一真源，建议走 brownfield 提取流程（先扫描现有组件，再反推 token）。
