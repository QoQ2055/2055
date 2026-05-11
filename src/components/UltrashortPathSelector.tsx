/**
 * UltrashortPathSelector · MM1 PR-7
 *
 * 进入 /ultrashort-film 路由时 · 若 ctx.ultrashortMode 未设 · 渲染本组件让用户选择创作路径。
 *
 * 三选一：
 *   - what-if (Part A · 高概念假设型 · 5 种组合方式)
 *   - how-to-tell (Part B · 反常叙事形式型 · 5 种创意方法)
 *   - undefined (混合 C · LLM 同时产 What-If + How-to-Tell + hybrid 三种方案让用户对比)
 *
 * 选择后 setCtx({ ultrashortMode }) · 上层 UltraShortFilm 路由检测到 mode 已设即渲染 Runner。
 */
import { Lightbulb, Eye, Layers, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useProject } from '../store/project';
import type { ProjectContext } from '../pipeline/types';

type Mode = NonNullable<ProjectContext['ultrashortMode']>;

interface PathOption {
  id: Mode;
  label: string;
  subtitle: string;
  icon: typeof Lightbulb;
  description: string;
  bullets: string[];
  recommended?: string;
}

const PATHS: PathOption[] = [
  {
    id: 'what-if',
    label: 'What-If 高概念路径',
    subtitle: 'Part A · 假设反常识前提 · 推演荒诞后果',
    icon: Lightbulb,
    description: '从一个反常识的假设出发 · 用画面和镜头呈现规则的极致后果。核心武器是概念的纯度和组合的冲击力。',
    bullets: [
      '5 种组合方式：嫁接 / 时空错置 / 隐喻具象化 / 反转并置 / 规则反转',
      '5 种结构：经典三段式 / 递进崩塌 / 双线并置 / 循环 Loop / 倒叙揭示',
      '观众在 5 秒内 get 规则 · 翻转必须是概念自身逻辑延伸',
    ],
    recommended: '推荐：你想从一个反直觉的假设开始（"如果 X，那么 ..."）',
  },
  {
    id: 'how-to-tell',
    label: 'How-to-Tell 视听形式路径',
    subtitle: 'Part B · 用反常叙事形式重讲已知事 · 形式即内容',
    icon: Eye,
    description: '内容是观众已知的或很快能理解的 · 卖点是叙事方式本身。最高级别：形式与内容在结尾合一。',
    bullets: [
      '5 种创意方法：视角置换 / 形式模拟 / 时间手术 / 尺度跳跃 / 规则限制',
      '形式即结构 · 不使用三段式 · 形式建立 → 形式深入 → 形式与内容交汇',
      '检验：去掉形式用常规方式讲 · 内容是否丧失冲击力',
    ],
    recommended: '推荐：你想用一种新颖的叙事方式重新讲一件熟悉的事',
  },
  {
    id: 'mixed',
    label: '混合 · 三方案对比',
    subtitle: 'Branch C · LLM 同时产 1 What-If + 1 How-to-Tell + 1 hybrid',
    icon: Layers,
    description: '不确定走哪条路径？让 AI 用三种方式各产一个方案 · 你看完三组对比再决定。',
    bullets: [
      '同时探索两种创作思路',
      '从对比中发现概念的最佳承载形式',
      '决定后可在 step 2 时单选一个方案推进',
    ],
    recommended: '推荐：第一次做超短片 · 想看 AI 如何理解你的创意意图',
  },
];

export function UltrashortPathSelector() {
  const setCtx = useProject((s) => s.setCtx);

  function selectPath(id: Mode) {
    setCtx({ ultrashortMode: id });
  }

  return (
    <div className="px-page-x py-page-y max-w-content mx-auto">
      <header className="mb-8">
        <h1 className="text-heading-xl text-fg-primary">概念超短片 · 路径选择</h1>
        <p className="mt-2 text-body-m text-fg-secondary leading-relaxed max-w-reading">
          1-3 分钟极短片有两条互斥的创作路径，进入流程前必须先选定。两条路径在结构上对称（各 3 步），但起点完全不同。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PATHS.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPath(p.id)}
              className={clsx(
                'text-left rounded-card border border-border-default bg-surface p-5',
                'hover:border-primary-300 hover:shadow-sm transition-all',
                'focus:outline-none focus:ring-2 focus:ring-primary-300',
              )}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-card bg-primary-100 text-primary-700 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-heading-m text-fg-primary leading-snug">{p.label}</h2>
                  <p className="mt-0.5 text-caption-m text-fg-muted">{p.subtitle}</p>
                </div>
              </div>

              <p className="text-body-s text-fg-secondary leading-relaxed mb-3">{p.description}</p>

              <ul className="space-y-1.5 mb-4">
                {p.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-body-s text-fg-secondary leading-relaxed">
                    <span className="text-fg-muted flex-shrink-0">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {p.recommended && (
                <p className="text-caption-m text-primary-700 bg-primary-50 rounded-pill px-2.5 py-1 inline-block">
                  {p.recommended}
                </p>
              )}

              <div className="mt-4 flex items-center text-body-s text-primary-600 font-medium">
                选择此路径 <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-caption-m text-fg-muted">
        提示：选择后可在 Runner 顶部点"切换路径"返回本页（注意 · 切换路径会清除已生成的 step 1-3 产物）。
      </p>
    </div>
  );
}
