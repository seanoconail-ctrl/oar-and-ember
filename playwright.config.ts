import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests. By default they run against the production build served by
 * `vite preview` (run `npm run build` first). Set BASE_URL to test a published address instead,
 * e.g. BASE_URL=https://<owner>.github.io/oar-and-ember/ npm run test:browser
 */
const published = process.env['BASE_URL'];
const baseURL = published ?? 'http://localhost:4173/';

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined,
  retries: process.env['CI'] !== undefined ? 1 : 0,
  reporter: process.env['CI'] !== undefined ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Overrides Firefox's graphics blocklist, which can turn WebGL off on the virtual GPUs of
        // CI machines. A desktop Firefox with a supported graphics card needs nothing.
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  ...(published === undefined
    ? {
        webServer: {
          command: 'npx vite preview --port 4173 --strictPort',
          url: baseURL,
          reuseExistingServer: process.env['CI'] === undefined,
        },
      }
    : {}),
});
