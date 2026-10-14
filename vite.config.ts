import { defineConfig } from 'vitest/config';

// base 设为相对路径，部署到 GitHub Pages 的子路径（/Firefly-Valley/）时资源也能正确加载
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
