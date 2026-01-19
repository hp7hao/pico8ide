"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pico8ContentProvider = void 0;
const vscode = require("vscode");
const decoder_1 = require("./decoder");
class Pico8ContentProvider {
    constructor() {
        // Event emitter for document changes (not needed for read-only static extraction, but good practice)
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }
    async provideTextDocumentContent(uri) {
        // The URI path is the absolute path to the .p8.png file
        // e.g. pico8:/path/to/cart.p8.png
        const fsPath = uri.fsPath; // or uri.path?
        try {
            // Check file existence
            // Note: simple fsPath might work or need correction depending on system
            return await decoder_1.Pico8Decoder.decode(fsPath);
        }
        catch (error) {
            return `-- Error decoding cartridge: ${error.message}`;
        }
    }
}
exports.Pico8ContentProvider = Pico8ContentProvider;
Pico8ContentProvider.scheme = 'pico8';
//# sourceMappingURL=contentProvider.js.map