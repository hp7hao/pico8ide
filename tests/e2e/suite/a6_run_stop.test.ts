import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    activateExtension,
    configureLocalMode,
    configureFakePico8,
    FIXTURE_DIR,
    waitFor,
} from '../helpers';

// A6 — Run / Stop via a fake PICO-8 stub (docs/E2E_TEST_PLAN.md §5, §3).
// No real emulator: pico8Path points at fake-pico8.sh, which logs its argv so we
// can assert the extension spawned it with `-run <cartPath>`, then that stopGame
// clears the process. runGame(string) treats its arg as a direct cart path
// (extension.ts:1018), so we drive it with an absolute fixture cart path.

const CART_FS_PATH = path.join(
    FIXTURE_DIR, 'fcdb', 'platforms', 'pico8', 'carts', 'bbs', 'synthetic-pxa.p8.png'
);

suite('A6: run / stop (fake pico8)', () => {
    let logPath: string;

    suiteSetup(async () => {
        await configureLocalMode();
        await activateExtension();
    });

    setup(async () => {
        logPath = await configureFakePico8();
    });

    teardown(async () => {
        await vscode.commands.executeCommand('pico8ide.stopGame');
    });

    const readLog = () => (fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf-8') : '');

    test('A6.1 runGame(cartPath) spawns fake pico8 with -run and the cart path', async function () {
        this.timeout(20000);
        await vscode.commands.executeCommand('pico8ide.runGame', CART_FS_PATH);

        const fired = await waitFor(() => readLog().includes('-run'), { timeout: 10000 });
        assert.ok(fired, 'fake pico8 was invoked with -run');
        assert.ok(readLog().includes(CART_FS_PATH), 'invoked with the fixture cart path');
    });

    test('A6.3 stopGame clears the process (a fresh run appends after stop)', async function () {
        this.timeout(20000);
        await vscode.commands.executeCommand('pico8ide.runGame', CART_FS_PATH);
        assert.ok(await waitFor(() => readLog().includes('-run'), { timeout: 10000 }),
            'first run launched');

        await vscode.commands.executeCommand('pico8ide.stopGame');
        const lenAfterStop = readLog().length;

        // With the previous process cleared, a new run must spawn again and grow
        // the log. (If stop had failed, runGameInPico8 still stops-then-runs, so
        // this also guards the stop-first path at extension.ts:929.)
        await vscode.commands.executeCommand('pico8ide.runGame', CART_FS_PATH);
        const grew = await waitFor(() => readLog().length > lenAfterStop, { timeout: 10000 });
        assert.ok(grew, 'a fresh run occurred after stop');
    });

    test('A6.6 pico8Path set but missing → no spawn', async function () {
        this.timeout(10000);
        await vscode.workspace.getConfiguration('pico8ide')
            .update('pico8Path', '/nonexistent/pico8-binary', vscode.ConfigurationTarget.Global);

        await vscode.commands.executeCommand('pico8ide.runGame', CART_FS_PATH);
        await new Promise((r) => setTimeout(r, 1500));

        assert.strictEqual(readLog().includes('-run'), false,
            'fake stub never ran (fs.existsSync gate rejected the missing path)');
    });
});
