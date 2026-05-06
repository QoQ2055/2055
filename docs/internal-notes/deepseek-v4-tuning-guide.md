# 内部参考手册 · DeepSeek V4 调优手册

> **创建日期**：2026-05-06
> **来源**：从 `@docs/reference-works/novelgenius-deep-enhancement-plan-original.md` 提炼
> **目的**：为 cineforge-web 的 LLM 客户端层（`@src/llm/deepseek.ts`）和未来的 prompt 工程提供技术参考
> **运行时状态**：❌ 内部文档 / 不影响 LLM 调用 / 不被加载
> **使用方式**：开发者在调优 LLM 调用 / 设计新 prompt / 升级到 V4 时查阅

---

## 一、DeepSeek V4 模型特性速查

### 1.1 V4 Flash vs V4 Pro

| 维度 | V4 Flash（284B / 13B 激活） | V4 Pro（1.6T / 49B 激活） |
|---|---|---|
| **指令遵循** | 弱（常忽略 preset 中的格式/结构指令） | **强**（CoT 处理复杂约束） |
| **散文质量** | 好（纯散文评测高于 V3.2 和 V4 Pro） | 更好（"V3.2 dialed up to 12"） |
| **创造力** | "dry"，Thinking Mode 下更明显 | 更有创造力（但 reasoning_effort=high 时也会变干） |
| **输出量** | 大（4000-5000 词，比 V3.2 多 45%+） | 中等 |
| **速度** | 快（约 Pro 的 3 倍） | 慢 |
| **成本** | 输入 $0.14/M，输出 $0.28/M | 输入 $1.74/M，输出 $3.48/M（**约 12 倍**） |
| **JSON 输出** | 简单结构可靠，复杂嵌套偶有错误 | 复杂结构也能可靠输出 |
| **长上下文** | 1M tokens，MRCR 78.0 | 1M tokens，MRCR 83.5 |
| **中文知识** | Chinese-SimpleQA 78.8 | Chinese-SimpleQA 84.4 |
| **中文创意写作** | 无官方数据 | 指令遵循 60.0% / 写作质量 77.5%（vs Gemini-3.1-Pro） |

### 1.2 选型决策

| 场景 | 推荐 |
|---|---|
| 结构化规划（卷纲 / 大纲骨架 / JSON 输出） | **V4 Pro** + Thinking 启用 + `reasoning_effort: "high"` |
| 创意扩展（章节正文 / 散文风格） | **V4 Flash** + Thinking **禁用** + `temperature: 0.85` |
| 格式化提取（参考解析 / 场景拆分） | **V4 Flash** + Thinking 禁用 + `temperature: 0.4` |
| 风格润色（去 AI 化） | **V4 Flash** + Thinking 禁用 + `temperature: 0.9` |
| 高频成本敏感操作 | 全 Flash（"经济模式"，100 章约 $0.6-1.0 vs 标准模式 $3.0-5.0） |

---

## 二、Thinking Mode 关键技术

### 2.1 启用方式（cineforge 当前未支持，重点）

```ts
// 在 ai.chat.completions.create() 调用中：
{
  model: "deepseek-v4-pro",
  messages: [...],
  extra_body: {
    thinking: { type: "enabled" },     // 启用
    reasoning_effort: "high"            // "high"（默认）或 "max"
  }
}

// 禁用：
{
  extra_body: {
    thinking: { type: "disabled" }
  }
}
```

### 2.2 关键限制（必须知道）

⚠ **Thinking Mode 启用后，以下参数全部失效**：
- `temperature`
- `top_p`
- `presence_penalty`
- `frequency_penalty`

→ **控制创造力的唯一途径是 prompt 工程本身**

### 2.3 reasoning_effort

- `"high"`（默认）/ `"max"`（复杂任务自动升级）有效
- `"low"` / `"medium"` 会被映射到 `"high"`

### 2.4 流式输出处理（cineforge 当前未处理）

V4 Thinking 内容在 SSE delta 的 `reasoning_content` 字段中：

```ts
const choice = json.choices?.[0];
const delta = choice?.delta;
const reasoning: string = delta?.reasoning_content ?? '';  // 思维链
const content: string = delta?.content ?? '';              // 正式回答
```

cineforge 当前 `@src/llm/deepseek.ts:81` 只读 `delta.content`，启用 thinking 后**思维链内容会丢失**。

---

## 三、Prompt 工程社区共识

### 3.1 角色沉浸式 > 禁止清单式（"gaslight 模式"）

❌ **不要写**："严禁使用'不禁'、'竟然'等词"

✅ **应该写**："你的叙述从不使用对比否定句式。你只描述发生了什么，而非没有发生什么。'你保持警惕'，而非'你没有放松警惕'。"

→ **印证 cineforge 现有 `@public/methods/anti-ai-flavor.md` 设计方向正确**。

### 3.2 指令的最优注入位置

| 位置 | 用途 |
|---|---|
| `role: "system"` | 角色身份定义 + 通用写作风格 |
| `role: "user"` 主体 | 任务描述 + 项目上下文 + 输出格式要求 |
| **`role: "user"` 第一轮末尾** | **Thinking Mode 控制指令**（V4 训练时使用的最优位置） |

### 3.3 非推理模式更适合散文风格

社区实测：reasoning_effort=high 会让写作"dry"。**纯创意写作（章节正文）禁用 Thinking 反而更好**，且 temperature 重新生效。

### 3.4 V4 的 CoT 倾向第一人称推理

可被利用来增强角色一致性和情感深度（→ 角色沉浸模式）。

---

## 四、DeepSeek 官方推荐的两种思维模式 prompt

### 4.1 角色沉浸模式（适用：大纲增强 / 需要情感深度的场景）

**英文版**：
```
【Character Immersion Requirements】Within your thinking process (inside the <think> tags), please follow these rules:
1. Use first-person inner monologue from the character's perspective, wrapping inner thoughts in parentheses, e.g., "(thinking: ...)" or "(inner voice: ...)"
2. Describe the character's inner feelings in first person, e.g., "I think to myself," "I feel," "I secretly," etc.
3. Your thinking content should be immersed in the character, analyzing the plot and planning replies through inner monologue.
```

**中文版（推荐中文小说创作场景使用）**：
```
【角色沉浸要求】在你的思考过程中（<think>标签内），请遵循以下规则：
1. 以角色的第一人称视角进行内心独白，用括号包裹内心想法，如"（心想：...）"或"（内心独白：...）"
2. 以第一人称描述角色的内心感受，如"我暗自想到"、"我感觉到"、"我偷偷地"等
3. 你的思考内容应沉浸在角色中，通过内心独白来分析情节和规划回复
```

### 4.2 纯分析模式（适用：卷纲设计 / 大纲推演 / 需要逻辑严谨的场景）

**英文版**：
```
【Thinking Mode Requirements】Within your thinking process (inside the <think> tags), please follow these rules:
1. Do NOT use parentheses to wrap inner monologue — state all analysis content directly.
2. Do NOT describe inner thoughts from the character's first-person perspective — use analytical language instead.
3. Your thinking content should focus on plot direction analysis and reply content planning.
```

**中文版**：
```
【思维模式要求】在你的思考过程中（<think>标签内），请遵循以下规则：
1. 不要使用括号包裹内心独白——直接陈述所有分析内容
2. 不要以角色的第一人称视角描述内心想法——使用分析性语言
3. 你的思考内容应聚焦于情节走向分析和回复内容规划
```

> **注入位置**：第一轮 user message 末尾。

---

## 五、response_format JSON 模式

### 5.1 启用方式（cineforge 当前未支持）

```ts
{
  model: "...",
  messages: [...],
  response_format: { type: "json_object" }
}
```

→ 强制模型输出合法 JSON，避免靠 prompt 文字引导 JSON 输出导致的偶发解析失败。

### 5.2 适用场景

- 卷纲生成
- 简要大纲推演
- 情节点检测
- KB 提取（`@src/llm/extractKb.ts`）
- 任何需要结构化输出的场景

---

## 六、两阶段法（解构 → 重构）

### 6.1 范式

**问题**：用户提供参考文本 → AI 输出与参考几乎一模一样（实测 10/10 关键词命中参考，0/8 命中目标）。

**解决**：分两步调用

```
阶段一：结构解构（V4 Flash + Thinking 禁用 + temp 0.4）
   输入：参考文本
   输出：纯抽象结构模式（卷数比例 / 转折点位置 / 情感波形 / 角色功能）
        严禁出现具体角色名 / 地名 / 事件名

阶段二：融合重构（V4 Pro + Thinking 启用 + 纯分析模式）
   输入：阶段一的抽象结构 + 项目完整上下文（角色 / 世界观 / 类型）
   输出：基于项目自身角色和世界观的原创设计
```

### 6.2 实测效果（附录 B.1）

| 测试组 | 参考关键词命中 | 目标关键词命中 | 结论 |
|---|---|---|---|
| 现有单步 + temp 0.3 | 10/10 | 0/8 | 完全复制 |
| 现有单步 + temp 0.7 | 10/10 | 0/8 | 提温无效 |
| **两阶段法** | **0/10** | **8/8** | 完全原创 |

### 6.3 在 cineforge 中的潜在应用

- **用户上传 KB 文档时**：用户可能上传"参考小说样本"，避免 LLM 直接复制原文 → 适合两阶段法
- **方法模块推荐时**：从参考作品提取结构模式，注入到当前项目而不污染情节
- **风格模仿（voiceCard）**：先解构风格特征，再让 LLM 用项目自身角色重写

---

## 七、cineforge-web 现状 vs 资料建议的 Gap 分析

### 7.1 LLM 客户端层（`@src/llm/deepseek.ts`）

| 能力 | cineforge 现状 | 资料建议 | 优先级 |
|---|---|---|---|
| `extra_body.thinking` | ❌ 不支持 | 启用 thinking mode 的核心 | **P1 高** |
| `extra_body.reasoning_effort` | ❌ 不支持 | thinking 强度控制 | **P1 高** |
| `response_format: json_object` | ❌ 不支持 | 强制 JSON 输出 | **P2 中** |
| `delta.reasoning_content` 流处理 | ❌ 仅读 `delta.content` | 启用 thinking 后思维链会丢失 | **P1 高（与 thinking 配套）** |
| 模型选择策略（Flash/Pro 自动） | ⚠ 用户在 settings 全局选 | 按场景自动选 | P3 低 |

### 7.2 Prompt 工程层

| 能力 | cineforge 现状 | 资料建议 | 价值 |
|---|---|---|---|
| 角色沉浸式 prompt | ✅ `anti-ai-flavor` 已采用 | 印证设计方向 | ✓ |
| 思维模式 prompt 中英版 | ❌ 没有 | 直接可复用 | ⭐⭐⭐ |
| 第一轮 user message 末尾注入 | ⚠ `compose.ts` 主要在 system | 按需调整 | ⭐⭐ |
| 两阶段法（参考避免复制） | ❌ 没有 | 用户 KB 上传场景适用 | ⭐⭐ |

### 7.3 功能层

| 功能 | cineforge 现状 | 备注 |
|---|---|---|
| 伏笔追踪系统 | ⚠ `plot-coherence-scaffold` 模块提及，无独立 UI/数据结构 | 可作为新功能 |
| 多方案备选生成 | ❌ | 提升用户控制感 |
| 引导式半自动生成 | ⚠ `Novel.tsx` 占位中 | UI 设计可参考 |

---

## 八、待办清单（建议执行优先级）

### P1 · LLM 客户端 thinking mode 支持（建议尽快）

修改 `@src/llm/deepseek.ts`：
1. `ChatRequest` 增加 `thinking?: { enabled: boolean; effort?: 'high' | 'max' }` 字段
2. fetch body 增加 `extra_body` 拼接
3. SSE 解析增加 `delta.reasoning_content` 处理 + `onReasoningDelta?: (chunk, full) => void` 回调
4. 启用 thinking 时**自动移除** `temperature` / `top_p` 等失效参数（避免混淆）

### P2 · response_format JSON 模式

修改 `ChatRequest` 增加 `responseFormat?: 'text' | 'json_object'`，`extractKb.ts` 等结构化输出场景启用。

### P3 · 节点级配置：thinking on/off 按场景

在 `@src/pipeline/methodModuleRecommend.ts` 或 `compose.ts` 层增加节点级 thinking 策略：
- 结构化节点（如 `novel.1` 立项 / `novel.2` 大纲）→ thinking on + 纯分析模式
- 创意节点（如 `novel.3.2` 章节正文）→ thinking off + temperature

### P4 · 两阶段法用于用户 KB 上传

`extractKb.ts` 增加可选两阶段流程（需用户 opt-in），避免 LLM 直接复制上传样本的具体内容。

### P5 · 伏笔追踪系统（独立功能）

参考资料 5.4.2 的数据结构与 UI，作为独立功能开发（与 ChapterFeedback 同级）。

---

## 九、引用源

- 原文：`@docs/reference-works/novelgenius-deep-enhancement-plan-original.md`
- 简介：`@docs/reference-works/novelgenius-deep-enhancement-plan.md`
- DeepSeek V4 官方技术报告：2026-04-24
- DeepSeek 官方员工 Deli Chen 在 GitHub 发布的思维模式 prompt
- Reddit SillyTavernAI 社区大规模实测共识
