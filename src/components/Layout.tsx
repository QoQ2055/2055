// App layout (workflow refactor v3).
//
// The sidebar is now driven by `getProjectModeMeta(ctx)`. Only nav items
// belonging to the active project's mode are rendered, plus a fixed set
// of global tools (Home / KB / Playground / Settings) at the bottom.
//
// A colored "mode bar" at the top of the sidebar makes the active mode
// instantly obvious — no more "wait, am I in Adaptation?" confusion.

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Clapperboard, Settings as SettingsIcon, FlaskConical, Home as HomeIcon,
  FileText, Box, BookOpen, BookCopy, Workflow, Rocket, Edit3, Wand2, FileSearch,
  Brain, Lightbulb, Command as CommandIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import { useCommandPalette } from '../store/commandPalette';
import { useShortcutHandbook } from '../store/shortcutHandbook';
import { useSidebarBadges } from '../store/sidebarBadges';
import { isEditingTarget, isCtrlOrCmd } from '../lib/shortcuts';
import { toast } from '../store/toast';
import { getProjectModeMeta } from '../data/projectModes';
import type { ModeNavItem } from '../data/projectModes';
import { NavItem, NavSectionLabel } from './ui';
import { ToastContainer } from './ui/feedback';
import { CommandPalette } from './CommandPalette';
import { ShortcutHandbook } from './ShortcutHandbook';
import { SidebarBadge } from './SidebarBadge';

const ICON_MAP: Record<ModeNavItem['icon'], ComponentType<{ className?: string }>> = {
  FileText, BookCopy, Box, Workflow, Rocket, BookOpen, Wand2: FileText, Edit3,
};

export function Layout() {
  const apiKey = useSettings((s) => s.apiKey);
  const hasKey = !!apiKey?.trim();
  const ctx = useProject((s) => s.ctx);
  const meta = getProjectModeMeta(ctx);
  const togglePalette = useCommandPalette((s) => s.togglePalette);
  const openPalette = useCommandPalette((s) => s.openPalette);
  const showHandbook = useShortcutHandbook((s) => s.show);
  const pendingLessons = useSidebarBadges((s) => s.pendingLessons);
  const refreshBadges = useSidebarBadges((s) => s.refresh);

  // ui-v3 PR-2 · sidebar badge 初始 + 周期刷新 + 项目切换时刷新
  // 轮询 10s · IndexedDB 索引查询 < 5ms · 成本 trivial
  useEffect(() => {
    refreshBadges();
    const id = window.setInterval(refreshBadges, 10_000);
    return () => window.clearInterval(id);
  }, [refreshBadges]);
  // 项目切换 · 以 ctx.name 作为轻量变更检测（ctx 对象 ref 变动个别字段会频繁·name 仅在切换时变）
  useEffect(() => {
    refreshBadges();
  }, [ctx.name, refreshBadges]);

  // ui-v3 PR-1 MVP / PR-1B · 全局快捷键路由器
  // V3-I-2 · 不与浏览器原生冲突：
  //   • Cmd+K / Ctrl+K · 抢应用内（preventDefault 覆盖地址栏聚焦）· 任意上下文
  //   • Cmd+S / Ctrl+S · 抢应用内（preventDefault 覆盖浏览器保存页面）· toast 提示已自动保存
  //   • ?           · 打开快捷键手册 · 仅非 input focus 时
  //   • 不抢 Cmd+C/V/Z/A 等系统快捷键
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K · 命令面板 · 任意上下文（含 input focus）
      if (isCtrlOrCmd(e, 'k')) {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
        return;
      }
      // Cmd+S / Ctrl+S · 阻拦浏览器原生保存 · 提示已自动保存（任意上下文）
      if (isCtrlOrCmd(e, 's')) {
        e.preventDefault();
        e.stopPropagation();
        toast.info('已自动保存 · 所有改动实时持久化到本地 IndexedDB');
        return;
      }
      // ? · 快捷键手册 · 仅非 input focus 时（避免抢用户输入）
      if (e.key === '?' && !isEditingTarget(e)) {
        e.preventDefault();
        e.stopPropagation();
        showHandbook();
        return;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePalette, showHandbook]);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-sidebar shrink-0 border-r border-border-subtle bg-canvas flex flex-col">
        {/* Logo */}
        <div className="border-b border-border-subtle">
          <div className="flex items-center gap-2 px-4 py-3">
            <Clapperboard className="size-5 text-primary-500" />
            <div className="leading-tight">
              <div className="text-body-m font-semibold text-fg-primary">影语 · FLIL</div>
              <div className="text-label-m text-fg-muted normal-case">
                FILM LANGUAGE INTEGRATED LEARNING
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-auto">
          <NavItem to="/" end icon={<HomeIcon className="size-4" />}>
            项目
          </NavItem>

          {/* Mode-specific workbenches */}
          {meta.navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? FileText;
            return (
              <NavItem key={item.key} to={item.to} icon={<Icon className="size-4" />}>
                {item.label}
              </NavItem>
            );
          })}

          <NavSectionLabel>工具</NavSectionLabel>
          <NavItem to="/analyzer" icon={<FileSearch className="size-4" />}>拆书分析</NavItem>
          <NavItem to="/refinery" icon={<Wand2 className="size-4" />}>润色工坊</NavItem>
          <NavItem to="/playground" icon={<FlaskConical className="size-4" />}>调试台</NavItem>

          <NavSectionLabel>资产</NavSectionLabel>
          <NavItem to="/kb" icon={<BookOpen className="size-4" />}>知识库</NavItem>
          <NavItem to="/methods" icon={<Brain className="size-4" />}>方法论</NavItem>
          {/* ui-v3 PR-2 · lessons pending badge */}
          <div className="relative">
            <NavItem to="/lessons" icon={<Lightbulb className="size-4" />}>Reflector Lessons</NavItem>
            <SidebarBadge variant="danger" count={pendingLessons} />
          </div>

          <NavSectionLabel>设置</NavSectionLabel>
          {/* ui-v3 PR-2 · settings API key warning dot */}
          <div className="relative">
            <NavItem to="/settings" icon={<SettingsIcon className="size-4" />}>设置</NavItem>
            <SidebarBadge variant="warning" dot hidden={hasKey} />
          </div>
        </nav>

        <div className="p-3 border-t border-border-subtle text-caption-m text-fg-muted space-y-2">
          <div className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${hasKey ? 'bg-success' : 'bg-warning'}`} />
            {hasKey ? 'API Key 已配置' : '未配置 API Key'}
          </div>
          {/* ui-v3 PR-1 MVP · Cmd+K 触发提示（点击也能打开） */}
          <button
            type="button"
            onClick={openPalette}
            className="flex items-center gap-1.5 text-tight-xs text-fg-muted hover:text-fg-secondary transition-colors w-full"
            title="打开命令面板（Cmd+K / Ctrl+K）"
          >
            <CommandIcon className="size-3" />
            <span>命令面板</span>
            <kbd className="ml-auto text-tight-xs px-1 py-0.5 rounded border border-border-subtle font-mono">
              ⌘K
            </kbd>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* ui-v2 PR-2 · 全局 Toast 容器·替代 alert() */}
      <ToastContainer />
      {/* ui-v3 PR-1 MVP · 全局命令面板（Cmd+K / Ctrl+K 触发） */}
      <CommandPalette />
      {/* ui-v3 PR-1B · 全局快捷键手册（? 触发） */}
      <ShortcutHandbook />
    </div>
  );
}
