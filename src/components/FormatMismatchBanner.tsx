/**
 * FormatMismatchBanner · MM1 PR-6 · 路由格式不匹配的全屏警告
 *
 * 场景：
 *   用户在 /short-film 跑完 8 步剧本（artifacts 中已有 'screenplay.{1..8}' 系列），
 *   点击导航到 /feature-film。此时 ctx.formatId='narrative_short' · 路由期望
 *   formatId='feature' · 但 artifact 残留是 short 格式产物。
 *
 *   PR-4/5 旧逻辑：useEffect 无声 setCtx({ formatId: 'feature' })。导致：
 *     1. ctx 立刻变 feature · artifacts 仍是 short 内容（语义混乱）
 *     2. 用户在 /feature-film 点"运行此步" → feature ctx 重新跑 → 覆盖 short 产物
 *
 *   PR-6 新逻辑：useEffect 仅在"安全"情况下设 ctx.formatId（首次进入或目标一致），
 *   不一致 + 有产物 → 渲染本组件 · 让用户显式选择"切换并清除产物" 或 "回原工作台"。
 *
 * 出口：
 *   - 主推路径：navigate(currentRoutePath) 回到原 format 路由 · 0 数据丢失
 *   - 危险路径：onConfirmSwitch 清除 4 stage（screenplay/adapt/assets/storyboard）
 *     + setCtx({ formatId: target }) · 不可逆 · 二次确认
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Trash2, Home } from 'lucide-react';
import clsx from 'clsx';

const FORMAT_LABEL: Record<string, { zh: string; route: string }> = {
  narrative_short: { zh: '叙事短片', route: '/short-film' },
  feature:         { zh: '电影长片', route: '/feature-film' },
  series:          { zh: '剧集',     route: '/series' },
  concept_short:   { zh: '极短片',   route: '/ultrashort-film' },
};

interface FormatMismatchBannerProps {
  /** 项目当前 ctx.formatId（已有产物对应的格式） */
  currentFormatId: string;
  /** 当前路由期望的 formatId（用户进入的目标） */
  targetFormatId: string;
  /** onConfirmSwitch 触发后会清空 4 stage 产物 + 设新 formatId */
  onConfirmSwitch: () => void;
}

export function FormatMismatchBanner({
  currentFormatId,
  targetFormatId,
  onConfirmSwitch,
}: FormatMismatchBannerProps) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const cur = FORMAT_LABEL[currentFormatId] ?? { zh: currentFormatId, route: '/' };
  const tgt = FORMAT_LABEL[targetFormatId] ?? { zh: targetFormatId, route: '/' };

  return (
    <div className="px-page-x py-page-y max-w-content mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-body-s text-fg-muted hover:text-fg-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> 返回首页
      </Link>

      <div className="rounded-card border border-warning-200 bg-warning-50 p-6">
        <header className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-warning-active flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-heading-l text-fg-primary">格式不匹配</h1>
            <p className="mt-1 text-body-m text-fg-secondary leading-relaxed">
              当前项目已有 <strong className="text-fg-primary">{cur.zh}</strong>（{currentFormatId}）格式的产物，
              你正在浏览 <strong className="text-fg-primary">{tgt.zh}</strong>（{targetFormatId}）工作台。
            </p>
          </div>
        </header>

        <section className="ml-9 mb-5 text-body-s text-fg-secondary leading-relaxed space-y-2">
          <p>
            两种格式的剧本结构差异显著（如时长 / 节点数 / 分集策略不同），
            混用会让模型在错误的格式分支下生成 / 覆盖产物。请选择以下一种方式继续：
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong className="text-fg-primary">回原工作台</strong>（推荐）：
              数据零丢失 · 继续完善 {cur.zh} 项目
            </li>
            <li>
              <strong className="text-fg-primary">切换到 {tgt.zh}</strong>：
              清除剧本 / 改编 / 资产 / 分镜 4 个 stage 的全部产物 · ctx.formatId 切到 {targetFormatId} ·
              <strong className="text-warning-active"> 不可逆</strong>
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3 ml-9">
          <button
            type="button"
            onClick={() => navigate(cur.route)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-primary-500 text-white text-body-s hover:bg-primary-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            回到 {cur.zh} 工作台
          </button>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-warning-200 text-warning-active text-body-s hover:bg-warning-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              切换到 {tgt.zh}（清除产物）
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-pill border border-danger-200 bg-danger-50">
              <span className="text-body-s text-fg-secondary">确认清除当前 {cur.zh} 项目的全部产物？</span>
              <button
                type="button"
                onClick={onConfirmSwitch}
                className={clsx(
                  'px-3 py-1 rounded-pill bg-danger text-white text-body-s',
                  'hover:bg-danger-hover transition-colors',
                )}
              >
                确认清除
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-1 rounded-pill text-body-s text-fg-muted hover:text-fg-primary"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
