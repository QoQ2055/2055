// Best-of-N 采样 + LLM-as-judge 择优
//
// 设计动机
// ─────────
// 对于"创作发散类"节点（破题 / 章节正文 / 场景写作）首跑通过率往往只有
// 50-60%，用户经常需要重跑 2-3 次才满意。Best-of-N 把"事后重跑"提前并行
// 完成，并由模型自己当裁判挑出最优——总体延迟≈最慢候选的延迟（并行），
// 总成本≈ N+1 倍单次成本，但综合考虑用户重跑次数 + 心智成本，通常划算。
//
// 工作流
// ───────
//   1. 同时发出 N 个 runStep 请求（默认 N=3），各自带温度微扰（±0.05）
//      防止同输入同温度产生重复结果
//   2. 收到全部候选后，发第 N+1 个请求让模型按节点专属 rubric 打分
//   3. 解析裁判输出的"获胜编号"，返回该候选作为正式 artifact
//   4. 三个候选与裁判结果都附在返回的 meta 里，用户可以查看
//
// 与现有流水线的关系
// ───────────────────
// • 不修改 runStep / composeMessages / runner 主流程
// • 不修改任何 prompt 模板（裁判 prompt 是新建的，不是改的）
// • 不修改输出契约（最终返回 NodeArtifact 与单跑同形）
// • UI 层完全可以选择是否调用——默认不调用
//
// 适用节点
// ─────────
// 见 BEST_OF_N_NODES。节点应满足：
//   ✓ 创作发散性强（高温度）
//   ✓ 输出为 markdown / 自然语言（裁判好读）
//   ✗ 不适用于 outFormat:'json' 节点（结构化抽取不需要 N 选 1，应该调温度）
//   ✗ 不适用于循环节点（每章 N=3 成本爆炸；如需，应在循环外部由用户手动触发）

import { chatStream } from '../llm/deepseek';
import { estimateCost } from '../llm/cost';
import { runStep, type RunStepOptions } from './runner';
import { resolveTemperature } from './decodingRecipe';
import type { NodeArtifact } from './types';

/* ───────────────────────────────────────────────────────────────────
 * 推荐启用 Best-of-N 的节点白名单
 * 调用方可以无视这个白名单强制对任何节点跑 Best-of-N，
 * 但默认 UI 应该只对白名单内的节点暴露按钮。
 * ─────────────────────────────────────────────────────────────────── */
export const BEST_OF_N_NODES: ReadonlySet<string> = new Set([
  // ── 剧本：高发散关键节点
  'screenplay.1',  // 破题与核心动作（首跑质量决定全片调性）
  'screenplay.5',  // 结构大纲（错了下游全错）
  'screenplay.7',  // 场景写作（情绪 / 节奏直接体现的环节）
  // ── 改编
  'adapt.6',       // 镜像剧本写作
  // ── 小说
  'novel.0',       // 题材选题（错了下游全错；3 候选差异化最值得择优）
  'novel.1',       // 世界观（决定后续所有设定的根基）
  'novel.3',       // 全书分卷规划（错了下游全错）
  'novel.6',       // 章节草稿（墨刃，最值得择优）
  // ── 分镜
  // 'storyboard.2' 单元生成是循环节点，默认不开 Best-of-N，调用方按需手动触发
]);

/* ───────────────────────────────────────────────────────────────────
 * Result types
 * ─────────────────────────────────────────────────────────────────── */
export interface CandidateRun {
  index: number;            // 0-based
  artifact: NodeArtifact;   // 该候选完整产出
  temperatureUsed: number;
}

export interface JudgementResult {
  /** 0-based winning index */
  winnerIndex: number;
  /** 模型给出的简要理由（≤ 200 字） */
  reasoning: string;
  /** 各候选评分（按 candidate.index 顺序） */
  scores: number[];
  /** P8 反思模式：裁判在评分前产出的维度详解（可选） */
  critique?: string;
  /** 本次是否使用了反思模式 */
  reflection?: boolean;
  /** 裁判模型耗时 / token 等 */
  judgeTokens?: number;
  judgeCost?: number;
  judgeDurationMs: number;
  /** 裁判原始 markdown 输出（调试用） */
  rawJudgement: string;
}

export interface BestOfNResult {
  /** 最终选中的产物 — runner 应把这个写入 artifactMap */
  chosen: NodeArtifact;
  /** 全部候选（含获胜者，按 index 排序） */
  candidates: CandidateRun[];
  /** 裁判结果 */
  judgement: JudgementResult;
  /** 累计 token / cost（候选 + 裁判） */
  totalTokens: number;
  totalCost: number;
  /** 总耗时（并行候选 + 裁判调用） */
  totalDurationMs: number;
}

/* ───────────────────────────────────────────────────────────────────
 * Per-node rubric — 不同节点关心的维度不同
 * ─────────────────────────────────────────────────────────────────── */
function getRubric(stepId: string): string {
  // Common base — always applies
  const base = `
- **格式合规**：严格匹配 system prompt 中规定的字段 / 标题 / 表格结构
- **指令遵循**：所有硬律 / 红线 / 禁令未被违反
- **可执行性**：下游节点能直接用，无需大改`;

  // Stage-specific dimensions
  if (stepId === 'screenplay.1' || stepId === 'screenplay.5') {
    return base + `
- **概念新颖度**：方案是否有真正的钩子，而非套路堆叠
- **冲突密度**：核心动作 / 反转是否能撑满目标时长
- **可视化潜力**：能否被摄影机拍到（避免大段心理描写）`;
  }
  if (stepId === 'screenplay.7' || stepId === 'adapt.6') {
    return base + `
- **场景画面感**：动作 / 场面调度是否清晰可拍
- **对白质感**：是否像真人说话（语气 / 口头禅 / 答非所问）
- **节奏流畅度**：长短句搭配，无 AI 机械味`;
  }
  if (stepId === 'novel.6') {
    return base + `
- **反 AI 腔**：禁用句式 / 滥词全部规避（"嘴角微微上扬"/ "只见"等）
- **三密度协同**：本章关键事件同时推动剧情 + 传递信息 + 激活情绪
- **角色声音**：每个角色对白都能闭眼听出是谁
- **章末钩子**：四选一明确、不强拉、有张力`;
  }
  if (stepId === 'storyboard.2') {
    return base + `
- **双区结构**：自然语言 prompt 与结构化 caption 字段对齐无矛盾
- **起幅锚点遵从**：plannedEntryState 被精确尊重
- **视觉风格一致**：与项目 visualStyle 设定锚一致`;
  }
  // Default
  return base + `
- **创意完成度**：方案落地清晰、内部自洽
- **细节密度**：在不违规前提下提供最丰富的可操作细节`;
}

/* ───────────────────────────────────────────────────────────────────
 * Judge prompt builder
 * ─────────────────────────────────────────────────────────────────── */
const JUDGE_SYSTEM = `
你是一位**严格的创作审稿人**。下面会给你 N 份针对**同一任务**的候选输出。
你的工作只有三件事，按顺序：

1. 按给定 rubric 给每个候选 1-10 分（10=完美，1=不可用），分项可以略，但**总分必须明确**
2. 选出最佳的那一个
3. 用 ≤ 150 字写出**为什么选它而不是其它**

## 输出格式（严格遵守，便于程序解析）
\`\`\`
## 评分
- 候选 1：X 分 — [一句话理由]
- 候选 2：X 分 — [一句话理由]
- 候选 3：X 分 — [一句话理由]
（候选数量按实际给出，编号从 1 开始）

## 选择
WINNER = N

## 理由
[≤ 150 字]
\`\`\`

铁律：
- 只能选一个 WINNER；不允许并列
- WINNER 必须是 1 到 N 之间的整数（1-based）
- 不要修改候选；不要给修订建议；不要解释你的解释
`.trim();

/**
 * P8 反思模式裁判 system prompt。
 * 要求裁判在评分**前**先写出维度级的批评（优 / 劣、并列对比），
 * 再进入评分 / 选择。Chain-of-thought 换分选准确度；代价是裁判 token × ~2.5。
 */
const JUDGE_SYSTEM_REFLECTION = `
你是一位**严格的创作审稿人**。下面会给你 N 份针对**同一任务**的候选输出。
你需要**先写出维度级的批评**，再给出评分与选择（chain-of-thought 改善选择质量）。

## 输出格式（必须严格遵守，便于程序解析）

\`\`\`
## 维度批评
从 rubric 提取 3-5 个关键维度。每维度下列出各候选的一句话评价（并列对比）。

### 维度 A：[名称]
- 候选 1：[质感一句话]
- 候选 2：[质感一句话]
- 候选 3：[质感一句话]

### 维度 B：[名称]
…（重复上述格式）

## 评分
- 候选 1：X 分 — [总评一句话]
- 候选 2：X 分 — [总评一句话]
- 候选 3：X 分 — [总评一句话]

## 选择
WINNER = N

## 理由
[≤ 150 字，重点说为什么是它而不是第二名]
\`\`\`

铁律：
- 维度批评必须**在评分之前**输出。倒叙会使 reflection 退化为后验合理化
- WINNER 必须是 1 到 N 之间的整数（1-based），且与评分最高者一致（并列时选面向任务偏重点的那个）
- 不修改候选；不给修订建议；不解释你的解释
`.trim();

function buildJudgeUser(opts: {
  taskBrief: string;
  candidates: CandidateRun[];
  rubric: string;
}): string {
  const parts: string[] = [];
  parts.push('## 任务简述');
  parts.push(opts.taskBrief);
  parts.push('');
  parts.push('## Rubric（评分维度）');
  parts.push(opts.rubric.trim());
  parts.push('');
  parts.push(`## 共 ${opts.candidates.length} 份候选`);
  for (const c of opts.candidates) {
    parts.push('');
    parts.push(`### 候选 ${c.index + 1}（temperature=${c.temperatureUsed.toFixed(2)}）`);
    parts.push('```');
    // 截断超长候选以避免裁判 prompt 爆长（保留头尾，删中间）
    parts.push(truncateForJudge(c.artifact.content, 6000));
    parts.push('```');
  }
  parts.push('');
  parts.push('请按 system 中规定格式输出评分 → WINNER → 理由。');
  return parts.join('\n');
}

function truncateForJudge(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const head = Math.floor(maxLen * 0.6);
  const tail = maxLen - head - 40;
  return text.slice(0, head) + `\n\n…（中间省略 ${text.length - head - tail} 字）…\n\n` + text.slice(-tail);
}

/* ───────────────────────────────────────────────────────────────────
 * Judgement parser
 * ─────────────────────────────────────────────────────────────────── */
function parseJudgement(raw: string, candidateCount: number): {
  winnerIndex: number;
  scores: number[];
  reasoning: string;
  critique?: string;
} {
  // Try strict marker first
  const winMatch = raw.match(/WINNER\s*=\s*(\d+)/i);
  let winner1Based = winMatch ? parseInt(winMatch[1], 10) : NaN;
  if (!Number.isFinite(winner1Based) || winner1Based < 1 || winner1Based > candidateCount) {
    // Fallback: pick the candidate with highest detected score
    const fallback = pickByMaxScore(raw, candidateCount);
    winner1Based = fallback.winner1Based;
  }
  const winnerIndex = winner1Based - 1;

  // Scores per candidate (best-effort)
  const scores: number[] = new Array(candidateCount).fill(0);
  for (let i = 1; i <= candidateCount; i++) {
    const re = new RegExp(`候选\\s*${i}\\s*[：:].{0,20}?(\\d+(?:\\.\\d+)?)\\s*分`, 'i');
    const m = raw.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n)) scores[i - 1] = n;
    }
  }

  // Reasoning section
  const reasonMatch = raw.match(/##\s*理由[\s\S]*?\n([\s\S]*?)(?:\n##|$)/);
  const reasoning = reasonMatch
    ? reasonMatch[1].trim().slice(0, 400)
    : raw.slice(0, 400);

  // P8 反思模式：提取"维度批评"区段（可选）
  const critiqueMatch = raw.match(/##\s*维度批评[\s\S]*?\n([\s\S]*?)(?=\n##\s*评分|$)/);
  const critique = critiqueMatch
    ? critiqueMatch[1].trim().slice(0, 2000)
    : undefined;

  return { winnerIndex, scores, reasoning, critique };
}

function pickByMaxScore(raw: string, candidateCount: number): { winner1Based: number } {
  let best = 1;
  let bestScore = -Infinity;
  for (let i = 1; i <= candidateCount; i++) {
    const re = new RegExp(`候选\\s*${i}\\s*[：:].{0,20}?(\\d+(?:\\.\\d+)?)\\s*分`, 'i');
    const m = raw.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > bestScore) {
        bestScore = n;
        best = i;
      }
    }
  }
  return { winner1Based: best };
}

/* ───────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────── */
export interface RunBestOfNOptions extends RunStepOptions {
  /** 候选数量，默认 3，建议 2-5 */
  n?: number;
  /** 候选间温度微扰 ±delta，默认 0.05 */
  temperatureJitter?: number;
  /** 裁判模型温度，默认 0.1 */
  judgeTemperature?: number;
  /** 任务简述（供裁判读，强烈建议提供 1-2 句话；缺省回退到 step.title） */
  taskBrief?: string;
  /** 单候选 onDelta（带 candidateIndex），不与 RunStepOptions.onDelta 冲突 */
  onCandidateDelta?: (candidateIndex: number, chunk: string, full: string) => void;
  /** 候选完成回调 */
  onCandidateDone?: (candidate: CandidateRun) => void;
  /** 进入裁判阶段回调 */
  onJudgeStart?: (candidates: CandidateRun[]) => void;
  /** 裁判流式增量 */
  onJudgeDelta?: (chunk: string, full: string) => void;
  /** P8 反思模式：裁判在打分前写出维度级批评（提高选择质量，裁判 token × ~2.5） */
  reflection?: boolean;
}

export async function runStepBestOfN(opts: RunBestOfNOptions): Promise<BestOfNResult> {
  const n = Math.max(2, Math.min(5, opts.n ?? 3));
  const jitter = opts.temperatureJitter ?? 0.05;
  const baseT = resolveTemperature(opts.stageId, opts.step.id, opts.settings);

  const t0 = performance.now();

  // ─── 并行跑 N 个候选 ──────────────────────────────────────────
  const candidatePromises: Promise<CandidateRun>[] = [];
  for (let i = 0; i < n; i++) {
    // 温度微扰：第一个用基准，后续 ±jitter 交替
    const sign = i === 0 ? 0 : (i % 2 === 1 ? +1 : -1);
    const offset = sign * jitter * Math.ceil(i / 2);
    const tCand = clamp(baseT + offset, 0.0, 1.4);
    const idx = i;

    candidatePromises.push((async () => {
      const art = await runStep({
        ...opts,
        // 第 0 个候选用 recipe 基准温度；后续用 ±jitter 微扰，确保候选间存
        // 在系统性差异（不仅靠采样随机性）。
        temperatureOverride: i === 0 ? undefined : tCand,
        onDelta: (chunk, full) => {
          opts.onCandidateDelta?.(idx, chunk, full);
        },
      });
      const candidate: CandidateRun = {
        index: idx,
        artifact: { ...art, meta: { ...(art.meta ?? {}), bestOfN: { candidate: idx, total: n } } },
        temperatureUsed: tCand,
      };
      opts.onCandidateDone?.(candidate);
      return candidate;
    })());
  }

  const candidatesUnsorted = await Promise.all(candidatePromises);
  const candidates = [...candidatesUnsorted].sort((a, b) => a.index - b.index);

  // ─── 裁判 ────────────────────────────────────────────────────
  opts.onJudgeStart?.(candidates);

  const taskBrief = opts.taskBrief
    ?? `节点 ${opts.step.id}（${opts.step.title}）—— 阶段 ${opts.stageId}`;
  const rubric = getRubric(opts.step.id);

  const reflection = opts.reflection === true;
  const judgeT0 = performance.now();
  const judgeRes = await chatStream({
    baseUrl: opts.settings.baseUrl,
    apiKey: opts.settings.apiKey,
    model: opts.settings.model,
    temperature: opts.judgeTemperature ?? 0.1,
    max_tokens: reflection ? 3500 : 1500,
    messages: [
      { role: 'system', content: reflection ? JUDGE_SYSTEM_REFLECTION : JUDGE_SYSTEM },
      { role: 'user', content: buildJudgeUser({ taskBrief, candidates, rubric }) },
    ],
    signal: opts.signal,
    onDelta: opts.onJudgeDelta,
  });
  const judgeDurationMs = performance.now() - judgeT0;

  const parsed = parseJudgement(judgeRes.content, candidates.length);
  const winner = candidates[parsed.winnerIndex] ?? candidates[0];

  const judgement: JudgementResult = {
    winnerIndex: parsed.winnerIndex,
    reasoning: parsed.reasoning,
    scores: parsed.scores,
    critique: parsed.critique,
    reflection,
    judgeTokens: judgeRes.usage?.total_tokens,
    judgeCost: estimateCost(judgeRes.usage),
    judgeDurationMs,
    rawJudgement: judgeRes.content,
  };

  // ─── 汇总 ────────────────────────────────────────────────────
  const totalTokens =
    candidates.reduce((sum, c) => sum + (c.artifact.tokens ?? 0), 0)
    + (judgement.judgeTokens ?? 0);
  const totalCost =
    candidates.reduce((sum, c) => sum + (c.artifact.cost ?? 0), 0)
    + (judgement.judgeCost ?? 0);
  const totalDurationMs = performance.now() - t0;

  // 把裁判信息塞进 chosen.meta 方便 UI 展示
  const chosen: NodeArtifact = {
    ...winner.artifact,
    meta: {
      ...(winner.artifact.meta ?? {}),
      bestOfN: {
        candidateCount: candidates.length,
        chosenIndex: winner.index,
        scores: judgement.scores,
        reasoning: judgement.reasoning,
        critique: judgement.critique,
        reflection: judgement.reflection,
      },
    },
  };

  return {
    chosen,
    candidates,
    judgement,
    totalTokens,
    totalCost,
    totalDurationMs,
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** 便利函数：判断是否是 Best-of-N 推荐节点 */
export function isBestOfNRecommended(stepId: string): boolean {
  return BEST_OF_N_NODES.has(stepId);
}
