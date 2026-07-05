import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { activateExtension, configureLocalMode, waitFor, sleep, FCDB_DIST } from '../helpers';

// A1 — Tree data provider (docs/E2E_TEST_PLAN.md §5).
// The Pico8ListsProvider instance is not exported, so tree children can't be
// read directly. Instead we drive the provider through its public commands and
// assert observable state: commands resolve without throwing, and a game
// flowing through selectGame/openCart opens a `Cart:` webview panel.
suite('A1: tree data', () => {
    suiteSetup(async () => {
        await configureLocalMode();
        await activateExtension();
    });

    setup(async () => {
        // Start each test from a clean tab state. Closing editors here (in
        // addition to teardown) plus a short settle lets any preview panel a
        // prior suite left behind finish its async onDidDispose, which clears
        // Pico8CartPanel's static _previewPanel. Otherwise a lingering (dead)
        // preview would make selectGame take the reveal-branch and open no tab.
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

    // Read a real GameMetadata object from the fixture DB so selectGame receives
    // the shape the command expects (id/name/author/source/extension).
    function fixtureGame(id: string): any {
        const dbPath = path.join(FCDB_DIST, 'db.json');
        const games = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const game = games.find((g: any) => g.id === id);
        assert.ok(game, `fixture game ${id} present in db.json`);
        return game;
    }

    test('A1.1 refreshEntry loads data from the fixture FCDB without throwing', async () => {
        // listsProvider.load() reads the local db.json; resolving without a throw
        // proves the fixture data loaded.
        await vscode.commands.executeCommand('pico8ide.refreshEntry');
    });

    test('A1.3 selectGame(synthetic-legacy) flows the game through and opens a preview cart panel', async function () {
        this.timeout(15000);
        const game = fixtureGame('synthetic-legacy');
        await vscode.commands.executeCommand('pico8ide.selectGame', game);
        const opened = await waitFor(cartTabOpen, { timeout: 15000 });
        assert.ok(opened, 'a Cart: webview tab appeared for the selected game');
    });

    test('A1.3b search opens an input box and dismisses cleanly (no throw)', async function () {
        this.timeout(15000);
        // showInputBox can't be stubbed from outside the extension, and headless
        // it stays pending rather than auto-resolving, so we must NOT await the
        // command to completion. Fire it, let the input box appear, then dismiss
        // it via closeQuickOpen; the search command's `if (query !== undefined)`
        // guard means the cancelled input skips setFilter. We assert only that
        // driving the command surfaces no synchronous error (deeper filter
        // assertion would need a provider test-hook — Tier B territory).
        const pending = vscode.commands.executeCommand('pico8ide.search');
        await sleep(300);
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        await pending; // resolves once the input box is cancelled
    });

    test('A1.4 refreshEntry is idempotent — a second reload also resolves cleanly', async () => {
        await vscode.commands.executeCommand('pico8ide.refreshEntry');
        await vscode.commands.executeCommand('pico8ide.refreshEntry');
    });

    test('A1.5 openCart(id) opens a Cart: webview tab', async function () {
        this.timeout(15000);
        await vscode.commands.executeCommand('pico8ide.openCart', 'synthetic-legacy');
        const opened = await waitFor(cartTabOpen, { timeout: 15000 });
        assert.ok(opened, 'a Cart: webview tab appeared');
    });
});
