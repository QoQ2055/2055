// ExportDrawer · v3 gap-e export UI shell (FR-11).
//
// Spec: PRD §6 / CA §1.3 §2.1-2.5 §3.1 §4.4 / CK §2.3.
// DESIGN.md tokens only (CK red-line #4): w-drawer (420px) / shadow-floating /
// bg-surface / bg-overlay / border-border-default / text-heading-m /
// text-body-s / text-body-m / text-fg-primary / text-fg-muted / btn-icon.
// Internal hook useExportActions handles live (sync) + archived (async Dexie read).

import * as React from 'react';
import { Download, X, AlertTriangle } from 'lucide-react';
import { useProject } from '../store/project';
import { db } from './../store/db';
import {
  downloadBlob,
  exportArchivedProjectFile,
} from '../store/projectExport';
import {
  buildNovelMd,
  buildNovelDocx,
  buildScreenplayFdx,
  buildScreenplayFountain,
  buildAssetsCsv,
  extractNovelSource,
  extractScreenplaySource,
  extractAssetsSource,
  type ExportSourceData,
  type BuildResult,
} from '../store/exportFormats';
import type { ArtifactMap, NodeArtifact, StageId } from '../pipeline/types';

export type ExportScope = 'all' | 'novel' | 'screenplay';
export type ExportSourceMode = 'live' | 'archived';

export interface ExportDrawerProps {
  open: boolean;
  onClose: () => void;
  scope: ExportScope;
  source: ExportSourceMode;
  /** When source='archived', the projectId from db.projects */
  archivedProjectId?: number;
}

type FormatKey =
  | 'novel.md'
  | 'novel.docx'
  | 'screenplay.fdx'
  | 'screenplay.fountain'
  | 'assets.csv'
  | 'project.flil';

interface ExportItemSpec {
  key: FormatKey;
  title: string;
  description: string;
}

const ITEMS: ExportItemSpec[] = [
  { key: 'novel.md',            title: '小说（Markdown）',     description: '.md · 通用编辑器 / 可粘贴回本工具' },
  { key: 'novel.docx',          title: '小说（Word）',         description: '.docx · Microsoft Word / WPS' },
  { key: 'screenplay.fdx',      title: '剧本（Final Draft）',  description: '.fdx · Final Draft 8.x+' },
  { key: 'screenplay.fountain', title: '剧本（Fountain）',     description: '.fountain · 通用纯文本剧本格式' },
  { key: 'assets.csv',          title: '资产（CSV）',           description: '.csv · Excel / 通用表格' },
  { key: 'project.flil',        title: '项目包（开发归档）',   description: '.flil.json · 完整项目快照 / 可 import 回工具' },
];

type ItemState = { state: 'enabled' | 'partial' | 'disabled'; warning?: string };

function deriveItemState(
  spec: ExportItemSpec,
  src: ExportSourceData | null,
  scope: ExportScope,
  sourceMode: ExportSourceMode,
): ItemState {
  // Scope filtering (CA §2.5)
  if (scope === 'novel' && (spec.key.startsWith('screenplay') || spec.key === 'assets.csv' || spec.key === 'project.flil')) {
    return { state: 'disabled', warning: '此入口仅支持小说格式（请到首页/剧本页）' };
  }
  if (scope === 'screenplay' && (spec.key.startsWith('novel') || spec.key === 'assets.csv' || spec.key === 'project.flil')) {
    return { state: 'disabled', warning: '此入口仅支持剧本格式（请到首页/小说页）' };
  }
  if (spec.key === 'project.flil' && sourceMode !== 'archived') {
    return { state: 'disabled', warning: '项目包导出仅在归档项目（首页项目卡）可用' };
  }

  if (!src) return { state: 'disabled', warning: '数据未就绪' };

  if (spec.key === 'project.flil') return { state: 'enabled' };

  if (spec.key.startsWith('novel')) {
    if (!src.novel) return { state: 'disabled', warning: '小说章节缺失（需 novel.7 或 novel.6 已生成）' };
    if (src.novel.completedChapters.length < src.novel.totalChapters && src.novel.totalChapters > 0) {
      return { state: 'partial', warning: `仅 ${src.novel.completedChapters.length}/${src.novel.totalChapters} 章已完成` };
    }
    return { state: 'enabled' };
  }
  if (spec.key.startsWith('screenplay')) {
    if (!src.screenplay) return { state: 'disabled', warning: '剧本缺失（需 screenplay.7 或 adapt.6 已生成）' };
    return { state: 'enabled' };
  }
  if (spec.key === 'assets.csv') {
    if (!src.assets) return { state: 'disabled', warning: '资产缺失（请先在资产阶段生成）' };
    const r = src.assets.roles.length, s = src.assets.scenes.length, p = src.assets.props.length;
    if (r + s + p === 0) return { state: 'disabled', warning: '资产为空' };
    if (!r || !s || !p) {
      const have: string[] = [];
      if (r) have.push('角色');
      if (s) have.push('场景');
      if (p) have.push('道具');
      return { state: 'partial', warning: `仅含 ${have.join(' + ')}` };
    }
    return { state: 'enabled' };
  }
  return { state: 'disabled' };
}

function useExportActions(source: ExportSourceMode, archivedProjectId: number | undefined, open: boolean) {
  const liveCtx = useProject((s) => s.ctx);
  const liveArtifacts = useProject((s) => s.artifacts);
  const [src, setSrc] = React.useState<ExportSourceData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    if (!open) { setSrc(null); return; }

    if (source === 'live') {
      setSrc({
        ctx: { name: liveCtx.name },
        novel: extractNovelSource(liveArtifacts),
        screenplay: extractScreenplaySource(liveArtifacts),
        assets: extractAssetsSource(liveArtifacts),
      });
      return;
    }

    if (source === 'archived' && archivedProjectId != null) {
      (async () => {
        try {
          const row = await db.projects.get(archivedProjectId);
          if (!row) throw new Error('项目不存在');
          const arts = await db.artifacts.where('projectId').equals(archivedProjectId).toArray();
          const map: ArtifactMap = {};
          for (const r of arts) {
            const meta = (r.meta ?? {}) as { stageId?: StageId; index?: number; title?: string };
            const a: NodeArtifact = {
              nodeId: r.nodeId,
              stageId: (meta.stageId ?? r.nodeId.split('.')[0]) as StageId,
              index: meta.index ?? Number(r.nodeId.split('.')[1] ?? 0),
              title: meta.title ?? r.nodeId,
              format: r.format,
              content: r.content,
              tokens: r.tokens,
              cost: r.cost,
              durationMs: r.durationMs ?? 0,
              ts: r.ts,
              meta: r.meta,
            };
            map[r.nodeId] = a;
          }
          if (cancelled) return;
          setSrc({
            ctx: { name: row.name },
            novel: extractNovelSource(map),
            screenplay: extractScreenplaySource(map),
            assets: extractAssetsSource(map),
          });
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        }
      })();
    }
    return () => { cancelled = true; };
  }, [source, archivedProjectId, open, liveArtifacts, liveCtx.name]);

  async function performExport(spec: ExportItemSpec) {
    if (!src) return;
    try {
      let result: BuildResult;
      const ts = Date.now();
      switch (spec.key) {
        case 'novel.md':            result = buildNovelMd(src, ts); break;
        case 'novel.docx':          result = buildNovelDocx(src, ts); break;
        case 'screenplay.fdx':      result = buildScreenplayFdx(src, ts); break;
        case 'screenplay.fountain': result = buildScreenplayFountain(src, ts); break;
        case 'assets.csv':          result = buildAssetsCsv(src, ts); break;
        case 'project.flil':
          if (source === 'archived' && archivedProjectId != null) {
            result = await exportArchivedProjectFile(archivedProjectId);
          } else {
            throw new Error('项目包导出仅在归档项目入口可用');
          }
          break;
      }
      downloadBlob(result.filename, result.blob);
    } catch (e) {
      alert('导出失败：' + (e instanceof Error ? e.message : String(e)));
    }
  }

  return { src, error, performExport };
}

export function ExportDrawer({ open, onClose, scope, source, archivedProjectId }: ExportDrawerProps) {
  const { src, error, performExport } = useExportActions(source, archivedProjectId, open);

  // ESC to close (a11y per CA §1.3.1)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subtitle =
    (scope === 'all' ? '全部格式' : scope === 'novel' ? '仅小说格式' : '仅剧本格式') +
    ' · ' +
    (source === 'archived' ? '归档项目' : '当前项目');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="导出"
      className="fixed inset-0 z-50 flex justify-end bg-overlay/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-drawer max-w-full h-full bg-surface shadow-floating flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-3 border-b border-border-default shrink-0">
          <div className="min-w-0">
            <h2 className="text-heading-m text-fg-primary">导出</h2>
            <p className="text-body-s text-fg-muted mt-1">{subtitle}</p>
          </div>
          <button type="button" className="btn-icon -mr-1.5 shrink-0" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-2">
          {error && (
            <div className="flex items-start gap-2 rounded p-3 bg-overlay/40 text-body-s text-fg-primary">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>读取归档失败：{error}</span>
            </div>
          )}
          {ITEMS.map((spec) => {
            const itemState = deriveItemState(spec, src, scope, source);
            const disabled = itemState.state === 'disabled';
            return (
              <button
                key={spec.key}
                type="button"
                disabled={disabled}
                onClick={() => performExport(spec)}
                className="w-full text-left rounded border border-border-default p-3 transition-colors hover:bg-overlay/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <div className="flex items-start gap-2">
                  <Download className="size-4 mt-0.5 shrink-0 text-fg-muted" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body-m text-fg-primary font-medium">{spec.title}</span>
                      {itemState.state === 'partial' && (
                        <span className="text-body-s px-1.5 py-0.5 rounded bg-overlay/30 text-fg-muted">部分</span>
                      )}
                    </div>
                    <p className="text-body-s text-fg-muted mt-1">{spec.description}</p>
                    {itemState.warning && itemState.state !== 'enabled' && (
                      <p className="text-body-s text-fg-muted mt-1">⚠ {itemState.warning}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-border-default shrink-0">
          <p className="text-body-s text-fg-muted">提示：成功后保持本面板打开，可继续导出其他格式。</p>
        </div>
      </div>
    </div>
  );
}
