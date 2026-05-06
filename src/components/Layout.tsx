// App layout (workflow refactor v3).
//
// The sidebar is now driven by `getProjectModeMeta(ctx)`. Only nav items
// belonging to the active project's mode are rendered, plus a fixed set
// of global tools (Home / KB / Playground / Settings) at the bottom.
//
// A colored "mode bar" at the top of the sidebar makes the active mode
// instantly obvious — no more "wait, am I in Adaptation?" confusion.

import { Outlet } from 'react-router-dom';
import {
  Clapperboard, Settings as SettingsIcon, FlaskConical, Home as HomeIcon,
  FileText, Box, BookOpen, BookCopy, Workflow, Rocket, Edit3, Wand2, FileSearch,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import { getProjectModeMeta } from '../data/projectModes';
import type { ModeNavItem } from '../data/projectModes';
import { NavItem, NavSectionLabel } from './ui';

const ICON_MAP: Record<ModeNavItem['icon'], ComponentType<{ className?: string }>> = {
  FileText, BookCopy, Box, Workflow, Rocket, BookOpen, Wand2: FileText, Edit3,
};

export function Layout() {
  const apiKey = useSettings((s) => s.apiKey);
  const hasKey = !!apiKey?.trim();
  const ctx = useProject((s) => s.ctx);
  const projectName = ctx.name || '未命名';
  const meta = getProjectModeMeta(ctx);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-sidebar shrink-0 border-r border-border-subtle bg-canvas flex flex-col">
        {/* Logo + mode color band */}
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
          {/* Mode strip — color encodes the active mode at a glance */}
          <div
            className="px-4 py-2 flex items-center gap-2 text-caption-m"
            style={{
              backgroundColor: `${meta.accentHex}15`,
              borderTop: `2px solid ${meta.accentHex}`,
            }}
            title={meta.tagline}
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: meta.accentHex }}
            />
            <span className="font-medium text-fg-primary">{meta.longLabel}</span>
            <span className="text-fg-muted truncate">· {projectName}</span>
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

          <NavSectionLabel>通用</NavSectionLabel>

          <NavItem to="/kb" icon={<BookOpen className="size-4" />}>知识库</NavItem>
          <NavItem to="/analyzer" icon={<FileSearch className="size-4" />}>拆书分析</NavItem>
          <NavItem to="/refinery" icon={<Wand2 className="size-4" />}>润色工坊</NavItem>
          <NavItem to="/playground" icon={<FlaskConical className="size-4" />}>调试台</NavItem>
          <NavItem to="/settings" icon={<SettingsIcon className="size-4" />}>设置</NavItem>
        </nav>

        <div className="p-3 border-t border-border-subtle text-caption-m text-fg-muted">
          <div className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${hasKey ? 'bg-success' : 'bg-warning'}`} />
            {hasKey ? 'API Key 已配置' : '未配置 API Key'}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
