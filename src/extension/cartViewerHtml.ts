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
    const { cartData, locale, extensionUri, webview, gameName, showRunButton, showAudio, editable, i18nData, metaData, templatePreviews } = options;

    const nonce = getNonce();

    const monacoBaseUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'monaco')).toString();
    const fontUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf')).toString();
    const bundleJsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'bundle.js'));
    const bundleCssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'bundle.css'));

    // Read VS Code editor font settings
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const editorFontSize = editorConfig.get<number>('fontSize', 13);
    const editorFontFamily = editorConfig.get<string>('fontFamily', "'Courier New', monospace");
    const editorLineHeight = editorConfig.get<number>('lineHeight', 0);

    const title = gameName ? `PICO-8 Cart: ${gameName}` : 'PICO-8 Cart';

    // CSP
    const csp = `default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; worker-src ${webview.cspSource} blob: data:; connect-src ${webview.cspSource}; img-src ${webview.cspSource} data:;`;

    // Serialize init data for the React app
    const initData = {
        cartData: {
            gfx: cartData.gfx,
            map: cartData.map,
            gfxFlags: cartData.gfxFlags,
            sfx: cartData.sfx,
            music: cartData.music,
            code: cartData.code,
            label: cartData.label,
        },
        locale,
        editable: !!editable,
        showAudio: !!showAudio,
        showRunButton: !!showRunButton,
        monacoBaseUri,
        fontUri,
        i18nData: i18nData || null,
        metaData: metaData || null,
        templatePreviews: templatePreviews || {},
        editorFontSize,
        editorFontFamily,
        editorLineHeight,
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="${bundleCssUri}">
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
        window.__INIT_DATA__ = ${JSON.stringify(initData)};
    </script>
    <script nonce="${nonce}" src="${bundleJsUri}"></script>
</body>
</html>`;
}
