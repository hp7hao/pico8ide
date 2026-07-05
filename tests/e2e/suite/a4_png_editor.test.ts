import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { activateExtension, FIXTURE_DIR, waitFor } from '../helpers';

// A4 — Pico8PngEditorProvider (viewType pico8ide.pngViewer) for .p8.png cartridges
// (docs/E2E_TEST_PLAN.md §5; src/extension/cartEditorProvider.ts:464-582).
//
// The pngViewer is read-only: it decodes the PNG via Pico8Decoder in
// openCustomDocument and renders a viewer webview in resolveCustomEditor. We
// cannot reliably drive the webview DOM from the extension host, so these tests
// assert what IS observable at the provider layer: opening the custom editor
// with vscode.openWith produces a TabInputCustom tab carrying the pngViewer
// viewType, and a corrupt PNG still resolves (error HTML) without throwing.
//
// Files are copied into a per-suite temp dir so the committed fixtures stay
// clean and so the paths are outside globalStorage (workspace-cart branch).

const PNG_VIEW_TYPE = 'pico8ide.pngViewer';
const REAL_CART = path.join(FIXTURE_DIR, 'carts', 'pxa_synthetic-pxa.p8.png');

let tmpDir: string;

/** True if any tab is a custom editor with the given viewType and uri. */
function customTabOpen(viewType: string, uri: vscode.Uri): boolean {
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (
                tab.input instanceof vscode.TabInputCustom &&
                tab.input.viewType === viewType &&
                tab.input.uri.fsPath === uri.fsPath
            ) {
                return true;
            }
        }
    }
    return false;
}

suite('A4: png editor (pico8ide.pngViewer)', () => {
    suiteSetup(async () => {
        await activateExtension();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p8ide-e2e-'));
    });

    suiteTeardown(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // best-effort cleanup
        }
    });

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    test('A4.1 openWith a synthetic .p8.png opens a pngViewer custom editor tab', async function () {
        this.timeout(15000);
        const dest = path.join(tmpDir, 'a41_real.p8.png');
        fs.copyFileSync(REAL_CART, dest);
        const uri = vscode.Uri.file(dest);

        // Should decode + resolve without throwing.
        await vscode.commands.executeCommand('vscode.openWith', uri, PNG_VIEW_TYPE);

        const opened = await waitFor(() => customTabOpen(PNG_VIEW_TYPE, uri), {
            timeout: 10000,
        });
        assert.ok(opened, 'a pico8ide.pngViewer custom editor tab appeared');
    });

    test('A4.3 openWith a corrupt .p8.png still opens a tab (error HTML, no throw)', async function () {
        this.timeout(15000);
        // A tiny invalid PNG: valid signature but no usable chunks, so
        // Pico8Decoder.decode throws → cartData stays null → getErrorHtml path
        // (cartEditorProvider.ts:480-484, 536-538). resolveCustomEditor must
        // still complete and yield a tab.
        const dest = path.join(tmpDir, 'a43_corrupt.p8.png');
        const badPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);
        fs.writeFileSync(dest, badPng);
        const uri = vscode.Uri.file(dest);

        // Must not throw despite the decode failure.
        await vscode.commands.executeCommand('vscode.openWith', uri, PNG_VIEW_TYPE);

        const opened = await waitFor(() => customTabOpen(PNG_VIEW_TYPE, uri), {
            timeout: 10000,
        });
        assert.ok(opened, 'a tab opened even though the cartridge failed to decode');
    });
});
