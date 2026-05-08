import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    // ui-v6 PR-7 · 路由级 lazy 后主 chunk 应 <500KB · vendor chunks 各 <450KB · 警告阈值上调到 600 给 vendor-react 留余地
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // vendor 分组：按"变更频率 × 体积"分组 · 用户代码改动不会让 vendor 重新下载
        manualChunks: {
          'vendor-react':     ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons':     ['lucide-react'],
          'vendor-storage':   ['dexie'],
          'vendor-markdown':  ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
});
