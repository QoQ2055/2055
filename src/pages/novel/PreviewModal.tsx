/**
 * ui-v2 PR-4 Step A · PreviewModal
 *
 * 从 src/pages/Novel.tsx (L1299-1633) 抽出 · 仅 prop 接口 + import 调整 · 业务逻辑零改动
 *
 * 用途：章节预览 / 节点产物预览 modal
 *   • chapter:draft:N → 章节草稿
 *   • chapter:polish:N → 章节润色
 *   • novel.X → 节点产物（世界观 / 人物 bible / 分卷 / 等）
 *
 * 内含：
 *   • Best-of-N 裁判信息展示（节点产物）
 *   • 章节级 ChapterScoreCardSlot（PR-3 score 集成）
 *   • 章节自动校验 ChapterValidationPanel
 *   • 选区 / 全章 RefinementToolPanel + Dexie 持久化撤销栈
 *   • ChapterFeedbackButton (用户负样本反馈)
 *
 * 不变量（继承 Novel.tsx 业务）：
 *   • PR-4 仅"搬家" · 不改业务（V2-I-3 原子不动 + V2-I-7 disable/loading prop 不变）
 *   • 撤销栈持久化 to Dexie（v4 阶段 2.6）
 *   • markStateStale 触发 (gap-b PR-5 · FR-6.1)
 */

import { useEffect, useState } from 'react';
import { RotateCcw, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { ChapterFeedbackButton } from '../../components/ChapterFeedbackButton';
import { RefinementToolPanel } from '../../components/RefinementToolPanel';
import { ChapterValidationPanel } from '../../components/ChapterValidationPanel';
import { ChapterScoreCardSlot } from '../../components/ChapterScoreCardSlot';
import { useProject } from '../../store/project';
import { useSettings } from '../../store/settings';
import {
  liveRefinementUndoAll,
  liveRefinementUndoPush,
  liveRefinementUndoPopLast,
  type LiveRefinementUndoEntry,
} from '../../store/db';
import { markStateStale } from '../../store/characterStates';
import type {
  ChapterMeta,
  NovelChapterLoopMeta,
} from '../../pipeline/novelLoop';
import type { NodeArtifact } from '../../pipeline/types';
import { NOVEL_STEP_TITLES } from './constants';

export function PreviewModal({
  target, chapters, draftMeta, polishMeta, artifacts, onClose,
}: {
  target: string;
  chapters: ChapterMeta[];
  draftMeta: Partial<NovelChapterLoopMeta>;
  polishMeta: Partial<NovelChapterLoopMeta>;
  artifacts: Record<string, NodeArtifact>;
  onClose: () => void;
}) {
  let title = target;
  let body = '';
  let chapterIndex: number | null = null;
  let chapterSrc: 'draft' | 'polish' | null = null;
  let chapterTitle: string | undefined;
  // B. 节点级 Best-of-N 裁判信息（章节预览不显示，章节级裁判信息存在 chapter loop 内未对外暴露）
  type BoNInfo = {
    candidateCount: number;
    chosenIndex: number;
    scores?: number[];
    reasoning?: string;
    critique?: string;
    reflection?: boolean;
  };
  let bestOfNInfo: BoNInfo | null = null;
  if (target.startsWith('chapter:')) {
    const [, src, idxStr] = target.split(':');
    const idx = parseInt(idxStr, 10);
    chapterIndex = idx;
    chapterSrc = src as 'draft' | 'polish';
    const ch = chapters.find((c) => c.index === idx);
    chapterTitle = ch?.title;
    title = `第 ${idx} 章 · ${ch?.title ?? ''} (${src === 'draft' ? '草稿' : '润色'})`;
    if (src === 'draft') body = draftMeta.chapterContents?.[idx] ?? '(无内容)';
    else body = polishMeta.chapterContents?.[idx] ?? '(无内容)';
  } else {
    const art = artifacts[target];
    title = NOVEL_STEP_TITLES[target] ?? target;
    body = art?.content ?? '(无内容)';
    const meta = (art?.meta ?? {}) as { bestOfN?: BoNInfo };
    if (meta.bestOfN) bestOfNInfo = meta.bestOfN;
  }

  // 动态显示体：应用 / 撤销后会同步更新，避免关闭 modal 才看到改动
  const [displayBody, setDisplayBody] = useState(body);
  // v2 阶段 2.4 · 章节自动校验需要 ctx + enabledModuleIds
  const previewCtx = useProject((s) => s.ctx);
  const previewEnabledModuleIds = previewCtx.methodModuleIds ?? [];
  const isChapterPreview = chapterIndex != null && displayBody && displayBody !== '(无内容)';

  function copyAll() {
    navigator.clipboard.writeText(displayBody).catch(() => {});
  }

  // 选区优先 —— 用户在 <pre> 中选中的文本优先作为润色入口；
  // 未选区时 RefinementToolPanel 退化到全章/全产物。
  // 仅在「章节预览」场景（chapterIndex 存在）启用润色面板；节点产物预览不启用。
  const [selection, setSelection] = useState('');
  const handlePreMouseUp = () => {
    const sel = window.getSelection?.()?.toString().trim() ?? '';
    setSelection(sel);
  };
  const refinementInput = selection || displayBody;
  const showRefinement = chapterIndex != null && displayBody && displayBody !== '(无内容)';

  // v4 阶段 2.6 · 润色撤销栈 — 持久化到 Dexie（表 liveRefinementUndo）。
  // 以前仅存于 modal 生命周期内，关闭丢弃；现在重启 / 刷新仍可逐步回退。
  // refineUndoStack 的语义是当前 (chapterIndex, source) 的本地映射，仅用于统计显示；
  // 实际 push/pop 都以 db 为准。
  const [refineUndoStack, setRefineUndoStack] = useState<LiveRefinementUndoEntry[]>([]);

  // mount + chapterIndex/chapterSrc 变化时：从 db 读入当前章节的栈
  useEffect(() => {
    if (chapterIndex == null || chapterSrc == null) {
      setRefineUndoStack([]);
      return;
    }
    let alive = true;
    liveRefinementUndoAll().then((all) => {
      if (!alive) return;
      setRefineUndoStack(
        all.filter((e) => e.chapterIndex === chapterIndex && e.source === chapterSrc),
      );
    }).catch((err) => console.warn('[novel] load refinement undo failed', err));
    return () => { alive = false; };
  }, [chapterIndex, chapterSrc]);

  /**
   * 用户点「应用」后的写回逻辑：
   * - 选区存在且选区在原章节中出现 → String.replace 首个匹配位置
   * - 否则 → 全章替换
   * - v4 阶段 2.6 · 原始文本同时写入 Dexie liveRefinementUndo，重启后仍可撤销
   */
  const handleRefineApply = async (newText: string) => {
    if (chapterIndex == null || chapterSrc == null) return;
    const nodeId = chapterSrc === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (!cur) return;
    const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
    const oldChapter = meta.chapterContents?.[chapterIndex];
    if (oldChapter == null) return;

    const trimmedSel = selection.trim();
    const useSelection =
      trimmedSel.length > 0 && trimmedSel !== oldChapter && oldChapter.includes(trimmedSel);
    const nextChapter = useSelection ? oldChapter.replace(trimmedSel, newText) : newText;
    if (nextChapter === oldChapter) return;

    // 业务写回
    useProject.getState().upsertArtifact({
      ...cur,
      meta: {
        ...(meta as Record<string, unknown>),
        chapterContents: {
          ...(meta.chapterContents ?? {}),
          [chapterIndex]: nextChapter,
        },
      },
    });

    // v4 阶段 2.6 · 原始文本持久化到 Dexie
    const entry: Omit<LiveRefinementUndoEntry, 'id'> = {
      chapterIndex,
      source: chapterSrc,
      previousText: oldChapter,
      ts: Date.now(),
    };
    try {
      const id = await liveRefinementUndoPush(entry);
      setRefineUndoStack((stack) => [...stack, { ...entry, id }]);
    } catch (e) {
      console.warn('[novel] persist undo entry failed; falling back to in-memory', e);
      setRefineUndoStack((stack) => [...stack, entry as LiveRefinementUndoEntry]);
    }
    // gap-b PR-5 · FR-6.1 用户修订后标记该章及下游状态过期
    if (useSettings.getState().enableCharacterStateExtraction) {
      try {
        await markStateStale(0, chapterIndex);
      } catch (e) {
        console.warn('[gap-b] markStateStale 失败（不阻塞）:', e);
      }
    }
    setDisplayBody(nextChapter);
    setSelection(''); // 应用后选区失效（内容变了）
  };

  /**
   * 弹出栈顶 → 写回原始章节内容。
   * v4 阶段 2.6：以 db 为权威，避免 UI/db 不一致。
   */
  const handleRefineUndo = async () => {
    if (chapterIndex == null || chapterSrc == null) return;
    const last = await liveRefinementUndoPopLast(chapterIndex, chapterSrc).catch((err) => {
      console.warn('[novel] pop undo entry failed', err);
      return null;
    });
    if (!last) return;
    const nodeId = last.source === 'draft' ? 'novel.6' : 'novel.7';
    const cur = useProject.getState().artifacts[nodeId];
    if (cur) {
      const meta = (cur.meta ?? {}) as Partial<NovelChapterLoopMeta>;
      useProject.getState().upsertArtifact({
        ...cur,
        meta: {
          ...(meta as Record<string, unknown>),
          chapterContents: {
            ...(meta.chapterContents ?? {}),
            [last.chapterIndex]: last.previousText,
          },
        },
      });
    }
    // 同步本地栈状态（删除对应 id 条目）
    setRefineUndoStack((stack) => stack.filter((e) => e.id !== last.id));
    if (last.chapterIndex === chapterIndex && last.source === chapterSrc) {
      setDisplayBody(last.previousText);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg max-w-5xl w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
          <div className="font-semibold text-sm flex-1">{title}</div>
          {/* 章节预览：加「不满意」反馈按钮，沉淀为偏好资料 */}
          {chapterIndex != null && chapterSrc != null && (
            <ChapterFeedbackButton
              chapterIndex={chapterIndex}
              nodeId={chapterSrc === 'draft' ? 'novel.3.1' : 'novel.3.2'}
              chapterTitle={chapterTitle}
            />
          )}
          {refineUndoStack.length > 0 && (
            <button
              type="button"
              onClick={handleRefineUndo}
              className="text-xs px-2 py-1 rounded border border-warning/40 bg-warning/10 hover:bg-warning/20 text-warning inline-flex items-center gap-1"
              title={`撤销最近一次润色应用（共 ${refineUndoStack.length} 步可撤销）`}
            >
              <RotateCcw className="size-3" />
              撤销润色 ({refineUndoStack.length})
            </button>
          )}
          <button className="btn-ghost text-xs" onClick={copyAll}>复制全文</button>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭</button>
        </div>
        {/* B. Best-of-N 裁判面板（仅节点产物 + 启用过 Best-of-N 时显示） */}
        {bestOfNInfo && (
          <details className="border-b border-border-subtle px-4 py-2 text-xs bg-warning/5">
            <summary className="cursor-pointer text-warning font-medium flex items-center gap-2 select-none">
              🎯 Best-of-{bestOfNInfo.candidateCount} 裁判结果
              <span className="text-success/80">· 已选候选 #{bestOfNInfo.chosenIndex + 1}</span>
              {bestOfNInfo.reflection && (
                <span className="text-blue-300 text-tight-xs px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30">🔍 反思模式</span>
              )}
              <span className="ml-auto text-fg-muted text-tight-xs">点击展开 / 收起</span>
            </summary>
            <div className="mt-2 space-y-2 pl-1">
              {bestOfNInfo.scores && bestOfNInfo.scores.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-fg-muted">评分：</span>
                  {bestOfNInfo.scores.map((s, i) => (
                    <span
                      key={i}
                      className={clsx(
                        'px-1.5 py-0.5 rounded border font-mono text-tight-sm',
                        i === bestOfNInfo!.chosenIndex
                          ? 'border-success/60 bg-success/10 text-success'
                          : 'border-border-default text-fg-secondary',
                      )}
                    >
                      候选 {i + 1}: {s}
                    </span>
                  ))}
                </div>
              )}
              {bestOfNInfo.reasoning && (
                <div>
                  <div className="text-fg-muted mb-0.5">裁判理由：</div>
                  <div className="text-fg-primary leading-relaxed bg-surface/50 rounded p-2 whitespace-pre-wrap">
                    {bestOfNInfo.reasoning}
                  </div>
                </div>
              )}
              {bestOfNInfo.critique && (
                <div>
                  <div className="text-fg-muted mb-0.5 flex items-center gap-1">
                    <span>维度批评（反思模式）：</span>
                  </div>
                  <pre className="text-fg-secondary text-tight-sm leading-relaxed bg-surface/50 rounded p-2 whitespace-pre-wrap font-mono max-h-72 overflow-auto">
                    {bestOfNInfo.critique}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
        <pre
          className={isChapterPreview
            ? "flex-1 overflow-auto p-6 prose-reading whitespace-pre-wrap select-text min-h-0"
            : "flex-1 overflow-auto p-4 text-sm text-fg-primary whitespace-pre-wrap font-mono leading-relaxed select-text min-h-0"
          }
          onMouseUp={handlePreMouseUp}
        >
          {displayBody}
        </pre>
        {/* v2 阶段 2.9 · 章节级 6 维评分（不持久化，仅当前会话）+ gap-c 第 7 维 transition */}
        {isChapterPreview && (
          <ChapterScoreCardSlot
            text={displayBody}
            chapterKey={`${chapterSrc}:${chapterTitle}`}
            nodeId={chapterSrc === 'draft' ? 'novel.3.1' : 'novel.3.2'}
            stageId="novel"
            prevChapterContent={
              chapterIndex != null && chapterIndex > 1
                ? (polishMeta.chapterContents?.[chapterIndex - 1] ?? draftMeta.chapterContents?.[chapterIndex - 1])
                : undefined
            }
          />
        )}
        {/* v2 阶段 2.4 · 章节自动校验面板（仅章节预览场景） */}
        {isChapterPreview && (
          <ChapterValidationPanel
            text={displayBody}
            ctx={previewCtx}
            enabledModuleIds={previewEnabledModuleIds}
            nodeId={chapterSrc === 'draft' ? 'novel.3.1' : 'novel.3.2'}
            chapterTitle={chapterTitle}
            onApplyRevised={(revised) => handleRefineApply(revised)}
          />
        )}
        {showRefinement && (
          <details className="border-t border-border-subtle bg-canvas/40 px-4 py-2 shrink-0">
            <summary className="cursor-pointer text-xs text-fg-secondary select-none flex items-center gap-2 hover:text-fg-primary">
              <Wand2 className="size-3.5 text-primary-400" />
              <span>润色工具（6 个单一职责工具）</span>
              {selection ? (
                <span className="text-tight-xs px-1.5 py-0.5 rounded border border-success/40 bg-success/10 text-success">
                  选区润色 · {selection.length} 字
                </span>
              ) : (
                <span className="text-tight-xs text-fg-muted">
                  未选区 · 将对全章 ({displayBody.length} 字) 润色
                </span>
              )}
              {refineUndoStack.length > 0 && (
                <span className="text-tight-xs px-1.5 py-0.5 rounded border border-warning/30 bg-warning/5 text-warning/80">
                  已应用 {refineUndoStack.length} 次
                </span>
              )}
              <span className="ml-auto text-tight-xs text-fg-muted">点击展开 / 收起</span>
            </summary>
            <div className="mt-2">
              <RefinementToolPanel
                inputText={refinementInput}
                onApply={handleRefineApply}
                compact
              />
              <p className="mt-2 text-tight-xs text-fg-muted leading-snug">
                💡 点「应用」后会{selection ? '替换选区文本' : '覆写全章内容'}。顺安全起见，顶栏「撤销润色」按钮可逐步回退。
                多工具可链式使用（先精炼→再润色→再调节奏）；不同于 fili-web 的 N3.2 批量润色节点。
              </p>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
