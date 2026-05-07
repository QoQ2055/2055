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
  NOVEL_AUDIENCES, MAX_GENRES, PROTAGONISTS,
  findNovelPlatform, findNovelScale,
} from '../data/projectTaxonomy';

interface RunState { status: NodeStatus; streamed: string; error?: string }

const NOVEL_STEP_TITLES: Record<string, string> = {
  'novel.0': 'N0 题材选题探索',
  'novel.1': 'N1.1 世界观文档',
  'novel.2': 'N1.2 人物 Bible',
  'novel.3': 'N2.1 全书分卷规划',
  'novel.4': 'N2.2 单卷分章明细（循环）',
  'novel.5': 'N2.3 伏笔表',
  'novel.6': 'N3.1 章节草稿（循环 · 墨刃）',
  'novel.7': 'N3.2 章节润色（循环 · 三模式）',
};

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

function PreviewModal({
  target, chapters, draftMeta, polishMeta, artifacts, onClose,
}: {
  target: string;
  chapters: ChapterMeta[];
  draftMeta: Partial<NovelChapterLoopMeta>;
  polishMeta: Partial<NovelChapterLoopMeta>;
  artifacts: Record<string, NodeArtifact>;
  onClose: () => void;
}) {
  let title = target;
  let body = '';
  let chapterIndex: number | null = null;
  let chapterSrc: 'draft' | 'polish' | null = null;
  let chapterTitle: string | undefined;
  // B. 节点级 Best-of-N 裁判信息（章节预览不显示，章节级裁判信息存在 chapter loop 内未对外暴露）
  type BoNInfo = {
    candidateCount: number;
    chosenIndex: number;
    scores?: number[];
    reasoning?: string;
    critique?: string;
    reflection?: boolean;
  };
  let bestOfNInfo: BoNInfo | null = null;
  if (target.startsWith('chapter:')) {
    const [, src, idxStr] = target.split(':');
    const idx = parseInt(idxStr, 10);
    chapterIndex = idx;
    chapterSrc = src as 'draft' | 'polish';
    const ch = chapters.find((c) => c.index === idx);
    chapterTitle = ch?.title;
    title = `第 ${idx} 章 · ${ch?.title ?? ''} (${src === 'draft' ? '草稿' : '润色'})`;
    if (src === 'draft') body = draftMeta.chapterContents?.[idx] ?? '(无内容)';
    else body = polishMeta.chapterContents?.[idx] ?? '(无内容)';
  } else {
    const art = artifacts[target];
    title = NOVEL_STEP_TITLES[target] ?? target;
    body = art?.content ?? '(无内容)';
    const meta = (art?.meta ?? {}) as { bestOfN?: BoNInfo };
    if (meta.bestOfN) bestOfNInfo = meta.bestOfN;
  }

  // 动态显示体：应用 / 撤销后会同步更新，避免关闭 modal 才看到改动
  const [displayBody, setDisplayBody] = useState(body);
  // v2 阶段 2.4 · 章节自动校验需要 ctx + enabledModuleIds
  const previewCtx = useProject((s) => s.ctx);
  const previewEnabledModuleIds = previewCtx.methodModuleIds ?? [];
  const isChapterPreview = chapterIndex != null && displayBody && displayBody !== '(无内容)';

  function copyAll() {
    navigator.clipboard.writeText(displayBody).catch(() => {});
  }

  // 选区优先 —— 用户在 <pre> 中选中的文本优先作为润色入口；
  // 未选区时 RefinementToolPanel 退化到全章/全产物。
  // 仅在「章节预览」场景（chapterIndex 存在）启用润色面板；节点产物预览不启用。
  const [selection, setSelection] = useState('');
  const handlePreMouseUp = () => {
    const sel = window.getSelection?.()?.toString().trim() ?? '';
    setSelection(sel);
  };
  const refinementInput = selection || displayBody;
  const showRefinement = chapterIndex != null && displayBody && displayBody !== '(无内容)';

  // v4 阶段 2.6 · 润色撤销栈 — 持久化到 Dexie（表 liveRefinementUndo）。
  // 以前仅存于 modal 生命周期内，关闭丢弃；现在重启 / 刷新仍可逐步回退。
  // refineUndoStack 的语义是当前 (chapterIndex, source) 的本地映射，仅用于统计显示；
  // 实际 push/pop 都以 db 为准。
  const [refineUndoStack, setRefineUndoStack] = useState<LiveRefinementUndoEntry[]>([]);

  // mount + chapterIndex/chapterSrc 变化时：从 db 读入当前章节的栈
  useEffect(() => {
    if (chapterIndex == null || chapterSrc == null) {
      setRefineUndoStack([]);
      return;
    }
    let alive = true;
    liveRefinementUndoAll().then((all) => {
      if (!alive) return;
      setRefineUndoStack(
        all.filter((e) => e.chapterIndex === chapterIndex && e.source === chapterSrc),
      );
    }).catch((err) => console.warn('[novel] load refinement undo failed', err));
    return () => { alive = false; };
  }, [chapterIndex, chapterSrc]);

  /**
   * 用户点「应用」后的写回逻辑：
   * - 选区存在且选区在原章节中出现 → String.replace 首个匹配位置
   * - 否则 → 全章替换
   * - v4 阶段 2.6 · 原始文本同时写入 Dexie liveRefinementUndo，重启后仍可撤销
   */
  const handleRefineApply = async (newText: string) => {
    if (chapterIndex == null || chapterSrc == null) return;
    const nodeId = chapterSrc === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (!cur) return;
    const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    const oldChapter = meta.chapterContents?.[chapterIndex];
    if (oldChapter == null) return;

    const trimmedSel = selection.trim();
    const useSelection =
      trimmedSel.length > 0 && trimmedSel !== oldChapter && oldChapter.includes(trimmedSel);
    const nextChapter = useSelection ? oldChapter.replace(trimmedSel, newText) : newText;
    if (nextChapter === oldChapter) return;

    // 业务写回
    useProject.getState().upsertArtifact({
      ...cur,
      meta: {
        ...(meta as Record<string, unknown>),
        chapterContents: {
          ...(meta.chapterContents ?? {}),
          [chapterIndex]: nextChapter,
        },
      },
    });

    // v4 阶段 2.6 · 原始文本持久化到 Dexie
    const entry: Omit<LiveRefinementUndoEntry, 'id'> = {
      chapterIndex,
      source: chapterSrc,
      previousText: oldChapter,
      ts: Date.now(),
    };
    try {
      const id = await liveRefinementUndoPush(entry);
      setRefineUndoStack((stack) => [...stack, { ...entry, id }]);
    } catch (e) {
      console.warn('[novel] persist undo entry failed; falling back to in-memory', e);
      setRefineUndoStack((stack) => [...stack, entry as LiveRefinementUndoEntry]);
    }
    // gap-b PR-5 · FR-6.1 用户修订后标记该章及下游状态过期
    if (useSettings.getState().enableCharacterStateExtraction) {
      try {
        await markStateStale(0, chapterIndex);
      } catch (e) {
        console.warn('[gap-b] markStateStale 失败（不阻塞）:', e);
      }
    }
    setDisplayBody(nextChapter);
    setSelection(''); // 应用后选区失效（内容变了）
  };

  /**
   * 弹出栈顶 → 写回原始章节内容。
   * v4 阶段 2.6：以 db 为权威，避免 UI/db 不一致。
   */
  const handleRefineUndo = async () => {
    if (chapterIndex == null || chapterSrc == null) return;
    const last = await liveRefinementUndoPopLast(chapterIndex, chapterSrc).catch((err) => {
      console.warn('[novel] pop undo entry failed', err);
      return null;
    });
    if (!last) return;
    const nodeId = last.source === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (cur) {
      const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
      useProject.getState().upsertArtifact({
        ...cur,
        meta: {
          ...(meta as Record<string, unknown>),
          chapterContents: {
            ...(meta.chapterContents ?? {}),
            [last.chapterIndex]: last.previousText,
          },
        },
      });
    }
    // 同步本地栈状态（删除对应 id 条目）
    setRefineUndoStack((stack) => stack.filter((e) => e.id !== last.id));
    if (last.chapterIndex === chapterIndex && last.source === chapterSrc) {
      setDisplayBody(last.previousText);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg max-w-5xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
          <div className="font-semibold text-sm flex-1">{title}</div>
          {/* 章节预览：加「不满意」反馈按钮，沉淀为偏好资料 */}
          {chapterIndex != null && chapterSrc != null && (
            <ChapterFeedbackButton
              chapterIndex={chapterIndex}
              nodeId={chapterSrc === 'draft' ? 'novel.3.1' : 'novel.3.2'}
              chapterTitle={chapterTitle}
            />
          )}
          {refineUndoStack.length > 0 && (
            <button
              type="button"
              onClick={handleRefineUndo}
              className="text-xs px-2 py-1 rounded border border-warning/40 bg-warning/10 hover:bg-warning/20 text-warning inline-flex items-center gap-1"
              title={`撤销最近一次润色应用（共 ${refineUndoStack.length} 步可撤销）`}
            >
              <RotateCcw className="size-3" />
              撤销润色 ({refineUndoStack.length})
            </button>
          )}
          <button className="btn-ghost text-xs" onClick={copyAll}>复制全文</button>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭</button>
        </div>
        {/* B. Best-of-N 裁判面板（仅节点产物 + 启用过 Best-of-N 时显示） */}
        {bestOfNInfo && (
          <details className="border-b border-border-subtle px-4 py-2 text-xs bg-warning/5">
            <summary className="cursor-pointer text-warning font-medium flex items-center gap-2 select-none">
              🎯 Best-of-{bestOfNInfo.candidateCount} 裁判结果
              <span className="text-success/80">· 已选候选 #{bestOfNInfo.chosenIndex + 1}</span>
              {bestOfNInfo.reflection && (
                <span className="text-blue-300 text-tight-xs px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30">🔍 反思模式</span>
              )}
              <span className="ml-auto text-fg-muted text-tight-xs">点击展开 / 收起</span>
            </summary>
            <div className="mt-2 space-y-2 pl-1">
              {bestOfNInfo.scores && bestOfNInfo.scores.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg-muted">评分：</span>
                  {bestOfNInfo.scores.map((s, i) => (
                    <span
                      key={i}
                      className={clsx(
                        'px-1.5 py-0.5 rounded border font-mono text-tight-sm',
                        i === bestOfNInfo!.chosenIndex
                          ? 'border-success/60 bg-success/10 text-success'
                          : 'border-border-default text-fg-secondary',
                      )}
                    >
                      候选 {i + 1}: {s}
                    </span>
                  ))}
                </div>
              )}
              {bestOfNInfo.reasoning && (
                <div>
                  <div className="text-fg-muted mb-0.5">裁判理由：</div>
                  <div className="text-fg-primary leading-relaxed bg-surface/50 rounded p-2 whitespace-pre-wrap">
                    {bestOfNInfo.reasoning}
                  </div>
                </div>
              )}
              {bestOfNInfo.critique && (
                <div>
                  <div className="text-fg-muted mb-0.5 flex items-center gap-1">
                    <span>维度批评（反思模式）：</span>
                  </div>
                  <pre className="text-fg-secondary text-tight-sm leading-relaxed bg-surface/50 rounded p-2 whitespace-pre-wrap font-mono max-h-72 overflow-auto">
                    {bestOfNInfo.critique}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
        <pre
          className={isChapterPreview
            ? "flex-1 overflow-auto p-6 prose-reading whitespace-pre-wrap select-text min-h-0"
            : "flex-1 overflow-auto p-4 text-sm text-fg-primary whitespace-pre-wrap font-mono leading-relaxed select-text min-h-0"
          }
          onMouseUp={handlePreMouseUp}
        >
          {displayBody}
        </pre>
        {/* v2 阶段 2.9 · 章节级 6 维评分（不持久化，仅当前会话）+ gap-c 第 7 维 transition */}
        {isChapterPreview && (
          <ChapterScoreCardSlot
            text={displayBody}
            chapterKey={`${chapterSrc}:${chapterTitle}`}
            nodeId={chapterSrc === 'draft' ? 'novel.3.1' : 'novel.3.2'}
            stageId="novel"
            prevChapterContent={
              chapterIndex != null && chapterIndex > 1
                ? (polishMeta.chapterContents?.[chapterIndex - 1] ?? draftMeta.chapterContents?.[chapterIndex - 1])
                : undefined
            }
          />
        )}
        {/* v2 阶段 2.4 · 章节自动校验面板（仅章节预览场景） */}
        {isChapterPreview && (
          <ChapterValidationPanel
            text={displayBody}
            ctx={previewCtx}
            enabledModuleIds={previewEnabledModuleIds}
            nodeId={chapterSrc === 'draft' ? 'novel.3.1' : 'novel.3.2'}
            chapterTitle={chapterTitle}
            onApplyRevised={(revised) => handleRefineApply(revised)}
          />
        )}
        {showRefinement && (
          <details className="border-t border-border-subtle bg-canvas/40 px-4 py-2 shrink-0">
            <summary className="cursor-pointer text-xs text-fg-secondary select-none flex items-center gap-2 hover:text-fg-primary">
              <Wand2 className="size-3.5 text-primary-400" />
              <span>润色工具（6 个单一职责工具）</span>
              {selection ? (
                <span className="text-tight-xs px-1.5 py-0.5 rounded border border-success/40 bg-success/10 text-success">
                  选区润色 · {selection.length} 字
                </span>
              ) : (
                <span className="text-tight-xs text-fg-muted">
                  未选区 · 将对全章 ({displayBody.length} 字) 润色
                </span>
              )}
              {refineUndoStack.length > 0 && (
                <span className="text-tight-xs px-1.5 py-0.5 rounded border border-warning/30 bg-warning/5 text-warning/80">
                  已应用 {refineUndoStack.length} 次
                </span>
              )}
              <span className="ml-auto text-tight-xs text-fg-muted">点击展开 / 收起</span>
            </summary>
            <div className="mt-2">
              <RefinementToolPanel
                inputText={refinementInput}
                onApply={handleRefineApply}
                compact
              />
              <p className="mt-2 text-tight-xs text-fg-muted leading-snug">
                💡 点「应用」后会{selection ? '替换选区文本' : '覆写全章内容'}。顺安全起见，顶栏「撤销润色」按钮可逐步回退。
                多工具可链式使用（先精炼→再润色→再调节奏）；不同于 cineforge 的 N3.2 批量润色节点。
              </p>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * 小说设定补全 / 编辑对话框
 *
 * 同时服务两种场景：
 *   • 老 novel 项目从未填过这些字段 → 一次性补全
 *   • 用户中途想改某个字段（比如换平台）→ 增量编辑
 *
 * 注意：所有产物（artifacts）保留不动；只 patch ProjectContext。
 * ────────────────────────────────────────────────────────────────── */
function NovelSettingsDialog({
  ctx, onClose, onSave,
}: {
  ctx: ProjectContext;
  onClose: () => void;
  onSave: (patch: Partial<ProjectContext>) => void;
}) {
  const [novelPlatform, setNovelPlatform] = useState(ctx.novelPlatform ?? 'qidian');
  const [novelScale, setNovelScale] = useState(ctx.novelScale ?? 'long');
  const [novelPov, setNovelPov] = useState(ctx.novelPov ?? 'third_limited');
  const [novelAudience, setNovelAudience] = useState(ctx.novelAudience ?? 'male');
  const [novelTone, setNovelTone] = useState(ctx.novelTone ?? 'fast_pleasure');
  const [novelTotalWordsK, setNovelTotalWordsK] = useState(ctx.novelTotalWordsK ?? 80);
  const [novelTotalChapters, setNovelTotalChapters] = useState(
    ctx.novelTotalChapters ?? Math.round(80 * 10000 / 3500),
  );
  const [chaptersTouched, setChaptersTouched] = useState(!!ctx.novelTotalChapters);
  const [genres, setGenres] = useState<string[]>(ctx.genres ?? []);
  const [protagonistGender, setProtagonistGender] = useState<NonNullable<ProjectContext['protagonistGender']>>(
    ctx.protagonistGender ?? 'male',
  );
  const [coreConflict, setCoreConflict] = useState(ctx.coreConflict ?? '');
  const [novelLogline, setNovelLogline] = useState(ctx.novelLogline ?? '');
  const [novelHook, setNovelHook] = useState(ctx.novelHook ?? '');
  const [userKbDocIds, setUserKbDocIds] = useState<number[]>(ctx.userKbDocIds ?? []);
  const [methodModuleIds, setMethodModuleIds] = useState<string[]>(ctx.methodModuleIds ?? []);

  // 体量切换：自动同步总字数
  useEffect(() => {
    const s = findNovelScale(novelScale);
    if (s) setNovelTotalWordsK(s.totalWordsK);
  }, [novelScale]);
  // 总字数 / 平台变化 → 同步章数（除非用户手动改过）
  useEffect(() => {
    if (!chaptersTouched) {
      const wpc = findNovelPlatform(novelPlatform)?.wordsPerChapter ?? 3500;
      setNovelTotalChapters(Math.max(20, Math.round(novelTotalWordsK * 10000 / wpc)));
    }
  }, [novelTotalWordsK, novelPlatform, chaptersTouched]);

  function toggleGenre(v: string) {
    setGenres((cur) => {
      if (cur.includes(v)) return cur.filter((x) => x !== v);
      if (cur.length >= MAX_GENRES) return cur;
      return [...cur, v];
    });
  }

  const canSave =
    genres.length >= 1
    && coreConflict.trim().length > 0
    && novelTotalWordsK > 0
    && novelTotalChapters >= 5;

  function handleSave() {
    if (!canSave) return;
    const patch: Partial<ProjectContext> = {
      novelPlatform, novelScale, novelPov, novelAudience, novelTone,
      novelTotalWordsK, novelTotalChapters,
      genres, protagonistGender, coreConflict: coreConflict.trim(),
      novelLogline: novelLogline.trim() || undefined,
      novelHook: novelHook.trim() || undefined,
      userKbDocIds: userKbDocIds.length > 0 ? userKbDocIds : undefined,
      methodModuleIds: methodModuleIds.length > 0 ? methodModuleIds : undefined,
    };
    onSave(patch);
  }

  const platform = findNovelPlatform(novelPlatform);
  const wpc = platform?.wordsPerChapter ?? 3500;
  const derivedWpc = novelTotalChapters > 0
    ? Math.round(novelTotalWordsK * 10000 / novelTotalChapters)
    : wpc;

  const audienceLabels: Record<string, string> = { male: '男频', female: '女频', general: '通用' };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg max-w-3xl w-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
          <Wand2 className="size-4 text-success" />
          <div className="font-semibold text-sm flex-1">编辑小说项目设定</div>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 text-xs">
          {/* 平台 / 读者 */}
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="目标平台 *">
              <select
                value={novelPlatform}
                onChange={(e) => setNovelPlatform(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              >
                {NOVEL_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}（每章 {p.wordsPerChapter}）
                  </option>
                ))}
              </select>
              <div className="text-fg-muted mt-1">{platform?.hint}</div>
            </DialogField>
            <DialogField label="读者群 *">
              <div className="flex gap-1">
                {NOVEL_AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setNovelAudience(a.value)}
                    className={clsx(
                      'flex-1 px-2 py-1.5 rounded border',
                      novelAudience === a.value
                        ? 'border-success/60 bg-success/15 text-success-200'
                        : 'border-border-subtle hover:border-border-default',
                    )}
                  >{a.label}</button>
                ))}
              </div>
            </DialogField>
          </div>

          {/* 体量 */}
          <DialogField label="体量档 *">
            <div className="grid grid-cols-5 gap-1">
              {NOVEL_SCALES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setNovelScale(s.value)}
                  className={clsx(
                    'px-2 py-1.5 rounded border text-center',
                    novelScale === s.value
                      ? 'border-success/60 bg-success/15 text-success-200'
                      : 'border-border-subtle hover:border-border-default',
                  )}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-tight-xs text-fg-muted">{s.totalWordsK}万</div>
                </button>
              ))}
            </div>
          </DialogField>

          {/* 总字数 / 章数 */}
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="总字数（万字）*">
              <input
                type="number" min={1} step={5}
                value={novelTotalWordsK}
                onChange={(e) => setNovelTotalWordsK(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              />
            </DialogField>
            <DialogField label={`总章节数 *${chaptersTouched ? '（已手动）' : '（自动派生）'}`}>
              <div className="flex gap-1">
                <input
                  type="number" min={5} step={10}
                  value={novelTotalChapters}
                  onChange={(e) => {
                    setChaptersTouched(true);
                    setNovelTotalChapters(Math.max(5, parseInt(e.target.value, 10) || 0));
                  }}
                  className="flex-1 bg-surface border border-border-subtle rounded px-2 py-1.5"
                />
                {chaptersTouched && (
                  <button className="btn-ghost text-xs" onClick={() => setChaptersTouched(false)}>自动</button>
                )}
              </div>
            </DialogField>
          </div>
          <div className="text-fg-muted -mt-1">
            派生：每章约 <b className="text-fg-secondary">{derivedWpc}</b> 字（平台推荐 {wpc} · ±10% 是写作硬律）
          </div>

          {/* POV / 调性 */}
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="POV 视角 *">
              <select
                value={novelPov}
                onChange={(e) => setNovelPov(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              >
                {NOVEL_POVS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </DialogField>
            <DialogField label="调性 *">
              <select
                value={novelTone}
                onChange={(e) => setNovelTone(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              >
                {NOVEL_TONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </DialogField>
          </div>

          {/* 题材 */}
          <DialogField label={`题材融合（${genres.length}/${MAX_GENRES}）*`}>
            <div className="flex flex-wrap gap-1">
              {GENRES.map((g) => {
                const picked = genres.includes(g.value);
                const capped = !picked && genres.length >= MAX_GENRES;
                return (
                  <button
                    key={g.value}
                    type="button"
                    disabled={capped}
                    onClick={() => toggleGenre(g.value)}
                    title={g.hint}
                    className={clsx(
                      'px-2 py-0.5 text-tight-sm rounded border',
                      picked
                        ? 'border-success/60 bg-success/15 text-success-200'
                        : capped
                          ? 'border-border-subtle text-fg-muted cursor-not-allowed'
                          : 'border-border-subtle hover:border-border-default',
                    )}
                  >{g.label}</button>
                );
              })}
            </div>
          </DialogField>

          {/* 主角 */}
          <DialogField label="主角性别">
            <div className="grid grid-cols-4 gap-1">
              {PROTAGONISTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProtagonistGender(opt.value as typeof protagonistGender)}
                  className={clsx(
                    'px-2 py-1.5 rounded border',
                    protagonistGender === opt.value
                      ? 'border-success/60 bg-success/15 text-success-200'
                      : 'border-border-subtle hover:border-border-default',
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </DialogField>

          <DialogField label="核心冲突 *">
            <textarea
              rows={2}
              value={coreConflict}
              onChange={(e) => setCoreConflict(e.target.value)}
              placeholder="主角 + 处境 + 目标 + 阻力"
              className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
            />
          </DialogField>

          <DialogField label="一句话简介 / 卖点（可选）">
            <input
              type="text" maxLength={120}
              value={novelLogline}
              onChange={(e) => setNovelLogline(e.target.value)}
              className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
            />
          </DialogField>

          <DialogField label="主角金手指 / 关键设定（可选）">
            <textarea
              rows={2} maxLength={400}
              value={novelHook}
              onChange={(e) => setNovelHook(e.target.value)}
              className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
            />
          </DialogField>

          <UserKbBindingPanel
            value={userKbDocIds}
            onChange={setUserKbDocIds}
            collapsed={userKbDocIds.length === 0}
          />
          <MethodModulePanel
            value={methodModuleIds}
            onChange={setMethodModuleIds}
            collapsed={methodModuleIds.length === 0}
            // P9-C 把当前对话框中的字段实时传给推荐引擎，
            // 这样用户调整 ctx 字段时推荐结果会同步刷新。
            ctx={{
              novelPlatform,
              novelScale,
              novelPov,
              novelAudience,
              novelTone,
              genres,
              protagonistGender,
              coreConflict,
            }}
          />

          <div className="bg-surface/50 border border-border-subtle rounded p-2 text-fg-secondary">
            预览：{[
              genres.map((v) => GENRES.find((g) => g.value === v)?.label).filter(Boolean).join('+') || '(题材?)',
              audienceLabels[novelAudience],
              platform?.label,
              `${novelTotalWordsK}万 / ${novelTotalChapters}章`,
              NOVEL_POVS.find((o) => o.value === novelPov)?.label,
              NOVEL_TONES.find((o) => o.value === novelTone)?.label,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-3 border-t border-border-subtle">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" disabled={!canSave} onClick={handleSave}>
            保存设定
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-fg-secondary mb-1">{label}</div>
      {children}
    </div>
  );
}
