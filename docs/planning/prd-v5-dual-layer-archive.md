---
project: fili-web
epic: v5-dual-layer-archive
stage: BMAD Stage 2 · PRD only (CA + CK pending follow-up sessions)
author: QvQ + Cascade
date: 2026-05-07
audience: 自己（QvQ）+ AI 协作者（Cascade）
status: draft · 待评审
workflow: BMAD-METHOD · QQ short-form PRD
related:
  - preflight-v5-dual-layer-archive.md（v5 设计基础 · §0-§11 详细分析）
  - prd-gap-b-character-bible.md（gap-b 是 v5 的扩展对象）
  - public/methods/dual-layer-archive-method.md（v3 method module · 方法论来源）
  - public/prompts/novel/3.3.json（改造对象 · LLM schema 升级）
  - src/store/characterStates.ts（改造对象 · CharacterSnapshot v5 → v6）
  - src/pipeline/characterStateExtraction.ts（改造对象 · LLM 调用 + schema fallback）
  - src/components/novel/CharacterBible.tsx（UI 改造对象 1 · 详情面板）
  - src/components/novel/CharacterTimelineView.tsx（UI 改造对象 2 · 时间线）
gap_c_R1_exemption: ✅ 仅 N3.3 豁免（N3.1 / N3.2 仍受保护）
---

# v5 epic · 双层存档（dual-layer-archive）

## 0. TL;DR

让 gap-b 已经实现的 `characterStates`（事实层 5 字段：emotion / relationships / abilities / keyEvents / summary）**叠加"读者层"4 字段**（whatISaw / whatIKnow / whatImWondering / keyUnderstanding），把"AI 视角的章节客观提取"和"读者视角的认知 / 情感 / 悬念追踪"分层并存。

解决：第 8 章往后 LLM 看不到"角色到此为止留给读者的悬念是什么 / 读者已知什么 / 读者还不知什么"，导致**反转突兀 / 伏笔失效 / 揭秘节奏错乱**。

预计：~4-5 小时 / 3 PR / 累积 src 增量 ≤ 140 行 / Dexie schema v5 → v6 add-only / **N3.3 prompt 升级**（gap-c R1 豁免 · 仅 N3.3）/ ScoreCard / N3.1 / N3.2 / characterBible 算法 **0 修改**。

---

## 1. Context · 为什么现在做

### 1.1 dual-layer-archive 起点

v3 method modules **batch-12**（self-evolving-auditor）在 2026-05-07 早些时候吸收完成。其核心创新就是**双层存档结构**（事实层 + 读者层），并且整个 fili-web 的 batch-12/13/14 都隐式遵循。`dual-layer-archive-method.md` 是这一原则的方法论描述。

但 fili-web **代码层面**仅 gap-b 落地了"事实层"（CharacterSnapshot 5 字段），没有"读者层"。v5 epic 的目的就是**让方法论与代码实现对齐**。

### 1.2 痛点（gap-b 已落地后发现）

QvQ dogfood 长篇（≥ 8 章）在 gap-b CharacterTimelineView 看到的状态摘要全是"事实"：

- ✅ 事实层有：第 5 章主角发现 X 是真凶（keyEvents）
- ❌ 读者层缺失：截至第 5 章末读者**已知** / **还不知** / **正在怀疑** 什么？

具体痛点：

- **悬念断片**：第 5 章布的伏笔（"X 戒指的来历"）到第 8 章被 LLM 遗忘 · 直接揭晓时显得突兀
- **反转无铺垫**：第 7 章本应是"读者还不知 → 揭晓"的拐点 · 但 LLM 不知道"读者还不知"是什么 · 反转节奏错乱
- **认知错位**：读者在第 5 章末**应该已知** A 与 B 的紧张关系 · 但第 6 章开头 LLM 把它当作"新冲突"重写一遍 · 拖沓
- **N3.3 LLM 提取信息密度不够**：现有 5 字段全是"客观发生了什么" · LLM 没在思考"读者怎么理解 / 还在等什么"

### 1.3 为什么是 v5 而不是 gap-h / gap-i

按 epic 编号体系：

- ✅ gap-a（多卷）/ gap-b（角色 Bible）/ gap-c（衔接）/ gap-d（Dashboard）/ gap-e（导出）/ gap-f（设置守卫）= 已落地或部分落地
- 🆕 v5 = **gap-b 的纵深扩展**（不开新 gap · 因为本质是 CharacterSnapshot 字段加深 · 不是新功能领域）
- 🟡 gap-g = D 完整版（CharacterBible UI 体验升级 · 与 v5 正交）
- 🟡 gap-h = 交叉验证（事实层 vs 读者层一致性检查 · v5 的后续）
- 🟡 gap-i+ = 留待未来

**v5 优先于 gap-g/h 的理由**：v5 是 gap-b 的"深度对齐"（让 schema 反映方法论） · gap-g 是 UI "广度提升"（更花哨但不增加表达力）· gap-h 是 "v5 + gap-g 完成后才有意义"（先有读者层数据才能交叉验证）。

### 1.4 现有可复用资产（**preflight 已审计**）

| 资产 | 路径 | 复用方式 |
|---|---|---|
| **CharacterSnapshot 5 字段** | `src/store/characterStates.ts:14-26` | add-only · 加 `readerLayer?: ReaderLayerSnapshot` 可选字段 |
| **Dexie schema 升级模式** | `src/db/schema.ts`（v3→v4→v5 历史）| 同模式 · v5→v6 add-only 索引不变 |
| **N3.3 prompt JSON** | `public/prompts/novel/3.3.json` | 升级 schema + system 引导 LLM 输出 readerLayer · gap-c R1 豁免 |
| **schema fallback** | `src/pipeline/characterStateExtraction.ts:60-90` | 旧 LLM 不返回 readerLayer 时 · undefined 容忍 |
| **CharacterTimelineView** | `src/components/novel/CharacterTimelineView.tsx` | UI add-only · 加"读者层摘要"折叠区 |
| **CharacterBible 详情** | `src/components/novel/CharacterBible.tsx` | UI add-only · 加"读者层"详细 4 字段展示 |
| **dual-layer-archive 方法论** | `public/methods/dual-layer-archive-method.md` | 文档复用 · PRD §4.x 引用其 4 字段定义 |

→ **不重造** schema 升级模式 / LLM 调用 / persistence / UI 渲染范式。

---

## 2. User Stories

### 2.1 主线 (MUST)

> **US-1**：作为写到第 8 章的 QvQ · 我点 N3.3（角色状态提取） · LLM 不仅返回 emotion/relationships/abilities/keyEvents/summary（事实层）· 还返回 readerLayer 4 字段（whatISaw / whatIKnow / whatImWondering / keyUnderstanding）· 全部存入同一 row。

> **US-2**：我打开 CharacterTimelineView · 选中"主角" · 时间线每章节卡片下方多一个折叠区 **「读者层」** · 一句话摘要："读者截至第 X 章已知 ... · 还在猜 ..."。

> **US-3**：我展开 CharacterBible 详情 · 看到 4 个新字段独立卡片：whatISaw（看到了什么）/ whatIKnow（知道了什么）/ whatImWondering（在猜什么）/ keyUnderstanding（核心理解）。每字段一段 50-150 字描述。

### 2.2 次线 (SHOULD)

> **US-4**：当我从旧版本（v5 schema）升级到 v6 时 · 旧 row 的 readerLayer 字段为 `undefined` · UI 显示「读者层（旧记录无数据 · 重跑提取可补全）」· 不报错。

> **US-5**：当 N3.3 LLM 返回时漏了 readerLayer 字段（调用旧 prompt 模型 / 模型没遵循 schema）· schema fallback 容忍 undefined · row 仍正确保存事实层。

### 2.3 不做 (OUT)

> **OUT-1**：交叉验证（事实层 vs 读者层一致性）→ 留 gap-h epic  
> **OUT-2**：N3.1 章节草稿 prompt 注入 readerLayer → 留后续 epic（v5 仅扩 schema · 不扩注入）  
> **OUT-3**：N3.2 章节润色 prompt 改动 → R1 红线保护（gap-c R1 仅豁免 N3.3）  
> **OUT-4**：ScoreCard 新增"读者层连贯度"维度 → 留 gap-h（gap-c R2 红线保护）  
> **OUT-5**：CharacterBible 时间线视觉重设计 → gap-g epic  
> **OUT-6**：导出 readerLayer 到 markdown → 接 gap-e ExportDrawer · 留后续  

---

## 3. Goals & Non-Goals

### 3.1 Goals

- ✅ schema 字段新增 4 项（readerLayer 子结构）· add-only · v5 → v6
- ✅ N3.3 prompt JSON 升级 schema + system 引导（gap-c R1 豁免）
- ✅ CharacterTimelineView 时间线增"读者层"折叠摘要
- ✅ CharacterBible 详情增"读者层" 4 字段卡片
- ✅ schema fallback 容忍 undefined（旧 row / 模型漏返回）
- ✅ vite errs=0 / dexie 旧 row 兼容 / dogfood 一遍通过

### 3.2 Non-Goals

- ❌ 不做交叉验证（gap-h）
- ❌ 不改 N3.1 / N3.2 prompt
- ❌ 不改 ScoreCard
- ❌ 不改 characterStates 表结构（除 readerLayer 字段外）
- ❌ 不改 CharacterTimelineView 视觉风格（仅 add-only 折叠区）
- ❌ 不接入导出（留 gap-e 后续）

---

## 4. Schema 升级（v5 → v6）

### 4.1 ReaderLayerSnapshot 类型定义（preflight §4.1）

```ts
// src/store/characterStates.ts (新增 type)
export interface ReaderLayerSnapshot {
  /** 读者从本章字面看到了什么客观信息（不含推理 · 50-150 字） */
  whatISaw: string;
  /** 读者从本章已知 + 之前章节累积 · 推理出的"事实拼图"（50-150 字） */
  whatIKnow: string;
  /** 读者还不知道但在好奇 / 怀疑的悬念点（50-150 字） */
  whatImWondering: string;
  /** 角色在读者认知里的"核心理解"摘要（一句话 · 50-100 字） */
  keyUnderstanding: string;
}
```

### 4.2 CharacterSnapshot 升级（add-only）

```ts
// src/store/characterStates.ts (修改)
export interface CharacterSnapshot {
  characterName: string;
  chapterIndex: number;
  emotion: string;             // 事实层 1
  relationships: Record<string, string>;  // 事实层 2
  abilities: string;           // 事实层 3
  keyEvents: string[];         // 事实层 4
  summary: string;             // 事实层 5
  readerLayer?: ReaderLayerSnapshot; // ★ v6 新增 · 可选（旧 row 兼容）
  createdAt: number;
}
```

### 4.3 Dexie schema v5 → v6（src/db/schema.ts）

```ts
// 索引不变（[characterName + chapterIndex]）
// 仅版本升一档 + ReaderLayerSnapshot 嵌套字段 add-only
this.version(6).stores({
  characterStates: '++id, [characterName+chapterIndex], chapterIndex',
});
```

→ **add-only · 旧 row 完全兼容 · 无需 upgrade fn**。

---

## 5. Prompt 升级（N3.3）

### 5.1 改动范围

```
public/prompts/novel/3.3.json
  ├─ system 字段：加 readerLayer 引导段（~80 字）
  └─ schema 字段：JSON Schema add 4 子字段 readerLayer.{whatISaw, whatIKnow, whatImWondering, keyUnderstanding}
```

### 5.2 schema 升级（细节）

```jsonc
// public/prompts/novel/3.3.json schema 字段
{
  "type": "object",
  "properties": {
    "characterName": { "type": "string" },
    "emotion": { "type": "string" },
    "relationships": { "type": "object", "additionalProperties": { "type": "string" } },
    "abilities": { "type": "string" },
    "keyEvents": { "type": "array", "items": { "type": "string" } },
    "summary": { "type": "string" },
    "readerLayer": {                          // ★ v6 新增
      "type": "object",
      "properties": {
        "whatISaw": { "type": "string", "minLength": 50, "maxLength": 150 },
        "whatIKnow": { "type": "string", "minLength": 50, "maxLength": 150 },
        "whatImWondering": { "type": "string", "minLength": 50, "maxLength": 150 },
        "keyUnderstanding": { "type": "string", "minLength": 50, "maxLength": 100 }
      },
      "required": ["whatISaw", "whatIKnow", "whatImWondering", "keyUnderstanding"]
    }
  },
  "required": ["characterName", "emotion", "relationships", "abilities", "keyEvents", "summary"]
  // ↑ readerLayer 不放 top-level required · 旧模型不返回时容忍
}
```

### 5.3 system 引导段（追加在原 system 末尾）

```
此外 · 请同时输出"读者层"4 字段：
- whatISaw：读者本章字面看到的客观信息（50-150 字 · 不含推理）
- whatIKnow：读者已知 + 推理拼图（含历史章节累积 · 50-150 字）
- whatImWondering：读者还不知 / 在猜 / 在悬念中的内容（50-150 字）
- keyUnderstanding：角色在读者认知里的核心理解（一句话 · 50-100 字）

事实层与读者层并存：事实层是"角色客观状态" · 读者层是"读者认知 / 情感 / 悬念视角"。
```

### 5.4 红线豁免（gap-c R1）

- gap-c R1 protects all `public/prompts/novel/*.json` from prompt JSON modifications
- **本 epic 仅豁免 N3.3** · N3.1 / N3.2 / N1.x 全部仍受保护
- preflight 文档 §3.2 已详细分析 · 用户已签字

---

## 6. UI 升级（CharacterTimelineView + CharacterBible）

### 6.1 CharacterTimelineView · 时间线读者层折叠摘要

```tsx
// src/components/novel/CharacterTimelineView.tsx (修改 · ~30 行)
{snapshot.readerLayer && (
  <details className="text-xs mt-2 text-zinc-400">
    <summary className="cursor-pointer hover:text-zinc-200">读者层摘要</summary>
    <div className="mt-1 pl-2 border-l-2 border-zinc-600 space-y-1">
      <div><span className="text-zinc-500">已知：</span>{snapshot.readerLayer.whatIKnow}</div>
      <div><span className="text-zinc-500">在猜：</span>{snapshot.readerLayer.whatImWondering}</div>
    </div>
  </details>
)}
{!snapshot.readerLayer && (
  <div className="text-xs mt-2 text-zinc-500 italic">读者层（旧记录无数据 · 重跑 N3.3 可补全）</div>
)}
```

### 6.2 CharacterBible · 详情 4 字段卡片

```tsx
// src/components/novel/CharacterBible.tsx (修改 · ~30 行)
{selectedSnapshot.readerLayer && (
  <section className="mt-4 p-3 bg-zinc-900/50 rounded">
    <h4 className="text-sm font-semibold text-zinc-200 mb-2">读者层</h4>
    <div className="space-y-2 text-xs">
      <div><span className="text-zinc-400">看到：</span>{selectedSnapshot.readerLayer.whatISaw}</div>
      <div><span className="text-zinc-400">已知：</span>{selectedSnapshot.readerLayer.whatIKnow}</div>
      <div><span className="text-zinc-400">在猜：</span>{selectedSnapshot.readerLayer.whatImWondering}</div>
      <div><span className="text-zinc-400">核心：</span>{selectedSnapshot.readerLayer.keyUnderstanding}</div>
    </div>
  </section>
)}
```

→ 两处 UI 都 **fallback 到 undefined 显示 italic 提示**。

---

## 7. Constraints · 红线 / 豁免

### 7.1 全局红线清单（截至当前）

| # | 红线 | 来源 | v5 状态 |
|:---:|---|---|:---:|
| R1 | 不改 `public/prompts/novel/*.json` | gap-c P1 | 🟡 **本 epic 豁免 · 仅 N3.3** |
| R2 | 不改 ScoreCard 维度 | gap-c | ✅ 不影响 |
| R3 | Dexie schema add-only · 不改字段 | dexie 兼容 | ✅ 完全遵守（v5→v6 仅加字段）|
| R4 | 不改 `pipeline/runner.ts` 流水线核心 | gap-d | ✅ 不影响 |
| R5 | gap-b CharacterTimelineView 视觉风格 | gap-b PR-3 | ✅ 不影响（仅 add-only 折叠区）|
| R6 | 不删 / 不弱化既有 tests | testing discipline | ✅ 不影响 |

### 7.2 gap-c R1 豁免详细

- 范围：仅 `public/prompts/novel/3.3.json`
- 不豁免：N3.1 / N3.2 / N1.x 全部
- 用户签字：✅ M3-step1 阶段 1 preflight 文档已签
- 改动审计：CA 文档 §3 列出确切改动行数

---

## 8. Boundary · 不做的事

| # | 项目 | 理由 | 留给 |
|:---:|---|---|---|
| B-1 | 交叉验证（事实层 ↔ 读者层一致性）| v5 仅扩 schema · 验证逻辑独立工程 | gap-h epic |
| B-2 | N3.1 章节草稿注入 readerLayer | 注入设计 · token 预算 · 影响 N3.1 prompt（红线）| 后续 epic |
| B-3 | N3.2 章节润色 prompt 改动 | gap-c R1 不豁免 N3.2 | 永久不动（除非未来豁免）|
| B-4 | ScoreCard 加"读者层连贯度"维度 | gap-c R2 红线保护 | gap-h epic |
| B-5 | CharacterBible 时间线视觉重设计 | UI 广度提升 · 与 v5 正交 | gap-g epic |
| B-6 | 导出 readerLayer 到 markdown | 需接 gap-e ExportDrawer · 工程量额外 | 后续 epic |

---

## 9. Phasing & PR Plan

### 9.1 总览

```
v5 epic = 3 PR · 顺序串行 · 每 PR 后用户审阅
预计：~4-5 小时（不含用户 dogfood 时间）
代码增量：≤ 140 行
```

### 9.2 PR-1 · schema + prompt 升级（核心）

```
范围：
  ├─ src/store/characterStates.ts        +5 行  (新 type ReaderLayerSnapshot + CharacterSnapshot 加可选字段)
  ├─ src/db/schema.ts                    +3 行  (Dexie v6 add-only)
  ├─ src/pipeline/characterStateExtraction.ts +8 行  (schema fallback · undefined 容忍)
  └─ public/prompts/novel/3.3.json      +20 行 (schema add 4 子字段 + system 引导段) ★ R1 豁免

总计：~36 行
验证：vite errs=0 / dexie 旧 row 不报错 / N3.3 LLM 调用一次成功返回 readerLayer
commit: feat(v5): PR-1 dual-layer-archive schema + N3.3 prompt upgrade (gap-c R1 exempt: N3.3 only)
```

### 9.3 PR-2 · UI 展示（CharacterTimelineView + CharacterBible）

```
范围：
  ├─ src/components/novel/CharacterTimelineView.tsx   +30 行  (折叠区 · 已知 / 在猜 摘要)
  └─ src/components/novel/CharacterBible.tsx          +30 行  (4 字段详情卡片)

总计：~60 行
验证：UI 渲染正确 / 旧 row（无 readerLayer）显示 italic 提示 / 新 row 渲染 4 字段
commit: feat(v5): PR-2 dual-layer UI (CharacterTimelineView + CharacterBible reader-layer panels)
```

### 9.4 PR-3 · dogfood 验收 + 文档收尾

```
范围：
  ├─ docs/dogfood-log.md       +30-50 行  (v5 dogfood 实测记录)
  └─ （可选）docs/notes/        修订（如有发现）

总计：~50 行 (纯 docs · 无代码)
验证：
  □ N3.3 实跑 1 次 · LLM 返回 readerLayer 4 字段 · 落 row
  □ CharacterTimelineView 折叠区可用
  □ CharacterBible 详情 4 字段卡片可用
  □ 旧 row 无 readerLayer · UI 显示 italic 提示
  □ vite build errs=0
  □ dexie 旧 row 兼容
commit: docs(v5): PR-3 dogfood verification + completion log
```

### 9.5 阶段间断点

```
PR-1 后 · 用户审阅 schema + prompt（不动 UI）· 签字 → PR-2
PR-2 后 · 用户审阅 UI（手动测试）· 签字 → PR-3
PR-3 后 · v5 epic 完成 · 进入 cool-down + dogfood · 等用户启动 gap-g 或 gap-h
```

---

## 10. Success Criteria

### 10.1 功能验收

```
□ N3.3 LLM 返回 readerLayer 4 字段（≥ 1 次成功）
□ CharacterSnapshot row 含 readerLayer（schema v6）
□ CharacterTimelineView 显示折叠摘要
□ CharacterBible 显示 4 字段详情
□ 旧 row（v5）UI 显示 italic 提示 · 不报错
□ schema fallback 工作（LLM 漏返回 readerLayer 时 · row 仍保存事实层）
```

### 10.2 工程验收

```
□ vite errs=0 / vite warnings 不增加
□ dexie 旧 row 在 v6 schema 下可读 · 无 upgrade error
□ src 增量 ≤ 140 行（PR-1 ~36 + PR-2 ~60 + 其它 ≤ 44）
□ N3.3 prompt JSON 修改限于 schema + system · 不改 user / temperature / model
□ R2/R3/R4/R5/R6 红线全部遵守
```

### 10.3 dogfood 验收（QvQ 长篇 ≥ 8 章）

```
□ 用户实跑 N3.3 · 等待 ≤ 30s · readerLayer 4 字段输出
□ 用户在 CharacterTimelineView 看到「读者层」折叠区
□ 用户在 CharacterBible 看到 4 字段详情
□ 用户主观感受：v5 实施后写第 N+1 章时 · LLM 对"读者已知 / 在猜"的把握更准确
  （非工程指标 · 但是核心动机验收）
```

---

## 11. Risks · 风险登记册

### 11.1 高风险（无）

预审计无高风险（preflight §8.1 已确认）。

### 11.2 中风险

| ID | 风险 | 概率 | 影响 | 缓解 |
|:---:|---|:---:|:---:|---|
| R-M1 | LLM 不遵守 readerLayer schema · 返回字段缺失 / 字数超 | 中 | 中 | schema fallback 容忍 + system 引导段强调字数 |
| R-M2 | 旧 row（v5 schema）在 v6 下 dexie 报错 | 低 | 高 | add-only · 不需 upgrade fn · preflight §3.3 已审计 |
| R-M3 | gap-c R1 豁免范围被扩大解释（如 N3.2 也被改）| 低 | 高 | PRD §7 + CA 文档明确"仅 N3.3" + commit msg 显式标注 |
| R-M4 | tokens 增加 > 30%（N3.3 prompt 升级 + 输出 readerLayer 4 字段）| 中 | 低 | NFR-1 设上限 · 实测 < 30% 即通过 |

### 11.3 低风险

| ID | 风险 | 缓解 |
|:---:|---|---|
| R-L1 | UI 折叠区在小屏被压缩到不可读 | 用 details/summary 原生组件 · 移动友好 |
| R-L2 | "读者层"中文字 50-100 字限制 LLM 偶尔超 | schema minLength/maxLength 强约束 · 失败重跑 |

---

## 12. Dependencies

### 12.1 上游

- **gap-b 已完成**（CharacterSnapshot 5 字段 + characterStates 表 + N3.3 prompt 基础 + CharacterTimelineView/CharacterBible UI 框架）
- **dual-layer-archive-method.md** 已落地（batch-12 · 2026-05-07）
- **preflight-v5-dual-layer-archive.md** 已签字（M3-step1 阶段 1）

### 12.2 下游（v5 unblock）

- **gap-h epic**（交叉验证）：等 v5 提供 readerLayer 数据
- **后续 N3.1 注入 epic**：等 v5 schema 稳定后才能注入 readerLayer 到草稿 prompt
- **gap-g epic**（CharacterBible 体验升级）：与 v5 正交 · 可并行

---

## 13. Dogfood Plan

### 13.1 准备（PR-1 完成后）

```
1. 在 dev 环境 dexie schema 升级到 v6（自动 · 用户开 app）
2. 找一个已有 ≥ 5 章的项目（无 readerLayer 数据）
3. 在 N3.3 面板对最新章节"重跑提取" · 验证返回 readerLayer
```

### 13.2 实操（PR-2 完成后）

```
1. CharacterTimelineView 选主角 · 看到时间线
2. 旧章节（无 readerLayer）显示 italic 提示
3. 最新章节（重跑过的）显示折叠区 · 摘要 2 行
4. 展开 CharacterBible 详情 · 看到 4 字段卡片
5. 切换其它角色 · 行为一致
```

### 13.3 主观评估（PR-3 完成时记录到 dogfood-log）

```
□ 写 N+1 章时 · 是否感觉 LLM 对"读者已知 / 在猜"的认识更准？
□ 反转章节是否更好铺垫？
□ 是否有"伏笔失效 / 揭秘错乱"减少？
□ tokens 增加是否可接受？
```

---

## 14. Out-of-Band Notes

### 14.1 与 method modules 的方法论对齐

- v5 让 gap-b 实施与 `dual-layer-archive-method.md` 方法论 100% 对齐
- 是 **fili-web "方法论 → 代码"对齐**的标志性 epic
- 后续可作为"如何把 method module 落地到 schema"的参考案例

### 14.2 与 standing instructions 的关系

- 不影响 standing instruction 1（Seedance 2.0 8 项 checklist）
- 不影响 standing instruction 2（阶段 2/3 暂停规则 · 本 PRD 是用户主动启动 · 已解锁）
- 不影响 standing instruction 3（push 网络问题协议）

### 14.3 后续 epic 序列建议（仅参考 · 非承诺）

```
v5 (本 epic) → gap-g（CharacterBible 体验）→ gap-h（交叉验证）→ 后续 N3.1 注入
                ↑ 与 v5 正交 · 可并行  ↑ 必须在 v5 + gap-g 后
```

---

## 15. Open Questions（启动前已签字 · 此处仅作记录）

| # | 问题 | 决策 | 时间 |
|:---:|---|---|---|
| 1 | gap-c R1 对 N3.3 豁免？ | ✅ 同意 | M3-step1 阶段 1 |
| 2 | readerLayer 4 字段设计？ | ✅ 同意 | M3-step1 阶段 1 |
| 3 | v5 一并做交叉验证？ | 🟡 拆 gap-h | M3-step1 阶段 1 |
| 4 | v5 一并改 N3.1 注入？ | 🟡 留后续 | M3-step1 阶段 1 |
| 5 | 启动 v5 epic？ | ✅ 启动 | M3-step1 阶段 2 |

---

## 16. PRD 自检

```
□ frontmatter 完整（project / epic / stage / related / gap_c_R1_exemption）
□ §0 TL;DR 一段话覆盖动机 + 范围 + 工程量
□ §1 Context 含痛点 + 优先级 + 复用资产
□ §2 User Stories 含 MUST / SHOULD / OUT
□ §3 Goals & Non-Goals 明确
□ §4 Schema 升级（add-only · v5→v6）
□ §5 Prompt 升级（gap-c R1 豁免范围明确）
□ §6 UI 升级（fallback 处理）
□ §7 Constraints 红线全清单 + 豁免范围
□ §8 Boundary 不做的事
□ §9 Phasing & PR Plan（3 PR · ≤ 140 行）
□ §10 Success Criteria 三段（功能 / 工程 / dogfood）
□ §11 Risks 高 / 中 / 低
□ §12 Dependencies（上游 / 下游）
□ §13 Dogfood Plan
□ §14 Out-of-Band（方法论对齐 / standing instructions）
□ §15 Open Questions（已签字记录）
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v5 epic 的 BMAD Stage 2 PRD · 描述目标 / 范围 / 红线 / PR 拆分。
**下游**：CA（Codebase Analysis · 本目录 codebase-analysis-v5-dual-layer-archive.md）+ CK（Code Knowledge invariants · 本目录 code-knowledge-v5-dual-layer-archive.md）+ PR-1/2/3 实施。
