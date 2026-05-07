# Design System · 应用指南

> **本目录用途**：把 [`DESIGN.md`](../../DESIGN.md)（设计宪章）从"理论 token 表"翻译成"开发者每天用的决策树"。
>
> **不是**：另一份独立设计系统（与 DESIGN.md 平级）。所有 token / spec 的**唯一权威**仍是 `DESIGN.md`。
>
> **是什么**：当你打开一个新页面、看到一个裸 `<button>`、不确定改不改时，应该先翻这里的 checklist + 决策树，再回 `DESIGN.md` 查精确数值。

---

## 索引（按使用频率倒序）

| 文档 | 适用场景 | 长度 |
|---|---|---|
| [`migration-checklist.md`](./migration-checklist.md) | 我看到一段裸 className · 该不该改？ | ~100 行 |
| [`usage-application-layer.md`](./usage-application-layer.md) | 我要在新页面写 button / input · 该用哪个 atom？ | ~180 行 |
| [`usage-feedback.md`](./usage-feedback.md) | 我要给用户提示 / 占位 / 加载 · Toast vs Tooltip vs Skeleton vs EmptyState 怎么选？ | ~140 行 |
| [`usage-shortcuts.md`](./usage-shortcuts.md) | 我要加一个全局快捷键 · 怎么不抢系统？handbook 怎么注册新条目？ | ~90 行 |

---

## 阅读路线

### 路线 A · 你是新加入的开发者

1. 先读项目根 [`DESIGN.md`](../../DESIGN.md) 全文（30 分钟）· 理解 token 体系
2. 读本目录 `migration-checklist.md` · 知道改 / 不改的边界
3. 写第一个 PR 时翻 `usage-application-layer.md` 选 atom

### 路线 B · 你在做某个具体 PR

- **新页面 / 新组件** → `usage-application-layer.md` 决策树
- **加 toast / 错误反馈** → `usage-feedback.md` 选用法
- **加快捷键** → `usage-shortcuts.md` 不变量清单
- **改老页面** → `migration-checklist.md` 逐项核对

### 路线 C · 你要修改设计系统本身

⚠ **不在本目录范围内**。修改 token / atom 实现需要：

1. 改 [`DESIGN.md`](../../DESIGN.md)（宪章）
2. 改 `tailwind.config.ts` / `src/index.css`（实现）
3. 改 `src/components/ui/`（atom 实现）
4. 写 BMAD epic（design-system epic · 通常 v 大版本）
5. 然后再回头更新本目录文档

---

## 不变量速查表

| 来源 | ID | 简述 |
|---|---|---|
| ui-v2 | V2-I-3 | 6 atoms 实现锁定（Button / Input / Textarea / NavItem + 2 已有） |
| ui-v2 | V2-I-4 | **不加第 7 atom**（Select / Toggle 等都走 page-level component） |
| ui-v2 | V2-I-7 | NavItem 路径不动（不能塞功能按钮 · 仅路由跳转） |
| ui-v2 | V2-I-9 | console.error 不静默（业务错误必须留 trace） |
| ui-v3 | V3-I-1 | 路由表不动（router.tsx 是冰山下面的） |
| ui-v3 | V3-I-2 | 不抢系统快捷键（仅可抢 Cmd+K / Cmd+S 这种应用语义键） |
| ui-v3 | V3-I-3 | NavItem 实现不动（badge 走 wrapper + absolute · 不进 NavItem） |
| ui-v3 | V3-I-4 | 不静默吞错（toast.error + console.error 双通道） |
| ui-v3 | V3-I-5 | Dexie schema 不变（仅读不改 schema） |
| ui-v3 | V3-I-6 | docs 改不动 src |
| ui-v3 | V3-I-7 | DESIGN.md ⑥ 色盲友好（语义色必须配 icon / 数字 · 不仅靠颜色） |

详细原文请查 `docs/planning/prd-ui-v2-application-layer-overhaul.md` § Invariants 与 `docs/planning/prd-ui-v3-interaction-system.md` § Invariants。

---

## 维护节奏

- **每个 ui-v\* epic 完成时**：检查本目录是否需要更新。新 atom / 新 modal / 新快捷键应该在文档里有对应条目。
- **每次发现"我又翻了一遍源码才确认 X"**：把答案写进对应文档（消除"必查源码"的返工）。
- **不在每个 PR 都更新**：避免 docs 与代码在多个 commit 间漂移。建议 epic 收尾时统一刷文档。
