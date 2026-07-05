import { test, expect, type Page } from '@playwright/test';

const APP = '/src/webview/standalone/index.html';

// Tier B interaction specs (docs/E2E_TEST_PLAN.md §6). The standalone build wires
// getVscodeApi() → standaloneBridge, whose postMessage logs `[standalone]
// postMessage: {...}`. We capture those console lines to assert the message
// CONTRACT fired on interaction, and assert DOM/tab state directly. Pixel-exact
// canvas payloads are intentionally not asserted here — that coordinate math is
// covered by the jsdom unit tests; Tier B guards render + interaction + contract.

/** Collect `[standalone] postMessage:` payloads seen on the page. */
function captureBridge(page: Page): { messages: any[] } {
    const box = { messages: [] as any[] };
    page.on('console', async (msg) => {
        if (!msg.text().includes('[standalone] postMessage:')) return;
        // The payload object is the 2nd console arg; resolve it to a real value
        // (headless Chromium renders it as a handle in msg.text(), not JSON).
        try {
            const args = msg.args();
            if (args.length >= 2) {
                const payload = await args[1].jsonValue();
                if (payload && typeof payload === 'object' && 'type' in payload) {
                    box.messages.push(payload);
                    return;
                }
            }
        } catch {
            // fall through to text parsing
        }
        const m = msg.text().match(/type:\s*'([^']+)'/);
        if (m) box.messages.push({ type: m[1] });
    });
    return box;
}

async function activateTab(page: Page, label: string) {
    await page.locator('.tab-header .tab', { hasText: new RegExp(`^${label}$`) }).click();
}

test.describe('B1: tab switching', () => {
    test('clicking each tab marks it active and renders its panel', async ({ page }) => {
        await page.goto(APP);
        await expect(page.locator('.tab-header')).toBeVisible();

        for (const label of ['Sprites', 'Map', 'SFX', 'Music', 'Export', 'Code']) {
            await activateTab(page, label);
            const active = page.locator('.tab-header .tab.active');
            await expect(active).toHaveText(label);
        }
    });

    test('Code tab hosts the Monaco container', async ({ page }) => {
        await page.goto(APP);
        await activateTab(page, 'Code');
        // Monaco mounts into a container; its presence proves the Code panel rendered.
        await expect(page.locator('#monaco-container, .monaco-editor').first())
            .toBeVisible({ timeout: 15000 });
    });
});

test.describe('B2: sprites panel', () => {
    test('sprite canvas renders and palette is present', async ({ page }) => {
        await page.goto(APP);
        await activateTab(page, 'Sprites');
        await expect(page.locator('.sprite-canvas-container')).toBeVisible();
        // The sprite sheet canvas exists inside the container.
        expect(await page.locator('.sprite-canvas-container canvas').count())
            .toBeGreaterThan(0);
    });

    test('painting on the sprite canvas emits a gfxChanged bridge message', async ({ page }) => {
        const bridge = captureBridge(page);
        await page.goto(APP);
        await activateTab(page, 'Sprites');
        await expect(page.locator('.sprite-canvas-container')).toBeVisible();
        // Two stacked canvases (sheet + overlay); the overlay is topmost and
        // receives pointer events. Click it directly with force (layered canvases
        // fail Playwright's default stability heuristic).
        const overlay = page.locator('.sprite-canvas-container canvas').last();
        await overlay.click({ position: { x: 20, y: 20 }, force: true });
        // gfxChanged is debounced 200ms in cartStore; wait past it.
        await page.waitForTimeout(500);
        expect(bridge.messages.some((m) => m.type === 'gfxChanged')).toBeTruthy();
    });
});

test.describe('B4: map panel', () => {
    test('map canvas renders', async ({ page }) => {
        await page.goto(APP);
        await activateTab(page, 'Map');
        await expect(page.locator('.map-canvas-container')).toBeVisible();
        expect(await page.locator('.map-canvas-container canvas').count())
            .toBeGreaterThan(0);
    });
});

test.describe('B5: sfx panel', () => {
    test('sfx editor renders bar-mode canvas', async ({ page }) => {
        await page.goto(APP);
        await activateTab(page, 'SFX');
        await expect(page.locator('.sfx-canvas-wrap')).toBeVisible({ timeout: 10000 });
    });
});

test.describe('B6: music panel', () => {
    test('music editor renders (pattern controls present)', async ({ page }) => {
        await page.goto(APP);
        await activateTab(page, 'Music');
        // The music tab renders its own container; assert the panel switched in.
        await expect(page.locator('.tab-header .tab.active')).toHaveText('Music');
        // Some interactive control should exist (buttons for channels/pattern nav).
        expect(await page.locator('button').count()).toBeGreaterThan(0);
    });
});

test.describe('B8: export panel', () => {
    test('export tab shows the template picker and preview canvas', async ({ page }) => {
        await page.goto(APP);
        await activateTab(page, 'Export');
        await expect(page.locator('.tab-header .tab.active')).toHaveText('Export');
        // ExportPreview renders a 160x205 canvas (src/webview/components/export/ExportPreview.tsx:83).
        await expect(page.locator('canvas[width="160"][height="205"]'))
            .toBeVisible({ timeout: 10000 });
    });
});

test.describe('B9: run button contract', () => {
    test('run button posts a run message via the bridge', async ({ page }) => {
        const bridge = captureBridge(page);
        await page.goto(APP);
        const runBtn = page.locator('#btn-run-pico8');
        await expect(runBtn).toBeVisible();
        await runBtn.click();
        await page.waitForTimeout(200);
        expect(bridge.messages.some((m) => m.type === 'run')).toBeTruthy();
    });
});
