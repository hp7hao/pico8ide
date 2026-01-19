"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameItem = exports.Pico8TreeDataProvider = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
class Pico8TreeDataProvider {
    constructor(workspaceRoot) {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.filterQuery = '';
        // Assume sibling directory structure: <root>/fcdb
        // workspaceRoot is likely <root>/pico8ide or <root>/fcdbtool
        // We need to find ../fcdb
        // If we run inside extension host, root might be different.
        // Let's assume the user opens the workspace root
        this.dataDir = path.resolve(workspaceRoot, '..', 'fcdb');
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    search(query) {
        this.filterQuery = query.toLowerCase();
        this.refresh();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.dataDir) {
            vscode.window.showInformationMessage('No dependency in empty workspace');
            return Promise.resolve([]);
        }
        if (element) {
            // No nesting for now, just a flat list of games?
            // Or maybe categories? Let's start flat.
            return Promise.resolve([]);
        }
        else {
            return this.getGames();
        }
    }
    async getGames() {
        const dbPath = path.join(this.dataDir, 'dist', 'pico8', 'db.json');
        if (!fs.existsSync(dbPath)) {
            vscode.window.showInformationMessage(`DB not found at ${dbPath}. Please run fcdbtool build first.`);
            return [];
        }
        try {
            const content = await fs.promises.readFile(dbPath, 'utf-8');
            let games = JSON.parse(content);
            if (this.filterQuery) {
                games = games.filter((g) => (g.name && g.name.toLowerCase().includes(this.filterQuery)) ||
                    (g.author?.name && g.author.name.toLowerCase().includes(this.filterQuery)));
            }
            return games.map((game) => {
                return new GameItem(game.name, game.author.name, game.id, game.extension?.cart_url, vscode.TreeItemCollapsibleState.None, {
                    command: 'pico8ide.openCart',
                    title: 'Open Cart',
                    arguments: [game.id]
                });
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to read DB: ${error}`);
            return [];
        }
    }
}
exports.Pico8TreeDataProvider = Pico8TreeDataProvider;
class GameItem extends vscode.TreeItem {
    constructor(label, author, id, cartUrl, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.author = author;
        this.id = id;
        this.cartUrl = cartUrl;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.tooltip = `${this.label} by ${this.author}`;
        this.description = this.author;
    }
}
exports.GameItem = GameItem;
//# sourceMappingURL=treeProvider.js.map