import { createHashRouter, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Settings } from './pages/Settings';
import { Playground } from './pages/Playground';
import { Pipeline } from './pages/Pipeline';
import { Screenplay, Adapt } from './pages/Screenplay';
import { Assets } from './pages/Assets';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Intake } from './pages/Intake';
import { Express } from './pages/Express';
import { Novel } from './pages/Novel';
import { Refinery } from './pages/Refinery';
import { Analyzer } from './pages/Analyzer';
import { MethodModules } from './pages/MethodModules';

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'intake', element: <Intake /> },
      { path: 'screenplay', element: <Screenplay /> },
      { path: 'adapt', element: <Adapt /> },
      { path: 'assets', element: <Assets /> },
      { path: 'kb', element: <KnowledgeBase /> },
      { path: 'pipeline', element: <Pipeline /> },
      { path: 'express', element: <Express /> },
      { path: 'novel', element: <Novel /> },
      { path: 'refinery', element: <Refinery /> },
      { path: 'analyzer', element: <Analyzer /> },
      { path: 'playground', element: <Playground /> },
      { path: 'methods', element: <MethodModules /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
