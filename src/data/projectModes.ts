// Project mode metadata: single source of truth for which UI elements
// each mode shows, how it's labelled, what stages belong to it, and which
// sidebar links / default route are appropriate.
//
// All UI components (NewProjectDialog cards, Layout sidebar, Pipeline tabs,
// Home navigation, ProgressBanner) read from this module, so changing how
// a mode behaves only needs to be done in one place.

import type { ProjectContext, ProjectMode, StageId } from '../pipeline/types';

/* ── Mode descriptors ──────────────────────────────────────── */

export interface ProjectModeMeta {
  id: ProjectMode;
  /** Short label e.g. "原创" */
  label: string;
  /** Longer descriptive title e.g. "从 0 原创剧本" */
  longLabel: string;
  /** One-line marketing copy used in the mode-pick card */
  tagline: string;
  /** Workflow ASCII rendered on the mode-pick card */
  workflow: string;
  /** Hex/Tailwind color band used for the sidebar mode-bar (uses arbitrary classes) */
  colorClass: string;
  /** Hex used in CSS for callouts (no Tailwind dependency) */
  accentHex: string;
  /** Whether this mode is feature-complete or still a placeholder */
  status: 'stable' | 'beta' | 'placeholder';
  /** Pipeline stages this mode actually uses, in run order */
  stages: StageId[];
  /** Default route after creating/loading a project of this mode */
  defaultRoute: string;
  /** Sidebar nav items shown when this mode is active */
  navItems: ModeNavItem[];
}

export interface ModeNavItem {
  /** Unique key */
  key: string;
  /** Route path; pass to <NavLink to> */
  to: string;
  /** Display label e.g. "剧本工作台 (S1-S8)" */
  label: string;
  /** Lucide icon name (kept as string so callers import their own) */
  icon: 'FileText' | 'BookCopy' | 'Box' | 'Workflow' | 'Rocket' | 'BookOpen' | 'Wand2' | 'Edit3';
}

/* ── Per-mode descriptors ──────────────────────────────────── */

export const MODE_ORIGINAL: ProjectModeMeta = {
  id: 'original',
  label: '原创',
  longLabel: '从 0 原创剧本',
  tagline: '题材融合 + 平台 + 核心冲突 → 八步剧本 → 资产 → 分镜',
  workflow: '题材定型 → R1 → S1–S8 → 资产 → 分镜',
  colorClass: 'bg-sky-500',
  accentHex: '#0ea5e9',
  status: 'stable',
  stages: ['screenplay', 'assets', 'storyboard'],
  defaultRoute: '/screenplay',
  navItems: [
    // 「剧本工作台 (S1-S8)」入口从侧栏移除：用户已通过项目卡 / 模式 defaultRoute 直达，
    // 侧栏不重复提供。/screenplay 路由仍保留，可通过 URL / 项目卡跳转访问。
    // 「资产工作台」入口从侧栏移除：本身在剧本工作台内部的「镜像到 screenplay.7 跳资产」
    // 按钮与 Express 页「资产工作台」入口中可达，不需侧栏重复提供。/assets 路由仍保留。
    // 「流水线总览」入口已移除：其功能与「新建项目」向导里的完整流程重复。
  ],
};

export const MODE_ADAPTATION: ProjectModeMeta = {
  id: 'adaptation',
  label: '改编',
  longLabel: '剧本改编',
  tagline: '吃下原作 → 派生 S0/R1\' → A1–A6 改编流水线 → 资产 → 分镜',
  workflow: '原作摄入 → A1–A6 → 资产 → 分镜',
  colorClass: 'bg-violet-500',
  accentHex: '#8b5cf6',
  status: 'stable',
  stages: ['screenplay', 'adapt', 'assets', 'storyboard'],
  defaultRoute: '/intake',
  navItems: [
    // 原作摄入 (S0) / 改编工作台 (A1-A6) / 资产工作台 均本属于同一改编流水线，
    // 依靠页面内部依次导航（defaultRoute=/intake → 摄入页「完成后进入改编」链接→
    // 改编工作台内「镜像到 screenplay.7 跳资产」按钮），依赖在页面内已完备，所以侧栏
    // 不重复列出三个独立条目。路由本身仍保留，可通过 URL / 席位跳转访问。
  ],
};

export const MODE_EXPRESS: ProjectModeMeta = {
  id: 'express',
  label: '特殊·分镜',
  longLabel: '特殊项目 · 仅分镜',
  tagline: '跳过剧本，给一段简介直接进分镜规划与单元生成',
  workflow: '简介 → 分镜规划 → 分镜单元',
  colorClass: 'bg-amber-500',
  accentHex: '#f59e0b',
  status: 'stable',
  stages: ['storyboard'],
  defaultRoute: '/express',
  navItems: [
    // 「分镜工作台」与「流水线总览」入口均已移除：
    // - 分镜工作台 (/express) 是 Express 模式的 defaultRoute, 创建项目后会自动跳过去
    // - 流水线总览 (/pipeline) 与新建项目向导功能重复
    // 路由本身保留, 仍可通过 URL / 项目创建跳转访问。
  ],
};

export const MODE_NOVEL: ProjectModeMeta = {
  id: 'novel',
  label: '小说',
  longLabel: '小说创作',
  tagline: '世界观 + 人物 bible → 分卷分章大纲 + 伏笔表 → 章节草稿 + 润色',
  workflow: '设定 → 大纲 → 章节',
  colorClass: 'bg-emerald-500',
  accentHex: '#10b981',
  status: 'stable',
  stages: ['novel'],
  defaultRoute: '/novel',
  navItems: [
    // 「小说工作台」入口从侧栏移除（与 original/adaptation/express 三模式一致）：
    // - /novel 是 novel 模式的 defaultRoute · 创建小说项目后会自动跳过去
    // - 项目卡 / 模式选择都能直达
    // 路由本身保留, 仍可通过 URL / 项目创建跳转访问。
  ],
};

export const ALL_MODES: ProjectModeMeta[] = [
  MODE_ORIGINAL,
  MODE_ADAPTATION,
  MODE_EXPRESS,
  MODE_NOVEL,
];

const MODE_BY_ID: Record<ProjectMode, ProjectModeMeta> = {
  original:   MODE_ORIGINAL,
  adaptation: MODE_ADAPTATION,
  express:    MODE_EXPRESS,
  novel:      MODE_NOVEL,
};

/* ── Resolution / back-compat ──────────────────────────────── */

/**
 * Derive the active mode from a project context. Used everywhere instead of
 * raw `ctx.createMode` so that legacy projects (saved before `projectMode`
 * was introduced) and Express-tagged projects (`projectType === 'express'`)
 * still resolve to the right metadata.
 *
 * Resolution order:
 *   1. Explicit `ctx.projectMode` (preferred — set by NewProjectDialog v2)
 *   2. `ctx.projectType === 'express'` (legacy tag)
 *   3. `ctx.createMode` ('adaptation' or 'original')
 */
export function getProjectMode(ctx: Pick<ProjectContext, 'projectMode' | 'projectType' | 'createMode'>): ProjectMode {
  if (ctx.projectMode) return ctx.projectMode;
  if (ctx.projectType === 'express') return 'express';
  if (ctx.createMode === 'adaptation') return 'adaptation';
  return 'original';
}

/** Look up metadata for a given mode id. Always returns a value (defaults to original). */
export function getModeMeta(mode: ProjectMode): ProjectModeMeta {
  return MODE_BY_ID[mode] ?? MODE_ORIGINAL;
}

/** Convenience: derive the meta directly from a project context. */
export function getProjectModeMeta(ctx: Pick<ProjectContext, 'projectMode' | 'projectType' | 'createMode'>): ProjectModeMeta {
  return getModeMeta(getProjectMode(ctx));
}
