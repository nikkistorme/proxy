import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      testTimeout: 15_000,
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/main.tsx'],
        reporter: ['text', 'html', 'lcov'],
        // QA-2: logic folders must stay at 85% lines and branches.
        thresholds: {
          'src/model/**': { lines: 85, branches: 85 },
          'src/actions/**': { lines: 85, branches: 85 },
          'src/csv/**': { lines: 85, branches: 85 },
        },
      },
    },
  }),
);
