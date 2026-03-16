import { describe, it, expect } from 'vitest';
import { cartDataToP8Mod, p8ModToCartData, blankP8Mod } from '../../extension/p8modFormat';
import { cartDataToP8, p8ToCartData } from '../../extension/p8format';
import type { CartData, MetaData } from '../../extension/cartData';

function makeCartData(code: string = 'print("hello")'): CartData {
    return {
        code,
        gfx: new Array(8192).fill(0),
        map: new Array(4096).fill(0),
        gfxFlags: new Array(256).fill(0),
        music: new Array(256).fill(0),
        sfx: new Array(4352).fill(0),
        label: ''
    };
}

function makeMetaData(): MetaData {
    return {
        meta: { title: 'Test Game', author: 'tester', template: 'default' },
        i18n: {
            locales: ['zh'],
            entries: [
                { key: 'hello', translations: { zh: '你好' } },
                { key: 'world', translations: { zh: '世界' } }
            ],
            outputLocale: 'zh'
        }
    };
}

describe('cartDataToP8Mod', () => {
    it('produces valid .p8 header', () => {
        const text = cartDataToP8Mod(makeCartData(), null);
        expect(text).toMatch(/^pico-8 cartridge/);
        expect(text).toContain('version 42');
    });

    it('includes __lua__ section with code', () => {
        const text = cartDataToP8Mod(makeCartData('print("test")'), null);
        expect(text).toContain('__lua__');
        expect(text).toContain('print("test")');
    });

    it('omits __meta__ and __i18n__ when metaData is null', () => {
        const text = cartDataToP8Mod(makeCartData(), null);
        expect(text).not.toContain('__meta__');
        expect(text).not.toContain('__i18n__');
    });

    it('includes __meta__ when meta has content', () => {
        const meta = makeMetaData();
        const text = cartDataToP8Mod(makeCartData(), meta);
        expect(text).toContain('__meta__');
        expect(text).toContain('"Test Game"');
        expect(text).toContain('"tester"');
    });

    it('includes __i18n__ when i18n has entries', () => {
        const meta = makeMetaData();
        const text = cartDataToP8Mod(makeCartData(), meta);
        expect(text).toContain('__i18n__');
        expect(text).toContain('"zh"');
        expect(text).toContain('你好');
    });

    it('omits __meta__ when meta fields are default', () => {
        const meta: MetaData = {
            meta: { title: '', author: '', template: 'default' },
            i18n: { locales: ['zh'], entries: [{ key: 'k', translations: { zh: 'v' } }], outputLocale: 'zh' }
        };
        const text = cartDataToP8Mod(makeCartData(), meta);
        expect(text).not.toContain('__meta__');
        expect(text).toContain('__i18n__');
    });

    it('omits __i18n__ when i18n is empty', () => {
        const meta: MetaData = {
            meta: { title: 'A', author: 'B', template: 'default' },
            i18n: { locales: [], entries: [], outputLocale: '' }
        };
        const text = cartDataToP8Mod(makeCartData(), meta);
        expect(text).toContain('__meta__');
        expect(text).not.toContain('__i18n__');
    });
});

describe('p8ModToCartData', () => {
    it('parses standard .p8 content correctly', () => {
        const original = makeCartData('print("roundtrip")');
        const text = cartDataToP8Mod(original, null);
        const { cartData, metaData } = p8ModToCartData(text);
        expect(cartData.code).toBe('print("roundtrip")');
        expect(metaData).toBeNull();
    });

    it('parses __meta__ section', () => {
        const meta = makeMetaData();
        const text = cartDataToP8Mod(makeCartData(), meta);
        const { metaData } = p8ModToCartData(text);
        expect(metaData).not.toBeNull();
        expect(metaData!.meta.title).toBe('Test Game');
        expect(metaData!.meta.author).toBe('tester');
    });

    it('parses __i18n__ section', () => {
        const meta = makeMetaData();
        const text = cartDataToP8Mod(makeCartData(), meta);
        const { metaData } = p8ModToCartData(text);
        expect(metaData).not.toBeNull();
        expect(metaData!.i18n.locales).toEqual(['zh']);
        expect(metaData!.i18n.entries).toHaveLength(2);
        expect(metaData!.i18n.entries[0].translations.zh).toBe('你好');
    });

    it('parses file with meta only (no i18n)', () => {
        const meta: MetaData = {
            meta: { title: 'Only Meta', author: 'me', template: 'cyan' },
            i18n: { locales: [], entries: [], outputLocale: '' }
        };
        const text = cartDataToP8Mod(makeCartData(), meta);
        const { metaData } = p8ModToCartData(text);
        expect(metaData).not.toBeNull();
        expect(metaData!.meta.title).toBe('Only Meta');
        expect(metaData!.meta.template).toBe('cyan');
    });

    it('parses file with i18n only (no meta)', () => {
        const meta: MetaData = {
            meta: { title: '', author: '', template: 'default' },
            i18n: { locales: ['zh'], entries: [{ key: 'k', translations: { zh: 'v' } }], outputLocale: 'zh' }
        };
        const text = cartDataToP8Mod(makeCartData(), meta);
        const { metaData } = p8ModToCartData(text);
        expect(metaData).not.toBeNull();
        expect(metaData!.i18n.entries).toHaveLength(1);
    });

    it('returns null metaData when no custom sections', () => {
        const text = cartDataToP8Mod(makeCartData(), null);
        const { metaData } = p8ModToCartData(text);
        expect(metaData).toBeNull();
    });
});

describe('round-trip', () => {
    it('preserves CartData through round-trip', () => {
        const original = makeCartData('-- test code\nprint("hello")');
        const meta = makeMetaData();
        const text = cartDataToP8Mod(original, meta);
        const { cartData } = p8ModToCartData(text);

        expect(cartData.code).toBe(original.code);
        expect(cartData.gfx).toEqual(original.gfx);
        expect(cartData.map).toEqual(original.map);
        expect(cartData.gfxFlags).toEqual(original.gfxFlags);
        expect(cartData.music).toEqual(original.music);
        expect(cartData.sfx).toEqual(original.sfx);
    });

    it('preserves MetaData through round-trip', () => {
        const meta = makeMetaData();
        const text = cartDataToP8Mod(makeCartData(), meta);
        const { metaData } = p8ModToCartData(text);

        expect(metaData!.meta).toEqual(meta.meta);
        expect(metaData!.i18n.locales).toEqual(meta.i18n.locales);
        expect(metaData!.i18n.entries).toEqual(meta.i18n.entries);
        expect(metaData!.i18n.outputLocale).toEqual(meta.i18n.outputLocale);
    });

    it('standard sections identical to p8ToCartData()', () => {
        const original = makeCartData('print("compare")');
        const p8Text = cartDataToP8(original);
        const p8ModText = cartDataToP8Mod(original, null);

        const fromP8 = p8ToCartData(p8Text);
        const { cartData: fromP8Mod } = p8ModToCartData(p8ModText);

        expect(fromP8Mod.code).toBe(fromP8.code);
        expect(fromP8Mod.gfx).toEqual(fromP8.gfx);
        expect(fromP8Mod.map).toEqual(fromP8.map);
        expect(fromP8Mod.gfxFlags).toEqual(fromP8.gfxFlags);
        expect(fromP8Mod.sfx).toEqual(fromP8.sfx);
        expect(fromP8Mod.music).toEqual(fromP8.music);
    });
});

describe('blankP8Mod', () => {
    it('produces a valid .p8mod string', () => {
        const text = blankP8Mod();
        expect(text).toMatch(/^pico-8 cartridge/);
        expect(text).toContain('__lua__');
        expect(text).toContain('__i18n__');
    });

    it('round-trips correctly', () => {
        const text = blankP8Mod();
        const { cartData, metaData } = p8ModToCartData(text);
        expect(cartData.code).toContain('_init');
        expect(metaData).not.toBeNull();
        expect(metaData!.i18n.locales).toContain('zh');
    });

    it('includes Chinese hello world demo', () => {
        const text = blankP8Mod();
        expect(text).toContain('tx("hello"');
        expect(text).toContain('\u4f60\u597d\u4e16\u754c');
    });
});
