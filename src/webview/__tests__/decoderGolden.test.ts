import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import { Pico8Decoder, Pico8Encoder } from '../../extension/pngDecoder';
import { cartDataToP8, p8ToCartData } from '../../extension/p8format';
import { cartDataToP8Mod, p8ModToCartData } from '../../extension/p8modFormat';
import type { CartData, MetaData } from '../../extension/cartData';

// Tier C: decoder + format golden tests (see docs/E2E_TEST_PLAN.md §7).
// Generated synthetic .p8.png carts under tests/e2e/fixtures/ exercise the two
// compression paths that matter: legacy `:c:` LZSS and `\0pxa`. Golden values
// were generated from these exact fixtures; a decoder regression that changes
// extracted bytes fails here.

const FIXTURE_DIR = path.resolve(__dirname, '../../../tests/e2e/fixtures');
const CART_DIR = path.join(FIXTURE_DIR, 'carts');
const golden: Record<string, any> = JSON.parse(
    readFileSync(path.join(FIXTURE_DIR, 'golden.json'), 'utf-8')
);

const sha256 = (data: string | number[]): string =>
    createHash('sha256')
        .update(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data))
        .digest('hex');

describe('Tier C: decoder golden (synthetic carts)', () => {
    for (const [file, g] of Object.entries(golden)) {
        describe(`${file} (${g.format})`, () => {
            let cart: CartData;

            it('decodes without throwing', async () => {
                cart = await Pico8Decoder.decode(path.join(CART_DIR, file));
                expect(cart).toBeTruthy();
            });

            it('section lengths are exact', () => {
                expect(cart.gfx.length).toBe(g.sectionLens.gfx);
                expect(cart.map.length).toBe(g.sectionLens.map);
                expect(cart.gfxFlags.length).toBe(g.sectionLens.gfxFlags);
                expect(cart.music.length).toBe(g.sectionLens.music);
                expect(cart.sfx.length).toBe(g.sectionLens.sfx);
            });

            it('code matches golden', () => {
                expect(cart.code.length).toBe(g.codeLen);
                expect(sha256(cart.code)).toBe(g.codeSha256);
            });

            it('sections match golden hashes', () => {
                expect(sha256(cart.gfx)).toBe(g.gfxSha256);
                expect(sha256(cart.map)).toBe(g.mapSha256);
                expect(sha256(cart.gfxFlags)).toBe(g.gfxFlagsSha256);
                expect(sha256(cart.music)).toBe(g.musicSha256);
                expect(sha256(cart.sfx)).toBe(g.sfxSha256);
            });

            it('label is a PNG data URL', () => {
                expect(cart.label.startsWith('data:image/png;base64,')).toBe(true);
                expect(cart.label.length).toBe(g.labelLen);
            });
        });
    }
});

describe('Tier C: encode → decode round-trip', () => {
    it('assembleRAM + encodeSteg + decode preserves code and sections', async () => {
        // Take a synthetic cart, re-assemble RAM, steganographically encode it into a
        // fresh cover PNG, write to disk, and decode back through the real path
        // API. This is the export path's integrity guarantee (mirrors A9.1/C6).
        const file = Object.keys(golden)[0];
        const original = await Pico8Decoder.decode(path.join(CART_DIR, file));

        const ram = Pico8Encoder.assembleRAM(original, original.code);
        // encodeSteg needs a PNG object as the cover carrier; use the fixture PNG.
        const coverPng = PNG.sync.read(readFileSync(path.join(CART_DIR, file)));
        const encoded = Pico8Encoder.encodeSteg(coverPng, ram);

        const tmp = path.join(mkdtempSync(path.join(tmpdir(), 'p8ide-')), 'rt.p8.png');
        writeFileSync(tmp, encoded);
        const roundTripped = await Pico8Decoder.decode(tmp);

        expect(roundTripped.code).toBe(original.code);
        expect(roundTripped.gfx).toEqual(original.gfx);
        expect(roundTripped.map).toEqual(original.map);
        expect(roundTripped.gfxFlags).toEqual(original.gfxFlags);
        expect(roundTripped.sfx).toEqual(original.sfx);
        expect(roundTripped.music).toEqual(original.music);
    });
});

function blankCart(code: string): CartData {
    return {
        code,
        gfx: new Array(8192).fill(0),
        map: new Array(4096).fill(0),
        gfxFlags: new Array(256).fill(0),
        music: new Array(256).fill(0),
        sfx: new Array(4352).fill(0),
        label: '',
    };
}

describe('Tier C: .p8 format round-trip', () => {
    it('cartDataToP8 → p8ToCartData preserves code and sections', () => {
        const cart = blankCart('print("hi")\nfor i=1,10 do spr(i,i*8,0) end');
        cart.gfx[0] = 7;
        cart.gfx[1] = 12;
        cart.map[10] = 3;
        cart.gfxFlags[5] = 0b10101010;
        cart.sfx[68] = 42;
        cart.music[4] = 9;

        const text = cartDataToP8(cart);
        const back = p8ToCartData(text);

        expect(back.code).toBe(cart.code);
        expect(back.gfx).toEqual(cart.gfx);
        expect(back.map).toEqual(cart.map);
        expect(back.gfxFlags).toEqual(cart.gfxFlags);
        expect(back.sfx).toEqual(cart.sfx);
        expect(back.music).toEqual(cart.music);
    });
});

describe('Tier C: .p8mod format round-trip with metadata', () => {
    it('cartDataToP8Mod → p8ModToCartData preserves meta + i18n', () => {
        const cart = blankCart('print(tx("greet"))');
        const meta: MetaData = {
            meta: { title: 'Golden', author: 'tester', template: 'cyan' },
            i18n: {
                locales: ['en', 'zh_CN'],
                entries: [
                    { key: 'greet', translations: { en: 'Hello', zh_CN: '你好' } },
                ],
                outputLocale: 'zh_CN',
            },
        };

        const text = cartDataToP8Mod(cart, meta);
        const { cartData, metaData } = p8ModToCartData(text);

        expect(cartData.code).toBe(cart.code);
        expect(metaData?.meta.title).toBe('Golden');
        expect(metaData?.meta.author).toBe('tester');
        expect(metaData?.meta.template).toBe('cyan');
        expect(metaData?.i18n.outputLocale).toBe('zh_CN');
        expect(metaData?.i18n.entries[0].translations.zh_CN).toBe('你好');
    });
});
