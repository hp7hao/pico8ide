"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = require("vscode");
const fs = require("fs");
const pngjs_1 = require("pngjs");
const dataManager_1 = require("./dataManager");
// PICO-8 16-color palette
const PICO8_PALETTE = [
    '#000000', // 0 black
    '#1D2B53', // 1 dark-blue
    '#7E2553', // 2 dark-purple
    '#008751', // 3 dark-green
    '#AB5236', // 4 brown
    '#5F574F', // 5 dark-grey
    '#C2C3C7', // 6 light-grey
    '#FFF1E8', // 7 white
    '#FF004D', // 8 red
    '#FFA300', // 9 orange
    '#FFEC27', // 10 yellow
    '#00E436', // 11 green
    '#29ADFF', // 12 blue
    '#83769C', // 13 lavender
    '#FF77A8', // 14 pink
    '#FFCCAA', // 15 light-peach
];
// Webview provider for game detail panel in sidebar
class GameDetailViewProvider {
    constructor(_extensionUri, _dataManager) {
        this._extensionUri = _extensionUri;
        this._dataManager = _dataManager;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: false,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getEmptyHtml();
    }
    async updateGame(game) {
        this._currentGame = game;
        this._thumbnailDataUrl = undefined;
        if (this._view) {
            // Show loading state
            this._view.webview.html = this._getGenericHtml(game, true);
        }
        // Try load thumbnail from CARTRIDGE file
        try {
            // CHANGED: Use 'cart' instead of 'thumb'
            // This triggers the download of the .p8.png if missing
            const cartPath = await this._dataManager.getAssetPath(game, 'cart');
            if (fs.existsSync(cartPath)) {
                // Convert to data uri
                const data = fs.readFileSync(cartPath);
                // PICO-8 carts are standard PNGs
                this._thumbnailDataUrl = `data:image/png;base64,${data.toString('base64')}`;
            }
        }
        catch (e) {
            console.warn('Failed to load detail thumbnail', e);
        }
        if (this._view && this._currentGame === game) {
            this._view.webview.html = this._getGenericHtml(game, false);
        }
    }
    _getEmptyHtml() {
        return `<!DOCTYPE html>
            <html lang="en">
            <body style="padding: 10px; font-family: sans-serif; opacity: 0.7;">
                Click a game in the explorer to view details.
            </body>
            </html>`;
    }
    _getGenericHtml(game, loading) {
        // CHANGED: Make image larger (100% width of panel) for better visibility
        const thumbHtml = loading ?
            `<div style="width: 100%; aspect-ratio: 1; background: #333; display: flex; align-items: center; justify-content: center; border-radius: 4px;">Loading...</div>` :
            (this._thumbnailDataUrl ?
                `<img src="${this._thumbnailDataUrl}" style="width: 100%; height: auto; image-rendering: pixelated; border: 1px solid #555; border-radius: 4px; display: block;">` :
                `<div style="width: 100%; aspect-ratio: 1; background: #222; display: flex; align-items: center; justify-content: center; color: #888; border-radius: 4px;">No Image</div>`);
        const cartBtn = `<div style="margin-top: 20px;">
            <a href="command:pico8ide.openCart?%22${game.id}%22" style="display: block; text-align: center; background: #e00; color: white; padding: 8px 12px; text-decoration: none; border-radius: 3px; font-weight: bold;">▶ OPEN CARTRIDGE</a>
        </div>`;
        const tags = (game.extension.tags || []).map((t) => `<span style="background: #333; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-right: 4px; display: inline-block; margin-bottom: 4px;">${t}</span>`).join('');
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 15px; font-size: 13px; }
                    h1 { margin: 10px 0 5px 0; font-size: 1.4em; color: var(--vscode-editor-foreground); line-height: 1.2; }
                    .meta { color: var(--vscode-descriptionForeground); margin-bottom: 15px; font-size: 0.9em; }
                    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    .stats { display: flex; gap: 15px; margin: 10px 0; font-size: 0.9em; opacity: 0.8; }
                    .desc { white-space: pre-wrap; margin: 15px 0; line-height: 1.5; font-family: var(--vscode-editor-font-family); font-size: 0.95em; opacity: 0.9; }
                    .footer { margin-top: 20px; font-size: 0.8em; opacity: 0.5; border-top: 1px solid #333; padding-top: 10px; }
                </style>
            </head>
            <body>
                <!-- CHANGED: Vertical Stack Layout -->
                <div style="margin-bottom: 15px;">
                    ${thumbHtml}
                </div>

                <div>
                    <h1>${game.name}</h1>
                    <div class="meta">
                        by <a href="${game.author.url || '#'}">${game.author.name}</a>
                    </div>

                    <div class="stats">
                            <span>❤️ ${game.extension.likes || 0}</span>
                            <span>👁️ ${game.extension.views || 0}</span>
                            <span>💾 ${game.id}</span>
                    </div>
                </div>

                ${cartBtn}

                <div class="desc">${game.description || 'No description available.'}</div>

                <div style="margin-top: 10px;">
                    ${tags}
                </div>

                <div class="footer">
                    Updated: ${new Date(game.datetime.updated).toLocaleDateString()}
                </div>
            </body>
            </html>`;
    }
}
GameDetailViewProvider.viewType = 'pico8GameDetail';
// Tree Data Provider
class Pico8GamesProvider {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.games = [];
        this.filteredGames = [];
        this.filter = '';
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async load() {
        this.games = await this.dataManager.getGames();
        this.filterData();
        this.refresh();
    }
    setFilter(query) {
        this.filter = query.toLowerCase();
        this.filterData();
        this.refresh();
    }
    filterData() {
        if (!this.filter) {
            this.filteredGames = this.games;
        }
        else {
            this.filteredGames = this.games.filter(g => g.name.toLowerCase().includes(this.filter) ||
                g.author.name.toLowerCase().includes(this.filter) ||
                g.id.includes(this.filter));
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return [];
        }
        return this.filteredGames.map(game => new GameItem(game));
    }
}
class GameItem extends vscode.TreeItem {
    constructor(game) {
        super(game.name, vscode.TreeItemCollapsibleState.None);
        this.game = game;
        this.tooltip = `${game.name} by ${game.author.name}`;
        this.description = game.author.name;
        // Custom icon? Or generic
        // this.iconPath = ...
        this.command = {
            command: 'pico8ide.selectGame',
            title: 'Select Game',
            arguments: [this.game]
        };
    }
}
// Custom Editor / Webview Panel for Cart
class Pico8CartPanel {
    static createOrShow(extensionUri, game, cartData) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we want multiple, create new every time.
        // For now, let's just create new.
        const panel = vscode.window.createWebviewPanel(Pico8CartPanel.viewType, `Cart: ${game.name}`, column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });
        const p = new Pico8CartPanel(panel, extensionUri, game, cartData);
    }
    constructor(panel, extensionUri, game, cartData) {
        this._disposables = [];
        this._panel = panel;
        this._panel.webview.html = this._getHtmlForWebview(game, cartData);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    dispose() {
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _getHtmlForWebview(game, cartData) {
        // We will render the sprite sheet using canvas
        // Convert gfx array to JS array string
        const gfxJson = JSON.stringify(cartData.gfx);
        const mapJson = JSON.stringify(cartData.map);
        const flagsJson = JSON.stringify(cartData.gfxFlags);
        // Palette
        const palJson = JSON.stringify(PICO8_PALETTE);
        // Escape code for html
        const safeCode = cartData.code.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>PICO-8 Cart: ${game.name}</title>
                <style>
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; height: 100vh; margin: 0; overflow: hidden; }
                    .sidebar { width: 300px; background: #222; border-right: 1px solid #333; display: flex; flex-direction: column; overflow-y: auto; padding: 10px; flex-shrink: 0; }
                    .main { flex: 1; display: flex; flex-direction: column; background: #1a1a1a; padding: 0; overflow: hidden; }

                    .tab-header { display: flex; background: #252525; border-bottom: 1px solid #333; }
                    .tab { padding: 8px 16px; cursor: pointer; border-right: 1px solid #333; background: #222; }
                    .tab.active { background: #1a1a1a; color: #fff; font-weight: bold; }

                    .content { flex: 1; overflow: auto; display: none; padding: 10px;}
                    .content.active { display: block; }

                    /* Code Highlighting (basic) */
                    pre { margin: 0; font-size: 13px; line-height: 1.5; color: #e0e0e0; tab-size: 2; }

                    /* Sprites */
                    .sprite-sheet-container { display: flex; justify-content: center; padding: 20px; background: #202020; }
                    canvas { image-rendering: pixelated; border: 1px solid #444; background: #000; box-shadow: 0 0 10px rgba(0,0,0,0.5); }

                    h2 { margin-top: 0; font-size: 1.1em; color: #fff; border-bottom: 1px solid #444; padding-bottom: 5px; }

                    .info-grid { display: grid; grid-template-columns: 80px 1fr; gap: 8px; font-size: 0.9em; }
                    .label { color: #888; }
                </style>
            </head>
            <body>
                <div class="sidebar">
                    <h2>Cartridge Info</h2>
                    <div class="info-grid">
                        <div class="label">Name</div><div>${game.name}</div>
                        <div class="label">Author</div><div>${game.author.name}</div>
                        <div class="label">ID</div><div>${game.id}</div>
                        <div class="label">Size</div><div>${cartData.code.length} chars (code)</div>
                    </div>

                    <div style="margin-top: 20px;">
                        <button onclick="toggleTheme()" style="width:100%; padding: 8px;">Toggle Theme</button>
                    </div>
                </div>

                <div class="main">
                    <div class="tab-header">
                        <div class="tab active" onclick="showTab('code')">LUA Code</div>
                        <div class="tab" onclick="showTab('gfx')">Sprites</div>
                        <div class="tab" onclick="showTab('map')">Map</div>
                        <div class="tab" onclick="showTab('sfx')">SFX (N/A)</div>
                        <div class="tab" onclick="showTab('music')">Music (N/A)</div>
                    </div>

                    <div id="tab-code" class="content active">
                        <pre>${safeCode}</pre>
                    </div>

                    <div id="tab-gfx" class="content">
                         <div class="sprite-sheet-container">
                             <canvas id="cvs-gfx" width="128" height="128"></canvas>
                         </div>
                         <div style="text-align: center; color: #666; font-size: 0.8em; margin-top: 5px;">128x128 Sprite Sheet</div>
                    </div>

                    <div id="tab-map" class="content">
                        <div style="padding: 20px; text-align: center;">Map viewer not implemented yet.</div>
                    </div>

                     <div id="tab-sfx" class="content">SFX not visible</div>
                     <div id="tab-music" class="content">Music not visible</div>
                </div>

                <script>
                    const GFX = ${gfxJson};
                    const MAP = ${mapJson};
                    const FLAGS = ${flagsJson};
                    const PAL = ${palJson};

                    function showTab(id) {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));

                        // find tab element by text roughly or index? hacky event.target check is better in real app
                        // abusing the onclick directly:
                        event.target.classList.add('active');
                        document.getElementById('tab-' + id).classList.add('active');

                        if (id === 'gfx') {
                            renderGfx();
                        }
                    }

                    function renderGfx() {
                        const cvs = document.getElementById('cvs-gfx');
                        const ctx = cvs.getContext('2d');
                        const imgData = ctx.createImageData(128, 128);

                        // Fill with black (0) usually, but key is we want transparency for color 0 maybe?
                        // In IDE spritesheet view, 0 is black.

                        for (let i = 0; i < 8192; i++) { // 128x128 / 2 bytes = 8192 bytes. Wait.
                            // PICO-8 gfx: 128x128 pixels.
                            // Each pixel is 4 bits (1 nibble).
                            // Size = 128 * 128 / 2 = 8192 bytes.
                            // My decode logic returned byte array of 0x2000 size?
                            // Yes 0x2000 is 8192.
                            // Wait, GFX region is 0x0000-0x1FFF = 8192 bytes.
                            // This holds 128x128 pixels.

                            const byte = GFX[i];
                            // Low nibble = even pixel (x), High nibble = odd pixel (x+1)?
                            // PICO-8 memory: "Pixel at (x,y) is stored in byte 0x6000 + y*64 + x/2" (Screen)
                            // Sprite sheet is same format.
                            // Low nibble is left pixel? No.
                            // Spec: "low 4 bits are the left pixel (x), high 4 bits are the right pixel (x+1)"

                            const p1 = byte & 0x0f;
                            const p2 = (byte >> 4) & 0x0f;

                            // Pixel indices:
                            // Row = Math.floor(i / 64);
                            // ColBase = (i % 64) * 2;

                            const row = Math.floor(i / 64);
                            const col = (i % 64) * 2;

                            setPixel(imgData, col, row, p1);
                            setPixel(imgData, col+1, row, p2);
                        }

                        // Scale up for visibility? Canvas CSS handles it with image-rendering: pixelated
                        // But canvas intrinsic size is 128x128.
                        ctx.putImageData(imgData, 0, 0);

                        // Let's scale the canvas element via CSS only, keep internal resolution 128
                        cvs.style.width = '256px';
                        cvs.style.height = '256px';
                    }

                    function setPixel(imgData, x, y, c) {
                        const idx = (y * 128 + x) * 4;
                        const hex = PAL[c & 15]; // Safety mask
                        // parse hex
                        const r = parseInt(hex.substr(1,2), 16);
                        const g = parseInt(hex.substr(3,2), 16);
                        const b = parseInt(hex.substr(5,2), 16);

                        imgData.data[idx] = r;
                        imgData.data[idx+1] = g;
                        imgData.data[idx+2] = b;
                        imgData.data[idx+3] = 255; // Alpha
                    }

                    // Initial render if active?
                </script>
            </body>
            </html>`;
    }
}
Pico8CartPanel.viewType = 'pico8Cart';
function activate(context) {
    const dataManager = new dataManager_1.DataManager(context);
    dataManager.initialize();
    const gamesProvider = new Pico8GamesProvider(dataManager);
    const detailProvider = new GameDetailViewProvider(context.extensionUri, dataManager);
    vscode.window.registerTreeDataProvider('pico8Games', gamesProvider);
    // Webview View for Details
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(GameDetailViewProvider.viewType, detailProvider));
    // Refresh Command
    vscode.commands.registerCommand('pico8ide.refreshEntry', () => gamesProvider.load());
    // Filter Command
    vscode.commands.registerCommand('pico8ide.search', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search games...',
            prompt: 'Filter by name or author'
        });
        if (query !== undefined) {
            gamesProvider.setFilter(query);
        }
    });
    // Select Game
    vscode.commands.registerCommand('pico8ide.selectGame', (game) => {
        detailProvider.updateGame(game);
        // Enable visibility context
        vscode.commands.executeCommand('setContext', 'pico8ide.gameSelected', true);
        // Focus webview
        vscode.commands.executeCommand('pico8GameDetail.focus');
    });
    // Open Cart (Download & View)
    vscode.commands.registerCommand('pico8ide.openCart', async (gameOrId) => {
        // Resolve argument
        let game;
        if (typeof gameOrId === 'string') {
            const games = await dataManager.getGames();
            game = games.find(g => g.id === gameOrId);
        }
        else {
            game = gameOrId;
        }
        if (!game) {
            vscode.window.showErrorMessage("Game not found.");
            return;
        }
        // 1. Get Path (triggers download)
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Opening ${game.name}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Downloading cartridge..." });
                const cartPath = await dataManager.getAssetPath(game, 'cart');
                progress.report({ message: "Extracting data..." });
                const cartData = await Pico8Decoder.decode(cartPath);
                // Show Panel
                Pico8CartPanel.createOrShow(context.extensionUri, game, cartData);
            });
        }
        catch (e) {
            vscode.window.showErrorMessage(`Failed to open cart: ${e.message}`);
        }
    });
    // Initial Load
    gamesProvider.load();
}
/**
 * DECODER LOGIC
 * Since we can't easily import a complex class from another file if we want to keep this simple
 * or if we had separate files before.
 * But wait, we have ./decoder.ts on disk still?
 * The user said "help implmenet" which implies we need to write the code.
 * We can reuse the decoder.ts via import.
 */
// Helper to decode using the Decoder class
class Pico8Decoder {
    // We'll trust the separate file `decoder.ts` handles the heavy lifting of LZSS/PXA.
    // But we need to EXTRACT the bytes from PNG first.
    // The previous `decoder.ts` ONLY took a PNG path and returned CODE string.
    // It didn't return gfx/map.
    // We need to enhance the decoder or do it here.
    // Let's reimplement a robust decoder here that returns structured data.
    static async decode(cartPath) {
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(cartPath);
            const png = new pngjs_1.PNG();
            stream.pipe(png).on('parsed', function () {
                try {
                    // Extract full RAM
                    // 128*128 pixels * 4 channels = 65536 bytes of raw pixel data
                    // But we care about RGBA channels.
                    // Each pixel holds 1 byte of PICO-8 RAM.
                    // RAM size = 0x8000 (32k).
                    // Image size needed: 32768 pixels.
                    // 160x205 image = 32800 pixels. Enough.
                    const ram = new Uint8Array(0x8000); // 32k
                    let ramIdx = 0;
                    for (let y = 0; y < this.height; y++) {
                        for (let x = 0; x < this.width; x++) {
                            if (ramIdx >= 0x8000)
                                break;
                            const idx = (this.width * y + x) << 2;
                            const r = this.data[idx];
                            const g = this.data[idx + 1];
                            const b = this.data[idx + 2];
                            const a = this.data[idx + 3];
                            // Reconstruct byte
                            // Order: A(2) R(2) G(2) B(2)  (MSB -> LSB) ??
                            // Actually PICO-8 steganography standard:
                            // byte = (alpha & 3) << 6 | (red & 3) << 4 | (green & 3) << 2 | (blue & 3)
                            const byte = ((a & 3) << 6) | ((r & 3) << 4) | ((g & 3) << 2) | (b & 3);
                            ram[ramIdx++] = byte;
                        }
                    }
                    // Slice Sections
                    const gfx = Array.from(ram.slice(0x0000, 0x2000));
                    const map = Array.from(ram.slice(0x2000, 0x3000));
                    const gfxFlags = Array.from(ram.slice(0x3000, 0x3100));
                    // Song/SFX/Music are further down. Code is at 0x4300.
                    const codeStart = 0x4300;
                    // Decode Code
                    let code = "";
                    // Check Header
                    if (ram[codeStart] === 0x3a && ram[codeStart + 1] === 0x63 && ram[codeStart + 2] === 0x3a && ram[codeStart + 3] === 0x00) {
                        // :c: compression
                        code = Pico8Decoder.decompressLZSS(ram.slice(codeStart + 4));
                    }
                    else if (ram[codeStart] === 0 && ram[codeStart + 1] === 0x70 && ram[codeStart + 2] === 0x78 && ram[codeStart + 3] === 0x61) {
                        // pxav (new compression)
                        code = "-- [PXA compression not supported in viewer yet]";
                    }
                    else {
                        // Raw
                        code = Pico8Decoder.readRaw(ram.slice(codeStart));
                    }
                    resolve({
                        code,
                        gfx,
                        map,
                        gfxFlags
                    });
                }
                catch (e) {
                    reject(e);
                }
            }).on('error', reject);
        });
    }
    static readRaw(buffer) {
        let s = "";
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 0)
                break;
            s += String.fromCharCode(buffer[i]);
        }
        return s;
    }
    static decompressLZSS(buffer) {
        const LUT = "\n 0123456789abcdefghijklmnopqrstuvwxyz!#%(){}[]<>+=/*:;.,~_";
        let out = "";
        let i = 0;
        while (i < buffer.length) {
            const b = buffer[i++];
            if (b === 0x00) {
                // Literal next
                if (i >= buffer.length)
                    break;
                out += String.fromCharCode(buffer[i++]);
            }
            else if (b < 0x3c) {
                out += LUT[b - 1];
            }
            else {
                // Copy
                if (i >= buffer.length)
                    break;
                const b2 = buffer[i++];
                const offset = (b - 0x3c) * 16 + (b2 & 0x0f);
                const length = (b2 >> 4) + 2;
                if (offset > out.length) {
                    out += Array(length).fill('?').join(''); // Error fallback
                }
                else {
                    const start = out.length - offset;
                    for (let k = 0; k < length; k++) {
                        out += out[start + k];
                    }
                }
            }
        }
        return out;
    }
}
//# sourceMappingURL=extension.js.map