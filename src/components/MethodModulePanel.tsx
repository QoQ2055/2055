/**
 * 资料库 v2 P2 · 方法论模块多选面板
 *
 * 与 UserKbBindingPanel 并列：让用户在 NovelSettingsDialog 里启用方法论模块
 * （MBTI 五步法 / Save the Cat 等）。最多启用 3 个，互斥关系自动处理。
 */

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BookMarked, ToggleLeft, ToggleRight, AlertTriangle, Sparkles, Loader2, Bot, Ban, ShieldAlert, CheckCircle2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import {
  loadMethodModuleManifest,
  validateMethodModuleGenres,
  type MethodModuleItem,
  type MethodModuleManifest,
  type GenreCompatIssue,
} from '../pipeline/methodModules';
import {
  recommendMethodModules,
  recommendMethodModulesLLM,
  mergeRecommendations,
  recommendationStrength,
  applyGenreCompatToRecommendations,
  type ModuleRecommendation,
} from '../pipeline/methodModuleRecommend';
import type { ProjectContext } from '../pipeline/types';
import { useSettings } from '../store/settings';
import { findGenre } from '../data/projectTaxonomy';

/** 把 genre value 列表渲染成中文 label（找不到回退原 value） */
function genresToLabels(values: string[]): string {
  return values.map((v) => findGenre(v)?.label ?? v).join(' / ');
}

/** 返回某模块对当前用户题材的兼容性等级（用于单条徽章） */
function getModuleCompatLevel(
  mod: MethodModuleItem,
  userGenres: string[],
): { level: 'incompatible' | 'warning' | 'recommended' | 'none'; hits: string[] } {
  if (!mod.genreCompat || userGenres.length === 0) return { level: 'none', hits: [] };
  const incompat = (mod.genreCompat.incompatible ?? []).filter((g) => userGenres.includes(g));
  if (incompat.length > 0) return { level: 'incompatible', hits: incompat };
  const warn = (mod.genreCompat.warnOnEnable ?? []).filter((g) => userGenres.includes(g));
  if (warn.length > 0) return { level: 'warning', hits: warn };
  const rec = (mod.genreCompat.recommended ?? []).filter((g) => userGenres.includes(g));
  if (rec.length > 0) return { level: 'recommended', hits: rec };
  return { level: 'none', hits: [] };
}

const MAX_ENABLED = 3;

/** category id → 中文 label。manifest 中目前 6 类。 */
const CATEGORY_LABELS: Record<string, string> = {
  character: '角色',
  structure: '结构',
  rhythm: '节奏',
  craft: '文笔',
  driver: '驱动',
  dream: '意境',
};

/** category 排序顺序（推荐分组显示顺序）。 */
const CATEGORY_ORDER = ['structure', 'character', 'rhythm', 'craft', 'driver', 'dream'];

interface Props {
  value: string[]; // enabled module ids
  onChange: (next: string[]) => void;
  collapsed?: boolean;
  /** P9-C 推荐引擎输入：传入项目 ctx 后，面板会高亮推荐模块并提供一键应用 */
  ctx?: Partial<ProjectContext>;
}

export function MethodModulePanel({ value, onChange, collapsed = false, ctx }: Props) {
  const [modules, setModules] = useState<MethodModuleItem[]>([]);
  const [manifest, setManifest] = useState<MethodModuleManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!collapsed);
  // P9-F LLM 推荐状态
  const [llmRecs, setLlmRecs] = useState<ModuleRecommendation[]>([]);
  const [llmRunning, setLlmRunning] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  // gap-f 后续 · 微 PR：搜索 + category 分组
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const settings = useSettings();

  useEffect(() => {
    loadMethodModuleManifest()
      .then((m) => {
        setModules(m.modules);
        setManifest(m);
      })
      .finally(() => setLoading(false));
  }, []);

  // P9-C 计算推荐列表（只在提供了 ctx 且存在可用模块时才计算）
  const recommendations: ModuleRecommendation[] = useMemo(() => {
    if (!ctx || modules.length === 0) return [];
    const heuristic = recommendMethodModules(ctx);
    // 过滤：manifest 里不存在的 id 跳过
    const known = new Set(modules.map((m) => m.id));
    const filtered = heuristic.filter((r) => known.has(r.id));
    // P9-F 与 LLM 推荐合并（如果已运行过）
    const merged = llmRecs.length > 0 ? mergeRecommendations(filtered, llmRecs) : filtered;
    // v2 阶段 2.3 · 应用题材兼容性矩阵后处理
    return manifest ? applyGenreCompatToRecommendations(merged, ctx, manifest) : merged;
  }, [ctx, modules, llmRecs, manifest]);

  // v2 阶段 2.3 · 已启用模块 × 用户题材 兼容性问题列表
  const compatIssues: GenreCompatIssue[] = useMemo(() => {
    if (!manifest || !ctx?.genres?.length) return [];
    return validateMethodModuleGenres(value, ctx.genres, manifest);
  }, [value, ctx?.genres, manifest]);

  // ctx 变化时，LLM 结果应丢弃（避免垃圾推荐贯穿）
  // 使用 useMemo 计算 ctx 签名，避免过度重置
  const ctxFingerprint = ctx ? JSON.stringify(ctx) : '';
  useEffect(() => {
    setLlmRecs([]);
    setLlmError(null);
  }, [ctxFingerprint]);
  const recById = useMemo(() => {
    const map = new Map<string, ModuleRecommendation>();
    for (const r of recommendations) map.set(r.id, r);
    return map;
  }, [recommendations]);

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    if (value.length >= MAX_ENABLED) return;
    // 处理互斥
    const target = modules.find((m) => m.id === id);
    if (!target) return;
    const next = value.filter((v) => !target.conflictsWith.includes(v));
    onChange([...next, id]);
  }

  /** 一键应用推荐：取推荐列表中强推荐 / 中推荐的前 N 个，自动处理互斥 */
  function applyRecommended() {
    if (recommendations.length === 0) return;
    const enabled: string[] = [];
    const blocked = new Set<string>();
    // 优先取 score>=65 的；最多 MAX_ENABLED 个
    // v2 阶段 2.3 · 经过 applyGenreCompatToRecommendations 后，incompatible 模块分数已被压到 25
    // 因此自然会被 score < 65 过滤掉，无需额外判断
    for (const r of recommendations) {
      if (r.score < 65) break;
      if (enabled.length >= MAX_ENABLED) break;
      if (blocked.has(r.id)) continue;
      const mod = modules.find((m) => m.id === r.id);
      if (!mod) continue;
      enabled.push(r.id);
      for (const c of mod.conflictsWith) blocked.add(c);
    }
    if (enabled.length > 0) onChange(enabled);
  }

  /** P9-F 调用 LLM 补充推荐 */
  async function runLlmRecommend() {
    if (!ctx || modules.length === 0) return;
    if (!settings.apiKey) {
      setLlmError('请先在「设置」页填入 API Key');
      return;
    }
    setLlmRunning(true);
    setLlmError(null);
    try {
      const recs = await recommendMethodModulesLLM({
        ctx,
        modules,
        settings: {
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
        },
      });
      setLlmRecs(recs);
    } catch (e: any) {
      setLlmError(e?.message ?? String(e));
    } finally {
      setLlmRunning(false);
    }
  }

  return (
    <div className="bg-surface/40 border border-border-subtle rounded">
      <div className="flex items-stretch">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-3 py-2 flex items-center gap-2 text-left hover:bg-surface/60 transition-colors rounded"
        >
          <BookMarked className="size-4 text-warning shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-fg-primary">方法论模块</div>
            <div className="text-tight-sm text-fg-muted mt-0.5">
              {loading ? '加载中…' : (
                modules.length === 0
                  ? '暂无可用方法论模块'
                  : `已启用 ${value.length}/${MAX_ENABLED} · 共 ${modules.length} 个可选${recommendations.length > 0 ? ` · 💡 ${recommendations.filter((r) => r.score >= 65).length} 个推荐` : ''}`
              )}
            </div>
          </div>
          <span className="text-fg-muted text-xs">{expanded ? '▾' : '▸'}</span>
        </button>
        {/* P9-F 调用 LLM 补充推荐 */}
        {ctx && modules.length > 0 && (
          <button
            onClick={runLlmRecommend}
            disabled={llmRunning}
            className="text-tight-xs px-2 my-1.5 mr-1 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 flex items-center gap-1 disabled:opacity-60"
            title="调用 LLM 读取「核心冲突 / logline」等自由文本后给出补充推荐（~ 800 token）"
          >
            {llmRunning ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
            {llmRecs.length > 0 ? `LLM 已补充 ${llmRecs.length}` : 'LLM 推荐'}
          </button>
        )}
        {/* P9-C 一键应用推荐 */}
        {recommendations.some((r) => r.score >= 65) && (
          <button
            onClick={applyRecommended}
            className="text-tight-xs px-2 my-1.5 mr-1.5 rounded border border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 flex items-center gap-1"
            title="一键应用推荐：取推荐分≥ 65 的前 3 个模块，自动处理互斥"
          >
            <Sparkles className="size-3" /> 一键应用推荐
          </button>
        )}
      </div>
      {llmError && (
        <div className="px-3 py-1.5 text-tight-sm text-danger border-t border-border-subtle/50 flex items-center gap-1">
          <AlertTriangle className="size-3" /> {llmError}
        </div>
      )}

      {/* v2 阶段 2.3 · 题材兼容性警示横幅（仅在已启用模块发生冲突时显示） */}
      {compatIssues.length > 0 && (
        <div className="px-3 py-2 border-t border-border-subtle/50 space-y-1">
          {compatIssues.map((it) => {
            const mod = modules.find((m) => m.id === it.moduleId);
            const isRed = it.level === 'incompatible';
            return (
              <div
                key={it.moduleId}
                className={clsx(
                  'text-tight-sm px-2 py-1 rounded flex items-start gap-1.5 border',
                  isRed
                    ? 'bg-danger/10 border-danger/40 text-danger'
                    : 'bg-warning/10 border-warning/40 text-warning',
                )}
              >
                {isRed ? (
                  <Ban className="size-3.5 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="font-medium">{mod?.title ?? it.moduleId}</span>
                  <span className="opacity-80">
                    {' '}{isRed ? '与' : '在'}题材[{genresToLabels(it.conflictingGenres)}]
                    {isRed ? '冲突' : '下兼容性较弱'}，
                    {isRed ? '建议关闭或换题材' : '可继续使用但产出可能不理想'}
                  </span>
                </div>
                <button
                  onClick={() => onChange(value.filter((v) => v !== it.moduleId))}
                  className="text-tight-xs px-1.5 py-0.5 rounded border border-current/40 hover:bg-current/10 shrink-0"
                  title="取消启用该模块"
                >
                  关闭
                </button>
              </div>
            );
          })}
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border-subtle/50 space-y-1.5">
          {loading && <div className="text-tight-sm text-fg-muted">加载中…</div>}

          {!loading && modules.length === 0 && (
            <div className="text-tight-sm text-fg-muted italic py-2">
              暂无方法论模块（请检查 public/methods/manifest.json 是否存在）
            </div>
          )}

          {/* 搜索框 · 实时过滤 title / summary / id */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模块（标题 / 简介 / id）..."
              className="w-full bg-surface border border-border-subtle rounded pl-7 pr-2 py-1.5 text-tight-sm focus:border-warning/40 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-tight-xs text-fg-muted hover:text-fg-secondary"
                title="清空搜索"
              >×</button>
            )}
          </div>

          {(() => {
            const sorted = modules
              .slice()
              .sort((a, b) => (recById.get(b.id)?.score ?? 0) - (recById.get(a.id)?.score ?? 0));
            const q = search.trim().toLowerCase();
            const filtered = q
              ? sorted.filter((m) =>
                  m.id.toLowerCase().includes(q)
                  || m.title.toLowerCase().includes(q)
                  || m.summary.toLowerCase().includes(q),
                )
              : sorted;

            if (filtered.length === 0) {
              return (
                <div className="text-tight-sm text-fg-muted italic py-2">
                  {q ? `无匹配「${search}」的模块` : '暂无可用模块'}
                </div>
              );
            }

            // 单条 module 的渲染（与原逻辑保持一致）
            const renderModule = (mod: MethodModuleItem) => {
              const checked = value.includes(mod.id);
              const isFull = !checked && value.length >= MAX_ENABLED;
              const conflictsActive = mod.conflictsWith.some((c) => value.includes(c));
              const rec = recById.get(mod.id);
              const strength = rec ? recommendationStrength(rec.score) : 'none';
              const compat = ctx?.genres?.length
                ? getModuleCompatLevel(mod, ctx.genres)
                : { level: 'none' as const, hits: [] };
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => !isFull && toggle(mod.id)}
                  disabled={isFull && !checked}
                  className={clsx(
                    'w-full text-left px-2.5 py-2 rounded text-tight-sm transition-colors',
                    checked && compat.level === 'incompatible'
                      ? 'bg-danger/15 border border-danger/50 text-danger-100'
                      : checked && compat.level === 'warning'
                        ? 'bg-warning/15 border border-warning/60 text-warning-100'
                        : checked
                          ? 'bg-warning/15 border border-warning/40 text-warning-100'
                          : compat.level === 'incompatible'
                            ? 'border border-danger/30 bg-danger/5 hover:bg-danger/10'
                            : strength === 'strong'
                              ? 'border border-warning/30 bg-warning/5 hover:bg-warning/10'
                              : strength === 'mild'
                                ? 'border border-border-default/50 hover:bg-surface'
                                : 'border border-transparent hover:bg-surface',
                    (isFull && !checked) && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {checked ? (
                      <ToggleRight className="size-3.5 shrink-0 text-warning mt-0.5" />
                    ) : (
                      <ToggleLeft className="size-3.5 shrink-0 text-fg-muted mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-1.5 flex-wrap">
                        <span>{mod.title}</span>
                        {strength === 'strong' && (
                          <span
                            className="text-tight-2xs px-1 py-0 rounded bg-warning/20 text-warning border border-warning/40"
                            title={rec?.reason}
                          >💡 强推荐 {rec!.score}</span>
                        )}
                        {strength === 'mild' && (
                          <span
                            className="text-tight-2xs px-1 py-0 rounded bg-neutral-700/40 text-fg-secondary border border-neutral-600/40"
                            title={rec?.reason}
                          >💡 推荐 {rec!.score}</span>
                        )}
                        {rec?.source === 'llm' && (
                          <span
                            className="text-tight-2xs px-1 py-0 rounded bg-blue-500/15 text-blue-300 border border-blue-500/40 flex items-center gap-0.5"
                            title="LLM 背书推荐"
                          ><Bot className="size-2.5" /> AI</span>
                        )}
                        {compat.level === 'incompatible' && (
                          <span
                            className="text-tight-2xs px-1 py-0 rounded bg-danger/15 text-danger border border-danger/40 flex items-center gap-0.5"
                            title={`与题材 [${genresToLabels(compat.hits)}] 语义冲突；启用后产出可能严重违和`}
                          ><Ban className="size-2.5" /> 题材冲突</span>
                        )}
                        {compat.level === 'warning' && (
                          <span
                            className="text-tight-2xs px-1 py-0 rounded bg-warning/10 text-warning border border-warning/30 flex items-center gap-0.5"
                            title={`在题材 [${genresToLabels(compat.hits)}] 下兼容性较弱，可继续使用但需注意`}
                          ><ShieldAlert className="size-2.5" /> 兼容弱</span>
                        )}
                        {compat.level === 'recommended' && (
                          <span
                            className="text-tight-2xs px-1 py-0 rounded bg-success/10 text-success border border-success/30 flex items-center gap-0.5"
                            title={`与题材 [${genresToLabels(compat.hits)}] 高度契合`}
                          ><CheckCircle2 className="size-2.5" /> 题材契合</span>
                        )}
                      </div>
                      <div className="text-tight-xs text-fg-secondary mt-0.5">{mod.summary}</div>
                      {rec && rec.score >= 65 && (
                        <div className="text-tight-xs text-warning/90 mt-0.5 italic">» {rec.reason}</div>
                      )}
                      <div className="text-tight-xs text-fg-muted mt-1 flex items-center gap-2">
                        <span>📍 注入到 {mod.injectsTo.join(', ')}</span>
                        <span>· ~{mod.estimatedTokens} tokens</span>
                        {conflictsActive && !checked && (
                          <span className="flex items-center gap-0.5 text-warning">
                            <AlertTriangle className="size-3" /> 启用后会替换冲突模块
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            };

            // 搜索时 → 平铺过滤结果（不分组）
            if (q) {
              return (
                <>
                  <div className="text-tight-xs text-fg-muted px-1">
                    匹配 {filtered.length} / {sorted.length} 个模块
                  </div>
                  {filtered.map(renderModule)}
                </>
              );
            }

            // 无搜索 → 按 category 分组渲染
            const grouped = new Map<string, MethodModuleItem[]>();
            for (const m of filtered) {
              const cat = m.category || 'other';
              if (!grouped.has(cat)) grouped.set(cat, []);
              grouped.get(cat)!.push(m);
            }
            // 按 CATEGORY_ORDER 排序 · 未列出的 category 追加在后
            const orderedCats = [
              ...CATEGORY_ORDER.filter((c) => grouped.has(c)),
              ...Array.from(grouped.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
            ];

            return orderedCats.map((cat) => {
              const items = grouped.get(cat) ?? [];
              const collapsed = collapsedCategories.has(cat);
              const label = CATEGORY_LABELS[cat] ?? cat;
              const enabledCount = items.filter((m) => value.includes(m.id)).length;
              const recommendedCount = items.filter((m) => (recById.get(m.id)?.score ?? 0) >= 65).length;
              return (
                <div key={cat} className="border-t border-border-subtle/30 first:border-t-0 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCollapsedCategories((prev) => {
                        const next = new Set(prev);
                        if (collapsed) next.delete(cat); else next.add(cat);
                        return next;
                      });
                    }}
                    className="w-full flex items-center gap-1.5 px-1 py-1 text-tight-xs text-fg-secondary hover:bg-surface/40 rounded"
                  >
                    {collapsed ? <ChevronRight className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
                    <span className="font-medium">{label}</span>
                    <span className="text-fg-muted">({items.length})</span>
                    {enabledCount > 0 && (
                      <span className="text-warning ml-1">已启用 {enabledCount}</span>
                    )}
                    {recommendedCount > 0 && (
                      <span className="text-warning/80 ml-1">💡 推荐 {recommendedCount}</span>
                    )}
                  </button>
                  {!collapsed && (
                    <div className="space-y-1.5 mt-0.5">{items.map(renderModule)}</div>
                  )}
                </div>
              );
            });
          })()}

          {value.length >= MAX_ENABLED && (
            <div className="text-tight-xs text-warning/80 italic mt-2">
              已达启用上限（{MAX_ENABLED} 个）。继续启用前请先取消勾选其他模块。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
