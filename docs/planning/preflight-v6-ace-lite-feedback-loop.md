---
project: fili-web
epic: v6-ace-lite-feedback-loop
stage: BMAD Stage 0 · preflight only (PRD/CA/CK pending user signoff)
author: QvQ + Cascade
date: 2026-05-07
audience: 自己（QvQ）+ AI 协作者（Cascade）
status: draft · 待用户签字 5 决策点后启动 Stage 2
workflow: BMAD-METHOD · QQ pre-PRD audit
related:
  - public/methods/agentic-context-engineering.md（batch-15 ACE 方法论）
  - public/methods/dual-layer-archive-method.md（batch-12 信号源）
  - public/methods/self-evolving-auditor-method.md（应用层方法论）
  - prd-v5-dual-layer-archive.md（v5 已完成 · 提供 readerLayer 数据）
  - src/pipeline/scoreCard.ts（信号源）
  - src/pipeline/consistencyCheck.ts（信号源）
  - src/pipeline/characterStates.ts（信号源）
  - docs/dogfood-log.md（Reflector lesson 暂存目标）
---

# Preflight · v6 epic · ACE-lite 反馈闭环

## §0 一句话摘要

让 fili-web 的"自动失败信号"（ScoreCard 低分 / consistencyCheck 硬伤 / 用户 dogfood 反馈）**不再止步于"显示给用户"**，而是触发**Reflector LLM step** 提炼"具体改进 lesson" → 写入 `docs/dogfood-log.md` 待审阅区 → 用户人工 commit 后追加到对应 method module 的"pitfalls"段。这是 ACE 三角色（Generator / Reflector / Curator）中最浅的"Reflector + 人工 Curator"路径。

预计：~10 小时 / 2 epic / src 增量 ≤ 250 行 / 0 prompt JSON 修改 / 1 新 LLM step（novel.9 = Reflector）/ 0 红线豁免（用户审阅环节守住所有红线）。

---

## §1 现状盘点

### §1.1 fili-web 已有的"自动失败信号"

| 信号源 | 文件路径 | 触发机制 | 当前去向 |
|---|---|---|---|
| ScoreCard 7 维分数 | `src/pipeline/scoreCard.ts` | N3.1/N3.2 章节后 | UI 显示 · 不写回 |
| consistencyCheck 硬伤 | `src/pipeline/consistencyCheck.ts` | 章节后扫描 | UI 显示 · 不写回 |
| characterStates 提取失败 | `src/pipeline/characterStates.ts` | snapshot=null | UI 红徽 · 不写回 |
| readerLayer 缺失 | v5 schema | optional undefined | UI italic 提示 · 不写回 |
| 用户 dogfood 主观反馈 | `docs/dogfood-log.md` | 用户手写 | 已记录 · 但不影响 prompt |

### §1.2 缺失的"Reflector 角色"

```
ACE 三角色：
  Generator  ✅ 100%（N3.1/N3.2/N3.3）
  Reflector  ❌  0%（信号 → 显示 → 静默 · 无提炼）
  Curator    ❌  0%（无回写机制）

→ 失败信号被 UI 消化 · 但 LLM 下次写章节时还会犯同样的错
→ 用户每次手写 dogfood-log lesson · 但 lesson 不进入下次 prompt
→ 整个 fili-web 没有"从失败学习"的回路
```

### §1.3 v5 epic 已铺路的部分

```
v5 epic（双层存档）已落地：
  ✅ readerLayer 4 字段（提供"读者认知"信号）
  ✅ characterStates 累积每章状态
  ✅ schema fallback 友好（v6 epic 不会破坏 v5）

→ v6 epic 复用 v5 数据：
   - readerLayer 变化是 Reflector 的关键信号源
   - 例：第 5 章 whatImWondering = "X 的身世" · 第 8 章已揭晓但 readerLayer 仍写"在猜 X 身世"
     → Reflector 检测到伏笔失效 · 提炼为 "本项目伏笔节奏偏慢" lesson
```

---

## §2 方法论来源（ACE 论文 · batch-15）

### §2.1 ACE 三角色（详 `public/methods/agentic-context-engineering.md`）

```
Generator  →  Reflector  →  Curator
   写章节        反思失败      整理写回

ACE 论文实证：
  - AppWorld agent benchmark：+12.3% over ICL · +14.8% (无 ground-truth)
  - financial benchmark：+10.9% offline · +6.2% online
  - 关键：依赖可靠 feedback signal
```

### §2.2 v6 epic 选 ACE 浅集成（layer 1）的理由

```
ACE 3 层路径（来自 method module §"改造 3 层路径"）：
  🟢 layer 1 浅集成（人工 Curator）   ~10h   红线 0    ← v6 epic 选择
  🟡 layer 2 v5 schema 升级 bullet     ~5h   红线 0    （未来 v7）
  🔴 layer 3 完整 Curator 自动化       ~25h  红线 多   （未来 v8/v9）

为什么浅集成先：
  ✅ 验证 Reflector lesson 质量（≥ 1 月 review pass rate > 70%）
  ✅ 用户保留 Curator 决策权（人工 commit · 不自动）
  ✅ 改动面小 · 不破红线
  ✅ 失败可立即回退（仅一个新 LLM step）
```

---

## §3 红线冲突分析

### §3.1 红线全清单（截至当前 · v5 epic 完成后）

| # | 红线 | 来源 | v6 状态 |
|:---:|---|---|:---:|
| R1 | 不改 `public/prompts/novel/*.json` | gap-c P1 | ✅ **不触碰**（仅新建 novel.9 prompt · 不改现有 N3.x）|
| R2 | 不改 ScoreCard 维度 | gap-c | ✅ 不影响（仅读取分数 · 不加新维度）|
| R3 | Dexie schema add-only · 不改字段 | dexie 兼容 | ✅ 完全遵守（仅加 reflectorLessons 表）|
| R4 | 不改 `pipeline/runner.ts` 流水线核心 | gap-d | ✅ 不影响（runStep 已支持新 step）|
| R5 | gap-b CharacterTimelineView 视觉风格 | gap-b PR-3 | ✅ 不影响（仅 CharacterBible 新 tab 或 dogfood UI）|
| R6 | 不删 / 不弱化既有 tests | testing | ✅ 不影响 |
| R7 | v5 readerLayer 字段全可选（CK I-1）| v5 epic | ✅ 严守（只读 readerLayer · 不改字段约束）|
| R8 | v5 v6 stores 字符串 = v5（CK I-3）| v5 epic | ✅ 严守（v6 epic 只 bump 一档 v7 · stores 字符串与 v6 等同）|

### §3.2 v6 epic 不需要红线豁免

```
对比 v5 epic 触发 gap-c R1（豁免 N3.3）：
  v6 epic ✅ 0 红线豁免
  
原因：
  1. novel.9（Reflector）是新 prompt · 不改现有 N3.1/N3.2/N3.3
  2. ScoreCard 不加新维度（CK 红线 R2 不触碰）
  3. 写回 method modules 是用户手动 commit · 不自动改 prompt
  4. dogfood-log.md 是 docs · 不在红线范围内

→ v6 epic 是"红线友好"的纯加法 epic
```

### §3.3 Dexie schema v6 → v7 add-only

```
新增表 reflectorLessons（add-only · 不改 v1-v6 表）：
  reflectorLessons: '++id, projectId, chapterIndex, signalType, status, ts,
                     [projectId+status], [projectId+chapterIndex]'

字段：
  - id: 自增主键
  - projectId: 项目隔离
  - chapterIndex: 关联章节
  - signalType: 'scoreCard' | 'consistencyCheck' | 'readerLayer' | 'userFeedback'
  - lessonContent: string（Reflector LLM 提炼的 lesson · ≤ 300 字）
  - suggestedModule: string | null（建议写入哪个 method module）
  - status: 'pending' | 'approved' | 'rejected' | 'committed'
  - ts: 时间戳

CK 红线 R3 / R8 严守：v1-v6 stores 字符串 0 变更 · v7 仅追加新表。
```

---

## §4 设计草案 · 4 个核心组件

### §4.1 组件 1 · Reflector LLM step（novel.9）

```
trigger（Generator 端）：
  N3.2 章节润色完成后 → 自动检查信号阈值：
    - ScoreCard 任一维度 < 6 分 → trigger
    - consistencyCheck 输出非空 → trigger
    - readerLayer.whatImWondering 跨 5 章不变 → trigger
    - 用户在 dogfood-log 标记本章为"差" → trigger

prompt 设计（novel.9 = `public/prompts/novel/9.json` · 新建）：
  system: "你是叙事流水线的 Reflector 角色。
           接收：本章正文 + 失败信号 + 历史 method modules 配置。
           任务：用 100-300 字提炼 1 条具体 lesson（不是泛泛建议）。
           lesson 必须含：
             1. 本章哪个具体段落 / 角色 / 情节出问题
             2. 失败原因（基于信号 + 文本分析）
             3. 改进 hint（下一章如何避免）
             4. 建议写入哪个 method module（从 manifest 选）"

  user: "本章正文：{{ chapterContent | truncate:3000 }}
         失败信号：{{ failureSignals | json }}
         当前 method modules：{{ activeModuleIds | join:',' }}
         请输出 lesson JSON：
         {
           \"lessonContent\": \"...\",
           \"suggestedModule\": \"<module-id>\"
         }"

输出：
  → upsert 到 reflectorLessons 表 · status='pending'
```

### §4.2 组件 2 · ReflectorLessonsPanel UI

```
位置：CharacterBible 旁边新增独立面板（默认折叠）

视觉：
  ├─ Header: "Reflector 待审阅 lessons (N pending)"
  ├─ 列表：每条 lesson 一行
  │     ├─ 第 X 章 · 信号类型 · 时间
  │     ├─ lesson content（≤ 100 字预览 · 点开详情）
  │     ├─ 建议写入：<method-module-id>
  │     └─ Actions: [审阅] [批准] [驳回]
  └─ 批量操作：[全选 approve] [全选 reject]

交互：
  - "批准" → status='approved' · 仍不自动写入 module
  - "审阅" → 打开详情 modal · 用户编辑 lesson 文字
  - "驳回" → status='rejected' · 不再触发
  - "提交到 method module" → 用户手动 git diff + commit
                                Cascade / 用户手动改 module 文件
                                改完后点 "标记已 commit"
                                → status='committed'
```

### §4.3 组件 3 · 信号阈值守卫

```
位置：src/store/settings.ts · 加 reflectorThresholds 字段

类型：
  reflectorThresholds: {
    enabled: boolean;                    // 总开关
    scoreCardMin: number;                // 默认 6（< 6 触发）
    consistencyCheckTriggerOnAny: boolean; // 默认 true
    readerLayerStaleChapterCount: number; // 默认 5（whatImWondering 5 章不变触发）
    userFeedbackEnabled: boolean;        // dogfood UI 标记触发
  }

默认禁用（v6 epic 落地后用户自己开启）：
  enabled: false

→ R7 守住：reader 层不强制
→ R6 不影响：现有 tests 不需要改
```

### §4.4 组件 4 · dogfood-log.md "Reflector lessons" 子区

```
docs/dogfood-log.md 顶部加一节（按倒序追加约定）：

## v6 epic · ACE-lite Reflector lessons（N pending）

### 待审阅
- 第 5 章 · scoreCard < 6 · 2026-05-XX
  > lesson 内容...
  > 建议写入：anti-ai-flavor-rules
  > [pending]

### 已批准（待写入 method module）
- 第 8 章 · readerLayer stale · 2026-05-XX
  > lesson 内容...
  > 建议写入：dual-layer-archive
  > [approved]

### 已 commit
- 第 3 章 · consistencyCheck · 2026-05-XX
  > lesson 内容...
  > 已写入：anti-ai-flavor-rules:L120-130
  > [committed]
```

---

## §5 影响范围 · 文件变更清单

### §5.1 必改 / 必新建文件

| # | 文件 | 类型 | 行数估 | 阶段 |
|:---:|---|:---:|:---:|---|
| F1 | `public/prompts/novel/9.json` | NEW prompt | ~30 | PR-1 |
| F2 | `src/pipeline/reflector.ts` | NEW pipeline | ~80 | PR-1 |
| F3 | `src/store/reflectorLessons.ts` | NEW store | ~70 | PR-1 |
| F4 | `src/store/db.ts` | MOD | +13 (v7 stores) | PR-1 |
| F5 | `src/store/settings.ts` | MOD | +8 (reflectorThresholds) | PR-1 |
| F6 | `public/prompts/manifest.json` | MOD | +5 (注册 novel.9) | PR-1 |
| F7 | `src/pipeline/novelLoop.ts` | MOD | +15 (trigger reflector) | PR-1 |
| F8 | `src/components/ReflectorLessonsPanel.tsx` | NEW UI | ~120 | PR-2 |
| F9 | `src/components/Novel.tsx` | MOD | +5 (mount panel) | PR-2 |
| F10 | `docs/dogfood-log.md` | MOD | +50 (epic record) | PR-3 |
| F11 | `.gitignore` | MOD | +1 (允许 novel/9.json) | PR-1 |

**总计**：~390 行（含 docs · 不含 PR-3 dogfood log）。
代码增量：~250 行（PR-1 ~150 + PR-2 ~125）。

### §5.2 不需要改的文件

| 文件 | 不改理由 |
|---|---|
| 现有 N3.1 / N3.2 / N3.3 prompt | gap-c R1 不豁免（v6 epic 不破红线）|
| `src/pipeline/scoreCard.ts` | gap-c R2 不豁免 · 仅读取 |
| `src/pipeline/consistencyCheck.ts` | 仅读取 · 不改 |
| `src/pipeline/runner.ts` | gap-d 红线 · runStep 已通用 |
| `src/components/character/CharacterTimelineView.tsx` | gap-b PR-3 R5 严守 |
| 现有 method modules（74 个） | 用户手动 commit · v6 epic 不自动改 |
| `src/pipeline/characterStates.ts`（pipeline 层）| v5 CK I-5 严守 |

---

## §6 不变量（CK 候选）

```
I-1 · novel.9（Reflector）prompt 输出 strict JSON · 含 lessonContent + suggestedModule
       理由：reflector.ts 解析必须 deterministic

I-2 · reflectorLessons 表 add-only · v6 stores → v7 stores 字符串 = v6 stores 字符串 + 1 新表
       理由：CK 红线 R3 / R8 严守

I-3 · v6 epic 不自动写入任何 method module · 100% 用户手动 commit
       理由：保护 prompt 系统 · 防止 ACE context collapse 风险

I-4 · settings.reflectorThresholds.enabled 默认 false
       理由：v6 epic 是 opt-in · 不破坏现有用户体验

I-5 · 现有 N3.1 / N3.2 / N3.3 prompt 0 行修改
       理由：gap-c R1 不豁免（与 v5 不同）

I-6 · ReflectorLessonsPanel 是新独立面板 · 不嵌入 CharacterBible
       理由：避免与 v5 reader viewMode 冲突 · 保持各自纯净

I-7 · scoreCard.ts / consistencyCheck.ts / characterStates.ts pipeline 层 0 行修改
       理由：仅作为信号源被 reflector.ts 读取

I-8 · novel.9 prompt 仅在 v7+ schema（reflectorLessons 表存在）下加载
       理由：旧版本（v5/v6）db 不应触发新 prompt
```

---

## §7 工作量估算

```
v6 epic 总时间：~10 小时
  preflight             ~30 min（本文档）
  Stage 2 docs（PRD/CA/CK） ~120 min
  PR-1 schema + reflector pipeline ~120 min
    - 新 prompt JSON       ~15 min
    - novel.9 manifest     ~10 min
    - reflector.ts         ~45 min
    - reflectorLessons store ~25 min
    - db.ts v7             ~10 min
    - settings reflectorThresholds ~10 min
    - novelLoop trigger    ~15 min
  PR-2 UI (ReflectorLessonsPanel) ~120 min
    - 组件本身             ~75 min
    - mount + state wire   ~30 min
    - 视觉打磨             ~15 min
  PR-3 dogfood log         ~30 min
  user dogfood             ~30 min（用户跑一次实测）

总计：~10 小时（不含用户长期 dogfood 验证）
```

---

## §8 风险评估

### §8.1 高风险（无）

```
v6 epic 是"红线友好 + 用户审阅"的浅集成 · 高风险归零。
```

### §8.2 中风险

| ID | 风险 | 概率 | 影响 | 缓解 |
|:---:|---|:---:|:---:|---|
| R-M1 | Reflector LLM lesson 质量低 / 太泛 | 中 | 中 | I-1 strict JSON · prompt 强约束 100-300 字具体 hint · 用户驳回率高时升级 prompt |
| R-M2 | 信号阈值过敏 · 每章都触发 reflector · tokens 暴涨 | 中 | 中 | I-4 默认 disabled · 用户手动开 · 阈值可调 |
| R-M3 | 用户审阅疲劳 · pending lessons 积压 | 中 | 低 | UI 加 max-N 提示 · 超额自动驳回最旧 · 不强制审阅 |
| R-M4 | v7 dexie 升级触发用户数据迁移异常 | 低 | 高 | I-2 add-only · 仅追加表 · 0 字段改动 · v6 epic 完成后双向回滚测试 |

### §8.3 低风险

| ID | 风险 | 缓解 |
|:---:|---|---|
| R-L1 | Reflector 提炼的 lesson 与现有 method module 冲突 | 用户审阅时人工判断 · 驳回或编辑 |
| R-L2 | suggestedModule 字段建议错位 | 用户审阅时改 · 不强制采纳 |
| R-L3 | dogfood-log.md 增长过快 | I-3 用户主动 commit · 自然控制 |

---

## §9 与 ACE / dual-layer-archive / self-evolving-auditor 方法论对接

### §9.1 与 `agentic-context-engineering.md` 的对接

```
ACE 三角色：
  Generator  ✅ 复用 N3.1/N3.2/N3.3
  Reflector  ✅ v6 PR-1 实现（novel.9 LLM step）
  Curator    🟡 v6 PR-2 实现（人工 UI · 非自动）

ACE 三创新：
  Reflector 分离        ✅ 已分离到独立 step
  Incremental delta     ✅ 每条 lesson 是一个 delta
  Grow-and-refine       🟡 部分（用户审阅时去重 / 弃用）

→ v6 epic = ACE layer 1 浅集成 · 验证后再决定是否升级 layer 2/3
```

### §9.2 与 `dual-layer-archive-method.md` 的对接

```
dual-layer-archive 提供 4 类信号：
  DB→DB        consistencyCheck（数据矛盾）
  DB→Reader    readerLayer 与事实层对照（脱节）
  Reader→Reader  readerLayer 跨章变化（理解前后不一）
  Reader→New   未来章节读者预期（人物崩塌）

→ v6 reflector 全部利用这 4 类信号
→ v5 epic 已落地 readerLayer · v6 是天然下游
```

### §9.3 与 `self-evolving-auditor-method.md` 的对接

```
self-evolving-auditor 是产品功能层方法论
ACE / v6 是引擎层方法论

self-evolving-auditor 说"审核员越用越懂"
v6 epic 实现"越用越懂"的具体机制（Reflector + 用户审阅 Curator）
```

---

## §10 决策建议

### §10.1 推荐结论 ✅ **可做 · 推荐启动**

```
v6 epic 价值：
  ✅ 让 fili-web 自我进化能力 2/5 → 4/5（method module §与 fili-web 的对接）
  ✅ 利用已有信号（ScoreCard / consistencyCheck / readerLayer）· 不重造
  ✅ 与 v5 epic 完美协同（v5 readerLayer 是 reflector 主要信号源）
  ✅ 0 红线豁免（v6 是红线友好 epic）
  ✅ 工程量可控（~10 小时）
  ✅ 失败容易回退（用户审阅环节兜底）

风险：
  ⚠ Reflector lesson 质量需要 dogfood 验证（≥ 1 月 review pass rate）
  ⚠ tokens 增加 ~15-20%（每章 reflector LLM 调用）
  ⚠ 用户需要养成审阅习惯（pending queue 不积压）
```

### §10.2 启动前需要用户签字（5 决策点）

```
□ Q1 · v6 epic 启动？
       推荐：✅ 启动（基于 v5 epic 已落地 + ACE 论文验证 + 0 红线豁免）
       回答：________

□ Q2 · settings.reflectorThresholds 默认 enabled = false？
       推荐：✅ 默认 false（opt-in · 用户自己开启）
       回答：________

□ Q3 · ReflectorLessonsPanel 与 CharacterBible 关系？
       选项：
         a. 独立面板（推荐 · I-6）
         b. CharacterBible 新 tab
         c. 浮动悬浮按钮
       推荐：a · 独立面板
       回答：________

□ Q4 · novel.9 Reflector prompt 加入版本库？
       推荐：✅ 加入（与 v5 N3.3 同模式 · .gitignore 例外）
       回答：________

□ Q5 · v6 epic 是否同时升级 layer 2（v5 readerLayer 加 counter）？
       推荐：🟡 不一起做 · 留 v7 epic（保持 v6 简单 · 验证后再升级）
       回答：________
```

### §10.3 不推荐的情况

```
v6 epic 暂不启动如果：
  ❌ v5 epic 用户 dogfood < 1 周（数据不足验证 readerLayer 信号）
  ❌ ScoreCard 阈值未稳定（信号噪声大）
  ❌ 用户带宽不足（无时间审阅 lessons）
  ❌ 项目章节 < 5 章（积累不够触发 reflector）

判断：
  当前 v5 epic 已完成 + 用户在线 + ACE 论文研究兴趣强烈
  → v6 epic 启动条件已充分（v1.0 dogfood 可与 v6 implementation 并行）
```

---

## §11 待用户决策

```
请用户回答 §10.2 的 5 个 Q（推荐答案：a / ✅ / a / ✅ / 🟡）

确认后：
  → 进入 BMAD Stage 2（PRD + CA + CK · ~120 min）
  → 然后 Stage 3.1 PR-1（schema + reflector pipeline）
  → 然后 Stage 3.2 PR-2（UI）
  → 然后 Stage 3.3 PR-3（dogfood log）
  → 完成 · v6 epic 落地

不确认或部分确认：
  → 我修订 preflight
  → 等再次签字
```

---

## §12 next steps

```
立即（用户操作）：
  1. 阅读 §10.2 五个 Q · 决定签字 / 调整
  2. 决策是否同时启动 v5 epic 用户 dogfood（D-1 ~ D-5）

短期（v6 epic 启动后）：
  Stage 2 · PRD + CA + CK
  Stage 3.1 PR-1 · schema + reflector pipeline
  Stage 3.2 PR-2 · UI
  Stage 3.3 PR-3 · dogfood log

中期（v6 epic 完成后 · ≥ 1 月 dogfood）：
  评估 Reflector lesson 质量
  决定是否启动 v7 epic（layer 2 · readerLayer 加 counter）

长期（v7 epic 完成后）：
  评估 ACE 完整架构价值
  决定是否启动 v8/v9 epic（layer 3 · 自动 Curator · pipeline 集成）
```

---

**版本**：v0.1 (2026-05-07)
**作用**：v6 epic ACE-lite 反馈闭环 BMAD Stage 0 preflight · 含 §1-§12 完整审计 · 等用户签字 5 决策点。
**下游**：用户签字后进 Stage 2（PRD + CA + CK）· 然后 PR-1/2/3 实施。
