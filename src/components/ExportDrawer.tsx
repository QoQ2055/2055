/**
 * gap-e Export · 通用导出抽屉
 *
 * **范围**（PRD §6.1 · 三处入口共享同一组件）：
 *   • Home.tsx 项目卡  · "导出"按钮 → 弹本抽屉（针对**当前活动项目**）
 *   • Novel.tsx toolbar · "导出"按钮 → 弹本抽屉
 *   • Screenplay.tsx toolbar · "下载剧本…"按钮 → 弹本抽屉
 *
 * **设计**：
 *   • 6 项导出（小说.md / 小说.docx / 剧本.fdx / 剧本.fountain / 资产.csv + 项目包.flil.json）
 *   • 数据缺失项 disabled · tooltip 解释为何
 *   • mode prop 决定**默认高亮分类**（novel/screenplay/all）· 不限制可选项
 *   • 单实例 · 由调用方 open state 控制
 *
 * **不变量**：
 *   • V2-I-3 / V2-I-4 6 atoms 不动 · 复用 Button atom
 *   • V2-I-9 console.error 沿用（exportFormats 内已加）
 *   • DESIGN.md token 优先 · 抽屉宽 420px（components.modal.drawer.width）
 *   • 0 IDB 写（NFR-9）· 0 网络（NFR-3）
 */

import { useEffect } from 'react';
import {
  X, FileText, FileDown, Film, FileSpreadsheet, Package,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { Button } from './ui/Button';
import { toast } from '../store/toast';
import {
  buildNovelMd, buildNovelDocx,
  buildScreenplayFdx, buildScreenplayFountain,
  buildAssetsCsv, downloadExportResult,
  type ExportContext, type ExportResult,
} from '../store/exportFormats';

export type ExportMode = 'all' | 'novel' | 'screenplay';

interface ExportDrawerProps {
  open: boolean;
  onClose: () => void;
  context: ExportContext;
  /** 默认高亮分类（影响展示顺序与默认 hover · 不限制可选项） */
  mode?: ExportMode;
  /** 是否包含项目包 .flil.json 入口（仅 Home 卡使用 · 工坊 toolbar 隐藏） */
  showProjectPackage?: boolean;
  /** 项目包导出回调（由 Home.tsx 注入 · 复用既有 projectExport 逻辑） */
  onExportProjectPackage?: () => void;
}

interface ExportItem {
  id: string;
  group: 'novel' | 'screenplay' | 'assets' | 'package';
  label: string;
  description: string;
  icon: LucideIcon;
  build: () => ExportResult | null;
  /** disabled 时显示的提示 */
  disabledHint: string;
  /** "package" 项不走 build · 走外部 callback */
  external?: () => void;
}

export function ExportDrawer({
  open, onClose, context, mode = 'all',
  showProjectPackage = false, onExportProjectPackage,
}: ExportDrawerProps) {
  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [open, onClose]);

  if (!open) return null;

  const items: ExportItem[] = [
    {
      id: 'novel-md',
      group: 'novel',
      label: '小说 · Markdown',
      description: '.md · 按章拼接 · 平台投稿首选',
      icon: FileText,
      build: () => buildNovelMd(context),
      disabledHint: '请先在 /novel 完成章节草稿（N3.1）',
    },
    {
      id: 'novel-docx',
      group: 'novel',
      label: '小说 · Word',
      description: '.docx · Word 2016+ 可直接打开 · 投稿/打印',
      icon: FileDown,
      build: () => buildNovelDocx(context),
      disabledHint: '请先在 /novel 完成章节草稿（N3.1）',
    },
    {
      id: 'screenplay-fdx',
      group: 'screenplay',
      label: '剧本 · Final Draft',
      description: '.fdx · 制片方 / 编剧软件标准',
      icon: Film,
      build: () => buildScreenplayFdx(context),
      disabledHint: '请先在 /screenplay 或 /adapt 完成最终剧本',
    },
    {
      id: 'screenplay-fountain',
      group: 'screenplay',
      label: '剧本 · Fountain',
      description: '.fountain · 开源剧本格式 · 跨工具',
      icon: Film,
      build: () => buildScreenplayFountain(context),
      disabledHint: '请先在 /screenplay 或 /adapt 完成最终剧本',
    },
    {
      id: 'assets-csv',
      group: 'assets',
      label: '资产清单 · Excel',
      description: '.csv · 角色/场景/道具合表 · 制片盘点',
      icon: FileSpreadsheet,
      build: () => buildAssetsCsv(context),
      disabledHint: '请先在 /assets 跑完角色/场景/道具引擎',
    },
  ];

  if (showProjectPackage) {
    items.push({
      id: 'project-package',
      group: 'package',
      label: '项目包 · 备份',
      description: '.flil.json · 含全部产物 + 元数据 · 跨设备同步',
      icon: Package,
      build: () => null, // 走 external
      disabledHint: '',
      external: onExportProjectPackage,
    });
  }

  // 按 mode 排序：默认分类靠前
  const orderedItems = [...items].sort((a, b) => {
    if (mode === 'all') return 0;
    const aMatch = a.group === mode ? -1 : 1;
    const bMatch = b.group === mode ? -1 : 1;
    return aMatch - bMatch;
  });

  async function handleExport(item: ExportItem) {
    try {
      if (item.external) {
        item.external();
        onClose();
        return;
      }
      const result = item.build();
      if (!result) {
        toast.warning(item.disabledHint || `${item.label} · 数据缺失`);
        return;
      }
      downloadExportResult(result);
      toast.success(`已导出：${result.filename}`);
      onClose();
    } catch (e: any) {
      console.error('[ExportDrawer] export failed', e);
      toast.error(`导出失败：${e?.message ?? e}`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-drawer-title"
    >
      {/* 遮罩 */}
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm anim-modal-backdrop"
        onClick={onClose}
      />

      {/* 抽屉 · 420px 宽 · DESIGN.md modal.drawer.width */}
      <aside className="w-[420px] bg-canvas border-l border-border-subtle flex flex-col shadow-2xl animate-slide-in-right">
        {/* header */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <FileDown className="size-5 text-primary-500" />
          <div id="export-drawer-title" className="font-semibold text-base flex-1">
            导出
          </div>
          <Button
            variant="ghost"
            iconOnly
            size="sm"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="size-4" />
          </Button>
        </header>

        {/* 项目名 */}
        <div className="px-4 py-3 border-b border-border-subtle bg-surface/30">
          <div className="text-tight-xs text-fg-muted mb-0.5">当前项目</div>
          <div className="font-semibold text-sm truncate">{context.ctx.name}</div>
        </div>

        {/* 导出项列表 */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {orderedItems.map((item) => {
            const Icon = item.icon;
            // 预览 build 一次以决定 disabled · 性能 trivial（dry run 仅检查 source）
            const result = item.external ? { ok: true } : item.build();
            const disabled = !item.external && !result;

            return (
              <button
                key={item.id}
                onClick={() => handleExport(item)}
                disabled={disabled}
                aria-disabled={disabled}
                title={disabled ? item.disabledHint : ''}
                className={clsx(
                  'w-full text-left rounded-lg border p-3 flex items-start gap-3 transition-colors',
                  disabled
                    ? 'border-border-subtle bg-surface/30 text-fg-muted cursor-not-allowed'
                    : 'border-border-subtle bg-surface hover:border-primary-500/40 hover:bg-elevated cursor-pointer',
                )}
              >
                <Icon className={clsx(
                  'size-5 mt-0.5 shrink-0',
                  disabled ? 'text-fg-muted' : 'text-primary-500',
                )} />
                <div className="flex-1 min-w-0">
                  <div className={clsx(
                    'font-medium text-sm',
                    disabled ? 'text-fg-muted' : 'text-fg-primary',
                  )}>
                    {item.label}
                  </div>
                  <div className="text-tight-xs text-fg-muted mt-0.5 break-words">
                    {item.description}
                  </div>
                  {disabled && (
                    <div className="text-tight-xs text-warning mt-1">{item.disabledHint}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* footer · 离线 + 隐私提示 */}
        <footer className="px-4 py-3 border-t border-border-subtle text-tight-xs text-fg-muted">
          所有导出文件由浏览器本地生成 · 不联网 · 不上传 · 不消耗 token
        </footer>
      </aside>
    </div>
  );
}
