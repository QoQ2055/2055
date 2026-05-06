// Step-level hard constraints from the SKILL prompts (5-min default).
// These are visualised as progress chips/bars on the Screenplay workbench.

import type { NodeArtifact } from './types';

export interface Constraint {
  label: string;            // "字数 / Logline 长度 / 场次数 …"
  actual: number;
  min?: number;
  max?: number;
  unit?: string;            // "字" / "场"
  ok: boolean;
}

export function computeStepConstraints(
  stepIndex: number,
  artifact: NodeArtifact | undefined,
  durationMin = 5,
): Constraint[] {
  if (!artifact) return [];
  const text = artifact.content;
  const cn = countChineseChars(text);

  switch (stepIndex) {
    case 1: {
      const logline = extractLogline(text);
      const len = countChineseChars(logline);
      return [c('Logline 字数', len, undefined, 80, '字')];
    }
    case 2:
      return [c('梗概字数', cn, 250, 400, '字')];
    case 3: {
      // count "## 角色N" or "角色 N" headings
      const roles = countMatches(text, /^##\s+(?:角色|主角|配角|人物)/gm)
                  || countMatches(text, /^### .+(?:主角|配角)/gm);
      return [c('角色数（建议 2-3）', roles, 2, 3, '个')];
    }
    case 4: {
      // 4 fields, 50–120 chars each
      const sections = splitH2Sections(text);
      const lengths = sections.map((s) => countChineseChars(s));
      const minLen = lengths.length ? Math.min(...lengths) : 0;
      const maxLen = lengths.length ? Math.max(...lengths) : 0;
      return [
        c('段落数（应为 4）', sections.length, 4, 4, '段'),
        c('每段最短字数', minLen, 50, undefined, '字'),
        c('每段最长字数', maxLen, undefined, 120, '字'),
      ];
    }
    case 5: {
      // count event points (每点开头 `- 事件` or `1.` `2.`)
      const events = countMatches(text, /^[\-\*]\s+事件\s*\d+/gm)
                  || countMatches(text, /^\d+[\.、]\s*事件/gm)
                  || countMatches(text, /^[\-\*]\s+/gm);
      const target = Math.round(8 + (durationMin - 5) * 0.4);
      return [c('事件点（建议 8-10）', events, 8, 10, '点')];
    }
    case 6: {
      const scenes = countScenes(text);
      const totalSec = sumDurations(text);
      const targetSec = durationMin * 60;
      const tol = Math.round(targetSec * 0.1);
      return [
        c('场次数（必须 8-10）', scenes, 8, 10, '场'),
        c('累计时长（秒）', totalSec, targetSec - tol, targetSec + tol, 's'),
      ];
    }
    case 7: {
      const bodyChars = countScreenplayBodyChars(text);
      const sceneCount = countScenes(text);
      // Step 7 hard target: 3000–3600 字 for 5 分钟; scale by duration.
      const min = Math.round(3000 * (durationMin / 5));
      const max = Math.round(3600 * (durationMin / 5));
      return [
        c('正文总字数', bodyChars, min, max, '字'),
        c('场次数（必须 8-10）', sceneCount, 8, 10, '场'),
      ];
    }
    case 8: {
      // doctor JSON; expose top-level severity counts if parseable
      try {
        const j = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
        const issues =
          (Array.isArray(j.issues) ? j.issues : []) as Array<{ severity?: string }>;
        const critical = issues.filter((i) => i.severity === 'critical').length;
        return [
          c('严重问题（应为 0）', critical, 0, 0, '条'),
          c('总问题数', issues.length, undefined, undefined, '条'),
        ];
      } catch {
        return [];
      }
    }
    default:
      return [];
  }
}

// --- helpers ----------------------------------------------------------------

function c(label: string, actual: number, min?: number, max?: number, unit?: string): Constraint {
  const ok = (min == null || actual >= min) && (max == null || actual <= max);
  return { label, actual, min, max, unit, ok };
}

export function countChineseChars(text: string): number {
  // count CJK + alphanumeric (rough total chars excluding whitespace/symbols)
  const m = text.match(/[\u4e00-\u9fff\u3400-\u4dbfA-Za-z0-9]/g);
  return m ? m.length : 0;
}

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function extractLogline(text: string): string {
  // try common markers from SKILL templates
  const m = text.match(/(?:logline|Logline|LOGLINE)[:：]?\s*([^\n]+)/);
  if (m) return m[1].trim();
  // fallback: first non-heading non-empty line
  for (const l of text.split('\n')) {
    const t = l.trim();
    if (!t) continue;
    if (/^#|^>|^---|^\*\*BLOCK/.test(t)) continue;
    return t;
  }
  return '';
}

function splitH2Sections(text: string): string[] {
  return text
    .split(/\n##\s+/)
    .slice(1)            // first chunk is preamble
    .map((s) => s.trim())
    .filter(Boolean);
}

export function countScenes(text: string): number {
  // matches "## 场次X" or "【场景X" or "场次X"
  const a = countMatches(text, /^##\s*场次/gm);
  if (a) return a;
  const b = countMatches(text, /【场景\s*\d+/g);
  if (b) return b;
  return countMatches(text, /^场次\s*[一二三四五六七八九十\d]+/gm);
}

export function sumDurations(text: string): number {
  // Sum patterns like "约 35 秒" / "duration: 32" / "（约 1 分钟）"
  let total = 0;
  // "X 秒" / "X s"
  for (const m of text.matchAll(/(\d+)\s*(?:秒|s)\b/g)) total += parseInt(m[1], 10);
  // "X 分钟" → seconds
  for (const m of text.matchAll(/约?\s*(\d+(?:\.\d+)?)\s*分钟?/g)) total += Math.round(parseFloat(m[1]) * 60);
  // "duration: 33"
  for (const m of text.matchAll(/duration["']?\s*[:=]\s*(\d+)/g)) total += parseInt(m[1], 10);
  return total;
}

export function countScreenplayBodyChars(text: string): number {
  // Step 7 standard format: 【场景X：…】 + dialogue + action lines.
  // Strip headings, scene markers, and metadata blocks before counting.
  const cleaned = text
    .replace(/^#.*$/gm, '')                                // markdown headings
    .replace(/^>\s.*$/gm, '')                              // blockquotes
    .replace(/^---+$/gm, '')                               // dividers
    .replace(/```[\s\S]*?```/g, '')                        // code fences
    .replace(/^\*\*BLOCK[^*]*\*\*.*$/gm, '')               // BLOCK markers
    .replace(/^情节节奏[：:][^\n]*$/gm, '')
    .replace(/^情感节奏[：:][^\n]*$/gm, '');
  return countChineseChars(cleaned);
}
