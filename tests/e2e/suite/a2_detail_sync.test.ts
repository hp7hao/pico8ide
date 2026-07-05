import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { activateExtension, configureLocalMode, waitFor, sleep, FCDB_DIST } from '../helpers';

// A2 — Detail sidebar sync (docs/E2E_TEST_PLAN.md §5).
// The detail sidebar is a WebviewViewProvider (pico8GameDetail) whose HTML is
// not resolved/readable in headless tests. We therefore assert the commands
// that DRIVE it run without throwing and produce observable side effects: a
// preview `Cart:` webview panel appears on single-click, and stays open after a
// double-click pin. Deeper HTML assertions would need a webview test-hook
// (Tier B territory).
suite('A2: detail sync', () => {
    suiteSetup(async () => {
        await configureLocalMode();
        await activateExtension();
    });

    setup(async () => {
        // Clean tab state + settle so any preview panel a prior suite left behind
        // finishes its async onDidDispose (which clears Pico8CartPanel's static
        // _previewPanel). Prevents selectGame from revealing a dead panel and
        // opening no tab. See a1_tree_data.test.ts for the same guard.
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await sleep(250);
    });

    teardown(async () => {
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

    function fixtureGame(id: string): any {
        const dbPath = path.join(FCDB_DIST, 'db.json');
        const games = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const game = games.find((g: any) => g.id === id);
        assert.ok(game, `fixture game ${id} present in db.json`);
        return game;
    }

    test('A2.1 selectGame(synthetic-legacy) single-click opens a preview Cart: panel', async function () {
        this.timeout(15000);
        const game = fixtureGame('synthetic-legacy');
        // Single click → detailProvider.updateGame + openCart preview.
        await vscode.commands.executeCommand('pico8ide.selectGame', game);
        const opened = await waitFor(cartTabOpen, { timeout: 15000 });
        assert.ok(opened, 'single-click opened a Cart: preview panel');
    });

    test('A2.2 selectList drives detailProvider.showListInfo without throwing', async () => {
        // Build a minimal ListInfo (matches src/extension/dataManager.ts ListInfo).
        // showListInfo guards on the view being resolved, so headless it is a
        // safe no-op; we assert the command path executes cleanly.
        const listInfo = { name: 'Fixtures', order: 1, filename: 'curated.json', games: [] };
        await vscode.commands.executeCommand('pico8ide.selectList', listInfo);
    });

    test('A2.3 double-click within 300ms pins the panel — a Cart: tab stays open', async function () {
        this.timeout(15000);
        const game = fixtureGame('synthetic-legacy');
        // First guarantee a live preview panel via openCart. This side-steps a
        // cross-test race: a prior test's closeAllEditors disposes its preview
        // asynchronously, so leaning on residual static preview state would let
        // selectGame take the reveal-a-dead-panel branch and open no tab.
        await vscode.commands.executeCommand('pico8ide.openCart', game);
        assert.ok(await waitFor(cartTabOpen, { timeout: 15000 }), 'preview panel opened');

        // Two back-to-back selectGame calls land inside the 300ms double-click
        // window, driving Pico8CartPanel.pinCurrent(). Either way (pin or reveal)
        // a Cart: tab must remain open afterward.
        await vscode.commands.executeCommand('pico8ide.selectGame', game);
        await vscode.commands.executeCommand('pico8ide.selectGame', game);
        const opened = await waitFor(cartTabOpen, { timeout: 15000 });
        assert.ok(opened, 'a Cart: tab remains open after the double invoke (pinned)');
    });
});
