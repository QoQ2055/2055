/**
 * vitest 配置 · MM5 PR-2 引入
 *
 * 用途：dexie 数据层迁移与 helpers 单元测试。
 *
 * 关键决策：
 *   - environment: 'node' · dexie 测试不需要 DOM
 *   - setupFiles: ['fake-indexeddb/auto'] · 在测试文件 import 之前注入全局 indexedDB
 *     polyfill · 让 dexie 在 Node 环境工作
 *   - 不与 vite.config.ts 共享 · 隔离构建配置 · 避免测试受 manualChunks / vendor 拆分影响
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // 每个测试文件独立 worker · 避免 dexie 单例污染
    isolate: true,
    // CI 友好：失败立即输出 · 不做 watch
    reporters: ['default'],
  },
});
