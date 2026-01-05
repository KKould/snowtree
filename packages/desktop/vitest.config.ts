import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@snowtree/core': path.resolve(__dirname, '../../node_modules/@snowtree/core/dist'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
