import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play, Square, Check, Pencil, RotateCcw, Stethoscope, Copy, AlertTriangle,
  CheckCircle2, Loader2, FileText, ChevronRight, Crown, Gavel, BookCopy,
  Box, Download, ArrowRight,
} from 'lucide-react';
import { ManualInjectDialog } from '../components/ManualInjectDialog';
import { SCREENPLAY_FINAL_NORMALIZE } from '../components/normalizePresets';
import clsx from 'clsx';
import { confirm as confirmDialog } from '../store/confirm';
import { loadManifest } from '../pipeline/manifest';
import { runStep } from '../pipeline/runner';
import { runTargetedSelfCheck, type SelfCheckReport } from '../pipeline/selfCheck';
import { SelfCheckPanel } from '../components/SelfCheckPanel';
import { ArtifactScoreCardSlot } from '../components/ArtifactScoreCardSlot';
import { computeStepConstraints, type Constraint } from '../pipeline/constraints';
import {
  R1_NODE_ID, R9_NODE_ID, runR1Directive, runR9Verdict, parseR9,
} from '../pipeline/editorial';
import { S0_NODE_ID } from '../pipeline/intake';
import type { ArtifactMap, Manifest, ManifestStep, NodeArtifact, NodeStatus, StageId } from '../pipeline/types';
import { useSettings, type SettingsState } from '../store/settings';
import { useProject } from '../store/project';
import { MarkdownView } from '../components/MarkdownView';
import { toast } from '../store/toast';

interface ScreenplayProps {
  stageId?: StageId;       // 'screenplay' | 'adapt'
  totalSteps?: number;     // 8 for screenplay, 6 for adapt
  title?: string;          // header title
  subtitle?: string;
  stepLabel?: string;      // 'S' | 'A'
}

export function Screenplay(props: ScreenplayProps = {}) {
  const stageId: StageId = props.stageId ?? 'screenplay';
  const totalSteps = props.totalSteps ?? 8;
  const stepLabel = props.stepLabel ?? 'S';
  const isAdapt = stageId === 'adapt';
  const settings = useSettings();
  const project = useProject();
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState('');
  const [activeIdx, setActiveIdx] = useState(1);
  const [injectOpen, setInjectOpen] = useState(false);

  // 把当前阶段最终剧本镜像写入 screenplay.7（让资产/分镜阶段能直接消费）
  function mirrorFinalScreenplayToS7(): boolean {
    const sourceNodeId = isAdapt ? 'adapt.6' : 'screenplay.7';
    const sourceArt = project.artifacts[sourceNodeId];
    if (!sourceArt?.content?.trim()) return false;
    if (sourceNodeId === 'screenplay.7') return true; // already canonical
    project.upsertArtifact({
      nodeId: 'screenplay.7',
      stageId: 'screenplay',
      index: 7,
      title: '最终剧本（镜像自改编 A6）',
      format: 'markdown',
      content: sourceArt.content,
      ts: Date.now(),
      tokens: 0,
      cost: 0,
      durationMs: 0,
      meta: { mirroredFrom: sourceNodeId, source: '改编最终稿镜像' },
    });
    return true;
  }

  function exportToAssets() {
    const ok = mirrorFinalScreenplayToS7();
    if (!ok) {
      toast.warning('当前阶段尚未生成最终剧本（' + (isAdapt ? 'adapt.6' : 'screenplay.7') + '），无法导出。');
      return;
    }
    navigate('/assets');
  }

  // per-node ephemeral state
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string | null>>({}); // nodeId → draft (or null = view)
  // doctor report 现在存于 artifact.meta.selfCheck（与 Pipeline 页一致）；
  // 本地只保留 busy 状态用于 Action bar “自检”按钮的 spinner。
  const [doctorBusy, setDoctorBusy] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const [chainBusy, setChainBusy] = useState(false);

  useEffect(() => {
    loadManifest().then(setManifest).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const steps = useMemo<ManifestStep[]>(() => {
    return manifest?.stages.find((s) => s.id === stageId)?.steps ?? [];
  }, [manifest, stageId]);
  const activeStep = steps.find((s) => s.index === activeIdx);

  function setStatus(id: string, st: NodeStatus) {
    setStatuses((s) => ({ ...s, [id]: st }));
  }

  async function runOne(step: ManifestStep) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus(step.id, 'running');
    setStreaming((s) => ({ ...s, [step.id]: '' }));
    setErrors((e) => { const n = { ...e }; delete n[step.id]; return n; });
    try {
      const a = await runStep({
        stageId, step,
        project: project.ctx,
        artifacts: project.artifacts,
        settings,
        signal: ctrl.signal,
        onDelta: (_, full) => setStreaming((s) => ({ ...s, [step.id]: full })),
      });
      project.upsertArtifact(a);
      project.invalidateFrom(stageId, step.index + 1);
      setStatus(step.id, 'done');
      return a;
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setStatus(step.id, 'aborted');
        setErrors((er) => ({ ...er, [step.id]: '已中止' }));
      } else {
        setStatus(step.id, 'error');
        setErrors((er) => ({ ...er, [step.id]: e.message ?? String(e) }));
      }
      throw e;
    }
  }

  async function runFrom(fromIndex: number) {
    if (!manifest || chainBusy) return;
    const isAdaptation = project.ctx.createMode === 'adaptation';
    // 改编模式必须先有 S0
    if (isAdaptation && !project.artifacts[S0_NODE_ID]) {
      toast.warning('改编模式需要先完成 S0 原作档案 (Intake 页)。点顶部「去原作摄入」。');
      return;
    }
    setChainBusy(true);
    try {
      // R1 (only if editorial rounds enabled, fromIndex<=0, and missing)
      if (settings.enableEditorialRounds && fromIndex <= 0 && !project.artifacts[R1_NODE_ID]) {
        await runR1();
      }
      const list = steps.filter((s) => s.index >= Math.max(1, fromIndex));
      for (const s of list) {
        setActiveIdx(s.index);
        await runOne(s);
      }
      // R9 final verdict
      if (settings.enableEditorialRounds && fromIndex <= totalSteps) {
        await runR9();
      }
    } catch { /* node-level error already shown */ }
    finally { setChainBusy(false); }
  }

  async function runR1() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus(R1_NODE_ID, 'running');
    setStreaming((s) => ({ ...s, [R1_NODE_ID]: '' }));
    setErrors((e) => { const n = { ...e }; delete n[R1_NODE_ID]; return n; });
    setActiveIdx(0);
    try {
      const a = await runR1Directive({
        project: project.ctx,
        artifacts: project.artifacts,
        settings,
        signal: ctrl.signal,
        onDelta: (_, full) => setStreaming((s) => ({ ...s, [R1_NODE_ID]: full })),
      });
      project.upsertArtifact(a);
      // R1 changed → invalidate everything downstream
      project.invalidateFrom(stageId, 1);
      setStatus(R1_NODE_ID, 'done');
      return a;
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setStatus(R1_NODE_ID, 'aborted');
        setErrors((er) => ({ ...er, [R1_NODE_ID]: '已中止' }));
      } else {
        setStatus(R1_NODE_ID, 'error');
        setErrors((er) => ({ ...er, [R1_NODE_ID]: e.message ?? String(e) }));
      }
      throw e;
    }
  }

  async function runR9() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus(R9_NODE_ID, 'running');
    setStreaming((s) => ({ ...s, [R9_NODE_ID]: '' }));
    setErrors((e) => { const n = { ...e }; delete n[R9_NODE_ID]; return n; });
    setActiveIdx(totalSteps + 1);
    try {
      const a = await runR9Verdict({
        project: project.ctx,
        artifacts: project.artifacts,
        settings,
        signal: ctrl.signal,
        onDelta: (_, full) => setStreaming((s) => ({ ...s, [R9_NODE_ID]: full })),
      });
      project.upsertArtifact(a);
      setStatus(R9_NODE_ID, 'done');
      return a;
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setStatus(R9_NODE_ID, 'aborted');
        setErrors((er) => ({ ...er, [R9_NODE_ID]: '已中止' }));
      } else {
        setStatus(R9_NODE_ID, 'error');
        setErrors((er) => ({ ...er, [R9_NODE_ID]: e.message ?? String(e) }));
      }
      throw e;
    }
  }

  function stop() { abortRef.current?.abort(); }

  function pass(step: ManifestStep) {
    project.setPassed(step.id, true);
    if (settings.autoChain && step.index < totalSteps) {
      const next = steps.find((s) => s.index === step.index + 1);
      if (next && !project.artifacts[next.id]) {
        setActiveIdx(next.index);
        runOne(next).catch(() => {});
      } else if (next) {
        setActiveIdx(next.index);
      }
    }
  }

  function startEdit(step: ManifestStep) {
    const cur = project.artifacts[step.id]?.content ?? '';
    setEditing((e) => ({ ...e, [step.id]: cur }));
  }
  function cancelEdit(step: ManifestStep) {
    setEditing((e) => ({ ...e, [step.id]: null }));
  }
  function saveEdit(step: ManifestStep) {
    const draft = editing[step.id];
    if (draft == null) return;
    project.overrideArtifactContent(step.id, draft);
    project.invalidateFrom(stageId, step.index + 1);
    project.setPassed(step.id, false);
    setEditing((e) => ({ ...e, [step.id]: null }));
  }

  async function rerun(step: ManifestStep) {
    project.clearArtifact(step.id);
    project.invalidateFrom(stageId, step.index + 1);
    setActiveIdx(step.index);
    await runOne(step).catch(() => {});
  }

  async function selfCheck(step: ManifestStep) {
    if (!manifest) return;
    const artifact = project.artifacts[step.id];
    if (!artifact) return;
    setDoctorBusy((b) => ({ ...b, [step.id]: true }));
    try {
      const res = await runTargetedSelfCheck({ artifact, settings });
      // 写入 artifact.meta.selfCheck（与 Pipeline 一致），SelfCheckPanel 可直接读取并提供修复闭环。
      const nextMeta = { ...(artifact.meta ?? {}), selfCheck: res.report ?? undefined };
      project.upsertArtifact({ ...artifact, meta: nextMeta });
    } catch (e: any) {
      setErrors((er) => ({ ...er, [step.id]: '自检失败：' + (e.message ?? e) }));
    } finally {
      setDoctorBusy((b) => ({ ...b, [step.id]: false }));
    }
  }

  if (error) {
    return (
      <div className="m-6 card border-warning/40 bg-warning/5 p-4 text-sm">
        <strong className="text-warning flex items-center gap-1.5">
          <AlertTriangle className="size-4" /> 加载 manifest 失败
        </strong>
        <p className="text-fg-secondary mt-1">{error}</p>
      </div>
    );
  }
  if (!manifest || !activeStep) return <div className="p-8 text-fg-muted">加载…</div>;

  // 改编模式下检测旧 8 步产物（迁移残留）
  const legacyScreenplayCount = isAdapt
    ? Object.keys(project.artifacts).filter((k) => /^screenplay\.\d+$/.test(k)).length
    : 0;

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border-subtle flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="size-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold">{props.title ?? '剧本工作台 · 八步法'}</h1>
            <p className="text-xs text-fg-muted">
              {props.subtitle ?? '单步 / 通过 / 修改 / 重跑 / 自检 · 修改任一步会自动把下游标记为 stale'}
            </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {chainBusy ? (
          <button className="btn-outline" onClick={stop}><Square className="size-4" /> 停止</button>
        ) : (
          <>
            <button
              className="btn-outline"
              onClick={() => setInjectOpen(true)}
              title="跳过流水线，直接粘贴外部剧本作为 screenplay.7"
            >
              <Download className="size-4" /> 导入剧本
            </button>
            {(project.artifacts['screenplay.7'] || (isAdapt && project.artifacts['adapt.6'])) && (
              <button
                className="btn-outline"
                onClick={exportToAssets}
                title="把当前最终剧本镜像到 screenplay.7 并跳转到资产工作台"
              >
                <Box className="size-4" /> 进入资产阶段 <ArrowRight className="size-3" />
              </button>
            )}
            <button className="btn-primary" onClick={() => runFrom(0)}>
              <Play className="size-4" />
              {settings.enableEditorialRounds
                ? `一键全跑（R1→${stepLabel}1..${totalSteps}→R9）`
                : '一键全跑'}
            </button>
          </>
        )}
      </div>
    </header>

      {/* Legacy screenplay.* artifacts banner (adapt mode only) */}
      {legacyScreenplayCount > 0 && (
        <section className="px-6 py-2 border-b border-border-subtle bg-warning/5 flex items-center gap-3 text-xs">
          <AlertTriangle className="size-4 text-warning" />
          <span className="text-warning">
            检测到旧的 8 步产物 <strong className="font-mono">{legacyScreenplayCount}</strong> 条（来自旧版改编流程，不会被新工作台使用）
          </span>
          <button
            className="btn-outline text-xs ml-auto"
            onClick={async () => {
              const ok = await confirmDialog({
                title: `清理 ${legacyScreenplayCount} 条遗留 screenplay.* 产物？`,
                message: '不影响 S0 原作档案、R1\' 改编指令书、R9\' 总编裁决 · 也不影响新的 A1..A6 产物。',
                confirmLabel: '清理',
                danger: true,
              });
              if (!ok) return;
              // 仅清 screenplay.{1..8}，保留 screenplay.r1 / screenplay.r9
              for (const k of Object.keys(project.artifacts)) {
                if (/^screenplay\.\d+$/.test(k)) project.clearArtifact(k);
              }
            }}
          >
            <RotateCcw className="size-3.5" /> 清理遗留产物
          </button>
        </section>
      )}

      {/* Project ctx mini-bar */}
      <section className="px-6 py-2 border-b border-border-subtle flex items-center gap-3 text-xs text-fg-secondary">
        <span><span className="text-fg-muted">项目：</span>{project.ctx.name}</span>
        <span className="text-fg-muted">·</span>
        <span><span className="text-fg-muted">概念：</span>{project.ctx.concept}</span>
        <span className="text-fg-muted">·</span>
        <span><span className="text-fg-muted">时长：</span>{project.ctx.durationMin} 分钟</span>
        <span className="ml-auto text-fg-muted">在「流水线」页可修改项目上下文</span>
      </section>

      {/* DAG strip */}
      <nav className="px-6 py-3 border-b border-border-subtle overflow-x-auto">
        <ol className="flex items-center gap-1 min-w-max">
          {project.ctx.createMode === 'adaptation' && (
            <>
              <li className="flex items-center">
                <Link to="/intake"
                      className={clsx(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                        'text-fg-secondary hover:bg-surface',
                      )}
                      title="去原作摄入工作台编辑">
                  <span className={clsx('size-2 rounded-full',
                    project.artifacts[S0_NODE_ID] ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <BookCopy className="size-3 text-warning" />
                  <span className="font-mono">S0</span>
                  <span className="hidden md:inline">原作档案</span>
                </Link>
              </li>
              <ChevronRight className="size-3 text-fg-muted mx-0.5" />
            </>
          )}
          {settings.enableEditorialRounds && (
            <>
              <DagPill
                label={project.ctx.createMode === 'adaptation' ? "R1'" : 'R1'}
                longLabel={project.ctx.createMode === 'adaptation' ? '改编指令书' : '创作指令书'}
                icon={<Crown className="size-3" />}
                isActive={activeIdx === 0}
                hasArtifact={!!project.artifacts[R1_NODE_ID]}
                stale={!!project.stale[R1_NODE_ID]}
                status={statuses[R1_NODE_ID]}
                onClick={() => setActiveIdx(0)}
              />
              <ChevronRight className="size-3 text-fg-muted mx-0.5" />
            </>
          )}
          {steps.map((s, i) => {
            const isActive = s.index === activeIdx;
            const a = project.artifacts[s.id];
            const passed = project.passed[s.id];
            const stale = project.stale[s.id];
            const stt = statuses[s.id];
            const dotColor =
              stt === 'running' ? 'bg-primary-500 animate-pulse' :
              stt === 'error' ? 'bg-rose-500' :
              passed ? 'bg-emerald-500' :
              a && stale ? 'bg-amber-500' :
              a ? 'bg-sky-500' :
              'bg-neutral-700';
            return (
              <li key={s.id} className="flex items-center">
                <button
                  onClick={() => setActiveIdx(s.index)}
                  className={clsx(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors',
                    isActive ? 'bg-elevated text-fg-primary ring-1 ring-primary-500/40' : 'text-fg-secondary hover:bg-surface',
                  )}
                  title={s.title}
                >
                  <span className={clsx('size-2 rounded-full', dotColor)} />
                  <span className="font-mono">{stepLabel}{s.index}</span>
                  <span className="hidden md:inline">{s.title}</span>
                </button>
                {(i < steps.length - 1 || settings.enableEditorialRounds) && <ChevronRight className="size-3 text-fg-muted mx-0.5" />}
              </li>
            );
          })}
          {settings.enableEditorialRounds && (
            <DagPill
              label={isAdapt ? "R9'" : 'R9'} longLabel="总编裁决" icon={<Gavel className="size-3" />}
              isActive={activeIdx === totalSteps + 1}
              hasArtifact={!!project.artifacts[R9_NODE_ID]}
              stale={!!project.stale[R9_NODE_ID]}
              status={statuses[R9_NODE_ID]}
              onClick={() => setActiveIdx(totalSteps + 1)}
            />
          )}
        </ol>
      </nav>

      <main className="flex-1 overflow-auto px-6 py-5">
        {activeIdx === 0 ? (
          <R1Pane
            artifact={project.artifacts[R1_NODE_ID]}
            status={statuses[R1_NODE_ID] ?? (project.artifacts[R1_NODE_ID] ? 'done' : 'idle')}
            streamingText={streaming[R1_NODE_ID]}
            err={errors[R1_NODE_ID]}
            chainBusy={chainBusy}
            onRun={() => runR1().catch(() => {})}
            onClear={() => { project.clearArtifact(R1_NODE_ID); project.invalidateFrom(stageId, 1); }}
          />
        ) : activeIdx === totalSteps + 1 ? (
          <R9Pane
            artifact={project.artifacts[R9_NODE_ID]}
            status={statuses[R9_NODE_ID] ?? (project.artifacts[R9_NODE_ID] ? 'done' : 'idle')}
            streamingText={streaming[R9_NODE_ID]}
            err={errors[R9_NODE_ID]}
            chainBusy={chainBusy}
            onRun={() => runR9().catch(() => {})}
            onClear={() => project.clearArtifact(R9_NODE_ID)}
            jumpToStep={(idx) => setActiveIdx(idx)}
          />
        ) : activeStep ? (
          <StepPane
            key={activeStep.id}
            step={activeStep}
            artifact={project.artifacts[activeStep.id]}
            status={statuses[activeStep.id] ?? (project.artifacts[activeStep.id] ? 'done' : 'idle')}
            stale={!!project.stale[activeStep.id]}
            passed={!!project.passed[activeStep.id]}
            streamingText={streaming[activeStep.id]}
            err={errors[activeStep.id]}
            chainBusy={chainBusy}
            stepLabel={stepLabel}
            totalSteps={totalSteps}
            editing={editing[activeStep.id] ?? null}
            report={(project.artifacts[activeStep.id]?.meta as any)?.selfCheck as SelfCheckReport | undefined}
            doctorBusy={!!doctorBusy[activeStep.id]}
            allArtifacts={project.artifacts}
            settings={settings}
            onSelfCheckUpdate={(report) => {
              const a = project.artifacts[activeStep.id];
              if (!a) return;
              const nextMeta = { ...(a.meta ?? {}), selfCheck: report ?? undefined };
              project.upsertArtifact({ ...a, meta: nextMeta });
            }}
            onArtifactPatch={(content) => {
              const a = project.artifacts[activeStep.id];
              if (!a) return;
              project.upsertArtifact({ ...a, content });
              project.invalidateFrom(stageId, activeStep.index + 1);
              project.setPassed(activeStep.id, false);
            }}
            durationMin={project.ctx.durationMin}
            onRun={() => runOne(activeStep).catch(() => {})}
            onRunFrom={() => runFrom(activeStep.index)}
            onPass={() => pass(activeStep)}
            onUnpass={() => project.setPassed(activeStep.id, false)}
            onEditStart={() => startEdit(activeStep)}
            onEditCancel={() => cancelEdit(activeStep)}
            onEditSave={() => saveEdit(activeStep)}
            onEditChange={(v) => setEditing((e) => ({ ...e, [activeStep.id]: v }))}
            onRerun={() => rerun(activeStep)}
            onSelfCheck={() => selfCheck(activeStep)}
          />
        ) : null}
      </main>

      <ManualInjectDialog
        open={injectOpen}
        title="导入外部剧本到 screenplay.7"
        description="跳过流水线，直接粘贴一份完整剧本作为最终稿。下游资产/分镜阶段会消费它。"
        fields={[{
          nodeId: 'screenplay.7',
          stageId: 'screenplay',
          index: 7,
          label: '最终剧本',
          format: 'markdown',
          placeholder: '粘贴完整剧本（含场次、对白、动作）；小说原文也行，点 ✨ 让 AI 改写为剧本格式…',
          hint: '建议至少 500 字。粘贴非剧本格式时点「✨ AI 修复格式」自动转换。',
          validate: (t) => t.length < 100 ? '剧本过短（< 100 字）' : null,
          normalize: SCREENPLAY_FINAL_NORMALIZE,
          doctor: true,
        }]}
        existing={{ 'screenplay.7': project.artifacts['screenplay.7'] }}
        onCancel={() => setInjectOpen(false)}
        onSubmit={(arts) => {
          for (const a of arts) project.upsertArtifact(a);
          setInjectOpen(false);
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

interface StepPaneProps {
  step: ManifestStep;
  artifact?: NodeArtifact;
  status: NodeStatus;
  stale: boolean;
  passed: boolean;
  streamingText?: string;
  err?: string;
  chainBusy: boolean;
  stepLabel?: string;
  totalSteps?: number;
  editing: string | null;
  report?: SelfCheckReport;
  doctorBusy: boolean;
  allArtifacts: ArtifactMap;
  settings: SettingsState;
  onSelfCheckUpdate: (report: SelfCheckReport | null) => void;
  onArtifactPatch: (newContent: string) => void;
  durationMin: number;
  onRun: () => void;
  onRunFrom: () => void;
  onPass: () => void;
  onUnpass: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onEditChange: (v: string) => void;
  onRerun: () => void;
  onSelfCheck: () => void;
}

function StepPane(p: StepPaneProps) {
  const isRunning = p.status === 'running';
  const display = isRunning ? (p.streamingText ?? '') : (p.artifact?.content ?? '');
  const stepLabel = p.stepLabel ?? 'S';
  const totalSteps = p.totalSteps ?? 8;
  const isAdapt = p.step.id.startsWith('adapt.');
  const constraints = !isAdapt && p.artifact
    ? computeStepConstraints(p.step.index, p.artifact, p.durationMin)
    : [];
  const isJson = p.step.outFormat === 'json';
  const isEditing = p.editing != null;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xl font-semibold text-fg-primary truncate">
            <span className="font-mono text-primary-500 mr-2">{stepLabel}{p.step.index}</span>
            {p.step.title}
          </h2>
          {p.passed && <Badge tone="emerald">已通过</Badge>}
          {p.stale && <Badge tone="amber">上游已变更 · 待重跑</Badge>}
          {p.status === 'error' && <Badge tone="rose">错误</Badge>}
          {p.status === 'aborted' && <Badge tone="amber">已中止</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          {isRunning ? null : !p.artifact ? (
            <button className="btn-primary" onClick={p.onRun} disabled={p.chainBusy}>
              <Play className="size-4" /> 运行此步
            </button>
          ) : (
            <>
              {!p.passed ? (
                <button className="btn-primary" onClick={p.onPass} disabled={p.chainBusy || isEditing}
                        title="标记通过；若开启自动级联则自动跑下一步">
                  <Check className="size-4" /> 通过
                </button>
              ) : (
                <button className="btn-outline" onClick={p.onUnpass} disabled={p.chainBusy}>
                  撤销通过
                </button>
              )}
              {!isEditing ? (
                <button className="btn-outline" onClick={p.onEditStart} disabled={p.chainBusy}>
                  <Pencil className="size-4" /> 修改
                </button>
              ) : (
                <>
                  <button className="btn-primary" onClick={p.onEditSave}>保存</button>
                  <button className="btn-outline" onClick={p.onEditCancel}>取消</button>
                </>
              )}
              <button className="btn-outline" onClick={p.onRerun} disabled={p.chainBusy || isEditing}>
                <RotateCcw className="size-4" /> 重跑
              </button>
              <button className="btn-outline" onClick={p.onSelfCheck} disabled={p.doctorBusy || isEditing}>
                {p.doctorBusy
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Stethoscope className="size-4" />}
                自检
              </button>
              <button className="btn-outline" onClick={p.onRunFrom} disabled={p.chainBusy || isEditing}>
                <Play className="size-4" /> 从此跑到 {stepLabel}{totalSteps}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Constraints chips */}
      {constraints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {constraints.map((c) => <ConstraintChip key={c.label} c={c} />)}
        </div>
      )}

      {/* Error */}
      {p.err && (
        <div className="card border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          {p.err}
        </div>
      )}

      {/* AI 综合评分（6 维 / 加权 / sparkline） */}
      {p.artifact && (
        <ArtifactScoreCardSlot artifact={p.artifact} />
      )}

      {/* Self-check verdict + 一键修改闭环 */}
      {p.artifact && (
        <SelfCheckPanel
          artifact={p.artifact}
          settings={p.settings}
          contextArtifacts={p.allArtifacts}
          report={p.report}
          onReportUpdate={p.onSelfCheckUpdate}
          onArtifactPatch={p.onArtifactPatch}
        />
      )}

      {/* Output / Editor */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
          <span className="label">
            {isEditing ? '编辑产物（保存后下游会标记 stale）'
                       : isRunning ? '流式输出中…'
                       : p.artifact ? '产物'
                       : '空'}
          </span>
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            {p.artifact && !isEditing && (
              <>
                <span>{p.artifact.content.length} 字</span>
                <span>{Math.round(p.artifact.durationMs)}ms</span>
                {p.artifact.tokens != null && <span>tokens {p.artifact.tokens}</span>}
                {p.artifact.cost != null && <span>≈ ¥{p.artifact.cost.toFixed(4)}</span>}
                <button className="btn-ghost px-1.5 py-1"
                        onClick={() => navigator.clipboard.writeText(p.artifact!.content)} title="复制">
                  <Copy className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <textarea
            className="w-full h-[60vh] bg-canvas p-4 text-sm font-mono resize-none focus:outline-none"
            value={p.editing ?? ''}
            onChange={(e) => p.onEditChange(e.target.value)}
          />
        ) : isRunning ? (
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words text-fg-primary max-h-[60vh] overflow-auto">
            {display || <span className="text-fg-muted">连接中…</span>}
          </pre>
        ) : !p.artifact ? (
          <div className="p-10 text-center text-sm text-fg-muted">
            还没运行过本步。点 <strong className="text-fg-secondary">运行此步</strong> 开始。
          </div>
        ) : isJson ? (
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words text-fg-primary max-h-[60vh] overflow-auto">
            {tryPrettyJson(p.artifact.content)}
          </pre>
        ) : (
          <div className="p-5 max-h-[60vh] overflow-auto">
            <MarkdownView content={p.artifact.content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function Badge({ tone, children }: { tone: 'emerald' | 'amber' | 'rose' | 'sky'; children: React.ReactNode }) {
  const map = {
    emerald: 'bg-success/15 text-success border-success/30',
    amber:   'bg-warning/15 text-warning border-warning/30',
    rose:    'bg-danger/15 text-danger border-danger/30',
    sky:     'bg-sky-500/15 text-sky-300 border-sky-500/30',
  };
  return <span className={clsx('px-2 py-0.5 rounded-full text-tight-sm border', map[tone])}>{children}</span>;
}

function ConstraintChip({ c }: { c: Constraint }) {
  const range =
    c.min != null && c.max != null && c.min === c.max ? `=${c.min}` :
    c.min != null && c.max != null ? `${c.min}–${c.max}` :
    c.min != null ? `≥${c.min}` :
    c.max != null ? `≤${c.max}` : '';
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
      c.ok
        ? 'border-success/30 bg-success/5 text-success'
        : 'border-warning/40 bg-warning/5 text-warning',
    )}>
      {c.ok ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
      <span className="text-fg-secondary">{c.label}</span>
      <span className="font-mono">{c.actual}{c.unit ?? ''}</span>
      {range && <span className="text-fg-muted">/ {range}{c.unit ?? ''}</span>}
    </span>
  );
}

function tryPrettyJson(s: string): string {
  try {
    const stripped = s.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    return JSON.stringify(JSON.parse(stripped), null, 2);
  } catch { return s; }
}

// ----------------------------------------------------------------------------
// R1 / R9 dag-pill + panes

interface DagPillProps {
  label: string;
  longLabel: string;
  icon: React.ReactNode;
  isActive: boolean;
  hasArtifact: boolean;
  stale: boolean;
  status?: NodeStatus;
  onClick: () => void;
}
function DagPill(p: DagPillProps) {
  const dotColor =
    p.status === 'running' ? 'bg-primary-500 animate-pulse' :
    p.status === 'error' ? 'bg-rose-500' :
    p.hasArtifact && !p.stale ? 'bg-emerald-500' :
    p.hasArtifact && p.stale ? 'bg-amber-500' :
    'bg-neutral-700';
  return (
    <li className="flex items-center">
      <button
        onClick={p.onClick}
        className={clsx(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
          p.isActive
            ? 'bg-elevated text-fg-primary ring-1 ring-amber-500/40'
            : 'text-fg-secondary hover:bg-surface',
        )}
        title={p.longLabel}
      >
        <span className={clsx('size-2 rounded-full', dotColor)} />
        <span className="text-warning">{p.icon}</span>
        <span className="font-mono">{p.label}</span>
        <span className="hidden md:inline">{p.longLabel}</span>
      </button>
    </li>
  );
}

interface R1PaneProps {
  artifact?: NodeArtifact;
  status: NodeStatus;
  streamingText?: string;
  err?: string;
  chainBusy: boolean;
  onRun: () => void;
  onClear: () => void;
}
function R1Pane(p: R1PaneProps) {
  const isRunning = p.status === 'running';
  const display = isRunning ? (p.streamingText ?? '') : (p.artifact?.content ?? '');
  let parsed: any = null;
  if (p.artifact && !isRunning) {
    try { parsed = JSON.parse(p.artifact.content); } catch {}
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Crown className="size-5 text-warning" />
          <h2 className="text-xl font-semibold text-fg-primary truncate">
            <span className="font-mono text-warning mr-2">R1</span> 创作指令书
          </h2>
          {p.artifact && <Badge tone="emerald">已锁定</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          {!isRunning && (
            <>
              <button className="btn-primary" onClick={p.onRun} disabled={p.chainBusy}>
                <Play className="size-4" /> {p.artifact ? '重新生成' : '生成指令书'}
              </button>
              {p.artifact && (
                <button className="btn-outline" onClick={p.onClear} disabled={p.chainBusy}>
                  <RotateCcw className="size-4" /> 清除
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-fg-muted">
        总编 (R1) 在 Step 1 之前锁定项目战略 — 主题 / 受众 / 题材 / 一句话钩子 / 红线 — 作为<strong className="text-fg-secondary">下游 8 步全部 LLM 调用的共享 system 头</strong>。
        修改 / 重生成会自动把 S1..S8 标记为 stale。
      </p>

      {p.err && (
        <div className="card border-danger/40 bg-danger/5 p-3 text-sm text-danger">{p.err}</div>
      )}

      {parsed ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DirectiveCard label="主题锚定" value={parsed.themeAnchor} highlight />
          <DirectiveCard label="一句话钩子" value={parsed.positioningHook} highlight />
          <DirectiveCard label="受众画像" value={parsed.audienceProfile} />
          <DirectiveCard label="题材策略" value={parsed.genreStrategy} />
          <DirectiveCard label="节拍策略" value={parsed.beatStrategy} />
          <DirectiveCard label="rationale" value={parsed.rationale} />
          {parsed.adaptationStrategy && (
            <DirectiveCard label="改编策略" value={parsed.adaptationStrategy} highlight />
          )}
          {Array.isArray(parsed.mustKeep) && parsed.mustKeep.length > 0 && (
            <div className="md:col-span-2 card p-4 ring-1 ring-emerald-500/30">
              <div className="label mb-2 text-success">必须保留 (mustKeep)</div>
              <ul className="text-sm space-y-1">
                {parsed.mustKeep.map((d: string, i: number) => (
                  <li key={i} className="flex gap-2 text-fg-secondary">
                    <span className="text-success">✓</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(parsed.mustCut) && parsed.mustCut.length > 0 && (
            <div className="md:col-span-2 card p-4">
              <div className="label mb-2 text-warning">必须裁掉 (mustCut)</div>
              <ul className="text-sm space-y-1">
                {parsed.mustCut.map((d: string, i: number) => (
                  <li key={i} className="flex gap-2 text-fg-secondary">
                    <span className="text-warning">✂</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(parsed.riskList) && parsed.riskList.length > 0 && (
            <div className="md:col-span-2 card p-4 ring-1 ring-rose-500/30">
              <div className="label mb-2 text-danger">改编风险 (riskList)</div>
              <ul className="text-sm space-y-1.5">
                {parsed.riskList.map((r: any, i: number) => (
                  <li key={i} className="text-fg-secondary">
                    <span className="px-1 py-0.5 rounded text-tight-xs bg-danger/15 text-danger border border-danger/30 mr-1.5">
                      {r.kind}
                    </span>
                    {r.issue}
                    {r.mitigation && <div className="text-xs text-fg-muted ml-6">→ {r.mitigation}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(parsed.doNots) && parsed.doNots.length > 0 && (
            <div className="md:col-span-2 card p-4">
              <div className="label mb-2 text-danger">红线 doNots</div>
              <ul className="text-sm space-y-1">
                {parsed.doNots.map((d: string, i: number) => (
                  <li key={i} className="flex gap-2 text-fg-secondary">
                    <span className="text-danger">⛔</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="label">{isRunning ? '流式输出中…' : p.artifact ? '原始 JSON' : '空'}</span>
            {p.artifact && !isRunning && (
              <button className="btn-ghost px-1.5 py-1"
                      onClick={() => navigator.clipboard.writeText(p.artifact!.content)}>
                <Copy className="size-3.5" />
              </button>
            )}
          </div>
          <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono text-fg-primary max-h-[60vh] overflow-auto">
            {display || (isRunning ? '连接中…' : '尚未生成。点上方「生成指令书」开始。')}
          </pre>
        </div>
      )}
    </div>
  );
}

function DirectiveCard({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className={clsx('card p-3', highlight && 'ring-1 ring-amber-500/30')}>
      <div className="label mb-1">{label}</div>
      <div className={clsx('text-sm', highlight ? 'text-warning font-medium' : 'text-fg-secondary')}>{value}</div>
    </div>
  );
}

interface R9PaneProps {
  artifact?: NodeArtifact;
  status: NodeStatus;
  streamingText?: string;
  err?: string;
  chainBusy: boolean;
  onRun: () => void;
  onClear: () => void;
  jumpToStep: (idx: number) => void;
}
function R9Pane(p: R9PaneProps) {
  const isRunning = p.status === 'running';
  const display = isRunning ? (p.streamingText ?? '') : (p.artifact?.content ?? '');
  const verdict = p.artifact && !isRunning ? parseR9(p.artifact.content) : null;
  const verdictTone = verdict?.verdict === 'APPROVED' ? 'emerald'
                    : verdict?.verdict === 'REVISION_MINOR' ? 'sky'
                    : verdict?.verdict === 'REVISION_MAJOR' ? 'amber'
                    : verdict?.verdict === 'REJECTED' ? 'rose'
                    : 'sky';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Gavel className="size-5 text-warning" />
          <h2 className="text-xl font-semibold text-fg-primary truncate">
            <span className="font-mono text-warning mr-2">R9</span> 总编四级裁决
          </h2>
          {verdict && <Badge tone={verdictTone}>{verdict.verdict}</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          {!isRunning && (
            <>
              <button className="btn-primary" onClick={p.onRun} disabled={p.chainBusy}>
                <Play className="size-4" /> {p.artifact ? '重新裁决' : '生成裁决'}
              </button>
              {p.artifact && (
                <button className="btn-outline" onClick={p.onClear} disabled={p.chainBusy}>
                  <RotateCcw className="size-4" /> 清除
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-fg-muted">
        终审从<strong className="text-fg-secondary">主题 / 受众 / 商业 / 与 R1 指令书一致度</strong> 4 个维度评估，输出 APPROVED / MINOR / MAJOR / REJECTED 四级裁决。
      </p>

      {p.err && (
        <div className="card border-danger/40 bg-danger/5 p-3 text-sm text-danger">{p.err}</div>
      )}

      {verdict ? (
        <>
          <div className={clsx(
            'grid gap-3',
            verdict.isAdaptation ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4',
          )}>
            <ScoreCard label="主题一致" v={verdict.scores.theme} />
            <ScoreCard label="受众契合" v={verdict.scores.audience} />
            <ScoreCard label="商业潜力" v={verdict.scores.marketability} />
            <ScoreCard label="指令书对齐" v={verdict.scores.directive} />
            {verdict.isAdaptation && (
              <>
                <ScoreCard label="原作忠实度" v={verdict.scores.fidelity} />
                <ScoreCard label="再创作灵气" v={verdict.scores.originality} />
              </>
            )}
          </div>
          {verdict.ipRiskCheck && (
            <div className={clsx('card p-3 flex items-center gap-3',
              verdict.ipRiskCheck === 'PASS' ? 'border-success/30 bg-success/5'
              : verdict.ipRiskCheck === 'WARN' ? 'border-warning/30 bg-warning/5'
              : 'border-danger/40 bg-danger/10',
            )}>
              <span className="text-xs text-fg-secondary">IP 风险审查:</span>
              <Badge tone={verdict.ipRiskCheck === 'PASS' ? 'emerald' : verdict.ipRiskCheck === 'WARN' ? 'amber' : 'rose'}>
                {verdict.ipRiskCheck}
              </Badge>
            </div>
          )}
          {verdict.recommendation && (
            <div className="card p-4">
              <div className="label mb-1 text-warning">总编建议</div>
              <p className="text-sm text-fg-primary">{verdict.recommendation}</p>
            </div>
          )}
          {verdict.criticalIssues.length > 0 && (
            <div className="card p-4">
              <div className="label mb-2 text-danger">关键问题（{verdict.criticalIssues.length}）</div>
              <ul className="space-y-2">
                {verdict.criticalIssues.map((it, i) => (
                  <li key={i} className="border-l-2 border-danger/40 pl-3">
                    <div className="flex items-center gap-2 text-xs">
                      {it.stepRef != null && (
                        <button className="btn-ghost text-xs px-1.5 py-0.5"
                                onClick={() => p.jumpToStep(it.stepRef!)}>
                          → {it.stepLabel ?? `Step ${it.stepRef}`}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-fg-primary mt-1">{it.issue}</p>
                    {it.suggestion && (
                      <p className="text-xs text-fg-muted mt-1">建议：{it.suggestion}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
            <span className="label">{isRunning ? '流式输出中…' : p.artifact ? '原始 JSON' : '空'}</span>
            {p.artifact && !isRunning && (
              <button className="btn-ghost px-1.5 py-1"
                      onClick={() => navigator.clipboard.writeText(p.artifact!.content)}>
                <Copy className="size-3.5" />
              </button>
            )}
          </div>
          <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono text-fg-primary max-h-[60vh] overflow-auto">
            {display || (isRunning ? '连接中…' : '尚未生成。点上方「生成裁决」开始。')}
          </pre>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Adapt 通道（改编 6 步）— 复用 Screenplay 组件，仅参数化
export function Adapt() {
  return (
    <Screenplay
      stageId="adapt"
      totalSteps={6}
      stepLabel="A"
      title="改编工作台 · 6 步"
      subtitle="基于 S0 原作档案 + R1' 改编指令书 · 砍掉破题/前史世界观，专注改编决策"
    />
  );
}

function ScoreCard({ label, v }: { label: string; v?: number }) {
  const score = v ?? 0;
  const tone = score >= 8 ? 'emerald' : score >= 6 ? 'sky' : score >= 4 ? 'amber' : 'rose';
  const colorMap = {
    emerald: 'text-success',
    sky: 'text-sky-400',
    amber: 'text-warning',
    rose: 'text-danger',
  } as const;
  return (
    <div className="card p-3 text-center">
      <div className="label">{label}</div>
      <div className={clsx('text-3xl font-bold mt-1', colorMap[tone])}>{score}</div>
      <div className="text-tight-xs text-fg-muted">/ 10</div>
    </div>
  );
}
