import { lazy, Suspense, type ReactNode } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// ui-v6 PR-7 路由级 code-split：每个一级路由独立 chunk · 首屏只加载 Home + Layout + vendor
// 14 路由 lazy 化 · Suspense 期间显示极简 loading 占位（保持 page-y 高度避免布局跳动）
const Home              = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Settings          = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Playground        = lazy(() => import('./pages/Playground').then(m => ({ default: m.Playground })));
const Pipeline          = lazy(() => import('./pages/Pipeline').then(m => ({ default: m.Pipeline })));
// Screenplay + Adapt 来自同一模块 · Rollup 自动 dedup 为单 chunk · 两个 lazy 共享一份代码
const Screenplay        = lazy(() => import('./pages/Screenplay').then(m => ({ default: m.Screenplay })));
const Adapt             = lazy(() => import('./pages/Screenplay').then(m => ({ default: m.Adapt })));
const Assets            = lazy(() => import('./pages/Assets').then(m => ({ default: m.Assets })));
const KnowledgeBase     = lazy(() => import('./pages/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const Intake            = lazy(() => import('./pages/Intake').then(m => ({ default: m.Intake })));
const Express           = lazy(() => import('./pages/Express').then(m => ({ default: m.Express })));
const Novel             = lazy(() => import('./pages/Novel').then(m => ({ default: m.Novel })));
const Refinery          = lazy(() => import('./pages/Refinery').then(m => ({ default: m.Refinery })));
const Analyzer          = lazy(() => import('./pages/Analyzer').then(m => ({ default: m.Analyzer })));
const MethodModules     = lazy(() => import('./pages/MethodModules').then(m => ({ default: m.MethodModules })));
const ReflectorLessons  = lazy(() => import('./pages/ReflectorLessons').then(m => ({ default: m.ReflectorLessons })));
// MM1 PR-2 · multi-format expansion · 4 路由骨架（0 LLM · 仅工作流元数据展示）
const FeatureFilm       = lazy(() => import('./pages/FeatureFilm').then(m => ({ default: m.FeatureFilm })));
const ShortFilm         = lazy(() => import('./pages/ShortFilm').then(m => ({ default: m.ShortFilm })));
const UltraShortFilm    = lazy(() => import('./pages/UltraShortFilm').then(m => ({ default: m.UltraShortFilm })));
const Series            = lazy(() => import('./pages/Series').then(m => ({ default: m.Series })));

// 极简 loading 占位 · 用 fg-muted token · 不引入新依赖
const RouteFallback = () => (
  <div className="flex items-center justify-center py-page-y text-fg-muted text-body-s">
    <span className="animate-pulse">加载中...</span>
  </div>
);

const wrap = (el: ReactNode) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true,            element: wrap(<Home />) },
      { path: 'intake',         element: wrap(<Intake />) },
      { path: 'screenplay',     element: wrap(<Screenplay />) },
      { path: 'adapt',          element: wrap(<Adapt />) },
      { path: 'assets',         element: wrap(<Assets />) },
      { path: 'kb',             element: wrap(<KnowledgeBase />) },
      { path: 'pipeline',       element: wrap(<Pipeline />) },
      { path: 'express',        element: wrap(<Express />) },
      { path: 'novel',          element: wrap(<Novel />) },
      { path: 'refinery',       element: wrap(<Refinery />) },
      { path: 'analyzer',       element: wrap(<Analyzer />) },
      { path: 'playground',     element: wrap(<Playground />) },
      { path: 'methods',        element: wrap(<MethodModules />) },
      { path: 'lessons',        element: wrap(<ReflectorLessons />) },
      // MM1 PR-2 · 4 multi-format 骨架路由（0 LLM · 仅工作流元数据展示）
      { path: 'feature-film',   element: wrap(<FeatureFilm />) },
      { path: 'short-film',     element: wrap(<ShortFilm />) },
      { path: 'ultrashort-film', element: wrap(<UltraShortFilm />) },
      { path: 'series',         element: wrap(<Series />) },
      { path: 'settings',       element: wrap(<Settings />) },
      { path: '*',              element: <Navigate to="/" replace /> },
    ],
  },
]);
