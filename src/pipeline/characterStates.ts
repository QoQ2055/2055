/**
 * gap-b PR-2 · 角色状态提取 LLM 流水线层 · CA §1.3 / §3.4。
 * 调 novel.8 提取快照、JSON 容错、Dexie 持久化。I-2 不读 zustand；
 * 红线 #3 不动 consistencyCheck.ts（采内联词典匹配）。
 */

import { runStep } from './runner';
import { loadManifest } from './manifest';
import type { ArtifactMap, ManifestStep, ProjectContext } from './types';
import type { SettingsState } from '../store/settings';
import type { CharacterSnapshot } from '../store/characterStates';
import { upsertCharacterState, listChapterStates } from '../store/characterStates';
import type { NovelChapterLoopMeta } from './novelLoop';

export interface RunCharacterStateOpts {
  project: ProjectContext;
  artifacts: ArtifactMap;
  settings: SettingsState;
  projectId: number;
  chapterIndex: number;
  source: 'novel.6' | 'novel.7';
  signal?: AbortSignal;
}

export type RunCharacterStateResult =
  | {
      ok: true;
      extractedCount: number;
      charactersFound: string[];
      durationMs: number;
    }
  | {
      ok: false;
      error: string;
      parseFailed?: boolean;
      charactersFound?: string[];
    };

export async function runCharacterStateExtraction(
  opts: RunCharacterStateOpts,
): Promise<RunCharacterStateResult> {
  const t0 = Date.now();
  const { project, artifacts, settings, projectId, chapterIndex, source, signal } = opts;

  const chapterArt = artifacts[source];
  const chapterMeta = (chapterArt?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const chapterContent = chapterMeta.chapterContents?.[chapterIndex];
  if (!chapterContent || chapterContent.trim().length === 0) {
    return { ok: false, error: `第 ${chapterIndex} 章 ${source} 内容缺失或为空` };
  }

  const bibleArt = artifacts['novel.2'];
  const bibleContent = bibleArt?.content ?? '';
  const bibleCharacters = extractCharactersFromNovelBible(bibleContent);
  const biblePresent = bibleCharacters.length > 0;

  const vocab = new Set<string>(bibleCharacters);
  const hits = findVocabMatches(chapterContent, vocab);
  const charactersInChapter: string[] = Array.from(hits.keys()).filter((n) => (hits.get(n) ?? 0) > 0);

  let step: ManifestStep;
  try {
    step = await loadCharacterStateStep();
  } catch (e: unknown) {
    return { ok: false, error: '加载 novel.8 step 失败：' + String((e as Error)?.message ?? e) };
  }

  const previousStates = chapterIndex > 1
    ? await listChapterStates(projectId, chapterIndex - 1)
    : [];
  const previousSummary = formatPreviousStatesForPrompt(previousStates);

  const userOverride = buildUserOverride({
    chapterIndex,
    chapterContent,
    bibleContent,
    biblePresent,
    previousSummary,
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
    const msg = (e as Error)?.message ?? String(e);
    return {
      ok: false,
      error: 'LLM 调用失败：' + msg,
      charactersFound: charactersInChapter,
    };
  }

  let parsed: Array<{ characterName: string; snapshot: CharacterSnapshot }>;
  try {
    parsed = parseExtractionResponse(llmContent);
  } catch (e: unknown) {
    const errMsg = (e as Error)?.message ?? 'JSON 解析失败';
    const fallbackChars = charactersInChapter.length > 0 ? charactersInChapter : ['未识别角色'];
    for (const name of fallbackChars) {
      await upsertCharacterState({
        projectId,
        chapterIndex,
        characterName: name,
        snapshot: null,
        extractionError: errMsg,
        sourceArtifactNodeId: source,
        stale: false,
      });
    }
    return {
      ok: false,
      error: errMsg,
      parseFailed: true,
      charactersFound: fallbackChars,
    };
  }

  for (const item of parsed) {
    if (!item.characterName || typeof item.characterName !== 'string') continue;
    await upsertCharacterState({
      projectId,
      chapterIndex,
      characterName: item.characterName.trim(),
      snapshot: item.snapshot ?? null,
      sourceArtifactNodeId: source,
      stale: false,
    });
  }

  return {
    ok: true,
    extractedCount: parsed.length,
    charactersFound: parsed.map((p) => p.characterName),
    durationMs: Date.now() - t0,
  };
}

export async function rerunStaleStates(
  projectId: number,
  fromChapter: number,
  baseOpts: Omit<RunCharacterStateOpts, 'chapterIndex' | 'source'> & { source?: 'novel.6' | 'novel.7' },
): Promise<{ runs: number; failures: number }> {
  let runs = 0;
  let failures = 0;
  const source = baseOpts.source ?? 'novel.7';
  const meta = (baseOpts.artifacts[source]?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const allChapters = Object.keys(meta.chapterContents ?? {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n >= fromChapter)
    .sort((a, b) => a - b);
  for (const ch of allChapters) {
    const r = await runCharacterStateExtraction({ ...baseOpts, chapterIndex: ch, source });
    runs += 1;
    if (!r.ok) failures += 1;
  }
  return { runs, failures };
}

let _cachedStep: ManifestStep | null = null;

async function loadCharacterStateStep(): Promise<ManifestStep> {
  if (_cachedStep) return _cachedStep;
  const mf = await loadManifest();
  const novelStage = mf.stages.find((s) => s.id === 'novel');
  const step = novelStage?.steps.find((s) => s.id === 'novel.8');
  if (!step) {
    throw new Error('novel.8 step 未注册到 prompts/manifest.json，请先同步 manifest');
  }
  _cachedStep = step;
  return step;
}

/** 内联词典匹配（红线 #3）：名长降序查找 + 占位覆盖避重匹（防止"云老"被"云云老"吃掉）。 */
function findVocabMatches(text: string, vocab: Set<string>): Map<string, number> {
  const hits = new Map<string, number>();
  if (text.length === 0 || vocab.size === 0) return hits;
  const sortedVocab = Array.from(vocab).sort((a, b) => b.length - a.length);
  let scratch = text;
  for (const name of sortedVocab) {
    if (!name) continue;
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'g');
    const found = scratch.match(re);
    if (found && found.length) {
      hits.set(name, (hits.get(name) ?? 0) + found.length);
      scratch = scratch.replace(re, '\u25c7'.repeat(name.length));
    }
  }
  return hits;
}

/** 从 N1.2 Bible markdown 抽取角色名：`### 姓名（别号）` 三级标题，剥括号+trim。 */
function extractCharactersFromNovelBible(bible: string): string[] {
  if (!bible) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of bible.split('\n')) {
    const m = line.match(/^###\s+([^（(\n]+)/);
    if (!m) continue;
    const name = m[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** 序列化上一章末状态为 LLM 可读摘要（截断 1500 字 · FR-5.3）。 */
function formatPreviousStatesForPrompt(states: Array<{ characterName: string; snapshot: CharacterSnapshot | null }>): string {
  if (states.length === 0) return '(本书第一章，无上一章状态)';
  const lines: string[] = [];
  for (const s of states) {
    if (!s.snapshot) continue;
    const sum = s.snapshot.summary ?? '';
    const emo = s.snapshot.emotion ? `情绪[${s.snapshot.emotion}]` : '';
    lines.push(`- **${s.characterName}**：${sum} ${emo}`.trim());
  }
  const joined = lines.join('\n');
  return joined.length > 1500 ? joined.slice(0, 1500) + '\n...(已截断)' : joined;
}

/** 构造 userOverride（运行时 prompt）。 */
function buildUserOverride(args: { chapterIndex: number; chapterContent: string; bibleContent: string; biblePresent: boolean; previousSummary: string }): string {
  const { chapterIndex, chapterContent, bibleContent, biblePresent, previousSummary } = args;
  const bibleSection = biblePresent
    ? `## 上游产物 · 人物 Bible（截至全书设定）\n${truncate(bibleContent, 3000)}`
    : `## 上游产物 · 人物 Bible\n(暂缺人物 Bible，请仅基于本章文本提取出场角色)`;
  return [
    bibleSection,
    `## 上一章末状态摘要\n${previousSummary}`,
    `## 当前章节正文（第 ${chapterIndex} 章）\n${chapterContent}`,
    `## 当前任务\n按 system 格式输出**严格 JSON 数组**。仅记录本章实际出场的角色。直接输出 JSON，不带任何说明文字。`,
  ].join('\n\n');
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...(已截断)' : s;
}

/** LLM 输出解析：依次试 整段·围栏内·首个 `[...]`；均失败抛错让上游写 stub。 */
function parseExtractionResponse(content: string): Array<{ characterName: string; snapshot: CharacterSnapshot }> {
  const candidates: string[] = [content.trim()];
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (arrayMatch) candidates.push(arrayMatch[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // 继续下一个候选
    }
  }
  throw new Error('LLM 输出无法解析为 JSON 数组');
}
