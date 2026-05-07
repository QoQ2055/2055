// ReflectorLessons page · ui-v1-asset-routing epic PR-2
//
// 全局浏览所有项目的 reflectorLessons（v6 epic ACE-lite）。与 ReflectorLessonsPanel 互补：
//   - ReflectorLessonsPanel：项目级 collapsible 面板（嵌在 Novel.tsx）
//   - /lessons：跨项目全局表 + 详情 modal（本 page）
//
// CK 不变量：
//   - I-3 用户手动审阅 + 手动 commit method module · 不自动写
//   - I-6 schema 仅 +listAllLessons helper · 不改现有 API

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Lightbulb, AlertTriangle } from 'lucide-react';
import {
  listAllLessons,
  type ReflectorLesson,
  type LessonStatus,
  type SignalType,
} from '../store/reflectorLessons';
import { ReflectorLessonModal } from '../components/ReflectorLessonsPanel';
import { useSettings } from '../store/settings';

const STATUS_OPTIONS: Array<{ value: LessonStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审阅' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已驳回' },
  { value: 'committed', label: '已 commit' },
];

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  scoreCard: 'ScoreCard',
  consistencyCheck: '一致性',
  readerLayer: '读者层',
  userFeedback: '用户反馈',
};

const STATUS_COLOR: Record<LessonStatus, string> = {
  pending:   'bg-amber-500/20 text-amber-700',
  approved:  'bg-emerald-500/20 text-emerald-700',
  rejected:  'bg-rose-500/20 text-rose-700',
  committed: 'bg-sky-500/20 text-sky-700',
};

export function ReflectorLessons() {
  const settings = useSettings();
  const enabled = settings.reflectorThresholds?.enabled ?? false;

  const [lessons, setLessons] = useState<ReflectorLesson[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LessonStatus | 'all'>('all');
  const [signalFilter, setSignalFilter] = useState<SignalType | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<number | 'all'>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    listAllLessons()
      .then(setLessons)
      .catch((e: unknown) => setLoadError((e as Error)?.message ?? String(e)));
  }, [refresh]);

  // counts by status (across all projects · 不受 filter 影响)
  const counts = useMemo(() => {
    const out: Record<LessonStatus, number> = { pending: 0, approved: 0, rejected: 0, committed: 0 };
    for (const l of lessons) out[l.status]++;
    return out;
  }, [lessons]);

  // 项目 id 列表（去重 · 用于 project filter dropdown）
  const projectIds = useMemo(() => Array.from(new Set(lessons.map((l) => l.projectId))).sort((a, b) => a - b), [lessons]);

  // 过滤
  const filtered = useMemo(() => lessons.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (signalFilter !== 'all' && l.signalType !== signalFilter) return false;
    if (projectFilter !== 'all' && l.projectId !== projectFilter) return false;
    return true;
  }), [lessons, statusFilter, signalFilter, projectFilter]);

  const selectedLesson = selectedId != null ? lessons.find((l) => l.id === selectedId) ?? null : null;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部 · summary + 标题 */}
      <header className="border-b border-border-subtle px-4 py-3 shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Lightbulb className="size-4 text-violet-500 shrink-0" />
          <h1 className="text-sm font-semibold">Reflector Lessons (v6 · ACE-lite · 全局)</h1>
          <div className="ml-auto flex items-center gap-2 text-tight-sm">
            <StatBadge label="待审阅" count={counts.pending} className="bg-amber-500/15 text-amber-700" />
            <StatBadge label="已批准" count={counts.approved} className="bg-emerald-500/15 text-emerald-700" />
            <StatBadge label="已驳回" count={counts.rejected} className="bg-rose-500/15 text-rose-700" />
            <StatBadge label="已 commit" count={counts.committed} className="bg-sky-500/15 text-sky-700" />
          </div>
        </div>
        {!enabled && (
          <div className="flex items-start gap-2 px-3 py-2 rounded bg-amber-500/10 text-amber-700 text-xs">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>
              Reflector 未启用。在 <code className="px-1 bg-amber-500/20 rounded">设置</code> 启用 <code className="px-1 bg-amber-500/20 rounded">reflectorThresholds.enabled</code> 后，N3.2 章节润色完成时会按阈值触发 lesson 提炼。
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-fg-muted">状态：</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LessonStatus | 'all')}
            className="border border-border-subtle rounded px-2 py-1 bg-surface-1"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-fg-muted ml-2">信号：</span>
          <select
            value={signalFilter}
            onChange={(e) => setSignalFilter(e.target.value as SignalType | 'all')}
            className="border border-border-subtle rounded px-2 py-1 bg-surface-1"
          >
            <option value="all">全部</option>
            {Object.entries(SIGNAL_TYPE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <span className="text-fg-muted ml-2">项目：</span>
          <select
            value={String(projectFilter)}
            onChange={(e) => setProjectFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="border border-border-subtle rounded px-2 py-1 bg-surface-1"
          >
            <option value="all">全部 ({projectIds.length})</option>
            {projectIds.map((pid) => <option key={pid} value={pid}>项目 #{pid}</option>)}
          </select>
          <span className="ml-auto text-fg-muted">显示 {filtered.length} / {lessons.length}</span>
        </div>
      </header>

      {/* 列表 */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {loadError ? (
          <div className="card border-warning/40 bg-warning/5 p-4 text-sm">
            <strong className="text-warning flex items-center gap-1.5"><AlertTriangle className="size-4" /> 加载失败</strong>
            <p className="text-fg-secondary mt-1">{loadError}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-fg-muted text-center py-12">
            {enabled
              ? (lessons.length === 0 ? '尚无 lessons · 跑过 N3.2 润色（满足阈值）后会出现' : '当前过滤条件下无 lessons')
              : '启用 Reflector 后将显示 lessons'}
          </div>
        ) : filtered.map((rec) => (
          <LessonCard
            key={`lesson-${rec.id}`}
            rec={rec}
            onSelect={() => setSelectedId(rec.id ?? null)}
          />
        ))}
      </div>

      {/* 详情 modal · 复用 ReflectorLessonModal */}
      {selectedLesson && (
        <ReflectorLessonModal
          lesson={selectedLesson}
          onClose={() => setSelectedId(null)}
          onUpdated={() => setRefresh((n) => n + 1)}
        />
      )}
    </div>
  );
}

function StatBadge({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded font-medium', className)}>
      {count} <span className="opacity-70 font-normal">{label}</span>
    </span>
  );
}

function LessonCard({ rec, onSelect }: { rec: ReflectorLesson; onSelect: () => void }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-1 px-3 py-2 text-xs hover:border-violet-500/40 transition-colors">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-medium">项目 #{rec.projectId} · 第 {rec.chapterIndex} 章</span>
        <span className="px-1 rounded bg-violet-500/15 text-violet-700">{SIGNAL_TYPE_LABELS[rec.signalType]}</span>
        <span className={clsx('px-1 rounded', STATUS_COLOR[rec.status])}>
          {STATUS_OPTIONS.find((o) => o.value === rec.status)?.label ?? rec.status}
        </span>
        <span className="text-fg-muted ml-auto">{new Date(rec.ts).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>
      <div className="text-fg-muted line-clamp-2 mb-1">{rec.lessonContent}</div>
      {rec.suggestedModule && (
        <div className="text-fg-muted mb-1">建议: <code className="px-1 rounded bg-surface-2">{rec.suggestedModule}</code></div>
      )}
      {rec.committedTo && (
        <div className="text-sky-700 mb-1">已 commit: <code className="px-1 rounded bg-sky-500/10">{rec.committedTo}</code></div>
      )}
      <button
        type="button"
        onClick={onSelect}
        className="px-2 py-0.5 rounded bg-surface-2 hover:bg-surface-3"
      >
        详情 / 编辑
      </button>
    </div>
  );
}
