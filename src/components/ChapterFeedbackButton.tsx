/**
 * 资料库 v2 P2 · 章节「👎 不满意」反馈按钮
 *
 * 嵌在 PreviewModal 里，仅在预览章节内容时显示（target='chapter:draft:N' 等）。
 * 用户点击后弹出表单：多选问题分类 + 文字理由 + 可选的负样本片段（自动带入鼠标选中文本）。
 *
 * 提交后写入 db.userKbFeedback 表（projectId=0 表示 live 项目，遵循 RunRecord 约定）。
 * 攒够数条后用户可在 /kb → 「我的资料库」里点「汇总成偏好资料」做反向沉淀。
 */

import { useState } from 'react';
import { ThumbsDown, X, Check, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { Textarea } from './ui';
import {
  recordUserKbFeedback,
  USER_KB_FEEDBACK_ISSUE_META,
  type UserKbFeedback,
} from '../store/userKb';

interface Props {
  /** 章节序号 */
  chapterIndex: number;
  /** 节点 id（区分 draft / polish） */
  nodeId: string;
  /** 章节标题（仅展示用） */
  chapterTitle?: string;
  /** 提交后回调（如关闭 modal） */
  onSubmitted?: () => void;
}

type IssueKey = UserKbFeedback['issues'][number];

const ALL_ISSUES = Object.keys(USER_KB_FEEDBACK_ISSUE_META) as IssueKey[];

export function ChapterFeedbackButton({ chapterIndex, nodeId, chapterTitle, onSubmitted }: Props) {
  const [open, setOpen] = useState(false);
  const [issues, setIssues] = useState<IssueKey[]>([]);
  const [reason, setReason] = useState('');
  const [highlightedExcerpt, setHighlightedExcerpt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function toggleIssue(k: IssueKey) {
    setIssues((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  }

  function captureSelection() {
    const sel = window.getSelection?.()?.toString() ?? '';
    if (sel.length < 5) {
      setError('请先在章节正文里高亮一段不满意的文字（至少 5 字）');
      return;
    }
    if (sel.length > 2000) {
      setError(`选中片段过长（${sel.length} 字符），请缩短到 2000 字以内`);
      return;
    }
    setHighlightedExcerpt(sel);
    setError('');
  }

  async function submit() {
    if (issues.length === 0 && reason.trim().length === 0) {
      setError('请至少选 1 个问题分类，或写文字理由');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await recordUserKbFeedback({
        projectId: 0, // 0 = live project（与 RunRecord 一致）
        chapterIndex,
        nodeId,
        issues,
        reason: reason.trim() || undefined,
        highlightedExcerpt: highlightedExcerpt.trim() || undefined,
      });
      setSubmitted(true);
      // 1.5s 后自动关闭并通知父组件
      setTimeout(() => {
        setOpen(false);
        onSubmitted?.();
        // 重置表单状态供下次使用
        setIssues([]);
        setReason('');
        setHighlightedExcerpt('');
        setSubmitted(false);
      }, 1500);
    } catch (e: any) {
      setError(`记录失败：${e?.message ?? e}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-xs flex items-center gap-1 text-danger/80 hover:text-danger"
        title="标记本章不满意 → 沉淀为下次生成时的偏好资料"
      >
        <ThumbsDown className="size-3.5" /> 不满意
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-canvas border border-border-subtle rounded-lg w-full max-w-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <ThumbsDown className="size-4 text-danger" />
              <h3 className="text-sm font-semibold flex-1">
                标记不满意 · 第 {chapterIndex} 章
                {chapterTitle && <span className="text-fg-muted ml-1">「{chapterTitle}」</span>}
              </h3>
              <button onClick={() => !submitting && setOpen(false)} className="btn-ghost p-1">
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-4 space-y-3 text-xs">
              {error && (
                <div className="card border-warning/40 bg-warning/5 p-2 flex items-start gap-2">
                  <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-fg-primary">{error}</div>
                </div>
              )}

              {submitted ? (
                <div className="py-6 flex flex-col items-center text-success">
                  <Check className="size-10 mb-2" />
                  <div className="text-sm">已记录！</div>
                  <p className="text-fg-secondary mt-1 text-center">
                    后续可在「知识库 → 我的资料库」里把多条反馈汇总成偏好资料注入下次生成。
                  </p>
                </div>
              ) : (
                <>
                  {/* 问题分类 */}
                  <div>
                    <label className="block text-fg-secondary mb-1.5">主要问题（多选）</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_ISSUES.map((k) => (
                        <button
                          key={k}
                          onClick={() => toggleIssue(k)}
                          className={clsx(
                            'px-2 py-1 rounded border text-xs transition-colors',
                            issues.includes(k)
                              ? 'border-rose-500 bg-danger/15 text-danger'
                              : 'border-border-default text-fg-secondary hover:text-fg-primary',
                          )}
                        >
                          {USER_KB_FEEDBACK_ISSUE_META[k]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 文字理由 */}
                  <div>
                    <label className="block text-fg-secondary mb-1.5">详细理由（可选，建议写得越具体越好）</label>
                    <Textarea
                      className="text-xs"
                      rows={3}
                      placeholder="例如：主角讲了一大段哲学独白，太脱戏；对话不像活人说话，太书面。"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  {/* 负样本片段 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-fg-secondary">负样本片段（可选）</label>
                      <button
                        onClick={captureSelection}
                        className="btn-ghost text-tight-sm text-brand-300 hover:text-brand-200"
                        title="先在章节正文里用鼠标高亮一段，再点这里抓取"
                      >
                        🖍 抓取选中文字
                      </button>
                    </div>
                    <Textarea
                      className="font-mono text-tight-sm"
                      rows={4}
                      placeholder="把章节里最尴尬 / 最 AI 味的片段贴在这里，会作为「具体例证」沉淀"
                      value={highlightedExcerpt}
                      onChange={(e) => setHighlightedExcerpt(e.target.value)}
                    />
                    <p className="text-tight-xs text-fg-muted mt-1">
                      {highlightedExcerpt.length} / 2000 字符
                    </p>
                  </div>
                </>
              )}
            </div>

            {!submitted && (
              <footer className="px-4 py-3 border-t border-border-subtle flex items-center justify-between gap-2">
                <span className="text-tight-sm text-fg-muted">
                  {issues.length > 0 && `已选 ${issues.length} 个问题`}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} disabled={submitting} className="btn-ghost text-xs">
                    取消
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting || (issues.length === 0 && reason.trim().length === 0)}
                    className="btn-primary text-xs"
                  >
                    {submitting ? '提交中…' : '记录反馈'}
                  </button>
                </div>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
