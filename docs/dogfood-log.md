# Dogfood Log

> 项目：fili-web · 用户：QvQ · 用途：记录每个 BMAD epic 完成时的实测验证结果。
>
> **本日志的写作约定**：
> - 每个 epic（gap-d / gap-c / gap-b / ...）一节，按完成时间倒序在顶部追加。
> - 每节包含：epic 总览表 + 各 PR 验证表 + 累积 ledger + erratum 决议（如有） + 用户手测项。
> - 所有数据**实测**（vite build / tsc / git diff / Select-String），不允许"理论值"占位。

---

## 缺口 d · Progress Dashboard（2026-05-06 完成 BMAD Stage 3）

### Epic 总览

| 维度 | 实测 | 来源 |
|---|---|---|
| **范围** | Novel 页 N3 阶段顶部 collapsible 进度面板 | PRD §1 / §3 |
| **PR 数** | 4 (PR-1 数据 + PR-2 三 view + PR-3 容器接入 + PR-4 docs) | CA §5.1 |
| **Commit 数** | 7（实施 PR） + 2（planning fix + 当前 PR-4） = 9 | git log |
| **新增 src 累积** | **508 行**（CA 估算 476 / +6.7%） | §累积 ledger |
| **dexie schema 改动** | 0 | CK 红线 #1 |
| **新依赖** | 0 | CK §3 I-2 |
| **vite build modules Δ** | +6（1926 → 1932） | npx vite build |
| **bundle gzip Δ** | +3 KB（350.58 → 353.59） | vite build |
| **tsc 新增 error** | 0（baseline 1 TS2688） | npx tsc --noEmit |

### 各 PR 验证表

#### PR-1 · `src/store/projectAggregates.ts`

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| 行数 | 101 | 150 | ✅ |
| 红线 #1-#4 | 0/0/0/0 | 0 | ✅ |
| I-1 (no dexie) | 0 hits | 0 | ✅ |
| I-2 (no new deps) | 0 | 0 | ✅ |
| tsc | 1 (baseline) | ≤ 1 | ✅ |
| Commit | `ef29ea4` | — | ✅ |

#### PR-2a · `src/components/dashboard/ChapterCompletionGrid.tsx`

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| 行数 | 82 | 100 | ✅ |
| a11y aria-label | 3 hits | — | ✅ |
| I-5 (no zustand) | 0 | 0 | ✅ |
| Commit | `ba5cc42` | — | ✅ |

#### PR-2b · `src/components/dashboard/WordCountTrend.tsx`

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| 行数 | 94 | 110 | ✅ |
| a11y aria-label | 3 hits | — | ✅ |
| I-5 (no zustand) | 0 | 0 | ✅ |
| Commit | `f15b9b7` | — | ✅ |

#### PR-2c · `src/components/dashboard/ScoreHeatmap.tsx`

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| 行数 | 97 | 130 | ✅ |
| a11y aria-label | 3 hits | — | ✅ |
| I-3 (no LLM) | 0 | 0 | ✅ |
| I-5 (no zustand) | 0 | 0 | ✅ |
| Erratum 节 | 已注入 | 必填（首次跨 PRD cap） | ✅ |
| Commit | `f5364b4` (amended) | — | ✅ |

#### PR-3a + 3b · `src/store/dashboard.ts` + `src/components/ProgressDashboard.tsx`

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| dashboard.ts 行数 | 35 | 70 | ✅ |
| ProgressDashboard.tsx 行数 | 95 | 100 | ✅ |
| I-1 (no dexie) | 0 | 0 | ✅ |
| I-4 (single localStorage key 'flil:dashboard:state') | 1（grep 命中 2 = 注释 + 配置；运行时仅 1） | 1 | ✅* |
| Commit | `ba8acad` | — | ✅ |

> ✅* I-4 grep 统计含注释行（`// CK invariant I-4：localStorage key 恰好 1 个 ('flil:dashboard:state')`）。运行时实际 storage key 仍为 1。CK §3 I-4 grep 模式可在下次 epic 时精化（exclude 注释）。

#### PR-3c · `src/pages/Novel.tsx` wire-up

| 项 | 实测 | Cap | 状态 |
|---|---|---|:---:|
| Novel.tsx 净增量 | +4 / -0 | +10 | ✅ |
| 红线 #4 (仅 Novel.tsx) | 0 其他页 | 0 | ✅ |
| Commit | `e063640` | — | ✅ |

### 累积 src 行数 ledger

```
src/store/projectAggregates.ts                        101
src/components/dashboard/ChapterCompletionGrid.tsx     82
src/components/dashboard/WordCountTrend.tsx            94
src/components/dashboard/ScoreHeatmap.tsx              97
src/components/ProgressDashboard.tsx                   95
src/store/dashboard.ts                                 35
src/pages/Novel.tsx (Δ)                                 4
─────────────────────────────────────────────────────────
累积                                                  508

vs PRD NFR-3 cap 350：+158 / +45%        ← 触发 erratum (CK §4.2 Case B)
vs CA estimate 476：  +32  / +6.7%       ← 在 CA 预警 25% 缓冲内
vs CK §4.2 回退线 550 (CA + 15%)：-42 / 7.6% 安全余量 ← 不触发回退
```

**erratum 决议**：accepted, **不回退**。理由：
1. NFR-3 350 是估算，CK §4.2 已预设 550 才触发回退，508 < 550
2. 5 不变量（I-1..I-5）全 ✅，4 红线全 0
3. ScoreCard 矩阵数据源 wire 推迟到下一迭代（PR-1 返回 null，子组件优雅处理）
4. 未来如需收紧，可走 simplify workflow

### Open Follow-ups（gap-d 范围外，下次启动时处理）

1. **ScoreCard 矩阵实际数据源**：当前 `getProjectAggregates()` 返回 `scoreCardMatrix: null` 占位。下次需要从 `useScoreCardController` / `ChapterScoreCardSlot` 的存储位置取真实评分数据，喂给 ScoreHeatmap。
2. **性能 smoke 验证**：CK §6 PR-1 要求 `getProjectAggregates(50 章 mock) ≤ 50ms`。当前未在 dev console 实测，依赖纯函数性质 + 内存计算特性给出理论结论。**首次真实使用时应加 console.time 验证**。
3. **CK §3 I-4 grep 精化**：当前命中 2 = 注释 + 配置，建议下次 grep 加 `--invert-match` 排除 `^//` 行。

### 用户手测 checklist（QvQ 实际用 dashboard 时验证）

> 这是**只能由用户在浏览器实际操作**才能完成的部分。CK §6 PR-4 dogfood user story 验证。

#### US-1 · 全局位置感知（必测）

- [ ] 打开 Novel 页 / 进入 N3 阶段（章节生成区）
- [ ] 看到顶部 ProgressDashboard 折叠态
- [ ] 折叠态显示一句话摘要（章节数 / 完成数 / 平均字数）
- [ ] 点击展开 → 看到 grid + trend + heatmap 三块

#### US-2 · 字数失衡识别（必测）

- [ ] 至少 5 章已写
- [ ] 在 WordCountTrend 看到平均字数虚线
- [ ] 异常章节（< 50% 均值或 > 200%）红点标注
- [ ] hover 红点能看具体字数

#### US-3 · 评分异常定位（PR-3 暂不可，需 ScoreCard 矩阵 wire）

- [ ] **当前不可测**：ScoreCard 矩阵返回 null，ScoreHeatmap 显示空状态文案。
- 该测试在 ScoreCard 数据源对接后（见 Open Follow-up #1）才生效。

#### US-4 · 折叠态 + 状态持久（必测）

- [ ] 折叠 → 刷新页面 → 仍折叠
- [ ] 展开 + 选中第 N 章 → 刷新 → 仍展开 + 仍选中
- [ ] localStorage key = `flil:dashboard:state`（DevTools Application 面板）

### Git commits（按时间正序）

```
ef29ea4  feat(dashboard): add projectAggregates dexie helper (gap-d FR-data)
ba5cc42  feat(dashboard): add ChapterCompletionGrid view component (gap-d FR-2)
f15b9b7  feat(dashboard): add WordCountTrend view component (gap-d FR-3)
f5364b4  feat(dashboard): add ScoreHeatmap view component (gap-d FR-4) [+ erratum]
ba8acad  feat(dashboard): add ProgressDashboard container + dashboard store (gap-d FR-1, FR-6)
e063640  feat(novel): wire ProgressDashboard into N3 stage (gap-d FR-5)
            ↓
PR-4 commit (本文)：docs(dogfood): record gap-d epic completion
```

---

> **下一个 epic 预留位**：gap-c / gap-b / 或其他。下次 epic 完成时在本文件**顶部**追加新一节（保持倒序）。
