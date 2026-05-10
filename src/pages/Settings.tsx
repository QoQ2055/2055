import { useState } from 'react';
import {
  Eye, EyeOff, RotateCcw, Save, Sun, Moon, Monitor,
  Settings as SettingsIcon, Palette, KeyRound, Workflow, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { useSettings, type ThemeMode } from '../store/settings';
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
    <div className="max-w-4xl mx-auto p-8 space-y-7">
      {/* Studio Calm C.2 · Hero header · 图标 + 标题 + 隐私提示 */}
      <header className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-primary-500/10 border border-primary-500/30 flex items-center justify-center shrink-0">
          <SettingsIcon className="size-5 text-primary-400" />
        </div>
        <div>
          <h1 className="text-heading-l">设置</h1>
          <p className="text-body-m text-fg-secondary mt-1">
            所有配置仅保存在浏览器 <code className="code px-1 bg-elevated rounded">localStorage</code>，永不上传任何服务器。
          </p>
        </div>
      </header>

      {/* ui-v4 PR-1 · 主题切换 · 3 档 segment */}
      <section className="card p-5 space-y-3">
        <h2 className="text-heading-m flex items-center gap-2">
          <Palette className="size-4 text-primary-400" /> 主题外观
        </h2>
        <p className="text-body-s text-fg-muted">
          切换亮/暗主题 · 也可随随系统 prefers-color-scheme · 快捷键：Cmd+K 输入「主题」。
        </p>
        <ThemeSegment value={s.theme} onChange={s.setTheme} />
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="text-heading-m flex items-center gap-2">
          <KeyRound className="size-4 text-primary-400" /> DeepSeek API
        </h2>

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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary">
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
          <pre
            className={clsx(
              'code mt-3 whitespace-pre-wrap rounded-md border p-3',
              testResult.startsWith('✅')
                ? 'border-success/40 bg-success/5 text-success'
                : testResult.startsWith('❌')
                ? 'border-danger/40 bg-danger/5 text-danger'
                : 'border-border-default bg-canvas text-fg-secondary',
            )}
          >
            {testResult}
          </pre>
        )}
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="text-heading-m flex items-center gap-2">
          <Workflow className="size-4 text-primary-400" /> 流水线默认
        </h2>
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
              <span className="text-body-m text-fg-primary">通过即自动跑下一步</span>
            </label>
          </Field>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="text-heading-m flex items-center gap-2">
            <Sparkles className="size-4 text-primary-400" /> 增强模式（来自 ShadowScript 影语沉淀）
          </h2>
          <p className="text-caption-m text-fg-muted mt-1.5">
            两项增强会<strong>增加 token 消耗</strong>（约 +30~80% / step），但<strong>显著提升</strong>剧本去 AI 味与分镜工业化程度。
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableKbInjection}
                 onChange={(e) => s.set({ enableKbInjection: e.target.checked })} />
          <div>
            <div className="text-body-m font-medium text-fg-primary">启用增强知识库注入</div>
            <div className="text-caption-m text-fg-muted mt-1">
              在剧本写作步注入「去 AI 味注册表」；分镜步注入「117 运镜库 / 质量增强词 / 14 情绪 FACS / 打斗三幕模板」；资产步注入「视觉风格库 / 道具方法论」。
              （在 <code className="code px-1 bg-elevated rounded">/kb</code> 页可浏览所有 KB）
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableEditorialRounds}
                 onChange={(e) => s.set({ enableEditorialRounds: e.target.checked })} />
          <div>
            <div className="text-body-m font-medium text-fg-primary">启用编辑部 R1 / R9</div>
            <div className="text-caption-m text-fg-muted mt-1">
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
            <div className="text-body-m font-medium text-fg-primary">启用节点自检面板</div>
            <div className="text-caption-m text-fg-muted mt-1">
              在每个节点产物完成后显示「🔬 自检」按钮，<strong>按需触发</strong>（不自动跑）。
              针对 <code className="code px-1 bg-elevated rounded">screenplay.7 / adapt.6 / storyboard.1 / storyboard.2 / assets.*</code>
              使用专属检查清单（场次连续性 / §N 引用 / 双区结构 / 资产忠实 / 反装饰），输出
              <code className="code px-1 bg-elevated rounded">pass | warn | fail</code> 三档诊断 + 按 severity 分级的 issues 列表。
              单次 ≈ 2k tokens 成本。
            </div>
          </div>
        </label>

        <label className={`flex items-start gap-3 cursor-pointer ${s.enableSelfCheck ? '' : 'opacity-50 pointer-events-none'}`}>
          <input type="checkbox" className="mt-1" checked={s.enableSelfCheckContext}
                 disabled={!s.enableSelfCheck}
                 onChange={(e) => s.set({ enableSelfCheckContext: e.target.checked })} />
          <div>
            <div className="text-body-m font-medium text-fg-primary">分镜自检注入上下文（sb.1 + assets）</div>
            <div className="text-caption-m text-fg-muted mt-1">
              对 <code className="code px-1 bg-elevated rounded">storyboard.2</code> 自检时，把 storyboard.1 单元规划与 assets 角色/场景/道具清单注入审稿员的 user 消息，
              <strong>大幅减少</strong>「资产忠实」「UNIT 数对齐」类<strong>因看不到上下文而误报</strong>的 warn / fail。
              代价：单次 +3k~6k tokens。关闭后这两类规则会被自动跳过。
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableScoreCard !== false}
                 onChange={(e) => s.set({ enableScoreCard: e.target.checked })} />
          <div>
            <div className="text-body-m font-medium text-fg-primary">启用 AI 综合评分卡（6 维 + 历史轨迹）</div>
            <div className="text-caption-m text-fg-muted mt-1">
              节点产出/章节修订后<strong>自动跑前 4 维</strong>（题材锚点 / 方法论模块 / KB 红线 / 写作工艺，纯前端规则，{'<'} 10ms）。
              点击<strong>「重算」</strong>会追加 LLM 2 维（R1 指令对齐 / 用户 KB 风格），单次 ≈ 1k tokens。
              展示总分 + 6 维子分 + 与上次分数 delta + 最近 5 次 sparkline。
            </div>
          </div>
        </label>

        <ScoreCardWeightSliders />

        {/* MM5 PR-5 · 连续性提取开关（默认 false · opt-in · fire-and-forget · 不阻塞主流程） */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={s.enableContinuityExtraction === true}
                 onChange={(e) => s.set({ enableContinuityExtraction: e.target.checked })} />
          <div>
            <div className="text-body-m font-medium text-fg-primary">启用连续性自动提取（v8 schema · MM5）</div>
            <div className="text-caption-m text-fg-muted mt-1">
              <code className="code px-1 bg-elevated rounded">novel.7</code> 章节润色完成后<strong>自动调 LLM 提取</strong>
              4 类连续性元素（伏笔 / 角色弧光 / 世界观规则 / 节奏诊断），落入
              <code className="code px-1 bg-elevated rounded">v8 dexie schema</code> 4 张表。Home 页「连续性看板」按钮可查看
              统计 + 分布。<strong>fire-and-forget 不阻塞 polish loop</strong> · 失败仅记 console.warn。
              单次 ≈ 1k tokens（用 modelLite · 提取任务稳定不发散）。
            </div>
          </div>
        </label>
      </section>
    </div>
  );
}

/** 6 维权重滑块（0..2，默认 1.0 = 等权）。 */
function ScoreCardWeightSliders() {
  const enabled = useSettings((st) => st.enableScoreCard !== false);
  const weights = useSettings((st) => st.scoreCardWeights);
  const setW = useSettings((st) => st.set);
  if (!enabled) return null;
  const dims: Array<{ key: 'genre' | 'method' | 'kbRedline' | 'craft' | 'r1Align' | 'userKbStyle'; label: string; hint: string }> = [
    { key: 'genre',       label: '题材锚点',     hint: '匹配该节点 stage 期望的题材关键词' },
    { key: 'method',      label: '方法论模块',    hint: '已开方法论模块的特征是否真正落地' },
    { key: 'kbRedline',   label: 'KB 红线',      hint: '违禁词 / 强制词 / 比例阈值' },
    { key: 'craft',       label: '写作工艺',     hint: '可读性 / 重复度 / 段落节奏' },
    { key: 'r1Align',     label: 'R1 对齐',      hint: 'LLM：是否符合本片创作指令书' },
    { key: 'userKbStyle', label: '用户 KB 风格',   hint: 'LLM：是否贴合上传的范文/喜好' },
  ];
  const reset = () => setW({ scoreCardWeights: undefined });
  const setOne = (k: string, v: number) =>
    setW({ scoreCardWeights: { ...(weights ?? {}), [k]: v } });
  return (
    <div className="ml-7 mt-1 p-3 rounded border border-border-subtle bg-elevated/40">
      <div className="flex items-center justify-between mb-2">
        <div className="text-caption-m font-medium text-fg-primary">6 维度权重（默认全 1.0 = 等权）</div>
        <button type="button" onClick={reset} className="text-caption-m text-fg-muted hover:text-fg-primary underline">
          全部重置
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
        {dims.map((d) => {
          const v = weights?.[d.key] ?? 1.0;
          return (
            <label key={d.key} className="flex items-center gap-2 text-caption-m" title={d.hint}>
              <span className="w-20 text-fg-secondary shrink-0">{d.label}</span>
              <input
                type="range" min={0} max={2} step={0.1} value={v}
                onChange={(e) => setOne(d.key, Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono text-fg-muted">{v.toFixed(1)}</span>
            </label>
          );
        })}
      </div>
      <div className="text-caption-m text-fg-muted mt-2">
        权重 = 0 → 该维度不计入总分（仍会显示子分）；权重 &gt; 1 → 该维度对总分影响放大。
      </div>
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

/**
 * ui-v4 PR-1 · 主题 segment 切换器
 * 3 档 button group · token 配色 · 选中态用 primary tint
 */
function ThemeSegment({
  value, onChange,
}: {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const options: Array<{ value: ThemeMode; label: string; icon: typeof Sun; hint: string }> = [
    { value: 'light', label: '亮色', icon: Sun, hint: '强光环境 / 白天编辑' },
    { value: 'dark', label: '暗色', icon: Moon, hint: '夜间 / 长时间写作（默认）' },
    { value: 'system', label: '跟随系统', icon: Monitor, hint: '随 OS prefers-color-scheme 自动切换' },
  ];
  return (
    <div className="inline-flex gap-1 p-1 rounded-lg border border-border-subtle bg-surface" role="radiogroup" aria-label="主题模式">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
              active
                ? 'bg-primary-500/15 text-primary-400 font-semibold'
                : 'text-fg-secondary hover:bg-elevated hover:text-fg-primary',
            )}
          >
            <Icon className="size-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
