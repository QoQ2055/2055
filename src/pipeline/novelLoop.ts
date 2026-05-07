// Novel mode loop schedulers + plan parsers.
//
// 三种循环节点（与 prompt JSON 对应）：
//   • novel.4 (单卷分章)：按卷迭代，输入 N2.1 分卷规划，每卷生成完整章节明细
//   • novel.6 (章节草稿)：按章迭代，注入 rollingContext + 单章戏点，墨刃风格
//   • novel.7 (章节润色)：按章迭代，输入 N3.1 草稿，输出润色版
//
// 与 storyboard.2 的 phase2 loop 设计一致：
//   • 每节点一个 nodeId，per-iteration 内容存在 meta.{volumeContents | chapterContents}
//   • 失败隔离 + 增量持久化 + 续跑
//   • content 字段保存 assembled markdown（按 volumeIndex / chapterIndex 拼接），
//     方便下游用 {{ artifacts.novel.X.content }} 直接读
//
// 不修改 prompt 模板：通过 userOverride 注入运行时变量

import { runStep } from './runner';
import { runStepBestOfN } from './bestOfN';
import { composeMessages } from './compose';
import { loadPayload } from './manifest';
import { applyProjectContext, interpolate } from './interpolate';
import { buildRollingContext, type ChapterRecord } from './rollingContext';
import { runCharacterStateExtraction } from './characterStates';
import { listChapterStates } from '../store/characterStates';
import type { SettingsState } from '../store/settings';
import type {
  ArtifactMap,
  ManifestStep,
  NodeArtifact,
  ProjectContext,
} from './types';

/* ───────────────────────────────────────────────────────────────────
 * 解析：从 N2.1 分卷规划中抽取卷信息
 * ─────────────────────────────────────────────────────────────────── */
export interface VolumeMeta {
  index: number;            // 1-based
  title: string;
  /** 章节数区间（保守估计；分章节时章数会落在此区间内） */
  chapterCountHint?: { min?: number; max?: number };
  /** 该卷主题/核心冲突摘要（来自 ## 第 N 卷 标题段下文） */
  themeSummary?: string;
  /** 原文片段（用作下游卷的 priorVolumes 上下文摘要） */
  rawSection: string;
}

export function parseVolumePlan(content: string): VolumeMeta[] {
  if (!content) return [];
  // 优先尝试「## 第 N 卷」标题切分；如果一卷都没识别到，则回退到 markdown 表格行解析
  // （N2.1 prompt 的默认输出格式是表格 `| 一 | 卷名 | 1-30 | XX 万 | ... |`）
  const lines = content.split(/\r?\n/);
  const volumes: VolumeMeta[] = [];
  let cur: { idx: number; title: string; buf: string[] } | null = null;
  const flush = () => {
    if (cur) {
      const raw = cur.buf.join('\n').trim();
      const meta = inferVolumeChapterRange(raw);
      const themeSummary = extractThemeSummary(raw);
      volumes.push({
        index: cur.idx,
        title: cur.title.trim(),
        chapterCountHint: meta,
        themeSummary,
        rawSection: raw,
      });
    }
    cur = null;
  };
  for (const line of lines) {
    const m = line.match(/^#{1,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*卷[\s·:：]*([^\n]*)$/);
    if (m) {
      flush();
      cur = { idx: chineseToInt(m[1]), title: m[2] || `第 ${m[1]} 卷`, buf: [line] };
    } else if (cur) {
      cur.buf.push(line);
    }
  }
  flush();

  if (volumes.length === 0) {
    // ── 回退：解析 markdown 表格行 ──────────────────────────────────
    // 表头形如 `| 卷号 | 卷名 | 章号区间 | 字数 | 卷核心目标 | 卷末转折 ... |`
    // 数据行形如 `| 一 | 落魄少年 | 1-30 | 12 万字 | 主角立志报仇 | 卷末钩子 |`
    // 跳过分隔行 `|---|---|---|`
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('|')) continue;
      // 分隔行：全部由 -, : 和 | 组成
      if (/^\|[\s\-:|]+\|?$/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim()).filter((c, i, arr) => {
        // 去掉首尾的空 cell（来自前后 `|`）
        return !(i === 0 && c === '') && !(i === arr.length - 1 && c === '');
      });
      if (cells.length < 2) continue;
      const idxCell = cells[0];
      const idx = chineseToInt(idxCell);
      // 必须是合法卷号 1..99 且第二列非空
      if (!idx || idx < 1 || idx > 99) continue;
      // 跳过表头行（第一列写「卷号」「序号」等）
      if (/卷号|序号|编号|index|no\.?/i.test(idxCell)) continue;
      const title = cells[1] || `第 ${idx} 卷`;
      // 章号区间通常在第 3 列；字数在第 4 列；主题在第 5 列
      const rangeCell = cells[2] ?? '';
      const themeCell = cells[4] ?? cells[3] ?? '';
      // 章号区间表格列形如 "1-30" 或 "31-80"（无「章」后缀），需要专门解析
      let chapterCountHint = inferVolumeChapterRange(rangeCell);
      if (!chapterCountHint) {
        const rm = rangeCell.match(/(\d+)\s*[-~–至到]\s*(\d+)/);
        if (rm) {
          const start = parseInt(rm[1], 10);
          const end = parseInt(rm[2], 10);
          if (end >= start) chapterCountHint = { min: end - start + 1, max: end - start + 1 };
        }
      }
      volumes.push({
        index: idx,
        title: title.replace(/^[\[【]|[\]】]$/g, '').trim(),
        chapterCountHint,
        themeSummary: themeCell.slice(0, 200) || undefined,
        rawSection: rawLine,
      });
    }
  }

  return volumes.sort((a, b) => a.index - b.index);
}

function inferVolumeChapterRange(text: string): VolumeMeta['chapterCountHint'] {
  // 形如 "约 30-40 章" / "30~40 章" / "30 章"
  const m = text.match(/(?:约\s*)?(\d+)\s*[-~–至到]\s*(\d+)\s*章/);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  const m2 = text.match(/(?:约\s*)?(\d+)\s*章/);
  if (m2) {
    const n = parseInt(m2[1], 10);
    return { min: n, max: n };
  }
  return undefined;
}

function extractThemeSummary(text: string): string | undefined {
  // 抓"## 第 N 卷"标题之后第一段非空文本作为摘要（≤ 200 字）
  const lines = text.split(/\r?\n/).slice(1);
  const para: string[] = [];
  for (const l of lines) {
    if (/^#{1,4}\s/.test(l)) break; // 子标题终止
    if (l.trim()) para.push(l.trim());
    else if (para.length) break;
  }
  const s = para.join(' ').slice(0, 200);
  return s || undefined;
}

/* ───────────────────────────────────────────────────────────────────
 * 解析：从 N2.2 单卷分章中抽取章节信息
 *
 * 接收的 content 是所有卷拼接后的总章节明细。每章是 "### 第 N 章 · 标题"。
 * 章节戏点 / 节奏标签 / 伏笔指令以列表形式紧跟在标题下。
 * ─────────────────────────────────────────────────────────────────── */
export interface ChapterMeta {
  index: number;            // 全局章号 1..N
  title: string;
  volumeIndex?: number;     // 推断：从最近的 ## 第 N 卷 标题
  beat?: string;            // 戏点 / 主线推进
  paceTag?: string;         // 节奏标签
  foreshadowOps?: string;   // 埋/推/收
  targetWords?: number;     // 目标字数（默认 3500）
  rawSection: string;       // 原文片段（含标题）
}

export function parseChapterOutlines(content: string): ChapterMeta[] {
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const chapters: ChapterMeta[] = [];
  let curVol = 0;
  let cur: { ch: ChapterMeta; buf: string[] } | null = null;

  const flush = () => {
    if (cur) {
      const raw = cur.buf.join('\n').trim();
      cur.ch.rawSection = raw;
      cur.ch.beat = extractField(raw, ['戏点', '主线推进', '本章戏点', '本章核心']) || undefined;
      cur.ch.paceTag = extractField(raw, ['节奏标签', '节奏', '密度']) || undefined;
      cur.ch.foreshadowOps = extractField(raw, ['伏笔', '伏笔指令', '伏笔操作', '埋推收']) || undefined;
      const tw = extractField(raw, ['目标字数', '字数']);
      if (tw) {
        const n = parseInt(tw.replace(/[^\d]/g, ''), 10);
        if (!isNaN(n) && n > 100) cur.ch.targetWords = n;
      }
      chapters.push(cur.ch);
    }
    cur = null;
  };

  for (const line of lines) {
    // N2.2 prompt 用 「## 卷 N · [卷名]」 作为卷标记；旧格式用 「## 第 N 卷」
    const volM = line.match(/^#{1,4}\s*(?:第\s*)?卷?\s*(\d+|[一二三四五六七八九十百千]+)\s*卷?[\s·:：]/)
      || line.match(/^#{1,4}\s*卷\s*(\d+|[一二三四五六七八九十百千]+)/);
    if (volM && /卷/.test(line)) {
      flush();
      curVol = chineseToInt(volM[1]);
      continue;
    }
    const chM = line.match(/^#{2,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*章[\s·:：]*([^\n\[]*)/);
    if (chM) {
      flush();
      cur = {
        ch: {
          index: chineseToInt(chM[1]),
          title: (chM[2] || '').trim() || `第 ${chM[1]} 章`,
          volumeIndex: curVol || undefined,
          rawSection: '',
        },
        buf: [line],
      };
    } else if (cur) {
      cur.buf.push(line);
    }
  }
  flush();

  if (chapters.length === 0) {
    // ── 回退：解析 markdown 表格行 ───────────────────────────────
    // N2.2 prompt 的默认输出格式是表格：
    //   | 章号 | 标题 | 戏点 | 字数 | 节奏标签 | 不可逆事件 | 转折 1/2 | 钩子类型 | 埋入线索 ID | 情绪波峰 |
    //   | A | [标题] | [一句话] | 3500 | 爽点·开场 | ... | ... | ... | L001（第 X 章）| ... |
    // 但 LLM 也可能用纯数字（1, 2, 3 ...）替换占位符 A/A+1。
    let curVol2 = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      // 卷标识：「## 卷 N」或「## 第 N 卷」
      const vm = line.match(/^#{1,4}\s*(?:第\s*)?卷\s*(\d+|[一二三四五六七八九十百千]+)/)
        || line.match(/^#{1,4}\s*第\s*(\d+|[一二三四五六七八九十百千]+)\s*卷/);
      if (vm && /卷/.test(line)) {
        curVol2 = chineseToInt(vm[1]);
        continue;
      }
      if (!line.startsWith('|')) continue;
      if (/^\|[\s\-:|]+\|?$/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim()).filter((c, i, arr) => {
        return !(i === 0 && c === '') && !(i === arr.length - 1 && c === '');
      });
      if (cells.length < 3) continue;
      const idxCell = cells[0];
      // 跳过表头行
      if (/^(?:章号|序号|编号|chapter|no\.?|#)$/i.test(idxCell)) continue;
      // 章号：纯数字（如 1 / 30 / A+1 中的 A 是占位符不应通过）
      const idxMatch = idxCell.match(/^(\d+)$/) || idxCell.match(/^第?\s*(\d+)\s*章?$/);
      if (!idxMatch) continue;
      const idx = parseInt(idxMatch[1], 10);
      if (!idx || idx < 1 || idx > 9999) continue;
      // 跳过示例行（标题列含「[标题]」或「(本卷全部章节，零省略)」等占位符）
      const titleCell = cells[1] ?? '';
      if (/^\[.*\]$/.test(titleCell) || /本卷全部章节|零省略|\.\.\./i.test(titleCell)) continue;
      const beatCell = cells[2] ?? '';
      const wordsCell = cells[3] ?? '';
      const paceCell = cells[4] ?? '';
      // 列 8 通常是「埋入线索 ID（回收章）」，与伏笔指令同义
      const foreshadowCell = cells[8] ?? '';
      const tw = parseInt(wordsCell.replace(/[^\d]/g, ''), 10);
      chapters.push({
        index: idx,
        title: titleCell.replace(/^[\[【]|[\]】]$/g, '').trim() || `第 ${idx} 章`,
        volumeIndex: curVol2 || undefined,
        beat: beatCell || undefined,
        paceTag: paceCell || undefined,
        foreshadowOps: foreshadowCell || undefined,
        targetWords: !isNaN(tw) && tw > 100 ? tw : undefined,
        rawSection: rawLine,
      });
    }
  }

  return chapters.sort((a, b) => a.index - b.index);
}

function extractField(text: string, keys: string[]): string {
  // 抓 "- 戏点：xxx" / "**戏点**：xxx" / "戏点: xxx"
  for (const k of keys) {
    const re = new RegExp(`(?:^|\\n)\\s*[-*•]?\\s*\\*{0,2}${escapeRegex(k)}\\*{0,2}\\s*[：:]\\s*([^\\n]+)`, 'i');
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CN_NUM: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};
function chineseToInt(s: string): number {
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // 简化处理 1-99：解析 十/百 等中文数字
  if (s.length === 1) return CN_NUM[s] ?? 0;
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (CN_NUM[s[1]] ?? 0);
  if (s.endsWith('十')) return (CN_NUM[s[0]] ?? 0) * 10;
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (CN_NUM[a] ?? 1) * 10 + (CN_NUM[b] ?? 0);
  }
  return parseInt(s, 10) || 0;
}

/* ───────────────────────────────────────────────────────────────────
 * Loop meta types
 * ─────────────────────────────────────────────────────────────────── */
export interface NovelVolumeLoopMeta {
  novelLoop: 'volume';
  volumeCount: number;
  completedVolumes: number[];
  volumeContents: Record<number, string>;
  failedVolumes: Array<{ volumeIndex: number; error: string; retries: number }>;
  cumulativeTokens?: number;
  cumulativeCost?: number;
}

export interface NovelChapterLoopMeta {
  novelLoop: 'chapter-draft' | 'chapter-polish';
  chapterCount: number;
  completedChapters: number[];
  chapterContents: Record<number, string>;
  chapterTitles: Record<number, string>;
  /** novel.7 only: which polish mode was used per chapter */
  chapterModes?: Record<number, NovelPolishMode>;
  failedChapters: Array<{ chapterIndex: number; error: string; retries: number }>;
  /** P6 章节级审批：用户手工标记为"已批准"的章节序号集合（仅前端策略，不持久到 LLM） */
  approvedChapters?: number[];
  /** Last-built rolling-context cache for novel.6 incremental writing */
  rollingSummaryCache?: string;
  rollingSummaryCoversThrough?: number;
  cumulativeTokens?: number;
  cumulativeCost?: number;
}

export type NovelPolishMode = 'default' | 'neuro' | 'condense' | 'de_ai';

const POLISH_MODE_PREFIX: Record<NovelPolishMode, string> = {
  default: '',
  neuro: '【神经化学重写】\n',
  condense: '【去冗余精简】\n',
  de_ai: '【去AI化】\n',
};

/* ───────────────────────────────────────────────────────────────────
 * Loop 1: novel.4 单卷分章
 * ─────────────────────────────────────────────────────────────────── */
export interface RunNovelVolumeLoopOptions {
  step: ManifestStep;
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  signal?: AbortSignal;
  resume?: boolean;
  onlyVolumes?: number[];
  onVolumeStart?: (volume: VolumeMeta, total: number) => void;
  onVolumeDelta?: (volumeIndex: number, full: string) => void;
  onVolumeDone?: (volume: VolumeMeta, content: string, total: number) => void;
  onVolumeFailed?: (volume: VolumeMeta, error: string, retries: number) => void;
  onProgress?: (intermediate: NodeArtifact) => void;
}

export async function runNovelVolumeLoop(
  opts: RunNovelVolumeLoopOptions,
): Promise<NodeArtifact> {
  const { step, project, artifacts, settings, signal } = opts;
  const resume = opts.resume !== false;
  const onlyVolumes = opts.onlyVolumes && opts.onlyVolumes.length ? new Set(opts.onlyVolumes) : null;

  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  const volumePlan = artifacts['novel.3'];
  if (!volumePlan) throw new Error('novel.4 需要 N2.1 分卷规划（novel.3）的输出，请先运行 N2.1');
  const volumes = parseVolumePlan(volumePlan.content);
  if (volumes.length === 0) {
    throw new Error('未能从 N2.1 解析到任何卷。请检查输出是否含「## 第 N 卷」标题');
  }

  // ─── 续跑状态 ────────────────────────────────────────────────
  const existing = artifacts[step.id];
  const existingMeta = (existing?.meta ?? {}) as Partial<NovelVolumeLoopMeta>;
  const isResumable = resume && existing && existingMeta.novelLoop === 'volume';
  const completedSet = new Set<number>(
    isResumable && Array.isArray(existingMeta.completedVolumes) ? existingMeta.completedVolumes : [],
  );
  const volumeContents: Record<number, string> = isResumable && existingMeta.volumeContents
    ? { ...existingMeta.volumeContents } : {};
  let failedVolumes: NovelVolumeLoopMeta['failedVolumes'] = isResumable && Array.isArray(existingMeta.failedVolumes)
    ? [...existingMeta.failedVolumes] : [];
  let cumulativeTokens = isResumable ? (existingMeta.cumulativeTokens ?? 0) : 0;
  let cumulativeCost = isResumable ? (existingMeta.cumulativeCost ?? 0) : 0;

  const t0 = performance.now();
  const total = volumes.length;

  let toRun = volumes.filter((v) => onlyVolumes ? onlyVolumes.has(v.index) : !completedSet.has(v.index));
  if (toRun.length === 0) {
    if (onlyVolumes) {
      return assembleVolumeArtifact({
        step, volumes, volumeContents, completedVolumes: [...completedSet],
        failedVolumes, cumulativeTokens, cumulativeCost, durationMs: 0,
      });
    }
    // 全部完成 → 全量重跑
    completedSet.clear();
    for (const k of Object.keys(volumeContents)) delete volumeContents[Number(k)];
    failedVolumes = [];
    cumulativeTokens = 0; cumulativeCost = 0;
    toRun = [...volumes];
  }

  for (const vol of toRun) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    opts.onVolumeStart?.(vol, total);

    // 构建 priorVolumes 上下文：已完成卷的章节明细摘要
    const priorParts: string[] = [];
    for (const v of volumes) {
      if (v.index >= vol.index) break;
      const c = volumeContents[v.index];
      if (c) {
        priorParts.push(`### 第 ${v.index} 卷 · ${v.title}`);
        // 取每章标题行（避免上下文爆炸）
        const titleLines = c.split(/\r?\n/).filter((l) => /^#{2,4}\s*第\s*\d+\s*章/.test(l));
        priorParts.push(titleLines.slice(0, 60).join('\n'));
      }
    }
    const priorVolumes = priorParts.join('\n\n').trim() || '(本卷为第一卷，无前序)';

    // 用 prompt 模板 + interpolate 注入运行时变量（绕过 composeMessages 的 novel 分支
    // 默认行为，因为我们要传 priorVolumes / currentVolume）
    const payload = await loadPayload(step);
    const userTemplate = payload.messages.find((m) => m.role === 'user')?.content ?? '';
    let userMsg = interpolate(userTemplate, {
      project, artifacts,
      priorVolumes,
      currentVolume: String(vol.index),
    } as any);
    userMsg = applyProjectContext(userMsg, project);

    try {
      const art = await runStep({
        stageId: 'novel',
        step, project, artifacts, settings, signal,
        userOverride: userMsg,
        onDelta: (_c, full) => opts.onVolumeDelta?.(vol.index, full),
      });
      volumeContents[vol.index] = art.content.trim();
      completedSet.add(vol.index);
      failedVolumes = failedVolumes.filter((f) => f.volumeIndex !== vol.index);
      cumulativeTokens += art.tokens ?? 0;
      cumulativeCost += art.cost ?? 0;
      opts.onVolumeDone?.(vol, art.content, total);

      const intermediate = assembleVolumeArtifact({
        step, volumes, volumeContents, completedVolumes: [...completedSet],
        failedVolumes, cumulativeTokens, cumulativeCost,
        durationMs: performance.now() - t0,
      });
      opts.onProgress?.(intermediate);
    } catch (e: any) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
      const errStr = e?.message ?? String(e);
      const prev = failedVolumes.find((f) => f.volumeIndex === vol.index);
      const retries = (prev?.retries ?? 0) + 1;
      failedVolumes = failedVolumes.filter((f) => f.volumeIndex !== vol.index);
      failedVolumes.push({ volumeIndex: vol.index, error: errStr, retries });
      opts.onVolumeFailed?.(vol, errStr, retries);
      const intermediate = assembleVolumeArtifact({
        step, volumes, volumeContents, completedVolumes: [...completedSet],
        failedVolumes, cumulativeTokens, cumulativeCost,
        durationMs: performance.now() - t0,
      });
      opts.onProgress?.(intermediate);
    }
  }

  return assembleVolumeArtifact({
    step, volumes, volumeContents, completedVolumes: [...completedSet],
    failedVolumes, cumulativeTokens, cumulativeCost,
    durationMs: performance.now() - t0,
  });
}

function assembleVolumeArtifact(p: {
  step: ManifestStep;
  volumes: VolumeMeta[];
  volumeContents: Record<number, string>;
  completedVolumes: number[];
  failedVolumes: NovelVolumeLoopMeta['failedVolumes'];
  cumulativeTokens: number;
  cumulativeCost: number;
  durationMs: number;
}): NodeArtifact {
  const segments = p.volumes.map((v) => {
    const c = p.volumeContents[v.index];
    const failed = p.failedVolumes.find((f) => f.volumeIndex === v.index);
    if (c) return c.trim();
    if (failed) {
      return `## 第 ${v.index} 卷 · ${v.title} ⚠ 失败 (重试 ${failed.retries} 次)\n\n> ${failed.error}\n`;
    }
    return `## 第 ${v.index} 卷 · ${v.title}\n\n_（待生成）_\n`;
  });
  const meta: NovelVolumeLoopMeta = {
    novelLoop: 'volume',
    volumeCount: p.volumes.length,
    completedVolumes: p.completedVolumes.slice().sort((a, b) => a - b),
    volumeContents: p.volumeContents,
    failedVolumes: p.failedVolumes,
    cumulativeTokens: p.cumulativeTokens,
    cumulativeCost: p.cumulativeCost,
  };
  return {
    nodeId: p.step.id,
    stageId: 'novel',
    index: p.step.index,
    title: p.step.title,
    format: p.step.outFormat,
    content: segments.join('\n\n'),
    tokens: p.cumulativeTokens,
    cost: p.cumulativeCost,
    durationMs: p.durationMs,
    ts: Date.now(),
    meta: meta as unknown as Record<string, unknown>,
  };
}

/* ───────────────────────────────────────────────────────────────────
 * Loop 2: novel.6 章节草稿
 * ─────────────────────────────────────────────────────────────────── */
export interface RunNovelChapterDraftOptions {
  step: ManifestStep;
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  signal?: AbortSignal;
  resume?: boolean;
  onlyChapters?: number[];
  /** 只跑前 N 章（增量写作）；若同时给 onlyChapters 以 onlyChapters 为准 */
  upTo?: number;
  /** 滚动上下文：远距区五段式摘要将每隔 condenseEvery 章重新生成 */
  condenseEvery?: number;
  /** 近距区窗口（最近多少章原文，默认 5） */
  recentWindow?: number;
  onChapterStart?: (chapter: ChapterMeta, total: number) => void;
  onChapterDelta?: (chapterIndex: number, full: string) => void;
  onChapterDone?: (chapter: ChapterMeta, content: string, total: number) => void;
  onChapterFailed?: (chapter: ChapterMeta, error: string, retries: number) => void;
  onCondense?: (info: { coversThrough: number; chars: number }) => void;
  onProgress?: (intermediate: NodeArtifact) => void;
  /** 启用 Best-of-N（默认 false）。开启后每章并行跑 N 个候选 + LLM judge 择优。
   *  代价：token 消耗 ≈ N 倍 + judge 调用一次。 */
  useBestOfN?: boolean;
  /** Best-of-N 候选数（2-5），默认 3 */
  bestOfNCount?: number;
  /** P8 反思裁判：裁判在打分前先写出维度级批评 */
  bestOfNReflection?: boolean;
}

export async function runNovelChapterDraftLoop(
  opts: RunNovelChapterDraftOptions,
): Promise<NodeArtifact> {
  return runChapterLoopShared({
    ...opts,
    mode: 'draft',
  });
}

/* ───────────────────────────────────────────────────────────────────
 * Loop 3: novel.7 章节润色
 * ─────────────────────────────────────────────────────────────────── */
export interface RunNovelChapterPolishOptions
  extends Omit<RunNovelChapterDraftOptions, 'onCondense' | 'condenseEvery' | 'recentWindow'> {
  /** 每章润色模式（chapterIndex → mode）；未指定则用 polishModeDefault */
  chapterModes?: Record<number, NovelPolishMode>;
  polishModeDefault?: NovelPolishMode;
}

export async function runNovelChapterPolishLoop(
  opts: RunNovelChapterPolishOptions,
): Promise<NodeArtifact> {
  return runChapterLoopShared({
    ...opts,
    mode: 'polish',
    polishModes: opts.chapterModes,
    polishModeDefault: opts.polishModeDefault ?? 'default',
  });
}

/* ───────────────────────────────────────────────────────────────────
 * 共享章节循环实现
 * ─────────────────────────────────────────────────────────────────── */
interface RunChapterLoopShared extends RunNovelChapterDraftOptions {
  mode: 'draft' | 'polish';
  polishModes?: Record<number, NovelPolishMode>;
  polishModeDefault?: NovelPolishMode;
}

async function runChapterLoopShared(opts: RunChapterLoopShared): Promise<NodeArtifact> {
  const { step, project, artifacts, settings, signal, mode } = opts;
  const resume = opts.resume !== false;
  const onlyChapters = opts.onlyChapters && opts.onlyChapters.length ? new Set(opts.onlyChapters) : null;

  if (!settings.apiKey) throw new Error('请先在设置里填写 API Key');

  // ─── 章节列表来源 ─────────────────────────────────────────
  const outlineArt = artifacts['novel.4'];
  if (!outlineArt) throw new Error(`novel.${mode === 'draft' ? '6' : '7'} 需要 N2.2 单卷分章（novel.4）的输出，请先运行 N2.2`);
  const chapters = parseChapterOutlines(outlineArt.content);
  if (chapters.length === 0) {
    throw new Error('未能从 N2.2 解析到任何章节。请检查输出是否含「### 第 N 章」标题');
  }

  // ─── 续跑状态 ─────────────────────────────────────────────
  const existing = artifacts[step.id];
  const existingMeta = (existing?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const targetLoopType = mode === 'draft' ? 'chapter-draft' : 'chapter-polish';
  const isResumable = resume && existing && existingMeta.novelLoop === targetLoopType;

  const completedSet = new Set<number>(
    isResumable && Array.isArray(existingMeta.completedChapters) ? existingMeta.completedChapters : [],
  );
  const chapterContents: Record<number, string> = isResumable && existingMeta.chapterContents
    ? { ...existingMeta.chapterContents } : {};
  const chapterTitles: Record<number, string> = isResumable && existingMeta.chapterTitles
    ? { ...existingMeta.chapterTitles } : {};
  const chapterModesOut: Record<number, NovelPolishMode> = isResumable && existingMeta.chapterModes
    ? { ...existingMeta.chapterModes } : {};
  let failedChapters: NovelChapterLoopMeta['failedChapters'] = isResumable && Array.isArray(existingMeta.failedChapters)
    ? [...existingMeta.failedChapters] : [];
  // P6 章节级批准：继续跑时保留已批准集合，但重写的章节会被自动从集合中移除
  const approvedSet = new Set<number>(
    isResumable && Array.isArray(existingMeta.approvedChapters) ? existingMeta.approvedChapters : [],
  );
  let cumulativeTokens = isResumable ? (existingMeta.cumulativeTokens ?? 0) : 0;
  let cumulativeCost = isResumable ? (existingMeta.cumulativeCost ?? 0) : 0;
  let rollingSummaryCache = isResumable ? existingMeta.rollingSummaryCache : undefined;
  let rollingSummaryCoversThrough = isResumable ? existingMeta.rollingSummaryCoversThrough : undefined;

  const total = chapters.length;
  const t0 = performance.now();

  // ─── 决定本次要跑哪些章 ──────────────────────────────────
  let toRun: ChapterMeta[];
  if (onlyChapters) {
    toRun = chapters.filter((c) => onlyChapters.has(c.index));
  } else {
    toRun = chapters.filter((c) => !completedSet.has(c.index));
    if (typeof opts.upTo === 'number') {
      toRun = toRun.filter((c) => c.index <= opts.upTo!);
    }
  }
  if (toRun.length === 0) {
    if (onlyChapters || typeof opts.upTo === 'number') {
      return assembleChapterArtifact({
        step, chapters, chapterContents, chapterTitles, chapterModesOut,
        completedChapters: [...completedSet],
        approvedChapters: [...approvedSet],
        failedChapters, cumulativeTokens, cumulativeCost,
        rollingSummaryCache, rollingSummaryCoversThrough,
        durationMs: 0, mode: targetLoopType,
      });
    }
    // 全部完成 → 全量重跑
    completedSet.clear();
    for (const k of Object.keys(chapterContents)) delete chapterContents[Number(k)];
    failedChapters = [];
    cumulativeTokens = 0; cumulativeCost = 0;
    approvedSet.clear();   // 全量重跑也应清除所有批准状态
    toRun = [...chapters];
  }
  // 即将重写的章节：撤销其批准
  for (const ch of toRun) approvedSet.delete(ch.index);

  // ─── 主循环 ─────────────────────────────────────────────
  const condenseEvery = opts.condenseEvery ?? 8;
  const recentWindow = opts.recentWindow ?? 5;

  for (const ch of toRun) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    opts.onChapterStart?.(ch, total);

    // ─── 构建 user 消息 ─────────────────────────────────
    const payload = await loadPayload(step);
    const userTemplate = payload.messages.find((m) => m.role === 'user')?.content ?? '';

    let userMsg: string;
    if (mode === 'draft') {
      // 注入 rollingContext + 章节戏点
      const priorChapters: ChapterRecord[] = [];
      for (const c of chapters) {
        if (c.index >= ch.index) break;
        const content = chapterContents[c.index];
        if (content) priorChapters.push({ index: c.index, title: c.title, content });
      }
      // 触发重摘要：每 condenseEvery 章一次（且只在远距区有未摘要章节时）
      const distantBoundary = ch.index - recentWindow;
      const distantHasUncovered = priorChapters.some(
        (c) => c.index < distantBoundary && (rollingSummaryCoversThrough ?? 0) < c.index,
      );
      const reachedRefreshTrigger =
        distantHasUncovered &&
        (rollingSummaryCoversThrough === undefined ||
          ch.index - rollingSummaryCoversThrough >= condenseEvery);
      const rc = await buildRollingContext({
        chapters: priorChapters,
        currentIndex: ch.index,
        recentWindow,
        cachedSummary: reachedRefreshTrigger ? undefined : rollingSummaryCache,
        cacheCoversThrough: reachedRefreshTrigger ? undefined : rollingSummaryCoversThrough,
        settings,
        signal,
        appendIncrementalDelta: true,
      });
      if (rc.condensed && rc.newCondensedSummary) {
        rollingSummaryCache = rc.newCondensedSummary;
        rollingSummaryCoversThrough = rc.newCacheCoversThrough;
        opts.onCondense?.({
          coversThrough: rc.newCacheCoversThrough ?? 0,
          chars: rc.newCondensedSummary.length,
        });
      }

      userMsg = interpolate(userTemplate, {
        project, artifacts,
        rollingContext: rc.rolling,
        chapterIndex: String(ch.index),
        chapterTitle: ch.title,
        chapterBeat: ch.beat ?? '(未指定，请按上下文自由发挥)',
        targetWords: String(ch.targetWords ?? 3500),
        paceTag: ch.paceTag ?? '中速',
        foreshadowOps: ch.foreshadowOps ?? '(无明确指令)',
      } as any);
      // gap-b PR-3 · 注入上一章末角色状态摘要（FR-5.1/5.3 · settings 守卫）
      if (settings.enableCharacterStateExtraction && ch.index > 1) {
        try {
          const prevStates = await listChapterStates(0, ch.index - 1);
          if (prevStates.length > 0) {
            const lines: string[] = [];
            for (const s of prevStates) {
              if (!s.snapshot) continue;
              const sum = s.snapshot.summary ?? '';
              const emo = s.snapshot.emotion ? ` 情绪[${s.snapshot.emotion}]` : '';
              lines.push(`- **${s.characterName}**：${sum}${emo}`);
            }
            const joined = lines.join('\n');
            const summary = joined.length > 1500 ? joined.slice(0, 1500) + '\n...(已截断)' : joined;
            if (summary) userMsg += `\n\n## 截至上一章的角色状态摘要\n${summary}`;
          }
        } catch (e) {
          console.warn('[gap-b] 注入上一章角色状态失败（不阻塞草稿）:', e);
        }
      }
    } else {
      // polish: 用模式前缀 + 单章草稿替换 user 中的 {{ artifacts.novel.6.content }}
      const draft = chapterContents[ch.index]
        ?? findChapterDraftFromArtifact(artifacts['novel.6'], ch.index)
        ?? '';
      if (!draft.trim()) {
        const errStr = `第 ${ch.index} 章草稿尚未生成，无法润色。请先运行 N3.1。`;
        const prev = failedChapters.find((f) => f.chapterIndex === ch.index);
        const retries = (prev?.retries ?? 0) + 1;
        failedChapters = failedChapters.filter((f) => f.chapterIndex !== ch.index);
        failedChapters.push({ chapterIndex: ch.index, error: errStr, retries });
        opts.onChapterFailed?.(ch, errStr, retries);
        continue;
      }
      const polishMode = (opts.polishModes?.[ch.index]) ?? opts.polishModeDefault ?? 'default';
      // 把 N3.2 模板里 {{ artifacts.novel.6.content }} 用单章草稿替换
      // 直接在模板字符串上做就地替换（不修改 prompt 文件）
      const draftBlock = draft.trim();
      const overridingScope = {
        project,
        artifacts: {
          ...artifacts,
          'novel.6': artifacts['novel.6']
            ? { ...artifacts['novel.6'], content: draftBlock }
            : {
              nodeId: 'novel.6', stageId: 'novel', index: 6, title: 'novel.6',
              format: 'markdown' as const, content: draftBlock,
              durationMs: 0, ts: Date.now(),
            },
        },
      };
      let body = interpolate(userTemplate, overridingScope as any);
      userMsg = (POLISH_MODE_PREFIX[polishMode] ?? '') + body;
      chapterModesOut[ch.index] = polishMode;
    }
    userMsg = applyProjectContext(userMsg, project);

    // ─── 调用 LLM ────────────────────────────────────────
    try {
      // 临时构造 ManifestStep 副本不需要 — runStep 内部会再 loadPayload，
      // 但我们已经构建好 userOverride，重复 loadPayload 是冗余开销。
      // 这里保持简单：传 userOverride 让 runStep 跑全流程。
      let art: NodeArtifact;
      if (opts.useBestOfN) {
        const bn = await runStepBestOfN({
          stageId: 'novel',
          step, project, artifacts, settings, signal,
          userOverride: userMsg,
          n: opts.bestOfNCount ?? 3,
          reflection: opts.bestOfNReflection,
          taskBrief: mode === 'draft'
            ? `第 ${ch.index} 章「${ch.title}」草稿（戏点：${ch.beat ?? '未指定'}）`
            : `第 ${ch.index} 章「${ch.title}」润色`,
          onCandidateDelta: (idx, _c, full) => {
            // 流式同时只显示获胜候选 0 的进度（其余在后台并行）
            if (idx === 0) opts.onChapterDelta?.(ch.index, full);
          },
        });
        art = bn.chosen;
      } else {
        art = await runStep({
          stageId: 'novel',
          step, project, artifacts, settings, signal,
          userOverride: userMsg,
          onDelta: (_c, full) => opts.onChapterDelta?.(ch.index, full),
        });
      }
      chapterContents[ch.index] = art.content.trim();
      chapterTitles[ch.index] = ch.title;
      completedSet.add(ch.index);
      failedChapters = failedChapters.filter((f) => f.chapterIndex !== ch.index);
      cumulativeTokens += art.tokens ?? 0;
      cumulativeCost += art.cost ?? 0;
      opts.onChapterDone?.(ch, art.content, total);

      // gap-b PR-3 · N3.2 润色完成后自动提取角色状态（I-6 不阻塞主流程）
      if (mode === 'polish' && settings.enableCharacterStateExtraction) {
        try {
          const sourceArtifacts: ArtifactMap = {
            ...artifacts,
            'novel.7': {
              ...(artifacts['novel.7'] ?? { nodeId: 'novel.7', stageId: 'novel', index: 7, title: 'novel.7', format: 'markdown' as const, content: '', durationMs: 0, ts: Date.now() }),
              meta: { ...(artifacts['novel.7']?.meta ?? {}), chapterContents: { ...chapterContents } },
            },
          };
          const r = await runCharacterStateExtraction({
            project, artifacts: sourceArtifacts, settings,
            projectId: 0, chapterIndex: ch.index, source: 'novel.7', signal,
          });
          if (!r.ok) console.warn('[gap-b] 角色状态提取失败（第 ' + ch.index + ' 章）:', r.error);
        } catch (e) {
          console.warn('[gap-b] 角色状态提取异常（第 ' + ch.index + ' 章不阻塞）:', e);
        }

        // v6 epic · ACE-lite Reflector hook（CK I-8 不阻塞 polish loop）
        if (settings.reflectorThresholds?.enabled) {
          try {
            const { runReflector } = await import('./reflector');
            void runReflector({
              project, artifacts, settings,
              projectId: 0, chapterIndex: ch.index, source: 'novel.7',
              activeModuleIds: [], // PR-2 UI 接入时再传实际 active modules
              signal,
            }).catch((e) => console.warn('[v6] reflector failed (第 ' + ch.index + ' 章不阻塞):', e));
          } catch (e) {
            console.warn('[v6] reflector hook import failed:', e);
          }
        }
      }

      const intermediate = assembleChapterArtifact({
        step, chapters, chapterContents, chapterTitles, chapterModesOut,
        completedChapters: [...completedSet],
        approvedChapters: [...approvedSet],
        failedChapters, cumulativeTokens, cumulativeCost,
        rollingSummaryCache, rollingSummaryCoversThrough,
        durationMs: performance.now() - t0, mode: targetLoopType,
      });
      opts.onProgress?.(intermediate);
    } catch (e: any) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
      const errStr = e?.message ?? String(e);
      const prev = failedChapters.find((f) => f.chapterIndex === ch.index);
      const retries = (prev?.retries ?? 0) + 1;
      failedChapters = failedChapters.filter((f) => f.chapterIndex !== ch.index);
      failedChapters.push({ chapterIndex: ch.index, error: errStr, retries });
      opts.onChapterFailed?.(ch, errStr, retries);

      const intermediate = assembleChapterArtifact({
        step, chapters, chapterContents, chapterTitles, chapterModesOut,
        completedChapters: [...completedSet],
        approvedChapters: [...approvedSet],
        failedChapters, cumulativeTokens, cumulativeCost,
        rollingSummaryCache, rollingSummaryCoversThrough,
        durationMs: performance.now() - t0, mode: targetLoopType,
      });
      opts.onProgress?.(intermediate);
    }
  }

  return assembleChapterArtifact({
    step, chapters, chapterContents, chapterTitles, chapterModesOut,
    completedChapters: [...completedSet],
    approvedChapters: [...approvedSet],
    failedChapters, cumulativeTokens, cumulativeCost,
    rollingSummaryCache, rollingSummaryCoversThrough,
    durationMs: performance.now() - t0, mode: targetLoopType,
  });
}

function assembleChapterArtifact(p: {
  step: ManifestStep;
  chapters: ChapterMeta[];
  chapterContents: Record<number, string>;
  chapterTitles: Record<number, string>;
  chapterModesOut: Record<number, NovelPolishMode>;
  completedChapters: number[];
  /** P6 可选的章节级批准集合 */
  approvedChapters?: number[];
  failedChapters: NovelChapterLoopMeta['failedChapters'];
  cumulativeTokens: number;
  cumulativeCost: number;
  rollingSummaryCache?: string;
  rollingSummaryCoversThrough?: number;
  durationMs: number;
  mode: 'chapter-draft' | 'chapter-polish';
}): NodeArtifact {
  const segments = p.chapters.map((c) => {
    const content = p.chapterContents[c.index];
    const failed = p.failedChapters.find((f) => f.chapterIndex === c.index);
    if (content) {
      return [
        `<!-- chapter ${c.index} · ${c.title} -->`,
        `## 第 ${c.index} 章 · ${c.title}`,
        '',
        content.trim(),
      ].join('\n');
    }
    if (failed) {
      return `## 第 ${c.index} 章 · ${c.title} ⚠ 失败 (${failed.retries} 次)\n\n> ${failed.error}\n`;
    }
    return `## 第 ${c.index} 章 · ${c.title}\n\n_（待生成）_\n`;
  });

  const meta: NovelChapterLoopMeta = {
    novelLoop: p.mode,
    chapterCount: p.chapters.length,
    completedChapters: p.completedChapters.slice().sort((a, b) => a - b),
    chapterContents: p.chapterContents,
    chapterTitles: p.chapterTitles,
    chapterModes: p.mode === 'chapter-polish' ? p.chapterModesOut : undefined,
    failedChapters: p.failedChapters,
    approvedChapters: p.approvedChapters && p.approvedChapters.length > 0
      ? p.approvedChapters.slice().sort((a, b) => a - b)
      : undefined,
    rollingSummaryCache: p.rollingSummaryCache,
    rollingSummaryCoversThrough: p.rollingSummaryCoversThrough,
    cumulativeTokens: p.cumulativeTokens,
    cumulativeCost: p.cumulativeCost,
  };

  return {
    nodeId: p.step.id,
    stageId: 'novel',
    index: p.step.index,
    title: p.step.title,
    format: p.step.outFormat,
    content: segments.join('\n\n'),
    tokens: p.cumulativeTokens,
    cost: p.cumulativeCost,
    durationMs: p.durationMs,
    ts: Date.now(),
    meta: meta as unknown as Record<string, unknown>,
  };
}

/** 从已 assembled 的 novel.6 artifact 中按章号回查单章草稿（润色循环 fallback） */
function findChapterDraftFromArtifact(art: NodeArtifact | undefined, chapterIndex: number): string | null {
  if (!art) return null;
  const meta = (art.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const direct = meta.chapterContents?.[chapterIndex];
  if (direct) return direct;
  // Fallback: 从 content 切分
  const re = new RegExp(`^##\\s*第\\s*${chapterIndex}\\s*章[\\s\\S]*?(?=^##\\s*第\\s*\\d+\\s*章|$)`, 'm');
  const m = art.content.match(re);
  return m ? m[0] : null;
}
