/**
 * 资料库 v2 P2 · 章节反馈面板（KnowledgeBase 第三 tab）
 *
 * 显示所有 userKbFeedback 记录，支持：
 *  - 按 issues / 时间筛选
 *  - 删除单条
 *  - 「✨ 汇总成偏好资料」：调 LLM summarize-feedback prompt，生成
 *    type='styleGuide', source='auto-summary' 的 UserKbDoc，
 *    项目设置里勾选后自动注入所有 novel.* prompt。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ThumbsDown, Trash2, Sparkles, Loader2, RefreshCw, AlertTriangle, Check, FileText, Ban,
} from 'lucide-react';
import clsx from 'clsx';
import {
  listUserKbFeedback,
  deleteUserKbFeedback,
  bulkDeleteUserKbFeedback,
  createUserKbDoc,
  USER_KB_FEEDBACK_ISSUE_META,
  type UserKbFeedback,
} from '../store/userKb';
import { extractUserKbDoc } from '../llm/extractKb';
import { useSettings } from '../store/settings';
import { confirm as confirmDialog } from '../store/confirm';

const MIN_FEEDBACK_TO_SUMMARIZE = 3;

export function FeedbackInsights() {
  const [feedback, setFeedback] = useState<UserKbFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summarizing, setSummarizing] = useState<false | 'styleGuide' | 'antiPattern' | 'both'>(false);
  const [summarizedDocs, setSummarizedDocs] = useState<Array<{ id: number; type: 'styleGuide' | 'antiPattern' }>>([]);
  const [filterIssue, setFilterIssue] = useState<UserKbFeedback['issues'][number] | 'all'>('all');
  // P9-G 多选删除状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const apiKey = useSettings((s) => s.apiKey);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const list = await listUserKbFeedback({ limit: 500 });
      setFeedback(list);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // 各 issue 的统计
  const issueStats = useMemo(() => {
    const map = new Map<UserKbFeedback['issues'][number], number>();
    for (const fb of feedback) {
      for (const k of fb.issues) {
        map.set(k, (map.get(k) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [feedback]);

  const filtered = useMemo(() => {
    if (filterIssue === 'all') return feedback;
    return feedback.filter((fb) => fb.issues.includes(filterIssue));
  }, [feedback, filterIssue]);

  async function handleDelete(id: number) {
    const ok = await confirmDialog({
      title: '删除这条反馈？',
      message: '删除后不可恢复。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await deleteUserKbFeedback(id);
    setSelectedIds((cur) => { const n = new Set(cur); n.delete(id); return n; });
    refresh();
  }

  /** P9-G 切换单条选中 */
  function toggleSelect(id: number) {
    setSelectedIds((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  /** P9-G 全选 / 全不选（作用于当前 filter 下可见项） */
  function toggleSelectAllVisible() {
    const visibleIds = filtered.map((fb) => fb.id).filter((id): id is number => id != null);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((cur) => {
      const n = new Set(cur);
      if (allSelected) {
        for (const id of visibleIds) n.delete(id);
      } else {
        for (const id of visibleIds) n.add(id);
      }
      return n;
    });
  }

  /** P9-G 批量删除选中 */
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const ok = await confirmDialog({
      title: `删除选中的 ${selectedIds.size} 条反馈？`,
      message: '此操作不可逆。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await bulkDeleteUserKbFeedback([...selectedIds]);
    setSelectedIds(new Set());
    refresh();
  }

  /** P9-G 按当前 filter 批量删除 */
  async function handleDeleteFilteredAll() {
    const visibleIds = filtered.map((fb) => fb.id).filter((id): id is number => id != null);
    if (visibleIds.length === 0) return;
    const desc = filterIssue === 'all' ? '全部' : `「${USER_KB_FEEDBACK_ISSUE_META[filterIssue]}」`;
    const ok = await confirmDialog({
      title: `删除${desc}反馈 ${visibleIds.length} 条？`,
      message: '此操作不可逆。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    await bulkDeleteUserKbFeedback(visibleIds);
    setSelectedIds(new Set());
    refresh();
  }

  /**
   * P9-D 反馈→KB 自动归并
   *
   * 两种汇总路径：
   * - styleGuide: 走 summarize-feedback.json，输出「偏好指南」（应该如何写）
   * - antiPattern: 走 extract-anti-pattern.json，把反馈拼为反例资料，输出「黑名单」（绝不能写）
   */
  async function handleSummarizeAs(type: 'styleGuide' | 'antiPattern' | 'both') {
    if (feedback.length < MIN_FEEDBACK_TO_SUMMARIZE) {
      setError(`反馈条数 ${feedback.length} 太少，至少需要 ${MIN_FEEDBACK_TO_SUMMARIZE} 条才能有效汇总`);
      return;
    }
    if (!apiKey) {
      setError('请先在「设置」页填入 API Key');
      return;
    }
    setSummarizing(type);
    setError('');
    setSummarizedDocs([]);

    const compact = feedback.map((fb) => ({
      chapterIndex: fb.chapterIndex,
      nodeId: fb.nodeId,
      issues: fb.issues,
      reason: fb.reason,
      highlightedExcerpt: fb.highlightedExcerpt,
    }));
    const compactJson = JSON.stringify(compact, null, 2);

    // 拼接反例资料（供 antiPattern 抽取使用；可读文本中五万字以内）
    const antiPatternRaw = compact.map((fb, i) => {
      const lines: string[] = [];
      lines.push(`### 反例 ${i + 1}（第 ${fb.chapterIndex} 章 · ${fb.nodeId}）`);
      if (fb.issues.length > 0) {
        const labels = fb.issues.map((k) => USER_KB_FEEDBACK_ISSUE_META[k]).join(' / ');
        lines.push(`问题标签：${labels}`);
      }
      if (fb.reason) lines.push(`理由：${fb.reason}`);
      if (fb.highlightedExcerpt) {
        lines.push('负样本片段：');
        lines.push('```');
        lines.push(fb.highlightedExcerpt);
        lines.push('```');
      }
      return lines.join('\n');
    }).join('\n\n');

    const wantStyleGuide = type === 'styleGuide' || type === 'both';
    const wantAntiPattern = type === 'antiPattern' || type === 'both';
    const created: Array<{ id: number; type: 'styleGuide' | 'antiPattern' }> = [];

    try {
      if (wantStyleGuide) {
        const result = await extractUserKbDoc({
          type: 'styleGuide',
          feedbackCount: feedback.length,
          feedbackJson: compactJson,
        });
        const id = await createUserKbDoc({
          type: 'styleGuide',
          title: `用户偏好汇总（${new Date().toLocaleDateString()} · 基于 ${feedback.length} 条反馈）`,
          source: 'auto-summary',
          rawContent: compactJson,
          structuredJson: JSON.stringify(result.structured, null, 2),
          tags: ['auto', `${feedback.length}-feedback`],
          enabled: true,
          extractMeta: {
            promptId: result.meta.promptId,
            tokens: result.meta.tokens,
            durationMs: result.meta.durationMs,
            model: result.meta.model,
          },
        });
        created.push({ id, type: 'styleGuide' });
      }

      if (wantAntiPattern) {
        const result = await extractUserKbDoc({
          type: 'antiPattern',
          rawContent: antiPatternRaw,
        });
        const id = await createUserKbDoc({
          type: 'antiPattern',
          title: `反例黑名单（${new Date().toLocaleDateString()} · 基于 ${feedback.length} 条反馈）`,
          source: 'auto-summary',
          rawContent: antiPatternRaw,
          structuredJson: JSON.stringify(result.structured, null, 2),
          tags: ['auto', 'from-feedback', `${feedback.length}-feedback`],
          enabled: true,
          extractMeta: {
            promptId: result.meta.promptId,
            tokens: result.meta.tokens,
            durationMs: result.meta.durationMs,
            model: result.meta.model,
          },
        });
        created.push({ id, type: 'antiPattern' });
      }
      setSummarizedDocs(created);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSummarizing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-fg-muted flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> 加载反馈记录…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部统计 + 操作栏 */}
      <header className="px-5 py-3 border-b border-border-subtle space-y-3">
        <div className="flex items-center gap-3">
          <ThumbsDown className="size-4 text-danger" />
          <div className="text-sm font-semibold">章节反馈</div>
          <span className="text-xs text-fg-muted">共 {feedback.length} 条</span>
          <button onClick={refresh} className="btn-ghost text-xs ml-auto" title="刷新">
            <RefreshCw className="size-3.5" />
          </button>
          {/* P9-D 三个按钮：styleGuide / antiPattern / 双向 */}
          <button
            onClick={() => handleSummarizeAs('styleGuide')}
            disabled={!!summarizing || feedback.length < MIN_FEEDBACK_TO_SUMMARIZE}
            className="btn-ghost text-xs flex items-center gap-1"
            title={
              feedback.length < MIN_FEEDBACK_TO_SUMMARIZE
                ? `至少需要 ${MIN_FEEDBACK_TO_SUMMARIZE} 条反馈才能汇总`
                : '生成「偏好指南」（应该如何写）。注入 novel.* prompt'
            }
          >
            {summarizing === 'styleGuide' ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {summarizing === 'styleGuide' ? '汇总中…' : '✨ 偏好资料'}
          </button>
          <button
            onClick={() => handleSummarizeAs('antiPattern')}
            disabled={!!summarizing || feedback.length < MIN_FEEDBACK_TO_SUMMARIZE}
            className="btn-ghost text-xs flex items-center gap-1 text-danger"
            title={
              feedback.length < MIN_FEEDBACK_TO_SUMMARIZE
                ? `至少需要 ${MIN_FEEDBACK_TO_SUMMARIZE} 条反馈才能汇总`
                : '生成「反例黑名单」（绝不能写）。与偏好资料互补。'
            }
          >
            {summarizing === 'antiPattern' ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
            {summarizing === 'antiPattern' ? '汇总中…' : '🚫 反例黑名单'}
          </button>
          <button
            onClick={() => handleSummarizeAs('both')}
            disabled={!!summarizing || feedback.length < MIN_FEEDBACK_TO_SUMMARIZE}
            className="btn-primary text-xs flex items-center gap-1"
            title="一次生成两份：偏好资料 + 反例黑名单（2 次 LLM 调用）"
          >
            {summarizing === 'both' ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {summarizing === 'both' ? '双向汇总中…' : '✨ 双向汇总'}
          </button>
        </div>

        {/* 各 issue 频次统计 */}
        {issueStats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterIssue('all')}
              className={clsx(
                'text-tight-sm px-2 py-0.5 rounded border transition-colors',
                filterIssue === 'all'
                  ? 'border-primary-200 bg-primary-500/15 text-primary-300'
                  : 'border-border-default text-fg-secondary hover:text-fg-primary',
              )}
            >
              全部 {feedback.length}
            </button>
            {issueStats.map(([k, n]) => (
              <button
                key={k}
                onClick={() => setFilterIssue(k)}
                className={clsx(
                  'text-tight-sm px-2 py-0.5 rounded border transition-colors',
                  filterIssue === k
                    ? 'border-rose-500 bg-danger/15 text-danger'
                    : 'border-border-default text-fg-secondary hover:text-fg-primary',
                )}
              >
                {USER_KB_FEEDBACK_ISSUE_META[k]} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="card border-warning/40 bg-warning/5 p-2 text-xs flex items-start gap-2">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <div className="text-fg-primary">{error}</div>
          </div>
        )}

        {summarizedDocs.length > 0 && (
          <div className="card border-success/40 bg-success/5 p-2 text-xs flex items-start gap-2">
            <Check className="size-4 text-success shrink-0 mt-0.5" />
            <div className="text-fg-primary">
              已生成 {summarizedDocs.length} 份 doc：
              {summarizedDocs.map((d, i) => (
                <span key={d.id} className="ml-1">
                  {i > 0 && <span className="text-fg-muted">、</span>}
                  <span className={d.type === 'styleGuide' ? 'text-success' : 'text-danger'}>
                    {d.type === 'styleGuide' ? '偏好资料' : '反例黑名单'} #{d.id}
                  </span>
                </span>
              ))}
              。前往「我的资料库」 tab 查看，在项目设置中勾选绑定后生效。
            </div>
          </div>
        )}
      </header>

      {/* P9-G 多选 / 批量删除控件栏 */}
      {filtered.length > 0 && (
        <div className="px-5 py-2 border-b border-border-subtle flex items-center gap-3 text-xs text-fg-secondary">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={
                filtered.length > 0
                && filtered.every((fb) => fb.id != null && selectedIds.has(fb.id))
              }
              onChange={toggleSelectAllVisible}
              className="cursor-pointer"
            />
            <span>全选当前筛选 ({filtered.length})</span>
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="text-fg-muted">· 已选 {selectedIds.size} 条</span>
              <button
                onClick={handleBulkDelete}
                className="text-danger hover:text-danger flex items-center gap-1 ml-auto"
                title="删除选中的反馈条目"
              >
                <Trash2 className="size-3" /> 删除选中
              </button>
            </>
          )}
          {selectedIds.size === 0 && filterIssue !== 'all' && (
            <button
              onClick={handleDeleteFilteredAll}
              className="text-danger/80 hover:text-danger flex items-center gap-1 ml-auto"
              title={`删除当前「${USER_KB_FEEDBACK_ISSUE_META[filterIssue as keyof typeof USER_KB_FEEDBACK_ISSUE_META]}」筛选下的全部 ${filtered.length} 条`}
            >
              <Trash2 className="size-3" /> 删除当前筛选全部
            </button>
          )}
        </div>
      )}

      {/* 反馈列表 */}
      <div className="flex-1 overflow-auto p-5 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-fg-muted py-12">
            <FileText className="size-10 mx-auto mb-3 opacity-30" />
            {feedback.length === 0 ? (
              <>
                还没有任何反馈记录。<br />
                在写完章节后预览章节，点右上「👎 不满意」按钮可以记录问题点。<br />
                攒够 {MIN_FEEDBACK_TO_SUMMARIZE} 条以上后可以汇总成偏好资料。
              </>
            ) : (
              `当前筛选下没有反馈`
            )}
          </div>
        ) : (
          filtered.map((fb) => (
            <FeedbackCard
              key={fb.id}
              fb={fb}
              selected={fb.id != null && selectedIds.has(fb.id)}
              onToggleSelect={() => fb.id != null && toggleSelect(fb.id)}
              onDelete={() => fb.id != null && handleDelete(fb.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FeedbackCard({
  fb, selected, onToggleSelect, onDelete,
}: {
  fb: UserKbFeedback;
  selected?: boolean;
  onToggleSelect?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={clsx(
      'card p-3 text-xs space-y-2 transition-colors',
      selected && 'border-danger/40 bg-danger/5',
    )}>
      <div className="flex items-start gap-2">
        {/* P9-G 多选复选框 */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggleSelect}
            className="mt-1 cursor-pointer shrink-0"
            aria-label="选中该反馈条目"
          />
        )}
        <div className="text-danger shrink-0">
          <ThumbsDown className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-fg-primary">第 {fb.chapterIndex} 章</span>
            <span className="text-tight-xs px-1.5 py-0.5 rounded bg-elevated text-fg-secondary">
              {fb.nodeId === 'novel.3.1' ? '草稿' : fb.nodeId === 'novel.3.2' ? '润色' : fb.nodeId}
            </span>
            <span className="text-tight-xs text-fg-muted">{new Date(fb.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {fb.issues.map((k) => (
              <span key={k} className="text-tight-xs px-1.5 py-0.5 rounded bg-danger/15 text-danger border border-danger/30">
                {USER_KB_FEEDBACK_ISSUE_META[k]}
              </span>
            ))}
          </div>
          {fb.reason && (
            <div className="mt-2 text-fg-secondary italic">
              「{fb.reason}」
            </div>
          )}
          {fb.highlightedExcerpt && (
            <details className="mt-2">
              <summary className="cursor-pointer text-fg-muted hover:text-fg-secondary">
                负样本片段（{fb.highlightedExcerpt.length} 字）
              </summary>
              <pre className="mt-1 p-2 bg-surface rounded text-tight-sm font-mono whitespace-pre-wrap text-fg-secondary">
                {fb.highlightedExcerpt}
              </pre>
            </details>
          )}
        </div>
        <button onClick={onDelete} className="btn-ghost p-1 text-danger hover:text-danger shrink-0" title="删除">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
