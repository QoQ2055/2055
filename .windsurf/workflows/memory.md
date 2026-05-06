---
description: 快速向 AGENTS.md 追加 / 编辑一条记忆（约定 / 避坑 / 任务速查 / 阶段历史）
---

`/memory` 是 AGENTS.md 的写入快捷入口。AGENTS.md 是项目唯一的"协作者长期记忆"。

参考 `/init` 的产出物：`@C:\Users\QvQ\CascadeProjects\fili-web\AGENTS.md`

---

## Step 1 · 听清楚用户要记什么

用户的输入通常是这几种形态之一：

| 形态 | 例子 | 应进哪个 section |
|------|------|------------------|
| 一条避坑 | "不要在 prompt 里硬编码示例" | `## 不要做什么（避坑）` |
| 一条约定 | "新方法论模块必须填 genreCompat" | `## 重要约定` |
| 一条速查 | "改章节字数阈值 → chapterValidation.ts" | `## 常见任务 → 看哪里` |
| 一句架构事实 | "Dexie 升到 v5，加了 xxx 表" | `## Dexie schema 演化` 表格 + `## 当前阶段` |
| 一个全新的子系统 | "新增了 /timeline 路由" | 多处：`## 路由` + `## 目录速查` + `## 常见任务` |

**如果用户说得太抽象**，反问一句确认归属，再写。**不要凭印象塞**。

## Step 2 · 写入

**优先用 `edit` 工具做 minimal 追加**，不要重写整个文件。

- 追加表格行：精确匹配现有表格的最后一行 + 新行
- 追加列表项：精确匹配 section 的最后一个 bullet + 新 bullet
- 新增子 section：在合适的父 section 末尾插入

避免：
- ❌ 删除已有内容（用户说"改"时也先确认是不是真的过时了）
- ❌ 重排整个文件结构
- ❌ 把同一条信息塞进多个 section

## Step 3 · 同步刷新元数据

每次 `/memory` 写入都更新 AGENTS.md 顶部：

```markdown
> Last refreshed: <YYYY-MM-DD> · 对应 CHANGELOG <最新条目>
```

如果新增的内容已经稳定到值得进 CHANGELOG（如新阶段 / schema 升级），
提示用户："这条信息已写入 AGENTS.md，是否同时在 CHANGELOG 加一条 Unreleased？"

## Step 4 · 验证

- [ ] AGENTS.md 里没有重复的等价条目（搜一下 keyword）
- [ ] 引用的文件路径都存在（用 `Test-Path`）
- [ ] 新增的 task → file 速查表项的文件确实是该任务的入口（不是无关引用）

## 反向操作：清理过期记忆

用户说"删掉/过期"时：

1. 先 grep 一下该条目的 keyword，看 AGENTS.md / README.md / CHANGELOG.md 是否互相印证
2. 如果该条仅出现在 AGENTS.md 且确认不再适用（如已删除的功能、改过的约定），直接删
3. 如果是阶段性内容（如"当前阶段 2.x"），不要删，移到下方"历史"或保留并加 `~~strikethrough~~`
