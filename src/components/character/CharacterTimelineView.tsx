// CharacterTimelineView.tsx · gap-b PR-4
// 单角色跨章节时间线（横轴 = 章节，纵轴 = 5 维度）。
//
// CK invariant I-3：纯 props 视图，0 zustand reads。
// 渲染策略：手撸 SVG（CA §0.3 · 0 新依赖）。

import type { CharacterStateRecord } from '../../store/characterStates';

export interface CharacterTimelineViewProps {
  /** 单角色按 chapterIndex 升序排列的全部记录（含 stale / failed）。 */
  records: CharacterStateRecord[];
  /** 总章数（含未提取章节，UI 显示空 gap）。 */
  totalChapters: number;
  selectedChapterIndex: number | null;
  onSelectChapter(idx: number): void;
}

const CELL_W = 56;
const CELL_H = 28;
const ROW_LABELS = ['关系', '情绪', '能力', '事件', '一句话'] as const;
const COLOR_NOT_RUN = '#e5e7eb';   // gray-200
const COLOR_OK = '#a7f3d0';        // green-200
const COLOR_STALE = '#fde68a';     // yellow-200
const COLOR_FAILED = '#fca5a5';    // red-300
const COLOR_SELECTED = '#3b82f6';  // blue-500

export function CharacterTimelineView(props: CharacterTimelineViewProps): JSX.Element {
  const { records, totalChapters, selectedChapterIndex, onSelectChapter } = props;
  if (totalChapters <= 0) {
    return <div className="text-sm text-gray-500 px-3 py-2">暂无章节</div>;
  }

  const recByChapter = new Map<number, CharacterStateRecord>();
  for (const r of records) recByChapter.set(r.chapterIndex, r);

  const width = totalChapters * CELL_W + 60;
  const height = (ROW_LABELS.length + 1) * CELL_H + 8;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="角色状态时间线">
        {/* 顶行：章节序号 */}
        {Array.from({ length: totalChapters }, (_, i) => {
          const ch = i + 1;
          const x = 60 + i * CELL_W;
          const isSel = ch === selectedChapterIndex;
          return (
            <text
              key={`hdr-${ch}`}
              x={x + CELL_W / 2}
              y={CELL_H - 8}
              textAnchor="middle"
              fontSize={12}
              fill={isSel ? COLOR_SELECTED : '#374151'}
              fontWeight={isSel ? 700 : 500}
            >
              第{ch}章
            </text>
          );
        })}

        {/* 行标签 + 单元格 */}
        {ROW_LABELS.map((label, rIdx) => {
          const y = (rIdx + 1) * CELL_H;
          return (
            <g key={label}>
              <text x={4} y={y + CELL_H / 2 + 4} fontSize={11} fill="#6b7280">
                {label}
              </text>
              {Array.from({ length: totalChapters }, (_, i) => {
                const ch = i + 1;
                const x = 60 + i * CELL_W;
                const rec = recByChapter.get(ch);
                const fill = rec === undefined
                  ? COLOR_NOT_RUN
                  : rec.snapshot === null
                    ? COLOR_FAILED
                    : rec.stale
                      ? COLOR_STALE
                      : COLOR_OK;
                const text = !rec?.snapshot
                  ? ''
                  : rIdx === 0
                    ? Object.keys(rec.snapshot.relations ?? {}).length > 0 ? `关系 ${Object.keys(rec.snapshot.relations).length}` : '—'
                    : rIdx === 1
                      ? rec.snapshot.emotion ?? '—'
                      : rIdx === 2
                        ? (rec.snapshot.abilities && rec.snapshot.abilities.length > 0 ? `${rec.snapshot.abilities.length} 项` : '—')
                        : rIdx === 3
                          ? (rec.snapshot.keyEvents && rec.snapshot.keyEvents.length > 0 ? `${rec.snapshot.keyEvents.length} 项` : '—')
                          : (rec.snapshot.summary ?? '').slice(0, 6);
                const tooltip = !rec
                  ? `第 ${ch} 章 · 未提取`
                  : rec.extractionError
                    ? `第 ${ch} 章 · 失败：${rec.extractionError}`
                    : `第 ${ch} 章${rec.stale ? ' · 已过期' : ''}\n${rec.snapshot?.summary ?? ''}`;
                const isSel = ch === selectedChapterIndex;
                return (
                  <g
                    key={`cell-${rIdx}-${ch}`}
                    onClick={() => onSelectChapter(ch)}
                    style={{ cursor: 'pointer' }}
                    aria-label={tooltip}
                  >
                    <title>{tooltip}</title>
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={CELL_W - 2}
                      height={CELL_H - 2}
                      fill={fill}
                      stroke={isSel ? COLOR_SELECTED : '#d1d5db'}
                      strokeWidth={isSel ? 2 : 1}
                      rx={3}
                    />
                    <text
                      x={x + CELL_W / 2}
                      y={y + CELL_H / 2 + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#1f2937"
                    >
                      {text}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
