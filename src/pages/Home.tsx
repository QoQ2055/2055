import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, FolderOpen, Trash2, Download, Upload, BookOpen, Settings as SettingsIcon,
  ArrowRight, Archive, Sparkles, FileDown,
  // MM1 PR-3 · format explore section icons
  Film, Clapperboard, Zap, Layers, Construction,
  // MM5 PR-3 · continuity dashboard
  Database,
} from 'lucide-react';
// MM1 PR-3 · multi-format expansion · 4 manifest 数据源
import { ALL_FORMATS, type FormatManifest } from '../data/formats';
// MM5 PR-3 · continuity dashboard · v8 4 表第一个产品消费者
import { Button, Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '../components/ui';
import { ContinuityDashboardPanel } from '../components/ContinuityDashboardPanel';
import { EmptyState } from '../components/ui/feedback';
import { toast } from '../store/toast';
import { confirm } from '../store/confirm';
import { db, type Project } from '../store/db';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import { archiveCurrent, startNewActive, loadFromDb, deleteFromDb } from '../store/projectArchive';
import {
  exportArchivedProjectFile,
  parseProjectFile,
  importAsActiveProject,
  importAsArchivedProject,
  downloadBlob,
} from '../store/projectExport';
import { NewProjectDialog } from '../components/NewProjectDialog';
import { AdaptIntakeWizard } from '../components/AdaptIntakeWizard';
import { useExportDrawer } from '../store/exportDrawer';
import { useProjectDialog } from '../store/projectDialog';
import type { ProjectContext, SourceChunk } from '../pipeline/types';
import { getProjectModeMeta, getModeMeta, getProjectMode } from '../data/projectModes';

export function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const apiKey = useSettings((s) => s.apiKey);
  const activeCtx = useProject((s) => s.ctx);
  const activeArtifacts = useProject((s) => s.artifacts);
  // ui-v5 PR-1 · 项目创建 / wizard 对话框全局化 · 支持 Cmd+K "新建项目" 跨路由调起
  const dialogOpen = useProjectDialog((s) => s.createOpen);
  const wizardOpen = useProjectDialog((s) => s.wizardOpen);
  const wizardSourceType = useProjectDialog((s) => s.wizardSourceType);
  const openCreate = useProjectDialog((s) => s.openCreate);
  const openWizard = useProjectDialog((s) => s.openWizard);
  const closeAllDialogs = useProjectDialog((s) => s.closeAll);
  const [busy, setBusy] = useState(false);
  // MM5 PR-3 · 连续性看板 modal 状态
  const [continuityOpen, setContinuityOpen] = useState(false);
  // gap-e PR-2 · 导出抽屉提升到全局 store · toolbar 与 Cmd+K 命令面板共享
  const showExport = useExportDrawer((s) => s.show);
  const navigate = useNavigate();

  /** 当前活动项目摘要（PR-3 · ActiveProjectCard）· 无产物视为"空白" */
  const activeStatus = useMemo(() => {
    const artifactCount = Object.keys(activeArtifacts).length;
    const hasContent = artifactCount > 0 || (activeCtx.source?.chunks?.length ?? 0) > 0;
    return {
      hasContent,
      artifactCount,
      sourceChunkCount: activeCtx.source?.chunks?.length ?? 0,
    };
  }, [activeArtifacts, activeCtx.source]);

  /** 归档当前活动项目（PR-3 · ActiveProjectCard 「归档」按钮）*/
  async function handleArchiveActive() {
    const ok = await confirm({
      title: `归档「${activeCtx.name}」到历史项目？`,
      message: '当前工作区会清空，可随时从下方载入。',
      confirmLabel: '归档',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await archiveCurrent();
      await refreshList();
      toast.success(`已归档「${activeCtx.name}」`);
    } catch (e: any) {
      toast.error('归档失败：' + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function refreshList() {
    const rows = await db.projects.orderBy('createdAt').reverse().toArray();
    setProjects(rows);
  }
  useEffect(() => { refreshList(); }, []);

  async function handleCreate(ctx: ProjectContext) {
    setBusy(true);
    try {
      await archiveCurrent();
      startNewActive(ctx);
      await refreshList();
      closeAllDialogs();
      // Route to the new project's mode-specific default workbench.
      navigate(getProjectModeMeta(ctx).defaultRoute);
    } catch (e: any) {
      toast.error('创建失败：' + (e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  /** 改编模式：Dialog 跳转到 Wizard */
  function handleStartAdaptWizard(adaptSourceType: string) {
    openWizard(adaptSourceType);
  }

  /** 改编模式：Wizard 提交 = 写 ctx + chunks + 跳 /intake */
  async function handleAdaptSubmit(payload: {
    ctx: ProjectContext;
    chunks: Array<Omit<SourceChunk, 'id' | 'ts'>>;
  }) {
    setBusy(true);
    try {
      await archiveCurrent();
      // 先 startNewActive 裸体上下文，再逐个写入 chunk（复用 store 的 addSourceChunk）
      startNewActive(payload.ctx);
      const { addSourceChunk } = useProject.getState();
      for (const c of payload.chunks) addSourceChunk(c);
      await refreshList();
      closeAllDialogs();
      navigate('/intake');
    } catch (e: any) {
      toast.error('创建失败：' + (e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoad(id: number) {
    const ok = await confirm({
      title: '载入此项目？',
      message: '当前活动项目（若有产物）会先归档保存。',
      confirmLabel: '载入',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await loadFromDb(id);
      await refreshList();
      // Route to the loaded project's mode-specific default workbench
      // (handles original / adaptation / express / novel uniformly).
      const loadedCtx = useProject.getState().ctx;
      navigate(getProjectModeMeta(loadedCtx).defaultRoute);
    } catch (e: any) {
      toast.error('载入失败：' + (e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    const ok = await confirm({
      title: `删除项目「${name}」？`,
      message: '该项目及其所有产物将被永久删除 · 此操作不可撤销。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await deleteFromDb(id);
    await refreshList();
  }

  async function handleExportArchived(id: number) {
    setBusy(true);
    try {
      const { filename, blob } = await exportArchivedProjectFile(id);
      downloadBlob(filename, blob);
    } catch (e: any) {
      toast.error('导出失败：' + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(
    file: File,
    target: 'active' | 'archive',
  ) {
    setBusy(true);
    try {
      const pkg = await parseProjectFile(file);
      if (target === 'active') {
        const ok = await confirm({
          title: `将「${pkg.ctx.name}」导入为活动项目？`,
          message: `当前活动项目会被自动归档。\n资产: ${pkg.artifacts.length} 个 · 运行历史: ${pkg.runHistory?.length ?? 0} 条`,
          confirmLabel: '导入',
        });
        if (!ok) {
          setBusy(false); return;
        }
        const summary = await importAsActiveProject(pkg);
        await refreshList();
        toast.success(`导入成功\n项目: ${summary.projectName}\n资产: ${summary.artifactCount}\n运行历史: ${summary.runHistoryCount}`);
      } else {
        const id = await importAsArchivedProject(pkg);
        await refreshList();
        toast.success(`已导入为历史项目 #${id}：${pkg.ctx.name}`);
      }
    } catch (e: any) {
      toast.error('导入失败：' + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function pickFile(target: 'active' | 'archive') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) await handleImportFile(f, target);
    };
    input.click();
  }

  const activeMode = getProjectMode(activeCtx as any);
  const activeMeta = getModeMeta(activeMode);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
      {/* Header · Studio Calm A.2 · 加 sparkles 装饰 + tracking + mt 推大 */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-3 text-action-primary">
            <Sparkles className="size-4" />
            <span className="text-tight-xs font-medium uppercase tracking-[0.18em]">Filmcraft Studio</span>
          </div>
          <h1 className="text-heading-xl tracking-tight">影语 FLIL</h1>
          <p className="text-body-m text-fg-secondary mt-2">
            短剧 AI 流水线 · 八步剧本 → 资产 → 分镜（Seedance 2.0）
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => openCreate()}
          disabled={busy}
        >
          <Plus className="size-5" /> 新建项目
        </Button>
      </header>

      {/* API Key warning */}
      {!apiKey && (
        <div className="card border-warning/40 bg-warning/5 p-4 text-body-m">
          <strong className="text-warning">⚠ 尚未配置 API Key</strong>
          <p className="text-fg-secondary mt-1">
            请前往 <Link to="/settings" className="text-warning underline underline-offset-2">设置</Link> 填写 DeepSeek API Key（仅保存在浏览器本地）。
          </p>
        </div>
      )}

      {/* ① ActiveProjectCard · Studio Calm A.2 · 背景渐变 + p-7 + 数字放大 */}
      {activeStatus.hasContent && (
        <section
          className="card p-7 relative overflow-hidden"
          style={{
            borderColor: `${activeMeta.accentHex}66`,
            backgroundImage: `linear-gradient(135deg, ${activeMeta.accentHex}0d 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-start gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeMeta.accentHex }}
                />
                <span className="text-tight-xs font-medium uppercase tracking-[0.14em]" style={{ color: activeMeta.accentHex }}>
                  当前工作区 · {activeMeta.label}
                </span>
              </div>
              <h2 className="text-heading-m text-fg-primary truncate">{activeCtx.name}</h2>
              <p className="text-body-s text-fg-secondary mt-1.5 line-clamp-2">{activeCtx.concept}</p>
              {/* Studio Calm · 数字放大 · mono + heading-s */}
              <div className="flex items-center gap-5 mt-4">
                <div>
                  <div className="text-heading-s font-mono text-fg-primary leading-none">{activeStatus.artifactCount}</div>
                  <div className="text-tight-xs text-fg-muted mt-1">产物</div>
                </div>
                {activeStatus.sourceChunkCount > 0 && (
                  <>
                    <span className="h-7 w-px bg-border-subtle" />
                    <div>
                      <div className="text-heading-s font-mono text-fg-primary leading-none">{activeStatus.sourceChunkCount}</div>
                      <div className="text-tight-xs text-fg-muted mt-1">原作章节</div>
                    </div>
                  </>
                )}
                {activeCtx.durationMin > 0 && (
                  <>
                    <span className="h-7 w-px bg-border-subtle" />
                    <div>
                      <div className="text-heading-s font-mono text-fg-primary leading-none">{activeCtx.durationMin}</div>
                      <div className="text-tight-xs text-fg-muted mt-1">分钟</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                variant="primary"
                onClick={() => navigate(getProjectModeMeta(activeCtx).defaultRoute)}
                disabled={busy}
              >
                <ArrowRight className="size-4" /> 继续编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => showExport('all')}
                disabled={busy || !activeStatus.hasContent}
                title="导出小说 / 剧本 / 资产 · 5 种格式"
              >
                <FileDown className="size-3.5" /> 导出…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchiveActive}
                disabled={busy}
                title="归档当前 · 工作区清空"
              >
                <Archive className="size-3.5" /> 归档
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ② Studio Calm A.2 · ModeStatsGrid 上移 · 4 mode counts 作为分类导览 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {(() => {
          const all = [activeCtx, ...projects];
          const counts: Record<string, number> = {};
          for (const c of all) {
            const m = getProjectMode(c as any);
            counts[m] = (counts[m] ?? 0) + 1;
          }
          const modes: Array<'original' | 'adaptation' | 'express' | 'novel'> =
            ['original', 'adaptation', 'express', 'novel'];
          return modes.map((m) => {
            const meta = getModeMeta(m);
            return (
              <div
                key={m}
                className="card-flat px-3 py-2.5"
                style={{ borderColor: `${meta.accentHex}33` }}
              >
                <div className="flex items-center gap-1.5 text-body-s font-medium text-fg-primary">
                  <span className="size-2 rounded-full" style={{ backgroundColor: meta.accentHex }} />
                  {meta.label}
                  <span className="ml-auto text-fg-secondary font-mono text-tight-sm">{counts[m] ?? 0}</span>
                </div>
                <div className="text-tight-xs normal-case tracking-normal text-fg-muted mt-1 leading-snug">
                  {meta.workflow}
                </div>
              </div>
            );
          });
        })()}
      </section>

      {/* ③ Studio Calm A.2 · QuickActions 紧凑工具条 · desc 删除 · 4 列 inline */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QuickActionCard
          icon={Sparkles}
          label="新建项目"
          onClick={() => openCreate()}
          accent="primary"
          disabled={busy}
        />
        <QuickActionCard
          icon={Upload}
          label="导入 .flil"
          onClick={() => pickFile('active')}
          disabled={busy}
        />
        <QuickActionCard
          icon={BookOpen}
          label="知识库 KB"
          onClick={() => navigate('/kb')}
          disabled={busy}
        />
        <QuickActionCard
          icon={SettingsIcon}
          label="设置"
          onClick={() => navigate('/settings')}
          disabled={busy}
        />
      </section>

      {/* ④ MM1 PR-3 · 格式探索 · 4 个新格式骨架路由入口（0 LLM · Coming Soon） */}
      <section>
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="text-heading-m text-fg-primary">格式探索</h2>
          <span className="text-tight-xs text-fg-muted">
            MM1 epic · 工作流元数据展示 · LLM 接入 Coming Soon
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {ALL_FORMATS.map((m) => (
            <FormatExploreCard key={m.id} manifest={m} />
          ))}
        </div>
      </section>

      {/* ⑤ MM5 PR-3 · 连续性看板入口（v8 schema 首个产品消费者 · 0 LLM） */}
      <section className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setContinuityOpen(true)}
          disabled={busy}
          title="读取 v8 连续性表 · 显示伏笔 / 角色弧光 / 世界观规则 / 节奏诊断 4 表统计 · 0 LLM 接入"
        >
          <Database className="size-3.5" /> 连续性看板
        </Button>
        <span className="text-tight-xs text-fg-muted">
          MM5 epic · 4 张连续性表只读视图 · 写入路径 Coming Soon
        </span>
      </section>

      {/* ⑥ History · Studio Calm A.2 · p-5 → p-6 · 行高加大 */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-heading-m">历史项目（{projects.length}）</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pickFile('archive')}
              disabled={busy}
              title="从 .flil.json 导入为历史项目【不交换当前活动项目】"
            >
              <Upload className="size-3.5" /> 导入为历史
            </Button>
            <span className="text-caption-m text-fg-muted">归档于浏览器 IndexedDB</span>
          </div>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="还没有归档项目"
            description="点击右上角「新建项目」开始；新建时若当前项目有产物会自动归档到这里。"
            compact
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {projects.map((p) => (
              <li key={p.id} className="py-4 flex items-center justify-between gap-3 transition-colors hover:bg-elevated/40 -mx-2 px-2 rounded">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ModeTag ctx={p} />
                    <div className="font-medium truncate text-fg-primary">{p.name}</div>
                  </div>
                  <div className="text-caption-m text-fg-muted truncate mt-1">
                    {p.concept}{p.durationMin > 0 ? ` · ${p.durationMin} 分钟` : ''} · {p.mode}
                  </div>
                </div>
                <span className="text-caption-m text-fg-muted shrink-0">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => p.id != null && handleLoad(p.id)}
                    disabled={busy}
                  >
                    <FolderOpen className="size-3.5" /> 载入
                  </Button>
                  <Button
                    iconOnly
                    onClick={() => p.id != null && handleExportArchived(p.id)}
                    disabled={busy}
                    title="导出 .flil.json"
                    aria-label="导出"
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    iconOnly
                    onClick={() => p.id != null && handleDelete(p.id, p.name)}
                    disabled={busy}
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Studio Calm A.2 · 原底部 ModeStatsGrid 已上移到 ActiveProjectCard 后 · 不再重复 */}

      <NewProjectDialog
        open={dialogOpen}
        busy={busy}
        onCancel={closeAllDialogs}
        onSubmit={handleCreate}
        onStartAdaptWizard={handleStartAdaptWizard}
      />

      <AdaptIntakeWizard
        open={wizardOpen}
        busy={busy}
        initialAdaptSourceType={wizardSourceType}
        onCancel={closeAllDialogs}
        onSubmit={handleAdaptSubmit}
      />

      {/* MM5 PR-3 · 连续性看板 modal · projectId=0 = 活动项目 sentinel · 与 recordRun 约定一致 */}
      <Modal
        open={continuityOpen}
        onClose={() => setContinuityOpen(false)}
        size="lg"
        ariaLabel="连续性看板"
      >
        <ModalHeader onClose={() => setContinuityOpen(false)}>
          <ModalTitle>v8 连续性看板</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <ContinuityDashboardPanel projectId={0} projectName={activeCtx.name} />
        </ModalBody>
        <ModalFooter>
          <span className="mr-auto text-tight-xs text-fg-muted">
            MM5 epic · 4 表只读视图 · 写入路径 PR-4+ Coming Soon
          </span>
          <Button variant="ghost" size="sm" onClick={() => setContinuityOpen(false)}>
            关闭
          </Button>
        </ModalFooter>
      </Modal>

    </div>
  );
}

/**
 * PR-3 · QuickActionCard 内部组件
 * 4 块快捷入口卡片 · accent='primary' 时用主色突出（新建项目主 CTA）
 */
/**
 * MM1 PR-3 · 格式探索卡 · 4 路 Link 入口（不调 LLM · 仅导航）
 *
 * 风格与 QuickActionCard 对齐 · 但用 Link 替代 button · hover 加 primary 边框。
 */
const FORMAT_ICON_MAP: Record<FormatManifest['id'], React.ComponentType<{ className?: string }>> = {
  feature:    Film,
  short:      Clapperboard,
  ultrashort: Zap,
  series:     Layers,
};

function FormatExploreCard({ manifest }: { manifest: FormatManifest }) {
  const Icon = FORMAT_ICON_MAP[manifest.id];
  const groups = manifest.paths ?? manifest.phases ?? [];
  const totalSteps = groups.reduce((acc, g) => acc + g.steps.length, 0);
  return (
    <Link
      to={manifest.routePath}
      className="card-flat px-3 py-3 transition-all duration-150 flex flex-col gap-1.5 hover:bg-elevated hover:border-primary-300 group"
    >
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-fg-secondary group-hover:text-primary-600 transition-colors" />
        <div className="text-body-s font-medium text-fg-primary truncate flex-1">
          {manifest.nameZh}
        </div>
        <Construction
          className="size-3 shrink-0 text-warning"
          aria-label="Coming Soon"
        />
      </div>
      <div className="flex items-center justify-between gap-2 ml-6">
        <span className="text-tight-xs text-fg-muted truncate">{manifest.duration}</span>
        <span className="text-tight-xs text-fg-muted font-mono shrink-0">
          {groups.length > 1 ? `${groups.length}×` : ''}{totalSteps}步
        </span>
      </div>
    </Link>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  desc,
  onClick,
  accent,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Studio Calm A.2 · 紧凑模式可省略 desc · 仅展示 icon + label */
  desc?: string;
  onClick: () => void;
  accent?: 'primary';
  disabled?: boolean;
}) {
  const isPrimary = accent === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        // Studio Calm A.2 · p-4 → p-3 · 紧凑工具条样式 · transition-all 加 hover scale
        'card-flat px-3 py-3 text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 ' +
        (isPrimary
          ? 'border-action-primary/40 bg-action-primary/5 hover:bg-action-primary/10 hover:border-action-primary/60'
          : 'hover:bg-elevated hover:border-border-default')
      }
    >
      <Icon className={'size-4 shrink-0 ' + (isPrimary ? 'text-action-primary' : 'text-fg-secondary')} />
      <div className="min-w-0 flex-1">
        <div className={'text-body-s font-medium truncate ' + (isPrimary ? 'text-action-primary' : 'text-fg-primary')}>
          {label}
        </div>
        {desc && (
          <div className="text-tight-xs text-fg-muted leading-snug truncate">{desc}</div>
        )}
      </div>
    </button>
  );
}

/** Small colored badge that visually identifies the mode of any project. */
function ModeTag({ ctx }: { ctx: { projectMode?: any; projectType?: any; createMode?: any } }) {
  const meta = getModeMeta(getProjectMode(ctx as any));
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-tight-xs font-medium shrink-0"
      style={{
        color: meta.accentHex,
        backgroundColor: `${meta.accentHex}18`,
        border: `1px solid ${meta.accentHex}55`,
      }}
      title={meta.tagline}
    >
      {meta.label}
    </span>
  );
}
