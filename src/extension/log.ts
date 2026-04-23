import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getLog(): vscode.OutputChannel {
    if (!channel) {
        channel = vscode.window.createOutputChannel('PICO-8 IDE');
    }
    return channel;
}

export function log(message: string): void {
    const ts = new Date().toISOString();
    getLog().appendLine(`[${ts}] ${message}`);
}

export function logError(message: string, error?: unknown): void {
    const ts = new Date().toISOString();
    const errMsg = error instanceof Error ? error.message : String(error ?? '');
    getLog().appendLine(`[${ts}] ERROR: ${message}${errMsg ? ' — ' + errMsg : ''}`);
}
