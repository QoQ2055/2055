---
trigger: always_on
description: fili-web 项目通用编程规范与协作约定
---

# 编码规范

- 使用 TypeScript 严格模式（`strict: true`），禁止 `any` 兜底，必要时使用 `unknown` 并显式收窄。
- 文件编码统一为 UTF-8，换行符使用 LF。
- 缩进 2 个空格，行宽 100。
- 命名：变量/函数 `camelCase`，类型/类/组件 `PascalCase`，常量 `UPPER_SNAKE_CASE`。
- 导入顺序：`第三方库` → `项目内别名` → `相对路径`，组之间空一行。

# 提交与分支

- 提交信息遵循 Conventional Commits：`feat: ...` / `fix: ...` / `refactor: ...` / `docs: ...` / `chore: ...`。
- 分支命名：`feature/<short-desc>`、`fix/<short-desc>`、`chore/<short-desc>`。

# 测试

- 修复 bug 必须附带回归测试。
- 不得删除或弱化现有测试，除非有明确理由并在 PR 描述中说明。

# 安全

- 严禁将 API Key、Token、密钥硬编码到仓库，改用 `.env` 并加入 `.gitignore`。
- 外部请求必须有超时与错误处理。

# 协作

- 优先在源头修复问题，避免下游 workaround。
- 改动保持最小化、聚焦，不顺手重构无关代码。
- 注释与文档：除非用户要求，否则不主动新增/删除注释。

# 决策心法（VFM / ADL）

> 来源：openclaw `proactive-agent` skill 评估（2026-05-06）借鉴的 2 个真实有用框架，**仅作为变更前心法**，与本仓 surgical-change 原则一致。

- **VFM 金规则**（动手前问自己）：
  - "这个变更能否让 future-me 用更少成本解决更多问题？"
  - 答 No → **跳过，不要做**。优化的目标是 compounding leverage，不是 marginal improvement。
- **ADL 优先序**（取舍冲突时按此排序）：
  - **Stability > Explainability > Reusability > Scalability > Novelty**
  - 稳定性永远第一；新颖性永远最后。"看起来更聪明" 的方案如果不能验证有效就拒绝。
- **禁止 evolution**：
  - ❌ 用 "直觉 / 感觉" 替代论证
  - ❌ 加复杂度只为 "显得高级"
  - ❌ 牺牲稳定性换新潮特性
