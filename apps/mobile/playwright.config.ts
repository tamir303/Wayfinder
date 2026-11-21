import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// An offline MapLibre style (a flat background, no tiles) so the real map renders in tests without a network or key.
const TEST_MAP_STYLE = `data:application/json,${encodeURIComponent(
  JSON.stringify({ version: 8, name: 'test', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#E6F0FB' } }] }),
)}`;

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
    env: { EXPO_PUBLIC_MAP_STYLE_URL: TEST_MAP_STYLE },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
