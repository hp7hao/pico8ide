import * as vscode from 'vscode';
import { CartData, PICO8_PALETTE, MetaData } from './cartData';
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
    i18nData?: object | null;
    metaData?: MetaData | null;
    templatePreviews?: { [name: string]: string };
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
    const { cartData, locale, extensionUri, webview, gameName, showRunButton, showConvertBanner, showAudio, editable, i18nData, metaData, templatePreviews } = options;

    const nonce = getNonce();

    const monacoBase = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'monaco'));
    const fontUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf'));

    const gfxJson = JSON.stringify(cartData.gfx);
    const mapJson = JSON.stringify(cartData.map);
    const flagsJson = JSON.stringify(cartData.gfxFlags);
    const sfxJson = JSON.stringify(cartData.sfx);
    const musicJson = JSON.stringify(cartData.music);
    const palJson = JSON.stringify(PICO8_PALETTE);

    // Escape code for embedding in a JS string literal (inside <script>)
    const codeForJs = JSON.stringify(cartData.code);

    // Read VS Code editor font settings
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const editorFontSize = editorConfig.get<number>('fontSize', 13);
    const editorFontFamily = editorConfig.get<string>('fontFamily', "'Courier New', monospace");
    const editorLineHeight = editorConfig.get<number>('lineHeight', 0); // 0 means auto

    const title = gameName ? `PICO-8 Cart: ${gameName}` : 'PICO-8 Cart';

    const i18nTabHtml = editable ? `<div class="tab" data-tab="i18n">${locale.tabI18n}</div>` : '';
    const exportTabHtml = editable ? `<div class="tab" data-tab="export">${locale.tabExport}</div>` : '';

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
    const csp = `default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; worker-src blob:; img-src ${webview.cspSource} data:;`;

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    :root {
                        --p8-bg-primary: #1d2b53;
                        --p8-bg-secondary: #222;
                        --p8-bg-surface: #2a2a2a;
                        --p8-accent: #29adff;
                        --p8-accent-hover: #3dbfff;
                        --p8-text-primary: #fff;
                        --p8-text-secondary: #aaa;
                        --p8-border: #444;
                        --p8-radius-sm: 3px;
                        --p8-radius-md: 6px;
                        --p8-transition-fast: 0.15s ease;
                        --p8-transition-normal: 0.25s ease;
                    }

                    body { background: #111; color: #ccc; font-family: 'Courier New', monospace; display: flex; flex-direction: column; height: 100vh; margin: 0; padding: 0; overflow: hidden; }

                    /* Global focus-visible for accessibility */
                    :focus-visible { outline: 2px solid var(--p8-accent); outline-offset: 2px; }

                    .convert-banner { background: #3a3500; border-bottom: 2px solid #ffec27; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; }
                    .convert-banner span { color: #ffec27; font-size: 13px; }
                    .convert-banner button { background: #ffec27; color: #111; border: none; padding: 6px 16px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 12px; font-weight: bold; transition: background-color var(--p8-transition-fast); }
                    .convert-banner button:hover { background: #fff170; }

                    .tab-header { display: flex; background: #252525; align-items: center; }
                    .tab { padding: 10px 18px; cursor: pointer; background: var(--p8-bg-secondary); border-bottom: 2px solid transparent; transition: background-color var(--p8-transition-fast), border-color var(--p8-transition-fast); }
                    .tab:hover { background: var(--p8-bg-surface); }
                    .tab.active { background: #1a1a1a; color: var(--p8-text-primary); font-weight: bold; border-bottom: 2px solid var(--p8-accent); }
                    .tab-spacer { flex: 1; }
                    .run-btn { margin-right: 10px; padding: 4px 12px; border: 1px solid #555; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 12px; transition: background-color var(--p8-transition-fast); }
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
                    .code-stats { background: #1a1a1a; border-top: 1px solid var(--p8-border); padding: 4px 8px; font-family: monospace; font-size: 11px; color: #c2c3c7; display: flex; gap: 16px; flex-shrink: 0; }

                    /* Shared editor toolbar base */
                    .editor-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .editor-toolbar .tool-btn { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; transition: background-color var(--p8-transition-fast); }
                    .editor-toolbar .tool-btn:hover { background: var(--p8-border); }
                    .editor-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: var(--p8-text-primary); border-left: 2px solid var(--p8-accent); }
                    .editor-toolbar .tool-sep { width: 1px; height: 20px; background: var(--p8-border); margin: 0 4px; }

                    /* Sprites */
                    .sprite-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .sprite-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .sprite-toolbar .tool-btn { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; transition: background-color var(--p8-transition-fast); }
                    .sprite-toolbar .tool-btn:hover { background: var(--p8-border); }
                    .sprite-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: var(--p8-text-primary); border-left: 2px solid var(--p8-accent); }
                    .sprite-toolbar .tool-sep { width: 1px; height: 20px; background: var(--p8-border); margin: 0 4px; }
                    .sprite-toolbar .zoom-group { margin-left: auto; display: flex; align-items: center; gap: 4px; }
                    .sprite-toolbar .zoom-label { color: #888; font-size: 11px; min-width: 28px; text-align: center; }
                    .sprite-toolbar .pal-swatch { width: 18px; height: 18px; border: 2px solid transparent; border-radius: 2px; cursor: pointer; box-sizing: border-box; display: inline-block; transition: border-color var(--p8-transition-fast); }
                    .sprite-toolbar .pal-swatch:hover { border-color: #888; }
                    .sprite-toolbar .pal-swatch.fg-active { border-color: var(--p8-text-primary); box-shadow: 0 0 0 1px var(--p8-text-primary); }
                    .sprite-toolbar .pal-swatch.bg-active { border-color: #ff004d; border-style: dashed; }
                    .sprite-toolbar .pal-info { color: #888; font-size: 11px; margin-left: 4px; margin-right: 4px; }
                    .sprite-canvas-wrap { flex: 1; overflow: hidden; position: relative; cursor: crosshair; }
                    #cvs-gfx { image-rendering: pixelated; position: absolute; top: 0; left: 0; background: #000; }
                    #cvs-gfx-overlay { position: absolute; top: 0; left: 0; pointer-events: none; background: transparent; }
                    .sprite-status { display: flex; align-items: center; padding: 4px 8px; background: #1a1a1a; border-top: 1px solid var(--p8-border); color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }
                    .sprite-toolbar .flag-group { display: flex; align-items: center; gap: 2px; }
                    .sprite-toolbar .flag-btn { width: 18px; height: 18px; border-radius: var(--p8-radius-sm); border: 1px solid var(--p8-border); cursor: pointer; opacity: 0.35; transition: opacity 0.1s; padding: 0; }
                    .sprite-toolbar .flag-btn:hover { opacity: 0.7; }
                    .sprite-toolbar .flag-btn.active { opacity: 1; border-color: var(--p8-text-primary); }
                    .sprite-toolbar .flag-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--p8-border); cursor: pointer; opacity: 0.3; box-sizing: border-box; padding: 0; background: transparent; display: inline-block; }
                    .sprite-toolbar .flag-dot:hover { opacity: 0.7; }
                    .sprite-toolbar .flag-dot.set { opacity: 1; border-color: var(--p8-text-primary); }
                    .quick-palette { position: absolute; display: none; background: var(--p8-bg-secondary); border: 1px solid #555; border-radius: var(--p8-radius-md); padding: 4px; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
                    .shortcuts-overlay { position: fixed; inset: 0; display: none; background: rgba(0,0,0,0.6); z-index: 200; align-items: center; justify-content: center; }
                    .shortcuts-overlay.visible { display: flex; }
                    .shortcuts-panel { background: var(--p8-bg-surface); border: 1px solid var(--p8-border); border-radius: var(--p8-radius-md); padding: 16px 24px; max-width: 480px; max-height: 70vh; overflow-y: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.5); color: var(--p8-text-primary); font-size: 13px; }
                    .shortcuts-panel h3 { margin: 0 0 12px 0; font-size: 15px; color: var(--p8-accent); border-bottom: 1px solid var(--p8-border); padding-bottom: 8px; }
                    .shortcuts-panel table { width: 100%; border-collapse: collapse; }
                    .shortcuts-panel td { padding: 3px 8px; }
                    .shortcuts-panel td:first-child { white-space: nowrap; text-align: right; padding-right: 12px; color: var(--p8-accent); font-family: monospace; font-weight: bold; }
                    .shortcuts-panel td:last-child { color: var(--p8-text-secondary); }
                    .shortcuts-help-btn { background: transparent; border: 1px solid var(--p8-border); color: var(--p8-text-secondary); border-radius: var(--p8-radius-sm); padding: 2px 8px; cursor: pointer; font-size: 12px; margin-left: auto; transition: background-color var(--p8-transition-fast), color var(--p8-transition-fast); }
                    .shortcuts-help-btn:hover { background: var(--p8-border); color: var(--p8-text-primary); }
                    .quick-palette .qp-swatch { width: 24px; height: 24px; display: inline-block; cursor: pointer; border: 1px solid #333; box-sizing: border-box; }
                    .quick-palette .qp-swatch:hover { border-color: var(--p8-text-primary); }
                    .sprite-sheet-container { display: flex; justify-content: center; padding: 20px; background: #1a1a1a; }
                    canvas { image-rendering: pixelated; border: 1px solid #333; background: #000; }

                    /* Map Editor */
                    .map-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .map-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .map-toolbar .tool-btn { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; transition: background-color var(--p8-transition-fast); }
                    .map-toolbar .tool-btn:hover { background: var(--p8-border); }
                    .map-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: var(--p8-text-primary); border-left: 2px solid var(--p8-accent); }
                    .map-toolbar .tool-sep { width: 1px; height: 20px; background: var(--p8-border); margin: 0 4px; }
                    .map-toolbar .zoom-group { margin-left: auto; display: flex; align-items: center; gap: 4px; }
                    .map-toolbar .zoom-label { color: #888; font-size: 11px; min-width: 28px; text-align: center; }
                    .map-toolbar .tile-preview { width: 18px; height: 18px; image-rendering: pixelated; border: 1px solid #555; cursor: pointer; vertical-align: middle; }
                    .map-toolbar .tile-info { color: #888; font-size: 11px; margin-left: 4px; margin-right: 4px; }
                    .map-canvas-wrap { flex: 1; overflow: hidden; position: relative; cursor: crosshair; }
                    #cvs-map { image-rendering: pixelated; position: absolute; top: 0; left: 0; background: #000; }
                    #cvs-map-overlay { position: absolute; top: 0; left: 0; pointer-events: none; background: transparent; }
                    .map-status { display: flex; align-items: center; padding: 4px 8px; background: #1a1a1a; border-top: 1px solid var(--p8-border); color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }
                    .map-tile-picker { position: absolute; inset: 0; display: none; background: rgba(0,0,0,0.5); z-index: 100; overflow: hidden; cursor: crosshair; }
                    .map-tile-picker canvas { image-rendering: pixelated; position: absolute; top: 0; left: 0; cursor: crosshair; }

                    /* SFX Editor Styles */
                    .sfx-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .sfx-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 2px; flex-shrink: 0; flex-wrap: wrap; }
                    .sfx-toolbar .tool-btn { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; min-width: 28px; text-align: center; transition: background-color var(--p8-transition-fast); }
                    .sfx-toolbar .tool-btn:hover { background: var(--p8-border); }
                    .sfx-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: var(--p8-text-primary); border-left: 2px solid var(--p8-accent); }
                    .sfx-toolbar .tool-sep { width: 1px; height: 20px; background: var(--p8-border); margin: 0 4px; }
                    .sfx-toolbar .sfx-label { color: #888; font-size: 11px; margin: 0 4px; }
                    .sfx-toolbar .sfx-val { color: var(--p8-text-primary); font-size: 11px; min-width: 20px; text-align: center; display: inline-block; }
                    .sfx-body { display: flex; flex: 1; min-height: 0; }
                    .sfx-list { width: 160px; border-right: 1px solid #333; overflow-y: auto; flex-shrink: 0; }
                    .sfx-item { padding: 4px 8px; cursor: pointer; border-bottom: 1px solid var(--p8-bg-secondary); font-size: 11px; display: flex; align-items: center; gap: 4px; transition: background-color var(--p8-transition-fast); }
                    .sfx-item:hover { background: var(--p8-bg-surface); }
                    .sfx-item.active { background: #3a3a5a; }
                    .sfx-item.empty { opacity: 0.4; }
                    .sfx-item .play-btn { background: #4a4; border: none; color: var(--p8-text-primary); padding: 1px 5px; border-radius: var(--p8-radius-sm); cursor: pointer; font-size: 9px; transition: background-color var(--p8-transition-fast); }
                    .sfx-item .play-btn:hover { background: #5b5; }
                    .sfx-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
                    .sfx-canvas-wrap { flex: 1; position: relative; overflow: hidden; cursor: crosshair; }
                    #cvs-sfx-bars { image-rendering: pixelated; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
                    .sfx-tracker-wrap { flex: 1; overflow: auto; display: none; }
                    .sfx-tracker-wrap.active { display: block; }
                    .sfx-tracker { font-family: monospace; font-size: 11px; background: #1a1a1a; border: 1px solid #333; }
                    .sfx-tracker-header { display: flex; background: #252525; border-bottom: 1px solid #333; padding: 4px; }
                    .sfx-tracker-header span { flex: 1; text-align: center; font-weight: bold; font-size: 10px; color: #888; }
                    .sfx-note { display: flex; border-bottom: 1px solid var(--p8-bg-secondary); cursor: pointer; transition: background-color var(--p8-transition-fast); }
                    .sfx-note:hover { background: #252530; }
                    .sfx-note.playing { background: #3a4a3a; }
                    .sfx-note.selected { background: #3a3a5a; }
                    .sfx-note span { flex: 1; text-align: center; padding: 2px 4px; }
                    .sfx-note .note-idx { color: #666; width: 30px; flex: none; }
                    .sfx-note .note-pitch { color: #6cf; }
                    .sfx-note .note-wave { color: #fc6; }
                    .sfx-note .note-vol { color: #6f6; }
                    .sfx-note .note-fx { color: #f6c; }
                    .sfx-note .col-active { background: rgba(255,255,255,0.15); border-radius: 2px; }
                    .sfx-status { display: flex; align-items: center; padding: 4px 8px; background: #1a1a1a; border-top: 1px solid var(--p8-border); color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }
                    .sfx-clr-btn { background: #5a2a2a; border: 1px solid #844; color: #f88; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; transition: background-color var(--p8-transition-fast); }
                    .sfx-clr-btn:hover { background: #6a3a3a; }
                    .music-clr-btn { background: #5a2a2a; border: 1px solid #844; color: #f88; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; transition: background-color var(--p8-transition-fast); }
                    .music-clr-btn:hover { background: #6a3a3a; }
                    .sfx-speed-input { background: var(--p8-bg-secondary); border: 1px solid #555; color: var(--p8-text-primary); font-family: monospace; font-size: 11px; width: 36px; text-align: center; padding: 2px; border-radius: var(--p8-radius-sm); }
                    .sfx-speed-input:focus { border-color: var(--p8-accent); outline: none; }

                    /* Music Editor Styles */
                    .music-editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                    .music-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #1e1e1e; border-bottom: 1px solid #333; flex-shrink: 0; flex-wrap: wrap; }
                    .music-toolbar .tool-btn { background: #333; border: 1px solid #555; color: #ccc; padding: 4px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 12px; min-width: 24px; text-align: center; transition: background-color var(--p8-transition-fast); }
                    .music-toolbar .tool-btn:hover { background: var(--p8-border); }
                    .music-toolbar .tool-btn.active { background: var(--p8-accent); color: var(--p8-text-primary); border-color: var(--p8-accent); }
                    .music-toolbar .sep { width: 1px; height: 20px; background: var(--p8-border); flex-shrink: 0; }
                    .music-toolbar .label { color: #888; font-size: 11px; }
                    .music-toolbar .value { color: var(--p8-text-primary); font-size: 12px; min-width: 20px; text-align: center; }
                    .music-pattern-editor { padding: 12px 10px; background: #1a1a1a; border-bottom: 1px solid #333; flex-shrink: 0; }
                    .music-channels { display: flex; gap: 8px; margin-bottom: 10px; }
                    .music-ch { flex: 1; background: var(--p8-bg-secondary); border: 1px solid var(--p8-border); border-radius: var(--p8-radius-md); padding: 8px; text-align: center; transition: border-color var(--p8-transition-fast), background-color var(--p8-transition-fast); }
                    .music-ch.disabled { opacity: 0.4; }
                    .music-ch.ch-selected { border-color: var(--p8-accent); background: #1a2a3a; }
                    .music-ch-label { font-size: 11px; color: #888; margin-bottom: 6px; }
                    .music-ch-toggle { cursor: pointer; margin-right: 4px; }
                    .music-ch-sfx { display: flex; align-items: center; justify-content: center; gap: 4px; }
                    .music-ch-sfx .tool-btn { background: #333; border: 1px solid #555; color: #ccc; padding: 2px 6px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; transition: background-color var(--p8-transition-fast); }
                    .music-ch-sfx .tool-btn:hover { background: var(--p8-border); }
                    .music-ch-sfx .sfx-val { color: #6cf; font-size: 14px; font-weight: bold; min-width: 24px; text-align: center; cursor: pointer; }
                    .music-ch-sfx .sfx-val:hover { text-decoration: underline; }
                    .music-ch-sfx .sfx-val.muted { color: #555; }
                    .music-flags { display: flex; gap: 8px; align-items: center; }
                    .music-flags .flag-btn { background: var(--p8-bg-secondary); border: 2px solid #555; color: #888; padding: 4px 12px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; transition: background-color var(--p8-transition-fast), border-color var(--p8-transition-fast); }
                    .music-flags .flag-btn:hover { background: var(--p8-bg-surface); }
                    .music-flags .flag-btn.loop-start-on { border-color: #00e436; color: #00e436; background: #0a2a0a; }
                    .music-flags .flag-btn.loop-end-on { border-color: #ff004d; color: #ff004d; background: #2a0a0a; }
                    .music-flags .flag-btn.stop-on { border-color: #ffec27; color: #ffec27; background: #2a2a0a; }
                    .music-navigator { flex: 1; overflow: auto; padding: 8px 10px; background: #111; }
                    .music-nav-grid { display: flex; flex-wrap: wrap; gap: 2px; }
                    .music-nav-cell { width: 36px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #888; background: #1a1a1a; border: 1px solid #333; border-radius: 2px; cursor: pointer; box-sizing: border-box; transition: background-color var(--p8-transition-fast); }
                    .music-nav-cell:hover { background: #252525; }
                    .music-nav-cell.selected { background: var(--p8-accent); color: var(--p8-text-primary); border-color: var(--p8-accent); }
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
                    .music-sfx-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; color: #888; background: var(--p8-bg-secondary); border: 1px solid #333; border-radius: 2px; cursor: pointer; box-sizing: border-box; min-height: 0; position: relative; gap: 2px; transition: background-color var(--p8-transition-fast); }
                    .music-sfx-cell:hover { background: #333; }
                    .music-sfx-cell.non-empty { color: #ccc; }
                    .music-sfx-cell.selected { background: var(--p8-accent); color: var(--p8-text-primary); border-color: var(--p8-accent); }
                    .music-sfx-cell .sfx-play-btn { display: none; font-size: 9px; color: #888; cursor: pointer; padding: 0 2px; }
                    .music-sfx-cell.non-empty .sfx-play-btn { display: block; }
                    .music-sfx-cell .sfx-play-btn:hover { color: var(--p8-text-primary); }
                    .music-sfx-cell.selected .sfx-play-btn { color: rgba(255,255,255,0.6); }
                    .music-sfx-cell.selected .sfx-play-btn:hover { color: var(--p8-text-primary); }
                    .music-sfx-cell.sfx-playing { background: #2a3a2a; border-color: #4a4; }
                    .music-status { display: flex; align-items: center; padding: 4px 8px; background: #1a1a1a; border-top: 1px solid var(--p8-border); color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }

                    /* i18n Editor */
                    .i18n-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .i18n-toolbar { display: flex; align-items: center; padding: 4px 8px; background: #252525; border-bottom: 1px solid #333; gap: 6px; flex-shrink: 0; flex-wrap: wrap; }
                    .i18n-toolbar .tool-btn { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 4px 10px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; transition: background-color var(--p8-transition-fast); }
                    .i18n-toolbar .tool-btn:hover { background: var(--p8-border); }
                    .i18n-toolbar .tool-btn.active { background: #5a5a8a; border-color: #7a7aaa; color: var(--p8-text-primary); }
                    .i18n-toolbar .tool-sep { width: 1px; height: 20px; background: var(--p8-border); margin: 0 2px; }
                    .i18n-toolbar select { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 3px 6px; border-radius: var(--p8-radius-sm); font-family: inherit; font-size: 11px; }
                    .i18n-toolbar input[type="text"] { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 3px 6px; border-radius: var(--p8-radius-sm); font-family: inherit; font-size: 11px; width: 80px; }
                    .i18n-toolbar input[type="text"]:focus { border-color: var(--p8-accent); outline: none; }
                    .i18n-table-wrap { flex: 1; overflow: auto; min-height: 0; padding: 0; }
                    .i18n-table-wrap table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    .i18n-table-wrap th { background: #252525; color: var(--p8-text-secondary); padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--p8-border); position: sticky; top: 0; z-index: 1; font-weight: normal; }
                    .i18n-table-wrap td { padding: 4px 8px; border-bottom: 1px solid var(--p8-bg-secondary); vertical-align: top; }
                    .i18n-table-wrap td.key-cell { color: #ff004d; font-family: monospace; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
                    .i18n-table-wrap td input { background: var(--p8-bg-secondary); border: 1px solid #333; color: #ccc; padding: 3px 6px; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 12px; border-radius: var(--p8-radius-sm); transition: border-color var(--p8-transition-fast); }
                    .i18n-table-wrap td input:focus { border-color: var(--p8-accent); outline: none; box-shadow: 0 0 0 1px rgba(41,173,255,0.25); }
                    .i18n-table-wrap td input.empty { border-color: #5a3a00; }
                    .i18n-codegen { border-top: 1px solid #333; max-height: 200px; overflow: auto; flex-shrink: 0; }
                    .i18n-codegen pre { margin: 0; padding: 8px; font-size: 11px; color: #8f8; background: #0a0a0a; white-space: pre-wrap; word-break: break-all; }
                    .i18n-codegen .codegen-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: #1e1e1e; border-bottom: 1px solid #333; }
                    .i18n-codegen .codegen-header span { color: #888; font-size: 11px; }
                    .i18n-codegen .codegen-header button { background: #333; border: 1px solid var(--p8-border); color: #ccc; padding: 2px 8px; border-radius: var(--p8-radius-sm); cursor: pointer; font-family: inherit; font-size: 11px; transition: background-color var(--p8-transition-fast); }
                    .i18n-codegen .codegen-header button:hover { background: var(--p8-border); }
                    .i18n-status { display: flex; align-items: center; padding: 4px 8px; background: #1a1a1a; border-top: 1px solid var(--p8-border); color: #666; font-size: 11px; gap: 16px; flex-shrink: 0; }

                    /* Export Editor */
                    .export-editor { display: flex; flex-direction: column; flex: 1; min-height: 0; background: #1a1a1a; }
                    .export-body { display: flex; flex: 1; min-height: 0; gap: 16px; padding: 16px; overflow: auto; }
                    .export-form { flex: 1; min-width: 200px; max-width: 400px; display: flex; flex-direction: column; gap: 12px; }
                    .export-form label { color: var(--p8-text-secondary); font-size: 11px; display: block; margin-bottom: 2px; }
                    .export-form input[type="text"] { background: var(--p8-bg-secondary); border: 1px solid var(--p8-border); color: #ccc; padding: 6px 8px; border-radius: var(--p8-radius-sm); font-family: inherit; font-size: 12px; width: 100%; box-sizing: border-box; transition: border-color var(--p8-transition-fast); }
                    .export-form input[type="text"]:focus { border-color: var(--p8-accent); outline: none; box-shadow: 0 0 0 1px rgba(41,173,255,0.25); }
                    .template-picker { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
                    .template-option { cursor: pointer; border: 2px solid var(--p8-border); border-radius: var(--p8-radius-md); overflow: hidden; text-align: center; padding: 4px; background: var(--p8-bg-secondary); transition: border-color var(--p8-transition-fast), background-color var(--p8-transition-fast); }
                    .template-option:hover { border-color: #888; }
                    .template-option.selected { border-color: var(--p8-accent); background: #1a2a3a; }
                    .template-option img { width: 80px; height: auto; image-rendering: pixelated; display: block; margin: 0 auto 4px; }
                    .template-option span { font-size: 10px; color: var(--p8-text-secondary); }
                    .export-buttons { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
                    .export-buttons button { background: var(--p8-accent); border: none; color: var(--p8-text-primary); padding: 8px 16px; border-radius: var(--p8-radius-md); cursor: pointer; font-family: inherit; font-size: 12px; transition: background-color var(--p8-transition-fast); }
                    .export-buttons button:hover { background: var(--p8-accent-hover); }
                    .export-buttons button.secondary { background: transparent; border: 1px solid var(--p8-border); color: #ccc; }
                    .export-buttons button.secondary:hover { background: var(--p8-bg-surface); border-color: #666; }
                    .export-preview { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
                    .export-preview canvas { image-rendering: pixelated; border: 1px solid #333; background: #000; border-radius: var(--p8-radius-sm); }
                    .export-status { padding: 4px 8px; background: #1a1a1a; border-top: 1px solid var(--p8-border); color: #666; font-size: 11px; flex-shrink: 0; }
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
                    ${i18nTabHtml}
                    ${exportTabHtml}
                    ${runButtonHtml}
                </div>

                <div id="shortcuts-overlay" class="shortcuts-overlay"></div>

                <div id="tab-code" class="content active">
                    <div id="monaco-container"></div>
                    <div class="code-stats" id="code-stats">
                        <span id="code-tokens">TOKENS: 0/8192</span>
                        <span id="code-chars">CHARS: 0/65535</span>
                        <button class="shortcuts-help-btn" id="code-help-btn">?</button>
                    </div>
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
                 ${editable ? `<div id="tab-i18n" class="content">
                    <div class="i18n-editor" id="i18n-editor">
                        <div class="i18n-toolbar" id="i18n-toolbar"></div>
                        <div class="i18n-table-wrap" id="i18n-table-wrap"></div>
                        <div class="i18n-codegen" id="i18n-codegen"></div>
                        <div class="i18n-status" id="i18n-status-bar"></div>
                    </div>
                 </div>` : ''}
                 ${editable ? `<div id="tab-export" class="content">
                    <div class="export-editor" id="export-editor">
                        <div class="export-body">
                            <div class="export-form" id="export-form"></div>
                            <div class="export-preview" id="export-preview">
                                <canvas id="cvs-export" width="160" height="205"></canvas>
                            </div>
                        </div>
                        <div class="export-status" id="export-status-bar"></div>
                    </div>
                 </div>` : ''}

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
                    const EDITOR_FONT_SIZE = ${editorFontSize};
                    const EDITOR_FONT_FAMILY = ${JSON.stringify(editorFontFamily)};
                    const EDITOR_LINE_HEIGHT = ${editorLineHeight};
                    const I18N_DATA = ${JSON.stringify(i18nData || null)};
                    const META_DATA = ${JSON.stringify(metaData || null)};
                    const TEMPLATE_PREVIEWS = ${JSON.stringify(templatePreviews || {})};
                    const LABEL_DATA_URL = ${JSON.stringify(cartData.label)};
                    const FONT_URI = "${fontUri}";

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
                        tilePicker: "${locale.tilePicker}",
                        tabI18n: "${locale.tabI18n}",
                        tabExport: "${locale.tabExport}",
                        exportTitle: "${locale.exportTitle}",
                        exportAuthor: "${locale.exportAuthor}",
                        exportTemplate: "${locale.exportTemplate}",
                        exportButton: "${locale.exportButton}",
                        exportSuccess: "${locale.exportSuccess}",
                        exportError: "${locale.exportError}",
                        exportLocaleVariant: "${locale.exportLocaleVariant}",
                        exportCodeTooLarge: "${locale.exportCodeTooLarge}"
                    };

                    const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
                    const WAVEFORMS = ['sine', 'tri', 'saw', 'sqr', 'pulse', 'ring', 'noise', 'ring2'];
                    const EFFECTS = ['none', 'slide', 'vib', 'drop', 'fadein', 'fadeout', 'arpF', 'arpS'];

                    // ============ MONACO EDITOR ============
                    var monacoEditor = null;
                    var monacoReady = false;
                    var i18nVisitedBeforeMonaco = false;

                    // ============ TAB SWITCHING ============
                    var currentTab = 'code';
                    function showTab(id, el) {
                        currentTab = id;
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
                        } else if (id === 'i18n') {
                            if (!monacoReady) {
                                i18nVisitedBeforeMonaco = true;
                            }
                            initI18nEditor();
                        } else if (id === 'export') {
                            initExportEditor();
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

                    // ============ KEYBOARD SHORTCUTS OVERLAY ============
                    var SHORTCUTS = {
                        code: [
                            ['Ctrl+Z', 'Undo'],
                            ['Ctrl+Shift+Z', 'Redo'],
                            ['Ctrl+Space', 'Trigger autocomplete'],
                            ['Ctrl+F', 'Find'],
                            ['Ctrl+H', 'Find and replace'],
                            ['Ctrl+D', 'Select next occurrence'],
                            ['Ctrl+/', 'Toggle line comment'],
                            ['Ctrl+Shift+K', 'Delete line'],
                            ['Alt+Up/Down', 'Move line up/down'],
                            ['Ctrl+Shift+F', 'Format document']
                        ],
                        gfx: [
                            ['D', 'Pencil tool'],
                            ['F', 'Fill tool'],
                            ['R', 'Rectangle tool'],
                            ['C', 'Circle/Ellipse tool'],
                            ['L', 'Line tool'],
                            ['S', 'Select tool'],
                            ['P', 'Hand/Pan tool'],
                            ['T', 'Rotate 90\u00b0 (selection)'],
                            ['H', 'Flip horizontal (selection)'],
                            ['V', 'Flip vertical (selection)'],
                            ['X', 'Quick palette'],
                            ['Tab', 'Swap fg/bg colors'],
                            ['Space', 'Temporary hand tool'],
                            ['Ctrl+A', 'Select all'],
                            ['Ctrl+C/X/V', 'Copy/Cut/Paste'],
                            ['Ctrl+Z', 'Undo'],
                            ['Ctrl+Shift+Z', 'Redo'],
                            ['+/-', 'Zoom in/out'],
                            ['0', 'Fit to view'],
                            ['Arrows', 'Move selection 1px'],
                            ['Del', 'Delete selection'],
                            ['Esc', 'Deselect'],
                            ['Dbl-click', 'Select 8x8 sprite cell'],
                            ['Right-click', 'Eyedropper'],
                            ['Ctrl+click', 'Search-replace color']
                        ],
                        map: [
                            ['D', 'Pencil tool'],
                            ['L', 'Line tool'],
                            ['R', 'Rectangle fill tool'],
                            ['F', 'Flood fill tool'],
                            ['S', 'Select tool'],
                            ['P', 'Hand/Pan tool'],
                            ['X', 'Toggle tile picker'],
                            ['Q/W', 'Previous/Next tile'],
                            ['B', 'Toggle screen boundary'],
                            ['Space', 'Temporary hand tool'],
                            ['Ctrl+C/X/V', 'Copy/Cut/Paste'],
                            ['Ctrl+Z', 'Undo'],
                            ['Ctrl+Shift+Z', 'Redo'],
                            ['+/-', 'Zoom in/out'],
                            ['0', 'Fit to view'],
                            ['Del', 'Delete selection'],
                            ['Esc', 'Deselect / Close picker'],
                            ['Right-click', 'Eyedropper (pick tile)']
                        ],
                        sfx: [
                            ['Space', 'Play/Stop'],
                            ['Tab', 'Toggle bar/tracker view'],
                            ['-/+', 'Previous/Next SFX'],
                            ['Q/W', 'Previous/Next waveform'],
                            ['A/S', 'Previous/Next effect'],
                            ['1-8', 'Select waveform directly'],
                            ['Ctrl+C', 'Copy SFX slot'],
                            ['Ctrl+V', 'Paste SFX slot'],
                            ['Ctrl+Z', 'Undo'],
                            ['Ctrl+Shift+Z', 'Redo'],
                            ['\\u2014 Tracker mode \\u2014', ''],
                            ['Tab', 'Cycle column (pitch/wave/vol/fx)'],
                            ['Left/Right', 'Move between columns'],
                            ['Up/Down', 'Adjust column value'],
                            ['0-7', 'Direct numeric entry'],
                            ['Z-M / Q-I', 'Piano keys (pitch entry)'],
                            ['Shift', 'Raise octave'],
                            ['Backspace', 'Clear note'],
                            ['Arrows', 'Navigate notes']
                        ],
                        music: [
                            ['Space', 'Play/Stop'],
                            ['Left/- Right/+', 'Previous/Next pattern'],
                            ['1/2/3/4', 'Toggle channel 1-4'],
                            ['Ctrl+C', 'Copy pattern'],
                            ['Ctrl+V', 'Paste pattern'],
                            ['Ctrl+Z', 'Undo'],
                            ['Ctrl+Shift+Z', 'Redo'],
                            ['Del', 'Clear pattern']
                        ]
                    };
                    var SHORTCUTS_TITLES = { gfx: 'Sprite Editor', map: 'Map Editor', sfx: 'SFX Editor', music: 'Music Editor', code: 'Code Editor' };

                    function showShortcuts() {
                        var shortcuts = SHORTCUTS[currentTab];
                        if (!shortcuts) return;
                        var overlay = document.getElementById('shortcuts-overlay');
                        var title = SHORTCUTS_TITLES[currentTab] || currentTab;
                        var html = '<div class="shortcuts-panel"><h3>' + title + ' Shortcuts</h3><table>';
                        for (var i = 0; i < shortcuts.length; i++) {
                            var s = shortcuts[i];
                            if (s[1] === '') {
                                html += '<tr><td colspan="2" style="padding-top:8px;color:var(--p8-text-secondary);text-align:center;font-style:italic">' + s[0] + '</td></tr>';
                            } else {
                                html += '<tr><td>' + s[0] + '</td><td>' + s[1] + '</td></tr>';
                            }
                        }
                        html += '</table></div>';
                        overlay.innerHTML = html;
                        overlay.classList.add('visible');
                    }

                    function hideShortcuts() {
                        var overlay = document.getElementById('shortcuts-overlay');
                        overlay.classList.remove('visible');
                        overlay.innerHTML = '';
                    }

                    // Click-outside dismiss for shortcuts overlay
                    document.getElementById('shortcuts-overlay').addEventListener('click', function(e) {
                        if (e.target === this) hideShortcuts();
                    });

                    // Global ? key and Escape for shortcuts overlay
                    window.addEventListener('keydown', function(e) {
                        var overlay = document.getElementById('shortcuts-overlay');
                        if (overlay.classList.contains('visible')) {
                            if (e.key === 'Escape') { e.preventDefault(); hideShortcuts(); }
                            return;
                        }
                        if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                            var tag = document.activeElement ? document.activeElement.tagName : '';
                            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                            if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('monaco-editor')) return;
                            e.preventDefault();
                            showShortcuts();
                        }
                    });

                    // Wire up code tab help button
                    var codeHelpBtn = document.getElementById('code-help-btn');
                    if (codeHelpBtn) codeHelpBtn.addEventListener('click', function() { showShortcuts(); });

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
                    var sfxClipboard = null;
                    var musicClipboard = null;
                    var sfxStatusMsg = '';
                    var sfxStatusTimer = null;

                    function sfxShowStatus(msg) {
                        sfxStatusMsg = msg;
                        if (sfxStatusTimer) clearTimeout(sfxStatusTimer);
                        sfxStatusTimer = setTimeout(function() { sfxStatusMsg = ''; sfxUpdateStatus(); }, 1500);
                        sfxUpdateStatus();
                    }

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
                    var COL_CLASSES = ['note-pitch', 'note-wave', 'note-vol', 'note-fx'];
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
                            var colHL = (i === sfxTrackerRow);
                            html += '<span class="note-pitch' + (colHL && sfxTrackerCol === 0 ? ' col-active' : '') + '">' + pitchToNote(n.pitch) + '</span>';
                            html += '<span class="note-wave' + (colHL && sfxTrackerCol === 1 ? ' col-active' : '') + '">' + (n.customWave ? 'C' + n.waveform : WAVEFORMS[n.waveform]) + '</span>';
                            html += '<span class="note-vol' + (colHL && sfxTrackerCol === 2 ? ' col-active' : '') + '">' + n.volume + '</span>';
                            html += '<span class="note-fx' + (colHL && sfxTrackerCol === 3 ? ' col-active' : '') + '">' + EFFECTS[n.effect] + '</span>';
                            html += '</div>';
                        }
                        html += '</div>';
                        wrap.innerHTML = html;

                        // Click to select row and column
                        wrap.querySelectorAll('.sfx-note').forEach(function(el) {
                            el.addEventListener('mousedown', function(ev) {
                                sfxTrackerRow = parseInt(el.dataset.idx);
                                // Detect which column was clicked
                                var target = ev.target;
                                if (target.classList.contains('note-pitch')) sfxTrackerCol = 0;
                                else if (target.classList.contains('note-wave')) sfxTrackerCol = 1;
                                else if (target.classList.contains('note-vol')) sfxTrackerCol = 2;
                                else if (target.classList.contains('note-fx')) sfxTrackerCol = 3;
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

                        // Speed with direct input
                        var spdLabel = document.createElement('span'); spdLabel.className = 'sfx-label'; spdLabel.textContent = 'SPD'; tb.appendChild(spdLabel);
                        var spdDown = document.createElement('button'); spdDown.className = 'tool-btn'; spdDown.textContent = '\\u25c0';
                        spdDown.onclick = function() { if (!EDITABLE) return; sfxPushUndo(); sfxSetSpeed(sfxCurrentId, sfxGetSpeed(sfxCurrentId) - 1); sfxRenderToolbar(); notifySfxChanged(); };
                        tb.appendChild(spdDown);
                        var spdVal = document.createElement('span'); spdVal.className = 'sfx-val'; spdVal.style.cursor = 'pointer'; spdVal.textContent = sfxGetSpeed(sfxCurrentId).toString(); tb.appendChild(spdVal);
                        spdVal.title = 'Click to edit, scroll to adjust';
                        if (EDITABLE) {
                            spdVal.onclick = function() {
                                var inp = document.createElement('input');
                                inp.type = 'number'; inp.min = '1'; inp.max = '255';
                                inp.value = sfxGetSpeed(sfxCurrentId).toString();
                                inp.className = 'sfx-speed-input';
                                spdVal.replaceWith(inp);
                                inp.focus(); inp.select();
                                function applyVal() {
                                    var v = parseInt(inp.value);
                                    if (v >= 1 && v <= 255) { sfxPushUndo(); sfxSetSpeed(sfxCurrentId, v); notifySfxChanged(); }
                                    sfxRenderToolbar();
                                }
                                inp.addEventListener('keydown', function(ie) { if (ie.key === 'Enter') { ie.preventDefault(); applyVal(); } if (ie.key === 'Escape') sfxRenderToolbar(); });
                                inp.addEventListener('blur', applyVal);
                            };
                            spdVal.addEventListener('wheel', function(we) {
                                we.preventDefault();
                                sfxPushUndo();
                                sfxSetSpeed(sfxCurrentId, sfxGetSpeed(sfxCurrentId) + (we.deltaY < 0 ? 1 : -1));
                                sfxRenderToolbar();
                                notifySfxChanged();
                            }, { passive: false });
                        }
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

                        if (EDITABLE) {
                            var sepClr = document.createElement('span'); sepClr.className = 'tool-sep'; tb.appendChild(sepClr);
                            var clrBtn = document.createElement('button');
                            clrBtn.className = 'sfx-clr-btn';
                            clrBtn.textContent = 'CLR';
                            clrBtn.title = 'Clear current SFX';
                            clrBtn.onclick = function() {
                                sfxPushUndo();
                                var offset = sfxCurrentId * 68;
                                for (var ci = 0; ci < 64; ci++) SFX[offset + ci] = 0;
                                SFX[offset + 65] = 16; // speed default
                                SFX[offset + 66] = 0;  // loop start
                                SFX[offset + 67] = 0;  // loop end
                                sfxRenderAll();
                                notifySfxChanged();
                                sfxShowStatus('SFX ' + sfxCurrentId + ' cleared');
                            };
                            tb.appendChild(clrBtn);
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

                        var helpBtn = document.createElement('button');
                        helpBtn.className = 'shortcuts-help-btn';
                        helpBtn.textContent = '?';
                        helpBtn.title = 'Keyboard shortcuts';
                        helpBtn.addEventListener('click', function() { showShortcuts(); });
                        tb.appendChild(helpBtn);
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
                        if (sfxStatusMsg) {
                            st.textContent = sfxStatusMsg;
                        } else if (sfxHoverNote >= 0 && sfxHoverNote < 32) {
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

                        // Tab in tracker: cycle columns; otherwise toggle mode
                        if (key === 'tab' && !e.ctrlKey && !e.metaKey && sfxMode === 'tracker' && sfxTrackerRow >= 0) {
                            e.preventDefault();
                            sfxTrackerCol = e.shiftKey ? (sfxTrackerCol - 1 + 4) % 4 : (sfxTrackerCol + 1) % 4;
                            sfxRenderTracker();
                            return;
                        }

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

                        // Waveform prev/next (skip in tracker with active column editing)
                        var inTrkEdit = (sfxMode === 'tracker' && sfxTrackerRow >= 0);
                        if (key === 'q' && !e.ctrlKey && !e.metaKey && (!inTrkEdit || sfxTrackerCol === 0)) { e.preventDefault(); sfxBrushWave = (sfxBrushWave - 1 + 8) % 8; sfxRenderToolbar(); return; }
                        if (key === 'w' && !e.ctrlKey && !e.metaKey && (!inTrkEdit || sfxTrackerCol === 0)) { e.preventDefault(); sfxBrushWave = (sfxBrushWave + 1) % 8; sfxRenderToolbar(); return; }

                        // Effect prev/next
                        if (key === 'a' && !e.ctrlKey && !e.metaKey && !inTrkEdit) { e.preventDefault(); sfxBrushEffect = (sfxBrushEffect - 1 + 8) % 8; sfxRenderToolbar(); return; }
                        if (key === 's' && !e.ctrlKey && !e.metaKey && !inTrkEdit) { e.preventDefault(); sfxBrushEffect = (sfxBrushEffect + 1) % 8; sfxRenderToolbar(); return; }

                        // Direct waveform selection 1-8
                        if (!e.ctrlKey && !e.metaKey && key >= '1' && key <= '8' && (!inTrkEdit || sfxTrackerCol === 0)) { e.preventDefault(); sfxBrushWave = parseInt(key) - 1; sfxRenderToolbar(); return; }

                        // Undo/redo
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey && EDITABLE) { e.preventDefault(); sfxDoUndo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey && EDITABLE) { e.preventDefault(); sfxDoRedo(); return; }
                        if ((e.ctrlKey || e.metaKey) && key === 'y' && EDITABLE) { e.preventDefault(); sfxDoRedo(); return; }

                        // Copy SFX slot (Ctrl+C)
                        if ((e.ctrlKey || e.metaKey) && key === 'c') {
                            e.preventDefault();
                            var cpOff = sfxCurrentId * 68;
                            sfxClipboard = SFX.slice(cpOff, cpOff + 68);
                            sfxShowStatus('Copied SFX ' + sfxCurrentId);
                            return;
                        }
                        // Paste SFX slot (Ctrl+V)
                        if ((e.ctrlKey || e.metaKey) && key === 'v' && EDITABLE) {
                            e.preventDefault();
                            if (!sfxClipboard) { sfxShowStatus('Nothing to paste'); return; }
                            sfxPushUndo();
                            var psOff = sfxCurrentId * 68;
                            for (var pi = 0; pi < 68; pi++) SFX[psOff + pi] = sfxClipboard[pi];
                            sfxRenderAll(); notifySfxChanged();
                            sfxShowStatus('Pasted to SFX ' + sfxCurrentId);
                            return;
                        }

                        // Tracker mode: keyboard note entry and column editing
                        if (sfxMode === 'tracker' && sfxTrackerRow >= 0 && EDITABLE) {
                            // Left/Right: move between columns
                            if (key === 'arrowleft') { e.preventDefault(); sfxTrackerCol = Math.max(0, sfxTrackerCol - 1); sfxRenderTracker(); return; }
                            if (key === 'arrowright') { e.preventDefault(); sfxTrackerCol = Math.min(3, sfxTrackerCol + 1); sfxRenderTracker(); return; }

                            // Column-specific value editing with Up/Down for non-pitch columns
                            if (sfxTrackerCol > 0 && (key === 'arrowup' || key === 'arrowdown')) {
                                e.preventDefault(); sfxPushUndo();
                                var cn = parseSfx(sfxCurrentId).notes[sfxTrackerRow];
                                var cd = (key === 'arrowup') ? 1 : -1;
                                if (sfxTrackerCol === 1) sfxSetNote(sfxCurrentId, sfxTrackerRow, 'waveform', Math.max(0, Math.min(7, cn.waveform + cd)));
                                else if (sfxTrackerCol === 2) sfxSetNote(sfxCurrentId, sfxTrackerRow, 'volume', Math.max(0, Math.min(7, cn.volume + cd)));
                                else if (sfxTrackerCol === 3) sfxSetNote(sfxCurrentId, sfxTrackerRow, 'effect', Math.max(0, Math.min(7, cn.effect + cd)));
                                sfxRenderTracker(); sfxRenderBars(); sfxRenderList(); notifySfxChanged();
                                return;
                            }

                            // Direct numeric entry for non-pitch columns (0-7)
                            if (sfxTrackerCol > 0 && !e.ctrlKey && !e.metaKey && key >= '0' && key <= '7') {
                                e.preventDefault(); sfxPushUndo();
                                var dv = parseInt(key);
                                if (sfxTrackerCol === 1) sfxSetNote(sfxCurrentId, sfxTrackerRow, 'waveform', dv);
                                else if (sfxTrackerCol === 2) sfxSetNote(sfxCurrentId, sfxTrackerRow, 'volume', dv);
                                else if (sfxTrackerCol === 3) sfxSetNote(sfxCurrentId, sfxTrackerRow, 'effect', dv);
                                sfxTrackerRow = Math.min(31, sfxTrackerRow + 1);
                                sfxRenderTracker(); sfxRenderBars(); sfxRenderList(); notifySfxChanged();
                                return;
                            }

                            // Piano key entry only for pitch column (col 0)
                            if (sfxTrackerCol === 0) {
                                var pianoMap = {
                                    'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4,
                                    'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11
                                };
                                var pianoMap2 = {
                                    'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16,
                                    'r': 17, '5': 18, 't': 19, '6': 20, 'y': 21, '7': 22, 'u': 23, 'i': 24
                                };
                                var pitch = -1;
                                if (pianoMap[key] !== undefined && !e.ctrlKey && !e.metaKey) pitch = pianoMap[key] + 24;
                                if (pianoMap2[key] !== undefined && !e.ctrlKey && !e.metaKey) pitch = pianoMap2[key] + 24;
                                if (e.shiftKey && pitch >= 0) pitch += 12;
                                if (pitch >= 0 && pitch <= 63) {
                                    e.preventDefault(); sfxPushUndo();
                                    sfxSetNote(sfxCurrentId, sfxTrackerRow, 'pitch', pitch);
                                    sfxSetNote(sfxCurrentId, sfxTrackerRow, 'waveform', sfxBrushWave);
                                    if (parseSfx(sfxCurrentId).notes[sfxTrackerRow].volume === 0) {
                                        sfxSetNote(sfxCurrentId, sfxTrackerRow, 'volume', 5);
                                    }
                                    sfxTrackerRow = Math.min(31, sfxTrackerRow + 1);
                                    sfxRenderTracker(); sfxRenderBars(); sfxRenderList(); notifySfxChanged();
                                    return;
                                }
                            }

                            if (key === 'backspace' || key === 'delete') {
                                e.preventDefault(); sfxPushUndo();
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

                        if (EDITABLE) {
                            var mClrSep = document.createElement('span'); mClrSep.className = 'sep'; tb.appendChild(mClrSep);
                            var mClrBtn = document.createElement('button');
                            mClrBtn.className = 'music-clr-btn';
                            mClrBtn.textContent = 'CLR';
                            mClrBtn.title = 'Clear current pattern';
                            mClrBtn.addEventListener('click', function() {
                                musicPushUndo();
                                var offset = musicCurrentPattern * 4;
                                for (var ci = 0; ci < 4; ci++) MUSIC[offset + ci] = 0x40;
                                musicRenderAll();
                                notifyMusicChanged();
                            });
                            tb.appendChild(mClrBtn);
                        }

                        var helpBtn = document.createElement('button');
                        helpBtn.className = 'shortcuts-help-btn';
                        helpBtn.textContent = '?';
                        helpBtn.title = 'Keyboard shortcuts';
                        helpBtn.addEventListener('click', function() { showShortcuts(); });
                        tb.appendChild(helpBtn);
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
                        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                            // Copy pattern
                            e.preventDefault();
                            var cpOff = musicCurrentPattern * 4;
                            musicClipboard = [MUSIC[cpOff], MUSIC[cpOff+1], MUSIC[cpOff+2], MUSIC[cpOff+3]];
                        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && EDITABLE) {
                            // Paste pattern
                            e.preventDefault();
                            if (!musicClipboard) return;
                            musicPushUndo();
                            var psOff = musicCurrentPattern * 4;
                            for (var mi = 0; mi < 4; mi++) MUSIC[psOff + mi] = musicClipboard[mi];
                            musicRenderAll();
                            notifyMusicChanged();
                        } else if ((e.key === 'Delete' || e.key === 'Backspace') && EDITABLE) {
                            // Clear pattern
                            e.preventDefault();
                            musicPushUndo();
                            var clOff = musicCurrentPattern * 4;
                            for (var ci = 0; ci < 4; ci++) MUSIC[clOff + ci] = 0x40;
                            musicRenderAll();
                            notifyMusicChanged();
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

                                    // PICO-8 API autocompletion
                                    var pico8Api = [
                                        { label: 'cls', insertText: 'cls(\${1:col})', doc: 'Clear screen with color' },
                                        { label: 'pset', insertText: 'pset(\${1:x}, \${2:y}, \${3:col})', doc: 'Set pixel color' },
                                        { label: 'pget', insertText: 'pget(\${1:x}, \${2:y})', doc: 'Get pixel color' },
                                        { label: 'line', insertText: 'line(\${1:x0}, \${2:y0}, \${3:x1}, \${4:y1}, \${5:col})', doc: 'Draw line' },
                                        { label: 'rect', insertText: 'rect(\${1:x0}, \${2:y0}, \${3:x1}, \${4:y1}, \${5:col})', doc: 'Draw rectangle outline' },
                                        { label: 'rectfill', insertText: 'rectfill(\${1:x0}, \${2:y0}, \${3:x1}, \${4:y1}, \${5:col})', doc: 'Draw filled rectangle' },
                                        { label: 'circ', insertText: 'circ(\${1:x}, \${2:y}, \${3:r}, \${4:col})', doc: 'Draw circle outline' },
                                        { label: 'circfill', insertText: 'circfill(\${1:x}, \${2:y}, \${3:r}, \${4:col})', doc: 'Draw filled circle' },
                                        { label: 'print', insertText: 'print(\${1:str}, \${2:x}, \${3:y}, \${4:col})', doc: 'Print string' },
                                        { label: 'spr', insertText: 'spr(\${1:n}, \${2:x}, \${3:y}, \${4:w}, \${5:h}, \${6:flip_x}, \${7:flip_y})', doc: 'Draw sprite' },
                                        { label: 'sspr', insertText: 'sspr(\${1:sx}, \${2:sy}, \${3:sw}, \${4:sh}, \${5:dx}, \${6:dy}, \${7:dw}, \${8:dh}, \${9:flip_x}, \${10:flip_y})', doc: 'Draw texture from spritesheet' },
                                        { label: 'map', insertText: 'map(\${1:cel_x}, \${2:cel_y}, \${3:sx}, \${4:sy}, \${5:cel_w}, \${6:cel_h}, \${7:layer})', doc: 'Draw map' },
                                        { label: 'camera', insertText: 'camera(\${1:x}, \${2:y})', doc: 'Set camera offset' },
                                        { label: 'clip', insertText: 'clip(\${1:x}, \${2:y}, \${3:w}, \${4:h})', doc: 'Set clipping region' },
                                        { label: 'pal', insertText: 'pal(\${1:c0}, \${2:c1}, \${3:p})', doc: 'Swap color / reset palette' },
                                        { label: 'palt', insertText: 'palt(\${1:col}, \${2:transparent})', doc: 'Set transparency for color' },
                                        { label: 'color', insertText: 'color(\${1:col})', doc: 'Set default color' },
                                        { label: 'fillp', insertText: 'fillp(\${1:pat})', doc: 'Set fill pattern' },
                                        { label: 'flip', insertText: 'flip()', doc: 'Flip screen buffer' },
                                        { label: 'btn', insertText: 'btn(\${1:i}, \${2:p})', doc: 'Button state (0..5=directions+OX, p=player)' },
                                        { label: 'btnp', insertText: 'btnp(\${1:i}, \${2:p})', doc: 'Button pressed this frame' },
                                        { label: 'rnd', insertText: 'rnd(\${1:x})', doc: 'Random number 0..x (exclusive)' },
                                        { label: 'flr', insertText: 'flr(\${1:x})', doc: 'Floor' },
                                        { label: 'ceil', insertText: 'ceil(\${1:x})', doc: 'Ceiling' },
                                        { label: 'abs', insertText: 'abs(\${1:x})', doc: 'Absolute value' },
                                        { label: 'sgn', insertText: 'sgn(\${1:x})', doc: 'Sign (-1 or 1)' },
                                        { label: 'sqrt', insertText: 'sqrt(\${1:x})', doc: 'Square root' },
                                        { label: 'sin', insertText: 'sin(\${1:x})', doc: 'Sine (0..1 turns)' },
                                        { label: 'cos', insertText: 'cos(\${1:x})', doc: 'Cosine (0..1 turns)' },
                                        { label: 'atan2', insertText: 'atan2(\${1:dx}, \${2:dy})', doc: 'Arctangent (0..1 turns)' },
                                        { label: 'max', insertText: 'max(\${1:x}, \${2:y})', doc: 'Maximum' },
                                        { label: 'min', insertText: 'min(\${1:x}, \${2:y})', doc: 'Minimum' },
                                        { label: 'mid', insertText: 'mid(\${1:x}, \${2:y}, \${3:z})', doc: 'Middle value' },
                                        { label: 'band', insertText: 'band(\${1:x}, \${2:y})', doc: 'Bitwise AND' },
                                        { label: 'bor', insertText: 'bor(\${1:x}, \${2:y})', doc: 'Bitwise OR' },
                                        { label: 'bxor', insertText: 'bxor(\${1:x}, \${2:y})', doc: 'Bitwise XOR' },
                                        { label: 'bnot', insertText: 'bnot(\${1:x})', doc: 'Bitwise NOT' },
                                        { label: 'shl', insertText: 'shl(\${1:x}, \${2:n})', doc: 'Shift left' },
                                        { label: 'shr', insertText: 'shr(\${1:x}, \${2:n})', doc: 'Shift right (arithmetic)' },
                                        { label: 'lshr', insertText: 'lshr(\${1:x}, \${2:n})', doc: 'Shift right (logical)' },
                                        { label: 'rotl', insertText: 'rotl(\${1:x}, \${2:n})', doc: 'Rotate left' },
                                        { label: 'rotr', insertText: 'rotr(\${1:x}, \${2:n})', doc: 'Rotate right' },
                                        { label: 'peek', insertText: 'peek(\${1:addr})', doc: 'Read byte from memory' },
                                        { label: 'poke', insertText: 'poke(\${1:addr}, \${2:val})', doc: 'Write byte to memory' },
                                        { label: 'peek2', insertText: 'peek2(\${1:addr})', doc: 'Read 16-bit value' },
                                        { label: 'poke2', insertText: 'poke2(\${1:addr}, \${2:val})', doc: 'Write 16-bit value' },
                                        { label: 'peek4', insertText: 'peek4(\${1:addr})', doc: 'Read 32-bit fixed-point value' },
                                        { label: 'poke4', insertText: 'poke4(\${1:addr}, \${2:val})', doc: 'Write 32-bit fixed-point value' },
                                        { label: 'memcpy', insertText: 'memcpy(\${1:dest}, \${2:src}, \${3:len})', doc: 'Copy memory' },
                                        { label: 'memset', insertText: 'memset(\${1:dest}, \${2:val}, \${3:len})', doc: 'Set memory' },
                                        { label: 'fget', insertText: 'fget(\${1:n}, \${2:f})', doc: 'Get sprite flag' },
                                        { label: 'fset', insertText: 'fset(\${1:n}, \${2:f}, \${3:v})', doc: 'Set sprite flag' },
                                        { label: 'mget', insertText: 'mget(\${1:x}, \${2:y})', doc: 'Get map tile' },
                                        { label: 'mset', insertText: 'mset(\${1:x}, \${2:y}, \${3:v})', doc: 'Set map tile' },
                                        { label: 'sfx', insertText: 'sfx(\${1:n}, \${2:ch}, \${3:off}, \${4:len})', doc: 'Play sound effect' },
                                        { label: 'music', insertText: 'music(\${1:n}, \${2:fade}, \${3:mask})', doc: 'Play music pattern' },
                                        { label: 'tostr', insertText: 'tostr(\${1:val}, \${2:hex})', doc: 'Convert to string' },
                                        { label: 'tonum', insertText: 'tonum(\${1:str})', doc: 'Convert to number' },
                                        { label: 'chr', insertText: 'chr(\${1:n})', doc: 'Character from ordinal' },
                                        { label: 'ord', insertText: 'ord(\${1:str}, \${2:i})', doc: 'Ordinal of character' },
                                        { label: 'sub', insertText: 'sub(\${1:str}, \${2:i}, \${3:j})', doc: 'Substring' },
                                        { label: 'split', insertText: 'split(\${1:str}, \${2:sep}, \${3:convert})', doc: 'Split string into table' },
                                        { label: 'add', insertText: 'add(\${1:tbl}, \${2:val}, \${3:i})', doc: 'Add value to table' },
                                        { label: 'del', insertText: 'del(\${1:tbl}, \${2:val})', doc: 'Delete first occurrence from table' },
                                        { label: 'deli', insertText: 'deli(\${1:tbl}, \${2:i})', doc: 'Delete by index from table' },
                                        { label: 'count', insertText: 'count(\${1:tbl}, \${2:val})', doc: 'Count occurrences in table' },
                                        { label: 'all', insertText: 'all(\${1:tbl})', doc: 'Iterator for table values' },
                                        { label: 'foreach', insertText: 'foreach(\${1:tbl}, \${2:func})', doc: 'Call func for each table value' },
                                        { label: 'pairs', insertText: 'pairs(\${1:tbl})', doc: 'Iterator for key-value pairs' },
                                        { label: 'stat', insertText: 'stat(\${1:x})', doc: 'Get system status' },
                                        { label: 'menuitem', insertText: 'menuitem(\${1:i}, \${2:label}, \${3:callback})', doc: 'Add pause menu item' },
                                        { label: 'time', insertText: 'time()', doc: 'Seconds since program start' },
                                        { label: 't', insertText: 't()', doc: 'Alias for time()' },
                                        { label: 'cocreate', insertText: 'cocreate(\${1:func})', doc: 'Create coroutine' },
                                        { label: 'coresume', insertText: 'coresume(\${1:cor})', doc: 'Resume coroutine' },
                                        { label: 'costatus', insertText: 'costatus(\${1:cor})', doc: 'Get coroutine status' },
                                        { label: 'yield', insertText: 'yield()', doc: 'Yield from coroutine' },
                                    ];

                                    monaco.languages.registerCompletionItemProvider('pico8-lua', {
                                        provideCompletionItems: function(model, position) {
                                            var word = model.getWordUntilPosition(position);
                                            var range = {
                                                startLineNumber: position.lineNumber,
                                                endLineNumber: position.lineNumber,
                                                startColumn: word.startColumn,
                                                endColumn: word.endColumn
                                            };
                                            var suggestions = pico8Api.map(function(item) {
                                                return {
                                                    label: item.label,
                                                    kind: monaco.languages.CompletionItemKind.Function,
                                                    insertText: item.insertText,
                                                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                                    documentation: item.doc,
                                                    range: range
                                                };
                                            });
                                            return { suggestions: suggestions };
                                        }
                                    });

                                    var container = document.getElementById('monaco-container');
                                    monacoEditor = monaco.editor.create(container, {
                                        value: CODE,
                                        language: 'pico8-lua',
                                        theme: 'pico8-dark',
                                        readOnly: !EDITABLE,
                                        minimap: { enabled: false },
                                        fontSize: EDITOR_FONT_SIZE,
                                        lineHeight: EDITOR_LINE_HEIGHT || 0,
                                        fontFamily: EDITOR_FONT_FAMILY,
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

                                    // Token/character counting for PICO-8
                                    function countTokens(code) {
                                        var tokens = 0;
                                        var i = 0;
                                        var len = code.length;
                                        var freeKeywords = { 'end': true, 'local': true };
                                        var opKeywords = { 'not': true, 'and': true, 'or': true };
                                        var twoCharOps = { '==':1, '~=':1, '<=':1, '>=':1, '..':1, '+=':1, '-=':1, '*=':1, '/=':1, '%=':1, '^=':1, '!=':1 };
                                        while (i < len) {
                                            var ch = code[i];
                                            if (ch === ' ' || ch === '\\t' || ch === '\\r' || ch === '\\n') { i++; continue; }
                                            if (ch === '-' && i + 1 < len && code[i+1] === '-') {
                                                i += 2;
                                                if (i + 1 < len && code[i] === '[' && code[i+1] === '[') {
                                                    i += 2;
                                                    while (i + 1 < len && !(code[i] === ']' && code[i+1] === ']')) i++;
                                                    if (i + 1 < len) i += 2;
                                                } else {
                                                    while (i < len && code[i] !== '\\n') i++;
                                                }
                                                continue;
                                            }
                                            if (ch === ',' || ch === ';' || ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}') { i++; continue; }
                                            if (ch === '.') {
                                                if (i + 1 < len && code[i+1] === '.') {
                                                    tokens++;
                                                    i += (i + 2 < len && code[i+2] === '.') ? 3 : 2;
                                                    continue;
                                                }
                                                i++; continue;
                                            }
                                            if (ch === ':') { i++; continue; }
                                            if (ch === '"' || ch === "'") {
                                                tokens++;
                                                var q = ch;
                                                i++;
                                                while (i < len && code[i] !== q) {
                                                    if (code[i] === '\\\\') i++;
                                                    i++;
                                                }
                                                if (i < len) i++;
                                                continue;
                                            }
                                            if (ch === '[' && i + 1 < len && code[i+1] === '[') {
                                                tokens++;
                                                i += 2;
                                                while (i + 1 < len && !(code[i] === ']' && code[i+1] === ']')) i++;
                                                if (i + 1 < len) i += 2;
                                                continue;
                                            }
                                            if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && code[i+1] >= '0' && code[i+1] <= '9')) {
                                                tokens++;
                                                if (ch === '0' && i + 1 < len && (code[i+1] === 'x' || code[i+1] === 'X')) {
                                                    i += 2;
                                                    while (i < len && /[0-9a-fA-F_]/.test(code[i])) i++;
                                                    if (i < len && code[i] === '.') { i++; while (i < len && /[0-9a-fA-F_]/.test(code[i])) i++; }
                                                } else if (ch === '0' && i + 1 < len && (code[i+1] === 'b' || code[i+1] === 'B')) {
                                                    i += 2;
                                                    while (i < len && /[01_]/.test(code[i])) i++;
                                                } else {
                                                    while (i < len && ((code[i] >= '0' && code[i] <= '9') || code[i] === '.')) i++;
                                                }
                                                continue;
                                            }
                                            if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
                                                var start = i;
                                                while (i < len && ((code[i] >= 'a' && code[i] <= 'z') || (code[i] >= 'A' && code[i] <= 'Z') || (code[i] >= '0' && code[i] <= '9') || code[i] === '_')) i++;
                                                var word = code.substring(start, i);
                                                if (freeKeywords[word]) continue;
                                                if (opKeywords[word]) { tokens++; continue; }
                                                tokens++;
                                                continue;
                                            }
                                            if (i + 1 < len && twoCharOps[code[i] + code[i+1]]) {
                                                tokens++;
                                                i += 2;
                                                continue;
                                            }
                                            tokens++;
                                            i++;
                                        }
                                        return tokens;
                                    }

                                    function countChars(code) {
                                        return code.length;
                                    }

                                    var codeStatsEl = document.getElementById('code-stats');
                                    var codeTokensEl = document.getElementById('code-tokens');
                                    var codeCharsEl = document.getElementById('code-chars');
                                    var statsDebounceTimer = null;

                                    function updateCodeStats() {
                                        var code = monacoEditor.getValue();
                                        var tk = countTokens(code);
                                        var ch = countChars(code);
                                        codeTokensEl.textContent = 'TOKENS: ' + tk + '/8192';
                                        codeCharsEl.textContent = 'CHARS: ' + ch + '/65535';
                                        var tkPct = tk / 8192;
                                        var chPct = ch / 65535;
                                        codeTokensEl.style.color = (tkPct >= 0.95) ? '#ff004d' : (tkPct >= 0.80) ? '#ffec27' : '#c2c3c7';
                                        codeCharsEl.style.color = (chPct >= 0.95) ? '#ff004d' : (chPct >= 0.80) ? '#ffec27' : '#c2c3c7';
                                    }

                                    updateCodeStats();

                                    monacoEditor.onDidChangeModelContent(function() {
                                        if (statsDebounceTimer) clearTimeout(statsDebounceTimer);
                                        statsDebounceTimer = setTimeout(updateCodeStats, 300);
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

                                    monacoReady = true;
                                    if (i18nVisitedBeforeMonaco) {
                                        i18nScanCode();
                                        i18nRenderCodegen();
                                    }
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
                    var sePrevPx = -1, sePrevPy = -1; // previous pencil pixel for Bresenham interpolation
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

                        // Show lifted selection pixels during drag
                        if (seSelection && seSelDragging && seSelection.data) {
                            ctx.globalAlpha = 0.7;
                            var sw = seSelection.w, sh = seSelection.h;
                            for (var dy = 0; dy < sh; dy++) {
                                for (var dx = 0; dx < sw; dx++) {
                                    var c = seSelection.data[dy * sw + dx];
                                    ctx.fillStyle = PAL[c];
                                    ctx.fillRect(
                                        (seSelection.x + dx) * seZoom,
                                        (seSelection.y + dy) * seZoom,
                                        seZoom, seZoom
                                    );
                                }
                            }
                            ctx.globalAlpha = 1.0;
                            // Marching ants around dragged selection
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

                    function seRotate90() {
                        if (!seSelection) return;
                        pushUndo();
                        var data = seGetSelectionPixels();
                        var w = seSelection.w, h = seSelection.h;
                        seClearRect(seSelection.x, seSelection.y, w, h, seBgColor);
                        var nw = h, nh = w;
                        for (var y = 0; y < h; y++)
                            for (var x = 0; x < w; x++)
                                setGfxPixel(seSelection.x + (h - 1 - y), seSelection.y + x, data[y * w + x]);
                        seSelection.w = nw;
                        seSelection.h = nh;
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
                        flagEditGrp.id = 'se-flag-dots';
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

                        var helpBtn = document.createElement('button');
                        helpBtn.className = 'shortcuts-help-btn';
                        helpBtn.textContent = '?';
                        helpBtn.title = 'Keyboard shortcuts';
                        helpBtn.addEventListener('click', function() { showShortcuts(); });
                        tb.appendChild(helpBtn);
                    }

                    function seRenderPalette() {
                        // Palette is now part of the toolbar; delegate to seRenderToolbar
                        seRenderToolbar();
                    }

                    function seRenderFlagDots() {
                        var container = document.getElementById('se-flag-dots');
                        if (!container) return;
                        container.innerHTML = '';
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
                                        seRenderFlagDots();
                                        seRenderOverlay();
                                        notifyFlagsChanged();
                                    };
                                }
                                container.appendChild(dot);
                            })(fi2);
                        }
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
                                sePrevPx = pos.px;
                                sePrevPy = pos.py;
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
                            seRenderFlagDots();
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
                                if (sePrevPx >= 0 && sePrevPy >= 0) {
                                    drawBresenhamLine(sePrevPx, sePrevPy, pos.px, pos.py, seFgColor);
                                } else {
                                    setGfxPixel(pos.px, pos.py, seFgColor);
                                }
                                sePrevPx = pos.px;
                                sePrevPy = pos.py;
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
                            sePrevPx = -1;
                            sePrevPy = -1;
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

                        // Ctrl+A select all
                        if ((e.ctrlKey || e.metaKey) && key === 'a' && seTool === 'select' && EDITABLE) {
                            e.preventDefault();
                            seSelection = { x: 0, y: 0, w: 128, h: 128 };
                            seRenderOverlay();
                            return;
                        }

                        // Tab = swap fg/bg colors
                        if (key === 'tab' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            var tmp = seFgColor;
                            seFgColor = seBgColor;
                            seBgColor = tmp;
                            seRenderPalette();
                            seUpdateStatus();
                            return;
                        }

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
                            if (key === 't') { seRotate90(); return; }
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
                        wrap.addEventListener('dblclick', function(e) {
                            if (!EDITABLE || seTool !== 'select') return;
                            var pos = seScreenToPixel(e.clientX, e.clientY);
                            if (pos.px >= 0 && pos.px < 128 && pos.py >= 0 && pos.py < 128) {
                                var cx = Math.floor(pos.px / 8) * 8;
                                var cy = Math.floor(pos.py / 8) * 8;
                                seSelection = { x: cx, y: cy, w: 8, h: 8 };
                                seRenderOverlay();
                            }
                        });
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
                    var meDrawStart = null;
                    var meShowScreenBounds = false;
                    var meStampTiles = null;
                    var meStampW = 1;
                    var meStampH = 1;
                    var meDirtyTiles = null;
                    var meForceFullRedraw = true;
                    var meLastImgData = null;
                    var tpZoom = 4;
                    var tpPanX = 0, tpPanY = 0;
                    var tpIsPanning = false;
                    var tpPanStart = null;
                    var tpCvs = null;
                    var tpHoverTile = -1;
                    var tpDragStart = null;
                    var tpDragEnd = null;
                    var tpIsDragging = false;

                    // Pre-computed palette RGBA
                    var PALETTE_RGBA = null;
                    function meBuildPaletteRGBA() {
                        PALETTE_RGBA = new Uint8Array(16 * 4);
                        for (var i = 0; i < 16; i++) {
                            var hex = PAL[i];
                            PALETTE_RGBA[i * 4]     = parseInt(hex.substr(1, 2), 16);
                            PALETTE_RGBA[i * 4 + 1] = parseInt(hex.substr(3, 2), 16);
                            PALETTE_RGBA[i * 4 + 2] = parseInt(hex.substr(5, 2), 16);
                            PALETTE_RGBA[i * 4 + 3] = 255;
                        }
                    }

                    function meMarkDirty(tx, ty) {
                        if (meDirtyTiles) meDirtyTiles.add(tx + ',' + ty);
                    }

                    function meMarkDirtyRect(x, y, w, h) {
                        if (!meDirtyTiles) return;
                        for (var dy = 0; dy < h; dy++)
                            for (var dx = 0; dx < w; dx++)
                                meDirtyTiles.add((x + dx) + ',' + (y + dy));
                    }

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
                        meMarkDirty(tx, ty);
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
                        meForceFullRedraw = true;
                        meRenderCanvas();
                        notifyMapChanged();
                    }

                    function meDoRedo() {
                        if (meRedoStack.length === 0) return;
                        meUndoStack.push({ map: MAP.slice(), gfx: GFX.slice() });
                        var next = meRedoStack.pop();
                        for (var i = 0; i < next.map.length; i++) MAP[i] = next.map[i];
                        for (var j = 0; j < next.gfx.length; j++) GFX[j] = next.gfx[j];
                        meForceFullRedraw = true;
                        meRenderCanvas();
                        notifyMapChanged();
                    }

                    function notifyMapChanged() {
                        if (!EDITABLE) return;
                        if (meMapChangedTimer) clearTimeout(meMapChangedTimer);
                        meMapChangedTimer = setTimeout(function() {
                            vscodeApi.postMessage({ type: 'mapChanged', map: MAP.slice(), gfx: GFX.slice() });
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

                    // ---- Line tool (Bresenham for tile coordinates) ----

                    function meBresenhamLine(x0, y0, x1, y1, tile) {
                        var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
                        var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
                        var err = dx - dy;
                        while (true) {
                            meSetTile(x0, y0, tile);
                            if (x0 === x1 && y0 === y1) break;
                            var e2 = 2 * err;
                            if (e2 > -dy) { err -= dy; x0 += sx; }
                            if (e2 < dx) { err += dx; y0 += sy; }
                        }
                    }

                    // ---- Rectangle fill tool ----

                    function meRectFill(x0, y0, x1, y1, tile) {
                        var rx = Math.max(0, Math.min(x0, x1));
                        var ry = Math.max(0, Math.min(y0, y1));
                        var rx2 = Math.min(127, Math.max(x0, x1));
                        var ry2 = Math.min(63, Math.max(y0, y1));
                        for (var yy = ry; yy <= ry2; yy++)
                            for (var xx = rx; xx <= rx2; xx++)
                                meSetTile(xx, yy, tile);
                    }

                    // ---- Multi-tile stamp helpers ----

                    function meStampAt(tx, ty) {
                        if (meStampTiles && meStampW > 1 || meStampH > 1) {
                            for (var sy = 0; sy < meStampH; sy++)
                                for (var sx = 0; sx < meStampW; sx++)
                                    meSetTile(tx + sx, ty + sy, meStampTiles[sy][sx]);
                        } else {
                            meSetTile(tx, ty, meFgTile);
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

                    function meRenderTile(imgData, tx, ty) {
                        var spriteIdx = meGetTile(tx, ty);
                        var baseX = tx * 8, baseY = ty * 8;
                        if (spriteIdx === 0) {
                            for (var py = 0; py < 8; py++) {
                                var rowOff = ((baseY + py) * 1024 + baseX) * 4;
                                for (var px = 0; px < 8; px++) {
                                    var idx = rowOff + px * 4;
                                    imgData.data[idx] = 0; imgData.data[idx+1] = 0; imgData.data[idx+2] = 0; imgData.data[idx+3] = 0;
                                }
                            }
                            return;
                        }
                        var spritePixels = getSprite(spriteIdx);
                        for (var py = 0; py < 8; py++) {
                            for (var px = 0; px < 8; px++) {
                                var color = spritePixels[py * 8 + px];
                                var ci = (color & 15) * 4;
                                var idx = ((baseY + py) * 1024 + baseX + px) * 4;
                                imgData.data[idx] = PALETTE_RGBA[ci];
                                imgData.data[idx+1] = PALETTE_RGBA[ci+1];
                                imgData.data[idx+2] = PALETTE_RGBA[ci+2];
                                imgData.data[idx+3] = 255;
                            }
                        }
                    }

                    function meRenderCanvas() {
                        if (!PALETTE_RGBA) meBuildPaletteRGBA();
                        var cvs = document.getElementById('cvs-map');
                        var ctx = cvs.getContext('2d');

                        if (meForceFullRedraw || !meLastImgData) {
                            var imgData = ctx.createImageData(1024, 512);
                            for (var ty = 0; ty < 64; ty++) {
                                for (var tx = 0; tx < 128; tx++) {
                                    meRenderTile(imgData, tx, ty);
                                }
                            }
                            ctx.putImageData(imgData, 0, 0);
                            meLastImgData = imgData;
                            meForceFullRedraw = false;
                            meDirtyTiles = new Set();
                        } else if (meDirtyTiles && meDirtyTiles.size > 0) {
                            var imgData = meLastImgData;
                            meDirtyTiles.forEach(function(key) {
                                var parts = key.split(',');
                                var dtx = parseInt(parts[0], 10);
                                var dty = parseInt(parts[1], 10);
                                if (dtx >= 0 && dtx < 128 && dty >= 0 && dty < 64) {
                                    meRenderTile(imgData, dtx, dty);
                                }
                            });
                            ctx.putImageData(imgData, 0, 0);
                            meDirtyTiles = new Set();
                        }
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

                        // Row 32 visual divider (shared with sprites)
                        var row32y = 32 * 8 * meZoom;
                        ctx.save();
                        ctx.strokeStyle = 'rgba(255, 0, 77, 0.5)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([6, 4]);
                        ctx.beginPath();
                        ctx.moveTo(0, row32y);
                        ctx.lineTo(sw, row32y);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        if (meZoom >= 0.5) {
                            ctx.fillStyle = 'rgba(255, 0, 77, 0.5)';
                            ctx.font = Math.max(9, Math.min(12, 10 * meZoom)) + 'px monospace';
                            ctx.fillText('shared with sprites', 4, row32y + Math.max(10, 12 * meZoom));
                        }
                        ctx.restore();

                        // Screen boundary overlay (16x16 tiles = 128x128 px)
                        if (meShowScreenBounds) {
                            ctx.save();
                            ctx.strokeStyle = 'rgba(41, 173, 255, 0.4)';
                            ctx.lineWidth = 2;
                            ctx.setLineDash([8, 4]);
                            ctx.strokeRect(0.5, 0.5, 128 * meZoom, 128 * meZoom);
                            ctx.setLineDash([]);
                            ctx.restore();
                        }

                        // Hover tile highlight (show stamp size if multi-tile)
                        if (meMouseTX >= 0 && meMouseTX < 128 && meMouseTY >= 0 && meMouseTY < 64) {
                            var hoverW = (meTool === 'pencil' && meStampTiles) ? meStampW : 1;
                            var hoverH = (meTool === 'pencil' && meStampTiles) ? meStampH : 1;
                            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(
                                meMouseTX * 8 * meZoom + 0.5,
                                meMouseTY * 8 * meZoom + 0.5,
                                8 * hoverW * meZoom - 1,
                                8 * hoverH * meZoom - 1
                            );
                        }

                        // Line/rect tool preview while dragging
                        if (meIsDrawing && meDrawStart && (meTool === 'line' || meTool === 'rect')) {
                            meRenderShapePreview(ctx);
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

                    function meRenderShapePreview(ctx) {
                        if (!meDrawStart) return;
                        var x0 = meDrawStart.tx, y0 = meDrawStart.ty;
                        var x1 = meMouseTX, y1 = meMouseTY;
                        ctx.save();
                        ctx.globalAlpha = 0.5;
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = Math.max(1, meZoom);
                        if (meTool === 'line') {
                            ctx.beginPath();
                            ctx.moveTo(x0 * 8 * meZoom + 4 * meZoom, y0 * 8 * meZoom + 4 * meZoom);
                            ctx.lineTo(x1 * 8 * meZoom + 4 * meZoom, y1 * 8 * meZoom + 4 * meZoom);
                            ctx.stroke();
                        } else if (meTool === 'rect') {
                            var rx = Math.min(x0, x1), ry = Math.min(y0, y1);
                            var rw = Math.abs(x1 - x0) + 1, rh = Math.abs(y1 - y0) + 1;
                            ctx.fillStyle = 'rgba(255,255,255,0.15)';
                            ctx.fillRect(rx * 8 * meZoom, ry * 8 * meZoom, rw * 8 * meZoom, rh * 8 * meZoom);
                            ctx.strokeRect(rx * 8 * meZoom + 0.5, ry * 8 * meZoom + 0.5, rw * 8 * meZoom - 1, rh * 8 * meZoom - 1);
                        }
                        ctx.restore();
                    }

                    function meRenderTilePreview() {
                        var pc = document.getElementById('me-tile-preview');
                        if (!pc) return;
                        if (!PALETTE_RGBA) meBuildPaletteRGBA();
                        var ctx = pc.getContext('2d');
                        // If multi-tile stamp, resize canvas to show it
                        var pw = meStampTiles ? meStampW * 8 : 8;
                        var ph = meStampTiles ? meStampH * 8 : 8;
                        pc.width = pw; pc.height = ph;
                        ctx.clearRect(0, 0, pw, ph);
                        if (meStampTiles) {
                            var imgData = ctx.createImageData(pw, ph);
                            for (var sy = 0; sy < meStampH; sy++) {
                                for (var sx = 0; sx < meStampW; sx++) {
                                    var sprIdx = meStampTiles[sy][sx];
                                    if (sprIdx === 0) continue;
                                    var spritePixels = getSprite(sprIdx);
                                    for (var py = 0; py < 8; py++) {
                                        for (var px = 0; px < 8; px++) {
                                            var color = spritePixels[py * 8 + px];
                                            var ci = (color & 15) * 4;
                                            var idx = ((sy * 8 + py) * pw + sx * 8 + px) * 4;
                                            imgData.data[idx] = PALETTE_RGBA[ci];
                                            imgData.data[idx+1] = PALETTE_RGBA[ci+1];
                                            imgData.data[idx+2] = PALETTE_RGBA[ci+2];
                                            imgData.data[idx+3] = 255;
                                        }
                                    }
                                }
                            }
                            ctx.putImageData(imgData, 0, 0);
                        } else {
                            if (meFgTile === 0) return;
                            var spritePixels = getSprite(meFgTile);
                            var imgData = ctx.createImageData(8, 8);
                            for (var i = 0; i < 64; i++) {
                                var color = spritePixels[i];
                                var ci = (color & 15) * 4;
                                imgData.data[i*4] = PALETTE_RGBA[ci];
                                imgData.data[i*4+1] = PALETTE_RGBA[ci+1];
                                imgData.data[i*4+2] = PALETTE_RGBA[ci+2];
                                imgData.data[i*4+3] = 255;
                            }
                            ctx.putImageData(imgData, 0, 0);
                        }
                    }

                    // ---- Tile Picker (zoomable/pannable with multi-tile selection) ----

                    function tpRenderCanvas() {
                        if (!tpCvs) return;
                        if (!PALETTE_RGBA) meBuildPaletteRGBA();
                        var ctx = tpCvs.getContext('2d');
                        var imgData = ctx.createImageData(128, 128);
                        for (var si = 0; si < 256; si++) {
                            var sprPixels = getSprite(si);
                            var sx = (si % 16) * 8;
                            var sy = Math.floor(si / 16) * 8;
                            for (var py = 0; py < 8; py++) {
                                for (var px = 0; px < 8; px++) {
                                    var color = sprPixels[py * 8 + px];
                                    var ci = (color & 15) * 4;
                                    var idx = ((sy + py) * 128 + sx + px) * 4;
                                    imgData.data[idx] = PALETTE_RGBA[ci];
                                    imgData.data[idx+1] = PALETTE_RGBA[ci+1];
                                    imgData.data[idx+2] = PALETTE_RGBA[ci+2];
                                    imgData.data[idx+3] = 255;
                                }
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);

                        // Highlight drag selection region
                        if (tpIsDragging && tpDragStart && tpDragEnd) {
                            var x0 = Math.min(tpDragStart.tx, tpDragEnd.tx);
                            var y0 = Math.min(tpDragStart.ty, tpDragEnd.ty);
                            var x1 = Math.max(tpDragStart.tx, tpDragEnd.tx);
                            var y1 = Math.max(tpDragStart.ty, tpDragEnd.ty);
                            ctx.strokeStyle = '#29adff';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(x0 * 8 + 0.5, y0 * 8 + 0.5, (x1 - x0 + 1) * 8 - 1, (y1 - y0 + 1) * 8 - 1);
                        } else {
                            // Highlight hovered tile
                            if (tpHoverTile >= 0 && tpHoverTile < 256 && tpHoverTile !== meFgTile) {
                                var hhx = (tpHoverTile % 16) * 8;
                                var hhy = Math.floor(tpHoverTile / 16) * 8;
                                ctx.strokeStyle = '#ff0';
                                ctx.lineWidth = 1;
                                ctx.strokeRect(hhx + 0.5, hhy + 0.5, 7, 7);
                            }
                            // Highlight current tile (or stamp region)
                            if (meStampTiles && meStampW > 1 || meStampH > 1) {
                                var stx = meFgTile % 16;
                                var sty = Math.floor(meFgTile / 16);
                                ctx.strokeStyle = '#fff';
                                ctx.lineWidth = 1;
                                ctx.strokeRect(stx * 8 + 0.5, sty * 8 + 0.5, meStampW * 8 - 1, meStampH * 8 - 1);
                            } else {
                                var hx = (meFgTile % 16) * 8;
                                var hy = Math.floor(meFgTile / 16) * 8;
                                ctx.strokeStyle = '#fff';
                                ctx.lineWidth = 1;
                                ctx.strokeRect(hx + 0.5, hy + 0.5, 7, 7);
                            }
                        }
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

                    function tpScreenToTile(clientX, clientY) {
                        if (!tpCvs) return null;
                        var rect = tpCvs.getBoundingClientRect();
                        var mx = clientX - rect.left;
                        var my = clientY - rect.top;
                        if (mx < 0 || my < 0 || mx >= rect.width || my >= rect.height) return null;
                        var scaleX = 128 / rect.width;
                        var scaleY = 128 / rect.height;
                        return {
                            tx: Math.max(0, Math.min(15, Math.floor(mx * scaleX / 8))),
                            ty: Math.max(0, Math.min(15, Math.floor(my * scaleY / 8)))
                        };
                    }

                    function meShowTilePicker() {
                        var picker = document.getElementById('map-tile-picker');
                        picker.innerHTML = '';
                        tpCvs = document.createElement('canvas');
                        tpCvs.width = 128; tpCvs.height = 128;
                        picker.appendChild(tpCvs);
                        picker.style.display = 'block';
                        meTilePickerVisible = true;
                        tpIsDragging = false;
                        tpDragStart = null;
                        tpDragEnd = null;

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
                        tpIsDragging = false;
                        tpDragStart = null;
                        tpDragEnd = null;
                    }

                    function meUpdateTileLabel() {
                        var lbl = document.getElementById('me-tile-label');
                        if (!lbl) return;
                        if (meStampTiles && (meStampW > 1 || meStampH > 1)) {
                            lbl.textContent = LOCALE.tileLabel + ': #' + meFgTile + ' (' + meStampW + 'x' + meStampH + ')';
                        } else {
                            lbl.textContent = LOCALE.tileLabel + ': #' + meFgTile;
                        }
                    }

                    // ---- Toolbar ----

                    function meRenderToolbar() {
                        var tb = document.getElementById('map-toolbar');
                        tb.innerHTML = '';

                        if (EDITABLE) {
                            var tools = [
                                { id: 'pencil', label: LOCALE.toolPencil, key: 'D', icon: '\u270e' },
                                { id: 'line', label: LOCALE.toolLine, key: 'L', icon: '\u2571' },
                                { id: 'rect', label: LOCALE.toolRectangle, key: 'R', icon: '\u25ad' },
                                { id: 'fill', label: LOCALE.toolFill, key: 'F', icon: '\u25a7' },
                                { id: 'select', label: LOCALE.toolSelect, key: 'S', icon: '\u25a1' },
                                { id: 'hand', label: LOCALE.toolHand, key: 'P', icon: '\u270b' }
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
                            tb.appendChild(tileLabel);

                            var sep2 = document.createElement('span');
                            sep2.className = 'tool-sep';
                            tb.appendChild(sep2);

                            // Screen boundary toggle
                            var screenBtn = document.createElement('button');
                            screenBtn.className = 'tool-btn' + (meShowScreenBounds ? ' active' : '');
                            screenBtn.textContent = '\u25a3';
                            screenBtn.title = 'Screen boundary (B)';
                            screenBtn.onclick = function() {
                                meShowScreenBounds = !meShowScreenBounds;
                                meRenderToolbar();
                                meRenderOverlay();
                            };
                            tb.appendChild(screenBtn);

                            var sep3 = document.createElement('span');
                            sep3.className = 'tool-sep';
                            tb.appendChild(sep3);
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

                        var helpBtn = document.createElement('button');
                        helpBtn.className = 'shortcuts-help-btn';
                        helpBtn.textContent = '?';
                        helpBtn.title = 'Keyboard shortcuts';
                        helpBtn.addEventListener('click', function() { showShortcuts(); });
                        tb.appendChild(helpBtn);

                        meRenderTilePreview();
                        meUpdateTileLabel();
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
                            // Left click = start drag selection in tile picker
                            if (e.button === 0 && tpCvs) {
                                var tpos = tpScreenToTile(e.clientX, e.clientY);
                                if (tpos) {
                                    tpDragStart = { tx: tpos.tx, ty: tpos.ty };
                                    tpDragEnd = { tx: tpos.tx, ty: tpos.ty };
                                    tpIsDragging = true;
                                } else {
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
                                meStampTiles = null; meStampW = 1; meStampH = 1;
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
                                meStampAt(pos.tx, pos.ty);
                                meRenderCanvas();
                            }
                        } else if (meTool === 'line' || meTool === 'rect') {
                            if (pos.tx >= 0 && pos.tx < 128 && pos.ty >= 0 && pos.ty < 64) {
                                mePushUndo();
                                meIsDrawing = true;
                                meDrawStart = { tx: pos.tx, ty: pos.ty };
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

                        // Tile picker drag selection
                        if (tpIsDragging && tpDragStart && tpCvs) {
                            var tpos = tpScreenToTile(e.clientX, e.clientY);
                            if (tpos) {
                                tpDragEnd = { tx: tpos.tx, ty: tpos.ty };
                                tpRenderCanvas();
                            }
                            return;
                        }

                        // Tile picker hover
                        if (meTilePickerVisible && tpCvs) {
                            var tpos = tpScreenToTile(e.clientX, e.clientY);
                            var prevHover = tpHoverTile;
                            tpHoverTile = tpos ? tpos.ty * 16 + tpos.tx : -1;
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
                                meStampAt(pos.tx, pos.ty);
                                meRenderCanvas();
                            }
                        } else if (meIsDrawing && (meTool === 'line' || meTool === 'rect')) {
                            meRenderOverlay();
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
                        // Tile picker drag selection complete
                        if (tpIsDragging && tpDragStart) {
                            tpIsDragging = false;
                            var endPos = tpDragEnd || tpDragStart;
                            var x0 = Math.min(tpDragStart.tx, endPos.tx);
                            var y0 = Math.min(tpDragStart.ty, endPos.ty);
                            var x1 = Math.max(tpDragStart.tx, endPos.tx);
                            var y1 = Math.max(tpDragStart.ty, endPos.ty);
                            var sw = x1 - x0 + 1;
                            var sh = y1 - y0 + 1;
                            meFgTile = y0 * 16 + x0;
                            if (sw === 1 && sh === 1) {
                                meStampTiles = null; meStampW = 1; meStampH = 1;
                            } else {
                                meStampW = sw; meStampH = sh;
                                meStampTiles = [];
                                for (var ty = 0; ty < sh; ty++) {
                                    var row = [];
                                    for (var tx = 0; tx < sw; tx++) {
                                        row.push((y0 + ty) * 16 + (x0 + tx));
                                    }
                                    meStampTiles.push(row);
                                }
                            }
                            tpDragStart = null; tpDragEnd = null;
                            meHideTilePicker();
                            meRenderTilePreview();
                            meUpdateTileLabel();
                            return;
                        }

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
                        } else if (meIsDrawing && meTool === 'line' && meDrawStart) {
                            meIsDrawing = false;
                            var x1 = Math.max(0, Math.min(127, meMouseTX));
                            var y1 = Math.max(0, Math.min(63, meMouseTY));
                            meBresenhamLine(meDrawStart.tx, meDrawStart.ty, x1, y1, meFgTile);
                            meDrawStart = null;
                            meRenderCanvas(); notifyMapChanged();
                        } else if (meIsDrawing && meTool === 'rect' && meDrawStart) {
                            meIsDrawing = false;
                            var rx1 = Math.max(0, Math.min(127, meMouseTX));
                            var ry1 = Math.max(0, Math.min(63, meMouseTY));
                            // Shift constrains to square
                            if (e.shiftKey) {
                                var side = Math.max(Math.abs(rx1 - meDrawStart.tx), Math.abs(ry1 - meDrawStart.ty));
                                rx1 = meDrawStart.tx + (rx1 >= meDrawStart.tx ? side : -side);
                                ry1 = meDrawStart.ty + (ry1 >= meDrawStart.ty ? side : -side);
                            }
                            meRectFill(meDrawStart.tx, meDrawStart.ty, rx1, ry1, meFgTile);
                            meDrawStart = null;
                            meRenderCanvas(); notifyMapChanged();
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
                                meStampTiles = null; meStampW = 1; meStampH = 1;
                                tpRenderCanvas(); meRenderTilePreview(); meUpdateTileLabel();
                                return;
                            }
                            if (key === 'w' && !e.ctrlKey && !e.metaKey) {
                                e.preventDefault();
                                meFgTile = (meFgTile + 1) % 256;
                                meStampTiles = null; meStampW = 1; meStampH = 1;
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
                            meStampTiles = null; meStampW = 1; meStampH = 1;
                            meRenderTilePreview(); meUpdateTileLabel();
                            return;
                        }
                        if (key === 'w' && !e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            meFgTile = (meFgTile + 1) % 256;
                            meStampTiles = null; meStampW = 1; meStampH = 1;
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
                        if (key === 'l' && !e.ctrlKey) { meTool = 'line'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 'r' && !e.ctrlKey) { meTool = 'rect'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 'f' && !e.ctrlKey) { meTool = 'fill'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 's' && !e.ctrlKey && !e.metaKey) { meTool = 'select'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 'p' && !e.ctrlKey) { meTool = 'hand'; meRenderToolbar(); meUpdateCursor(); return; }
                        if (key === 'b' && !e.ctrlKey) { meShowScreenBounds = !meShowScreenBounds; meRenderToolbar(); meRenderOverlay(); return; }

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
                            meForceFullRedraw = true;
                            meRenderCanvas();
                            return;
                        }
                        mapEditorInited = true;

                        meBuildPaletteRGBA();
                        meDirtyTiles = new Set();
                        meForceFullRedraw = true;

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
                    var BASE_FREQ = 65.41;

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
                                case 6:
                                case 7:
                                    // Arpeggio: alternate between current and next note frequency
                                    if (oscillator.frequency) {
                                        var arpInterval = (note.effect === 6) ? 16 : 33; // fast=16ms, slow=33ms
                                        var arpFreqA = pitchToFreq(note.pitch);
                                        var arpFreqB = pitchToFreq(nextNote.pitch);
                                        var arpToggle = false;
                                        var arpEnd = audioCtx.currentTime + noteDuration;
                                        var arpTimer = setInterval(function() {
                                            if (!isPlaying || audioCtx.currentTime >= arpEnd) { clearInterval(arpTimer); return; }
                                            try {
                                                arpToggle = !arpToggle;
                                                oscillator.frequency.setValueAtTime(arpToggle ? arpFreqB : arpFreqA, audioCtx.currentTime);
                                            } catch(ae) { clearInterval(arpTimer); }
                                        }, arpInterval);
                                    }
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
                    // ============ END AUDIO ENGINE ============

                    // ============ I18N EDITOR ============
                    var i18nInited = false;
                    var i18nData = (META_DATA && META_DATA.i18n) || I18N_DATA || { locales: [], entries: [], outputLocale: "" };
                    var metaObj = META_DATA || { meta: { title: '', author: '', template: 'default' }, i18n: i18nData };
                    // entries: [{key: string, translations: {locale: string}}]
                    // locales: string[]
                    var i18nFontLoaded = false;
                    var i18nFontCanvas = null;
                    var i18nFontCtx = null;

                    function initI18nEditor() {
                        if (!i18nData.locales) i18nData.locales = [];
                        if (!i18nData.entries) i18nData.entries = [];
                        if (!i18nData.outputLocale) i18nData.outputLocale = "";
                        // Auto-scan code for tx() calls every time the tab is shown
                        i18nScanCode();
                        if (!i18nInited) {
                            i18nInited = true;
                            loadI18nFont(function() {
                                i18nRenderToolbar();
                                i18nRenderTable();
                                i18nRenderCodegen();
                                i18nRenderStatus();
                            });
                        } else {
                            i18nRenderToolbar();
                            i18nRenderTable();
                            i18nRenderCodegen();
                            i18nRenderStatus();
                        }
                    }

                    function loadI18nFont(cb) {
                        if (i18nFontLoaded) { cb(); return; }
                        var f = new FontFace('BoutiqueBitmap7x7', 'url(' + FONT_URI + ')');
                        f.load().then(function(loaded) {
                            document.fonts.add(loaded);
                            i18nFontLoaded = true;
                            i18nFontCanvas = document.createElement('canvas');
                            i18nFontCanvas.width = 8;
                            i18nFontCanvas.height = 8;
                            i18nFontCtx = i18nFontCanvas.getContext('2d', { willReadFrequently: true });
                            cb();
                        }).catch(function(e) {
                            console.warn('Failed to load i18n font:', e);
                            i18nFontLoaded = true;
                            i18nFontCanvas = document.createElement('canvas');
                            i18nFontCanvas.width = 8;
                            i18nFontCanvas.height = 8;
                            i18nFontCtx = i18nFontCanvas.getContext('2d', { willReadFrequently: true });
                            cb();
                        });
                    }

                    function isAscii(ch) {
                        return ch.charCodeAt(0) < 128;
                    }

                    // Render a single character to 8 bytes (LSB=leftmost pixel)
                    function renderGlyphBytes(ch) {
                        if (!i18nFontCtx) return [0,0,0,0,0,0,0,0];
                        var ctx = i18nFontCtx;
                        ctx.clearRect(0, 0, 8, 8);
                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, 8, 8);
                        ctx.fillStyle = '#fff';
                        ctx.font = '8px BoutiqueBitmap7x7';
                        ctx.textBaseline = 'top';
                        ctx.fillText(ch, 0, 0);
                        var imgData = ctx.getImageData(0, 0, 8, 8);
                        var bytes = [];
                        for (var row = 0; row < 8; row++) {
                            var b = 0;
                            for (var col = 0; col < 8; col++) {
                                var idx = (row * 8 + col) * 4;
                                // If pixel is bright (white), set bit. LSB = leftmost pixel.
                                if (imgData.data[idx] > 128) {
                                    b |= (1 << col);
                                }
                            }
                            bytes.push(b);
                        }
                        return bytes;
                    }

                    function i18nScanCode() {
                        if (!monacoEditor) return;
                        var code = monacoEditor.getValue();
                        var re = /tx\\s*\\(\\s*"([^"]+)"/g;
                        var m;
                        var foundKeys = {};
                        while ((m = re.exec(code)) !== null) {
                            foundKeys[m[1]] = true;
                        }
                        // Remove entries whose keys no longer exist in code
                        i18nData.entries = i18nData.entries.filter(function(e) { return foundKeys[e.key]; });
                        // Add new keys
                        var existingKeys = {};
                        i18nData.entries.forEach(function(e) { existingKeys[e.key] = true; });
                        Object.keys(foundKeys).forEach(function(k) {
                            if (!existingKeys[k]) {
                                var trans = {};
                                i18nData.locales.forEach(function(loc) { trans[loc] = ""; });
                                i18nData.entries.push({ key: k, translations: trans });
                            }
                        });
                    }

                    function i18nAddLocale(loc) {
                        loc = loc.trim();
                        if (!loc || i18nData.locales.indexOf(loc) >= 0) return;
                        i18nData.locales.push(loc);
                        i18nData.entries.forEach(function(e) {
                            if (!e.translations) e.translations = {};
                            e.translations[loc] = "";
                        });
                        if (!i18nData.outputLocale) i18nData.outputLocale = loc;
                        i18nRenderToolbar();
                        i18nRenderTable();
                        i18nRenderCodegen();
                        i18nRenderStatus();
                        notifyI18nChanged();
                    }

                    function i18nRemoveLocale(loc) {
                        var idx = i18nData.locales.indexOf(loc);
                        if (idx < 0) return;
                        i18nData.locales.splice(idx, 1);
                        i18nData.entries.forEach(function(e) {
                            if (e.translations) delete e.translations[loc];
                        });
                        if (i18nData.outputLocale === loc) {
                            i18nData.outputLocale = i18nData.locales[0] || "";
                        }
                        i18nRenderToolbar();
                        i18nRenderTable();
                        i18nRenderCodegen();
                        i18nRenderStatus();
                        notifyI18nChanged();
                    }

                    function i18nRenderToolbar() {
                        var tb = document.getElementById('i18n-toolbar');
                        if (!tb) return;
                        var html = '';
                        html += '<span style="color:#888;font-size:11px;">Locales:</span> ';
                        i18nData.locales.forEach(function(loc) {
                            html += '<span style="color:#29adff;font-size:11px;margin:0 2px;">' + loc;
                            html += ' <span class="i18n-remove-locale" data-loc="' + loc + '" style="color:#f66;cursor:pointer;font-size:9px;" title="Remove">x</span>';
                            html += '</span>';
                        });
                        html += '<div class="tool-sep"></div>';
                        html += '<input type="text" id="i18n-new-locale" placeholder="e.g. zh_CN" style="width:70px;">';
                        html += '<button class="tool-btn" id="i18n-add-locale-btn">+ Locale</button>';
                        html += '<div class="tool-sep"></div>';
                        html += '<span style="color:#888;font-size:11px;">Output:</span> ';
                        html += '<select id="i18n-output-locale">';
                        i18nData.locales.forEach(function(loc) {
                            html += '<option value="' + loc + '"' + (loc === i18nData.outputLocale ? ' selected' : '') + '>' + loc + '</option>';
                        });
                        html += '</select>';
                        tb.innerHTML = html;

                        // Wire events
                        var addBtn = document.getElementById('i18n-add-locale-btn');
                        if (addBtn) addBtn.addEventListener('click', function() {
                            var inp = document.getElementById('i18n-new-locale');
                            if (inp) { i18nAddLocale(inp.value); inp.value = ''; }
                        });

                        var newLocInput = document.getElementById('i18n-new-locale');
                        if (newLocInput) newLocInput.addEventListener('keydown', function(ev) {
                            if (ev.key === 'Enter') {
                                i18nAddLocale(newLocInput.value);
                                newLocInput.value = '';
                            }
                        });

                        var outputSel = document.getElementById('i18n-output-locale');
                        if (outputSel) outputSel.addEventListener('change', function() {
                            i18nData.outputLocale = outputSel.value;
                            i18nRenderCodegen();
                            notifyI18nChanged();
                        });

                        document.querySelectorAll('.i18n-remove-locale').forEach(function(el) {
                            el.addEventListener('click', function() {
                                i18nRemoveLocale(el.getAttribute('data-loc'));
                            });
                        });
                    }

                    function i18nRenderTable() {
                        var wrap = document.getElementById('i18n-table-wrap');
                        if (!wrap) return;
                        if (i18nData.entries.length === 0 && i18nData.locales.length === 0) {
                            wrap.innerHTML = '<div style="padding:20px;color:#666;text-align:center;">No i18n entries yet. Add a locale and click "Scan Code" to find tx() calls.</div>';
                            return;
                        }
                        var html = '<table><thead><tr><th>Key</th>';
                        i18nData.locales.forEach(function(loc) {
                            html += '<th>' + loc + '</th>';
                        });
                        html += '</tr></thead><tbody>';
                        i18nData.entries.forEach(function(entry, idx) {
                            html += '<tr>';
                            html += '<td class="key-cell" title="' + entry.key + '">' + entry.key + '</td>';
                            i18nData.locales.forEach(function(loc) {
                                var val = (entry.translations && entry.translations[loc]) || '';
                                var emptyClass = !val ? ' empty' : '';
                                html += '<td><input class="i18n-trans-input' + emptyClass + '" data-idx="' + idx + '" data-loc="' + loc + '" value="' + escHtml(val) + '"></td>';
                            });
                            html += '</tr>';
                        });
                        html += '</tbody></table>';
                        wrap.innerHTML = html;

                        // Wire input events
                        wrap.querySelectorAll('.i18n-trans-input').forEach(function(inp) {
                            inp.addEventListener('input', function() {
                                var idx = parseInt(inp.getAttribute('data-idx'));
                                var loc = inp.getAttribute('data-loc');
                                if (!i18nData.entries[idx].translations) i18nData.entries[idx].translations = {};
                                i18nData.entries[idx].translations[loc] = inp.value;
                                inp.classList.toggle('empty', !inp.value);
                                i18nRenderCodegenDebounced();
                                i18nRenderStatus();
                                notifyI18nChanged();
                            });
                        });
                    }

                    function escHtml(s) {
                        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                    }

                    var codegenTimer = null;
                    function i18nRenderCodegenDebounced() {
                        if (codegenTimer) clearTimeout(codegenTimer);
                        codegenTimer = setTimeout(function() { i18nRenderCodegen(); }, 200);
                    }

                    function i18nRenderCodegen() {
                        var el = document.getElementById('i18n-codegen');
                        if (!el) return;
                        var loc = i18nData.outputLocale;
                        if (!loc) {
                            el.innerHTML = '<div class="codegen-header"><span>No output locale selected</span></div>';
                            return;
                        }

                        // Collect all unique non-ASCII chars across all translations for this locale
                        var uniqueChars = {};
                        var charList = [];
                        i18nData.entries.forEach(function(entry) {
                            var text = (entry.translations && entry.translations[loc]) || '';
                            for (var i = 0; i < text.length; i++) {
                                var ch = text[i];
                                if (!isAscii(ch) && !uniqueChars[ch]) {
                                    uniqueChars[ch] = charList.length;
                                    charList.push(ch);
                                }
                            }
                        });

                        // Render glyph data (8 bytes per char, as hex string)
                        var glyphHex = '';
                        charList.forEach(function(ch) {
                            var bytes = renderGlyphBytes(ch);
                            bytes.forEach(function(b) {
                                glyphHex += ('0' + b.toString(16)).slice(-2);
                            });
                        });

                        // Build _gd as a Lua hex string literal
                        var gdStr = '';
                        var bslash = String.fromCharCode(92);
                        for (var i = 0; i < glyphHex.length; i += 2) {
                            gdStr += bslash + 'x' + glyphHex.substr(i, 2);
                        }

                        // Build _td (text data table)
                        var tdLines = [];
                        i18nData.entries.forEach(function(entry) {
                            var text = (entry.translations && entry.translations[loc]) || '';
                            if (!text) return;
                            var mapped = '';
                            var width = 0;
                            for (var i = 0; i < text.length; i++) {
                                var ch = text[i];
                                if (isAscii(ch)) {
                                    if (ch === '"') mapped += bslash + '"';
                                    else if (ch === bslash) mapped += bslash + bslash;
                                    else mapped += ch;
                                    width += 4;
                                } else {
                                    var idx = uniqueChars[ch];
                                    // Map to char code 128+
                                    var code = 128 + idx;
                                    mapped += bslash + code.toString();
                                    width += 8;
                                }
                            }
                            tdLines.push(' ' + entry.key + '={w=' + width + ',s="' + mapped + '"}');
                        });

                        var useSwap = charList.length > 128;
                        var nl = String.fromCharCode(10);
                        var p014 = bslash + '014';

                        // Generate Lua code
                        var lua = '';
                        lua += '-- i18n runtime (generated by pico8ide)' + nl;
                        lua += '-- locale: ' + loc + ', ' + charList.length + ' unique glyphs' + nl;
                        if (glyphHex.length > 0) {
                            lua += '_gd="' + gdStr + '"' + nl;
                        }
                        lua += '_td={' + nl;
                        tdLines.forEach(function(l) { lua += l + ',' + nl; });
                        lua += '}' + nl + nl;

                        if (!useSwap) {
                            // Simple mode: all glyphs fit in slots 128-255
                            lua += 'function _txi()' + nl;
                            lua += ' poke(0x5600,4)' + nl;
                            lua += ' poke(0x5601,8)' + nl;
                            lua += ' poke(0x5602,8)' + nl;
                            if (glyphHex.length > 0) {
                                lua += ' for i=1,#_gd do poke(0x59ff+i,ord(_gd,i)) end' + nl;
                            }
                            lua += 'end' + nl + nl;
                            lua += 'function tx(k,x,y,c)' + nl;
                            lua += ' local d=_td[k]' + nl;
                            lua += ' if(d)print("' + p014 + '"..d.s,x,y,c)' + nl;
                            lua += 'end' + nl + nl;
                        } else {
                            // Swap mode: >128 unique chars, need per-text poke
                            lua += '_gi={}' + nl + nl;
                            lua += 'function _txi()' + nl;
                            lua += ' poke(0x5600,4)' + nl;
                            lua += ' poke(0x5601,8)' + nl;
                            lua += ' poke(0x5602,8)' + nl;
                            lua += 'end' + nl + nl;
                            lua += 'function _txl(s)' + nl;
                            lua += ' for i=1,#s do' + nl;
                            lua += '  local c=ord(s,i)' + nl;
                            lua += '  if c>=128 and not _gi[c] then' + nl;
                            lua += '   local o=(c-128)*8+1' + nl;
                            lua += '   for j=0,7 do poke(0x5a00+(c-128)*8+j,ord(_gd,o+j)) end' + nl;
                            lua += '   _gi[c]=true' + nl;
                            lua += '  end' + nl;
                            lua += ' end' + nl;
                            lua += 'end' + nl + nl;
                            lua += 'function tx(k,x,y,c)' + nl;
                            lua += ' local d=_td[k]' + nl;
                            lua += ' if not d then return end' + nl;
                            lua += ' _txl(d.s)' + nl;
                            lua += ' print("' + p014 + '"..d.s,x,y,c)' + nl;
                            lua += 'end' + nl + nl;
                        }
                        lua += 'function txw(k)' + nl;
                        lua += ' local d=_td[k]' + nl;
                        lua += ' return d and d.w or 0' + nl;
                        lua += 'end' + nl;

                        // Display
                        var headerNote = charList.length + ' unique glyphs';
                        if (useSwap) headerNote += ' (swap mode)';
                        var html = '<div class="codegen-header">';
                        html += '<span>Generated Lua (' + headerNote + ')</span>';
                        html += '<button id="i18n-copy-btn">Copy</button>';
                        html += '</div>';
                        html += '<pre id="i18n-codegen-pre">' + escHtml(lua) + '</pre>';
                        el.innerHTML = html;

                        var copyBtn = document.getElementById('i18n-copy-btn');
                        if (copyBtn) {
                            copyBtn.addEventListener('click', function() {
                                var pre = document.getElementById('i18n-codegen-pre');
                                if (pre) {
                                    navigator.clipboard.writeText(pre.textContent || '').then(function() {
                                        copyBtn.textContent = 'Copied!';
                                        setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                                    });
                                }
                            });
                        }
                    }

                    function i18nRenderStatus() {
                        var el = document.getElementById('i18n-status-bar');
                        if (!el) return;
                        var totalEntries = i18nData.entries.length;
                        var totalLocales = i18nData.locales.length;
                        var filled = 0;
                        var total = totalEntries * totalLocales;
                        i18nData.entries.forEach(function(e) {
                            i18nData.locales.forEach(function(loc) {
                                if (e.translations && e.translations[loc]) filled++;
                            });
                        });
                        var pct = total > 0 ? Math.round(filled / total * 100) : 0;
                        el.textContent = totalEntries + ' keys | ' + totalLocales + ' locales | ' + filled + '/' + total + ' translations (' + pct + '%)';
                    }

                    var i18nNotifyTimer = null;
                    function notifyI18nChanged() {
                        if (i18nNotifyTimer) clearTimeout(i18nNotifyTimer);
                        i18nNotifyTimer = setTimeout(function() {
                            // Only persist when there are tx() entries
                            if (i18nData.entries.length === 0) return;
                            metaObj.i18n = {
                                locales: i18nData.locales,
                                entries: i18nData.entries,
                                outputLocale: i18nData.outputLocale
                            };
                            vscodeApi.postMessage({
                                type: 'metaChanged',
                                metaData: metaObj
                            });
                        }, 300);
                    }
                    // ============ END I18N EDITOR ============

                    // ============ EXPORT EDITOR ============
                    var exportInited = false;
                    var exportPreviewImg = null;

                    function notifyMetaChanged() {
                        vscodeApi.postMessage({
                            type: 'metaChanged',
                            metaData: metaObj
                        });
                    }

                    function initExportEditor() {
                        if (!metaObj.meta) metaObj.meta = { title: '', author: '', template: 'default' };
                        if (!exportInited) {
                            exportInited = true;
                            loadI18nFont(function() {
                                exportRenderForm();
                                exportRenderPreview();
                            });
                        } else {
                            exportRenderForm();
                            exportRenderPreview();
                        }
                    }

                    function exportRenderForm() {
                        var form = document.getElementById('export-form');
                        if (!form) return;
                        var html = '';

                        // Title
                        html += '<div>';
                        html += '<label>' + LOCALE.exportTitle + '</label>';
                        html += '<input type="text" id="export-title" value="' + escHtml(metaObj.meta.title || '') + '" placeholder="Game Title">';
                        html += '</div>';

                        // Author
                        html += '<div>';
                        html += '<label>' + LOCALE.exportAuthor + '</label>';
                        html += '<input type="text" id="export-author" value="' + escHtml(metaObj.meta.author || '') + '" placeholder="Author">';
                        html += '</div>';

                        // Template picker
                        html += '<div>';
                        html += '<label>' + LOCALE.exportTemplate + '</label>';
                        html += '<div class="template-picker" id="template-picker">';
                        var templates = ['default', 'cyan', 'e-zombie', 'e-zombie16'];
                        templates.forEach(function(name) {
                            var sel = (metaObj.meta.template === name) ? ' selected' : '';
                            var preview = TEMPLATE_PREVIEWS[name] || '';
                            html += '<div class="template-option' + sel + '" data-template="' + name + '">';
                            if (preview) {
                                html += '<img src="' + preview + '" alt="' + name + '">';
                            }
                            html += '<span>' + name + '</span>';
                            html += '</div>';
                        });
                        html += '</div>';
                        html += '</div>';

                        // Export buttons
                        html += '<div class="export-buttons">';
                        html += '<button id="export-base-btn">' + LOCALE.exportButton + '</button>';
                        // Per-locale variant buttons
                        if (i18nData.locales && i18nData.locales.length > 0) {
                            i18nData.locales.forEach(function(loc) {
                                html += '<button class="secondary export-locale-btn" data-locale="' + loc + '">' + LOCALE.exportLocaleVariant + ' ' + loc + '.p8.png</button>';
                            });
                            html += '<button class="secondary" id="export-all-btn">' + LOCALE.exportAll + '</button>';
                        }
                        html += '</div>';

                        // Status
                        html += '<div id="export-msg" style="margin-top:8px;font-size:11px;color:#888;"></div>';

                        form.innerHTML = html;

                        // Wire events
                        var titleInp = document.getElementById('export-title');
                        if (titleInp) titleInp.addEventListener('input', function() {
                            metaObj.meta.title = titleInp.value;
                            notifyMetaChanged();
                            exportRenderPreviewDebounced();
                        });

                        var authorInp = document.getElementById('export-author');
                        if (authorInp) authorInp.addEventListener('input', function() {
                            metaObj.meta.author = authorInp.value;
                            notifyMetaChanged();
                            exportRenderPreviewDebounced();
                        });

                        document.querySelectorAll('.template-option').forEach(function(el) {
                            el.addEventListener('click', function() {
                                document.querySelectorAll('.template-option').forEach(function(o) { o.classList.remove('selected'); });
                                el.classList.add('selected');
                                metaObj.meta.template = el.getAttribute('data-template');
                                notifyMetaChanged();
                                exportRenderPreview();
                            });
                        });

                        var baseBtn = document.getElementById('export-base-btn');
                        if (baseBtn) baseBtn.addEventListener('click', function() {
                            exportDoExport('base');
                        });

                        document.querySelectorAll('.export-locale-btn').forEach(function(btn) {
                            btn.addEventListener('click', function() {
                                exportDoExport(btn.getAttribute('data-locale'));
                            });
                        });

                        var allBtn = document.getElementById('export-all-btn');
                        if (allBtn) allBtn.addEventListener('click', function() { exportDoExportAll(); });
                    }

                    var exportPreviewTimer = null;
                    function exportRenderPreviewDebounced() {
                        if (exportPreviewTimer) clearTimeout(exportPreviewTimer);
                        exportPreviewTimer = setTimeout(function() { exportRenderPreview(); }, 150);
                    }

                    function exportRenderPreview() {
                        var cvs = document.getElementById('cvs-export');
                        if (!cvs) return;
                        var ctx = cvs.getContext('2d');
                        ctx.clearRect(0, 0, 160, 205);

                        // Draw template
                        var templateName = metaObj.meta.template || 'default';
                        var templateSrc = TEMPLATE_PREVIEWS[templateName];
                        if (templateSrc) {
                            var tplImg = new Image();
                            tplImg.onload = function() {
                                ctx.drawImage(tplImg, 0, 0, 160, 205);
                                // Composite label at (16, 24)
                                if (LABEL_DATA_URL) {
                                    var labelImg = new Image();
                                    labelImg.onload = function() {
                                        ctx.drawImage(labelImg, 16, 24, 128, 128);
                                        exportDrawText(ctx);
                                    };
                                    labelImg.src = LABEL_DATA_URL;
                                } else {
                                    exportDrawText(ctx);
                                }
                            };
                            tplImg.src = templateSrc;
                        }
                    }

                    function exportDrawText(ctx) {
                        var title = metaObj.meta.title || '';
                        var author = metaObj.meta.author || '';

                        // Use BoutiqueBitmap7x7 if loaded
                        if (i18nFontLoaded) {
                            ctx.font = '8px BoutiqueBitmap7x7';
                            ctx.fillStyle = '#fff';
                            ctx.textBaseline = 'top';

                            // Render title at (18, 166)
                            var tx = 18;
                            for (var i = 0; i < title.length; i++) {
                                var ch = title[i];
                                var isA = ch.charCodeAt(0) < 128;
                                ctx.fillText(ch, tx, 166);
                                tx += isA ? 4 : 8;
                            }

                            // Render author at (18, 176)
                            var ax = 18;
                            for (var j = 0; j < author.length; j++) {
                                var ch2 = author[j];
                                var isA2 = ch2.charCodeAt(0) < 128;
                                ctx.fillText(ch2, ax, 176);
                                ax += isA2 ? 4 : 8;
                            }
                        }
                    }

                    function exportDoExport(variant) {
                        var msg = document.getElementById('export-msg');
                        if (msg) msg.textContent = 'Exporting...';
                        if (msg) msg.style.color = '#888';

                        // Collect glyph bitmaps for title/author chars
                        var title = metaObj.meta.title || '';
                        var author = metaObj.meta.author || '';
                        var glyphs = {};
                        var allText = title + author;

                        // For locale variant, use locale-specific title/author if available
                        var localeMeta = null;
                        if (variant !== 'base' && variant) {
                            // Check for locale-specific title/author in i18n entries
                            var locTitle = '';
                            var locAuthor = '';
                            i18nData.entries.forEach(function(e) {
                                if (e.key === '_title' && e.translations && e.translations[variant]) locTitle = e.translations[variant];
                                if (e.key === '_author' && e.translations && e.translations[variant]) locAuthor = e.translations[variant];
                            });
                            if (locTitle || locAuthor) {
                                localeMeta = { title: locTitle || title, author: locAuthor || author };
                                allText = localeMeta.title + localeMeta.author;
                            }
                        }

                        for (var i = 0; i < allText.length; i++) {
                            var ch = allText[i];
                            if (!glyphs[ch]) {
                                glyphs[ch] = renderGlyphBytes(ch);
                            }
                        }

                        // For locale variant, generate i18n Lua runtime
                        var i18nLuaCode = null;
                        if (variant !== 'base' && variant) {
                            i18nLuaCode = exportGenerateI18nLua(variant);
                        }

                        vscodeApi.postMessage({
                            type: 'exportCart',
                            variant: variant,
                            glyphs: glyphs,
                            i18nLuaCode: i18nLuaCode,
                            localeMeta: localeMeta
                        });
                    }

                    function exportDoExportAll() {
                        var msg = document.getElementById('export-msg');
                        if (msg) { msg.textContent = 'Exporting all...'; msg.style.color = '#888'; }

                        var variants = ['base'];
                        if (i18nData.locales) {
                            i18nData.locales.forEach(function(loc) { variants.push(loc); });
                        }

                        var items = [];
                        variants.forEach(function(variant) {
                            var title = metaObj.meta.title || '';
                            var author = metaObj.meta.author || '';
                            var glyphs = {};
                            var allText = title + author;
                            var localeMeta = null;
                            var i18nLuaCode = null;

                            if (variant !== 'base') {
                                var locTitle = '';
                                var locAuthor = '';
                                i18nData.entries.forEach(function(e) {
                                    if (e.key === '_title' && e.translations && e.translations[variant]) locTitle = e.translations[variant];
                                    if (e.key === '_author' && e.translations && e.translations[variant]) locAuthor = e.translations[variant];
                                });
                                if (locTitle || locAuthor) {
                                    localeMeta = { title: locTitle || title, author: locAuthor || author };
                                    allText = localeMeta.title + localeMeta.author;
                                }
                                i18nLuaCode = exportGenerateI18nLua(variant);
                            }

                            for (var i = 0; i < allText.length; i++) {
                                var ch = allText[i];
                                if (!glyphs[ch]) glyphs[ch] = renderGlyphBytes(ch);
                            }

                            items.push({ variant: variant, glyphs: glyphs, i18nLuaCode: i18nLuaCode, localeMeta: localeMeta });
                        });

                        vscodeApi.postMessage({ type: 'exportCartBatch', items: items });
                    }

                    function exportGenerateI18nLua(loc) {
                        // Same logic as i18nRenderCodegen but returns the Lua string
                        var uniqueChars = {};
                        var charList = [];
                        i18nData.entries.forEach(function(entry) {
                            var text = (entry.translations && entry.translations[loc]) || '';
                            for (var i = 0; i < text.length; i++) {
                                var ch = text[i];
                                if (!isAscii(ch) && !uniqueChars[ch]) {
                                    uniqueChars[ch] = charList.length;
                                    charList.push(ch);
                                }
                            }
                        });

                        var glyphHex = '';
                        charList.forEach(function(ch) {
                            var bytes = renderGlyphBytes(ch);
                            bytes.forEach(function(b) {
                                glyphHex += ('0' + b.toString(16)).slice(-2);
                            });
                        });

                        var gdStr = '';
                        var bslash = String.fromCharCode(92);
                        for (var i = 0; i < glyphHex.length; i += 2) {
                            gdStr += bslash + 'x' + glyphHex.substr(i, 2);
                        }

                        var tdLines = [];
                        i18nData.entries.forEach(function(entry) {
                            var text = (entry.translations && entry.translations[loc]) || '';
                            if (!text) return;
                            var mapped = '';
                            var width = 0;
                            for (var j = 0; j < text.length; j++) {
                                var ch = text[j];
                                if (isAscii(ch)) {
                                    if (ch === '"') mapped += bslash + '"';
                                    else if (ch === bslash) mapped += bslash + bslash;
                                    else mapped += ch;
                                    width += 4;
                                } else {
                                    var idx = uniqueChars[ch];
                                    var code = 128 + idx;
                                    mapped += bslash + code.toString();
                                    width += 8;
                                }
                            }
                            tdLines.push(' ' + entry.key + '={w=' + width + ',s="' + mapped + '"}');
                        });

                        var useSwap = charList.length > 128;
                        var nl = String.fromCharCode(10);
                        var p014 = bslash + '014';

                        var lua = '';
                        lua += '-- i18n runtime (generated by pico8ide)' + nl;
                        lua += '-- locale: ' + loc + ', ' + charList.length + ' unique glyphs' + nl;
                        if (glyphHex.length > 0) {
                            lua += '_gd="' + gdStr + '"' + nl;
                        }
                        lua += '_td={' + nl;
                        tdLines.forEach(function(l) { lua += l + ',' + nl; });
                        lua += '}' + nl + nl;

                        if (!useSwap) {
                            lua += 'function _txi()' + nl;
                            lua += ' poke(0x5600,4)' + nl;
                            lua += ' poke(0x5601,8)' + nl;
                            lua += ' poke(0x5602,8)' + nl;
                            if (glyphHex.length > 0) {
                                lua += ' for i=1,#_gd do poke(0x59ff+i,ord(_gd,i)) end' + nl;
                            }
                            lua += 'end' + nl + nl;
                            lua += 'function tx(k,x,y,c)' + nl;
                            lua += ' local d=_td[k]' + nl;
                            lua += ' if(d)print("' + p014 + '"..d.s,x,y,c)' + nl;
                            lua += 'end' + nl + nl;
                        } else {
                            lua += '_gi={}' + nl + nl;
                            lua += 'function _txi()' + nl;
                            lua += ' poke(0x5600,4)' + nl;
                            lua += ' poke(0x5601,8)' + nl;
                            lua += ' poke(0x5602,8)' + nl;
                            lua += 'end' + nl + nl;
                            lua += 'function _txl(s)' + nl;
                            lua += ' for i=1,#s do' + nl;
                            lua += '  local c=ord(s,i)' + nl;
                            lua += '  if c>=128 and not _gi[c] then' + nl;
                            lua += '   local o=(c-128)*8+1' + nl;
                            lua += '   for j=0,7 do poke(0x5a00+(c-128)*8+j,ord(_gd,o+j)) end' + nl;
                            lua += '   _gi[c]=true' + nl;
                            lua += '  end' + nl;
                            lua += ' end' + nl;
                            lua += 'end' + nl + nl;
                            lua += 'function tx(k,x,y,c)' + nl;
                            lua += ' local d=_td[k]' + nl;
                            lua += ' if not d then return end' + nl;
                            lua += ' _txl(d.s)' + nl;
                            lua += ' print("' + p014 + '"..d.s,x,y,c)' + nl;
                            lua += 'end' + nl + nl;
                        }
                        lua += 'function txw(k)' + nl;
                        lua += ' local d=_td[k]' + nl;
                        lua += ' return d and d.w or 0' + nl;
                        lua += 'end' + nl;

                        return lua;
                    }

                    // Listen for export results from extension
                    window.addEventListener('message', function(event) {
                        var msg = event.data;
                        var statusEl = document.getElementById('export-msg');
                        if (msg.type === 'exportComplete' && statusEl) {
                            statusEl.textContent = LOCALE.exportSuccess + ': ' + msg.path.split('/').pop().split(String.fromCharCode(92)).pop();
                            statusEl.style.color = '#8f8';
                        }
                        if (msg.type === 'exportError' && statusEl) {
                            statusEl.textContent = LOCALE.exportError + ': ' + msg.error;
                            statusEl.style.color = '#f66';
                        }
                        if (msg.type === 'exportBatchComplete' && statusEl) {
                            if (msg.errors && msg.errors.length > 0) {
                                statusEl.textContent = msg.paths.length + ' exported, ' + msg.errors.length + ' failed: ' + msg.errors.join(', ');
                                statusEl.style.color = '#fa0';
                            } else {
                                statusEl.textContent = LOCALE.exportSuccess + ': ' + msg.paths.length + ' files (' + msg.paths.join(', ') + ')';
                                statusEl.style.color = '#8f8';
                            }
                        }
                    });
                    // ============ END EXPORT EDITOR ============`;
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
