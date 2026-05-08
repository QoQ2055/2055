/**
 * GenreAnchorPreview · 题材锚点预览面板
 *
 * 用户在题材选择器中选定 1-3 个原子题材后，这个组件展示合并后的
 * 「必须包含」/「必须避免」清单 + 数值参数提示，让用户在创建项目前
 * 就能直观看到自己选择的题材组合带来的硬约束。
 *
 * 数据源：src/data/projectTaxonomy.ts → GENRE_ANCHORS（15 核心题材）
 * 实际注入：src/pipeline/compose.ts → buildGenreAnchorPreamble()
 *
 * 使用场景：
 *   - NewProjectDialog 题材选择后
 *   - Novel.tsx 小说设置对话框
 *   - Express.tsx 快速分镜模式（可选）
 */

import { useMemo } from 'react';
import {
  findGenre,
  findGenreAnchor,
  type GenreAnchor,
} from '../data/projectTaxonomy';

export interface GenreAnchorPreviewProps {
  /** 已选题材的 value 列表（来自 ProjectContext.genres） */
  genres: string[];
  /** 紧凑模式：仅显示 must include / avoid 列表（用于狭窄 UI） */
  compact?: boolean;
  className?: string;
}

interface MergedAnchor {
  labels: string[];
  configuredCount: number;
  unconfiguredCount: number;
  mustInclude: string[];
  mustAvoid: string[];
  worldRules: { label: string; text: string }[];
  pronounRules: { label: string; text: string }[];
  paragraphLength: number | null;
  dialogueRatio: number | null;
}

function mergeAnchors(genres: string[]): MergedAnchor | null {
  if (!genres || genres.length === 0) return null;
  const items = genres.map((v) => ({
    value: v,
    label: findGenre(v)?.label ?? v,
    anchor: findGenreAnchor(v),
  }));
  const configured = items.filter((x): x is { value: string; label: string; anchor: GenreAnchor } =>
    !!x.anchor
  );
  const unconfiguredCount = items.length - configured.length;

  const dedup = (xs: string[]) => Array.from(new Set(xs.map((s) => s.trim())).values());
  const mustInclude = dedup(configured.flatMap((a) => a.anchor.mustInclude ?? []));
  const mustAvoid = dedup(configured.flatMap((a) => a.anchor.mustAvoid ?? []));
  const worldRules = configured
    .filter((a) => !!a.anchor.worldRules)
    .map((a) => ({ label: a.label, text: a.anchor.worldRules! }));
  const pronounRules = configured
    .filter((a) => !!a.anchor.pronounUsage)
    .map((a) => ({ label: a.label, text: a.anchor.pronounUsage! }));

  const paraVals = configured
    .map((a) => a.anchor.paragraphLength)
    .filter((n): n is number => typeof n === 'number');
  const diaVals = configured
    .map((a) => a.anchor.dialogueRatio)
    .filter((n): n is number => typeof n === 'number');
  const paragraphLength = paraVals.length
    ? Math.round(paraVals.reduce((s, x) => s + x, 0) / paraVals.length)
    : null;
  const dialogueRatio = diaVals.length
    ? Math.round(diaVals.reduce((s, x) => s + x, 0) / diaVals.length)
    : null;

  return {
    labels: items.map((x) => x.label),
    configuredCount: configured.length,
    unconfiguredCount,
    mustInclude,
    mustAvoid,
    worldRules,
    pronounRules,
    paragraphLength,
    dialogueRatio,
  };
}

export function GenreAnchorPreview({ genres, compact, className }: GenreAnchorPreviewProps) {
  const merged = useMemo(() => mergeAnchors(genres), [genres]);

  // 没有任何已选题材 → 不渲染
  if (!merged) return null;

  // 已选题材但无任何配置 anchor → 提示用户
  if (merged.configuredCount === 0) {
    return (
      <div
        className={
          'mt-2 rounded-md border border-border-subtle bg-surface/40 px-3 py-2 text-xs text-fg-muted ' +
          (className ?? '')
        }
      >
        所选题材暂未配置锚点（{merged.labels.join(' + ')}）。已选题材会被注入到项目元信息，但不携带题材级硬约束。
      </div>
    );
  }

  return (
    <div
      className={
        'mt-2 rounded-md border border-primary-200/30 bg-primary-500/5 px-3 py-2.5 space-y-2 ' +
        (className ?? '')
      }
    >
      {/* 标题行 */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="text-xs font-medium text-primary-300">
          🎯 题材锚点
          <span className="ml-1.5 text-fg-muted font-normal">{merged.labels.join(' + ')}</span>
        </div>
        {merged.unconfiguredCount > 0 && (
          <span className="text-tight-xs text-warning/80">
            {merged.unconfiguredCount} 个题材暂无锚点配置
          </span>
        )}
      </div>

      {/* 必须包含 */}
      {merged.mustInclude.length > 0 && (
        <div>
          <div className="text-tight-xs uppercase tracking-wider text-success/80 mb-1">
            ✓ 必须包含（题材必备元素）
          </div>
          <div className="flex flex-wrap gap-1">
            {merged.mustInclude.map((s, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-tight-sm rounded border border-success/30 bg-success/10 text-success-200"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 必须避免 */}
      {merged.mustAvoid.length > 0 && (
        <div>
          <div className="text-tight-xs uppercase tracking-wider text-danger/80 mb-1">
            ✗ 必须避免（题材污染清单）
          </div>
          <div className="flex flex-wrap gap-1">
            {merged.mustAvoid.map((s, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 text-tight-sm rounded border border-danger/30 bg-danger/10 text-danger"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 完整模式：世界观规则 / 数值参数 / 人称细则 */}
      {!compact && (
        <>
          {merged.worldRules.length > 0 && (
            <div>
              <div className="text-tight-xs uppercase tracking-wider text-fg-muted mb-1">
                🌍 世界观核心规则
              </div>
              <ul className="space-y-1">
                {merged.worldRules.map((r, i) => (
                  <li key={i} className="text-tight-sm text-fg-secondary leading-snug">
                    <span className="text-fg-secondary font-medium">[{r.label}]</span> {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(merged.paragraphLength !== null || merged.dialogueRatio !== null) && (
            <div className="flex gap-3 flex-wrap text-tight-sm text-fg-secondary">
              {merged.paragraphLength !== null && (
                <span>
                  📐 段落长度参考 <span className="text-fg-primary font-mono">{merged.paragraphLength}</span> 字
                </span>
              )}
              {merged.dialogueRatio !== null && (
                <span>
                  💬 对话比例参考 <span className="text-fg-primary font-mono">{merged.dialogueRatio}%</span>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

