# 参考资料 · NovelGenius AI Studio 深度增强方案 v2.0

> **归档日期**：2026-05-06
> **原始来源**：`F:\下载文件\AI技术分享\NovelGenius_Deep_Enhancement_Plan(1).md`（30 KB / 1030 行）
> **原文位置**：`@docs/reference-works/novelgenius-deep-enhancement-plan-original.md`
> **关键警示**：⚠ **本档是针对 NovelGenius AI Studio（另一个项目）的实施级方案**，**不是 fili-web 的方案**。其 5 大场景（卷纲参考解析 / 自动卷纲 / 简要大纲 / 大纲增强 / 章节正文）的具体 prompt **不能直接套用**到 fili-web 流水线（节点结构不同）。
> **保留原因**：含大量**通用 DeepSeek V4 技术知识**和 **prompt 工程原则**，已提炼到 `@docs/internal-notes/deepseek-v4-tuning-guide.md` 作为内部参考手册。
> **运行时状态**：❌ 不被加载。

---

## 一、对 fili-web 真正有价值的部分

| 资料元素 | 性质 | 提炼到 |
|---|---|---|
| DeepSeek V4 Flash vs Pro 特性对照（章 2.1） | 通用技术知识 | `deepseek-v4-tuning-guide.md` |
| Thinking Mode 启用方式 + 限制（章 2.2） | 通用技术 | 同上 |
| 思维模式 prompt 中英双版（附录 A） | 通用 prompt 模板 | 同上 |
| 两阶段法（解构→重构，附录 B 实测 0/10→8/8） | 通用 prompt 范式 | 同上 |
| 角色沉浸式 vs 禁止清单式（章 2.3） | prompt 工程原则 | 同上（**印证现有 `anti-ai-flavor` 设计**） |
| `response_format: { type: "json_object" }` 启用 | 通用 API 用法 | 同上 |
| `extra_body: { thinking: { type: "enabled" }, reasoning_effort }` | 通用 API 用法 | 同上 |
| 第一轮 user message 末尾注入指令的最优位置 | 通用 prompt 工程 | 同上 |

## 二、对 fili-web 不直接适用的部分

| 资料元素 | 不适用原因 |
|---|---|
| 5 大场景的具体 prompt 设计（章 3） | NovelGenius 的流水线是"卷纲→大纲→正文"，fili-web 是 craft method modules + 节点注入策略，节点结构完全不同 |
| 8 个叙事结构模板（5.3） | fili-web 已有 11 个结构方法模块（更全） |
| 卷纲卡片 / 备选方案 UI（5.2） | fili-web UI 设计应根据自身 UX 决定 |
| 分阶段实施路线图（章 6） | NovelGenius 项目特定 |

## 三、值得未来按需落地的功能

| 功能 | fili-web 现状 | 未来价值 |
|---|---|---|
| **伏笔追踪系统**（5.4.2 数据结构 + UI） | ⚠ `plot-coherence-scaffold` 提及但无独立系统 | ⭐⭐ 可作为新功能（与 ChapterFeedback 同级） |
| **两阶段法**（参考资料避免复制） | ❌ | ⭐⭐⭐ 适用于用户上传 KB 文档场景 |
| **多方案备选**（一处生成 N 个方案对比） | ❌ | ⭐⭐ 提升用户控制感 |

---

完整 1030 行内容保留在 `novelgenius-deep-enhancement-plan-original.md`。
