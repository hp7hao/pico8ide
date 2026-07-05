import { defineConfig } from '@vscode/test-cli';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tier A extension-host E2E (see docs/E2E_TEST_PLAN.md §5). Compiled suites live
// under out/e2e; the fixture workspace keeps the window empty-but-trusted.
export default defineConfig({
    files: 'out/e2e/suite/**/*.test.js',
    workspaceFolder: path.join(__dirname, 'tests/e2e/workspace'),
    mocha: {
        ui: 'tdd',
        timeout: 60000,
    },
    launchArgs: [
        '--disable-extensions',
        '--disable-workspace-trust',
        ...(process.env.P8IDE_TEST_UDD ? ['--user-data-dir', process.env.P8IDE_TEST_UDD] : []),
    ],
});
