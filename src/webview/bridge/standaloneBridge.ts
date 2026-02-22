import type { HostBridge } from './types';

let state: any = {};
const listeners: Set<(msg: any) => void> = new Set();

export function simulateHostMessage(msg: any) {
    for (const handler of listeners) {
        handler(msg);
    }
}

export const standaloneBridge: HostBridge = {
    postMessage(msg: any) {
        console.log('[standalone] postMessage:', msg);
        // Simulate export success after a short delay
        if (msg.type === 'exportCart') {
            setTimeout(() => {
                simulateHostMessage({
                    type: 'exportComplete',
                    path: `standalone/${msg.variant || 'base'}.p8.png`,
                });
            }, 300);
        }
        if (msg.type === 'exportCartBatch') {
            setTimeout(() => {
                const paths = (msg.items || []).map(
                    (item: any) => `standalone/${item.variant || 'base'}.p8.png`
                );
                simulateHostMessage({
                    type: 'exportBatchComplete',
                    paths,
                    errors: [],
                });
            }, 300);
        }
    },
    getState() {
        return state;
    },
    setState(newState: any) {
        state = newState;
    },
    onMessage(handler: (msg: any) => void) {
        listeners.add(handler);
        return () => {
            listeners.delete(handler);
        };
    },
};
