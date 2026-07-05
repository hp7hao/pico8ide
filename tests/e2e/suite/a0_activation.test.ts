import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { activateExtension, configureLocalMode } from '../helpers';

// A0 — Activation & registration (docs/E2E_TEST_PLAN.md §5).
suite('A0: activation & registration', () => {
    suiteSetup(async () => {
        await configureLocalMode();
        await activateExtension();
    });

    test('A0.1 extension activates without throwing', async () => {
        const ext = vscode.extensions.getExtension('hp7hao.pico8ide');
        assert.ok(ext, 'extension present');
        assert.strictEqual(ext!.isActive, true, 'extension active');
    });

    test('A0.3 all contributed commands are registered', async () => {
        const all = await vscode.commands.getCommands(true);
        const expected = [
            'pico8ide.search',
            'pico8ide.openCart',
            'pico8ide.refreshEntry',
            'pico8ide.setPico8Path',
            'pico8ide.runGame',
            'pico8ide.stopGame',
            'pico8ide.forkGame',
            'pico8ide.openWithP8IDE',
            'pico8ide.useTextEditorForP8',
            'pico8ide.newP8Mod',
            'pico8ide.showI18nDemo',
            'pico8ide.installAgentSkills',
        ];
        for (const id of expected) {
            assert.ok(all.includes(id), `command registered: ${id}`);
        }
    });

    test('A0.4 tree view container and view are contributed', () => {
        const ext = vscode.extensions.getExtension('hp7hao.pico8ide')!;
        const contributes = ext.packageJSON.contributes;
        const views = contributes.views['pico8-explorer'].map((v: any) => v.id);
        assert.ok(views.includes('pico8Lists'), 'pico8Lists view contributed');
        assert.ok(views.includes('pico8GameDetail'), 'pico8GameDetail view contributed');
    });

    test('A0.5 both custom editors are registered', () => {
        const ext = vscode.extensions.getExtension('hp7hao.pico8ide')!;
        const editors = ext.packageJSON.contributes.customEditors.map((e: any) => e.viewType);
        assert.ok(editors.includes('pico8ide.pngViewer'), 'pngViewer registered');
        assert.ok(editors.includes('pico8ide.p8Editor'), 'p8Editor registered');
    });
});
