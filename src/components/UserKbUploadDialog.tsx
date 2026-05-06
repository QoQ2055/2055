/**
 * 资料库 v2 · 上传 + LLM 提炼对话框
 *
 * 流程：
 *  1. 选类型 → 文件选择 / 粘贴文本 / 设置标题 + 标签
 *  2. 点「✨ LLM 提炼」→ 调用 extractUserKbDoc → 显示结构化预览（可手动编辑）
 *  3. 点「💾 保存」→ 写入 db.userKbDocs
 *
 * 也支持「跳过提炼，手动结构化」（适合用户已有现成 JSON 的情况）。
 */

import { useState, useRef } from 'react';
import {
  X, Upload, Sparkles, Loader2, Save, AlertTriangle, FileText, Edit3, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import {
  USER_KB_TYPE_META,
  createUserKbDoc,
  type UserKbDocType,
} from '../store/userKb';
import { extractUserKbDoc } from '../llm/extractKb';
import { useSettings } from '../store/settings';

interface Props {
  initialType?: UserKbDocType;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'input' | 'extracting' | 'review';

export function UserKbUploadDialog({ initialType = 'trend', onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [type, setType] = useState<UserKbDocType>(initialType);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [filename, setFilename] = useState('');
  const [structuredJson, setStructuredJson] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [enableOnSave, setEnableOnSave] = useState(true);
  const [extractMeta, setExtractMeta] = useState<{
    promptId: string;
    tokens?: number;
    durationMs: number;
    model: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKey = useSettings((s) => s.apiKey);
  const meta = USER_KB_TYPE_META[type];

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('文件太大（>5MB）。请精简后再上传，过大的资料对 LLM 提炼没有帮助。');
      return;
    }
    setFilename(file.name);
    if (!title) {
      // 自动用文件名（去后缀）作标题
      setTitle(file.name.replace(/\.[^.]+$/, ''));
    }
    try {
      const text = await file.text();
      setRawContent(text);
      setError('');
    } catch (e: any) {
      setError(`读取文件失败：${e?.message ?? e}`);
    }
  }

  async function handleExtract() {
    if (!apiKey) {
      setError('请先在「设置」页填入 API Key');
      return;
    }
    if (rawContent.trim().length < 50) {
      setError('原始内容太短（< 50 字符），无需提炼。请直接「跳过提炼」手动新建。');
      return;
    }
    if (USER_KB_TYPE_META[type].extractPromptId === '' || !canExtract(type)) {
      setError(`类型「${meta.shortLabel}」暂未启用 LLM 提炼（计划在 P3+ 阶段加），请使用「跳过提炼」。`);
      return;
    }

    setStep('extracting');
    setError('');
    setStreamingText('');

    try {
      const res = await extractUserKbDoc({
        type,
        rawContent,
        onDelta: (_chunk, full) => setStreamingText(full),
      });
      setStructuredJson(JSON.stringify(res.structured, null, 2));
      setExtractMeta(res.meta);
      setStep('review');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('input');
    }
  }

  function handleSkipExtract() {
    // 不调 LLM；让用户手动填 structuredJson
    setStructuredJson(JSON.stringify({ summary: '手动新建（未提炼）', _placeholder: rawContent.slice(0, 200) }, null, 2));
    setExtractMeta(null);
    setStep('review');
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    // 验证 structuredJson 是合法 JSON
    try {
      JSON.parse(structuredJson);
    } catch (e: any) {
      setError(`structuredJson 不是合法 JSON：${e?.message ?? e}`);
      return;
    }

    try {
      await createUserKbDoc({
        type,
        title: title.trim(),
        source: filename ? 'upload' : 'manual',
        sourceFilename: filename || undefined,
        rawContent,
        structuredJson,
        tags: tags.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean),
        enabled: enableOnSave,
        extractMeta: extractMeta
          ? { ...extractMeta }
          : undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(`保存失败：${e?.message ?? e}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* header */}
        <header className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Upload className="size-4 text-brand-500" />
          <h2 className="text-base font-semibold">上传资料 → LLM 自动结构化</h2>
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
            <StepIndicator current={step} step="input">输入</StepIndicator>
            <ArrowRight className="size-3 opacity-40" />
            <StepIndicator current={step} step="extracting">提炼</StepIndicator>
            <ArrowRight className="size-3 opacity-40" />
            <StepIndicator current={step} step="review">审核</StepIndicator>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="size-4" /></button>
        </header>

        {/* body */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {error && (
            <div className="card border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <strong className="text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="size-4" /> {error}
              </strong>
            </div>
          )}

          {step === 'input' && (
            <>
              {/* 类型选择 */}
              <Field label="类型">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(USER_KB_TYPE_META) as UserKbDocType[]).map((t) => {
                    const m = USER_KB_TYPE_META[t];
                    const supported = canExtract(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={clsx(
                          'text-xs px-2.5 py-1.5 rounded border transition-colors',
                          type === t
                            ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                            : 'border-zinc-700 text-zinc-400 hover:text-zinc-200',
                        )}
                        title={`${m.description}\n注入到：${m.injectsTo.join('、')}${supported ? '' : '\n⚠ 暂不支持 LLM 自动提炼，需手动填'}`}
                      >
                        {m.label}
                        {!supported && <span className="ml-1 text-[10px] opacity-60">(手动)</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">{meta.description}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  注入到：<span className="text-zinc-300">{meta.injectsTo.join(' · ')}</span>
                </p>
              </Field>

              {/* 标题 + 标签 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="标题">
                  <input
                    className="input w-full"
                    placeholder="例：2026 年 4 月爆款要点"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
                <Field label="标签（逗号分隔，可选）">
                  <input
                    className="input w-full"
                    placeholder="例：都市,2026Q1,重生"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </Field>
              </div>

              {/* 文件上传 */}
              <Field label="原始内容">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt,.markdown,.text"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-ghost text-xs flex items-center gap-1.5"
                  >
                    <FileText className="size-3.5" /> 选择 .md / .txt 文件
                  </button>
                  {filename && <span className="text-xs text-zinc-400">📁 {filename}</span>}
                  <span className="ml-auto text-[11px] text-zinc-500">
                    {rawContent.length} 字符
                  </span>
                </div>
                <textarea
                  className="input w-full font-mono text-xs"
                  rows={12}
                  placeholder="或直接粘贴文本……（支持 markdown / 纯文本，建议 200-50000 字符）"
                  value={rawContent}
                  onChange={(e) => setRawContent(e.target.value)}
                />
              </Field>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOnSave}
                    onChange={(e) => setEnableOnSave(e.target.checked)}
                  />
                  保存后立即启用（参与 prompt 注入）
                </label>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={handleSkipExtract}
                    disabled={!rawContent.trim() && !title.trim()}
                    className="btn-ghost text-xs flex items-center gap-1"
                    title="不调 LLM，让你手动填结构化数据。适合已有现成 JSON 的情况。"
                  >
                    <Edit3 className="size-3.5" /> 跳过提炼，手动新建
                  </button>
                  <button
                    onClick={handleExtract}
                    disabled={!rawContent.trim() || !canExtract(type)}
                    className="btn-primary text-xs flex items-center gap-1"
                    title={canExtract(type) ? '调用 LLM 把原始内容提炼为结构化 JSON' : '此类型暂不支持自动提炼'}
                  >
                    <Sparkles className="size-3.5" /> LLM 提炼
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'extracting' && (
            <div className="py-8 flex flex-col items-center text-sm text-zinc-300">
              <Loader2 className="size-8 animate-spin text-brand-500 mb-3" />
              <div>正在调用 LLM 提炼资料……</div>
              <div className="text-[11px] text-zinc-500 mt-1">使用 {useSettings.getState().modelLite || useSettings.getState().model}</div>
              {streamingText && (
                <pre className="text-[10px] font-mono mt-4 max-h-48 overflow-auto w-full bg-zinc-950 rounded p-2 leading-relaxed">
                  {streamingText.slice(-2000)}
                </pre>
              )}
            </div>
          )}

          {step === 'review' && (
            <>
              <div className="card border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
                <strong className="text-emerald-300">✓ 提炼完成</strong>
                {extractMeta && (
                  <span className="text-zinc-400 ml-2">
                    {extractMeta.model} · {extractMeta.durationMs}ms
                    {extractMeta.tokens && ` · ${extractMeta.tokens} tokens`}
                  </span>
                )}
                <p className="text-zinc-300 mt-1">请审核下方 JSON，可手动编辑。点「保存」入库。</p>
              </div>

              <Field label="结构化 JSON（可手动编辑）">
                <textarea
                  className="input w-full font-mono text-[11px]"
                  rows={20}
                  value={structuredJson}
                  onChange={(e) => setStructuredJson(e.target.value)}
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  {structuredJson.length} 字符 · 注入到 prompt 时会按 type 渲染为简化 markdown，不会原样塞 JSON
                </p>
              </Field>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('input')}
                  className="btn-ghost text-xs"
                >
                  ← 返回修改输入
                </button>
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOnSave}
                    onChange={(e) => setEnableOnSave(e.target.checked)}
                  />
                  启用
                </label>
                <button
                  onClick={handleSave}
                  className="btn-primary text-xs flex items-center gap-1 ml-auto"
                >
                  <Save className="size-3.5" /> 保存到资料库
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StepIndicator({ current, step, children }: { current: Step; step: Step; children: React.ReactNode }) {
  const order: Step[] = ['input', 'extracting', 'review'];
  const idx = order.indexOf(current);
  const myIdx = order.indexOf(step);
  const active = current === step;
  const done = myIdx < idx;
  return (
    <span className={clsx(
      'px-1.5 py-0.5 rounded transition-colors',
      active && 'bg-brand-500/20 text-brand-300',
      done && 'text-emerald-400',
      !active && !done && 'text-zinc-500',
    )}>
      {children}
    </span>
  );
}

/** 哪些类型当前支持 LLM 自动提炼。其他类型（worldHardSchema / voiceCard）走「手动新建」 */
function canExtract(type: UserKbDocType): boolean {
  return type === 'trend' || type === 'sample' || type === 'antiPattern';
}
