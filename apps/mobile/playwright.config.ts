import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Runs against the dev environment build (mock data, no network).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /\.he\.spec\.ts/ },
    { name: 'chromium-he', use: { ...devices['Desktop Chrome'], locale: 'he-IL' }, testMatch: /\.he\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm run export:web && node scripts/serve-dist.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
