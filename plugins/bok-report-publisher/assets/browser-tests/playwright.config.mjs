import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'report.spec.mjs',
  outputDir: './test-results',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.BOK_BASE_URL || 'http://127.0.0.1:5173',
    browserName: 'chromium',
    ...(process.env.BOK_BROWSER_CHANNEL ? { channel: process.env.BOK_BROWSER_CHANNEL } : {}),
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, hasTouch: true } },
    { name: 'tablet-portrait', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'tablet-landscape', use: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }
  ]
});
