import type { HostBridge } from './types';

declare function acquireVsCodeApi(): {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
};

let api: ReturnType<typeof acquireVsCodeApi> | null = null;

function getApi() {
    if (!api) {
        api = acquireVsCodeApi();
    }
    return api;
}

export const vscodeBridge: HostBridge = {
    postMessage(msg: any) {
        getApi().postMessage(msg);
    },
    getState() {
        return getApi().getState();
    },
    setState(state: any) {
        getApi().setState(state);
    },
    onMessage(handler: (msg: any) => void) {
        const listener = (event: MessageEvent) => {
            handler(event.data);
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    },
};
