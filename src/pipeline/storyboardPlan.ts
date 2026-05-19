// Parse storyboard.1 (Phase A-D unit planning) markdown output into
// structured units / paragraphs / peaks for downstream Phase E-G loop.
//
// storyboard.1 outputs strict markdown with blocks separated by `---`:
//   ## META                 → structureType / totalSec / totalUnits
//   ## PARA §N              → 人物 / 动作 / 台词 / 道具 / 场景 / 情绪
//   ## PEAK §N              → kind / originalRef
//   ## BUFFER §N            → reason
//   ## SUBTEXT §N           → description
//   ## UNIT N               → sceneId / sectionRefs / durationSec /
//                             sceneType / subShotCount / summary /
//                             plannedEntryState / plannedExitState

import { paragraphize, type Paragraph } from './paragraphize';

export interface PlannedUnit {
  unitIndex: number;
  sceneId: number;
  sectionRefs: string[];     // ["§1", "§2"]
  durationSec: number;
  sceneType: string;
  subShotCount: number;
  summary: string;
  plannedEntryState: string;
  plannedExitState: string;
}

export interface ParaFacts {
  人物?: string;
  动作?: string;
  台词?: string;
  道具?: string;
  场景?: string;
  情绪?: string;
}

export interface ParsedPlan {
  meta: { structureType?: string; totalSec?: number; totalUnits?: number };
  paragraphs: Map<string, ParaFacts>;       // §1 → facts
  peaks: Array<{ sectionId: string; kind: string; originalRef: string }>;
  buffers: Array<{ sectionId: string; reason: string }>;
  subtexts: Array<{ sectionId: string; description: string }>;
  units: PlannedUnit[];
  /** 解析来源："json" 表示用了 <plan-json> 块；"markdown" 表示靠正则降级 */
  source?: 'json' | 'markdown';
  /** 非阻塞警告（如缺字段、§N 引用不存在等），UI 可用于诊断面板 */
  warnings?: string[];
}

/* ── 公开校验枚举 ─────────────────────────────────────────────────── */

/** 标准戏份枚举（来自 prompts/storyboard 系统约束） */
export const SCENE_TYPES = ['文戏', '快文戏', '武戏', '动作非武', '环境'] as const;
export type SceneType = typeof SCENE_TYPES[number];

/** 把模型输出的杂乱 sceneType 归一化到枚举；未匹配返回 null */
export function normalizeSceneType(s: string | undefined): SceneType | null {
  if (!s) return null;
  const t = s.trim();
  if ((SCENE_TYPES as readonly string[]).includes(t)) return t as SceneType;
  // 容错常见变体
  if (/快.{0,2}文/.test(t)) return '快文戏';
  if (/武|打斗|对决|招式/.test(t)) return '武戏';
  if (/动作|追逐|奔跑|体力/.test(t)) return '动作非武';
  if (/环境|空镜|氛围|过场|转场/.test(t)) return '环境';
  if (/文|对话|对白|情绪/.test(t)) return '文戏';
  return null;
}

/* ── Parser 主入口：JSON 优先，markdown 兜底 ───────────────────────── */

export function parseStoryboardPlan(md: string): ParsedPlan {
  // 优先：从 <plan-json>...</plan-json> 中解析（storyboard.1 双输出契约）
  const jsonResult = tryParsePlanJson(md);
  if (jsonResult) {
    jsonResult.source = 'json';
    jsonResult.warnings = collectWarnings(jsonResult);
    return jsonResult;
  }
  // 回退：markdown 正则解析（保留旧行为以兼容旧 artifact / 模型偷懒不输出 JSON）
  const mdResult = parseStoryboardPlanFromMarkdown(md);
  mdResult.source = 'markdown';
  mdResult.warnings = collectWarnings(mdResult);
  return mdResult;
}

/* ── JSON 路径 ────────────────────────────────────────────────────── */

function tryParsePlanJson(md: string): ParsedPlan | null {
  // 抓 <plan-json>...</plan-json>（容许任意大小写 / 多余空白 / 嵌套换行）
  const m = md.match(/<plan-json>\s*([\s\S]*?)\s*<\/plan-json>/i);
  if (!m) return null;
  let raw = m[1].trim();
  // 容错：模型偶尔把内容包在 ```json ... ```
  raw = raw.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
  let obj: unknown;
  try { obj = JSON.parse(raw); }
  catch (e) {
    // JSON 损坏：返回 null 让上层走 markdown 兜底
    // eslint-disable-next-line no-console
    console.warn('[storyboardPlan] <plan-json> JSON parse failed, falling back to markdown:', e);
    return null;
  }
  const validated = validatePlanShape(obj);
  if (!validated.ok) {
    // eslint-disable-next-line no-console
    console.warn('[storyboardPlan] <plan-json> shape invalid:', validated.errors);
    return null;
  }
  return validated.value;
}

/** 极简 schema 校验：只校验必要字段并做温柔的容错。失败时给具体路径错误。 */
function validatePlanShape(o: unknown): { ok: true; value: ParsedPlan } | { ok: false; errors: string[] } {
  const errs: string[] = [];
  if (!o || typeof o !== 'object') return { ok: false, errors: ['root: not an object'] };
  const r = o as Record<string, unknown>;

  const meta = (r.meta && typeof r.meta === 'object') ? (r.meta as Record<string, unknown>) : {};
  const out: ParsedPlan = {
    meta: {
      structureType: typeof meta.structureType === 'string' ? meta.structureType : undefined,
      totalSec: typeof meta.totalSec === 'number' ? meta.totalSec : undefined,
      totalUnits: typeof meta.totalUnits === 'number' ? meta.totalUnits : undefined,
    },
    paragraphs: new Map(),
    peaks: [],
    buffers: [],
    subtexts: [],
    units: [],
  };

  // paragraphs: 数组形式 [{ sectionId, 人物, 动作, ... }]
  if (Array.isArray(r.paragraphs)) {
    for (let i = 0; i < r.paragraphs.length; i++) {
      const p = r.paragraphs[i] as Record<string, unknown>;
      const sid = normalizeSectionId(String(p.sectionId ?? ''));
      if (!sid) { errs.push(`paragraphs[${i}].sectionId 非法: ${JSON.stringify(p.sectionId)}`); continue; }
      const facts: ParaFacts = {};
      for (const k of ['人物','动作','台词','道具','场景','情绪'] as const) {
        if (typeof p[k] === 'string') facts[k] = p[k] as string;
      }
      out.paragraphs.set(sid, facts);
    }
  }

  if (Array.isArray(r.peaks)) {
    for (const pk of r.peaks as Array<Record<string, unknown>>) {
      const sid = normalizeSectionId(String(pk.sectionId ?? ''));
      if (!sid) continue;
      out.peaks.push({
        sectionId: sid,
        kind: String(pk.kind ?? ''),
        originalRef: String(pk.originalRef ?? ''),
      });
    }
  }
  if (Array.isArray(r.buffers)) {
    for (const b of r.buffers as Array<Record<string, unknown>>) {
      const sid = normalizeSectionId(String(b.sectionId ?? ''));
      if (!sid) continue;
      out.buffers.push({ sectionId: sid, reason: String(b.reason ?? '') });
    }
  }
  if (Array.isArray(r.subtexts)) {
    for (const s of r.subtexts as Array<Record<string, unknown>>) {
      const sid = normalizeSectionId(String(s.sectionId ?? ''));
      if (!sid) continue;
      out.subtexts.push({ sectionId: sid, description: String(s.description ?? '') });
    }
  }

  if (!Array.isArray(r.units) || r.units.length === 0) {
    return { ok: false, errors: ['units: empty or missing'] };
  }
  for (let i = 0; i < r.units.length; i++) {
    const u = r.units[i] as Record<string, unknown>;
    const idx = typeof u.unitIndex === 'number' ? u.unitIndex : i + 1;
    const sectionRefsRaw = u.sectionRefs;
    let sectionRefs: string[] = [];
    if (Array.isArray(sectionRefsRaw)) {
      sectionRefs = sectionRefsRaw
        .map((x) => normalizeSectionId(String(x)))
        .filter((x): x is string => !!x);
    } else if (typeof sectionRefsRaw === 'string') {
      sectionRefs = parseSectionRefs(sectionRefsRaw);
    }
    if (sectionRefs.length === 0) {
      errs.push(`units[${i}].sectionRefs 缺失或全部非法 (unitIndex=${idx})`);
    }
    out.units.push({
      unitIndex: idx,
      sceneId: typeof u.sceneId === 'number' ? u.sceneId : (parseInt(String(u.sceneId ?? ''), 10) || 1),
      sectionRefs,
      durationSec: typeof u.durationSec === 'number' ? u.durationSec : (parseFloat(String(u.durationSec ?? '')) || 14),
      sceneType: String(u.sceneType ?? '文戏'),
      subShotCount: typeof u.subShotCount === 'number' ? u.subShotCount : (parseInt(String(u.subShotCount ?? ''), 10) || 3),
      summary: String(u.summary ?? ''),
      plannedEntryState: String(u.plannedEntryState ?? ''),
      plannedExitState: String(u.plannedExitState ?? ''),
    });
  }
  out.units.sort((a, b) => a.unitIndex - b.unitIndex);

  if (errs.length && out.units.every((u) => u.sectionRefs.length === 0)) {
    return { ok: false, errors: errs };
  }
  return { ok: true, value: out };
}

function normalizeSectionId(s: string): string | null {
  if (!s) return null;
  // 接受 "§1" / "1" / "S1" / "section 1" / "第1段"
  const m =
    s.match(/§\s*(\d+)/) ||
    s.match(/^[Ss]\.?\s*(\d+)$/) ||
    s.match(/^(\d+)$/) ||
    s.match(/[Ss]ection\s*(\d+)/i) ||
    s.match(/第\s*(\d+)\s*段/);
  return m ? `§${m[1]}` : null;
}

function collectWarnings(plan: ParsedPlan): string[] {
  const w: string[] = [];
  // Unit 级
  for (const u of plan.units) {
    if (u.sectionRefs.length === 0) w.push(`UNIT ${u.unitIndex} 缺 sectionRefs（不会拿到原文）`);
    if (!u.plannedEntryState) w.push(`UNIT ${u.unitIndex} 缺 plannedEntryState`);
    if (!u.plannedExitState) w.push(`UNIT ${u.unitIndex} 缺 plannedExitState`);
    if (!normalizeSceneType(u.sceneType)) w.push(`UNIT ${u.unitIndex} sceneType "${u.sceneType}" 不在标准枚举内`);
  }
  // 时长合计 vs meta.totalSec
  if (typeof plan.meta.totalSec === 'number') {
    const sum = plan.units.reduce((s, u) => s + (u.durationSec || 0), 0);
    const drift = Math.abs(sum - plan.meta.totalSec);
    if (drift > Math.max(5, plan.meta.totalSec * 0.15)) {
      w.push(`单元时长合计 ${sum}s 与 meta.totalSec ${plan.meta.totalSec}s 偏差 ${drift}s（>15%）`);
    }
  }
  // §N 引用必须在 paragraphs 中出现
  if (plan.paragraphs.size > 0) {
    for (const u of plan.units) {
      for (const ref of u.sectionRefs) {
        if (!plan.paragraphs.has(ref)) w.push(`UNIT ${u.unitIndex} 引用 ${ref}，但 paragraphs 未声明`);
      }
    }
  }
  return w;
}

/* ── 旧 markdown 解析（重命名以保留兜底路径） ─────────────────────── */

export function parseStoryboardPlanFromMarkdown(md: string): ParsedPlan {
  const text = md.replace(/\r\n/g, '\n').replace(/```[\w]*\n?|\n?```/g, '');
  // Split top-level blocks: 任何 `## ` 开头视为新块（容错前置 `---` 分隔符与
  // 多余空行）。不依赖 `---` 单独切分，因为 LLM 经常省略它。
  const blocks = text.split(/\n(?=#{1,3}\s+)/g).map((b) => b.trim()).filter(Boolean);

  const out: ParsedPlan = {
    meta: {},
    paragraphs: new Map(),
    peaks: [],
    buffers: [],
    subtexts: [],
    units: [],
  };

  // 容错：识别 META / PARA / PEAK / BUFFER / SUBTEXT / UNIT 关键字（大小写无关；
  // 容许中英文及前后多余空白，例如 `## Unit 1` / `##  UNIT  1`）。
  const HEADER_RE = /^#{1,3}\s+(META|PARA|PEAK|BUFFER|SUBTEXT|UNIT)\b\s*([^\n]*)/i;

  for (const block of blocks) {
    const headerMatch = block.match(HEADER_RE);
    if (!headerMatch) continue;
    const kind = headerMatch[1].toUpperCase();
    const headerTail = headerMatch[2].trim();
    const body = block.slice(headerMatch[0].length).trim();
    const fields = parseFields(body);

    if (kind === 'META') {
      if (fields.structureType) out.meta.structureType = fields.structureType;
      if (fields.totalSec) out.meta.totalSec = num(fields.totalSec);
      if (fields.totalUnits) out.meta.totalUnits = num(fields.totalUnits);
      continue;
    }
    if (kind === 'PARA') {
      const id = sectionId(headerTail);
      if (!id) continue;
      out.paragraphs.set(id, {
        人物: fields['人物'],
        动作: fields['动作'],
        台词: fields['台词'],
        道具: fields['道具'],
        场景: fields['场景'],
        情绪: fields['情绪'],
      });
      continue;
    }
    if (kind === 'PEAK') {
      const id = sectionId(headerTail);
      if (!id) continue;
      out.peaks.push({
        sectionId: id,
        kind: fields.kind ?? '',
        originalRef: fields.originalRef ?? '',
      });
      continue;
    }
    if (kind === 'BUFFER') {
      const id = sectionId(headerTail);
      if (!id) continue;
      out.buffers.push({ sectionId: id, reason: fields.reason ?? '' });
      continue;
    }
    if (kind === 'SUBTEXT') {
      const id = sectionId(headerTail);
      if (!id) continue;
      out.subtexts.push({ sectionId: id, description: fields.description ?? '' });
      continue;
    }
    if (kind === 'UNIT') {
      // headerTail like "1" or "1 (some note)"
      const idx = parseInt(headerTail.match(/^\d+/)?.[0] ?? '', 10);
      if (!Number.isFinite(idx)) continue;
      out.units.push({
        unitIndex: idx,
        sceneId: num(fields.sceneId) ?? 0,
        sectionRefs: parseSectionRefs(fields.sectionRefs ?? ''),
        durationSec: num(fields.durationSec) ?? 14,
        sceneType: fields.sceneType ?? '文戏',
        subShotCount: num(fields.subShotCount) ?? 3,
        summary: fields.summary ?? '',
        plannedEntryState: fields.plannedEntryState ?? '',
        plannedExitState: fields.plannedExitState ?? '',
      });
      continue;
    }
  }

  out.units.sort((a, b) => a.unitIndex - b.unitIndex);
  return out;
}

// 已知字段白名单：用于在歧义时优先匹配真实字段（key 容易被 markdown 装饰污染）
const KNOWN_FIELDS = new Set([
  'structureType', 'totalSec', 'totalUnits',
  'sceneId', 'sectionRefs', 'durationSec', 'sceneType', 'subShotCount',
  'summary', 'plannedEntryState', 'plannedExitState',
  'kind', 'originalRef', 'reason', 'description',
  '人物', '动作', '台词', '道具', '场景', '情绪',
]);

/**
 * 容错地把 markdown 装饰从 key 中剥掉：
 *   `- sceneId`        → `sceneId`
 *   `* sceneId`        → `sceneId`
 *   `**sceneId**`      → `sceneId`
 *   `- **sceneId**`    → `sceneId`
 *   `**sceneId:`       → `sceneId`（冒号外露的情形已在外层处理）
 */
function stripKeyDecorations(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[-*+]\s+/, '');         // 列表标记
  s = s.replace(/^\*{1,3}|\*{1,3}$/g, ''); // 粗/斜体
  s = s.replace(/^`+|`+$/g, '');           // 反引号
  return s.trim();
}

function parseFields(body: string): Record<string, string> {
  // 每行 "key: value"；value 多行延续，直到遇到下一条疑似 key:。
  // 容错支持：
  //   - 行首 markdown bullet `- `, `* `, `+ `
  //   - 行首/key 周围 `**bold**` 装饰
  //   - 中英文冒号 `:` / `：`
  //   - 仅当解析出的 key 命中 KNOWN_FIELDS 时才视为新字段，避免把
  //     普通描述句（如「冷秋凝：证据？」）误当成 key。
  const lines = body.split('\n');
  const out: Record<string, string> = {};
  let curKey: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (curKey !== null) out[curKey] = buf.join('\n').trim();
    buf = [];
  };
  // 匹配 "[bullet] [bold]key[bold] [: 或 ：] value"
  const KV_RE = /^[\s]*(?:[-*+]\s+)?(?:\*{1,3})?\s*([^\s:：][^:：]*?)\s*(?:\*{1,3})?\s*[:：]\s*(.*)$/;
  for (const raw of lines) {
    const m = raw.match(KV_RE);
    if (m) {
      const candidateKey = stripKeyDecorations(m[1]);
      // 仅当 key 命中白名单（或符合驼峰 / 全字母 / 中文短词）时视为新 key。
      const looksLikeKey = KNOWN_FIELDS.has(candidateKey) ||
        (/^[A-Za-z][A-Za-z0-9_]*$/.test(candidateKey) && candidateKey.length <= 32);
      if (looksLikeKey) {
        flush();
        curKey = candidateKey;
        buf = [m[2]];
        continue;
      }
    }
    if (curKey !== null) buf.push(raw);
  }
  flush();
  return out;
}

function sectionId(tail: string): string | null {
  // 接受 "§1" / "§ 1" / "S1" / "Section 1" / "第1段" / "1" (header 末尾的纯数字)
  const m =
    tail.match(/§\s*(\d+)/) ||
    tail.match(/(?:^|\s)[Ss]\.?\s*(\d+)\b/) ||
    tail.match(/[Ss]ection\s*(\d+)/i) ||
    tail.match(/第\s*(\d+)\s*段/);
  return m ? `§${m[1]}` : null;
}

function parseSectionRefs(s: string): string[] {
  // 抓所有 §N / SN / 第N段 形式的引用，统一成 §N
  const ids: string[] = [];
  for (const m of s.matchAll(/§\s*(\d+)/g)) ids.push(`§${m[1]}`);
  for (const m of s.matchAll(/(?:^|[\s,，、])[Ss]\.?\s*(\d+)(?=[\s,，、)\]]|$)/g)) ids.push(`§${m[1]}`);
  for (const m of s.matchAll(/第\s*(\d+)\s*段/g)) ids.push(`§${m[1]}`);
  // 去重，保持原顺序
  return Array.from(new Set(ids));
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/* ── Per-unit user message builder ───────────────────────────────── */

/**
 * 为 storyboard.2 的某一单元构建 user 消息，结构对齐 prompts/storyboard/2.json
 * 模板（当前单元信息 / 本单元对应原文 / Phase A-D 分析上下文 / 素材清单 / 起幅锚点）。
 */
export function buildPhase2UnitUser(args: {
  unit: PlannedUnit;
  plan: ParsedPlan;
  screenplayParagraphs: Paragraph[];
  assetList: unknown;
}): string {
  const { unit, plan, screenplayParagraphs, assetList } = args;
  const refSet = new Set(unit.sectionRefs);
  const previousUnit = plan.units.find((u) => u.unitIndex === unit.unitIndex - 1);
  const nextUnit = plan.units.find((u) => u.unitIndex === unit.unitIndex + 1);

  const unitInfo = {
    unitIndex: unit.unitIndex,
    totalUnits: plan.units.length,
    durationSec: unit.durationSec,
    sceneType: unit.sceneType,
    subShotCount: unit.subShotCount,
    summary: unit.summary,
    sectionRefs: unit.sectionRefs,
    previousUnit: previousUnit
      ? {
          unitIndex: unit.unitIndex - 1,
          summary: previousUnit.summary,
          plannedExitState: previousUnit.plannedExitState,
        }
      : null,
    nextUnit: nextUnit
      ? {
          unitIndex: unit.unitIndex + 1,
          summary: nextUnit.summary,
          plannedEntryState: nextUnit.plannedEntryState,
        }
      : null,
    batchHint: {
      firstBatchEnd: Math.min(5, plan.units.length),
      remainingAfterFirstBatch: Math.max(0, plan.units.length - 5),
      isFirstBatchBoundary: unit.unitIndex === 5 && plan.units.length > 5,
      isFinalUnit: unit.unitIndex === plan.units.length,
    },
  };

  // 本单元对应原文片段：拼接 paragraphIndex 中匹配 sectionRefs 的段
  const unitParagraphs = screenplayParagraphs
    .filter((p) => refSet.has(p.id))
    .map((p) => p.text)
    .join('\n\n');

  // Phase A-D 分析上下文（仅保留与本单元相关的 §）
  const relevantParagraphs = screenplayParagraphs
    .filter((p) => refSet.has(p.id))
    .map((p) => ({
      id: p.id,
      text: p.text,
      facts: plan.paragraphs.get(p.id) ?? {},
    }));
  const phaseAD = {
    structureType: plan.meta.structureType ?? 'linear',
    emotionMap: {
      peaks: plan.peaks.filter((x) => refSet.has(x.sectionId)),
      buffers: plan.buffers.filter((x) => refSet.has(x.sectionId)),
      subtexts: plan.subtexts.filter((x) => refSet.has(x.sectionId)),
    },
    relevantParagraphs,
  };

  return [
    '## 当前单元信息',
    JSON.stringify(unitInfo, null, 2),
    '',
    '## 本单元对应原文片段',
    unitParagraphs || '(无对应原文)',
    '',
    '## Phase A-D 分析上下文 (参考, 保持忠实)',
    JSON.stringify(phaseAD, null, 2),
    '',
    '## 素材清单',
    JSON.stringify(assetList),
    '',
    '## 起幅锚点 (Phase D 预规划, 独立于其他单元)',
    `本单元 plannedEntryState: ${unit.plannedEntryState || '(未指定)'}`,
    unit.plannedExitState ? `本单元 plannedExitState: ${unit.plannedExitState}` : '',
    '',
    '请按 Phase E-F-G 生成本单元的完整双区 prompt. 不要输出其他内容.',
  ].filter(Boolean).join('\n');
}
