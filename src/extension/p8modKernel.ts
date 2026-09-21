import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { CartData } from './cartData';

type WasmCartInstance = {
    free(): void;
    code: string;
    gfx_data(): Uint8Array;
    map_data(): Uint8Array;
    gfx_flags_data(): Uint8Array;
    music_data(): Uint8Array;
    sfx_data(): Uint8Array;
    set_gfx_data(data: Uint8Array): void;
    set_map_data(data: Uint8Array): void;
    set_gfx_flags_data(data: Uint8Array): void;
    set_music_data(data: Uint8Array): void;
    set_sfx_data(data: Uint8Array): void;
    to_p8(): string;
};

type P8modGlue = {
    initSync(input: { module: Uint8Array }): unknown;
    WasmCart: {
        new (): WasmCartInstance;
        from_p8(text: string): WasmCartInstance;
    };
};

let glue: P8modGlue | undefined;
let initPromise: Promise<P8modGlue> | undefined;

function kernelError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error(String(error));
}

function packageRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        const lockPath = path.join(dir, 'vendor', 'xwsdk', 'release', 'manifest.json');
        if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(lockPath)) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return path.resolve(__dirname, '..', '..');
}

function vendorFiles(): { jsPath: string; wasmPath: string } {
    const root = packageRoot();
    const lockPath = path.join(root, 'vendor', 'xwsdk', 'release', 'manifest.json');
    if (!fs.existsSync(lockPath)) {
        throw new Error('vendored XWSDK p8mod lock is missing');
    }
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {
        version?: string;
        artifacts?: Array<{ path: string }>;
    };
    const jsRecord = lock.artifacts?.find((record) => record.path.endsWith('/p8mod.js'));
    const wasmRecord = lock.artifacts?.find((record) => record.path.endsWith('/p8mod_bg.wasm'));
    if (!jsRecord || !wasmRecord) {
        throw new Error('vendored XWSDK p8mod-web artifacts are missing from the lock');
    }
    const jsPath = path.join(root, 'vendor', 'xwsdk', 'release', ...jsRecord.path.split('/'));
    const wasmPath = path.join(root, 'vendor', 'xwsdk', 'release', ...wasmRecord.path.split('/'));
    if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) {
        throw new Error('vendored XWSDK p8mod-web bytes are missing');
    }
    return { jsPath, wasmPath };
}

export async function initP8modKernel(): Promise<void> {
    if (glue) {
        return;
    }
    if (!initPromise) {
        initPromise = (async () => {
            const { jsPath, wasmPath } = vendorFiles();
            const loaded = await import(pathToFileURL(jsPath).href) as P8modGlue;
            loaded.initSync({ module: fs.readFileSync(wasmPath) });
            glue = loaded;
            return loaded;
        })();
    }
    await initPromise;
}

export function getP8modKernel(): P8modGlue {
    if (!glue) {
        throw new Error('XWSDK p8mod kernel is not initialized');
    }
    return glue;
}

function bytesToNumbers(data: Uint8Array): number[] {
    return Array.from(data);
}

export function cartSectionsFromP8(text: string): Omit<CartData, 'label'> {
    const kernel = getP8modKernel();
    let cart: WasmCartInstance | undefined;
    try {
        cart = kernel.WasmCart.from_p8(text);
        return {
            code: cart.code,
            gfx: bytesToNumbers(cart.gfx_data()),
            map: bytesToNumbers(cart.map_data()),
            gfxFlags: bytesToNumbers(cart.gfx_flags_data()),
            music: bytesToNumbers(cart.music_data()),
            sfx: bytesToNumbers(cart.sfx_data()),
        };
    } catch (error) {
        throw kernelError(error);
    } finally {
        cart?.free();
    }
}

export function cartSectionsToP8(cartData: CartData): string {
    const kernel = getP8modKernel();
    const cart = new kernel.WasmCart();
    try {
        cart.code = cartData.code.replace(/\0/g, '').replace(/[\x01-\x08\x0b\x0c\x0e-\x1f]/g, '');
        cart.set_gfx_data(Uint8Array.from(cartData.gfx));
        cart.set_map_data(Uint8Array.from(cartData.map));
        cart.set_gfx_flags_data(Uint8Array.from(cartData.gfxFlags));
        cart.set_music_data(Uint8Array.from(cartData.music));
        cart.set_sfx_data(Uint8Array.from(cartData.sfx));
        return cart.to_p8();
    } catch (error) {
        throw kernelError(error);
    } finally {
        cart.free();
    }
}
