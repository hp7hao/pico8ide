import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from 'pngjs';
import type { CartData, MetaData } from '../../extension/cartData';
import { cartDataToP8Mod } from '../../extension/p8modFormat';
import { p8ToCartData } from '../../extension/p8format';
import { Pico8Decoder, Pico8Encoder } from '../../extension/pngDecoder';
import {
    exportP8Mod,
    parseP8ModExportArgs,
    renderGlyphBytesHeadless,
} from '../../extension/p8modExporter';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function makeCartData(code: string): CartData {
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

function makeMetaData(template = 'default'): MetaData {
    return {
        meta: { title: 'Headless', author: 'tester', template },
        i18n: {
            locales: ['en-US', 'zh-CN'],
            outputLocale: 'zh-CN',
            entries: [
                { key: 'hello', translations: { 'en-US': 'Hello', 'zh-CN': '你好' } },
                { key: '_title', translations: { 'en-US': 'Headless', 'zh-CN': '无界面' } },
                { key: '_author', translations: { 'en-US': 'tester', 'zh-CN': '测试者' } },
            ],
        },
    };
}

function makeMetaDataWithMeta(meta: Record<string, unknown>, template = 'default'): MetaData {
    return {
        ...makeMetaData(template),
        meta: {
            ...makeMetaData(template).meta,
            ...meta,
        } as any,
    };
}

function writeFixture(tmp: string, code: string, meta: MetaData = makeMetaData()): string {
    const cart = makeCartData(code);
    const inputPath = path.join(tmp, 'game.p8mod');
    writeFileSync(inputPath, cartDataToP8Mod(cart, meta), 'utf-8');
    return inputPath;
}

function makeOversizedUncompressibleCode(): string {
    let seed = 1;
    const chars: string[] = [];
    for (let i = 0; i < 20000; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        chars.push(String.fromCharCode(65 + (seed % 26)));
    }
    return chars.join('');
}

describe('p8modtool export API', () => {
    it('exports runnable .p8 with generated i18n and resolved bundled includes', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            '--#include vec2\nfunction _init()\n _txi()\n pos=v2(1,2)\nend\nfunction _draw()\n tx("hello",0,0,7)\nend\n'
        );
        const outputPath = path.join(tmp, 'game.p8');

        const result = await exportP8Mod({
            inputPath,
            outputPath,
            format: 'p8',
            lang: 'zh-CN',
            extensionPath: PROJECT_ROOT,
        });

        expect(result.outputs).toEqual([outputPath]);
        const text = readFileSync(outputPath, 'utf-8');
        expect(text).toContain('-- i18n runtime');
        expect(text).toContain('_gd="');
        expect(text).not.toContain('_gd="\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00');
        expect(text).toContain('function tx(k,x,y,c)');
        expect(text).toContain('-- [lib:vec2] --');
        expect(text).not.toContain('--#include vec2');
        expect(text).not.toContain('__i18n__');

        const parsed = p8ToCartData(text);
        expect(parsed.code).toContain('pos=v2(1,2)');
    });

    it('exports .p8.png with the selected Pico8 IDE template and decodable code', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            'function _init()\n _txi()\nend\nfunction _draw()\n tx("hello",0,0,7)\nend\n',
            makeMetaData('cyan')
        );
        const outputPath = path.join(tmp, 'game.p8.png');

        await exportP8Mod({
            inputPath,
            outputPath,
            format: 'p8.png',
            lang: 'zh-CN',
            extensionPath: PROJECT_ROOT,
        });

        const png = PNG.sync.read(readFileSync(outputPath));
        expect(png.width).toBe(160);
        expect(png.height).toBe(205);

        const decoded = await Pico8Decoder.decode(outputPath);
        expect(decoded.code).toContain('-- i18n runtime');
        expect(decoded.code).toContain('function tx(k,x,y,c)');
    });

    it('fails clearly for missing bundled libraries', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(tmp, '--#include missing_lib\nprint("x")\n');

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'game.p8'),
                format: 'p8',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Library not found: missing_lib/);
    });

    it('fails clearly for missing templates', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(tmp, 'print("x")\n', makeMetaData('not-a-template'));

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'game.p8.png'),
                format: 'p8.png',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Template not found: not-a-template/);
    });

    it('fails when .p8mod metadata requires a newer p8modtool', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            'print("x")\n',
            makeMetaDataWithMeta({
                p8mod: {
                    format: '1.0',
                    producer: 'pico8ide@99.0.0',
                    requires: { p8modtool: '>=99.0.0' },
                },
            })
        );

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'game.p8'),
                format: 'p8',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/requires p8modtool >=99\.0\.0/);
    });

    it('fails when .p8mod metadata requires an unsupported feature', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            'print("x")\n',
            makeMetaDataWithMeta({
                p8mod: {
                    format: '1.0',
                    requires: { features: ['future-runtime-v9'] },
                },
            })
        );

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'game.p8'),
                format: 'p8',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Unsupported required p8mod feature: future-runtime-v9/);
    });

    it('fails when export metadata requires an incompatible asset version', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            '--#include vec2\nprint("x")\n',
            makeMetaDataWithMeta({
                export: {
                    libs: { vec2: '>=9.0.0' },
                },
            })
        );

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'game.p8'),
                format: 'p8',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Asset lib:vec2 version 1\.0\.0 does not satisfy >=9\.0\.0/);
    });

    it('writes provenance with exact bundled asset versions and hashes', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            '--#include vec2\nfunction _draw() print("x",0,0,7) end\n',
            makeMetaData('cyan')
        );
        const outputPath = path.join(tmp, 'game.p8.png');
        const provenancePath = path.join(tmp, 'game.provenance.json');

        await exportP8Mod({
            inputPath,
            outputPath,
            format: 'p8.png',
            lang: 'zh-CN',
            extensionPath: PROJECT_ROOT,
            provenancePath,
        } as any);

        const provenance = JSON.parse(readFileSync(provenancePath, 'utf-8'));
        expect(provenance.tool).toMatchObject({ name: 'p8modtool', package: 'pico8ide' });
        expect(provenance.assetPack).toMatchObject({ id: 'pico8ide-default' });
        expect(provenance.outputs).toEqual([outputPath]);
        expect(provenance.assets).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: 'lib', id: 'vec2', version: '1.0.0', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }),
            expect.objectContaining({ kind: 'template', id: 'cyan', version: '1.0.0', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }),
            expect.objectContaining({ kind: 'font', id: 'BoutiqueBitmap7x7_1.7', version: '1.7.0', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }),
        ]));
    });

    it('fails rather than truncating oversized .p8.png code', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const noisyCode = makeOversizedUncompressibleCode();
        expect(Pico8Encoder.compressLZSS(noisyCode)).toBeNull();
        const inputPath = writeFixture(tmp, noisyCode, makeMetaData());

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'too-large.p8.png'),
                format: 'p8.png',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Code does not fit/);
    });

    it('fails rather than wrapping compressed source length in .p8.png code', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const hugeCompressibleCode = 'a'.repeat(70000);
        const inputPath = writeFixture(tmp, hugeCompressibleCode, makeMetaData());

        await expect(
            exportP8Mod({
                inputPath,
                outputPath: path.join(tmp, 'length-wrap.p8.png'),
                format: 'p8.png',
                lang: 'zh-CN',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Code does not fit/);
    });

    it('allows oversized source code when exporting .p8 text', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const noisyCode = makeOversizedUncompressibleCode();
        const inputPath = writeFixture(tmp, noisyCode, makeMetaData());
        const outputPath = path.join(tmp, 'source-only.p8');

        await exportP8Mod({
            inputPath,
            outputPath,
            format: 'p8',
            lang: 'zh-CN',
            extensionPath: PROJECT_ROOT,
        });

        expect(readFileSync(outputPath, 'utf-8')).toContain(noisyCode.slice(0, 64));
    });

    it('exports every declared language by default with language infix names', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(
            tmp,
            'function _init()\n _txi()\nend\nfunction _draw()\n tx("hello",0,0,7)\nend\n'
        );

        const result = await exportP8Mod({
            inputPath,
            format: 'p8',
            extensionPath: PROJECT_ROOT,
        });

        expect(result.outputs.map((output) => path.basename(output))).toEqual([
            'game.en-US.p8',
            'game.zh-CN.p8',
        ]);
        expect(readFileSync(result.outputs[0], 'utf-8')).toContain('-- locale: en-US');
        expect(readFileSync(result.outputs[1], 'utf-8')).toContain('-- locale: zh-CN');
    });

    it('requires at least one declared language for default export', async () => {
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-api-'));
        const inputPath = writeFixture(tmp, 'print("x")\n', {
            meta: { title: 'Headless', author: 'tester', template: 'default' },
            i18n: { locales: [], outputLocale: '', entries: [] },
        });

        await expect(
            exportP8Mod({
                inputPath,
                format: 'p8',
                extensionPath: PROJECT_ROOT,
            })
        ).rejects.toThrow(/Export requires at least one language/);
    });

    it('parses CLI arguments for single-file export', () => {
        expect(
            parseP8ModExportArgs([
                'game.p8mod',
                '--format',
                'p8.png',
                '--out',
                'game.zh-CN.p8.png',
                '--lang',
                'zh-CN',
                '--template',
                'cyan',
                '--provenance',
                'game.provenance.json',
                '--frozen-provenance',
                'release.provenance.json',
                '--write-provenance',
            ])
        ).toMatchObject({
            inputPath: 'game.p8mod',
            outputPath: 'game.zh-CN.p8.png',
            format: 'p8.png',
            lang: 'zh-CN',
            template: 'cyan',
            provenancePath: 'game.provenance.json',
            frozenProvenancePath: 'release.provenance.json',
            writeProvenance: true,
        });
    });

    it('rejects retired locale and all-locales CLI arguments', () => {
        expect(() => parseP8ModExportArgs(['game.p8mod', '--locale', 'zh-CN'])).toThrow(/Unknown argument: --locale/);
        expect(() => parseP8ModExportArgs(['game.p8mod', '--all-locales'])).toThrow(/Unknown argument: --all-locales/);
    });

    it('rejects single-output provenance for default multi-language export', () => {
        expect(() => parseP8ModExportArgs(['game.p8mod', '--write-provenance'])).toThrow(/--write-provenance requires --lang/);
    });

    it('runs through the compiled p8modtool entrypoint after build', () => {
        const cliPath = path.join(PROJECT_ROOT, 'out', 'extension', 'p8modtool.js');
        if (!existsSync(cliPath)) {
            return;
        }
        const tmp = mkdtempSync(path.join(tmpdir(), 'p8modtool-cli-'));
        const inputPath = writeFixture(tmp, 'print("cli")\n', makeMetaData());
        const outputPath = path.join(tmp, 'cli.p8');

        const result = spawnSync(process.execPath, [
            cliPath,
            inputPath,
            '--format',
            'p8',
            '--lang',
            'en-US',
            '--out',
            outputPath,
            '--extension-path',
            PROJECT_ROOT,
        ], { encoding: 'utf-8' });

        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe(outputPath);
        expect(readFileSync(outputPath, 'utf-8')).toContain('print("cli")');
    });

    it('renders non-empty headless glyph bytes from the bundled font', async () => {
        const fontPath = path.join(PROJECT_ROOT, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf');
        const glyph = await renderGlyphBytesHeadless('A', fontPath);

        expect(glyph.bytes).toHaveLength(8);
        expect(glyph.bytes.some((byte) => byte !== 0)).toBe(true);
        expect(glyph.width).toBeGreaterThan(1);
    });
});
