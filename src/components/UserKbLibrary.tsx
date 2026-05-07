/**
 * 资料库 v2 · 「我的资料库」主面板
 *
 * 功能：
 *  - 顶部「+ 上传文档」按钮 → 打开 UserKbUploadDialog
 *  - 类型筛选标签（全部 / 趋势 / 范文 / 反例 / 偏好）
 *  - 列表卡片，每张展示：标题 + 类型 + 提炼概要 + 启用开关 + 编辑/删除
 *  - 点击卡片右侧「查看」展开右侧详情面板（结构化 JSON 预览）
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, FileText, RefreshCw, ToggleLeft, ToggleRight, Loader2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import {
  listUserKbDocs,
  deleteUserKbDoc,
  updateUserKbDoc,
  USER_KB_TYPE_META,
  type UserKbDoc,
  type UserKbDocType,
} from '../store/userKb';
import { UserKbUploadDialog } from './UserKbUploadDialog';
import { MarkdownView } from './MarkdownView';
import { confirm as confirmDialog } from '../store/confirm';

const TYPE_FILTER_OPTIONS: Array<{ value: UserKbDocType | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'trend', label: '趋势' },
  { value: 'sample', label: '范文' },
  { value: 'antiPattern', label: '反例' },
  { value: 'styleGuide', label: '偏好' },
  { value: 'worldHardSchema', label: '世界' },
  { value: 'voiceCard', label: '声纹' },
  { value: 'bookAnalysis', label: '拆书' },
];

export function UserKbLibrary() {
  const [docs, setDocs] = useState<UserKbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserKbDocType | 'all'>('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadInitialType, setUploadInitialType] = useState<UserKbDocType>('trend');
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const list = await listUserKbDocs();
      setDocs(list);
      if (list[0] && activeId == null) setActiveId(list[0].id ?? null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return docs;
    return docs.filter((d) => d.type === filter);
  }, [docs, filter]);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeId) ?? null,
    [docs, activeId],
  );

  async function toggleEnabled(d: UserKbDoc) {
    if (d.id == null) return;
    await updateUserKbDoc(d.id, { enabled: !d.enabled });
    refresh();
  }

  async function handleDelete(d: UserKbDoc) {
    if (d.id == null) return;
    const ok = await confirmDialog({
      title: `删除「${d.title}」？`,
      message: '所有项目里对该资料的绑定会自动失效（保留为悬空引用 · 无副作用）。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await deleteUserKbDoc(d.id);
    if (activeId === d.id) setActiveId(null);
    refresh();
  }

  function openUpload(type: UserKbDocType = 'trend') {
    setUploadInitialType(type);
    setUploadOpen(true);
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-fg-muted flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> 加载资料库…
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex">
        {/* 列表侧 */}
        <aside className="w-80 border-r border-border-subtle flex flex-col shrink-0">
          <header className="px-3 py-2.5 border-b border-border-subtle flex items-center gap-2">
            <button
              onClick={() => openUpload('trend')}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Plus className="size-3" /> 上传文档
            </button>
            <span className="text-tight-sm text-fg-muted ml-auto">
              共 {docs.length} 条 · 启用 {docs.filter((d) => d.enabled).length}
            </span>
          </header>
          {/* 类型筛选 */}
          <div className="px-2 pt-2 pb-1 flex flex-wrap gap-1 border-b border-border-subtle">
            {TYPE_FILTER_OPTIONS.map((opt) => {
              const count = opt.value === 'all'
                ? docs.length
                : docs.filter((d) => d.type === opt.value).length;
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={clsx(
                    'text-tight-sm px-2 py-0.5 rounded border transition-colors',
                    filter === opt.value
                      ? 'border-brand-500 bg-primary-500/15 text-brand-300'
                      : 'border-border-default text-fg-secondary hover:text-fg-primary',
                  )}
                >
                  {opt.label} {count > 0 && <span className="opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="m-2 card border-warning/40 bg-warning/5 p-2 text-xs">
              <strong className="text-warning flex items-center gap-1">
                <AlertTriangle className="size-3.5" /> 加载失败
              </strong>
              <p className="text-fg-secondary mt-1">{error}</p>
            </div>
          )}

          <ul className="flex-1 overflow-auto p-2 space-y-1">
            {filtered.length === 0 && (
              <li className="text-xs text-fg-muted italic px-3 py-4 text-center">
                {docs.length === 0
                  ? '资料库为空。点击上方「上传文档」开始，或选下面任一类型快速创建：'
                  : `当前筛选下没有资料`}
                {docs.length === 0 && (
                  <div className="flex flex-wrap gap-1 justify-center mt-3">
                    {(['trend', 'sample', 'antiPattern'] as UserKbDocType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => openUpload(t)}
                        className="text-tight-sm px-2 py-0.5 rounded bg-elevated hover:bg-neutral-700"
                      >
                        + {USER_KB_TYPE_META[t].shortLabel}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            )}
            {filtered.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setActiveId(d.id ?? null)}
                  className={clsx(
                    'w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors group',
                    activeId === d.id ? 'bg-elevated' : 'hover:bg-surface',
                    !d.enabled && 'opacity-50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{USER_KB_TYPE_META[d.type].label.split(' ')[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="text-tight-xs text-fg-muted mt-0.5 truncate">
                        {USER_KB_TYPE_META[d.type].shortLabel}
                        {d.tags.length > 0 && <span className="ml-1">· {d.tags.join('/')}</span>}
                        <span className="ml-1">· {new Date(d.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* 详情侧 */}
        <main className="flex-1 overflow-auto">
          {activeDoc ? (
            <DocDetail
              doc={activeDoc}
              onToggle={() => toggleEnabled(activeDoc)}
              onDelete={() => handleDelete(activeDoc)}
              onRefresh={refresh}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-fg-muted text-sm">
              <FileText className="size-10 mb-3 opacity-30" />
              {docs.length === 0
                ? '上传第一份资料开始用 v2 资料库'
                : '从左侧选择一份资料查看详情'}
            </div>
          )}
        </main>
      </div>

      {uploadOpen && (
        <UserKbUploadDialog
          initialType={uploadInitialType}
          onClose={() => setUploadOpen(false)}
          onSaved={() => {
            setUploadOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

/* ──────────────────────────── 详情面板 ──────────────────────────── */

function DocDetail({
  doc,
  onToggle,
  onDelete,
  onRefresh,
}: {
  doc: UserKbDoc;
  onToggle: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'structured' | 'raw' | 'meta'>('structured');
  const meta = USER_KB_TYPE_META[doc.type];

  let structuredPretty = '';
  let parseError = '';
  try {
    const parsed = JSON.parse(doc.structuredJson);
    structuredPretty = renderStructuredAsMarkdown(doc.type, parsed);
  } catch (e: any) {
    parseError = e?.message ?? String(e);
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-border-subtle sticky top-0 bg-canvas/80 backdrop-blur z-10">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0">{meta.label.split(' ')[0]}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{doc.title}</h2>
            <div className="text-xs text-fg-secondary mt-0.5">
              {meta.label} · {doc.source === 'upload' ? `📁 ${doc.sourceFilename ?? '上传'}` : doc.source === 'manual' ? '✍ 手动' : '🤖 自动汇总'}
              <span className="mx-1.5">·</span>
              注入到 <span className="text-fg-secondary">{meta.injectsTo.join('、')}</span>
              {doc.tags.length > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  {doc.tags.map((t) => (
                    <span key={t} className="text-tight-xs px-1.5 py-0.5 mr-1 rounded bg-elevated">{t}</span>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggle}
              className={clsx(
                'btn-ghost text-xs flex items-center gap-1',
                doc.enabled ? 'text-success' : 'text-fg-muted',
              )}
              title={doc.enabled ? '点击禁用（保留资料但不注入到任何 prompt）' : '点击启用'}
            >
              {doc.enabled ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
              {doc.enabled ? '已启用' : '已禁用'}
            </button>
            <button onClick={onRefresh} className="btn-ghost text-xs" title="刷新列表">
              <RefreshCw className="size-3.5" />
            </button>
            <button onClick={onDelete} className="btn-ghost text-xs text-danger hover:text-danger" title="删除">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        {/* tab 切换 */}
        <div className="mt-3 flex items-center gap-3 text-xs">
          <DetailTab active={tab === 'structured'} onClick={() => setTab('structured')}>结构化预览</DetailTab>
          <DetailTab active={tab === 'raw'} onClick={() => setTab('raw')}>原始 JSON</DetailTab>
          <DetailTab active={tab === 'meta'} onClick={() => setTab('meta')}>提炼元信息</DetailTab>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'structured' && (
          parseError ? (
            <div className="card border-warning/40 bg-warning/5 p-3 text-sm">
              <strong className="text-warning">structuredJson 解析失败</strong>
              <p className="text-fg-secondary mt-1">{parseError}</p>
              <p className="text-fg-muted mt-2 text-xs">请到「原始 JSON」页签查看原文，并修正后重新保存。</p>
            </div>
          ) : (
            <MarkdownView content={structuredPretty} />
          )
        )}
        {tab === 'raw' && (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-surface rounded p-3 leading-relaxed">
            {tryFormatJson(doc.structuredJson)}
          </pre>
        )}
        {tab === 'meta' && (
          <div className="text-xs space-y-2 text-fg-secondary">
            <Row label="ID">{doc.id}</Row>
            <Row label="类型">{doc.type} ({meta.shortLabel})</Row>
            <Row label="来源">{doc.source} {doc.sourceFilename && `· ${doc.sourceFilename}`}</Row>
            <Row label="创建时间">{new Date(doc.createdAt).toLocaleString()}</Row>
            <Row label="更新时间">{new Date(doc.updatedAt).toLocaleString()}</Row>
            <Row label="启用">{doc.enabled ? '是' : '否（不参与 prompt 注入）'}</Row>
            {doc.extractMeta && (
              <>
                <Row label="提炼模型">{doc.extractMeta.model}</Row>
                <Row label="提炼耗时">{doc.extractMeta.durationMs}ms</Row>
                <Row label="提炼 tokens">{doc.extractMeta.tokens ?? '-'}</Row>
                <Row label="提炼 prompt">{doc.extractMeta.promptId}</Row>
              </>
            )}
            <Row label="rawContent 长度">{doc.rawContent.length} 字符</Row>
            <Row label="structuredJson 长度">{doc.structuredJson.length} 字符</Row>

            <details className="mt-4">
              <summary className="cursor-pointer text-fg-secondary hover:text-fg-primary">查看原始上传内容（rawContent）</summary>
              <pre className="text-tight-sm font-mono whitespace-pre-wrap break-all bg-surface rounded p-3 mt-2 max-h-96 overflow-auto">
                {doc.rawContent || '(空)'}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-2 py-1 border-b-2 -mb-px transition-colors',
        active ? 'border-brand-500 text-fg-primary' : 'border-transparent text-fg-muted hover:text-fg-secondary',
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-fg-muted w-28 shrink-0">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

function tryFormatJson(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); }
  catch { return s; }
}

/* ─── 把结构化 JSON 渲染成 markdown 供详情面板预览（轻量版，与 buildUserKbPreamble 区分） ─── */
function renderStructuredAsMarkdown(type: UserKbDocType, p: any): string {
  if (!p || typeof p !== 'object') return '_(结构化数据为空)_';
  const lines: string[] = [];
  if (p.summary) lines.push(`## 总览\n\n> ${p.summary}\n`);

  if (type === 'trend') {
    pushList(lines, '热门题材切入', p.hotTropes);
    pushList(lines, '强情绪节点', p.emotionPeaks);
    pushList(lines, '强反转方式', p.reversalTypes);
    pushList(lines, '人设类型', p.characterTypes);
    pushList(lines, '结局方式', p.endingTypes);
    pushList(lines, '⭐ 用户明确喜欢', p.userExplicitLikes);
    pushList(lines, '🚫 用户明确不喜欢', p.userExplicitDislikes);
    pushList(lines, '平台约束', p.platformHints);
  } else if (type === 'sample') {
    if (Array.isArray(p.globalTechniques) && p.globalTechniques.length) {
      lines.push('## 全局技法\n');
      p.globalTechniques.forEach((t: any) => {
        lines.push(`- **${t.name}** _(${(t.applyTo || []).join('/')}) — ${t.id}_`);
        lines.push(`  ${t.explanation}`);
      });
      lines.push('');
    }
    if (Array.isArray(p.samples)) {
      lines.push(`## 范文片段（${p.samples.length} 段）\n`);
      p.samples.forEach((s: any, i: number) => {
        lines.push(`### 片段 ${i + 1}`);
        lines.push(`> ${(s.excerpt ?? '').slice(0, 1000)}\n`);
        if (Array.isArray(s.techniques)) {
          lines.push('**技法标注**：');
          s.techniques.forEach((t: any) => {
            lines.push(`- \`${t.techniqueId}\` — ${t.evidence}`);
          });
        }
        if (s.notes) lines.push(`\n_笔记：${s.notes}_\n`);
      });
    }
  } else if (type === 'antiPattern') {
    if (Array.isArray(p.categories)) {
      p.categories.forEach((cat: any) => {
        lines.push(`## ${cat.name}`);
        if (Array.isArray(cat.patterns)) {
          cat.patterns.forEach((pat: any) => {
            if (typeof pat === 'string') {
              lines.push(`- ${pat}`);
            } else if (pat?.pattern) {
              lines.push(`- **${pat.pattern}**`);
              if (pat.why) lines.push(`  - 为什么烂：${pat.why}`);
              if (pat.betterAlternative) lines.push(`  - 推荐改法：${pat.betterAlternative}`);
            }
          });
        }
        lines.push('');
      });
    }
  } else if (type === 'styleGuide') {
    if (Array.isArray(p.topPainPoints)) {
      lines.push('## Top 痛点\n');
      p.topPainPoints.forEach((pp: any) => {
        lines.push(`### ${pp.rank}. ${pp.issueCategory} _(出现 ${pp.frequency} 次)_`);
        if (pp.description) lines.push(pp.description + '\n');
        if (Array.isArray(pp.concreteExamples)) {
          pp.concreteExamples.forEach((ex: string) => lines.push(`> ${ex}`));
        }
      });
    }
    pushList(lines, '⭐ 明确偏好', p.explicitLikes);
    pushList(lines, '🚫 明确禁忌', p.explicitDislikes);
    if (Array.isArray(p.writingRulesForLLM)) {
      lines.push('## 给 LLM 的硬指令\n');
      p.writingRulesForLLM.forEach((r: string, i: number) => lines.push(`${i + 1}. ${r}`));
    }
  } else if (type === 'bookAnalysis') {
    // 拆书分析：详情面板完整渲染五大模块（与 buildUserKbPreamble 的紧凑版区分）
    if (p.bookMeta) {
      const meta = [p.bookMeta.title, p.bookMeta.author, p.bookMeta.genre].filter(Boolean).join(' · ');
      if (meta) lines.push(`> 📖 ${meta}\n`);
    }
    if (p.methodology) {
      lines.push('## 🎯 核心方法论提炼');
      const m = p.methodology;
      if (m.hookFormula) lines.push(`**钩子配方**：${m.hookFormula}`);
      if (m.conflictModel) lines.push(`**冲突模型**：${m.conflictModel}`);
      if (m.rhythmSignature) lines.push(`**节奏签名**：${m.rhythmSignature}`);
      if (Array.isArray(m.coreCraftPrinciples)) {
        lines.push('\n**核心工艺原则**：');
        m.coreCraftPrinciples.forEach((s: string, i: number) => lines.push(`${i + 1}. ${s}`));
      }
      lines.push('');
    }
    if (p.worldview) {
      lines.push('## 🌍 世界观维度');
      if (p.worldview.summary) lines.push(`**核心定位**：${p.worldview.summary}\n`);
      if (p.worldview.coreRules) lines.push(`**核心规则**：${p.worldview.coreRules}\n`);
      if (p.worldview.tropesAndArchetypes) lines.push(`**题材套路**：${p.worldview.tropesAndArchetypes}\n`);
    }
    if (p.characters) {
      lines.push('## 👤 角色维度');
      if (p.characters.protagonistDesign) lines.push(`**主角设计**：${p.characters.protagonistDesign}\n`);
      if (p.characters.castStructure) lines.push(`**配角结构**：${p.characters.castStructure}\n`);
      if (p.characters.arcMethodology) lines.push(`**弧线设计**：${p.characters.arcMethodology}\n`);
    }
    if (p.plot) {
      lines.push('## 📐 剧情维度');
      if (p.plot.macroStructure) lines.push(`**宏观结构**：${p.plot.macroStructure}\n`);
      if (p.plot.pacingControl) lines.push(`**节奏控制**：${p.plot.pacingControl}\n`);
      if (p.plot.foreshadowingAndPayoff) lines.push(`**伏笔与回收**：${p.plot.foreshadowingAndPayoff}\n`);
      pushList(lines, '关键转折点', p.plot.keyTurningPoints);
    }
    if (Array.isArray(p.positionInsights) && p.positionInsights.length) {
      lines.push('## 📍 位置洞察');
      p.positionInsights.forEach((ins: any) => {
        lines.push(`### [${ins.tag ?? '?'}] ${ins.chapterTitle ?? ''}`);
        if (ins.whyItWorks) lines.push(`**为什么有效**：${ins.whyItWorks}\n`);
        if (ins.transferableTechnique) lines.push(`**可复用技法**：${ins.transferableTechnique}\n`);
      });
    }
  } else {
    lines.push('```json\n' + JSON.stringify(p, null, 2) + '\n```');
  }
  return lines.join('\n');
}

function pushList(lines: string[], title: string, arr: unknown) {
  if (!Array.isArray(arr) || arr.length === 0) return;
  lines.push(`## ${title}\n`);
  arr.forEach((s) => lines.push(`- ${String(s)}`));
  lines.push('');
}
