import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { activateExtension, configureLocalMode, waitFor, FIXTURE_DIR } from '../helpers';

// A8 — Authoring / editor-association commands (docs/E2E_TEST_PLAN.md §5).
//
// newP8Mod / showI18nDemo / openWithP8IDE all end by opening a p8Editor custom
// editor via a showSaveDialog-selected (or temp) path. showSaveDialog
// auto-cancels headless, so we stub it to a temp path to exercise the write
// path. useTextEditorForP8 mutates a Global config; we assert then restore it.

// FIXTURE_DIR is <root>/tests/e2e/fixtures; the .p8 probe lives at
// <root>/tests/p8go_probe/, so walk up three levels to the project root.
const PROJECT_ROOT = path.resolve(FIXTURE_DIR, '..', '..', '..');
const P8_PROBE = path.join(PROJECT_ROOT, 'tests', 'p8go_probe', 'p8go_probe.p8');

function p8EditorTabOpen(): boolean {
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            if (tab.input instanceof vscode.TabInputCustom &&
                tab.input.viewType === 'pico8ide.p8Editor') {
                return true;
            }
        }
    }
    return false;
}

suite('A8: authoring & editor-association commands', () => {
    let tmpDir: string;

    suiteSetup(async () => {
        await configureLocalMode();
        await activateExtension();
    });

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p8ide-a8-'));
    });

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
    });

    async function withSaveDialog(destPath: string, fn: () => Promise<void>): Promise<void> {
        const orig = vscode.window.showSaveDialog;
        (vscode.window as any).showSaveDialog = async () => vscode.Uri.file(destPath);
        try {
            await fn();
        } finally {
            (vscode.window as any).showSaveDialog = orig;
        }
    }

    test('A8.1 newP8Mod writes a blank p8mod and opens it', async function () {
        this.timeout(20000);
        const dest = path.join(tmpDir, 'untitled.p8mod');
        await withSaveDialog(dest, async () => {
            await vscode.commands.executeCommand('pico8ide.newP8Mod');
        });

        assert.ok(await waitFor(() => fs.existsSync(dest), { timeout: 10000 }),
            'blank p8mod written to stubbed dest');
        const content = fs.readFileSync(dest, 'utf-8');
        assert.ok(content.includes('__lua__'), 'blank p8mod has a __lua__ section');
        assert.ok(await waitFor(p8EditorTabOpen, { timeout: 15000 }),
            'blank p8mod opened in the p8Editor');
    });

    test('A8.2 showI18nDemo writes an i18n demo p8mod containing __i18n__', async function () {
        this.timeout(20000);
        const dest = path.join(tmpDir, 'i18n_demo.p8mod');
        await withSaveDialog(dest, async () => {
            await vscode.commands.executeCommand('pico8ide.showI18nDemo');
        });

        assert.ok(await waitFor(() => fs.existsSync(dest), { timeout: 10000 }),
            'i18n demo p8mod written');
        const content = fs.readFileSync(dest, 'utf-8');
        assert.ok(content.includes('__i18n__'), 'demo p8mod carries an __i18n__ section');
        assert.ok(await waitFor(p8EditorTabOpen, { timeout: 15000 }),
            'i18n demo opened in the p8Editor');
    });

    test('A8.3 openWithP8IDE(.p8 uri) converts to temp p8mod and opens a custom editor', async function () {
        this.timeout(20000);
        assert.ok(fs.existsSync(P8_PROBE), 'the .p8 probe fixture exists');
        // openWithP8IDE writes into globalStorage/temp_p8mod itself (no dialog),
        // so no stub is needed — it just needs a real uri arg.
        await vscode.commands.executeCommand('pico8ide.openWithP8IDE', vscode.Uri.file(P8_PROBE));
        assert.ok(await waitFor(p8EditorTabOpen, { timeout: 15000 }),
            'openWithP8IDE opened the converted cart in the p8Editor');
    });

    test('A8.4 useTextEditorForP8 sets the *.p8 editor association to default', async function () {
        this.timeout(15000);
        // showInformationMessage with an action button BLOCKS awaiting a click and
        // does not auto-cancel headless, so the command would never resolve. Stub
        // it to return undefined (as a cancelled toast would) so the Undo branch is
        // skipped and the association persists — which is what we assert, then we
        // restore it here to keep global state clean.
        const wb = () => vscode.workspace.getConfiguration('workbench');
        const origInfo = vscode.window.showInformationMessage;
        (vscode.window as any).showInformationMessage = async () => undefined;
        try {
            await vscode.commands.executeCommand('pico8ide.useTextEditorForP8');
            const assoc = await waitFor(() => {
                const a = wb().get<Record<string, string>>('editorAssociations') || {};
                return a['*.p8'] === 'default';
            }, { timeout: 5000 });
            assert.ok(assoc, "workbench.editorAssociations['*.p8'] === 'default'");
        } finally {
            (vscode.window as any).showInformationMessage = origInfo;
            const updated: Record<string, string> = {
                ...wb().get<Record<string, string>>('editorAssociations'),
            };
            delete updated['*.p8'];
            await wb().update('editorAssociations', updated, vscode.ConfigurationTarget.Global);
        }
    });

    test('A8.5 installAgentSkills copies the bundled p8mod-author skill into the workspace', async function () {
        this.timeout(15000);
        const ws = vscode.workspace.workspaceFolders?.[0];
        assert.ok(ws, 'a workspace is open (the runner opens tests/e2e/workspace)');
        const wsRoot = ws!.uri.fsPath;

        // Track what we create so teardown-in-test can leave the repo workspace clean.
        const created = [
            path.join(wsRoot, '.pico8ide-skills'),
            path.join(wsRoot, '.codex'),
            path.join(wsRoot, '.claude'),
            path.join(wsRoot, '.github'),
        ];
        const skillTarget = path.join(wsRoot, '.pico8ide-skills', 'p8mod-author');

        try {
            await vscode.commands.executeCommand('pico8ide.installAgentSkills');
            // The bundled resource exists (verified in tree), so the copy should land.
            const landed = await waitFor(() => fs.existsSync(skillTarget), { timeout: 8000 });
            assert.ok(landed, '.pico8ide-skills/p8mod-author appeared in the workspace');
            assert.ok(fs.existsSync(path.join(skillTarget, 'SKILL.md')),
                'the copied skill carries its SKILL.md');
        } finally {
            for (const dir of created) {
                try {
                    fs.rmSync(dir, { recursive: true, force: true });
                } catch {
                    /* best effort */
                }
            }
        }
    });
});
