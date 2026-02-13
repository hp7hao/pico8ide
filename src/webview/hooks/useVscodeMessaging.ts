import { useEffect } from 'react';
import { getVscodeApi } from '../vscodeApi';

type MessageHandler = (msg: any) => void;

/**
 * Hook to listen for messages from the extension host.
 * The handler is called for every message received.
 */
export function useVscodeMessage(handler: MessageHandler) {
    useEffect(() => {
        const listener = (event: MessageEvent) => {
            handler(event.data);
        };
        window.addEventListener('message', listener);
        return () => window.removeEventListener('message', listener);
    }, [handler]);
}

/**
 * Send a message to the extension host.
 */
export function postMessage(msg: any) {
    getVscodeApi().postMessage(msg);
}
