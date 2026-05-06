// App layout (workflow refactor v3).
//
// The sidebar is now driven by `getProjectModeMeta(ctx)`. Only nav items
// belonging to the active project's mode are rendered, plus a fixed set
// of global tools (Home / KB / Playground / Settings) at the bottom.
//
// A colored "mode bar" at the top of the sidebar makes the active mode
// instantly obvious — no more "wait, am I in Adaptation?" confusion.

import { NavLink, Outlet } from 'react-router-dom';
import {
  Clapperboard, Settings as SettingsIcon, FlaskConical, Home as HomeIcon,
  FileText, Box, BookOpen, BookCopy, Workflow, Rocket, Edit3, Wand2, FileSearch,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useSettings } from '../store/settings';
import { useProject } from '../store/project';
import { getProjectModeMeta } from '../data/projectModes';
import type { ModeNavItem } from '../data/projectModes';

const ICON_MAP: Record<ModeNavItem['icon'], ComponentType<{ className?: string }>> = {
  FileText, BookCopy, Box, Workflow, Rocket, BookOpen, Wand2: FileText, Edit3,
};

export function Layout() {
  const apiKey = useSettings((s) => s.apiKey);
  const hasKey = !!apiKey?.trim();
  const ctx = useProject((s) => s.ctx);
  const projectName = ctx.name || '未命名';
  const meta = getProjectModeMeta(ctx);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
    }`;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        {/* Logo + mode color band */}
        <div className="border-b border-zinc-800">
          <div className="flex items-center gap-2 px-4 py-3">
            <Clapperboard className="size-5 text-brand-500" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">影语 · FLIL</div>
              <div className="text-[10px] text-zinc-500 tracking-wider">
                FILM LANGUAGE INTEGRATED LEARNING
              </div>
            </div>
          </div>
          {/* Mode strip — color encodes the active mode at a glance */}
          <div
            className="px-4 py-2 flex items-center gap-2 text-[11px]"
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
            <span className="font-medium text-zinc-200">{meta.longLabel}</span>
            <span className="text-zinc-500 truncate">· {projectName}</span>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-auto">
          <NavLink to="/" className={linkCls} end>
            <HomeIcon className="size-4" /> 项目
          </NavLink>

          {/* Mode-specific workbenches */}
          {meta.navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? FileText;
            return (
              <NavLink key={item.key} to={item.to} className={linkCls}>
                <Icon className="size-4" /> {item.label}
              </NavLink>
            );
          })}

          {/* Section separator */}
          <div className="pt-3 pb-1 px-3 text-[10px] uppercase tracking-wider text-zinc-600">
            通用
          </div>

          <NavLink to="/kb" className={linkCls}>
            <BookOpen className="size-4" /> 知识库
          </NavLink>
          <NavLink to="/analyzer" className={linkCls}>
            <FileSearch className="size-4" /> 拆书分析
          </NavLink>
          <NavLink to="/refinery" className={linkCls}>
            <Wand2 className="size-4" /> 润色工坊
          </NavLink>
          <NavLink to="/playground" className={linkCls}>
            <FlaskConical className="size-4" /> 调试台
          </NavLink>
          <NavLink to="/settings" className={linkCls}>
            <SettingsIcon className="size-4" /> 设置
          </NavLink>
        </nav>

        <div className="p-3 border-t border-zinc-800 text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
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
