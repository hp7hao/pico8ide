// Re-export bridge as getVscodeApi() for backward compatibility.
// All VS Code coupling now flows through the bridge abstraction.

import { bridge } from './bridge';

export function getVscodeApi() {
    return bridge;
}
