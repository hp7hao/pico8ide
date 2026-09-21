import { describe, it, expect } from 'vitest';
import { cartDataToP8Mod, p8ModToCartData } from '../../extension/p8modFormat';
import { validateVendor } from '../../../scripts/xwsdk-vendor.mjs';
import type { CartData } from '../../extension/cartData';

function makeCartData(code: string = 'print("hello")'): CartData {
    const gfx = new Array(8192).fill(0);
    gfx[0] = 0xab;
    gfx[100] = 0xcd;
    return {
        code,
        gfx,
        map: new Array(4096).fill(0),
        gfxFlags: new Array(256).fill(0),
        music: new Array(256).fill(0),
        sfx: new Array(4352).fill(0),
        label: '',
    };
}

describe('XWSDK p8mod vendor', () => {
    it('verifies the tracked release pin', () => {
        const { lock } = validateVendor('release');
        expect(lock.schema).toBe('pico8ide.xwsdk-vendor.v1');
        expect(lock.profile).toBe('release');
        expect(lock.artifacts.map((artifact: { path: string }) => artifact.path)).toEqual(expect.arrayContaining([
            '0.1.1/web/p8mod/p8mod.js',
            '0.1.1/web/p8mod/p8mod.d.ts',
            '0.1.1/web/p8mod/p8mod_bg.wasm',
        ]));
    });

    it('round-trips cart section bytes through the vendored kernel', () => {
        const original = makeCartData('print("kernel")');
        const text = cartDataToP8Mod(original, null);
        const { cartData } = p8ModToCartData(text);
        expect(cartData.code).toBe('print("kernel")');
        expect(cartData.gfx[0]).toBe(0xab);
        expect(cartData.gfx[100]).toBe(0xcd);
        expect(cartData.gfx).toHaveLength(8192);
        expect(cartData.map).toHaveLength(4096);
        expect(cartData.sfx).toHaveLength(4352);
    });
});
