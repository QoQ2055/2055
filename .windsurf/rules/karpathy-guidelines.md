---
trigger: always_on
description: Karpathy 四原则 — 减少 LLM 写代码时的常见失误。源自 https://x.com/karpathy/status/2015883857489522876
---

# Karpathy Guidelines · 四原则

> **Tradeoff**: 这套原则偏向 *谨慎 > 速度*。trivial 任务（typo / 单行修复）可以放宽。
> 目标是减少非平凡改动里的代价高昂的错误，而不是拖慢简单任务。

## 1. Think Before Coding · 写代码前先想清楚

**Don't assume. Don't hide confusion. Surface tradeoffs.**

实施前：

- 显式说出你的假设；不确定就问。
- 出现多种合理理解时，把所有解释列出来——不要静默挑一个。
- 如果存在更简单的方案，说出来；该 push back 就 push back。
- 有不清楚的地方，停下、点名"哪里不清楚"、问。

## 2. Simplicity First · 先做最简单的版本

**Minimum code that solves the problem. Nothing speculative.**

- 不实现没要求的特性。
- 不为单次使用的代码搞抽象。
- 不加用户没要的"灵活性 / 可配置性"。
- 不为不可能的场景写错误处理。
- 如果你写了 200 行可以变 50 行的，重写它。

自检：*"一个高级工程师会觉得这是过度设计吗？"* 如果会，简化。

## 3. Surgical Changes · 外科手术式修改

**Touch only what you must. Clean up only your own mess.**

编辑已有代码时：

- 不"顺手改进"旁边的代码、注释、格式。
- 不重构没坏的东西。
- 匹配已有风格，即使你个人偏好不同。
- 看到无关的死代码——指出它，不要删。

当你的改动产生孤儿（orphan imports / unused vars）时：

- 删掉**因你的改动而失效**的 import / 变量 / 函数。
- 但不要删未经要求的 pre-existing 死代码。

测试：*每一行被改的代码，都能直接追溯到用户的请求。*

## 4. Goal-Driven Execution · 目标驱动地执行

**Define success criteria. Loop until verified.**

把指令任务翻译成可验证的目标：

| 弱指令 → | 强目标 |
|----------|--------|
| "加校验" | "为非法输入写测试，然后让它通过" |
| "修这个 bug" | "写一个能复现 bug 的测试，然后让它过" |
| "重构 X" | "确保改动前后测试都通过" |

多步任务先列出简明计划：

```
1. [步骤] → verify: [验证方式]
2. [步骤] → verify: [验证方式]
3. [步骤] → verify: [验证方式]
```

强成功标准让你能独立循环；弱标准（"让它能用"）会持续要求澄清。

---

## 项目特定补充（cineforge-web）

`@C:\Users\QvQ\CascadeProjects\cineforge-web\AGENTS.md` 是项目导航；
`@C:\Users\QvQ\CascadeProjects\cineforge-web\CHANGELOG.md` 是阶段日志。

本仓库特别强调：

- **构建即验证**：任何非 trivial 改动落地前 `npx vite build` 必须通过（基线 ~1911 modules / ~3s）。
- **prompt 注入分层不可越界**：`compose.ts` 的拼接顺序固定（creation_constraints → genre_anchor → static_KB → method_modules → user_KB → original prompt）。新增层时找对位置，不要插队。
- **Dexie schema 只追加**：升 version 时复制全部 stores，不要修改已存在 version 的定义。
- **AbortController 必须传递**：所有 `chatStream` 调用入口都要让用户能取消。

---

来源：https://github.com/forrestchang/andrej-karpathy-skills （MIT）
