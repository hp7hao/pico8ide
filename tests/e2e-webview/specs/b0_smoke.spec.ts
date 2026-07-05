import { test, expect } from '@playwright/test';

const APP = '/src/webview/standalone/index.html';

// B0 — Smoke: the standalone webview boots and mounts in headless Chromium.
// This is the Tier B gate; if it fails, the interaction specs can't run.
test.describe('B0: standalone smoke', () => {
    test('app mounts and renders the tab header', async ({ page }) => {
        await page.goto(APP);
        // #root is the mount point; the tab header proves React mounted.
        await expect(page.locator('.tab-header')).toBeVisible({ timeout: 15000 });
        const tabs = page.locator('.tab-header .tab');
        expect(await tabs.count()).toBeGreaterThan(0);
    });

    test('expected tabs are present (editable mock)', async ({ page }) => {
        await page.goto(APP);
        const header = page.locator('.tab-header');
        await expect(header).toBeVisible();
        for (const label of ['Code', 'Sprites', 'Map', 'SFX', 'Music', 'Export']) {
            await expect(header.getByText(label, { exact: true })).toBeVisible();
        }
    });
});
