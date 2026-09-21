#!/usr/bin/env node
import * as path from 'path';
import { exportP8Mod, parseP8ModExportArgs, usage } from './p8modExporter';
import { initP8modKernel } from './p8modKernel';

export async function runP8ModToolCli(argv: string[]): Promise<number> {
    try {
        await initP8modKernel();
        const options = parseP8ModExportArgs(argv);
        if (!options.extensionPath) {
            options.extensionPath = path.resolve(__dirname, '..', '..');
        }
        const result = await exportP8Mod(options);
        for (const output of result.outputs) {
            process.stdout.write(`${output}\n`);
        }
        return 0;
    } catch (error: any) {
        const message = error?.message || String(error);
        process.stderr.write(`${message}\n`);
        if (message === usage()) {
            return 0;
        }
        return 1;
    }
}

if (require.main === module) {
    runP8ModToolCli(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    });
}
