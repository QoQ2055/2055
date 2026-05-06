// Pure builders for v3 gap-e export (FR-1..FR-5 + FR-9 extractors).
//
// Spec sources:
//   - PRD prd-gap-e-export.md FR-1..FR-9
//   - CA architecture-gap-e-export.md sections 3.1 / 3.2 / 3.3 / 3.4 / 3.5
//   - CK checkpoint-gap-e-export.md section 2.2 (PR-2 launch gate)
//
// Invariants (CK section 1.4):
//   - I-1: zero Dexie writes (this module never imports db)
//   - I-2: no react / zustand / dexie imports (pure functions only)
//   - I-3: no URL.createObjectURL (returns in-memory Blob; download happens elsewhere)
//   - I-5: archived/live paths share the same ExportSourceData type
//   - I-6: build* outputs are reproducible given a frozen `ts` parameter

import { sanitizeName, formatStamp, buildExportFilename } from './projectExport';
import { parseLooseArray } from '../pipeline/jsonLoose';
import { parseScreenplayMarkdown, type Element } from '../pipeline/screenplayParser';
import type { NodeArtifact } from '../pipeline/types';

/* ── Source data shape (CA section 3.1) ──────────────── */

export interface ExportNovelSource {
  chapterContents: Record<number, string>;
  chapterTitles: Record<number, string>;
  completedChapters: number[];
  totalChapters: number;
  sourceNodeId: string; // 'novel.7' or 'novel.6'
}

export interface ExportScreenplaySource {
  content: string;
  sourceNodeId: string; // 'screenplay.7' or 'adapt.6'
}

export interface ExportAssetsSource {
  roles: unknown[];
  scenes: unknown[];
  props: unknown[];
}

export interface ExportCtx {
  name: string;
}

export interface ExportSourceData {
  ctx: ExportCtx;
  novel?: ExportNovelSource;
  screenplay?: ExportScreenplaySource;
  assets?: ExportAssetsSource;
}

export interface BuildResult {
  filename: string;
  blob: Blob;
  sizeBytes: number;
}

/* ── Internal helpers ───────────────────────────────── */

function safeStem(ctxName: string, ts: number): { safeName: string; stamp: string } {
  return { safeName: sanitizeName(ctxName), stamp: formatStamp(ts) };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '&') return '&amp;';
    if (c === "'") return '&apos;';
    return '&quot;';
  });
}

function escapeCsvCell(v: unknown): string {
  if (v == null) return '';
  let s: string;
  if (typeof v === 'string') s = v;
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  if (/["\n\r,]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function pickField(item: unknown, candidates: string[]): string {
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;
  for (const k of candidates) {
    if (k in obj && obj[k] != null) {
      const v = obj[k];
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.join(' / ');
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }
  }
  return '';
}

/* ── FR-1 buildNovelMd ──────────────────────────────── */

export function buildNovelMd(src: ExportSourceData, ts: number = Date.now()): BuildResult {
  if (!src.novel) throw new Error('小说章节缺失：source.novel undefined');
  const { safeName, stamp } = safeStem(src.ctx.name, ts);
  const lines: string[] = [];
  lines.push(`# ${src.ctx.name || 'Untitled'}`);
  lines.push('');
  const chapters = src.novel.completedChapters.slice().sort((a, b) => a - b);
  for (const i of chapters) {
    const title = src.novel.chapterTitles[i] || `第 ${i} 章`;
    lines.push(`## ${title}`);
    lines.push('');
    const body = src.novel.chapterContents[i] || '';
    lines.push(body);
    lines.push('');
  }
  const md = lines.join('\n');
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const filename = buildExportFilename(safeName, stamp, '.md');
  return { filename, blob, sizeBytes: blob.size };
}

/* ── FR-2 buildNovelDocx (HTML container; D1 spike candidate) ── */

const DOCX_CSS = [
  "body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; font-size: 12pt; line-height: 1.6; }",
  'h1 { font-size: 22pt; text-align: center; margin: 0 0 24pt 0; }',
  'h2 { font-size: 16pt; margin: 24pt 0 12pt 0; mso-page-break-before: always; page-break-before: always; }',
  'h2:first-of-type { mso-page-break-before: auto; page-break-before: auto; }',
  'p { margin: 0 0 8pt 0; text-indent: 2em; }',
].join(' ');

export function buildNovelDocx(src: ExportSourceData, ts: number = Date.now()): BuildResult {
  if (!src.novel) throw new Error('小说章节缺失：source.novel undefined');
  const { safeName, stamp } = safeStem(src.ctx.name, ts);
  const chapters = src.novel.completedChapters.slice().sort((a, b) => a - b);
  const html: string[] = [];
  html.push(
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">'
  );
  html.push('<head>');
  html.push('<meta charset="UTF-8" />');
  html.push('<meta http-equiv="Content-Type" content="application/vnd.ms-word; charset=UTF-8" />');
  html.push('<title>' + escapeXml(src.ctx.name || 'Untitled') + '</title>');
  html.push('<style>' + DOCX_CSS + '</style>');
  html.push('</head><body>');
  html.push('<h1>' + escapeXml(src.ctx.name || 'Untitled') + '</h1>');
  for (const i of chapters) {
    const title = src.novel.chapterTitles[i] || `第 ${i} 章`;
    html.push('<h2>' + escapeXml(title) + '</h2>');
    const body = src.novel.chapterContents[i] || '';
    for (const para of body.split(/\n\s*\n/)) {
      const t = para.trim();
      if (!t) continue;
      html.push('<p>' + escapeXml(t).replace(/\n/g, '<br />') + '</p>');
    }
  }
  html.push('</body></html>');
  const blob = new Blob([html.join('\n')], { type: 'application/msword;charset=utf-8' });
  const filename = buildExportFilename(safeName, stamp, '.docx');
  return { filename, blob, sizeBytes: blob.size };
}

/* ── FR-3 buildScreenplayFdx (Final Draft XML) ───────── */

const ELEMENT_KIND_TO_FDX: Record<string, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
};

export function buildScreenplayFdx(src: ExportSourceData, ts: number = Date.now()): BuildResult {
  if (!src.screenplay) throw new Error('剧本缺失：source.screenplay undefined');
  const { safeName, stamp } = safeStem(src.ctx.name, ts);
  const elements: Element[] = parseScreenplayMarkdown(src.screenplay.content);
  const xml: string[] = [];
  xml.push('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>');
  xml.push('<FinalDraft DocumentType="Script" Template="No" Version="1">');
  xml.push('  <Content>');
  for (const el of elements) {
    const kind = ELEMENT_KIND_TO_FDX[el.kind] || 'Action';
    xml.push(`    <Paragraph Type="${kind}"><Text>${escapeXml(el.text)}</Text></Paragraph>`);
  }
  xml.push('  </Content>');
  xml.push('</FinalDraft>');
  const blob = new Blob([xml.join('\n')], { type: 'application/xml;charset=utf-8' });
  const filename = buildExportFilename(safeName, stamp, '.fdx');
  return { filename, blob, sizeBytes: blob.size };
}

/* ── FR-4 buildScreenplayFountain ───────────────────── */

export function buildScreenplayFountain(src: ExportSourceData, ts: number = Date.now()): BuildResult {
  if (!src.screenplay) throw new Error('剧本缺失：source.screenplay undefined');
  const { safeName, stamp } = safeStem(src.ctx.name, ts);
  const elements = parseScreenplayMarkdown(src.screenplay.content);
  const out: string[] = [];
  out.push(`Title: ${src.ctx.name || 'Untitled'}`);
  out.push('');
  let prev: string | null = null;
  for (const el of elements) {
    switch (el.kind) {
      case 'scene_heading':
        if (prev) out.push('');
        out.push(el.text.toUpperCase());
        out.push('');
        break;
      case 'transition':
        if (prev) out.push('');
        out.push('> ' + el.text.toUpperCase());
        out.push('');
        break;
      case 'character':
        if (prev) out.push('');
        out.push(el.text.toUpperCase());
        break;
      case 'parenthetical':
        out.push('(' + el.text + ')');
        break;
      case 'dialogue':
        out.push(el.text);
        break;
      case 'action':
      default:
        if (prev && prev !== 'action') out.push('');
        out.push(el.text);
        break;
    }
    prev = el.kind;
  }
  const blob = new Blob([out.join('\n')], { type: 'text/plain;charset=utf-8' });
  const filename = buildExportFilename(safeName, stamp, '.fountain');
  return { filename, blob, sizeBytes: blob.size };
}

/* ── FR-5 buildAssetsCsv ────────────────────────────── */

const ROLE_NAME = ['name', '名称', 'role', '角色名', '角色'];
const ROLE_DESC = ['description', 'desc', '描述', '简介'];
const ROLE_TRAITS = ['traits', '特征', '性格'];
const ROLE_NOTES = ['notes', '备注', 'note'];

const SCENE_NAME = ['name', 'scene', '场景', '场景名', 'title', '标题'];
const SCENE_LOC = ['location', '地点'];
const SCENE_TIME = ['time', '时间'];
const SCENE_DESC = ['description', 'desc', '描述', '简介'];

const PROP_NAME = ['name', 'prop', '道具', '道具名', 'title', '标题'];
const PROP_CAT = ['category', '分类', 'kind'];
const PROP_DESC = ['description', 'desc', '描述', '简介'];

export function buildAssetsCsv(src: ExportSourceData, ts: number = Date.now()): BuildResult {
  if (!src.assets) throw new Error('资产缺失：source.assets undefined');
  const { safeName, stamp } = safeStem(src.ctx.name, ts);
  // unified flat header (CA section 3.5).
  const header = ['type', 'name', 'location', 'time', 'category', 'description', 'traits', 'notes'];
  const rows: string[][] = [];
  for (const item of src.assets.roles) {
    rows.push([
      'role',
      pickField(item, ROLE_NAME),
      '',
      '',
      '',
      pickField(item, ROLE_DESC),
      pickField(item, ROLE_TRAITS),
      pickField(item, ROLE_NOTES),
    ]);
  }
  for (const item of src.assets.scenes) {
    rows.push([
      'scene',
      pickField(item, SCENE_NAME),
      pickField(item, SCENE_LOC),
      pickField(item, SCENE_TIME),
      '',
      pickField(item, SCENE_DESC),
      '',
      '',
    ]);
  }
  for (const item of src.assets.props) {
    rows.push([
      'prop',
      pickField(item, PROP_NAME),
      '',
      '',
      pickField(item, PROP_CAT),
      pickField(item, PROP_DESC),
      '',
      '',
    ]);
  }
  const csvLines: string[] = [];
  csvLines.push(header.map(escapeCsvCell).join(','));
  for (const row of rows) {
    csvLines.push(row.map(escapeCsvCell).join(','));
  }
  // BOM for Excel UTF-8 detection (NFR-6).
  const text = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const filename = buildExportFilename(safeName, stamp, '.csv');
  return { filename, blob, sizeBytes: blob.size };
}

/* ── FR-9 source data extractors (CA section 3.5) ───── */

export function extractNovelSource(
  artifacts: Record<string, NodeArtifact>,
): ExportNovelSource | undefined {
  const a = artifacts['novel.7'] || artifacts['novel.6'];
  if (!a) return undefined;
  const meta = (a.meta ?? {}) as Record<string, unknown>;
  const chapterContents = (meta.chapterContents ?? {}) as Record<number, string>;
  const chapterTitles = (meta.chapterTitles ?? {}) as Record<number, string>;
  const completedChapters = (meta.completedChapters ?? []) as number[];
  if (!Array.isArray(completedChapters) || !completedChapters.length) return undefined;
  const totalChapters =
    typeof meta.chapterCount === 'number' ? (meta.chapterCount as number) : completedChapters.length;
  return {
    chapterContents,
    chapterTitles,
    completedChapters,
    totalChapters,
    sourceNodeId: a.nodeId,
  };
}

export function extractScreenplaySource(
  artifacts: Record<string, NodeArtifact>,
): ExportScreenplaySource | undefined {
  const a = artifacts['screenplay.7'] || artifacts['adapt.6'];
  if (!a || !a.content) return undefined;
  return { content: a.content, sourceNodeId: a.nodeId };
}

export function extractAssetsSource(
  artifacts: Record<string, NodeArtifact>,
): ExportAssetsSource | undefined {
  const assetArts = Object.values(artifacts).filter((a) => a.stageId === 'assets');
  if (!assetArts.length) return undefined;
  const roles: unknown[] = [];
  const scenes: unknown[] = [];
  const props: unknown[] = [];
  for (const a of assetArts) {
    if (!a.content) continue;
    const id = a.nodeId.toLowerCase();
    const title = (a.title || '').toLowerCase();
    if (/角色|role|人物/.test(title) || /role/.test(id)) {
      roles.push(...parseLooseArray(a.content));
    } else if (/场景|scene/.test(title) || /scene/.test(id)) {
      scenes.push(...parseLooseArray(a.content));
    } else if (/道具|prop/.test(title) || /prop/.test(id)) {
      props.push(...parseLooseArray(a.content));
    }
  }
  if (!roles.length && !scenes.length && !props.length) return undefined;
  return { roles, scenes, props };
}
