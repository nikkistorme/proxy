import { defineConfig, devices } from '@playwright/test';

const port = 4174;

/**
 * The performance check (8d, #171): `npm run test:perf`. Chromium only, one test at a
 * time, against the production build. Kept out of `npm run test:e2e` and CI, because
 * INP and frame rate are too noisy on shared runners (owner decision). The default
 * test match doesn't pick up `*.perf.ts`, so the E2E config never runs it.
 */
export default defineConfig({
  testDir: './e2e/perf',
  testMatch: '**/*.perf.ts',
  workers: 1,
  timeout: 300_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}/proxy/`,
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/proxy/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
