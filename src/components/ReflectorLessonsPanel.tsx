// ReflectorLessonsPanel.tsx · v6 epic · ACE-lite Reflector lessons 审阅面板
//
// 位置：Novel 页 · 在 CharacterBible 之后追加（独立面板 · CK I-6）
//
// 状态来源：
//   • lessons → dexie reflectorLessons 表（按 statusFilter / signalTypeFilter 查询）
//   • collapsed / filters / selectedLessonId → useReflectorLessonsPanel store
//   • settings.reflectorThresholds.enabled → useSettings
//
// CK invariants：
//   • I-3 用户审阅 + 手动 commit · 不自动改 method module
//   • I-6 独立面板 · 不嵌入 CharacterBible · 独立 localStorage key
//   • I-8 详情 modal 操作不阻塞主流程

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Brain, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '../store/settings';
import { useReflectorLessonsPanel } from '../store/reflectorLessonsPanel';
import { Button, Input, Textarea } from './ui';
import {
  listLessonsByStatus,
  updateLessonStatus,
  type ReflectorLesson,
  type LessonStatus,
  type SignalType,
} from '../store/reflectorLessons';

const PROJECT_ID = 0; // live project · 与 CharacterBible 一致

const STATUS_OPTIONS: Array<{ value: LessonStatus | 'all'; label: string }> = [
  { value: 'pending', label: '待审阅' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已驳回' },
  { value: 'committed', label: '已 commit' },
  { value: 'all', label: '全部' },
];

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  scoreCard: 'ScoreCard',
  consistencyCheck: '一致性',
  readerLayer: '读者层',
  userFeedback: '用户反馈',
};

export function ReflectorLessonsPanel() {
  const settings = useSettings();
  const collapsed = useReflectorLessonsPanel((s) => s.collapsed);
  const toggleCollapse = useReflectorLessonsPanel((s) => s.toggleCollapse);
  const statusFilter = useReflectorLessonsPanel((s) => s.statusFilter);
  const setStatusFilter = useReflectorLessonsPanel((s) => s.setStatusFilter);
  const signalTypeFilter = useReflectorLessonsPanel((s) => s.signalTypeFilter);
  const setSignalTypeFilter = useReflectorLessonsPanel((s) => s.setSignalTypeFilter);
  const selectedLessonId = useReflectorLessonsPanel((s) => s.selectedLessonId);
  const selectLesson = useReflectorLessonsPanel((s) => s.selectLesson);

  const [lessons, setLessons] = useState<ReflectorLesson[]>([]);
  const [counts, setCounts] = useState<Record<LessonStatus, number>>({ pending: 0, approved: 0, rejected: 0, committed: 0 });
  const [refresh, setRefresh] = useState(0);

  // 加载 lessons（按 statusFilter）+ 统计 counts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 主列表
      const target = statusFilter === 'all'
        ? [...await listLessonsByStatus(PROJECT_ID, 'pending'),
           ...await listLessonsByStatus(PROJECT_ID, 'approved'),
           ...await listLessonsByStatus(PROJECT_ID, 'rejected'),
           ...await listLessonsByStatus(PROJECT_ID, 'committed')]
        : await listLessonsByStatus(PROJECT_ID, statusFilter);
      const filtered = signalTypeFilter === 'all'
        ? target
        : target.filter((l) => l.signalType === signalTypeFilter);
      if (!cancelled) setLessons(filtered.sort((a, b) => b.ts - a.ts));

      // 统计
      const [p, a, r, c] = await Promise.all([
        listLessonsByStatus(PROJECT_ID, 'pending'),
        listLessonsByStatus(PROJECT_ID, 'approved'),
        listLessonsByStatus(PROJECT_ID, 'rejected'),
        listLessonsByStatus(PROJECT_ID, 'committed'),
      ]);
      if (!cancelled) setCounts({ pending: p.length, approved: a.length, rejected: r.length, committed: c.length });
    })().catch((e) => console.warn('[v6] lessons 加载失败:', e));
    return () => { cancelled = true; };
  }, [statusFilter, signalTypeFilter, refresh]);

  const summary = `${counts.pending} 待审阅 · ${counts.approved} 已批准 · ${counts.committed} 已 commit`;
  const enabled = settings.reflectorThresholds?.enabled ?? false;
  const selectedLesson = selectedLessonId != null ? lessons.find((l) => l.id === selectedLessonId) ?? null : null;

  async function handleQuickAction(id: number, newStatus: LessonStatus) {
    try {
      await updateLessonStatus(id, newStatus);
      setRefresh((n) => n + 1);
    } catch (e) {
      console.warn('[v6] 状态更新失败:', e);
    }
  }

  return (
    <section className="rounded border border-border-subtle bg-surface-1" aria-label="Reflector 待审阅 lessons">
      <button
        type="button"
        onClick={toggleCollapse}
        aria-expanded={!collapsed}
        aria-controls="reflector-lessons-body"
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2 transition focus:outline-none focus:ring-2 focus:ring-violet-400"
      >
        <span className="flex items-center gap-2 font-medium">
          <Brain className="size-4 text-violet-500" />
          Reflector lessons (v6 · ACE-lite)
          <span className="text-xs text-fg-muted font-normal ml-2">{summary}</span>
          {!enabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700">未启用</span>
          )}
        </span>
        {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
      </button>

      {!collapsed && (
        <div id="reflector-lessons-body" className="px-3 py-3 space-y-3 border-t border-border-subtle">
          {!enabled && (
            <div className="flex items-start gap-2 px-3 py-2 rounded bg-amber-500/10 text-amber-700 text-xs">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>
                Reflector 未启用。在 <code className="px-1 bg-amber-500/20 rounded">设置</code> 启用 <code className="px-1 bg-amber-500/20 rounded">reflectorThresholds.enabled</code> 后，N3.2 章节润色完成时会按阈值触发 lesson 提炼。
              </span>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <label className="text-fg-muted">状态:</label>
            <select
              className="border border-border-subtle rounded px-2 py-1 bg-surface-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LessonStatus | 'all')}
              aria-label="按状态过滤"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <label className="text-fg-muted ml-2">信号:</label>
            <select
              className="border border-border-subtle rounded px-2 py-1 bg-surface-1"
              value={signalTypeFilter}
              onChange={(e) => setSignalTypeFilter(e.target.value as SignalType | 'all')}
              aria-label="按信号类型过滤"
            >
              <option value="all">全部</option>
              {Object.entries(SIGNAL_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>

          {/* List */}
          {lessons.length === 0 ? (
            <div className="text-sm text-gray-500 px-3 py-6 text-center">
              {enabled ? '当前过滤条件下无 lessons · 跑过 N3.2 润色（满足阈值）后会出现' : '启用 Reflector 后将显示 lessons'}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {lessons.map((rec) => (
                <div
                  key={`lesson-${rec.id}`}
                  className="rounded border border-border-subtle px-3 py-2 bg-surface-1 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">第 {rec.chapterIndex} 章</span>
                    <span className="px-1 rounded bg-violet-500/15 text-violet-700">{SIGNAL_TYPE_LABELS[rec.signalType]}</span>
                    {rec.status === 'pending' && <span className="px-1 rounded bg-amber-500/20 text-amber-700">待审阅</span>}
                    {rec.status === 'approved' && <span className="px-1 rounded bg-emerald-500/20 text-emerald-700">已批准</span>}
                    {rec.status === 'rejected' && <span className="px-1 rounded bg-rose-500/20 text-rose-700">已驳回</span>}
                    {rec.status === 'committed' && <span className="px-1 rounded bg-sky-500/20 text-sky-700">已 commit</span>}
                    <span className="text-fg-muted ml-auto">{new Date(rec.ts).toLocaleString('zh-CN', { hour12: false })}</span>
                  </div>
                  <div className="text-fg-muted line-clamp-2 mb-1">{rec.lessonContent}</div>
                  {rec.suggestedModule && (
                    <div className="text-fg-muted">建议: <code className="px-1 rounded bg-surface-2">{rec.suggestedModule}</code></div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      type="button"
                      onClick={() => selectLesson(rec.id ?? null)}
                      className="px-2 py-0.5 rounded bg-surface-2 hover:bg-surface-3"
                    >
                      详情
                    </button>
                    {rec.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => rec.id && handleQuickAction(rec.id, 'approved')}
                          className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                        >
                          批准
                        </button>
                        <button
                          type="button"
                          onClick={() => rec.id && handleQuickAction(rec.id, 'rejected')}
                          className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 hover:bg-rose-500/25"
                        >
                          驳回
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 详情 modal */}
      {selectedLesson && (
        <ReflectorLessonModal
          lesson={selectedLesson}
          onClose={() => selectLesson(null)}
          onUpdated={() => setRefresh((n) => n + 1)}
        />
      )}
    </section>
  );
}

// ─── 详情 modal（CK I-3：用户手动操作 · 不自动写 method module） ──

export interface ReflectorLessonModalProps {
  lesson: ReflectorLesson;
  onClose(): void;
  onUpdated(): void;
}

/**
 * Reflector lesson 详情 modal。供 ReflectorLessonsPanel（项目级）与 /lessons page（全局）复用。
 * CK ui-v1 I-3 · v6 CK I-3 严守：不自动写 method module。
 */
export function ReflectorLessonModal(props: ReflectorLessonModalProps): JSX.Element {
  const { lesson, onClose, onUpdated } = props;
  const [content, setContent] = useState(lesson.lessonContent);
  const [suggested, setSuggested] = useState(lesson.suggestedModule ?? '');
  const [reviewNote, setReviewNote] = useState(lesson.reviewNote ?? '');
  const [committedTo, setCommittedTo] = useState(lesson.committedTo ?? '');
  const [busy, setBusy] = useState(false);

  async function save(newStatus?: LessonStatus) {
    if (!lesson.id) return;
    setBusy(true);
    try {
      await updateLessonStatus(lesson.id, newStatus ?? lesson.status, {
        lessonContent: content,
        suggestedModule: suggested.trim() || null,
        reviewNote: reviewNote || undefined,
        committedTo: committedTo.trim() || undefined,
      });
      onUpdated();
      if (newStatus) onClose();
    } catch (e) {
      console.warn('[v6] modal 更新失败:', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-1 border border-border-subtle rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Reflector lesson · 第 {lesson.chapterIndex} 章 · {SIGNAL_TYPE_LABELS[lesson.signalType]}
          </h3>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>

        <label className="block text-xs">
          <div className="text-fg-muted mb-1">Lesson 内容（可编辑 · 100-300 字）</div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
          />
        </label>

        <label className="block text-xs">
          <div className="text-fg-muted mb-1">建议写入的 method module（id · 可改 / 可留空）</div>
          <Input
            type="text"
            value={suggested}
            onChange={(e) => setSuggested(e.target.value)}
            placeholder="e.g. anti-ai-flavor-rules"
            className="font-mono"
          />
        </label>

        <label className="block text-xs">
          <div className="text-fg-muted mb-1">审阅备注（可选）</div>
          <Input
            type="text"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="备注或说明"
          />
        </label>

        {(lesson.status === 'approved' || lesson.status === 'committed') && (
          <label className="block text-xs">
            <div className="text-fg-muted mb-1">已 commit 到（手动填 · 形如 "anti-ai-flavor-rules:L120-130"）</div>
            <Input
              type="text"
              value={committedTo}
              onChange={(e) => setCommittedTo(e.target.value)}
              className="font-mono"
            />
          </label>
        )}

        <div className="text-[10px] text-fg-muted">
          信号上下文：<code className="px-1 bg-surface-2 rounded">{JSON.stringify(lesson.signalContext)}</code>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border-subtle flex-wrap">
          <button
            type="button"
            onClick={() => save()}
            disabled={busy}
            className="text-xs px-3 py-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
          >
            保存修改
          </button>
          {lesson.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => save('approved')}
                disabled={busy}
                className="text-xs px-3 py-1 rounded bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                批准
              </button>
              <button
                type="button"
                onClick={() => save('rejected')}
                disabled={busy}
                className="text-xs px-3 py-1 rounded bg-rose-500/20 text-rose-700 hover:bg-rose-500/30 disabled:opacity-50"
              >
                驳回
              </button>
            </>
          )}
          {lesson.status === 'approved' && (
            <button
              type="button"
              onClick={() => save('committed')}
              disabled={busy || !committedTo.trim()}
              className={clsx(
                'text-xs px-3 py-1 rounded',
                committedTo.trim()
                  ? 'bg-sky-500/20 text-sky-700 hover:bg-sky-500/30'
                  : 'bg-surface-2 text-fg-muted opacity-50',
              )}
              title={!committedTo.trim() ? '需先填"已 commit 到"路径' : undefined}
            >
              标记已 commit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1 rounded bg-surface-2 hover:bg-surface-3 ml-auto"
          >
            取消
          </button>
        </div>

        <div className="text-[10px] text-fg-muted pt-1 border-t border-border-subtle">
          ⚠ CK I-3：v6 epic 不会自动写 method module · 你必须手动编辑文件 + git commit · 然后回此处填路径并标记已 commit。
        </div>
      </div>
    </div>
  );
}
