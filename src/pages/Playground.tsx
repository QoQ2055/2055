import { useEffect, useRef, useState } from 'react';
import { Play, Square, Copy } from 'lucide-react';
import { useSettings } from '../store/settings';
import { chatStream } from '../llm/deepseek';
import { estimateCost } from '../llm/cost';

interface PromptFile {
  path: string;
  label: string;
  category: '剧本' | '资产提取' | '分镜';
}

const PROMPT_FILES: PromptFile[] = [
  { path: 'prompts/screenplay/1.json', label: 'Step 1 · 破题',          category: '剧本' },
  { path: 'prompts/screenplay/2.json', label: 'Step 2 · 梗概',          category: '剧本' },
  { path: 'prompts/screenplay/3.json', label: 'Step 3 · 人物',          category: '剧本' },
  { path: 'prompts/screenplay/4.json', label: 'Step 4 · 前史',          category: '剧本' },
  { path: 'prompts/screenplay/5.json', label: 'Step 5 · 结构大纲',       category: '剧本' },
  { path: 'prompts/screenplay/6.json', label: 'Step 6 · 场次拆解',       category: '剧本' },
  { path: 'prompts/screenplay/7.json', label: 'Step 7 · 场景写作',       category: '剧本' },
  { path: 'prompts/screenplay/8.json', label: 'Step 8 · 剧本医生',       category: '剧本' },
  { path: 'prompts/assets/1.json',     label: '资产扫描（完整性闸）',     category: '资产提取' },
  { path: 'prompts/assets/2.json',     label: '角色资产 V3.0',           category: '资产提取' },
  { path: 'prompts/assets/3.json',     label: '场景资产 V3.0',           category: '资产提取' },
  { path: 'prompts/assets/4.json',     label: '道具资产 V3.0',           category: '资产提取' },
  { path: 'prompts/storyboard/1.json', label: '分镜 Phase A-D 单元规划', category: '分镜' },
  { path: 'prompts/storyboard/2.json', label: '分镜 Phase E-G 逐单元',   category: '分镜' },
];

export function Playground() {
  const s = useSettings();
  const [selected, setSelected] = useState<string>(PROMPT_FILES[0].path);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState<{ ms?: number; cost?: number; tokens?: number; status?: string }>({});
  const abortRef = useRef<AbortController | null>(null);
  const [missing, setMissing] = useState(false);

  // load prompt
  useEffect(() => {
    setMissing(false);
    fetch('./' + selected)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const sys = j.messages?.find((m: any) => m.role === 'system')?.content ?? '';
        const usr = j.messages?.find((m: any) => m.role === 'user')?.content ?? '';
        setSystemPrompt(sys);
        setUserPrompt(usr);
      })
      .catch(() => {
        setMissing(true);
        setSystemPrompt('');
        setUserPrompt('');
      });
  }, [selected]);

  async function run() {
    if (!s.apiKey) { setMeta({ status: '❌ 请先在设置里配置 API Key' }); return; }
    setRunning(true); setOutput(''); setMeta({ status: '请求中…' });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const isAssets = selected.includes('assets/') || selected.includes('storyboard/');
    try {
      const res = await chatStream({
        baseUrl: s.baseUrl,
        apiKey: s.apiKey,
        model: s.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        temperature: isAssets ? s.temperatureAssets : s.temperatureScreenplay,
        max_tokens: s.maxTokens,
        signal: ctrl.signal,
        onDelta: (_, full) => setOutput(full),
      });
      setMeta({
        ms: Math.round(res.durationMs),
        tokens: res.usage?.total_tokens,
        cost: estimateCost(res.usage),
        status: `✅ ${res.finishReason ?? 'done'}`,
      });
    } catch (e: any) {
      setMeta({ status: `❌ ${e.message ?? e}` });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() { abortRef.current?.abort(); }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold">调试台</h1>
          <p className="text-xs text-zinc-500">手动选择任一 prompt 模板，对 DeepSeek 单次调用并流式预览。</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input max-w-md"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {(['剧本', '资产提取', '分镜'] as const).map((cat) => (
              <optgroup key={cat} label={cat}>
                {PROMPT_FILES.filter((p) => p.category === cat).map((p) => (
                  <option key={p.path} value={p.path}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {!running ? (
            <button className="btn-primary" onClick={run} disabled={!systemPrompt || !s.apiKey}>
              <Play className="size-4" /> 运行
            </button>
          ) : (
            <button className="btn-outline" onClick={stop}>
              <Square className="size-4" /> 停止
            </button>
          )}
        </div>
      </header>

      {missing && (
        <div className="m-6 card border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <strong className="text-amber-300">⚠ 找不到 prompt 文件</strong>
          <p className="text-zinc-300 mt-1">
            请先在仓库根目录运行：<code className="px-1 bg-zinc-800 rounded">npm run import:prompts</code>，
            它会读取 <code>F:\下载文件\八步\</code> 并把 14 份 .txt 转成 <code>public/prompts/**/*.json</code>。
          </p>
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 gap-4 p-6 overflow-hidden">
        <div className="card flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="label">输入 Prompt（可编辑）</span>
            <span className="text-xs text-zinc-500">
              system {systemPrompt.length} 字 / user {userPrompt.length} 字
            </span>
          </div>
          <div className="flex-1 grid grid-rows-2 gap-px bg-zinc-800">
            <textarea
              className="bg-zinc-950 p-3 text-xs font-mono resize-none focus:outline-none"
              placeholder="system"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            <textarea
              className="bg-zinc-950 p-3 text-xs font-mono resize-none focus:outline-none"
              placeholder="user"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
            />
          </div>
        </div>

        <div className="card flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
            <span className="label">输出（流式）</span>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>{meta.status}</span>
              {meta.ms != null && <span>{meta.ms}ms</span>}
              {meta.tokens != null && <span>tokens {meta.tokens}</span>}
              {meta.cost != null && <span>≈ ¥{meta.cost.toFixed(4)}</span>}
              <button
                className="btn-ghost px-1.5 py-1"
                onClick={() => navigator.clipboard.writeText(output)}
                title="复制"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
          <pre className="flex-1 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap break-words text-zinc-200">
            {output || <span className="text-zinc-600">（未运行）</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}
