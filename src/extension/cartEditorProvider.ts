import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CartData } from './cartData';
import { MetaData } from './cartData';
import { Pico8Decoder } from './pngDecoder';
import { Pico8Encoder } from './pngDecoder';
import { cartDataToP8, p8ToCartData } from './p8format';
import { t } from './i18n';
import { generateCartViewerHtml } from './cartViewerHtml';
import { pico8RunState } from './pico8Runner';

interface Pico8Document extends vscode.CustomDocument {
    uri: vscode.Uri;
    cartData: CartData | null;
    currentCode: string | null;
    i18nData: object | null;
    metaData: MetaData | null;
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

function exportSingleCart(
    document: Pico8Document,
    message: any,
    context: vscode.ExtensionContext
): string {
    if (!document.cartData) {
        throw new Error('No cart data');
    }
    const variant: string = message.variant || 'base';
    const glyphs: { [char: string]: number[] } = message.glyphs || {};

    // Determine final code
    let finalCode = document.currentCode ?? document.cartData.code;
    if (variant !== 'base' && message.i18nLuaCode) {
        finalCode = message.i18nLuaCode + '\n' + finalCode;
    }

    // Assemble RAM (uses LZSS compression automatically for large code)
    const ram = Pico8Encoder.assembleRAM(document.cartData, finalCode);

    // Determine title/author for cover
    const meta = document.metaData?.meta;
    let coverTitle = meta?.title || '';
    let coverAuthor = meta?.author || '';
    if (variant !== 'base' && message.localeMeta) {
        coverTitle = message.localeMeta.title || coverTitle;
        coverAuthor = message.localeMeta.author || coverAuthor;
    }

    // Generate cover PNG
    const templateName = meta?.template || 'default';
    const templatePath = path.join(context.extensionPath, 'resources', 'cart_templates', `${templateName}.png`);
    const coverPng = Pico8Encoder.generateCover(
        templatePath,
        document.cartData.label,
        coverTitle,
        coverAuthor,
        glyphs
    );

    // Steganography encode
    const finalPngBuf = Pico8Encoder.encodeSteg(coverPng, ram);

    // Determine output path
    const cartDir = path.dirname(document.uri.fsPath);
    const baseName = path.basename(document.uri.fsPath).replace(/\.(p8|p8\.png)$/i, '');
    let outName: string;
    if (variant === 'base') {
        outName = `${baseName}.p8.png`;
    } else {
        outName = `${baseName}.${variant}.p8.png`;
    }
    const outPath = path.join(cartDir, outName);
    fs.writeFileSync(outPath, finalPngBuf);

    return outName;
}

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

function generateTemplatePreviews(context: vscode.ExtensionContext): { [name: string]: string } {
    const templatesDir = path.join(context.extensionPath, 'resources', 'cart_templates');
    const previews: { [name: string]: string } = {};
    const templateNames = ['default', 'cyan', 'e-zombie', 'e-zombie16'];
    for (const name of templateNames) {
        const filePath = path.join(templatesDir, `${name}.png`);
        try {
            if (fs.existsSync(filePath)) {
                const buf = fs.readFileSync(filePath);
                previews[name] = `data:image/png;base64,${buf.toString('base64')}`;
            }
        } catch {
            // Skip missing templates
        }
    }
    return previews;
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
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'monaco'),
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts'),
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'cart_templates')
        ]
    };

    const templatePreviews = generateTemplatePreviews(context);

    webviewPanel.webview.onDidReceiveMessage(async (message: any) => {
        if (message.type === 'run') {
            // Save current state to .p8, then launch via shared command
            if (document.cartData) {
                const p8Path = document.uri.fsPath.replace(/\.p8\.png$/i, '.p8');
                if (!p8Path.endsWith('.p8')) {
                    // Already a .p8 file
                    saveDocumentAsP8(document, document.uri.fsPath);
                    await vscode.commands.executeCommand('pico8ide.runGame', document.uri.fsPath);
                } else {
                    saveDocumentAsP8(document, p8Path);
                    await vscode.commands.executeCommand('pico8ide.runGame', p8Path);
                }
            }
        }
        if (message.type === 'stop') {
            await vscode.commands.executeCommand('pico8ide.stopGame');
        }
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
            if (message.gfx !== undefined) {
                document.cartData.gfx = message.gfx;
            }
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'sfxChanged' && message.sfx !== undefined && document.cartData) {
            document.cartData.sfx = message.sfx;
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'musicChanged' && message.music !== undefined && document.cartData) {
            document.cartData.music = message.music;
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'metaChanged' && message.metaData !== undefined) {
            document.metaData = message.metaData;
            document.i18nData = message.metaData.i18n;
            // Persist to .meta.json alongside the cart
            const metaPath = document.uri.fsPath.replace(/\.(p8|p8\.png)$/i, '.meta.json');
            try {
                fs.writeFileSync(metaPath, JSON.stringify(message.metaData, null, 4), 'utf-8');
            } catch {
                // Silently ignore write errors
            }
            onDidChange.fire({
                document,
                undo: () => {},
                redo: () => {}
            });
        }
        if (message.type === 'exportCart') {
            try {
                if (!document.cartData) {
                    throw new Error('No cart data');
                }
                const outName = exportSingleCart(document, message, context);

                webviewPanel.webview.postMessage({
                    type: 'exportComplete',
                    path: outName
                });
                vscode.window.showInformationMessage(`${locale.exportSuccess}: ${outName}`);
            } catch (e: any) {
                webviewPanel.webview.postMessage({
                    type: 'exportError',
                    error: e.message || 'Unknown error'
                });
                vscode.window.showErrorMessage(`${locale.exportError}: ${e.message}`);
            }
        }
        if (message.type === 'exportCartBatch') {
            if (!document.cartData) {
                webviewPanel.webview.postMessage({
                    type: 'exportBatchComplete',
                    paths: [],
                    errors: ['No cart data']
                });
                return;
            }
            const results: string[] = [];
            const errors: string[] = [];
            for (const item of message.items) {
                try {
                    const outName = exportSingleCart(document, item, context);
                    results.push(outName);
                } catch (e: any) {
                    errors.push(`${item.variant}: ${e.message}`);
                }
            }
            if (errors.length === 0) {
                webviewPanel.webview.postMessage({ type: 'exportBatchComplete', paths: results });
                vscode.window.showInformationMessage(`${locale.exportSuccess}: ${results.length} files`);
            } else {
                webviewPanel.webview.postMessage({ type: 'exportBatchComplete', paths: results, errors: errors });
                vscode.window.showWarningMessage(`Export: ${results.length} ok, ${errors.length} failed`);
            }
        }
    });

    webviewPanel.webview.html = generateCartViewerHtml({
        cartData: document.cartData!,
        locale,
        extensionUri: context.extensionUri,
        webview: webviewPanel.webview,
        showAudio: true,
        showRunButton: true,
        editable: true,
        i18nData: document.i18nData,
        metaData: document.metaData,
        templatePreviews
    });

    // Subscribe to shared run state so the button updates
    const runStateDisposable = pico8RunState.onChanged((running) => {
        webviewPanel.webview.postMessage({ type: 'runState', running });
    });
    webviewPanel.onDidDispose(() => runStateDisposable.dispose());
}

function saveDocumentAsP8(document: Pico8Document, destPath: string): void {
    if (!document.cartData) { return; }
    const code = document.currentCode ?? document.cartData.code;
    const saveData = { ...document.cartData, code };
    const p8Content = cartDataToP8(saveData);
    fs.writeFileSync(destPath, p8Content, 'utf-8');
}

function loadMetaData(cartPath: string): MetaData | null {
    const metaPath = cartPath.replace(/\.(p8|p8\.png)$/i, '.meta.json');
    const i18nPath = cartPath.replace(/\.(p8|p8\.png)$/i, '.i18n.json');
    // Try .meta.json first
    try {
        if (fs.existsSync(metaPath)) {
            const raw = fs.readFileSync(metaPath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch {
        // Fall through to i18n fallback
    }
    // Fall back to .i18n.json (migration)
    try {
        if (fs.existsSync(i18nPath)) {
            const raw = fs.readFileSync(i18nPath, 'utf-8');
            const i18nData = JSON.parse(raw);
            return {
                meta: { title: '', author: '', template: 'default' },
                i18n: i18nData
            };
        }
    } catch {
        // Ignore parse errors
    }
    return null;
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
        const metaData = loadMetaData(uri.fsPath);
        return {
            uri,
            cartData,
            currentCode: null,
            i18nData: metaData ? metaData.i18n : null,
            metaData,
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
        const metaData = loadMetaData(uri.fsPath);
        return {
            uri,
            cartData,
            currentCode: null,
            i18nData: metaData ? metaData.i18n : null,
            metaData,
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
