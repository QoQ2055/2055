// 通用产物结构化展示组件
// 把一份 markdown 产物按 nodeId 自适应拆分为多张卡片，
// 每张卡片都有独立的复制按钮 + 折叠 + 搜索高亮。
//
// 拆分策略（按 nodeId 自动嗅探）：
//   assets.2/3/4   → 优先尝试解析为 JSON 数组，每个对象一卡，标题取 name 字段
//   storyboard.1   → 按 \n---\n 切；META/PARA/PEAK/BUFFER/SUBTEXT 合并为「前置元数据」一卡，UNIT N 各自一卡
//   storyboard.2*  → 优先按 \n\n---\n\n 分割（Phase 2 单元分隔符）
//   其他          → 按 ## 二级标题切；只 1 段时回退按 ### 三级标题
//   仍只 1 段     → 直接走"原始视图"，不强行拆分
//
// 如果拆出 ≥ 2 段：渲染卡片网格 + 顶部工具条（复制全部 / 折叠 / 搜索 / 切回原始）
// 如果只 1 段：渲染单个 <pre> + 复制按钮

import { useMemo, useState, type ReactNode } from 'react';
import {
  Copy, Check, Search, ChevronDown, ChevronRight,
  LayoutGrid, FileText, X,
} from 'lucide-react';
import clsx from 'clsx';

interface Props {
  content: string;
  nodeId: string;
  className?: string;
  /** 卡片正文区最大高度（px），默认 320 */
  maxBodyHeight?: number;
}

interface Section {
  /** 标题（拆出的或自动生成的） */
  title: string;
  /** 完整正文（含原标题行，方便整段复制） */
  body: string;
}

/* ─── 拆分逻辑 ─────────────────────────────────────────────── */

function splitByHeading(content: string, level: 2 | 3): Section[] {
  // 把 ## / ### 行作为 section 起始，title 取该行剩余文本
  const re = level === 2 ? /^##\s+(.+?)\s*$/gm : /^###\s+(.+?)\s*$/gm;
  const matches: { idx: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    matches.push({ idx: m.index, title: m[1].trim() });
  }
  if (matches.length === 0) return [];

  const sections: Section[] = [];
  // 第一个 heading 之前的内容（preamble）忽略——因为每 section 应从 heading 起算
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : content.length;
    const body = content.slice(start, end).trim();
    if (body) sections.push({ title: matches[i].title, body });
  }
  return sections;
}

/**
 * 按 `## UNIT N` 外层标题切分（storyboard.2 专用）。
 * runner.ts 的 assembleArtifact 会在每个单元正文前强制写入 `## UNIT N`
 * （或 `## UNIT N · 待生成` / `## UNIT N ⚠ 失败`），这是最稳定的单元边界。
 * 单元内 LLM 输出的 `---` / 二级子字段 (`## 锚点` 等) 不会触发这里的切分。
 */
function splitByUnitHeading(content: string): Section[] {
  const re = /^##\s+UNIT\s+(\d+)([^\n]*)$/gim;
  const matches: { idx: number; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const tail = (m[2] || '').trim();
    matches.push({
      idx: m.index,
      title: tail ? `UNIT ${m[1]} ${tail}` : `UNIT ${m[1]}`,
    });
  }
  if (matches.length < 2) return [];

  const sections: Section[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : content.length;
    const body = content.slice(start, end).trim();
    if (body) sections.push({ title: matches[i].title, body });
  }
  return sections;
}

function splitBySeparator(content: string): Section[] {
  // \n---\n 为 markdown 水平分割线；分镜.2 单元就是这么拼的
  const parts = content
    .split(/\n\s*---\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length <= 1) return [];
  return parts.map((body, i) => {
    // 标题：找正文第一行的 #+ 标题，否则用"段 N"
    const firstHeading = body.match(/^#{1,6}\s+(.+?)\s*$/m);
    const title = firstHeading ? firstHeading[1].trim() : `段 ${i + 1}`;
    return { title, body };
  });
}

function inferSections(content: string, nodeId: string): Section[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  // 0. 资产阶段（角色/场景/道具）：先尝试 JSON 数组解析
  if (/^assets\.[234]\b/.test(nodeId)) {
    const arr = tryParseJsonArray(trimmed);
    if (arr && arr.length >= 2) {
      return arr.map((obj, i) => ({
        title: pickItemName(obj, i),
        body: '```json\n' + JSON.stringify(obj, null, 2) + '\n```',
      }));
    }
  }

  // 1. storyboard.1 (Phase A-D 单元规划)：按 --- 切，META/PARA/PEAK/BUFFER/SUBTEXT 合并为元数据卡
  if (nodeId.startsWith('storyboard.1')) {
    const grouped = groupStoryboardPlanSections(trimmed);
    if (grouped.length >= 2) return grouped;
  }

  // 2. storyboard.2 (Phase E-G 逐单元 Seedance prompt)：按 `## UNIT N` 外层标题聚合。
  //    单元内部的双区分隔线 (---) 与 `## 锚点 / ## 时序 / ## Must-Show` 等子字段
  //    都属于 ONE UNIT 的内容，不应再被拆分。
  if (nodeId.startsWith('storyboard.2')) {
    const byUnit = splitByUnitHeading(trimmed);
    if (byUnit.length >= 2) return byUnit;
    // 兜底：极端情况下没有 UNIT 标题（旧产物）才回退
    const bySep = splitBySeparator(trimmed);
    if (bySep.length >= 2) return bySep;
    const byH2 = splitByHeading(trimmed, 2);
    if (byH2.length >= 2) return byH2;
  }

  // 3. 其他：先 ##，再 ###，再 ---
  const byH2 = splitByHeading(trimmed, 2);
  if (byH2.length >= 2) return byH2;

  const byH3 = splitByHeading(trimmed, 3);
  if (byH3.length >= 2) return byH3;

  const bySep = splitBySeparator(trimmed);
  if (bySep.length >= 2) return bySep;

  return []; // 表示无法拆分，调用方走原始视图
}

/* ─── JSON 数组解析（assets.*） ──────────────────────────────── */

function tryParseJsonArray(s: string): any[] | null {
  // 直接解析
  const direct = safeParseToArray(s);
  if (direct) return direct;

  // 抽 ```json ... ``` 围栏
  const fenceMatch = s.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    const arr = safeParseToArray(fenceMatch[1]);
    if (arr) return arr;
  }

  // 抽第一个 [...] 块
  const arrMatch = s.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrMatch) {
    const arr = safeParseToArray(arrMatch[0]);
    if (arr) return arr;
  }

  return null;
}

function safeParseToArray(s: string): any[] | null {
  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j;
    // 容器对象：{ characters: [...], scenes: [...], ... }
    if (j && typeof j === 'object') {
      for (const k of ['characters', 'roles', 'scenes', 'props', 'items', 'list', 'data']) {
        if (Array.isArray(j[k])) return j[k];
      }
      // 单对象时也包成单元素数组（虽然不会触发 ≥2 但保留逻辑完整）
      if (Object.keys(j).length > 0) return [j];
    }
  } catch {
    /* fall through */
  }
  return null;
}

function pickItemName(obj: any, fallback: number): string {
  if (!obj || typeof obj !== 'object') return `项 ${fallback + 1}`;
  // 优先使用名字类字段；带 ref/category 等做副标题
  const name = obj.name || obj.title || obj.id || obj.ref || `项 ${fallback + 1}`;
  const tag = obj.category || obj.role || obj.sceneType;
  return tag ? `${name} · ${tag}` : String(name);
}

/* ─── storyboard.1 分组：把元数据合并、UNIT 单独 ───────────── */

function groupStoryboardPlanSections(content: string): Section[] {
  const parts = content
    .split(/\n\s*---\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length < 2) return [];

  const metaBlocks: string[] = [];
  const units: Section[] = [];
  for (const p of parts) {
    // 找首行 #+ 标题
    const m = p.match(/^#{1,4}\s+(.+?)\s*$/m);
    const title = m ? m[1].trim() : p.slice(0, 30).replace(/\n/g, ' ');
    if (/^UNIT\b/i.test(title)) {
      units.push({ title, body: p });
    } else {
      metaBlocks.push(p);
    }
  }

  const sections: Section[] = [];
  if (metaBlocks.length > 0) {
    sections.push({
      title: `前置元数据（META / PARA / PEAK / BUFFER / SUBTEXT，共 ${metaBlocks.length} 块）`,
      body: metaBlocks.join('\n\n---\n\n'),
    });
  }
  sections.push(...units);
  return sections;
}

/* ─── 复制按钮（带 1.2s 反馈） ──────────────────────────────── */

function CopyButton({
  text, label, className,
}: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className={clsx(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors',
        copied
          ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10'
          : 'border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
        className,
      )}
      title={copied ? '已复制' : `复制${label ? ` ${label}` : ''}`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {label && <span>{copied ? '已复制' : label}</span>}
    </button>
  );
}

/* ─── 主组件 ───────────────────────────────────────────────── */

export function ArtifactStructuredView({
  content, nodeId, className, maxBodyHeight = 320,
}: Props) {
  const sections = useMemo(() => inferSections(content, nodeId), [content, nodeId]);
  const [view, setView] = useState<'cards' | 'raw'>('cards');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  // 没拆出 → 直接原始视图
  if (sections.length === 0) {
    return <RawView content={content} className={className} maxHeight={maxBodyHeight} />;
  }

  // 强制原始视图分支
  if (view === 'raw') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 mb-2">
          <button
            className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => setView('cards')}
          >
            <LayoutGrid className="size-3" /> 卡片视图
          </button>
          <CopyButton text={content} label="全部" />
          <span className="ml-auto text-[10px] text-zinc-600">
            原始视图 · {content.length.toLocaleString()} 字
          </span>
        </div>
        <RawView content={content} maxHeight={maxBodyHeight} />
      </div>
    );
  }

  // 过滤
  const q = search.trim().toLowerCase();
  const filtered = q
    ? sections.map((s, i) => ({ ...s, _i: i })).filter(
        (s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q),
      )
    : sections.map((s, i) => ({ ...s, _i: i }));

  const allCollapsed = collapsed.size === sections.length;
  const noneCollapsed = collapsed.size === 0;

  function toggleCollapse(i: number) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  function expandAll() { setCollapsed(new Set()); }
  function collapseAll() { setCollapsed(new Set(sections.map((_, i) => i))); }

  return (
    <div className={className}>
      {/* 工具条 */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] text-zinc-500 mr-1">
          共 <strong className="text-zinc-300">{sections.length}</strong> 段
          {q && ` · 匹配 ${filtered.length}`}
        </span>
        <CopyButton text={content} label="全部" />
        <button
          className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          onClick={collapseAll}
          disabled={allCollapsed}
        >
          全部折叠
        </button>
        <button
          className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
          onClick={expandAll}
          disabled={noneCollapsed}
        >
          全部展开
        </button>
        <button
          className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          onClick={() => setView('raw')}
        >
          <FileText className="size-3" /> 原始
        </button>
        <div className="ml-auto relative">
          <Search className="size-3 absolute left-1.5 top-1.5 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索…"
            className="text-[10px] bg-zinc-900 border border-zinc-800 rounded pl-6 pr-5 py-0.5 w-32 focus:border-brand-500 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1 top-1 text-zinc-500 hover:text-zinc-200"
            >
              <X className="size-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* 卡片网格（单列，每卡片独立滚动） */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-[11px] text-zinc-500 text-center py-4 border border-zinc-800 rounded">
            无匹配段
          </div>
        ) : filtered.map((s) => {
          const i = s._i;
          const isCollapsed = collapsed.has(i);
          return (
            <div
              key={i}
              className="border border-zinc-800 rounded-md bg-zinc-950/40 overflow-hidden"
            >
              {/* 标题行：chevron+title 区域可点击折叠，复制按钮独立（避免嵌套 button） */}
              <div className="px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800/30 transition-colors">
                <button
                  onClick={() => toggleCollapse(i)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3 text-zinc-500 flex-none" />
                  ) : (
                    <ChevronDown className="size-3 text-zinc-500 flex-none" />
                  )}
                  <span className="text-[10px] font-mono text-zinc-600 flex-none">#{i + 1}</span>
                  <span className="text-xs text-zinc-200 truncate flex-1">
                    {q ? <Highlight text={s.title} q={q} /> : s.title}
                  </span>
                </button>
                <span className="text-[10px] text-zinc-600 flex-none">
                  {s.body.length.toLocaleString()} 字
                </span>
                <CopyButton text={s.body} className="flex-none" />
              </div>
              {!isCollapsed && (
                <pre
                  className="text-[11px] font-mono text-zinc-200 whitespace-pre-wrap break-words overflow-auto px-3 py-2 border-t border-zinc-800/60 bg-zinc-950/60"
                  style={{ maxHeight: maxBodyHeight }}
                >
                  {q ? <Highlight text={s.body} q={q} /> : s.body}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 原始视图（单 pre + 复制按钮） ─────────────────────────── */

function RawView({
  content, className, maxHeight = 320,
}: { content: string; className?: string; maxHeight?: number }) {
  return (
    <div className={clsx('relative', className)}>
      <div className="absolute top-1.5 right-1.5 z-10">
        <CopyButton text={content} label="复制" />
      </div>
      <pre
        className="text-[11px] font-mono text-zinc-200 whitespace-pre-wrap break-words overflow-auto bg-zinc-950/60 border border-zinc-800 rounded px-3 py-2 pr-20"
        style={{ maxHeight }}
      >
        {content}
      </pre>
    </div>
  );
}

/* ─── 关键字高亮 ───────────────────────────────────────────── */

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const found = lower.indexOf(q, i);
    if (found < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (found > i) parts.push(text.slice(i, found));
    parts.push(
      <mark key={found} className="bg-amber-500/40 text-amber-100 rounded px-0.5">
        {text.slice(found, found + q.length)}
      </mark>,
    );
    i = found + q.length;
  }
  return <>{parts}</>;
}
