import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { activateExtension, configureLocalMode, waitFor } from '../helpers';

// A3 — Open cart (database viewer, read-only) subset (docs/E2E_TEST_PLAN.md §5).
// The fixture carts resolve locally (no network); opening exercises the real
// decode path (pngDecoder) and the Pico8CartPanel preview lifecycle.
suite('A3: open cart + decode', () => {
    suiteSetup(async () => {
        await configureLocalMode();
        await activateExtension();
    });

    teardown(async () => {
        // Close all editors so each test starts from a clean tab state.
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    function cartTabOpen(): boolean {
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputWebview &&
                    /Cart:/.test(tab.label)) {
                    return true;
                }
            }
        }
        return false;
    }

    test('A3.1 openCart(pxa game) opens a cart webview panel', async () => {
        await vscode.commands.executeCommand('pico8ide.openCart', 'synthetic-pxa');
        const opened = await waitFor(cartTabOpen, { timeout: 15000 });
        assert.ok(opened, 'a Cart: webview tab appeared');
    });

    test('A3.1b openCart(legacy game) opens a cart webview panel', async () => {
        await vscode.commands.executeCommand('pico8ide.openCart', 'synthetic-legacy');
        const opened = await waitFor(cartTabOpen, { timeout: 15000 });
        assert.ok(opened, 'a Cart: webview tab appeared');
    });

    test('A3.3 openCart(unknown id) does not open a cart panel', async () => {
        await vscode.commands.executeCommand('pico8ide.openCart', 'nonexistent-id');
        // Give the command a beat; no Cart: tab should appear.
        const opened = await waitFor(cartTabOpen, { timeout: 2000 });
        assert.strictEqual(opened, false, 'no cart tab for unknown id');
    });
});
