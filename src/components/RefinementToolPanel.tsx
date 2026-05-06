/**
 * RefinementToolPanel · 6 大润色工具集面板
 *
 * 通用面板组件，可嵌入任何需要"按需触发段落级多维度润色"的场景。
 * 当前测试入口：src/pages/Refinery.tsx
 * 未来可接入：Novel.tsx 章节阅读视图、Screenplay.tsx 剧本场景等。
 *
 * Props 协议：
 *   - inputText (必填)：待润色的原文（受控字符串）
 *   - onApply  (可选)：用户点击"应用"时回调，接收润色后的新文本。
 *                       未传时仅保留输出在面板内显示。
 *   - compact  (可选)：紧凑模式（隐藏说明区，工具按钮单行排）
 *
 * 数据源：src/pipeline/refinement.ts → REFINEMENT_TOOLS / runRefinement()
 */

import { useState, useRef, useCallback } from 'react';
import { Loader2, Square, Copy, Check, X } from 'lucide-react';
import {
  REFINEMENT_TOOLS,
  runRefinement,
  type RefinementToolId,
  type RefinementTool,
} from '../pipeline/refinement';
import { useSettings } from '../store/settings';

export interface RefinementToolPanelProps {
  inputText: string;
  onApply?: (newText: string) => void;
  compact?: boolean;
  /** 自定义类名 */
  className?: string;
}

interface RunState {
  toolId: RefinementToolId | null;
  output: string;
  running: boolean;
  durationMs?: number;
  tokens?: number;
  error?: string;
}

const initialState: RunState = { toolId: null, output: '', running: false };

export function RefinementToolPanel({
  inputText,
  onApply,
  compact,
  className,
}: RefinementToolPanelProps) {
  const settings = useSettings();
  const [state, setState] = useState<RunState>(initialState);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (tool: RefinementTool) => {
      if (state.running) return;
      const text = (inputText ?? '').trim();
      if (!text) {
        setState({ ...initialState, error: '请先在上方输入或粘贴待润色的文本' });
        return;
      }
      if (!settings.baseUrl || !settings.apiKey || !settings.model) {
        setState({
          ...initialState,
          error: '请先在「设置」中配置 baseUrl / apiKey / model',
        });
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ toolId: tool.id, output: '', running: true });

      try {
        const res = await runRefinement({
          toolId: tool.id,
          inputText: text,
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          maxTokens: settings.maxTokens,
          signal: ctrl.signal,
          onDelta: (_chunk, full) => {
            setState((s) => (s.toolId === tool.id ? { ...s, output: full } : s));
          },
        });
        setState({
          toolId: tool.id,
          output: res.outputText,
          running: false,
          durationMs: res.durationMs,
          tokens: res.tokens,
        });
      } catch (e: any) {
        const aborted = ctrl.signal.aborted;
        setState({
          toolId: tool.id,
          output: '',
          running: false,
          error: aborted ? '已取消' : e?.message ?? String(e),
        });
      } finally {
        abortRef.current = null;
      }
    },
    [inputText, settings, state.running],
  );

  const stop = () => abortRef.current?.abort();

  const apply = () => {
    if (!state.output || state.running) return;
    onApply?.(state.output);
    setState(initialState);
  };

  const discard = () => {
    abortRef.current?.abort();
    setState(initialState);
  };

  const copyOut = async () => {
    if (!state.output) return;
    try {
      await navigator.clipboard.writeText(state.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const activeTool = state.toolId ? REFINEMENT_TOOLS.find((t) => t.id === state.toolId) : null;

  return (
    <div
      className={
        'rounded-md border border-zinc-800 bg-zinc-950/40 p-3 space-y-3 ' + (className ?? '')
      }
    >
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm font-medium text-zinc-200">章节润色工具集</div>
            <div className="text-[11px] text-zinc-500">
              选区或全文 · 6 个独立工具 · 单一职责（每个工具只动一件事）
            </div>
          </div>
          <div className="text-[10px] text-zinc-500">
            输入字数：<span className="text-zinc-300 font-mono">{(inputText ?? '').length}</span>
          </div>
        </div>
      )}

      {/* Tool buttons */}
      <div
        className={
          compact
            ? 'flex flex-wrap gap-1.5'
            : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5'
        }
      >
        {REFINEMENT_TOOLS.map((tool) => {
          const isActive = state.toolId === tool.id;
          const isRunning = state.running && isActive;
          const isDimmed = state.running && !isActive;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => run(tool)}
              disabled={state.running || !inputText.trim()}
              title={tool.description}
              className={
                'flex flex-col items-center gap-0.5 px-2 py-2 text-xs rounded-md border transition-colors ' +
                (isActive
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-200'
                  : isDimmed
                    ? 'border-zinc-900 bg-zinc-900/30 text-zinc-600 cursor-wait'
                    : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300') +
                (state.running || !inputText.trim() ? ' disabled:cursor-not-allowed disabled:opacity-50' : '')
              }
            >
              <span className="text-base leading-none">
                {isRunning ? (
                  <Loader2 className="size-4 animate-spin inline" />
                ) : (
                  <span>{tool.emoji}</span>
                )}
              </span>
              <span className="leading-tight">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Description of active tool */}
      {activeTool && !compact && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-[11px] text-zinc-400">
          <span className="text-zinc-300">{activeTool.emoji} {activeTool.label}：</span>
          {activeTool.description}
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-300">
          ⚠ {state.error}
        </div>
      )}

      {/* Output area */}
      {(state.running || state.output) && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="text-zinc-200">{activeTool?.emoji} {activeTool?.label}</span>
              {state.running && (
                <span className="flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  生成中…
                </span>
              )}
              {!state.running && state.durationMs !== undefined && (
                <span className="text-zinc-500">
                  ✓ {(state.durationMs / 1000).toFixed(1)}s
                  {state.tokens !== undefined && ` · ${state.tokens} tokens`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {state.running ? (
                <button
                  type="button"
                  onClick={stop}
                  className="px-2 py-1 text-[11px] rounded border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-300 inline-flex items-center gap-1"
                >
                  <Square className="size-3" /> 停止
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={copyOut}
                    disabled={!state.output}
                    className="px-2 py-1 text-[11px] rounded border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-300 inline-flex items-center gap-1 disabled:opacity-50"
                    title="复制到剪贴板"
                  >
                    {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                  {onApply && (
                    <button
                      type="button"
                      onClick={apply}
                      disabled={!state.output}
                      className="px-2 py-1 text-[11px] rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="size-3" /> 应用
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={discard}
                    className="px-2 py-1 text-[11px] rounded border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-400 inline-flex items-center gap-1"
                    title="丢弃本次结果"
                  >
                    <X className="size-3" /> 丢弃
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="px-3 py-2 max-h-[420px] overflow-y-auto whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">
            {state.output || (state.running && '…')}
          </div>
        </div>
      )}
    </div>
  );
}
