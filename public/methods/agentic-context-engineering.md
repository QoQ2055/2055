# Agentic Context Engineering · 演化中的提示词剧本

> **来源**：arXiv 2510.04618v3《Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models》(Stanford / SambaNova · Qizheng Zhang et al. · 2025-10) 概念提取 · 重写为通用方法论。
> **定位**：craft 层 · **AI 协作流水线进化型模块**（与 dual-layer-archive / self-evolving-auditor / chapter-coverage-7layer / progress-dashboard 强协同）。
> **核心命题**：让"提示词 / 上下文"不是静态指令 · 而是**演化中的剧本（playbook）**——通过 Generator / Reflector / Curator 三角色 · 把每章成功 / 失败的经验持续累积到上下文里 · 让 LLM 越写越懂这个项目。
> **核心价值**：(1) 三角色架构（写章节 → 反思 → 整理）；(2) 增量小步更新（避免崩溃）；(3) 增 + 修整循环（防止臃肿）；(4) 给 fili-web 自我进化能力的方法论基础。

---

## 适用边界

✅ **强推荐启用**：
- 长篇连载（≥ 30 章 · 经验累积价值高）
- 系列作品 / 多卷（跨项目共享 playbook）
- 多角色复杂剧情（角色 ≥ 5 · 跨章节状态复杂）
- 含 method modules 自定义需求的项目（用户希望 LLM 学习专属风格）

⚠ **可选启用**：
- 中长篇（10-30 章 · 经验积累临界）
- 多人协作（多作者共享同一 playbook）

❌ **不要启用**：
- 短篇 / 单元剧（演化成本 > 收益）
- 一次性创作（无累积场景）
- 缺反馈信号的场景（无 ScoreCard / 无用户审阅）

---

## 核心心法 · 上下文是剧本不是指令

### 痛点 · 静态提示词的两大坑

```
坑 1 · Brevity Bias（过度简洁偏见）
  现象：每次优化 prompt 都倾向"通用 / 简短"
  例：N3.1 章节 prompt 不断浓缩为"写一章好看的小说"
  后果：丢失 domain heuristics（题材专属技巧）
        丢失 failure modes（已知坑点 / 反例）
        丢失 character-specific 提示
  →   通用化 = 平庸化

坑 2 · Context Collapse（上下文崩溃）
  现象：让 LLM 全量重写积累的提示词 → 突然压缩为短摘要
  例：第 60 章 18282 tokens 准确率 66.7% · 第 61 章压缩到 122 tokens 跌到 57.1%
  →   一次错误重写 · 几个月积累被擦除

→ 两坑共同问题：把 context 当"待优化指令"而非"待累积经验"
```

### 解决方案 · 三角色 + 增量更新

```
ACE 心法：
  ├─ context 是 playbook（剧本）· 不是 prompt（指令）
  ├─ playbook 不断累积 / 提炼 / 整理（grow + refine）· 不全量重写
  └─ 三角色分工 · 仿人类学习（实验 / 反思 / 巩固）

→ 上下文像"老作者的笔记本" · 越写越厚 · 越用越准
→ LLM 长上下文能力让"丰富 + 详细"成为可能（不必压缩）
```

---

## 三角色架构详解 ★ 核心实操

### 角色 1 · Generator（生成者）· "动笔写"

```
职责：
  ├─ 接收 query（任务）+ 当前 playbook（上下文）
  ├─ 产生推理轨迹 / 章节草稿 / 工具调用
  └─ 标记哪些 playbook bullets 有用 / 误导

对应 fili-web：
  └─ N3.1 章节草稿 / N3.2 章节润色 / N3.3 角色状态提取
     的 LLM step 即是 Generator

输出：
  ├─ 章节 / artifact 内容
  ├─ 推理轨迹（可选 · 通过 stream 截获）
  └─ playbook bullets 反馈标记（helpful / harmful · 计数器）
```

### 角色 2 · Reflector（反思者）· "复盘"

```
职责：
  ├─ 接收 Generator 的轨迹 + 结果（成功 / 失败信号）
  ├─ 提炼具体 insights（不是泛泛建议）
  └─ 输出"小颗粒 lessons"给 Curator

关键创新：把"评估 + 提炼"从 Curator 中分离
  → 单一 LLM 同时做 3 件事会 overload
  → 分离后 Reflector 专注"为什么对 / 为什么错"

对应 fili-web：
  ├─ ScoreCard 失败维度（< 阈值的 7 维）作为信号
  ├─ consistencyCheck 检测出的硬伤作为信号
  └─ 用户在 dogfood-log 的负面反馈作为信号
  → 上述都触发新 LLM step：Reflector

输出 lessons 格式（小颗粒）：
  - 不是"章节质量需要提高"（太泛）
  - 而是"第 5 章主角对手 X 的态度从 30 章前的厌恶突然变温和 · 缺过渡铺垫"（具体）
```

### 角色 3 · Curator（整理者）· "归档"

```
职责：
  ├─ 接收 Reflector 的 lessons
  ├─ 决定写入哪个 playbook bullet（新建 / 更新 / 合并 / 弃用）
  └─ 通过非 LLM 逻辑做 deterministic merge（避免再次崩溃）

关键设计：non-LLM merge
  → 避免"全量 rewrite playbook"风险
  → 用 ID + counter + dedup（embedding 相似度）

对应 fili-web：
  ├─ 自动追加到现有 method module 的"common pitfalls"段
  ├─ 更新 readerLayer.whatImWondering 的累积
  ├─ 标注 method module bullet 的 helpful/harmful counter
  └─ 触发用户审阅（人工 commit · 不自动覆盖）

输出：
  └─ playbook 的增量更新（delta · 不全量）
```

---

## 三大创新 · 避免静态 prompt 的失效

### 创新 1 · Reflector / Curator 分离

```
传统：单 LLM 同时做"反思 + 整理 + 写"
ACE：分 3 个 step

收益：
  ✅ 反思更深入（专注 why）
  ✅ 整理更稳定（non-LLM merge · 避免 collapse）
  ✅ 生成更专注（不分心元任务）

代价：
  ⚠ 多 1-2 次 LLM 调用（tokens 增加）
  ⚠ pipeline 复杂度上升
```

### 创新 2 · Incremental Delta Updates（增量小步更新）

```
传统：每次优化全量 rewrite playbook
ACE：每次输出 delta（小颗粒补丁）

bullet 结构：
  - id: 唯一标识（如 "ML-pitfall-20251007-003"）
  - metadata: { helpful_count, harmful_count, last_updated, created }
  - content: 一段经验（≤ 200 字 · 可读 / 可定位）

收益：
  ✅ localization：只动相关 bullet · 不影响其它
  ✅ fine-grained retrieval：Generator 只看相关 bullet
  ✅ incremental：合并 / 修剪 / 去重容易
  ✅ 防 collapse：不会一次错误擦掉全部

对应 fili-web：
  └─ method module 升级路径（每个 bullet 加 metadata）
```

### 创新 3 · Grow-and-Refine（增 + 修整）

```
传统：playbook 无限膨胀 / 一刀切删旧
ACE：周期性"修整"
  ├─ Grow：新 bullet 直接 append
  ├─ Refine（懒模式）：仅 context window 超额时触发
  └─ Refine（主动）：每 N 个 delta 触发
  
修整动作：
  ├─ counter 更新（已存在 bullet · helpful++ / harmful++）
  ├─ 语义去重（embedding 相似度 > 0.85 → 合并）
  └─ 弃用（harmful_count > N · 标记 deprecated）

收益：
  ✅ playbook 既增长 · 又不臃肿
  ✅ 旧经验被验证（counter） · 新经验被吸收（append）

对应 fili-web：
  └─ method module 周期 review（自动 dogfood 触发）
```

---

## 与 fili-web 的对接 · 改造路径

### 现状评估

| ACE 元素 | fili-web 现状 | 对接度 |
|---|---|:---:|
| Generator | LLM 跑 N3.1 / N3.2 / N3.3 | ✅ 100% |
| Reflector | 部分（ScoreCard / consistencyCheck）但**不写回** | 🟡 30% |
| Curator | ❌ 完全缺失 | ❌ 0% |
| Bullet 结构 | method modules 接近 | 🟡 50% |
| helpful/harmful counter | ❌ 无 | ❌ 0% |
| Incremental delta | ❌ 全人工 | ❌ 0% |
| Grow-and-refine | ❌ 无 | ❌ 0% |
| 多 epoch | ❌ 无 | ❌ 0% |

→ 当前自我进化能力 ⭐⭐☆☆☆（2/5）

### 改造 3 层路径

#### 🟢 层 1 · 浅 ACE · "失败反馈写入 method modules"

```
机制：
  ├─ ScoreCard 失败 → 触发 Reflector LLM step
  ├─ Reflector 提炼 lesson → 写入 method module 的"pitfalls"段
  └─ 用户审阅后 commit（人工把关）

工程量：~10 小时 · 2 epic
红线影响：低（人工审阅环节保留）
价值：高（自我进化能力 2/5 → 4/5）
```

#### 🟡 层 2 · 中 ACE · "v5 readerLayer 升级 ACE bullet"

```
机制：
  ├─ readerLayer 4 字段加 helpful/harmful counter
  ├─ grow-and-refine 合并相邻章节相似 readerLayer
  └─ 跨角色 dedup

工程量：~5 小时 · 1 epic
红线影响：v5 schema add-only · 0
价值：中（v5 进化为 ACE-lite）
```

#### 🔴 层 3 · 完整 ACE · "Generator/Reflector/Curator 流水线"

```
机制：
  ├─ pipeline 加 novel.6.5 (Reflector) + novel.7.5 (Curator)
  ├─ 每章自动触发 reflect + curate
  └─ 多 epoch：用户每写 N 章 · 流水线自动 refresh modules

工程量：~25 小时 · 3-4 epic
红线影响：触发多红线（pipeline / runner / prompt JSON）
价值：极高（完整自我进化）
```

---

## 关键 caveat · ACE 的失效条件

### 必需的反馈信号

```
ACE 强依赖**可靠 feedback signals**：
  ├─ 代码：execution success/failure
  ├─ 数学：formula correctness
  └─ 财务：ground-truth answer

fili-web 类比信号：
  ✅ ScoreCard 7 维分数（自动）
  ✅ consistencyCheck 硬伤（自动）
  ✅ 用户 dogfood-log 反馈（手动）
  ⚠ 主观体验（如"读起来爽不爽" · 弱信号）

如果信号不可靠：
  ❌ Reflector 提炼的 lesson 被噪声污染
  ❌ Curator 写入的 bullet 让 playbook 变质
  → 越用越糟
```

### 信号弱时的应对

```
Layer 1 · 严格阈值
  → 只 reflect 高置信度信号（如 ScoreCard 大幅低于均值）
  → 弱信号忽略

Layer 2 · 双签
  → Reflector 输出后必须用户 review · 不自动写入
  → 风险与价值平衡

Layer 3 · 控制写入范围
  → 只写"common pitfalls" 类增量段
  → 不改 prompt 主体
```

---

## 与其它 fili-web 模块的协同

### 与 dual-layer-archive 协同

```
dual-layer-archive 提供：
  ├─ 数据层 + 读者层 → 双层信号源
  └─ 4 类交叉验证 → 检测信号可靠性

ACE 提供：
  ├─ 双层信号变化 → 触发 Reflector
  ├─ 读者层 unwondering 变化 → 加入 lesson
  └─ 数据层矛盾 → 自动写入 pitfall bullet
```

### 与 self-evolving-auditor 协同

```
self-evolving-auditor 提供：
  └─ "审核员越用越懂这个项目"的方法论

ACE 提供：
  └─ 把"越用越懂"的具体机制（3 角色 + 3 创新）
```

### 与 chapter-coverage-7layer 协同

```
7 层覆盖框架定义"每章必须涵盖什么"
ACE 让 Reflector 跨章节学习"哪一层经常被漏"
  → 写入 method module bullet
  → 下一章 Generator 自动注意
```

### 与 progress-dashboard / dogfood-log 协同

```
progress-dashboard 显示 ACE playbook 增长曲线
dogfood-log 记录 ACE 演化的关键节点
```

---

## 实施 checklist

### 启用 ACE 前自查

```
□ 项目长度 ≥ 30 章（演化收益 > 成本）
□ ScoreCard 已开启（提供 reflector 信号）
□ method modules 设计稳定（curator 写入目标明确）
□ 用户愿意人工审阅（层 1 红线 mitigation）
□ tokens 预算允许 +30-50%（Reflector + Curator 额外 LLM 调用）
□ 有 dogfood 习惯（信号验证）
```

### 三角色实施先后

```
推荐顺序：Generator → Reflector → Curator

Step 1：先优化 Generator（已有 N3.x）
  → 确保章节质量稳定后再加 Reflector

Step 2：加 Reflector（新 LLM step）
  → 仅做"反思" · 输出 lesson 暂时只写入 dogfood-log
  → 用户验证 lesson 质量后再启用 Curator

Step 3：加 Curator（自动写入 method modules）
  → 先用人工审阅模式（dry-run）
  → 验证 ≥ 1 月后再考虑自动 commit
```

### 演化中的健康监控

```
□ playbook 大小（应稳定增长 · 不暴涨）
□ helpful_count / harmful_count 比值（应 > 5:1）
□ 重复 bullet 数（refine 后应 < 5%）
□ Reflector lesson 质量（用户 review pass rate · 应 > 70%）
□ ScoreCard 趋势（应平稳上升 · 不应跌入 collapse）
```

---

## 失败模式

### 失败 1 · Reflector overload

```
症状：Reflector 提炼的 lesson 太泛
原因：信号过弱 / 任务太复杂
对策：
  ├─ 收紧信号阈值（只反思最差 10%）
  ├─ 多 epoch 适应（refine 多轮 lesson）
  └─ 切换更强 LLM 做 Reflector
```

### 失败 2 · Curator 写错位置

```
症状：lesson 写到错误的 method module
原因：semantic embedding 相似度阈值不准
对策：
  ├─ 加 module 类别标签（character / structure / craft 等）
  ├─ Reflector 输出时附带"应写入哪类 module"hint
  └─ 用户审阅环节兜底
```

### 失败 3 · playbook 过载

```
症状：method modules 累积到 200+ · LLM 注意力分散
原因：grow-and-refine 没及时触发
对策：
  ├─ 每月强制 refine（不依赖 lazy mode）
  ├─ 弃用 harmful_count > 5 的 bullet
  └─ 按 helpful_count 排序 · 取 top-N 注入
```

---

## 与 batch-12 self-evolving-auditor 的关系

```
batch-12 self-evolving-auditor：
  └─ "审核工具自我进化"的应用层方法论
  └─ 定义"审核员如何学习项目"的高层流程

本 module（ACE）：
  └─ "上下文自我进化"的算法层方法论
  └─ 定义 Generator / Reflector / Curator 三角色 + 增量更新机制

→ batch-12 是产品功能 · ACE 是底层引擎
→ 两者结合 = "审核工具的引擎"
```

---

## 实证数据（论文 §4）

```
ACE 在 AppWorld agent benchmark：
  ├─ ReAct + ACE vs ReAct + ICL：+12.3%
  ├─ ReAct + ACE vs ReAct + GEPA：+11.9%
  ├─ ReAct + ACE vs Dynamic Cheatsheet（online）：+7.6%
  └─ 无 ground-truth label 时仍 +14.8%（依赖代码执行信号）

ACE 在 financial benchmark：
  ├─ ACE vs ICL/MIPROv2/GEPA（offline）：+10.9%
  └─ ACE vs DC（online）：+6.2%

→ 在"有可靠 feedback signal"场景下 · ACE 是当前 SOTA
```

---

## 论文标识 · 进一步阅读

```
arXiv: 2510.04618v3
作者: Qizheng Zhang, Changran Hu, Shubhangi Upasani, ...James Zou, Kunle Olukotun
机构: Stanford / SambaNova
发布: 2025-10
许可: CC-BY-4.0
开源代码: github.com/ace-agent/ace
```

---

**版本**：v0.1 (2026-05-07 · 来自 arXiv 2510.04618 batch-15)
**作用**：让 fili-web 提示词系统从"静态 JSON"演化为"agentic playbook"的方法论基础。
**下游**：v6 epic（ace-lite-feedback-loop · preflight 待写）+ 未来 v7 / v8 epic 实施完整 ACE 流水线。
