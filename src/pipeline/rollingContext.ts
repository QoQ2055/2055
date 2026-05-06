// 滚动上下文压缩（rolling context compression）
//
// 应用场景
// ─────────
// 长篇小说写到第 30 章时，前 25 章合计 7-10 万字，全塞进 prompt 会爆 token，
// 但只塞最近 5 章又会让远距离伏笔 / 角色弧线断档。
//
// 解决方案（蒸馏自 ShadowScript rolling_context_compression.md）
// ──────────────────────────────────────────────────────────────
//   • 远距区（章节 < currentIndex - recentWindow）：用 LLM 浓缩为五段式摘要
//     ▸ 开篇定调
//     ▸ 主线推进
//     ▸ 高潮 / 转折
//     ▸ 收束 / 余震
//     ▸ 待回收线索（伏笔状态 / 谎言状态 / 角色关系当前定位）
//   • 近距区（最近 recentWindow 章）：原文保留（最少 1 章，最多 5-10 章）
//   • 远距摘要可缓存：每写完 K 章重新摘要一次，平时复用
//
// 接口设计（纯函数，与 artifact 存储方案解耦）
// ──────────────────────────────────────────
//   • buildRollingContext()：组装 prompt 用的滚动上下文字符串
//   • condenseFiveSegment()：调一次 LLM 把多章压缩成五段摘要
//   • 缓存策略由调用方决定（推荐存到 project.meta.rollingSummary）
//
// 与既有流水线
// ──────────────
//   • 不修改 runner / compose / 任何 prompt 模板
//   • novel.6 / novel.7 prompt 模板里已留 {{ rollingContext }} 占位符；
//     调用方在 Novel 工作台逐章生成时用 userOverride 注入本模块产出

import { chatStream } from '../llm/deepseek';
import { estimateCost } from '../llm/cost';
import type { SettingsState } from '../store/settings';

/* ───────────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────────── */
export interface ChapterRecord {
  index: number;          // 1-based
  title: string;
  content: string;        // 章节正文（不含 system prompt / 自检表）
}

export interface RollingContextOptions {
  /** 已完成的所有章节，按 index 递增排序 */
  chapters: ChapterRecord[];
  /** 即将写的目标章 index（1-based） */
  currentIndex: number;
  /** 最近多少章保留原文，默认 5；0 = 全部用摘要 */
  recentWindow?: number;
  /**
   * 缓存的远距摘要（来自上次 condenseFiveSegment 的产物）。若提供且
   * cacheCoversThrough >= 远距区上界，则跳过重新摘要直接使用。
   */
  cachedSummary?: string;
  /** 缓存覆盖到第几章（含）。例如 cacheCoversThrough=20 表示前 20 章已摘要 */
  cacheCoversThrough?: number;
  /**
   * 命中缓存后的"增量"远距章节是否拼接到摘要末尾（不再调 LLM）。
   * 默认 true：用便宜的 truncate 摘要补足缺口；false：必须重新调 LLM。
   * 推荐每写 5-10 章触发一次完整重摘要，保持质量。
   */
  appendIncrementalDelta?: boolean;
  /** 远距单章原文塞入"增量补丁"时的截断字符上限，默认 400 */
  incrementalChapterMaxChars?: number;
  /** 调用 LLM 浓缩时使用 — 必填 */
  settings: SettingsState;
  signal?: AbortSignal;
  /** 浓缩流式增量回调 */
  onCondenseDelta?: (chunk: string, full: string) => void;
}

export interface RollingContextResult {
  /** 组装好的 markdown 字符串，可直接塞进 user 消息 */
  rolling: string;
  /** 远距区是否调用了 LLM 重新摘要 */
  condensed: boolean;
  /** 新生成的摘要（仅当 condensed=true）；调用方应缓存 */
  newCondensedSummary?: string;
  /** 新缓存覆盖到第几章 */
  newCacheCoversThrough?: number;
  /** 浓缩调用统计（如有） */
  condenseTokens?: number;
  condenseCost?: number;
  condenseDurationMs?: number;
}

/* ───────────────────────────────────────────────────────────────────
 * 主入口：按 currentIndex 切分远 / 近距区，组装滚动上下文
 * ─────────────────────────────────────────────────────────────────── */
export async function buildRollingContext(
  opts: RollingContextOptions,
): Promise<RollingContextResult> {
  const recentWindow = Math.max(0, opts.recentWindow ?? 5);
  const sorted = [...opts.chapters].sort((a, b) => a.index - b.index);
  const distantBoundaryExclusive = opts.currentIndex - recentWindow; // 章节 index < 此值 视为远距

  const distant = sorted.filter((c) => c.index < distantBoundaryExclusive);
  const recent = sorted.filter(
    (c) => c.index >= distantBoundaryExclusive && c.index < opts.currentIndex,
  );

  // ─── 边界场景 ────────────────────────────────────────────────
  if (distant.length === 0 && recent.length === 0) {
    return { rolling: '(本章为第一章，无前序)', condensed: false };
  }

  // ─── 远距区摘要 ─────────────────────────────────────────────
  let distantSummary = '';
  let condensed = false;
  let newCondensedSummary: string | undefined;
  let newCacheCoversThrough: number | undefined;
  let condenseTokens: number | undefined;
  let condenseCost: number | undefined;
  let condenseDurationMs: number | undefined;

  if (distant.length > 0) {
    const cacheUpperBound = opts.cacheCoversThrough ?? 0;
    const cacheValid = !!opts.cachedSummary && cacheUpperBound >= distant[distant.length - 1].index;

    if (cacheValid) {
      // 完全命中
      distantSummary = opts.cachedSummary!;
    } else if (
      opts.cachedSummary
      && cacheUpperBound > 0
      && (opts.appendIncrementalDelta ?? true)
    ) {
      // 部分命中 — 用缓存 + 截断式补丁覆盖未覆盖章节，避免重复 LLM 调用
      const uncovered = distant.filter((c) => c.index > cacheUpperBound);
      const incrementalLimit = opts.incrementalChapterMaxChars ?? 400;
      const incrementalParts = uncovered.map((c) => {
        const head = c.content.slice(0, incrementalLimit);
        return `- 第 ${c.index} 章「${c.title}」：${head}${c.content.length > incrementalLimit ? '…' : ''}`;
      });
      distantSummary = [
        opts.cachedSummary!,
        '',
        '## 增量补丁（自上次摘要后的新章节，尚未浓缩）',
        ...incrementalParts,
      ].join('\n');
    } else {
      // 缓存失效 / 不存在 / 不允许补丁 → 重新摘要
      const condResult = await condenseFiveSegment({
        chapters: distant,
        settings: opts.settings,
        signal: opts.signal,
        onDelta: opts.onCondenseDelta,
      });
      distantSummary = condResult.summary;
      condensed = true;
      newCondensedSummary = condResult.summary;
      newCacheCoversThrough = distant[distant.length - 1].index;
      condenseTokens = condResult.tokens;
      condenseCost = condResult.cost;
      condenseDurationMs = condResult.durationMs;
    }
  }

  // ─── 近距区原文 ─────────────────────────────────────────────
  const recentParts: string[] = [];
  for (const c of recent) {
    recentParts.push(`### 第 ${c.index} 章 · ${c.title}`);
    recentParts.push(c.content.trim());
    recentParts.push('');
  }

  // ─── 组装 ──────────────────────────────────────────────────
  const out: string[] = [];
  if (distantSummary) {
    out.push('## 远距区 · 五段式摘要');
    out.push(distantSummary.trim());
    out.push('');
  }
  if (recentParts.length) {
    out.push(`## 近距区 · 最近 ${recent.length} 章原文`);
    out.push(recentParts.join('\n').trim());
  }

  return {
    rolling: out.join('\n').trim(),
    condensed,
    newCondensedSummary,
    newCacheCoversThrough,
    condenseTokens,
    condenseCost,
    condenseDurationMs,
  };
}

/* ───────────────────────────────────────────────────────────────────
 * 五段式浓缩调 LLM
 * ─────────────────────────────────────────────────────────────────── */
const CONDENSE_SYSTEM = `
你是一位**长篇小说摘要师**。给你一组章节正文，你把它们浓缩为一份**五段式摘要**——
让一个没读过原文的写作者读完后，能知道：
1. 故事背景与主角动机（开篇定调）
2. 主线推进了哪些不可逆事件（主线推进）
3. 哪些大转折 / 高潮已发生（高潮 / 转折）
4. 上一章结尾时的角色物理 / 心理 / 关系状态（收束 / 余震）
5. 还有哪些线索 / 伏笔 / 谎言悬而未决（待回收线索）

## 硬律
- **只能压缩，不能创作**：所有事件都必须是原文里发生过的；不要补充原文没写的细节
- **不超过 1500 字**：超出会让下游章节写作 prompt 过长
- **保留所有"待回收线索"**：哪怕它们看起来不重要——伏笔追踪的关键信息全靠这一段
- **角色"声音"提示**：每个出场角色用 1 句话描述当前对主角的态度 / 关键互动
- **零省略号**：不要写"等等"、"诸如此类"、"还有许多"

## 输出格式
\`\`\`markdown
### 开篇定调
[≤ 200 字]

### 主线推进
[≤ 400 字，按发生顺序列要点]

### 高潮 / 转折
[≤ 300 字，列已发生的关键节点]

### 收束 / 余震 · 主角当前状态
[≤ 200 字：身体 / 情绪 / 物理位置 / 关系 / 持有物]

### 待回收线索
[每条一行，格式：- [类别] 内容 · 上次出现章节]
\`\`\`

只输出五段，不要在前后加任何说明性文字。
`.trim();

interface CondenseResult {
  summary: string;
  tokens?: number;
  cost?: number;
  durationMs: number;
}

async function condenseFiveSegment(opts: {
  chapters: ChapterRecord[];
  settings: SettingsState;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}): Promise<CondenseResult> {
  const t0 = performance.now();

  const userParts: string[] = [];
  userParts.push(`## 待浓缩章节（共 ${opts.chapters.length} 章）`);
  for (const c of opts.chapters) {
    userParts.push('');
    userParts.push(`### 第 ${c.index} 章 · ${c.title}`);
    userParts.push(c.content.trim());
  }
  userParts.push('');
  userParts.push('请按 system 中规定的五段式格式输出摘要。');

  const res = await chatStream({
    baseUrl: opts.settings.baseUrl,
    apiKey: opts.settings.apiKey,
    // 浓缩用便宜模型即可——它只是"读 + 抽取"，不需要 flagship
    model: opts.settings.modelLite || opts.settings.model,
    temperature: 0.25,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: CONDENSE_SYSTEM },
      { role: 'user', content: userParts.join('\n') },
    ],
    signal: opts.signal,
    onDelta: opts.onDelta,
  });

  return {
    summary: res.content.trim(),
    tokens: res.usage?.total_tokens,
    cost: estimateCost(res.usage),
    durationMs: performance.now() - t0,
  };
}

