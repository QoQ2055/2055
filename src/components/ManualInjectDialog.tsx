// Manual artifact injection dialog
// 让用户粘贴外部内容（剧本 / 资产 JSON / etc）写入指定 nodeId，
// 标记 meta.manual=true，下游工作台照常运行，无需上游产物。

import { useEffect, useRef, useState } from 'react';
import { X, Download, AlertTriangle, FileText, Loader2, Sparkles, Check, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import type { NodeArtifact, StageId } from '../pipeline/types';
import { normalizeContent, type NormalizeConfig } from './normalizer';
import { ScreenplayDoctorPanel } from './ScreenplayDoctorPanel';
import { useSettings } from '../store/settings';

export interface InjectField {
  /** 写入的 nodeId，如 'screenplay.7' / 'assets.4' */
  nodeId: string;
  /** 所属 stageId */
  stageId: StageId;
  /** 步序（用于 invalidate；通常等于 nodeId 末尾数字） */
  index: number;
  /** UI 标签 */
  label: string;
  hint?: string;
  /** 推荐占位符 */
  placeholder?: string;
  /** 校验：返回错误消息或 null */
  validate?: (text: string) => string | null;
  /** content 格式 */
  format?: 'markdown' | 'json' | 'text';
  /** 可选字段 — 留空时跳过校验且不写入产物 */
  optional?: boolean;
  /** AI 格式修复配置；存在则显示 ✨ 按钮 */
  normalize?: NormalizeConfig;
  /** 启用「剧本医生质检」面板（仅对剧本类字段有意义）。 */
  doctor?: boolean;
}

interface ManualInjectDialogProps {
  open: boolean;
  title: string;
  description?: string;
  fields: InjectField[];
  /** 已存在的产物（用于回填初始值） */
  existing?: Record<string, NodeArtifact | undefined>;
  onCancel: () => void;
  onSubmit: (artifacts: NodeArtifact[]) => void;
}

interface NormalizeState {
  status: 'streaming' | 'previewing' | 'rejected' | 'error';
  preview: string;
  /** 替换原文前的原始内容快照，用于「撤销修复」 */
  backup?: string;
  rejectReason?: string;
  errMsg?: string;
}

export function ManualInjectDialog(p: ManualInjectDialogProps) {
  const settings = useSettings();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [normalizeStates, setNormalizeStates] = useState<Record<string, NormalizeState | undefined>>({});
  /** 已通过 AI 修复并 apply 过的字段 → 原文备份，用于撤销 */
  const [appliedBackup, setAppliedBackup] = useState<Record<string, string>>({});
  const abortRefs = useRef<Record<string, AbortController | undefined>>({});

  useEffect(() => {
    if (!p.open) return;
    const init: Record<string, string> = {};
    for (const f of p.fields) init[f.nodeId] = p.existing?.[f.nodeId]?.content ?? '';
    setValues(init);
    setErrors({});
    setNormalizeStates({});
    setAppliedBackup({});
  }, [p.open, p.fields, p.existing]);

  // 关闭对话框时中止所有未完成的归一化请求
  useEffect(() => {
    if (p.open) return;
    for (const k in abortRefs.current) abortRefs.current[k]?.abort();
    abortRefs.current = {};
  }, [p.open]);

  if (!p.open) return null;

  function setNormState(nodeId: string, patch: Partial<NormalizeState> | undefined) {
    setNormalizeStates((s) => {
      if (patch === undefined) {
        const { [nodeId]: _, ...rest } = s;
        return rest;
      }
      const cur = s[nodeId] ?? { status: 'streaming', preview: '' };
      return { ...s, [nodeId]: { ...cur, ...patch } };
    });
  }

  async function startNormalize(f: InjectField) {
    if (!f.normalize) return;
    const raw = (values[f.nodeId] ?? '').trim();
    if (!raw) {
      setErrors((e) => ({ ...e, [f.nodeId]: '请先粘贴原始内容再修复格式' }));
      return;
    }
    if (!settings.apiKey) {
      setErrors((e) => ({ ...e, [f.nodeId]: '未配置 API key（请到「设置」填入 DeepSeek key）' }));
      return;
    }
    setErrors((e) => ({ ...e, [f.nodeId]: '' }));

    abortRefs.current[f.nodeId]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[f.nodeId] = ctrl;

    setNormState(f.nodeId, { status: 'streaming', preview: '', errMsg: undefined, rejectReason: undefined });

    try {
      const res = await normalizeContent({
        raw,
        config: f.normalize,
        settings: { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model },
        signal: ctrl.signal,
        onDelta: (_, full) => setNormState(f.nodeId, { preview: full }),
      });
      if (res.rejected) {
        setNormState(f.nodeId, { status: 'rejected', preview: res.content, rejectReason: res.rejectReason });
      } else {
        setNormState(f.nodeId, { status: 'previewing', preview: res.content });
      }
    } catch (e: any) {
      if (ctrl.signal.aborted) {
        setNormState(f.nodeId, undefined);
      } else {
        setNormState(f.nodeId, { status: 'error', errMsg: e?.message ?? String(e) });
      }
    } finally {
      if (abortRefs.current[f.nodeId] === ctrl) abortRefs.current[f.nodeId] = undefined;
    }
  }

  function abortNormalize(nodeId: string) {
    abortRefs.current[nodeId]?.abort();
  }

  function applyNormalize(nodeId: string) {
    const ns = normalizeStates[nodeId];
    if (!ns || ns.status !== 'previewing') return;
    setAppliedBackup((b) => ({ ...b, [nodeId]: values[nodeId] ?? '' }));
    setValues((s) => ({ ...s, [nodeId]: ns.preview }));
    setNormState(nodeId, undefined);
    setErrors((e) => ({ ...e, [nodeId]: '' }));
  }

  function discardNormalize(nodeId: string) {
    abortRefs.current[nodeId]?.abort();
    setNormState(nodeId, undefined);
  }

  function undoNormalize(nodeId: string) {
    const orig = appliedBackup[nodeId];
    if (orig === undefined) return;
    setValues((s) => ({ ...s, [nodeId]: orig }));
    setAppliedBackup((b) => {
      const { [nodeId]: _, ...rest } = b;
      return rest;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const f of p.fields) {
      const v = values[f.nodeId] ?? '';
      const empty = !v.trim();
      if (empty) {
        if (!f.optional) errs[f.nodeId] = '不能为空';
        // optional + empty => skip
      } else if (f.validate) {
        const e = f.validate(v);
        if (e) errs[f.nodeId] = e;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const now = Date.now();
    const out: NodeArtifact[] = p.fields
      .filter((f) => (values[f.nodeId] ?? '').trim().length > 0)
      .map((f) => {
        const wasAINormalized = appliedBackup[f.nodeId] !== undefined;
        return {
          nodeId: f.nodeId,
          stageId: f.stageId,
          index: f.index,
          title: f.label,
          content: values[f.nodeId] ?? '',
          format: f.format ?? 'markdown',
          ts: now,
          tokens: 0,
          cost: 0,
          durationMs: 0,
          meta: {
            manual: true,
            source: wasAINormalized ? '用户粘贴 + AI 格式修复' : '用户粘贴',
            ...(wasAINormalized ? { normalized: true, normalizedFrom: appliedBackup[f.nodeId] } : {}),
          },
        };
      });
    p.onSubmit(out);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) p.onCancel(); }}
    >
      <div className="w-full max-w-3xl card p-0 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Download className="size-4 text-emerald-400" /> {p.title}
            </h2>
            {p.description && <p className="text-[11px] text-zinc-500 mt-0.5">{p.description}</p>}
          </div>
          <button className="btn-ghost p-1.5" onClick={p.onCancel}>
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {p.fields.map((f) => {
            const v = values[f.nodeId] ?? '';
            const err = errors[f.nodeId];
            const replacing = p.existing?.[f.nodeId] != null;
            const ns = normalizeStates[f.nodeId];
            const wasApplied = appliedBackup[f.nodeId] !== undefined;
            const canNormalize = !!f.normalize;
            const isStreaming = ns?.status === 'streaming';
            return (
              <div key={f.nodeId}>
                <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                  <label className="label flex items-center gap-2">
                    <FileText className="size-3.5 text-zinc-500" />
                    {f.label}
                    <span className="text-[10px] font-mono text-zinc-600">[{f.nodeId}]</span>
                    {replacing && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        将覆盖现有产物
                      </span>
                    )}
                    {wasApplied && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                        <Sparkles className="size-2.5" /> 已 AI 修复
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    {wasApplied && (
                      <button
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
                        onClick={() => undoNormalize(f.nodeId)}
                        title="还原到 AI 修复前的内容"
                      >
                        <Undo2 className="size-3" /> 撤销
                      </button>
                    )}
                    {canNormalize && !ns && (
                      <button
                        className="text-[11px] px-2 py-1 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 inline-flex items-center gap-1 disabled:opacity-40"
                        onClick={() => startNormalize(f)}
                        disabled={!v.trim()}
                        title="调用 AI 把粘贴内容转换为下游期望的格式"
                      >
                        <Sparkles className="size-3" /> AI 修复格式
                      </button>
                    )}
                    <span className="text-[10px] text-zinc-600">{v.length.toLocaleString()} 字</span>
                  </div>
                </div>
                <textarea
                  rows={10}
                  value={v}
                  onChange={(e) => setValues((s) => ({ ...s, [f.nodeId]: e.target.value }))}
                  placeholder={f.placeholder ?? '粘贴内容…'}
                  className={clsx(
                    'w-full bg-zinc-900 border rounded-md px-3 py-2 text-xs font-mono focus:outline-none',
                    err ? 'border-rose-500/60' : 'border-zinc-800 focus:border-brand-500',
                  )}
                />
                {f.hint && !err && !ns && <div className="text-[11px] text-zinc-500 mt-1">{f.hint}</div>}
                {err && (
                  <div className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> {err}
                  </div>
                )}

                {/* ── AI 修复预览面板 ────────────────────────────────── */}
                {ns && (
                  <div className="mt-2 border border-violet-500/30 bg-violet-500/5 rounded-md overflow-hidden">
                    <div className="px-3 py-2 border-b border-violet-500/20 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-violet-300 inline-flex items-center gap-1.5">
                        {isStreaming ? (
                          <>
                            <Loader2 className="size-3 animate-spin" /> AI 正在修复格式…
                          </>
                        ) : ns.status === 'previewing' ? (
                          <>
                            <Sparkles className="size-3" /> 修复完成预览
                            <span className="text-zinc-500">·</span>
                            <span className="text-zinc-400">{ns.preview.length.toLocaleString()} 字</span>
                          </>
                        ) : ns.status === 'rejected' ? (
                          <>
                            <AlertTriangle className="size-3 text-amber-400" />
                            <span className="text-amber-300">模型拒绝修复</span>
                            {ns.rejectReason && <span className="text-zinc-400">· {ns.rejectReason}</span>}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="size-3 text-rose-400" />
                            <span className="text-rose-300">修复失败</span>
                            {ns.errMsg && <span className="text-zinc-400 truncate max-w-[400px]">· {ns.errMsg}</span>}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isStreaming && (
                          <button
                            className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                            onClick={() => abortNormalize(f.nodeId)}
                          >
                            中止
                          </button>
                        )}
                        {!isStreaming && (
                          <>
                            <button
                              className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                              onClick={() => discardNormalize(f.nodeId)}
                            >
                              丢弃
                            </button>
                            <button
                              className="text-[10px] px-2 py-0.5 rounded border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 inline-flex items-center gap-1"
                              onClick={() => startNormalize(f)}
                            >
                              <Sparkles className="size-2.5" /> 重试
                            </button>
                            {ns.status === 'previewing' && (
                              <button
                                className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 inline-flex items-center gap-1"
                                onClick={() => applyNormalize(f.nodeId)}
                              >
                                <Check className="size-2.5" /> 替换原文
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <pre className="px-3 py-2 text-[11px] font-mono text-zinc-200 whitespace-pre-wrap break-words max-h-72 overflow-auto">
                      {ns.preview || (isStreaming ? '…' : '(空)')}
                    </pre>
                  </div>
                )}

                {/* ── 剧本医生质检面板（可选，仅 doctor 字段开启） ────────── */}
                {f.doctor && ((ns?.status === 'previewing' ? ns.preview : v) ?? '').trim().length >= 100 && (
                  <ScreenplayDoctorPanel
                    script={(ns?.status === 'previewing' ? ns.preview : v).trim()}
                    disabled={isStreaming}
                    onAcceptRewrite={(rewritten) => {
                      setValues((s) => ({ ...s, [f.nodeId]: rewritten }));
                      setNormState(f.nodeId, undefined);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-800 shrink-0">
          <button className="btn-outline" onClick={p.onCancel}>取消</button>
          <button className="btn-primary" onClick={handleSubmit}>
            <Download className="size-4" /> 写入产物
          </button>
        </div>
      </div>
    </div>
  );
}
