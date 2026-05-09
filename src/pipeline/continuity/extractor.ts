/**
 * v8 epic · MM5 PR-4 · 章节 → 4 张连续性表的 LLM 提取器
 *
 * 设计参照（CK · 模仿 ./extractKb.ts 与 ./characterStateExtraction.ts）：
 *   - 独立调 chatStream · 不进 manifest 主流水线（不污染 runHistory · 不触发 chain）
 *   - parseLooseJson 容错解析（兼容 ```json 包裹 / 尾随空白等）
 *   - 失败不阻塞调用方（返回 ok:false + error · 由调用方决定告警策略）
 *   - projectId 透传（约定 0 = 活动项目 sentinel · 与 recordRun 一致）
 *
 * 边界（CK · 关注点分离）：
 *   - 只做"章节文本 → 4 表 row" · 不改 novelLoop.ts · 不改 SelfCheckPanel
 *   - 写入约束：只 add（不 update / 不 delete）· 重复调用同章节会造成重复行 ·
 *     调用方负责去重策略（推荐先 clearProjectXxx 再 extract）
 */
import { chatStream } from '../../llm/deepseek';
import type { SettingsState } from '../../store/settings';
import { parseLooseJson } from '../jsonLoose';
import {
  addForeshadow,
  addCharacterArc,
  addWorldRule,
  upsertRhythmDiagnostic,
  type ForeshadowStatus,
  type ForeshadowWeight,
  type WorldRuleSeverity,
} from '../../store/continuity';

// ─── LLM 输出 schema（与提示词中描述对齐） ─────────────────────────

interface ExtractedForeshadow {
  title: string;
  content: string;
  status?: ForeshadowStatus;
  weight?: ForeshadowWeight;
  setupChapter?: number;
  payoffChapter?: number;
  payoffNote?: string;
  notes?: string;
}

interface ExtractedArc {
  characterName: string;
  epoch: string;
  state: string;
  driver?: string;
  evidence?: string;
}

interface ExtractedRule {
  domain: string;
  rule: string;
  severity?: WorldRuleSeverity;
  violations?: string[];
  notes?: string;
}

interface ExtractedRhythm {
  sceneIdx: number;
  tension: number;
  emotion: number;
  warnings?: string[];
  sceneLabel?: string;
}

interface ExtractedPayload {
  foreshadows?: ExtractedForeshadow[];
  characterArcs?: ExtractedArc[];
  worldRules?: ExtractedRule[];
  rhythmDiagnostics?: ExtractedRhythm[];
}

// ─── 提示词（hardcode · 不走 public/prompts/ 避免增加 import:prompts 复杂度） ─

const SYSTEM_PROMPT = `你是连续性分析师。读取一个章节的文本，提取 4 类连续性元素，输出严格 JSON。

# 输出 JSON schema

{
  "foreshadows": [
    {
      "title": "5-30 字标识 · 用于 UI 展示",
      "content": "完整描述 · 伏笔的具体内容（埋下了什么）· 30-200 字",
      "status": "planted | partial | resolved | broken",
      "weight": "minor | major | critical",
      "setupChapter": 整数 · 当前章节号,
      "payoffChapter": 可选整数 · status=resolved/partial 时填,
      "payoffNote": "可选 · 回收方式说明",
      "notes": "可选 · 自由备注"
    }
  ],
  "characterArcs": [
    {
      "characterName": "角色名 · 与剧本中保持一致",
      "epoch": "弧光阶段标识（自定义字符串如 opening / midpoint / climax / denouement）",
      "state": "此阶段角色状态简述 · 30-200 字",
      "driver": "可选 · 引发本次状态变化的驱动事件 · 10-100 字",
      "evidence": "可选 · 剧本中支持本状态的引用片段"
    }
  ],
  "worldRules": [
    {
      "domain": "规则领域 · 自定义字符串如 magic-system / tech-level / currency",
      "rule": "规则陈述 · 一句话 · 30-200 字",
      "severity": "soft | hard",
      "violations": ["可选 · 后续章节中检测到的违规记录"],
      "notes": "可选 · 自由备注"
    }
  ],
  "rhythmDiagnostics": [
    {
      "sceneIdx": 整数 · 章节内场景序号 · 0-based,
      "tension": 整数 · 0-10 · 0=完全静态 / 10=极度紧张,
      "emotion": 整数 · -5..+5 · 负值悲伤/低落 · 正值喜悦/高扬,
      "warnings": ["可选 · 诊断警报"],
      "sceneLabel": "可选 · 场景标题 / 简述"
    }
  ]
}

# 提取规则

- 4 类数组都可空（输出 \`[]\`）· 不要凭空捏造内容
- foreshadows · setupChapter 必须等于本章号
- characterArcs · 仅记录"显著状态变化点"· 不要每章都填
- worldRules · 仅记录"首次定义"或"违规检测"· 不重复已有规则
- rhythmDiagnostics · 章节内每个独立场景一行 · sceneIdx 从 0 开始递增
- 严禁 markdown 装饰（**bold** / *italic* / 列表）
- 严禁解释性前后缀 · 仅输出 JSON 对象`;

function buildUserPrompt(opts: {
  chapterIndex: number;
  chapterTitle?: string;
  chapterContent: string;
}): string {
  return [
    `# 待分析章节`,
    '',
    `章节号: ${opts.chapterIndex}`,
    opts.chapterTitle ? `章节标题: ${opts.chapterTitle}` : '',
    '',
    `## 章节正文`,
    '',
    '```',
    opts.chapterContent,
    '```',
    '',
    `请提取 4 类连续性元素 · 输出 JSON 对象（不要包 \`\`\`json 围栏）。`,
  ].filter(Boolean).join('\n');
}

// ─── 公开 API ────────────────────────────────────────────────────────

export interface ExtractContinuityOptions {
  /** 项目 ID · 0 = 活动项目 sentinel（与 recordRun / characterStates 约定一致）。 */
  projectId: number;
  /** 章节号（1-based）· 落库时作为 setupChapter / chapter 使用。 */
  chapterIndex: number;
  /** 章节标题 · 可选 · 仅入 prompt · 不入库。 */
  chapterTitle?: string;
  /** 章节正文（markdown 或纯文本均可）。 */
  chapterContent: string;
  /** 全局 settings · 提供 baseUrl / apiKey / model（优先 modelLite · 提取任务）。 */
  settings: SettingsState;
  /** AbortSignal · 用户中断。 */
  signal?: AbortSignal;
  /** 流式增量回调 · 可选 · UI 显示进度。 */
  onDelta?: (chunk: string, full: string) => void;
}

export interface ExtractContinuityResult {
  ok: boolean;
  /** 错误信息 · ok=false 时填。 */
  error?: string;
  /** 各类成功落库行数。 */
  counts: {
    foreshadows: number;
    characterArcs: number;
    worldRules: number;
    rhythmDiagnostics: number;
  };
  /** LLM 调用元信息（即使解析失败也返回）。 */
  meta: {
    durationMs: number;
    tokens?: number;
    rawTextHead: string;
  };
}

const EMPTY_COUNTS = {
  foreshadows: 0,
  characterArcs: 0,
  worldRules: 0,
  rhythmDiagnostics: 0,
};

/**
 * 提取一章的 continuity 元素并落入 v8 4 张表。
 *
 * 失败模式（不抛 · 通过 ok:false 返回）：
 *   - apiKey 未配置
 *   - LLM 调用失败 / 超时
 *   - JSON 解析失败
 *   - dexie 写入失败（部分行可能已写入 · counts 反映实际入库数）
 *
 * 成功模式：
 *   - 即使 LLM 输出空数组（如本章无新伏笔）· 仍返回 ok:true · counts 全 0
 */
export async function extractContinuityFromChapter(
  opts: ExtractContinuityOptions,
): Promise<ExtractContinuityResult> {
  const t0 = performance.now();
  const counts = { ...EMPTY_COUNTS };
  const meta = { durationMs: 0, tokens: undefined as number | undefined, rawTextHead: '' };

  if (!opts.settings.apiKey) {
    return {
      ok: false,
      error: '未配置 API Key · 请到设置页填写',
      counts,
      meta: { ...meta, durationMs: performance.now() - t0 },
    };
  }
  if (!opts.chapterContent.trim()) {
    return {
      ok: false,
      error: '章节内容为空',
      counts,
      meta: { ...meta, durationMs: performance.now() - t0 },
    };
  }

  // 提取任务用 lite 模型即可（结构化抽取 · 对创意要求低 · 节省 token）
  const model = opts.settings.modelLite || opts.settings.model;

  let rawContent = '';
  try {
    const res = await chatStream({
      baseUrl: opts.settings.baseUrl,
      apiKey: opts.settings.apiKey,
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(opts) },
      ],
      temperature: 0.1, // 提取任务要稳定不发散
      max_tokens: 4096,
      responseFormat: 'json_object',
      signal: opts.signal,
      onDelta: opts.onDelta,
    });
    rawContent = res.content;
    meta.tokens = res.usage?.total_tokens;
  } catch (e) {
    return {
      ok: false,
      error: `LLM 调用失败：${(e as Error)?.message ?? String(e)}`,
      counts,
      meta: { ...meta, durationMs: performance.now() - t0 },
    };
  }

  meta.rawTextHead = rawContent.slice(0, 200);

  // 解析 JSON
  let payload: ExtractedPayload;
  try {
    const parsed = parseLooseJson(rawContent);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('输出不是对象');
    }
    payload = parsed as ExtractedPayload;
  } catch (e) {
    return {
      ok: false,
      error: `JSON 解析失败：${(e as Error)?.message ?? String(e)}`,
      counts,
      meta: { ...meta, durationMs: performance.now() - t0 },
    };
  }

  // 落库（每类独立 try · 一类失败不阻塞其他）
  await persistForeshadows(opts.projectId, opts.chapterIndex, payload.foreshadows ?? [], counts);
  await persistArcs(opts.projectId, opts.chapterIndex, payload.characterArcs ?? [], counts);
  await persistRules(opts.projectId, opts.chapterIndex, payload.worldRules ?? [], counts);
  await persistRhythms(opts.projectId, opts.chapterIndex, payload.rhythmDiagnostics ?? [], counts);

  meta.durationMs = performance.now() - t0;
  return { ok: true, counts, meta };
}

// ─── persistors（每类独立 · 一类失败不阻塞其他类） ────────────────────

async function persistForeshadows(
  projectId: number,
  chapterIndex: number,
  rows: ExtractedForeshadow[],
  counts: ExtractContinuityResult['counts'],
): Promise<void> {
  for (const r of rows) {
    try {
      if (!r.title || !r.content) continue;
      await addForeshadow({
        projectId,
        title: r.title.slice(0, 60),
        content: r.content,
        status: r.status ?? 'planted',
        weight: r.weight ?? 'minor',
        setupChapter: r.setupChapter ?? chapterIndex,
        payoffChapter: r.payoffChapter,
        payoffNote: r.payoffNote,
        notes: r.notes,
      });
      counts.foreshadows++;
    } catch (e) {
      console.warn('[continuity.extractor] addForeshadow failed:', e);
    }
  }
}

async function persistArcs(
  projectId: number,
  chapterIndex: number,
  rows: ExtractedArc[],
  counts: ExtractContinuityResult['counts'],
): Promise<void> {
  for (const r of rows) {
    try {
      if (!r.characterName || !r.epoch || !r.state) continue;
      await addCharacterArc({
        projectId,
        characterName: r.characterName,
        epoch: r.epoch,
        chapter: chapterIndex,
        state: r.state,
        driver: r.driver,
        evidence: r.evidence,
      });
      counts.characterArcs++;
    } catch (e) {
      console.warn('[continuity.extractor] addCharacterArc failed:', e);
    }
  }
}

async function persistRules(
  projectId: number,
  chapterIndex: number,
  rows: ExtractedRule[],
  counts: ExtractContinuityResult['counts'],
): Promise<void> {
  for (const r of rows) {
    try {
      if (!r.domain || !r.rule) continue;
      await addWorldRule({
        projectId,
        domain: r.domain,
        rule: r.rule,
        severity: r.severity ?? 'soft',
        chapter: chapterIndex,
        violations: r.violations,
        notes: r.notes,
      });
      counts.worldRules++;
    } catch (e) {
      console.warn('[continuity.extractor] addWorldRule failed:', e);
    }
  }
}

async function persistRhythms(
  projectId: number,
  chapterIndex: number,
  rows: ExtractedRhythm[],
  counts: ExtractContinuityResult['counts'],
): Promise<void> {
  for (const r of rows) {
    try {
      if (typeof r.sceneIdx !== 'number') continue;
      const tension = clampInt(r.tension, 0, 10);
      const emotion = clampInt(r.emotion, -5, 5);
      await upsertRhythmDiagnostic({
        projectId,
        chapter: chapterIndex,
        sceneIdx: r.sceneIdx,
        tension,
        emotion,
        warnings: r.warnings,
        sceneLabel: r.sceneLabel,
      });
      counts.rhythmDiagnostics++;
    } catch (e) {
      console.warn('[continuity.extractor] upsertRhythmDiagnostic failed:', e);
    }
  }
}

function clampInt(n: unknown, min: number, max: number): number {
  const v = typeof n === 'number' ? n : parseInt(String(n ?? 0), 10);
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, Math.round(v)));
}
