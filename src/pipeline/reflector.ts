/**
 * v6 epic · ACE-lite Reflector pipeline · LLM step + 信号收集 + JSON 解析
 *
 * 职责（CK v6 I-1 / I-7 / I-8）：
 *   - 收集失败信号（ScoreCard / consistencyCheck / readerLayer / userFeedback）
 *   - 调 novel.9 LLM step 提炼 lesson
 *   - 写入 reflectorLessons 表（status='pending'）
 *
 * 红线：
 *   - I-1 parseReflectorResponse 不抛错（失败返 null）
 *   - I-3 不自动改任何 method module（仅写 reflectorLessons row）
 *   - I-7 不改 scoreCard.ts / consistencyCheck.ts / characterStates.ts pipeline 层
 *   - I-8 失败时不阻塞 polish loop（novelLoop hook 的 .catch 兜底）
 */

import { runStep } from './runner';
import { loadManifest } from './manifest';
import type { ArtifactMap, ManifestStep, ProjectContext } from './types';
import type { SettingsState } from '../store/settings';
import { upsertReflectorLesson, type SignalType } from '../store/reflectorLessons';
import { listCharacterTimeline } from '../store/characterStates';
import type { NovelChapterLoopMeta } from './novelLoop';

export interface ReflectorThresholds {
  enabled: boolean;
  scoreCardMin: number;
  consistencyCheckTriggerOnAny: boolean;
  readerLayerStaleChapterCount: number;
  userFeedbackEnabled: boolean;
}

export interface FailureSignals {
  scoreCardScores?: Record<string, number>;
  consistencyIssues?: string[];
  staleChapterRange?: [number, number];
  userFeedbackText?: string;
}

export interface RunReflectorOpts {
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  projectId: number;
  chapterIndex: number;
  source: 'novel.6' | 'novel.7';
  /** 当前启用的 method modules（v6 epic Q3 候选 · 让 LLM 选 suggestedModule）。 */
  activeModuleIds: string[];
  signal?: AbortSignal;
}

export type RunReflectorResult =
  | { ok: true; lessonId: number; signalType: SignalType }
  | { ok: false; error: string; reason?: 'no-signal' | 'llm-failed' | 'parse-failed' };

/**
 * 主入口 · novelLoop 在 N3.2 polish 完成后调用。
 *
 * 不变量 I-8：本函数不应让 polish loop 阻塞 / 报错。
 * 上游 hook 用 .catch 兜底。
 */
export async function runReflector(opts: RunReflectorOpts): Promise<RunReflectorResult> {
  const { project, artifacts, settings, projectId, chapterIndex, source, activeModuleIds, signal } = opts;

  // 1. 收集信号
  const signals = await collectFailureSignals(projectId, chapterIndex, source, artifacts);
  const triggered = pickTriggeringSignal(signals, settings.reflectorThresholds);
  if (!triggered) {
    return { ok: false, error: '无触发信号 · 跳过', reason: 'no-signal' };
  }

  // 2. 加载 chapter 内容
  const chapterArt = artifacts[source];
  const chapterMeta = (chapterArt?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const chapterContent = chapterMeta.chapterContents?.[chapterIndex];
  if (!chapterContent || chapterContent.trim().length === 0) {
    return { ok: false, error: `第 ${chapterIndex} 章 ${source} 内容缺失`, reason: 'no-signal' };
  }

  // 3. 加载 novel.9 step
  let step: ManifestStep;
  try {
    step = await loadReflectorStep();
  } catch (e: unknown) {
    return { ok: false, error: '加载 novel.9 step 失败：' + String((e as Error)?.message ?? e), reason: 'llm-failed' };
  }

  // 4. 调 LLM
  const userOverride = buildUserOverride({
    chapterIndex,
    chapterContent: truncate(chapterContent, 3000),
    failureSignals: JSON.stringify(triggered.signals, null, 2),
    activeModuleIds: activeModuleIds.join(', '),
  });

  let llmContent: string;
  try {
    const art = await runStep({
      stageId: 'novel',
      step,
      project,
      artifacts,
      settings,
      signal,
      userOverride,
    });
    llmContent = art.content;
  } catch (e: unknown) {
    return { ok: false, error: 'novel.9 LLM 调用失败：' + ((e as Error)?.message ?? String(e)), reason: 'llm-failed' };
  }

  // 5. 解析（容错 · 失败返 null · 不 throw · CK I-1）
  const parsed = parseReflectorResponse(llmContent);
  if (!parsed) {
    return { ok: false, error: 'novel.9 输出无法解析为 JSON', reason: 'parse-failed' };
  }

  // 6. 验证 suggestedModule 是否在 active 范围（不在则置 null）
  const validSuggested = parsed.suggestedModule && activeModuleIds.includes(parsed.suggestedModule)
    ? parsed.suggestedModule
    : null;

  // 7. 写入 reflectorLessons 表（status='pending'）
  const lessonId = await upsertReflectorLesson({
    projectId,
    chapterIndex,
    signalType: triggered.signalType,
    lessonContent: parsed.lessonContent,
    suggestedModule: validSuggested,
    status: 'pending',
    committedTo: null,
    reviewNote: null,
    signalContext: triggered.signals,
  });

  return { ok: true, lessonId, signalType: triggered.signalType };
}

/**
 * 收集失败信号（CK I-7 仅读取 · 不改 pipeline 模块）。
 *
 * 当前 v6 实现：
 *   - scoreCard：从 artifacts['novel.7'].meta.scoreCard 读
 *   - consistencyCheck：暂留 stub（v6 PR-1 未集成 · 后续可加）
 *   - readerLayer：listCharacterTimeline 跨章扫 whatImWondering
 *   - userFeedback：暂留 stub（dogfood UI 未对接）
 */
async function collectFailureSignals(
  projectId: number,
  chapterIndex: number,
  source: 'novel.6' | 'novel.7',
  artifacts: ArtifactMap,
): Promise<FailureSignals> {
  const out: FailureSignals = {};

  // scoreCard：从本章 artifact.meta 读 ScoreCard.dimensions
  const chapterArt = artifacts[source];
  const scoreCardMeta = (chapterArt?.meta as { scoreCard?: { dimensions?: Record<string, { score: number }> } } | undefined)?.scoreCard;
  if (scoreCardMeta?.dimensions) {
    const scores: Record<string, number> = {};
    for (const [dim, val] of Object.entries(scoreCardMeta.dimensions)) {
      if (typeof val?.score === 'number') scores[dim] = val.score;
    }
    if (Object.keys(scores).length > 0) out.scoreCardScores = scores;
  }

  // readerLayer：扫该项目所有角色 timeline · 找 whatImWondering 跨章不变
  try {
    // 简化：只看主角（第一个有 timeline 的角色）
    // 完整实现可扩展为多角色聚合
    const _firstChar = await pickFirstCharacterWithTimeline(projectId);
    if (_firstChar) {
      const timeline = await listCharacterTimeline(projectId, _firstChar);
      const stale = detectStaleReaderLayer(timeline, chapterIndex);
      if (stale) out.staleChapterRange = stale;
    }
  } catch {
    // 容错：v5 数据缺失时不报错
  }

  return out;
}

/**
 * 选第一个有 timeline 的角色（简化实现 · 后续可改为遍历全部）。
 */
async function pickFirstCharacterWithTimeline(projectId: number): Promise<string | null> {
  try {
    const { db } = await import('../store/db');
    const row = await db.characterStates.where('projectId').equals(projectId).first();
    return row?.characterName ?? null;
  } catch {
    return null;
  }
}

/**
 * 检测 readerLayer.whatImWondering 跨 N 章不变（"伏笔积压"）。
 *
 * 算法：找最近 N 章 · 若 whatImWondering 内容相同 · 返回 [start, end]。
 */
function detectStaleReaderLayer(
  timeline: Array<{ chapterIndex: number; snapshot: { readerLayer?: { whatImWondering?: string } } | null }>,
  currentChapter: number,
): [number, number] | null {
  if (timeline.length < 3) return null;
  const sorted = [...timeline].sort((a, b) => a.chapterIndex - b.chapterIndex);
  const recent = sorted.filter((r) => r.chapterIndex <= currentChapter).slice(-5);
  if (recent.length < 3) return null;
  const wonderings = recent.map((r) => r.snapshot?.readerLayer?.whatImWondering ?? '').filter(Boolean);
  if (wonderings.length < 3) return null;
  const allSame = wonderings.every((w) => w === wonderings[0]);
  if (allSame) {
    return [recent[0].chapterIndex, recent[recent.length - 1].chapterIndex];
  }
  return null;
}

/**
 * 选出最高优先级的触发信号（多信号同时触发时 · 取一个最严重的）。
 *
 * 优先级：consistencyCheck > scoreCard < min > readerLayer 积压 > userFeedback
 */
function pickTriggeringSignal(
  signals: FailureSignals,
  thresholds: ReflectorThresholds,
): { signalType: SignalType; signals: FailureSignals } | null {
  if (signals.consistencyIssues && signals.consistencyIssues.length > 0 && thresholds.consistencyCheckTriggerOnAny) {
    return { signalType: 'consistencyCheck', signals };
  }
  if (signals.scoreCardScores) {
    const minScore = Math.min(...Object.values(signals.scoreCardScores));
    if (minScore < thresholds.scoreCardMin) return { signalType: 'scoreCard', signals };
  }
  if (signals.staleChapterRange) {
    const [start, end] = signals.staleChapterRange;
    if (end - start + 1 >= thresholds.readerLayerStaleChapterCount) {
      return { signalType: 'readerLayer', signals };
    }
  }
  if (signals.userFeedbackText && thresholds.userFeedbackEnabled) {
    return { signalType: 'userFeedback', signals };
  }
  return null;
}

/**
 * 加载 novel.9 step（lazy · 缓存）。
 */
let _cachedStep: ManifestStep | null = null;
async function loadReflectorStep(): Promise<ManifestStep> {
  if (_cachedStep) return _cachedStep;
  const mf = await loadManifest();
  const novelStage = mf.stages.find((s) => s.id === 'novel');
  const step = novelStage?.steps.find((s) => s.id === 'novel.9');
  if (!step) {
    throw new Error('novel.9 step 未注册到 prompts/manifest.json');
  }
  _cachedStep = step;
  return step;
}

/**
 * 构造 userOverride · 注入 chapterIndex / chapterContent / failureSignals / activeModuleIds。
 */
function buildUserOverride(args: {
  chapterIndex: number;
  chapterContent: string;
  failureSignals: string;
  activeModuleIds: string;
}): string {
  return `## 本章正文（第 ${args.chapterIndex} 章 · 已截断至 3000 字）\n${args.chapterContent}\n\n## 失败信号\n${args.failureSignals}\n\n## 当前启用的 method modules（id 列表）\n${args.activeModuleIds}\n\n请按 system 格式输出严格 JSON。直接输出 · 不带任何说明文字。`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...(已截断)' : s;
}

/**
 * 解析 LLM 输出（容错 · CK I-1 · 失败返 null · 不抛错）。
 *
 * 容错策略（与 v5 parseExtractionResponse 同模式）：
 *   1. 整段 trim 试 JSON.parse
 *   2. ```json 围栏内试 parse
 *   3. 首个 {...} 匹配试 parse
 *   4. 全失败返 null
 */
export function parseReflectorResponse(content: string): { lessonContent: string; suggestedModule: string | null } | null {
  const candidates: string[] = [content.trim()];
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === 'object' && typeof parsed.lessonContent === 'string') {
        return {
          lessonContent: parsed.lessonContent,
          suggestedModule: typeof parsed.suggestedModule === 'string' ? parsed.suggestedModule : null,
        };
      }
    } catch {
      // 继续下一个候选
    }
  }
  return null;
}
