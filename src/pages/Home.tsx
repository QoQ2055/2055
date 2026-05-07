import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, FolderOpen, Trash2, Download, Upload, BookOpen, Settings as SettingsIcon,
  ArrowRight, Archive, Sparkles, FileDown,
} from 'lucide-react';
import { Button } from '../components/ui';
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
import type { ProjectContext, SourceChunk } from '../pipeline/types';
import { getProjectModeMeta, getModeMeta, getProjectMode } from '../data/projectModes';

export function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const apiKey = useSettings((s) => s.apiKey);
  const activeCtx = useProject((s) => s.ctx);
  const activeArtifacts = useProject((s) => s.artifacts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSourceType, setWizardSourceType] = useState<string>('novel_long');
  const [busy, setBusy] = useState(false);
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
      setDialogOpen(false);
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
    setDialogOpen(false);
    setWizardSourceType(adaptSourceType);
    setWizardOpen(true);
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
      setWizardOpen(false);
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
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-heading-xl">影语 FLIL</h1>
          <p className="text-body-m text-fg-secondary mt-2">
            短剧 AI 流水线 · 八步剧本 → 资产 → 分镜（Seedance 2.0）
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setDialogOpen(true)}
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

      {/* ① ActiveProjectCard · 仅当有产物 / source chunks 时显示 */}
      {activeStatus.hasContent && (
        <section
          className="card p-5"
          style={{ borderColor: `${activeMeta.accentHex}55` }}
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeMeta.accentHex }}
                />
                <span className="text-tight-xs font-medium uppercase tracking-wide" style={{ color: activeMeta.accentHex }}>
                  当前工作区 · {activeMeta.label}
                </span>
              </div>
              <h2 className="text-heading-m text-fg-primary truncate">{activeCtx.name}</h2>
              <p className="text-body-s text-fg-secondary mt-1 line-clamp-2">{activeCtx.concept}</p>
              <div className="flex items-center gap-4 mt-3 text-caption-m text-fg-muted">
                <span><strong className="text-fg-primary font-mono">{activeStatus.artifactCount}</strong> 个产物</span>
                {activeStatus.sourceChunkCount > 0 && (
                  <span>· <strong className="text-fg-primary font-mono">{activeStatus.sourceChunkCount}</strong> 个原作章节</span>
                )}
                <span>· {activeCtx.durationMin} 分钟</span>
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

      {/* ② QuickActions · 4 块快捷入口 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickActionCard
          icon={Sparkles}
          label="新建项目"
          desc="开始一段新的故事"
          onClick={() => setDialogOpen(true)}
          accent="primary"
          disabled={busy}
        />
        <QuickActionCard
          icon={Upload}
          label="导入 .flil"
          desc="从备份文件载入"
          onClick={() => pickFile('active')}
          disabled={busy}
        />
        <QuickActionCard
          icon={BookOpen}
          label="知识库 KB"
          desc="管理 prompt 注入"
          onClick={() => navigate('/kb')}
          disabled={busy}
        />
        <QuickActionCard
          icon={SettingsIcon}
          label="设置"
          desc="API Key + 偏好"
          onClick={() => navigate('/settings')}
          disabled={busy}
        />
      </section>

      {/* ③ ModeStatsGrid（保留 · 4 mode counts · 见原 JSX 下方） */}

      {/* ④ History */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
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
              <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ModeTag ctx={p} />
                    <div className="font-medium truncate text-fg-primary">{p.name}</div>
                  </div>
                  <div className="text-caption-m text-fg-muted truncate mt-1">
                    {p.concept} · {p.durationMin} 分钟 · {p.mode}
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

      <section className="grid grid-cols-4 gap-3">
        {(() => {
          // Per-mode project counts: gives users a feel for how their work
          // is distributed across modes at a glance.
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
                className="card p-3"
                style={{ borderColor: `${meta.accentHex}33` }}
              >
                <div className="flex items-center gap-1.5 text-body-s font-medium text-fg-primary">
                  <span className="size-2 rounded-full" style={{ backgroundColor: meta.accentHex }} />
                  {meta.label}
                  <span className="ml-auto text-fg-secondary font-mono">{counts[m] ?? 0}</span>
                </div>
                <div className="text-label-m normal-case tracking-normal text-fg-muted mt-1.5 leading-snug">
                  {meta.workflow}
                </div>
              </div>
            );
          });
        })()}
      </section>

      <NewProjectDialog
        open={dialogOpen}
        busy={busy}
        onCancel={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        onStartAdaptWizard={handleStartAdaptWizard}
      />

      <AdaptIntakeWizard
        open={wizardOpen}
        busy={busy}
        initialAdaptSourceType={wizardSourceType}
        onCancel={() => setWizardOpen(false)}
        onSubmit={handleAdaptSubmit}
      />

    </div>
  );
}

/**
 * PR-3 · QuickActionCard 内部组件
 * 4 块快捷入口卡片 · accent='primary' 时用主色突出（新建项目主 CTA）
 */
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
  desc: string;
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
        'card p-4 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
        (isPrimary
          ? 'border-action-primary/40 bg-action-primary/5 hover:bg-action-primary/10 hover:border-action-primary/60'
          : 'hover:bg-elevated hover:border-border-default')
      }
    >
      <Icon className={'size-5 mb-2 ' + (isPrimary ? 'text-action-primary' : 'text-fg-secondary')} />
      <div className={'text-body-m font-medium ' + (isPrimary ? 'text-action-primary' : 'text-fg-primary')}>
        {label}
      </div>
      <div className="text-tight-xs text-fg-muted mt-0.5 leading-snug">{desc}</div>
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
