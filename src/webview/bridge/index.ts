import type { HostBridge } from './types';
import { standaloneBridge } from './standaloneBridge';
import { vscodeBridge } from './vscodeBridge';

declare const __HOST_MODE__: string;

const bridge: HostBridge = __HOST_MODE__ === 'standalone'
    ? standaloneBridge
    : vscodeBridge;

export { bridge };
export type { HostBridge };
