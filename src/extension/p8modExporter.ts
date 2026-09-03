import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseOpenType, type Font, type GlyphPath, type PathCommand } from 'opentype.js';
import type { CartData, MetaData } from './cartData';
import type { Pico8Lib } from './libTypes';
import {
    assertAssetSatisfies,
    assertFrozenProvenance,
    createAssetUsageTracker,
    findManifestAssetByPath,
    satisfiesVersion,
    sortedProvenanceAssets,
    type AssetUsageTracker,
    type ExportProvenance,
} from './assetManifest';
import { cartDataToP8 } from './p8format';
import { p8ModToCartData } from './p8modFormat';
import { Pico8Encoder } from './pngDecoder';

export type P8ModExportFormat = 'p8' | 'p8.png';

export interface P8ModExportOptions {
    inputPath: string;
    outputPath?: string;
    outDir?: string;
    format: P8ModExportFormat;
    lang?: string;
    template?: string;
    templatePath?: string;
    libsDirs?: string[];
    workspaceRoot?: string;
    extensionPath?: string;
    provenancePath?: string;
    frozenProvenancePath?: string;
    writeProvenance?: boolean;
    glyphs?: Record<string, number[]>;
    i18nLuaCode?: string | null;
    localeMeta?: { title?: string; author?: string } | null;
}

export interface P8ModExportResult {
    outputs: string[];
}

export interface P8ModCodeBuildOptions {
    libsDirs?: string[];
    workspaceRoot?: string;
    includeResolver?: (code: string) => string;
}

interface LoadedLib extends Pico8Lib {
    _sourcePath: string;
}

interface ExportVariant {
    lang: string;
    outputPath: string;
    i18nLuaCode?: string | null;
    localeMeta?: { title?: string; author?: string } | null;
    glyphs?: Record<string, number[]>;
}

interface ExportMetaConstraints {
    assetPack?: string;
    libs?: Record<string, string>;
    templates?: Record<string, string>;
    fonts?: Record<string, string>;
}

interface P8ModRequirements {
    p8modtool?: string;
    features?: string[];
}

interface P8ModCompatibilityMeta {
    format?: string;
    producer?: string;
    requires?: P8ModRequirements;
}

const INCLUDE_RE = /^--#include\s+(\S+)\s*$/;
const FONT_CACHE = new Map<string, Font>();
const SUPPORTED_P8MOD_FORMAT = '1.0';
const SUPPORTED_P8MOD_FEATURES = new Set(['i18n-glyph-v1', 'asset-provenance-v1']);

export function parseP8ModExportArgs(argv: string[]): P8ModExportOptions {
    const args = [...argv];
    const inputPath = args.shift();
    if (!inputPath || inputPath === '--help' || inputPath === '-h') {
        throw new Error(usage());
    }

    const options: P8ModExportOptions = {
        inputPath,
        format: 'p8.png',
    };

    while (args.length > 0) {
        const arg = args.shift()!;
        switch (arg) {
            case '--format': {
                const value = requireValue(arg, args.shift());
                if (value !== 'p8' && value !== 'p8.png' && value !== 'p8png') {
                    throw new Error(`Invalid --format: ${value}`);
                }
                options.format = value === 'p8png' ? 'p8.png' : value;
                break;
            }
            case '--out':
                options.outputPath = requireValue(arg, args.shift());
                break;
            case '--out-dir':
                options.outDir = requireValue(arg, args.shift());
                break;
            case '--lang':
                options.lang = requireValue(arg, args.shift());
                break;
            case '--template':
                options.template = requireValue(arg, args.shift());
                break;
            case '--template-path':
                options.templatePath = requireValue(arg, args.shift());
                break;
            case '--libs-dir':
                options.libsDirs = [...(options.libsDirs || []), requireValue(arg, args.shift())];
                break;
            case '--workspace-root':
                options.workspaceRoot = requireValue(arg, args.shift());
                break;
            case '--extension-path':
                options.extensionPath = requireValue(arg, args.shift());
                break;
            case '--provenance':
                options.provenancePath = requireValue(arg, args.shift());
                break;
            case '--write-provenance':
                options.writeProvenance = true;
                break;
            case '--frozen-provenance':
                options.frozenProvenancePath = requireValue(arg, args.shift());
                break;
            default:
                throw new Error(`Unknown argument: ${arg}\n${usage()}`);
        }
    }

    if (options.outputPath && options.outDir) {
        throw new Error('Use either --out or --out-dir, not both.');
    }
    if (options.outputPath && !options.lang) {
        throw new Error('--out requires --lang because default export emits one file per declared language.');
    }
    if (options.writeProvenance && !options.lang) {
        throw new Error('--write-provenance requires --lang because default export emits one file per declared language; use --provenance for batch exports.');
    }

    return options;
}

export async function exportP8Mod(options: P8ModExportOptions): Promise<P8ModExportResult> {
    const extensionPath = resolveExtensionPath(options.extensionPath);
    const tracker = createAssetUsageTracker(extensionPath);
    const inputText = fs.readFileSync(options.inputPath, 'utf-8');
    const { cartData, metaData } = p8ModToCartData(inputText);
    validateP8ModCompatibility(metaData, extensionPath);
    const exportConstraints = getExportConstraints(metaData);
    validateAssetPackConstraint(tracker, exportConstraints.assetPack);
    const variants = await buildVariants(options, extensionPath, metaData, tracker, exportConstraints);
    const outputs: string[] = [];

    for (const variant of variants) {
        const code = buildFinalCode(cartData.code, variant, options, extensionPath, tracker, exportConstraints);
        const saveData: CartData = { ...cartData, code };
        fs.mkdirSync(path.dirname(variant.outputPath), { recursive: true });

        if (options.format === 'p8') {
            fs.writeFileSync(variant.outputPath, cartDataToP8(saveData), 'utf-8');
        } else {
            const templateSource = resolveTemplateSource(options, extensionPath, metaData, tracker, exportConstraints);
            const coverTitle = variant.localeMeta?.title || metaData?.meta.title || '';
            const coverAuthor = variant.localeMeta?.author || metaData?.meta.author || '';
            const glyphs = variant.glyphs || await collectCoverGlyphs(coverTitle + coverAuthor, extensionPath, tracker, exportConstraints);
            const coverPng = Pico8Encoder.generateCover(
                templateSource,
                cartData.label,
                coverTitle,
                coverAuthor,
                glyphs
            );
            const ram = Pico8Encoder.assembleRAM(saveData, code);
            fs.writeFileSync(variant.outputPath, Pico8Encoder.encodeSteg(coverPng, ram));
        }
        outputs.push(variant.outputPath);
    }

    const provenance = buildProvenance(options, extensionPath, tracker, outputs);
    if (options.frozenProvenancePath) {
        assertFrozenProvenance(provenance, options.frozenProvenancePath);
    }
    const provenancePath = resolveProvenancePath(options, outputs);
    if (provenancePath) {
        fs.mkdirSync(path.dirname(provenancePath), { recursive: true });
        fs.writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf-8');
    }

    return { outputs };
}

export function buildFinalCode(
    baseCode: string,
    variant: Pick<ExportVariant, 'i18nLuaCode'>,
    options: P8ModCodeBuildOptions,
    extensionPath: string,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): string {
    let code = baseCode;
    if (variant.i18nLuaCode) {
        code = `${variant.i18nLuaCode}\n${code}`;
    }
    if (options.includeResolver) {
        return options.includeResolver(code);
    }
    return resolveIncludes(code, loadLibs(extensionPath, options.libsDirs, options.workspaceRoot), tracker, constraints);
}

export function resolveIncludes(
    code: string,
    libs: Map<string, LoadedLib>,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): string {
    const errors: string[] = [];
    const requestedIds = code
        .split('\n')
        .map((line) => line.match(INCLUDE_RE)?.[1])
        .filter((id): id is string => Boolean(id));

    if (requestedIds.length === 0) {
        return code;
    }

    const resolved = topologicalResolve(requestedIds, libs, errors);
    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }

    const libBlocks: string[] = [];
    for (const id of resolved) {
        const lib = libs.get(id);
        if (!lib) {
            throw new Error(`Library not found: ${id}`);
        }
        recordLibUsage(id, lib, tracker, constraints);
        libBlocks.push(`-- [lib:${id}] --`, lib.code, `-- [/lib:${id}] --`);
    }

    const stripped = code.split('\n').filter((line) => !INCLUDE_RE.test(line));
    return `${libBlocks.join('\n')}\n${stripped.join('\n')}`;
}

export function loadLibs(extensionPath: string, libsDirs?: string[], workspaceRoot?: string): Map<string, LoadedLib> {
    const dirs = [path.join(extensionPath, 'resources', 'libs')];
    if (libsDirs) {
        dirs.push(...libsDirs);
    }
    if (workspaceRoot) {
        dirs.push(path.join(workspaceRoot, '.pico8libs'));
    }

    const libs = new Map<string, LoadedLib>();
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            continue;
        }
        for (const file of fs.readdirSync(dir)) {
            if (!file.endsWith('.json')) {
                continue;
            }
            const fullPath = path.join(dir, file);
            const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as Pico8Lib;
            if (parsed.id && parsed.code) {
                libs.set(parsed.id, { ...parsed, _sourcePath: fullPath });
            }
        }
    }
    return libs;
}

export function resolveTemplateSource(
    options: Pick<P8ModExportOptions, 'templatePath' | 'template'>,
    extensionPath: string,
    metaData: MetaData | null,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): string | Buffer {
    if (options.templatePath) {
        if (!fs.existsSync(options.templatePath)) {
            throw new Error(`Template file not found: ${options.templatePath}`);
        }
        recordTemplateUsage(options.templatePath, tracker, constraints);
        return options.templatePath;
    }

    const templateName = options.template || metaData?.meta.template || 'default';
    const embedded = metaData?.meta.templates?.find((entry) => entry.id === templateName);
    if (embedded) {
        if (embedded.mediaType !== 'image/png' || embedded.encoding !== 'base64') {
            throw new Error(`Unsupported embedded template encoding: ${templateName}`);
        }
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(embedded.data) || embedded.data.length % 4 !== 0) {
            throw new Error(`Embedded template is not valid base64: ${templateName}`);
        }
        const bytes = Buffer.from(embedded.data, 'base64');
        const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actualHash !== embedded.sha256) {
            throw new Error(`Embedded template hash mismatch: ${templateName}`);
        }
        const asset = tracker?.recordEmbeddedAsset('template', templateName, bytes);
        const range = constraints?.templates?.[templateName];
        if (asset && range) {
            assertAssetSatisfies(asset, range);
        }
        return bytes;
    }

    const templatePath = path.join(extensionPath, 'resources', 'cart_templates', `${templateName}.png`);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`);
    }
    recordTemplateUsage(templatePath, tracker, constraints, templateName);
    return templatePath;
}

export async function generateI18nLuaHeadless(
    locale: string,
    metaData: MetaData,
    extensionPath: string,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): Promise<string> {
    const i18n = metaData.i18n;
    const { uniqueChars, charList } = collectI18nChars(i18n, locale);
    let glyphHex = '';
    const glyphWidths: number[] = [];
    const fontPath = path.join(extensionPath, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf');
    recordFontUsage(fontPath, tracker, constraints);
    for (const ch of charList) {
        const { bytes, width } = await renderGlyphBytesHeadless(ch, fontPath);
        glyphWidths.push(width);
        for (const b of bytes) {
            glyphHex += (`0${b.toString(16)}`).slice(-2);
        }
    }

    let gdStr = '';
    for (let i = 0; i < glyphHex.length; i += 2) {
        gdStr += `\\x${glyphHex.slice(i, i + 2)}`;
    }

    const useSwap = charList.length > 128;
    const tdLines: string[] = [];
    if (!useSwap) {
        for (const entry of i18n.entries) {
            const text = entry.translations?.[locale] || '';
            if (!text) {
                continue;
            }
            let mapped = '';
            let width = 0;
            let uniform = true;
            for (const ch of text) {
                if (ch === '\n') {
                    mapped += '\\n';
                } else {
                    const idx = uniqueChars[ch];
                    if (idx === undefined) {
                        mapped += escapeLuaString(ch);
                        width += 4;
                        uniform = false;
                    } else {
                        mapped += `\\${128 + idx}`;
                        width += glyphWidths[idx];
                        if (glyphWidths[idx] !== 8) {
                            uniform = false;
                        }
                    }
                }
            }
            const extra = uniform ? ',f=1' : '';
            tdLines.push(` ["${escapeLuaKey(entry.key)}"]={w=${width}${extra},s="${mapped}"}`);
        }
    } else {
        for (const entry of i18n.entries) {
            const text = entry.translations?.[locale] || '';
            if (!text) {
                continue;
            }
            const indices: string[] = [];
            let width = 0;
            for (const ch of text) {
                if (ch === '\n') {
                    indices.push('32767');
                } else {
                    const idx = uniqueChars[ch];
                    if (idx === undefined) {
                        indices.push(String(-ch.charCodeAt(0)));
                        width += 4;
                    } else {
                        indices.push(String(idx));
                        width += glyphWidths[idx];
                    }
                }
            }
            tdLines.push(` ["${escapeLuaKey(entry.key)}"]={w=${width},g={${indices.join(',')}}}`);
        }
    }

    const lines: string[] = [
        '-- i18n runtime (generated by pico8ide headless)',
        `-- locale: ${locale}, ${charList.length} unique glyphs`,
    ];
    if (glyphHex.length > 0) {
        lines.push(`_gd="${gdStr}"`);
    }
    lines.push(`_gw={${glyphWidths.join(',')}}`);
    lines.push('_td={', ...tdLines.map((line) => `${line},`), '}', '');

    lines.push('function _txi()', ' poke(0x5600,4)', ' poke(0x5601,8)', ' poke(0x5602,8)');
    if (!useSwap && glyphHex.length > 0) {
        lines.push(' for i=1,#_gd do poke(0x59ff+i,ord(_gd,i)) end');
    }
    lines.push('end', '');

    if (!useSwap) {
        lines.push(
            'function tx(k,x,y,c)',
            ' local d=_td[k]',
            ' if not d then return end',
            ' if d.f then print("\\014"..d.s,x,y,c) return end',
            ' local cx=x',
            ' for i=1,#d.s do',
            '  local ch=ord(d.s,i)',
            '  if ch==10 then cx=x y+=10',
            '  else',
            '   print("\\014"..chr(ch),cx,y,c)',
            '   cx+=_gw[ch-127] or 4',
            '  end',
            ' end',
            'end',
            ''
        );
    } else {
        lines.push(
            'function tx(k,x,y,c)',
            ' local d=_td[k]',
            ' if not d then return end',
            ' local cx=x',
            ' for gi in all(d.g) do',
            '  if gi==32767 then',
            '   cx=x y+=10',
            '  elseif gi<0 then',
            '   print(chr(-gi),cx,y,c)',
            '   cx+=4',
            '  else',
            '   local o=gi*8+1',
            '   for j=0,7 do poke(0x5a00+j,ord(_gd,o+j)) end',
            '   print("\\014\\128",cx,y,c)',
            '   cx+=_gw[gi+1] or 8',
            '  end',
            ' end',
            'end',
            ''
        );
    }

    lines.push('function txw(k)', ' local d=_td[k]', ' return d and d.w or 0', 'end');
    return lines.join('\n');
}

export async function renderGlyphBytesHeadless(ch: string, fontPath: string): Promise<{ bytes: number[]; width: number }> {
    const font = loadFont(fontPath);
    return rasterizeGlyph(font, ch);
}

export function usage(): string {
    return [
        'Usage: p8modtool <cart.p8mod> [options]',
        '',
        'Options:',
        '  --format <p8|p8.png>       Output format (default: p8.png)',
        '  --out <path>               Output file for a single-language export; requires --lang',
        '  --out-dir <path>           Output directory for generated language-infix names',
        '  --lang <lang>              Export only one declared language',
        '  --template <name>          Use resources/cart_templates/<name>.png',
        '  --template-path <path>     Use an explicit cover template PNG',
        '  --libs-dir <path>          Add a directory of Pico8 IDE library JSON files',
        '  --workspace-root <path>    Add <path>/.pico8libs to library lookup',
        '  --extension-path <path>    Pico8 IDE package root (defaults from CLI location)',
        '  --provenance <path>        Write exact exporter/asset provenance JSON',
        '  --write-provenance         Write <output>.provenance.json beside a --lang single-output export',
        '  --frozen-provenance <path> Validate resolved assets against provenance JSON',
    ].join('\n');
}

async function buildVariants(
    options: P8ModExportOptions,
    extensionPath: string,
    metaData: MetaData | null,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): Promise<ExportVariant[]> {
    const baseName = path.basename(options.inputPath).replace(/\.p8mod$/i, '');
    const inputDir = path.dirname(options.inputPath);
    const outDir = options.outDir || inputDir;

    const declaredLanguages = metaData?.i18n.locales || [];
    if (declaredLanguages.length === 0) {
        throw new Error('Export requires at least one language declared in __i18n__.locales.');
    }

    const languages = options.lang ? [options.lang] : declaredLanguages;
    for (const lang of languages) {
        if (!declaredLanguages.includes(lang)) {
            throw new Error(`Language not declared in __i18n__.locales: ${lang}`);
        }
    }

    return Promise.all(languages.map(async (lang) => {
        const outputPath = options.outputPath || defaultOutputPath(outDir, baseName, lang, options.format);
        let i18nLuaCode = options.i18nLuaCode || null;
        let localeMeta = options.localeMeta || null;
        let glyphs = options.glyphs;

        i18nLuaCode = options.i18nLuaCode === undefined
            ? await generateI18nLuaHeadless(lang, metaData!, extensionPath, tracker, constraints)
            : options.i18nLuaCode;
        localeMeta = options.localeMeta === undefined
            ? getLocaleMeta(metaData!, lang)
            : options.localeMeta;

        if (!glyphs) {
            const title = localeMeta?.title || metaData?.meta.title || '';
            const author = localeMeta?.author || metaData?.meta.author || '';
            glyphs = await collectCoverGlyphs(title + author, extensionPath, tracker, constraints);
        }

        return { lang, outputPath, i18nLuaCode, localeMeta, glyphs };
    }));
}

async function collectCoverGlyphs(
    text: string,
    extensionPath: string,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): Promise<Record<string, number[]>> {
    const fontPath = path.join(extensionPath, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf');
    recordFontUsage(fontPath, tracker, constraints);
    const glyphs: Record<string, number[]> = {};
    for (const ch of text) {
        if (!glyphs[ch]) {
            glyphs[ch] = (await renderGlyphBytesHeadless(ch, fontPath)).bytes;
        }
    }
    return glyphs;
}

function defaultOutputPath(outDir: string, baseName: string, variant: string, format: P8ModExportFormat): string {
    return path.join(outDir, `${baseName}.${variant}.${format}`);
}

function getLocaleMeta(metaData: MetaData, locale: string): { title?: string; author?: string } | null {
    let title = '';
    let author = '';
    for (const entry of metaData.i18n.entries) {
        if (entry.key === '_title') {
            title = entry.translations?.[locale] || '';
        }
        if (entry.key === '_author') {
            author = entry.translations?.[locale] || '';
        }
    }
    if (!title && !author) {
        return null;
    }
    return {
        title: title || metaData.meta.title,
        author: author || metaData.meta.author,
    };
}

function topologicalResolve(ids: string[], libs: Map<string, LoadedLib>, errors: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
        if (visited.has(id)) {
            return;
        }
        if (visiting.has(id)) {
            errors.push(`Circular dependency detected: ${id}`);
            return;
        }
        const lib = libs.get(id);
        if (!lib) {
            errors.push(`Library not found: ${id}`);
            return;
        }
        visiting.add(id);
        for (const dep of lib.depends || []) {
            visit(dep);
        }
        visiting.delete(id);
        visited.add(id);
        result.push(id);
    };

    for (const id of ids) {
        visit(id);
    }
    return result;
}

function resolveExtensionPath(extensionPath?: string): string {
    return extensionPath || path.resolve(__dirname, '..', '..');
}

function requireValue(flag: string, value: string | undefined): string {
    if (!value) {
        throw new Error(`${flag} requires a value.`);
    }
    return value;
}

function validateP8ModCompatibility(metaData: MetaData | null, extensionPath: string): void {
    const meta = metaData?.meta as (MetaData['meta'] & { p8mod?: P8ModCompatibilityMeta }) | undefined;
    const p8mod = meta?.p8mod;
    if (!p8mod) {
        return;
    }
    if (p8mod.format && p8mod.format !== SUPPORTED_P8MOD_FORMAT) {
        throw new Error(`Unsupported p8mod format: ${p8mod.format}`);
    }
    const requires = p8mod.requires;
    if (!requires) {
        return;
    }
    const toolVersion = getPackageVersion(extensionPath);
    if (requires.p8modtool && !satisfiesVersion(toolVersion, requires.p8modtool)) {
        throw new Error(`This cart requires p8modtool ${requires.p8modtool}; current version is ${toolVersion}.`);
    }
    for (const feature of requires.features || []) {
        if (!SUPPORTED_P8MOD_FEATURES.has(feature)) {
            throw new Error(`Unsupported required p8mod feature: ${feature}`);
        }
    }
}

function getExportConstraints(metaData: MetaData | null): ExportMetaConstraints {
    const meta = metaData?.meta as (MetaData['meta'] & { export?: ExportMetaConstraints }) | undefined;
    return meta?.export || {};
}

function validateAssetPackConstraint(tracker: AssetUsageTracker, constraint?: string): void {
    if (!constraint) {
        return;
    }
    const atIndex = constraint.lastIndexOf('@');
    const id = atIndex >= 0 ? constraint.slice(0, atIndex) : constraint;
    const versionRange = atIndex >= 0 ? constraint.slice(atIndex + 1) : '';
    if (id && id !== tracker.manifest.assetPack.id) {
        throw new Error(`Asset pack ${tracker.manifest.assetPack.id} does not satisfy ${constraint}`);
    }
    if (versionRange && !satisfiesVersion(tracker.manifest.assetPack.version, versionRange)) {
        throw new Error(`Asset pack ${tracker.manifest.assetPack.id}@${tracker.manifest.assetPack.version} does not satisfy ${constraint}`);
    }
}

function recordLibUsage(
    id: string,
    lib: LoadedLib,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints
): void {
    if (!tracker) {
        return;
    }
    const manifestAsset = findManifestAssetByPath(tracker.manifest, relativeToPackage(lib._sourcePath));
    const asset = manifestAsset
        ? tracker.recordManifestAsset('lib', id)
        : tracker.recordExternalAsset('lib', id, lib._sourcePath, lib.version);
    const range = constraints?.libs?.[id];
    if (range) {
        assertAssetSatisfies(asset, range);
    }
}

function recordTemplateUsage(
    templatePath: string,
    tracker?: AssetUsageTracker,
    constraints?: ExportMetaConstraints,
    templateId?: string
): void {
    if (!tracker) {
        return;
    }
    const manifestAsset = findManifestAssetByPath(tracker.manifest, relativeToPackage(templatePath));
    const id = templateId || manifestAsset?.id || path.basename(templatePath).replace(/\.png$/i, '');
    const asset = manifestAsset
        ? tracker.recordManifestAsset('template', manifestAsset.id)
        : tracker.recordExternalAsset('template', id, templatePath);
    const range = constraints?.templates?.[asset.id] || constraints?.templates?.[id];
    if (range) {
        assertAssetSatisfies(asset, range);
    }
}

function recordFontUsage(fontPath: string, tracker?: AssetUsageTracker, constraints?: ExportMetaConstraints): void {
    if (!tracker) {
        return;
    }
    const manifestAsset = findManifestAssetByPath(tracker.manifest, relativeToPackage(fontPath));
    const id = manifestAsset?.id || path.basename(fontPath).replace(/\.ttf$/i, '');
    const asset = manifestAsset
        ? tracker.recordManifestAsset('font', manifestAsset.id)
        : tracker.recordExternalAsset('font', id, fontPath);
    const range = constraints?.fonts?.[asset.id] || constraints?.fonts?.[id];
    if (range) {
        assertAssetSatisfies(asset, range);
    }
}

function buildProvenance(
    options: P8ModExportOptions,
    extensionPath: string,
    tracker: AssetUsageTracker,
    outputs: string[]
): ExportProvenance {
    return {
        schemaVersion: 1,
        tool: {
            name: 'p8modtool',
            package: 'pico8ide',
            version: getPackageVersion(extensionPath),
        },
        assetPack: tracker.manifest.assetPack,
        input: path.resolve(options.inputPath),
        outputs,
        format: options.format,
        lang: options.lang,
        assets: sortedProvenanceAssets(tracker),
    };
}

function resolveProvenancePath(options: P8ModExportOptions, outputs: string[]): string | null {
    if (options.provenancePath) {
        return options.provenancePath;
    }
    if (!options.writeProvenance) {
        return null;
    }
    if (outputs.length !== 1) {
        throw new Error('--write-provenance requires a single output; use --provenance for batch exports.');
    }
    return `${outputs[0]}.provenance.json`;
}

function getPackageVersion(extensionPath: string): string {
    const packageJson = JSON.parse(fs.readFileSync(path.join(extensionPath, 'package.json'), 'utf-8')) as { version?: string };
    return packageJson.version || '0.0.0';
}

function relativeToPackage(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const marker = '/resources/';
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) {
        return `resources/${normalized.slice(index + marker.length)}`;
    }
    return normalized;
}

function collectI18nChars(metaI18n: MetaData['i18n'], locale: string): { uniqueChars: Record<string, number>; charList: string[] } {
    const uniqueChars: Record<string, number> = {};
    const charList: string[] = [];
    for (const entry of metaI18n.entries) {
        const text = entry.translations?.[locale] || '';
        for (const ch of text) {
            if (ch !== '\n' && uniqueChars[ch] === undefined) {
                uniqueChars[ch] = charList.length;
                charList.push(ch);
            }
        }
    }
    return { uniqueChars, charList };
}

function loadFont(fontPath: string): Font {
    const cached = FONT_CACHE.get(fontPath);
    if (cached) {
        return cached;
    }
    const data = fs.readFileSync(fontPath);
    const font = parseOpenType(data);
    FONT_CACHE.set(fontPath, font);
    return font;
}

function rasterizeGlyph(font: Font, ch: string): { bytes: number[]; width: number } {
    const glyph = font.charToGlyph(ch);
    const glyphPath = glyph.getPath(0, 8, 8);
    const bytes = new Array(8).fill(0);
    let maxCol = 0;
    for (let row = 0; row < 8; row++) {
        let b = 0;
        for (let col = 0; col < 8; col++) {
            if (pointInPath(col + 0.5, row + 0.5, glyphPath)) {
                b |= 1 << col;
                maxCol = Math.max(maxCol, col);
            }
        }
        bytes[row] = b;
    }
    return { bytes, width: maxCol + 2 };
}

function pointInPath(x: number, y: number, glyphPath: GlyphPath): boolean {
    const polygons = flattenPath(glyphPath.commands);
    let inside = false;
    for (const poly of polygons) {
        if (pointInPolygon(x, y, poly)) {
            inside = !inside;
        }
    }
    return inside;
}

function flattenPath(commands: PathCommand[]): Array<Array<{ x: number; y: number }>> {
    const polygons: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    let pos = { x: 0, y: 0 };
    let start = { x: 0, y: 0 };

    const pushPoint = (x: number, y: number) => {
        current.push({ x, y });
        pos = { x, y };
    };

    for (const cmd of commands) {
        if (cmd.type === 'M') {
            if (current.length > 0) {
                polygons.push(current);
            }
            current = [];
            start = { x: cmd.x || 0, y: cmd.y || 0 };
            pushPoint(start.x, start.y);
        } else if (cmd.type === 'L') {
            pushPoint(cmd.x || 0, cmd.y || 0);
        } else if (cmd.type === 'Q') {
            const p0 = pos;
            const p1 = { x: cmd.x1 || 0, y: cmd.y1 || 0 };
            const p2 = { x: cmd.x || 0, y: cmd.y || 0 };
            for (let i = 1; i <= 8; i++) {
                const t = i / 8;
                pushPoint(quad(p0.x, p1.x, p2.x, t), quad(p0.y, p1.y, p2.y, t));
            }
        } else if (cmd.type === 'C') {
            const p0 = pos;
            const p1 = { x: cmd.x1 || 0, y: cmd.y1 || 0 };
            const p2 = { x: cmd.x2 || 0, y: cmd.y2 || 0 };
            const p3 = { x: cmd.x || 0, y: cmd.y || 0 };
            for (let i = 1; i <= 12; i++) {
                const t = i / 12;
                pushPoint(cubic(p0.x, p1.x, p2.x, p3.x, t), cubic(p0.y, p1.y, p2.y, p3.y, t));
            }
        } else if (cmd.type === 'Z') {
            pushPoint(start.x, start.y);
            if (current.length > 0) {
                polygons.push(current);
                current = [];
            }
        }
    }
    if (current.length > 0) {
        polygons.push(current);
    }
    return polygons;
}

function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        if (((pi.y > y) !== (pj.y > y)) &&
            x < ((pj.x - pi.x) * (y - pi.y)) / ((pj.y - pi.y) || 1) + pi.x) {
            inside = !inside;
        }
    }
    return inside;
}

function quad(a: number, b: number, c: number, t: number): number {
    const mt = 1 - t;
    return mt * mt * a + 2 * mt * t * b + t * t * c;
}

function cubic(a: number, b: number, c: number, d: number, t: number): number {
    const mt = 1 - t;
    return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function escapeLuaKey(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeLuaString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
