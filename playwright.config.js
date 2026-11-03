import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.js',
    url: 'http://localhost:4173/health',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
  reporter: 'list',
});
