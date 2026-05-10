// Lightweight `{{ path.to.value | filter:arg }}` interpolation engine.
// Used to inject project ctx + upstream artifacts into prompt templates.

import type { ArtifactMap, ProjectContext } from './types';
import { getNovelPresets } from './novelTonePresets';

export interface InterpolateScope {
  project: ProjectContext;
  artifacts: ArtifactMap;
  // arbitrary helpers / extra vars
  [key: string]: unknown;
}

type Filter = (value: unknown, ...args: string[]) => unknown;

const filters: Record<string, Filter> = {
  json: (v) => typeof v === 'string' ? v : JSON.stringify(v, null, 2),
  upper: (v) => String(v ?? '').toUpperCase(),
  trim: (v) => String(v ?? '').trim(),
  truncate: (v, n) => {
    const s = String(v ?? '');
    const limit = parseInt(n ?? '500', 10);
    return s.length <= limit ? s : s.slice(0, limit) + '…';
  },
  // pull `.content` from a NodeArtifact-like object
  content: (v) => (v && typeof v === 'object' && 'content' in (v as any)) ? (v as any).content : v,
  default: (v, d) => (v == null || v === '' ? (d ?? '') : v),

  // ─── Step 3: Context curation filters ─────────────────────────────
  //
  // 比 truncate 更智能的裁剪 filter，让 prompt 模板能精确提取上游产物里
  // **本步骤真正需要**的部分，而不是从头部硬切。
  //
  // 用法示例（在 prompt JSON user 模板里）：
  //   {{ artifacts.novel.2.content | firstSection:"## 主角" }}
  //   {{ artifacts.assets.1.content | firstSection:"## 角色清单" | truncate:1500 }}
  //   {{ artifacts.storyboard.1.content | sections:"## UNIT 1,## UNIT 2" }}
  //   {{ artifacts.novel.4.content | grepLines:"第 42 章|第 43 章" }}
  //   {{ assetList | pickKeys:"name,role,redLine" }}

  /**
   * Extract a single markdown section by heading. Matches `arg` as the literal
   * heading text (with `#`-level prefix); returns content from that line up
   * until the next heading of equal or higher level (or EOF).
   *
   * If heading not found, returns empty string.
   */
  firstSection: (v, arg) => {
    if (!arg) return String(v ?? '');
    const text = String(v ?? '');
    const heading = arg.trim();
    return extractMarkdownSection(text, heading) ?? '';
  },

  /**
   * Extract multiple markdown sections (comma-separated headings) and join
   * them with blank lines.
   */
  sections: (v, arg) => {
    if (!arg) return String(v ?? '');
    const text = String(v ?? '');
    const headings = arg.split(',').map((s) => s.trim()).filter(Boolean);
    const parts: string[] = [];
    for (const h of headings) {
      const seg = extractMarkdownSection(text, h);
      if (seg) parts.push(seg);
    }
    return parts.join('\n\n');
  },

  /**
   * Filter lines of a string to only those matching a regex pattern.
   * `pattern` is parsed as a JS RegExp source (without flags); 'i' (case-
   * insensitive) is applied automatically.
   */
  grepLines: (v, arg) => {
    if (!arg) return String(v ?? '');
    const text = String(v ?? '');
    let re: RegExp;
    try { re = new RegExp(arg, 'i'); }
    catch { return text; }
    return text.split(/\r?\n/).filter((line) => re.test(line)).join('\n');
  },

  /**
   * Pick a subset of keys from an object (or array of objects) and re-encode
   * as pretty JSON. Keys is a comma-separated list.
   *
   *   {{ assetList | pickKeys:"name,role,redLine" }}
   */
  pickKeys: (v, arg) => {
    if (!arg) return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    const keys = arg.split(',').map((s) => s.trim()).filter(Boolean);
    const project = (obj: any): any => {
      if (obj == null || typeof obj !== 'object') return obj;
      const out: Record<string, unknown> = {};
      for (const k of keys) if (k in obj) out[k] = obj[k];
      return out;
    };
    if (Array.isArray(v)) return JSON.stringify(v.map(project), null, 2);
    if (v && typeof v === 'object') return JSON.stringify(project(v), null, 2);
    // Try parse as JSON string
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return JSON.stringify(parsed.map(project), null, 2);
        if (parsed && typeof parsed === 'object') return JSON.stringify(project(parsed), null, 2);
      } catch { /* fall through */ }
      return v;
    }
    return String(v ?? '');
  },

  /**
   * Heuristic relevance filter: keep markdown sections whose heading or body
   * contains any of the comma-separated keywords (case-insensitive).
   *
   *   {{ artifacts.novel.5.content | relevant:"第 42 章,沈砚,玉佩" }}
   *
   * Useful for chapter writing where you only need伏笔表里 mentions of the
   * current chapter / characters, not the full ledger.
   */
  relevant: (v, arg) => {
    if (!arg) return String(v ?? '');
    const text = String(v ?? '');
    const keywords = arg.split(',').map((s) => s.trim()).filter(Boolean);
    if (!keywords.length) return text;
    const re = new RegExp(keywords.map(escapeRegex).join('|'), 'i');
    // Split into sections by `^## ` markers (preserving the heading on each chunk)
    const sections: string[] = [];
    const lines = text.split(/\r?\n/);
    let buf: string[] = [];
    const flush = () => {
      if (buf.length) sections.push(buf.join('\n'));
      buf = [];
    };
    for (const line of lines) {
      if (/^##\s/.test(line)) flush();
      buf.push(line);
    }
    flush();
    if (sections.length <= 1) {
      // Not section-structured → fall back to line-grep
      return lines.filter((line) => re.test(line)).join('\n');
    }
    return sections.filter((sec) => re.test(sec)).join('\n\n');
  },

  /**
   * Take the last N characters (handy for "tail of long output, where most
   * recent context lives" — e.g. last few chapters of a draft pile).
   */
  tail: (v, n) => {
    const s = String(v ?? '');
    const limit = parseInt(n ?? '500', 10);
    return s.length <= limit ? s : '…' + s.slice(-limit);
  },

  /**
   * Take the first N characters from each markdown section (head sampling),
   * useful for getting a "table of contents + intros" preview without the bulk.
   *
   *   {{ artifacts.novel.4.content | sectionHeads:200 }}
   */
  sectionHeads: (v, n) => {
    const text = String(v ?? '');
    const limit = parseInt(n ?? '200', 10);
    const sections = splitBySectionHeading(text);
    return sections.map((s) => {
      const head = s.slice(0, limit);
      return s.length > limit ? head + '…' : head;
    }).join('\n\n---\n\n');
  },
};

/* ───────────────────────────────────────────────────────────────────
 * Markdown section helpers
 * ─────────────────────────────────────────────────────────────────── */

/**
 * Find a markdown section by its heading line (e.g. "## 主角") and return
 * the content from that heading up to (but not including) the next heading
 * of equal or higher level. Returns null if the heading isn't found.
 */
function extractMarkdownSection(text: string, heading: string): string | null {
  // Determine the heading level from the requested heading
  const reqMatch = heading.match(/^(#+)\s/);
  if (!reqMatch) return null;
  const reqLevel = reqMatch[1].length;
  const lines = text.split(/\r?\n/);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading.trim()) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  // Find end: next heading of level <= reqLevel
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= reqLevel) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join('\n').trimEnd();
}

function splitBySectionHeading(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) out.push(buf.join('\n'));
    buf = [];
  };
  for (const line of lines) {
    if (/^##\s/.test(line)) flush();
    buf.push(line);
  }
  flush();
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPath(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let cur: any = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function interpolate(template: string, scope: InterpolateScope): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    // expr like "artifacts.screenplay.1.content | truncate:1000"
    const parts = expr.split('|').map((s) => s.trim());
    const path = parts[0];
    let value: unknown;
    if (path.startsWith("'") || path.startsWith('"')) {
      value = path.slice(1, -1); // string literal
    } else {
      value = getPath(scope, path);
    }
    for (const f of parts.slice(1)) {
      const [name, ...args] = f.split(':').map((s) => s.trim());
      const fn = filters[name];
      if (fn) value = fn(value, ...args);
    }
    return value == null ? '' : String(value);
  });
}

// Apply project context to a "user message template" by replacing the
// hard-coded examples baked into the original payload.
// (The original payloads have e.g. "一句话概念: 仙侠爱情短剧" and "5分钟" hard-wired.)
export function applyProjectContext(text: string, ctx: ProjectContext): string {
  // MM1 PR-4 · 把 hardcoded 'narrative_short' 替换为 ctx.formatId（默认仍 narrative_short）
  // 让 screenplay system prompt 的 4 分支（concept_short / narrative_short / feature / series）
  // 由 ProjectContext 控制 · 而不是 prompt JSON 里写死。现有项目缺省值 = 'narrative_short' 零行为变化。
  const formatId = ctx.formatId ?? 'narrative_short';
  let out = text
    .replace(/一句话概念:\s*[^\n]+/g, `一句话概念: ${ctx.concept}`)
    .replace(/体量:\s*[^\n]+/g, `体量: ${formatId}`)
    .replace(/单集时长:\s*\*\*\d+\s*分钟\*\*/g, `单集时长: **${ctx.durationMin}分钟**`)
    .replace(/单集时长:\s*\d+\s*分钟/g, `单集时长: ${ctx.durationMin}分钟`)
    .replace(/创作模式:\s*[^\n]+/g, `创作模式: ${ctx.mode}`);

  // 追加结构化字段块（v2，让模型精确感知题材融合 / 平台 / 主角性别 / 核心冲突）
  const struct = buildStructuredFields(ctx);
  if (struct) out += '\n\n' + struct;
  return out;
}

function buildStructuredFields(ctx: ProjectContext): string {
  const lines: string[] = [];
  if (ctx.genres?.length) lines.push(`- 题材融合: ${ctx.genres.join(' + ')}`);
  if (ctx.protagonistGender) {
    const map: Record<string, string> = {
      male: '男主', female: '女主', dual: '男女双主', nonhuman: '非人/特殊',
    };
    lines.push(`- 主角性别: ${map[ctx.protagonistGender] ?? ctx.protagonistGender}`);
  }
  if (ctx.platform) lines.push(`- 目标平台: ${ctx.platform}`);
  if (ctx.coreConflict) lines.push(`- 核心冲突: ${ctx.coreConflict}`);
  if (ctx.adaptSourceType) lines.push(`- 改编原作类型: ${ctx.adaptSourceType}`);

  // ─── 小说创作专用字段 ───
  // 这些字段对 novel 阶段所有 prompt 至关重要（决定章长 / POV / 节奏 / 调性）。
  // 仅当 projectMode='novel' 或 ctx 含 novelPlatform 时注入，避免污染短剧 prompt。
  if (ctx.projectMode === 'novel' || ctx.novelPlatform) {
    const novelLines: string[] = [];
    const audienceMap: Record<string, string> = { male: '男频', female: '女频', general: '通用' };
    const platformMap: Record<string, string> = {
      qidian: '起点中文网', fanqie: '番茄/七猫', jjwxc: '晋江文学城',
      zongheng: '纵横/17K', kindle: 'Kindle/实体', web_free: '通用网络',
    };
    const scaleMap: Record<string, string> = {
      short: '短篇 (~5万)', medium: '中篇 (5-30万)', long: '长篇 (30-150万)',
      mega: '超长 (150-300万)', epic: '史诗 (300万+)',
    };
    const povMap: Record<string, string> = {
      first: '第一人称', third_limited: '第三人称·限制', third_dual: '第三人称·双视角',
      third_multi: '第三人称·多视角', omniscient: '全知视角',
    };
    const toneMap: Record<string, string> = {
      fast_pleasure: '爽文快节奏', literary: '文艺慢节奏', hardcore: '硬核/硬科',
      healing: '治愈日常', dark_heavy: '黑暗厚重', humor: '幽默吐槽',
    };
    if (ctx.novelPlatform) novelLines.push(`- 小说平台: ${platformMap[ctx.novelPlatform] ?? ctx.novelPlatform}`);
    if (ctx.novelAudience) novelLines.push(`- 读者群: ${audienceMap[ctx.novelAudience] ?? ctx.novelAudience}`);
    if (ctx.novelScale) novelLines.push(`- 体量档: ${scaleMap[ctx.novelScale] ?? ctx.novelScale}`);
    if (ctx.novelTotalWordsK) novelLines.push(`- 目标总字数: 约 ${ctx.novelTotalWordsK} 万字`);
    if (ctx.novelTotalChapters) novelLines.push(`- 目标总章节数: ${ctx.novelTotalChapters} 章`);
    if (ctx.novelTotalWordsK && ctx.novelTotalChapters) {
      const wpc = Math.round(ctx.novelTotalWordsK * 10000 / ctx.novelTotalChapters);
      novelLines.push(`- 每章平均字数: ${wpc} 字（±10% 浮动）`);
    }
    if (ctx.novelPov) novelLines.push(`- POV 视角: ${povMap[ctx.novelPov] ?? ctx.novelPov}（**全书锁定，严禁乱跳**）`);
    if (ctx.novelTone) novelLines.push(`- 写作调性: ${toneMap[ctx.novelTone] ?? ctx.novelTone}`);
    if (ctx.novelLogline) novelLines.push(`- 一句话简介: ${ctx.novelLogline}`);
    if (ctx.novelHook) novelLines.push(`- 主角金手指/关键设定: ${ctx.novelHook}`);
    if (novelLines.length) {
      lines.push('### 小说创作硬约束');
      lines.push(...novelLines);
    }
  }

  if (lines.length === 0) return '';
  let out = ['## 项目结构化字段', ...lines, '（以上字段决定 KB 注入与节奏范式，不可与 system 中的硬律冲突）'].join('\n');

  // 小说模式：追加 调性 + 读者群 KB 预设（精炼硬律，每段 ≤ 8 行）
  if (ctx.projectMode === 'novel' || ctx.novelPlatform) {
    const presets = getNovelPresets(ctx.novelTone, ctx.novelAudience);
    if (presets) out += '\n\n' + presets;
  }

  return out;
}
