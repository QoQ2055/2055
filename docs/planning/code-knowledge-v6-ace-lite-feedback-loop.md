---
project: fili-web
epic: v6-ace-lite-feedback-loop
stage: BMAD Stage 2 · CK (Code Knowledge invariants)
author: QvQ + Cascade
date: 2026-05-07
status: draft · 不变量定义
workflow: BMAD-METHOD · post-CA invariant registry
related:
  - prd-v6-ace-lite-feedback-loop.md（设计意图）
  - codebase-analysis-v6-ace-lite-feedback-loop.md（代码现状审计 · 含 §5 不变量候选）
  - public/methods/agentic-context-engineering.md（方法论）
---

# v6 epic · CK · Code Knowledge Invariants

## 0. TL;DR

定义 v6 epic 实施过程必须保持的 **8 条不变量**（I-1 到 I-8）。每条含：定义 / 来源 / 检测方法 / 违反影响 / 修正动作。

CK 文档作为：
- PR review 的硬性 checklist
- 未来 v7（layer 2）/ v8/v9（layer 3）epic 的依赖契约
- 回归测试的设计输入

---

## 1. Invariant Registry

### I-1 · novel.9 prompt 输出 strict JSON

**定义**：

```
novel.9 LLM 输出必须是可解析 JSON · 含至少：
  {
    "lessonContent": <100-300 字>,
    "suggestedModule": <method-module-id 或 null>
  }

reflector.ts parseReflectorResponse(content) 必须：
  - 容错（与 v5 parseExtractionResponse 同模式 · 试整段 / 围栏内 / 首个 {} 匹配）
  - 失败时返回 null（不抛错 · 不阻塞 polish loop）
  - 字数超限不报错（用户审阅时手动改）
```

**来源**：CA §3.3 / PRD §4.1 / R-M1 风险缓解。

**检测方法**：

```bash
# 类型检查
pnpm tsc

# grep 验证 parseReflectorResponse 不抛错
grep -A 20 "function parseReflectorResponse" src/pipeline/reflector.ts
# 应包含：try/catch · 不 throw · 失败返 null
```

**违反影响**：高（reflector 失败 → polish loop 阻塞 / row 入库失败）。

**修正动作**：parseReflectorResponse 必须 return null · 不能 throw · 不能 break novelLoop。

---

### I-2 · reflectorLessons 表 add-only · v6 stores 0 变更

**定义**：

```
v7 stores 字符串 = v6 stores 字符串 + 1 行（reflectorLessons）

具体：
  v6 块（8 张表）字符串完全保留
  v7 块 = v6 块 8 张表字符串 + reflectorLessons 一行

reflectorLessons 索引：
  '++id, projectId, chapterIndex, signalType, status, ts,
   [projectId+status], [projectId+chapterIndex]'
```

**来源**：CA §3.5 · v5 CK I-3 衍生（"v6 stores = v5 stores"延伸）。

**检测方法**：

```bash
# diff v6 / v7 stores 字符串
# v7 内 v6 部分必须 0 行差异
```

**违反影响**：致命（破坏 CK 红线 #1 · 旧用户数据风险）。

**修正动作**：发现差异 → 立刻回退 v7 块 · 重新审计原因。

---

### I-3 · v6 epic 不自动写入任何 method module

**定义**：

```
Reflector 输出的 lesson · 仅写入 reflectorLessons 表（status='pending'）
绝对不允许：
  ❌ 自动改写 public/methods/*.md
  ❌ 自动 git commit
  ❌ 自动追加到 manifest
  ❌ 任何形式的"自动 Curator"

必须：
  ✅ 用户手动打开 method module 文件
  ✅ 用户手动编辑 + git commit
  ✅ 用户手动在 panel 点 "标记已 commit"
  ✅ 标记后 row.status='committed' + row.committedTo 填值
```

**来源**：preflight §10.2 Q3 用户签字 · ACE 论文"context collapse"风险防护。

**检测方法**：

```bash
# 全代码搜：禁止 reflector 写入 methods/
grep -r "writeFile\|fs\.write\|exec\|spawn" src/pipeline/reflector.ts src/components/ReflectorLessonsPanel.tsx
# 应输出 0 行（无写文件代码）

# 全代码搜：禁止自动 git 调用
grep -r "git commit\|git add" src/pipeline/reflector.ts
# 应输出 0 行
```

**违反影响**：致命（破坏用户控制权 · 风险 ACE context collapse）。

**修正动作**：发现违反 → 立刻 revert · 确保所有 method module 修改路径都需用户主动操作。

---

### I-4 · settings.reflectorThresholds.enabled 默认 false

**定义**：

```ts
// src/store/settings.ts DEFAULTS
reflectorThresholds: {
  enabled: false,                         // ★ 默认 false
  scoreCardMin: 6,
  consistencyCheckTriggerOnAny: true,
  readerLayerStaleChapterCount: 5,
  userFeedbackEnabled: true,
}
```

**来源**：preflight §10.2 Q2 用户签字 · 不破坏现有用户体验。

**检测方法**：

```bash
grep -A 8 "reflectorThresholds" src/store/settings.ts | grep "enabled:"
# 应包含：enabled: false
```

**违反影响**：中（首次升级用户被动开启 · token 暴涨 · 用户体验破坏）。

**修正动作**：DEFAULTS 必须 enabled: false · 用户主动开启。

---

### I-5 · 现有 prompt JSON（N1.x / N2.x / N3.1 / N3.2 / N3.3）0 行修改

**定义**：

```
v6 epic 全程不允许修改：
  ❌ public/prompts/novel/0.json
  ❌ public/prompts/novel/1.1.json
  ❌ public/prompts/novel/1.2.json
  ❌ public/prompts/novel/1.3.json
  ❌ public/prompts/novel/2.1.json
  ❌ public/prompts/novel/2.2.json
  ❌ public/prompts/novel/2.3.json
  ❌ public/prompts/novel/3.1.json
  ❌ public/prompts/novel/3.2.json
  ❌ public/prompts/novel/3.3.json （v5 epic 已改 · v6 不再动）
  ❌ public/prompts/screenplay/*.json （所有）
  ❌ public/prompts/storyboard/*.json （所有）

只允许：
  ✅ public/prompts/novel/9.json （NEW · 5 决策点 Q4 ✅）
```

**来源**：preflight §10.2 Q4 用户签字 · gap-c R1 严守。

**检测方法**：

```bash
# v6 epic PR-1/2/3 全程：
git diff main -- public/prompts/
# 应仅显示 novel/9.json 的 NEW · 不显示任何其它 prompt JSON 修改
```

**违反影响**：致命（破坏 gap-c R1 · 用户信任崩塌）。

**修正动作**：rollback · 任何其它 prompt 改动必须用户重新签字。

---

### I-6 · ReflectorLessonsPanel 是新独立面板 · 不嵌入 CharacterBible

**定义**：

```
ReflectorLessonsPanel 是 src/components/ 下独立组件
mount 在 Novel.tsx · 紧跟 CharacterBible 之后（不在 CharacterBible 内部）

绝对禁止：
  ❌ 在 CharacterBible.tsx 内 import / mount ReflectorLessonsPanel
  ❌ 在 CharacterBible viewMode 加 'reflector' 选项
  ❌ 复用 useCharacterBible store

必须：
  ✅ 自己的 zustand store（src/store/reflectorLessonsPanel.ts）
  ✅ 自己的 localStorage key（'flil:reflector-lessons:state'）
  ✅ 视觉风格独立（虽可参考 CharacterBible 配色）
```

**来源**：preflight §10.2 Q3 用户签字 · CA §3.10。

**检测方法**：

```bash
# 验证 CharacterBible.tsx 不 import ReflectorLessonsPanel
grep "ReflectorLessonsPanel" src/components/CharacterBible.tsx
# 应输出 0 行

# 验证 Novel.tsx mount 是顺序追加
grep -A 2 "<CharacterBible" src/components/Novel.tsx
# 应包含 <ReflectorLessonsPanel /> 在 </CharacterBible> 之后
```

**违反影响**：中（v5 reader viewMode 与 v6 reflector 概念混淆 · 维护复杂度上升）。

**修正动作**：rollback 嵌入 · 改回独立 panel。

---

### I-7 · scoreCard.ts / consistencyCheck.ts / characterStates.ts (pipeline) 0 行修改

**定义**：

```
v6 epic 全程：
  ❌ src/pipeline/scoreCard.ts diff = 0 行
  ❌ src/pipeline/consistencyCheck.ts diff = 0 行
  ❌ src/pipeline/characterStates.ts diff = 0 行（v5 已 0 修改 · v6 也 0）

只允许 reflector.ts 用 import 调用上述模块的 export 函数：
  - import { runScoreCard, ScoreCard } from './scoreCard'
  - import { buildConsistencyReport } from './consistencyCheck'
  - import { listChapterStates } from '../store/characterStates' (v5 已用)
```

**来源**：CA §2.2 · gap-c R2（不改 ScoreCard）/ v5 CK I-5 衍生。

**检测方法**：

```bash
git diff main -- src/pipeline/scoreCard.ts src/pipeline/consistencyCheck.ts src/pipeline/characterStates.ts
# v6 epic 全程应输出 0 行
```

**违反影响**：高（破坏 gap-c R2 / v5 CK I-5 · 增加 v6 epic 风险面）。

**修正动作**：rollback 修改 · v6 仅作为消费者读取上述模块输出。

---

### I-8 · novel.9 LLM 调用失败时不阻塞 novelLoop polish

**定义**：

```
novelLoop.ts 内 reflector hook：
  if (settings.reflectorThresholds.enabled) {
    try {
      const { runReflector } = await import('./reflector');
      runReflector({...}).catch((e) => console.warn('[v6] reflector failed:', e));
      // ★ .catch 不抛 · 不 await
    } catch (e) {
      console.warn('[v6] reflector hook failed:', e);
      // ★ try/catch 兜底 import 失败
    }
  }

绝对禁止：
  ❌ await runReflector(...) （阻塞 polish）
  ❌ throw 后续异常
  ❌ 让 reflector 失败影响 character state extraction
```

**来源**：CA §3.7 · R-M5 风险缓解。

**检测方法**：

```bash
# 检查 reflector hook 不 await · 不 throw
grep -A 5 "reflectorThresholds.enabled" src/pipeline/novelLoop.ts
# 应包含 .catch · 不应有 await runReflector 或 throw
```

**违反影响**：高（reflector 失败 → polish 阻塞 → 用户体验破坏）。

**修正动作**：reflector 调用必须非阻塞 + 错误兜底 + console.warn 即可。

---

## 2. 不变量速查表

| ID | 一句话 | 严重度 | 检测时机 |
|:---:|---|:---:|---|
| I-1 | novel.9 prompt 输出 strict JSON · parser 不抛错 | 高 | PR-1 review |
| I-2 | v7 stores 字符串 = v6 + 1 表 | 致命 | PR-1 review |
| I-3 | 不自动写 method module · 100% 用户手动 | 致命 | PR-1/2 review |
| I-4 | reflectorThresholds.enabled 默认 false | 中 | PR-1 review |
| I-5 | 现有 prompt JSON 0 修改 | 致命 | PR-1 review |
| I-6 | ReflectorLessonsPanel 独立面板 | 中 | PR-2 review |
| I-7 | scoreCard / consistencyCheck / characterStates pipeline 0 改 | 高 | PR-1/2 review |
| I-8 | reflector 失败不阻塞 polish loop | 高 | PR-1 review |

---

## 3. 检测自动化建议（未来）

```
□ 加 lint rule：禁止 reflector.ts 调用 fs.write / spawn / exec
□ 加 git pre-commit hook：v6 PR diff 必须不含 prompts/novel/[0-8] 修改
□ 加 unit test：parseReflectorResponse 容错（多种畸形输入）
□ 加 unit test：upsertReflectorLesson 接受 status='pending' 默认值
□ 加 e2e test：settings disabled 时 polish loop 不调 reflector

→ 本 epic 不实施（v6 范围外 · 留 v7 / 后续）· 仅 PR review 时 manual checklist
```

---

## 4. 与既有红线的关系

| 既有红线 | v6 是否触碰 | 不变量保护 |
|---|:---:|---|
| CK 红线 #1（v1-v5 stores 0 变更）| ❌ 不触碰 | I-2 严守 |
| gap-c R1（不改 prompt JSON）| ❌ 不触碰 | I-5 严守（仅 NEW novel.9）|
| gap-c R2（不改 ScoreCard）| ❌ 不触碰 | I-7 严守 |
| gap-d 红线 #4（不改 runner.ts）| ❌ 不触碰 | 无关 |
| gap-b PR-3 红线 R5（视觉风格）| ❌ 不触碰 | I-6 独立面板 |
| testing discipline R6 | ❌ 不触碰 | 无 v6 测试改动 |
| v5 CK I-1（readerLayer 全可选）| ❌ 不触碰 | I-7 同步守 |
| v5 CK I-3（v6 stores = v5）| ❌ 不触碰 | I-2 衍生（v7 stores = v6 + 1 表）|

---

## 5. 不变量违反时的回退协议

### 5.1 PR-1 阶段违反（schema / Reflector pipeline）

```
检测时机：commit 前 self-review + push 前 git diff 复审

违反类型：
  ├─ I-1 violated → parseReflectorResponse 加 try/catch · 不 throw
  ├─ I-2 violated → rollback v7 块 · 重新审计 stores 字符串
  ├─ I-3 violated → 致命 · 立刻 revert · 不允许任何自动写文件
  ├─ I-4 violated → 改 DEFAULTS · 必须 enabled: false
  ├─ I-5 violated → 致命 · 立刻 revert · 用户重新签字
  ├─ I-7 violated → rollback pipeline 改动
  └─ I-8 violated → 改 reflector hook · 加 .catch · 不 await

回退方法：
  git restore <file>  # 单文件回退
  git reset --hard HEAD~1  # 整 commit 回退
```

### 5.2 PR-2 阶段违反（UI）

```
检测时机：commit 前 + 手动测试 + vite build

违反类型：
  ├─ I-3 violated → rollback 自动写入逻辑
  └─ I-6 violated → rollback 嵌入 CharacterBible · 改回独立 panel

回退方法：同 5.1
```

### 5.3 PR-3 阶段违反（dogfood）

```
检测时机：实际跑 reflector + UI 操作时

违反类型：
  └─ I-1 / I-3 / I-8 在实际数据下暴露

回退方法：
  □ 找出 root cause（LLM 输出畸形 / hook 异步未捕获）
  □ 针对性修 PR-1 / PR-2 已落代码（hotfix）
  □ 极端情况：v6 epic 整体 revert · 保留 v5 状态
```

---

## 6. CK 自检

```
□ 8 条不变量定义清晰（I-1 到 I-8）
□ 每条含：定义 / 来源 / 检测方法 / 违反影响 / 修正动作
□ §2 速查表含严重度与检测时机
□ §3 检测自动化建议（未来）
□ §4 与既有红线的关系（不交叉冲突）
□ §5 回退协议（PR-1/2/3 三阶段）
```

---

## 7. 后续 epic 的依赖契约

### 7.1 v7 epic（layer 2 · readerLayer 加 counter）使用 v6 不变量

```
v7 假设：
  □ I-3 不自动写 method module → v7 也保持人工 Curator
  □ I-7 readerLayer schema 不变 → v7 仅在 readerLayer 字段上加 counter（add-only · 子字段）
  □ I-8 reflector hook 模式 → v7 复用同模式
```

### 7.2 v8/v9 epic（layer 3 · 自动 Curator）使用 v6 不变量

```
v8/v9 必须先放宽 I-3：
  □ 用户重新签字 "允许自动写入 method module"
  □ 提供回滚机制（git revert / 用户 toggle 关闭）
  □ 多重审阅（用户 review > N 条 lesson 后才允许自动）

v8/v9 必须严守：
  □ I-2 v7 → v8 stores 字符串 = v7 + 1 新表
  □ I-5 现有 prompt JSON 仍 0 修改（除非新签字）
```

### 7.3 gap-h epic（交叉验证）与 v6 正交

```
gap-h 用 v5 readerLayer · 不依赖 v6
gap-h 与 v6 可并行
但：gap-h 也产出 ConsistencyReport → 自动成为 v6 reflector 的新信号源
    （I-7 严守 · gap-h 仅扩展 consistencyCheck.ts 输出 · v6 reflector.ts 0 改动）
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v6 epic 的 BMAD Stage 2 CK · 8 条不变量 + 检测 / 回退协议 + 后续依赖契约。
**下游**：PR-1 / PR-2 / PR-3 实施时的 review checklist + 未来 v7 / v8/v9 / gap-h epic 的依赖契约源头。
