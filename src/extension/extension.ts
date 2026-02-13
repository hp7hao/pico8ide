import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { DataManager, GameMetadata, ListInfo } from './dataManager';
import { t } from './i18n';
import { CartData } from './cartData';
import { Pico8Decoder } from './pngDecoder';
import { cartDataToP8 } from './p8format';
import { Pico8PngEditorProvider, Pico8P8EditorProvider } from './cartEditorProvider';
import { generateCartViewerHtml } from './cartViewerHtml';
import { pico8RunState } from './pico8Runner';

// Webview provider for game detail panel in sidebar
class GameDetailViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'pico8GameDetail';
    private _view?: vscode.WebviewView;
    private _currentGame?: GameMetadata;
    private _thumbnailDataUrl?: string;
    private _cartInfo?: { codeSize: number; label: string };
    private _pendingUpdate?: GameMetadata; // Store pending game if view not ready

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _dataManager: DataManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: false,
            localResourceRoots: [this._extensionUri]
        };

        // Check if there's a pending game update
        if (this._pendingUpdate) {
            const game = this._pendingUpdate;
            this._pendingUpdate = undefined;
            this.updateGame(game);
        } else {
            webviewView.webview.html = this._getEmptyHtml();
        }
    }

    public async updateGame(game: GameMetadata) {
        this._currentGame = game;
        this._thumbnailDataUrl = undefined;
        this._cartInfo = undefined;

        // If view not ready yet, store for later
        if (!this._view) {
            this._pendingUpdate = game;
            return;
        }

        // Show loading state
        this._view.webview.html = this._getGenericHtml(game, true);

        // First, check if we have a cached extracted thumbnail
        const cachedThumb = this._dataManager.loadExtractedThumb(game);
        if (cachedThumb) {
            this._thumbnailDataUrl = cachedThumb;
            if (this._view && this._currentGame === game) {
                this._view.webview.html = this._getGenericHtml(game, false);
            }
            return; // We have the thumbnail, no need to download cart
        }

        // No cached thumbnail - need to download cart (will extract thumbnail when opened)
        // For now, show "No Image" - thumbnail will be extracted when user opens the cart
        if (this._view && this._currentGame === game) {
            this._view.webview.html = this._getGenericHtml(game, false);
        }
    }

    public showListInfo(listInfo: ListInfo) {
        this._currentGame = undefined;
        this._thumbnailDataUrl = undefined;
        this._cartInfo = undefined;

        if (!this._view) return;
        this._view.webview.html = this._getListInfoHtml(listInfo);
    }

    // Called after cart is decoded to show code size and label
    public updateCartInfo(game: GameMetadata, codeSize: number, label: string) {
        if (this._currentGame?.id === game.id) {
            this._cartInfo = { codeSize, label };
            // Use the extracted label as thumbnail
            this._thumbnailDataUrl = label;
            // Save the extracted thumbnail for future use
            this._dataManager.saveExtractedThumb(game, label);
            if (this._view) {
                this._view.webview.html = this._getGenericHtml(game, false);
            }
        }
    }

    private _getListInfoHtml(listInfo: ListInfo) {
        const desc = listInfo.description
            ? `<p style="opacity:0.75; line-height:1.5;">${listInfo.description}</p>`
            : '';
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 16px;
                        margin: 0;
                        font-size: 13px;
                    }
                    h2 { margin: 0 0 8px 0; }
                    .count { opacity: 0.6; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <h2>${listInfo.name}</h2>
                ${desc}
                <div class="count">${listInfo.games.length} games</div>
            </body>
            </html>`;
    }

    private _getEmptyHtml() {
        return `<!DOCTYPE html>
            <html lang="en">
            <body style="padding: 10px; font-family: sans-serif; opacity: 0.7;">
                Click a game in the explorer to view details.
            </body>
            </html>`;
    }

    private _getGenericHtml(game: GameMetadata, loading: boolean, error?: string) {
        const locale = t();
        // Thumbnail with floating metadata overlay on bottom half
        let thumbContent: string;
        if (loading) {
            thumbContent = `<div class="thumb-placeholder">${locale.loading}</div>`;
        } else if (error) {
            thumbContent = `<div class="thumb-placeholder thumb-error">${error}</div>`;
        } else if (this._thumbnailDataUrl) {
            thumbContent = `<img src="${this._thumbnailDataUrl}" class="thumb-img">`;
        } else {
            thumbContent = `<div class="thumb-placeholder">${locale.noImage}</div>`;
        }

        const tags = (game.extension.tags || []).slice(0, 3).map((t: string) =>
            `<span class="tag">${t}</span>`
        ).join('');

        const codeSizeHtml = this._cartInfo ?
            `<div class="code-size">${this._cartInfo.codeSize.toLocaleString()} chars</div>` : '';

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        padding: 0;
                        margin: 0;
                        font-size: 13px;
                    }
                    .thumb-container {
                        position: relative;
                        width: 100%;
                        aspect-ratio: 1;
                        background: #111;
                        overflow: hidden;
                    }
                    .thumb-img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        image-rendering: pixelated;
                        display: block;
                    }
                    .thumb-placeholder {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #222;
                        color: #888;
                    }
                    .thumb-error {
                        background: #422;
                        color: #f88;
                        text-align: center;
                        padding: 10px;
                        font-size: 0.85em;
                    }
                    .meta-overlay {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: linear-gradient(transparent, rgba(0,0,0,0.9));
                        padding: 30px 12px 12px 12px;
                    }
                    .game-title {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #fff;
                        margin: 0 0 4px 0;
                        text-shadow: 1px 1px 2px #000;
                    }
                    .game-author {
                        font-size: 0.85em;
                        color: #ccc;
                        margin-bottom: 6px;
                    }
                    .game-author a { color: #8cf; text-decoration: none; }
                    .stats {
                        display: flex;
                        gap: 10px;
                        font-size: 0.8em;
                        color: #aaa;
                    }
                    .tags {
                        margin-top: 6px;
                    }
                    .tag {
                        display: inline-block;
                        background: rgba(255,255,255,0.15);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 0.75em;
                        margin-right: 4px;
                        color: #ddd;
                    }
                    .code-size {
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        background: rgba(0,0,0,0.7);
                        color: #0f0;
                        font-family: monospace;
                        font-size: 0.75em;
                        padding: 2px 6px;
                        border-radius: 3px;
                    }
                    .details {
                        padding: 12px;
                    }
                    .desc {
                        white-space: pre-wrap;
                        line-height: 1.4;
                        font-size: 0.9em;
                        opacity: 0.85;
                        max-height: 100px;
                        overflow-y: auto;
                    }
                </style>
            </head>
            <body>
                <div class="thumb-container">
                    ${thumbContent}
                    ${codeSizeHtml}
                    <div class="meta-overlay">
                        <div class="game-title">${game.name}</div>
                        <div class="game-author">by <a href="${game.author?.url || '#'}">${game.author?.name || 'Unknown'}</a></div>
                        <div class="stats">
                            <span>❤️ ${game.extension?.likes || 0}</span>
                        </div>
                        ${tags ? `<div class="tags">${tags}</div>` : ''}
                    </div>
                </div>
                <div class="details">
                    <div class="desc">${game.description || 'No description available.'}</div>
                </div>
            </body>
            </html>`;
    }
}

// Hierarchical Tree Data Provider: Lists as folders, Games as children
type ListTreeItem = ListGroupItem | ListGameItem;

class Pico8ListsProvider implements vscode.TreeDataProvider<ListTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ListTreeItem | undefined | null | void> = new vscode.EventEmitter<ListTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ListTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private lists: ListInfo[] = [];
    private allGames: GameMetadata[] = [];
    private filter: string = '';

    constructor(private dataManager: DataManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async load() {
        this.allGames = await this.dataManager.getGames();
        this.lists = await this.dataManager.getLists();
        this.filter = '';
        this.refresh();
    }

    setFilter(query: string) {
        this.filter = query.toLowerCase();
        this.refresh();
    }

    getTreeItem(element: ListTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ListTreeItem): vscode.ProviderResult<ListTreeItem[]> {
        if (!element) {
            // Root level: show list groups + "BBS Released" for all games
            const groups: ListGroupItem[] = [];
            for (const list of this.lists) {
                groups.push(new ListGroupItem(list));
            }
            if (this.allGames.length > 0) {
                groups.push(new ListGroupItem({
                    name: 'BBS Released',
                    order: 999,
                    filename: '__all__',
                    games: this.allGames
                }));
            }
            return groups;
        }
        if (element instanceof ListGroupItem) {
            let games = element.listInfo.games;
            if (this.filter) {
                games = games.filter(g =>
                    g.name.toLowerCase().includes(this.filter) ||
                    g.author.name.toLowerCase().includes(this.filter) ||
                    g.id.toLowerCase().includes(this.filter)
                );
            }
            return games.map(game => new ListGameItem(game));
        }
        return [];
    }
}

class ListGroupItem extends vscode.TreeItem {
    constructor(public readonly listInfo: ListInfo) {
        super(listInfo.name, vscode.TreeItemCollapsibleState.Collapsed);
        this.tooltip = listInfo.description
            ? `${listInfo.name} - ${listInfo.description} (${listInfo.games.length} games)`
            : `${listInfo.name} (${listInfo.games.length} games)`;
        this.description = listInfo.filename === '__all__' ? '' : `${listInfo.games.length}`;
        this.contextValue = 'listGroup';
        this.command = {
            command: 'pico8ide.selectList',
            title: 'Select List',
            arguments: [this.listInfo]
        };
    }
}

class ListGameItem extends vscode.TreeItem {
    constructor(public readonly game: GameMetadata) {
        super(game.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${game.name} by ${game.author.name}`;
        this.description = game.author.name;
        this.contextValue = 'gameItem';
        this.command = {
            command: 'pico8ide.selectGame',
            title: 'Select Game',
            arguments: [this.game]
        };
    }
}

// Custom Editor / Webview Panel for Cart
class Pico8CartPanel {
    public static readonly viewType = 'pico8Cart';
    private static _previewPanel: Pico8CartPanel | undefined;
    private static _pinnedPanels: Map<string, Pico8CartPanel> = new Map();
    private static _lastActivePanel: Pico8CartPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _game: GameMetadata;
    private _pinned = false;
    private _lastTabActivateTime = 0;
    private static _runningProcess: ChildProcess | undefined;
    private static _onRunRequest: ((game: GameMetadata) => void) | undefined;
    private static _onStopRequest: (() => void) | undefined;
    private static _onPanelActivated: ((game: GameMetadata) => void) | undefined;

    public static get currentGame(): GameMetadata | undefined {
        return Pico8CartPanel._lastActivePanel?._game;
    }

    public static setOnPanelActivated(handler: (game: GameMetadata) => void) {
        Pico8CartPanel._onPanelActivated = handler;
    }

    /** Check if a panel (preview or pinned) already has this game loaded */
    public static hasGame(gameId: string): boolean {
        if (Pico8CartPanel._previewPanel?._game.id === gameId) {
            return true;
        }
        return Pico8CartPanel._pinnedPanels.has(gameId);
    }

    /** Reveal an already-open panel for this game */
    public static revealGame(gameId: string): void {
        const pinned = Pico8CartPanel._pinnedPanels.get(gameId);
        if (pinned) {
            pinned._panel.reveal();
            return;
        }
        if (Pico8CartPanel._previewPanel?._game.id === gameId) {
            Pico8CartPanel._previewPanel._panel.reveal();
        }
    }

    /** Pin the current preview panel (or a pinned panel that's already pinned is a no-op) */
    public static pinCurrent(): void {
        const preview = Pico8CartPanel._previewPanel;
        if (!preview || preview._pinned) {
            return;
        }
        preview._pinned = true;
        preview._panel.title = `Cart: ${preview._game.name}`;
        Pico8CartPanel._pinnedPanels.set(preview._game.id, preview);
        Pico8CartPanel._previewPanel = undefined;
    }

    public static setRunHandler(handler: (game: GameMetadata) => void) {
        Pico8CartPanel._onRunRequest = handler;
    }

    public static setStopHandler(handler: () => void) {
        Pico8CartPanel._onStopRequest = handler;
    }

    public static setRunningProcess(proc: ChildProcess | undefined) {
        Pico8CartPanel._runningProcess = proc;
        Pico8CartPanel._lastActivePanel?.postRunState(!!proc);
        pico8RunState.set(!!proc);
    }

    public static getRunningProcess(): ChildProcess | undefined {
        return Pico8CartPanel._runningProcess;
    }

    // Create or reuse panel, show loading state initially
    public static createWithLoading(extensionUri: vscode.Uri, game: GameMetadata): Pico8CartPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If a pinned panel for this game exists, just reveal it
        const pinned = Pico8CartPanel._pinnedPanels.get(game.id);
        if (pinned) {
            pinned._panel.reveal(column);
            return pinned;
        }

        // If the preview panel already has this game, reveal it
        if (Pico8CartPanel._previewPanel && Pico8CartPanel._previewPanel._game.id === game.id) {
            Pico8CartPanel._previewPanel._panel.reveal(column);
            return Pico8CartPanel._previewPanel;
        }

        // Close old preview panel (pinned panels stay)
        if (Pico8CartPanel._previewPanel) {
            Pico8CartPanel._previewPanel.dispose();
        }

        const panel = vscode.window.createWebviewPanel(
            Pico8CartPanel.viewType,
            `*Cart: ${game.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri, vscode.Uri.joinPath(extensionUri, 'resources', 'monaco')]
            }
        );

        const cartPanel = new Pico8CartPanel(panel, extensionUri, game);
        Pico8CartPanel._previewPanel = cartPanel;
        Pico8CartPanel._lastActivePanel = cartPanel;
        return cartPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri,
        game: GameMetadata
    ) {
        this._panel = panel;
        this._game = game;

        // Show loading state
        this._panel.webview.html = this._getLoadingHtml(game, "Downloading cartridge...");

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Track which panel is active and notify extension
        // Also detect double-click on tab to pin the panel
        this._panel.onDidChangeViewState(() => {
            if (this._panel.active) {
                Pico8CartPanel._lastActivePanel = this;
                if (Pico8CartPanel._onPanelActivated) {
                    Pico8CartPanel._onPanelActivated(this._game);
                }
                // Double-click detection: if tab activated again within 300ms, pin
                const now = Date.now();
                if (!this._pinned && now - this._lastTabActivateTime < 300) {
                    Pico8CartPanel.pinCurrent();
                }
                this._lastTabActivateTime = now;
            }
        }, null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message: { type: string }) => {
                if (message.type === 'run' && Pico8CartPanel._onRunRequest) {
                    Pico8CartPanel._onRunRequest(this._game);
                } else if (message.type === 'stop' && Pico8CartPanel._onStopRequest) {
                    Pico8CartPanel._onStopRequest();
                }
            },
            null,
            this._disposables
        );
    }

    public postRunState(running: boolean) {
        this._panel.webview.postMessage({ type: 'runState', running });
    }

    public updateProgress(message: string) {
        this._panel.webview.html = this._getLoadingHtml(this._game, message);
    }

    public showError(error: string) {
        this._panel.webview.html = this._getErrorHtml(this._game, error);
    }

    public showCart(cartData: CartData) {
        this._panel.webview.html = this._getCartHtml(this._game, cartData);
    }

    public dispose() {
        // Remove from tracking
        if (Pico8CartPanel._previewPanel === this) {
            Pico8CartPanel._previewPanel = undefined;
        }
        if (this._pinned) {
            Pico8CartPanel._pinnedPanels.delete(this._game.id);
        }
        if (Pico8CartPanel._lastActivePanel === this) {
            Pico8CartPanel._lastActivePanel = undefined;
        }
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getLoadingHtml(game: GameMetadata, message: string) {
        const locale = t();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .loader { text-align: center; }
                    .spinner { border: 4px solid #333; border-top: 4px solid #ff004d; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    h2 { color: #fff; margin-bottom: 10px; }
                    p { color: #888; }
                </style>
            </head>
            <body>
                <div class="loader">
                    <div class="spinner"></div>
                    <h2>${game.name}</h2>
                    <p>${message}</p>
                </div>
            </body>
            </html>`;
    }

    private _getErrorHtml(game: GameMetadata, error: string) {
        const locale = t();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .error { text-align: center; max-width: 600px; padding: 20px; }
                    h2 { color: #ff004d; margin-bottom: 10px; }
                    p { color: #888; word-break: break-word; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>${locale.error}: ${game.name}</h2>
                    <p>${error}</p>
                </div>
            </body>
            </html>`;
    }

    private _getCartHtml(game: GameMetadata, cartData: CartData) {
        const locale = t();
        return generateCartViewerHtml({
            cartData,
            locale,
            extensionUri: this.extensionUri,
            webview: this._panel.webview,
            gameName: game.name,
            showRunButton: true,
            showAudio: true,
            editable: false
        });
    }
}

function showDisclaimer(context: vscode.ExtensionContext) {
    const locale = t();
    const panel = vscode.window.createWebviewPanel(
        'pico8ideDisclaimer',
        'PICO-8 IDE - ' + locale.disclaimerImportant,
        vscode.ViewColumn.One,
        { enableScripts: false }
    );

    panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PICO-8 IDE Disclaimer</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 700px;
                margin: 40px auto;
                padding: 20px;
                line-height: 1.6;
                color: #e0e0e0;
                background: #1a1a2e;
            }
            h1 {
                color: #ff77a8;
                border-bottom: 2px solid #ff77a8;
                padding-bottom: 10px;
            }
            h2 {
                color: #29adff;
                margin-top: 30px;
            }
            .disclaimer-box {
                background: #2a2a4a;
                border-left: 4px solid #ffec27;
                padding: 15px 20px;
                margin: 20px 0;
                border-radius: 0 8px 8px 0;
            }
            a {
                color: #29adff;
            }
            ul {
                padding-left: 20px;
            }
            li {
                margin: 8px 0;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #333;
                font-size: 0.9em;
                color: #888;
            }
        </style>
    </head>
    <body>
        <h1>${locale.disclaimerTitle}</h1>

        <div class="disclaimer-box">
            <strong>${locale.disclaimerImportant}</strong>
            <p>${locale.disclaimerHobbyProject}</p>
            <p>${locale.disclaimerNotForSale}</p>
        </div>

        <h2>${locale.disclaimerAboutTitle}</h2>
        <p>${locale.disclaimerAboutText}</p>
        <p>${locale.disclaimerPaidSoftware}</p>
        <p>
            <a href="${locale.disclaimerVisitWebsite}">${locale.disclaimerVisitWebsite}</a>
        </p>

        <h2>${locale.disclaimerFeaturesTitle}</h2>
        <ul>
            <li>${locale.disclaimerFeature1}</li>
            <li>${locale.disclaimerFeature2}</li>
            <li>${locale.disclaimerFeature3}</li>
            <li>${locale.disclaimerFeature4}</li>
        </ul>

        <div class="footer">
            <p>${locale.disclaimerFooter1}</p>
            <p>${locale.disclaimerFooter2}</p>
        </div>
    </body>
    </html>`;
}


export function activate(context: vscode.ExtensionContext) {
    // Show disclaimer on every activation
    showDisclaimer(context);

    const locale = t();
    const dataManager = new DataManager(context);
    dataManager.initialize();

    const listsProvider = new Pico8ListsProvider(dataManager);
    const detailProvider = new GameDetailViewProvider(context.extensionUri, dataManager);

    // Set callback to refresh game list when database is updated
    dataManager.setUpdateCallback(() => {
        vscode.window.showInformationMessage(locale.databaseUpdated);
        listsProvider.load();
    });

    const listsTreeView = vscode.window.createTreeView('pico8Lists', { treeDataProvider: listsProvider });
    listsTreeView.onDidExpandElement(e => {
        if (e.element instanceof ListGroupItem) {
            detailProvider.showListInfo(e.element.listInfo);
        }
    });
    listsTreeView.onDidCollapseElement(e => {
        if (e.element instanceof ListGroupItem) {
            detailProvider.showListInfo(e.element.listInfo);
        }
    });

    // Webview View for Details
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(GameDetailViewProvider.viewType, detailProvider)
    );

    // Custom Editor for .p8.png files
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            Pico8PngEditorProvider.viewType,
            new Pico8PngEditorProvider(context),
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // Custom Editor for .p8 files
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            Pico8P8EditorProvider.viewType,
            new Pico8P8EditorProvider(context),
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // Refresh Command
    vscode.commands.registerCommand('pico8ide.refreshEntry', () => listsProvider.load());

    // Filter Command
    vscode.commands.registerCommand('pico8ide.search', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: locale.searchPlaceholder,
            prompt: locale.searchPrompt
        });
        if (query !== undefined) {
             listsProvider.setFilter(query);
        }
    });

    // Select List - updates detail panel with list info
    vscode.commands.registerCommand('pico8ide.selectList', (listInfo: ListInfo) => {
        detailProvider.showListInfo(listInfo);
    });

    // Select Game - updates detail panel and opens cart view
    // Double-click detection: if same game clicked again within 300ms, pins the panel
    let currentSelectedGame: GameMetadata | undefined;
    let lastSelectedGameId: string | undefined;
    let lastSelectedTime = 0;
    const DOUBLE_CLICK_MS = 300;

    // When a cart panel tab becomes active, sync the detail sidebar
    Pico8CartPanel.setOnPanelActivated((game: GameMetadata) => {
        currentSelectedGame = game;
        detailProvider.updateGame(game);
    });

    vscode.commands.registerCommand('pico8ide.selectGame', async (game: GameMetadata) => {
        const now = Date.now();
        const isDoubleClick = game.id === lastSelectedGameId && (now - lastSelectedTime) < DOUBLE_CLICK_MS;
        lastSelectedGameId = game.id;
        lastSelectedTime = now;

        currentSelectedGame = game;
        // Update detail panel (this will download thumbnail in background)
        detailProvider.updateGame(game);

        if (isDoubleClick) {
            // Double-click: pin the preview panel
            Pico8CartPanel.pinCurrent();
        } else if (Pico8CartPanel.hasGame(game.id)) {
            // Already open (pinned or preview), just reveal it
            Pico8CartPanel.revealGame(game.id);
        } else {
            // Single click: open as preview
            await vscode.commands.executeCommand('pico8ide.openCart', game);
        }
    });

    // Open Cart (Download & View)
    vscode.commands.registerCommand('pico8ide.openCart', async (gameOrId: GameMetadata | string) => {
        // Resolve argument
        let game: GameMetadata | undefined;
        if (typeof gameOrId === 'string') {
             const games = await dataManager.getGames();
             game = games.find(g => g.id === gameOrId);
        } else {
            game = gameOrId;
        }

        if (!game) {
            vscode.window.showErrorMessage(locale.gameNotFound);
            return;
        }

        // Create panel immediately with loading state
        const panel = Pico8CartPanel.createWithLoading(context.extensionUri, game);

        try {
            panel.updateProgress(locale.downloading);
            const cartPath = await dataManager.getAssetPath(game, 'cart');

            panel.updateProgress(locale.extracting);
            const cartData = await Pico8Decoder.decode(cartPath);

            // Update detail panel with cart info and label
            detailProvider.updateCartInfo(game, cartData.code.length, cartData.label);

            // Show the cart content
            panel.showCart(cartData);
        } catch (e: any) {
            panel.showError(e.message || 'Unknown error');
        }
    });

    // Set PICO-8 Path Command
    vscode.commands.registerCommand('pico8ide.setPico8Path', async () => {
        const result = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: locale.pico8PathSelectPrompt,
            filters: process.platform === 'win32'
                ? { 'Executable': ['exe'] }
                : undefined
        });
        if (result && result[0]) {
            let selectedPath = result[0].fsPath;
            // macOS: if user selects a .app bundle, resolve to inner binary
            if (process.platform === 'darwin' && selectedPath.endsWith('.app')) {
                selectedPath = path.join(selectedPath, 'Contents', 'MacOS', 'pico8');
            }
            await vscode.workspace.getConfiguration('pico8ide').update('pico8Path', selectedPath, vscode.ConfigurationTarget.Global);
        }
    });

    // Run Game in PICO-8 Command
    async function runGameInPico8(gameOrPath: GameMetadata | string) {
        // If already running, stop first
        if (Pico8CartPanel.getRunningProcess()) {
            stopRunningGame();
        }

        const config = vscode.workspace.getConfiguration('pico8ide');
        let pico8Path = config.get<string>('pico8Path') || '';

        if (!pico8Path) {
            const action = await vscode.window.showWarningMessage(
                locale.pico8PathNotSet,
                'Yes', 'No'
            );
            if (action === 'Yes') {
                await vscode.commands.executeCommand('pico8ide.setPico8Path');
                pico8Path = vscode.workspace.getConfiguration('pico8ide').get<string>('pico8Path') || '';
            }
            if (!pico8Path) {
                return;
            }
        }

        if (!fs.existsSync(pico8Path)) {
            vscode.window.showErrorMessage(locale.pico8PathNotFound);
            return;
        }

        try {
            const cartPath = typeof gameOrPath === 'string'
                ? gameOrPath
                : await dataManager.getAssetPath(gameOrPath, 'cart');
            const child = spawn(pico8Path, ['-run', cartPath], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
            Pico8CartPanel.setRunningProcess(child);

            child.on('exit', () => {
                if (Pico8CartPanel.getRunningProcess() === child) {
                    Pico8CartPanel.setRunningProcess(undefined);
                }
            });
        } catch (e: any) {
            vscode.window.showErrorMessage(`${locale.runGameFailed}: ${e.message}`);
        }
    }

    function stopRunningGame() {
        const proc = Pico8CartPanel.getRunningProcess();
        if (proc) {
            try {
                // Kill the process group on unix, or the process on windows
                if (proc.pid) {
                    if (process.platform === 'win32') {
                        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t']);
                    } else {
                        process.kill(-proc.pid, 'SIGTERM');
                    }
                }
            } catch (_) {
                // Process may have already exited
            }
            Pico8CartPanel.setRunningProcess(undefined);
        }
    }

    // Wire up webview run/stop handlers
    Pico8CartPanel.setRunHandler((game) => runGameInPico8(game));
    Pico8CartPanel.setStopHandler(() => stopRunningGame());

    vscode.commands.registerCommand('pico8ide.runGame', async (itemOrPath?: ListGameItem | string) => {
        // Accept a direct file path from custom editors
        if (typeof itemOrPath === 'string') {
            await runGameInPico8(itemOrPath);
            return;
        }
        const game = itemOrPath?.game ?? currentSelectedGame ?? Pico8CartPanel.currentGame;
        if (game) {
            await runGameInPico8(game);
            return;
        }
        // Fallback: check active text editor for .p8 file
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.p8')) {
            await runGameInPico8(activeEditor.document.uri.fsPath);
            return;
        }
        // Fallback: check active tab for .p8.png custom editor
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        if (activeTab?.input && typeof (activeTab.input as any).uri?.fsPath === 'string') {
            const fsPath: string = (activeTab.input as any).uri.fsPath;
            if (fsPath.endsWith('.p8.png')) {
                await runGameInPico8(fsPath);
                return;
            }
        }
    });

    // Stop Game Command
    vscode.commands.registerCommand('pico8ide.stopGame', () => {
        stopRunningGame();
    });

    // Fork Game command - copy database game into workspace as .p8
    vscode.commands.registerCommand('pico8ide.forkGame', async (item?: ListGameItem) => {
        const locale = t();
        const game = item?.game ?? currentSelectedGame;
        if (!game) {
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(locale.forkNoWorkspace);
            return;
        }

        try {
            const cartPath = await dataManager.getAssetPath(game, 'cart');
            const cartData = await Pico8Decoder.decode(cartPath);
            const p8Content = cartDataToP8(cartData);

            // Sanitize game name for filename
            const safeName = game.name.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_').substring(0, 64);
            const destPath = path.join(workspaceFolders[0].uri.fsPath, `${safeName}.p8`);

            fs.writeFileSync(destPath, p8Content, 'utf-8');
            vscode.window.showInformationMessage(locale.forkSuccess);
            const destUri = vscode.Uri.file(destPath);
            await vscode.commands.executeCommand('vscode.openWith', destUri, Pico8P8EditorProvider.viewType);
        } catch (e: any) {
            vscode.window.showErrorMessage(`${locale.error}: ${e.message}`);
        }
    });

    // Preview .p8 Cart command - open .p8 file in the cart editor
    vscode.commands.registerCommand('pico8ide.previewP8Cart', async (uri?: vscode.Uri) => {
        if (!uri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.fileName.endsWith('.p8')) {
                uri = activeEditor.document.uri;
            }
        }
        if (!uri) {
            return;
        }

        await vscode.commands.executeCommand('vscode.openWith', uri, Pico8P8EditorProvider.viewType);
    });

    // Initial Load
    listsProvider.load();
}

