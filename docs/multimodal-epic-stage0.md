# fili-web · multimodal epic Stage 0 范围划定

> **BMAD Stage 0**：在动任何代码之前，用纯文档完成目标 / 范围 / 决策 / 风险 / 不变量的固化。
>
> 时间：2026-05-09
> 前置：ui-v6 epic 已收口（13 commit · 性能 + 视觉 + 体验三方面闭环 · commit `cc41dad`）
> 基准资料：`C:\Users\QvQ\CascadeProjects\cineforge-corpus\` + `C:\Users\QvQ\CascadeProjects\FLIL_工作流.md` + `C:\Users\QvQ\CascadeProjects\seedance-v5-pro\`
> 合规基准：`docs/ip-tier-policy.md`（必读 · 严格三档分类 · 违规 revert）

---

## §0 · TL;DR

fili-web 从**文字剧本生产工具**扩展为**短剧工业化生产管线**。5 个并行 epic · 60-90 commit · 估算 8-10 session。

```
当前 fili-web                                    目标 fili-web
=====================                           =====================
14 路由                                         18-20 路由
仅支持短剧/小说                    → MM1 →       +长片/超短片/剧集
单维 SelfCheck                     → MM2 →       5 维自检 + AI 避雷 + 节奏量化
无 LLM 驱动资产提取                 → MM3 →       资产工厂（三路并行 prompt 产出）
无分镜                             → MM4 →       分镜板（7 步 + 5 模型适配器）
简单 dexie 6 表                    → MM5 →       +4 张连续性表（伏笔/弧光/世界观/节奏）
```

**决策锁定**（IP / 体量 / 成本 / 迁移）：

| 决策 | 选择 | 影响 |
| --- | --- | --- |
| IP 治理 | 严格三档分类 | 全 PR 强制合规检查 · 开发量 +15-20% |
| 体量优先级 | **全上 5 epic** | 60-90 commit · 8-10 session |
| LLM 成本 UX | **B · 进度可中断 + 预算护栏** | Stage 2/3 每个 LLM 操作前估算 + 可停 + 可重跑 · 多 4-6 commit |
| dexie schema | **A · 狠 + 迁移脚本** | MM5 动顶层 4 表时附带 v6→v10 迁移 · 旧项目 0 丢 · +3 commit |

---

## §1 · 5 个 epic 详细范围

### epic MM1 · multi-format expansion（fili-web 从 2 格式扩到 5 格式）

**目标**：把现有 `/screenplay`（短剧）+ `/novel`（小说）扩展为对等的 5 种格式路由，每种格式配套独立的 8 步工作流 system prompt + 方法论资料库。

**产物**：

| 新增路由 | 格式 | LAYER 1 来源 | 备注 |
| --- | --- | --- | --- |
| `/feature-film` | 长片 | `format-feature.md` | 4 种结构（三幕/四幕/Save the Cat/Story Circle）+ 5 风格变体 + Subplot/伏笔/世界观三层 |
| `/short-film` | 短片 | `format-short.md` | 已部分在 `/screenplay` · 需对齐 LAYER 1 8 步工作流 + 节奏技法 |
| `/ultrashort-film` | 超短片 | `format-ultrashort.md` | What-If + How-to-Tell + 视听武器库 |
| `/series` | 剧集 | `format-series.md` | 双层结构 + 弧光预算 + 信息释放表 + 4 张连续性表 |

`/novel` 保留不动（小说非影视格式 · LAYER 1 无对应）。

**IP 合规**：
- 🟢 第 1 档 · 四份 format SKILL 全文可直引 · 加 `@山音 MIT` attribution
- 4 份文件拷贝到 `docs/methodology/` · 代码中按 schema 消费
- `LICENSE.md` / `README.md` 加致谢段

**技术路径**：
- Lessons learned from `/screenplay` + `/novel` pipeline runner 架构复用
- 每种格式一个 `src/pages/XxxFormat.tsx` · 复用 `PipelineRunner` + `ManifestSteps` 组件
- `src/data/formats/` 新建 4 个 YAML/JSON manifest（对应 8-step workflow）

**不变量**：
- DESIGN.md 14 token 0 增删 · 6 atom API 0 破坏
- dexie schema 0 改（本 epic 不动）
- 现有 `/screenplay` / `/novel` 公开行为 0 改（仅可能 refactor 共用逻辑）

**预估**：12-15 commit · 2 session

---

### epic MM2 · 5-dim selfcheck + AI-pitfalls 工程化

**目标**：把 `/refinery` 的 SelfCheckPanel 升级为多维自检系统 · 实装 AI 词典扫描 + 5 项机械测试思路（重命名）+ 双轨节奏量化（重阈值）。

**产物**：

| 模块 | 内容 | IP 档 |
| --- | --- | --- |
| `src/lib/selfcheck/dimensions.ts` | 5 维度自检（重命名为 `逻辑 / 人物 / 节奏 / 主题 / 真实感`）· 思路来自 CineForge 5-dim · **重命名 + 重写表达** | 🟡 |
| `src/data/ai-dictionary/` | AI 词典（自建 · 从 fili-web 项目日志 + 公开论文积累 · 不复用 CineForge 90 词典原文） | 🟡 (思路) / 🟢 (内容) |
| `src/lib/selfcheck/mechanical-tests.ts` | 5 项机械测试（**重命名**：`具体性检测 / 静态化检测 / 感官缺失检测 / 意外性检测 / 可替换性检测`）· 正则 + 词典匹配 | 🟡 |
| `src/lib/selfcheck/delabel.ts` | 剥标签 5 步法（重写描述 · 重命名为 `去标签化`） | 🟡 |
| `src/lib/rhythm/dual-track.ts` | 多维节奏扫描（**重命名**：不用"双轨节奏"· 用 `情节张力 + 情感起伏`）· 阈值**自跑数据定**（不照搬 ±2 / 3 场） | 🟡 |
| `src/components/SelfCheckPanel.tsx` | UI 升级 · 多维度 radar chart · 违规项高亮（复用 ui-v6 Studio Calm 视觉） | - |

**IP 合规**：
- 🟡 档必过重命名检查（`npm run ip-guard` grep 测试）
- 词典自建（从 fili-web 自己跑测试积累 + McKee / Save the Cat 公开建议）
- 阈值自跑数据（用 fili-web dogfood 产物做数据集 · 统计出 p50 / p90 · 再定）
- PR 描述强制写 `refs: @cineforge-corpus/03-ai-pitfalls.md（idea only · re-named + re-worded）`

**技术路径**：
- 词典 schema：`{ category, pattern (regex), severity, suggestion, tier (1-3) }`
- 节奏扫描：遍历场次 · 每场打 `{ tension: 0-10, emotion: -5..+5 }` · 输出曲线 + 连续高/低警报
- SelfCheckPanel 消费 `/refinery` 当前章节文本 · 实时扫描 · 按维度折叠展示

**不变量**：
- DESIGN.md 14 token 0 增删 · atom API 0 破坏
- dexie schema 0 改（selfcheck 结果存内存 · 不持久化）· MM5 后再持久化
- SelfCheckPanel 旧 API（`reflectorLessons`）保持向后兼容

**预估**：8-10 commit · 1.5 session

---

### epic MM3 · 资产工厂（/asset-factory）

**目标**：新增路由 `/asset-factory` · 从完整剧本产出三类 AI 文生图 prompt（场景 / 角色 / 道具）。

**产物**：

| 模块 | 内容 | IP 档 |
| --- | --- | --- |
| `src/pages/AssetFactory.tsx` | 主路由 · 完整性闸 → 三路并行 | - |
| `src/pipeline/asset-factory/completeness-gate.ts` | 完整性闸：扫描剧本 · 枚举场景/角色/道具（**三级角色**：主角/配角/群像）· 返回 JSON | 🟡 (思路) |
| `src/pipeline/asset-factory/scene-extractor.ts` | 场景卡生成（空镜七层递进 · 按物理空间聚合） | 🟡 (思路) / 🟢 (术语) |
| `src/pipeline/asset-factory/character-extractor.ts` | 角色卡生成（四宫格 · 发型时代化 · 五官具体） | 🟡 (思路) |
| `src/pipeline/asset-factory/prop-extractor.ts` | 道具卡生成（8 类硬覆盖 · 四视图 + 可触摸材质 · 纯静物） | 🟡 (思路) |
| `src/lib/budget-guard/` | **LLM 预算护栏**：调用前估算 token + 费用 · 超预算需确认 · 进度条可中断 · 单项失败可重跑 | - |
| `src/components/AssetCard.tsx` | 产物卡 UI · 复制/重跑/删除/导出 | - |
| `src/store/assets.ts` | 资产工厂产物 atom（非持久化 · 刷新清空 · MM5 后接 dexie） | - |

**System prompt 编写**（🟡 档 · 完全自写 · 参考 corpus 思路但**不复用原文**）：
- 完整性闸 prompt：列枚举场景/角色/道具 · 强调"漏一即失败"· 三级角色
- 场景卡 prompt：空镜七层递进 · 材质/光线/氛围/时代约束
- 角色卡 prompt：四宫格全身/半身/表情/动作 · 发型五官具体化
- 道具卡 prompt：四视图正/侧/背/俯 · 材质工艺 · 戏剧功能说明

**LLM 预算护栏 UX（决策 B）**：
1. 点"创建资产"前：估算 tokens = (剧本长度 + prompt 长度) × 3 路 · 按用户 settings 的模型单价算 ¥
2. 弹 `confirm` 对话框："预计 ¥X.XX / 完成时间 Y-Z 秒 · 是否继续？"
3. 用户点开始后：进度条显示当前步骤 + 已用 tokens + 累计费用
4. 进度条上有 "中断" 按钮 · 中断时保留已生成资产
5. 单项失败（如 JSON.parse 失败）· 自动记录 error · 可单独点"重跑" · 不影响其他两路
6. 全部完成后：显示实际 vs 预算对比 + 积累到 `settings.assetFactoryStats` 用于未来校准

**IP 合规**：
- 🔴 回避：不复用 `bubu_summary.txt` 14 prompt 原文
- 🟡 重写：参考 `01-tools-schema.md` 思路但完全重写 schema
- 🟢 直用：13 大师 + 13 调色 + 空镜七层 + 四视图 等公共影视术语

**技术路径**：
- 复用 `/screenplay` 的 `PipelineRunner` + `ManifestSteps` 架构
- JSON.parse 校验 + 失败重试 · 与现有 `runStepBestOfN` 对齐
- 输出格式：标准 JSON · fili-web 不绑定具体文生图模型 · 用户自己复制到 Midjourney / SD / 即梦文生图

**不变量**：
- 不动现有 `/assets`（那是项目素材库 · 手动上传场景）· `/asset-factory` 是 LLM 驱动的 prompt 生产
- dexie schema 0 改（MM5 后再持久化）
- 现有路由 0 改

**预估**：15-20 commit · 3 session

---

### epic MM4 · 分镜板（/storyboard）

**目标**：新增路由 `/storyboard` · 从剧本 + 资产库产出逐镜视频 prompt · 支持 5 种视频生成模型。

**产物**：

| 模块 | 内容 | IP 档 |
| --- | --- | --- |
| `src/pages/Storyboard.tsx` | 主路由 · Phase A-D 分析 → Phase E-G 逐单元编译 | - |
| `src/pipeline/storyboard/phase-a-d/` | 原文锚定 / 结构识别 / 情绪扫描 / 单元分配 · 命名用中性词 | 🟡 (思路) |
| `src/pipeline/storyboard/phase-e-g/` | 单元细化 / prompt 编译 / 忠实度自检 | 🟡 (思路) |
| `src/data/references/masters.ts` | 13 位大师风格库 · JSON | 🟢 |
| `src/data/references/color-grading.ts` | 13 种调色库 · JSON | 🟢 |
| `src/data/references/industry-terms.ts` | 64 工业术语映射 · JSON | 🟢 |
| `src/data/references/negative-prompts.ts` | AI 伪影 5 类 25 项 · JSON | 🟢 |
| `src/lib/model-adapters/` | 5 模型适配器（**自写 prompt 模板** · 不复用 `seedance/` 反推文本）· 即梦 / Sora / Veo / Kling / 可灵 | 🟡 (思路) |
| `src/components/ShotCard.tsx` | 镜头卡 UI · subShot 切分 · prompt 复制 · 跨模型切换 | - |
| `src/components/ModelSwitcher.tsx` | 5 模型切换 · 同一镜生成 5 种 prompt 变体 | - |

**IP 合规**：
- 🟢 13 大师 / 13 调色 / 64 术语 / AI 伪影 → 直接数据吃 · 无限制
- 🟡 Phase A-G 流程思路用 · 重命名阶段（如 `anchoring / structure / emotion / unit-split / refine / compile / fidelity-check`）
- 🔴 不复用 `seedance/` 具体 prompt 模板 · 自己跑测试写
- 🔴 不复用 INTERCEPT 62 镜样本（即使 corpus 标注"重组版"仍不用）

**LLM 预算护栏**（决策 B · 核心 epic）：
- N 镜逐单元调用 · 每镜估算 + 全局进度条
- 支持单镜失败重跑 + 全部暂停 + 全部取消
- 费用累计 + 预算超限弹窗（"您已设置 ¥X 上限，当前累计 ¥Y · 是否继续？"）

**不变量**：
- DESIGN.md 14 token 0 增删
- 不绑定任一视频生成模型（输出纯 prompt 文本 · 用户自己粘到即梦/Sora/可灵）
- dexie schema 0 改（MM5 后再持久化）

**预估**：20-25 commit · 4 session

---

### epic MM5 · continuity-table 持久化（dexie schema v8）

> **修订（2026-05-09）**：原计划 v7 已被 ACE-lite reflectorLessons（commit `cc41dad` 之前合入）占用 · 本 epic 顺延至 v8。

**目标**：dexie schema v7 → v8 · 新增 4 张连续性表 · 每个 chat step 的 `save` 自动 `update_continuity_table` · 解决跨会话状态丢失。

**产物**：

| 表 | schema | 消费者 |
| --- | --- | --- |
| `foreshadowTable` | `{ id, projectId, chapter, content, status, setupStep, payoffStep, createdAt, updatedAt }` | MM1 长片/剧集 · MM3 资产工厂（人物动机串联） |
| `characterArcTable` | `{ id, projectId, characterName, epoch, state, change, evidence, chapter }` | MM1 剧集弧光 · MM2 人物维度自检 |
| `worldContinuityTable` | `{ id, projectId, domain, rule, violations, chapter }` | MM1 长片世界观层 · MM4 分镜忠实度自检 |
| `rhythmDiagnosticTable` | `{ id, projectId, sceneIdx, tension, emotion, warnings, chapter }` | MM2 双轨节奏 · MM4 phase-C 情绪扫描 |

**迁移脚本（决策 A · 狠）**：
```ts
this.version(8).stores({
  // v1-v7 表全部保留（stores 字符串追加）
  foreshadowTable: '++id, projectId, status, [projectId+status]',
  characterArcTable: '++id, projectId, characterName, [projectId+characterName]',
  worldContinuityTable: '++id, projectId, domain, [projectId+domain]',
  rhythmDiagnosticTable: '++id, projectId, sceneIdx',
}).upgrade(async tx => {
  // 旧项目数据 0 丢 · 新表默认空 · 首次使用时自动填充
});
```

**IP 合规**：
- 🟡 4 张表的**思路**来自 CineForge `01-tools-schema.md update_continuity_table` · 但 4 张表的**字段设计全部自写**
- 表名用 fili-web 自己命名（`foreshadowTable` 等 · 不用 CineForge tableKind 枚举值）
- 代码注释中可写 "inspired by continuity-table concept · re-designed schema"

**技术路径**：
- Dexie v7→v8 迁移测试（用户 dogfood 前跑 `storage.test.ts` 验证无丢）
- 添加 `src/store/continuity/*.ts` atom · CRUD API
- SelfCheckPanel / AssetFactory / Storyboard 各自消费对应表
- `/project-settings` 加"导出所有连续性表为 JSON"按钮 · 用户可离线备份

**不变量**：
- dexie v1-v7 stores 字符串 0 改（严守"CK 红线 #1"）· 仅追加 v8 4 张新表
- 旧项目（dexie v7 数据）在 v8 下完全可读 · 只是 4 张新表为空
- `npm run build` 0 errors · storage.test.ts 必须全过

**预估**：5-8 commit · 1 session

---

## §2 · 5 epic 依赖图 + 推荐执行顺序

```
MM5 (dexie schema)
  └─ 支撑 MM2/MM3/MM4 的持久化

MM1 (多格式) ────┐
                 ├─ 可独立上线
MM2 (5 维自检) ──┘

MM3 (资产工厂) ──┐
                 ├─ 独立 · 但效果最佳依赖 MM1 (长片需要资产) 和 MM5 (连续性)
MM4 (分镜板) ────┘
```

**推荐顺序**（最小风险路径）：
1. **MM5 先行**（不碰 UI · 仅 schema v8 + 迁移脚本 · 最快反馈迁移正确性）
2. **MM1 平行**（直接吃 LAYER 1 · 最安全 · 快速扩大产品能力）
3. **MM2**（MM1 完成后 · 新格式消费 MM2 自检）
4. **MM3 资产工厂**（最大产品 gap · 依赖 MM1 的长片/剧集做测试数据）
5. **MM4 分镜板**（最复杂 · 依赖 MM3 资产库 + MM5 连续性）

**或**：MM1 + MM5 并行（都独立）· 再串 MM2 → MM3 → MM4。

---

## §3 · 不变量（横跨 5 epic 必守）

源于 fili-web 历史 CK 红线 + ui-v6 epic 沉淀：

1. **CK 红线 #1 · dexie stores 字符串 v1-v8 全部严守追加**（v8 仅 `+foreshadowTable / +characterArcTable / +worldContinuityTable / +rhythmDiagnosticTable` · 不改既有表任一字段）
2. **DESIGN.md 14 token 0 增删**（MM1-MM4 所有 UI 只消费现有 token · MM5 不涉及 UI）
3. **6 atom API 0 破坏**（useSettings / useProject / useExportDrawer / useConfirm / useShortcuts / useKbBinding · 6 个核心 atom 的公开 API 严守不改）
4. **路由 0 删除**（只可新增 · 不可删除 · 不可改路径 · 保已发布产品的 bookmark 兼容）
5. **bundle 不回退**：index.js < 60 KB / 任何路由 chunk < 600 KB / hover prefetch 不回退
6. **IP 合规**：所有 PR 过 `npm run ip-guard`（grep 品牌词 + CineForge 独创命名 → 0 hits）
7. **业务逻辑不回退**：现有 `/screenplay` / `/novel` / `/refinery` / `/analyzer` / `/adapt` / `/assets` / `/kb` / `/pipeline` / `/express` / `/playground` / `/methods` / `/lessons` / `/settings` / `/intake` 全部功能必须持续可用

---

## §4 · 主要风险 + 缓解

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| IP 合规破线 · 无意复用 CineForge 命名 | 🔴 高 | `npm run ip-guard` 每次 commit 前跑 · CI 强制 · dogfood-log 每 PR 声明 |
| LLM 预算失控（用户一键点"生成全部"烧 ¥100+）| 🔴 高 | 预算护栏必须上 · 默认保守值（每项目 ¥20 上限 · 超出需确认） |
| Dexie v8 迁移失败 · 用户数据丢 | 🔴 高 | v8 上线前 · 手动备份 dexie 数据 + 写 storage.test.ts 覆盖 v7→v8 · 线上 feature flag 分阶段启用 |
| 5 epic 并行开发分支冲突 | 🟡 中 | 推荐串行 MM5 → MM1 → MM2 → MM3 → MM4 · 每 epic 完全合入后再开下一个 |
| bundle 回退（MM3/MM4 代码量大 · 或新 chunk 超限）| 🟡 中 | 每 PR build-stats 对比基线 · 回退 > 10% 必须优化才合入 |
| 视频模型 API 快速过时（Sora 2 / Veo 4 等）| 🟡 中 | ModelAdapter 抽象层 · 5 模型 ≠ 硬编码 · 用户可自定义模型模板 · 未来扩展 |
| 文档量爆炸 · `docs/` 失序 | 🟢 低 | `docs/` 建立二级目录（`docs/methodology/` / `docs/epics/` / `docs/compliance/`） |

---

## §5 · Stage 0 验收

- [x] ip-tier-policy.md 写完
- [x] multimodal-epic-stage0.md 写完（本文档）
- [ ] CHANGELOG.md ui-v6 收尾写完
- [ ] 用户确认所有决策 · 不再变更
- [ ] Stage 0 commit 推送到 origin/main（当前 HEAD：`cc41dad` · PR-9）

验收通过后 · 下一 session 开 **MM5 PR-1**（dexie v8 迁移 · 最小风险切入点）。

---

## §6 · 附录：corpus 文件引用表（建档留痕）

本 Stage 0 文档参考了以下 corpus 文件（仅用于思路 · 不复用原文）：

| 文件 | 用途 | 档级 |
| --- | --- | --- |
| `FLIL_工作流.md` | 14 步管线总图 | 🟡 |
| `cineforge-corpus/README.md` | 产品三层架构 | 🟡 |
| `cineforge-corpus/product-matrix/README.md` | 挖矿元架构 | 🟡 |
| `cineforge-corpus/06-09-format-*.md` | 4 种格式 SKILL | 🟢 MIT |
| `cineforge-corpus/01-tools-schema.md` | 5 工具协议 | 🟡 |
| `cineforge-corpus/02-core-methodology.md` | 编剧理论 + 5 维自检 | 🟢 + 🟡 |
| `cineforge-corpus/03-ai-pitfalls.md` | AI 避雷 | 🟡 |
| `cineforge-corpus/04-rhythm-algorithm.md` | 双轨节奏 | 🟡 |
| `cineforge-corpus/shotlist-references/01-08` | shotlist 8 references | 🟢 (13 大师 / 64 术语) + 🟡 (流程) |
| `cineforge-corpus/seedance/` | seedance 反推 | 🟡 (流程) + 🟢 (术语库) |

全部在 fili-web repo **外部**保留 · repo 内 `docs/` 只存：
- 🟢 MIT 山音 SKILL 4 份（加 attribution）
- 🟢 公共知识数据（大师 / 调色 / 术语 · 自整理）
- fili-web 自写的文档

---

## 修订记录

- **v1.0（2026-05-09）**：初稿 · 5 epic 全上 · 决策锁定 · 等用户确认后启动 MM5 PR-1
- **v1.1（2026-05-09）**：MM5 dexie schema 起点修正 v7 → v8（v7 已被 ACE-lite reflectorLessons 占用 · commit `cc41dad`）
