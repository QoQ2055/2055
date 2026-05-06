import { useState } from 'react';
import { Eye, EyeOff, RotateCcw, Save } from 'lucide-react';
import { useSettings } from '../store/settings';
import { chatStream } from '../llm/deepseek';

export function Settings() {
  const s = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  async function testConnection() {
    setTesting(true); setTestResult('');
    try {
      let acc = '';
      const res = await chatStream({
        baseUrl: s.baseUrl,
        apiKey: s.apiKey,
        model: s.model,
        messages: [{ role: 'user', content: '只回答两个字：可用。' }],
        temperature: 0,
        max_tokens: 32,
        onDelta: (_, full) => { acc = full; setTestResult(acc); },
      });
      setTestResult(`✅ 连通成功 · ${res.durationMs.toFixed(0)}ms\n回复：${res.content}`);
    } catch (e: any) {
      setTestResult(`❌ ${e.message ?? String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">设置</h1>
        <p className="text-sm text-zinc-400 mt-1">
          所有配置仅保存在浏览器 <code className="px-1 bg-zinc-800 rounded">localStorage</code>，永不上传任何服务器。
        </p>
      </header>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">DeepSeek API</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Base URL">
            <input className="input" value={s.baseUrl}
                   onChange={(e) => s.set({ baseUrl: e.target.value })} />
          </Field>
          <Field label="Model">
            <input className="input" value={s.model}
                   onChange={(e) => s.set({ model: e.target.value })} />
          </Field>
        </div>

        <Field label="API Key">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              className="input pr-10"
              placeholder="sk-..."
              value={s.apiKey}
              onChange={(e) => s.set({ apiKey: e.target.value })}
            />
            <button type="button" onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200">
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="温度（剧本）">
            <input type="number" step="0.1" min="0" max="2" className="input"
                   value={s.temperatureScreenplay}
                   onChange={(e) => s.set({ temperatureScreenplay: +e.target.value })} />
          </Field>
          <Field label="温度（资产/分镜）">
            <input type="number" step="0.1" min="0" max="2" className="input"
                   value={s.temperatureAssets}
                   onChange={(e) => s.set({ temperatureAssets: +e.target.value })} />
          </Field>
          <Field label="Max Tokens">
            <input type="number" step="256" min="512" className="input"
                   value={s.maxTokens}
                   onChange={(e) => s.set({ maxTokens: +e.target.value })} />
          </Field>
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn-primary" onClick={testConnection} disabled={testing || !s.apiKey}>
            <Save className="size-4" />
            {testing ? '测试中…' : '测试连通'}
          </button>
          <button className="btn-outline" onClick={() => s.reset()}>
            <RotateCcw className="size-4" /> 恢复默认
          </button>
        </div>

        {testResult && (
          <pre className="mt-3 whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
            {testResult}
          </pre>
        )}
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">流水线默认</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="并发数（分镜循环）">
            <input type="number" min="1" max="8" className="input"
                   value={s.concurrency}
                   onChange={(e) => s.set({ concurrency: +e.target.value })} />
          </Field>
          <Field label="失败重试">
            <input type="number" min="0" max="5" className="input"
                   value={s.retryMax}
                   onChange={(e) => s.set({ retryMax: +e.target.value })} />
          </Field>
          <Field label="自动级联下游">
            <label className="flex items-center gap-2 mt-1.5">
              <input type="checkbox" checked={s.autoChain}
                     onChange={(e) => s.set({ autoChain: e.target.checked })} />
              <span className="text-sm">通过即自动跑下一步</span>
            </label>
          </Field>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">增强模式（来自 ShadowScript 影语沉淀）</h2>
          <p className="text-xs text-zinc-500 mt-1">
            两项增强会**增加 token 消耗**（约 +30~80% / step），但**显著提升**剧本去 AI 味与分镜工业化程度。
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableKbInjection}
                 onChange={(e) => s.set({ enableKbInjection: e.target.checked })} />
          <div>
            <div className="text-sm font-medium">启用增强知识库注入</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              在剧本写作步注入「去 AI 味注册表」；分镜步注入「117 运镜库 / 质量增强词 / 14 情绪 FACS / 打斗三幕模板」；资产步注入「视觉风格库 / 道具方法论」。
              （在 <code className="px-1 bg-zinc-800 rounded">/kb</code> 页可浏览所有 KB）
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableEditorialRounds}
                 onChange={(e) => s.set({ enableEditorialRounds: e.target.checked })} />
          <div>
            <div className="text-sm font-medium">启用编辑部 R1 / R9</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              <strong>R1 总编</strong> 在 Step 1 之前生成创作指令书（主题/受众/题材/红线），锁定为下游 8 步共享 system 头；
              <strong>R9 总编</strong> 在 Step 8 之后做四级裁决（APPROVED / MINOR / MAJOR / REJECTED）。
              「一键全跑」会自动覆盖 R1 → S1..8 → R9。
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableSelfCheck}
                 onChange={(e) => s.set({ enableSelfCheck: e.target.checked })} />
          <div>
            <div className="text-sm font-medium">启用节点自检面板</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              在每个节点产物完成后显示「🔬 自检」按钮，<strong>按需触发</strong>（不自动跑）。
              针对 <code className="px-1 bg-zinc-800 rounded">screenplay.7 / adapt.6 / storyboard.1 / storyboard.2 / assets.*</code>
              使用专属检查清单（场次连续性 / §N 引用 / 双区结构 / 资产忠实 / 反装饰），输出
              <code className="px-1 bg-zinc-800 rounded">pass | warn | fail</code> 三档诊断 + 按 severity 分级的 issues 列表。
              单次 ≈ 2k tokens 成本。
            </div>
          </div>
        </label>

        <label className={`flex items-start gap-3 cursor-pointer ${s.enableSelfCheck ? '' : 'opacity-50 pointer-events-none'}`}>
          <input type="checkbox" className="mt-1" checked={s.enableSelfCheckContext}
                 disabled={!s.enableSelfCheck}
                 onChange={(e) => s.set({ enableSelfCheckContext: e.target.checked })} />
          <div>
            <div className="text-sm font-medium">分镜自检注入上下文（sb.1 + assets）</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              对 <code className="px-1 bg-zinc-800 rounded">storyboard.2</code> 自检时，把 storyboard.1 单元规划与 assets 角色/场景/道具清单注入审稿员的 user 消息，
              <strong>大幅减少</strong>「资产忠实」「UNIT 数对齐」类<strong>因看不到上下文而误报</strong>的 warn / fail。
              代价：单次 +3k~6k tokens。关闭后这两类规则会被自动跳过。
            </div>
          </div>
        </label>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}
