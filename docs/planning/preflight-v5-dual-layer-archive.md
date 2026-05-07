# Preflight · v5 epic · 双层存档（dual-layer-archive）

> **目的**：在投入 v5 epic（PRD/CA/CK/PR）之前 · 评估可行性 + 红线影响 + 设计草案 + 决策建议。
> **来源**：dual-layer-archive-method.md（batch-12 提取的方法论模块） + gap-b 现状代码。
> **状态**：📋 预审计 · 0 代码改动 · 等待用户决策。
> **决策点**：本报告读完后 · 用户决定 (a) 启动 v5 epic / (b) 调整设计 / (c) 暂不做。

---

## §0 一句话摘要

```
现状：fili-web characterStates 只有"事实层"（5 字段）· 缺"读者层"（理解层）。
方案：在 CharacterSnapshot 加 readerLayer 字段（4 子字段）· 不破坏现有 5 字段。
影响：~120 行变更 · 1 个红线豁免（gap-c R1 仅对 N3.3）· Dexie v6 add-only。
建议：✅ **可做** · 价值高 · 风险可控 · 估时 4-5 小时。
```

---

## §1 现状盘点（gap-b 实施的 characterStates）

### §1.1 现有 CharacterSnapshot 5 字段（src/store/characterStates.ts）

```ts
export interface CharacterSnapshot {
  relations: Record<string, CharacterRelation>;  // 关系变化
  emotion?: string;                               // 情绪标签 ≤ 20 字
  abilities?: string[];                           // 能力变化 ≤ 30 字 × 5 项
  keyEvents?: string[];                           // 关键事件 ≤ 40 字 × 3 项
  summary?: string;                               // 一句话 ≤ 80 字
}
```

→ **5 字段全部是"事实层"**（"发生了什么"）。

### §1.2 缺失的"读者层"（"为什么 / 我怎么理解"）

```
读者读章节时大脑里发生的事：
  ├─ "我看到了什么"（角色的视觉 / 听觉 / 嗅觉感知）
  ├─ "我知道了什么"（角色的背景 / 历史 / 既有知识）
  ├─ "我在想什么"（疑问 / 假设 / 期待 / 担忧）
  └─ "我的关键理解"（因果 / 动机 / 关系 → 这个最重要）

→ 这 4 项当前完全没有记录
→ 直接导致：
  ├─ 章节衔接（gap-c）无法用读者层验证一致性
  ├─ 人物崩塌检测只能看"事实矛盾"· 抓不到"理解错位"
  └─ N3.1 草稿 prompt 无法注入"上一章末读者层"
```

---

## §2 方法论来源（dual-layer-archive-method.md · batch-12）

```
4 类交叉验证：
  ├─ DB ↔ DB        数值 / 状态矛盾（fili-web 已支持）
  ├─ DB ↔ Reader    事实与理解脱节（缺）
  ├─ Reader ↔ Reader 理解前后不一（缺）
  └─ Reader ↔ New   人物崩塌（最严重 · 缺）

→ 当前 fili-web 只能做第 1 类
→ v5 epic 加 readerLayer 后 · 4 类全可做
```

---

## §3 红线冲突分析

### §3.1 红线全清单（fili-web 截至当前）

| 红线 | 来源 | 内容 | v5 是否触发 |
|---|---|---|:---:|
| **gap-b R1** | gap-b PRD | 不动 v1-v4 Dexie schema | ⚠ 需 v6 |
| **gap-b R2** | gap-b PRD | 不动 N1.2 / N3.2 prompt 文件 | ✅ 不触发 |
| gap-b R3 | gap-b PRD | 不动现有 zustand persist | ✅ 不触发 |
| gap-b R4 | gap-b PRD | 不动 consistencyCheck.ts | ✅ 不触发 |
| **gap-c R1** | gap-c PRD | 不动 N1.x / N2.x / **N3.x prompt JSON** | 🔴 **触发** |
| gap-c R2 | gap-c PRD | 不动 ScoreCard 7 维定义 | ✅ 不触发 |
| gap-c R3 | gap-c PRD | 不动 db.ts v1-v4 | ✅ 已被 R1 覆盖 |
| gap-d R1 | gap-d PRD | 不动 useKb 现有 API | ✅ 不触发 |
| gap-d R2 | gap-d PRD | 不动 user-kb persist 格式 | ✅ 不触发 |
| gap-d R3 | gap-d PRD | 不动 method modules manifest 格式 | ✅ 不触发 |

### §3.2 唯一触发的红线 · gap-c R1 详细分析

```
原文：「不动 N1.x / N2.x / N3.x prompt JSON」

触发原因：
  v5 需要修改 docs/prompts/novel-3.3-character-state-extract.md
  → 同步生成 public/prompts/novel/3.3.json
  → 这是 N3.3（属于 N3.x）

为什么 gap-c R1 会写"N3.x"？
  → 当时 gap-c 的 epic 关注 章节衔接（N3.x 作为下游消费）
  → 怕 gap-c 自己改 N3.x 引发回归
  → 但 N3.3 实际是 gap-b 引入的 prompt（不是 gap-c 引入的）
  → gap-c R1 对 N3.3 的保护是"防御性过广"

豁免方案：
  v5 PRD 显式声明：
    「gap-c R1 对 N3.3 的保护被 v5 epic 豁免。
     豁免范围：仅 N3.3 prompt（本就由 gap-b 引入）。
     仍保护：N3.1 / N3.2 prompt JSON（gap-c 真正关心的）。」

豁免合法性：
  ✅ N3.3 是 gap-b 引入的 · 与 gap-c 无关
  ✅ 仅扩展 N3.3 输出 schema · 不破坏现有结构
  ✅ N3.1 / N3.2 仍受保护 · gap-c 实际关心的部分无影响
  ✅ ScoreCard 7 维不动 · gap-c R2 不触发
```

### §3.3 Dexie schema 影响 · 需 v6 add-only

```
现状 db.ts 已经 v5（gap-b 引入）：
  v5 加了 characterStates 表

v5 epic 需要 v6：
  迁移：characterStates 表的 row 加可选字段（snapshot.readerLayer）
  策略：add-only · 不删现有字段 · 旧 row snapshot 没有 readerLayer 时按 undefined 处理
  实现：Dexie schema 不变（snapshot 是 JSON · readerLayer 是 snapshot 内嵌字段）
       严格说：不需要 db.ts 升级 v6 · 因为 snapshot 是 inline JSON
       但建议：标注为 v6 以便日后追溯（add-only 保持 v5 schema 不变）

→ 实际：可能不需要改 db.ts · readerLayer 是 snapshot 内嵌
→ 仅需改：CharacterSnapshot TypeScript 类型 + prompt schema
```

---

## §4 4 字段 readerLayer 设计草案

### §4.1 字段定义

```ts
/**
 * 读者层快照 · 章末某角色"读者视角"的理解状态。
 * 与事实层（relations / emotion / abilities / keyEvents / summary）互补。
 *
 * 4 子字段语义：
 * - whatISaw：本章角色感知到的（视觉 / 听觉 / 物理感受 · 0-3 项 · ≤ 50 字/项）
 * - whatIKnow：角色已知的背景知识（≤ 100 字 · 累积 · 不全量复读）
 * - whatImWondering：角色当前的疑问 / 假设 / 期待（0-3 项 · ≤ 40 字/项）
 * - keyUnderstanding：角色对因果 / 动机 / 关系的关键理解（≤ 80 字 · 最重要）
 */
export interface ReaderLayer {
  whatISaw?: string[];          // 我看到的（≤ 3 项 · ≤ 50 字/项）
  whatIKnow?: string;            // 我知道的（≤ 100 字）
  whatImWondering?: string[];    // 我在想的（≤ 3 项 · ≤ 40 字/项）
  keyUnderstanding?: string;    // 关键理解（≤ 80 字 · ★ 最重要）
}

export interface CharacterSnapshot {
  // 事实层（v3 现有 · 不变）
  relations: Record<string, CharacterRelation>;
  emotion?: string;
  abilities?: string[];
  keyEvents?: string[];
  summary?: string;

  // 读者层（v5 新增 · 可选 · 不强制）
  readerLayer?: ReaderLayer;
}
```

### §4.2 为什么是 4 字段（不是 3 / 5 / 7）

```
方法论提示 4 项（dual-layer-archive-method.md）：
  - 我看到的     · 视角层（perspective）
  - 我知道的     · 背景层（background）
  - 我在想的     · 期待层（expectation）
  - 关键理解     · 因果层（causation）

每一层抓的是不同维度：
  whatISaw       · 即时感知（章节内）
  whatIKnow      · 跨章累积（角色全部背景）
  whatImWondering · 未来导向（驱动剧情）
  keyUnderstanding · 高维总结（动机 / 关系 / 因果）

→ 缺一不可 · 多一冗余
→ 4 字段是最小完整集
```

### §4.3 与事实层的对应关系

| 事实层 | 读者层 | 关系 |
|---|---|---|
| `relations` | 部分映射 `keyUnderstanding` | 关系是事实 · 理解关系是高维 |
| `emotion` | 部分映射 `whatImWondering` | 情绪是事实 · 担忧 / 期待是高维 |
| `abilities` | 部分映射 `whatIKnow` | 能力是事实 · 角色对自己能力的认知是高维 |
| `keyEvents` | 部分映射 `whatISaw` | 事件是事实 · 角色感知到的是个人视角 |
| `summary` | — | 事实总结 · 不与读者层重叠 |

→ **不是替代** · 是**互补**。事实层抓"发生了什么" · 读者层抓"角色怎么理解"。

---

## §5 影响范围 · 文件变更清单

### §5.1 必改文件（src + prompt）

| # | 文件 | 改动 | 估行 |
|:---:|---|---|:---:|
| 1 | `src/store/characterStates.ts` | CharacterSnapshot 加 readerLayer + 类型导出 | +15 |
| 2 | `docs/prompts/novel-3.3-character-state-extract.md` | prompt schema 加 readerLayer 部分 | +35 |
| 3 | `public/prompts/novel/3.3.json` | 从 md 同步生成 | +30 |
| 4 | `src/components/character/CharacterTimelineView.tsx` | 第 6 行展示 readerLayer 摘要 | +25 |
| 5 | `src/components/CharacterBible.tsx` | 单章节详情显示 readerLayer 卡片 | +35 |

**src 净增**：~75 行
**prompt + 文档**：~65 行
**总变更**：~140 行

### §5.2 不需要改的文件

```
✅ src/pipeline/characterStates.ts
   → parseExtractionResponse 自动支持新字段（readerLayer 在 snapshot 内嵌）
   → upsertCharacterState 不变

✅ src/store/db.ts
   → snapshot 是 inline JSON · 无 schema 变化
   → 旧 row 的 snapshot 没有 readerLayer · 视为 undefined

✅ src/pipeline/consistencyCheck.ts
   → gap-b R4 红线保护 · 不动

✅ ScoreCard 7 维定义
   → gap-c R2 红线保护 · 不动

✅ 现有 N3.1 / N3.2 prompt
   → gap-b R2 + gap-c R1 红线保护 · 不动

✅ formatPreviousStatesForPrompt
   → 可选增强（注入"上一章末读者层"到 N3.1）· 但作为后续优化 · 不进 v5 epic 第一版
```

---

## §6 不变量（CK 候选）

```
I-1：readerLayer 字段为可选 · 旧 row 兼容（无 readerLayer 时 = undefined）
I-2：readerLayer 4 子字段全部可选（部分提取也合法）
I-3：keyUnderstanding ≤ 80 字（同 summary 的硬律）
I-4：whatISaw / whatImWondering 数组各 ≤ 3 项（防 token 爆炸）
I-5：CharacterSnapshot 事实层 5 字段不动（v3 兼容）
I-6：v5 不影响 N3.1 / N3.2 prompt 输出（gap-c R1 仅 N3.3 豁免）
I-7：v5 不破坏 ScoreCard / consistencyCheck / useKb（红线保护）
```

---

## §7 工作量估算 · v5 epic 完整时间预算

| 阶段 | 内容 | 估时 |
|---|---|:---:|
| **Stage 1** ✅ | 预审计（本文档）| 30 min（已完成）|
| **Stage 2** | PRD（含红线豁免 / FR / NFR / 决议）| 45 min |
| **Stage 2** | CA（架构 / Schema 草案 / 注入 hooks）| 30 min |
| **Stage 2** | CK（不变量 / Risk Register / Verify Plan）| 30 min |
| **Stage 3** | PR-1 schema + prompt（CharacterSnapshot + 3.3.md + 3.3.json · ~80 行）| 60 min |
| **Stage 3** | PR-2 UI（CharacterTimelineView + CharacterBible · ~60 行）| 60 min |
| **Stage 3** | PR-3 dogfood log + verify（vite + tsc + manual 测试用例）| 30 min |
| **TOTAL** | | **~4 小时** |

→ 比之前估的 4-5 小时偏短（因为不需要改 db.ts）

---

## §8 风险评估

### §8.1 高风险（无）

```
🔴 无
```

### §8.2 中风险

```
🟠 LLM JSON 解析容错
   → 旧 prompt 输出可能没有 readerLayer 字段
   → 新 prompt 输出可能 readerLayer 部分缺失
   → 缓解：parseExtractionResponse 已经容错（snapshot 整体可解析就 OK）
   → 缓解：readerLayer 4 子字段全部可选

🟠 Token 成本
   → readerLayer 大约 +200-300 token / 角色 / 章节
   → 缓解：whatIKnow 不全量复读（增量）· keyUnderstanding 限 80 字
   → 缓解：跑现有项目时仍可（小说 50 章 × 5 角色 × 200 token = 50K token / 全本提取）
```

### §8.3 低风险

```
🟢 UI 复杂度
   → CharacterTimelineView 第 6 行只展示摘要
   → CharacterBible 单章详情才展开
   → 不破坏现有交互

🟢 用户学习成本
   → 用户不需要"主动用读者层"
   → LLM 自动产出 · UI 自动展示 · 自动用于一致性检查
   → 用户体验：感觉 CharacterBible 突然变聪明
```

---

## §9 与 dual-layer-archive-method.md 方法论对接

```
v5 epic 落地范围（与方法论对照）：
  ✅ readerLayer 4 字段（whatISaw / whatIKnow / whatImWondering / keyUnderstanding）
  ✅ DB 层（事实）保持原样
  ✅ Reader 层加入

v5 epic 暂不落地（留 v6 / 后续）：
  ⏳ 4 类交叉验证逻辑（DB-DB / DB-Reader / Reader-Reader / Reader-New）
     → 因为 consistencyCheck.ts 是 gap-b R4 红线保护
     → 留给独立 epic（如 gap-h?）

  ⏳ 注入"上一章末读者层"到 N3.1
     → formatPreviousStatesForPrompt 增强
     → 作为 v5 PR-X 可选 · 不进第一版
```

---

## §10 决策建议

### §10.1 推荐结论 ✅ **可做 · 推荐启动**

```
✅ 价值高
   → 填补 fili-web 唯一"理解层"盲区
   → 与 gap-c 章节衔接形成"事实 + 理解"双轨
   → 为 dual-layer-archive 方法论模块兑现承诺

✅ 风险可控
   → 仅 1 红线豁免（gap-c R1 对 N3.3）
   → 红线豁免合法性强（N3.3 是 gap-b 引入的）
   → 0 高风险项

✅ 工作量合理
   → ~4 小时（含 BMAD 全套 + 3 PR + dogfood）
   → 远小于历史 epic（gap-b ~12h / gap-c ~15h / gap-d ~10h）
   → 在 1 个 session 内完成可行
```

### §10.2 启动前需要用户签字确认

```
□ 同意 gap-c R1 对 N3.3 的豁免
  → 仅 N3.3 prompt schema 可加 readerLayer
  → N3.1 / N3.2 仍受 gap-c R1 完整保护

□ 同意 readerLayer 4 字段设计
  → 或要求调整字段数 / 字段名 / 字数限制

□ 同意 v5 epic 不做交叉验证（留 gap-h）
  → 或要求 v5 一并做（工作量从 4h → 8-10h）

□ 同意 v5 epic 不改 N3.1 prompt（不注入读者层到草稿）
  → 或要求一并做（gap-c R1 保护要求 N3.1 也豁免 · 风险升级）
```

### §10.3 不推荐的情况

```
❌ 如果用户不同意 gap-c R1 豁免
   → v5 不能做（无法改 N3.3）

❌ 如果用户希望 v5 同时做 4 类交叉验证
   → 工作量 8-10h · 一个 session 太大
   → 建议拆 v5（基础）+ gap-h（交叉验证）
```

---

## §11 待用户决策

| 问题 | 选项 |
|---|---|
| 是否同意 gap-c R1 对 N3.3 豁免？ | ✅ 同意 / ❌ 不同意 |
| 是否同意 readerLayer 4 字段设计？ | ✅ 同意 / 🟡 调整（说明）/ ❌ 不同意 |
| v5 epic 是否一并做交叉验证？ | ✅ 一并（升 8-10h）/ 🟡 拆为 gap-h（推 ★）/ ❌ 不做 |
| 是否一并改 N3.1 注入读者层？ | ✅ 一并（gap-c 升豁免）/ 🟡 留后续（推 ★）/ ❌ 不做 |
| 是否启动 v5 epic（PRD 阶段）？ | ✅ 启动 / 🟡 调整后启动 / ❌ 暂不做 |

---

## §12 next steps

```
如用户决策 ✅ 启动 v5 epic（基础版 · ~4h）：

Step 2.1 · PRD 文档（45 min）
  → docs/planning/prd-v5-dual-layer-archive.md
  → 包含 §3 红线豁免 / §4 字段设计 / §5 影响范围 / §6 不变量

Step 2.2 · CA 文档（30 min）
  → docs/planning/ca-v5-dual-layer-archive.md
  → 算法约束 / Dexie schema / prompt schema / UI 草案

Step 2.3 · CK 文档（30 min）
  → docs/planning/ck-v5-dual-layer-archive.md
  → 不变量 I-1..7 / Risk Register / Verify Plan

Step 3.1 · PR-1 schema + prompt（60 min）
  → ~80 行变更
  → vite errs=0 verify

Step 3.2 · PR-2 UI（60 min）
  → ~60 行变更
  → vite errs=0 + dogfood 实测

Step 3.3 · PR-3 dogfood log + verify（30 min）
  → 更新 dogfood-log.md
  → manual 测试用例
  → 1 push（含 PRD/CA/CK + 3 PR · 共 ~140 行变更 + 600 行 docs）
```

---

**版本**：v0.1 (2026-05-07) · M3-step1 阶段 1 · v5 epic 预审计文档 · 0 代码改动 · 等待用户决策。
