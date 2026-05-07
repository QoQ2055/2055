/**
 * ui-v2 PR-4 Step B  NovelSettingsDialog
 *
 * 从 src/pages/Novel.tsx 抽出  业务零改动
 * 同时含 DialogField 内部 wrapper  仅本文件使用
 */

import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { UserKbBindingPanel } from '../../components/UserKbBindingPanel';
import { MethodModulePanel } from '../../components/MethodModulePanel';
import {
  GENRES, NOVEL_PLATFORMS, NOVEL_POVS, NOVEL_TONES, NOVEL_SCALES,
  NOVEL_AUDIENCES, MAX_GENRES, PROTAGONISTS,
  findNovelPlatform, findNovelScale,
} from '../../data/projectTaxonomy';
import type { ProjectContext } from '../../pipeline/types';


/* ──────────────────────────────────────────────────────────────────
 * 小说设定补全 / 编辑对话框
 *
 * 同时服务两种场景：
 *   • 老 novel 项目从未填过这些字段 → 一次性补全
 *   • 用户中途想改某个字段（比如换平台）→ 增量编辑
 *
 * 注意：所有产物（artifacts）保留不动；只 patch ProjectContext。
 * ────────────────────────────────────────────────────────────────── */
export function NovelSettingsDialog({
  ctx, onClose, onSave,
}: {
  ctx: ProjectContext;
  onClose: () => void;
  onSave: (patch: Partial<ProjectContext>) => void;
}) {
  const [novelPlatform, setNovelPlatform] = useState(ctx.novelPlatform ?? 'qidian');
  const [novelScale, setNovelScale] = useState(ctx.novelScale ?? 'long');
  const [novelPov, setNovelPov] = useState(ctx.novelPov ?? 'third_limited');
  const [novelAudience, setNovelAudience] = useState(ctx.novelAudience ?? 'male');
  const [novelTone, setNovelTone] = useState(ctx.novelTone ?? 'fast_pleasure');
  const [novelTotalWordsK, setNovelTotalWordsK] = useState(ctx.novelTotalWordsK ?? 80);
  const [novelTotalChapters, setNovelTotalChapters] = useState(
    ctx.novelTotalChapters ?? Math.round(80 * 10000 / 3500),
  );
  const [chaptersTouched, setChaptersTouched] = useState(!!ctx.novelTotalChapters);
  const [genres, setGenres] = useState<string[]>(ctx.genres ?? []);
  const [protagonistGender, setProtagonistGender] = useState<NonNullable<ProjectContext['protagonistGender']>>(
    ctx.protagonistGender ?? 'male',
  );
  const [coreConflict, setCoreConflict] = useState(ctx.coreConflict ?? '');
  const [novelLogline, setNovelLogline] = useState(ctx.novelLogline ?? '');
  const [novelHook, setNovelHook] = useState(ctx.novelHook ?? '');
  const [userKbDocIds, setUserKbDocIds] = useState<number[]>(ctx.userKbDocIds ?? []);
  const [methodModuleIds, setMethodModuleIds] = useState<string[]>(ctx.methodModuleIds ?? []);

  // 体量切换：自动同步总字数
  useEffect(() => {
    const s = findNovelScale(novelScale);
    if (s) setNovelTotalWordsK(s.totalWordsK);
  }, [novelScale]);
  // 总字数 / 平台变化 → 同步章数（除非用户手动改过）
  useEffect(() => {
    if (!chaptersTouched) {
      const wpc = findNovelPlatform(novelPlatform)?.wordsPerChapter ?? 3500;
      setNovelTotalChapters(Math.max(20, Math.round(novelTotalWordsK * 10000 / wpc)));
    }
  }, [novelTotalWordsK, novelPlatform, chaptersTouched]);

  function toggleGenre(v: string) {
    setGenres((cur) => {
      if (cur.includes(v)) return cur.filter((x) => x !== v);
      if (cur.length >= MAX_GENRES) return cur;
      return [...cur, v];
    });
  }

  const canSave =
    genres.length >= 1
    && coreConflict.trim().length > 0
    && novelTotalWordsK > 0
    && novelTotalChapters >= 5;

  function handleSave() {
    if (!canSave) return;
    const patch: Partial<ProjectContext> = {
      novelPlatform, novelScale, novelPov, novelAudience, novelTone,
      novelTotalWordsK, novelTotalChapters,
      genres, protagonistGender, coreConflict: coreConflict.trim(),
      novelLogline: novelLogline.trim() || undefined,
      novelHook: novelHook.trim() || undefined,
      userKbDocIds: userKbDocIds.length > 0 ? userKbDocIds : undefined,
      methodModuleIds: methodModuleIds.length > 0 ? methodModuleIds : undefined,
    };
    onSave(patch);
  }

  const platform = findNovelPlatform(novelPlatform);
  const wpc = platform?.wordsPerChapter ?? 3500;
  const derivedWpc = novelTotalChapters > 0
    ? Math.round(novelTotalWordsK * 10000 / novelTotalChapters)
    : wpc;

  const audienceLabels: Record<string, string> = { male: '男频', female: '女频', general: '通用' };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas border border-border-subtle rounded-lg max-w-3xl w-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
          <Wand2 className="size-4 text-success" />
          <div className="font-semibold text-sm flex-1">编辑小说项目设定</div>
          <button className="btn-ghost text-xs" onClick={onClose}>关闭</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 text-xs">
          {/* 平台 / 读者 */}
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="目标平台 *">
              <select
                value={novelPlatform}
                onChange={(e) => setNovelPlatform(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              >
                {NOVEL_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}（每章 {p.wordsPerChapter}）
                  </option>
                ))}
              </select>
              <div className="text-fg-muted mt-1">{platform?.hint}</div>
            </DialogField>
            <DialogField label="读者群 *">
              <div className="flex gap-1">
                {NOVEL_AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setNovelAudience(a.value)}
                    className={clsx(
                      'flex-1 px-2 py-1.5 rounded border',
                      novelAudience === a.value
                        ? 'border-success/60 bg-success/15 text-success-200'
                        : 'border-border-subtle hover:border-border-default',
                    )}
                  >{a.label}</button>
                ))}
              </div>
            </DialogField>
          </div>

          {/* 体量 */}
          <DialogField label="体量档 *">
            <div className="grid grid-cols-5 gap-1">
              {NOVEL_SCALES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setNovelScale(s.value)}
                  className={clsx(
                    'px-2 py-1.5 rounded border text-center',
                    novelScale === s.value
                      ? 'border-success/60 bg-success/15 text-success-200'
                      : 'border-border-subtle hover:border-border-default',
                  )}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-tight-xs text-fg-muted">{s.totalWordsK}万</div>
                </button>
              ))}
            </div>
          </DialogField>

          {/* 总字数 / 章数 */}
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="总字数（万字）*">
              <input
                type="number" min={1} step={5}
                value={novelTotalWordsK}
                onChange={(e) => setNovelTotalWordsK(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              />
            </DialogField>
            <DialogField label={`总章节数 *${chaptersTouched ? '（已手动）' : '（自动派生）'}`}>
              <div className="flex gap-1">
                <input
                  type="number" min={5} step={10}
                  value={novelTotalChapters}
                  onChange={(e) => {
                    setChaptersTouched(true);
                    setNovelTotalChapters(Math.max(5, parseInt(e.target.value, 10) || 0));
                  }}
                  className="flex-1 bg-surface border border-border-subtle rounded px-2 py-1.5"
                />
                {chaptersTouched && (
                  <button className="btn-ghost text-xs" onClick={() => setChaptersTouched(false)}>自动</button>
                )}
              </div>
            </DialogField>
          </div>
          <div className="text-fg-muted -mt-1">
            派生：每章约 <b className="text-fg-secondary">{derivedWpc}</b> 字（平台推荐 {wpc} · ±10% 是写作硬律）
          </div>

          {/* POV / 调性 */}
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="POV 视角 *">
              <select
                value={novelPov}
                onChange={(e) => setNovelPov(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              >
                {NOVEL_POVS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </DialogField>
            <DialogField label="调性 *">
              <select
                value={novelTone}
                onChange={(e) => setNovelTone(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
              >
                {NOVEL_TONES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </DialogField>
          </div>

          {/* 题材 */}
          <DialogField label={`题材融合（${genres.length}/${MAX_GENRES}）*`}>
            <div className="flex flex-wrap gap-1">
              {GENRES.map((g) => {
                const picked = genres.includes(g.value);
                const capped = !picked && genres.length >= MAX_GENRES;
                return (
                  <button
                    key={g.value}
                    type="button"
                    disabled={capped}
                    onClick={() => toggleGenre(g.value)}
                    title={g.hint}
                    className={clsx(
                      'px-2 py-0.5 text-tight-sm rounded border',
                      picked
                        ? 'border-success/60 bg-success/15 text-success-200'
                        : capped
                          ? 'border-border-subtle text-fg-muted cursor-not-allowed'
                          : 'border-border-subtle hover:border-border-default',
                    )}
                  >{g.label}</button>
                );
              })}
            </div>
          </DialogField>

          {/* 主角 */}
          <DialogField label="主角性别">
            <div className="grid grid-cols-4 gap-1">
              {PROTAGONISTS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProtagonistGender(opt.value as typeof protagonistGender)}
                  className={clsx(
                    'px-2 py-1.5 rounded border',
                    protagonistGender === opt.value
                      ? 'border-success/60 bg-success/15 text-success-200'
                      : 'border-border-subtle hover:border-border-default',
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </DialogField>

          <DialogField label="核心冲突 *">
            <textarea
              rows={2}
              value={coreConflict}
              onChange={(e) => setCoreConflict(e.target.value)}
              placeholder="主角 + 处境 + 目标 + 阻力"
              className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
            />
          </DialogField>

          <DialogField label="一句话简介 / 卖点（可选）">
            <input
              type="text" maxLength={120}
              value={novelLogline}
              onChange={(e) => setNovelLogline(e.target.value)}
              className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
            />
          </DialogField>

          <DialogField label="主角金手指 / 关键设定（可选）">
            <textarea
              rows={2} maxLength={400}
              value={novelHook}
              onChange={(e) => setNovelHook(e.target.value)}
              className="w-full bg-surface border border-border-subtle rounded px-2 py-1.5"
            />
          </DialogField>

          <UserKbBindingPanel
            value={userKbDocIds}
            onChange={setUserKbDocIds}
            collapsed={userKbDocIds.length === 0}
          />
          <MethodModulePanel
            value={methodModuleIds}
            onChange={setMethodModuleIds}
            collapsed={methodModuleIds.length === 0}
            // P9-C 把当前对话框中的字段实时传给推荐引擎，
            // 这样用户调整 ctx 字段时推荐结果会同步刷新。
            ctx={{
              novelPlatform,
              novelScale,
              novelPov,
              novelAudience,
              novelTone,
              genres,
              protagonistGender,
              coreConflict,
            }}
          />

          <div className="bg-surface/50 border border-border-subtle rounded p-2 text-fg-secondary">
            预览：{[
              genres.map((v) => GENRES.find((g) => g.value === v)?.label).filter(Boolean).join('+') || '(题材?)',
              audienceLabels[novelAudience],
              platform?.label,
              `${novelTotalWordsK}万 / ${novelTotalChapters}章`,
              NOVEL_POVS.find((o) => o.value === novelPov)?.label,
              NOVEL_TONES.find((o) => o.value === novelTone)?.label,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-3 border-t border-border-subtle">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" disabled={!canSave} onClick={handleSave}>
            保存设定
          </button>
        </div>
      </div>
    </div>
  );
}

function DialogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-fg-secondary mb-1">{label}</div>
      {children}
    </div>
  );
}