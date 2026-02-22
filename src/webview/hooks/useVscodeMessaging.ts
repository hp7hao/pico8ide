import { useEffect } from 'react';
import { bridge } from '../bridge';

type MessageHandler = (msg: any) => void;

/**
 * Hook to listen for messages from the host (VS Code or standalone).
 * The handler is called for every message received.
 */
export function useVscodeMessage(handler: MessageHandler) {
    useEffect(() => {
        return bridge.onMessage(handler);
    }, [handler]);
}

/**
 * Send a message to the host.
 */
export function postMessage(msg: any) {
    bridge.postMessage(msg);
}
