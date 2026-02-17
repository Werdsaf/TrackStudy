// playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '__tests__/ui',
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:3000', 
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm start', // ← запускает сервер перед тестами
    port: 3000,
    reuseExistingServer: true, // ← если сервер уже запущен — не перезапускать
  },
});