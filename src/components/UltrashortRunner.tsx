/**
 * UltrashortRunner · MM1 PR-7
 *
 * /ultrashort-film 路由的 3 步 LLM-driven runner（concept_short 格式专用）。
 *
 * 与 Screenplay 组件的区别（为什么不复用）：
 *   - Screenplay 8 步 · 含 R1/R9 编辑部 / Best-of-N / 自检 / 评分卡 / 硬批准闸 / Best-of-N
 *     等高级功能（>1000 LOC）· 这些 ultrashort 都不需要
 *   - ultrashort 仅 3 步 · 流程极简（path 选择 → 概念/形式 → 结构视听 → 全片剧本）
 *   - 复用 Screenplay 需在多处 hardcode 'screenplay' 分支扩展 'ultrashort' · 污染面大
 *   - 独立 ~200 LOC runner 维护更清晰 · 与 Screenplay 演进解耦
 *
 * 复用 Screenplay 的：
 *   - runStep（src/pipeline/runner.ts）·  composeMessages / chatStream 全套底层
 *   - loadManifest 加载 'ultrashort' stage 的 3 步元数据
 *   - useProject / useSettings store
 *   - MarkdownView 渲染 artifact
 *
 * 实施 SKILL 双分支：ultrashortMode 由 ProjectContext 控制 · interpolate.ts 注入 user prompt。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Play, StopCircle, Trash2, RefreshCw, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { loadManifest } from '../pipeline/manifest';
import { runStep } from '../pipeline/runner';
import { useProject } from '../store/project';
import { useSettings } from '../store/settings';
import { MarkdownView } from './MarkdownView';
import type { Manifest, ManifestStep, NodeStatus } from '../pipeline/types';

const STAGE_ID = 'ultrashort' as const;

const MODE_LABEL: Record<string, string> = {
  'what-if': 'What-If 高概念',
  'how-to-tell': 'How-to-Tell 视听形式',
  'mixed': '混合 · 三方案对比',
};

interface UltrashortRunnerProps {
  /** ctx.ultrashortMode · UltraShortFilm 路由保证非 undefined（undefined 时渲染 PathSelector） */
  mode: 'what-if' | 'how-to-tell' | 'mixed';
  /** 切换路径的回调（清 ctx.ultrashortMode + 清 ultrashort.* artifact） */
  onSwitchPath: () => void;
}

export function UltrashortRunner({ mode, onSwitchPath }: UltrashortRunnerProps) {
  const project = useProject();
  const settings = useSettings();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'ultrashort.1': true });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadManifest().then(setManifest).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const steps = useMemo<ManifestStep[]>(() => {
    return manifest?.stages.find((s) => s.id === STAGE_ID)?.steps ?? [];
  }, [manifest]);

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
    setExpanded((e) => ({ ...e, [step.id]: true }));
    try {
      const a = await runStep({
        stageId: STAGE_ID,
        step,
        project: project.ctx,
        artifacts: project.artifacts,
        settings,
        signal: ctrl.signal,
        onDelta: (_, full) => setStreaming((s) => ({ ...s, [step.id]: full })),
      });
      project.upsertArtifact(a);
      project.invalidateFrom(STAGE_ID, step.index + 1);
      setStatus(step.id, 'done');
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setStatus(step.id, 'aborted');
        setErrors((er) => ({ ...er, [step.id]: '已中止' }));
      } else {
        setStatus(step.id, 'error');
        setErrors((er) => ({ ...er, [step.id]: e?.message ?? String(e) }));
      }
    }
  }

  function abort() {
    abortRef.current?.abort();
  }

  function clearStep(stepId: string) {
    project.clearArtifact(stepId);
    setStatus(stepId, 'idle');
    setStreaming((s) => { const n = { ...s }; delete n[stepId]; return n; });
    setErrors((e) => { const n = { ...e }; delete n[stepId]; return n; });
  }

  if (error) {
    return (
      <div className="px-page-x py-page-y max-w-content mx-auto">
        <div className="rounded-card border border-danger-200 bg-danger-50 p-4 text-body-s text-danger-active">
          加载 manifest 失败: {error}
        </div>
      </div>
    );
  }

  if (!manifest || steps.length === 0) {
    return (
      <div className="px-page-x py-page-y max-w-content mx-auto">
        <div className="text-body-s text-fg-muted inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载工作流元数据...
        </div>
      </div>
    );
  }

  const modeLabel = MODE_LABEL[mode];

  return (
    <div className="px-page-x py-page-y max-w-content mx-auto">
      {/* ── header ─────────────────────────────────────────── */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-heading-xl text-fg-primary">概念超短片 · 三步工作台</h1>
          <p className="mt-1 text-body-s text-fg-secondary">
            <span className="font-medium text-primary-700">{modeLabel}</span>
            <span className="mx-2 text-fg-muted">·</span>
            <span>1-3 分钟极短片 · 视听语言炫技合法空间</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSwitchPath}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border-default text-body-s text-fg-secondary hover:bg-surface transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            切换路径
          </button>
        </div>
      </header>

      {!settings.apiKey && (
        <div className="mb-4 rounded-card border border-warning-200 bg-warning-50 px-4 py-2.5 text-body-s text-warning-active">
          ⚠ 未配置 API Key · 请到「设置」填入后再运行步骤
        </div>
      )}

      {/* ── steps ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {steps.map((step) => {
          const status = statuses[step.id] ?? (project.artifacts[step.id] ? 'done' : 'idle');
          const artifact = project.artifacts[step.id];
          const streamingText = streaming[step.id];
          const errMsg = errors[step.id];
          const isExpanded = expanded[step.id] !== false;
          const stepError = status === 'error' || status === 'aborted';

          return (
            <article
              key={step.id}
              className={clsx(
                'rounded-card border bg-surface',
                stepError ? 'border-danger-200' : status === 'done' ? 'border-success-200' : 'border-border-default',
              )}
            >
              {/* card header (clickable to collapse) */}
              <header
                className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setExpanded((e) => ({ ...e, [step.id]: !isExpanded }))}
              >
                <ChevronRight className={clsx('w-4 h-4 text-fg-muted transition-transform', isExpanded && 'rotate-90')} />
                <span className="flex-shrink-0 w-7 h-7 rounded-pill bg-primary-100 text-primary-700 text-body-s font-medium flex items-center justify-center">
                  U{step.index}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-body-m font-medium text-fg-primary truncate">{step.title}</h3>
                  {artifact && (
                    <p className="mt-0.5 text-caption-m text-fg-muted truncate">
                      已生成 · {artifact.content.length} 字符 · {new Date(artifact.ts).toLocaleString()}
                    </p>
                  )}
                </div>
                <StatusBadge status={status} />
              </header>

              {/* card body */}
              {isExpanded && (
                <div className="border-t border-border-subtle px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {status !== 'running' ? (
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); runOne(step); }}
                        disabled={!settings.apiKey}
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-body-s text-white transition-colors',
                          'bg-primary-500 hover:bg-primary-600 disabled:bg-neutral-300 disabled:cursor-not-allowed',
                        )}
                      >
                        <Play className="w-3.5 h-3.5" />
                        {artifact ? '重跑此步' : '运行此步'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); abort(); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-danger text-white text-body-s hover:bg-danger-hover transition-colors"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        中止
                      </button>
                    )}

                    {artifact && status !== 'running' && (
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); clearStep(step.id); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border-default text-body-s text-fg-secondary hover:bg-surface transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        清产物
                      </button>
                    )}

                    {status === 'running' && streamingText && (
                      <span className="inline-flex items-center gap-1 text-caption-m text-fg-muted">
                        <RefreshCw className="w-3 h-3 animate-spin" /> 流式输出中 · {streamingText.length} 字符
                      </span>
                    )}
                  </div>

                  {errMsg && (
                    <div className="mb-3 rounded-card border border-danger-200 bg-danger-50 px-3 py-2 text-body-s text-danger-active inline-flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{errMsg}</span>
                    </div>
                  )}

                  {/* preview: streaming > artifact > placeholder */}
                  {status === 'running' && streamingText ? (
                    <div className="rounded-card border border-border-subtle bg-canvas p-3 max-h-96 overflow-auto">
                      <MarkdownView content={streamingText} />
                    </div>
                  ) : artifact ? (
                    <div className="rounded-card border border-border-subtle bg-canvas p-3 max-h-[600px] overflow-auto">
                      <MarkdownView content={artifact.content} />
                    </div>
                  ) : (
                    <p className="text-body-s text-fg-muted italic">尚未运行 · 点击"运行此步"开始</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <footer className="mt-6 text-caption-m text-fg-muted leading-relaxed">
        <p>
          来源：<code className="px-1.5 py-0.5 rounded bg-surface border border-border-default text-code-m">docs/methodology/format-ultrashort.md</code>
          {' · '}MIT @山音 · 字符级摘要嵌入 prompts/{STAGE_ID}/{'{2,3}'}.json (step 1 复用 prompts/screenplay/1.json 的 4 分支)。
        </p>
      </footer>
    </div>
  );
}

function StatusBadge({ status }: { status: NodeStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-success-50 text-success-active text-caption-m border border-success-200">
        <CheckCircle2 className="w-3 h-3" /> 已完成
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-primary-50 text-primary-700 text-caption-m border border-primary-200">
        <Loader2 className="w-3 h-3 animate-spin" /> 运行中
      </span>
    );
  }
  if (status === 'error' || status === 'aborted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-danger-50 text-danger-active text-caption-m border border-danger-200">
        <AlertCircle className="w-3 h-3" /> {status === 'aborted' ? '已中止' : '错误'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-neutral-100 text-fg-muted text-caption-m">
      待运行
    </span>
  );
}
