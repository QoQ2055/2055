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
  }, [projectId]);

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
        <span className="ml-auto text-tight-xs text-fg-muted font-mono">
          v8 schema · 4 表 · {loading ? '...' : `${totalRows} 行`}
        </span>
      </header>

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
