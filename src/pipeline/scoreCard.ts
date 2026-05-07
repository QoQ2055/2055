// 节点级评分系统（v2 阶段 2.9）
//
// 在"生成完 / R9 完 / 修改完"三个时机给当前 artifact 算一份 6 维分。
// 4 维纯前端规则（题材 / 方法论 / KB 红线 / 文笔），2 维 LLM 评判（R1 对齐 / 用户 KB 风格）。
//
// 与 selfCheck.ts 的区别：
//   - selfCheck = "诊断 + 列 issue"，主要给 LLM 修复用
//   - scoreCard = "量化打分 + delta 对比"，主要给用户看
//
// 数据流：runScoreCard(opts) → 写入 artifact.meta.scoreCard + 历史栈 scoreCardHistory[]
// UI：见 src/components/ScoreCardBadge.tsx

import { chatStream } from '../llm/deepseek';
import { findGenreAnchor, findGenre } from '../data/projectTaxonomy';
import { listUserKbDocsForProject, type UserKbDoc } from '../store/userKb';
import { validateChapter } from './chapterValidation';
import { MODULE_SCORE_CHECKS, type ModuleScoreCheck } from './scoreCardModuleChecks';
import { R1_NODE_ID } from './editorial';
import type { NodeArtifact, ArtifactMap, ProjectContext } from './types';
import type { SettingsState } from '../store/settings';

/* ── 类型 ─────────────────────────────────────────────────────── */

export type ScoreDimension =
  | 'genre'         // 1. 题材契合
  | 'method'        // 2. 方法论遵循
  | 'kbRedline'     // 3. KB 红线
  | 'craft'         // 4. 文笔基础
  | 'r1Align'       // 5. R1 指令书对齐 (LLM)
  | 'userKbStyle'   // 6. 用户 KB 风格 (LLM)
  | 'transition';   // 7. 章节衔接顺畅度 (LLM · gap-c)

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  'genre', 'method', 'kbRedline', 'craft', 'r1Align', 'userKbStyle',
  'transition',
];

export const SCORE_DIMENSION_LABELS: Record<ScoreDimension, string> = {
  genre: '题材',
  method: '方法',
  kbRedline: 'KB',
  craft: '文笔',
  r1Align: 'R1',
  userKbStyle: '风格',
  transition: '衔接',
};

export const SCORE_DIMENSION_LONG_LABELS: Record<ScoreDimension, string> = {
  genre: '题材契合',
  method: '方法论遵循',
  kbRedline: 'KB 红线',
  craft: '文笔基础',
  r1Align: 'R1 指令书对齐',
  userKbStyle: '用户 KB 风格',
  transition: '章节衔接顺畅度',
};

export interface ScoreIssue {
  dimension: ScoreDimension;
  severity: 'major' | 'minor' | 'info';
  /** 简短中文说明（≤ 50 字） */
  message: string;
  /** 命中证据（最多 3 项） */
  evidence?: string[];
  /** 该 issue 扣分量 */
  penalty: number;
}

export interface DimensionScore {
  /** 0-100 */
  score: number;
  /** 维度子说明（"6/7 钩子段落达标" 等） */
  summary?: string;
  issues: ScoreIssue[];
  /** 该维度是否真实评分；不适用时 score=100 / inactive=true（不计入扣分） */
  inactive?: boolean;
}

export type DimensionWeights = Record<ScoreDimension, number>;

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  genre: 1,
  method: 1,
  kbRedline: 1,
  craft: 1,
  r1Align: 1,
  userKbStyle: 1,
  transition: 1,
};

export interface ScoreCard {
  /** 0-100 加权综合分 */
  total: number;
  /** 6 维子分 */
  dimensions: Record<ScoreDimension, DimensionScore>;
  ts: number;
  /** 是否包含 LLM 评分（false 时 r1Align / userKbStyle 维度为占位） */
  llmEvaluated: boolean;
  durationMs: number;
}

export interface ScoreCardOptions {
  artifact: NodeArtifact;
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  weights?: DimensionWeights;
  /** true 时跳过 LLM 2 维（debounce 期间快速预览用） */
  skipLlm?: boolean;
  signal?: AbortSignal;
  /**
   * gap-c · 上一章原文（末尾 ≈ 300 字可判）。
   * 提供时启动 transition 第 7 维评分；未提供 / 第 1 章 → inactive 占位。
   */
  prevChapterContent?: string;
}

/* ── 工具：合成总分（加权平均；inactive 维度自动从分母中剔除） ─── */

export function computeTotal(
  dims: Record<ScoreDimension, DimensionScore>,
  weights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS,
): number {
  let num = 0, den = 0;
  for (const d of SCORE_DIMENSIONS) {
    const ds = dims[d];
    if (ds.inactive) continue;
    const w = weights[d] ?? 1;
    num += ds.score * w;
    den += w;
  }
  return den === 0 ? 100 : Math.round(num / den);
}

/* ── 维度 1: 题材契合 ─────────────────────────────────────────── */

function scoreGenre(content: string, genres: string[] | undefined): DimensionScore {
  if (!genres || genres.length === 0) {
    return { score: 100, inactive: true, issues: [], summary: '未配置题材' };
  }
  const anchors = genres
    .map((v) => ({ label: findGenre(v)?.label ?? v, anchor: findGenreAnchor(v) }))
    .filter((x) => x.anchor);
  if (anchors.length === 0) {
    return { score: 100, inactive: true, issues: [], summary: '题材无锚点配置' };
  }

  // 合并 mustInclude / mustAvoid（去重）
  const dedup = (xs: string[]) => Array.from(new Set(xs.map((s) => s.trim()).filter(Boolean)));
  const allMustInclude = dedup(anchors.flatMap((a) => a.anchor!.mustInclude ?? []));
  const allMustAvoid = dedup(anchors.flatMap((a) => a.anchor!.mustAvoid ?? []));

  const issues: ScoreIssue[] = [];
  let score = 100;

  // mustAvoid 命中：每条 -8
  const avoidHits: string[] = [];
  for (const phrase of allMustAvoid) {
    if (!phrase) continue;
    if (content.includes(phrase)) {
      avoidHits.push(phrase);
    }
  }
  if (avoidHits.length > 0) {
    const penalty = Math.min(60, avoidHits.length * 8);
    score -= penalty;
    issues.push({
      dimension: 'genre',
      severity: 'major',
      message: `命中题材 mustAvoid ${avoidHits.length} 项`,
      evidence: avoidHits.slice(0, 3),
      penalty,
    });
  }

  // mustInclude 缺失：每缺一条 -5（上限 25）
  if (allMustInclude.length > 0) {
    const hits = allMustInclude.filter((p) => content.includes(p));
    const missCount = allMustInclude.length - hits.length;
    if (missCount > 0) {
      const penalty = Math.min(25, missCount * 5);
      score -= penalty;
      issues.push({
        dimension: 'genre',
        severity: missCount >= allMustInclude.length / 2 ? 'major' : 'minor',
        message: `mustInclude 仅 ${hits.length}/${allMustInclude.length} 命中`,
        evidence: allMustInclude.filter((p) => !content.includes(p)).slice(0, 3),
        penalty,
      });
    }
  }

  return {
    score: Math.max(0, score),
    summary: `${anchors.map((a) => a.label).join(' + ')} · mustInclude ${allMustInclude.length - avoidHits.length}/${allMustInclude.length} · mustAvoid ${avoidHits.length} 违反`,
    issues,
  };
}

/* ── 维度 2: 方法论遵循 ──────────────────────────────────────── */

function applyModuleCheck(check: ModuleScoreCheck, content: string): {
  pass: boolean;
  hitCount: number;
  evidence: string[];
} {
  // 用 RegExp + 全局标志统计命中
  const re = new RegExp(check.pattern, check.flags ?? 'g');
  const matches = Array.from(content.matchAll(re));
  const hitCount = matches.length;
  const evidence = matches
    .slice(0, 3)
    .map((m) => (m[0] ?? '').slice(0, 30))
    .filter(Boolean);
  let pass: boolean;
  if (check.kind === 'min') pass = hitCount >= (check.min ?? 1);
  else if (check.kind === 'max') pass = hitCount <= (check.max ?? 0);
  else if (check.kind === 'range') {
    pass = hitCount >= (check.min ?? 1) && hitCount <= (check.max ?? Infinity);
  } else pass = hitCount > 0; // 'present'
  return { pass, hitCount, evidence };
}

function scoreMethod(
  content: string,
  enabledIds: string[] | undefined,
  nodeId: string,
): DimensionScore {
  const ids = enabledIds ?? [];
  if (ids.length === 0) {
    return { score: 100, inactive: true, issues: [], summary: '未启用方法论模块' };
  }

  const issues: ScoreIssue[] = [];
  let totalChecks = 0;
  let passedChecks = 0;
  const moduleSummaries: string[] = [];

  for (const moduleId of ids) {
    const checks = MODULE_SCORE_CHECKS[moduleId];
    if (!checks || checks.length === 0) continue;
    // 仅跑该模块声明可应用到本节点的 check
    const applicable = checks.filter((c) => !c.appliesTo || c.appliesTo.includes(nodeId));
    if (applicable.length === 0) continue;

    let modPassed = 0;
    for (const check of applicable) {
      totalChecks++;
      const res = applyModuleCheck(check, content);
      if (res.pass) {
        passedChecks++;
        modPassed++;
      } else {
        issues.push({
          dimension: 'method',
          severity: check.severity ?? 'minor',
          message: `${moduleId}: ${check.label} 未达标（命中 ${res.hitCount}）`,
          evidence: res.evidence,
          penalty: check.severity === 'major' ? 12 : 6,
        });
      }
    }
    moduleSummaries.push(`${moduleId} ${modPassed}/${applicable.length}`);
  }

  if (totalChecks === 0) {
    return { score: 100, inactive: true, issues: [], summary: '启用模块对本节点无 scoreChecks' };
  }

  const passRate = passedChecks / totalChecks;
  const score = Math.round(100 * passRate);
  return {
    score,
    summary: `${passedChecks}/${totalChecks} 检查通过 · ${moduleSummaries.join(' / ')}`,
    issues,
  };
}

/* ── 维度 3: KB 红线 ──────────────────────────────────────────── */

// 静态 KB 提炼的高频违反点（去 AI 味 + 反装饰）
const AI_FLAVOR_PHRASES = [
  '不禁', '心想道', '暗自', '心头一震', '千言万语', '情不自禁',
  '一时间', '默默地', '与此同时', '紧接着', '不由得',
  '若有所思', '微微一笑', '心中一动', '不约而同', '油然而生',
];

const DECORATION_RE = /\*\*[^*\n]+\*\*|\*[^*\n]+\*|^>\s/m;

function scoreKbRedline(content: string, nodeId: string): DimensionScore {
  const issues: ScoreIssue[] = [];
  let score = 100;

  // AI 味命中（每个短语命中 ≥ 2 次或总命中 > 5 触发）
  const flavorHits: { phrase: string; count: number }[] = [];
  let flavorTotal = 0;
  for (const phrase of AI_FLAVOR_PHRASES) {
    const re = new RegExp(phrase, 'g');
    const count = (content.match(re) ?? []).length;
    if (count > 0) flavorHits.push({ phrase, count });
    flavorTotal += count;
  }
  if (flavorTotal >= 5) {
    const penalty = Math.min(30, (flavorTotal - 4) * 4);
    score -= penalty;
    const top = [...flavorHits].sort((a, b) => b.count - a.count).slice(0, 3);
    issues.push({
      dimension: 'kbRedline',
      severity: 'major',
      message: `AI 套话总命中 ${flavorTotal} 次（阈值 5）`,
      evidence: top.map((t) => `${t.phrase}×${t.count}`),
      penalty,
    });
  } else if (flavorTotal >= 3) {
    score -= 8;
    issues.push({
      dimension: 'kbRedline',
      severity: 'minor',
      message: `AI 套话命中 ${flavorTotal} 次，临近警戒线`,
      evidence: flavorHits.slice(0, 3).map((t) => `${t.phrase}×${t.count}`),
      penalty: 8,
    });
  }

  // 反装饰：仅对 JSON 节点强检（创作节点容忍少量 markdown）
  const isJsonNode = /^assets\.\d+$|^storyboard\.1$/.test(nodeId);
  if (isJsonNode && DECORATION_RE.test(content)) {
    const samples = (content.match(/\*\*[^*\n]{1,20}\*\*|\*[^*\n]{1,20}\*/g) ?? []).slice(0, 3);
    score -= 15;
    issues.push({
      dimension: 'kbRedline',
      severity: 'major',
      message: 'JSON 节点字段值含 markdown 装饰',
      evidence: samples,
      penalty: 15,
    });
  }

  return {
    score: Math.max(0, score),
    summary: flavorTotal > 0 ? `AI 套话 ${flavorTotal} 处` : '无明显 KB 红线违反',
    issues,
  };
}

/* ── 维度 4: 文笔基础（复用 chapterValidation） ────────────────── */

function scoreCraft(
  content: string,
  project: ProjectContext,
  enabledIds: string[] | undefined,
): DimensionScore {
  const validationIssues = validateChapter({
    text: content,
    ctx: project,
    enabledModuleIds: enabledIds,
  });

  const issues: ScoreIssue[] = [];
  let score = 100;
  for (const v of validationIssues) {
    const penalty = v.severity === 'error' ? 15 : v.severity === 'warning' ? 5 : 1;
    score -= penalty;
    issues.push({
      dimension: 'craft',
      severity: v.severity === 'error' ? 'major' : v.severity === 'warning' ? 'minor' : 'info',
      message: v.message,
      evidence: v.evidence?.slice(0, 3),
      penalty,
    });
  }

  return {
    score: Math.max(0, score),
    summary: validationIssues.length === 0
      ? '通过全部 7 类纯前端规则'
      : `${validationIssues.length} 项校验问题`,
    issues,
  };
}

/* ── 维度 5+6: LLM 合并评分（一次调用返回 R1 对齐 + 用户 KB 风格） ── */

interface LlmCombinedResult {
  r1Align: DimensionScore;
  userKbStyle: DimensionScore;
}

async function scoreLlmCombined(
  artifact: NodeArtifact,
  project: ProjectContext,
  artifacts: ArtifactMap,
  settings: SettingsState,
  signal?: AbortSignal,
): Promise<LlmCombinedResult> {
  const r1 = artifacts[R1_NODE_ID];
  let userKbDocs: UserKbDoc[] = [];
  if (project.userKbDocIds?.length) {
    try {
      userKbDocs = await listUserKbDocsForProject(project.userKbDocIds);
    } catch {
      userKbDocs = [];
    }
  }
  const styleDocs = userKbDocs.filter((d) => d.type === 'styleGuide' || d.type === 'sample' || d.type === 'antiPattern');

  // 缺数据时给 inactive 占位
  const r1Inactive = !r1 || !r1.content;
  const styleInactive = styleDocs.length === 0;

  if (r1Inactive && styleInactive) {
    return {
      r1Align: { score: 100, inactive: true, issues: [], summary: '无 R1 指令书' },
      userKbStyle: { score: 100, inactive: true, issues: [], summary: '未绑定用户 KB 风格资料' },
    };
  }

  const sys = [
    '你是一名内容评分员，对一份产物输出**严格的 JSON 评分结果**，不带 markdown 围栏，不带任何说明。',
    '',
    '## 任务',
    '同时评估两个维度（每维度独立打分 0-100）：',
    '1. r1Align：产物对 R1 创作指令书的遵循度（主题锚点 / 钩子策略 / doNots / mustKeep）',
    '2. userKbStyle：产物与用户 KB 风格资料的匹配度（styleGuide 命中 / antiPattern 规避 / sample 接近）',
    '',
    '若该维度数据缺失（无 R1 / 无样本），则该维度 score=100 且 inactive=true。',
    '',
    '## 输出 schema（必须严格 JSON）',
    '{',
    '  "r1Align":     { "score": 0-100, "inactive": false, "summary": "<= 30 字总评", "issues": [{"severity":"major|minor|info","message":"...","evidence":["..."]}] },',
    '  "userKbStyle": { "score": 0-100, "inactive": false, "summary": "<= 30 字总评", "issues": [...] }',
    '}',
    '',
    '## 评分原则',
    '- 不写空泛"好/不好"，每条 issue 必须给具体证据（产物中的 1-3 个短语 / 段落片段）',
    '- 缺数据维度 inactive=true，不要硬猜',
    '- issues 数量精简，最多 3 条/维',
  ].join('\n');

  const r1Content = r1Inactive ? '（未配置 R1 创作指令书）' : (r1!.content.length > 2000 ? r1!.content.slice(0, 2000) + '\n...(已截断)' : r1!.content);
  const styleSection = styleInactive
    ? '（未绑定用户 KB 风格资料）'
    : styleDocs.slice(0, 4).map((d) => {
        const body = (d.rawContent ?? '').slice(0, 800);
        return `### [${d.type}] ${d.title ?? '(无标题)'}\n${body}`;
      }).join('\n\n');

  const user = [
    `# 待评产物 · ${artifact.nodeId} · ${artifact.title}`,
    '```',
    artifact.content.length > 6000 ? artifact.content.slice(0, 6000) + '\n...(已截断)' : artifact.content,
    '```',
    '',
    '# R1 创作指令书',
    r1Content,
    '',
    '# 用户 KB 风格资料',
    styleSection,
    '',
    '请按 schema 输出 JSON。',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
    temperature: 0,
    max_tokens: 1024,
    signal,
  });

  const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch (e: any) {
    throw new Error(`scoreCard LLM JSON 解析失败：${e?.message ?? e}\n原始前 200 字：${stripped.slice(0, 200)}`);
  }

  const norm = (raw: any, dim: ScoreDimension, fallbackInactive: boolean): DimensionScore => {
    if (!raw || typeof raw !== 'object') {
      return { score: 100, inactive: fallbackInactive, issues: [], summary: '解析失败' };
    }
    const score = Math.max(0, Math.min(100, Number(raw.score ?? 100)));
    const issues = Array.isArray(raw.issues)
      ? raw.issues.slice(0, 3).map((i: any): ScoreIssue => ({
          dimension: dim,
          severity: ['major', 'minor', 'info'].includes(i.severity) ? i.severity : 'minor',
          message: String(i.message ?? '').slice(0, 80),
          evidence: Array.isArray(i.evidence) ? i.evidence.slice(0, 3).map((e: any) => String(e)) : undefined,
          penalty: 100 - score,
        }))
      : [];
    return {
      score,
      inactive: !!raw.inactive || fallbackInactive,
      summary: String(raw.summary ?? '').slice(0, 60) || undefined,
      issues,
    };
  };

  return {
    r1Align: norm(parsed.r1Align, 'r1Align', r1Inactive),
    userKbStyle: norm(parsed.userKbStyle, 'userKbStyle', styleInactive),
  };
}

/* ── 维度 7: 章节衔接顺畅度（LLM · gap-c）─────────────────── */

async function scoreTransition(
  currentChapterContent: string,
  prevChapterContent: string,
  settings: SettingsState,
  signal?: AbortSignal,
): Promise<DimensionScore> {
  // 取上一章末尾 + 本章开头各 ~300 字评判衔接
  const prevTail = prevChapterContent.trim().slice(-300);
  const currentOpening = currentChapterContent.trim().slice(0, 300);
  if (prevTail.length === 0 || currentOpening.length === 0) {
    return { score: 100, inactive: true, issues: [], summary: '文本不足以评判' };
  }

  const sys = [
    '你是网络小说衔接评审师。评估"本章开头"与"上一章末尾"的衔接顺畅度。',
    '',
    '## 评分维度',
    '- 时空衔接：地点 / 时间过渡是否自然',
    '- 情绪衔接：人物情绪是否合理延续',
    '- 视点衔接：POV 切换是否流畅',
    '- 节奏衔接：开头节奏是否承上启下',
    '',
    '## 输出严格 JSON（无 markdown 围栏）',
    '{ "score": 0-100, "summary": "一句话评价 ≤ 30 字", "issues": [{"severity":"major|minor|info","message":"...","evidence":["..."]}] }',
    '',
    '## 评分原则',
    '- ≥ 80 自然 / 60-80 可改 / < 60 硬切',
    '- issues ≤ 2 条，每条含具体证据（原文短语）',
    '- 如本章是首章或不需衔接，返回 inactive=true',
  ].join('\n');

  const user = [
    '## 上一章末尾',
    prevTail,
    '',
    '## 本章开头',
    currentOpening,
    '',
    '请按 schema 输出 JSON。',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: 400,
    signal,
  });

  const stripped = res.content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch (e: any) {
    throw new Error(`transition JSON 解析失败：${e?.message ?? e}\n原始前 200 字：${stripped.slice(0, 200)}`);
  }

  const score = Math.max(0, Math.min(100, Number(parsed.score ?? 100)));
  const issues: ScoreIssue[] = Array.isArray(parsed.issues)
    ? parsed.issues.slice(0, 2).map((i: any): ScoreIssue => ({
        dimension: 'transition',
        severity: ['major', 'minor', 'info'].includes(i.severity) ? i.severity : 'minor',
        message: String(i.message ?? '').slice(0, 80),
        evidence: Array.isArray(i.evidence) ? i.evidence.slice(0, 3).map((e: any) => String(e)) : undefined,
        penalty: 100 - score,
      }))
    : [];

  return {
    score,
    inactive: !!parsed.inactive,
    summary: String(parsed.summary ?? '').slice(0, 60) || undefined,
    issues,
  };
}

/* ── 主入口 ───────────────────────────────────────────────────── */

export async function runScoreCard(opts: ScoreCardOptions): Promise<ScoreCard> {
  const t0 = performance.now();
  const { artifact, project, artifacts, settings, weights, skipLlm, signal, prevChapterContent } = opts;
  const w = weights ?? DEFAULT_DIMENSION_WEIGHTS;

  // 4 个前端维度（同步，<10ms）
  const genre = scoreGenre(artifact.content, project.genres);
  const method = scoreMethod(artifact.content, project.methodModuleIds, artifact.nodeId);
  const kbRedline = scoreKbRedline(artifact.content, artifact.nodeId);
  const craft = scoreCraft(artifact.content, project, project.methodModuleIds);

  // 2 个 LLM 维度（可跳过）
  let r1Align: DimensionScore = { score: 100, inactive: true, issues: [], summary: '未评分' };
  let userKbStyle: DimensionScore = { score: 100, inactive: true, issues: [], summary: '未评分' };
  let llmEvaluated = false;
  if (!skipLlm && settings.apiKey) {
    try {
      const res = await scoreLlmCombined(artifact, project, artifacts, settings, signal);
      r1Align = res.r1Align;
      userKbStyle = res.userKbStyle;
      llmEvaluated = true;
    } catch (e) {
      console.warn('[scoreCard] LLM 维度评分失败，前 4 维仍可用：', e);
      // 失败时保持 inactive 占位
    }
  }

  // gap-c · 第 7 维 transition：仅在提供 prevChapterContent + apiKey + 不跳 LLM 时含化
  let transition: DimensionScore = { score: 100, inactive: true, issues: [], summary: '第一章无衔接对象' };
  if (!skipLlm && settings.apiKey && opts.prevChapterContent && opts.prevChapterContent.trim().length > 0) {
    try {
      transition = await scoreTransition(artifact.content, opts.prevChapterContent, settings, signal);
      llmEvaluated = true;
    } catch (e) {
      console.warn('[scoreCard] transition 维度评分失败：', e);
      transition = { score: 100, inactive: true, issues: [], summary: '评分失败' };
    }
  }

  const dimensions: Record<ScoreDimension, DimensionScore> = {
    genre, method, kbRedline, craft, r1Align, userKbStyle, transition,
  };
  const total = computeTotal(dimensions, w);

  return {
    total,
    dimensions,
    ts: Date.now(),
    llmEvaluated,
    durationMs: performance.now() - t0,
  };
}

/* ── 写入 artifact.meta + 历史栈管理 ─────────────────────────── */

const MAX_HISTORY = 5;

/**
 * 计算 delta 用：返回上一份 ScoreCard（artifact.meta.scoreCard）。
 */
export function previousScoreCard(artifact: NodeArtifact): ScoreCard | undefined {
  return (artifact.meta as any)?.scoreCard;
}

/**
 * 把新 ScoreCard 写到 artifact.meta.scoreCard，并把上一份压入 scoreCardHistory[]（保留最近 5 次）。
 * 调用方负责 upsertArtifact 持久化。
 */
export function applyScoreCardToArtifact(
  artifact: NodeArtifact,
  card: ScoreCard,
): NodeArtifact {
  const prev = previousScoreCard(artifact);
  const history = ((artifact.meta as any)?.scoreCardHistory ?? []) as ScoreCard[];
  const nextHistory = prev ? [...history, prev].slice(-MAX_HISTORY) : history;
  return {
    ...artifact,
    meta: {
      ...(artifact.meta ?? {}),
      scoreCard: card,
      scoreCardHistory: nextHistory,
    },
  };
}

/** 计算 delta（新-旧；缺失旧分则为 undefined） */
export function scoreCardDelta(card: ScoreCard, prev?: ScoreCard): {
  total?: number;
  byDimension: Partial<Record<ScoreDimension, number>>;
} {
  if (!prev) return { byDimension: {} };
  const byDimension: Partial<Record<ScoreDimension, number>> = {};
  for (const d of SCORE_DIMENSIONS) {
    byDimension[d] = card.dimensions[d].score - prev.dimensions[d].score;
  }
  return { total: card.total - prev.total, byDimension };
}
