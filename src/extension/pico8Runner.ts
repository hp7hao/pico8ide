import * as vscode from 'vscode';

// Shared run-state observable — no circular deps
class Pico8RunState {
    private _listeners: ((running: boolean) => void)[] = [];
    private _running = false;

    get running(): boolean {
        return this._running;
    }

    set(running: boolean): void {
        this._running = running;
        this._listeners.forEach(fn => fn(running));
    }

    onChanged(listener: (running: boolean) => void): vscode.Disposable {
        this._listeners.push(listener);
        return new vscode.Disposable(() => {
            const idx = this._listeners.indexOf(listener);
            if (idx >= 0) { this._listeners.splice(idx, 1); }
        });
    }
}

export const pico8RunState = new Pico8RunState();
