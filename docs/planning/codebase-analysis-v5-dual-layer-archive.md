---
project: fili-web
epic: v5-dual-layer-archive
stage: BMAD Stage 2 · CA (Codebase Analysis)
author: QvQ + Cascade
date: 2026-05-07
status: draft · 修正 PRD §4-§6 偏差
workflow: BMAD-METHOD · post-PRD codebase audit
related:
  - prd-v5-dual-layer-archive.md（被本文档修正的对象）
  - preflight-v5-dual-layer-archive.md（v5 preflight 设计）
  - public/methods/dual-layer-archive-method.md（方法论）
---

# v5 epic · CA · Codebase Analysis

## 0. TL;DR

PRD 在 §4-§6 引用的若干**文件路径 / 字段命名 / Dexie schema 结构**与代码实际状态不符。本 CA 以代码为准（2026-05-07 audit），修正 PRD 偏差并给出 PR-1/2/3 准确的文件清单与改动行数。

**结论**：v5 epic 仍可执行，但实际改动量 ~73 行（远低于 PRD 估的 140 行 · 因为 PR-1 无需新建 fallback · 已存在）。

---

## 1. PRD 偏差修正（核心）

### 1.1 文件路径偏差

| PRD 写的路径 | 实际路径 | 状态 |
|---|---|:---:|
| `src/db/schema.ts` | `src/store/db.ts`（CineDB class · v1-v5 stores）| ❌→✅ 修正 |
| `src/pipeline/characterStateExtraction.ts` | `src/pipeline/characterStates.ts` | ❌→✅ 修正 |
| `src/components/novel/CharacterBible.tsx` | `src/components/CharacterBible.tsx` | ❌→✅ 修正 |
| `src/components/novel/CharacterTimelineView.tsx` | `src/components/character/CharacterTimelineView.tsx` | ❌→✅ 修正 |
| `src/store/characterStates.ts` | `src/store/characterStates.ts` | ✅ PRD 正确 |
| `public/prompts/novel/3.3.json` | `public/prompts/novel/3.3.json` | ✅ PRD 正确 |

### 1.2 字段命名偏差

```
PRD §4.2 写的：
  relationships: Record<string, string>      // ❌

实际代码（src/store/characterStates.ts）：
  relations: Record<string, CharacterRelation>  // ✅
  // CharacterRelation = { type: RelationType; note?: string }
  // RelationType 枚举 8 项：friend / enemy / neutral / lover / family / mentor / rival / unknown
```

→ **readerLayer 仍加在 CharacterSnapshot · 与 relations 平级**。

### 1.3 CharacterSnapshot 5 字段实际形态

```ts
// src/store/characterStates.ts:62-77
export interface CharacterSnapshot {
  relations: Record<string, CharacterRelation>;  // 必填（可空对象）
  emotion?: string;                              // 可选 ≤ 20 字
  abilities?: string[];                          // 可选 ≤ 5 项 × 30 字
  keyEvents?: string[];                          // 可选 ≤ 3 项 × 40 字
  summary?: string;                              // 可选 ≤ 80 字
}
```

→ PRD §4.2 把 emotion/relationships/abilities/keyEvents/summary 全标为必填 · 实际仅 relations 必填。
→ **修正**：v5 readerLayer 与现有字段一致 · 全部可选（schema fallback 友好）。

### 1.4 Dexie schema 修正（重大）

```
PRD §4.3 假设：
  v5 → v6 add-only · 索引不变  // ❌ 多余

实际现状（src/store/db.ts:111-128）：
  v5 已存在（gap-b PR-1 已落 stores）
  characterStates 表：++id, projectId, chapterIndex, characterName, ts, stale,
                       [projectId+chapterIndex], [projectId+characterName],
                       [projectId+chapterIndex+characterName]

readerLayer 字段：
  - 嵌套在 snapshot JSON blob 内（非顶级）
  - 不进任何索引（dexie schema 字符串完全不变）
  - 技术上 dexie 不需要 bump 版本

但 BMAD 推荐 bump v5 → v6（即使 stores 字符串完全相同）：
  ✅ 显式审视 schema（让 dexie 知道用户已确认）
  ✅ 保留未来 readerLayer 部分字段索引化的可能
  ✅ CK 红线 #1（v1-v5 stores 字符串 0 变更）严守
```

→ **修正**：v6 stores 字符串 = v5 stores 字符串（完全相同 · 仅 version 号 +1）。

### 1.5 N3.3 prompt 实际现状

```
PRD §5.2 写的 JSON Schema 字段（minLength/maxLength/required）

实际现状（public/prompts/novel/3.3.json）：
  - 仅 messages（system + user）+ temperature + max_tokens + stream
  - 无 "schema" 顶级字段
  - schema 描述全在 system content 文本里（非结构化 JSON Schema）
  - LLM 输出靠 system 文本约束 + parseExtractionResponse 容错
```

→ **修正**：v5 改动是在 system content 字符串内追加 readerLayer 4 字段说明 · 不引入 JSON Schema 结构化约束。

### 1.6 N3.3 step 实际身份

```
prompt 文件名：3.3.json
manifest step id：novel.8（不是 novel.3.3）
loadStep 调用：mf.stages.find(s.id==='novel').steps.find(s.id==='novel.8')

→ R1 红线豁免范围：仅 public/prompts/novel/3.3.json （即 novel.8 step 的 prompt）
```

---

## 2. 实际文件清单（v5 涉及）

### 2.1 改动文件（5 个）

| # | 文件路径 | 当前行数 | 改动 | 类型 |
|:---:|---|:---:|:---:|---|
| F1 | `src/store/characterStates.ts` | 209 | +6 行 | TS type add-only |
| F2 | `src/store/db.ts` | 200+ | +12 行 | Dexie v6 stores (与 v5 同) |
| F3 | `public/prompts/novel/3.3.json` | 18 | +5 行 | system 文本扩展 ★ R1 豁免 |
| F4 | `src/components/character/CharacterTimelineView.tsx` | 135 | +20 行 | UI add-only（详情区）|
| F5 | `src/components/CharacterBible.tsx` | 230 | +30 行 | UI add-only（reader viewMode 或卡片）|

**总计**：~73 行 · 远低于 PRD 估 140 行。

### 2.2 不改动文件（验证清单）

| # | 文件路径 | 状态 | 理由 |
|:---:|---|:---:|---|
| - | `src/pipeline/characterStates.ts` | ✅ 不改 | 现有 schema fallback 完整（parseExtractionResponse 容错 · upsert 接受 snapshot:null）· readerLayer 自动随 snapshot 落 row |
| - | `public/prompts/novel/3.1.json` | ✅ 不改 | gap-c R1 红线（仅 N3.3 豁免）|
| - | `public/prompts/novel/3.2.json` | ✅ 不改 | gap-c R1 红线 |
| - | `public/prompts/novel/1.x.json`/`2.x.json` | ✅ 不改 | gap-c R1 红线 |
| - | `src/pipeline/scoreCard.ts` | ✅ 不改 | gap-c R2 红线 |
| - | `src/pipeline/runner.ts` | ✅ 不改 | gap-d 红线 #4 |
| - | `src/components/character/CharacterRelationGraph.tsx` | ✅ 不改 | 与 readerLayer 无关 |
| - | `src/store/characterBible.ts` | ✅ 不改 | UI state（collapsed / viewMode 等）· 不动 |

---

## 3. 改动详情（diff 预览）

### 3.1 F1 · `src/store/characterStates.ts` (+6 行)

**插入位置**：`CharacterSnapshot` interface 之前（约 L62）

```ts
/**
 * v6 readerLayer · 双层存档 · 读者视角认知摘要。
 * 与事实层（relations / emotion / abilities / keyEvents / summary）平级。
 * 全部可选（旧 row + LLM 漏返回时 undefined）。
 */
export interface ReaderLayerSnapshot {
  /** 读者本章字面看到的客观信息 · 50-150 字 · 不含推理 */
  whatISaw?: string;
  /** 读者已知 + 历史累积推理 · 50-150 字 */
  whatIKnow?: string;
  /** 读者还不知 / 在猜 / 在悬念 · 50-150 字 */
  whatImWondering?: string;
  /** 角色在读者认知里的核心理解 · 一句话 50-100 字 */
  keyUnderstanding?: string;
}
```

**修改位置**：`CharacterSnapshot` interface 内（L77 之前）

```ts
export interface CharacterSnapshot {
  relations: Record<string, CharacterRelation>;
  emotion?: string;
  abilities?: string[];
  keyEvents?: string[];
  summary?: string;
  /** ★ v6 新增 · 双层存档读者层。可选（旧 row 兼容）。 */
  readerLayer?: ReaderLayerSnapshot;
}
```

→ **add-only · 完全不破坏现有 row 类型**。

### 3.2 F2 · `src/store/db.ts` (+12 行)

**插入位置**：v5 stores 块之后（约 L128）

```ts
// v6: epic v5 · 双层存档（dual-layer-archive）
// CharacterSnapshot 加 readerLayer? 嵌套字段（非索引），dexie stores 字符串与 v5 完全一致。
// 仅 bump 版本号让 dexie 显式审视 schema · CK 红线 #1（v1-v5 stores 0 变更）严守。
this.version(6).stores({
  projects: '++id, name, createdAt, status',
  artifacts: '++id, projectId, nodeId, ts, [projectId+nodeId]',
  liveArtifacts: '&nodeId, stageId, ts',
  runHistory: '++id, nodeId, ts, projectId, [projectId+nodeId], [nodeId+ts]',
  userKbDocs: '++id, type, enabled, createdAt, [type+enabled]',
  userKbFeedback: '++id, projectId, chapterIndex, createdAt, [projectId+chapterIndex]',
  liveRefinementUndo: '++id, ts, [chapterIndex+source]',
  characterStates: '++id, projectId, chapterIndex, characterName, ts, stale, [projectId+chapterIndex], [projectId+characterName], [projectId+chapterIndex+characterName]',
});
```

→ **v5 stores 字符串复制粘贴 · 0 索引变更**。

### 3.3 F3 · `public/prompts/novel/3.3.json` (+5 行) ★ R1 豁免

**修改位置**：`messages[0].content`（system）末尾，在"## 行为约束"段之前或之内追加：

```text
## v6 双层存档 · 读者层 4 字段（可选输出）
除事实层（snapshot 5 字段）外，可同时输出"读者层"摘要 readerLayer：
- whatISaw：读者本章字面看到的客观信息（50-150 字 · 不含推理）
- whatIKnow：读者已知 + 历史累积推理（50-150 字）
- whatImWondering：读者还不知 / 在猜 / 在悬念（50-150 字）
- keyUnderstanding：核心理解（一句话 50-100 字）
读者层全部可选；LLM 不输出时 row 仅含事实层。
```

**改动后输出 schema 示例**：

```jsonc
[
  {
    "characterName": "...",
    "snapshot": {
      "relations": { /* ... */ },
      "emotion": "...",
      "abilities": [/* ... */],
      "keyEvents": [/* ... */],
      "summary": "...",
      "readerLayer": {                           // ★ v6 新增
        "whatISaw": "...",
        "whatIKnow": "...",
        "whatImWondering": "...",
        "keyUnderstanding": "..."
      }
    }
  }
]
```

→ **gap-c R1 红线豁免范围：仅本文件**。

### 3.4 F4 · `CharacterTimelineView.tsx` (+20 行) UI add-only

**当前现状**：SVG 网格 · 5 行（关系 / 情绪 / 能力 / 事件 / 一句话）· 不适合直接加 readerLayer 第 6 行（视觉过密）。

**修正方案**：在 SVG 下方追加一个 conditional 详情区（仅 selectedChapterIndex 非空时显示）。

**插入位置**：返回的 JSX `<div className="overflow-x-auto">` 之后（L132 之前）

```tsx
{selectedChapterIndex && recByChapter.get(selectedChapterIndex)?.snapshot?.readerLayer && (
  <div className="mt-2 px-3 py-2 rounded bg-violet-500/5 border border-violet-500/20 text-xs">
    <div className="font-medium text-violet-700 mb-1">读者层 · 第 {selectedChapterIndex} 章</div>
    <div className="space-y-1 text-fg-muted">
      {recByChapter.get(selectedChapterIndex)!.snapshot!.readerLayer!.whatIKnow && (
        <div><span className="text-violet-600">已知：</span>{recByChapter.get(selectedChapterIndex)!.snapshot!.readerLayer!.whatIKnow}</div>
      )}
      {recByChapter.get(selectedChapterIndex)!.snapshot!.readerLayer!.whatImWondering && (
        <div><span className="text-violet-600">在猜：</span>{recByChapter.get(selectedChapterIndex)!.snapshot!.readerLayer!.whatImWondering}</div>
      )}
    </div>
  </div>
)}
{selectedChapterIndex && recByChapter.get(selectedChapterIndex)?.snapshot && !recByChapter.get(selectedChapterIndex)?.snapshot?.readerLayer && (
  <div className="mt-2 px-3 py-1 text-xs italic text-fg-muted">
    第 {selectedChapterIndex} 章无读者层数据 · 重跑 N3.3 可补全
  </div>
)}
```

→ **不破坏现有 SVG 网格视觉风格 · gap-b PR-3 红线 R5 严守**。

### 3.5 F5 · `CharacterBible.tsx` (+30 行) UI add-only

**当前现状**：viewMode = 'timeline' | 'relations' · 两个 tab。

**修正方案 A**：加第 3 个 tab `'reader'`（推荐）· 单独面板显示当前选中角色全部章节的 readerLayer 综合视图。

**修正方案 B**：保持 2 tab · 在 timeline 下方追加"全章 readerLayer 摘要"卡片（更紧凑）。

**推荐 A 的理由**：
- viewMode 已有 reducer 模式（characterBible store · setViewMode）· 加 'reader' 一致性高
- 用户可显式切换 · 不污染 timeline 视图
- 与 gap-g（CharacterBible 体验升级）正交 · 不冲突

**插入位置 1**：`viewMode` 类型扩展（在 `src/store/characterBible.ts` · 但不动 store · 直接在 props 处用 string 联合）

→ **如不改 store**：保持 viewMode 字符串放宽 · 用 type assertion 接收新值。
→ **保险起见 PR-2 同时小改 store**（视情况）。

**插入位置 2**：tabs 列表（约 L195）追加：

```tsx
<button
  type="button"
  role="tab"
  aria-selected={viewMode === 'reader'}
  onClick={() => setViewMode('reader' as 'timeline' | 'relations')}
  className={clsx(
    'text-xs px-2 py-1 rounded',
    viewMode === 'reader' ? 'bg-violet-500 text-white' : 'bg-surface-2 hover:bg-surface-3',
  )}
>
  读者层
</button>
```

**插入位置 3**：view body 三元式（约 L210）扩展为多分支：

```tsx
{!selectedCharacter ? (
  /* 现有空态 */
) : viewMode === 'timeline' ? (
  /* 现有 timeline 视图 */
) : viewMode === 'relations' ? (
  /* 现有 relations 视图 */
) : (
  // ★ v6 新增 · reader 视图
  <div className="space-y-2 px-3 py-2">
    {timeline.length === 0 ? (
      <div className="text-sm text-gray-500 text-center py-4">尚无章节状态</div>
    ) : (
      timeline.map((rec) => (
        <div key={`reader-${rec.chapterIndex}`} className="rounded border border-border-subtle px-3 py-2">
          <div className="text-xs font-medium mb-1">第 {rec.chapterIndex} 章 · {rec.characterName}</div>
          {rec.snapshot?.readerLayer ? (
            <div className="text-xs space-y-1 text-fg-muted">
              {rec.snapshot.readerLayer.whatISaw && <div><span className="text-violet-600">看到：</span>{rec.snapshot.readerLayer.whatISaw}</div>}
              {rec.snapshot.readerLayer.whatIKnow && <div><span className="text-violet-600">已知：</span>{rec.snapshot.readerLayer.whatIKnow}</div>}
              {rec.snapshot.readerLayer.whatImWondering && <div><span className="text-violet-600">在猜：</span>{rec.snapshot.readerLayer.whatImWondering}</div>}
              {rec.snapshot.readerLayer.keyUnderstanding && <div><span className="text-violet-600">核心：</span>{rec.snapshot.readerLayer.keyUnderstanding}</div>}
            </div>
          ) : (
            <div className="text-xs italic text-fg-muted">无读者层数据 · 重跑 N3.3 可补全</div>
          )}
        </div>
      ))
    )}
  </div>
)}
```

→ **add-only · 不破坏 timeline / relations 视图**。

---

## 4. 红线审计

### 4.1 全 6 条红线对 v5 epic 的影响

| # | 红线 | v5 状态 | 详证 |
|:---:|---|:---:|---|
| R1 | 不改 `public/prompts/novel/*.json` | 🟡 豁免 N3.3 | F3 仅改 system content · 用户已签字（preflight） |
| R2 | 不改 ScoreCard 维度 | ✅ 不影响 | 0 改动到 `src/pipeline/scoreCard.ts` |
| R3 | Dexie schema add-only · 不改 v1-v5 stores | ✅ 完全遵守 | F2 仅 bump v6 · stores 字符串与 v5 完全相同 |
| R4 | 不改 `pipeline/runner.ts` | ✅ 不影响 | 0 改动到 runner |
| R5 | gap-b CharacterTimelineView 视觉风格 | ✅ 不影响 | F4 在 SVG 下方追加 conditional 详情区 · 不动 SVG 网格 |
| R6 | 不删 / 不弱化既有 tests | ✅ 不影响 | 0 测试修改（v5 全 add-only） |

### 4.2 R1 豁免详细审计

```
范围：仅 public/prompts/novel/3.3.json
改动维度：仅 messages[0].content（system 文本扩展 · ~5 行）
不改动：
  □ messages[1].content（user）
  □ temperature: 0.3
  □ max_tokens: 2000
  □ stream: true
  □ 任何其它顶级字段

签字记录：preflight-v5-dual-layer-archive.md §11 · 用户 M3-step1 阶段 1 已确认。

未来扩展边界：
  □ N3.1 / N3.2 / N1.x 仍受 R1 完全保护（未来想动需新签字）
  □ 仅本 epic（v5）+ 仅本文件 · 不可援引到其它 epic
```

---

## 5. 不变量候选（CK 来源）

以下不变量将出现在 CK 文档（code-knowledge-v5-dual-layer-archive.md）：

```
I-1 · readerLayer 字段全部可选（CharacterSnapshot.readerLayer? · ReaderLayerSnapshot 内部字段全可选）
       理由：旧 row + LLM 漏返回 + schema fallback · undefined 容忍

I-2 · readerLayer 不进 dexie 索引（嵌套在 snapshot JSON）
       理由：避免 schema 复杂化 · readerLayer 只用于显示 / 不用于查询

I-3 · v6 stores 字符串 = v5 stores 字符串（仅版本号变化）
       理由：CK 红线 #1（v1-v5 stores 0 变更）严守 · v6 也跟随

I-4 · F4 / F5 不破坏 gap-b 现有视图（timeline 网格 / relations 图）
       理由：gap-b PR-3 红线 R5（CharacterTimelineView 视觉风格保持）

I-5 · pipeline/characterStates.ts 不改
       理由：现有 schema fallback（parseExtractionResponse + upsert snapshot:null）已足够容错 readerLayer

I-6 · gap-c R1 豁免范围严格限制：仅 public/prompts/novel/3.3.json + 仅 system content
       理由：preflight 签字范围 · 不可扩大解释
```

---

## 6. PR 拆分细化（修正 PRD §9）

### 6.1 PR-1 · schema + prompt 升级（核心）

```
范围：3 文件 · ~23 行
  ├─ F1 src/store/characterStates.ts                +6 行
  ├─ F2 src/store/db.ts                             +12 行
  └─ F3 public/prompts/novel/3.3.json              +5 行 ★ R1 豁免

总计：~23 行（PRD 估 36 行 · 实际更少）
验证：
  □ vite build errs=0
  □ pnpm tsc 类型检查通过（CharacterSnapshot 加可选字段 · 现有调用兼容）
  □ dexie 旧 row（v5）可读 · 无 upgrade error
  □ N3.3 实跑一次 · 验证 LLM 输出可含 readerLayer（不强求一定输出）
commit: feat(v5): PR-1 dual-layer-archive schema + N3.3 prompt upgrade (gap-c R1 exempt: novel/3.3.json system only)
```

### 6.2 PR-2 · UI 展示

```
范围：2 文件 · ~50 行
  ├─ F4 src/components/character/CharacterTimelineView.tsx  +20 行
  └─ F5 src/components/CharacterBible.tsx                   +30 行

总计：~50 行（PRD 估 60 行）
验证：
  □ vite build errs=0
  □ UI 渲染正确（手动测试 timeline / reader / relations 三视图切换）
  □ 旧 row（无 readerLayer）显示 italic 提示
  □ 新 row（有 readerLayer）显示 4 字段
  □ aria 标签 / role 一致性（reader tab 与现有 tab 同结构）
commit: feat(v5): PR-2 dual-layer UI (TimelineView reader-layer detail panel + CharacterBible reader viewMode)
```

### 6.3 PR-3 · dogfood 验收 + 文档

```
范围：1-2 docs · ~50 行
  ├─ docs/dogfood-log.md            +30-50 行  (v5 实测记录)
  └─ docs/notes/                     可选修订（如有发现）

总计：~50 行 docs
验证：见 §7
commit: docs(v5): PR-3 dogfood verification + completion log
```

---

## 7. 风险更新（vs PRD §11）

### 7.1 PRD R-M2（dexie 旧 row v6 报错）→ 实际风险归零

```
PRD 担心：v5 → v6 schema 升级有 upgrade error 风险

实际审计：
  □ stores 字符串 v6 = v5（完全相同）
  □ readerLayer 嵌套在 snapshot JSON · 不进索引
  □ dexie 不需 upgrade fn
  □ 旧 row 完全兼容（snapshot.readerLayer = undefined · TS 已可选）

→ 风险等级：P → 0（消除）
```

### 7.2 PRD R-M4（tokens 增加 > 30%）→ 风险下调

```
PRD 担心：N3.3 prompt 升级 + 输出 readerLayer 4 字段 · tokens 翻倍

实际审计：
  □ N3.3 当前 prompt 大小 ~1500 tokens
  □ system 文本 +5 行 ~80 tokens（5%）
  □ 输出额外 readerLayer 4 × ~100 字 ≈ 400 tokens 增加
  □ max_tokens 当前 2000 · 仍在范围内

→ 实际增长 ~25-30%（在 PRD NFR-1 上限内）· 风险等级：M → L
```

### 7.3 新风险（CA 新增）

| ID | 风险 | 概率 | 影响 | 缓解 |
|:---:|---|:---:|:---:|---|
| R-M5 | F5 加新 viewMode 'reader' 但 store 类型未扩 · TS 报错 | 中 | 低 | type assertion + PR-2 选项加小改 store（or 仅在 props 层面接受字符串）|
| R-M6 | F4 SVG 下方加 conditional 区导致布局抖动（selectedChapterIndex 切换时）| 低 | 低 | 用 min-height 占位 + transition 平滑 |
| R-L3 | LLM 输出 readerLayer 时违反 50-150 字限制 | 中 | 低 | system 文本强调 · UI 显示时 truncate 即可 |

---

## 8. 验证计划

### 8.1 PR-1 验收

```
□ pnpm tsc 通过
□ pnpm build 通过 · errs=0
□ 启动 dev · 项目从 v5 自动迁移到 v6（dexie console 无 error）
□ 跑一次 N3.3 · 看 LLM 输出（用 console.log 抓 raw response · 验证是否含 readerLayer）
□ 落 row 后 dexie 表查询正常
```

### 8.2 PR-2 验收

```
□ pnpm build 通过 · errs=0
□ CharacterBible 默认显示 timeline 视图（与 gap-b 一致）
□ 切到 'reader' tab 显示新视图
□ 旧 row 显示 italic 提示
□ 新 row 显示 4 字段
□ TimelineView SVG 网格视觉与 gap-b 一致（R5 验证）
```

### 8.3 PR-3 dogfood 验收

```
□ QvQ 实跑 N3.3 一次（≥ 5 章项目）
□ 至少 1 章 readerLayer 4 字段都有内容
□ 至少 1 章 readerLayer 缺字段（验证 fallback）
□ 至少 1 旧 row（v5）显示 italic 提示
□ 主观评估：v5 实施后写下一章对"读者已知 / 在猜"的把握更准
```

---

## 9. CA 自检

```
□ §1 PRD 偏差全部修正（路径 / 字段 / schema / prompt 结构）
□ §2 实际文件清单准确（5 改 + 8 不改）
□ §3 每个 F 文件的 diff 预览可执行
□ §4 红线审计含 R1 豁免详证
□ §5 不变量候选 6 条（CK 来源）
□ §6 PR-1/2/3 行数细化（与 PRD §9 对齐）
□ §7 风险更新（R-M2 消除 / R-M4 下调 / R-M5/6/L3 新增）
□ §8 验证计划三段（PR-1/2/3）
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v5 epic 的 BMAD Stage 2 CA · 修正 PRD §4-§6 偏差并给出准确文件清单。
**下游**：CK（code-knowledge-v5-dual-layer-archive.md）+ PR-1/2/3 实施。
