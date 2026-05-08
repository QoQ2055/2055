/**
 * ui-v6 PR-8 · 路由 chunk hover 预取
 *
 * 配合 router.tsx 的 React.lazy 路由级 code-split · 在用户 hover sidebar nav item
 * 时提前 fetch 该路由的 chunk · 真实点击时 React.lazy 已能同步 resolve · 消除
 * Suspense fallback 闪现。
 *
 * 设计：
 * - 注册表 path → 同 router.tsx 的 dynamic import 函数（Vite 自动 chunk hash 共享）
 * - 已预取过的 path 用 Set 去重 · 避免重复网络请求
 * - 用 requestIdleCallback 推迟到主线程空闲再下载 · 不抢占用户当前操作
 * - 失败时从 Set 移除 · 下次 hover 重试
 *
 * 不变量：
 * - 路由路径 0 改 · dynamic import 路径与 router.tsx 完全一致（Rollup dedup）
 * - 业务逻辑 0 改 · 仅在 nav hover 时触发网络请求
 */

const prefetchers: Record<string, () => Promise<unknown>> = {
  '/':           () => import('./pages/Home'),
  '/intake':     () => import('./pages/Intake'),
  '/screenplay': () => import('./pages/Screenplay'),
  '/adapt':      () => import('./pages/Screenplay'),
  '/assets':     () => import('./pages/Assets'),
  '/kb':         () => import('./pages/KnowledgeBase'),
  '/pipeline':   () => import('./pages/Pipeline'),
  '/express':    () => import('./pages/Express'),
  '/novel':      () => import('./pages/Novel'),
  '/refinery':   () => import('./pages/Refinery'),
  '/analyzer':   () => import('./pages/Analyzer'),
  '/playground': () => import('./pages/Playground'),
  '/methods':    () => import('./pages/MethodModules'),
  '/lessons':    () => import('./pages/ReflectorLessons'),
  '/settings':   () => import('./pages/Settings'),
};

const prefetched = new Set<string>();

/**
 * 预取指定路径的路由 chunk · 幂等 · 失败可重试。
 * @param path - react-router 中定义的 path · 不在注册表中的会静默忽略
 */
export function prefetchRoute(path: string): void {
  if (prefetched.has(path)) return;
  const fn = prefetchers[path];
  if (!fn) return;
  prefetched.add(path);

  const run = () => {
    fn().catch(() => {
      // 失败时回滚 set · 下次 hover 重试
      prefetched.delete(path);
    });
  };

  // requestIdleCallback 是 DOM lib 已声明的可选 API（部分浏览器支持） · fallback 到 setTimeout
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 200 });
  } else {
    setTimeout(run, 0);
  }
}

/** 测试用：清空已预取记录（dogfood 验证 hover 行为时可用） */
export function _resetPrefetchCache(): void {
  prefetched.clear();
}
