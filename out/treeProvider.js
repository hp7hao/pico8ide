"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameItem = exports.Pico8TreeDataProvider = void 0;
const vscode = require("vscode");
class Pico8TreeDataProvider {
    constructor(workspaceRoot, dataManager) {
        this.workspaceRoot = workspaceRoot;
        this.dataManager = dataManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.games = [];
        this.filter = '';
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async load() {
        this.games = await this.dataManager.getGames();
        this.refresh();
    }
    setFilter(query) {
        this.filter = query.toLowerCase();
        this.refresh();
    }
    search(query) {
        this.setFilter(query);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element) {
            return [];
        }
        // Apply filter
        let filtered = this.games;
        if (this.filter) {
            filtered = this.games.filter(g => g.name.toLowerCase().includes(this.filter) ||
                g.author.name.toLowerCase().includes(this.filter) ||
                g.id.includes(this.filter));
        }
        return filtered.map(game => new GameItem(game));
    }
}
exports.Pico8TreeDataProvider = Pico8TreeDataProvider;
class GameItem extends vscode.TreeItem {
    constructor(game) {
        super(game.name, vscode.TreeItemCollapsibleState.None);
        this.game = game;
        this.tooltip = `${game.name} by ${game.author.name}`;
        this.description = game.author.name;
        this.command = {
            command: 'pico8ide.selectGame',
            title: 'Select Game',
            arguments: [this.game]
        };
    }
}
exports.GameItem = GameItem;
//# sourceMappingURL=treeProvider.js.map