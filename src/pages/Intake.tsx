import { useEffect, useRef, useState } from 'react';
import {
  BookCopy, Plus, Trash2, Loader2, FileText, AlertTriangle, Wand2,
  Square, Scissors, Copy, RotateCcw, ChevronDown, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useProject } from '../store/project';
import { useSettings } from '../store/settings';
import {
  S0_NODE_ID, summarizeChunk, compileMaster, parseMaster, type ParsedMaster,
} from '../pipeline/intake';
import type { SourceChunk } from '../pipeline/types';

export function Intake() {
  const settings = useSettings();
  const project = useProject();
  const ctx = project.ctx;

  const isAdaptation = ctx.createMode === 'adaptation';
  const adaptType = ctx.adaptationType ?? 'novel';
  const chunks: SourceChunk[] = ctx.source?.chunks ?? [];
  const masterArt = project.artifacts[S0_NODE_ID];

  const [busyChunkIds, setBusyChunkIds] = useState<Record<string, boolean>>({});
  const [errorByChunk, setErrorByChunk] = useState<Record<string, string>>({});
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [chainBusy, setChainBusy] = useState(false);

  const [compiling, setCompiling] = useState(false);
  const [compileErr, setCompileErr] = useState('');
  const [compileStream, setCompileStream] = useState('');
  const compileAbortRef = useRef<AbortController | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    if (!activeChunkId && chunks.length > 0) setActiveChunkId(chunks[0].id);
  }, [chunks, activeChunkId]);

  if (!isAdaptation) {
    return (
      <div className="m-6 card border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <strong className="text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="size-4" /> 当前项目不是改编模式
        </strong>
        <p className="text-zinc-300 mt-1">
          原作摄入仅在「改编」模式下可用。回到首页 <strong>新建项目 → 改编剧本</strong> 即可启用本页。
        </p>
      </div>
    );
  }

  // ---- handlers -------------------------------------------------------------

  function addChunk() {
    const idx = chunks.length + 1;
    project.addSourceChunk({
      title: adaptType === 'novel' ? `第 ${idx} 章` : `片段 ${idx}`,
      raw: '',
    });
  }

  function bulkSplit() {
    const text = bulkText.trim();
    if (!text) return;
    // 启发式按 "第 X 章" / "Chapter X" / "## " 切分；找不到就按双换行段落
    const headingRe = /(?=^(?:第\s*[0-9零一二三四五六七八九十百千]+\s*[章回]|Chapter\s+\d+|##\s+).*$)/m;
    let parts = text.split(headingRe).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      // fallback: 6000 字一段
      const N = 6000;
      parts = [];
      for (let i = 0; i < text.length; i += N) parts.push(text.slice(i, i + N));
    }
    parts.forEach((p, i) => {
      const firstLine = p.split('\n')[0].trim();
      const looksLikeHeading = firstLine.length > 0 && firstLine.length < 40;
      const title = looksLikeHeading ? firstLine.slice(0, 36) : (adaptType === 'novel' ? `第 ${i + 1} 章` : `片段 ${i + 1}`);
      const raw = looksLikeHeading ? p.slice(firstLine.length).trim() : p;
      project.addSourceChunk({ title, raw });
    });
    setBulkText('');
    setBulkOpen(false);
  }

  async function summarizeOne(chunk: SourceChunk) {
    if (!chunk.raw.trim()) {
      setErrorByChunk((e) => ({ ...e, [chunk.id]: '原文为空，无法摘要' }));
      return;
    }
    setBusyChunkIds((s) => ({ ...s, [chunk.id]: true }));
    setErrorByChunk((e) => { const n = { ...e }; delete n[chunk.id]; return n; });
    let liveText = '';
    try {
      const summary = await summarizeChunk({
        chunk, type: adaptType, settings,
        onDelta: (_, full) => {
          liveText = full;
          project.updateSourceChunk(chunk.id, { summary: full });
        },
      });
      project.updateSourceChunk(chunk.id, { summary });
      // S0 master is now stale
      if (project.artifacts[S0_NODE_ID]) {
        project.invalidateFrom('screenplay', -1);
      }
    } catch (e: any) {
      // restore last good summary if streaming failed mid-way
      if (liveText) project.updateSourceChunk(chunk.id, { summary: undefined });
      setErrorByChunk((er) => ({ ...er, [chunk.id]: e.message ?? String(e) }));
    } finally {
      setBusyChunkIds((s) => { const n = { ...s }; delete n[chunk.id]; return n; });
    }
  }

  async function summarizeAll() {
    if (chainBusy) return;
    setChainBusy(true);
    try {
      for (const c of chunks) {
        if (c.summary) continue;
        await summarizeOne(c);
      }
    } finally { setChainBusy(false); }
  }

  async function compileMasterDoc() {
    if (compiling) return;
    setCompileErr(''); setCompileStream(''); setCompiling(true);
    const ctrl = new AbortController();
    compileAbortRef.current = ctrl;
    try {
      const a = await compileMaster({
        project: ctx,
        chunks,
        type: adaptType,
        settings,
        signal: ctrl.signal,
        onDelta: (_, full) => setCompileStream(full),
      });
      project.upsertArtifact(a);
      // master changed → invalidate R1 and downstream screenplay
      project.invalidateFrom('screenplay', -1);
    } catch (e: any) {
      setCompileErr(e.message ?? String(e));
    } finally {
      setCompiling(false);
    }
  }
  function stopCompile() { compileAbortRef.current?.abort(); }

  function clearMaster() {
    project.clearArtifact(S0_NODE_ID);
  }

  const activeChunk = chunks.find((c) => c.id === activeChunkId) ?? null;
  const summarized = chunks.filter((c) => c.summary).length;

  const master = masterArt && !compiling ? parseMaster(masterArt.content) : null;
  const compileMasterPreview = compiling
    ? (() => { try { return parseMaster(compileStream); } catch { return null; } })()
    : null;

  // ---- render ---------------------------------------------------------------

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookCopy className="size-5 text-brand-500" />
          <div>
            <h1 className="text-lg font-semibold">原作摄入 · S0</h1>
            <p className="text-xs text-zinc-500">
              将{adaptType === 'novel' ? '小说 / 网文' : '旧剧本 / 外语原版'}逐章摘要 → 合成改编档案 → 喂给下游 R1' + 8 步
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>章/段 <span className="font-mono text-zinc-200">{chunks.length}</span></span>
          <span className="text-zinc-700">·</span>
          <span>已摘要 <span className="font-mono text-zinc-200">{summarized}</span></span>
          <span className="text-zinc-700">·</span>
          <span>{masterArt ? <span className="text-emerald-400">✓ 总档案已生成</span> : <span className="text-amber-400">总档案未生成</span>}</span>
        </div>
      </header>

      <section className="px-6 py-2 border-b border-zinc-800 flex items-center gap-3 text-xs text-zinc-400">
        <span><span className="text-zinc-600">项目：</span>{ctx.name}</span>
        <span className="text-zinc-700">·</span>
        <span><span className="text-zinc-600">概念：</span>{ctx.concept}</span>
        <span className="text-zinc-700">·</span>
        <span><span className="text-zinc-600">改编类型：</span>{adaptType === 'novel' ? '小说/网文' : '旧剧本翻拍'}</span>
        <span className="ml-auto">
          <a href="#/adapt" className="text-brand-400 hover:underline">→ 完成后进入改编工作台</a>
        </span>
      </section>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: chunk list */}
        <aside className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="p-3 border-b border-zinc-800 flex flex-wrap gap-1.5">
            <button className="btn-outline text-xs" onClick={addChunk}>
              <Plus className="size-3.5" /> 添加{adaptType === 'novel' ? '章' : '段'}
            </button>
            <button className="btn-outline text-xs" onClick={() => setBulkOpen((v) => !v)}>
              <Scissors className="size-3.5" /> 整本切分
            </button>
            <button className="btn-primary text-xs" onClick={summarizeAll}
                    disabled={chainBusy || chunks.length === 0 || !settings.apiKey}>
              {chainBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              一键全摘要
            </button>
          </div>

          {bulkOpen && (
            <div className="p-3 border-b border-zinc-800 space-y-2 bg-zinc-900/50">
              <textarea className="input min-h-[120px] text-xs font-mono"
                        placeholder="粘贴原作全文（按「第 X 章」/「Chapter X」/「## 」自动切分；找不到时每 6000 字切一段）"
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)} />
              <div className="flex gap-1.5 justify-end">
                <button className="btn-outline text-xs" onClick={() => { setBulkOpen(false); setBulkText(''); }}>取消</button>
                <button className="btn-primary text-xs" onClick={bulkSplit} disabled={!bulkText.trim()}>
                  <Scissors className="size-3.5" /> 切分并加入
                </button>
              </div>
            </div>
          )}

          <ol className="flex-1 overflow-auto p-2 space-y-1">
            {chunks.length === 0 ? (
              <li className="text-xs text-zinc-500 text-center py-8">
                还没有原文。点上方「添加」或「整本切分」开始。
              </li>
            ) : chunks.map((c) => (
              <ChunkListItem
                key={c.id}
                chunk={c}
                active={c.id === activeChunkId}
                busy={!!busyChunkIds[c.id]}
                err={errorByChunk[c.id]}
                onClick={() => setActiveChunkId(c.id)}
                onDelete={() => {
                  if (confirm(`删除「${c.title}」？`)) {
                    project.removeSourceChunk(c.id);
                    if (activeChunkId === c.id) setActiveChunkId(null);
                  }
                }}
              />
            ))}
          </ol>
        </aside>

        {/* Middle: chunk editor */}
        <section className="flex-1 min-w-0 border-r border-zinc-800 flex flex-col">
          {activeChunk ? (
            <ChunkEditor
              chunk={activeChunk}
              busy={!!busyChunkIds[activeChunk.id]}
              err={errorByChunk[activeChunk.id]}
              onTitle={(t) => project.updateSourceChunk(activeChunk.id, { title: t })}
              onRaw={(raw) => project.updateSourceChunk(activeChunk.id, { raw })}
              onSummarize={() => summarizeOne(activeChunk)}
              onClearSummary={() => project.updateSourceChunk(activeChunk.id, { summary: undefined })}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              在左侧选一章/段开始编辑
            </div>
          )}
        </section>

        {/* Right: master document */}
        <aside className="w-[420px] shrink-0 flex flex-col">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="size-4 text-brand-500" /> 改编档案 · masterDocument
            </div>
            <div className="flex items-center gap-1">
              {compiling ? (
                <button className="btn-outline text-xs" onClick={stopCompile}>
                  <Square className="size-3" /> 停止
                </button>
              ) : (
                <>
                  <button className="btn-primary text-xs"
                          onClick={compileMasterDoc}
                          disabled={summarized === 0 || !settings.apiKey}>
                    <Wand2 className="size-3.5" />
                    {masterArt ? '重新合成' : '合成总档案'}
                  </button>
                  {masterArt && (
                    <button className="btn-ghost text-xs" onClick={clearMaster} title="清除">
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {compileErr && (
              <div className="card border-rose-500/40 bg-rose-500/5 p-2 text-xs text-rose-200">{compileErr}</div>
            )}
            {summarized === 0 && !masterArt && (
              <p className="text-xs text-zinc-500">至少需要一章/段已摘要后才能合成总档案。</p>
            )}
            {compiling ? (
              <MasterPreview master={compileMasterPreview} streaming streamRaw={compileStream} />
            ) : master ? (
              <MasterPreview master={master} />
            ) : masterArt ? (
              <pre className="text-xs whitespace-pre-wrap font-mono text-zinc-300">{masterArt.content}</pre>
            ) : null}
            {masterArt && !compiling && (
              <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                <button className="btn-ghost text-[11px] px-1.5 py-0.5"
                        onClick={() => navigator.clipboard.writeText(masterArt.content)}>
                  <Copy className="size-3" /> 复制 JSON
                </button>
                {Math.round(masterArt.durationMs)}ms · tokens {masterArt.tokens ?? '?'}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function ChunkListItem({
  chunk, active, busy, err, onClick, onDelete,
}: {
  chunk: SourceChunk;
  active: boolean;
  busy: boolean;
  err?: string;
  onClick: () => void;
  onDelete: () => void;
}) {
  const hasSum = !!chunk.summary;
  const dot = busy ? 'bg-brand-500 animate-pulse'
            : err ? 'bg-rose-500'
            : hasSum ? 'bg-emerald-500'
            : 'bg-zinc-700';
  return (
    <li>
      <div className={clsx(
        'rounded-md px-2 py-2 text-xs transition-colors flex items-center gap-2',
        active ? 'bg-zinc-800 ring-1 ring-brand-500/30' : 'hover:bg-zinc-900',
      )}>
        <span className={clsx('size-2 rounded-full shrink-0', dot)} />
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <div className="truncate font-medium text-zinc-200">{chunk.title || '(未命名)'}</div>
          <div className="truncate text-[10px] text-zinc-500">
            {chunk.raw.length > 0 ? `${chunk.raw.length} 字` : '空'}
            {hasSum && <span className="text-emerald-400"> · 已摘要</span>}
            {err && <span className="text-rose-400"> · 出错</span>}
          </div>
        </button>
        <button className="btn-ghost px-1 py-1 opacity-60 hover:opacity-100" onClick={onDelete}>
          <Trash2 className="size-3" />
        </button>
      </div>
    </li>
  );
}

function ChunkEditor({
  chunk, busy, err, onTitle, onRaw, onSummarize, onClearSummary,
}: {
  chunk: SourceChunk;
  busy: boolean;
  err?: string;
  onTitle: (t: string) => void;
  onRaw: (raw: string) => void;
  onSummarize: () => void;
  onClearSummary: () => void;
}) {
  const [showSummary, setShowSummary] = useState(true);
  let parsedSummary: any = null;
  if (chunk.summary) {
    try { parsedSummary = JSON.parse(chunk.summary); } catch {}
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <input className="input flex-1 text-sm font-medium" value={chunk.title}
               onChange={(e) => onTitle(e.target.value)}
               placeholder="章节标题" />
        <span className="text-xs text-zinc-500 shrink-0">{chunk.raw.length} 字</span>
        <button className="btn-primary text-xs" onClick={onSummarize} disabled={busy || !chunk.raw.trim()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          摘要本{chunk.title.includes('段') ? '段' : '章'}
        </button>
      </div>

      {err && (
        <div className="mx-4 mt-3 card border-rose-500/40 bg-rose-500/5 p-2 text-xs text-rose-200">{err}</div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-3 min-h-0">
        <div>
          <div className="label mb-1.5 flex items-center justify-between">
            <span>原文</span>
            <span className="text-zinc-600 text-[10px]">建议每章 ≤8000 字（更长会被截断）</span>
          </div>
          <textarea
            className="input w-full font-mono text-xs"
            style={{ minHeight: 240, resize: 'vertical' }}
            value={chunk.raw}
            onChange={(e) => onRaw(e.target.value)}
            placeholder="粘贴本章/段原文…"
          />
        </div>

        {chunk.summary && (
          <div className="card overflow-hidden">
            <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
              <button className="text-xs text-zinc-400 flex items-center gap-1 hover:text-zinc-200"
                      onClick={() => setShowSummary((v) => !v)}>
                {showSummary ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                结构化摘要 (JSON)
              </button>
              <div className="flex items-center gap-1">
                <button className="btn-ghost text-[11px] px-1.5 py-0.5"
                        onClick={() => navigator.clipboard.writeText(chunk.summary as string)}>
                  <Copy className="size-3" />
                </button>
                <button className="btn-ghost text-[11px] px-1.5 py-0.5" onClick={onClearSummary}>
                  <RotateCcw className="size-3" />
                </button>
              </div>
            </div>
            {showSummary && (
              parsedSummary ? (
                <ChunkSummaryView j={parsedSummary} />
              ) : (
                <pre className="p-3 text-xs whitespace-pre-wrap font-mono text-zinc-300 max-h-72 overflow-auto">
                  {chunk.summary}
                </pre>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ChunkSummaryView({ j }: { j: any }) {
  return (
    <div className="p-3 space-y-2 text-xs">
      {j.brief && (
        <div>
          <div className="label">brief</div>
          <p className="text-zinc-200 mt-0.5">{j.brief}</p>
        </div>
      )}
      {Array.isArray(j.beats) && j.beats.length > 0 && (
        <div>
          <div className="label">beats ({j.beats.length})</div>
          <ul className="mt-0.5 space-y-0.5">
            {j.beats.map((b: any, i: number) => {
              const score = b.intensity ?? (b.weight ? b.weight * 2 : null);
              const tier = b.tier ?? (score == null ? null : score >= 7 ? 'core' : score >= 4 ? 'sub' : 'transition');
              const star = tier === 'core' ? '⭐⭐⭐' : tier === 'sub' ? '⭐⭐' : tier === 'transition' ? '⭐' : '';
              const ttype = b.conflictType ?? b.type;
              return (
                <li key={i} className="text-zinc-300">
                  <span className="text-amber-400 font-mono">[✨{score ?? '-'}]</span>
                  {star && <span className="text-zinc-500 ml-1">{star}</span>}
                  {ttype && <span className="text-brand-400 ml-1">&lt;{ttype}&gt;</span>}
                  <span className="ml-1">{b.summary}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {Array.isArray(j.emotionalHooks) && j.emotionalHooks.length > 0 && (
        <div>
          <div className="label">emotionalHooks ({j.emotionalHooks.length})</div>
          <ul className="mt-0.5 space-y-0.5">
            {j.emotionalHooks.map((h: any, i: number) => (
              <li key={i} className="text-zinc-300">
                <span className="px-1 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 mr-1">
                  {h.kind}
                </span>
                <span className="text-amber-400 font-mono">[✨{h.intensity ?? '-'}]</span>
                <span className="ml-1">{h.moment}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(j.characters) && j.characters.length > 0 && (
        <div>
          <div className="label">characters</div>
          <ul className="mt-0.5">
            {j.characters.map((c: any, i: number) => (
              <li key={i} className="text-zinc-300">
                <strong className="text-zinc-100">{c.name}</strong>
                {c.appearancesHere && <span className="text-zinc-500"> — {c.appearancesHere}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(j.standoutLines) && j.standoutLines.length > 0 && (
        <div>
          <div className="label">standoutLines</div>
          <ul className="mt-0.5">
            {j.standoutLines.map((l: string, i: number) => (
              <li key={i} className="text-amber-300">"{l}"</li>
            ))}
          </ul>
        </div>
      )}
      {j.notes && (
        <div>
          <div className="label">notes</div>
          <p className="text-zinc-400 mt-0.5">{j.notes}</p>
        </div>
      )}
    </div>
  );
}

function MasterPreview({
  master, streaming, streamRaw,
}: { master: ParsedMaster | null; streaming?: boolean; streamRaw?: string }) {
  if (!master) {
    return streaming ? (
      <pre className="text-xs whitespace-pre-wrap font-mono text-zinc-300">{streamRaw ?? ''}</pre>
    ) : null;
  }
  return (
    <div className="space-y-3 text-xs">
      {master.logline && (
        <Section title="logline" tone="brand">
          <p className="text-zinc-100 font-medium leading-snug">{master.logline}</p>
        </Section>
      )}
      {master.themes && master.themes.length > 0 && (
        <Section title="themes">
          <div className="flex flex-wrap gap-1">
            {master.themes.map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-300">{t}</span>
            ))}
          </div>
        </Section>
      )}
      {master.mainCharacters && master.mainCharacters.length > 0 && (
        <Section title={`mainCharacters (${master.mainCharacters.length})`}>
          <ul className="space-y-1">
            {master.mainCharacters.map((c, i) => (
              <li key={i}>
                <strong className="text-zinc-100">{c.name}</strong>
                {c.role && <span className="text-amber-400 ml-1">[{c.role}]</span>}
                {c.signature && <span className="text-zinc-500"> · {c.signature}</span>}
                {c.arc && <div className="text-zinc-400 leading-snug">{c.arc}</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {(master.genreType || master.subType || master.hookDensity) && (
        <Section title="genre">
          <div className="flex flex-wrap gap-1.5 items-center">
            {master.genreType && (
              <span className="px-1.5 py-0.5 rounded border border-brand-500/40 bg-brand-500/10 text-brand-300">
                {master.genreType}
              </span>
            )}
            {master.subType && (
              <span className="px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-300">{master.subType}</span>
            )}
            {master.hookDensity && (
              <span className="text-zinc-400">钩子密度: <span className="text-zinc-200">{master.hookDensity}</span></span>
            )}
          </div>
        </Section>
      )}
      {master.beatSheet && master.beatSheet.length > 0 && (
        <Section title={`beatSheet (${master.beatSheet.length})`}>
          <ul className="space-y-0.5">
            {[...master.beatSheet]
              .sort((a, b) => ((b.intensity ?? (b.weight ?? 0) * 2) - (a.intensity ?? (a.weight ?? 0) * 2)))
              .map((b, i) => {
                const score = b.intensity ?? (b.weight ? b.weight * 2 : null);
                const ttype = b.conflictType ?? b.type;
                return (
                  <li key={i} className="text-zinc-300">
                    <span className="text-zinc-500 font-mono">{b.id ?? `B${i + 1}`}</span>
                    <span className="text-amber-400 font-mono ml-1">[✨{score ?? '-'}]</span>
                    {ttype && <span className="text-brand-400 ml-1">&lt;{ttype}&gt;</span>}
                    <span className="ml-1">{b.summary}</span>
                  </li>
                );
              })}
          </ul>
        </Section>
      )}
      {master.worldRules && master.worldRules.length > 0 && (
        <Section title="worldRules">
          <ul className="space-y-0.5">
            {master.worldRules.map((r, i) => <li key={i} className="text-zinc-300">· {r}</li>)}
          </ul>
        </Section>
      )}
      {master.standoutLines && master.standoutLines.length > 0 && (
        <Section title="standoutLines">
          <ul className="space-y-0.5">
            {master.standoutLines.map((l, i) => <li key={i} className="text-amber-300">"{l}"</li>)}
          </ul>
        </Section>
      )}
      {master.adaptationRisks && master.adaptationRisks.length > 0 && (
        <Section title="adaptationRisks" tone="rose">
          <ul className="space-y-1">
            {master.adaptationRisks.map((r, i) => (
              <li key={i}>
                <span className="px-1 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  {r.kind}
                </span>
                <span className="text-zinc-300 ml-1.5">{r.issue}</span>
                {r.mitigation && <div className="text-zinc-500 ml-6">→ {r.mitigation}</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {master.summary && (
        <Section title="summary">
          <p className="text-zinc-300 leading-snug">{master.summary}</p>
        </Section>
      )}
    </div>
  );
}

function Section({
  title, children, tone = 'default',
}: { title: string; children: React.ReactNode; tone?: 'default' | 'brand' | 'rose' }) {
  const ring = tone === 'brand' ? 'ring-1 ring-brand-500/30'
             : tone === 'rose' ? 'ring-1 ring-rose-500/30'
             : '';
  return (
    <div className={clsx('card p-2.5', ring)}>
      <div className="label mb-1">{title}</div>
      {children}
    </div>
  );
}
