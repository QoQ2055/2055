import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Square, RotateCcw, Copy, AlertTriangle, CheckCircle2, Loader2,
  Box, MapPin, Users, Search, ChevronDown, ChevronRight, FileText, Download,
} from 'lucide-react';
import clsx from 'clsx';
import { loadManifest } from '../pipeline/manifest';
import { runStep } from '../pipeline/runner';
import { parseLooseArray } from '../pipeline/jsonLoose';
import type { Manifest, ManifestStep, NodeArtifact, NodeStatus } from '../pipeline/types';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import { MarkdownView } from '../components/MarkdownView';
import { ManualInjectDialog } from '../components/ManualInjectDialog';
import { SCREENPLAY_FINAL_NORMALIZE } from '../components/normalizePresets';
import { Button } from '../components/ui';

type Tab = 'roles' | 'scenes' | 'props';

const TAB_TO_INDEX: Record<Tab, number> = { roles: 2, scenes: 3, props: 4 };
const TAB_META: Record<Tab, { label: string; icon: any; color: string }> = {
  roles:  { label: '角色', icon: Users,  color: 'text-sky-400' },
  scenes: { label: '场景', icon: MapPin, color: 'text-success' },
  props:  { label: '道具', icon: Box,    color: 'text-warning' },
};

export function Assets() {
  const settings = useSettings();
  const project = useProject();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('roles');
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [streaming, setStreaming] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [scanOpen, setScanOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const [chainBusy, setChainBusy] = useState(false);

  useEffect(() => {
    loadManifest().then(setManifest).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const stage = manifest?.stages.find((s) => s.id === 'assets');
  const steps = stage?.steps ?? [];
  const stepBy = (i: number) => steps.find((s) => s.index === i)!;

  const screenplayDone = !!project.artifacts['screenplay.7'] || !!project.artifacts['adapt.6'];
  const screenplaySource: 'screenplay.7' | 'adapt.6' | null =
    project.artifacts['screenplay.7'] ? 'screenplay.7'
    : project.artifacts['adapt.6'] ? 'adapt.6'
    : null;
  const [injectOpen, setInjectOpen] = useState(false);
  const scanArt = project.artifacts['assets.1'];

  function setStatus(id: string, st: NodeStatus) {
    setStatuses((s) => ({ ...s, [id]: st }));
  }
  function clearErr(id: string) {
    setErrs((e) => { const n = { ...e }; delete n[id]; return n; });
  }

  async function runOne(step: ManifestStep, ctrlExt?: AbortController) {
    const ctrl = ctrlExt ?? new AbortController();
    if (!ctrlExt) abortRef.current = ctrl;
    setStatus(step.id, 'running');
    setStreaming((s) => ({ ...s, [step.id]: '' }));
    clearErr(step.id);
    try {
      const a = await runStep({
        stageId: 'assets', step,
        project: project.ctx,
        artifacts: project.artifacts,
        settings,
        signal: ctrl.signal,
        onDelta: (_, full) => setStreaming((s) => ({ ...s, [step.id]: full })),
      });
      project.upsertArtifact(a);
      // re-running scan invalidates engines (downstream within stage)
      project.invalidateFrom('assets', step.index + 1);
      setStatus(step.id, 'done');
      return a;
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setStatus(step.id, 'aborted');
        setErrs((er) => ({ ...er, [step.id]: '已中止' }));
      } else {
        setStatus(step.id, 'error');
        setErrs((er) => ({ ...er, [step.id]: e.message ?? String(e) }));
      }
      throw e;
    }
  }

  async function runScanThenAll() {
    if (!stage || chainBusy || !screenplayDone) return;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await runOne(stepBy(1), ctrl);
      await Promise.all([
        runOne(stepBy(2), ctrl).catch(() => {}),
        runOne(stepBy(3), ctrl).catch(() => {}),
        runOne(stepBy(4), ctrl).catch(() => {}),
      ]);
    } catch { /* gate failed; engines skipped */ }
    finally { setChainBusy(false); }
  }

  async function runEnginesParallel() {
    if (!stage || chainBusy || !scanArt) return;
    setChainBusy(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await Promise.all([
        runOne(stepBy(2), ctrl).catch(() => {}),
        runOne(stepBy(3), ctrl).catch(() => {}),
        runOne(stepBy(4), ctrl).catch(() => {}),
      ]);
    } finally { setChainBusy(false); }
  }

  function stop() { abortRef.current?.abort(); }

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
  if (!manifest || !stage) return <div className="p-8 text-fg-muted">加载…</div>;

  return (
    <div className="h-full flex flex-col relative">
      <header className="px-6 py-4 border-b border-border-subtle flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Box className="size-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold">资产工作台</h1>
            <p className="text-xs text-fg-muted">
              gate-then-parallel · 扫描完整性闸 → 角色 / 场景 / 道具 三路并发生成 AI 文生图 prompt
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {chainBusy ? (
            <button className="btn-outline" onClick={stop}><Square className="size-4" /> 停止</button>
          ) : (
            <>
              <button className="btn-outline" onClick={() => setInjectOpen(true)}
                      title="跳过剧本工作台，直接粘贴外部剧本">
                <Download className="size-4" /> 导入剧本
              </button>
              <button className="btn-outline" onClick={runEnginesParallel}
                      disabled={!scanArt}
                      title={!scanArt ? '请先跑扫描闸' : '只跑三路引擎（保持扫描结果）'}>
                <Play className="size-4" /> 三路并发
              </button>
              <button className="btn-primary" onClick={runScanThenAll}
                      disabled={!screenplayDone}
                      title={!screenplayDone ? '请先在剧本工作台完成 Step 7' : '扫描 → 三路并发'}>
                <Play className="size-4" /> 全跑
              </button>
            </>
          )}
        </div>
      </header>

      {!screenplayDone && (
        <div className="m-6 card border-warning/40 bg-warning/5 p-4 text-sm">
          <strong className="text-warning">⚠ 缺少剧本输入</strong>
          <p className="text-fg-secondary mt-1">
            资产阶段需要剧本作为输入。三条路径：
            <strong>原创</strong>跳 <a href="#/screenplay" className="text-primary-400 underline">/screenplay</a> 完成 Step 7；
            <strong>改编</strong>跳 <a href="#/adapt" className="text-primary-400 underline">/adapt</a> 完成 A6；
            或点右上角 <strong>「📥 导入剧本」</strong> 手动粘贴。
          </p>
        </div>
      )}
      {screenplaySource === 'adapt.6' && (
        <div className="px-6 py-2 border-b border-border-subtle bg-sky-500/5 text-xs text-sky-200 flex items-center gap-2">
          <FileText className="size-3.5" />
          剧本输入来自 <span className="font-mono">adapt.6</span>（改编最终稿） · 所有资产抽取针对改编后的剧本
        </div>
      )}

      {/* Gate (scan) section */}
      <section className="px-6 pt-4">
        <GateCard
          step={stepBy(1)}
          status={statuses['assets.1'] ?? (scanArt ? 'done' : 'idle')}
          stale={!!project.stale['assets.1']}
          artifact={scanArt}
          err={errs['assets.1']}
          streaming={streaming['assets.1']}
          open={scanOpen}
          chainBusy={chainBusy}
          onToggle={() => setScanOpen((v) => !v)}
          onRun={() => runOne(stepBy(1)).catch(() => {})}
          onClear={() => project.clearArtifact('assets.1')}
        />
      </section>

      {/* Tabs */}
      <nav className="px-6 pt-4 flex items-center gap-1 border-b border-border-subtle -mb-px">
        {(['roles', 'scenes', 'props'] as Tab[]).map((t) => {
          const meta = TAB_META[t];
          const idx = TAB_TO_INDEX[t];
          const a = project.artifacts[`assets.${idx}`];
          const items = a ? parseLooseArray(a.content) : [];
          const count = items.length;
          const Icon = meta.icon;
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors',
                isActive
                  ? 'border-brand-500 text-fg-primary bg-surface/60'
                  : 'border-transparent text-fg-secondary hover:text-fg-primary',
              )}
            >
              <Icon className={clsx('size-4', isActive ? meta.color : 'text-fg-muted')} />
              {meta.label}
              {count > 0 && (
                <span className="text-tight-xs px-1.5 py-0.5 rounded bg-elevated text-fg-secondary">{count}</span>
              )}
              {(statuses[`assets.${idx}`] === 'running') && (
                <Loader2 className="size-3 animate-spin text-primary-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab body */}
      <main className="flex-1 overflow-auto p-6">
        <EnginePane
          tab={tab}
          step={stepBy(TAB_TO_INDEX[tab])}
          artifact={project.artifacts[`assets.${TAB_TO_INDEX[tab]}`]}
          status={statuses[`assets.${TAB_TO_INDEX[tab]}`] ?? (project.artifacts[`assets.${TAB_TO_INDEX[tab]}`] ? 'done' : 'idle')}
          err={errs[`assets.${TAB_TO_INDEX[tab]}`]}
          streaming={streaming[`assets.${TAB_TO_INDEX[tab]}`]}
          chainBusy={chainBusy}
          gateReady={!!scanArt}
          onRun={() => runOne(stepBy(TAB_TO_INDEX[tab])).catch(() => {})}
          onClear={() => project.clearArtifact(`assets.${TAB_TO_INDEX[tab]}`)}
        />
      </main>

      <ManualInjectDialog
        open={injectOpen}
        title="导入外部剧本到 screenplay.7"
        description="跳过剧本工作台，直接粘贴外部剧本，资产抽取将以此为输入。"
        fields={[{
          nodeId: 'screenplay.7',
          stageId: 'screenplay',
          index: 7,
          label: '剧本全文',
          format: 'markdown',
          placeholder: '粘贴完整剧本（含场次、对白、动作）；非剧本文本可点 ✨ 转换…',
          hint: '至少 100 字。非剧本格式可点「✨ AI 修复格式」自动转换。',
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

interface GateCardProps {
  step: ManifestStep;
  status: NodeStatus;
  stale: boolean;
  artifact?: NodeArtifact;
  err?: string;
  streaming?: string;
  open: boolean;
  chainBusy: boolean;
  onToggle: () => void;
  onRun: () => void;
  onClear: () => void;
}

function GateCard(p: GateCardProps) {
  const isRunning = p.status === 'running';
  const display = isRunning ? (p.streaming ?? '') : (p.artifact?.content ?? '');
  return (
    <div className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-border-subtle flex items-center gap-3">
        <Button variant="ghost" iconOnly onClick={p.onToggle} aria-label={p.open ? '折叠' : '展开'}>
          {p.open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
        <Search className="size-4 text-primary-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold flex items-center gap-2">
            完整性扫描闸
            <StatusBadge status={p.status} stale={p.stale} hasArtifact={!!p.artifact} />
          </div>
          <div className="text-xs text-fg-muted">assets.1 · {p.artifact ? `${p.artifact.content.length} 字 · ${Math.round(p.artifact.durationMs)}ms` : '未运行'}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn-outline" onClick={p.onRun} disabled={p.chainBusy}>
            <Play className="size-4" /> {p.artifact ? '重跑' : '运行'}
          </button>
          {p.artifact && (
            <button className="btn-ghost" onClick={p.onClear} disabled={p.chainBusy}>
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      </header>
      {p.err && (
        <div className="px-4 py-2 text-sm text-danger bg-danger/5">{p.err}</div>
      )}
      {p.open && (
        <div className="p-4 max-h-72 overflow-auto bg-canvas/40">
          {display
            ? <MarkdownView content={display} />
            : <div className="text-xs text-fg-muted text-center py-4">未运行扫描。</div>}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

interface EnginePaneProps {
  tab: Tab;
  step: ManifestStep;
  artifact?: NodeArtifact;
  status: NodeStatus;
  err?: string;
  streaming?: string;
  chainBusy: boolean;
  gateReady: boolean;
  onRun: () => void;
  onClear: () => void;
}

function EnginePane(p: EnginePaneProps) {
  const items = useMemo(() => p.artifact ? parseLooseArray(p.artifact.content) : [], [p.artifact]);
  const isRunning = p.status === 'running';
  const meta = TAB_META[p.tab];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={clsx('size-5', meta.color)} />
          <h2 className="text-lg font-semibold">{meta.label}卡片</h2>
          <StatusBadge status={p.status} hasArtifact={!!p.artifact} />
          {items.length > 0 && (
            <span className="text-xs text-fg-muted">共 {items.length} 张</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn-outline" onClick={p.onRun}
                  disabled={p.chainBusy || (!p.gateReady && !p.artifact)}
                  title={!p.gateReady && !p.artifact ? '请先跑扫描闸' : ''}>
            <Play className="size-4" /> {p.artifact ? '重跑本类' : '运行本类'}
          </button>
          {p.artifact && (
            <button className="btn-ghost" onClick={p.onClear} disabled={p.chainBusy}>
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      </div>

      {p.err && (
        <div className="card border-danger/40 bg-danger/5 p-3 text-sm text-danger">
          {p.err}
        </div>
      )}

      {isRunning && (
        <div className="card p-3 max-h-60 overflow-auto bg-canvas/60">
          <div className="text-xs text-fg-muted mb-2 flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" /> 流式输出中…
          </div>
          <pre className="text-xs whitespace-pre-wrap break-words font-mono text-fg-secondary">
            {p.streaming || ''}
          </pre>
        </div>
      )}

      {!isRunning && !p.artifact && (
        <div className="card p-10 text-center text-sm text-fg-muted">
          未运行。点 <strong className="text-fg-secondary">运行本类</strong> 开始生成 {meta.label}卡。
        </div>
      )}

      {!isRunning && p.artifact && items.length === 0 && (
        <div className="card p-6 text-sm text-fg-secondary">
          <strong className="text-warning">⚠ 输出无法解析为数组</strong>
          <p className="mt-1 text-xs">原始输出（前 1000 字）：</p>
          <pre className="mt-2 text-xs whitespace-pre-wrap font-mono text-fg-secondary max-h-60 overflow-auto bg-canvas p-2 rounded">
            {p.artifact.content.slice(0, 1000)}
          </pre>
        </div>
      )}

      {!isRunning && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((it: any, i: number) => <AssetCard key={i} item={it} tab={p.tab} />)}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function AssetCard({ item, tab }: { item: any; tab: Tab }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = TAB_META[tab];
  const Icon = meta.icon;

  const name      = item.name ?? item.title ?? item.场景名 ?? item.角色名 ?? '(未命名)';
  const category  = item.category ?? item.tier ?? item.role ?? item.分类 ?? '';
  const belongsTo = item.belongsTo ?? item.belong_to ?? item.location ?? item.所属 ?? '';
  const era       = item.era ?? item.时代 ?? '';
  const aiPrompt: string = item.aiPrompt ?? item.ai_prompt ?? item.prompt ?? '';
  const visualAnchor = item.visualAnchor ?? item.visual_anchor ?? '';
  const dramatic = item.dramaticFunction ?? item.dramatic_function ?? '';

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Icon className={clsx('size-4 shrink-0', meta.color)} />
          <h3 className="text-sm font-semibold truncate flex-1" title={name}>{name}</h3>
          {category && (
            <span className="text-tight-xs px-1.5 py-0.5 rounded bg-elevated text-fg-secondary shrink-0">
              {category}
            </span>
          )}
        </div>
        {(belongsTo || era) && (
          <div className="text-tight-sm text-fg-muted mt-1 truncate">
            {belongsTo}{belongsTo && era ? ' · ' : ''}{era}
          </div>
        )}
      </header>

      <div className="px-4 py-3 flex-1 space-y-2">
        {visualAnchor && (
          <p className="text-xs text-fg-secondary line-clamp-2"><strong className="text-fg-secondary">锚点：</strong>{visualAnchor}</p>
        )}
        {dramatic && (
          <p className="text-xs text-fg-secondary line-clamp-2"><strong>戏剧功能：</strong>{dramatic}</p>
        )}
        {aiPrompt && (
          <div className="rounded bg-canvas/60 border border-border-subtle p-2 max-h-32 overflow-auto">
            <pre className="text-tight-sm whitespace-pre-wrap break-words font-mono text-fg-secondary">
              {aiPrompt.length > 400 ? aiPrompt.slice(0, 400) + '…' : aiPrompt}
            </pre>
          </div>
        )}
      </div>

      <footer className="px-4 py-2 border-t border-border-subtle flex items-center justify-between">
        <button className="btn-ghost text-xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '收起' : '展开全部字段'}
        </button>
        <div className="flex gap-1">
          {aiPrompt && (
            <button
              className={clsx('btn-ghost text-xs', copied && 'text-success')}
              onClick={() => copy(aiPrompt)}
              title="复制 AI 文生图 Prompt"
            >
              <Copy className="size-3" /> {copied ? '已复制' : '复制 prompt'}
            </button>
          )}
          <button
            className="btn-ghost text-xs"
            onClick={() => copy(JSON.stringify(item, null, 2))}
            title="复制整张卡 JSON"
          >
            <FileText className="size-3" /> JSON
          </button>
        </div>
      </footer>

      {expanded && (
        <div className="px-4 py-3 border-t border-border-subtle bg-canvas/40 max-h-80 overflow-auto">
          <dl className="text-xs space-y-1.5">
            {Object.entries(item).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[100px_1fr] gap-2">
                <dt className="text-fg-muted shrink-0 break-all">{k}</dt>
                <dd className="text-fg-secondary whitespace-pre-wrap break-words">
                  {typeof v === 'string' ? v : JSON.stringify(v, null, 2)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function StatusBadge({ status, stale, hasArtifact }: { status: NodeStatus; stale?: boolean; hasArtifact: boolean }) {
  if (status === 'running')
    return <span className="inline-flex items-center gap-1 text-tight-xs text-brand-300"><Loader2 className="size-3 animate-spin" /> 运行中</span>;
  if (status === 'error')
    return <span className="text-tight-xs px-1.5 py-0.5 rounded bg-danger/15 text-danger border border-danger/30">错误</span>;
  if (stale && hasArtifact)
    return <span className="text-tight-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">stale</span>;
  if (hasArtifact)
    return <span className="inline-flex items-center gap-1 text-tight-xs text-success"><CheckCircle2 className="size-3" /> 完成</span>;
  return null;
}
