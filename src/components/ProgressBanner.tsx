// Shared progress banner used at the top of mode-specific work pages
// (Pipeline, Express, …).
//
// Goals:
//   • Make "where am I in the workflow?" visible at a glance from any page.
//   • Reuse the same UI across modes so users don't re-learn each page.
//   • Stay agnostic of pipeline manifest details: callers pass in pre-computed
//     `segments` (one per logical stage). The banner only renders.
//
// Layout:
//   ┌────────────────────────────────────────────────────────────────┐
//   │ ●  原创 · 《项目名》              产物 9/14   [actions ...] │
//   │ ──[seg1: 8/8]──[seg2: 1/3]──[seg3: 0/3]── ...                  │
//   └────────────────────────────────────────────────────────────────┘
//
// Each segment is a colored bar; filled portion = done/total. Hover for
// per-stage tooltip ("分镜 · 1/3 完成").

import type { ReactNode } from 'react';
import { useProject } from '../store/project';
import { getProjectModeMeta } from '../data/projectModes';

export interface ProgressSegment {
  /** Stable key */
  key: string;
  /** Short stage label e.g. "剧本" / "资产" / "分镜" */
  label: string;
  /** Completed step count */
  done: number;
  /** Total step count (>= done; 0 hides the segment) */
  total: number;
  /** Optional CSS color (defaults to mode accent) */
  color?: string;
}

interface ProgressBannerProps {
  segments: ProgressSegment[];
  /** Optional title override; defaults to mode longLabel */
  title?: ReactNode;
  /** Optional subtitle line under the title (page-specific tagline) */
  subtitle?: ReactNode;
  /** Right-side action slot (Stop / Reset / external links …) */
  actions?: ReactNode;
}

export function ProgressBanner({ segments, title, subtitle, actions }: ProgressBannerProps) {
  const ctx = useProject((s) => s.ctx);
  const meta = getProjectModeMeta(ctx);

  const visible = segments.filter((s) => s.total > 0);
  const totalDone = visible.reduce((a, s) => a + Math.min(s.done, s.total), 0);
  const totalAll  = visible.reduce((a, s) => a + s.total, 0);

  return (
    <header
      className="border-b border-zinc-800"
      style={{ backgroundColor: `${meta.accentHex}08` }}
    >
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-2.5">
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: meta.accentHex }}
            title={meta.tagline}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2 truncate">
              <span style={{ color: meta.accentHex }}>{meta.label}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-200 truncate">
                {ctx.name || '未命名项目'}
              </span>
              {title && <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-300 truncate">{title}</span>
              </>}
            </div>
            {subtitle && (
              <div className="text-[11px] text-zinc-500 truncate mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {totalAll > 0 && (
            <div className="text-xs text-zinc-500">
              产物 <span className="font-mono text-zinc-200">{totalDone}</span>
              <span className="text-zinc-600">/{totalAll}</span>
            </div>
          )}
          {actions}
        </div>
      </div>

      {visible.length > 0 && (
        <div className="px-6 pb-2 flex gap-1.5">
          {visible.map((seg) => {
            const ratio = seg.total === 0 ? 0 : Math.min(1, seg.done / seg.total);
            const color = seg.color ?? meta.accentHex;
            return (
              <div
                key={seg.key}
                className="flex-1 group"
                title={`${seg.label} · ${seg.done}/${seg.total}`}
              >
                <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800/80">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${ratio * 100}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  <span>{seg.label}</span>
                  <span className="font-mono">{seg.done}/{seg.total}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}
