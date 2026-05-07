/**
 * gap-e Export · 6 种创作产物文件构建（不含 .flil.json · 那是项目包级别 · 仍走 projectExport.ts）
 *
 * **设计原则**（gap-e PRD §0.5 红线）：
 *   • 0 npm 依赖（纯字符串 + Blob · Karpathy "Simplicity First"）
 *   • 不动 Dexie schema（NFR-9 零 IDB 写）
 *   • 不动 .flil.json 格式（与本模块正交）
 *   • 不动 Screenplay exportToAssets()（同名异义 · 见红线 #3）
 *
 * **导出函数命名**（NFR-7 钉死的清单）：
 *   • buildNovelMd / buildNovelDocx       (FR-1 / FR-2)
 *   • buildScreenplayFdx / buildScreenplayFountain  (FR-3 / FR-4)
 *   • buildAssetsCsv                       (FR-5)
 *   • parseScreenplayElements              (FR-8 共用 helper)
 *
 * 全部返回 `{ filename, blob } | null`：
 *   • null = 数据源缺失（调用方 disabled UI · 不抛错）
 *   • blob 直接 download via URL.createObjectURL
 */

import { parseLooseArray } from '../pipeline/jsonLoose';
import type { ProjectContext, NodeArtifact } from '../pipeline/types';
import type { NovelChapterLoopMeta } from '../pipeline/novelLoop';

export interface ExportContext {
  ctx: ProjectContext;
  artifacts: Record<string, NodeArtifact>;
}

export interface ExportResult {
  filename: string;
  blob: Blob;
}

/* ─── 通用 helper ──────────────────────────────────────────────── */

/** 文件名安全化 · FR-7：替换 Windows / macOS 非法字符 */
function safeName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'untitled';
}

/** 当前日期 YYYYMMDD（FR-7） */
function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** 当前时间戳（导出文件头） */
function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** XML 转义 · 5 字符 · 不依赖 DOM */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** HTML 转义 · 5 字符 */
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** CSV 字段转义 · RFC 4180 */
function csvField(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/* ─── 小说数据源（gap-e FR-1/2 共用） ────────────────────────────── */

interface NovelChapters {
  titles: Record<number, string>;
  contents: Record<number, string>;
  /** 已完成章节序号升序数组 · 来自 chapterContents key */
  completedIndexes: number[];
  /** 期望章数（如有 ctx.novelTotalChapters） · 用于显示"X/N"提示 */
  expectedTotal: number | null;
  /** 数据源 · 用于文件头注明 */
  source: 'polish' | 'draft';
}

function readNovelChapters(c: ExportContext): NovelChapters | null {
  // 优先 polish (novel.7) · 回退 draft (novel.6)
  const polish = c.artifacts['novel.7'];
  const draft = c.artifacts['novel.6'];
  const meta = (polish?.meta ?? draft?.meta ?? null) as Partial<NovelChapterLoopMeta> | null;
  const source: 'polish' | 'draft' = polish ? 'polish' : 'draft';

  if (!meta || !meta.chapterContents || Object.keys(meta.chapterContents).length === 0) {
    // 回退 · 旧 artifact 仅有 content 字段 · 已是按章拼接的 markdown
    const fallback = polish?.content ?? draft?.content;
    if (!fallback) return null;
    return {
      titles: {},
      contents: { 1: fallback },
      completedIndexes: [1],
      expectedTotal: c.ctx.novelTotalChapters ?? null,
      source,
    };
  }

  const indexes = Object.keys(meta.chapterContents)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  return {
    titles: meta.chapterTitles ?? {},
    contents: meta.chapterContents,
    completedIndexes: indexes,
    expectedTotal: c.ctx.novelTotalChapters ?? null,
    source,
  };
}

/** 估算总字数（中文字符数 · 不计标点空白）· 用于文件头 */
function countChars(contents: Record<number, string>): number {
  let n = 0;
  for (const v of Object.values(contents)) {
    n += (v.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  }
  return n;
}

/* ─── FR-1 · 小说 → .md ──────────────────────────────────────── */

export function buildNovelMd(c: ExportContext): ExportResult | null {
  const data = readNovelChapters(c);
  if (!data) return null;

  const lines: string[] = [];
  lines.push(`# ${c.ctx.name}`);
  lines.push('');
  const chapterCount = data.completedIndexes.length;
  const wordCount = countChars(data.contents);
  const sourceLabel = data.source === 'polish' ? '润色稿' : '草稿';
  let header = `> 导出于 ${nowStamp()} · 共 ${chapterCount} 章 · 约 ${wordCount} 字 · ${sourceLabel}`;
  if (data.expectedTotal && chapterCount < data.expectedTotal) {
    header += `\n> ⚠ 注：共规划 ${data.expectedTotal} 章 · 当前仅 ${chapterCount} 章已完成`;
  }
  lines.push(header);
  lines.push('');

  for (const idx of data.completedIndexes) {
    const title = data.titles[idx] ?? '';
    const heading = title ? `## 第 ${idx} 章 · ${title}` : `## 第 ${idx} 章`;
    lines.push(heading);
    lines.push('');
    lines.push((data.contents[idx] ?? '').trim());
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  return {
    filename: `${safeName(c.ctx.name)}-${todayStamp()}.md`,
    blob,
  };
}

/* ─── FR-2 · 小说 → .docx（Word HTML 容器路线 · 0 依赖） ─────── */

export function buildNovelDocx(c: ExportContext): ExportResult | null {
  const data = readNovelChapters(c);
  if (!data) return null;

  const chapterCount = data.completedIndexes.length;
  const wordCount = countChars(data.contents);
  const sourceLabel = data.source === 'polish' ? '润色稿' : '草稿';

  const head = [
    '<!DOCTYPE html>',
    '<html><head>',
    '<meta charset="UTF-8">',
    `<title>${htmlEscape(c.ctx.name)}</title>`,
    '<style>',
    'body { font-family: "Microsoft YaHei", "PingFang SC", "Source Han Sans SC", serif; line-height: 1.7; }',
    'h1 { font-size: 24pt; text-align: center; margin: 24pt 0 12pt; }',
    'h2 { font-size: 16pt; margin: 18pt 0 8pt; page-break-before: always; }',
    'p { margin: 0 0 8pt; text-indent: 2em; }',
    'hr { border: none; border-top: 1px solid #999; margin: 12pt 0; }',
    '.export-meta { text-align: center; color: #666; font-size: 10pt; margin-bottom: 18pt; }',
    '</style>',
    '</head><body>',
  ].join('\n');

  const body: string[] = [];
  body.push(`<h1>${htmlEscape(c.ctx.name)}</h1>`);
  let metaLine = `导出于 ${nowStamp()} · 共 ${chapterCount} 章 · 约 ${wordCount} 字 · ${sourceLabel}`;
  if (data.expectedTotal && chapterCount < data.expectedTotal) {
    metaLine += ` · ⚠ 共规划 ${data.expectedTotal} 章 · 当前 ${chapterCount} 章`;
  }
  body.push(`<p class="export-meta">${htmlEscape(metaLine)}</p>`);

  for (const idx of data.completedIndexes) {
    const title = data.titles[idx] ?? '';
    const heading = title ? `第 ${idx} 章 · ${title}` : `第 ${idx} 章`;
    body.push(`<h2>${htmlEscape(heading)}</h2>`);
    const content = (data.contents[idx] ?? '').trim();
    // 段落切分：连续两 \n = 段间 · 单 \n = 内换行（保留 <br>）
    const paragraphs = content.split(/\n{2,}/);
    for (const p of paragraphs) {
      const inner = htmlEscape(p).replace(/\n/g, '<br>');
      body.push(`<p>${inner}</p>`);
    }
  }

  body.push('</body></html>');
  const html = head + '\n' + body.join('\n');

  // Word 2016+ 接受 application/msword + .docx 扩展名 · 历史兼容路径
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  return {
    filename: `${safeName(c.ctx.name)}-${todayStamp()}.docx`,
    blob,
  };
}

/* ─── 剧本数据源 + element 分类（FR-3/4/8 共用） ──────────────── */

export type ScreenplayElementType = 'sceneHeading' | 'action' | 'character' | 'dialogue' | 'transition';

export interface ScreenplayElement {
  type: ScreenplayElementType;
  text: string;
}

function readScreenplayMd(c: ExportContext): string | null {
  return c.artifacts['screenplay.7']?.content
    ?? c.artifacts['adapt.6']?.content
    ?? null;
}

/**
 * FR-8 · markdown → element 数组（启发式 · 短剧场景覆盖 90%+）
 *
 * 启发式规则（按行扫描 · 状态机）：
 *   • 场景头：`INT.` / `EXT.` / `EST.` / `内` / `外` 起头 · 整行
 *   • 转场：`> CUT TO:` / `FADE OUT.` 等以 `>` 起头 · 或全大写英文 + ` TO:` 结尾
 *   • 人物名 + 对白：人物名 = 短行（≤ 12 字符 · 不含句号）+ 紧跟非空行作为对白
 *   • 其余：动作（默认归类）
 *
 * 不做的：parenthetical / shot / dual dialogue 等罕见类型 · 全归 action · 不丢内容
 */
export function parseScreenplayElements(md: string): ScreenplayElement[] {
  const out: ScreenplayElement[] = [];
  const lines = md.split(/\r?\n/).map((l) => l.trim());

  const isSceneHead = (l: string) =>
    /^(INT\.|EXT\.|EST\.|I\/E\.)\s/i.test(l)
    || /^[内外]\s*[\.\-—－]/.test(l)
    || /^场\s*[\d一二三四五六七八九十]+/.test(l);

  const isTransition = (l: string) =>
    /^>\s/.test(l)
    || /^[A-Z][A-Z\s]+ TO[:：]\s*$/.test(l)
    || /^(淡入|淡出|切至|溶入|叠化)/.test(l);

  const stripPrefix = (l: string) => l.replace(/^>\s*/, '').replace(/^#+\s*/, '');

  // 候选人物名：短（中文 ≤ 8 / 英文 ≤ 20）· 不含句末标点 · 不是其它类型
  const isCharacterCandidate = (l: string) => {
    if (!l) return false;
    if (l.length > 24) return false;
    if (/[。；！？.;!?]$/.test(l)) return false;
    if (isSceneHead(l) || isTransition(l)) return false;
    // 排除 markdown 标题 / 列表 / 引用
    if (/^[#\->*\d+\.\s]/.test(l) && !/^[#]+\s/.test(l)) return false;
    return true;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;

    if (isSceneHead(raw)) {
      out.push({ type: 'sceneHeading', text: stripPrefix(raw).toUpperCase() });
      continue;
    }
    if (isTransition(raw)) {
      out.push({ type: 'transition', text: stripPrefix(raw).toUpperCase() });
      continue;
    }

    // 人物 + 对白 · 看下一行
    const next = lines[i + 1] ?? '';
    if (isCharacterCandidate(raw) && next && !isSceneHead(next) && !isTransition(next) && !isCharacterCandidate(next)) {
      out.push({ type: 'character', text: stripPrefix(raw) });
      out.push({ type: 'dialogue', text: next });
      i++; // 跳过对白行
      continue;
    }

    out.push({ type: 'action', text: stripPrefix(raw) });
  }

  return out;
}

/* ─── FR-3 · 剧本 → .fdx ─────────────────────────────────────── */

const FDX_TYPE_MAP: Record<ScreenplayElementType, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  transition: 'Transition',
};

export function buildScreenplayFdx(c: ExportContext): ExportResult | null {
  const md = readScreenplayMd(c);
  if (!md) return null;

  const elements = parseScreenplayElements(md);
  const paragraphs = elements
    .map((el) => `    <Paragraph Type="${FDX_TYPE_MAP[el.type]}"><Text>${xmlEscape(el.text)}</Text></Paragraph>`)
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="1">',
    '  <Content>',
    paragraphs,
    '  </Content>',
    '</FinalDraft>',
  ].join('\n');

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  return {
    filename: `${safeName(c.ctx.name)}-${todayStamp()}.fdx`,
    blob,
  };
}

/* ─── FR-4 · 剧本 → .fountain ────────────────────────────────── */

export function buildScreenplayFountain(c: ExportContext): ExportResult | null {
  const md = readScreenplayMd(c);
  if (!md) return null;

  const elements = parseScreenplayElements(md);
  const lines: string[] = [];

  // Title page
  lines.push(`Title: ${c.ctx.name}`);
  lines.push('Author: QvQ');
  lines.push(`Draft date: ${nowStamp()}`);
  lines.push('');
  lines.push('===');
  lines.push('');

  let prevType: ScreenplayElementType | null = null;
  for (const el of elements) {
    // 段间空行规则
    if (prevType && (el.type === 'sceneHeading' || el.type === 'character' || el.type === 'transition')) {
      lines.push('');
    }
    switch (el.type) {
      case 'sceneHeading':
        lines.push(el.text);
        break;
      case 'action':
        lines.push(el.text);
        break;
      case 'character':
        lines.push(el.text.toUpperCase());
        break;
      case 'dialogue':
        lines.push(el.text);
        break;
      case 'transition':
        lines.push(`> ${el.text}`);
        break;
    }
    prevType = el.type;
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  return {
    filename: `${safeName(c.ctx.name)}-${todayStamp()}.fountain`,
    blob,
  };
}

/* ─── FR-5 · 资产 → .csv（UTF-8 with BOM） ───────────────────── */

export function buildAssetsCsv(c: ExportContext): ExportResult | null {
  const a2 = c.artifacts['assets.2']; // 角色
  const a3 = c.artifacts['assets.3']; // 场景
  const a4 = c.artifacts['assets.4']; // 道具

  const roles = a2 ? safeParseArray(a2.content) : [];
  const scenes = a3 ? safeParseArray(a3.content) : [];
  const props = a4 ? safeParseArray(a4.content) : [];

  if (roles.length === 0 && scenes.length === 0 && props.length === 0) return null;

  // FR-9 · 固定列序 · 中文表头
  const headers = ['分类', '名称', '描述', '视觉风格', '关联场次', '其他属性'];
  const rows: string[][] = [];

  for (const r of roles) {
    rows.push([
      '角色',
      String(r.name ?? r.title ?? ''),
      String(r.description ?? r.desc ?? ''),
      String(r.visualStyle ?? r.style ?? ''),
      String(r.scenes ?? r.relatedScenes ?? ''),
      summarizeRest(r, ['name', 'title', 'description', 'desc', 'visualStyle', 'style', 'scenes', 'relatedScenes']),
    ]);
  }
  for (const s of scenes) {
    rows.push([
      '场景',
      String(s.name ?? s.title ?? ''),
      String(s.description ?? s.desc ?? ''),
      String(s.visualStyle ?? s.style ?? ''),
      String(s.scenes ?? s.relatedScenes ?? ''),
      summarizeRest(s, ['name', 'title', 'description', 'desc', 'visualStyle', 'style', 'scenes', 'relatedScenes']),
    ]);
  }
  for (const p of props) {
    rows.push([
      '道具',
      String(p.name ?? p.title ?? ''),
      String(p.description ?? p.desc ?? ''),
      String(p.visualStyle ?? p.style ?? ''),
      String(p.scenes ?? p.relatedScenes ?? ''),
      summarizeRest(p, ['name', 'title', 'description', 'desc', 'visualStyle', 'style', 'scenes', 'relatedScenes']),
    ]);
  }

  const csv = [
    headers.map(csvField).join(','),
    ...rows.map((r) => r.map(csvField).join(',')),
  ].join('\r\n');

  // BOM · 中文 Excel 强制需要
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  return {
    filename: `${safeName(c.ctx.name)}-资产-${todayStamp()}.csv`,
    blob,
  };
}

function safeParseArray(content: string): Array<Record<string, unknown>> {
  try {
    const arr = parseLooseArray(content);
    return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
  } catch (e) {
    console.error('[exportFormats] parseLooseArray failed', e);
    return [];
  }
}

/** 汇总未在固定列里出现的字段 · 拼成 "k1: v1; k2: v2" */
function summarizeRest(obj: Record<string, unknown>, exclude: string[]): string {
  const keys = Object.keys(obj).filter((k) => !exclude.includes(k));
  if (keys.length === 0) return '';
  return keys
    .map((k) => `${k}: ${typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : String(obj[k])}`)
    .join('; ');
}

/* ─── 下载触发 · 公共 helper ────────────────────────────────── */

export function downloadExportResult(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 微延迟后释放 · 避免 Safari 等浏览器中下载未触发即被回收
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
