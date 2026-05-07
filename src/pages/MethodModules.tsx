// MethodModules page · ui-v1-asset-routing epic PR-1
//
// 全局浏览 public/methods/ 下的 74 个方法论模块。与 /kb 内置 KB 视图同模式：
//   - 顶部：搜索框 + category 过滤 tab
//   - 左侧：modules 列表（按 category 着色点）
//   - 右侧：详情（title + category 徽章 + injectsTo + 完整 markdown）
//
// CK 不变量：
//   - I-1/I-2 不改现有 router / Layout 的路径语义
//   - 仅读 manifest + content · 不写（opt-out: 用户在 MethodModulePanel 里选模块）

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Brain, Search, AlertTriangle, Loader2 } from 'lucide-react';
import {
  loadMethodModuleManifest,
  loadMethodModuleContent,
  type MethodModuleItem,
  type MethodModuleManifest,
} from '../pipeline/methodModules';
import { MarkdownView } from '../components/MarkdownView';

/** category → 中文 label + 徽章配色。未知 category 回退到灰色。 */
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  character:  { label: '人物',     color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  structure:  { label: '结构',     color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  writing:    { label: '写作',     color: 'bg-danger/20 text-danger border-danger/40' },
  shot:       { label: '镜头',     color: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  combat:     { label: '打斗',     color: 'bg-warning/20 text-warning border-warning/40' },
  asset:      { label: '资产',     color: 'bg-success/20 text-success border-success/40' },
  adaptation: { label: '改编',     color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  audio:      { label: '音频',     color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  workflow:   { label: '工作流',   color: 'bg-neutral-500/20 text-fg-secondary border-zinc-500/40' },
  engine:     { label: '引擎',     color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  world:      { label: '世界观',   color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  plot:       { label: '情节',     color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
};

export function MethodModules() {
  const [manifest, setManifest] = useState<MethodModuleManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // 加载 manifest（仅 1 次）
  useEffect(() => {
    loadMethodModuleManifest()
      .then((m) => {
        setManifest(m);
        if (m.modules[0]) setActiveId(m.modules[0].id);
      })
      .catch((e: unknown) => setManifestError((e as Error)?.message ?? String(e)));
  }, []);

  // 加载选中 module 的 markdown 内容
  useEffect(() => {
    if (!activeId) return;
    setContentLoading(true);
    loadMethodModuleContent(activeId)
      .then(setContent)
      .catch((e: unknown) => setContent('# 加载失败\n\n' + ((e as Error)?.message ?? String(e))))
      .finally(() => setContentLoading(false));
  }, [activeId]);

  // 提取 category 列表（动态 · 避免硬编码 74 modules 的分类）
  const categories = useMemo(() => {
    if (!manifest) return [] as string[];
    return Array.from(new Set(manifest.modules.map((m) => m.category))).sort();
  }, [manifest]);

  // 过滤（category + 搜索）
  const filtered = useMemo(() => {
    if (!manifest) return [] as MethodModuleItem[];
    const q = search.trim().toLowerCase();
    return manifest.modules.filter((m) => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.summary.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [manifest, search, activeCategory]);

  if (manifestError) {
    return (
      <div className="m-6 card border-warning/40 bg-warning/5 p-4 text-sm">
        <strong className="text-warning flex items-center gap-1.5">
          <AlertTriangle className="size-4" /> 加载方法论 manifest 失败
        </strong>
        <p className="text-fg-secondary mt-1">{manifestError}</p>
      </div>
    );
  }
  if (!manifest) return <div className="p-8 text-fg-muted">加载…</div>;

  const activeItem = activeId ? manifest.modules.find((m) => m.id === activeId) ?? null : null;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 · 搜索 + category tabs */}
      <header className="border-b border-border-subtle px-4 py-2 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary-500 shrink-0" />
          <h1 className="text-sm font-semibold">方法论模块库</h1>
          <span className="text-tight-sm text-fg-muted ml-2">{manifest.modules.length} 篇 · 共 {categories.length} 类</span>
          <div className="ml-auto relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题 / 摘要 / id"
              className="pl-7 pr-3 py-1 text-xs rounded border border-border-subtle bg-surface w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <CategoryTab label="全部" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} count={manifest.modules.length} />
          {categories.map((cat) => (
            <CategoryTab
              key={cat}
              label={CATEGORY_META[cat]?.label ?? cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              count={manifest.modules.filter((m) => m.category === cat).length}
              color={CATEGORY_META[cat]?.color}
            />
          ))}
        </div>
      </header>

      {/* 主区 · 左列表 + 右详情 */}
      <div className="flex-1 min-h-0 flex">
        <aside className="w-72 border-r border-border-subtle flex flex-col shrink-0">
          <ul className="flex-1 overflow-auto p-2 space-y-0.5">
            {filtered.length === 0 ? (
              <li className="p-4 text-xs text-fg-muted italic text-center">无匹配模块</li>
            ) : filtered.map((m) => (
              <ModuleListItem key={m.id} item={m} active={m.id === activeId} onClick={() => setActiveId(m.id)} />
            ))}
          </ul>
          <footer className="px-3 py-2 border-t border-border-subtle text-tight-sm text-fg-muted">
            显示 {filtered.length} / {manifest.modules.length}
          </footer>
        </aside>

        <main className="flex-1 overflow-auto">
          {activeItem ? (
            <>
              <header className="px-6 py-4 border-b border-border-subtle sticky top-0 bg-canvas/80 backdrop-blur z-10">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold">{activeItem.title}</h2>
                  <CategoryBadge cat={activeItem.category} />
                  <code className="text-tight-sm text-fg-muted font-mono">{activeItem.id}</code>
                  <span className="text-tight-sm text-fg-muted">~{activeItem.estimatedTokens} tokens</span>
                </div>
                <p className="text-xs text-fg-secondary mt-2">{activeItem.summary}</p>
                <div className="mt-2 flex items-center gap-1 flex-wrap text-tight-xs text-fg-muted">
                  <span>注入节点：</span>
                  {activeItem.injectsTo.length === 0 ? <em>（未指定）</em> : activeItem.injectsTo.map((n) => (
                    <code key={n} className="px-1.5 py-0.5 rounded bg-elevated font-mono">{n}</code>
                  ))}
                </div>
                {activeItem.conflictsWith && activeItem.conflictsWith.length > 0 && (
                  <div className="mt-1 flex items-center gap-1 flex-wrap text-tight-xs text-warning">
                    <span>互斥：</span>
                    {activeItem.conflictsWith.map((id) => (
                      <code key={id} className="px-1.5 py-0.5 rounded bg-warning/10 font-mono">{id}</code>
                    ))}
                  </div>
                )}
              </header>
              <div className="p-6">
                {contentLoading ? (
                  <div className="flex items-center gap-2 text-sm text-fg-muted">
                    <Loader2 className="size-4 animate-spin" /> 加载中…
                  </div>
                ) : (
                  <MarkdownView content={content} />
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-fg-muted text-sm">从左侧选择一个模块查看详情</div>
          )}
        </main>
      </div>
    </div>
  );
}

function CategoryTab(props: { label: string; active: boolean; onClick: () => void; count: number; color?: string }) {
  const { label, active, onClick, count, color } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'text-tight-sm px-2 py-1 rounded border transition-colors',
        active
          ? (color ?? 'bg-primary-500/20 text-primary-300 border-primary-500/40')
          : 'border-border-subtle text-fg-muted hover:text-fg-primary hover:bg-surface',
      )}
    >
      {label} <span className="text-tight-xs opacity-70">{count}</span>
    </button>
  );
}

function ModuleListItem(props: { item: MethodModuleItem; active: boolean; onClick: () => void }) {
  const { item, active, onClick } = props;
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
        <div className="text-tight-xs text-fg-muted mt-0.5 line-clamp-1">{item.summary}</div>
      </button>
    </li>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const m = CATEGORY_META[cat];
  if (!m) return <span className="text-tight-xs px-1.5 py-0.5 rounded border border-border-subtle text-fg-muted">{cat}</span>;
  return <span className={clsx('text-tight-xs px-1.5 py-0.5 rounded border', m.color)}>{m.label}</span>;
}

function CategoryDot({ cat }: { cat: string }) {
  const m = CATEGORY_META[cat];
  const color = m?.color?.split(' ').find((c) => c.startsWith('bg-')) ?? 'bg-neutral-500/30';
  return <span className={clsx('size-2 rounded-full shrink-0', color)} />;
}
