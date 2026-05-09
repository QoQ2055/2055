/**
 * v8 epic · MM5 PR-3 · 连续性看板（首个产品级 helper 消费者）
 *
 * 职责：读取 4 张 v8 连续性表 · 显示 stat card · 0 LLM · 0 写入。
 *
 * 设计边界（CK · 关注点分离）：
 *   - 仅消费 src/store/continuity/* 的 IO helpers · 不直接触 dexie
 *   - 不修改 SelfCheckPanel · 不入 LLM 流水线
 *   - 当表为空时渲染"等待写入路径"占位（MM5 PR-4+ 引入 LLM 提取）
 *
 * projectId 约定：
 *   - 0 = 活动项目 sentinel（与 src/store/db.ts recordRun({ projectId: 0 }) 对齐）
 *   - >0 = 已归档项目
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Anchor, Sparkles, Globe, Activity, Loader2, AlertCircle, Database,
  Wand2, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';
import {
  listForeshadows,
  listAllCharacterArcs,
  listWorldRules,
  listAllRhythm,
  type ForeshadowRow,
  type ForeshadowStatus,
  type CharacterArcRow,
  type WorldRuleRow,
  type WorldRuleSeverity,
  type RhythmDiagnosticRow,
} from '../store/continuity';
import { extractContinuityFromChapter, type ExtractContinuityResult } from '../pipeline/continuity';
import { useSettings } from '../store/settings';
import { toast } from '../store/toast';

export interface ContinuityDashboardPanelProps {
  /** 项目 ID · 0 = 活动项目 sentinel · >0 = 已归档项目。 */
  projectId: number;
  /** 项目名 · 仅显示用 · 可空。 */
  projectName?: string;
}

interface ContinuityData {
  foreshadows: ForeshadowRow[];
  arcs: CharacterArcRow[];
  rules: WorldRuleRow[];
  rhythms: RhythmDiagnosticRow[];
}

export function ContinuityDashboardPanel({
  projectId, projectName,
}: ContinuityDashboardPanelProps) {
  const [data, setData] = useState<ContinuityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** 增量一次即重加载 4 表（提取完成后触发） */
  const [reloadKey, setReloadKey] = useState(0);

  // ─── 提取子流程状态 (PR-4b) ─────────────────────────────
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractChapterIdx, setExtractChapterIdx] = useState(1);
  const [extractChapterText, setExtractChapterText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<ExtractContinuityResult | null>(null);
  const apiKey = useSettings((s) => s.apiKey);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      listForeshadows(projectId),
      listAllCharacterArcs(projectId),
      listWorldRules(projectId),
      listAllRhythm(projectId),
    ])
      .then(([foreshadows, arcs, rules, rhythms]) => {
        if (cancelled) return;
        setData({ foreshadows, arcs, rules, rhythms });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError((e as Error)?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  async function handleExtract() {
    if (extracting) return;
    if (!extractChapterText.trim()) {
      toast.warning('请输入章节文本');
      return;
    }
    setExtracting(true);
    setExtractResult(null);
    try {
      const settings = useSettings.getState();
      const result = await extractContinuityFromChapter({
        projectId,
        chapterIndex: extractChapterIdx,
        chapterContent: extractChapterText,
        settings,
      });
      setExtractResult(result);
      if (result.ok) {
        const total =
          result.counts.foreshadows + result.counts.characterArcs +
          result.counts.worldRules + result.counts.rhythmDiagnostics;
        toast.success(`提取完成 · 落库 ${total} 行`);
        setReloadKey((k) => k + 1);
      } else {
        toast.error(`提取失败：${result.error}`);
      }
    } catch (e) {
      toast.error(`提取异常：${(e as Error)?.message ?? String(e)}`);
    } finally {
      setExtracting(false);
    }
  }

  const totalRows = data
    ? data.foreshadows.length + data.arcs.length + data.rules.length + data.rhythms.length
    : 0;

  return (
    <div className="space-y-4">
      {/* ── header ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-heading-s text-fg-primary">
          连续性看板
        </h3>
        <span className="text-body-s text-fg-muted">
          {projectName ? `· ${projectName}` : ''}
          {projectId === 0 ? ' · 活动项目' : ` · 项目 #${projectId}`}
        </span>
        <button
          type="button"
          onClick={() => setExtractOpen((v) => !v)}
          disabled={!apiKey}
          title={apiKey ? '从章节文本提取 · LLM 推进 4 表' : '请先在设置中填写 API Key'}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-button border border-primary-300 bg-primary-50 text-primary-700 text-body-s hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Wand2 className="size-3.5" />
          从章节提取
          {extractOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <span className="text-tight-xs text-fg-muted font-mono w-full text-right md:w-auto">
          v8 schema · 4 表 · {loading ? '...' : `${totalRows} 行`}
        </span>
      </header>

      {/* ── PR-4 · 提取子流程（嵌入式·默认折叠） ───────── */}
      {extractOpen && (
        <div className="card-flat p-3 space-y-2 bg-primary-50/50 border-primary-200">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-body-s text-fg-secondary inline-flex items-center gap-1">
              章节号
              <input
                type="number"
                min={1}
                max={9999}
                value={extractChapterIdx}
                onChange={(e) => setExtractChapterIdx(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                disabled={extracting}
                className="w-16 px-2 py-1 rounded-input border border-border-default bg-canvas text-body-s text-fg-primary disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || !extractChapterText.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-button bg-primary-600 text-white text-body-s hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {extracting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> 提取中…
                </>
              ) : (
                <>
                  <Wand2 className="size-3.5" /> 提取并落库
                </>
              )}
            </button>
            <span className="text-tight-xs text-fg-muted ml-auto">
              提取会调 LLM (推荐 modelLite) · 落入 4 表 · 调用后看板自动刷新
            </span>
          </div>
          <textarea
            value={extractChapterText}
            onChange={(e) => setExtractChapterText(e.target.value)}
            disabled={extracting}
            placeholder="粘贴本章正文（markdown / 纯文本均可）· 例如从 /novel 产出复制单章· LLM 会提取伏笔 / 角色弧光 / 世界观规则 / 节奏诊断 4 类· 输出严格 JSON。"
            className="w-full h-32 px-2.5 py-1.5 rounded-input border border-border-default bg-canvas text-body-s text-fg-primary resize-y disabled:opacity-50"
          />
          {extractResult && (
            <div
              className={`p-2 rounded-input text-body-s flex items-start gap-2 ${
                extractResult.ok
                  ? 'bg-success/10 border border-success/30 text-fg-secondary'
                  : 'bg-danger/10 border border-danger/30 text-fg-secondary'
              }`}
            >
              {extractResult.ok ? (
                <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="size-3.5 text-danger shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                {extractResult.ok ? (
                  <span>
                    <strong className="text-fg-primary">提取完成</strong>
                    · 伏笔 {extractResult.counts.foreshadows}
                    · 弧光 {extractResult.counts.characterArcs}
                    · 规则 {extractResult.counts.worldRules}
                    · 节奏 {extractResult.counts.rhythmDiagnostics}
                    {typeof extractResult.meta.tokens === 'number' && (
                      <span className="text-tight-xs text-fg-muted ml-1 font-mono">
                        · {extractResult.meta.tokens} tok · {Math.round(extractResult.meta.durationMs)}ms
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    <strong className="text-fg-primary">提取失败：</strong>
                    {extractResult.error}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── error / loading state ──────────────────────────────────── */}
      {error && (
        <div className="card-flat p-3 flex items-start gap-2 border-danger/40 bg-danger/5">
          <AlertCircle className="size-4 text-danger shrink-0 mt-0.5" />
          <div className="text-body-s text-fg-secondary">
            <strong className="text-fg-primary">加载失败：</strong>
            {error}
          </div>
        </div>
      )}

      {loading && !error && (
        <div className="card-flat p-6 flex items-center justify-center gap-2 text-fg-muted">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-body-s">读取 v8 连续性表…</span>
        </div>
      )}

      {/* ── 4 stat cards grid ──────────────────────────────────────── */}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ForeshadowCard rows={data.foreshadows} />
            <CharacterArcCard rows={data.arcs} />
            <WorldRuleCard rows={data.rules} />
            <RhythmCard rows={data.rhythms} />
          </div>

          {totalRows === 0 && (
            <div className="card-flat p-4 flex items-start gap-3 bg-warning/5 border-warning/30">
              <Database className="size-4 text-warning shrink-0 mt-0.5" />
              <div className="text-body-s text-fg-secondary leading-relaxed">
                <strong className="text-fg-primary">所有表为空</strong>
                <span className="text-fg-muted"> · projectId={projectId}</span>
                <br />
                v8 schema 已就位 · 但还未引入写入路径。后续 PR 会通过 LLM
                提取（如章节生成完成后自动落 foreshadow / arc / world / rhythm
                表）· 本看板将自动反映数据。
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 4 stat cards ────────────────────────────────────────────────────

const STATUS_LABEL: Record<ForeshadowStatus, string> = {
  planted:  '已埋',
  partial:  '部分回收',
  resolved: '已闭环',
  broken:   '断头',
};

function ForeshadowCard({ rows }: { rows: ForeshadowRow[] }) {
  const counts = useMemo(() => {
    const c: Record<ForeshadowStatus, number> = { planted: 0, partial: 0, resolved: 0, broken: 0 };
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);
  const broken = counts.broken;
  return (
    <StatCard
      icon={Anchor}
      title="伏笔追踪"
      total={rows.length}
      tone={broken > 0 ? 'danger' : 'neutral'}
      footer={
        rows.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(['planted', 'partial', 'resolved', 'broken'] as ForeshadowStatus[]).map((st) => (
              <span key={st} className="text-tight-xs">
                <span className="text-fg-muted">{STATUS_LABEL[st]}</span>
                <span
                  className={`ml-1 font-mono ${
                    st === 'broken' && counts[st] > 0 ? 'text-danger' : 'text-fg-secondary'
                  }`}
                >
                  {counts[st]}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-tight-xs text-fg-muted">暂无伏笔记录</span>
        )
      }
    />
  );
}

function CharacterArcCard({ rows }: { rows: CharacterArcRow[] }) {
  const stats = useMemo(() => {
    const characterSet = new Set<string>();
    const epochSet = new Set<string>();
    let minChapter = Number.POSITIVE_INFINITY;
    let maxChapter = 0;
    rows.forEach((r) => {
      characterSet.add(r.characterName);
      epochSet.add(r.epoch);
      if (r.chapter < minChapter) minChapter = r.chapter;
      if (r.chapter > maxChapter) maxChapter = r.chapter;
    });
    return {
      characters: characterSet.size,
      epochs: epochSet.size,
      chapterRange: rows.length > 0 ? `第 ${minChapter}-${maxChapter} 章` : '—',
    };
  }, [rows]);
  return (
    <StatCard
      icon={Sparkles}
      title="角色弧光"
      total={rows.length}
      footer={
        rows.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-tight-xs">
            <span>
              <span className="text-fg-muted">角色</span>
              <span className="ml-1 font-mono text-fg-secondary">{stats.characters}</span>
            </span>
            <span>
              <span className="text-fg-muted">epoch</span>
              <span className="ml-1 font-mono text-fg-secondary">{stats.epochs}</span>
            </span>
            <span className="text-fg-muted">{stats.chapterRange}</span>
          </div>
        ) : (
          <span className="text-tight-xs text-fg-muted">暂无弧光记录</span>
        )
      }
    />
  );
}

function WorldRuleCard({ rows }: { rows: WorldRuleRow[] }) {
  const stats = useMemo(() => {
    const c: Record<WorldRuleSeverity, number> = { hard: 0, soft: 0 };
    let violations = 0;
    const domainSet = new Set<string>();
    rows.forEach((r) => {
      c[r.severity]++;
      domainSet.add(r.domain);
      if (r.violations) violations += r.violations.length;
    });
    return { hard: c.hard, soft: c.soft, violations, domains: domainSet.size };
  }, [rows]);
  return (
    <StatCard
      icon={Globe}
      title="世界观规则"
      total={rows.length}
      tone={stats.violations > 0 && stats.hard > 0 ? 'warning' : 'neutral'}
      footer={
        rows.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-tight-xs">
            <span>
              <span className="text-fg-muted">硬规则</span>
              <span className="ml-1 font-mono text-fg-secondary">{stats.hard}</span>
            </span>
            <span>
              <span className="text-fg-muted">软规则</span>
              <span className="ml-1 font-mono text-fg-secondary">{stats.soft}</span>
            </span>
            <span>
              <span className="text-fg-muted">领域</span>
              <span className="ml-1 font-mono text-fg-secondary">{stats.domains}</span>
            </span>
            <span>
              <span className="text-fg-muted">违规</span>
              <span
                className={`ml-1 font-mono ${
                  stats.violations > 0 ? 'text-warning' : 'text-fg-secondary'
                }`}
              >
                {stats.violations}
              </span>
            </span>
          </div>
        ) : (
          <span className="text-tight-xs text-fg-muted">暂无规则记录</span>
        )
      }
    />
  );
}

function RhythmCard({ rows }: { rows: RhythmDiagnosticRow[] }) {
  const stats = useMemo(() => {
    if (rows.length === 0) return { chapters: 0, warnings: 0, range: '—' };
    const chapterSet = new Set<number>();
    let warnings = 0;
    let minCh = Number.POSITIVE_INFINITY;
    let maxCh = 0;
    rows.forEach((r) => {
      chapterSet.add(r.chapter);
      if (r.warnings) warnings += r.warnings.length;
      if (r.chapter < minCh) minCh = r.chapter;
      if (r.chapter > maxCh) maxCh = r.chapter;
    });
    return {
      chapters: chapterSet.size,
      warnings,
      range: `第 ${minCh}-${maxCh} 章`,
    };
  }, [rows]);
  return (
    <StatCard
      icon={Activity}
      title="节奏诊断"
      total={rows.length}
      tone={stats.warnings > 0 ? 'warning' : 'neutral'}
      footer={
        rows.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-tight-xs">
            <span>
              <span className="text-fg-muted">章节</span>
              <span className="ml-1 font-mono text-fg-secondary">{stats.chapters}</span>
            </span>
            <span>
              <span className="text-fg-muted">警报</span>
              <span
                className={`ml-1 font-mono ${
                  stats.warnings > 0 ? 'text-warning' : 'text-fg-secondary'
                }`}
              >
                {stats.warnings}
              </span>
            </span>
            <span className="text-fg-muted">{stats.range}</span>
          </div>
        ) : (
          <span className="text-tight-xs text-fg-muted">暂无诊断记录</span>
        )
      }
    />
  );
}

// ─── shared StatCard ─────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  total: number;
  tone?: 'neutral' | 'warning' | 'danger';
  footer: React.ReactNode;
}

function StatCard({ icon: Icon, title, total, tone = 'neutral', footer }: StatCardProps) {
  const accentClass =
    tone === 'danger'  ? 'text-danger'  :
    tone === 'warning' ? 'text-warning' :
    'text-primary-600';
  return (
    <article className="card-flat p-3.5 flex flex-col gap-2">
      <header className="flex items-center gap-2">
        <Icon className={`size-4 shrink-0 ${accentClass}`} />
        <h4 className="text-body-s font-medium text-fg-primary truncate flex-1">{title}</h4>
        <span className={`text-heading-m font-mono shrink-0 ${accentClass}`}>{total}</span>
      </header>
      <div>{footer}</div>
    </article>
  );
}
