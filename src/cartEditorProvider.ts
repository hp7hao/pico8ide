import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CartData } from './cartData';
import { Pico8Decoder } from './pngDecoder';
import { cartDataToP8, p8ToCartData } from './p8format';
import { t } from './i18n';
import { generateCartViewerHtml } from './cartViewerHtml';

interface Pico8Document extends vscode.CustomDocument {
    uri: vscode.Uri;
    cartData: CartData | null;
    currentCode: string | null;
}

// ---- Breadcrumb suppression ----

function suppressBreadcrumbs(webviewPanel: vscode.WebviewPanel): vscode.Disposable {
    const config = vscode.workspace.getConfiguration('breadcrumbs');
    let savedValue: boolean | undefined;

    function hide() {
        savedValue = config.get<boolean>('enabled');
        if (savedValue !== false) {
            config.update('enabled', false, vscode.ConfigurationTarget.Global);
        }
    }

    function restore() {
        if (savedValue !== undefined && savedValue !== false) {
            config.update('enabled', savedValue, vscode.ConfigurationTarget.Global);
        }
    }

    if (webviewPanel.active) {
        hide();
    }

    const listener = webviewPanel.onDidChangeViewState(e => {
        if (e.webviewPanel.active) {
            hide();
        } else {
            restore();
        }
    });

    const disposeListener = webviewPanel.onDidDispose(() => {
        restore();
        listener.dispose();
        disposeListener.dispose();
    });

    return listener;
}

// ---- Shared helpers ----

function getErrorHtml(error: string): string {
    const locale = t();
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .error { text-align: center; max-width: 600px; padding: 20px; }
                h2 { color: #ff004d; }
                p { color: #888; word-break: break-word; }
            </style>
        </head>
        <body>
            <div class="error">
                <h2>${locale.error}</h2>
                <p>${error}</p>
            </div>
        </body>
        </html>`;
}

function setupEditableWebview(
    document: Pico8Document,
    webviewPanel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    onDidChange: vscode.EventEmitter<vscode.CustomDocumentEditEvent<Pico8Document>>
): void {
    const locale = t();

    webviewPanel.webview.options = {
        enableScripts: true,
        localResourceRoots: [
            context.extensionUri,
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'monaco')
        ]
    };

    webviewPanel.webview.onDidReceiveMessage(async (message: { type: string; code?: string; gfx?: number[]; flags?: number[]; map?: number[] }) => {
        if (message.type === 'codeChanged' && message.code !== undefined) {
            document.currentCode = message.code;
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'gfxChanged' && message.gfx !== undefined && document.cartData) {
            document.cartData.gfx = message.gfx;
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'flagsChanged' && message.flags !== undefined && document.cartData) {
            document.cartData.gfxFlags = message.flags;
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'mapChanged' && message.map !== undefined && document.cartData) {
            document.cartData.map = message.map;
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
    });

    webviewPanel.webview.html = generateCartViewerHtml({
        cartData: document.cartData!,
        locale,
        extensionUri: context.extensionUri,
        webview: webviewPanel.webview,
        showAudio: true,
        editable: true
    });
}

function saveDocumentAsP8(document: Pico8Document, destPath: string): void {
    if (!document.cartData) { return; }
    const code = document.currentCode ?? document.cartData.code;
    const saveData = { ...document.cartData, code };
    const p8Content = cartDataToP8(saveData);
    fs.writeFileSync(destPath, p8Content, 'utf-8');
}

function backupDocumentAsP8(document: Pico8Document, backupPath: string): void {
    if (!document.cartData) { return; }
    const code = document.currentCode ?? document.cartData.code;
    const saveData = { ...document.cartData, code };
    const p8Content = cartDataToP8(saveData);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.writeFileSync(backupPath, p8Content, 'utf-8');
}

// ---- .p8.png Custom Editor ----

export class Pico8PngEditorProvider implements vscode.CustomEditorProvider<Pico8Document> {
    public static readonly viewType = 'pico8ide.pngViewer';

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Pico8Document>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<Pico8Document> {
        let cartData: CartData | null = null;
        try {
            cartData = await Pico8Decoder.decode(uri.fsPath);
        } catch {
            // cartData stays null; error shown in resolveCustomEditor
        }
        return {
            uri,
            cartData,
            currentCode: null,
            dispose: () => {}
        };
    }

    async resolveCustomEditor(
        document: Pico8Document,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        suppressBreadcrumbs(webviewPanel);

        const locale = t();
        const filePath = document.uri.fsPath;

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.context.extensionUri,
                vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'monaco')
            ]
        };

        // Check if file is inside the cache (database cart) or workspace
        const cachePath = this.context.globalStorageUri.fsPath;
        const isDatabaseCart = filePath.startsWith(cachePath);

        if (isDatabaseCart) {
            // Database cart: show read-only viewer
            if (!document.cartData) {
                webviewPanel.webview.html = getErrorHtml('Failed to decode cartridge');
                return;
            }
            webviewPanel.webview.html = generateCartViewerHtml({
                cartData: document.cartData,
                locale,
                extensionUri: this.context.extensionUri,
                webview: webviewPanel.webview,
                showAudio: true,
                editable: false
            });
            return;
        }

        // Workspace .p8.png
        if (!document.cartData) {
            webviewPanel.webview.html = getErrorHtml('Failed to decode cartridge');
            return;
        }

        const p8Path = filePath.replace(/\.p8\.png$/i, '.p8');
        const p8Exists = fs.existsSync(p8Path);

        if (p8Exists) {
            // Companion .p8 exists: prompt user to open it in the .p8 editor
            this.showCompanionPrompt(webviewPanel, p8Path);
            return;
        }

        // No companion .p8: prompt user to export or keep .p8.png
        this.showExportPrompt(document, webviewPanel, p8Path);
    }

    private showCompanionPrompt(panel: vscode.WebviewPanel, p8Path: string): void {
        const locale = t();

        panel.webview.onDidReceiveMessage(async (message: { type: string }) => {
            if (message.type === 'openP8') {
                const uri = vscode.Uri.file(p8Path);
                await vscode.commands.executeCommand('vscode.openWith', uri, Pico8P8EditorProvider.viewType);
            }
        });

        panel.webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .prompt { text-align: center; max-width: 500px; padding: 40px; }
                    h2 { color: #fff; margin-bottom: 16px; }
                    p { color: #aaa; margin-bottom: 24px; }
                    button { background: #29adff; border: none; color: #fff; padding: 10px 24px; border-radius: 4px; cursor: pointer;
                             font-family: inherit; font-size: 14px; }
                    button:hover { background: #4dc0ff; }
                </style>
            </head>
            <body>
                <div class="prompt">
                    <h2>${locale.companionExists}</h2>
                    <button onclick="vscodeApi.postMessage({type:'openP8'})">${locale.openP8File}</button>
                </div>
                <script>const vscodeApi = acquireVsCodeApi();</script>
            </body>
            </html>`;
    }

    private showExportPrompt(document: Pico8Document, panel: vscode.WebviewPanel, p8Path: string): void {
        const locale = t();

        panel.webview.onDidReceiveMessage(async (message: { type: string }) => {
            if (message.type === 'exportP8') {
                // Convert and write .p8, then open in .p8 editor
                try {
                    saveDocumentAsP8(document, p8Path);
                    vscode.window.showInformationMessage(locale.convertSuccess);
                    const uri = vscode.Uri.file(p8Path);
                    await vscode.commands.executeCommand('vscode.openWith', uri, Pico8P8EditorProvider.viewType);
                } catch (e: any) {
                    vscode.window.showErrorMessage(`${locale.error}: ${e.message}`);
                }
            } else if (message.type === 'keepPng') {
                // Show the editable webview for .p8.png directly
                setupEditableWebview(document, panel, this.context, this._onDidChangeCustomDocument);
            }
        });

        panel.webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .prompt { text-align: center; max-width: 500px; padding: 40px; }
                    h2 { color: #fff; margin-bottom: 16px; }
                    p { color: #aaa; margin-bottom: 24px; }
                    .buttons { display: flex; gap: 12px; justify-content: center; }
                    button { border: none; color: #fff; padding: 10px 24px; border-radius: 4px; cursor: pointer;
                             font-family: inherit; font-size: 14px; }
                    .btn-primary { background: #29adff; }
                    .btn-primary:hover { background: #4dc0ff; }
                    .btn-secondary { background: #555; }
                    .btn-secondary:hover { background: #777; }
                </style>
            </head>
            <body>
                <div class="prompt">
                    <h2>${locale.exportToP8Prompt}</h2>
                    <div class="buttons">
                        <button class="btn-primary" onclick="vscodeApi.postMessage({type:'exportP8'})">${locale.exportToP8}</button>
                        <button class="btn-secondary" onclick="vscodeApi.postMessage({type:'keepPng'})">${locale.keepP8Png}</button>
                    </div>
                </div>
                <script>const vscodeApi = acquireVsCodeApi();</script>
            </body>
            </html>`;
    }

    async saveCustomDocument(document: Pico8Document, _cancellation: vscode.CancellationToken): Promise<void> {
        if (!document.cartData || document.currentCode === null) {
            return;
        }
        const p8Path = document.uri.fsPath.replace(/\.p8\.png$/i, '.p8');
        saveDocumentAsP8(document, p8Path);
    }

    async saveCustomDocumentAs(document: Pico8Document, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
        saveDocumentAsP8(document, destination.fsPath);
    }

    async revertCustomDocument(document: Pico8Document, _cancellation: vscode.CancellationToken): Promise<void> {
        try {
            document.cartData = await Pico8Decoder.decode(document.uri.fsPath);
            document.currentCode = null;
        } catch {
            // Keep existing data
        }
    }

    async backupCustomDocument(document: Pico8Document, context: vscode.CustomDocumentBackupContext, _cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        const backupPath = context.destination.fsPath;
        backupDocumentAsP8(document, backupPath);
        return {
            id: context.destination.toString(),
            delete: () => {
                try { fs.unlinkSync(backupPath); } catch {}
            }
        };
    }
}

// ---- .p8 Custom Editor ----

export class Pico8P8EditorProvider implements vscode.CustomEditorProvider<Pico8Document> {
    public static readonly viewType = 'pico8ide.p8Editor';

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Pico8Document>>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<Pico8Document> {
        let cartData: CartData | null = null;
        try {
            const text = fs.readFileSync(uri.fsPath, 'utf-8');
            cartData = p8ToCartData(text);
        } catch {
            // cartData stays null; error shown in resolveCustomEditor
        }
        return {
            uri,
            cartData,
            currentCode: null,
            dispose: () => {}
        };
    }

    async resolveCustomEditor(
        document: Pico8Document,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        suppressBreadcrumbs(webviewPanel);

        if (!document.cartData) {
            webviewPanel.webview.html = getErrorHtml('Failed to parse .p8 file');
            return;
        }

        setupEditableWebview(document, webviewPanel, this.context, this._onDidChangeCustomDocument);
    }

    async saveCustomDocument(document: Pico8Document, _cancellation: vscode.CancellationToken): Promise<void> {
        if (!document.cartData) { return; }
        saveDocumentAsP8(document, document.uri.fsPath);
    }

    async saveCustomDocumentAs(document: Pico8Document, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
        saveDocumentAsP8(document, destination.fsPath);
    }

    async revertCustomDocument(document: Pico8Document, _cancellation: vscode.CancellationToken): Promise<void> {
        try {
            const text = fs.readFileSync(document.uri.fsPath, 'utf-8');
            document.cartData = p8ToCartData(text);
            document.currentCode = null;
        } catch {
            // Keep existing data
        }
    }

    async backupCustomDocument(document: Pico8Document, context: vscode.CustomDocumentBackupContext, _cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        const backupPath = context.destination.fsPath;
        backupDocumentAsP8(document, backupPath);
        return {
            id: context.destination.toString(),
            delete: () => {
                try { fs.unlinkSync(backupPath); } catch {}
            }
        };
    }
}
