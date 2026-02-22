export interface HostBridge {
    postMessage(msg: any): void;
    getState(): any;
    setState(state: any): void;
    onMessage(handler: (msg: any) => void): () => void;
}
