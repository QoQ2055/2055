// Novel mode workbench.
// 三阶段流水线：设定（N1.1/N1.2）→ 大纲（N2.1/N2.2/N2.3）→ 章节（N3.1/N3.2）。
// 复用 runStep（serial 节点）+ novelLoop 自定义循环器（N2.2 / N3.1 / N3.2）。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Edit3, Play, Square, Loader2, CheckCircle2, Circle, AlertTriangle,
  BookOpen, Eye, ChevronRight, RotateCcw, Wand2, Sparkles,
  Shield, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import clsx from 'clsx';
import { UserKbBindingPanel } from '../components/UserKbBindingPanel';
import { ChapterFeedbackButton } from '../components/ChapterFeedbackButton';
import { MethodModulePanel } from '../components/MethodModulePanel';
import { RefinementToolPanel } from '../components/RefinementToolPanel';
import { ChapterValidationPanel } from '../components/ChapterValidationPanel';
import { ChapterScoreCardSlot } from '../components/ChapterScoreCardSlot';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { CharacterBible } from '../components/CharacterBible';
import { ReflectorLessonsPanel } from '../components/ReflectorLessonsPanel';
import { markStateStale } from '../store/characterStates';
import { loadManifest } from '../pipeline/manifest';
import { runStep } from '../pipeline/runner';
import { runStepBestOfN, isBestOfNRecommended } from '../pipeline/bestOfN';
import {
  runNovelVolumeLoop,
  runNovelChapterDraftLoop,
  runNovelChapterPolishLoop,
  parseVolumePlan,
  parseChapterOutlines,
  type NovelPolishMode,
  type VolumeMeta,
  type ChapterMeta,
  type NovelVolumeLoopMeta,
  type NovelChapterLoopMeta,
} from '../pipeline/novelLoop';
import type { Manifest, ManifestStep, NodeArtifact, NodeStatus, ProjectContext } from '../pipeline/types';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import {
  liveRefinementUndoAll,
  liveRefinementUndoPush,
  liveRefinementUndoPopLast,
  type LiveRefinementUndoEntry,
} from '../store/db';
import { getProjectModeMeta } from '../data/projectModes';
import {
  GENRES, NOVEL_PLATFORMS, NOVEL_POVS, NOVEL_TONES, NOVEL_SCALES,
} from '../data/projectTaxonomy';

// PR-4 · 拆出 sub-components（src/pages/novel/）
import { NOVEL_STEP_TITLES } from './novel/constants';
import { PreviewModal } from './novel/PreviewModal';
import { NovelSettingsDialog } from './novel/NovelSettingsDialog';

// ui-v3 PR-1B · 局部 J/K 章节切换快捷键
import { isEditingTarget } from '../lib/shortcuts';

interface RunState { status: NodeStatus; streamed: string; error?: string }

export function Novel() {
  const project = useProject();
  const settings = useSettings();
  const ctx = project.ctx;
  const meta = getProjectModeMeta(ctx);

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const [chainBusy, setChainBusy] = useState(false);
  const [previewNode, setPreviewNode] = useState<string | null>(null);
  const [editSettings, setEditSettings] = useState(false);
  // Best-of-N 全局开关（影响 N1.1 / N1.2 等推荐节点 + 章节草稿循环）
  const [useBestOfN, setUseBestOfN] = useState(false);
  const [bestOfNCount, setBestOfNCount] = useState(3);
  // P8 反思裁判：在 Best-of-N 裁判阶段让裁判先写出维度级批评再评分
  const [bestOfNReflection, setBestOfNReflection] = useState(false);
  // P5 硬批准闸：开启后，上游未批准时下游节点无法运行（软警告 → 硬阻断）
  const [hardGate, setHardGate] = useState(false);
  // 章节面板 UI 状态
  const [chapterFilter, setChapterFilter] = useState<'all' | 'pending' | 'failed'>('all');
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number | null>(null);
  const [draftUpTo, setDraftUpTo] = useState<number | ''>('');
  const [polishMode, setPolishMode] = useState<NovelPolishMode>('default');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadManifest()
      .then((m) => { if (!cancelled) setManifest(m); })
      .catch((e) => { if (!cancelled) setLoadErr(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  const novelStage = useMemo(
    () => manifest?.stages.find((s) => s.id === 'novel') ?? null,
    [manifest],
  );
  const stepBy = (i: number): ManifestStep | null =>
    novelStage?.steps.find((s) => s.index === i) ?? null;

  // 解析当前的卷 / 章节列表（来自最新 artifact）
  const volumes = useMemo<VolumeMeta[]>(() => {
    const a = project.artifacts['novel.3'];
    return a ? parseVolumePlan(a.content) : [];
  }, [project.artifacts]);

  const chapters = useMemo<ChapterMeta[]>(() => {
    const a = project.artifacts['novel.4'];
    return a ? parseChapterOutlines(a.content) : [];
  }, [project.artifacts]);

  const volumeMeta = (project.artifacts['novel.4']?.meta ?? {}) as Partial<NovelVolumeLoopMeta>;
  const draftMeta = (project.artifacts['novel.6']?.meta ?? {}) as Partial<NovelChapterLoopMeta>;
  const polishMeta = (project.artifacts['novel.7']?.meta ?? {}) as Partial<NovelChapterLoopMeta>;

  // ui-v3 PR-1B Step2 · J / K 章节切换快捷键（局部 · 仅 /novel 生效）
  // V3-I-2 不抢系统：仅纯 J/K（不含 modifier）· 输入态自动禁用
  // V3-I-1 路由不动：仅修改 selectedChapterIdx · 不调用 navigate
  // 边界：1..chapters.length · 首次按键时从 1 开始 · K 不会跌破 1 · J 不会超 length
  useEffect(() => {
    if (chapters.length === 0) return;
    function handler(e: KeyboardEvent) {
      if (isEditingTarget(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      e.preventDefault();
      setSelectedChapterIdx((cur) => {
        const start = cur ?? 0;
        if (key === 'j') return Math.min(chapters.length, start + 1);
        return Math.max(1, start - 1);
      });
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chapters.length]);

  /* ── helpers ───────────────────────────────────────────────── */

  function setNodeState(id: string, patch: Partial<RunState>) {
    setRunStates((s) => ({
      ...s,
      [id]: { ...(s[id] ?? { status: 'idle', streamed: '' }), ...patch },
    }));
  }

  function stop() { abortRef.current?.abort(); }

  /* ── P4 审批闸 helpers ─────────────────────────────────────
   * artifact.meta.approved + approvedAt 作为 "下游可信依赖" 的锁定标记。
   * 该锁定是软策略：上游未批准时下游可运行，但 UI 会显示警告。
   * 重跑已批准节点时会有 confirm，避免误覆盖。
   */
  // novel.* 上下游依赖图（仅做软警告用，不阻断运行）
  const NOVEL_UPSTREAM: Record<string, string[]> = {
    'novel.1': ['novel.0'],         // novel.0 可选，缺失时不算未批准
    'novel.2': ['novel.1'],
    'novel.3': ['novel.1', 'novel.2'],
    'novel.4': ['novel.3'],
    'novel.5': ['novel.4'],
    'novel.6': ['novel.3', 'novel.4', 'novel.5'],
    'novel.7': ['novel.6'],
  };

  function toggleApproval(nodeId: string) {
    const cur = useProject.getState().artifacts[nodeId];
    if (!cur) return;
    const meta = (cur.meta ?? {}) as { approved?: boolean; approvedAt?: number };
    const nextApproved = !meta.approved;
    project.upsertArtifact({
      ...cur,
      meta: {
        ...meta,
        approved: nextApproved,
        approvedAt: nextApproved ? Date.now() : undefined,
      },
    });
  }

  /** 返回该节点 "存在但未批准" 的直接上游 id 列表（用于软警告） */
  function unapprovedUpstreamFor(nodeId: string): string[] {
    const ups = NOVEL_UPSTREAM[nodeId] ?? [];
    const out: string[] = [];
    for (const u of ups) {
      const a = project.artifacts[u];
      if (!a) continue; // 缺失就跳过（可能根本没跑过；不算"未批准"）
      const meta = (a.meta ?? {}) as { approved?: boolean };
      if (!meta.approved) out.push(u);
    }
    return out;
  }

  /** P5 硬闸：为真时返回"该节点应被阻断运行"。软闸下永远返回 false。 */
  function gateBlocks(nodeId: string): boolean {
    if (!hardGate) return false;
    return unapprovedUpstreamFor(nodeId).length > 0;
  }

  /** P6 章节级批准：在 novel.6/7 artifact 的 meta.approvedChapters 上增删 */
  function toggleChapterApproval(source: 'draft' | 'polish', chapterIndex: number) {
    const nodeId = source === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (!cur) return;
    const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    const set = new Set<number>(meta.approvedChapters ?? []);
    if (set.has(chapterIndex)) set.delete(chapterIndex);
    else set.add(chapterIndex);
    const nextApproved = [...set].sort((a, b) => a - b);
    project.upsertArtifact({
      ...cur,
      meta: {
        ...(meta as Record<string, unknown>),
        approvedChapters: nextApproved.length > 0 ? nextApproved : undefined,
      },
    });
  }

  /** A. 一键批准本源下所有已完成且未批准的章节 */
  function bulkApproveAllCompleted(source: 'draft' | 'polish') {
    const nodeId = source === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (!cur) return;
    const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    const completed = meta.completedChapters ?? [];
    if (completed.length === 0) return;
    const set = new Set<number>(meta.approvedChapters ?? []);
    let changed = false;
    for (const idx of completed) {
      if (!set.has(idx)) { set.add(idx); changed = true; }
    }
    if (!changed) return;
    const nextApproved = [...set].sort((a, b) => a - b);
    project.upsertArtifact({
      ...cur,
      meta: {
        ...(meta as Record<string, unknown>),
        approvedChapters: nextApproved,
      },
    });
  }

  /** A. 一键撤销本源所有批准 */
  function bulkRevokeAllApprovals(source: 'draft' | 'polish') {
    const nodeId = source === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (!cur) return;
    const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    if (!meta.approvedChapters || meta.approvedChapters.length === 0) return;
    project.upsertArtifact({
      ...cur,
      meta: {
        ...(meta as Record<string, unknown>),
        approvedChapters: undefined,
      },
    });
  }

  async function runSerial(step: ManifestStep) {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setNodeState(step.id, { status: 'running', streamed: '', error: undefined });
    try {
      const liveArtifacts = useProject.getState().artifacts;
      const liveCtx = useProject.getState().ctx;
      // 仅对 Best-of-N 推荐节点（含 novel.6）+ 全局开关开启 时启用
      const enable = useBestOfN && isBestOfNRecommended(step.id);
      let art;
      if (enable) {
        const bn = await runStepBestOfN({
          stageId: 'novel', step,
          project: liveCtx, artifacts: liveArtifacts,
          settings, signal: ctrl.signal,
          n: bestOfNCount,
          reflection: bestOfNReflection,
          taskBrief: `${step.title}（小说项目「${liveCtx.name}」）`,
          onCandidateDelta: (idx, _c, full) => {
            if (idx === 0) setNodeState(step.id, {
              streamed: `🎯 Best-of-${bestOfNCount}${bestOfNReflection ? ' (反思模式)' : ''} 并行中（候选 1 流式）：\n\n${full}`,
            });
          },
          onJudgeStart: () => setNodeState(step.id, {
            streamed: bestOfNReflection
              ? '🎯 候选生成完毕，正在让 LLM 反思裁判择优（先产出维度批评再评分）…'
              : '🎯 候选生成完毕，正在让 LLM 裁判择优…',
          }),
          onJudgeDelta: (_c, full) => setNodeState(step.id, {
            streamed: `🎯 LLM ${bestOfNReflection ? '反思裁判' : '裁判'}中：\n\n${full}`,
          }),
        });
        art = bn.chosen;
      } else {
        art = await runStep({
          stageId: 'novel', step,
          project: liveCtx, artifacts: liveArtifacts,
          settings, signal: ctrl.signal,
          onDelta: (_c, full) => setNodeState(step.id, { streamed: full }),
        });
      }
      project.upsertArtifact(art);
      setNodeState(step.id, { status: 'done' });
    } catch (e: any) {
      if (ctrl.signal.aborted) setNodeState(step.id, { status: 'aborted', error: '已中止' });
      else setNodeState(step.id, { status: 'error', error: e?.message ?? String(e) });
    }
  }

  async function runVolumeLoop(opts?: { onlyVolumes?: number[]; resume?: boolean }) {
    const step = stepBy(4);
    if (!step) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChainBusy(true);
    setNodeState(step.id, { status: 'running', streamed: '', error: undefined });
    try {
      const liveArtifacts = useProject.getState().artifacts;
      const liveCtx = useProject.getState().ctx;
      const art = await runNovelVolumeLoop({
        step, project: liveCtx, artifacts: liveArtifacts, settings,
        signal: ctrl.signal,
        resume: opts?.resume,
        onlyVolumes: opts?.onlyVolumes,
        onVolumeStart: (v, t) => setNodeState(step.id, {
          streamed: `## 第 ${v.index} / ${t} 卷 · ${v.title}（生成中）\n`,
        }),
        onVolumeDelta: (idx, full) => setNodeState(step.id, {
          streamed: `## 第 ${idx} 卷（生成中）\n\n${full}`,
        }),
        onProgress: (intermediate) => project.upsertArtifact(intermediate),
      });
      project.upsertArtifact(art);
      setNodeState(step.id, { status: 'done' });
    } catch (e: any) {
      if (ctrl.signal.aborted) setNodeState(step.id, { status: 'aborted', error: '已中止' });
      else setNodeState(step.id, { status: 'error', error: e?.message ?? String(e) });
    } finally {
      setChainBusy(false);
    }
  }

  async function runDraftLoop(opts?: { onlyChapters?: number[]; upTo?: number; resume?: boolean }) {
    const step = stepBy(6);
    if (!step) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChainBusy(true);
    setNodeState(step.id, { status: 'running', streamed: '', error: undefined });
    try {
      const liveArtifacts = useProject.getState().artifacts;
      const liveCtx = useProject.getState().ctx;
      const art = await runNovelChapterDraftLoop({
        step, project: liveCtx, artifacts: liveArtifacts, settings,
        signal: ctrl.signal,
        resume: opts?.resume,
        onlyChapters: opts?.onlyChapters,
        upTo: opts?.upTo,
        useBestOfN,
        bestOfNCount,
        bestOfNReflection,
        onChapterStart: (c, t) => setNodeState(step.id, {
          streamed: `## 第 ${c.index} / ${t} 章 · ${c.title}（生成中）\n戏点: ${c.beat ?? '(未指定)'}\n`,
        }),
        onChapterDelta: (idx, full) => setNodeState(step.id, {
          streamed: `## 第 ${idx} 章（生成中）\n\n${full}`,
        }),
        onCondense: (info) => setNodeState(step.id, {
          streamed: `🧠 远距区五段式重摘要中（覆盖至第 ${info.coversThrough} 章, ${info.chars} 字）…`,
        }),
        onProgress: (intermediate) => project.upsertArtifact(intermediate),
      });
      project.upsertArtifact(art);
      setNodeState(step.id, { status: 'done' });
    } catch (e: any) {
      if (ctrl.signal.aborted) setNodeState(step.id, { status: 'aborted', error: '已中止' });
      else setNodeState(step.id, { status: 'error', error: e?.message ?? String(e) });
    } finally {
      setChainBusy(false);
    }
  }

  async function runPolishLoop(opts?: {
    onlyChapters?: number[];
    resume?: boolean;
    mode?: NovelPolishMode;
  }) {
    const step = stepBy(7);
    if (!step) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setChainBusy(true);
    setNodeState(step.id, { status: 'running', streamed: '', error: undefined });
    try {
      const liveArtifacts = useProject.getState().artifacts;
      const liveCtx = useProject.getState().ctx;
      const art = await runNovelChapterPolishLoop({
        step, project: liveCtx, artifacts: liveArtifacts, settings,
        signal: ctrl.signal,
        resume: opts?.resume,
        onlyChapters: opts?.onlyChapters,
        polishModeDefault: opts?.mode ?? polishMode,
        onChapterStart: (c, t) => setNodeState(step.id, {
          streamed: `## 润色第 ${c.index} / ${t} 章 · ${c.title}（${opts?.mode ?? polishMode} 模式）\n`,
        }),
        onChapterDelta: (idx, full) => setNodeState(step.id, {
          streamed: `## 第 ${idx} 章（润色中）\n\n${full}`,
        }),
        onProgress: (intermediate) => project.upsertArtifact(intermediate),
      });
      project.upsertArtifact(art);
      setNodeState(step.id, { status: 'done' });
    } catch (e: any) {
      if (ctrl.signal.aborted) setNodeState(step.id, { status: 'aborted', error: '已中止' });
      else setNodeState(step.id, { status: 'error', error: e?.message ?? String(e) });
    } finally {
      setChainBusy(false);
    }
  }

  /* ── render ───────────────────────────────────────────────── */

  if (loadErr) {
    return <div className="p-8 text-red-400">manifest 加载失败：{loadErr}</div>;
  }
  if (!manifest || !novelStage) {
    return (
      <div className="p-8 flex items-center gap-2 text-fg-secondary">
        <Loader2 className="size-4 animate-spin" /> 正在加载小说阶段配置…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Edit3 className="size-7" style={{ color: meta.accentHex }} />
          <div>
            <h1 className="text-2xl font-bold">小说工作台</h1>
            <p className="text-fg-muted text-sm">
              模式：{meta.longLabel} · 项目：{ctx.name || '未命名'}
              {!settings.apiKey && (
                <span className="ml-2 text-warning">⚠ 未配置 API Key（请到「设置」填入）</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Best-of-N 开关 */}
          <div
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors',
              useBestOfN
                ? 'border-warning/60 bg-warning/10 text-warning'
                : 'border-border-subtle text-fg-muted',
            )}
            title="开启后：N1.1/N1.2/N3.1 等高发散节点会并行跑 N 个候选 + LLM 裁判择优。代价：token ≈ N 倍。"
          >
            <input
              type="checkbox"
              id="best-of-n-toggle"
              checked={useBestOfN}
              onChange={(e) => setUseBestOfN(e.target.checked)}
              disabled={chainBusy}
              className="cursor-pointer"
            />
            <label htmlFor="best-of-n-toggle" className="cursor-pointer">🎯 Best-of-N</label>
            {useBestOfN && (
              <select
                value={bestOfNCount}
                onChange={(e) => setBestOfNCount(parseInt(e.target.value, 10))}
                disabled={chainBusy}
                className="bg-surface border border-border-subtle rounded px-1 py-0.5 text-tight-sm"
              >
                <option value={2}>×2</option>
                <option value={3}>×3</option>
                <option value={4}>×4</option>
                <option value={5}>×5</option>
              </select>
            )}
            {useBestOfN && (
              <label
                className="flex items-center gap-1 cursor-pointer text-tight-sm pl-1 border-l border-warning/30"
                title="反思模式：裁判在打分前先写出维度级批评（提高选择准确度，裁判 token × ~2.5）"
              >
                <input
                  type="checkbox"
                  checked={bestOfNReflection}
                  onChange={(e) => setBestOfNReflection(e.target.checked)}
                  disabled={chainBusy}
                  className="cursor-pointer"
                />
                🔍 反思裁判
              </label>
            )}
          </div>
          {/* P5 硬批准闸开关 */}
          <div
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors',
              hardGate
                ? 'border-success/60 bg-success/10 text-success'
                : 'border-border-subtle text-fg-muted',
            )}
            title={hardGate
              ? '硬闸模式：上游未批准时，下游节点会被阻断运行。'
              : '软闸模式：上游未批准仅显示警告，仍可运行。'}
          >
            <input
              type="checkbox"
              id="hard-gate-toggle"
              checked={hardGate}
              onChange={(e) => setHardGate(e.target.checked)}
              disabled={chainBusy}
              className="cursor-pointer"
            />
            <label htmlFor="hard-gate-toggle" className="cursor-pointer">🛡 硬批准闸</label>
          </div>
          {chainBusy && (
            <button onClick={stop} className="btn-ghost text-warning">
              <Square className="size-4 mr-1" /> 中止
            </button>
          )}
          <Link to="/" className="btn-ghost"><ChevronRight className="size-4 mr-1" /> 项目首页</Link>
        </div>
      </header>

      <ProjectSettingsCard
        ctx={ctx}
        accentHex={meta.accentHex}
        onEdit={() => setEditSettings(true)}
      />

      {editSettings && (
        <NovelSettingsDialog
          ctx={ctx}
          onClose={() => setEditSettings(false)}
          onSave={(patch) => {
            project.setCtx(patch);
            setEditSettings(false);
          }}
        />
      )}

      {/* ── Phase 0 · 选题 ─────────────────────────────────── */}
      {stepBy(0) && (
        <section className="card p-5 space-y-3">
          <SectionHeader
            icon={<Wand2 className="size-4 text-success" />}
            title="阶段 0 · 选题"
            desc="在世界观之前，先用 3 候选差异化的题材切入帮你择优；推荐开 Best-of-N"
          />
          <div className="grid grid-cols-1 gap-3">
            <StepCard
              step={stepBy(0)!}
              state={runStates['novel.0']}
              artifact={project.artifacts['novel.0']}
              onRun={() => runSerial(stepBy(0)!)}
              onPreview={() => setPreviewNode('novel.0')}
              onApprove={() => toggleApproval('novel.0')}
              disabled={chainBusy}
              bestOfNActive={useBestOfN && isBestOfNRecommended('novel.0')}
            />
          </div>
        </section>
      )}

      {/* ── Phase A · 设定 ─────────────────────────────────── */}
      <section className="card p-5 space-y-3">
        <SectionHeader
          icon={<Sparkles className="size-4 text-success" />}
          title="阶段 A · 设定"
          desc="确定世界观与人物 bible，是后续所有大纲与章节的根基"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StepCard
            step={stepBy(1)!}
            state={runStates['novel.1']}
            artifact={project.artifacts['novel.1']}
            onRun={() => runSerial(stepBy(1)!)}
            onPreview={() => setPreviewNode('novel.1')}
            onApprove={() => toggleApproval('novel.1')}
            unapprovedUpstream={unapprovedUpstreamFor('novel.1')}
            gateBlocked={gateBlocks('novel.1')}
            disabled={chainBusy}
            bestOfNActive={useBestOfN && isBestOfNRecommended('novel.1')}
          />
          <StepCard
            step={stepBy(2)!}
            state={runStates['novel.2']}
            artifact={project.artifacts['novel.2']}
            onRun={() => runSerial(stepBy(2)!)}
            onPreview={() => setPreviewNode('novel.2')}
            onApprove={() => toggleApproval('novel.2')}
            unapprovedUpstream={unapprovedUpstreamFor('novel.2')}
            gateBlocked={gateBlocks('novel.2')}
            disabled={chainBusy}
            bestOfNActive={useBestOfN && isBestOfNRecommended('novel.2')}
          />
        </div>
      </section>

      {/* ── Phase B · 大纲 ─────────────────────────────────── */}
      <section className="card p-5 space-y-3">
        <SectionHeader
          icon={<BookOpen className="size-4 text-success" />}
          title="阶段 B · 大纲"
          desc="分卷规划 → 单卷分章 → 伏笔表"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StepCard
            step={stepBy(3)!}
            state={runStates['novel.3']}
            artifact={project.artifacts['novel.3']}
            onRun={() => runSerial(stepBy(3)!)}
            onPreview={() => setPreviewNode('novel.3')}
            onApprove={() => toggleApproval('novel.3')}
            unapprovedUpstream={unapprovedUpstreamFor('novel.3')}
            gateBlocked={gateBlocks('novel.3')}
            disabled={chainBusy}
            badge={volumes.length ? `已识别 ${volumes.length} 卷` : undefined}
            bestOfNActive={useBestOfN && isBestOfNRecommended('novel.3')}
          />
          <div className="md:col-span-1">
            <StepCard
              step={stepBy(4)!}
              state={runStates['novel.4']}
              artifact={project.artifacts['novel.4']}
              onRun={() => runVolumeLoop({ resume: true })}
              onPreview={() => setPreviewNode('novel.4')}
              onApprove={() => toggleApproval('novel.4')}
              unapprovedUpstream={unapprovedUpstreamFor('novel.4')}
              gateBlocked={gateBlocks('novel.4')}
              disabled={chainBusy || volumes.length === 0}
              badge={volumeMeta.completedVolumes
                ? `${volumeMeta.completedVolumes.length}/${volumes.length} 卷`
                : volumes.length
                  ? `${volumes.length} 卷`
                  : project.artifacts['novel.3']
                    ? '⚠ N2.1 输出无法解析'
                    : '需先跑 N2.1'}
              extraButtons={volumes.length > 0 ? (
                <button
                  className="btn-ghost text-xs"
                  disabled={chainBusy}
                  onClick={() => runVolumeLoop({ resume: false })}
                >全量重跑</button>
              ) : undefined}
            />
            {volumeMeta.failedVolumes && volumeMeta.failedVolumes.length > 0 && (
              <button
                className="btn-ghost text-xs text-warning mt-2"
                disabled={chainBusy}
                onClick={() => runVolumeLoop({
                  onlyVolumes: volumeMeta.failedVolumes!.map((f) => f.volumeIndex),
                  resume: true,
                })}
              >
                <RotateCcw className="size-3 mr-1" />
                重跑失败卷 ({volumeMeta.failedVolumes.length})
              </button>
            )}
          </div>
          <StepCard
            step={stepBy(5)!}
            state={runStates['novel.5']}
            artifact={project.artifacts['novel.5']}
            onRun={() => runSerial(stepBy(5)!)}
            onPreview={() => setPreviewNode('novel.5')}
            onApprove={() => toggleApproval('novel.5')}
            unapprovedUpstream={unapprovedUpstreamFor('novel.5')}
            gateBlocked={gateBlocks('novel.5')}
            disabled={chainBusy}
          />
        </div>
      </section>

      {/* ── Phase C · 章节 ─────────────────────────────────── */}
      <section className="card p-5 space-y-4">
        <SectionHeader
          icon={<Edit3 className="size-4 text-success" />}
          title="阶段 C · 章节"
          desc="章节草稿（墨刃）→ 章节润色（默认 / 神经化学重写 / 去冗余精简）"
        />

        {/* gap-d · 进度可视化面板（顶部 collapsible · 默认折叠）*/}
        <ProgressDashboard />

        {/* gap-b · 角色 Bible 跨章节追踪面板（CA §4.1 Q1 决议：同视觉语言 collapsible，默认折叠）*/}
        <CharacterBible />

        {/* v6 epic · ACE-lite Reflector lessons 面板（CK I-6 独立面板 · 默认折叠 · 默认未启用）*/}
        <ReflectorLessonsPanel />

        {chapters.length === 0 ? (
          <div className="text-sm text-fg-muted italic">
            暂无章节列表。请先完成 N2.1 分卷规划与 N2.2 单卷分章。
          </div>
        ) : (
          <>
            {gateBlocks('novel.6') && (
              <div className="rounded border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-300 flex items-center gap-2">
                <ShieldAlert className="size-3" />
                <span>硬闸已开启，上游未批准：{unapprovedUpstreamFor('novel.6').join(', ')}。请先批准上游节点或关闭硬闸后再运行章节草稿 / 润色。</span>
              </div>
            )}
            {/* N3.1 草稿控件 */}
            <div className="rounded border border-border-subtle p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wand2 className="size-4 text-success" />
                  {NOVEL_STEP_TITLES['novel.6']}
                  <StatusBadge status={runStates['novel.6']?.status ?? 'idle'} />
                </div>
                <div className="text-xs text-fg-muted">
                  {draftMeta.completedChapters?.length ?? 0} / {chapters.length} 章已写
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  className="btn-primary text-xs"
                  disabled={chainBusy || gateBlocks('novel.6')}
                  onClick={() => runDraftLoop({ resume: true })}
                ><Play className="size-3 mr-1" />续写所有未完成章节</button>
                <button
                  className="btn-ghost text-xs"
                  disabled={chainBusy || selectedChapterIdx === null || gateBlocks('novel.6')}
                  onClick={() => selectedChapterIdx && runDraftLoop({
                    onlyChapters: [selectedChapterIdx], resume: true,
                  })}
                >仅写选中章 {selectedChapterIdx ? `(第 ${selectedChapterIdx} 章)` : ''}</button>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-fg-muted">写到第</span>
                  <input
                    type="number"
                    className="w-16 bg-surface border border-border-default rounded px-1.5 py-0.5"
                    value={draftUpTo}
                    onChange={(e) => setDraftUpTo(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                    placeholder="N"
                    min={1}
                  />
                  <button
                    className="btn-ghost text-xs"
                    disabled={chainBusy || typeof draftUpTo !== 'number' || gateBlocks('novel.6')}
                    onClick={() => typeof draftUpTo === 'number' && runDraftLoop({
                      upTo: draftUpTo, resume: true,
                    })}
                  >章为止</button>
                </div>
                <button
                  className="btn-ghost text-xs ml-auto"
                  onClick={() => setPreviewNode('novel.6')}
                  disabled={!project.artifacts['novel.6']}
                ><Eye className="size-3 mr-1" />预览</button>
              </div>
              {draftMeta.failedChapters && draftMeta.failedChapters.length > 0 && (
                <button
                  className="btn-ghost text-xs text-warning"
                  disabled={chainBusy || gateBlocks('novel.6')}
                  onClick={() => runDraftLoop({
                    onlyChapters: draftMeta.failedChapters!.map((f) => f.chapterIndex),
                    resume: true,
                  })}
                >
                  <RotateCcw className="size-3 mr-1" />
                  重写失败章节 ({draftMeta.failedChapters.length})
                </button>
              )}
            </div>

            {/* N3.2 润色控件 */}
            <div className="rounded border border-border-subtle p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4 text-success" />
                  {NOVEL_STEP_TITLES['novel.7']}
                  <StatusBadge status={runStates['novel.7']?.status ?? 'idle'} />
                </div>
                <div className="text-xs text-fg-muted">
                  {polishMeta.completedChapters?.length ?? 0} / {chapters.length} 章已润色
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="bg-surface border border-border-default rounded px-2 py-1 text-xs"
                  value={polishMode}
                  onChange={(e) => setPolishMode(e.target.value as NovelPolishMode)}
                  title={
                    polishMode === 'de_ai'
                      ? '专门消除 AI 写作痕迹（机械连词/对仗排比/通用形容词/summarizing 旁白等 10 类）'
                      : polishMode === 'neuro'
                        ? '按 6 个神经化学滑钮（多巴胺 / 内啡肽 / 催产素 / 血清素 / 皮质醇 / GABA）重配情绪戏'
                        : polishMode === 'condense'
                          ? '五条铁律压缩字数（-10~-20%）'
                          : '语言润色 + 三密度修订（戏点 / 信息 / 情绪）'
                  }
                >
                  <option value="default">默认润色</option>
                  <option value="de_ai">🧹 去 AI 化（10 条反 AI 笔触）</option>
                  <option value="neuro">【神经化学重写】</option>
                  <option value="condense">【去冗余精简】</option>
                </select>
                <button
                  className="btn-primary text-xs"
                  disabled={chainBusy || (draftMeta.completedChapters?.length ?? 0) === 0 || gateBlocks('novel.7')}
                  onClick={() => runPolishLoop({ resume: true })}
                ><Play className="size-3 mr-1" />润色所有已写章节</button>
                <button
                  className="btn-ghost text-xs"
                  disabled={chainBusy || selectedChapterIdx === null
                    || !draftMeta.completedChapters?.includes(selectedChapterIdx)
                    || gateBlocks('novel.7')}
                  onClick={() => selectedChapterIdx && runPolishLoop({
                    onlyChapters: [selectedChapterIdx], resume: true,
                  })}
                >仅润选中章</button>
                <button
                  className="btn-ghost text-xs ml-auto"
                  onClick={() => setPreviewNode('novel.7')}
                  disabled={!project.artifacts['novel.7']}
                ><Eye className="size-3 mr-1" />预览</button>
              </div>
            </div>

            {/* 章节列表 */}
            <ChapterList
              chapters={chapters}
              draftMeta={draftMeta}
              polishMeta={polishMeta}
              filter={chapterFilter}
              setFilter={setChapterFilter}
              selectedIdx={selectedChapterIdx}
              setSelectedIdx={setSelectedChapterIdx}
              onPreviewChapter={(i, src) => setPreviewNode(`chapter:${src}:${i}`)}
              onToggleChapterApproval={toggleChapterApproval}
              onBulkApproveCompleted={bulkApproveAllCompleted}
              onBulkRevoke={bulkRevokeAllApprovals}
            />
          </>
        )}
      </section>

      {/* ── Streaming preview of the currently-running step ──────── */}
      {chainBusy && (
        <section className="card p-4 bg-surface/50">
          <div className="text-xs text-fg-muted mb-1">实时输出</div>
          <pre className="whitespace-pre-wrap text-xs text-fg-secondary max-h-96 overflow-auto font-mono">
            {Object.entries(runStates).find(([, s]) => s.status === 'running')?.[1].streamed
              ?? '（等待首个 token...）'}
          </pre>
        </section>
      )}

      {/* ── Preview modal ────────────────────────────────────────── */}
      {previewNode && (
        <PreviewModal
          target={previewNode}
          chapters={chapters}
          draftMeta={draftMeta}
          polishMeta={polishMeta}
          artifacts={project.artifacts}
          onClose={() => setPreviewNode(null)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────────────── */

function ProjectSettingsCard({
  ctx, accentHex, onEdit,
}: {
  ctx: ProjectContext;
  accentHex: string;
  onEdit: () => void;
}) {
  // 老项目可能没有小说字段；在这种情况下显示提示，建议重建项目
  const hasNovelFields = !!(ctx.novelPlatform || ctx.novelScale || ctx.novelPov);
  if (!hasNovelFields) {
    return (
      <section
        className="card p-4 text-xs"
        style={{ borderColor: '#f59e0b55', backgroundColor: '#f59e0b08' }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-medium text-warning">缺少小说项目设定</div>
            <div className="text-fg-secondary leading-relaxed">
              当前项目未填写平台 / POV / 调性等小说专用字段，会导致大纲和章节生成质量受影响。
              点击右侧按钮原地<b>补全设定</b>（不影响已有产物）。
            </div>
          </div>
          <button className="btn-primary text-xs shrink-0" onClick={onEdit}>
            <Wand2 className="size-3 mr-1" /> 补全设定
          </button>
        </div>
      </section>
    );
  }

  const platform = NOVEL_PLATFORMS.find((p) => p.value === ctx.novelPlatform);
  const scale = NOVEL_SCALES.find((s) => s.value === ctx.novelScale);
  const pov = NOVEL_POVS.find((o) => o.value === ctx.novelPov);
  const tone = NOVEL_TONES.find((o) => o.value === ctx.novelTone);
  const audienceMap: Record<string, string> = { male: '男频', female: '女频', general: '通用' };
  const genreLabels = (ctx.genres ?? [])
    .map((v) => GENRES.find((g) => g.value === v)?.label)
    .filter(Boolean) as string[];
  const wpc = ctx.novelTotalWordsK && ctx.novelTotalChapters
    ? Math.round(ctx.novelTotalWordsK * 10000 / ctx.novelTotalChapters)
    : null;

  return (
    <section
      className="card p-4 space-y-2"
      style={{ borderColor: `${accentHex}55`, backgroundColor: `${accentHex}08` }}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-fg-secondary">
        <Sparkles className="size-3.5" style={{ color: accentHex }} />
        项目设定（注入到所有小说 prompt）
        <button className="ml-auto btn-ghost text-tight-sm py-0.5 px-1.5" onClick={onEdit}>
          编辑
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <SettingItem label="平台" value={platform?.label} sub={platform ? `每章 ${platform.wordsPerChapter} 字` : undefined} />
        <SettingItem label="读者" value={ctx.novelAudience ? audienceMap[ctx.novelAudience] : undefined} />
        <SettingItem label="体量" value={scale?.label} sub={scale ? `${scale.totalWordsK}万字` : undefined} />
        <SettingItem
          label="规模"
          value={ctx.novelTotalWordsK && ctx.novelTotalChapters
            ? `${ctx.novelTotalWordsK}万 / ${ctx.novelTotalChapters}章`
            : undefined}
          sub={wpc ? `每章约 ${wpc} 字` : undefined}
        />
        <SettingItem label="POV" value={pov?.label} />
        <SettingItem label="调性" value={tone?.label} />
        <SettingItem
          label="题材"
          value={genreLabels.length ? genreLabels.join('+') : undefined}
        />
        <SettingItem
          label="主角"
          value={ctx.protagonistGender
            ? ({ male: '男主', female: '女主', dual: '男女双主', nonhuman: '非人/特殊' } as Record<string, string>)[ctx.protagonistGender]
            : undefined}
        />
      </div>
      {(ctx.novelLogline || ctx.coreConflict || ctx.novelHook) && (
        <div className="border-t border-border-subtle/60 pt-2 space-y-1 text-xs">
          {ctx.novelLogline && (
            <div><span className="text-fg-muted">卖点：</span><span className="text-fg-secondary">{ctx.novelLogline}</span></div>
          )}
          {ctx.coreConflict && (
            <div><span className="text-fg-muted">核心冲突：</span><span className="text-fg-secondary">{ctx.coreConflict}</span></div>
          )}
          {ctx.novelHook && (
            <div><span className="text-fg-muted">金手指 / 关键设定：</span><span className="text-fg-secondary">{ctx.novelHook}</span></div>
          )}
        </div>
      )}
      {((ctx.userKbDocIds && ctx.userKbDocIds.length > 0) || (ctx.methodModuleIds && ctx.methodModuleIds.length > 0)) && (
        <div className="border-t border-border-subtle/60 pt-2 text-xs space-y-1">
          {ctx.userKbDocIds && ctx.userKbDocIds.length > 0 && (
            <div>
              <span className="text-fg-muted">📚 知识库绑定：</span>
              <span className="text-fg-secondary">{ctx.userKbDocIds.length} 条资料</span>
              <Link to="/kb" className="ml-2 text-tight-sm text-brand-300 hover:text-brand-200">
                管理 →
              </Link>
            </div>
          )}
          {ctx.methodModuleIds && ctx.methodModuleIds.length > 0 && (
            <div>
              <span className="text-fg-muted">📐 方法论：</span>
              <span className="text-fg-secondary">{ctx.methodModuleIds.length} 个已启用</span>
              <span className="ml-1 text-fg-muted text-tight-xs">({ctx.methodModuleIds.join(', ')})</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SettingItem({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <div>
      <div className="text-tight-xs text-fg-muted uppercase tracking-wider">{label}</div>
      <div className="text-fg-primary truncate" title={value ?? '—'}>{value ?? <span className="text-fg-muted">—</span>}</div>
      {sub && <div className="text-tight-xs text-fg-muted">{sub}</div>}
    </div>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-base font-semibold">{icon}{title}</div>
      <div className="text-xs text-fg-muted mt-0.5">{desc}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: NodeStatus }) {
  if (status === 'running') {
    return <span className="text-xs flex items-center gap-1 text-blue-400">
      <Loader2 className="size-3 animate-spin" /> 运行中
    </span>;
  }
  if (status === 'done') {
    return <span className="text-xs flex items-center gap-1 text-success">
      <CheckCircle2 className="size-3" /> 完成
    </span>;
  }
  if (status === 'error') {
    return <span className="text-xs flex items-center gap-1 text-red-400">
      <AlertTriangle className="size-3" /> 失败
    </span>;
  }
  if (status === 'aborted') {
    return <span className="text-xs flex items-center gap-1 text-warning">
      <Square className="size-3" /> 中止
    </span>;
  }
  return <span className="text-xs flex items-center gap-1 text-fg-muted">
    <Circle className="size-3" /> 待运行
  </span>;
}

function StepCard({
  step, state, artifact, onRun, onPreview, onApprove, disabled, badge, extraButtons,
  bestOfNActive, unapprovedUpstream, gateBlocked,
}: {
  step: ManifestStep;
  state?: RunState;
  artifact?: NodeArtifact;
  onRun: () => void;
  onPreview: () => void;
  onApprove?: () => void;
  disabled?: boolean;
  badge?: string;
  extraButtons?: React.ReactNode;
  bestOfNActive?: boolean;
  /** 上游节点 id 列表，有但未批准时显示软警告（不阻断运行） */
  unapprovedUpstream?: string[];
  /** P5 硬闸：为真时运行按钮被锁定，警告变红 */
  gateBlocked?: boolean;
}) {
  const status = state?.status ?? (artifact ? 'done' : 'idle');
  const meta = artifact?.meta as { bestOfN?: { candidateCount: number; chosenIndex: number }; approved?: boolean; approvedAt?: number } | undefined;
  const bnMeta = meta?.bestOfN;
  const approved = meta?.approved === true;
  const approvedAt = meta?.approvedAt;
  function handleRun() {
    if (approved) {
      const ok = window.confirm('该节点已被批准，重跑会覆盖已批准的产出，并需重新批准。确定重跑？');
      if (!ok) return;
    }
    onRun();
  }
  return (
    <div className={clsx(
      'rounded border p-3 transition-colors space-y-2',
      approved ? 'border-emerald-700/60 bg-success/5' : 'border-border-subtle hover:border-border-default',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-tight flex items-center gap-1.5 flex-wrap">
          {NOVEL_STEP_TITLES[step.id] ?? step.title}
          {bestOfNActive && (
            <span className="text-tight-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
              🎯 Best-of-N
            </span>
          )}
          {bnMeta && (
            <span
              className="text-tight-xs px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30"
              title={`Best-of-${bnMeta.candidateCount} 选中候选 #${bnMeta.chosenIndex + 1}`}
            >
              ✓ {bnMeta.candidateCount}选1
            </span>
          )}
          {approved && (
            <span
              className="text-tight-xs px-1.5 py-0.5 rounded bg-emerald-600/20 text-success border border-success/40 flex items-center gap-1"
              title={approvedAt ? `已于 ${new Date(approvedAt).toLocaleString()} 批准` : '已批准'}
            >
              <ShieldCheck className="size-3" /> 已批准
            </span>
          )}
          {!approved && artifact && (
            <span className="text-tight-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning/90 border border-warning/30" title="产出已生成，但未被批准。下游可运行，但会提示软警告。">
              🛡 待批准
            </span>
          )}
        </div>
        <StatusBadge status={status as NodeStatus} />
      </div>
      {badge && <div className="text-xs text-fg-muted">{badge}</div>}
      {unapprovedUpstream && unapprovedUpstream.length > 0 && (
        <div
          className={clsx(
            'text-tight-sm flex items-center gap-1',
            gateBlocked ? 'text-red-400' : 'text-warning/90',
          )}
          title={gateBlocked
            ? `硬闸已开启，上游未批准：${unapprovedUpstream.join(', ')}。请先批准上游节点或关闭硬闸。`
            : `上游节点未批准：${unapprovedUpstream.join(', ')}。可以运行，但质量不保。`}
        >
          <ShieldAlert className="size-3" />
          {gateBlocked ? '硬闸阻断' : '上游未批准'}：{unapprovedUpstream.join(', ')}
        </div>
      )}
      {state?.error && (
        <div className="text-xs text-red-400 truncate" title={state.error}>
          {state.error}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          className="btn-primary text-xs flex-1"
          disabled={disabled || status === 'running' || gateBlocked}
          onClick={handleRun}
          title={gateBlocked ? '硬闸已开启，上游未批准，无法运行' : undefined}
        >
          {status === 'running'
            ? <><Loader2 className="size-3 mr-1 animate-spin" />运行中</>
            : gateBlocked
              ? <><ShieldAlert className="size-3 mr-1" />硬闸阻断</>
              : artifact
                ? <><RotateCcw className="size-3 mr-1" />重跑</>
                : <><Play className="size-3 mr-1" />运行</>}
        </button>
        {artifact && (
          <button className="btn-ghost text-xs" onClick={onPreview} title="预览">
            <Eye className="size-3" />
          </button>
        )}
        {artifact && onApprove && (
          <button
            className={clsx('btn-ghost text-xs', approved ? 'text-success' : 'text-fg-secondary hover:text-success')}
            onClick={onApprove}
            title={approved ? '点击撤回批准' : '批准该产出（锁定为下游可信依赖的基准版本）'}
          >
            {approved ? <ShieldCheck className="size-3" /> : <Shield className="size-3" />}
          </button>
        )}
        {extraButtons}
      </div>
    </div>
  );
}

function ChapterList({
  chapters, draftMeta, polishMeta, filter, setFilter,
  selectedIdx, setSelectedIdx, onPreviewChapter, onToggleChapterApproval,
  onBulkApproveCompleted, onBulkRevoke,
}: {
  chapters: ChapterMeta[];
  draftMeta: Partial<NovelChapterLoopMeta>;
  polishMeta: Partial<NovelChapterLoopMeta>;
  filter: 'all' | 'pending' | 'failed';
  setFilter: (f: 'all' | 'pending' | 'failed') => void;
  selectedIdx: number | null;
  setSelectedIdx: (i: number | null) => void;
  onPreviewChapter: (chapterIndex: number, source: 'draft' | 'polish') => void;
  /** P6 章节级批准切换（可选） */
  onToggleChapterApproval?: (source: 'draft' | 'polish', chapterIndex: number) => void;
  /** A. 一键批准本源所有已完成章节 */
  onBulkApproveCompleted?: (source: 'draft' | 'polish') => void;
  /** A. 一键撤销本源所有批准 */
  onBulkRevoke?: (source: 'draft' | 'polish') => void;
}) {
  const draftApprovedSet = new Set(draftMeta.approvedChapters ?? []);
  const polishApprovedSet = new Set(polishMeta.approvedChapters ?? []);
  const visible = chapters.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !draftMeta.completedChapters?.includes(c.index);
    if (filter === 'failed') return draftMeta.failedChapters?.some((f) => f.chapterIndex === c.index);
    return true;
  });
  return (
    <div className="rounded border border-border-subtle">
      <div className="flex items-center gap-2 p-2 border-b border-border-subtle text-xs flex-wrap">
        <span className="text-fg-muted">章节列表 · 共 {chapters.length} 章</span>
        {(draftApprovedSet.size > 0 || polishApprovedSet.size > 0) && (
          <span className="text-success/80 flex items-center gap-1" title="已批准章节计数（草 / 润）">
            <ShieldCheck className="size-3" />
            草 {draftApprovedSet.size} / 润 {polishApprovedSet.size}
          </span>
        )}
        {/* A. 一键批准 / 撤销控件 */}
        {onBulkApproveCompleted && (
          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border-default/60">
            <span className="text-fg-muted">一键：</span>
            <button
              className="text-success/80 hover:text-success px-1"
              title={`批准所有已完成草稿章节（${(draftMeta.completedChapters?.length ?? 0)} 章）`}
              disabled={(draftMeta.completedChapters?.length ?? 0) === 0}
              onClick={() => onBulkApproveCompleted('draft')}
            >✓ 草稿</button>
            <button
              className="text-blue-400/80 hover:text-blue-300 px-1"
              title={`批准所有已完成润色章节（${(polishMeta.completedChapters?.length ?? 0)} 章）`}
              disabled={(polishMeta.completedChapters?.length ?? 0) === 0}
              onClick={() => onBulkApproveCompleted('polish')}
            >✓ 润色</button>
            {onBulkRevoke && (draftApprovedSet.size > 0 || polishApprovedSet.size > 0) && (
              <button
                className="text-fg-muted hover:text-danger px-1"
                title="撤销所有批准状态"
                onClick={() => {
                  if (!confirm('确认撤销本项目中所有章节的批准状态？')) return;
                  if (draftApprovedSet.size > 0) onBulkRevoke('draft');
                  if (polishApprovedSet.size > 0) onBulkRevoke('polish');
                }}
              >× 全部撤销</button>
            )}
          </div>
        )}
        <div className="ml-auto flex gap-1">
          {(['all', 'pending', 'failed'] as const).map((k) => (
            <button
              key={k}
              className={clsx(
                'px-2 py-0.5 rounded',
                filter === k ? 'bg-emerald-600/20 text-success' : 'text-fg-muted hover:text-fg-secondary',
              )}
              onClick={() => setFilter(k)}
            >{k === 'all' ? '全部' : k === 'pending' ? '未写' : '失败'}</button>
          ))}
        </div>
      </div>
      <div className="max-h-72 overflow-auto divide-y divide-border-subtle/50">
        {visible.length === 0 && (
          <div className="p-3 text-xs text-fg-muted italic">无匹配章节</div>
        )}
        {visible.map((c) => {
          const drafted = draftMeta.completedChapters?.includes(c.index);
          const polished = polishMeta.completedChapters?.includes(c.index);
          const failed = draftMeta.failedChapters?.find((f) => f.chapterIndex === c.index);
          const selected = selectedIdx === c.index;
          const draftApproved = draftApprovedSet.has(c.index);
          const polishApproved = polishApprovedSet.has(c.index);
          // A. 视觉锁定：草稿批准 → 绿边；润色批准 → 蓝边；两者都有 → 紫边（最高优先级）
          const lockBorder = polishApproved && draftApproved
            ? 'border-l-2 border-l-violet-500/70'
            : polishApproved
              ? 'border-l-2 border-l-blue-500/70'
              : draftApproved
                ? 'border-l-2 border-l-emerald-500/70'
                : 'border-l-2 border-l-transparent';
          return (
            <div
              key={c.index}
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-elevated/40',
                selected && 'bg-emerald-600/10',
                lockBorder,
              )}
              onClick={() => setSelectedIdx(selected ? null : c.index)}
            >
              <span className="w-10 text-fg-muted font-mono shrink-0">第{c.index}章</span>
              <span className="flex-1 truncate text-fg-primary">{c.title}</span>
              <span className="text-fg-muted truncate max-w-[40%] hidden lg:block">
                {c.beat || c.paceTag || ''}
              </span>
              <div className="flex gap-1 shrink-0 items-center">
                {drafted && (
                  <button
                    title="预览草稿"
                    className="text-success hover:text-success"
                    onClick={(e) => { e.stopPropagation(); onPreviewChapter(c.index, 'draft'); }}
                  >草</button>
                )}
                {drafted && onToggleChapterApproval && (
                  <button
                    title={draftApproved ? '点击撤销草稿批准' : '批准本章草稿（重写会自动撤销）'}
                    className={clsx(draftApproved ? 'text-success' : 'text-fg-muted hover:text-success')}
                    onClick={(e) => { e.stopPropagation(); onToggleChapterApproval('draft', c.index); }}
                  >
                    {draftApproved ? <ShieldCheck className="size-3" /> : <Shield className="size-3" />}
                  </button>
                )}
                {polished && (
                  <button
                    title="预览润色"
                    className="text-blue-400 hover:text-blue-300"
                    onClick={(e) => { e.stopPropagation(); onPreviewChapter(c.index, 'polish'); }}
                  >润</button>
                )}
                {polished && onToggleChapterApproval && (
                  <button
                    title={polishApproved ? '点击撤销润色批准' : '批准本章润色版本'}
                    className={clsx(polishApproved ? 'text-blue-400' : 'text-fg-muted hover:text-blue-400')}
                    onClick={(e) => { e.stopPropagation(); onToggleChapterApproval('polish', c.index); }}
                  >
                    {polishApproved ? <ShieldCheck className="size-3" /> : <Shield className="size-3" />}
                  </button>
                )}
                {failed && <span title={failed.error} className="text-red-400">⚠</span>}
                {!drafted && !failed && <span className="text-fg-muted">·</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

