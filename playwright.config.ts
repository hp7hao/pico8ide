import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT || 5599);
const BASE = `http://127.0.0.1:${PORT}`;

// Tier B — webview E2E against the standalone build (docs/E2E_TEST_PLAN.md §6).
// The React webview boots with mockInitData and __HOST_MODE__=standalone, so no
// VS Code is involved; we drive the real DOM/canvas in headless Chromium.
export default defineConfig({
    testDir: './tests/e2e-webview/specs',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: BASE,
        headless: true,
        trace: 'off',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'node tests/e2e-webview/server.mjs',
        url: `${BASE}/src/webview/standalone/index.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
    },
});
