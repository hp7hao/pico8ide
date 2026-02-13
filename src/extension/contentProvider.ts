import * as vscode from 'vscode';
import { Pico8Decoder } from './decoder';

export class Pico8ContentProvider implements vscode.TextDocumentContentProvider {
    public static readonly scheme = 'pico8';

    // Event emitter for document changes (not needed for read-only static extraction, but good practice)
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // The URI path is the absolute path to the .p8.png file
        // e.g. pico8:/path/to/cart.p8.png
        const fsPath = uri.fsPath; // or uri.path?

        try {
            // Check file existence
            // Note: simple fsPath might work or need correction depending on system
            return await Pico8Decoder.decode(fsPath);
        } catch (error: any) {
            return `-- Error decoding cartridge: ${error.message}`;
        }
    }
}
