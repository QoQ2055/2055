// 改编模式专用 4 步向导
// Step 1: 已选原作类型回显（在 NewProjectDialog 选过；这里只展示，可改）
// Step 2: 投喂原作（粘贴章节，多个 chunk）
// Step 3: 目标短剧规格（时长 + 平台 + 主角性别）
// Step 4: 项目命名（默认从原作首章标题派生）
// 提交后：写入 ProjectContext + sourceChunks，由父组件路由到 /intake 完成摘要

import { useEffect, useState } from 'react';
import { BookCopy, X, ChevronLeft, ChevronRight, Plus, Trash2, FileText, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { ProjectContext, SourceChunk } from '../pipeline/types';
import {
  ADAPT_SOURCE_TYPES, PLATFORMS, PROTAGONISTS, DURATIONS,
  buildConcept, sourceToLegacyAdaptationType,
} from '../data/projectTaxonomy';

interface AdaptIntakeWizardProps {
  open: boolean;
  busy?: boolean;
  /** 用户在 NewProjectDialog 选好的 adaptSourceType */
  initialAdaptSourceType: string;
  onCancel: () => void;
  /** 提交：返回 ctx + 待写入的 source chunks */
  onSubmit: (payload: {
    ctx: ProjectContext;
    chunks: Array<Omit<SourceChunk, 'id' | 'ts'>>;
  }) => void;
}

interface DraftChunk { title: string; raw: string }

export function AdaptIntakeWizard(p: AdaptIntakeWizardProps) {
  const [step, setStep] = useState(1);
  const TOTAL = 4;

  const [adaptSourceType, setAdaptSourceType] = useState(p.initialAdaptSourceType);
  const [chunks, setChunks] = useState<DraftChunk[]>([{ title: '第一章', raw: '' }]);
  const [durationMin, setDurationMin] = useState<number>(1);
  const [platform, setPlatform] = useState<string>('douyin');
  const [protagonistGender, setProtagonistGender] = useState<'male' | 'female' | 'dual' | 'nonhuman'>('male');
  const [name, setName] = useState('');

  useEffect(() => {
    if (p.open) {
      setStep(1);
      setAdaptSourceType(p.initialAdaptSourceType);
      setChunks([{ title: '第一章', raw: '' }]);
      setDurationMin(1);
      setPlatform('douyin');
      setProtagonistGender('male');
      setName('');
    }
  }, [p.open, p.initialAdaptSourceType]);

  if (!p.open) return null;

  // 默认项目名建议：取第一章标题或前 12 字
  const suggestedName = (() => {
    const first = chunks.find((c) => c.raw.trim());
    if (!first) return '';
    const t = first.title.trim();
    if (t && t !== '第一章') return `${t}_短剧改编`;
    const head = first.raw.trim().slice(0, 12).replace(/\s+/g, '');
    return head ? `${head}_短剧改编` : '';
  })();

  const validChunks = chunks.filter((c) => c.raw.trim().length >= 50);
  const totalChars = chunks.reduce((sum, c) => sum + c.raw.length, 0);

  function canAdvance(): boolean {
    if (step === 1) return !!adaptSourceType;
    if (step === 2) return validChunks.length >= 1;
    if (step === 3) return durationMin > 0 && !!platform;
    if (step === 4) return name.trim().length >= 2;
    return false;
  }

  function handleNext() {
    if (!canAdvance()) return;
    if (step < TOTAL) {
      // 进入下一步前的副作用：第 2 步进入第 3 步时自动建议项目名
      if (step === 3 && !name.trim() && suggestedName) setName(suggestedName);
      setStep(step + 1);
      return;
    }
    handleSubmit();
  }

  function handleSubmit() {
    if (!canAdvance()) return;
    const concept = buildConcept({
      protagonistGender,
      platform,
      durationMin,
      adaptedFrom: name.trim().replace(/_短剧改编$/, ''),
    });
    const ctx: ProjectContext = {
      name: name.trim(),
      concept,
      durationMin,
      mode: '改编',
      createMode: 'adaptation',
      adaptationType: sourceToLegacyAdaptationType(adaptSourceType),
      adaptSourceType,
      protagonistGender,
      platform,
    };
    const chunkPayload = validChunks.map((c, i) => ({
      title: c.title.trim() || `章节 ${i + 1}`,
      raw: c.raw.trim(),
    }));
    p.onSubmit({ ctx, chunks: chunkPayload });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) p.onCancel(); }}
    >
      <div className="w-full max-w-3xl card p-0 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <BookCopy className="size-4 text-sky-300" />
            <div>
              <h2 className="text-base font-semibold">原作摄入向导</h2>
              <div className="flex items-center gap-1 mt-0.5">
                {Array.from({ length: TOTAL }, (_, i) => (
                  <span
                    key={i}
                    className={clsx(
                      'h-1 rounded transition-all',
                      i + 1 === step ? 'w-6 bg-brand-500' : i + 1 < step ? 'w-4 bg-brand-500/50' : 'w-4 bg-zinc-800',
                    )}
                  />
                ))}
                <span className="text-[10px] text-zinc-500 ml-1.5">Step {step} / {TOTAL}</span>
              </div>
            </div>
          </div>
          <button className="btn-ghost p-1.5" onClick={p.onCancel} disabled={p.busy}>
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 space-y-3">
          {step === 1 && (
            <>
              <div className="label">原作类型</div>
              <div className="grid grid-cols-2 gap-2">
                {ADAPT_SOURCE_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAdaptSourceType(opt.value)}
                    className={clsx(
                      'text-left rounded-md border p-3 transition-colors',
                      adaptSourceType === opt.value
                        ? 'border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30'
                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900',
                    )}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-1">{opt.hint}</div>
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-zinc-500 mt-2">
                这一步决定 <span className="text-amber-300">KB 注入策略</span>（如长篇网文走压缩 5 策略，真实事件加合规审查）和后续 R1' 改编战略
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <div className="label">投喂原作章节</div>
                <div className="text-[11px] text-zinc-500">
                  共 <span className="font-mono text-zinc-300">{chunks.length}</span> 块 · {totalChars.toLocaleString()} 字 · 有效块 <span className={clsx('font-mono', validChunks.length >= 1 ? 'text-emerald-300' : 'text-zinc-500')}>{validChunks.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {chunks.map((c, i) => (
                  <div key={i} className="card border-zinc-800 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c.title}
                        onChange={(e) => setChunks((arr) => arr.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                        placeholder={`章节 ${i + 1} 标题`}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
                      />
                      {chunks.length > 1 && (
                        <button
                          className="btn-ghost p-1.5 text-rose-400 hover:bg-rose-500/10"
                          onClick={() => setChunks((arr) => arr.filter((_, j) => j !== i))}
                          title="删除此块"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={5}
                      value={c.raw}
                      onChange={(e) => setChunks((arr) => arr.map((x, j) => j === i ? { ...x, raw: e.target.value } : x))}
                      placeholder="粘贴本章原文（≥ 50 字）"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-brand-500"
                    />
                    <div className="text-[10px] text-zinc-600">
                      字数 <span className={clsx('font-mono', c.raw.length >= 50 ? 'text-emerald-400' : 'text-amber-400')}>{c.raw.length}</span>
                      {c.raw.length < 50 && c.raw.length > 0 && <span className="text-amber-400 ml-2">（需 ≥ 50 字才算有效）</span>}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="btn-outline w-full"
                onClick={() => setChunks((arr) => [...arr, { title: `章节 ${arr.length + 1}`, raw: '' }])}
              >
                <Plus className="size-4" /> 添加章节
              </button>
              <div className="text-[11px] text-zinc-500 mt-2">
                创建项目后还可在 <span className="font-mono text-zinc-300">/intake</span> 页继续追加章节、跑摘要
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="label">目标短剧规格</div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">单集时长</div>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDurationMin(d.value)}
                        className={clsx(
                          'px-2.5 py-1 text-xs rounded-md border transition-colors',
                          durationMin === d.value
                            ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                            : 'border-zinc-800 hover:border-zinc-700 text-zinc-300',
                        )}
                        title={d.hint}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">目标平台</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PLATFORMS.map((pl) => (
                      <button
                        key={pl.value}
                        type="button"
                        onClick={() => setPlatform(pl.value)}
                        className={clsx(
                          'text-left rounded-md border p-2.5 transition-colors',
                          platform === pl.value
                            ? 'border-brand-500/60 bg-brand-500/10 ring-1 ring-brand-500/30'
                            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900',
                        )}
                      >
                        <div className="text-xs font-medium">{pl.label}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{pl.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">主角性别（基于原作主线）</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PROTAGONISTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setProtagonistGender(opt.value as any)}
                        className={clsx(
                          'px-2 py-1.5 text-xs rounded-md border transition-colors',
                          protagonistGender === opt.value
                            ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                            : 'border-zinc-800 hover:border-zinc-700 text-zinc-300',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="label">项目命名</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={suggestedName || '例如：山海经短剧改编'}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                autoFocus
              />
              {suggestedName && name !== suggestedName && (
                <button
                  type="button"
                  className="btn-ghost text-[11px] mt-1 text-brand-300 hover:bg-brand-500/10"
                  onClick={() => setName(suggestedName)}
                >
                  使用建议名「{suggestedName}」
                </button>
              )}
              <div className="card bg-zinc-950 border-zinc-800 p-3 mt-3 space-y-2">
                <div className="text-[10px] text-zinc-600">即将创建的项目预览</div>
                <SummaryRow icon={<BookCopy className="size-3.5 text-sky-300" />} label="原作类型" value={ADAPT_SOURCE_TYPES.find((t) => t.value === adaptSourceType)?.label ?? adaptSourceType} />
                <SummaryRow icon={<FileText className="size-3.5 text-amber-300" />} label="原作章节" value={`${validChunks.length} 章 / ${totalChars.toLocaleString()} 字`} />
                <SummaryRow label="目标规格" value={`${durationMin} 分钟 · ${PLATFORMS.find((p) => p.value === platform)?.label ?? platform} · ${PROTAGONISTS.find((g) => g.value === protagonistGender)?.label ?? protagonistGender}`} />
              </div>
              <div className="text-[11px] text-zinc-500 mt-2">
                创建后会自动跳转 <span className="font-mono text-zinc-300">/intake</span> 页 → 一键摘要 + 合成 S0 总档案 → 进入 R1' 改编指令书
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-zinc-800 shrink-0">
          <button className="btn-outline" onClick={() => step > 1 ? setStep(step - 1) : p.onCancel()} disabled={p.busy}>
            <ChevronLeft className="size-4" />
            {step > 1 ? '上一步' : '取消'}
          </button>
          <button
            className="btn-primary"
            onClick={handleNext}
            disabled={!canAdvance() || p.busy}
          >
            {p.busy && <Loader2 className="size-4 animate-spin" />}
            {step === TOTAL ? '创建项目并进入 /intake' : '下一步'}
            {!p.busy && step < TOTAL && <ChevronRight className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span className="text-zinc-500">{label}：</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
