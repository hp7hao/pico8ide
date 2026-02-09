import * as vscode from 'vscode';
import { CartData, PICO8_PALETTE } from './cartData';
import { LocaleStrings } from './i18n';

export interface CartViewerOptions {
    cartData: CartData;
    locale: LocaleStrings;
    extensionUri: vscode.Uri;
    webview: vscode.Webview;
    gameName?: string;
    showRunButton?: boolean;
    showConvertBanner?: boolean;
    showAudio?: boolean;
    editable?: boolean;
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function generateCartViewerHtml(options: CartViewerOptions): string {
    const { cartData, locale, extensionUri, webview, gameName, showRunButton, showConvertBanner, showAudio, editable } = options;

    const nonce = getNonce();

    const monacoBase = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'monaco'));

    const gfxJson = JSON.stringify(cartData.gfx);
    const mapJson = JSON.stringify(cartData.map);
    const flagsJson = JSON.stringify(cartData.gfxFlags);
    const sfxJson = JSON.stringify(cartData.sfx);
    const musicJson = JSON.stringify(cartData.music);
    const palJson = JSON.stringify(PICO8_PALETTE);

    // Escape code for embedding in a JS string literal (inside <script>)
    const codeForJs = JSON.stringify(cartData.code);

    const title = gameName ? `PICO-8 Cart: ${gameName}` : 'PICO-8 Cart';

    // Build conditional HTML pieces
    const bannerHtml = showConvertBanner ? `
                <div class="convert-banner">
                    <span>${locale.convertBanner}</span>
                    <button id="btn-convert">${locale.convertButton}</button>
                </div>` : '';

    const runButtonHtml = showRunButton ? `
                    <div class="tab-spacer"></div>
                    <button id="btn-run-pico8" class="run-btn idle">&#9654; ${locale.runInPico8}</button>` : '';

    // CSP
    const csp = `default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; worker-src blob:; img-src ${webview.cspSource};`;

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; flex-direction: column; height: 100vh; margin: 0; padding: 0; overflow: hidden; }

                    .convert-banner { background: #3a3500; border-bottom: 2px solid #ffec27; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; }
                    .convert-banner span { color: #ffec27; font-size: 13px; }
                    .convert-banner button { background: #ffec27; color: #111; border: none; padding: 6px 16px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: bold; }
                    .convert-banner button:hover { background: #fff170; }

                    .tab-header { display: flex; background: #252525; align-items: center; }
                    .tab { padding: 8px 16px; cursor: pointer; background: #222; }
                    .tab:hover { background: #2a2a2a; }
                    .tab.active { background: #1a1a1a; color: #fff; font-weight: bold; }
                    .tab-spacer { flex: 1; }
                    .run-btn { margin-right: 10px; padding: 4px 12px; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 12px; }
                    .run-btn.idle { background: #2a5a2a; color: #6f6; }
                    .run-btn.idle:hover { background: #3a6a3a; }
                    .run-btn.running { background: #5a2a2a; color: #f66; }
                    .run-btn.running:hover { background: #6a3a3a; }

                    .content { flex: 1; overflow: auto; display: none; padding: 0; min-height: 0; }
                    .content.active { display: flex; flex-direction: column; }
                    #tab-gfx.content.active { overflow: hidden; }
                    #tab-map.content.active { overflow: hidden; }

                    /* Monaco container */
                    #monaco-container { flex: 1; width: 100%; min-height: 0; overflow: hidden; }

                    /* Sprites */
                    .sprite-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .sprite-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .sprite-toolbar .tool-btn { background: #333; border: 1px solid #444; color: #ccc; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; }
                    .sprite-toolbar .tool-btn:hover { background: #444; }
                    .sprite-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: #fff; }
                    .sprite-toolbar .tool-sep { width: 1px; height: 20px; background: #444; margin: 0 4px; }
                    .sprite-toolbar .zoom-group { margin-left: auto; display: flex; align-items: center; gap: 4px; }
                    .sprite-toolbar .zoom-label { color: #888; font-size: 11px; min-width: 28px; text-align: center; }
                    .sprite-toolbar .pal-swatch { width: 18px; height: 18px; border: 2px solid transparent; border-radius: 2px; cursor: pointer; box-sizing: border-box; display: inline-block; }
                    .sprite-toolbar .pal-swatch:hover { border-color: #888; }
                    .sprite-toolbar .pal-swatch.fg-active { border-color: #fff; box-shadow: 0 0 0 1px #fff; }
                    .sprite-toolbar .pal-swatch.bg-active { border-color: #ff004d; border-style: dashed; }
                    .sprite-toolbar .pal-info { color: #888; font-size: 11px; margin-left: 4px; margin-right: 4px; }
                    .sprite-canvas-wrap { flex: 1; overflow: hidden; position: relative; cursor: crosshair; }
                    #cvs-gfx { image-rendering: pixelated; position: absolute; top: 0; left: 0; background: #000; }
                    #cvs-gfx-overlay { position: absolute; top: 0; left: 0; pointer-events: none; background: transparent; }
                    .sprite-status { display: flex; align-items: center; padding: 2px 8px; background: #1a1a1a; border-top: 1px solid #333; color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }
                    .sprite-toolbar .flag-group { display: flex; align-items: center; gap: 2px; }
                    .sprite-toolbar .flag-btn { width: 18px; height: 18px; border-radius: 3px; border: 1px solid #444; cursor: pointer; opacity: 0.35; transition: opacity 0.1s; padding: 0; }
                    .sprite-toolbar .flag-btn:hover { opacity: 0.7; }
                    .sprite-toolbar .flag-btn.active { opacity: 1; border-color: #fff; }
                    .sprite-toolbar .flag-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #444; cursor: pointer; opacity: 0.3; box-sizing: border-box; padding: 0; background: transparent; display: inline-block; }
                    .sprite-toolbar .flag-dot:hover { opacity: 0.7; }
                    .sprite-toolbar .flag-dot.set { opacity: 1; border-color: #fff; }
                    .quick-palette { position: absolute; display: none; background: #222; border: 1px solid #555; border-radius: 4px; padding: 4px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
                    .quick-palette .qp-swatch { width: 24px; height: 24px; display: inline-block; cursor: pointer; border: 1px solid #333; box-sizing: border-box; }
                    .quick-palette .qp-swatch:hover { border-color: #fff; }
                    .sprite-sheet-container { display: flex; justify-content: center; padding: 20px; background: #1a1a1a; }
                    canvas { image-rendering: pixelated; border: 1px solid #333; background: #000; }

                    /* Map Editor */
                    .map-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .map-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .map-toolbar .tool-btn { background: #333; border: 1px solid #444; color: #ccc; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; }
                    .map-toolbar .tool-btn:hover { background: #444; }
                    .map-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: #fff; }
                    .map-toolbar .tool-sep { width: 1px; height: 20px; background: #444; margin: 0 4px; }
                    .map-toolbar .zoom-group { margin-left: auto; display: flex; align-items: center; gap: 4px; }
                    .map-toolbar .zoom-label { color: #888; font-size: 11px; min-width: 28px; text-align: center; }
                    .map-toolbar .tile-preview { width: 18px; height: 18px; image-rendering: pixelated; border: 1px solid #555; cursor: pointer; vertical-align: middle; }
                    .map-toolbar .tile-info { color: #888; font-size: 11px; margin-left: 4px; margin-right: 4px; }
                    .map-canvas-wrap { flex: 1; overflow: hidden; position: relative; cursor: crosshair; }
                    #cvs-map { image-rendering: pixelated; position: absolute; top: 0; left: 0; background: #000; }
                    #cvs-map-overlay { position: absolute; top: 0; left: 0; pointer-events: none; background: transparent; }
                    .map-status { display: flex; align-items: center; padding: 2px 8px; background: #1a1a1a; border-top: 1px solid #333; color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }
                    .map-tile-picker { position: absolute; inset: 0; display: none; background: rgba(0,0,0,0.5); z-index: 100; overflow: hidden; cursor: crosshair; }
                    .map-tile-picker canvas { image-rendering: pixelated; position: absolute; top: 0; left: 0; cursor: crosshair; }

                    /* SFX Editor Styles */
                    .sfx-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .sfx-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .sfx-toolbar .tool-btn { background: #333; border: 1px solid #444; color: #ccc; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; }
                    .sfx-toolbar .tool-btn:hover { background: #444; }
                    .sfx-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: #fff; }
                    .sfx-toolbar .tool-sep { width: 1px; height: 20px; background: #444; margin: 0 4px; }
                    .sfx-toolbar .sfx-label { color: #888; font-size: 11px; margin: 0 4px; }
                    .sfx-toolbar .sfx-val { color: #fff; font-size: 11px; min-width: 20px; text-align: center; display: inline-block; }
                    .sfx-body { display: flex; flex: 1; min-height: 0; }
                    .sfx-list { width: 160px; border-right: 1px solid #333; overflow-y: auto; flex-shrink: 0; }
                    .sfx-item { padding: 4px 8px; cursor: pointer; border-bottom: 1px solid #222; font-size: 11px; display: flex; align-items: center; gap: 4px; }
                    .sfx-item:hover { background: #2a2a2a; }
                    .sfx-item.active { background: #3a3a5a; }
                    .sfx-item.empty { opacity: 0.4; }
                    .sfx-item .play-btn { background: #4a4; border: none; color: #fff; padding: 1px 5px; border-radius: 3px; cursor: pointer; font-size: 9px; }
                    .sfx-item .play-btn:hover { background: #5b5; }
                    .sfx-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
                    .sfx-canvas-wrap { flex: 1; position: relative; overflow: hidden; cursor: crosshair; }
                    #cvs-sfx-bars { image-rendering: pixelated; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
                    .sfx-tracker-wrap { flex: 1; overflow: auto; display: none; }
                    .sfx-tracker-wrap.active { display: block; }
                    .sfx-tracker { font-family: monospace; font-size: 11px; background: #1a1a1a; border: 1px solid #333; }
                    .sfx-tracker-header { display: flex; background: #252525; border-bottom: 1px solid #333; padding: 4px; }
                    .sfx-tracker-header span { flex: 1; text-align: center; font-weight: bold; font-size: 10px; color: #888; }
                    .sfx-note { display: flex; border-bottom: 1px solid #222; cursor: pointer; }
                    .sfx-note:hover { background: #252530; }
                    .sfx-note.playing { background: #3a4a3a; }
                    .sfx-note.selected { background: #3a3a5a; }
                    .sfx-note span { flex: 1; text-align: center; padding: 2px 4px; }
                    .sfx-note .note-idx { color: #666; width: 30px; flex: none; }
                    .sfx-note .note-pitch { color: #6cf; }
                    .sfx-note .note-wave { color: #fc6; }
                    .sfx-note .note-vol { color: #6f6; }
                    .sfx-note .note-fx { color: #f6c; }
                    .sfx-status { display: flex; align-items: center; padding: 2px 8px; background: #1a1a1a; border-top: 1px solid #333; color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }

                    /* Music Editor Styles */
                    .music-editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                    .music-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #1e1e1e; border-bottom: 1px solid #333; flex-shrink: 0; flex-wrap: wrap; }
                    .music-toolbar .tool-btn { background: #333; border: 1px solid #555; color: #ccc; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 12px; min-width: 24px; text-align: center; }
                    .music-toolbar .tool-btn:hover { background: #444; }
                    .music-toolbar .tool-btn.active { background: #29adff; color: #fff; border-color: #29adff; }
                    .music-toolbar .sep { width: 1px; height: 20px; background: #444; flex-shrink: 0; }
                    .music-toolbar .label { color: #888; font-size: 11px; }
                    .music-toolbar .value { color: #fff; font-size: 12px; min-width: 20px; text-align: center; }
                    .music-pattern-editor { padding: 12px 10px; background: #1a1a1a; border-bottom: 1px solid #333; flex-shrink: 0; }
                    .music-channels { display: flex; gap: 8px; margin-bottom: 10px; }
                    .music-ch { flex: 1; background: #222; border: 1px solid #444; border-radius: 4px; padding: 8px; text-align: center; }
                    .music-ch.disabled { opacity: 0.4; }
                    .music-ch.ch-selected { border-color: #29adff; background: #1a2a3a; }
                    .music-ch-label { font-size: 11px; color: #888; margin-bottom: 6px; }
                    .music-ch-toggle { cursor: pointer; margin-right: 4px; }
                    .music-ch-sfx { display: flex; align-items: center; justify-content: center; gap: 4px; }
                    .music-ch-sfx .tool-btn { background: #333; border: 1px solid #555; color: #ccc; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 11px; }
                    .music-ch-sfx .tool-btn:hover { background: #444; }
                    .music-ch-sfx .sfx-val { color: #6cf; font-size: 14px; font-weight: bold; min-width: 24px; text-align: center; cursor: pointer; }
                    .music-ch-sfx .sfx-val:hover { text-decoration: underline; }
                    .music-ch-sfx .sfx-val.muted { color: #555; }
                    .music-flags { display: flex; gap: 8px; align-items: center; }
                    .music-flags .flag-btn { background: #222; border: 2px solid #555; color: #888; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 11px; }
                    .music-flags .flag-btn:hover { background: #2a2a2a; }
                    .music-flags .flag-btn.loop-start-on { border-color: #00e436; color: #00e436; background: #0a2a0a; }
                    .music-flags .flag-btn.loop-end-on { border-color: #ff004d; color: #ff004d; background: #2a0a0a; }
                    .music-flags .flag-btn.stop-on { border-color: #ffec27; color: #ffec27; background: #2a2a0a; }
                    .music-navigator { flex: 1; overflow: auto; padding: 8px 10px; background: #111; }
                    .music-nav-grid { display: flex; flex-wrap: wrap; gap: 2px; }
                    .music-nav-cell { width: 36px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #888; background: #1a1a1a; border: 1px solid #333; border-radius: 2px; cursor: pointer; box-sizing: border-box; }
                    .music-nav-cell:hover { background: #252525; }
                    .music-nav-cell.selected { background: #29adff; color: #fff; border-color: #29adff; }
                    .music-nav-cell.non-empty { color: #ccc; }
                    .music-nav-cell.empty { opacity: 0.35; }
                    .music-nav-cell.loop-start { border-left: 3px solid #00e436; }
                    .music-nav-cell.loop-end { border-right: 3px solid #ff004d; }
                    .music-nav-cell.stop-end { border-bottom: 3px solid #ffec27; }
                    .music-nav-cell.playing { background: #2a3a2a; border-color: #4a4; animation: music-pulse 0.5s ease-in-out infinite alternate; }
                    @keyframes music-pulse { from { background: #2a3a2a; } to { background: #3a5a3a; } }
                    .music-sfx-picker { padding: 8px 10px; background: #1a1a1a; border-top: 1px solid #333; flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
                    .music-sfx-picker-label { font-size: 11px; color: #888; margin-bottom: 6px; flex-shrink: 0; }
                    .music-sfx-picker-label .ch-num { color: #6cf; font-weight: bold; }
                    .music-sfx-grid { display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); gap: 2px; flex: 1; min-height: 0; }
                    .music-sfx-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; color: #888; background: #222; border: 1px solid #333; border-radius: 2px; cursor: pointer; box-sizing: border-box; min-height: 0; position: relative; gap: 2px; }
                    .music-sfx-cell:hover { background: #333; }
                    .music-sfx-cell.non-empty { color: #ccc; }
                    .music-sfx-cell.selected { background: #29adff; color: #fff; border-color: #29adff; }
                    .music-sfx-cell .sfx-play-btn { display: none; font-size: 9px; color: #888; cursor: pointer; padding: 0 2px; }
                    .music-sfx-cell.non-empty .sfx-play-btn { display: block; }
                    .music-sfx-cell .sfx-play-btn:hover { color: #fff; }
                    .music-sfx-cell.selected .sfx-play-btn { color: rgba(255,255,255,0.6); }
                    .music-sfx-cell.selected .sfx-play-btn:hover { color: #fff; }
                    .music-sfx-cell.sfx-playing { background: #2a3a2a; border-color: #4a4; }
                    .music-status { display: flex; align-items: center; padding: 2px 8px; background: #1a1a1a; border-top: 1px solid #333; color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }
                </style>
            </head>
            <body>
                ${bannerHtml}
                <div class="tab-header">
                    <div class="tab active" data-tab="code">${locale.tabCode}</div>
                    <div class="tab" data-tab="gfx">${locale.tabSprites}</div>
                    <div class="tab" data-tab="map">${locale.tabMap}</div>
                    <div class="tab" data-tab="sfx">${locale.tabSfx}</div>
                    <div class="tab" data-tab="music">${locale.tabMusic}</div>
                    ${runButtonHtml}
                </div>

                <div id="tab-code" class="content active">
                    <div id="monaco-container"></div>
                </div>

                <div id="tab-gfx" class="content">
                    <div class="sprite-editor" id="sprite-editor">
                        <div class="sprite-toolbar" id="sprite-toolbar"></div>
                        <div class="sprite-canvas-wrap" id="sprite-canvas-wrap">
                            <canvas id="cvs-gfx" width="128" height="128"></canvas>
                            <canvas id="cvs-gfx-overlay" width="128" height="128"></canvas>
                            <div class="quick-palette" id="quick-palette"></div>
                        </div>
                        <div class="sprite-status" id="sprite-status"></div>
                    </div>
                </div>

                <div id="tab-map" class="content">
                    <div class="map-editor" id="map-editor">
                        <div class="map-toolbar" id="map-toolbar"></div>
                        <div class="map-canvas-wrap" id="map-canvas-wrap">
                            <canvas id="cvs-map" width="1024" height="512"></canvas>
                            <canvas id="cvs-map-overlay" width="1024" height="512"></canvas>
                            <div class="map-tile-picker" id="map-tile-picker"></div>
                        </div>
                        <div class="map-status" id="map-status"></div>
                    </div>
                </div>

                 <div id="tab-sfx" class="content">
                    <div class="sfx-editor" id="sfx-editor">
                        <div class="sfx-toolbar" id="sfx-toolbar"></div>
                        <div class="sfx-body">
                            <div class="sfx-list" id="sfx-list"></div>
                            <div class="sfx-main" id="sfx-main">
                                <div class="sfx-canvas-wrap" id="sfx-canvas-wrap">
                                    <canvas id="cvs-sfx-bars" width="640" height="320"></canvas>
                                </div>
                                <div class="sfx-tracker-wrap" id="sfx-tracker-wrap"></div>
                            </div>
                        </div>
                        <div class="sfx-status" id="sfx-status"></div>
                    </div>
                 </div>
                 <div id="tab-music" class="content">
                    <div class="music-editor" id="music-editor">
                        <div class="music-toolbar" id="music-toolbar"></div>
                        <div class="music-pattern-editor" id="music-pattern-editor"></div>
                        <div class="music-navigator" id="music-navigator"></div>
                        <div class="music-sfx-picker" id="music-sfx-picker"></div>
                        <div class="music-status" id="music-status-bar"></div>
                    </div>
                 </div>

                <script nonce="${nonce}">
                    const vscodeApi = acquireVsCodeApi();
                    const MONACO_BASE = "${monacoBase}";
                    const CODE = ${codeForJs};
                    const EDITABLE = ${!!editable};
                    const SHOW_AUDIO = ${!!showAudio};
                    const SHOW_RUN_BUTTON = ${!!showRunButton};

                    const GFX = ${gfxJson};
                    const MAP = ${mapJson};
                    const FLAGS = ${flagsJson};
                    const SFX = ${sfxJson};
                    const MUSIC = ${musicJson};
                    const PAL = ${palJson};

                    const LOCALE = {
                        play: "${locale.play}",
                        stop: "${locale.stop}",
                        playMusic: "${locale.playMusic}",
                        speed: "${locale.speed}",
                        loop: "${locale.loop}",
                        playingPattern: "${locale.playingPattern}",
                        empty: "${locale.empty}",
                        runInPico8: "${locale.runInPico8}",
                        stopGame: "${locale.stopGame}",
                        toolPencil: "${locale.toolPencil}",
                        toolFill: "${locale.toolFill}",
                        toolRectangle: "${locale.toolRectangle}",
                        toolCircle: "${locale.toolCircle}",
                        toolLine: "${locale.toolLine}",
                        toolSelect: "${locale.toolSelect}",
                        toolHand: "${locale.toolHand}",
                        zoomIn: "${locale.zoomIn}",
                        zoomOut: "${locale.zoomOut}",
                        zoomFit: "${locale.zoomFit}",
                        foreground: "${locale.foreground}",
                        background: "${locale.background}",
                        position: "${locale.position}",
                        spriteLabel: "${locale.spriteLabel}",
                        undo: "${locale.undo}",
                        redo: "${locale.redo}",
                        flagLabel: "${locale.flagLabel}",
                        flagsLabel: "${locale.flagsLabel}",
                        tileLabel: "${locale.tileLabel}",
                        tilePicker: "${locale.tilePicker}"
                    };

                    const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
                    const WAVEFORMS = ['sine', 'tri', 'saw', 'sqr', 'pulse', 'ring', 'noise', 'ring2'];
                    const EFFECTS = ['none', 'slide', 'vib', 'drop', 'fadein', 'fadeout', 'arpF', 'arpS'];

                    // ============ MONACO EDITOR ============
                    var monacoEditor = null;

                    // ============ TAB SWITCHING ============
                    function showTab(id, el) {
                        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
                        document.querySelectorAll('.content').forEach(function(c) { c.classList.remove('active'); });
                        el.classList.add('active');
                        document.getElementById('tab-' + id).classList.add('active');

                        if (id === 'code' && monacoEditor) {
                            setTimeout(function() { monacoEditor.layout(); }, 0);
                        } else if (id === 'gfx') {
                            renderGfx();
                        } else if (id === 'map') {
                            initMapEditor();
                        } else if (id === 'sfx') {
                            initSfxEditor();
                        } else if (id === 'music') {
                            initMusicEditor();
                        }
                    }

                    // Wire up tab click handlers (cannot use inline onclick with nonce CSP)
                    document.querySelectorAll('.tab[data-tab]').forEach(function(tab) {
                        tab.addEventListener('click', function() {
                            showTab(tab.getAttribute('data-tab'), tab);
                        });
                    });

                    // Wire up convert banner button
                    var btnConvert = document.getElementById('btn-convert');
                    if (btnConvert) {
                        btnConvert.addEventListener('click', function() {
                            vscodeApi.postMessage({type: 'convert'});
                        });
                    }

                    // Wire up run button
                    var btnRun = document.getElementById('btn-run-pico8');
                    if (btnRun) {
                        btnRun.addEventListener('click', function() {
                            toggleRunPico8();
                        });
                    }

                    // ============ SPRITES / MAP / SFX / MUSIC RENDERING ============
                    function setPixel(imgData, x, y, c) {
                        var idx = (y * 128 + x) * 4;
                        var hex = PAL[c & 15];
                        var r = parseInt(hex.substr(1,2), 16);
                        var g = parseInt(hex.substr(3,2), 16);
                        var b = parseInt(hex.substr(5,2), 16);
                        imgData.data[idx] = r; imgData.data[idx+1] = g; imgData.data[idx+2] = b; imgData.data[idx+3] = 255;
                    }

                    function renderGfx() {
                        initSpriteEditor();
                    }

                    ${getSpriteEditorScript()}

                    ${getMapEditorScript()}

                    function getSprite(spriteIdx) {
                        var sx = (spriteIdx % 16) * 8;
                        var sy = Math.floor(spriteIdx / 16) * 8;
                        var pixels = [];
                        for (var py = 0; py < 8; py++) {
                            for (var px = 0; px < 8; px++) {
                                var x = sx + px, y = sy + py;
                                var byteIdx = y * 64 + Math.floor(x / 2);
                                var b = GFX[byteIdx] || 0;
                                pixels.push((x % 2 === 0) ? (b & 0x0f) : ((b >> 4) & 0x0f));
                            }
                        }
                        return pixels;
                    }

                    function pitchToNote(pitch) {
                        if (pitch === 0) return '...';
                        var octave = Math.floor(pitch / 12);
                        var note = pitch % 12;
                        return NOTE_NAMES[note] + octave;
                    }

                    function parseSfx(sfxId) {
                        var offset = sfxId * 68;
                        var notes = [];
                        for (var i = 0; i < 32; i++) {
                            var lo = SFX[offset + i * 2] || 0;
                            var hi = SFX[offset + i * 2 + 1] || 0;
                            notes.push({
                                pitch: lo & 0x3f,
                                waveform: ((lo >> 6) & 0x03) | ((hi & 0x01) << 2),
                                volume: (hi >> 1) & 0x07,
                                effect: (hi >> 4) & 0x07,
                                customWave: (hi >> 7) & 0x01
                            });
                        }
                        var speed = SFX[offset + 65] || 0;
                        var loopStart = SFX[offset + 66] || 0;
                        var loopEnd = SFX[offset + 67] || 0;
                        var isEmpty = notes.every(function(n) { return n.volume === 0; });
                        return { notes: notes, speed: speed, loopStart: loopStart, loopEnd: loopEnd, isEmpty: isEmpty };
                    }

                    // ============ SFX EDITOR ============
                    var sfxEditorInited = false;
                    var sfxCurrentId = 0;
                    var sfxMode = 'bar'; // 'bar' or 'tracker'
                    var sfxBrushWave = 0;
                    var sfxBrushEffect = 0;
                    var sfxHoverNote = -1;
                    var sfxHoverArea = ''; // 'pitch', 'volume', 'effect', ''
                    var sfxIsDrawing = false;
                    var sfxDrawArea = '';
                    var sfxUndoStack = [];
                    var sfxRedoStack = [];
                    var sfxChangedTimer = null;
                    var sfxTrackerRow = -1;
                    var sfxTrackerCol = 0;

                    var WAVE_COLORS = ['#ff77a8', '#29adff', '#00e436', '#ffec27', '#ff6c24', '#a8e6cf', '#83769c', '#fff1e8'];
                    var FX_COLORS = ['#333', '#29adff', '#ff77a8', '#ff004d', '#00e436', '#ffa300', '#ffec27', '#a8e6cf'];

                    function sfxPackNote(note) {
                        var lo = (note.pitch & 0x3f) | ((note.waveform & 0x03) << 6);
                        var hi = ((note.waveform >> 2) & 0x01) | ((note.volume & 0x07) << 1) | ((note.effect & 0x07) << 4) | ((note.customWave & 0x01) << 7);
                        return [lo, hi];
                    }

                    function sfxSetNote(sfxId, noteIdx, field, value) {
                        var offset = sfxId * 68 + noteIdx * 2;
                        var lo = SFX[offset] || 0;
                        var hi = SFX[offset + 1] || 0;
                        var note = {
                            pitch: lo & 0x3f,
                            waveform: ((lo >> 6) & 0x03) | ((hi & 0x01) << 2),
                            volume: (hi >> 1) & 0x07,
                            effect: (hi >> 4) & 0x07,
                            customWave: (hi >> 7) & 0x01
                        };
                        note[field] = value;
                        var packed = sfxPackNote(note);
                        SFX[offset] = packed[0];
                        SFX[offset + 1] = packed[1];
                    }

                    function sfxGetSpeed(sfxId) { return SFX[sfxId * 68 + 65] || 0; }
                    function sfxSetSpeed(sfxId, v) { SFX[sfxId * 68 + 65] = Math.max(0, Math.min(255, v)); }
                    function sfxGetLoopStart(sfxId) { return SFX[sfxId * 68 + 66] || 0; }
                    function sfxSetLoopStart(sfxId, v) { SFX[sfxId * 68 + 66] = Math.max(0, Math.min(31, v)); }
                    function sfxGetLoopEnd(sfxId) { return SFX[sfxId * 68 + 67] || 0; }
                    function sfxSetLoopEnd(sfxId, v) { SFX[sfxId * 68 + 67] = Math.max(0, Math.min(31, v)); }

                    function sfxPushUndo() {
                        var offset = sfxCurrentId * 68;
                        var snap = SFX.slice(offset, offset + 68);
                        sfxUndoStack.push({ id: sfxCurrentId, data: snap });
                        if (sfxUndoStack.length > 50) sfxUndoStack.shift();
                        sfxRedoStack = [];
                    }

                    function sfxDoUndo() {
                        if (sfxUndoStack.length === 0) return;
                        var frame = sfxUndoStack.pop();
                        var offset = frame.id * 68;
                        var current = SFX.slice(offset, offset + 68);
                        sfxRedoStack.push({ id: frame.id, data: current });
                        for (var i = 0; i < 68; i++) SFX[offset + i] = frame.data[i];
                        sfxCurrentId = frame.id;
                        sfxRenderAll();
                        notifySfxChanged();
                    }

                    function sfxDoRedo() {
                        if (sfxRedoStack.length === 0) return;
                        var frame = sfxRedoStack.pop();
                        var offset = frame.id * 68;
                        var current = SFX.slice(offset, offset + 68);
                        sfxUndoStack.push({ id: frame.id, data: current });
                        for (var i = 0; i < 68; i++) SFX[offset + i] = frame.data[i];
                        sfxCurrentId = frame.id;
                        sfxRenderAll();
                        notifySfxChanged();
                    }

                    function notifySfxChanged() {
                        if (sfxChangedTimer) clearTimeout(sfxChangedTimer);
                        sfxChangedTimer = setTimeout(function() {
                            vscodeApi.postMessage({ type: 'sfxChanged', sfx: Array.from(SFX) });
                        }, 100);
                    }

                    // ---- Render bar mode canvas ----
                    function sfxRenderBars() {
                        var cvs = document.getElementById('cvs-sfx-bars');
                        if (!cvs) return;
                        var wrap = document.getElementById('sfx-canvas-wrap');
                        var w = wrap.clientWidth || 640;
                        var h = wrap.clientHeight || 320;
                        cvs.width = w; cvs.height = h;
                        var ctx = cvs.getContext('2d');
                        ctx.fillStyle = '#111';
                        ctx.fillRect(0, 0, w, h);

                        var sfx = parseSfx(sfxCurrentId);
                        var colW = Math.floor(w / 32);
                        var fxH = 16;
                        var volH = Math.floor((h - fxH) * 0.15);
                        var pitchH = h - volH - fxH;
                        var pitchY = 0;
                        var volY = pitchH;
                        var fxY = pitchH + volH;

                        // Loop region shade
                        if (sfx.loopStart < sfx.loopEnd) {
                            ctx.fillStyle = 'rgba(100,200,100,0.07)';
                            ctx.fillRect(sfx.loopStart * colW, 0, (sfx.loopEnd - sfx.loopStart) * colW, h);
                            ctx.strokeStyle = 'rgba(100,200,100,0.3)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(sfx.loopStart * colW + 0.5, 0); ctx.lineTo(sfx.loopStart * colW + 0.5, h);
                            ctx.moveTo(sfx.loopEnd * colW + 0.5, 0); ctx.lineTo(sfx.loopEnd * colW + 0.5, h);
                            ctx.stroke();
                        }

                        // Octave grid lines in pitch area
                        ctx.strokeStyle = '#222';
                        ctx.lineWidth = 1;
                        for (var oct = 1; oct <= 5; oct++) {
                            var y = pitchY + pitchH - (oct * 12 / 63) * pitchH;
                            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
                        }

                        // Area separators
                        ctx.strokeStyle = '#444';
                        ctx.beginPath(); ctx.moveTo(0, volY); ctx.lineTo(w, volY); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(0, fxY); ctx.lineTo(w, fxY); ctx.stroke();

                        // Draw bars
                        for (var i = 0; i < 32; i++) {
                            var n = sfx.notes[i];
                            var x = i * colW;

                            // Pitch bar
                            if (n.volume > 0 && n.pitch > 0) {
                                var barH = (n.pitch / 63) * pitchH;
                                var alpha = 0.4 + (n.volume / 7) * 0.6;
                                ctx.globalAlpha = alpha;
                                ctx.fillStyle = WAVE_COLORS[n.waveform] || WAVE_COLORS[0];
                                ctx.fillRect(x + 1, pitchY + pitchH - barH, colW - 2, barH);
                                ctx.globalAlpha = 1;
                            } else if (n.pitch > 0) {
                                // Volume 0 — dim ghost bar
                                var barH2 = (n.pitch / 63) * pitchH;
                                ctx.globalAlpha = 0.15;
                                ctx.fillStyle = WAVE_COLORS[n.waveform] || WAVE_COLORS[0];
                                ctx.fillRect(x + 1, pitchY + pitchH - barH2, colW - 2, barH2);
                                ctx.globalAlpha = 1;
                            }

                            // Volume mini-bar
                            if (n.volume > 0) {
                                var vBarH = (n.volume / 7) * (volH - 2);
                                ctx.fillStyle = '#00e436';
                                ctx.fillRect(x + 1, volY + volH - vBarH - 1, colW - 2, vBarH);
                            }

                            // Effect cell
                            if (n.effect > 0) {
                                ctx.fillStyle = FX_COLORS[n.effect] || FX_COLORS[0];
                                ctx.fillRect(x + 1, fxY + 1, colW - 2, fxH - 2);
                            }

                            // Column separator
                            ctx.strokeStyle = '#1a1a1a';
                            ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
                        }

                        // Hover highlight
                        if (sfxHoverNote >= 0 && sfxHoverNote < 32) {
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(sfxHoverNote * colW + 0.5, 0.5, colW - 1, h - 1);
                        }
                    }

                    // ---- Render tracker mode ----
                    function sfxRenderTracker() {
                        var wrap = document.getElementById('sfx-tracker-wrap');
                        if (!wrap) return;
                        var sfx = parseSfx(sfxCurrentId);
                        var html = '<div class="sfx-tracker"><div class="sfx-tracker-header"><span>#</span><span>Note</span><span>Wave</span><span>Vol</span><span>FX</span></div>';
                        for (var i = 0; i < 32; i++) {
                            var n = sfx.notes[i];
                            var cls = 'sfx-note';
                            if (i === sfxTrackerRow) cls += ' selected';
                            html += '<div class="' + cls + '" data-idx="' + i + '">';
                            html += '<span class="note-idx">' + i.toString().padStart(2, '0') + '</span>';
                            html += '<span class="note-pitch">' + pitchToNote(n.pitch) + '</span>';
                            html += '<span class="note-wave">' + (n.customWave ? 'C' + n.waveform : WAVEFORMS[n.waveform]) + '</span>';
                            html += '<span class="note-vol">' + n.volume + '</span>';
                            html += '<span class="note-fx">' + EFFECTS[n.effect] + '</span>';
                            html += '</div>';
                        }
                        html += '</div>';
                        wrap.innerHTML = html;

                        // Click to select row
                        wrap.querySelectorAll('.sfx-note').forEach(function(el) {
                            el.addEventListener('mousedown', function() {
                                sfxTrackerRow = parseInt(el.dataset.idx);
                                sfxRenderTracker();
                            });
                        });
                    }

                    // ---- SFX list ----
                    function sfxRenderList() {
                        var container = document.getElementById('sfx-list');
                        container.innerHTML = '';
                        for (var i = 0; i < 64; i++) {
                            var sfx = parseSfx(i);
                            var div = document.createElement('div');
                            div.className = 'sfx-item' + (sfx.isEmpty ? ' empty' : '') + (i === sfxCurrentId ? ' active' : '');
                            ${showAudio ? `
                            if (!sfx.isEmpty) {
                                var playBtn = document.createElement('button');
                                playBtn.className = 'play-btn';
                                playBtn.textContent = '\\u25b6';
                                (function(sfxIdx, btn) {
                                    btn.onclick = function(e) {
                                        e.stopPropagation();
                                        if (btn.classList.contains('is-playing')) {
                                            stopSfx();
                                        } else {
                                            currentSfxPlayer = playSfx(sfxIdx, function(noteIdx) {
                                                sfxHighlightPlayingNote(noteIdx);
                                            });
                                            if (currentSfxPlayer) {
                                                btn.textContent = '\\u23f9';
                                                btn.classList.add('is-playing');
                                            }
                                        }
                                    };
                                })(i, playBtn);
                                div.appendChild(playBtn);
                            }
                            ` : ''}
                            var label = document.createElement('span');
                            label.textContent = 'SFX ' + i.toString().padStart(2, '0') + (sfx.isEmpty ? '' : ' spd:' + sfx.speed);
                            div.appendChild(label);
                            (function(idx) {
                                div.onclick = function() {
                                    sfxCurrentId = idx;
                                    sfxRenderAll();
                                };
                            })(i);
                            container.appendChild(div);
                        }
                    }

                    function sfxHighlightPlayingNote(noteIdx) {
                        // For both bar and tracker modes
                        sfxHoverNote = noteIdx;
                        if (sfxMode === 'bar') sfxRenderBars();
                        if (sfxMode === 'tracker') {
                            document.querySelectorAll('.sfx-note').forEach(function(el) { el.classList.remove('playing'); });
                            var noteEl = document.querySelector('.sfx-note[data-idx="' + noteIdx + '"]');
                            if (noteEl) noteEl.classList.add('playing');
                        }
                    }

                    // ---- Toolbar ----
                    function sfxRenderToolbar() {
                        var tb = document.getElementById('sfx-toolbar');
                        tb.innerHTML = '';

                        // Mode toggle
                        var barBtn = document.createElement('button');
                        barBtn.className = 'tool-btn' + (sfxMode === 'bar' ? ' active' : '');
                        barBtn.textContent = '\\u2581\\u2583\\u2585\\u2587';
                        barBtn.title = 'Bar mode (Tab)';
                        barBtn.onclick = function() { sfxMode = 'bar'; sfxUpdateMode(); };
                        tb.appendChild(barBtn);

                        var trkBtn = document.createElement('button');
                        trkBtn.className = 'tool-btn' + (sfxMode === 'tracker' ? ' active' : '');
                        trkBtn.textContent = '\\u2261';
                        trkBtn.title = 'Tracker mode (Tab)';
                        trkBtn.onclick = function() { sfxMode = 'tracker'; sfxUpdateMode(); };
                        tb.appendChild(trkBtn);

                        var sep0 = document.createElement('span'); sep0.className = 'tool-sep'; tb.appendChild(sep0);

                        // SFX selector
                        var prevBtn = document.createElement('button');
                        prevBtn.className = 'tool-btn'; prevBtn.textContent = '\\u25c0'; prevBtn.title = 'Previous SFX (-)';
                        prevBtn.onclick = function() { sfxCurrentId = (sfxCurrentId - 1 + 64) % 64; sfxRenderAll(); };
                        tb.appendChild(prevBtn);

                        var idLabel = document.createElement('span');
                        idLabel.className = 'sfx-val';
                        idLabel.textContent = sfxCurrentId.toString().padStart(2, '0');
                        tb.appendChild(idLabel);

                        var nextBtn = document.createElement('button');
                        nextBtn.className = 'tool-btn'; nextBtn.textContent = '\\u25b6'; nextBtn.title = 'Next SFX (+)';
                        nextBtn.onclick = function() { sfxCurrentId = (sfxCurrentId + 1) % 64; sfxRenderAll(); };
                        tb.appendChild(nextBtn);

                        var sep1 = document.createElement('span'); sep1.className = 'tool-sep'; tb.appendChild(sep1);

                        // Speed
                        var spdLabel = document.createElement('span'); spdLabel.className = 'sfx-label'; spdLabel.textContent = 'SPD'; tb.appendChild(spdLabel);
                        var spdDown = document.createElement('button'); spdDown.className = 'tool-btn'; spdDown.textContent = '\\u25c0';
                        spdDown.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetSpeed(sfxCurrentId, sfxGetSpeed(sfxCurrentId) - 1); sfxRenderToolbar(); notifySfxChanged(); };
                        tb.appendChild(spdDown);
                        var spdVal = document.createElement('span'); spdVal.className = 'sfx-val'; spdVal.textContent = sfxGetSpeed(sfxCurrentId).toString(); tb.appendChild(spdVal);
                        var spdUp = document.createElement('button'); spdUp.className = 'tool-btn'; spdUp.textContent = '\\u25b6';
                        spdUp.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetSpeed(sfxCurrentId, sfxGetSpeed(sfxCurrentId) + 1); sfxRenderToolbar(); notifySfxChanged(); };
                        tb.appendChild(spdUp);

                        var sep2 = document.createElement('span'); sep2.className = 'tool-sep'; tb.appendChild(sep2);

                        // Loop
                        var ls = sfxGetLoopStart(sfxCurrentId);
                        var le = sfxGetLoopEnd(sfxCurrentId);
                        var loopLabel = document.createElement('span'); loopLabel.className = 'sfx-label';
                        loopLabel.textContent = (le === 0 && ls > 0) ? 'LEN' : 'LOOP';
                        tb.appendChild(loopLabel);
                        var lsDown = document.createElement('button'); lsDown.className = 'tool-btn'; lsDown.textContent = '\\u25c0';
                        lsDown.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetLoopStart(sfxCurrentId, sfxGetLoopStart(sfxCurrentId) - 1); sfxRenderAll(); notifySfxChanged(); };
                        tb.appendChild(lsDown);
                        var lsVal = document.createElement('span'); lsVal.className = 'sfx-val'; lsVal.textContent = ls.toString(); tb.appendChild(lsVal);
                        var lsUp = document.createElement('button'); lsUp.className = 'tool-btn'; lsUp.textContent = '\\u25b6';
                        lsUp.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetLoopStart(sfxCurrentId, sfxGetLoopStart(sfxCurrentId) + 1); sfxRenderAll(); notifySfxChanged(); };
                        tb.appendChild(lsUp);
                        var leDown = document.createElement('button'); leDown.className = 'tool-btn'; leDown.textContent = '\\u25c0';
                        leDown.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetLoopEnd(sfxCurrentId, sfxGetLoopEnd(sfxCurrentId) - 1); sfxRenderAll(); notifySfxChanged(); };
                        tb.appendChild(leDown);
                        var leVal = document.createElement('span'); leVal.className = 'sfx-val'; leVal.textContent = le.toString(); tb.appendChild(leVal);
                        var leUp = document.createElement('button'); leUp.className = 'tool-btn'; leUp.textContent = '\\u25b6';
                        leUp.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetLoopEnd(sfxCurrentId, sfxGetLoopEnd(sfxCurrentId) + 1); sfxRenderAll(); notifySfxChanged(); };
                        tb.appendChild(leUp);

                        var sep3 = document.createElement('span'); sep3.className = 'tool-sep'; tb.appendChild(sep3);

                        // Waveform selector
                        var wLabel = document.createElement('span'); wLabel.className = 'sfx-label'; wLabel.textContent = 'WAV'; tb.appendChild(wLabel);
                        for (var wi = 0; wi < 8; wi++) {
                            (function(wIdx) {
                                var wb = document.createElement('button');
                                wb.className = 'tool-btn' + (sfxBrushWave === wIdx ? ' active' : '');
                                wb.textContent = wIdx.toString();
                                wb.style.color = WAVE_COLORS[wIdx];
                                wb.title = WAVEFORMS[wIdx];
                                wb.onclick = function() { sfxBrushWave = wIdx; sfxRenderToolbar(); };
                                tb.appendChild(wb);
                            })(wi);
                        }

                        var sep4 = document.createElement('span'); sep4.className = 'tool-sep'; tb.appendChild(sep4);

                        // Effect selector
                        var fxLabel = document.createElement('span'); fxLabel.className = 'sfx-label'; fxLabel.textContent = 'FX'; tb.appendChild(fxLabel);
                        for (var fi = 0; fi < 8; fi++) {
                            (function(fIdx) {
                                var fb = document.createElement('button');
                                fb.className = 'tool-btn' + (sfxBrushEffect === fIdx ? ' active' : '');
                                fb.textContent = fIdx.toString();
                                fb.style.color = FX_COLORS[fIdx];
                                fb.title = EFFECTS[fIdx];
                                fb.onclick = function() { sfxBrushEffect = fIdx; sfxRenderToolbar(); };
                                tb.appendChild(fb);
                            })(fi);
                        }

                        ${showAudio ? `
                        var sep5 = document.createElement('span'); sep5.className = 'tool-sep'; tb.appendChild(sep5);
                        var playBtn = document.createElement('button');
                        playBtn.className = 'tool-btn';
                        playBtn.id = 'sfx-play-btn';
                        playBtn.textContent = '\\u25b6 ' + LOCALE.play;
                        playBtn.title = 'Play (Space)';
                        playBtn.onclick = function() { sfxTogglePlay(); };
                        tb.appendChild(playBtn);
                        ` : ''}
                    }

                    ${showAudio ? `
                    function sfxTogglePlay() {
                        var btn = document.getElementById('sfx-play-btn');
                        if (currentSfxPlayer) {
                            stopSfx();
                        } else {
                            currentSfxPlayer = playSfx(sfxCurrentId, function(noteIdx) {
                                sfxHighlightPlayingNote(noteIdx);
                            });
                            if (currentSfxPlayer && btn) {
                                btn.textContent = '\\u23f9 ' + LOCALE.stop;
                            }
                        }
                    }
                    ` : ''}

                    // ---- Status bar ----
                    function sfxUpdateStatus() {
                        var st = document.getElementById('sfx-status');
                        if (!st) return;
                        if (sfxHoverNote >= 0 && sfxHoverNote < 32) {
                            var sfx = parseSfx(sfxCurrentId);
                            var n = sfx.notes[sfxHoverNote];
                            st.textContent = 'Note: ' + sfxHoverNote + ' | ' + pitchToNote(n.pitch) + ' | ' + WAVEFORMS[n.waveform] + ' | Vol: ' + n.volume + ' | FX: ' + EFFECTS[n.effect];
                        } else {
                            st.textContent = 'SFX ' + sfxCurrentId;
                        }
                    }

                    // ---- Mode toggle ----
                    function sfxUpdateMode() {
                        var cvsWrap = document.getElementById('sfx-canvas-wrap');
                        var trkWrap = document.getElementById('sfx-tracker-wrap');
                        if (sfxMode === 'bar') {
                            cvsWrap.style.display = 'block';
                            trkWrap.classList.remove('active');
                            sfxRenderBars();
                        } else {
                            cvsWrap.style.display = 'none';
                            trkWrap.classList.add('active');
                            sfxRenderTracker();
                        }
                        sfxRenderToolbar();
                    }

                    // ---- Render all ----
                    function sfxRenderAll() {
                        sfxRenderToolbar();
                        sfxRenderList();
                        if (sfxMode === 'bar') sfxRenderBars();
                        else sfxRenderTracker();
                        sfxUpdateStatus();
                    }

                    // ---- Bar mode mouse interaction ----
                    function sfxBarHitTest(e) {
                        var cvs = document.getElementById('cvs-sfx-bars');
                        var rect = cvs.getBoundingClientRect();
                        var mx = e.clientX - rect.left;
                        var my = e.clientY - rect.top;
                        var w = rect.width;
                        var h = rect.height;
                        var colW = w / 32;
                        var pitchH = h * 0.70;
                        var volH = h * 0.15;
                        var noteIdx = Math.floor(mx / colW);
                        if (noteIdx < 0) noteIdx = 0;
                        if (noteIdx > 31) noteIdx = 31;
                        var area = '';
                        var value = 0;
                        if (my < pitchH) {
                            area = 'pitch';
                            value = Math.round((1 - my / pitchH) * 63);
                            if (value < 0) value = 0;
                            if (value > 63) value = 63;
                        } else if (my < pitchH + volH) {
                            area = 'volume';
                            value = Math.round((1 - ((my - pitchH) / volH)) * 7);
                            if (value < 0) value = 0;
                            if (value > 7) value = 7;
                        } else {
                            area = 'effect';
                            value = sfxBrushEffect;
                        }
                        return { noteIdx: noteIdx, area: area, value: value };
                    }

                    function sfxApplyDraw(hit) {
                        if (!EDITABLE) return;
                        if (hit.area === 'pitch') {
                            sfxSetNote(sfxCurrentId, hit.noteIdx, 'pitch', hit.value);
                            // Also set waveform and ensure volume > 0
                            sfxSetNote(sfxCurrentId, hit.noteIdx, 'waveform', sfxBrushWave);
                            var sfx = parseSfx(sfxCurrentId);
                            if (sfx.notes[hit.noteIdx].volume === 0) {
                                sfxSetNote(sfxCurrentId, hit.noteIdx, 'volume', 5);
                            }
                        } else if (hit.area === 'volume') {
                            sfxSetNote(sfxCurrentId, hit.noteIdx, 'volume', hit.value);
                        } else if (hit.area === 'effect') {
                            sfxSetNote(sfxCurrentId, hit.noteIdx, 'effect', hit.value);
                        }
                    }

                    function sfxOnBarMouseDown(e) {
                        e.preventDefault();
                        if (e.button === 2) {
                            // Right-click: eyedropper
                            var hit = sfxBarHitTest(e);
                            var sfx = parseSfx(sfxCurrentId);
                            var n = sfx.notes[hit.noteIdx];
                            if (hit.area === 'pitch') {
                                sfxBrushWave = n.waveform;
                            } else if (hit.area === 'effect') {
                                sfxBrushEffect = n.effect;
                            }
                            sfxRenderToolbar();
                            return;
                        }
                        if (e.button === 0 && EDITABLE) {
                            sfxPushUndo();
                            sfxIsDrawing = true;
                            var hit = sfxBarHitTest(e);
                            sfxDrawArea = hit.area;
                            sfxApplyDraw(hit);
                            sfxRenderBars();
                            sfxUpdateStatus();
                        }
                    }

                    function sfxOnBarMouseMove(e) {
                        var hit = sfxBarHitTest(e);
                        var prevHoverNote = sfxHoverNote;
                        sfxHoverNote = hit.noteIdx;
                        sfxHoverArea = hit.area;
                        if (sfxIsDrawing && EDITABLE) {
                            hit.area = sfxDrawArea;
                            sfxApplyDraw(hit);
                        }
                        if (sfxHoverNote !== prevHoverNote || sfxIsDrawing) {
                            sfxRenderBars();
                        }
                        sfxUpdateStatus();
                    }

                    function sfxOnBarMouseUp(e) {
                        if (sfxIsDrawing) {
                            sfxIsDrawing = false;
                            sfxDrawArea = '';
                            notifySfxChanged();
                            sfxRenderList();
                        }
                    }

                    function sfxOnBarMouseLeave(e) {
                        sfxHoverNote = -1;
                        sfxHoverArea = '';
                        sfxRenderBars();
                        sfxUpdateStatus();
                    }

                    // ---- Keyboard ----
                    function sfxOnKeyDown(e) {
                        var sfxTab = document.getElementById('tab-sfx');
                        if (!sfxTab || !sfxTab.classList.contains('active')) return;

                        var key = e.key.toLowerCase();

                        // Tab: toggle mode
                        if (key === 'tab' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            sfxMode = (sfxMode === 'bar') ? 'tracker' : 'bar';
                            sfxUpdateMode();
                            return;
                        }

                        ${showAudio ? `
                        // Space: play/stop
                        if (key === ' ' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            sfxTogglePlay();
                            return;
                        }
                        ` : ''}

                        // SFX prev/next
                        if (key === '-' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sfxCurrentId = (sfxCurrentId - 1 + 64) % 64; sfxRenderAll(); return; }
                        if (key === '=' || key === '+') { e.preventDefault(); sfxCurrentId = (sfxCurrentId + 1) % 64; sfxRenderAll(); return; }

                        // Waveform prev/next
                        if (key === 'q' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sfxBrushWave = (sfxBrushWave - 1 + 8) % 8; sfxRenderToolbar(); return; }
                        if (key === 'w' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sfxBrushWave = (sfxBrushWave + 1) % 8; sfxRenderToolbar(); return; }

                        // Effect prev/next
                        if (key === 'a' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sfxBrushEffect = (sfxBrushEffect - 1 + 8) % 8; sfxRenderToolbar(); return; }
                        if (key === 's' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sfxBrushEffect = (sfxBrushEffect + 1) % 8; sfxRenderToolbar(); return; }

                        // Direct waveform selection 1-8
                        if (!e.ctrlKey && !e.metaKey && key >= '1' && key <= '8') { e.preventDefault(); sfxBrushWave = parseInt(key) - 1; sfxRenderToolbar(); return; }

                        // Undo/redo
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey && EDITABLE) { e.preventDefault(); sfxDoUndo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey && EDITABLE) { e.preventDefault(); sfxDoRedo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'y' && EDITABLE) { e.preventDefault(); sfxDoRedo(); return; }

                        // Tracker mode: keyboard note entry
                        if (sfxMode === 'tracker' && sfxTrackerRow >= 0 && EDITABLE) {
                            var pianoMap = {
                                'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4,
                                'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11
                            };
                            var pianoMap2 = {
                                'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16,
                                'r': 17, '5': 18, 't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24
                            };
                            // Skip piano input if Q/W would conflict with waveform nav (only use piano in tracker with note entry)
                            var pitch = -1;
                            if (pianoMap[key] !== undefined && !e.ctrlKey && !e.metaKey) pitch = pianoMap[key] + 24;
                            if (pianoMap2[key] !== undefined && !e.ctrlKey && !e.metaKey) pitch = pianoMap2[key] + 24;
                            if (e.shiftKey && pitch >= 0) pitch += 12;
                            if (pitch >= 0 && pitch <= 63) {
                                e.preventDefault();
                                sfxPushUndo();
                                sfxSetNote(sfxCurrentId, sfxTrackerRow, 'pitch', pitch);
                                sfxSetNote(sfxCurrentId, sfxTrackerRow, 'waveform', sfxBrushWave);
                                if (parseSfx(sfxCurrentId).notes[sfxTrackerRow].volume === 0) {
                                    sfxSetNote(sfxCurrentId, sfxTrackerRow, 'volume', 5);
                                }
                                sfxTrackerRow = Math.min(31, sfxTrackerRow + 1);
                                sfxRenderTracker(); sfxRenderBars(); sfxRenderList(); notifySfxChanged();
                                return;
                            }
                            if (key === 'backspace') {
                                e.preventDefault();
                                sfxPushUndo();
                                sfxSetNote(sfxCurrentId, sfxTrackerRow, 'volume', 0);
                                sfxSetNote(sfxCurrentId, sfxTrackerRow, 'pitch', 0);
                                sfxRenderTracker(); sfxRenderBars(); sfxRenderList(); notifySfxChanged();
                                return;
                            }
                            if (key === 'arrowup') { e.preventDefault(); sfxTrackerRow = Math.max(0, sfxTrackerRow - 1); sfxRenderTracker(); return; }
                            if (key === 'arrowdown') { e.preventDefault(); sfxTrackerRow = Math.min(31, sfxTrackerRow + 1); sfxRenderTracker(); return; }
                            if (key === 'pageup') { e.preventDefault(); sfxTrackerRow = Math.max(0, sfxTrackerRow - 4); sfxRenderTracker(); return; }
                            if (key === 'pagedown') { e.preventDefault(); sfxTrackerRow = Math.min(31, sfxTrackerRow + 4); sfxRenderTracker(); return; }
                            if (key === 'home') { e.preventDefault(); sfxTrackerRow = 0; sfxRenderTracker(); return; }
                            if (key === 'end') { e.preventDefault(); sfxTrackerRow = 31; sfxRenderTracker(); return; }
                        }
                    }

                    // ---- Init ----
                    function initSfxEditor() {
                        if (sfxEditorInited) {
                            sfxRenderAll();
                            return;
                        }
                        sfxEditorInited = true;

                        sfxRenderAll();

                        var cvsWrap = document.getElementById('sfx-canvas-wrap');
                        cvsWrap.addEventListener('mousedown', sfxOnBarMouseDown);
                        cvsWrap.addEventListener('contextmenu', function(e) { e.preventDefault(); });
                        window.addEventListener('mousemove', function(e) {
                            if (!document.getElementById('tab-sfx').classList.contains('active')) return;
                            if (sfxMode !== 'bar') return;
                            var cvs = document.getElementById('cvs-sfx-bars');
                            if (!cvs) return;
                            var rect = cvs.getBoundingClientRect();
                            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                                sfxOnBarMouseMove(e);
                            } else if (sfxIsDrawing) {
                                sfxOnBarMouseMove(e);
                            } else if (sfxHoverNote >= 0) {
                                sfxOnBarMouseLeave(e);
                            }
                        });
                        window.addEventListener('mouseup', sfxOnBarMouseUp);
                        window.addEventListener('keydown', sfxOnKeyDown);

                        // Resize observer to re-render bars when size changes
                        if (window.ResizeObserver) {
                            var ro = new ResizeObserver(function() {
                                if (sfxMode === 'bar') sfxRenderBars();
                            });
                            ro.observe(cvsWrap);
                        }
                    }
                    // ============ END SFX EDITOR ============

                    // ============ MUSIC EDITOR ============
                    var musicInited = false;
                    var musicCurrentPattern = 0;
                    var musicSelectedChannel = 0;
                    var musicUndoStack = [];
                    var musicRedoStack = [];

                    function musicParsePattern(idx) {
                        var offset = idx * 4;
                        var ch0 = MUSIC[offset] || 0;
                        var ch1 = MUSIC[offset + 1] || 0;
                        var ch2 = MUSIC[offset + 2] || 0;
                        var ch3 = MUSIC[offset + 3] || 0;
                        var channels = [ch0, ch1, ch2, ch3];
                        return {
                            sfxIds: channels.map(function(c) { return c & 0x3f; }),
                            disabled: channels.map(function(c) { return (c & 0x40) !== 0; }),
                            loopStart: (ch0 & 0x80) !== 0,
                            loopEnd: (ch1 & 0x80) !== 0,
                            stopAtEnd: (ch2 & 0x80) !== 0,
                            isEmpty: channels.every(function(c) { return (c & 0x40) !== 0; })
                        };
                    }

                    function musicPushUndo() {
                        var offset = musicCurrentPattern * 4;
                        musicUndoStack.push({ pattern: musicCurrentPattern, data: [MUSIC[offset], MUSIC[offset+1], MUSIC[offset+2], MUSIC[offset+3]] });
                        if (musicUndoStack.length > 50) musicUndoStack.shift();
                        musicRedoStack = [];
                    }

                    function musicUndo() {
                        if (musicUndoStack.length === 0) return;
                        var frame = musicUndoStack.pop();
                        var offset = frame.pattern * 4;
                        musicRedoStack.push({ pattern: frame.pattern, data: [MUSIC[offset], MUSIC[offset+1], MUSIC[offset+2], MUSIC[offset+3]] });
                        for (var i = 0; i < 4; i++) MUSIC[offset + i] = frame.data[i];
                        musicCurrentPattern = frame.pattern;
                        musicRenderAll();
                        notifyMusicChanged();
                    }

                    function musicRedo() {
                        if (musicRedoStack.length === 0) return;
                        var frame = musicRedoStack.pop();
                        var offset = frame.pattern * 4;
                        musicUndoStack.push({ pattern: frame.pattern, data: [MUSIC[offset], MUSIC[offset+1], MUSIC[offset+2], MUSIC[offset+3]] });
                        for (var i = 0; i < 4; i++) MUSIC[offset + i] = frame.data[i];
                        musicCurrentPattern = frame.pattern;
                        musicRenderAll();
                        notifyMusicChanged();
                    }

                    var musicChangeTimer = null;
                    function notifyMusicChanged() {
                        if (!EDITABLE) return;
                        if (musicChangeTimer) clearTimeout(musicChangeTimer);
                        musicChangeTimer = setTimeout(function() {
                            vscodeApi.postMessage({ type: 'musicChanged', music: Array.prototype.slice.call(MUSIC) });
                        }, 100);
                    }

                    function musicRenderToolbar() {
                        var tb = document.getElementById('music-toolbar');
                        tb.innerHTML = '';

                        // Pattern index selector
                        var lbl = document.createElement('span');
                        lbl.className = 'label';
                        lbl.textContent = 'PATTERN';
                        tb.appendChild(lbl);

                        var prevBtn = document.createElement('button');
                        prevBtn.className = 'tool-btn';
                        prevBtn.textContent = '\\u25c0';
                        prevBtn.addEventListener('click', function() {
                            musicCurrentPattern = (musicCurrentPattern + 63) % 64;
                            musicRenderAll();
                        });
                        tb.appendChild(prevBtn);

                        var val = document.createElement('span');
                        val.className = 'value';
                        val.id = 'music-pat-value';
                        val.textContent = musicCurrentPattern.toString().padStart(2, '0');
                        tb.appendChild(val);

                        var nextBtn = document.createElement('button');
                        nextBtn.className = 'tool-btn';
                        nextBtn.textContent = '\\u25b6';
                        nextBtn.addEventListener('click', function() {
                            musicCurrentPattern = (musicCurrentPattern + 1) % 64;
                            musicRenderAll();
                        });
                        tb.appendChild(nextBtn);

                        ${showAudio ? `
                        var sep = document.createElement('span');
                        sep.className = 'sep';
                        tb.appendChild(sep);

                        var playBtn = document.createElement('button');
                        playBtn.className = 'tool-btn';
                        playBtn.id = 'music-play-btn';
                        playBtn.textContent = '\\u25b6 ' + LOCALE.play;
                        playBtn.addEventListener('click', function() { musicTogglePlay(); });
                        tb.appendChild(playBtn);
                        ` : ''}
                    }

                    ${showAudio ? `
                    function musicTogglePlay() {
                        var btn = document.getElementById('music-play-btn');
                        if (currentMusicPlayer) {
                            stopMusic();
                        } else {
                            playMusic(musicCurrentPattern);
                            if (currentMusicPlayer && btn) {
                                btn.textContent = '\\u23f9 ' + LOCALE.stop;
                                btn.classList.add('active');
                            }
                        }
                    }
                    ` : ''}

                    function musicRenderPatternEditor() {
                        var container = document.getElementById('music-pattern-editor');
                        container.innerHTML = '';
                        var pat = musicParsePattern(musicCurrentPattern);

                        // Channel boxes
                        var chRow = document.createElement('div');
                        chRow.className = 'music-channels';
                        for (var c = 0; c < 4; c++) {
                            (function(ch) {
                                var box = document.createElement('div');
                                var boxCls = 'music-ch';
                                if (pat.disabled[ch]) boxCls += ' disabled';
                                if (ch === musicSelectedChannel) boxCls += ' ch-selected';
                                box.className = boxCls;

                                if (!pat.disabled[ch]) {
                                    box.style.cursor = 'pointer';
                                    box.addEventListener('click', function(e) {
                                        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                                        musicSelectedChannel = ch;
                                        musicRenderPatternEditor();
                                        musicRenderSfxPicker();
                                    });
                                }

                                var label = document.createElement('div');
                                label.className = 'music-ch-label';

                                if (EDITABLE) {
                                    var cb = document.createElement('input');
                                    cb.type = 'checkbox';
                                    cb.checked = !pat.disabled[ch];
                                    cb.className = 'music-ch-toggle';
                                    cb.addEventListener('change', function() {
                                        musicPushUndo();
                                        var offset = musicCurrentPattern * 4 + ch;
                                        if (cb.checked) {
                                            MUSIC[offset] = MUSIC[offset] & ~0x40;
                                        } else {
                                            MUSIC[offset] = MUSIC[offset] | 0x40;
                                            if (musicSelectedChannel === ch) musicSelectedChannel = -1;
                                        }
                                        musicRenderPatternEditor();
                                        musicRenderNavigator();
                                        musicRenderSfxPicker();
                                        notifyMusicChanged();
                                    });
                                    label.appendChild(cb);
                                }
                                label.appendChild(document.createTextNode('CH ' + ch));
                                box.appendChild(label);

                                var sfxRow = document.createElement('div');
                                sfxRow.className = 'music-ch-sfx';

                                if (EDITABLE && !pat.disabled[ch]) {
                                    var decBtn = document.createElement('button');
                                    decBtn.className = 'tool-btn';
                                    decBtn.textContent = '\\u25c0';
                                    decBtn.addEventListener('click', function() {
                                        musicPushUndo();
                                        var offset = musicCurrentPattern * 4 + ch;
                                        var cur = MUSIC[offset] & 0x3f;
                                        var flags = MUSIC[offset] & 0xc0;
                                        cur = (cur + 63) % 64;
                                        MUSIC[offset] = flags | cur;
                                        musicRenderPatternEditor();
                                        musicRenderSfxPicker();
                                        notifyMusicChanged();
                                    });
                                    sfxRow.appendChild(decBtn);
                                }

                                var sfxVal = document.createElement('span');
                                sfxVal.className = 'sfx-val' + (pat.disabled[ch] ? ' muted' : '');
                                sfxVal.textContent = pat.disabled[ch] ? '--' : pat.sfxIds[ch].toString().padStart(2, '0');
                                if (!pat.disabled[ch]) {
                                    sfxVal.addEventListener('click', function(e) {
                                        e.stopPropagation();
                                        musicSelectedChannel = (musicSelectedChannel === ch) ? -1 : ch;
                                        musicRenderPatternEditor();
                                        musicRenderSfxPicker();
                                    });
                                }
                                sfxRow.appendChild(sfxVal);

                                if (EDITABLE && !pat.disabled[ch]) {
                                    var incBtn = document.createElement('button');
                                    incBtn.className = 'tool-btn';
                                    incBtn.textContent = '\\u25b6';
                                    incBtn.addEventListener('click', function() {
                                        musicPushUndo();
                                        var offset = musicCurrentPattern * 4 + ch;
                                        var cur = MUSIC[offset] & 0x3f;
                                        var flags = MUSIC[offset] & 0xc0;
                                        cur = (cur + 1) % 64;
                                        MUSIC[offset] = flags | cur;
                                        musicRenderPatternEditor();
                                        musicRenderSfxPicker();
                                        notifyMusicChanged();
                                    });
                                    sfxRow.appendChild(incBtn);
                                }

                                box.appendChild(sfxRow);
                                chRow.appendChild(box);
                            })(c);
                        }
                        container.appendChild(chRow);

                        // Flags row
                        var flagsRow = document.createElement('div');
                        flagsRow.className = 'music-flags';

                        var flagDefs = [
                            { name: 'Loop Start', cls: 'loop-start-on', bit: 0x80, chIdx: 0 },
                            { name: 'Loop End', cls: 'loop-end-on', bit: 0x80, chIdx: 1 },
                            { name: 'Stop', cls: 'stop-on', bit: 0x80, chIdx: 2 }
                        ];

                        var flagLabel = document.createElement('span');
                        flagLabel.className = 'label';
                        flagLabel.textContent = 'Flags:';
                        flagLabel.style.color = '#888';
                        flagLabel.style.fontSize = '11px';
                        flagsRow.appendChild(flagLabel);

                        for (var fi = 0; fi < flagDefs.length; fi++) {
                            (function(fd) {
                                var btn = document.createElement('button');
                                btn.className = 'flag-btn';
                                var offset = musicCurrentPattern * 4 + fd.chIdx;
                                var isOn = (MUSIC[offset] & fd.bit) !== 0;
                                if (isOn) btn.classList.add(fd.cls);
                                btn.textContent = (isOn ? '\\u25cf ' : '\\u25cb ') + fd.name;
                                if (EDITABLE) {
                                    btn.addEventListener('click', function() {
                                        musicPushUndo();
                                        MUSIC[offset] = MUSIC[offset] ^ fd.bit;
                                        musicRenderPatternEditor();
                                        musicRenderNavigator();
                                        notifyMusicChanged();
                                    });
                                }
                                flagsRow.appendChild(btn);
                            })(flagDefs[fi]);
                        }
                        container.appendChild(flagsRow);
                    }

                    function musicRenderNavigator() {
                        var container = document.getElementById('music-navigator');
                        container.innerHTML = '';
                        var grid = document.createElement('div');
                        grid.className = 'music-nav-grid';
                        for (var i = 0; i < 64; i++) {
                            (function(idx) {
                                var pat = musicParsePattern(idx);
                                var cell = document.createElement('div');
                                var cls = 'music-nav-cell';
                                if (idx === musicCurrentPattern) cls += ' selected';
                                if (pat.isEmpty) cls += ' empty';
                                else cls += ' non-empty';
                                if (pat.loopStart) cls += ' loop-start';
                                if (pat.loopEnd) cls += ' loop-end';
                                if (pat.stopAtEnd) cls += ' stop-end';
                                cell.className = cls;
                                cell.textContent = idx.toString().padStart(2, '0');
                                cell.addEventListener('click', function() {
                                    musicCurrentPattern = idx;
                                    musicRenderAll();
                                });
                                grid.appendChild(cell);
                            })(i);
                        }
                        container.appendChild(grid);
                    }

                    var musicPlayingSfxId = -1;

                    function musicRenderSfxPicker() {
                        var picker = document.getElementById('music-sfx-picker');
                        if (!picker) return;
                        picker.innerHTML = '';

                        var pat = musicParsePattern(musicCurrentPattern);

                        // Auto-fix: if selected channel is disabled, pick first enabled one
                        if (musicSelectedChannel >= 0 && musicSelectedChannel <= 3 && pat.disabled[musicSelectedChannel]) {
                            musicSelectedChannel = -1;
                            for (var ci = 0; ci < 4; ci++) {
                                if (!pat.disabled[ci]) { musicSelectedChannel = ci; break; }
                            }
                        }

                        var currentSfxId = -1;
                        if (musicSelectedChannel >= 0 && musicSelectedChannel <= 3 && !pat.disabled[musicSelectedChannel]) {
                            currentSfxId = pat.sfxIds[musicSelectedChannel];
                        }

                        var label = document.createElement('div');
                        label.className = 'music-sfx-picker-label';
                        if (musicSelectedChannel >= 0 && musicSelectedChannel <= 3) {
                            label.innerHTML = 'SFX for <span class="ch-num">CH ' + musicSelectedChannel + '</span>';
                        } else {
                            label.textContent = 'SFX (no channel selected)';
                        }
                        picker.appendChild(label);

                        var grid = document.createElement('div');
                        grid.className = 'music-sfx-grid';
                        for (var i = 0; i < 64; i++) {
                            (function(sfxIdx) {
                                var cell = document.createElement('div');
                                var cls = 'music-sfx-cell';
                                // Check if SFX has any non-zero note data
                                var sfxOffset = sfxIdx * 68;
                                var hasData = false;
                                for (var b = 0; b < 64; b++) {
                                    if (SFX[sfxOffset + b]) { hasData = true; break; }
                                }
                                if (hasData) cls += ' non-empty';
                                if (sfxIdx === currentSfxId) cls += ' selected';
                                if (sfxIdx === musicPlayingSfxId) cls += ' sfx-playing';
                                cell.className = cls;

                                var numSpan = document.createElement('span');
                                numSpan.textContent = sfxIdx.toString().padStart(2, '0');
                                cell.appendChild(numSpan);

                                // Play button for non-empty SFX
                                var playBtn = document.createElement('span');
                                playBtn.className = 'sfx-play-btn';
                                playBtn.textContent = '\u25B6';
                                playBtn.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    if (musicPlayingSfxId === sfxIdx) {
                                        stopSfx();
                                        musicPlayingSfxId = -1;
                                        musicRenderSfxPicker();
                                    } else {
                                        stopSfx();
                                        musicPlayingSfxId = sfxIdx;
                                        musicRenderSfxPicker();
                                        playSfx(sfxIdx, null, false);
                                        // Clear playing state when SFX finishes
                                        var sfxData = parseSfx(sfxIdx);
                                        if (!sfxData.isEmpty) {
                                            var dur = (sfxData.speed || 1) * 183 / 22050 * 32;
                                            setTimeout(function() {
                                                if (musicPlayingSfxId === sfxIdx) {
                                                    musicPlayingSfxId = -1;
                                                    musicRenderSfxPicker();
                                                }
                                            }, dur * 1000 + 200);
                                        }
                                    }
                                });
                                cell.appendChild(playBtn);

                                if (EDITABLE && musicSelectedChannel >= 0) {
                                    cell.addEventListener('click', function() {
                                        if (musicSelectedChannel < 0 || musicSelectedChannel > 3) return;
                                        musicPushUndo();
                                        var offset = musicCurrentPattern * 4 + musicSelectedChannel;
                                        var flags = MUSIC[offset] & 0xc0;
                                        MUSIC[offset] = flags | (sfxIdx & 0x3f);
                                        musicRenderPatternEditor();
                                        musicRenderSfxPicker();
                                        notifyMusicChanged();
                                    });
                                }
                                grid.appendChild(cell);
                            })(i);
                        }
                        picker.appendChild(grid);
                    }

                    function musicRenderStatus() {
                        var st = document.getElementById('music-status-bar');
                        if (!st) return;
                        st.textContent = 'Pattern ' + musicCurrentPattern.toString().padStart(2, '0');
                    }

                    function musicRenderAll() {
                        var valEl = document.getElementById('music-pat-value');
                        if (valEl) valEl.textContent = musicCurrentPattern.toString().padStart(2, '0');
                        musicRenderPatternEditor();
                        musicRenderNavigator();
                        musicRenderSfxPicker();
                        musicRenderStatus();
                    }

                    function musicOnKeyDown(e) {
                        var tabMusic = document.getElementById('tab-music');
                        if (!tabMusic || !tabMusic.classList.contains('active')) return;
                        if (e.key === 'ArrowLeft' || e.key === '-') {
                            e.preventDefault();
                            musicCurrentPattern = (musicCurrentPattern + 63) % 64;
                            musicRenderAll();
                        } else if (e.key === 'ArrowRight' || e.key === '+' || e.key === '=') {
                            e.preventDefault();
                            musicCurrentPattern = (musicCurrentPattern + 1) % 64;
                            musicRenderAll();
                        } else if (e.key === ' ') {
                            e.preventDefault();
                            ${showAudio ? 'musicTogglePlay();' : ''}
                        } else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
                            if (EDITABLE) {
                                e.preventDefault();
                                var ch = parseInt(e.key) - 1;
                                musicPushUndo();
                                var offset = musicCurrentPattern * 4 + ch;
                                MUSIC[offset] = MUSIC[offset] ^ 0x40;
                                musicRenderPatternEditor();
                                musicRenderNavigator();
                                notifyMusicChanged();
                            }
                        } else if (e.ctrlKey && e.key === 'z') {
                            e.preventDefault();
                            if (e.shiftKey) musicRedo();
                            else musicUndo();
                        } else if (e.ctrlKey && e.key === 'y') {
                            e.preventDefault();
                            musicRedo();
                        }
                    }

                    function initMusicEditor() {
                        if (musicInited) {
                            musicRenderAll();
                            return;
                        }
                        musicInited = true;
                        musicRenderToolbar();
                        musicRenderAll();
                        window.addEventListener('keydown', musicOnKeyDown);
                    }
                    // ============ END MUSIC EDITOR ============

                    ${showAudio ? getAudioEngineScript() : ''}

                    ${showRunButton ? getRunButtonScript() : ''}

                    // Listen for messages from the extension host
                    window.addEventListener('message', function(event) {
                        var msg = event.data;
                        if (msg.type === 'runState') {
                            updateRunButton(msg.running);
                        }
                    });

                    // ============ LOAD MONACO EDITOR (async, non-blocking) ============
                    try {
                        var _monacoScript = document.createElement('script');
                        _monacoScript.src = MONACO_BASE + '/loader.js';
                        _monacoScript.nonce = "${nonce}";
                        _monacoScript.onload = function() {
                            try {
                                require.config({ paths: { vs: MONACO_BASE } });

                                window.MonacoEnvironment = {
                                    getWorkerUrl: function(workerId, label) {
                                        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
                                            'self.MonacoEnvironment = { baseUrl: "' + MONACO_BASE + '/" };' +
                                            'importScripts("' + MONACO_BASE + '/base/worker/workerMain.js");'
                                        );
                                    }
                                };

                                require(['vs/editor/editor.main'], function() {
                                    monaco.languages.register({ id: 'pico8-lua' });

                                    monaco.languages.setMonarchTokensProvider('pico8-lua', {
                                        keywords: [
                                            'and', 'break', 'do', 'else', 'elseif', 'end', 'for',
                                            'function', 'goto', 'if', 'in', 'local', 'not', 'or',
                                            'repeat', 'return', 'then', 'until', 'while'
                                        ],
                                        builtins: [
                                            'print', 'printh', 'cls', 'spr', 'sspr', 'map', 'mget', 'mset',
                                            'pset', 'pget', 'sget', 'sset', 'fget', 'fset', 'line', 'rect',
                                            'rectfill', 'circ', 'circfill', 'oval', 'ovalfill', 'pal', 'palt',
                                            'color', 'clip', 'camera', 'cursor', 'fillp', 'flip', 'btn', 'btnp',
                                            'sfx', 'music', 'mstat', 'stat', 'peek', 'peek2', 'peek4', 'poke',
                                            'poke2', 'poke4', 'memcpy', 'memset', 'reload', 'cstore', 'cartdata',
                                            'dget', 'dset', 'rnd', 'srand', 'flr', 'ceil', 'abs', 'sgn', 'sqrt',
                                            'sin', 'cos', 'atan2', 'band', 'bor', 'bxor', 'bnot', 'shl', 'shr',
                                            'lshr', 'rotl', 'rotr', 'max', 'min', 'mid', 'chr', 'ord', 'sub',
                                            'tostr', 'tonum', 'type', 'add', 'del', 'deli', 'all', 'pairs',
                                            'foreach', 'count', 'cocreate', 'coresume', 'costatus', 'yield',
                                            'time', 't', 'menuitem', 'extcmd', 'assert', 'stop', 'trace',
                                            '_init', '_update', '_update60', '_draw'
                                        ],
                                        operators: [
                                            '+', '-', '*', '/', '%', '^', '#',
                                            '==', '~=', '<=', '>=', '<', '>', '=',
                                            '..', '...'
                                        ],
                                        symbols: /[=><!~?:&|+\\-*\\/\\^%#]+/,
                                        tokenizer: {
                                            root: [
                                                [/--\\[\\[/, 'comment', '@comment'],
                                                [/--.*$/, 'comment'],
                                                [/"([^"\\\\]|\\\\.)*$/, 'string.invalid'],
                                                [/'([^'\\\\]|\\\\.)*$/, 'string.invalid'],
                                                [/"/, 'string', '@string_double'],
                                                [/'/, 'string', '@string_single'],
                                                [/0[xX][0-9a-fA-F_]+(\\.[0-9a-fA-F_]+)?/, 'number.hex'],
                                                [/0[bB][01_]+/, 'number.binary'],
                                                [/\\d+(\\.\\d+)?/, 'number'],
                                                [/[a-zA-Z_]\\w*/, {
                                                    cases: {
                                                        '@keywords': 'keyword',
                                                        '@builtins': 'type.identifier',
                                                        '@default': 'identifier'
                                                    }
                                                }],
                                                [/\\.\\.\\.?/, 'operator'],
                                                [/@symbols/, 'operator'],
                                                [/[{}()\\[\\]]/, 'delimiter.bracket'],
                                                [/[;,.]/, 'delimiter'],
                                                [/[ \\t\\r\\n]+/, 'white'],
                                            ],
                                            comment: [
                                                [/[^\\]]+/, 'comment'],
                                                [/\\]\\]/, 'comment', '@pop'],
                                                [/\\]/, 'comment'],
                                            ],
                                            string_double: [
                                                [/[^\\\\"]+/, 'string'],
                                                [/\\\\./, 'string.escape'],
                                                [/"/, 'string', '@pop'],
                                            ],
                                            string_single: [
                                                [/[^\\\\']+/, 'string'],
                                                [/\\\\./, 'string.escape'],
                                                [/'/, 'string', '@pop'],
                                            ],
                                        }
                                    });

                                    monaco.editor.defineTheme('pico8-dark', {
                                        base: 'vs-dark',
                                        inherit: false,
                                        rules: [
                                            { token: 'keyword', foreground: 'ff77a8' },
                                            { token: 'type.identifier', foreground: '29adff' },
                                            { token: 'string', foreground: '00e436' },
                                            { token: 'string.escape', foreground: '00e436' },
                                            { token: 'string.invalid', foreground: 'ff004d' },
                                            { token: 'comment', foreground: '5f574f', fontStyle: 'italic' },
                                            { token: 'number', foreground: 'ffec27' },
                                            { token: 'number.hex', foreground: 'ffec27' },
                                            { token: 'number.binary', foreground: 'ffec27' },
                                            { token: 'operator', foreground: 'ff77a8' },
                                            { token: 'delimiter.bracket', foreground: 'c2c3c7' },
                                            { token: 'delimiter', foreground: 'c2c3c7' },
                                            { token: 'identifier', foreground: 'c2c3c7' },
                                            { token: '', foreground: 'c2c3c7' },
                                        ],
                                        colors: {
                                            'editor.background': '#1a1a1a',
                                            'editor.foreground': '#c2c3c7',
                                            'editorLineNumber.foreground': '#555555',
                                            'editorCursor.foreground': '#ff77a8',
                                            'editor.selectionBackground': '#3a3a5a',
                                            'editor.lineHighlightBackground': '#222222',
                                            'editorIndentGuide.background': '#333333',
                                            'editorWidget.background': '#1a1a1a',
                                            'editorWidget.border': '#333333',
                                            'input.background': '#252525',
                                            'input.foreground': '#c2c3c7',
                                            'input.border': '#333333',
                                            'focusBorder': '#ff77a8',
                                            'scrollbarSlider.background': '#333333aa',
                                            'scrollbarSlider.hoverBackground': '#444444aa',
                                        }
                                    });

                                    var container = document.getElementById('monaco-container');
                                    monacoEditor = monaco.editor.create(container, {
                                        value: CODE,
                                        language: 'pico8-lua',
                                        theme: 'pico8-dark',
                                        readOnly: !EDITABLE,
                                        minimap: { enabled: false },
                                        fontSize: 13,
                                        lineHeight: 20,
                                        fontFamily: "'Courier New', monospace",
                                        scrollBeyondLastLine: false,
                                        automaticLayout: false,
                                        tabSize: 2,
                                        renderLineHighlight: 'line',
                                        glyphMargin: false,
                                        folding: true,
                                        lineNumbers: 'on',
                                        wordWrap: 'off',
                                        overviewRulerLanes: 0,
                                        hideCursorInOverviewRuler: true,
                                        overviewRulerBorder: false,
                                        stickyScroll: { enabled: false },
                                    });

                                    if (EDITABLE) {
                                        monacoEditor.onDidChangeModelContent(function() {
                                            vscodeApi.postMessage({
                                                type: 'codeChanged',
                                                code: monacoEditor.getValue()
                                            });
                                        });
                                    }

                                    monacoEditor.layout();
                                });
                            } catch (e) {
                                console.error('Monaco init error:', e);
                            }
                        };
                        _monacoScript.onerror = function() {
                            console.error('Failed to load Monaco loader.js');
                        };
                        document.head.appendChild(_monacoScript);
                    } catch (e) {
                        console.error('Monaco setup error:', e);
                    }
                </script>
            </body>
            </html>`;
}

function getSpriteEditorScript(): string {
    return `
                    // ============ SPRITE EDITOR ============
                    var spriteEditorInited = false;
                    var seZoom = 4;
                    var seZoomMin = 2;
                    var seZoomMax = 64;
                    var seZoomFactor = 1.08; // per wheel tick multiplier
                    var sePanX = 0, sePanY = 0;
                    var seTool = 'pencil';
                    var sePrevTool = null; // for space-hold temp hand
                    var seFgColor = 7;
                    var seBgColor = 0;
                    var seMouseX = -1, seMouseY = -1; // pixel coords
                    var seIsDrawing = false;
                    var seDrawStart = null; // {x,y} for shape tools
                    var seIsPanning = false;
                    var sePanStart = null; // {mx,my,px,py}
                    var seSpaceHeld = false;
                    var seUndoStack = [];
                    var seRedoStack = [];
                    var seMaxUndo = 50;
                    var seSelection = null; // {x,y,w,h,data}
                    var seClipboard = null; // {w,h,data}
                    var seSelDragging = false;
                    var seSelDragStart = null;
                    var seGfxChangedTimer = null;
                    var seMarchingAntsOffset = 0;
                    var seMarchingAntsTimer = null;
                    var seQuickPaletteVisible = false;
                    var seFlagFilter = [false,false,false,false,false,false,false,false]; // 8 flag filter toggles
                    var seFlagColors = [PAL[8],PAL[9],PAL[10],PAL[11],PAL[12],PAL[13],PAL[14],PAL[15]]; // flag 0-7 → palette 8-15
                    var seFlagsChangedTimer = null;
                    var seLastHoveredSprite = -1;

                    function notifyFlagsChanged() {
                        if (!EDITABLE) return;
                        if (seFlagsChangedTimer) clearTimeout(seFlagsChangedTimer);
                        seFlagsChangedTimer = setTimeout(function() {
                            vscodeApi.postMessage({ type: 'flagsChanged', flags: FLAGS.slice() });
                        }, 100);
                    }

                    function getGfxPixel(x, y) {
                        if (x < 0 || x >= 128 || y < 0 || y >= 128) return 0;
                        var byteIdx = y * 64 + Math.floor(x / 2);
                        var b = GFX[byteIdx] || 0;
                        return (x % 2 === 0) ? (b & 0x0f) : ((b >> 4) & 0x0f);
                    }

                    function setGfxPixel(x, y, c) {
                        if (x < 0 || x >= 128 || y < 0 || y >= 128) return;
                        var byteIdx = y * 64 + Math.floor(x / 2);
                        var b = GFX[byteIdx] || 0;
                        if (x % 2 === 0) {
                            GFX[byteIdx] = (b & 0xf0) | (c & 0x0f);
                        } else {
                            GFX[byteIdx] = (b & 0x0f) | ((c & 0x0f) << 4);
                        }
                    }

                    function pushUndo() {
                        seUndoStack.push(GFX.slice());
                        if (seUndoStack.length > seMaxUndo) seUndoStack.shift();
                        seRedoStack = [];
                    }

                    function doUndo() {
                        if (seUndoStack.length === 0) return;
                        seRedoStack.push(GFX.slice());
                        var prev = seUndoStack.pop();
                        for (var i = 0; i < prev.length; i++) GFX[i] = prev[i];
                        seRenderCanvas();
                        notifyGfxChanged();
                    }

                    function doRedo() {
                        if (seRedoStack.length === 0) return;
                        seUndoStack.push(GFX.slice());
                        var next = seRedoStack.pop();
                        for (var i = 0; i < next.length; i++) GFX[i] = next[i];
                        seRenderCanvas();
                        notifyGfxChanged();
                    }

                    function notifyGfxChanged() {
                        if (!EDITABLE) return;
                        if (seGfxChangedTimer) clearTimeout(seGfxChangedTimer);
                        seGfxChangedTimer = setTimeout(function() {
                            vscodeApi.postMessage({ type: 'gfxChanged', gfx: GFX.slice() });
                        }, 100);
                    }

                    function seScreenToPixel(clientX, clientY) {
                        var wrap = document.getElementById('sprite-canvas-wrap');
                        var rect = wrap.getBoundingClientRect();
                        var mx = clientX - rect.left;
                        var my = clientY - rect.top;
                        var px = Math.floor((mx - sePanX) / seZoom);
                        var py = Math.floor((my - sePanY) / seZoom);
                        return { px: px, py: py, mx: mx, my: my };
                    }

                    function seClampPan() {
                        var wrap = document.getElementById('sprite-canvas-wrap');
                        if (!wrap) return;
                        var cw = 128 * seZoom;
                        var ch = 128 * seZoom;
                        var ww = wrap.clientWidth;
                        var wh = wrap.clientHeight;
                        // Allow panning so at least 32px of canvas is visible
                        var margin = 32;
                        if (sePanX > ww - margin) sePanX = ww - margin;
                        if (sePanY > wh - margin) sePanY = wh - margin;
                        if (sePanX < -(cw - margin)) sePanX = -(cw - margin);
                        if (sePanY < -(ch - margin)) sePanY = -(ch - margin);
                    }

                    function seFitCanvas() {
                        var wrap = document.getElementById('sprite-canvas-wrap');
                        if (!wrap) return;
                        var ww = wrap.clientWidth;
                        var wh = wrap.clientHeight;
                        // Fit image to 80% of editor area
                        var fitZoom = Math.min(ww * 0.8 / 128, wh * 0.8 / 128);
                        seZoom = Math.max(seZoomMin, Math.min(seZoomMax, fitZoom));
                        var cw = 128 * seZoom;
                        var ch = 128 * seZoom;
                        sePanX = Math.floor((ww - cw) / 2);
                        sePanY = Math.floor((wh - ch) / 2);
                    }

                    function seUpdateCanvasTransform() {
                        var cvs = document.getElementById('cvs-gfx');
                        var overlay = document.getElementById('cvs-gfx-overlay');
                        var size = 128 * seZoom;
                        var s = size + 'px';
                        cvs.style.width = s; cvs.style.height = s;
                        cvs.style.left = sePanX + 'px'; cvs.style.top = sePanY + 'px';
                        overlay.width = size; overlay.height = size;
                        overlay.style.width = s; overlay.style.height = s;
                        overlay.style.left = sePanX + 'px'; overlay.style.top = sePanY + 'px';
                    }

                    function seRenderCanvas() {
                        var cvs = document.getElementById('cvs-gfx');
                        var ctx = cvs.getContext('2d');
                        var imgData = ctx.createImageData(128, 128);
                        for (var i = 0; i < 8192; i++) {
                            var byte = GFX[i];
                            var p1 = byte & 0x0f;
                            var p2 = (byte >> 4) & 0x0f;
                            var row = Math.floor(i / 64);
                            var col = (i % 64) * 2;
                            setPixel(imgData, col, row, p1);
                            setPixel(imgData, col+1, row, p2);
                        }
                        ctx.putImageData(imgData, 0, 0);
                        seUpdateCanvasTransform();
                        seRenderOverlay();
                    }

                    function seRenderOverlay() {
                        var overlay = document.getElementById('cvs-gfx-overlay');
                        var ctx = overlay.getContext('2d');
                        var size = 128 * seZoom;
                        ctx.clearRect(0, 0, size, size);

                        // Sprite grid at zoom >= 2
                        if (seZoom >= 2) {
                            ctx.strokeStyle = 'rgba(102,102,102,0.7)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            for (var gx = 0; gx <= 128; gx += 8) {
                                ctx.moveTo(gx * seZoom + 0.5, 0);
                                ctx.lineTo(gx * seZoom + 0.5, size);
                            }
                            for (var gy = 0; gy <= 128; gy += 8) {
                                ctx.moveTo(0, gy * seZoom + 0.5);
                                ctx.lineTo(size, gy * seZoom + 0.5);
                            }
                            ctx.stroke();
                        }

                        // Pixel grid at zoom >= 8
                        if (seZoom >= 8) {
                            ctx.strokeStyle = 'rgba(51,51,51,0.5)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            for (var px = 0; px <= 128; px++) {
                                if (px % 8 === 0) continue; // skip sprite grid lines
                                ctx.moveTo(px * seZoom + 0.5, 0);
                                ctx.lineTo(px * seZoom + 0.5, size);
                            }
                            for (var py = 0; py <= 128; py++) {
                                if (py % 8 === 0) continue;
                                ctx.moveTo(0, py * seZoom + 0.5);
                                ctx.lineTo(size, py * seZoom + 0.5);
                            }
                            ctx.stroke();
                        }

                        // Flag filter overlay
                        var anyFlagActive = seFlagFilter.indexOf(true) >= 0;
                        if (anyFlagActive) {
                            for (var si = 0; si < 256; si++) {
                                var flagByte = FLAGS[si] || 0;
                                if (flagByte === 0) continue;
                                // Find the lowest active flag that matches
                                var matchColor = null;
                                for (var fi = 0; fi < 8; fi++) {
                                    if (seFlagFilter[fi] && (flagByte & (1 << fi))) {
                                        matchColor = seFlagColors[fi];
                                        break;
                                    }
                                }
                                if (matchColor) {
                                    var sx = (si % 16) * 8;
                                    var sy = Math.floor(si / 16) * 8;
                                    ctx.strokeStyle = matchColor;
                                    ctx.lineWidth = 2;
                                    ctx.strokeRect(
                                        sx * seZoom + 1,
                                        sy * seZoom + 1,
                                        8 * seZoom - 2,
                                        8 * seZoom - 2
                                    );
                                }
                            }
                            ctx.lineWidth = 1;
                        }

                        // Hover pixel highlight
                        if (seMouseX >= 0 && seMouseX < 128 && seMouseY >= 0 && seMouseY < 128) {
                            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(
                                seMouseX * seZoom + 0.5,
                                seMouseY * seZoom + 0.5,
                                seZoom - 1,
                                seZoom - 1
                            );
                            // Highlight 8x8 sprite cell border
                            var cellX = Math.floor(seMouseX / 8) * 8;
                            var cellY = Math.floor(seMouseY / 8) * 8;
                            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(
                                cellX * seZoom + 0.5,
                                cellY * seZoom + 0.5,
                                8 * seZoom - 1,
                                8 * seZoom - 1
                            );
                        }

                        // Selection marching ants
                        if (seSelection && !seSelDragging) {
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 1;
                            ctx.setLineDash([4, 4]);
                            ctx.lineDashOffset = seMarchingAntsOffset;
                            ctx.strokeRect(
                                seSelection.x * seZoom + 0.5,
                                seSelection.y * seZoom + 0.5,
                                seSelection.w * seZoom,
                                seSelection.h * seZoom
                            );
                            ctx.setLineDash([]);
                        }

                        // Shape preview while dragging
                        if (seIsDrawing && seDrawStart && (seTool === 'rectangle' || seTool === 'circle' || seTool === 'line')) {
                            seRenderShapePreview(ctx);
                        }
                    }

                    function seRenderShapePreview(ctx) {
                        if (!seDrawStart || seMouseX < 0) return;
                        var x0 = seDrawStart.x, y0 = seDrawStart.y;
                        var x1 = seMouseX, y1 = seMouseY;
                        ctx.strokeStyle = PAL[seFgColor];
                        ctx.globalAlpha = 0.6;
                        ctx.lineWidth = seZoom;
                        if (seTool === 'rectangle') {
                            var rx = Math.min(x0, x1), ry = Math.min(y0, y1);
                            var rw = Math.abs(x1 - x0) + 1, rh = Math.abs(y1 - y0) + 1;
                            ctx.strokeRect(rx * seZoom + seZoom/2, ry * seZoom + seZoom/2, (rw-1) * seZoom, (rh-1) * seZoom);
                        } else if (seTool === 'circle') {
                            var cx = (x0 + x1) / 2 * seZoom + seZoom/2;
                            var cy = (y0 + y1) / 2 * seZoom + seZoom/2;
                            var rx2 = Math.abs(x1 - x0) / 2 * seZoom;
                            var ry2 = Math.abs(y1 - y0) / 2 * seZoom;
                            ctx.beginPath();
                            ctx.ellipse(cx, cy, Math.max(rx2, 0.5), Math.max(ry2, 0.5), 0, 0, Math.PI * 2);
                            ctx.stroke();
                        } else if (seTool === 'line') {
                            ctx.beginPath();
                            ctx.moveTo(x0 * seZoom + seZoom/2, y0 * seZoom + seZoom/2);
                            ctx.lineTo(x1 * seZoom + seZoom/2, y1 * seZoom + seZoom/2);
                            ctx.stroke();
                        }
                        ctx.globalAlpha = 1.0;
                    }

                    // ---- Drawing algorithms ----

                    function drawBresenhamLine(x0, y0, x1, y1, color) {
                        var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
                        var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
                        var err = dx - dy;
                        while (true) {
                            setGfxPixel(x0, y0, color);
                            if (x0 === x1 && y0 === y1) break;
                            var e2 = 2 * err;
                            if (e2 > -dy) { err -= dy; x0 += sx; }
                            if (e2 < dx) { err += dx; y0 += sy; }
                        }
                    }

                    function drawRect(x0, y0, x1, y1, color, filled) {
                        var rx = Math.min(x0, x1), ry = Math.min(y0, y1);
                        var rx2 = Math.max(x0, x1), ry2 = Math.max(y0, y1);
                        if (filled) {
                            for (var yy = ry; yy <= ry2; yy++)
                                for (var xx = rx; xx <= rx2; xx++)
                                    setGfxPixel(xx, yy, color);
                        } else {
                            for (var xx = rx; xx <= rx2; xx++) { setGfxPixel(xx, ry, color); setGfxPixel(xx, ry2, color); }
                            for (var yy = ry; yy <= ry2; yy++) { setGfxPixel(rx, yy, color); setGfxPixel(rx2, yy, color); }
                        }
                    }

                    function drawEllipse(x0, y0, x1, y1, color, filled) {
                        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
                        var a = Math.abs(x1 - x0) / 2, b = Math.abs(y1 - y0) / 2;
                        if (a < 0.5 && b < 0.5) { setGfxPixel(Math.round(cx), Math.round(cy), color); return; }
                        if (a < 0.5) a = 0.5;
                        if (b < 0.5) b = 0.5;
                        // Midpoint ellipse
                        var x = 0, y = b;
                        var a2 = a * a, b2 = b * b;
                        var plotPoints = filled ? function(cx, cy, x, y) {
                            for (var i = Math.ceil(cx - x); i <= Math.floor(cx + x); i++) {
                                setGfxPixel(i, Math.round(cy + y), color);
                                setGfxPixel(i, Math.round(cy - y), color);
                            }
                        } : function(cx, cy, x, y) {
                            setGfxPixel(Math.round(cx + x), Math.round(cy + y), color);
                            setGfxPixel(Math.round(cx - x), Math.round(cy + y), color);
                            setGfxPixel(Math.round(cx + x), Math.round(cy - y), color);
                            setGfxPixel(Math.round(cx - x), Math.round(cy - y), color);
                        };
                        // Region 1
                        var d1 = b2 - a2 * b + 0.25 * a2;
                        var dx = 2 * b2 * x, dy = 2 * a2 * y;
                        while (dx < dy) {
                            plotPoints(cx, cy, x, y);
                            if (d1 < 0) { x++; dx += 2 * b2; d1 += dx + b2; }
                            else { x++; y--; dx += 2 * b2; dy -= 2 * a2; d1 += dx - dy + b2; }
                        }
                        // Region 2
                        var d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2;
                        while (y >= 0) {
                            plotPoints(cx, cy, x, y);
                            if (d2 > 0) { y--; dy -= 2 * a2; d2 += a2 - dy; }
                            else { y--; x++; dx += 2 * b2; dy -= 2 * a2; d2 += dx - dy + a2; }
                        }
                    }

                    function floodFill(startX, startY, fillColor) {
                        var targetColor = getGfxPixel(startX, startY);
                        if (targetColor === fillColor) return;
                        var stack = [[startX, startY]];
                        var visited = {};
                        while (stack.length > 0) {
                            var p = stack.pop();
                            var x = p[0], y = p[1];
                            if (x < 0 || x >= 128 || y < 0 || y >= 128) continue;
                            var key = x + ',' + y;
                            if (visited[key]) continue;
                            if (getGfxPixel(x, y) !== targetColor) continue;
                            visited[key] = true;
                            setGfxPixel(x, y, fillColor);
                            stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
                        }
                    }

                    function searchReplace(targetColor, replaceColor) {
                        if (targetColor === replaceColor) return;
                        for (var y = 0; y < 128; y++)
                            for (var x = 0; x < 128; x++)
                                if (getGfxPixel(x, y) === targetColor) setGfxPixel(x, y, replaceColor);
                    }

                    function snapLine45(x0, y0, x1, y1) {
                        var dx = x1 - x0, dy = y1 - y0;
                        var adx = Math.abs(dx), ady = Math.abs(dy);
                        if (adx > ady * 2) { return { x: x1, y: y0 }; }
                        if (ady > adx * 2) { return { x: x0, y: y1 }; }
                        var d = Math.max(adx, ady);
                        return { x: x0 + d * (dx >= 0 ? 1 : -1), y: y0 + d * (dy >= 0 ? 1 : -1) };
                    }

                    function constrainSquare(x0, y0, x1, y1) {
                        var dx = x1 - x0, dy = y1 - y0;
                        var d = Math.max(Math.abs(dx), Math.abs(dy));
                        return { x: x0 + d * (dx >= 0 ? 1 : -1), y: y0 + d * (dy >= 0 ? 1 : -1) };
                    }

                    // ---- Selection helpers ----

                    function seGetSelectionPixels() {
                        if (!seSelection) return null;
                        var data = [];
                        for (var y = 0; y < seSelection.h; y++) {
                            for (var x = 0; x < seSelection.w; x++) {
                                data.push(getGfxPixel(seSelection.x + x, seSelection.y + y));
                            }
                        }
                        return data;
                    }

                    function sePastePixels(px, py, w, h, data) {
                        for (var y = 0; y < h; y++)
                            for (var x = 0; x < w; x++)
                                setGfxPixel(px + x, py + y, data[y * w + x]);
                    }

                    function seClearRect(x, y, w, h, color) {
                        for (var yy = 0; yy < h; yy++)
                            for (var xx = 0; xx < w; xx++)
                                setGfxPixel(x + xx, y + yy, color);
                    }

                    function seFlipH() {
                        if (!seSelection) return;
                        pushUndo();
                        var data = seGetSelectionPixels();
                        var w = seSelection.w, h = seSelection.h;
                        for (var y = 0; y < h; y++)
                            for (var x = 0; x < w; x++)
                                setGfxPixel(seSelection.x + x, seSelection.y + y, data[y * w + (w - 1 - x)]);
                        seRenderCanvas(); notifyGfxChanged();
                    }

                    function seFlipV() {
                        if (!seSelection) return;
                        pushUndo();
                        var data = seGetSelectionPixels();
                        var w = seSelection.w, h = seSelection.h;
                        for (var y = 0; y < h; y++)
                            for (var x = 0; x < w; x++)
                                setGfxPixel(seSelection.x + x, seSelection.y + y, data[(h - 1 - y) * w + x]);
                        seRenderCanvas(); notifyGfxChanged();
                    }

                    function seShiftSelection(dx, dy) {
                        if (!seSelection) return;
                        pushUndo();
                        var data = seGetSelectionPixels();
                        seClearRect(seSelection.x, seSelection.y, seSelection.w, seSelection.h, seBgColor);
                        seSelection.x += dx; seSelection.y += dy;
                        sePastePixels(seSelection.x, seSelection.y, seSelection.w, seSelection.h, data);
                        seRenderCanvas(); notifyGfxChanged();
                    }

                    function seCopySelection() {
                        if (!seSelection) return;
                        seClipboard = { w: seSelection.w, h: seSelection.h, data: seGetSelectionPixels() };
                    }

                    function seCutSelection() {
                        if (!seSelection) return;
                        pushUndo();
                        seClipboard = { w: seSelection.w, h: seSelection.h, data: seGetSelectionPixels() };
                        seClearRect(seSelection.x, seSelection.y, seSelection.w, seSelection.h, seBgColor);
                        seRenderCanvas(); notifyGfxChanged();
                    }

                    function sePasteClipboard() {
                        if (!seClipboard) return;
                        pushUndo();
                        var px = seMouseX >= 0 ? seMouseX : 0;
                        var py = seMouseY >= 0 ? seMouseY : 0;
                        sePastePixels(px, py, seClipboard.w, seClipboard.h, seClipboard.data);
                        seSelection = { x: px, y: py, w: seClipboard.w, h: seClipboard.h };
                        seRenderCanvas(); notifyGfxChanged();
                    }

                    function seDeleteSelection() {
                        if (!seSelection) return;
                        pushUndo();
                        seClearRect(seSelection.x, seSelection.y, seSelection.w, seSelection.h, seBgColor);
                        seSelection = null;
                        seRenderCanvas(); notifyGfxChanged();
                    }

                    // ---- Quick Palette ----

                    function seShowQuickPalette(mx, my) {
                        var qp = document.getElementById('quick-palette');
                        qp.innerHTML = '';
                        qp.style.display = 'block';
                        qp.style.left = mx + 'px';
                        qp.style.top = my + 'px';
                        for (var i = 0; i < 16; i++) {
                            var sw = document.createElement('span');
                            sw.className = 'qp-swatch';
                            sw.style.background = PAL[i];
                            if (i % 4 === 0 && i > 0) { var br = document.createElement('br'); qp.appendChild(br); }
                            (function(ci) {
                                sw.onmousedown = function(e) {
                                    e.preventDefault(); e.stopPropagation();
                                    if (e.button === 2) { seBgColor = ci; }
                                    else { seFgColor = ci; }
                                    seHideQuickPalette();
                                    seRenderPalette();
                                };
                                sw.oncontextmenu = function(e) { e.preventDefault(); };
                            })(i);
                            qp.appendChild(sw);
                        }
                        seQuickPaletteVisible = true;
                    }

                    function seHideQuickPalette() {
                        var qp = document.getElementById('quick-palette');
                        qp.style.display = 'none';
                        seQuickPaletteVisible = false;
                    }

                    // ---- Build toolbar, palette, status ----

                    function seRenderToolbar() {
                        var tb = document.getElementById('sprite-toolbar');
                        tb.innerHTML = '';

                        // Drawing tools (editable only)
                        if (EDITABLE) {
                            var tools = [
                                { id: 'pencil', label: LOCALE.toolPencil, key: 'D', icon: '\\u270e' },
                                { id: 'fill', label: LOCALE.toolFill, key: 'F', icon: '\\u25a7' },
                                { id: 'rectangle', label: LOCALE.toolRectangle, key: 'R', icon: '\\u25ad' },
                                { id: 'circle', label: LOCALE.toolCircle, key: 'C', icon: '\\u25cb' },
                                { id: 'line', label: LOCALE.toolLine, key: 'L', icon: '\\u2571' },
                                { id: 'select', label: LOCALE.toolSelect, key: 'S', icon: '\\u25a1' },
                                { id: 'hand', label: LOCALE.toolHand, key: 'P', icon: '\\u270b' }
                            ];
                            tools.forEach(function(t) {
                                var btn = document.createElement('button');
                                btn.className = 'tool-btn' + (seTool === t.id ? ' active' : '');
                                btn.textContent = t.icon;
                                btn.title = t.label + ' (' + t.key + ')';
                                btn.onclick = function() { seTool = t.id; seRenderToolbar(); seUpdateCursor(); };
                                tb.appendChild(btn);
                            });
                            var sep1 = document.createElement('span');
                            sep1.className = 'tool-sep';
                            tb.appendChild(sep1);
                        }

                        // Color palette swatches
                        for (var i = 0; i < 16; i++) {
                            (function(ci) {
                                var sw = document.createElement('span');
                                sw.className = 'pal-swatch';
                                if (ci === seFgColor) sw.className += ' fg-active';
                                if (ci === seBgColor) sw.className += ' bg-active';
                                sw.style.background = PAL[ci];
                                sw.title = ci.toString();
                                sw.onmousedown = function(e) {
                                    e.preventDefault();
                                    if (e.button === 2) { seBgColor = ci; }
                                    else { seFgColor = ci; }
                                    seRenderToolbar();
                                    seUpdateStatus();
                                };
                                sw.oncontextmenu = function(e) { e.preventDefault(); };
                                tb.appendChild(sw);
                            })(i);
                        }
                        var palInfo = document.createElement('span');
                        palInfo.className = 'pal-info';
                        palInfo.textContent = LOCALE.foreground + ':' + seFgColor + ' ' + LOCALE.background + ':' + seBgColor;
                        tb.appendChild(palInfo);

                        // Separator before flags
                        var sep2 = document.createElement('span');
                        sep2.className = 'tool-sep';
                        tb.appendChild(sep2);

                        // Flag filter buttons
                        var flagFilterGrp = document.createElement('span');
                        flagFilterGrp.className = 'flag-group';
                        for (var fi = 0; fi < 8; fi++) {
                            (function(idx) {
                                var fb = document.createElement('button');
                                fb.className = 'flag-btn' + (seFlagFilter[idx] ? ' active' : '');
                                fb.style.background = seFlagColors[idx];
                                fb.title = LOCALE.flagLabel + ' ' + idx;
                                fb.onclick = function() {
                                    seFlagFilter[idx] = !seFlagFilter[idx];
                                    seRenderToolbar();
                                    seRenderOverlay();
                                };
                                flagFilterGrp.appendChild(fb);
                            })(fi);
                        }
                        tb.appendChild(flagFilterGrp);

                        // Flag editor circles (per hovered sprite)
                        var flagEditGrp = document.createElement('span');
                        flagEditGrp.className = 'flag-group';
                        var sprIdx = -1;
                        if (seMouseX >= 0 && seMouseX < 128 && seMouseY >= 0 && seMouseY < 128) {
                            sprIdx = Math.floor(seMouseY / 8) * 16 + Math.floor(seMouseX / 8);
                        }
                        var flagByte = sprIdx >= 0 ? (FLAGS[sprIdx] || 0) : 0;
                        for (var fi2 = 0; fi2 < 8; fi2++) {
                            (function(idx) {
                                var dot = document.createElement('button');
                                dot.className = 'flag-dot';
                                if (sprIdx >= 0 && (flagByte & (1 << idx))) {
                                    dot.className += ' set';
                                    dot.style.background = seFlagColors[idx];
                                } else {
                                    dot.style.background = 'transparent';
                                }
                                dot.style.borderColor = (sprIdx >= 0 && (flagByte & (1 << idx))) ? '#fff' : seFlagColors[idx];
                                dot.title = LOCALE.flagLabel + ' ' + idx;
                                if (EDITABLE && sprIdx >= 0) {
                                    dot.onclick = function() {
                                        FLAGS[sprIdx] ^= (1 << idx);
                                        seRenderToolbar();
                                        seRenderOverlay();
                                        notifyFlagsChanged();
                                    };
                                }
                                flagEditGrp.appendChild(dot);
                            })(fi2);
                        }
                        tb.appendChild(flagEditGrp);

                        // Separator before zoom
                        var sep3 = document.createElement('span');
                        sep3.className = 'tool-sep';
                        tb.appendChild(sep3);

                        // Zoom controls
                        var zg = document.createElement('span');
                        zg.className = 'zoom-group';
                        var zminus = document.createElement('button');
                        zminus.className = 'tool-btn'; zminus.textContent = '-'; zminus.title = LOCALE.zoomOut;
                        zminus.onclick = function() { seSetZoom(seZoom / 1.5); };
                        var zlabel = document.createElement('span');
                        zlabel.className = 'zoom-label'; zlabel.textContent = seZoom + 'x';
                        var zplus = document.createElement('button');
                        zplus.className = 'tool-btn'; zplus.textContent = '+'; zplus.title = LOCALE.zoomIn;
                        zplus.onclick = function() { seSetZoom(seZoom * 1.5); };
                        var zfit = document.createElement('button');
                        zfit.className = 'tool-btn'; zfit.textContent = LOCALE.zoomFit; zfit.title = LOCALE.zoomFit + ' (0)';
                        zfit.onclick = function() { seFitCanvas(); seUpdateCanvasTransform(); seRenderOverlay(); seUpdateZoomLabel(); };
                        zg.appendChild(zminus); zg.appendChild(zlabel); zg.appendChild(zplus); zg.appendChild(zfit);
                        tb.appendChild(zg);
                    }

                    function seRenderPalette() {
                        // Palette is now part of the toolbar; delegate to seRenderToolbar
                        seRenderToolbar();
                    }

                    function seUpdateStatus() {
                        var st = document.getElementById('sprite-status');
                        if (seMouseX >= 0 && seMouseX < 128 && seMouseY >= 0 && seMouseY < 128) {
                            var sprNum = Math.floor(seMouseY / 8) * 16 + Math.floor(seMouseX / 8);
                            var flagByte = FLAGS[sprNum] || 0;
                            var flagList = [];
                            for (var fi = 0; fi < 8; fi++) {
                                if (flagByte & (1 << fi)) flagList.push(fi);
                            }
                            var flagStr = flagList.length > 0 ? ('  ' + LOCALE.flagsLabel + ': ' + flagList.join(',')) : '';
                            st.textContent = LOCALE.position + ': (' + seMouseX + ', ' + seMouseY + ')  ' + LOCALE.spriteLabel + ': #' + sprNum + '  ' + LOCALE.foreground + ':' + seFgColor + ' ' + LOCALE.background + ':' + seBgColor + flagStr;
                        } else {
                            st.textContent = '';
                        }
                    }

                    function seSetZoom(newZoom) {
                        var wrap = document.getElementById('sprite-canvas-wrap');
                        var rect = wrap.getBoundingClientRect();
                        seApplyZoom(newZoom, rect.width / 2, rect.height / 2);
                    }

                    function seUpdateCursor() {
                        var wrap = document.getElementById('sprite-canvas-wrap');
                        if (!wrap) return;
                        if (seTool === 'hand' || seSpaceHeld) {
                            wrap.style.cursor = seIsPanning ? 'grabbing' : 'grab';
                        } else if (seTool === 'fill') {
                            wrap.style.cursor = 'crosshair';
                        } else if (seTool === 'select') {
                            wrap.style.cursor = 'crosshair';
                        } else {
                            wrap.style.cursor = 'crosshair';
                        }
                    }

                    // ---- Mouse event handlers ----

                    function seOnMouseDown(e) {
                        var wrap = document.getElementById('sprite-canvas-wrap');
                        var pos = seScreenToPixel(e.clientX, e.clientY);
                        seMouseX = pos.px; seMouseY = pos.py;

                        if (seQuickPaletteVisible) { seHideQuickPalette(); return; }

                        // Middle mouse = pan
                        if (e.button === 1) {
                            e.preventDefault();
                            seIsPanning = true;
                            sePanStart = { mx: e.clientX, my: e.clientY, px: sePanX, py: sePanY };
                            seUpdateCursor();
                            return;
                        }

                        // Right click = color pick
                        if (e.button === 2) {
                            e.preventDefault();
                            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                                seFgColor = getGfxPixel(pos.px, pos.py);
                                seRenderPalette();
                            }
                            return;
                        }

                        if (!EDITABLE) return;

                        // Hand tool or space held
                        if (seTool === 'hand' || seSpaceHeld) {
                            seIsPanning = true;
                            sePanStart = { mx: e.clientX, my: e.clientY, px: sePanX, py: sePanY };
                            seUpdateCursor();
                            return;
                        }

                        if (seTool === 'pencil') {
                            if (e.ctrlKey || e.metaKey) {
                                // Search and replace
                                if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                                    pushUndo();
                                    searchReplace(getGfxPixel(pos.px, pos.py), seFgColor);
                                    seRenderCanvas(); notifyGfxChanged();
                                }
                                return;
                            }
                            pushUndo();
                            seIsDrawing = true;
                            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                                setGfxPixel(pos.px, pos.py, seFgColor);
                                seRenderCanvas();
                            }
                        } else if (seTool === 'fill') {
                            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                                pushUndo();
                                floodFill(pos.px, pos.py, seFgColor);
                                seRenderCanvas(); notifyGfxChanged();
                            }
                        } else if (seTool === 'rectangle' || seTool === 'circle' || seTool === 'line') {
                            pushUndo();
                            seIsDrawing = true;
                            seDrawStart = { x: pos.px, y: pos.py };
                        } else if (seTool === 'select') {
                            // Check if clicking inside existing selection
                            if (seSelection && pos.px >= seSelection.x && pos.px < seSelection.x + seSelection.w &&
                                pos.py >= seSelection.y && pos.py < seSelection.y + seSelection.h) {
                                // Start dragging selection
                                seSelDragging = true;
                                seSelDragStart = { mx: pos.px, my: pos.py, sx: seSelection.x, sy: seSelection.y };
                                pushUndo();
                                // Lift pixels
                                seSelection.data = seGetSelectionPixels();
                                seClearRect(seSelection.x, seSelection.y, seSelection.w, seSelection.h, seBgColor);
                            } else {
                                // New selection
                                seSelection = null;
                                seIsDrawing = true;
                                seDrawStart = { x: pos.px, y: pos.py };
                            }
                        }
                    }

                    function seOnMouseMove(e) {
                        var pos = seScreenToPixel(e.clientX, e.clientY);
                        seMouseX = pos.px; seMouseY = pos.py;
                        seUpdateStatus();

                        // Update palette flag dots when hovered sprite changes
                        var curSpr = (seMouseX >= 0 && seMouseX < 128 && seMouseY >= 0 && seMouseY < 128)
                            ? Math.floor(seMouseY / 8) * 16 + Math.floor(seMouseX / 8) : -1;
                        if (curSpr !== seLastHoveredSprite) {
                            seLastHoveredSprite = curSpr;
                            seRenderPalette();
                        }

                        if (seIsPanning && sePanStart) {
                            sePanX = sePanStart.px + (e.clientX - sePanStart.mx);
                            sePanY = sePanStart.py + (e.clientY - sePanStart.my);
                            seClampPan();
                            seUpdateCanvasTransform();
                            seRenderOverlay();
                            return;
                        }

                        if (!EDITABLE) { seRenderOverlay(); return; }

                        if (seIsDrawing && seTool === 'pencil') {
                            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                                setGfxPixel(pos.px, pos.py, seFgColor);
                                seRenderCanvas();
                            }
                        } else if (seIsDrawing && (seTool === 'rectangle' || seTool === 'circle' || seTool === 'line')) {
                            seRenderOverlay(); // show preview
                        } else if (seIsDrawing && seTool === 'select' && seDrawStart) {
                            // Update selection preview
                            var x0 = Math.min(seDrawStart.x, pos.px);
                            var y0 = Math.min(seDrawStart.y, pos.py);
                            var x1 = Math.max(seDrawStart.x, pos.px);
                            var y1 = Math.max(seDrawStart.y, pos.py);
                            var cx0 = Math.max(0, Math.min(127, x0));
                            var cy0 = Math.max(0, Math.min(127, y0));
                            var cx1 = Math.max(0, Math.min(127, x1));
                            var cy1 = Math.max(0, Math.min(127, y1));
                            seSelection = { x: Math.min(cx0, cx1), y: Math.min(cy0, cy1), w: Math.abs(cx1 - cx0) + 1, h: Math.abs(cy1 - cy0) + 1 };
                            seRenderOverlay();
                        } else if (seSelDragging && seSelDragStart && seSelection) {
                            var dx = pos.px - seSelDragStart.mx;
                            var dy = pos.py - seSelDragStart.my;
                            // Repaint previous position with bg
                            seSelection.x = seSelDragStart.sx + dx;
                            seSelection.y = seSelDragStart.sy + dy;
                            seRenderOverlay();
                        } else {
                            seRenderOverlay();
                        }
                    }

                    function seOnMouseUp(e) {
                        if (seIsPanning) {
                            seIsPanning = false;
                            sePanStart = null;
                            seUpdateCursor();
                            return;
                        }

                        if (!EDITABLE) return;

                        if (seIsDrawing && seTool === 'pencil') {
                            seIsDrawing = false;
                            notifyGfxChanged();
                        } else if (seIsDrawing && seDrawStart) {
                            var pos = seScreenToPixel(e.clientX, e.clientY);
                            var x0 = seDrawStart.x, y0 = seDrawStart.y;
                            var x1 = pos.px, y1 = pos.py;

                            if (seTool === 'select') {
                                // Selection finalized
                                seIsDrawing = false;
                                seDrawStart = null;
                                // seSelection already set in mousemove
                                if (seSelection && (seSelection.w <= 0 || seSelection.h <= 0)) seSelection = null;
                                seRenderOverlay();
                                return;
                            }

                            // Constrain modifiers
                            if (e.shiftKey) {
                                if (seTool === 'line') { var sn = snapLine45(x0, y0, x1, y1); x1 = sn.x; y1 = sn.y; }
                                else { var sq = constrainSquare(x0, y0, x1, y1); x1 = sq.x; y1 = sq.y; }
                            }

                            var filled = e.ctrlKey || e.metaKey;

                            if (seTool === 'rectangle') {
                                drawRect(x0, y0, x1, y1, seFgColor, filled);
                            } else if (seTool === 'circle') {
                                drawEllipse(x0, y0, x1, y1, seFgColor, filled);
                            } else if (seTool === 'line') {
                                drawBresenhamLine(x0, y0, x1, y1, seFgColor);
                            }

                            seIsDrawing = false;
                            seDrawStart = null;
                            seRenderCanvas();
                            notifyGfxChanged();
                        }

                        if (seSelDragging && seSelection && seSelection.data) {
                            // Drop selection at new position
                            sePastePixels(seSelection.x, seSelection.y, seSelection.w, seSelection.h, seSelection.data);
                            seSelection.data = null;
                            seSelDragging = false;
                            seSelDragStart = null;
                            seRenderCanvas();
                            notifyGfxChanged();
                        }
                    }

                    function seApplyZoom(newZoom, anchorMx, anchorMy) {
                        newZoom = Math.max(seZoomMin, Math.min(seZoomMax, newZoom));
                        if (newZoom === seZoom) return;
                        // Keep the pixel under anchor fixed
                        var cpx = (anchorMx - sePanX) / seZoom;
                        var cpy = (anchorMy - sePanY) / seZoom;
                        seZoom = newZoom;
                        sePanX = Math.round(anchorMx - cpx * seZoom);
                        sePanY = Math.round(anchorMy - cpy * seZoom);
                        seClampPan();
                        seUpdateCanvasTransform();
                        seRenderOverlay();
                        seUpdateZoomLabel();
                    }

                    function seUpdateZoomLabel() {
                        var txt = seZoom >= 1 ? Math.round(seZoom) + 'x' : seZoom.toFixed(1) + 'x';
                        var labels = document.querySelectorAll('.zoom-label');
                        labels.forEach(function(el) { el.textContent = txt; });
                    }

                    function seOnWheel(e) {
                        e.preventDefault();
                        // If hand tool active or space held, use wheel for panning
                        if (seSpaceHeld || seTool === 'hand') {
                            sePanX -= e.deltaX;
                            sePanY -= e.deltaY;
                            seClampPan();
                            seUpdateCanvasTransform();
                            seRenderOverlay();
                            return;
                        }
                        var pos = seScreenToPixel(e.clientX, e.clientY);
                        // Smooth zoom: compute multiplier from deltaY
                        // Normalize: trackpad sends small deltas (~1-10), mouse wheel sends larger (~100)
                        // Use pow so the feel is proportional to scroll amount
                        var delta = -e.deltaY;
                        if (e.deltaMode === 1) delta *= 30; // line mode
                        else if (e.deltaMode === 2) delta *= 300; // page mode
                        var factor = Math.pow(seZoomFactor, delta / 50);
                        seApplyZoom(seZoom * factor, pos.mx, pos.my);
                    }

                    function seOnKeyDown(e) {
                        // Only handle when gfx tab is active
                        var gfxTab = document.getElementById('tab-gfx');
                        if (!gfxTab || !gfxTab.classList.contains('active')) return;

                        var key = e.key.toLowerCase();

                        // Quick palette
                        if (key === 'x' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            var wrap = document.getElementById('sprite-canvas-wrap');
                            var rect = wrap.getBoundingClientRect();
                            var mx = (seMouseX >= 0 ? seMouseX * seZoom + sePanX : rect.width / 2);
                            var my = (seMouseY >= 0 ? seMouseY * seZoom + sePanY : rect.height / 2);
                            if (seQuickPaletteVisible) seHideQuickPalette();
                            else seShowQuickPalette(mx, my);
                            return;
                        }

                        // Space for temporary hand
                        if (key === ' ' && !seSpaceHeld) {
                            e.preventDefault();
                            seSpaceHeld = true;
                            sePrevTool = seTool;
                            seTool = 'hand';
                            seRenderToolbar();
                            seUpdateCursor();
                            return;
                        }

                        // Zoom
                        if (key === '=' || key === '+') { e.preventDefault(); seSetZoom(seZoom * 1.5); return; }
                        if (key === '-') { e.preventDefault(); seSetZoom(seZoom / 1.5); return; }
                        if (key === '0') { e.preventDefault(); seFitCanvas(); seUpdateCanvasTransform(); seRenderOverlay(); seUpdateZoomLabel(); return; }

                        // Undo/Redo
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey && EDITABLE) { e.preventDefault(); doUndo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey && EDITABLE) { e.preventDefault(); doRedo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'y' && EDITABLE) { e.preventDefault(); doRedo(); return; }

                        // Copy/Cut/Paste
                        if ((e.ctrlKey || e.metaKey) && key === 'c' && seTool === 'select' && EDITABLE) { e.preventDefault(); seCopySelection(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'x' && seTool === 'select' && EDITABLE) { e.preventDefault(); seCutSelection(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'v' && EDITABLE) { e.preventDefault(); sePasteClipboard(); return; }

                        if (!EDITABLE) return;

                        // Tool shortcuts
                        if (key === 'd' && !e.ctrlKey) { seTool = 'pencil'; seRenderToolbar(); seUpdateCursor(); return; }
                        if (key === 'f' && !e.ctrlKey) { seTool = 'fill'; seRenderToolbar(); seUpdateCursor(); return; }
                        if (key === 'r' && !e.ctrlKey) { seTool = 'rectangle'; seRenderToolbar(); seUpdateCursor(); return; }
                        if (key === 'c' && !e.ctrlKey && !e.metaKey) { seTool = 'circle'; seRenderToolbar(); seUpdateCursor(); return; }
                        if (key === 'l' && !e.ctrlKey) { seTool = 'line'; seRenderToolbar(); seUpdateCursor(); return; }
                        if (key === 's' && !e.ctrlKey && !e.metaKey) { seTool = 'select'; seRenderToolbar(); seUpdateCursor(); return; }
                        if (key === 'p' && !e.ctrlKey) { seTool = 'hand'; seRenderToolbar(); seUpdateCursor(); return; }

                        // Selection operations
                        if (seTool === 'select' && seSelection) {
                            if (key === 'h') { seFlipH(); return; }
                            if (key === 'v' && !e.ctrlKey) { seFlipV(); return; }
                            if (key === 'arrowleft') { e.preventDefault(); seShiftSelection(-1, 0); return; }
                            if (key === 'arrowright') { e.preventDefault(); seShiftSelection(1, 0); return; }
                            if (key === 'arrowup') { e.preventDefault(); seShiftSelection(0, -1); return; }
                            if (key === 'arrowdown') { e.preventDefault(); seShiftSelection(0, 1); return; }
                            if (key === 'delete' || key === 'backspace') { e.preventDefault(); seDeleteSelection(); return; }
                            if (key === 'escape') { seSelection = null; seRenderOverlay(); return; }
                        }
                    }

                    function seOnKeyUp(e) {
                        if (e.key === ' ' && seSpaceHeld) {
                            seSpaceHeld = false;
                            if (sePrevTool) seTool = sePrevTool;
                            sePrevTool = null;
                            seRenderToolbar();
                            seUpdateCursor();
                        }
                    }

                    // ---- Initialize ----

                    function initSpriteEditor() {
                        if (spriteEditorInited) {
                            seRenderCanvas();
                            return;
                        }
                        spriteEditorInited = true;

                        seRenderToolbar();
                        seUpdateStatus();
                        seFitCanvas();
                        seRenderCanvas();

                        var wrap = document.getElementById('sprite-canvas-wrap');
                        wrap.addEventListener('mousedown', seOnMouseDown);
                        wrap.addEventListener('contextmenu', function(e) { e.preventDefault(); });
                        window.addEventListener('mousemove', seOnMouseMove);
                        window.addEventListener('mouseup', seOnMouseUp);
                        wrap.addEventListener('wheel', seOnWheel, { passive: false });
                        window.addEventListener('keydown', seOnKeyDown);
                        window.addEventListener('keyup', seOnKeyUp);

                        // Marching ants animation
                        seMarchingAntsTimer = setInterval(function() {
                            if (seSelection) {
                                seMarchingAntsOffset = (seMarchingAntsOffset + 1) % 8;
                                seRenderOverlay();
                            }
                        }, 150);

                        // Click outside quick palette to close
                        window.addEventListener('mousedown', function(e) {
                            if (seQuickPaletteVisible) {
                                var qp = document.getElementById('quick-palette');
                                if (!qp.contains(e.target)) seHideQuickPalette();
                            }
                        });
                    }
                    // ============ END SPRITE EDITOR ============`;
}

function getMapEditorScript(): string {
    return `
                    // ============ MAP EDITOR ============
                    var mapEditorInited = false;
                    var meZoom = 1;
                    var meZoomMin = 0.5;
                    var meZoomMax = 16;
                    var meZoomFactor = 1.08;
                    var mePanX = 0, mePanY = 0;
                    var meTool = 'pencil';
                    var mePrevTool = null;
                    var meFgTile = 1;
                    var meMouseTX = -1, meMouseTY = -1;
                    var meIsDrawing = false;
                    var meIsPanning = false;
                    var mePanStart = null;
                    var meSpaceHeld = false;
                    var meUndoStack = [];
                    var meRedoStack = [];
                    var meMaxUndo = 50;
                    var meSelection = null;
                    var meClipboard = null;
                    var meSelDragging = false;
                    var meSelDragStart = null;
                    var meMapChangedTimer = null;
                    var meMarchingAntsOffset = 0;
                    var meMarchingAntsTimer = null;
                    var meTilePickerVisible = false;
                    var tpZoom = 4;
                    var tpPanX = 0, tpPanY = 0;
                    var tpIsPanning = false;
                    var tpPanStart = null;
                    var tpCvs = null;
                    var tpHoverTile = -1;

                    // ---- Tile get/set ----

                    function meGetTile(tx, ty) {
                        if (tx < 0 || tx >= 128 || ty < 0 || ty >= 64) return 0;
                        if (ty < 32) {
                            return MAP[ty * 128 + tx] || 0;
                        } else {
                            return GFX[4096 + (ty - 32) * 128 + tx] || 0;
                        }
                    }

                    function meSetTile(tx, ty, sprIdx) {
                        if (tx < 0 || tx >= 128 || ty < 0 || ty >= 64) return;
                        if (ty < 32) {
                            MAP[ty * 128 + tx] = sprIdx;
                        } else {
                            GFX[4096 + (ty - 32) * 128 + tx] = sprIdx;
                        }
                    }

                    // ---- Undo/Redo ----

                    function mePushUndo() {
                        meUndoStack.push({ map: MAP.slice(), gfx: GFX.slice() });
                        if (meUndoStack.length > meMaxUndo) meUndoStack.shift();
                        meRedoStack = [];
                    }

                    function meDoUndo() {
                        if (meUndoStack.length === 0) return;
                        meRedoStack.push({ map: MAP.slice(), gfx: GFX.slice() });
                        var prev = meUndoStack.pop();
                        for (var i = 0; i < prev.map.length; i++) MAP[i] = prev.map[i];
                        for (var j = 0; j < prev.gfx.length; j++) GFX[j] = prev.gfx[j];
                        meRenderCanvas();
                        notifyMapChanged();
                    }

                    function meDoRedo() {
                        if (meRedoStack.length === 0) return;
                        meUndoStack.push({ map: MAP.slice(), gfx: GFX.slice() });
                        var next = meRedoStack.pop();
                        for (var i = 0; i < next.map.length; i++) MAP[i] = next.map[i];
                        for (var j = 0; j < next.gfx.length; j++) GFX[j] = next.gfx[j];
                        meRenderCanvas();
                        notifyMapChanged();
                    }

                    function notifyMapChanged() {
                        if (!EDITABLE) return;
                        if (meMapChangedTimer) clearTimeout(meMapChangedTimer);
                        meMapChangedTimer = setTimeout(function() {
                            vscodeApi.postMessage({ type: 'mapChanged', map: MAP.slice() });
                        }, 100);
                    }

                    // ---- Coordinate helpers ----

                    function meScreenToTile(clientX, clientY) {
                        var wrap = document.getElementById('map-canvas-wrap');
                        var rect = wrap.getBoundingClientRect();
                        var mx = clientX - rect.left;
                        var my = clientY - rect.top;
                        var px = (mx - mePanX) / meZoom;
                        var py = (my - mePanY) / meZoom;
                        var tx = Math.floor(px / 8);
                        var ty = Math.floor(py / 8);
                        return { tx: tx, ty: ty, mx: mx, my: my };
                    }

                    function meClampPan() {
                        var wrap = document.getElementById('map-canvas-wrap');
                        if (!wrap) return;
                        var cw = 1024 * meZoom;
                        var ch = 512 * meZoom;
                        var ww = wrap.clientWidth;
                        var wh = wrap.clientHeight;
                        var margin = 32;
                        if (mePanX > ww - margin) mePanX = ww - margin;
                        if (mePanY > wh - margin) mePanY = wh - margin;
                        if (mePanX < -(cw - margin)) mePanX = -(cw - margin);
                        if (mePanY < -(ch - margin)) mePanY = -(ch - margin);
                    }

                    function meFitCanvas() {
                        var wrap = document.getElementById('map-canvas-wrap');
                        if (!wrap) return;
                        var ww = wrap.clientWidth;
                        var wh = wrap.clientHeight;
                        var fitZoom = Math.min(ww * 0.8 / 1024, wh * 0.8 / 512);
                        meZoom = Math.max(meZoomMin, Math.min(meZoomMax, fitZoom));
                        var cw = 1024 * meZoom;
                        var ch = 512 * meZoom;
                        mePanX = Math.floor((ww - cw) / 2);
                        mePanY = Math.floor((wh - ch) / 2);
                    }

                    function meUpdateCanvasTransform() {
                        var cvs = document.getElementById('cvs-map');
                        var overlay = document.getElementById('cvs-map-overlay');
                        var sw = 1024 * meZoom;
                        var sh = 512 * meZoom;
                        var ws = sw + 'px';
                        var hs = sh + 'px';
                        cvs.style.width = ws; cvs.style.height = hs;
                        cvs.style.left = mePanX + 'px'; cvs.style.top = mePanY + 'px';
                        overlay.width = sw; overlay.height = sh;
                        overlay.style.width = ws; overlay.style.height = hs;
                        overlay.style.left = mePanX + 'px'; overlay.style.top = mePanY + 'px';
                    }

                    // ---- Flood fill ----

                    function meFloodFill(tx, ty, newTile) {
                        var targetTile = meGetTile(tx, ty);
                        if (targetTile === newTile) return;
                        var stack = [[tx, ty]];
                        var visited = {};
                        while (stack.length > 0) {
                            var p = stack.pop();
                            var cx = p[0], cy = p[1];
                            if (cx < 0 || cx >= 128 || cy < 0 || cy >= 64) continue;
                            var key = cx + ',' + cy;
                            if (visited[key]) continue;
                            if (meGetTile(cx, cy) !== targetTile) continue;
                            visited[key] = true;
                            meSetTile(cx, cy, newTile);
                            stack.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
                        }
                    }

                    // ---- Selection helpers ----

                    function meGetSelectionTiles() {
                        if (!meSelection) return null;
                        var data = [];
                        for (var y = 0; y < meSelection.h; y++) {
                            for (var x = 0; x < meSelection.w; x++) {
                                data.push(meGetTile(meSelection.x + x, meSelection.y + y));
                            }
                        }
                        return data;
                    }

                    function mePasteTiles(px, py, w, h, data) {
                        for (var y = 0; y < h; y++)
                            for (var x = 0; x < w; x++)
                                meSetTile(px + x, py + y, data[y * w + x]);
                    }

                    function meClearTileRect(x, y, w, h) {
                        for (var yy = 0; yy < h; yy++)
                            for (var xx = 0; xx < w; xx++)
                                meSetTile(x + xx, y + yy, 0);
                    }

                    function meCopySelection() {
                        if (!meSelection) return;
                        meClipboard = { w: meSelection.w, h: meSelection.h, data: meGetSelectionTiles() };
                    }

                    function meCutSelection() {
                        if (!meSelection) return;
                        mePushUndo();
                        meClipboard = { w: meSelection.w, h: meSelection.h, data: meGetSelectionTiles() };
                        meClearTileRect(meSelection.x, meSelection.y, meSelection.w, meSelection.h);
                        meRenderCanvas(); notifyMapChanged();
                    }

                    function mePasteClipboard() {
                        if (!meClipboard) return;
                        mePushUndo();
                        var tx = meMouseTX >= 0 ? meMouseTX : 0;
                        var ty = meMouseTY >= 0 ? meMouseTY : 0;
                        mePasteTiles(tx, ty, meClipboard.w, meClipboard.h, meClipboard.data);
                        meSelection = { x: tx, y: ty, w: meClipboard.w, h: meClipboard.h };
                        meRenderCanvas(); notifyMapChanged();
                    }

                    function meDeleteSelection() {
                        if (!meSelection) return;
                        mePushUndo();
                        meClearTileRect(meSelection.x, meSelection.y, meSelection.w, meSelection.h);
                        meSelection = null;
                        meRenderCanvas(); notifyMapChanged();
                    }

                    // ---- Rendering ----

                    function meRenderCanvas() {
                        var cvs = document.getElementById('cvs-map');
                        var ctx = cvs.getContext('2d');
                        var imgData = ctx.createImageData(1024, 512);
                        for (var ty = 0; ty < 64; ty++) {
                            for (var tx = 0; tx < 128; tx++) {
                                var spriteIdx = meGetTile(tx, ty);
                                if (spriteIdx === 0) continue;
                                var spritePixels = getSprite(spriteIdx);
                                var baseX = tx * 8, baseY = ty * 8;
                                for (var py = 0; py < 8; py++) {
                                    for (var px = 0; px < 8; px++) {
                                        var color = spritePixels[py * 8 + px];
                                        var hex = PAL[color & 15];
                                        var r = parseInt(hex.substr(1,2), 16);
                                        var g = parseInt(hex.substr(3,2), 16);
                                        var bVal = parseInt(hex.substr(5,2), 16);
                                        var idx = ((baseY + py) * 1024 + baseX + px) * 4;
                                        imgData.data[idx] = r; imgData.data[idx+1] = g; imgData.data[idx+2] = bVal; imgData.data[idx+3] = 255;
                                    }
                                }
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                        meUpdateCanvasTransform();
                        meRenderOverlay();
                    }

                    function meRenderOverlay() {
                        var overlay = document.getElementById('cvs-map-overlay');
                        var ctx = overlay.getContext('2d');
                        var sw = 1024 * meZoom;
                        var sh = 512 * meZoom;
                        ctx.clearRect(0, 0, sw, sh);

                        // Tile grid at zoom >= 1
                        if (meZoom >= 1) {
                            ctx.strokeStyle = 'rgba(68,68,68,0.5)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            for (var gx = 0; gx <= 1024; gx += 8) {
                                ctx.moveTo(gx * meZoom + 0.5, 0);
                                ctx.lineTo(gx * meZoom + 0.5, sh);
                            }
                            for (var gy = 0; gy <= 512; gy += 8) {
                                ctx.moveTo(0, gy * meZoom + 0.5);
                                ctx.lineTo(sw, gy * meZoom + 0.5);
                            }
                            ctx.stroke();
                        }

                        // Hover tile highlight
                        if (meMouseTX >= 0 && meMouseTX < 128 && meMouseTY >= 0 && meMouseTY < 64) {
                            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(
                                meMouseTX * 8 * meZoom + 0.5,
                                meMouseTY * 8 * meZoom + 0.5,
                                8 * meZoom - 1,
                                8 * meZoom - 1
                            );
                        }

                        // Selection marching ants
                        if (meSelection && !meSelDragging) {
                            ctx.strokeStyle = '#fff';
                            ctx.lineWidth = 1;
                            ctx.setLineDash([4, 4]);
                            ctx.lineDashOffset = meMarchingAntsOffset;
                            ctx.strokeRect(
                                meSelection.x * 8 * meZoom + 0.5,
                                meSelection.y * 8 * meZoom + 0.5,
                                meSelection.w * 8 * meZoom,
                                meSelection.h * 8 * meZoom
                            );
                            ctx.setLineDash([]);
                        }
                    }

                    function meRenderTilePreview() {
                        var pc = document.getElementById('me-tile-preview');
                        if (!pc) return;
                        var ctx = pc.getContext('2d');
                        ctx.clearRect(0, 0, 8, 8);
                        if (meFgTile === 0) return;
                        var spritePixels = getSprite(meFgTile);
                        var imgData = ctx.createImageData(8, 8);
                        for (var i = 0; i < 64; i++) {
                            var color = spritePixels[i];
                            var hex = PAL[color & 15];
                            var r = parseInt(hex.substr(1,2), 16);
                            var g = parseInt(hex.substr(3,2), 16);
                            var bVal = parseInt(hex.substr(5,2), 16);
                            imgData.data[i*4] = r; imgData.data[i*4+1] = g; imgData.data[i*4+2] = bVal; imgData.data[i*4+3] = 255;
                        }
                        ctx.putImageData(imgData, 0, 0);
                    }

                    // ---- Tile Picker (zoomable/pannable) ----

                    function tpRenderCanvas() {
                        if (!tpCvs) return;
                        var ctx = tpCvs.getContext('2d');
                        var imgData = ctx.createImageData(128, 128);
                        for (var si = 0; si < 256; si++) {
                            var sprPixels = getSprite(si);
                            var sx = (si % 16) * 8;
                            var sy = Math.floor(si / 16) * 8;
                            for (var py = 0; py < 8; py++) {
                                for (var px = 0; px < 8; px++) {
                                    var color = sprPixels[py * 8 + px];
                                    var hex = PAL[color & 15];
                                    var r = parseInt(hex.substr(1,2), 16);
                                    var g = parseInt(hex.substr(3,2), 16);
                                    var bVal = parseInt(hex.substr(5,2), 16);
                                    var idx = ((sy + py) * 128 + sx + px) * 4;
                                    imgData.data[idx] = r; imgData.data[idx+1] = g; imgData.data[idx+2] = bVal; imgData.data[idx+3] = 255;
                                }
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                        // Highlight hovered tile
                        if (tpHoverTile >= 0 && tpHoverTile < 256 && tpHoverTile !== meFgTile) {
                            var hhx = (tpHoverTile % 16) * 8;
                            var hhy = Math.floor(tpHoverTile / 16) * 8;
                            ctx.strokeStyle = '#ff0';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(hhx + 0.5, hhy + 0.5, 7, 7);
                        }
                        // Highlight current tile
                        var hx = (meFgTile % 16) * 8;
                        var hy = Math.floor(meFgTile / 16) * 8;
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(hx + 0.5, hy + 0.5, 7, 7);
                    }

                    function tpUpdateTransform() {
                        if (!tpCvs) return;
                        var sw = 128 * tpZoom;
                        var sh = 128 * tpZoom;
                        tpCvs.style.width = sw + 'px';
                        tpCvs.style.height = sh + 'px';
                        tpCvs.style.left = tpPanX + 'px';
                        tpCvs.style.top = tpPanY + 'px';
                    }

                    function tpClampPan() {
                        var picker = document.getElementById('map-tile-picker');
                        if (!picker) return;
                        var cw = 128 * tpZoom;
                        var ch = 128 * tpZoom;
                        var ww = picker.clientWidth;
                        var wh = picker.clientHeight;
                        var margin = 32;
                        if (tpPanX > ww - margin) tpPanX = ww - margin;
                        if (tpPanY > wh - margin) tpPanY = wh - margin;
                        if (tpPanX < -(cw - margin)) tpPanX = -(cw - margin);
                        if (tpPanY < -(ch - margin)) tpPanY = -(ch - margin);
                    }

                    function tpFitAndCenter() {
                        var picker = document.getElementById('map-tile-picker');
                        if (!picker) return;
                        var ww = picker.clientWidth;
                        var wh = picker.clientHeight;
                        var fitZoom = Math.min(ww / 128, wh / 128) * 0.9;
                        tpZoom = Math.max(1, Math.min(16, fitZoom));
                        tpPanX = Math.floor((ww - 128 * tpZoom) / 2);
                        tpPanY = Math.floor((wh - 128 * tpZoom) / 2);
                    }

                    function meShowTilePicker() {
                        var picker = document.getElementById('map-tile-picker');
                        picker.innerHTML = '';
                        tpCvs = document.createElement('canvas');
                        tpCvs.width = 128; tpCvs.height = 128;
                        picker.appendChild(tpCvs);
                        picker.style.display = 'block';
                        meTilePickerVisible = true;

                        tpFitAndCenter();
                        tpRenderCanvas();
                        tpUpdateTransform();
                    }

                    function meHideTilePicker() {
                        var picker = document.getElementById('map-tile-picker');
                        picker.style.display = 'none';
                        meTilePickerVisible = false;
                        tpIsPanning = false;
                        tpPanStart = null;
                        tpCvs = null;
                        tpHoverTile = -1;
                    }

                    function meUpdateTileLabel() {
                        var lbl = document.getElementById('me-tile-label');
                        if (lbl) lbl.textContent = LOCALE.tileLabel + ': #' + meFgTile;
                    }

                    // ---- Toolbar ----

                    function meRenderToolbar() {
                        var tb = document.getElementById('map-toolbar');
                        tb.innerHTML = '';

                        if (EDITABLE) {
                            var tools = [
                                { id: 'pencil', label: LOCALE.toolPencil, key: 'D', icon: '\\u270e' },
                                { id: 'fill', label: LOCALE.toolFill, key: 'F', icon: '\\u25a7' },
                                { id: 'select', label: LOCALE.toolSelect, key: 'S', icon: '\\u25a1' },
                                { id: 'hand', label: LOCALE.toolHand, key: 'P', icon: '\\u270b' }
                            ];
                            tools.forEach(function(t) {
                                var btn = document.createElement('button');
                                btn.className = 'tool-btn' + (meTool === t.id ? ' active' : '');
                                btn.textContent = t.icon;
                                btn.title = t.label + ' (' + t.key + ')';
                                btn.onclick = function() { meTool = t.id; meRenderToolbar(); meUpdateCursor(); };
                                tb.appendChild(btn);
                            });

                            var sep1 = document.createElement('span');
                            sep1.className = 'tool-sep';
                            tb.appendChild(sep1);

                            // Tile preview
                            var previewCvs = document.createElement('canvas');
                            previewCvs.id = 'me-tile-preview';
                            previewCvs.width = 8; previewCvs.height = 8;
                            previewCvs.className = 'tile-preview';
                            previewCvs.title = LOCALE.tilePicker + ' (X)';
                            previewCvs.onclick = function() {
                                if (meTilePickerVisible) meHideTilePicker();
                                else meShowTilePicker();
                            };
                            tb.appendChild(previewCvs);

                            var tileLabel = document.createElement('span');
                            tileLabel.id = 'me-tile-label';
                            tileLabel.className = 'tile-info';
                            tileLabel.textContent = LOCALE.tileLabel + ': #' + meFgTile;
                            tb.appendChild(tileLabel);

                            var sep2 = document.createElement('span');
                            sep2.className = 'tool-sep';
                            tb.appendChild(sep2);
                        }

                        // Zoom controls
                        var zg = document.createElement('span');
                        zg.className = 'zoom-group';
                        var zminus = document.createElement('button');
                        zminus.className = 'tool-btn'; zminus.textContent = '-'; zminus.title = LOCALE.zoomOut;
                        zminus.onclick = function() { meSetZoom(meZoom / 1.5); };
                        var zlabel = document.createElement('span');
                        zlabel.className = 'zoom-label'; zlabel.id = 'me-zoom-label';
                        zlabel.textContent = meZoom >= 1 ? Math.round(meZoom) + 'x' : meZoom.toFixed(1) + 'x';
                        var zplus = document.createElement('button');
                        zplus.className = 'tool-btn'; zplus.textContent = '+'; zplus.title = LOCALE.zoomIn;
                        zplus.onclick = function() { meSetZoom(meZoom * 1.5); };
                        var zfit = document.createElement('button');
                        zfit.className = 'tool-btn'; zfit.textContent = LOCALE.zoomFit; zfit.title = LOCALE.zoomFit + ' (0)';
                        zfit.onclick = function() { meFitCanvas(); meUpdateCanvasTransform(); meRenderOverlay(); meUpdateZoomLabel(); };
                        zg.appendChild(zminus); zg.appendChild(zlabel); zg.appendChild(zplus); zg.appendChild(zfit);
                        tb.appendChild(zg);

                        meRenderTilePreview();
                    }

                    function meUpdateStatus() {
                        var st = document.getElementById('map-status');
                        if (meMouseTX >= 0 && meMouseTX < 128 && meMouseTY >= 0 && meMouseTY < 64) {
                            var sprNum = meGetTile(meMouseTX, meMouseTY);
                            var flagByte = FLAGS[sprNum] || 0;
                            var flagList = [];
                            for (var fi = 0; fi < 8; fi++) {
                                if (flagByte & (1 << fi)) flagList.push(fi);
                            }
                            var flagStr = flagList.length > 0 ? ('  ' + LOCALE.flagsLabel + ': ' + flagList.join(',')) : '';
                            st.textContent = LOCALE.tileLabel + ': (' + meMouseTX + ', ' + meMouseTY + ')  ' + LOCALE.spriteLabel + ': #' + sprNum + flagStr;
                        } else {
                            st.textContent = '';
                        }
                    }

                    function meSetZoom(newZoom) {
                        var wrap = document.getElementById('map-canvas-wrap');
                        var rect = wrap.getBoundingClientRect();
                        meApplyZoom(newZoom, rect.width / 2, rect.height / 2);
                    }

                    function meApplyZoom(newZoom, anchorMx, anchorMy) {
                        newZoom = Math.max(meZoomMin, Math.min(meZoomMax, newZoom));
                        if (newZoom === meZoom) return;
                        var cpx = (anchorMx - mePanX) / meZoom;
                        var cpy = (anchorMy - mePanY) / meZoom;
                        meZoom = newZoom;
                        mePanX = Math.round(anchorMx - cpx * meZoom);
                        mePanY = Math.round(anchorMy - cpy * meZoom);
                        meClampPan();
                        meUpdateCanvasTransform();
                        meRenderOverlay();
                        meUpdateZoomLabel();
                    }

                    function meUpdateZoomLabel() {
                        var lbl = document.getElementById('me-zoom-label');
                        if (lbl) lbl.textContent = meZoom >= 1 ? Math.round(meZoom) + 'x' : meZoom.toFixed(1) + 'x';
                    }

                    function meUpdateCursor() {
                        var wrap = document.getElementById('map-canvas-wrap');
                        if (!wrap) return;
                        if (meTool === 'hand' || meSpaceHeld) {
                            wrap.style.cursor = meIsPanning ? 'grabbing' : 'grab';
                        } else {
                            wrap.style.cursor = 'crosshair';
                        }
                    }

                    // ---- Mouse handlers ----

                    function meOnMouseDown(e) {
                        var pos = meScreenToTile(e.clientX, e.clientY);
                        meMouseTX = pos.tx; meMouseTY = pos.ty;

                        if (meTilePickerVisible) {
                            e.preventDefault();
                            // Middle mouse = pan the picker
                            if (e.button === 1) {
                                tpIsPanning = true;
                                tpPanStart = { mx: e.clientX, my: e.clientY, px: tpPanX, py: tpPanY };
                                return;
                            }
                            // Left click = pick a tile (if on the canvas)
                            if (e.button === 0 && tpCvs) {
                                var rect = tpCvs.getBoundingClientRect();
                                var mx = e.clientX - rect.left;
                                var my = e.clientY - rect.top;
                                if (mx >= 0 && my >= 0 && mx < rect.width && my < rect.height) {
                                    var scaleX = 128 / rect.width;
                                    var scaleY = 128 / rect.height;
                                    var tileX = Math.floor(mx * scaleX / 8);
                                    var tileY = Math.floor(my * scaleY / 8);
                                    meFgTile = Math.max(0, Math.min(255, tileY * 16 + tileX));
                                    meHideTilePicker();
                                    meRenderTilePreview();
                                    meUpdateTileLabel();
                                } else {
                                    // Clicked outside the sprite canvas = close
                                    meHideTilePicker();
                                }
                            }
                            return;
                        }

                        // Middle mouse = pan
                        if (e.button === 1) {
                            e.preventDefault();
                            meIsPanning = true;
                            mePanStart = { mx: e.clientX, my: e.clientY, px: mePanX, py: mePanY };
                            meUpdateCursor();
                            return;
                        }

                        // Right click = eyedropper
                        if (e.button === 2) {
                            e.preventDefault();
                            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                                meFgTile = meGetTile(pos.tx, pos.ty);
                                meRenderTilePreview();
                                meUpdateTileLabel();
                            }
                            return;
                        }

                        if (!EDITABLE) return;

                        // Hand tool or space held
                        if (meTool === 'hand' || meSpaceHeld) {
                            meIsPanning = true;
                            mePanStart = { mx: e.clientX, my: e.clientY, px: mePanX, py: mePanY };
                            meUpdateCursor();
                            return;
                        }

                        if (meTool === 'pencil') {
                            mePushUndo();
                            meIsDrawing = true;
                            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                                meSetTile(pos.tx, pos.ty, meFgTile);
                                meRenderCanvas();
                            }
                        } else if (meTool === 'fill') {
                            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                                mePushUndo();
                                meFloodFill(pos.tx, pos.ty, meFgTile);
                                meRenderCanvas(); notifyMapChanged();
                            }
                        } else if (meTool === 'select') {
                            if (meSelection && pos.tx >= meSelection.x && pos.tx < meSelection.x + meSelection.w &&
                                pos.ty >= meSelection.y && pos.ty < meSelection.y + meSelection.h) {
                                meSelDragging = true;
                                meSelDragStart = { mx: pos.tx, my: pos.ty, sx: meSelection.x, sy: meSelection.y };
                                mePushUndo();
                                meSelection.data = meGetSelectionTiles();
                                meClearTileRect(meSelection.x, meSelection.y, meSelection.w, meSelection.h);
                            } else {
                                meSelection = null;
                                meIsDrawing = true;
                                meSelDragStart = { tx: pos.tx, ty: pos.ty };
                            }
                        }
                    }

                    function meOnMouseMove(e) {
                        // Tile picker panning
                        if (tpIsPanning && tpPanStart) {
                            tpPanX = tpPanStart.px + (e.clientX - tpPanStart.mx);
                            tpPanY = tpPanStart.py + (e.clientY - tpPanStart.my);
                            tpClampPan();
                            tpUpdateTransform();
                            return;
                        }

                        // Tile picker hover
                        if (meTilePickerVisible && tpCvs) {
                            var rect = tpCvs.getBoundingClientRect();
                            var mx = e.clientX - rect.left;
                            var my = e.clientY - rect.top;
                            var prevHover = tpHoverTile;
                            if (mx >= 0 && my >= 0 && mx < rect.width && my < rect.height) {
                                var scaleX = 128 / rect.width;
                                var scaleY = 128 / rect.height;
                                var tileX = Math.floor(mx * scaleX / 8);
                                var tileY = Math.floor(my * scaleY / 8);
                                tpHoverTile = Math.max(0, Math.min(255, tileY * 16 + tileX));
                            } else {
                                tpHoverTile = -1;
                            }
                            if (tpHoverTile !== prevHover) tpRenderCanvas();
                            return;
                        }

                        var pos = meScreenToTile(e.clientX, e.clientY);
                        meMouseTX = pos.tx; meMouseTY = pos.ty;
                        meUpdateStatus();

                        if (meIsPanning && mePanStart) {
                            mePanX = mePanStart.px + (e.clientX - mePanStart.mx);
                            mePanY = mePanStart.py + (e.clientY - mePanStart.my);
                            meClampPan();
                            meUpdateCanvasTransform();
                            meRenderOverlay();
                            return;
                        }

                        if (!EDITABLE) { meRenderOverlay(); return; }

                        if (meIsDrawing && meTool === 'pencil') {
                            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                                meSetTile(pos.tx, pos.ty, meFgTile);
                                meRenderCanvas();
                            }
                        } else if (meIsDrawing && meTool === 'select' && meSelDragStart) {
                            var x0 = Math.min(meSelDragStart.tx, pos.tx);
                            var y0 = Math.min(meSelDragStart.ty, pos.ty);
                            var x1 = Math.max(meSelDragStart.tx, pos.tx);
                            var y1 = Math.max(meSelDragStart.ty, pos.ty);
                            var cx0 = Math.max(0, Math.min(127, x0));
                            var cy0 = Math.max(0, Math.min(63, y0));
                            var cx1 = Math.max(0, Math.min(127, x1));
                            var cy1 = Math.max(0, Math.min(63, y1));
                            meSelection = { x: Math.min(cx0, cx1), y: Math.min(cy0, cy1), w: Math.abs(cx1 - cx0) + 1, h: Math.abs(cy1 - cy0) + 1 };
                            meRenderOverlay();
                        } else if (meSelDragging && meSelDragStart && meSelection) {
                            var dx = pos.tx - meSelDragStart.mx;
                            var dy = pos.ty - meSelDragStart.my;
                            meSelection.x = meSelDragStart.sx + dx;
                            meSelection.y = meSelDragStart.sy + dy;
                            meRenderOverlay();
                        } else {
                            meRenderOverlay();
                        }
                    }

                    function meOnMouseUp(e) {
                        if (tpIsPanning) {
                            tpIsPanning = false;
                            tpPanStart = null;
                            return;
                        }

                        if (meIsPanning) {
                            meIsPanning = false;
                            mePanStart = null;
                            meUpdateCursor();
                            return;
                        }

                        if (!EDITABLE) return;

                        if (meIsDrawing && meTool === 'pencil') {
                            meIsDrawing = false;
                            notifyMapChanged();
                        } else if (meIsDrawing && meTool === 'select') {
                            meIsDrawing = false;
                            meSelDragStart = null;
                            if (meSelection && (meSelection.w <= 0 || meSelection.h <= 0)) meSelection = null;
                            meRenderOverlay();
                        }

                        if (meSelDragging && meSelection && meSelection.data) {
                            mePasteTiles(meSelection.x, meSelection.y, meSelection.w, meSelection.h, meSelection.data);
                            meSelection.data = null;
                            meSelDragging = false;
                            meSelDragStart = null;
                            meRenderCanvas();
                            notifyMapChanged();
                        }
                    }

                    function meOnWheel(e) {
                        e.preventDefault();

                        // When tile picker is open, zoom/pan it instead
                        if (meTilePickerVisible) {
                            var picker = document.getElementById('map-tile-picker');
                            var pr = picker.getBoundingClientRect();
                            var amx = e.clientX - pr.left;
                            var amy = e.clientY - pr.top;
                            var delta = -e.deltaY;
                            if (e.deltaMode === 1) delta *= 30;
                            else if (e.deltaMode === 2) delta *= 300;
                            var factor = Math.pow(meZoomFactor, delta / 50);
                            var newZoom = Math.max(1, Math.min(16, tpZoom * factor));
                            if (newZoom !== tpZoom) {
                                var cpx = (amx - tpPanX) / tpZoom;
                                var cpy = (amy - tpPanY) / tpZoom;
                                tpZoom = newZoom;
                                tpPanX = Math.round(amx - cpx * tpZoom);
                                tpPanY = Math.round(amy - cpy * tpZoom);
                                tpClampPan();
                                tpUpdateTransform();
                            }
                            return;
                        }

                        if (meSpaceHeld || meTool === 'hand') {
                            mePanX -= e.deltaX;
                            mePanY -= e.deltaY;
                            meClampPan();
                            meUpdateCanvasTransform();
                            meRenderOverlay();
                            return;
                        }
                        var pos = meScreenToTile(e.clientX, e.clientY);
                        var delta = -e.deltaY;
                        if (e.deltaMode === 1) delta *= 30;
                        else if (e.deltaMode === 2) delta *= 300;
                        var factor = Math.pow(meZoomFactor, delta / 50);
                        meApplyZoom(meZoom * factor, pos.mx, pos.my);
                    }

                    function meOnKeyDown(e) {
                        var mapTab = document.getElementById('tab-map');
                        if (!mapTab || !mapTab.classList.contains('active')) return;

                        var key = e.key.toLowerCase();

                        // Tile picker toggle (X)
                        if (key === 'x' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            if (meTilePickerVisible) meHideTilePicker();
                            else meShowTilePicker();
                            return;
                        }

                        // When tile picker is open, intercept keys
                        if (meTilePickerVisible) {
                            if (key === 'escape') { e.preventDefault(); meHideTilePicker(); return; }
                            // Q/W = prev/next tile (update picker highlight)
                            if (key === 'q' && !e.ctrlKey && !e.metaKey) {
                                e.preventDefault();
                                meFgTile = (meFgTile - 1 + 256) % 256;
                                tpRenderCanvas(); meRenderTilePreview(); meUpdateTileLabel();
                                return;
                            }
                            if (key === 'w' && !e.ctrlKey && !e.metaKey) {
                                e.preventDefault();
                                meFgTile = (meFgTile + 1) % 256;
                                tpRenderCanvas(); meRenderTilePreview(); meUpdateTileLabel();
                                return;
                            }
                            // Zoom picker
                            if (key === '=' || key === '+') {
                                e.preventDefault();
                                tpZoom = Math.min(16, tpZoom * 1.5); tpClampPan(); tpUpdateTransform();
                                return;
                            }
                            if (key === '-') {
                                e.preventDefault();
                                tpZoom = Math.max(1, tpZoom / 1.5); tpClampPan(); tpUpdateTransform();
                                return;
                            }
                            if (key === '0') {
                                e.preventDefault();
                                tpFitAndCenter(); tpUpdateTransform();
                                return;
                            }
                            // Block other keys while picker is open
                            return;
                        }

                        // Space for temporary hand
                        if (key === ' ' && !meSpaceHeld) {
                            e.preventDefault();
                            meSpaceHeld = true;
                            mePrevTool = meTool;
                            meTool = 'hand';
                            meRenderToolbar();
                            meUpdateCursor();
                            return;
                        }

                        // Q/W = prev/next tile
                        if (key === 'q' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            meFgTile = (meFgTile - 1 + 256) % 256;
                            meRenderTilePreview(); meUpdateTileLabel();
                            return;
                        }
                        if (key === 'w' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            meFgTile = (meFgTile + 1) % 256;
                            meRenderTilePreview(); meUpdateTileLabel();
                            return;
                        }

                        // Zoom
                        if (key === '=' || key === '+') { e.preventDefault(); meSetZoom(meZoom * 1.5); return; }
                        if (key === '-') { e.preventDefault(); meSetZoom(meZoom / 1.5); return; }
                        if (key === '0') { e.preventDefault(); meFitCanvas(); meUpdateCanvasTransform(); meRenderOverlay(); meUpdateZoomLabel(); return; }

                        // Undo/Redo
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey && EDITABLE) { e.preventDefault(); meDoUndo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey && EDITABLE) { e.preventDefault(); meDoRedo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'y' && EDITABLE) { e.preventDefault(); meDoRedo(); return; }

                        // Copy/Cut/Paste
                        if ((e.ctrlKey || e.metaKey) && key === 'c' && meTool === 'select' && EDITABLE) { e.preventDefault(); meCopySelection(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'x' && meTool === 'select' && EDITABLE) { e.preventDefault(); meCutSelection(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'v' && EDITABLE) { e.preventDefault(); mePasteClipboard(); return; }

                        if (!EDITABLE) return;

                        // Tool shortcuts
                        if (key === 'd' && !e.ctrlKey) { meTool = 'pencil'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 'f' && !e.ctrlKey) { meTool = 'fill'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 's' && !e.ctrlKey && !e.metaKey) { meTool = 'select'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 'p' && !e.ctrlKey) { meTool = 'hand'; meRenderToolbar(); meUpdateCursor(); return; }

                        // Selection operations
                        if (meTool === 'select' && meSelection) {
                            if (key === 'delete' || key === 'backspace') { e.preventDefault(); meDeleteSelection(); return; }
                            if (key === 'escape') { meSelection = null; meRenderOverlay(); return; }
                        }
                    }

                    function meOnKeyUp(e) {
                        if (e.key === ' ' && meSpaceHeld) {
                            meSpaceHeld = false;
                            if (mePrevTool) meTool = mePrevTool;
                            mePrevTool = null;
                            meRenderToolbar();
                            meUpdateCursor();
                        }
                    }

                    // ---- Initialize ----

                    function initMapEditor() {
                        if (mapEditorInited) {
                            meRenderCanvas();
                            return;
                        }
                        mapEditorInited = true;

                        meRenderToolbar();
                        meUpdateStatus();
                        meFitCanvas();
                        meRenderCanvas();

                        var wrap = document.getElementById('map-canvas-wrap');
                        wrap.addEventListener('mousedown', meOnMouseDown);
                        wrap.addEventListener('contextmenu', function(e) { e.preventDefault(); });
                        window.addEventListener('mousemove', meOnMouseMove);
                        window.addEventListener('mouseup', meOnMouseUp);
                        wrap.addEventListener('wheel', meOnWheel, { passive: false });
                        window.addEventListener('keydown', meOnKeyDown);
                        window.addEventListener('keyup', meOnKeyUp);

                        meMarchingAntsTimer = setInterval(function() {
                            if (meSelection) {
                                meMarchingAntsOffset = (meMarchingAntsOffset + 1) % 8;
                                meRenderOverlay();
                            }
                        }, 150);
                    }
                    // ============ END MAP EDITOR ============`;
}

function getAudioEngineScript(): string {
    return `
                    // ============ AUDIO ENGINE ============
                    var audioCtx = null;
                    var currentSfxPlayer = null;
                    var currentMusicPlayer = null;
                    var allActiveSfxPlayers = [];
                    var BASE_FREQ = 16.35;

                    function pitchToFreq(pitch) {
                        return BASE_FREQ * Math.pow(2, pitch / 12);
                    }

                    function getOscillatorType(waveform) {
                        switch (waveform) {
                            case 0: return 'sine';
                            case 1: return 'triangle';
                            case 2: return 'sawtooth';
                            case 3: return 'square';
                            case 4: return 'square';
                            case 5: return 'triangle';
                            case 6: return 'sawtooth';
                            case 7: return 'sine';
                            default: return 'sine';
                        }
                    }

                    function createNoiseSource(ctx, duration) {
                        var bufferSize = ctx.sampleRate * duration;
                        var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                        var data = buffer.getChannelData(0);
                        for (var i = 0; i < bufferSize; i++) {
                            data[i] = Math.random() * 2 - 1;
                        }
                        var source = ctx.createBufferSource();
                        source.buffer = buffer;
                        return source;
                    }

                    function playSfx(sfxId, onNoteChange, skipStop) {
                        if (!audioCtx) {
                            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        }
                        if (!skipStop) stopSfx();
                        var sfx = parseSfx(sfxId);
                        if (sfx.isEmpty) return null;
                        var noteDuration = (sfx.speed || 1) * 183 / 22050;
                        var noteIndex = 0;
                        var isPlaying = true;
                        var oscillator = null;
                        var gainNode = null;

                        function playNote() {
                            if (!isPlaying || noteIndex >= 32) {
                                if (sfx.loopStart < sfx.loopEnd && isPlaying) {
                                    noteIndex = sfx.loopStart;
                                } else {
                                    isPlaying = false;
                                    if (oscillator) { try { oscillator.stop(); } catch(e) {} }
                                    if (!skipStop) stopSfx();
                                    return;
                                }
                            }
                            var note = sfx.notes[noteIndex];
                            if (onNoteChange) onNoteChange(noteIndex);
                            if (note.volume === 0) {
                                noteIndex++;
                                setTimeout(playNote, noteDuration * 1000);
                                return;
                            }
                            if (note.waveform === 6) {
                                oscillator = createNoiseSource(audioCtx, noteDuration);
                            } else {
                                oscillator = audioCtx.createOscillator();
                                oscillator.type = getOscillatorType(note.waveform);
                                oscillator.frequency.setValueAtTime(pitchToFreq(note.pitch), audioCtx.currentTime);
                            }
                            gainNode = audioCtx.createGain();
                            var vol = note.volume / 7;
                            gainNode.gain.setValueAtTime(vol * 0.3, audioCtx.currentTime);
                            var nextNote = sfx.notes[noteIndex + 1] || note;
                            switch (note.effect) {
                                case 1:
                                    if (oscillator.frequency) {
                                        oscillator.frequency.linearRampToValueAtTime(pitchToFreq(nextNote.pitch), audioCtx.currentTime + noteDuration);
                                    }
                                    break;
                                case 2:
                                    if (oscillator.frequency) {
                                        var vibratoOsc = audioCtx.createOscillator();
                                        vibratoOsc.frequency.setValueAtTime(6, audioCtx.currentTime);
                                        var vibratoGain = audioCtx.createGain();
                                        vibratoGain.gain.setValueAtTime(pitchToFreq(note.pitch) * 0.02, audioCtx.currentTime);
                                        vibratoOsc.connect(vibratoGain);
                                        vibratoGain.connect(oscillator.frequency);
                                        vibratoOsc.start();
                                        setTimeout(function() { vibratoOsc.stop(); }, noteDuration * 1000);
                                    }
                                    break;
                                case 3:
                                    if (oscillator.frequency) {
                                        oscillator.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + noteDuration);
                                    }
                                    break;
                                case 4:
                                    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                                    gainNode.gain.linearRampToValueAtTime(vol * 0.3, audioCtx.currentTime + noteDuration);
                                    break;
                                case 5:
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
                        var player = {
                            stop: function() {
                                isPlaying = false;
                                if (oscillator) { try { oscillator.stop(); } catch (e) {} }
                            }
                        };
                        allActiveSfxPlayers.push(player);
                        return player;
                    }

                    function stopSfx() {
                        if (currentSfxPlayer) {
                            currentSfxPlayer.stop();
                            currentSfxPlayer = null;
                        }
                        allActiveSfxPlayers.forEach(function(p) { try { p.stop(); } catch(e) {} });
                        allActiveSfxPlayers = [];
                        document.querySelectorAll('.sfx-note.playing').forEach(function(el) { el.classList.remove('playing'); });
                        var btn = document.getElementById('sfx-play-btn');
                        if (btn) { btn.textContent = '\\u25b6 ' + LOCALE.play; }
                        sfxHoverNote = -1;
                        if (typeof sfxRenderBars === 'function' && sfxMode === 'bar') sfxRenderBars();
                        if (typeof sfxRenderTracker === 'function' && sfxMode === 'tracker') {
                            document.querySelectorAll('.sfx-note.playing').forEach(function(el) { el.classList.remove('playing'); });
                        }
                        document.querySelectorAll('.play-btn.is-playing').forEach(function(el) {
                            el.textContent = '\\u25b6';
                            el.classList.remove('is-playing');
                        });
                    }

                    function playMusic(startPattern) {
                        if (!audioCtx) {
                            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        }
                        stopMusic();
                        var patternIndex = startPattern || 0;
                        var isPlaying = true;
                        var channelPlayers = [null, null, null, null];

                        function updatePatternHighlight() {
                            document.querySelectorAll('.music-nav-cell').forEach(function(el, idx) {
                                el.classList.toggle('playing', idx === patternIndex);
                            });
                            var statusEl = document.getElementById('music-status-bar');
                            if (statusEl) statusEl.textContent = LOCALE.playingPattern + ' ' + patternIndex;
                        }

                        function playPattern() {
                            if (!isPlaying || patternIndex >= 64) {
                                stopMusic();
                                return;
                            }
                            for (var c = 0; c < 4; c++) {
                                if (channelPlayers[c]) {
                                    try { channelPlayers[c].stop(); } catch(e) {}
                                    channelPlayers[c] = null;
                                }
                            }
                            updatePatternHighlight();
                            var offset = patternIndex * 4;
                            var channels = [MUSIC[offset] || 0, MUSIC[offset + 1] || 0, MUSIC[offset + 2] || 0, MUSIC[offset + 3] || 0];
                            var allDisabled = channels.every(function(c) { return (c & 0x40) !== 0; });
                            var loopStart = (channels[0] & 0x80) !== 0;
                            var loopEnd = (channels[1] & 0x80) !== 0;
                            var stopAtEnd = (channels[2] & 0x80) !== 0;
                            if (allDisabled) { stopMusic(); return; }
                            var maxDuration = 0;
                            for (var ch = 0; ch < 4; ch++) {
                                var disabled = (channels[ch] & 0x40) !== 0;
                                if (!disabled) {
                                    var sfxId = channels[ch] & 0x3f;
                                    var sfx = parseSfx(sfxId);
                                    var nd = (sfx.speed || 1) * 183 / 22050;
                                    var sfxDuration = nd * 32;
                                    maxDuration = Math.max(maxDuration, sfxDuration);
                                    channelPlayers[ch] = playSfx(sfxId, null, true);
                                }
                            }
                            setTimeout(function() {
                                if (!isPlaying) return;
                                if (stopAtEnd) { stopMusic(); }
                                else if (loopEnd) {
                                    var loopStartIdx = 0;
                                    for (var li = patternIndex; li >= 0; li--) {
                                        if ((MUSIC[li * 4] & 0x80) !== 0) { loopStartIdx = li; break; }
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
                            stop: function() {
                                isPlaying = false;
                                channelPlayers.forEach(function(p) { if (p) p.stop(); });
                            }
                        };
                    }

                    function stopMusic() {
                        if (currentMusicPlayer) {
                            currentMusicPlayer.stop();
                            currentMusicPlayer = null;
                        }
                        allActiveSfxPlayers.forEach(function(p) { try { p.stop(); } catch(e) {} });
                        allActiveSfxPlayers = [];
                        document.querySelectorAll('.music-nav-cell.playing').forEach(function(el) { el.classList.remove('playing'); });
                        var statusEl = document.getElementById('music-status-bar');
                        if (statusEl) statusEl.textContent = 'Pattern ' + (typeof musicCurrentPattern !== 'undefined' ? musicCurrentPattern.toString().padStart(2, '0') : '00');
                        var btn = document.getElementById('music-play-btn');
                        if (btn) { btn.textContent = '\\u25b6 ' + LOCALE.play; btn.classList.remove('active'); }
                    }
                    // ============ END AUDIO ENGINE ============`;
}

function getRunButtonScript(): string {
    return `
                    // ============ RUN / STOP PICO-8 ============
                    var pico8Running = false;

                    function toggleRunPico8() {
                        if (pico8Running) {
                            vscodeApi.postMessage({ type: 'stop' });
                        } else {
                            vscodeApi.postMessage({ type: 'run' });
                        }
                    }

                    function updateRunButton(running) {
                        pico8Running = running;
                        var btn = document.getElementById('btn-run-pico8');
                        if (!btn) return;
                        if (running) {
                            btn.className = 'run-btn running';
                            btn.innerHTML = '&#9724; ' + LOCALE.stopGame;
                        } else {
                            btn.className = 'run-btn idle';
                            btn.innerHTML = '&#9654; ' + LOCALE.runInPico8;
                        }
                    }`;
}
