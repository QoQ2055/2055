---
project: fili-web
epic: v5-dual-layer-archive
stage: BMAD Stage 2 · CK (Code Knowledge invariants)
author: QvQ + Cascade
date: 2026-05-07
status: draft · 不变量定义
workflow: BMAD-METHOD · post-CA invariant registry
related:
  - prd-v5-dual-layer-archive.md（设计意图）
  - codebase-analysis-v5-dual-layer-archive.md（代码现状审计 · 含 §5 不变量候选）
  - public/methods/dual-layer-archive-method.md（方法论）
---

# v5 epic · CK · Code Knowledge Invariants

## 0. TL;DR

定义 v5 epic 实施过程必须保持的 **8 条不变量**（I-1 到 I-8）。每条不变量含：定义 / 来源 / 检测方法 / 违反影响 / 修正动作。

CK 文档作为：
- PR review 的硬性 checklist
- 未来 epic（gap-h / N3.1 注入）的依赖契约
- 回归测试的设计输入

---

## 1. Invariant Registry

### I-1 · readerLayer 字段全部可选

**定义**：

```ts
ReaderLayerSnapshot {
  whatISaw?: string;
  whatIKnow?: string;
  whatImWondering?: string;
  keyUnderstanding?: string;
}
CharacterSnapshot {
  // ... 5 现有字段
  readerLayer?: ReaderLayerSnapshot;  // 顶层可选
}
```

→ 所有 5 个层级的 readerLayer 相关字段（含 readerLayer 自己）**全部 TypeScript optional**。

**来源**：CA §5 · PRD §4.1 修正 · 旧 row + LLM 漏返回兼容需求。

**检测方法**：

```bash
# 类型检查（应通过）
pnpm tsc

# grep 防 required 漂移
grep -rE "readerLayer\??:" src/store/characterStates.ts
# 应输出：readerLayer?: ReaderLayerSnapshot;
```

**违反影响**：高（旧 row 在 v6 schema 下读取报错 · LLM 漏返回时 row 写入失败）。

**修正动作**：发现违反 → 立刻把字段改回 optional · 不可妥协。

---

### I-2 · readerLayer 不进 dexie 索引

**定义**：

```
characterStates 表索引（v5 = v6）：
  ++id, projectId, chapterIndex, characterName, ts, stale,
  [projectId+chapterIndex], [projectId+characterName],
  [projectId+chapterIndex+characterName]

readerLayer.* 字段：嵌套在 snapshot JSON blob · 不可作为索引键。
```

**来源**：CA §1.4 · 避免 schema 复杂化 · readerLayer 仅用于显示。

**检测方法**：

```bash
# 验证 stores 字符串不变
grep -A 2 "version(6)" src/store/db.ts | grep characterStates
# 应输出 v5 同样的字符串
```

**违反影响**：高（破坏 CK 红线 #1 · v1-v5 stores 0 变更）。

**修正动作**：禁止 readerLayer 任何子字段进入 stores 字符串。

---

### I-3 · v6 stores 字符串 = v5 stores 字符串

**定义**：

```
this.version(6).stores({
  // 8 张表的字符串完全复制 v5
  ...
});
```

仅 version 号 +1 · 表数量 / 表名 / 索引串 / 复合索引 全部 0 变更。

**来源**：CK 红线 #1（v1-v5 stores 0 变更）· CA §3.2。

**检测方法**：

```bash
# diff v5 / v6 stores 字符串
# 应输出 0 行差异（除版本号）
```

或代码层：

```ts
// src/store/db.ts 内
const v5Stores = { /* v5 完整 */ };
const v6Stores = { /* v6 完整 */ };
// 二者必须 deepEqual（含所有索引串）
```

**违反影响**：致命（升级时 dexie 触发 unintended migration · 旧用户数据风险）。

**修正动作**：发现差异 → 立刻回退 v6 块 · 重新审计原因。

---

### I-4 · F4 / F5 不破坏 gap-b 现有视图

**定义**：

- **F4 `CharacterTimelineView.tsx`**：保留现有 SVG 网格 5 行（关系 / 情绪 / 能力 / 事件 / 一句话）+ 56×28 cell 尺寸 + 5 色方案（NOT_RUN / OK / STALE / FAILED / SELECTED）。
- **F5 `CharacterBible.tsx`**：保留现有 'timeline' / 'relations' viewMode + summary 标签 + hasFailed/hasStale 徽章 + 角色下拉 + 重跑按钮。

新增**仅追加**（reader viewMode / SVG 下方详情区）· 不修改现有 JSX 任何节点。

**来源**：gap-b PR-3 红线 R5（视觉风格保持）· CA §3.4 / §3.5。

**检测方法**：

```
□ git diff PR-2 时 · F4 现有 ROW_LABELS 数组 / 颜色常量 / SVG cell 尺寸 0 行修改
□ git diff PR-2 时 · F5 现有 timeline / relations 分支 0 行修改
□ 手动测试 · gap-b dogfood 现有视觉一致
```

**违反影响**：中（gap-b 视觉破坏 · 用户体验回退 · 可能触发 R5 红线告警）。

**修正动作**：rollback 修改 → 改用 add-only 模式（在现有结构外追加）。

---

### I-5 · pipeline/characterStates.ts 不改

**定义**：

```
src/pipeline/characterStates.ts 在 v5 epic 全程 0 行修改。
```

**来源**：CA §2.2 · 现有 schema fallback 已足够容错 readerLayer。

**检测方法**：

```bash
git diff main -- src/pipeline/characterStates.ts
# v5 PR-1/2/3 全程应输出 0 行
```

**违反影响**：中（额外改动 · 增加 v5 epic 风险面 · 可能影响 LLM 调用稳定性）。

**修正动作**：rollback · readerLayer 数据流应该完全靠现有 parseExtractionResponse → upsertCharacterState 自动透传（snapshot 是嵌套 JSON · 整体落 row）。

---

### I-6 · gap-c R1 豁免范围严格限制

**定义**：

```
v5 epic 唯一 prompt JSON 修改：
  □ 文件：public/prompts/novel/3.3.json（且仅这一个）
  □ 字段：messages[0].content（system 字段 · 文本扩展）
  □ 不改：messages[1].content / temperature / max_tokens / stream / 任何其它字段

不可援引到：
  □ N3.1（public/prompts/novel/3.1.json）→ R1 完全保护
  □ N3.2（public/prompts/novel/3.2.json）→ R1 完全保护
  □ N1.x（public/prompts/novel/1.*.json）→ R1 完全保护
  □ N2.x（public/prompts/novel/2.*.json）→ R1 完全保护
  □ 任何其它 stage prompt → R1 完全保护
```

**来源**：preflight §3.2 用户签字 · CA §4.2。

**检测方法**：

```bash
# v5 PR-1 仅改这一个 JSON · git diff 验证
git diff main -- public/prompts/novel/
# 应仅显示 3.3.json 改动
```

**违反影响**：致命（red-line 红线被破坏 · 用户信任崩塌）。

**修正动作**：rollback · 任何其它 prompt 改动必须用户重新签字。

---

### I-7 · readerLayer 数据流：LLM → upsert 透传

**定义**：

```
N3.3 LLM 输出 → parseExtractionResponse 解析 →
  for each item: { characterName, snapshot: {...含 readerLayer...} }
  upsertCharacterState({ ..., snapshot: item.snapshot })
  → dexie row.snapshot.readerLayer 自动透传

不变量：
  □ pipeline/characterStates.ts 的 parseExtractionResponse 不需特别处理 readerLayer
  □ upsertCharacterState 不需特别处理 readerLayer
  □ schema fallback（snapshot:null）路径不受 readerLayer 影响
```

**来源**：CA §2.2 / §3.1。

**检测方法**：

```
□ runCharacterStateExtraction 调用全程 0 个 readerLayer 字符串引用
□ pipeline/characterStates.ts 中 grep 'readerLayer' 应输出 0 行
□ N3.3 LLM 输出含 readerLayer 时 · row.snapshot.readerLayer 应直接落库
```

**违反影响**：中（数据流破坏 · I-5 同时违反 · 增加耦合复杂度）。

**修正动作**：保持 readerLayer 完全透传 · 不在 pipeline 层加任何处理。

---

### I-8 · UI fallback 优雅退化

**定义**：

```
F4 / F5 UI 必须处理 3 类 row 状态：
  1. snapshot === null（提取失败 · 已显示 COLOR_FAILED）
  2. snapshot 存在但 readerLayer === undefined（旧 row / LLM 漏返回）
     → 显示 italic 提示："无读者层数据 · 重跑 N3.3 可补全"
  3. snapshot.readerLayer 存在但部分字段 undefined（LLM 漏字段）
     → 仅渲染存在的字段 · 不报错

绝对禁止：
  □ readerLayer.whatIKnow 直接访问而不判 undefined → TypeError
  □ optional chaining 缺失 → React render crash
```

**来源**：CA §3.4 / §3.5 · I-1 配套约束。

**检测方法**：

```
□ TS strict mode 通过（pnpm tsc）
□ 测试 3 类 row 状态都不报错（手动 dogfood）
□ ESLint 不允许 non-null assertion（!）滥用
```

**违反影响**：高（旧 row 渲染 crash · 用户白屏）。

**修正动作**：所有 readerLayer 访问必须 optional chaining + 全字段独立判 undefined。

---

## 2. 不变量速查表

| ID | 一句话 | 严重度 | 检测时机 |
|:---:|---|:---:|---|
| I-1 | readerLayer 全字段可选 | 高 | PR-1 review |
| I-2 | readerLayer 不进 dexie 索引 | 高 | PR-1 review |
| I-3 | v6 stores 字符串 = v5 | 致命 | PR-1 review |
| I-4 | F4/F5 不破坏 gap-b 视图 | 中 | PR-2 review |
| I-5 | pipeline/characterStates.ts 不改 | 中 | PR-1/2 review |
| I-6 | gap-c R1 豁免限于 3.3.json system | 致命 | PR-1 review |
| I-7 | readerLayer 数据流 LLM→upsert 透传 | 中 | PR-1 review |
| I-8 | UI fallback 优雅退化 | 高 | PR-2 review |

---

## 3. 检测自动化建议（未来）

```
□ 加 lint rule：禁止 readerLayer 非 optional 声明
□ 加 unit test：upsertCharacterState 接受 snapshot.readerLayer = undefined
□ 加 unit test：CharacterTimelineView render 旧 row 不报错
□ 加 git hook：v5 PR diff 必须包含 codebase-analysis-v5-dual-layer-archive.md 验证清单中的所有点
```

→ **本 epic 不实施这些自动化**（v5 范围外 · 留 gap-h / 后续）· 仅 PR review 时 manual checklist。

---

## 4. 与既有红线的关系

| 既有红线 | v5 是否触碰 | 不变量保护 |
|---|:---:|---|
| CK 红线 #1（v1-v5 stores 0 变更）| ❌ 不触碰 | I-3 严守 |
| CK 红线 #3（不动 consistencyCheck.ts）| ❌ 不触碰 | I-5 同步守（不动 pipeline/characterStates.ts）|
| gap-c R1（不改 prompt JSON）| 🟡 豁免 N3.3 | I-6 严守豁免范围 |
| gap-c R2（不改 ScoreCard）| ❌ 不触碰 | 无关 |
| gap-d 红线 #4（不改 runner.ts）| ❌ 不触碰 | 无关 |
| gap-b PR-3 红线 R5（视觉风格）| ❌ 不触碰 | I-4 严守 |
| testing discipline R6（不删测试）| ❌ 不触碰 | 无 v5 测试改动 |

---

## 5. 不变量违反时的回退协议

### 5.1 PR-1 阶段违反（schema / prompt）

```
检测时机：commit 前 self-review + push 前 git diff 复审

违反类型：
  ├─ I-1 violated → 立即改回 optional · 不可妥协
  ├─ I-2 violated → 立即从 stores 字符串移除 readerLayer.* 字段
  ├─ I-3 violated → rollback v6 块 · 重新审计
  ├─ I-6 violated → 致命 · 立刻 revert · 用户重新签字
  └─ I-7 violated → rollback pipeline/characterStates.ts 改动

回退方法：
  git restore <file>  # 单文件回退
  git reset --hard HEAD~1  # 整 commit 回退
```

### 5.2 PR-2 阶段违反（UI）

```
检测时机：commit 前 + 手动 dogfood 测试 + vite build

违反类型：
  ├─ I-4 violated → rollback F4/F5 修改 · 改 add-only
  ├─ I-5 violated → rollback pipeline 改动
  └─ I-8 violated → 加 optional chaining + 单元测试覆盖

回退方法：同 5.1
```

### 5.3 PR-3 阶段违反（dogfood）

```
检测时机：实际跑 N3.3 + UI 渲染时

违反类型：
  └─ I-1 / I-7 / I-8 在实际数据下暴露

回退方法：
  □ 找出 root cause（LLM 输出畸形 / row 旧版本 / 字段访问错）
  □ 针对性修 PR-1 / PR-2 已落代码（hotfix）
  □ 极端情况：v5 epic 整体 revert · 恢复 gap-b v5 schema
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

### 7.1 gap-h epic（交叉验证）使用 v5 不变量

```
gap-h 假设：
  □ I-1 readerLayer 字段全可选 → gap-h 验证逻辑必须 fallback 处理 undefined
  □ I-7 数据流透传 → gap-h 直接读 row.snapshot.readerLayer 即可 · 不需 pipeline 改造
  □ I-8 UI fallback → gap-h 不变验证不引发 UI crash
```

### 7.2 后续 N3.1 注入 epic 使用 v5 不变量

```
后续 N3.1 注入假设：
  □ I-1 → 注入时容忍 readerLayer 部分字段 undefined
  □ I-6 → 修改 N3.1 prompt 需重新签字（不可援引 v5 R1 豁免）
  □ I-7 → readerLayer 数据已自动落 row · 注入只读 dexie · 不改 pipeline
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v5 epic 的 BMAD Stage 2 CK · 8 条不变量 + 检测 / 回退协议 + 后续依赖契约。
**下游**：PR-1 / PR-2 / PR-3 实施时的 review checklist + 未来 gap-h / N3.1 注入 epic 的依赖契约源头。
