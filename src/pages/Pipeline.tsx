import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  Play, Square, RotateCcw, ChevronDown, ChevronRight, Trash2, Copy, AlertTriangle,
  CheckCircle2, Circle, Loader2, FastForward, Download,
} from 'lucide-react';
import { loadManifest } from '../pipeline/manifest';
import { runStep, runStoryboardPhase2Loop } from '../pipeline/runner';
import type {
  ArtifactMap, Manifest, ManifestStep, NodeArtifact, NodeStatus, StageId,
} from '../pipeline/types';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import { ManualInjectDialog, type InjectField } from '../components/ManualInjectDialog';
import {
  SCREENPLAY_FINAL_NORMALIZE,
  ASSETS_LIST_NORMALIZE,
} from '../components/normalizePresets';
import { StoryboardPlanDiagnostics } from '../components/StoryboardPlanDiagnostics';
import { SelfCheckPanel } from '../components/SelfCheckPanel';
import { ConsistencyPanel } from '../components/ConsistencyPanel';
import { RunHistoryPanel } from '../components/RunHistoryPanel';
import { ArtifactStructuredView } from '../components/ArtifactStructuredView';
import { getProjectModeMeta } from '../data/projectModes';
import { ProgressBanner, type ProgressSegment } from '../components/ProgressBanner';
import type { SelfCheckReport } from '../pipeline/selfCheck';

interface RunState {
  status: NodeStatus;
  streamed: string;       // currently streaming text (overwrites artifact view)
  error?: string;
}

export function Pipeline() {
  const settings = useSettings();
  const project = useProject();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string>('');
  const [expand, setExpand] = useState<Record<string, boolean>>({});
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const abortRef = useRef<AbortController | null>(null);
  const [chainBusy, setChainBusy] = useState(false);

  useEffect(() => {
    loadManifest().then(setManifest).catch((e) => setError(String(e.message ?? e)));
  }, []);

  function setNodeState(id: string, patch: Partial<RunState>) {
    setRunStates((s) => ({ ...s, [id]: { ...(s[id] ?? { status: 'idle', streamed: '' }), ...patch } }));
  }

  async function runOne(stageId: StageId, step: ManifestStep) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setNodeState(step.id, { status: 'running', streamed: '', error: undefined });
    try {
      // 实时读取 store 快照，避免闭包中的 project 变量是上次渲染的旧状态。
      // 连跑 storyboard.1 → storyboard.2 时，upsertArtifact 会为下一渲染设新
      // artifacts，但本 async 中的 project 闭包不会更新——必须从 getState 读。
      const liveArtifacts = useProject.getState().artifacts;
      const liveCtx = useProject.getState().ctx;
      let artifact: NodeArtifact;
      // storyboard.2 = Phase E-G 逐单元生成；走专用循环器
      if (stageId === 'storyboard' && step.index === 2) {
        const accumulated: string[] = [];
        // 续跑预填：若 storyboard.2 已有 unitContents，先恢复显示
        const existing = liveArtifacts['storyboard.2'];
        const existingMeta = (existing?.meta ?? {}) as { unitContents?: Record<number, string> };
        if (existingMeta.unitContents) {
          for (const [k, v] of Object.entries(existingMeta.unitContents)) {
            if (v) accumulated.push(`## UNIT ${k}\n\n${String(v).trim()}`);
          }
          accumulated.sort((a, b) => {
            const ai = parseInt(a.match(/UNIT (\d+)/)?.[1] ?? '0', 10);
            const bi = parseInt(b.match(/UNIT (\d+)/)?.[1] ?? '0', 10);
            return ai - bi;
          });
        }
        artifact = await runStoryboardPhase2Loop({
          step,
          project: liveCtx,
          artifacts: liveArtifacts,
          settings,
          signal: ctrl.signal,
          onUnitStart: (unit, total) => {
            setNodeState(step.id, {
              streamed:
                accumulated.join('\n\n---\n\n') +
                (accumulated.length ? '\n\n---\n\n' : '') +
                `## UNIT ${unit.unitIndex} / ${total} （生成中）\n${unit.summary}\n`,
            });
          },
          onUnitDelta: (unitIndex, full) => {
            setNodeState(step.id, {
              streamed:
                accumulated.join('\n\n---\n\n') +
                (accumulated.length ? '\n\n---\n\n' : '') +
                `## UNIT ${unitIndex} （生成中）\n\n${full}`,
            });
          },
          onUnitDone: (unit, content) => {
            const block = `## UNIT ${unit.unitIndex}\n\n${content.trim()}`;
            const idx = accumulated.findIndex((s) =>
              s.startsWith(`## UNIT ${unit.unitIndex}\n`) ||
              s.startsWith(`## UNIT ${unit.unitIndex} `));
            if (idx >= 0) accumulated[idx] = block; else accumulated.push(block);
            setNodeState(step.id, { streamed: accumulated.join('\n\n---\n\n') });
          },
          onUnitFailed: (unit, err, retries) => {
            const block = `## UNIT ${unit.unitIndex} ⚠ 失败 (#${retries})\n\n> ${err.slice(0, 200)}`;
            const idx = accumulated.findIndex((s) =>
              s.startsWith(`## UNIT ${unit.unitIndex}\n`) ||
              s.startsWith(`## UNIT ${unit.unitIndex} `));
            if (idx >= 0) accumulated[idx] = block; else accumulated.push(block);
            setNodeState(step.id, { streamed: accumulated.join('\n\n---\n\n') });
          },
          // 增量持久化：刷新 / 中止后能续跑
          onProgress: (intermediate) => project.upsertArtifact(intermediate),
        });
      } else {
        artifact = await runStep({
          stageId, step,
          project: liveCtx,
          artifacts: liveArtifacts,
          settings,
          signal: ctrl.signal,
          onDelta: (_, full) => setNodeState(step.id, { streamed: full }),
        });
      }
      project.upsertArtifact(artifact);
      setNodeState(step.id, { status: 'done' });
      return artifact;
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setNodeState(step.id, { status: 'aborted', error: '已中止' });
      } else {
        setNodeState(step.id, { status: 'error', error: e.message ?? String(e) });
      }
      throw e;
    }
  }

  async function runChain(stageId: StageId, fromIndex = 1) {
    if (!manifest || chainBusy) return;
    const stage = manifest.stages.find((s) => s.id === stageId);
    if (!stage) return;
    setChainBusy(true);
    try {
      const steps = stage.steps.filter((s) => s.index >= fromIndex);
      // serial mode for screenplay; for assets/storyboard run sequentially too in M2
      // (parallel + loop handled in M4/M5).
      for (const step of steps) {
        setExpand((e) => ({ ...e, [step.id]: true }));
        await runOne(stageId, step);
      }
    } catch {
      /* error already shown on the failed node */
    } finally {
      setChainBusy(false);
    }
  }

  function stop() { abortRef.current?.abort(); }

  function clearOne(nodeId: string) {
    project.clearArtifact(nodeId);
    setNodeState(nodeId, { status: 'idle', streamed: '', error: undefined });
  }

  if (error) {
    return (
      <div className="m-6 card border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <strong className="text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="size-4" /> 加载 manifest 失败
        </strong>
        <p className="text-zinc-300 mt-1">{error}</p>
        <p className="text-zinc-400 mt-2">
          请确认已运行：<code className="px-1 bg-zinc-800 rounded">npm run import:prompts</code>
        </p>
      </div>
    );
  }

  if (!manifest) return <div className="p-8 text-zinc-500">加载 manifest…</div>;

  // ── progress segments: one per visible stage of the active mode ──
  // We compute done/total from the manifest's step list intersected with
  // the actual artifacts present on the project. Stages outside the active
  // mode (e.g. `adapt` for an Original project) are excluded automatically
  // because the same `meta.stages` filter drives both the rendering below
  // and the segment list here.
  const bannerSegments: ProgressSegment[] = (() => {
    const meta = getProjectModeMeta(project.ctx);
    return manifest.stages
      .filter((s) => meta.stages.includes(s.id))
      .map((s): ProgressSegment => ({
        key: s.id,
        label: s.nameZh || s.id,
        total: s.steps.length,
        done: s.steps.filter((st) => !!project.artifacts[st.id]).length,
      }));
  })();

  return (
    <div className="h-full flex flex-col">
      <ProgressBanner
        segments={bannerSegments}
        title="流水线"
        subtitle="manifest 驱动 · 上游产物自动注入下游 · 流式可视"
        actions={
          <>
            {chainBusy && (
              <button className="btn-outline" onClick={stop}>
                <Square className="size-4" /> 停止
              </button>
            )}
            <button className="btn-ghost" onClick={() => project.resetAll()} title="清空所有产物">
              <RotateCcw className="size-4" /> 重置项目
            </button>
          </>
        }
      />

      {/* project context bar */}
      <section className="px-6 py-3 border-b border-zinc-800 grid grid-cols-4 gap-3 text-sm">
        <Field label="项目名">
          <input className="input" value={project.ctx.name}
                 onChange={(e) => project.setCtx({ name: e.target.value })} />
        </Field>
        <Field label="一句话概念">
          <input className="input" value={project.ctx.concept}
                 onChange={(e) => project.setCtx({ concept: e.target.value })} />
        </Field>
        <Field label="单集时长（分钟）">
          <input type="number" min={3} max={60} className="input"
                 value={project.ctx.durationMin}
                 onChange={(e) => project.setCtx({ durationMin: +e.target.value || 5 })} />
        </Field>
        <Field label="创作模式">
          <input className="input" value={project.ctx.mode}
                 onChange={(e) => project.setCtx({ mode: e.target.value })} />
        </Field>
      </section>

      <section className="flex-1 overflow-auto p-6 space-y-6">
        {(() => {
          // Filter manifest stages by the active project's mode so that
          // e.g. an Express project sees only [storyboard], an Adaptation
          // project sees [adapt, assets, storyboard], etc.
          const meta = getProjectModeMeta(project.ctx);
          const allowed = meta.stages;
          const visible = allowed.length === 0
            ? []  // novel placeholder — nothing to show yet
            : manifest.stages.filter((s) => allowed.includes(s.id));

          if (visible.length === 0) {
            return (
              <div className="card p-8 text-center text-zinc-500 text-sm">
                <div className="font-medium text-zinc-300 mb-2">{meta.longLabel}</div>
                <div>该模式的流水线尚未实现。</div>
                <div className="text-xs text-zinc-600 mt-2">{meta.tagline}</div>
              </div>
            );
          }

          return visible.map((stage) => (
            <StageBlock
              key={stage.id}
              manifest={manifest}
              stageId={stage.id}
              chainBusy={chainBusy}
              runStates={runStates}
              artifacts={project.artifacts}
              expand={expand}
              setExpand={setExpand}
              runOne={runOne}
              runChain={runChain}
              clearOne={clearOne}
            />
          ));
        })()}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------

interface StageBlockProps {
  manifest: Manifest;
  stageId: StageId;
  chainBusy: boolean;
  runStates: Record<string, RunState>;
  artifacts: ArtifactMap;
  expand: Record<string, boolean>;
  setExpand: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  runOne: (stageId: StageId, step: ManifestStep) => Promise<any>;
  runChain: (stageId: StageId, fromIndex?: number) => Promise<void>;
  clearOne: (nodeId: string) => void;
}

function StageBlock(p: StageBlockProps) {
  const stage = p.manifest.stages.find((s) => s.id === p.stageId)!;
  const stageDoneCount = stage.steps.filter((s) => p.artifacts[s.id]).length;
  const project = useProject();
  const [injectOpen, setInjectOpen] = useState(false);

  // 各阶段需要的"上游产物"清单 — 用于手动注入
  const injectFields: InjectField[] = (() => {
    if (p.stageId === 'screenplay' || p.stageId === 'adapt') {
      return [{
        nodeId: 'screenplay.7', stageId: 'screenplay', index: 7,
        label: '最终剧本', format: 'markdown',
        placeholder: '粘贴完整剧本（小说原文也可，点 ✨ 让 AI 改写为剧本格式）…',
        hint: '若粘贴的是小说/大纲，点右上角「✨ AI 修复格式」转为剧本结构。',
        validate: (t) => t.length < 100 ? '< 100 字' : null,
        normalize: SCREENPLAY_FINAL_NORMALIZE,
        doctor: true,
      }];
    }
    if (p.stageId === 'assets') {
      return [{
        nodeId: 'screenplay.7', stageId: 'screenplay', index: 7,
        label: '剧本全文（资产抽取所需）', format: 'markdown',
        placeholder: '粘贴完整剧本…',
        validate: (t) => t.length < 100 ? '< 100 字' : null,
        normalize: SCREENPLAY_FINAL_NORMALIZE,
        doctor: true,
      }];
    }
    if (p.stageId === 'storyboard') {
      return [
        {
          nodeId: 'screenplay.7', stageId: 'screenplay', index: 7,
          label: '剧本全文', format: 'markdown',
          placeholder: '粘贴完整剧本…',
          validate: (t) => t.length < 100 ? '< 100 字' : null,
          normalize: SCREENPLAY_FINAL_NORMALIZE,
          doctor: true,
        },
        {
          nodeId: 'assets.4', stageId: 'assets', index: 4,
          label: '道具/资产清单 JSON（可选，留空则只用剧本）',
          format: 'json',
          optional: true,
          placeholder: '粘贴 JSON 数组；非 JSON 文本可点 ✨ 自动转换',
          hint: '若粘贴自然语言列表，点 ✨ 转为合法 JSON。',
          validate: (t) => {
            try { JSON.parse(t); return null; } catch { return 'JSON 格式错误（可点 ✨ 让 AI 修复）'; }
          },
          normalize: ASSETS_LIST_NORMALIZE,
        },
      ];
    }
    return [];
  })();

  return (
    <div className="card">
      <header className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{stage.nameZh}</h2>
          <span className="text-xs text-zinc-500">
            {stageDoneCount}/{stage.steps.length} · {stage.mode}
          </span>
        </div>
        <div className="flex gap-2">
          {injectFields.length > 0 && (
            <button className="btn-outline" onClick={() => setInjectOpen(true)}
                    title="跳过上游，手动粘贴产物启动本阶段">
              <Download className="size-4" /> 手动注入
            </button>
          )}
          <button className="btn-primary" onClick={() => p.runChain(p.stageId, 1)}
                  disabled={p.chainBusy}>
            <Play className="size-4" /> 跑完整阶段
          </button>
        </div>
      </header>

      <ManualInjectDialog
        open={injectOpen}
        title={`手动注入 · ${stage.nameZh} 阶段`}
        description="粘贴外部产物作为本阶段输入；下游会消费这些手动注入的产物。"
        fields={injectFields}
        existing={Object.fromEntries(injectFields.map((f) => [f.nodeId, project.artifacts[f.nodeId]]))}
        onCancel={() => setInjectOpen(false)}
        onSubmit={(arts) => {
          for (const a of arts) project.upsertArtifact(a);
          setInjectOpen(false);
        }}
      />


      {p.stageId === 'storyboard' && p.artifacts['storyboard.1'] && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30 space-y-3">
          <StoryboardPlanDiagnostics
            artifact={p.artifacts['storyboard.1']}
            targetDurationSec={
              project.ctx.durationMin ? Math.round(project.ctx.durationMin * 60) : undefined
            }
          />
          {p.artifacts['storyboard.2'] && (
            <ConsistencyPanel artifacts={p.artifacts} />
          )}
        </div>
      )}

      <div className="px-4 pt-3">
        <RunHistoryPanel limit={50} />
      </div>

      <ul className="divide-y divide-zinc-800">
        {stage.steps.map((step) => (
          <StepRow
            key={step.id}
            stageId={p.stageId}
            step={step}
            artifact={p.artifacts[step.id]}
            allArtifacts={p.artifacts}
            state={p.runStates[step.id]}
            expanded={!!p.expand[step.id]}
            chainBusy={p.chainBusy}
            onToggle={() => p.setExpand((e) => ({ ...e, [step.id]: !e[step.id] }))}
            onRun={() => p.runOne(p.stageId, step)}
            onRunFromHere={() => p.runChain(p.stageId, step.index)}
            onClear={() => p.clearOne(step.id)}
            onSelfCheckUpdate={(report) => {
              const a = project.artifacts[step.id];
              if (!a) return;
              const nextMeta = { ...(a.meta ?? {}), selfCheck: report ?? undefined };
              project.upsertArtifact({ ...a, meta: nextMeta });
            }}
            onArtifactPatch={(content) => {
              const a = project.artifacts[step.id];
              if (!a) return;
              project.upsertArtifact({ ...a, content });
            }}
          />
        ))}
      </ul>
    </div>
  );
}

interface StepRowProps {
  stageId: StageId;
  step: ManifestStep;
  artifact?: NodeArtifact;
  allArtifacts: ArtifactMap;
  state?: RunState;
  expanded: boolean;
  chainBusy: boolean;
  onToggle: () => void;
  onRun: () => void;
  onRunFromHere: () => void;
  onClear: () => void;
  onSelfCheckUpdate: (report: SelfCheckReport | null) => void;
  onArtifactPatch: (newContent: string) => void;
}

function StepRow(p: StepRowProps) {
  const status: NodeStatus = p.state?.status ?? (p.artifact ? 'done' : 'idle');
  const streaming = status === 'running';
  const display = streaming ? p.state?.streamed ?? '' : p.artifact?.content ?? '';

  return (
    <li>
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={p.onToggle} className="text-zinc-500 hover:text-zinc-200">
          {p.expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {p.stageId === 'screenplay' ? `Step ${p.step.index} · ` : ''}{p.step.title}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {p.step.outFormat} · {p.step.id}
            {p.artifact && (
              <span className="ml-2 text-zinc-400">
                {p.artifact.content.length} 字 · {Math.round(p.artifact.durationMs)}ms
                {p.artifact.tokens != null && ` · tokens ${p.artifact.tokens}`}
                {p.artifact.cost != null && ` · ¥${p.artifact.cost.toFixed(4)}`}
              </span>
            )}
            {p.state?.error && (
              <span className="ml-2 text-rose-400">{p.state.error}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2" onClick={p.onRun} disabled={p.chainBusy} title="运行此步">
            <Play className="size-3.5" />
          </button>
          <button className="btn-ghost px-2" onClick={p.onRunFromHere} disabled={p.chainBusy}
                  title="从此步跑到阶段末尾">
            <FastForward className="size-3.5" />
          </button>
          <button className="btn-ghost px-2" onClick={p.onClear} disabled={p.chainBusy}
                  title="清空本步产物">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {p.expanded && (
        <div className="px-4 pb-4 space-y-2">
          {!display ? (
            <div className="card bg-zinc-950/60 p-3">
              <div className="text-xs text-zinc-600 py-4 text-center">
                未运行。点 ▶ 运行本步，或在阶段顶部点「跑完整阶段」。
              </div>
            </div>
          ) : streaming ? (
            // 流式中：原 <pre> 实时增长 + 复制按钮
            <div className="card bg-zinc-950/60 max-h-96 overflow-auto p-3 relative">
              <button
                className="absolute top-2 right-2 btn-ghost px-1.5 py-1"
                onClick={() => navigator.clipboard.writeText(display)}
                title="复制"
              >
                <Copy className="size-3" />
              </button>
              <pre className="text-xs whitespace-pre-wrap break-words font-mono text-zinc-200">
                {display}
              </pre>
            </div>
          ) : (
            // 完成：结构化视图（按 ## 标题或 --- 拆分为卡片，每卡片独立复制）
            <div className="card bg-zinc-950/60 p-3">
              <ArtifactStructuredView
                content={display}
                nodeId={p.step.id}
                maxBodyHeight={360}
              />
            </div>
          )}
          {p.artifact && status === 'done' && useSettings.getState().enableSelfCheck && (
            <SelfCheckPanel
              artifact={p.artifact}
              settings={useSettings.getState()}
              contextArtifacts={p.allArtifacts}
              report={(p.artifact.meta as any)?.selfCheck}
              onReportUpdate={p.onSelfCheckUpdate}
              onArtifactPatch={p.onArtifactPatch}
            />
          )}
          <RunHistoryPanel nodeId={p.step.id} title={`运行历史 · ${p.step.id}`} limit={20} />
        </div>
      )}
    </li>
  );
}

function StatusIcon({ status }: { status: NodeStatus }) {
  if (status === 'running') return <Loader2 className="size-4 text-brand-400 animate-spin" />;
  if (status === 'done')    return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (status === 'error')   return <AlertTriangle className="size-4 text-rose-500" />;
  if (status === 'aborted') return <AlertTriangle className="size-4 text-amber-500" />;
  return <Circle className="size-4 text-zinc-600" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}
