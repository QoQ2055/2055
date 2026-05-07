import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { hydrateProject } from './store/project';
import { installInitialTheme } from './lib/theme';
import './index.css';

// ui-v4 PR-1 · 在 React 渲染前安装初始主题（避免 FOUC）
// 直接同步读 localStorage · zustand persist 异步 hydrate 太晚
installInitialTheme();

// Kick off IDB hydration before first render. We don't await it here — UI
// components can read `useProject(s => s.hydrated)` to gate on the result.
// This way the first paint isn't blocked by a DB roundtrip while still
// guaranteeing artifacts are available before any meaningful interaction.
hydrateProject();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
