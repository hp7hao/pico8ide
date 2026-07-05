import * as vscode from 'vscode';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

// Absolute paths to committed fixtures. __dirname at runtime is out/e2e; the
// fixtures live in the source tree, so walk back to the project root.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const FIXTURE_DIR = path.join(PROJECT_ROOT, 'tests', 'e2e', 'fixtures');
export const FCDB_DIST = path.join(FIXTURE_DIR, 'fcdb', 'dist', 'pico8');
export const FAKE_PICO8 = path.join(FIXTURE_DIR, 'fake-pico8.sh');

export const EXTENSION_ID = 'hp7hao.pico8ide';

/** Configure the extension for hermetic local-mode E2E (no network). */
export async function configureLocalMode(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('pico8ide');
    await cfg.update('dataMode', 'local', vscode.ConfigurationTarget.Global);
    await cfg.update('localPath', FCDB_DIST, vscode.ConfigurationTarget.Global);
}

/** Point pico8Path at the fake stub and return a fresh log path to assert against. */
export async function configureFakePico8(): Promise<string> {
    const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'p8ide-e2e-')), 'run.log');
    process.env.PICO8_FAKE_LOG = logPath;
    const cfg = vscode.workspace.getConfiguration('pico8ide');
    await cfg.update('pico8Path', FAKE_PICO8, vscode.ConfigurationTarget.Global);
    return logPath;
}

export async function activateExtension(): Promise<vscode.Extension<any>> {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    if (!ext) {
        throw new Error(`Extension ${EXTENSION_ID} not found`);
    }
    if (!ext.isActive) {
        await ext.activate();
    }
    return ext;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Poll until predicate is true or timeout elapses. */
export async function waitFor(
    predicate: () => boolean | Promise<boolean>,
    { timeout = 5000, interval = 100 } = {}
): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await predicate()) {
            return true;
        }
        await sleep(interval);
    }
    return false;
}
