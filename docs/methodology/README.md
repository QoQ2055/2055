# fili-web · 方法论资料库

> **MM1 epic · multi-format expansion** 的 LAYER 1 来源文档目录。
>
> 本目录存放 4 种创作格式（长片 / 短片 / 概念超短片 / 剧集）的 SKILL 指南，
> 直接来自 `shanyin-screenwriting-master` MIT 仓库。

---

## §1 · 文件清单

| 文件 | 格式 | 时长 | 体量 | 用途 |
|---|---|---|---|---|
| `format-feature.md` | 长片 | 75-120 分钟 | 32 KB | 4 种结构（三幕 / 四幕 / Save the Cat / Story Circle / 内在节拍）+ 5 风格变体 + Subplot/伏笔/世界观三层 |
| `format-short.md` | 叙事短片 | 5-10 分钟 | 10 KB | 四段式聚焦单一核心事件 + 高密度信息推进 |
| `format-ultrashort.md` | 概念超短片 | 1-3 分钟 | 25 KB | What-If（高概念）+ How-to-Tell（视听武器库）双路径 |
| `format-series.md` | 剧集 | 8-24 集 / 10-60 分钟/集 | 24 KB | 双层结构（集内 + 弧线）+ 弧光预算 + 信息释放表 + 4 张连续性表 |

---

## §2 · 来源 + 许可

**上游仓库**：`shanyin-screenwriting-master`（@山音 · MIT License）

```
SPDX-License-Identifier: MIT
Copyright (c) 山音
```

**许可范围**（MIT 标准条款 · 见上游 `LICENSE`）：
- ✅ 可商业使用 / 可修改 / 可再分发 / 可纳入私有项目
- ✅ 必须保留原版权声明 + 许可证文本
- ❌ 不提供任何明示或暗示的担保

**本地副本说明**：
- 4 份文件按"字符级引用 SKILL 原文"原则拷贝（每份文件头部已含 `MIT License · @山音` attribution）
- 文件名简化（去除 corpus 中 `06-` / `07-` / `08-` / `09-` 编号前缀）
- 内容 0 修改 · 0 删减 · 编码 UTF-8 保持原状

---

## §3 · 与 ip-tier-policy.md 的对应

按 `@docs/ip-tier-policy.md` 三档分类：

| 档级 | 处理 | 适用 |
|---|---|---|
| 🟢 第 1 档（直接复用） | 加 MIT attribution 即可直引 | **本目录全部 4 份** |
| 🟡 第 2 档（重命名 + 重写） | 不适用本目录 | 见 `@docs/multimodal-epic-stage0.md` MM2/MM3/MM4 处理 |
| 🔴 第 3 档（回避） | 不适用本目录 | seedance prompt / 14 prompt 原文等 |

---

## §4 · 代码消费约定（MM1 PR-2 起逐步落地）

后续 PR 在引入 LLM-driven 流水线时：

- **`/feature-film` 路由**：消费 `format-feature.md` · 8 步工作流 system prompt 提取
- **`/short-film` 路由**：消费 `format-short.md` · 与现有 `/screenplay` 对齐 LAYER 1
- **`/ultrashort-film` 路由**：消费 `format-ultrashort.md` · What-If / How-to-Tell 双路径分支
- **`/series` 路由**：消费 `format-series.md` · 双阶段工作流（剧集大纲 → 逐集开发）

代码中 system prompt 构造时按 schema 切片消费本目录 · 而非简单拼接全文（避免 token 浪费）。
具体 schema 设计在 MM1 PR-2 引入。

---

## §5 · 维护规则

- **不可改原文**：本目录的 4 份 SKILL 全文按 MIT 直引 · 任何"翻译/改写/重排"都需挪到独立的 fili-web 自写文档（如 `docs/methodology-extensions/`）
- **同步上游**：若上游 `shanyin-screenwriting-master` 更新 · 通过手动重新拷贝同步 · commit message 注明 "sync upstream @ commit `<sha>`"
- **删除约束**：本目录的 4 份文件不可删除（除非整个 MM1 epic revert）

---

## 修订记录

- **v1.0（2026-05-09）**：初始迁入 · 4 份 format SKILL 全文 · MM1 PR-1
