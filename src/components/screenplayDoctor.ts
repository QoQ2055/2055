// 剧本医生（Script Doctor Lite）
// 二阶段工作流：
//   1) runDoctorDiagnose(script)        → 输出结构化 JSON 诊断报告
//   2) runDoctorRewrite(script, report) → 输出修订后的完整剧本（markdown）

import { chatStream } from '../llm/deepseek';
import type { SettingsState } from '../store/settings';

/* ── 类型 ─────────────────────────────────────────────────── */

export type IssueSeverity = 'high' | 'mid' | 'low';
export type IssueCategory =
  | '戏剧结构'
  | '人物动机'
  | '场次平衡'
  | '台词质量'
  | '场景头格式'
  | '遗漏元素'
  | '叙事节奏';
export type OverallVerdict = 'pass' | 'minor_issues' | 'major_revision' | 'needs_rewrite';

export interface DoctorIssue {
  severity: IssueSeverity;
  category: IssueCategory | string;
  location: string;
  description: string;
  suggestion: string;
}

export interface DoctorReport {
  overall: OverallVerdict;
  summary: string;
  issues: DoctorIssue[];
}

export interface DoctorDiagnoseOptions {
  script: string;
  settings: Pick<SettingsState, 'baseUrl' | 'apiKey' | 'model'>;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

export interface DoctorDiagnoseResult {
  report: DoctorReport | null;
  rawOutput: string;
  parseError?: string;
  durationMs: number;
  tokens: number;
}

export interface DoctorRewriteOptions {
  script: string;
  report: DoctorReport;
  settings: Pick<SettingsState, 'baseUrl' | 'apiKey' | 'model'>;
  signal?: AbortSignal;
  onDelta?: (chunk: string, full: string) => void;
}

export interface DoctorRewriteResult {
  rewritten: string;
  durationMs: number;
  tokens: number;
}

/* ── prompt 加载（带模块级缓存） ──────────────────────────── */

let cachedDiagnosePrompt: string | null = null;
let cachedRewritePrompt: string | null = null;

async function loadSystemPrompt(file: string, cacheRef: 'diagnose' | 'rewrite'): Promise<string> {
  if (cacheRef === 'diagnose' && cachedDiagnosePrompt) return cachedDiagnosePrompt;
  if (cacheRef === 'rewrite' && cachedRewritePrompt) return cachedRewritePrompt;

  const r = await fetch(`/prompts/utility/${file}`);
  if (!r.ok) throw new Error(`加载提示词 ${file} 失败：HTTP ${r.status}`);
  const j = await r.json();
  const content: string = j?.messages?.[0]?.content ?? j?.system ?? '';
  if (!content) throw new Error(`提示词 ${file} 内容为空`);

  if (cacheRef === 'diagnose') cachedDiagnosePrompt = content;
  else cachedRewritePrompt = content;
  return content;
}

/* ── 诊断 ─────────────────────────────────────────────────── */

export async function runDoctorDiagnose(opts: DoctorDiagnoseOptions): Promise<DoctorDiagnoseResult> {
  const { script, settings, signal, onDelta } = opts;
  const system = await loadSystemPrompt('script_doctor_lite.json', 'diagnose');
  const user = `【待审剧本】\n${script}\n\n请输出诊断 JSON。`;

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    signal,
    onDelta,
  });

  const raw = stripFence(res.content.trim());
  let report: DoctorReport | null = null;
  let parseError: string | undefined;

  // 兜底解析：直接 JSON.parse → 失败则尝试抽出第一个 { ... } 块
  try {
    report = JSON.parse(raw) as DoctorReport;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        report = JSON.parse(m[0]) as DoctorReport;
      } catch (e: any) {
        parseError = `JSON 解析失败：${e?.message ?? e}`;
      }
    } else {
      parseError = 'LLM 输出未包含 JSON 对象';
    }
  }

  if (report && !validateReport(report)) {
    parseError = 'JSON 形态不匹配（缺字段或类型错）';
    report = null;
  }

  return {
    report,
    rawOutput: raw,
    parseError,
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens ?? 0,
  };
}

/* ── 改写 ─────────────────────────────────────────────────── */

export async function runDoctorRewrite(opts: DoctorRewriteOptions): Promise<DoctorRewriteResult> {
  const { script, report, settings, signal, onDelta } = opts;
  const system = await loadSystemPrompt('script_doctor_rewrite.json', 'rewrite');
  const user = [
    '【原剧本】',
    script,
    '',
    '【诊断报告】',
    JSON.stringify(report, null, 2),
    '',
    '请按报告中的建议修订剧本。直接输出完整的修订版剧本（markdown 全文），从第一行开始，不要任何前置语 / JSON / 围栏。',
  ].join('\n');

  const res = await chatStream({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
    max_tokens: 16384,
    signal,
    onDelta,
  });

  return {
    rewritten: stripFence(res.content.trim()),
    durationMs: res.durationMs,
    tokens: res.usage?.total_tokens ?? 0,
  };
}

/* ── 工具函数 ─────────────────────────────────────────────── */

function stripFence(s: string): string {
  const fence = /^```(?:json|markdown|md|text)?\s*\n([\s\S]*?)\n```$/i;
  const m = s.match(fence);
  return m ? m[1].trim() : s;
}

function validateReport(x: any): x is DoctorReport {
  if (!x || typeof x !== 'object') return false;
  if (!['pass', 'minor_issues', 'major_revision', 'needs_rewrite'].includes(x.overall)) return false;
  if (typeof x.summary !== 'string') return false;
  if (!Array.isArray(x.issues)) return false;
  for (const it of x.issues) {
    if (!it || typeof it !== 'object') return false;
    if (!['high', 'mid', 'low'].includes(it.severity)) return false;
    if (typeof it.category !== 'string') return false;
    if (typeof it.location !== 'string') return false;
    if (typeof it.description !== 'string') return false;
    if (typeof it.suggestion !== 'string') return false;
  }
  return true;
}

/** 报告整体严重度色（用于 UI 边框 / 标签） */
export function verdictColor(v: OverallVerdict): { label: string; cls: string } {
  switch (v) {
    case 'pass':
      return { label: '通过', cls: 'text-success border-success/40 bg-success/5' };
    case 'minor_issues':
      return { label: '小问题', cls: 'text-warning border-warning/40 bg-warning/5' };
    case 'major_revision':
      return { label: '需修订', cls: 'text-orange-300 border-orange-500/40 bg-orange-500/5' };
    case 'needs_rewrite':
      return { label: '需重写', cls: 'text-danger border-danger/40 bg-danger/5' };
  }
}

export function severityColor(s: IssueSeverity): { dot: string; text: string; bg: string } {
  switch (s) {
    case 'high':
      return { dot: 'bg-rose-500', text: 'text-danger', bg: 'bg-danger/5 border-danger/30' };
    case 'mid':
      return { dot: 'bg-amber-500', text: 'text-warning', bg: 'bg-warning/5 border-warning/30' };
    case 'low':
      return { dot: 'bg-zinc-500', text: 'text-fg-secondary', bg: 'bg-zinc-700/30 border-border-default' };
  }
}
