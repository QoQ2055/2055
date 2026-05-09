/**
 * v8 epic · MM1 PR-2 · 4 种格式共享的 scaffold 页组件
 *
 * 职责：渲染一份 FormatManifest 为只读骨架页 · 0 LLM 调用 · 0 业务状态。
 *
 * UI 元素：
 *   - 顶部 header：格式名 + 时长 + attribution + 描述
 *   - 路径/阶段切换 tab（paths 或 phases · 互斥二选一）
 *   - 步骤卡片网格：每步显示 index / title / goal / highlights / outFormat
 *   - 底部 "Coming Soon" 状态条 · 标注后续 PR 接入计划
 *
 * 风格：复用 tailwind.config.ts / DESIGN.md token：
 *   - 主题感知 bg：canvas / surface / elevated
 *   - 文字：fg-primary / fg-secondary / fg-muted
 *   - 边框：border-default
 *   - 字号：heading-xl / heading-l / heading-m / body-m / body-s / caption-m / code-m
 *   - 间距：page-x / page-y（页级别）· 其余用 tailwind 默认
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Workflow, Construction, FileCode2, FileJson } from 'lucide-react';
import clsx from 'clsx';
import type { FormatManifest, FormatStep } from '../data/formats';

interface FormatScaffoldPageProps {
  manifest: FormatManifest;
}

export function FormatScaffoldPage({ manifest }: FormatScaffoldPageProps) {
  const groups = useMemo(() => {
    if (manifest.paths) {
      return manifest.paths.map((p) => ({ id: p.id, label: p.label, description: p.description, steps: p.steps }));
    }
    if (manifest.phases) {
      return manifest.phases.map((p) => ({ id: p.id, label: p.label, description: p.description, steps: p.steps }));
    }
    return [];
  }, [manifest]);

  const [activeGroupId, setActiveGroupId] = useState<string>(groups[0]?.id ?? '');
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const totalSteps = useMemo(() => groups.reduce((acc, g) => acc + g.steps.length, 0), [groups]);
  const isMultiGroup = groups.length > 1;
  const groupKindLabel = manifest.phases ? '阶段' : '路径';

  return (
    <div className="px-page-x py-page-y max-w-content mx-auto">
      {/* ── header ─────────────────────────────────────────────────── */}
      <header className="mb-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-body-s text-fg-muted hover:text-fg-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 返回首页
        </Link>

        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-heading-xl text-fg-primary">{manifest.nameZh}</h1>
          <span className="text-body-s text-fg-muted">{manifest.nameEn}</span>
          <span className="px-2 py-0.5 rounded-chip bg-primary-100 text-primary-700 text-caption-m border border-primary-200 font-mono">
            {manifest.duration}
          </span>
          <span className="px-2 py-0.5 rounded-chip bg-warning-100 text-warning-active text-caption-m border border-warning-200 inline-flex items-center gap-1">
            <Construction className="w-3 h-3" /> Coming Soon
          </span>
        </div>

        <p className="mt-3 text-body-m text-fg-secondary leading-relaxed max-w-reading">
          {manifest.description}
        </p>

        {/* attribution + source link */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s">
          <span className="text-fg-muted inline-flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            来源：
            <code className="px-1.5 py-0.5 rounded bg-surface border border-border-default text-code-m">
              {manifest.source}
            </code>
          </span>
          <span className="text-fg-muted">·</span>
          <span className="text-fg-muted">{manifest.upstream}</span>
        </div>
      </header>

      {/* ── overview ───────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Workflow className="w-4 h-4 text-primary-600" />
          <h2 className="text-heading-l text-fg-primary">工作流概览</h2>
          <span className="text-body-s text-fg-muted">
            ({groups.length} {groupKindLabel} · 共 {totalSteps} 步)
          </span>
        </div>

        {/* group tabs (paths or phases) */}
        {isMultiGroup && activeGroup && (
          <div className="flex gap-2 border-b border-border-default mb-4 -mx-1 px-1 overflow-x-auto">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={clsx(
                  'px-4 py-2 text-body-s border-b-2 transition-colors whitespace-nowrap',
                  g.id === activeGroup.id
                    ? 'border-primary-500 text-fg-primary font-medium'
                    : 'border-transparent text-fg-muted hover:text-fg-primary',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        {activeGroup && (
          <>
            {!isMultiGroup && (
              <h3 className="text-heading-m text-fg-primary mb-2">{activeGroup.label}</h3>
            )}
            <p className="text-body-s text-fg-secondary mb-4 max-w-reading">
              {activeGroup.description}
            </p>

            {/* step grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeGroup.steps.map((step) => (
                <StepCard key={`${activeGroup.id}-${step.index}`} step={step} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── status banner ──────────────────────────────────────────── */}
      <section className="mt-10 p-4 rounded-card bg-warning-50 border border-warning-200">
        <div className="flex items-start gap-3">
          <Construction className="w-4 h-4 text-warning-active flex-shrink-0 mt-0.5" />
          <div className="text-body-s text-fg-secondary leading-relaxed">
            <strong className="text-fg-primary">本路由处于骨架阶段</strong>
            （MM1 epic PR-2 · 仅展示工作流元数据 · 0 LLM 接入）。
            <br />
            后续 PR 将接入 LLM-driven 流水线（参考{' '}
            <code className="px-1 rounded bg-surface border border-border-default text-code-m">
              /screenplay
            </code>{' '}
            八步法 + R1/R9 编辑部 + 自检 + 评分卡的成熟模式）。
            <br />
            完整方法论详情见{' '}
            <code className="px-1.5 py-0.5 rounded bg-surface border border-border-default text-code-m">
              {manifest.source}
            </code>{' '}
            （MIT · @山音 · 字符级保留原文）。
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── step card ───────────────────────────────────────────────────────

function StepCard({ step }: { step: FormatStep }) {
  const FormatIcon = step.outFormat === 'json' ? FileJson : FileCode2;
  return (
    <article className="p-4 rounded-card bg-surface border border-border-default hover:border-primary-300 transition-colors">
      <header className="flex items-start gap-3 mb-2">
        <span className="flex-shrink-0 w-7 h-7 rounded-pill bg-primary-100 text-primary-700 font-medium text-body-s flex items-center justify-center">
          {step.index}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-body-m font-medium text-fg-primary leading-snug">{step.title}</h4>
          <p className="mt-1 text-body-s text-fg-secondary leading-relaxed">{step.goal}</p>
        </div>
        <FormatIcon
          className={clsx(
            'w-3.5 h-3.5 flex-shrink-0 mt-1',
            step.outFormat === 'json' ? 'text-secondary-500' : 'text-fg-muted',
          )}
          aria-label={step.outFormat}
        />
      </header>

      {step.highlights.length > 0 && (
        <ul className="mt-2 ml-10 space-y-1 text-body-s text-fg-secondary">
          {step.highlights.map((h, i) => (
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="text-fg-muted flex-shrink-0">·</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
