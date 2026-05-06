/**
 * Analyzer · 拆书分析师页面
 *
 * 用户提供参考小说的若干章节（每章打位置标签），AI 输出可迁移的写作方法论。
 *
 * 关键交互：
 *   1. 顶部输入：书名 / 作者 / 类型（可选）
 *   2. 章节区：可增删的章节卡片，每张卡含标签下拉 + 标题 + 正文 textarea
 *   3. 中部按钮："开始分析"（流式触发）
 *   4. 输出区：分块渲染 worldview / characters / plot / positionInsights /
 *      methodology，可导出 JSON / 复制全文
 *
 * Reference: src/pipeline/bookAnalyzer.ts
 */

import { useState, useRef, useMemo } from 'react';
import {
  FileSearch, Plus, Trash2, Play, Square, Copy, Check, Brain, FileJson, Loader2, Save,
} from 'lucide-react';
import { useSettings } from '../store/settings';
import {
  CHAPTER_TAGS,
  findChapterTag,
  runBookAnalysis,
  runBookAnalysisStage1,
  runBookAnalysisStage2,
  type ChapterTag,
  type ReferenceChapter,
  type BookMeta,
  type BookAnalysisResult,
  type BookAnalysisStage1,
} from '../pipeline/bookAnalyzer';
import { createUserKbDoc } from '../store/userKb';

interface DraftChapter extends ReferenceChapter {
  /** UI 局部 ID（不入分析参数） */
  uid: string;
}

const DEFAULT_TAG_ORDER: ChapterTag[] = ['golden', 'arc-10', 'arc-50', 'arc-80', 'finale'];

function newChapter(tag: ChapterTag = 'golden'): DraftChapter {
  return { uid: Math.random().toString(36).slice(2, 9), tag, title: '', text: '' };
}

export function Analyzer() {
  const settings = useSettings();
  const [bookMeta, setBookMeta] = useState<BookMeta>({});
  const [chapters, setChapters] = useState<DraftChapter[]>([newChapter('golden')]);
  const [useThinking, setUseThinking] = useState(true);

  const [running, setRunning] = useState(false);
  /** 当前进行中的阶段（仅两阶段模式下用）：'stage1' | 'stage2' | null */
  const [runningStage, setRunningStage] = useState<'stage1' | 'stage2' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingJson, setStreamingJson] = useState('');
  const [reasoningStream, setReasoningStream] = useState('');
  const [result, setResult] = useState<BookAnalysisResult | null>(null);
  const [meta, setMeta] = useState<{ durationMs?: number; tokens?: number }>({});
  // v2 阶段 2.5 · 拆书两阶段法
  const [analysisMode, setAnalysisMode] = useState<'single' | 'two-stage'>('single');
  const [stage1Result, setStage1Result] = useState<BookAnalysisStage1 | null>(null);
  const [stage1Meta, setStage1Meta] = useState<{ durationMs?: number; tokens?: number }>({});
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [savingKb, setSavingKb] = useState(false);
  const [savedKbId, setSavedKbId] = useState<number | null>(null);
  const [kbError, setKbError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const totalChars = useMemo(
    () => chapters.reduce((n, c) => n + (c.text?.length ?? 0), 0),
    [chapters],
  );

  const canRun =
    !running &&
    chapters.length > 0 &&
    chapters.every((c) => c.text.trim().length >= 50) &&
    !!settings.baseUrl &&
    !!settings.apiKey &&
    !!settings.model;

  const updateChapter = (uid: string, patch: Partial<DraftChapter>) => {
    setChapters((cs) => cs.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  };

  const addChapter = () => {
    const usedTags = new Set(chapters.map((c) => c.tag));
    const next = DEFAULT_TAG_ORDER.find((t) => !usedTags.has(t)) ?? 'aiPick';
    setChapters((cs) => [...cs, newChapter(next)]);
  };

  const removeChapter = (uid: string) => {
    setChapters((cs) => (cs.length === 1 ? cs : cs.filter((c) => c.uid !== uid)));
  };

  const run = async () => {
    setError(null);
    setStreamingJson('');
    setReasoningStream('');
    setResult(null);
    setMeta({});

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);

    try {
      const res = await runBookAnalysis({
        bookMeta,
        chapters: chapters.map(({ uid: _uid, ...rest }) => rest),
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        maxTokens: settings.maxTokens,
        useThinking,
        signal: ctrl.signal,
        onDelta: (_chunk, full) => setStreamingJson(full),
        onReasoningDelta: (_chunk, full) => setReasoningStream(full),
      });
      setResult(res.result);
      setStreamingJson(res.rawJson);
      setMeta({ durationMs: res.durationMs, tokens: res.tokens });
    } catch (e: any) {
      const aborted = ctrl.signal.aborted;
      setError(aborted ? '已取消' : e?.message ?? String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  /** v2 阶段 2.5 · 两阶段法 · Stage 1：框架扫描 */
  const runStage1 = async () => {
    setError(null);
    setStreamingJson('');
    setReasoningStream('');
    setResult(null);
    setMeta({});
    setStage1Result(null);
    setStage1Meta({});

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setRunningStage('stage1');
    try {
      const res = await runBookAnalysisStage1({
        bookMeta,
        chapters: chapters.map(({ uid: _uid, ...rest }) => rest),
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        useThinking: false, // 默认 stage1 不开 thinking
        signal: ctrl.signal,
        onDelta: (_chunk, full) => setStreamingJson(full),
        onReasoningDelta: (_chunk, full) => setReasoningStream(full),
      });
      setStage1Result(res.result);
      setStreamingJson(res.rawJson);
      setStage1Meta({ durationMs: res.durationMs, tokens: res.tokens });
    } catch (e: any) {
      const aborted = ctrl.signal.aborted;
      setError(aborted ? '已取消' : e?.message ?? String(e));
    } finally {
      setRunning(false);
      setRunningStage(null);
      abortRef.current = null;
    }
  };

  /** v2 阶段 2.5 · Stage 2：基于 stage1Result 进行深度方法论提炼 */
  const runStage2 = async () => {
    if (!stage1Result) {
      setError('请先运行 Stage 1 框架扫描');
      return;
    }
    setError(null);
    setStreamingJson('');
    setReasoningStream('');
    setResult(null);
    setMeta({});

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setRunningStage('stage2');
    try {
      const res = await runBookAnalysisStage2({
        bookMeta,
        chapters: chapters.map(({ uid: _uid, ...rest }) => rest),
        stage1: stage1Result,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        maxTokens: settings.maxTokens,
        useThinking,
        signal: ctrl.signal,
        onDelta: (_chunk, full) => setStreamingJson(full),
        onReasoningDelta: (_chunk, full) => setReasoningStream(full),
      });
      setResult(res.result);
      setStreamingJson(res.rawJson);
      setMeta({ durationMs: res.durationMs, tokens: res.tokens });
    } catch (e: any) {
      const aborted = ctrl.signal.aborted;
      setError(aborted ? '已取消' : e?.message ?? String(e));
    } finally {
      setRunning(false);
      setRunningStage(null);
      abortRef.current = null;
    }
  };

  /** Stage 1 预览面板里修改某个字段 */
  const updateStage1 = (patch: Partial<BookAnalysisStage1>) => {
    setStage1Result((s) => (s ? { ...s, ...patch } : s));
  };
  const updateStage1Focus = (idx: number, value: string) => {
    setStage1Result((s) => {
      if (!s) return s;
      const next = [...s.stage2Focus];
      next[idx] = value;
      return { ...s, stage2Focus: next };
    });
  };
  const updateStage1ChapterFn = (idx: number, value: string) => {
    setStage1Result((s) => {
      if (!s) return s;
      const next = [...s.chapterFunctions];
      next[idx] = { ...next[idx], structuralFunction: value };
      return { ...s, chapterFunctions: next };
    });
  };

  const stop = () => abortRef.current?.abort();

  const copyJson = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  /**
   * 将拆书结果保存为 UserKbDoc（type='bookAnalysis'）。
   * 保存后可在项目「资料库」中绑定该 doc，组合型注入 N1.* / N2.* 节点。
   */
  const saveToKb = async () => {
    if (!result || savingKb) return;
    setKbError(null);
    setSavingKb(true);
    try {
      const titleParts = [
        result.bookMeta?.title || bookMeta.title || '未命名作品',
        result.bookMeta?.author || bookMeta.author,
        result.bookMeta?.genre || bookMeta.genre,
      ].filter(Boolean);
      const title = `拆书：${titleParts.join(' · ')}`;
      const id = await createUserKbDoc({
        type: 'bookAnalysis',
        title,
        source: 'manual',
        rawContent: chapters
          .map((c, i) => `## 章节 ${i + 1} · ${c.title || '未命名'} · [${findChapterTag(c.tag).label}]\n\n${c.text}`)
          .join('\n\n---\n\n'),
        structuredJson: JSON.stringify(result),
        tags: [
          'bookAnalysis',
          ...(result.bookMeta?.genre ? [result.bookMeta.genre] : []),
          ...(bookMeta.genre ? [bookMeta.genre] : []),
        ].filter((t, i, arr) => arr.indexOf(t) === i),
        enabled: true,
        extractMeta: {
          promptId: 'analyzer.book-analysis',
          tokens: meta.tokens,
          durationMs: meta.durationMs,
          model: settings.model,
        },
      });
      setSavedKbId(id);
      setTimeout(() => setSavedKbId(null), 3000);
    } catch (e: any) {
      setKbError(e?.message ?? String(e));
    } finally {
      setSavingKb(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary flex items-center gap-2">
            <FileSearch className="size-5 text-primary-400" />
            拆书分析师
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            提供参考小说的若干章节（每章打位置标签），AI 提炼可迁移的写作方法论。
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={useThinking}
            onChange={(e) => setUseThinking(e.target.checked)}
            className="accent-brand-500"
          />
          <Brain className="size-3.5" />
          深度分析（V4 Thinking Mode）
        </label>
      </div>

      {/* Book Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="书名（可选）"
          value={bookMeta.title ?? ''}
          onChange={(e) => setBookMeta({ ...bookMeta, title: e.target.value })}
          className="bg-surface border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        />
        <input
          type="text"
          placeholder="作者（可选）"
          value={bookMeta.author ?? ''}
          onChange={(e) => setBookMeta({ ...bookMeta, author: e.target.value })}
          className="bg-surface border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        />
        <input
          type="text"
          placeholder="类型 / 流派（可选）"
          value={bookMeta.genre ?? ''}
          onChange={(e) => setBookMeta({ ...bookMeta, genre: e.target.value })}
          className="bg-surface border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Chapters editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-fg-secondary font-medium">
            参考章节（建议 3-6 章覆盖关键位置 · 共 {totalChars} 字）
          </div>
          <button
            type="button"
            onClick={addChapter}
            disabled={chapters.length >= 8}
            className="px-2 py-1 text-xs rounded border border-border-default hover:border-zinc-600 hover:bg-elevated text-fg-secondary inline-flex items-center gap-1 disabled:opacity-40"
          >
            <Plus className="size-3" /> 添加章节
          </button>
        </div>

        {chapters.map((ch, idx) => {
          const tag = findChapterTag(ch.tag);
          return (
            <div
              key={ch.uid}
              className="rounded-md border border-border-subtle bg-canvas/40 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-xs text-fg-muted font-mono">#{idx + 1}</div>
                <select
                  value={ch.tag}
                  onChange={(e) => updateChapter(ch.uid, { tag: e.target.value as ChapterTag })}
                  className="bg-surface border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
                >
                  {CHAPTER_TAGS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.position}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="章节标题（如：第一章·觉醒）"
                  value={ch.title ?? ''}
                  onChange={(e) => updateChapter(ch.uid, { title: e.target.value })}
                  className="flex-1 min-w-[150px] bg-surface border border-border-subtle rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-fg-muted">
                  {ch.text.length} 字
                  {ch.text.trim().length < 50 && (
                    <span className="text-warning ml-1">· 太短</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeChapter(ch.uid)}
                  disabled={chapters.length === 1}
                  className="p-1 rounded text-fg-muted hover:text-danger hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="删除本章"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-fg-muted leading-snug">
                <span className="text-fg-secondary">分析重点：</span>
                {tag.analysisFocus}
              </div>
              <textarea
                value={ch.text}
                onChange={(e) => updateChapter(ch.uid, { text: e.target.value })}
                placeholder="粘贴本章正文（建议 ≥ 500 字以保证分析质量）..."
                rows={6}
                className="w-full bg-surface border border-border-subtle rounded-md px-2 py-2 text-xs text-fg-primary leading-relaxed focus:outline-none focus:border-brand-500 font-serif"
                spellCheck={false}
              />
            </div>
          );
        })}
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-fg-secondary">分析模式：</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="analysis-mode"
            checked={analysisMode === 'single'}
            onChange={() => setAnalysisMode('single')}
            className="accent-brand-500"
            disabled={running}
          />
          <span className={analysisMode === 'single' ? 'text-fg-primary' : 'text-fg-muted'}>单步快速</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="analysis-mode"
            checked={analysisMode === 'two-stage'}
            onChange={() => setAnalysisMode('two-stage')}
            className="accent-brand-500"
            disabled={running}
          />
          <span className={analysisMode === 'two-stage' ? 'text-fg-primary' : 'text-fg-muted'}>两阶段法（推荐）</span>
        </label>
        <span className="text-[10px] text-fg-muted">
          {analysisMode === 'two-stage'
            ? '先扫框架 → 人工复核 → 再深挖方法论，在同一 token 预算下质量更高'
            : '一次调用输出完整结果'}
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {analysisMode === 'single' ? (
          !running ? (
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              className="px-4 py-2 text-sm rounded-md border border-brand-500/40 bg-primary-500/15 hover:bg-primary-500/25 text-brand-200 font-medium inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="size-4" /> 开始拆书分析
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 text-sm rounded-md border border-danger/40 bg-danger/10 hover:bg-danger/20 text-danger font-medium inline-flex items-center gap-1.5"
            >
              <Square className="size-4" /> 停止
            </button>
          )
        ) : (
          <>
            {/* Stage 1 按钮 */}
            {!running ? (
              <button
                type="button"
                onClick={runStage1}
                disabled={!canRun}
                className="px-4 py-2 text-sm rounded-md border border-brand-500/40 bg-primary-500/15 hover:bg-primary-500/25 text-brand-200 font-medium inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="size-4" /> {stage1Result ? '重跑' : '运行'} Stage 1：框架扫描
              </button>
            ) : (
              <button
                type="button"
                onClick={stop}
                className="px-4 py-2 text-sm rounded-md border border-danger/40 bg-danger/10 hover:bg-danger/20 text-danger font-medium inline-flex items-center gap-1.5"
              >
                <Square className="size-4" /> 停止 Stage {runningStage === 'stage1' ? '1' : '2'}
              </button>
            )}
            {/* Stage 2 按钮（仅 stage1 已完成且未运行时可点） */}
            {stage1Result && !running && (
              <button
                type="button"
                onClick={runStage2}
                className="px-4 py-2 text-sm rounded-md border border-success/40 bg-success/15 hover:bg-success/25 text-emerald-200 font-medium inline-flex items-center gap-1.5"
              >
                <Play className="size-4" /> 运行 Stage 2：深度方法论
              </button>
            )}
          </>
        )}
        {meta.durationMs !== undefined && (
          <span className="text-xs text-fg-muted">
            ✓ Stage 2: {(meta.durationMs / 1000).toFixed(1)}s
            {meta.tokens !== undefined && ` · ${meta.tokens} tokens`}
          </span>
        )}
        {stage1Meta.durationMs !== undefined && analysisMode === 'two-stage' && (
          <span className="text-xs text-fg-muted">
            ✓ Stage 1: {(stage1Meta.durationMs / 1000).toFixed(1)}s
            {stage1Meta.tokens !== undefined && ` · ${stage1Meta.tokens} tokens`}
          </span>
        )}
        {!canRun && !running && (
          <span className="text-[11px] text-warning">
            {chapters.some((c) => c.text.trim().length < 50)
              ? '每章正文需 ≥ 50 字'
              : '请先在「设置」中配置 API'}
          </span>
        )}
      </div>

      {/* v2 阶段 2.5 · Stage 1 框架扫描预览面板（可编辑） */}
      {analysisMode === 'two-stage' && stage1Result && (
        <div className="rounded-md border border-brand-500/30 bg-primary-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-200">
              📝 Stage 1 框架扫描结果（可手动修订后运行 Stage 2）
            </h3>
            <button
              type="button"
              onClick={() => setStage1Result(null)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border-default text-fg-secondary hover:bg-elevated"
            >
              丢弃
            </button>
          </div>
          <div className="space-y-2">
            <Stage1Field
              label="全书定位"
              value={stage1Result.bookPositioning}
              onChange={(v) => updateStage1({ bookPositioning: v })}
            />
            <Stage1Field
              label="宏观骨架"
              value={stage1Result.macroSkeleton}
              onChange={(v) => updateStage1({ macroSkeleton: v })}
              rows={3}
            />
            <Stage1Field
              label="节奏签名"
              value={stage1Result.rhythmSignature}
              onChange={(v) => updateStage1({ rhythmSignature: v })}
            />
            <Stage1Field
              label="冲突模型"
              value={stage1Result.conflictModel}
              onChange={(v) => updateStage1({ conflictModel: v })}
              rows={2}
            />
            {stage1Result.chapterFunctions.length > 0 && (
              <div>
                <div className="text-xs text-fg-secondary mb-1">各章结构功能</div>
                <div className="space-y-1">
                  {stage1Result.chapterFunctions.map((cf, i) => {
                    const tag = findChapterTag(cf.tag);
                    return (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <span className="shrink-0 px-1 py-0 rounded border border-brand-500/40 bg-primary-500/10 text-brand-300 text-[9px]">
                          {tag?.label ?? cf.tag}
                        </span>
                        <input
                          type="text"
                          value={cf.structuralFunction}
                          onChange={(e) => updateStage1ChapterFn(i, e.target.value)}
                          className="flex-1 bg-surface border border-border-subtle rounded px-1.5 py-0.5 text-[11px] text-fg-primary focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {stage1Result.stage2Focus.length > 0 && (
              <div>
                <div className="text-xs text-fg-secondary mb-1">Stage 2 重点深挖问题</div>
                <div className="space-y-1">
                  {stage1Result.stage2Focus.map((q, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      <span className="text-fg-muted shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateStage1Focus(i, e.target.value)}
                        className="flex-1 bg-surface border border-border-subtle rounded px-1.5 py-0.5 text-[11px] text-fg-primary focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-fg-muted leading-snug">
            💡 人工复核后点击「运行 Stage 2」，会将以上框架作为已确定背景交给深度分析。
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          ⚠ {error}
        </div>
      )}

      {/* Streaming reasoning */}
      {(reasoningStream || (running && useThinking)) && (
        <details
          open={showReasoning}
          onToggle={(e) => setShowReasoning(e.currentTarget.open)}
          className="rounded-md border border-border-subtle bg-surface/30 px-3 py-2"
        >
          <summary className="text-xs text-fg-secondary cursor-pointer flex items-center gap-1.5">
            <Brain className="size-3.5" />
            思维链
            {running && reasoningStream && (
              <Loader2 className="size-3 animate-spin text-primary-400" />
            )}
            <span className="text-fg-muted font-normal">（{reasoningStream.length} 字）</span>
          </summary>
          <div className="mt-2 max-h-[300px] overflow-y-auto text-[11px] text-fg-secondary whitespace-pre-wrap leading-snug border-t border-border-subtle pt-2">
            {reasoningStream || '（思维链尚未流式返回...）'}
          </div>
        </details>
      )}

      {/* Streaming raw JSON (during generation) */}
      {running && streamingJson && !result && (
        <details
          className="rounded-md border border-border-subtle bg-surface/30 px-3 py-2"
        >
          <summary className="text-xs text-fg-secondary cursor-pointer flex items-center gap-1.5">
            <FileJson className="size-3.5" />
            实时输出（流式 JSON · {streamingJson.length} 字）
          </summary>
          <pre className="mt-2 max-h-[300px] overflow-y-auto text-[10px] text-fg-muted whitespace-pre-wrap font-mono">
            {streamingJson}
          </pre>
        </details>
      )}

      {/* Result rendering */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-semibold text-fg-primary">📚 分析结果</h2>
            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={saveToKb}
                disabled={savingKb || savedKbId !== null}
                title="保存为拆书资料后，可在项目设置中绑定此资料。将被注入到 N1.* / N2.* 规划节点。"
                className={
                  'px-2 py-1 text-[11px] rounded border inline-flex items-center gap-1 disabled:opacity-60 ' +
                  (savedKbId !== null
                    ? 'border-success/40 bg-success/15 text-emerald-200'
                    : 'border-brand-500/40 bg-primary-500/10 hover:bg-primary-500/20 text-brand-200')
                }
              >
                {savingKb ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : savedKbId !== null ? (
                  <Check className="size-3" />
                ) : (
                  <Save className="size-3" />
                )}
                {savingKb ? '保存中…' : savedKbId !== null ? `已保存 #${savedKbId}` : '保存到 KB'}
              </button>
              <button
                type="button"
                onClick={() => setShowRawJson((v) => !v)}
                className="px-2 py-1 text-[11px] rounded border border-border-default hover:border-zinc-600 hover:bg-elevated text-fg-secondary inline-flex items-center gap-1"
              >
                <FileJson className="size-3" /> {showRawJson ? '隐藏' : '查看'} JSON
              </button>
              <button
                type="button"
                onClick={copyJson}
                className="px-2 py-1 text-[11px] rounded border border-border-default hover:border-zinc-600 hover:bg-elevated text-fg-secondary inline-flex items-center gap-1"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                {copied ? '已复制' : '复制 JSON'}
              </button>
            </div>
          </div>

          {kbError && (
            <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger">
              ⚠ 保存 KB 失败：{kbError}
            </div>
          )}
          {savedKbId !== null && (
            <div className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-emerald-200">
              ✓ 已保存为拆书资料 #{savedKbId}。可在项目「资料库」面板中查看并绑定到当前项目。
            </div>
          )}

          {/* Book meta echo */}
          {(result.bookMeta?.title || result.bookMeta?.author || result.bookMeta?.genre) && (
            <div className="text-xs text-fg-muted">
              📖 {result.bookMeta.title} · {result.bookMeta.author} · {result.bookMeta.genre}
            </div>
          )}

          {/* Methodology — most valuable, show first */}
          <Section title="🎯 核心方法论提炼（最有价值的可迁移知识）">
            <Field label="钩子配方" value={result.methodology.hookFormula} />
            <Field label="冲突模型" value={result.methodology.conflictModel} />
            <Field label="节奏签名" value={result.methodology.rhythmSignature} />
            {result.methodology.coreCraftPrinciples?.length > 0 && (
              <div>
                <div className="text-xs text-fg-secondary mb-1">核心工艺原则</div>
                <ul className="space-y-1">
                  {result.methodology.coreCraftPrinciples.map((p, i) => (
                    <li key={i} className="text-xs text-fg-secondary leading-snug pl-3 border-l-2 border-brand-500/40">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Worldview */}
          <Section title="🌍 世界观维度">
            <Field label="核心定位" value={result.worldview.summary} />
            <Field label="核心规则" value={result.worldview.coreRules} />
            <Field label="题材套路与原型" value={result.worldview.tropesAndArchetypes} />
          </Section>

          {/* Characters */}
          <Section title="👤 角色维度">
            <Field label="主角设计方法论" value={result.characters.protagonistDesign} />
            <Field label="配角结构与功能分配" value={result.characters.castStructure} />
            <Field label="角色弧线设计方法" value={result.characters.arcMethodology} />
          </Section>

          {/* Plot */}
          <Section title="📐 剧情维度">
            <Field label="宏观结构" value={result.plot.macroStructure} />
            <Field label="节奏控制手法" value={result.plot.pacingControl} />
            <Field label="伏笔与回收" value={result.plot.foreshadowingAndPayoff} />
            {result.plot.keyTurningPoints?.length > 0 && (
              <div>
                <div className="text-xs text-fg-secondary mb-1">关键转折点</div>
                <ul className="space-y-1">
                  {result.plot.keyTurningPoints.map((p, i) => (
                    <li key={i} className="text-xs text-fg-secondary leading-snug pl-3 border-l-2 border-border-default">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* Position insights */}
          {result.positionInsights?.length > 0 && (
            <Section title="📍 位置洞察（按章节标签）">
              <div className="space-y-2">
                {result.positionInsights.map((ins, i) => {
                  const tag = findChapterTag(ins.tag);
                  return (
                    <div
                      key={i}
                      className="rounded border border-border-subtle bg-surface/30 p-2 space-y-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="px-1.5 py-0.5 rounded border border-brand-500/40 bg-primary-500/10 text-brand-300">
                          {tag.label}
                        </span>
                        <span className="text-fg-muted">{tag.position}</span>
                        {ins.chapterTitle && (
                          <span className="text-fg-secondary">· {ins.chapterTitle}</span>
                        )}
                      </div>
                      <Field label="为什么这样写有效" value={ins.whyItWorks} small />
                      <Field label="如何复用到新作" value={ins.transferableTechnique} small />
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Raw JSON viewer */}
          {showRawJson && (
            <Section title="📄 原始 JSON 输出">
              <pre className="text-[10px] text-fg-secondary font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto bg-canvas border border-border-subtle rounded p-2">
                {JSON.stringify(result, null, 2)}
              </pre>
            </Section>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div className="text-[11px] text-fg-muted leading-relaxed border-t border-border-subtle pt-3">
        <p className="mb-1">
          <span className="text-fg-secondary">💡 使用提示：</span>
          建议至少提供 <span className="text-fg-secondary">黄金章 + 中段 50% + 高潮 80%</span> 三个位置以覆盖核心结构。每章正文 ≥ 500 字效果最佳。
        </p>
        <p>
          <span className="text-fg-secondary">⚙️ Thinking Mode：</span>
          启用后 AI 会先做深度推理再输出（耗时增加 30-50%，但分析质量显著提升）。需要 DeepSeek V4 Pro 或更高模型支持。
        </p>
      </div>
    </div>
  );
}

// ───────────── 子组件 ─────────────

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface/30 p-3 space-y-2">
      <div className="text-sm font-medium text-fg-primary">{props.title}</div>
      <div className="space-y-2">{props.children}</div>
    </div>
  );
}

function Stage1Field(props: { label: string; value: string; rows?: number; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] text-fg-secondary mb-0.5">{props.label}</div>
      {props.rows && props.rows > 1 ? (
        <textarea
          value={props.value}
          rows={props.rows}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-surface border border-border-subtle rounded px-1.5 py-1 text-[11px] text-fg-primary leading-relaxed focus:outline-none focus:border-brand-500"
        />
      ) : (
        <input
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-surface border border-border-subtle rounded px-1.5 py-1 text-[11px] text-fg-primary focus:outline-none focus:border-brand-500"
        />
      )}
    </div>
  );
}

function Field(props: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <div className={(props.small ? 'text-[10px]' : 'text-xs') + ' text-fg-muted mb-0.5'}>
        {props.label}
      </div>
      <div
        className={
          (props.small ? 'text-[11px]' : 'text-xs') +
          ' text-fg-secondary leading-relaxed whitespace-pre-wrap'
        }
      >
        {props.value || <span className="text-fg-muted">（未生成）</span>}
      </div>
    </div>
  );
}
