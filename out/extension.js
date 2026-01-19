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
        // Check if there's a pending game update
        if (this._pendingUpdate) {
            const game = this._pendingUpdate;
            this._pendingUpdate = undefined;
            this.updateGame(game);
        }
        else {
            webviewView.webview.html = this._getEmptyHtml();
        }
    }
    async updateGame(game) {
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
    // Called after cart is decoded to show code size and label
    updateCartInfo(game, codeSize, label) {
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
    _getEmptyHtml() {
        return `<!DOCTYPE html>
            <html lang="en">
            <body style="padding: 10px; font-family: sans-serif; opacity: 0.7;">
                Click a game in the explorer to view details.
            </body>
            </html>`;
    }
    _getGenericHtml(game, loading, error) {
        // Thumbnail with floating metadata overlay on bottom half
        let thumbContent;
        if (loading) {
            thumbContent = `<div class="thumb-placeholder">Loading...</div>`;
        }
        else if (error) {
            thumbContent = `<div class="thumb-placeholder thumb-error">${error}</div>`;
        }
        else if (this._thumbnailDataUrl) {
            thumbContent = `<img src="${this._thumbnailDataUrl}" class="thumb-img">`;
        }
        else {
            thumbContent = `<div class="thumb-placeholder">No Image</div>`;
        }
        const tags = (game.extension.tags || []).slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join('');
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
                            <span>👁️ ${game.extension?.views || 0}</span>
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
    // Create or reuse panel, show loading state initially
    static createWithLoading(extensionUri, game) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // Reuse existing panel if same game, otherwise create new
        if (Pico8CartPanel.currentPanel && Pico8CartPanel.currentPanel._game.id === game.id) {
            Pico8CartPanel.currentPanel._panel.reveal(column);
            return Pico8CartPanel.currentPanel;
        }
        // Close old panel if different game
        if (Pico8CartPanel.currentPanel) {
            Pico8CartPanel.currentPanel.dispose();
        }
        const panel = vscode.window.createWebviewPanel(Pico8CartPanel.viewType, `Cart: ${game.name}`, column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });
        Pico8CartPanel.currentPanel = new Pico8CartPanel(panel, extensionUri, game);
        return Pico8CartPanel.currentPanel;
    }
    constructor(panel, extensionUri, game) {
        this.extensionUri = extensionUri;
        this._disposables = [];
        this._panel = panel;
        this._game = game;
        // Show loading state
        this._panel.webview.html = this._getLoadingHtml(game, "Downloading cartridge...");
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    updateProgress(message) {
        this._panel.webview.html = this._getLoadingHtml(this._game, message);
    }
    showError(error) {
        this._panel.webview.html = this._getErrorHtml(this._game, error);
    }
    showCart(cartData) {
        this._panel.webview.html = this._getCartHtml(this._game, cartData);
    }
    dispose() {
        Pico8CartPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    _getLoadingHtml(game, message) {
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
    _getErrorHtml(game, error) {
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
                    <h2>Failed to load ${game.name}</h2>
                    <p>${error}</p>
                </div>
            </body>
            </html>`;
    }
    _getCartHtml(game, cartData) {
        // We will render the sprite sheet using canvas
        // Convert gfx array to JS array string
        const gfxJson = JSON.stringify(cartData.gfx);
        const mapJson = JSON.stringify(cartData.map);
        const flagsJson = JSON.stringify(cartData.gfxFlags);
        const sfxJson = JSON.stringify(cartData.sfx);
        const musicJson = JSON.stringify(cartData.music);
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
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; flex-direction: column; height: 100vh; margin: 0; overflow: hidden; }

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

                    /* SFX Styles */
                    .sfx-container { display: flex; height: 100%; }
                    .sfx-list { width: 200px; border-right: 1px solid #333; overflow-y: auto; }
                    .sfx-item { padding: 6px 10px; cursor: pointer; border-bottom: 1px solid #222; font-size: 12px; display: flex; align-items: center; }
                    .sfx-item:hover { background: #2a2a2a; }
                    .sfx-item.active { background: #3a3a5a; }
                    .sfx-item.empty { opacity: 0.4; }
                    .sfx-item .play-btn { margin-right: 8px; background: #4a4; border: none; color: #fff; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px; }
                    .sfx-item .play-btn:hover { background: #5b5; }
                    .sfx-detail { flex: 1; padding: 10px; overflow: auto; }
                    .sfx-header { font-weight: bold; margin-bottom: 10px; color: #fff; }
                    .sfx-controls { margin-bottom: 15px; }
                    .sfx-controls button { background: #444; border: 1px solid #555; color: #fff; padding: 6px 12px; margin-right: 8px; border-radius: 3px; cursor: pointer; }
                    .sfx-controls button:hover:not(:disabled) { background: #555; }
                    .sfx-controls button:disabled { opacity: 0.5; cursor: not-allowed; }
                    .sfx-info { margin-bottom: 15px; font-size: 12px; color: #888; }
                    .sfx-tracker { font-family: monospace; font-size: 11px; background: #1a1a1a; border: 1px solid #333; }
                    .sfx-tracker-header { display: flex; background: #252525; border-bottom: 1px solid #333; padding: 4px; }
                    .sfx-tracker-header span { flex: 1; text-align: center; font-weight: bold; font-size: 10px; color: #888; }
                    .sfx-note { display: flex; border-bottom: 1px solid #222; }
                    .sfx-note:hover { background: #252530; }
                    .sfx-note.playing { background: #3a4a3a; }
                    .sfx-note span { flex: 1; text-align: center; padding: 2px 4px; }
                    .sfx-note .note-idx { color: #666; width: 30px; flex: none; }
                    .sfx-note .note-pitch { color: #6cf; }
                    .sfx-note .note-wave { color: #fc6; }
                    .sfx-note .note-vol { color: #6f6; }
                    .sfx-note .note-fx { color: #f6c; }

                    /* Music Styles */
                    .music-container { padding: 10px; }
                    .music-controls { margin-bottom: 15px; padding: 10px; background: #1a1a1a; border-radius: 5px; }
                    .music-controls button { background: #444; border: 1px solid #555; color: #fff; padding: 8px 16px; margin-right: 10px; border-radius: 3px; cursor: pointer; }
                    .music-controls button:hover { background: #555; }
                    #music-status { color: #888; font-size: 12px; }
                    .music-patterns { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; }
                    .music-pattern { background: #1a1a1a; border: 1px solid #333; padding: 8px; font-size: 11px; border-radius: 3px; cursor: pointer; }
                    .music-pattern:hover { background: #252525; }
                    .music-pattern.playing { background: #2a3a2a; border-color: #4a4; }
                    .music-pattern.empty { opacity: 0.3; }
                    .music-pattern.loop-start { border-left: 3px solid #6f6; }
                    .music-pattern.loop-end { border-right: 3px solid #f66; }
                    .music-pattern.stop { border-bottom: 3px solid #ff6; }
                    .music-pattern-id { font-weight: bold; color: #fff; margin-bottom: 5px; }
                    .music-channel { font-size: 10px; color: #888; }
                    .music-channel.disabled { color: #444; text-decoration: line-through; }
                    .music-channel.enabled { color: #6cf; }
                </style>
            </head>
            <body>
                <div class="tab-header">
                    <div class="tab active" onclick="showTab('code')">LUA Code</div>
                    <div class="tab" onclick="showTab('gfx')">Sprites</div>
                    <div class="tab" onclick="showTab('map')">Map</div>
                    <div class="tab" onclick="showTab('sfx')">SFX</div>
                    <div class="tab" onclick="showTab('music')">Music</div>
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
                    <div class="sprite-sheet-container">
                        <canvas id="cvs-map" width="1024" height="512"></canvas>
                    </div>
                    <div style="text-align: center; color: #666; font-size: 0.8em; margin-top: 5px;">128x64 Map (1024x512 pixels) - Lower 32 rows share memory with sprite sheet</div>
                </div>

                 <div id="tab-sfx" class="content">
                    <div class="sfx-container">
                        <div class="sfx-list" id="sfx-list"></div>
                        <div class="sfx-detail" id="sfx-detail">
                            <div class="sfx-header">Select an SFX to view details</div>
                            <div class="sfx-controls">
                                <button id="btn-play-sfx" disabled>▶ Play</button>
                                <button id="btn-stop-sfx" disabled>⏹ Stop</button>
                            </div>
                        </div>
                    </div>
                 </div>
                 <div id="tab-music" class="content">
                    <div class="music-container">
                        <div class="music-controls">
                            <button id="btn-play-music">▶ Play Music</button>
                            <button id="btn-stop-music">⏹ Stop</button>
                            <span id="music-status"></span>
                        </div>
                        <div class="music-patterns" id="music-patterns"></div>
                    </div>
                 </div>

                <script>
                    const GFX = ${gfxJson};
                    const MAP = ${mapJson};
                    const FLAGS = ${flagsJson};
                    const SFX = ${sfxJson};
                    const MUSIC = ${musicJson};
                    const PAL = ${palJson};

                    // Note names for pitch display
                    const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
                    const WAVEFORMS = ['sine', 'tri', 'saw', 'sqr', 'pulse', 'ring', 'noise', 'ring2'];
                    const EFFECTS = ['none', 'slide', 'vib', 'drop', 'fadein', 'fadeout', 'arpF', 'arpS'];

                    // ============ AUDIO ENGINE ============
                    let audioCtx = null;
                    let currentSfxPlayer = null;
                    let currentMusicPlayer = null;
                    let selectedSfxId = null;

                    // PICO-8 base frequency: C0 = 16.35 Hz (standard tuning)
                    const BASE_FREQ = 16.35;

                    // Convert PICO-8 pitch (0-63) to frequency in Hz
                    function pitchToFreq(pitch) {
                        return BASE_FREQ * Math.pow(2, pitch / 12);
                    }

                    // Map PICO-8 waveform to Web Audio type or custom
                    function getOscillatorType(waveform) {
                        switch (waveform) {
                            case 0: return 'sine';
                            case 1: return 'triangle';
                            case 2: return 'sawtooth';
                            case 3: return 'square';  // long square
                            case 4: return 'square';  // short square (we'll handle duty cycle separately if needed)
                            case 5: return 'triangle'; // ringing - approximate
                            case 6: return 'sawtooth'; // noise - we'll use special handling
                            case 7: return 'sine';     // ringing sine
                            default: return 'sine';
                        }
                    }

                    // Create noise source using AudioBuffer
                    function createNoiseSource(ctx, duration) {
                        const bufferSize = ctx.sampleRate * duration;
                        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                        const data = buffer.getChannelData(0);
                        for (let i = 0; i < bufferSize; i++) {
                            data[i] = Math.random() * 2 - 1;
                        }
                        const source = ctx.createBufferSource();
                        source.buffer = buffer;
                        return source;
                    }

                    // Play a single SFX
                    function playSfx(sfxId, onNoteChange) {
                        if (!audioCtx) {
                            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        }

                        // Stop any currently playing SFX
                        stopSfx();

                        const sfx = parseSfx(sfxId);
                        if (sfx.isEmpty) return null;

                        // Calculate note duration: speed * (1/128) seconds approximately
                        // PICO-8: 22050 ticks/sec, 183 ticks per speed unit
                        // So duration = speed * 183 / 22050 ≈ speed * 0.0083 seconds
                        const noteDuration = (sfx.speed || 1) * 183 / 22050;

                        let noteIndex = 0;
                        let isPlaying = true;
                        let oscillator = null;
                        let gainNode = null;

                        function playNote() {
                            if (!isPlaying || noteIndex >= 32) {
                                // Check for loop
                                if (sfx.loopStart < sfx.loopEnd && isPlaying) {
                                    noteIndex = sfx.loopStart;
                                } else {
                                    stopSfx();
                                    return;
                                }
                            }

                            const note = sfx.notes[noteIndex];

                            // Highlight current note
                            if (onNoteChange) onNoteChange(noteIndex);

                            // Skip silent notes
                            if (note.volume === 0) {
                                noteIndex++;
                                setTimeout(playNote, noteDuration * 1000);
                                return;
                            }

                            // Create oscillator for this note
                            if (note.waveform === 6) {
                                // Noise
                                oscillator = createNoiseSource(audioCtx, noteDuration);
                            } else {
                                oscillator = audioCtx.createOscillator();
                                oscillator.type = getOscillatorType(note.waveform);
                                oscillator.frequency.setValueAtTime(pitchToFreq(note.pitch), audioCtx.currentTime);
                            }

                            // Create gain for volume
                            gainNode = audioCtx.createGain();
                            const vol = note.volume / 7; // Normalize to 0-1
                            gainNode.gain.setValueAtTime(vol * 0.3, audioCtx.currentTime); // Scale down to avoid clipping

                            // Apply effects
                            const nextNote = sfx.notes[noteIndex + 1] || note;
                            switch (note.effect) {
                                case 1: // Slide
                                    if (oscillator.frequency) {
                                        oscillator.frequency.linearRampToValueAtTime(
                                            pitchToFreq(nextNote.pitch),
                                            audioCtx.currentTime + noteDuration
                                        );
                                    }
                                    break;
                                case 2: // Vibrato
                                    if (oscillator.frequency) {
                                        const vibratoOsc = audioCtx.createOscillator();
                                        vibratoOsc.frequency.setValueAtTime(6, audioCtx.currentTime);
                                        const vibratoGain = audioCtx.createGain();
                                        vibratoGain.gain.setValueAtTime(pitchToFreq(note.pitch) * 0.02, audioCtx.currentTime);
                                        vibratoOsc.connect(vibratoGain);
                                        vibratoGain.connect(oscillator.frequency);
                                        vibratoOsc.start();
                                        setTimeout(() => vibratoOsc.stop(), noteDuration * 1000);
                                    }
                                    break;
                                case 3: // Drop
                                    if (oscillator.frequency) {
                                        oscillator.frequency.exponentialRampToValueAtTime(
                                            20,
                                            audioCtx.currentTime + noteDuration
                                        );
                                    }
                                    break;
                                case 4: // Fade in
                                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                                    gainNode.gain.linearRampToValueAtTime(vol * 0.3, audioCtx.currentTime + noteDuration);
                                    break;
                                case 5: // Fade out
                                    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + noteDuration);
                                    break;
                            }

                            oscillator.connect(gainNode);
                            gainNode.connect(audioCtx.destination);

                            oscillator.start();
                            oscillator.stop(audioCtx.currentTime + noteDuration);

                            noteIndex++;
                            setTimeout(playNote, noteDuration * 1000);
                        }

                        playNote();

                        return {
                            stop: () => {
                                isPlaying = false;
                                if (oscillator) {
                                    try { oscillator.stop(); } catch (e) {}
                                }
                            }
                        };
                    }

                    function stopSfx() {
                        if (currentSfxPlayer) {
                            currentSfxPlayer.stop();
                            currentSfxPlayer = null;
                        }
                        // Clear note highlighting
                        document.querySelectorAll('.sfx-note.playing').forEach(el => el.classList.remove('playing'));
                    }

                    // Music player
                    function playMusic(startPattern) {
                        if (!audioCtx) {
                            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        }

                        stopMusic();

                        let patternIndex = startPattern || 0;
                        let isPlaying = true;
                        let channelPlayers = [null, null, null, null];

                        function updatePatternHighlight() {
                            document.querySelectorAll('.music-pattern').forEach((el, idx) => {
                                el.classList.toggle('playing', idx === patternIndex);
                            });
                            document.getElementById('music-status').textContent = 'Playing pattern ' + patternIndex;
                        }

                        function playPattern() {
                            if (!isPlaying || patternIndex >= 64) {
                                stopMusic();
                                return;
                            }

                            updatePatternHighlight();

                            const offset = patternIndex * 4;
                            const channels = [
                                MUSIC[offset] || 0,
                                MUSIC[offset + 1] || 0,
                                MUSIC[offset + 2] || 0,
                                MUSIC[offset + 3] || 0
                            ];

                            // Check if all channels disabled (empty pattern)
                            const allDisabled = channels.every(c => (c & 0x40) !== 0);

                            // Parse flags
                            const loopStart = (channels[0] & 0x80) !== 0;
                            const loopEnd = (channels[1] & 0x80) !== 0;
                            const stopAtEnd = (channels[2] & 0x80) !== 0;

                            if (allDisabled) {
                                stopMusic();
                                return;
                            }

                            // Find longest SFX duration
                            let maxDuration = 0;
                            for (let c = 0; c < 4; c++) {
                                const disabled = (channels[c] & 0x40) !== 0;
                                if (!disabled) {
                                    const sfxId = channels[c] & 0x3f;
                                    const sfx = parseSfx(sfxId);
                                    const noteDuration = (sfx.speed || 1) * 183 / 22050;
                                    const sfxDuration = noteDuration * 32;
                                    maxDuration = Math.max(maxDuration, sfxDuration);

                                    // Play this channel's SFX
                                    channelPlayers[c] = playSfx(sfxId, null);
                                }
                            }

                            // Schedule next pattern
                            setTimeout(() => {
                                if (!isPlaying) return;

                                if (stopAtEnd) {
                                    stopMusic();
                                } else if (loopEnd) {
                                    // Find loop start
                                    let loopStartIdx = 0;
                                    for (let i = patternIndex; i >= 0; i--) {
                                        if ((MUSIC[i * 4] & 0x80) !== 0) {
                                            loopStartIdx = i;
                                            break;
                                        }
                                    }
                                    patternIndex = loopStartIdx;
                                    playPattern();
                                } else {
                                    patternIndex++;
                                    playPattern();
                                }
                            }, maxDuration * 1000);
                        }

                        playPattern();

                        currentMusicPlayer = {
                            stop: () => {
                                isPlaying = false;
                                channelPlayers.forEach(p => { if (p) p.stop(); });
                            }
                        };
                    }

                    function stopMusic() {
                        if (currentMusicPlayer) {
                            currentMusicPlayer.stop();
                            currentMusicPlayer = null;
                        }
                        document.querySelectorAll('.music-pattern.playing').forEach(el => el.classList.remove('playing'));
                        document.getElementById('music-status').textContent = '';
                    }

                    // ============ END AUDIO ENGINE ============

                    function pitchToNote(pitch) {
                        if (pitch === 0) return '...';
                        const octave = Math.floor(pitch / 12);
                        const note = pitch % 12;
                        return NOTE_NAMES[note] + octave;
                    }

                    function showTab(id) {
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));

                        // find tab element by text roughly or index? hacky event.target check is better in real app
                        // abusing the onclick directly:
                        event.target.classList.add('active');
                        document.getElementById('tab-' + id).classList.add('active');

                        if (id === 'gfx') {
                            renderGfx();
                        } else if (id === 'map') {
                            renderMap();
                        } else if (id === 'sfx') {
                            renderSfxList();
                        } else if (id === 'music') {
                            renderMusic();
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

                    // Get a sprite's pixel data (8x8 pixels) from GFX memory
                    function getSprite(spriteIdx) {
                        // Sprite sheet is 16x16 sprites (128x128 pixels / 8x8 per sprite)
                        const sx = (spriteIdx % 16) * 8;  // x in pixels
                        const sy = Math.floor(spriteIdx / 16) * 8;  // y in pixels
                        const pixels = [];

                        for (let py = 0; py < 8; py++) {
                            for (let px = 0; px < 8; px++) {
                                const x = sx + px;
                                const y = sy + py;
                                // GFX layout: 64 bytes per row, 2 pixels per byte
                                const byteIdx = y * 64 + Math.floor(x / 2);
                                const byte = GFX[byteIdx] || 0;
                                // Low nibble = even x, high nibble = odd x
                                const color = (x % 2 === 0) ? (byte & 0x0f) : ((byte >> 4) & 0x0f);
                                pixels.push(color);
                            }
                        }
                        return pixels; // 64 color indices
                    }

                    function renderMap() {
                        const cvs = document.getElementById('cvs-map');
                        const ctx = cvs.getContext('2d');
                        // Map is 128x64 tiles, each 8x8 pixels = 1024x512 pixels
                        const imgData = ctx.createImageData(1024, 512);

                        // Upper 32 rows: from MAP array (0x2000-0x2FFF = 4096 bytes = 128x32)
                        // Lower 32 rows: from GFX array lower half (0x1000-0x1FFF = 4096 bytes = 128x32)

                        for (let ty = 0; ty < 64; ty++) {
                            for (let tx = 0; tx < 128; tx++) {
                                let spriteIdx;
                                if (ty < 32) {
                                    // Upper map: from MAP array
                                    const mapIdx = ty * 128 + tx;
                                    spriteIdx = MAP[mapIdx] || 0;
                                } else {
                                    // Lower map: shares memory with lower half of sprite sheet
                                    // GFX 0x1000-0x1FFF = bytes 4096-8191 = sprite rows 8-15
                                    // Map rows 32-63 -> GFX bytes at offset based on tile position
                                    // Each map row (128 tiles) = 128 bytes in shared region
                                    const sharedRow = ty - 32;
                                    const sharedIdx = sharedRow * 128 + tx;
                                    // This maps to GFX[0x1000 + sharedIdx] = GFX[4096 + sharedIdx]
                                    spriteIdx = GFX[4096 + sharedIdx] || 0;
                                }

                                // Get sprite pixels
                                const spritePixels = getSprite(spriteIdx);

                                // Draw 8x8 sprite at tile position
                                const baseX = tx * 8;
                                const baseY = ty * 8;

                                for (let py = 0; py < 8; py++) {
                                    for (let px = 0; px < 8; px++) {
                                        const color = spritePixels[py * 8 + px];
                                        const hex = PAL[color & 15];
                                        const r = parseInt(hex.substr(1,2), 16);
                                        const g = parseInt(hex.substr(3,2), 16);
                                        const b = parseInt(hex.substr(5,2), 16);

                                        const imgX = baseX + px;
                                        const imgY = baseY + py;
                                        const idx = (imgY * 1024 + imgX) * 4;

                                        imgData.data[idx] = r;
                                        imgData.data[idx+1] = g;
                                        imgData.data[idx+2] = b;
                                        imgData.data[idx+3] = 255;
                                    }
                                }
                            }
                        }

                        ctx.putImageData(imgData, 0, 0);
                    }

                    // Parse a single SFX from the SFX array
                    function parseSfx(sfxId) {
                        const offset = sfxId * 68;
                        const notes = [];

                        // Parse 32 notes (2 bytes each = 64 bytes)
                        for (let i = 0; i < 32; i++) {
                            const lo = SFX[offset + i * 2] || 0;
                            const hi = SFX[offset + i * 2 + 1] || 0;

                            // Decode note: pppppp www vvv eee c
                            // lo: ww pppppp (low 6 bits = pitch, bits 6-7 = low 2 bits of waveform)
                            // hi: c eee vvv w (bit 0 = high bit of waveform, bits 1-3 = volume, bits 4-6 = effect, bit 7 = custom)
                            const pitch = lo & 0x3f;
                            const waveform = ((lo >> 6) & 0x03) | ((hi & 0x01) << 2);
                            const volume = (hi >> 1) & 0x07;
                            const effect = (hi >> 4) & 0x07;
                            const customWave = (hi >> 7) & 0x01;

                            notes.push({ pitch, waveform, volume, effect, customWave });
                        }

                        const editorByte = SFX[offset + 64] || 0;
                        const speed = SFX[offset + 65] || 0;
                        const loopStart = SFX[offset + 66] || 0;
                        const loopEnd = SFX[offset + 67] || 0;

                        // Check if SFX is empty (all notes have 0 volume)
                        const isEmpty = notes.every(n => n.volume === 0);

                        return { notes, speed, loopStart, loopEnd, isEmpty };
                    }

                    function renderSfxList() {
                        const container = document.getElementById('sfx-list');
                        container.innerHTML = '';

                        for (let i = 0; i < 64; i++) {
                            const sfx = parseSfx(i);
                            const div = document.createElement('div');
                            div.className = 'sfx-item' + (sfx.isEmpty ? ' empty' : '');

                            // Play button
                            if (!sfx.isEmpty) {
                                const playBtn = document.createElement('button');
                                playBtn.className = 'play-btn';
                                playBtn.textContent = '▶';
                                playBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    currentSfxPlayer = playSfx(i, null);
                                };
                                div.appendChild(playBtn);
                            }

                            const label = document.createElement('span');
                            label.textContent = 'SFX ' + i.toString().padStart(2, '0') + (sfx.isEmpty ? ' (empty)' : ' spd:' + sfx.speed);
                            div.appendChild(label);

                            div.onclick = () => {
                                selectedSfxId = i;
                                renderSfxDetail(i);
                            };
                            container.appendChild(div);
                        }
                    }

                    function renderSfxDetail(sfxId) {
                        selectedSfxId = sfxId;

                        // Highlight active item
                        document.querySelectorAll('.sfx-item').forEach((el, idx) => {
                            el.classList.toggle('active', idx === sfxId);
                        });

                        const sfx = parseSfx(sfxId);
                        const container = document.getElementById('sfx-detail');

                        let html = '<div class="sfx-header">SFX ' + sfxId + '</div>';
                        html += '<div class="sfx-controls">';
                        html += '<button id="btn-play-sfx" ' + (sfx.isEmpty ? 'disabled' : '') + '>▶ Play</button>';
                        html += '<button id="btn-stop-sfx">⏹ Stop</button>';
                        html += '</div>';
                        html += '<div class="sfx-info">';
                        html += 'Speed: ' + sfx.speed + ' | ';
                        html += 'Loop: ' + sfx.loopStart + ' → ' + sfx.loopEnd;
                        html += '</div>';

                        html += '<div class="sfx-tracker" id="sfx-tracker">';
                        html += '<div class="sfx-tracker-header"><span>#</span><span>Note</span><span>Wave</span><span>Vol</span><span>FX</span></div>';

                        for (let i = 0; i < 32; i++) {
                            const n = sfx.notes[i];
                            const noteStr = pitchToNote(n.pitch);
                            const waveStr = n.customWave ? 'C' + n.waveform : WAVEFORMS[n.waveform];
                            const volStr = n.volume.toString();
                            const fxStr = EFFECTS[n.effect];

                            html += '<div class="sfx-note" data-idx="' + i + '">';
                            html += '<span class="note-idx">' + i.toString().padStart(2, '0') + '</span>';
                            html += '<span class="note-pitch">' + noteStr + '</span>';
                            html += '<span class="note-wave">' + waveStr + '</span>';
                            html += '<span class="note-vol">' + volStr + '</span>';
                            html += '<span class="note-fx">' + fxStr + '</span>';
                            html += '</div>';
                        }
                        html += '</div>';

                        container.innerHTML = html;

                        // Wire up buttons
                        document.getElementById('btn-play-sfx').onclick = () => {
                            currentSfxPlayer = playSfx(sfxId, (noteIdx) => {
                                // Highlight playing note
                                document.querySelectorAll('.sfx-note').forEach(el => el.classList.remove('playing'));
                                const noteEl = document.querySelector('.sfx-note[data-idx="' + noteIdx + '"]');
                                if (noteEl) noteEl.classList.add('playing');
                            });
                        };
                        document.getElementById('btn-stop-sfx').onclick = stopSfx;
                    }

                    function renderMusic() {
                        const container = document.getElementById('music-patterns');
                        container.innerHTML = '';

                        // Wire up music control buttons
                        document.getElementById('btn-play-music').onclick = () => playMusic(0);
                        document.getElementById('btn-stop-music').onclick = stopMusic;

                        for (let i = 0; i < 64; i++) {
                            const offset = i * 4;
                            const ch0 = MUSIC[offset] || 0;
                            const ch1 = MUSIC[offset + 1] || 0;
                            const ch2 = MUSIC[offset + 2] || 0;
                            const ch3 = MUSIC[offset + 3] || 0;

                            // Parse channel bytes
                            const channels = [ch0, ch1, ch2, ch3];
                            const sfxIds = channels.map(c => c & 0x3f);
                            const disabled = channels.map(c => (c & 0x40) !== 0);

                            // Flags from bit 7
                            const loopStart = (ch0 & 0x80) !== 0;
                            const loopEnd = (ch1 & 0x80) !== 0;
                            const stopAtEnd = (ch2 & 0x80) !== 0;

                            // Check if pattern is empty (all channels disabled)
                            const isEmpty = disabled.every(d => d);

                            const div = document.createElement('div');
                            let classes = 'music-pattern';
                            if (isEmpty) classes += ' empty';
                            if (loopStart) classes += ' loop-start';
                            if (loopEnd) classes += ' loop-end';
                            if (stopAtEnd) classes += ' stop';
                            div.className = classes;
                            div.dataset.pattern = i;

                            // Click to play from this pattern
                            if (!isEmpty) {
                                div.onclick = () => playMusic(i);
                                div.title = 'Click to play from pattern ' + i;
                            }

                            let html = '<div class="music-pattern-id">' + i.toString().padStart(2, '0') + '</div>';
                            for (let c = 0; c < 4; c++) {
                                const chClass = disabled[c] ? 'disabled' : 'enabled';
                                html += '<div class="music-channel ' + chClass + '">';
                                html += 'CH' + c + ': ' + (disabled[c] ? '--' : sfxIds[c].toString().padStart(2, '0'));
                                html += '</div>';
                            }
                            div.innerHTML = html;
                            container.appendChild(div);
                        }
                    }

                    // Initial render if active?
                </script>
            </body>
            </html>`;
    }
}
Pico8CartPanel.viewType = 'pico8Cart';
// Show disclaimer/readme on activation
function showDisclaimer(context) {
    const panel = vscode.window.createWebviewPanel('pico8ideDisclaimer', 'PICO-8 IDE - Disclaimer', vscode.ViewColumn.One, { enableScripts: false });
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
        <h1>PICO-8 IDE Browser</h1>

        <div class="disclaimer-box">
            <strong>Important Disclaimer</strong>
            <p>This is a <strong>hobby project</strong> created for <strong>learning purposes only</strong>.</p>
            <p>This extension is <strong>NOT for sale</strong> and is <strong>NOT affiliated with Lexaloffle Games</strong>.</p>
        </div>

        <h2>About PICO-8</h2>
        <p>
            PICO-8 is a fantasy console created by <strong>Lexaloffle Games</strong>.
            It's a wonderful platform for learning game development and creating retro-style games.
        </p>
        <p>
            <strong>PICO-8 is paid software.</strong> If you're interested in creating games or
            exploring the full PICO-8 experience, please support the developer by visiting the official website:
        </p>
        <p>
            <a href="https://www.lexaloffle.com/pico-8.php">https://www.lexaloffle.com/pico-8.php</a>
        </p>

        <h2>What This Extension Does</h2>
        <ul>
            <li>Browse PICO-8 games from the BBS (Bulletin Board System)</li>
            <li>View game metadata, sprites, maps, and code</li>
            <li>Preview SFX and music patterns</li>
            <li>Learn how PICO-8 cartridges are structured</li>
        </ul>

        <div class="footer">
            <p>Close this tab to continue using the extension.</p>
            <p>This message appears each time the extension is activated.</p>
        </div>
    </body>
    </html>`;
}
function activate(context) {
    // Show disclaimer on every activation
    showDisclaimer(context);
    const dataManager = new dataManager_1.DataManager(context);
    dataManager.initialize();
    const gamesProvider = new Pico8GamesProvider(dataManager);
    const detailProvider = new GameDetailViewProvider(context.extensionUri, dataManager);
    // Set callback to refresh game list when database is updated
    dataManager.setUpdateCallback(() => {
        vscode.window.showInformationMessage('Database updated successfully!');
        gamesProvider.load();
    });
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
    // Select Game - updates detail panel AND opens cart view
    vscode.commands.registerCommand('pico8ide.selectGame', async (game) => {
        // Update detail panel (this will download thumbnail in background)
        detailProvider.updateGame(game);
        // Enable visibility context
        vscode.commands.executeCommand('setContext', 'pico8ide.gameSelected', true);
        // Focus webview
        vscode.commands.executeCommand('pico8GameDetail.focus');
        // Also open the cart view
        vscode.commands.executeCommand('pico8ide.openCart', game);
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
        // Create panel immediately with loading state
        const panel = Pico8CartPanel.createWithLoading(context.extensionUri, game);
        try {
            panel.updateProgress("Downloading cartridge...");
            const cartPath = await dataManager.getAssetPath(game, 'cart');
            panel.updateProgress("Extracting data...");
            const cartData = await Pico8Decoder.decode(cartPath);
            // Update detail panel with cart info and label
            detailProvider.updateCartInfo(game, cartData.code.length, cartData.label);
            // Show the cart content
            panel.showCart(cartData);
        }
        catch (e) {
            panel.showError(e.message || 'Unknown error');
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
                    // Also extract the label image (128x128 visible portion)
                    const labelPng = new pngjs_1.PNG({ width: 128, height: 128 });
                    for (let y = 0; y < this.height; y++) {
                        for (let x = 0; x < this.width; x++) {
                            const idx = (this.width * y + x) << 2;
                            const r = this.data[idx];
                            const g = this.data[idx + 1];
                            const b = this.data[idx + 2];
                            const a = this.data[idx + 3];
                            // Extract RAM data from steganography
                            if (ramIdx < 0x8000) {
                                // Reconstruct byte
                                // PICO-8 steganography standard:
                                // byte = (alpha & 3) << 6 | (red & 3) << 4 | (green & 3) << 2 | (blue & 3)
                                const byte = ((a & 3) << 6) | ((r & 3) << 4) | ((g & 3) << 2) | (b & 3);
                                ram[ramIdx++] = byte;
                            }
                            // Copy label pixels (128x128 area starting at offset 16,24)
                            const labelX = x - 16;
                            const labelY = y - 24;
                            if (labelX >= 0 && labelX < 128 && labelY >= 0 && labelY < 128) {
                                const labelIdx = (labelY * 128 + labelX) << 2;
                                labelPng.data[labelIdx] = r;
                                labelPng.data[labelIdx + 1] = g;
                                labelPng.data[labelIdx + 2] = b;
                                labelPng.data[labelIdx + 3] = 255; // Full alpha
                            }
                        }
                    }
                    // Convert label to base64 data URL
                    const labelBuffer = pngjs_1.PNG.sync.write(labelPng);
                    const label = `data:image/png;base64,${labelBuffer.toString('base64')}`;
                    // Slice Sections
                    const gfx = Array.from(ram.slice(0x0000, 0x2000));
                    const map = Array.from(ram.slice(0x2000, 0x3000));
                    const gfxFlags = Array.from(ram.slice(0x3000, 0x3100));
                    const music = Array.from(ram.slice(0x3100, 0x3200));
                    const sfx = Array.from(ram.slice(0x3200, 0x4300));
                    const codeStart = 0x4300;
                    // Decode Code
                    let code = "";
                    // Check Header
                    if (ram[codeStart] === 0x3a && ram[codeStart + 1] === 0x63 && ram[codeStart + 2] === 0x3a && ram[codeStart + 3] === 0x00) {
                        // :c: compression (legacy LZSS)
                        code = Pico8Decoder.decompressLZSS(ram.slice(codeStart + 4));
                    }
                    else if (ram[codeStart] === 0x00 && ram[codeStart + 1] === 0x70 && ram[codeStart + 2] === 0x78 && ram[codeStart + 3] === 0x61) {
                        // \0pxa (new PXA compression)
                        code = Pico8Decoder.decompressPXA(ram.slice(codeStart + 4));
                    }
                    else {
                        // Raw
                        code = Pico8Decoder.readRaw(ram.slice(codeStart));
                    }
                    resolve({
                        code,
                        gfx,
                        map,
                        gfxFlags,
                        music,
                        sfx,
                        label
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
    static decompressPXA(buffer) {
        // PXA compression format (PICO-8 v0.2.0+)
        // After header "\0pxa":
        // - 2 bytes: decompressed length (MSB first / big-endian)
        // - 2 bytes: compressed length + 8 (MSB first / big-endian)
        // - bitstream data (bits read LSB to MSB within each byte)
        if (buffer.length < 4) {
            return "-- Empty PXA data";
        }
        const uncompressedLen = (buffer[0] << 8) | buffer[1];
        // const compressedLen = (buffer[2] << 8) | buffer[3]; // Not needed for decompression
        // Initialize MTF table with identity mapping (0→0, 1→1, ..., 255→255)
        const mtfTable = [];
        for (let i = 0; i < 256; i++) {
            mtfTable.push(i);
        }
        // Bit reader - LSB to MSB order within each byte
        let bitPos = 0;
        const dataStart = 4;
        const getBit = () => {
            const byteIdx = dataStart + (bitPos >> 3);
            if (byteIdx >= buffer.length)
                return 0;
            // LSB to MSB: bit 0 is least significant
            const bit = (buffer[byteIdx] >> (bitPos & 7)) & 1;
            bitPos++;
            return bit;
        };
        const getBits = (n) => {
            let val = 0;
            for (let i = 0; i < n; i++) {
                // LSB first: each new bit goes to higher position
                val |= (getBit() << i);
            }
            return val;
        };
        const output = [];
        while (output.length < uncompressedLen) {
            const headerBit = getBit();
            if (headerBit === 1) {
                // Literal character
                // Read unary prefix: count consecutive 1-bits until 0
                let unary = 0;
                while (getBit() === 1) {
                    unary++;
                }
                // Calculate index: read (4 + unary) bits, add mask offset
                const unaryMask = (1 << unary) - 1;
                const index = getBits(4 + unary) + (unaryMask << 4);
                if (index >= 256)
                    break;
                const charCode = mtfTable[index];
                output.push(charCode);
                // Move to front
                if (index > 0) {
                    mtfTable.splice(index, 1);
                    mtfTable.unshift(charCode);
                }
            }
            else {
                // Copy reference
                // Determine offset bit width: 15, 10, or 5 bits
                let offsetBits;
                if (getBit() === 0) {
                    offsetBits = 15;
                }
                else if (getBit() === 0) {
                    offsetBits = 10;
                }
                else {
                    offsetBits = 5;
                }
                const offset = getBits(offsetBits) + 1;
                // Check for uncompressed block signal (offset_bits == 10 && offset == 1)
                if (offsetBits === 10 && offset === 1) {
                    // Read raw 8-bit characters until null byte
                    while (output.length < uncompressedLen) {
                        const rawChar = getBits(8);
                        if (rawChar === 0)
                            break;
                        output.push(rawChar);
                    }
                    continue;
                }
                // Read length: base 3, add 3-bit chunks until chunk != 7
                let length = 3;
                let part;
                do {
                    part = getBits(3);
                    length += part;
                } while (part === 7);
                // Copy from back-reference
                if (offset > output.length) {
                    // Invalid reference, fill with zeros
                    for (let k = 0; k < length && output.length < uncompressedLen; k++) {
                        output.push(0);
                    }
                }
                else {
                    const start = output.length - offset;
                    for (let k = 0; k < length && output.length < uncompressedLen; k++) {
                        output.push(output[start + k]);
                    }
                }
            }
        }
        return String.fromCharCode(...output);
    }
}
//# sourceMappingURL=extension.js.map