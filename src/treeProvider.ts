import * as vscode from 'vscode';
import * as path from 'path';
import { DataManager, GameMetadata } from './dataManager';

export class Pico8TreeDataProvider implements vscode.TreeDataProvider<GameItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<GameItem | undefined | null | void> = new vscode.EventEmitter<GameItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<GameItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private games: GameMetadata[] = [];
    private filter: string = '';

    constructor(
        private workspaceRoot: string,
        private dataManager: DataManager
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async load() {
        this.games = await this.dataManager.getGames();
        this.refresh();
    }

    setFilter(query: string) {
        this.filter = query.toLowerCase();
        this.refresh();
    }

    search(query: string) {
        this.setFilter(query);
    }

    getTreeItem(element: GameItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: GameItem): vscode.ProviderResult<GameItem[]> {
        if (element) {
            return [];
        }

        // Apply filter
        let filtered = this.games;
        if (this.filter) {
            filtered = this.games.filter(g =>
                g.name.toLowerCase().includes(this.filter) ||
                g.author.name.toLowerCase().includes(this.filter) ||
                g.id.includes(this.filter)
            );
        }

        return filtered.map(game => new GameItem(game));
    }
}

export class GameItem extends vscode.TreeItem {
    constructor(
        public readonly game: GameMetadata
    ) {
        super(game.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${game.name} by ${game.author.name}`;
        this.description = game.author.name;

        this.command = {
            command: 'pico8ide.selectGame',
            title: 'Select Game',
            arguments: [this.game]
        };
    }
}
