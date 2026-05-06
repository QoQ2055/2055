/**
 * 资料库 v2 P2 · 方法论模块多选面板
 *
 * 与 UserKbBindingPanel 并列：让用户在 NovelSettingsDialog 里启用方法论模块
 * （MBTI 五步法 / Save the Cat 等）。最多启用 3 个，互斥关系自动处理。
 */

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BookMarked, ToggleLeft, ToggleRight, AlertTriangle, Sparkles, Loader2, Bot, Ban, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
    <div className="bg-zinc-900/40 border border-zinc-800 rounded">
      <div className="flex items-stretch">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-900/60 transition-colors rounded"
        >
          <BookMarked className="size-4 text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-zinc-200">方法论模块</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {loading ? '加载中…' : (
                modules.length === 0
                  ? '暂无可用方法论模块'
                  : `已启用 ${value.length}/${MAX_ENABLED} · 共 ${modules.length} 个可选${recommendations.length > 0 ? ` · 💡 ${recommendations.filter((r) => r.score >= 65).length} 个推荐` : ''}`
              )}
            </div>
          </div>
          <span className="text-zinc-500 text-xs">{expanded ? '▾' : '▸'}</span>
        </button>
        {/* P9-F 调用 LLM 补充推荐 */}
        {ctx && modules.length > 0 && (
          <button
            onClick={runLlmRecommend}
            disabled={llmRunning}
            className="text-[10px] px-2 my-1.5 mr-1 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 flex items-center gap-1 disabled:opacity-60"
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
            className="text-[10px] px-2 my-1.5 mr-1.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"
            title="一键应用推荐：取推荐分≥ 65 的前 3 个模块，自动处理互斥"
          >
            <Sparkles className="size-3" /> 一键应用推荐
          </button>
        )}
      </div>
      {llmError && (
        <div className="px-3 py-1.5 text-[11px] text-rose-300 border-t border-zinc-800/50 flex items-center gap-1">
          <AlertTriangle className="size-3" /> {llmError}
        </div>
      )}

      {/* v2 阶段 2.3 · 题材兼容性警示横幅（仅在已启用模块发生冲突时显示） */}
      {compatIssues.length > 0 && (
        <div className="px-3 py-2 border-t border-zinc-800/50 space-y-1">
          {compatIssues.map((it) => {
            const mod = modules.find((m) => m.id === it.moduleId);
            const isRed = it.level === 'incompatible';
            return (
              <div
                key={it.moduleId}
                className={clsx(
                  'text-[11px] px-2 py-1 rounded flex items-start gap-1.5 border',
                  isRed
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                    : 'bg-amber-500/10 border-amber-500/40 text-amber-200',
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
                  className="text-[10px] px-1.5 py-0.5 rounded border border-current/40 hover:bg-current/10 shrink-0"
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
        <div className="px-3 pb-3 pt-1 border-t border-zinc-800/50 space-y-1.5">
          {loading && <div className="text-[11px] text-zinc-500">加载中…</div>}

          {!loading && modules.length === 0 && (
            <div className="text-[11px] text-zinc-500 italic py-2">
              暂无方法论模块（请检查 public/methods/manifest.json 是否存在）
            </div>
          )}

          {modules
            .slice()
            // 推荐分高的靠前（似推荐分为准，同分后按原顺序）
            .sort((a, b) => (recById.get(b.id)?.score ?? 0) - (recById.get(a.id)?.score ?? 0))
            .map((mod) => {
              const checked = value.includes(mod.id);
              const isFull = !checked && value.length >= MAX_ENABLED;
              const conflictsActive = mod.conflictsWith.some((c) => value.includes(c));
              const rec = recById.get(mod.id);
              const strength = rec ? recommendationStrength(rec.score) : 'none';
              // v2 阶段 2.3 · 题材兼容性等级（独立于推荐分；用于徽章 + 边框配色）
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
                    'w-full text-left px-2.5 py-2 rounded text-[11px] transition-colors',
                    // 已启用 + 题材冲突 → 红框；已启用 + 题材弱兼容 → 黄框
                    checked && compat.level === 'incompatible'
                      ? 'bg-rose-500/15 border border-rose-500/50 text-rose-100'
                      : checked && compat.level === 'warning'
                        ? 'bg-amber-500/15 border border-amber-500/60 text-amber-100'
                        : checked
                          ? 'bg-amber-500/15 border border-amber-500/40 text-amber-100'
                          : compat.level === 'incompatible'
                            ? 'border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                            : strength === 'strong'
                              ? 'border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                              : strength === 'mild'
                                ? 'border border-zinc-700/50 hover:bg-zinc-900'
                                : 'border border-transparent hover:bg-zinc-900',
                    (isFull && !checked) && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {checked ? (
                      <ToggleRight className="size-3.5 shrink-0 text-amber-300 mt-0.5" />
                    ) : (
                      <ToggleLeft className="size-3.5 shrink-0 text-zinc-500 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-1.5 flex-wrap">
                        <span>{mod.title}</span>
                        {strength === 'strong' && (
                          <span
                            className="text-[9px] px-1 py-0 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            title={rec?.reason}
                          >💡 强推荐 {rec!.score}</span>
                        )}
                        {strength === 'mild' && (
                          <span
                            className="text-[9px] px-1 py-0 rounded bg-zinc-700/40 text-zinc-300 border border-zinc-600/40"
                            title={rec?.reason}
                          >💡 推荐 {rec!.score}</span>
                        )}
                        {/* P9-F LLM 来源徐章 */}
                        {rec?.source === 'llm' && (
                          <span
                            className="text-[9px] px-1 py-0 rounded bg-blue-500/15 text-blue-300 border border-blue-500/40 flex items-center gap-0.5"
                            title="LLM 背书推荐"
                          ><Bot className="size-2.5" /> AI</span>
                        )}
                        {/* v2 阶段 2.3 · 题材兼容性徐章 */}
                        {compat.level === 'incompatible' && (
                          <span
                            className="text-[9px] px-1 py-0 rounded bg-rose-500/15 text-rose-300 border border-rose-500/40 flex items-center gap-0.5"
                            title={`与题材 [${genresToLabels(compat.hits)}] 语义冲突；启用后产出可能严重违和`}
                          ><Ban className="size-2.5" /> 题材冲突</span>
                        )}
                        {compat.level === 'warning' && (
                          <span
                            className="text-[9px] px-1 py-0 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-0.5"
                            title={`在题材 [${genresToLabels(compat.hits)}] 下兼容性较弱，可继续使用但需注意`}
                          ><ShieldAlert className="size-2.5" /> 兼容弱</span>
                        )}
                        {compat.level === 'recommended' && (
                          <span
                            className="text-[9px] px-1 py-0 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5"
                            title={`与题材 [${genresToLabels(compat.hits)}] 高度契合`}
                          ><CheckCircle2 className="size-2.5" /> 题材契合</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{mod.summary}</div>
                      {rec && rec.score >= 65 && (
                        <div className="text-[10px] text-amber-300/90 mt-0.5 italic">» {rec.reason}</div>
                      )}
                      <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2">
                        <span>📍 注入到 {mod.injectsTo.join(', ')}</span>
                        <span>· ~{mod.estimatedTokens} tokens</span>
                        {conflictsActive && !checked && (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <AlertTriangle className="size-3" /> 启用后会替换冲突模块
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

          {value.length >= MAX_ENABLED && (
            <div className="text-[10px] text-amber-400/80 italic mt-2">
              已达启用上限（{MAX_ENABLED} 个）。继续启用前请先取消勾选其他模块。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
