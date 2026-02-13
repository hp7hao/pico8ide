// Singleton wrapper for VS Code webview API
// acquireVsCodeApi() can only be called once

interface VsCodeApi {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | null = null;

export function getVscodeApi(): VsCodeApi {
    if (!api) {
        api = acquireVsCodeApi();
    }
    return api;
}
