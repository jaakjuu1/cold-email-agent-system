import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@cold-outreach/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@cold-outreach/agent': path.resolve(__dirname, '../../packages/agent/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', '__tests__/**/*.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts'],
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});

