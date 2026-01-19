"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const https = require("https");
const treeProvider_1 = require("./treeProvider");
const contentProvider_1 = require("./contentProvider");
function activate(context) {
    // Helper: Determine the data root
    // If workspace folder is present, look for sibling 'fcdb'
    let rootPath = '';
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    else {
        rootPath = context.extensionPath; // Fallback
    }
    const pico8Provider = new treeProvider_1.Pico8TreeDataProvider(rootPath);
    // Register TreeDataProvider
    vscode.window.registerTreeDataProvider('pico8Games', pico8Provider);
    // Register Document Content Provider
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(contentProvider_1.Pico8ContentProvider.scheme, new contentProvider_1.Pico8ContentProvider()));
    // Register Command: Refresh
    context.subscriptions.push(vscode.commands.registerCommand('pico8ide.refreshEntry', () => {
        pico8Provider.refresh();
    }));
    // Register Command: Search
    context.subscriptions.push(vscode.commands.registerCommand('pico8ide.search', async () => {
        const query = await vscode.window.showInputBox({
            placeHolder: 'Search PICO-8 games (name or author)',
            prompt: 'Enter search query'
        });
        if (query !== undefined) { // Allow empty string to clear filter
            pico8Provider.search(query);
        }
    }));
    // Command: Open Cart
    context.subscriptions.push(vscode.commands.registerCommand('pico8ide.openCart', async (id, cartUrl) => {
        // Find the cart in fcdb/platforms/pico8/carts/bbs/<id>.p8.png
        // Resolve fcdb path again (simple duplication for now)
        const dataDir = path.resolve(rootPath, '..', 'fcdb');
        const cartDir = path.join(dataDir, 'platforms', 'pico8', 'carts', 'bbs');
        const cartPath = path.join(cartDir, `${id}.p8.png`);
        if (!fs.existsSync(cartPath)) {
            // Cart not found locally, try to download i
            const inferredUrl = `https://www.lexaloffle.com/bbs/cposts/${id}.p8.png`;
            const urlToUse = (cartUrl && cartUrl !== '') ? cartUrl : inferredUrl;
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: `Downloading cartridge ${id} (CC4)...`,
                cancellable: false
            };
            await vscode.window.withProgress(progressOptions, async (progress) => {
                try {
                    // Ensure directory exists
                    if (!fs.existsSync(cartDir)) {
                        fs.mkdirSync(cartDir, { recursive: true });
                    }
                    await downloadFile(urlToUse, cartPath);
                    vscode.window.showInformationMessage(`Successfully downloaded cartridge ${id}`);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to download cartridge: ${err.message}`);
                    return; // Stop execution
                }
            });
        }
        if (fs.existsSync(cartPath)) {
            // Open as virtual document using our custom scheme
            // Schema: pico8:/absolute/path/to/cart.p8.png
            const uri = vscode.Uri.parse(`${contentProvider_1.Pico8ContentProvider.scheme}:${cartPath}`);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
    }));
}
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                fs.unlink(dest, () => { }); // Delete the empty file
                reject(new Error(`Status Code: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { }); // Delete the partial file
            reject(err);
        });
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map