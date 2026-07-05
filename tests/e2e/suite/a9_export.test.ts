import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import { FIXTURE_DIR } from '../helpers';

// A9 — Export integrity (docs/E2E_TEST_PLAN.md §5).
//
// The user-facing export (cartEditorProvider.ts exportCart / exportCartBatch ->
// exportSingleCart, 330-376 / 65-129) is driven by WEBVIEW messages, not by any
// registered command. It is therefore NOT reachable at the extension-host
// (Tier A) layer without driving the webview UI — that is Tier B territory.
//
// What export actually guarantees is byte integrity of the cart round-trip:
// exportSingleCart calls Pico8Encoder.assembleRAM(cartData, code) then
// Pico8Encoder.encodeSteg(cover, ram) to produce the .p8.png. We assert that
// exact encode path here against the real compiled encoder API, decoding the
// result back and comparing code + data sections. We reuse the fixture cart PNG
// as the steg cover (skipping only cover art generation, which carries no cart
// data), so this mirrors the on-disk output export writes.
//
// We require the compiled module from out/extension (this file runs from
// out/e2e/suite), i.e. the same API cartEditorProvider consumes at runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Pico8Encoder, Pico8Decoder } = require('../../extension/pngDecoder');

const CARTS_DIR = path.join(FIXTURE_DIR, 'fcdb', 'platforms', 'pico8', 'carts', 'bbs');

function assertBytesEqual(a: number[], b: number[], label: string): void {
    assert.strictEqual(a.length, b.length, `${label}: section length preserved`);
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            assert.fail(`${label}: byte ${i} changed (${a[i]} -> ${b[i]})`);
        }
    }
}

async function roundTrip(cartFile: string, tmpDir: string): Promise<void> {
    const cartPath = path.join(CARTS_DIR, cartFile);
    // 1. Decode the fixture cart to CartData (real decode path).
    const original = await Pico8Decoder.decode(cartPath);

    // 2. Re-encode exactly as exportSingleCart does: assembleRAM + encodeSteg.
    //    Reuse the fixture PNG itself as the cover (a valid, large-enough canvas);
    //    encodeSteg overwrites the low 2 bits of every channel with RAM bytes.
    const coverBuf = fs.readFileSync(cartPath);
    const cover = PNG.sync.read(coverBuf);
    const ram = Pico8Encoder.assembleRAM(original, original.code);
    const outBuf: Buffer = Pico8Encoder.encodeSteg(cover, ram);

    const outPath = path.join(tmpDir, cartFile.replace(/\.png$/, '.roundtrip.png'));
    fs.writeFileSync(outPath, outBuf);

    // 3. Decode the re-encoded cart and assert integrity.
    const decoded = await Pico8Decoder.decode(outPath);

    assert.strictEqual(decoded.code, original.code, `${cartFile}: code round-trips byte-exact`);
    assertBytesEqual(decoded.gfx, original.gfx, `${cartFile} gfx`);
    assertBytesEqual(decoded.map, original.map, `${cartFile} map`);
    assertBytesEqual(decoded.gfxFlags, original.gfxFlags, `${cartFile} gfxFlags`);
    assertBytesEqual(decoded.music, original.music, `${cartFile} music`);
    assertBytesEqual(decoded.sfx, original.sfx, `${cartFile} sfx`);
}

suite('A9: export integrity (encoder round-trip)', () => {
    let tmpDir: string;

    setup(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p8ide-a9-'));
    });

    teardown(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
    });

    test('A9.1 legacy cart survives assembleRAM+encodeSteg round-trip', async function () {
        this.timeout(20000);
        await roundTrip('synthetic-legacy.p8.png', tmpDir);
    });

    test('A9.2 pxa cart survives assembleRAM+encodeSteg round-trip', async function () {
        this.timeout(20000);
        await roundTrip('synthetic-pxa.p8.png', tmpDir);
    });
});
