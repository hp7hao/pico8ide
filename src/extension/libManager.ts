import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Pico8Lib, Pico8LibMeta } from './libTypes';

const INCLUDE_RE = /^--#include\s+(\S+)\s*$/;

export class LibManager {
    private libs: Map<string, Pico8Lib> = new Map();
    private extensionPath: string;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
    }

    loadAll(): void {
        this.libs.clear();

        // 1. Bundled libs from resources/libs/
        const bundledDir = path.join(this.extensionPath, 'resources', 'libs');
        this.loadFromDirectory(bundledDir, 'bundled');

        // 2. Workspace libs from .pico8libs/
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const wsLibDir = path.join(folder.uri.fsPath, '.pico8libs');
                this.loadFromDirectory(wsLibDir, 'workspace');
            }
        }
    }

    private loadFromDirectory(dir: string, source: 'bundled' | 'workspace'): void {
        if (!fs.existsSync(dir)) return;

        let files: string[];
        try {
            files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        } catch {
            return;
        }

        for (const file of files) {
            try {
                const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
                const lib: Pico8Lib & { source?: string } = JSON.parse(raw);
                if (!lib.id || !lib.code) continue;
                (lib as any)._source = source;
                this.libs.set(lib.id, lib);
            } catch {
                // Skip invalid files
            }
        }
    }

    getMetadataList(): Pico8LibMeta[] {
        const result: Pico8LibMeta[] = [];
        for (const lib of this.libs.values()) {
            result.push({
                id: lib.id,
                name: lib.name,
                description: lib.description,
                author: lib.author,
                version: lib.version,
                tags: lib.tags,
                depends: lib.depends,
                tokenCount: lib.tokenCount,
                charCount: lib.charCount,
                source: (lib as any)._source || 'bundled',
            });
        }
        return result;
    }

    getLib(id: string): Pico8Lib | undefined {
        return this.libs.get(id);
    }

    resolveIncludes(code: string): { resolvedCode: string; errors: string[] } {
        const errors: string[] = [];
        const lines = code.split('\n');
        const requestedIds: string[] = [];

        // Parse --#include directives
        for (const line of lines) {
            const m = line.match(INCLUDE_RE);
            if (m) {
                requestedIds.push(m[1]);
            }
        }

        if (requestedIds.length === 0) {
            return { resolvedCode: code, errors };
        }

        // Resolve dependencies via topological sort
        const resolved = this.topologicalResolve(requestedIds, errors);

        // Build lib code blocks
        const libBlocks: string[] = [];
        for (const id of resolved) {
            const lib = this.libs.get(id);
            if (!lib) {
                errors.push(`Library not found: ${id}`);
                continue;
            }
            libBlocks.push(`-- [lib:${id}] --`);
            libBlocks.push(lib.code);
            libBlocks.push(`-- [/lib:${id}] --`);
        }

        // Strip --#include lines from user code
        const strippedLines = lines.filter(l => !INCLUDE_RE.test(l));
        const resolvedCode = libBlocks.join('\n') + '\n' + strippedLines.join('\n');

        return { resolvedCode, errors };
    }

    private topologicalResolve(ids: string[], errors: string[]): string[] {
        const visited = new Set<string>();
        const result: string[] = [];

        const visit = (id: string, chain: Set<string>) => {
            if (visited.has(id)) return;
            if (chain.has(id)) {
                errors.push(`Circular dependency detected: ${id}`);
                return;
            }
            chain.add(id);

            const lib = this.libs.get(id);
            if (!lib) {
                errors.push(`Library not found: ${id}`);
                return;
            }

            if (lib.depends) {
                for (const dep of lib.depends) {
                    visit(dep, chain);
                }
            }

            chain.delete(id);
            visited.add(id);
            result.push(id);
        };

        for (const id of ids) {
            visit(id, new Set());
        }

        return result;
    }

    startWatching(): vscode.Disposable {
        const watchers: vscode.FileSystemWatcher[] = [];

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const pattern = new vscode.RelativePattern(folder, '.pico8libs/*.json');
                const watcher = vscode.workspace.createFileSystemWatcher(pattern);
                watcher.onDidCreate(() => this.loadAll());
                watcher.onDidChange(() => this.loadAll());
                watcher.onDidDelete(() => this.loadAll());
                watchers.push(watcher);
            }
        }

        return {
            dispose: () => {
                for (const w of watchers) {
                    w.dispose();
                }
            }
        };
    }
}
