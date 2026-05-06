/**
 * 章节自动校验（v2 阶段 2.4）
 *
 * 作用：在章节生成完成 / 用户预览时，对章节正文做一组「便宜的」纯前端检查，
 * 输出可视化问题清单。**不调用 LLM，零成本，毫秒级返回**。
 *
 * 维度：
 *   1) 题材锚点（GENRE_ANCHORS）·  mustAvoid 命中 → error；mustInclude 覆盖率 → info
 *   2) AI 套话黑名单（来自 anti-ai-flavor 简化版） → warning
 *   3) 章节长度（相对 ctx.novelPlatform.wordsPerChapter 与 anchor.paragraphLength） → info
 *   4) 对话比例（相对 anchor.dialogueRatio） → warning
 *   5) 章末钩子（启用 webfiction-pacing-pack / three-density-review 时强校验） → warning
 *
 * 设计原则：
 *   - 仅做正则 / 计数级检测，不做语义判断。模糊命中宁愿漏报也不要假阳性。
 *   - 所有阈值均在文件顶部可调常量里，便于后续微调。
 *   - 缺 ctx 字段或 anchor 时静默降级（不抛异常、不输出乱报）。
 */

import { GENRES, type GenreAnchor } from '../data/projectTaxonomy';
import type { ProjectContext } from './types';

/* ─── 类型 ───────────────────────────────────────────────────── */

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  /** 类别 id，UI 用于分组 / 图标 */
  kind:
    | 'genre.mustAvoid'
    | 'genre.mustInclude'
    | 'craft.aiFlavor'
    | 'pace.lengthShort'
    | 'pace.lengthLong'
    | 'pace.paragraphSize'
    | 'pace.dialogueRatio'
    | 'pace.endingHook';
  /** 简短中文说明（≤ 50 字） */
  message: string;
  /** 命中的关键证据（最多 3 项），UI 可高亮显示 */
  evidence?: string[];
  /** 一句修复建议（可选） */
  fixHint?: string;
}

export interface ValidateChapterOptions {
  /** 章节正文 */
  text: string;
  /** 项目 ctx（用题材锚点 + 平台字数） */
  ctx?: Partial<ProjectContext>;
  /** 已启用方法论模块 id 列表（决定钩子等强约束是否启用） */
  enabledModuleIds?: string[];
}

/* ─── 阈值常量 ────────────────────────────────────────────────── */

/**
 * AI 套话/AI 腔黑名单（来自 anti-ai-flavor 工艺包简化版 + 中文写作社区共识）。
 * 命中 ≥3 次或单条命中 ≥2 次即触发 warning。
 */
const AI_FLAVOR_PHRASES: string[] = [
  '不禁',
  '心想道',
  '暗自',
  '心头一震',
  '千言万语',
  '情不自禁',
  '一时间',
  '默默地',
  '与此同时',
  '紧接着',
  '不由得',
  '若有所思',
  '微微一笑',
  '心中一动',
  '不约而同',
  '油然而生',
];

/** 钩子识别启用模块白名单 */
const HOOK_REQUIRED_MODULES = new Set([
  'webfiction-pacing-pack',
  'three-density-review',
  'twelve-step-mystery',
  'seven-emotion-peaks',
]);

/** 章末钩子常见信号（任一命中即视为有钩子） */
const HOOK_SIGNALS_REGEX = /[？?！!…][」"』')）]?\s*$|[？?！!…]\s*[」"』')）]?\s*$|(?:可是|然而|但是|就在这时|话音未落|正当|忽然|蓦地)[^。.]{0,20}(?:[。.！!？?…]|$)/;

/* ─── 工具 ────────────────────────────────────────────────────── */

/** 估算中文字数（去掉空白字符与 ASCII 标点，统计剩余字符数） */
function countChars(s: string): number {
  return s.replace(/[\s\r\n]+/g, '').length;
}

/** 切段（按双换行或单换行段落）返回非空段落列表 */
function paragraphs(s: string): string[] {
  return s
    .split(/\r?\n\r?\n+|\r?\n/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** 估算对话字符占比：被中/英文双引号包裹的连续片段总字数 / 总字数 */
function estimateDialogueRatio(s: string): number {
  const total = countChars(s);
  if (total === 0) return 0;
  // 匹配中文「」、英文 ""、中文 ""
  const re = /[「""'""][^「」""'""]+[」""'""]/g;
  let dialog = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    dialog += countChars(m[0]);
  }
  return Math.min(1, dialog / total);
}

/** 合并 ctx.genres 上的 anchor（取并集；mustAvoid / mustInclude 简单去重） */
function mergeAnchors(genres: string[]): GenreAnchor | null {
  const anchors = genres
    .map((g) => GENRES.find((x) => x.value === g)?.anchor)
    .filter((x): x is GenreAnchor => !!x);
  if (anchors.length === 0) return null;
  const out: GenreAnchor = {};
  const mustAvoid = new Set<string>();
  const mustInclude = new Set<string>();
  for (const a of anchors) {
    a.mustAvoid?.forEach((x) => mustAvoid.add(x));
    a.mustInclude?.forEach((x) => mustInclude.add(x));
    if (out.paragraphLength == null && a.paragraphLength) out.paragraphLength = a.paragraphLength;
    if (out.dialogueRatio == null && a.dialogueRatio) out.dialogueRatio = a.dialogueRatio;
  }
  if (mustAvoid.size) out.mustAvoid = [...mustAvoid];
  if (mustInclude.size) out.mustInclude = [...mustInclude];
  return out;
}

/** 平台 → 默认章节字数（用于 length 校验，缺失时回退 3000） */
function platformChapterWords(platform?: string): number {
  switch (platform) {
    case 'qidian':
    case 'zongheng':
      return 3500;
    case '17k':
      return 3000;
    case 'jjwxc':
      return 3500;
    case 'fanqie':
      return 2500;
    default:
      return 3000;
  }
}

/* ─── 主函数 ─────────────────────────────────────────────────── */

/**
 * 对章节正文做静态校验。返回问题列表（可能为空）。
 *
 * 顺序：mustAvoid（强）→ AI 套话 → 长度 → 对话比例 → 段落 → 钩子 → mustInclude 覆盖率
 */
export function validateChapter(opts: ValidateChapterOptions): ValidationIssue[] {
  const { text, ctx, enabledModuleIds = [] } = opts;
  const issues: ValidationIssue[] = [];
  if (!text || text.trim().length === 0) return issues;

  const totalChars = countChars(text);
  const anchor = mergeAnchors(ctx?.genres ?? []);

  /* 1) 题材 mustAvoid 命中（强 error） */
  if (anchor?.mustAvoid?.length) {
    const hits: string[] = [];
    for (const phrase of anchor.mustAvoid) {
      const trimmed = phrase.trim();
      if (trimmed.length === 0) continue;
      if (text.includes(trimmed)) hits.push(trimmed);
    }
    if (hits.length > 0) {
      issues.push({
        severity: 'error',
        kind: 'genre.mustAvoid',
        message: `题材污染：命中 ${hits.length} 个题材禁忌词`,
        evidence: hits.slice(0, 6),
        fixHint: '此类词汇被题材锚点列入禁用清单，需替换为符合题材调性的表达。',
      });
    }
  }

  /* 2) AI 套话黑名单（warning） */
  {
    const phraseHits: { p: string; n: number }[] = [];
    for (const p of AI_FLAVOR_PHRASES) {
      const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const n = (text.match(re) ?? []).length;
      if (n > 0) phraseHits.push({ p, n });
    }
    const totalAi = phraseHits.reduce((s, x) => s + x.n, 0);
    const hasHeavySingle = phraseHits.some((x) => x.n >= 2);
    if (totalAi >= 3 || hasHeavySingle) {
      const top = phraseHits.sort((a, b) => b.n - a.n).slice(0, 5);
      issues.push({
        severity: 'warning',
        kind: 'craft.aiFlavor',
        message: `检测到 AI 套话密度偏高（共 ${totalAi} 处命中）`,
        evidence: top.map((x) => `${x.p}×${x.n}`),
        fixHint: '可启用 anti-ai-flavor 工艺模块，或在润色时把这些短语替换为具体动作 / 感官描写。',
      });
    }
  }

  /* 3) 章节长度 */
  {
    const target = platformChapterWords(ctx?.novelPlatform);
    if (totalChars < Math.round(target * 0.5)) {
      issues.push({
        severity: 'info',
        kind: 'pace.lengthShort',
        message: `章节字数 ${totalChars}，明显短于平台目标（${target} 字）`,
        fixHint: '若不是过渡章 / 番外，建议补充场景或扩写动作 / 心理戏。',
      });
    } else if (totalChars > Math.round(target * 1.8)) {
      issues.push({
        severity: 'info',
        kind: 'pace.lengthLong',
        message: `章节字数 ${totalChars}，明显长于平台目标（${target} 字）`,
        fixHint: '可考虑拆章或精简过渡段落，避免读者翻屏疲劳。',
      });
    }
  }

  /* 4) 对话比例（仅在 anchor 提供 dialogueRatio 时检测） */
  if (anchor?.dialogueRatio != null) {
    const target = anchor.dialogueRatio / 100; // anchor 单位是百分比
    const actual = estimateDialogueRatio(text);
    const diff = actual - target;
    if (Math.abs(diff) > 0.18) {
      issues.push({
        severity: 'warning',
        kind: 'pace.dialogueRatio',
        message: `对话占比 ${(actual * 100).toFixed(0)}% ${diff > 0 ? '高于' : '低于'}题材建议（${anchor.dialogueRatio}%）`,
        fixHint: diff > 0
          ? '可把部分对话压缩为动作 / 神态描写，让画面感更强。'
          : '可把部分内心戏 / 旁白改写为对白，提升节奏感。',
      });
    }
  }

  /* 5) 段落平均字数（仅在 anchor 提供 paragraphLength 时） */
  if (anchor?.paragraphLength != null) {
    const ps = paragraphs(text);
    if (ps.length > 0) {
      const avg = totalChars / ps.length;
      const target = anchor.paragraphLength;
      if (avg > target * 2.0) {
        issues.push({
          severity: 'info',
          kind: 'pace.paragraphSize',
          message: `平均段落 ${avg.toFixed(0)} 字，远超题材建议（${target} 字）`,
          fixHint: '过长段落让读者疲劳，建议每个动作 / 视角切换处分段。',
        });
      } else if (avg < target * 0.4 && ps.length > 8) {
        issues.push({
          severity: 'info',
          kind: 'pace.paragraphSize',
          message: `平均段落 ${avg.toFixed(0)} 字，过于碎片化（题材建议 ${target} 字）`,
          fixHint: '过短段落让叙事节奏过快，可合并紧密相关的句子。',
        });
      }
    }
  }

  /* 6) 章末钩子（启用了爽文 / 悬疑节奏类模块时） */
  {
    const hookRequired = enabledModuleIds.some((id) => HOOK_REQUIRED_MODULES.has(id));
    if (hookRequired) {
      // 取最后 1-2 段落判断
      const ps = paragraphs(text);
      const tail = ps.slice(-2).join('\n');
      const trimmedTail = tail.trim();
      const hasHook = HOOK_SIGNALS_REGEX.test(trimmedTail)
        // 末标点是中文「。」且不是问号叹号 → 视为陈述结尾，扣分
        && !/[。.][」"』')）]?\s*$/.test(trimmedTail);
      if (!hasHook) {
        issues.push({
          severity: 'warning',
          kind: 'pace.endingHook',
          message: '章末缺少明显钩子（陈述句结尾）',
          evidence: [trimmedTail.slice(-60)],
          fixHint: '可改为悬念问句 / 突发事件中断 / 名场面截断，让读者带着问题进入下一章。',
        });
      }
    }
  }

  /* 7) mustInclude 覆盖率（info，不强制） */
  if (anchor?.mustInclude?.length) {
    const total = anchor.mustInclude.length;
    const matched = anchor.mustInclude.filter((p) => text.includes(p.trim()));
    const ratio = matched.length / total;
    // 单章不要求每个都覆盖；只在 ratio < 20% 时给提示
    if (ratio < 0.2) {
      const missing = anchor.mustInclude.filter((p) => !text.includes(p.trim()));
      issues.push({
        severity: 'info',
        kind: 'genre.mustInclude',
        message: `题材必备元素覆盖率 ${(ratio * 100).toFixed(0)}%（${matched.length}/${total}）`,
        evidence: missing.slice(0, 4),
        fixHint: '题材锚点中的"必备元素"建议在全书层面累计覆盖，单章可酌情考虑。',
      });
    }
  }

  return issues;
}

/** 统计辅助：返回各 severity 的计数，便于 UI 顶栏显示数字徽章 */
export function summarizeIssues(issues: ValidationIssue[]): { error: number; warning: number; info: number } {
  return issues.reduce(
    (acc, i) => ({ ...acc, [i.severity]: acc[i.severity] + 1 }),
    { error: 0, warning: 0, info: 0 },
  );
}

