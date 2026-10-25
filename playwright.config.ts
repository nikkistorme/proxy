import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const port = 4173;

const browsers = isCI
  ? [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ]
  : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}/proxy/`,
    // QA-6: keep a trace and screenshot for failed tests.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: browsers,
  // E2E runs against the production build.
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/proxy/`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
