// New Project Dialog (v3 — workflow refactor)
//
// Two-step flow:
//   Step 1 — Pick a project mode (4 cards: original / adaptation / express / novel)
//   Step 2 — Mode-specific form (varies per mode)
//
// Goals:
//   • Make project mode the *first* decision; lock the rest of the UI to it.
//   • Avoid mixing original-mode fields (题材、平台) with adaptation-mode fields
//     or special-mode fields, which used to all live in one big form.
//   • Allow adding new modes (e.g. novel) by just dropping new metadata in
//     `data/projectModes.ts` + a small form section here.

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, BookCopy, Loader2, X, Wand2, Rocket, Edit3, ArrowLeft,
} from 'lucide-react';
import clsx from 'clsx';
import type { ProjectContext, CreateMode, ProjectMode } from '../pipeline/types';
import { GenreAnchorPreview } from './GenreAnchorPreview';
import { Input, Textarea } from './ui';
import {
  GENRES, MAX_GENRES, PLATFORMS, PROTAGONISTS, DURATIONS, ADAPT_SOURCE_TYPES,
  NOVEL_PLATFORMS, NOVEL_SCALES, NOVEL_POVS, NOVEL_AUDIENCES, NOVEL_TONES,
  deriveChapterCount, findNovelScale, findNovelPlatform,
  buildConcept, type GenreGroup, sourceToLegacyAdaptationType,
} from '../data/projectTaxonomy';
import {
  ALL_MODES, getModeMeta, type ProjectModeMeta,
} from '../data/projectModes';

const GROUPS: GenreGroup[] = [
  '东方玄幻', '都市/现实', '悬疑/惊悚', '科幻/末世',
  '历史/架空', '西幻/奇幻', '情感/校园', '特殊',
];

interface NewProjectDialogProps {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  /** 原创 / Express / Novel 模式：直接产出 ProjectContext，父组件创建项目并跳转 */
  onSubmit: (ctx: ProjectContext) => void;
  /** 改编模式：父组件接管，打开 AdaptIntakeWizard */
  onStartAdaptWizard: (adaptSourceType: string) => void;
}

export function NewProjectDialog(p: NewProjectDialogProps) {
  // ── step 1: which mode? ──
  const [mode, setMode] = useState<ProjectMode | null>(null);

  // ── step 2 form state (shared between modes; only relevant fields are read) ──
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState<number>(5);

  // original mode
  const [genres, setGenres] = useState<string[]>([]);
  const [protagonistGender, setProtagonistGender] = useState<'male' | 'female' | 'dual' | 'nonhuman'>('male');
  const [platform, setPlatform] = useState<string>('douyin');
  const [coreConflict, setCoreConflict] = useState('');

  // adaptation mode
  const [adaptSourceType, setAdaptSourceType] = useState<string>('novel_long');

  // novel mode
  const [novelPlatform, setNovelPlatform] = useState<string>('qidian');
  const [novelScale, setNovelScale] = useState<string>('long');
  const [novelPov, setNovelPov] = useState<string>('third_limited');
  const [novelAudience, setNovelAudience] = useState<string>('male');
  const [novelTone, setNovelTone] = useState<string>('fast_pleasure');
  const [novelTotalWordsK, setNovelTotalWordsK] = useState<number>(80);
  const [novelTotalChapters, setNovelTotalChapters] = useState<number>(228);
  const [novelChaptersTouched, setNovelChaptersTouched] = useState(false);
  const [novelLogline, setNovelLogline] = useState('');
  const [novelHook, setNovelHook] = useState('');

  // Reset every time the dialog (re)opens
  useEffect(() => {
    if (p.open) {
      setMode(null);
      setName('');
      setDurationMin(5);
      setGenres([]);
      setProtagonistGender('male');
      setPlatform('douyin');
      setCoreConflict('');
      setAdaptSourceType('novel_long');
      setNovelPlatform('qidian');
      setNovelScale('long');
      setNovelPov('third_limited');
      setNovelAudience('male');
      setNovelTone('fast_pleasure');
      setNovelTotalWordsK(80);
      setNovelTotalChapters(228);
      setNovelChaptersTouched(false);
      setNovelLogline('');
      setNovelHook('');
    }
  }, [p.open]);

  // 体量 / 平台变化 → 同步推荐总字数 + 总章数（除非用户手动改过）
  useEffect(() => {
    const scale = findNovelScale(novelScale);
    if (scale) setNovelTotalWordsK(scale.totalWordsK);
  }, [novelScale]);
  useEffect(() => {
    if (!novelChaptersTouched) {
      // 重新计算总章数（基于当前总字数 + 平台每章字数）
      const platform = findNovelPlatform(novelPlatform);
      const wpc = platform?.wordsPerChapter ?? 3500;
      const chapters = Math.max(20, Math.round(novelTotalWordsK * 10000 / wpc));
      setNovelTotalChapters(chapters);
    }
  }, [novelTotalWordsK, novelPlatform, novelChaptersTouched]);

  // 题材融合默认随读者群联动（仅在用户未选时）
  useEffect(() => {
    if (mode !== 'novel' || genres.length > 0) return;
    if (novelAudience === 'female') setProtagonistGender('female');
    else if (novelAudience === 'male') setProtagonistGender('male');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novelAudience, mode]);

  const previewConcept = useMemo(
    () => buildConcept({ genres, protagonistGender, platform, coreConflict, durationMin }),
    [genres, protagonistGender, platform, coreConflict, durationMin],
  );

  if (!p.open) return null;

  function toggleGenre(value: string) {
    setGenres((cur) => {
      if (cur.includes(value)) return cur.filter((v) => v !== value);
      if (cur.length >= MAX_GENRES) return cur;
      return [...cur, value];
    });
  }

  function canSubmit(): boolean {
    if (!mode) return false;
    if (mode === 'adaptation') return !!adaptSourceType;
    if (mode === 'original') {
      return name.trim().length > 0
        && genres.length >= 1
        && coreConflict.trim().length > 0;
    }
    if (mode === 'express') {
      // 特殊·分镜：仅需项目名。简介、时长、风格进入分镜工作台后再填。
      return name.trim().length > 0;
    }
    if (mode === 'novel') {
      return name.trim().length > 0
        && genres.length >= 1
        && coreConflict.trim().length > 0
        && novelTotalWordsK > 0
        && novelTotalChapters >= 5;
    }
    return false;
  }

  function handleSubmit() {
    if (!canSubmit() || !mode) return;

    if (mode === 'adaptation') {
      p.onStartAdaptWizard(adaptSourceType);
      return;
    }

    let ctx: ProjectContext;
    if (mode === 'original') {
      ctx = {
        name: name.trim(),
        concept: buildConcept({ genres, protagonistGender, platform, coreConflict, durationMin }),
        durationMin,
        mode: '从零创作',
        projectMode: 'original',
        createMode: 'original',
        genres,
        protagonistGender,
        platform,
        coreConflict: coreConflict.trim(),
      };
    } else if (mode === 'express') {
      ctx = {
        name: name.trim(),
        // Concept / duration are filled later inside the Express workbench;
        // start with sensible defaults so prompts don't break if run early.
        concept: '特殊·分镜项目（待填写简介）',
        durationMin: 5,
        mode: '特殊·分镜',
        projectMode: 'express',
        // back-compat fields so legacy code paths still work
        createMode: 'original' as CreateMode,
        projectType: 'express',
      };
    } else {
      // novel — full project setup
      const audienceMap: Record<string, string> = { male: '男频', female: '女频', general: '通用' };
      const platformLabel = findNovelPlatform(novelPlatform)?.label ?? novelPlatform;
      const scaleLabel = findNovelScale(novelScale)?.label ?? novelScale;
      const genreLabels = genres
        .map((v) => GENRES.find((g) => g.value === v)?.label)
        .filter(Boolean)
        .join('+');
      const conceptParts = [
        genreLabels && `${genreLabels}小说`,
        audienceMap[novelAudience],
        platformLabel,
        `${novelTotalWordsK}万字 / ${novelTotalChapters}章`,
        scaleLabel,
        coreConflict.trim(),
      ].filter(Boolean);
      ctx = {
        name: name.trim(),
        concept: conceptParts.join(' · '),
        durationMin: 0,
        mode: '小说创作',
        projectMode: 'novel',
        createMode: 'original' as CreateMode,
        // 复用通用结构化字段（让 buildStructuredFields 一并注入）
        genres,
        protagonistGender,
        coreConflict: coreConflict.trim(),
        // 小说专用
        novelPlatform,
        novelScale,
        novelPov,
        novelAudience,
        novelTone,
        novelTotalWordsK,
        novelTotalChapters,
        novelLogline: novelLogline.trim() || undefined,
        novelHook: novelHook.trim() || undefined,
      };
    }

    p.onSubmit(ctx);
  }

  const activeMeta: ProjectModeMeta | null = mode ? getModeMeta(mode) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 anim-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) p.onCancel(); }}
    >
      <div className="w-full max-w-3xl card p-0 max-h-[92vh] flex flex-col anim-modal-panel">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            {mode && (
              <button
                className="btn-ghost p-1.5"
                onClick={() => setMode(null)}
                disabled={p.busy}
                title="返回选择模式"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-primary-500" />
                {activeMeta ? `新建项目 · ${activeMeta.longLabel}` : '新建项目'}
              </h2>
              <p className="text-tight-sm text-fg-muted mt-0.5">
                {activeMeta
                  ? activeMeta.workflow
                  : '第一步：选择创作模式'}
              </p>
            </div>
          </div>
          <button className="btn-ghost p-1.5" onClick={p.onCancel} disabled={p.busy}>
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {!mode ? (
            <ModePickStep onPick={setMode} />
          ) : mode === 'original' ? (
            <OriginalForm
              name={name} setName={setName}
              durationMin={durationMin} setDurationMin={setDurationMin}
              genres={genres} toggleGenre={toggleGenre}
              protagonistGender={protagonistGender} setProtagonistGender={setProtagonistGender}
              platform={platform} setPlatform={setPlatform}
              coreConflict={coreConflict} setCoreConflict={setCoreConflict}
              previewConcept={previewConcept}
            />
          ) : mode === 'adaptation' ? (
            <AdaptForm
              adaptSourceType={adaptSourceType}
              setAdaptSourceType={setAdaptSourceType}
            />
          ) : mode === 'express' ? (
            <ExpressForm
              name={name} setName={setName}
            />
          ) : (
            <NovelForm
              name={name} setName={setName}
              genres={genres} toggleGenre={toggleGenre}
              protagonistGender={protagonistGender} setProtagonistGender={setProtagonistGender}
              coreConflict={coreConflict} setCoreConflict={setCoreConflict}
              novelPlatform={novelPlatform} setNovelPlatform={setNovelPlatform}
              novelScale={novelScale} setNovelScale={setNovelScale}
              novelPov={novelPov} setNovelPov={setNovelPov}
              novelAudience={novelAudience} setNovelAudience={setNovelAudience}
              novelTone={novelTone} setNovelTone={setNovelTone}
              novelTotalWordsK={novelTotalWordsK} setNovelTotalWordsK={setNovelTotalWordsK}
              novelTotalChapters={novelTotalChapters}
              setNovelTotalChapters={(v) => { setNovelChaptersTouched(true); setNovelTotalChapters(v); }}
              resetChaptersAuto={() => setNovelChaptersTouched(false)}
              novelChaptersTouched={novelChaptersTouched}
              novelLogline={novelLogline} setNovelLogline={setNovelLogline}
              novelHook={novelHook} setNovelHook={setNovelHook}
            />
          )}
        </div>

        {/* Footer */}
        {mode && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle shrink-0">
            <button className="btn-outline" onClick={p.onCancel} disabled={p.busy}>取消</button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!canSubmit() || p.busy}
            >
              {p.busy && <Loader2 className="size-4 animate-spin" />}
              {mode === 'adaptation' ? '下一步：投喂原作 →' : '创建项目'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 兼容老引用：deriveConceptFromAdaptType 已被 buildConcept 取代
export { sourceToLegacyAdaptationType };

/* ─────────────────────────── Step 1 ─────────────────────────── */

function ModePickStep({ onPick }: { onPick: (m: ProjectMode) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-secondary leading-relaxed">
        每种模式有独立的工作台与流水线，互不混淆。选择后右上角可以「返回」重新选。
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ALL_MODES.map((m) => (
          <ModeBigCard key={m.id} meta={m} onClick={() => onPick(m.id)} />
        ))}
      </div>
    </div>
  );
}

function ModeBigCard({ meta, onClick }: { meta: ProjectModeMeta; onClick: () => void }) {
  const Icon = pickModeIcon(meta.id);
  const isPlaceholder = meta.status === 'placeholder';
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'text-left rounded-lg border p-4 transition-all relative overflow-hidden',
        'border-border-subtle hover:border-neutral-600 hover:bg-surface/60',
        isPlaceholder && 'opacity-80',
      )}
    >
      {/* color band */}
      <div
        className="absolute top-0 left-0 h-1 w-full"
        style={{ backgroundColor: meta.accentHex }}
      />
      <div className="flex items-center gap-2 mt-1">
        <Icon className="size-5" style={{ color: meta.accentHex }} />
        <div className="text-base font-semibold">{meta.longLabel}</div>
        {isPlaceholder && (
          <span className="text-tight-xs px-1.5 py-0.5 rounded bg-elevated text-fg-secondary">
            开发中
          </span>
        )}
      </div>
      <div className="text-xs text-fg-secondary mt-2 leading-relaxed">{meta.tagline}</div>
      <div className="text-tight-xs text-fg-muted mt-3 font-mono tracking-tight">
        {meta.workflow}
      </div>
    </button>
  );
}

function pickModeIcon(id: ProjectMode) {
  switch (id) {
    case 'original':   return Sparkles;
    case 'adaptation': return BookCopy;
    case 'express':    return Rocket;
    case 'novel':      return Edit3;
  }
}

/* ─────────────────────────── Step 2 forms ─────────────────────────── */

interface OriginalFormProps {
  name: string; setName: (v: string) => void;
  durationMin: number; setDurationMin: (v: number) => void;
  genres: string[]; toggleGenre: (v: string) => void;
  protagonistGender: 'male' | 'female' | 'dual' | 'nonhuman';
  setProtagonistGender: (v: 'male' | 'female' | 'dual' | 'nonhuman') => void;
  platform: string; setPlatform: (v: string) => void;
  coreConflict: string; setCoreConflict: (v: string) => void;
  previewConcept: string;
}

function OriginalForm(f: OriginalFormProps) {
  return (
    <>
      <Field label="项目名称" required>
        <Input
          type="text"
          value={f.name}
          onChange={(e) => f.setName(e.target.value)}
          placeholder="例如：《重生之我是大魔王》"
          autoFocus
        />
      </Field>

      <Field
        label={`题材融合（已选 ${f.genres.length}/${MAX_GENRES}）`}
        required
        hint="选 1-3 个原子题材组合，决定 KB / 节奏 / 钩子配方；推荐 1-2 个"
      >
        <div className="space-y-2">
          {GROUPS.map((group) => {
            const items = GENRES.filter((g) => g.group === group);
            return (
              <div key={group}>
                <div className="text-tight-xs text-fg-muted uppercase tracking-wider mb-1">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((g) => {
                    const picked = f.genres.includes(g.value);
                    const capped = !picked && f.genres.length >= MAX_GENRES;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        disabled={capped}
                        onClick={() => f.toggleGenre(g.value)}
                        title={g.hint}
                        className={clsx(
                          'px-2 py-1 text-xs rounded-md border transition-colors',
                          picked
                            ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                            : capped
                              ? 'border-border-subtle bg-surface/50 text-fg-muted cursor-not-allowed'
                              : 'border-border-subtle hover:border-border-default hover:bg-surface text-fg-secondary',
                        )}
                      >
                        {g.label}{picked && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      <GenreAnchorPreview genres={f.genres} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="主角性别">
          <div className="grid grid-cols-2 gap-1.5">
            {PROTAGONISTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => f.setProtagonistGender(opt.value as 'male' | 'female' | 'dual' | 'nonhuman')}
                className={clsx(
                  'px-2 py-1.5 text-xs rounded-md border transition-colors',
                  f.protagonistGender === opt.value
                    ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                    : 'border-border-subtle hover:border-border-default text-fg-secondary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="目标平台" hint="决定钩子密度 / 完播阈值 / 竖横屏">
          <select
            value={f.platform}
            onChange={(e) => f.setPlatform(e.target.value)}
            className="w-full bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-primary-300"
          >
            {PLATFORMS.map((pl) => (
              <option key={pl.value} value={pl.value}>{pl.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="单集时长">
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => f.setDurationMin(d.value)}
              className={clsx(
                'px-2 py-1 text-xs rounded-md border transition-colors',
                f.durationMin === d.value
                  ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                  : 'border-border-subtle hover:border-border-default text-fg-secondary',
              )}
              title={d.hint}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="一句话核心冲突" required hint="主角 + 处境 + 目标 + 阻力，e.g. 落魄少年重生立誓灭杀仇家">
        <Textarea
          rows={2}
          value={f.coreConflict}
          onChange={(e) => f.setCoreConflict(e.target.value)}
          placeholder="谁 + 在什么情境 + 要做什么 + 谁在阻挠"
        />
      </Field>

      <div className="card bg-canvas border-border-subtle p-3">
        <div className="text-tight-xs text-fg-muted mb-1">派生 concept (将注入到所有 prompt)</div>
        <div className="text-xs text-fg-secondary font-mono break-all">
          {f.previewConcept || <span className="text-fg-muted">填写题材和冲突后自动生成…</span>}
        </div>
      </div>
    </>
  );
}

function AdaptForm({
  adaptSourceType, setAdaptSourceType,
}: {
  adaptSourceType: string;
  setAdaptSourceType: (v: string) => void;
}) {
  return (
    <>
      <Field label="原作类型" required hint="决定 KB 注入策略和合规审查重点；点击下一步进入「原作摄入向导」">
        <div className="grid grid-cols-2 gap-2">
          {ADAPT_SOURCE_TYPES.map((opt) => (
            <SmallCard
              key={opt.value}
              active={adaptSourceType === opt.value}
              onClick={() => setAdaptSourceType(opt.value)}
              title={opt.label}
              desc={opt.hint}
            />
          ))}
        </div>
      </Field>
      <div className="card border-violet-500/30 bg-violet-500/5 p-3 text-xs text-violet-200 flex items-start gap-2">
        <Wand2 className="size-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">下一步：原作摄入向导</div>
          <div className="text-fg-secondary mt-0.5">
            点击下方「下一步：投喂原作」会打开 4 步向导：① 投喂原作章节 ② 选目标短剧规格 ③ 命名项目。
            项目名、概念、节奏会从原作和向导自动派生。
          </div>
        </div>
      </div>
    </>
  );
}

function ExpressForm({
  name, setName,
}: {
  name: string; setName: (v: string) => void;
}) {
  return (
    <>
      <div className="card border-warning/30 bg-warning/5 p-3 text-xs text-warning flex items-start gap-2">
        <Rocket className="size-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">特殊·分镜模式</div>
          <div className="text-fg-secondary mt-0.5">
            跳过剧本流水线，直接进入分镜规划。只需项目名即可创建；简介 / 时长 / 风格 在进入分镜工作台后填写。
          </div>
        </div>
      </div>

      <Field label="项目名称" required>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：《惊鸿一瞥》分镜测试"
          autoFocus
        />
      </Field>
    </>
  );
}

interface NovelFormProps {
  name: string; setName: (v: string) => void;
  genres: string[]; toggleGenre: (v: string) => void;
  protagonistGender: 'male' | 'female' | 'dual' | 'nonhuman';
  setProtagonistGender: (v: 'male' | 'female' | 'dual' | 'nonhuman') => void;
  coreConflict: string; setCoreConflict: (v: string) => void;
  novelPlatform: string; setNovelPlatform: (v: string) => void;
  novelScale: string; setNovelScale: (v: string) => void;
  novelPov: string; setNovelPov: (v: string) => void;
  novelAudience: string; setNovelAudience: (v: string) => void;
  novelTone: string; setNovelTone: (v: string) => void;
  novelTotalWordsK: number; setNovelTotalWordsK: (v: number) => void;
  novelTotalChapters: number; setNovelTotalChapters: (v: number) => void;
  resetChaptersAuto: () => void;
  novelChaptersTouched: boolean;
  novelLogline: string; setNovelLogline: (v: string) => void;
  novelHook: string; setNovelHook: (v: string) => void;
}

function NovelForm(f: NovelFormProps) {
  const platform = NOVEL_PLATFORMS.find((p) => p.value === f.novelPlatform);
  const wpc = platform?.wordsPerChapter ?? 3500;
  const derivedWpc = f.novelTotalChapters > 0
    ? Math.round(f.novelTotalWordsK * 10000 / f.novelTotalChapters)
    : wpc;

  return (
    <>
      <div className="card border-success/30 bg-success/5 p-3 text-xs text-success-200 flex items-start gap-2">
        <Edit3 className="size-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">小说创作模式</div>
          <div className="text-fg-secondary mt-0.5">
            三阶段流水线：设定（世界观 + 人物 bible）→ 大纲（分卷 + 分章 + 伏笔）→ 章节（草稿 + 润色）。
            以下字段在大纲生成与章节写作中是<b>硬约束</b>，请认真填写。
          </div>
        </div>
      </div>

      <Field label="项目名称" required>
        <Input
          type="text"
          value={f.name}
          onChange={(e) => f.setName(e.target.value)}
          placeholder="例如：《长夜未央》"
          autoFocus
        />
      </Field>

      {/* ── 平台 / 体量 ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="目标平台" required hint="决定每章字数 / 钩子密度 / 节奏范式">
          <select
            value={f.novelPlatform}
            onChange={(e) => f.setNovelPlatform(e.target.value)}
            className="w-full bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary-300"
          >
            {NOVEL_PLATFORMS.map((pl) => (
              <option key={pl.value} value={pl.value}>
                {pl.label}（每章 {pl.wordsPerChapter} 字）
              </option>
            ))}
          </select>
          <div className="text-tight-sm text-fg-muted mt-1">{platform?.hint}</div>
        </Field>

        <Field label="读者群" required hint="影响题材交集 / 爽点配方 / 敏感线">
          <div className="flex gap-1.5">
            {NOVEL_AUDIENCES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => f.setNovelAudience(opt.value)}
                title={opt.hint}
                className={clsx(
                  'flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors',
                  f.novelAudience === opt.value
                    ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                    : 'border-border-subtle hover:border-border-default text-fg-secondary',
                )}
              >{opt.label}</button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="体量档" required hint="决定总字数和分卷数；切换会重置总字数">
        <div className="grid grid-cols-5 gap-1.5">
          {NOVEL_SCALES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => f.setNovelScale(s.value)}
              title={`${s.hint} · 推荐 ${s.volumesHint}`}
              className={clsx(
                'px-2 py-1.5 text-xs rounded-md border transition-colors text-center',
                f.novelScale === s.value
                  ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                  : 'border-border-subtle hover:border-border-default text-fg-secondary',
              )}
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-tight-xs text-fg-muted">{s.totalWordsK}万</div>
            </button>
          ))}
        </div>
      </Field>

      {/* ── 总字数 / 章数 双联控件 ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="目标总字数（万字）" required>
          <Input
            type="number"
            min={1}
            step={5}
            value={f.novelTotalWordsK}
            onChange={(e) => f.setNovelTotalWordsK(Math.max(1, parseInt(e.target.value, 10) || 0))}
          />
        </Field>
        <Field label="目标总章节数" required hint={f.novelChaptersTouched ? '已手动调整' : '随平台 + 总字数自动派生'}>
          <div className="flex gap-1.5">
            <Input
              type="number"
              min={5}
              step={10}
              value={f.novelTotalChapters}
              onChange={(e) => f.setNovelTotalChapters(Math.max(5, parseInt(e.target.value, 10) || 0))}
              className="flex-1"
            />
            {f.novelChaptersTouched && (
              <button
                type="button"
                className="btn-ghost text-xs px-2"
                onClick={f.resetChaptersAuto}
                title="按平台 + 总字数重新派生"
              >自动</button>
            )}
          </div>
        </Field>
      </div>

      <div className="text-tight-sm text-fg-muted -mt-2">
        派生：每章约 <b className="text-fg-secondary">{derivedWpc}</b> 字（平台推荐 {wpc} 字 · ±10% 浮动是 chapter_writer 的硬律）
      </div>

      {/* ── POV / 调性 ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="POV 视角" required hint="全书锁定，chapter_writer 严禁视角乱跳">
          <select
            value={f.novelPov}
            onChange={(e) => f.setNovelPov(e.target.value)}
            className="w-full bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary-300"
          >
            {NOVEL_POVS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="text-tight-sm text-fg-muted mt-1">
            {NOVEL_POVS.find((o) => o.value === f.novelPov)?.hint}
          </div>
        </Field>

        <Field label="写作调性" required hint="影响章节叙述节奏 / 场景密度 / 钩子方式">
          <select
            value={f.novelTone}
            onChange={(e) => f.setNovelTone(e.target.value)}
            className="w-full bg-surface border border-border-subtle rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-primary-300"
          >
            {NOVEL_TONES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="text-tight-sm text-fg-muted mt-1">
            {NOVEL_TONES.find((o) => o.value === f.novelTone)?.hint}
          </div>
        </Field>
      </div>

      {/* ── 题材 / 主角性别 ── */}
      <Field
        label={`题材融合（已选 ${f.genres.length}/${MAX_GENRES}）`}
        required
        hint="选 1-3 个原子题材组合，决定 KB / 节奏 / 钩子配方；推荐 1-2 个"
      >
        <div className="space-y-2">
          {GROUPS.map((group) => {
            const items = GENRES.filter((g) => g.group === group);
            return (
              <div key={group}>
                <div className="text-tight-xs text-fg-muted uppercase tracking-wider mb-1">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((g) => {
                    const picked = f.genres.includes(g.value);
                    const capped = !picked && f.genres.length >= MAX_GENRES;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        disabled={capped}
                        onClick={() => f.toggleGenre(g.value)}
                        title={g.hint}
                        className={clsx(
                          'px-2 py-1 text-xs rounded-md border transition-colors',
                          picked
                            ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                            : capped
                              ? 'border-border-subtle bg-surface/50 text-fg-muted cursor-not-allowed'
                              : 'border-border-subtle hover:border-border-default hover:bg-surface text-fg-secondary',
                        )}
                      >
                        {g.label}{picked && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      <GenreAnchorPreview genres={f.genres} />

      <Field label="主角性别">
        <div className="grid grid-cols-4 gap-1.5">
          {PROTAGONISTS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => f.setProtagonistGender(opt.value as 'male' | 'female' | 'dual' | 'nonhuman')}
              className={clsx(
                'px-2 py-1.5 text-xs rounded-md border transition-colors',
                f.protagonistGender === opt.value
                  ? 'border-primary-300/60 bg-primary-500/15 text-primary-200'
                  : 'border-border-subtle hover:border-border-default text-fg-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {/* ── 核心冲突（必填）+ 卖点 + 金手指 ── */}
      <Field label="核心冲突" required hint="主角 + 处境 + 目标 + 阻力。novel_outliner 据此规划全书主线">
        <Textarea
          rows={2}
          value={f.coreConflict}
          onChange={(e) => f.setCoreConflict(e.target.value)}
          placeholder="例：落魄少年绑定签到系统，立誓在十年内灭杀屠戮全族的仇家，却发现敌方背后有更深的阴谋"
        />
      </Field>

      <Field label="一句话简介 / 卖点（可选）" hint="≤ 100 字，营销向，会出现在大纲首页">
        <Input
          type="text"
          value={f.novelLogline}
          onChange={(e) => f.setNovelLogline(e.target.value)}
          placeholder="例：当所有修真者都在追逐天道，他选择跟天道讨债"
          maxLength={120}
        />
      </Field>

      <Field label="主角金手指 / 关键设定（可选）" hint="≤ 200 字，会注入到世界观和人物 bible 生成 prompt 中">
        <Textarea
          rows={2}
          value={f.novelHook}
          onChange={(e) => f.setNovelHook(e.target.value)}
          placeholder="例：每杀一名同境界敌人可吞噬其修为；但每次吞噬会带回死者最痛苦的一段记忆"
          maxLength={400}
        />
      </Field>

      <div className="card bg-canvas border-border-subtle p-3">
        <div className="text-tight-xs text-fg-muted mb-1">将注入所有小说 prompt 的项目设定摘要</div>
        <div className="text-xs text-fg-secondary font-mono break-words leading-relaxed">
          {[
            f.genres.map((v) => GENRES.find((g) => g.value === v)?.label).filter(Boolean).join('+'),
            { male: '男频', female: '女频', general: '通用' }[f.novelAudience],
            platform?.label,
            `${f.novelTotalWordsK}万 / ${f.novelTotalChapters}章`,
            NOVEL_POVS.find((o) => o.value === f.novelPov)?.label,
            NOVEL_TONES.find((o) => o.value === f.novelTone)?.label,
          ].filter(Boolean).join(' · ') || <span className="text-fg-muted">填写以上字段后预览…</span>}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── Shared atoms ─────────────────────────── */

function SmallCard({
  active, onClick, icon, title, desc,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'text-left rounded-md border p-3 transition-colors',
        active
          ? 'border-primary-300/60 bg-primary-500/10 ring-1 ring-primary-500/30'
          : 'border-border-subtle hover:border-border-default hover:bg-surface',
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="text-tight-sm text-fg-muted mt-1 leading-snug">{desc}</div>
    </button>
  );
}

function Field({ label, required, hint, children }:
  { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </div>
      {children}
      {hint && <div className="text-tight-sm text-fg-muted mt-1">{hint}</div>}
    </div>
  );
}
