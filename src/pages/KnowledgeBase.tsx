import { useEffect, useState } from 'react';
import { BookOpen, AlertTriangle, Loader2, Library, Upload, ThumbsDown } from 'lucide-react';
import clsx from 'clsx';
import { loadKbContent, loadKbManifest, type KbItem, type KbManifest } from '../pipeline/kb';
import { MarkdownView } from '../components/MarkdownView';
import { UserKbLibrary } from '../components/UserKbLibrary';
import { FeedbackInsights } from '../components/FeedbackInsights';

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  writing:    { label: '写作 / 台词', color: 'bg-danger/20 text-danger border-danger/40' },
  visual:     { label: '视觉风格',     color: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  shot:       { label: '镜头 / 表情',  color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  combat:     { label: '打斗',         color: 'bg-warning/20 text-warning border-warning/40' },
  asset:      { label: '资产方法论',   color: 'bg-success/20 text-success border-success/40' },
  adaptation: { label: '改编',         color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  audio:      { label: '音频',         color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  workflow:   { label: '工作流',       color: 'bg-zinc-500/20 text-fg-secondary border-zinc-500/40' },
};

type KbTab = 'builtin' | 'user' | 'feedback';

const TAB_HINTS: Record<KbTab, string> = {
  user: '上传爆款要点 / 范文 / 反例 → LLM 自动结构化 → 项目设置里多选绑定 → 注入 novel.* 节点',
  feedback: '章节预览里点「👎 不满意」累积反馈 → 攒 ≥3 条后一键汇总成偏好资料注入下次生成',
  builtin: '系统内置的写作 / 视觉 / 镜头红线，由「设置 → 启用增强知识库注入」自动喂给 LLM',
};

export function KnowledgeBase() {
  const [tab, setTab] = useState<KbTab>('user'); // 默认进入"我的资料库"，更符合 v2 主使用场景

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 tab 栏 */}
      <nav className="border-b border-border-subtle px-4 flex items-center gap-1 shrink-0">
        <TabButton active={tab === 'user'} onClick={() => setTab('user')}>
          <Upload className="size-3.5" /> 我的资料库
          <span className="text-[10px] text-fg-muted ml-1">v2</span>
        </TabButton>
        <TabButton active={tab === 'feedback'} onClick={() => setTab('feedback')}>
          <ThumbsDown className="size-3.5" /> 章节反馈
        </TabButton>
        <TabButton active={tab === 'builtin'} onClick={() => setTab('builtin')}>
          <Library className="size-3.5" /> 内置 KB
        </TabButton>
        <div className="ml-auto text-[11px] text-fg-muted py-2 truncate">
          {TAB_HINTS[tab]}
        </div>
      </nav>

      <div className="flex-1 min-h-0">
        {tab === 'builtin' && <BuiltinKbView />}
        {tab === 'user' && <UserKbLibrary />}
        {tab === 'feedback' && <FeedbackInsights />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-2 text-xs flex items-center gap-1.5 border-b-2 -mb-px transition-colors',
        active
          ? 'border-brand-500 text-fg-primary'
          : 'border-transparent text-fg-secondary hover:text-fg-primary',
      )}
    >
      {children}
    </button>
  );
}

/* ──────────────────────────── 内置 KB 视图（保留旧版逻辑） ──────────────────────────── */

function BuiltinKbView() {
  const [manifest, setManifest] = useState<KbManifest | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState<string>('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadKbManifest()
      .then((m) => {
        setManifest(m);
        if (m.items[0]) setActiveId(m.items[0].id);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    loadKbContent(activeId)
      .then(setContent)
      .catch((e) => setContent('# 加载失败\n\n' + (e.message ?? e)))
      .finally(() => setLoading(false));
  }, [activeId]);

  if (error) {
    return (
      <div className="m-6 card border-warning/40 bg-warning/5 p-4 text-sm">
        <strong className="text-warning flex items-center gap-1.5">
          <AlertTriangle className="size-4" /> 加载 KB manifest 失败
        </strong>
        <p className="text-fg-secondary mt-1">{error}</p>
      </div>
    );
  }
  if (!manifest) return <div className="p-8 text-fg-muted">加载…</div>;

  const activeItem = manifest.items.find((i) => i.id === activeId);

  return (
    <div className="h-full flex">
      <aside className="w-64 border-r border-border-subtle flex flex-col shrink-0">
        <header className="px-4 py-3 border-b border-border-subtle">
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary-500" /> 内置知识库
          </h1>
          <p className="text-[11px] text-fg-muted mt-0.5">{manifest.source}</p>
        </header>
        <ul className="flex-1 overflow-auto p-2 space-y-0.5">
          {manifest.items.map((it) => (
            <KbListItem key={it.id} item={it} active={it.id === activeId}
                        onClick={() => setActiveId(it.id)} />
          ))}
        </ul>
        <footer className="px-3 py-2 border-t border-border-subtle text-[11px] text-fg-muted">
          共 {manifest.items.length} 篇
        </footer>
      </aside>

      <main className="flex-1 overflow-auto">
        {activeItem && (
          <header className="px-6 py-4 border-b border-border-subtle sticky top-0 bg-canvas/80 backdrop-blur z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{activeItem.title}</h2>
              <CategoryBadge cat={activeItem.category} />
              <code className="text-[11px] text-fg-muted font-mono">{activeItem.file}</code>
            </div>
            <p className="text-xs text-fg-secondary mt-1">{activeItem.summary}</p>
          </header>
        )}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              <Loader2 className="size-4 animate-spin" /> 加载中…
            </div>
          ) : (
            <MarkdownView content={content} />
          )}
        </div>
      </main>
    </div>
  );
}

function KbListItem({ item, active, onClick }: { item: KbItem; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={clsx(
          'w-full text-left rounded-md px-3 py-2 text-xs transition-colors',
          active ? 'bg-elevated text-fg-primary' : 'text-fg-secondary hover:bg-surface',
        )}
      >
        <div className="flex items-center gap-2">
          <CategoryDot cat={item.category} />
          <span className="font-medium truncate">{item.title}</span>
        </div>
      </button>
    </li>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const m = CATEGORY_META[cat];
  if (!m) return null;
  return (
    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', m.color)}>{m.label}</span>
  );
}
function CategoryDot({ cat }: { cat: string }) {
  const m = CATEGORY_META[cat];
  return <span className={clsx('size-1.5 rounded-full shrink-0',
    m ? m.color.split(' ')[0] : 'bg-zinc-700')} />;
}
