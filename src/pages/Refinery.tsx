/**
 * Refinery · 章节润色工坊
 *
 * 6 大润色工具集的独立测试页面。用户粘贴正文 → 选工具 → 流式润色 → 应用回改。
 * 链式触发：用户可以多次按不同工具，每次"应用"会把输出回写到原文区，
 * 下一次润色基于上一次的结果（链式迭代）。
 *
 * 未来集成方向：
 *   - Novel.tsx 章节阅读视图（选区润色）
 *   - Screenplay.tsx 剧本场景（选区润色）
 *   - ChapterFeedback 反馈标签自动建议工具
 */

import { useState } from 'react';
import { Wand2, RotateCcw } from 'lucide-react';
import { RefinementToolPanel } from '../components/RefinementToolPanel';
import { REFINEMENT_TOOLS } from '../pipeline/refinement';

const SAMPLE_TEXT = `他站在悬崖边，望着远方的云海，心中涌起复杂的情绪。多年的修炼，无数的挫折，仿佛都在这一刻有了答案。他想起了师父临终前的嘱托，想起了那些曾经并肩作战的同门，想起了那个已经离他而去的姑娘。

"我做到了。"他低声说道。

然而他知道，这只是一个开始。前方的路还很长，更大的挑战还在等待着他。但此刻，他不再惧怕。`;

export function Refinery() {
  const [text, setText] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);

  const handleApply = (newText: string) => {
    setHistory((h) => [...h, text]);
    setText(newText);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setText(prev);
  };

  const loadSample = () => setText(SAMPLE_TEXT);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Wand2 className="size-5 text-brand-400" />
            润色工坊
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            6 大独立润色工具，单一职责，按需触发。粘贴正文 → 选工具 → 应用回改 → 链式迭代。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={undo}
              className="px-2.5 py-1.5 text-xs rounded border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-300 inline-flex items-center gap-1"
              title={`撤销最近一次"应用"（共 ${history.length} 步可撤销）`}
            >
              <RotateCcw className="size-3.5" /> 撤销 ({history.length})
            </button>
          )}
          <button
            type="button"
            onClick={loadSample}
            className="px-2.5 py-1.5 text-xs rounded border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 text-zinc-400"
          >
            加载示例
          </button>
        </div>
      </div>

      {/* Tools intro grid */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">6 大工具速查</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {REFINEMENT_TOOLS.map((t) => (
            <div
              key={t.id}
              className="border border-zinc-800 rounded p-2 bg-zinc-950/40"
              title={t.description}
            >
              <div className="text-base">{t.emoji}</div>
              <div className="text-xs font-medium text-zinc-300 mt-0.5">{t.label}</div>
              <div className="text-[10px] text-zinc-500 mt-1 leading-snug line-clamp-2">
                {t.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input textarea */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-zinc-400 font-medium">原文（待润色）</label>
          <span className="text-[10px] text-zinc-500 font-mono">{text.length} 字</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴要润色的小说正文（建议 ≤ 4000 字以避免超出上下文）..."
          rows={12}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 leading-relaxed focus:outline-none focus:border-brand-500 font-serif"
          spellCheck={false}
        />
      </div>

      {/* Tool panel */}
      <RefinementToolPanel inputText={text} onApply={handleApply} />

      {/* Footer hint */}
      <div className="text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
        <p className="mb-1">
          <span className="text-zinc-400">💡 使用提示：</span>
          每个工具单一职责，可链式调用（先<span className="text-zinc-300">文字精炼</span>压缩冗余 →
          再<span className="text-zinc-300">文笔润色</span>提升表达 → 最后<span className="text-zinc-300">节奏调整</span>调整张弛）。
        </p>
        <p>
          <span className="text-zinc-400">⚙️ LLM 配置：</span>
          所有工具默认禁用 V4 Thinking Mode（社区共识：thinking 模式下创意写作会变"dry"）；temperature 各工具差异化预设。
        </p>
      </div>
    </div>
  );
}
