#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'resources', 'assets.json');
const DEFAULT_ASSET_PACK = { id: 'pico8ide-default', version: '2026.07.0' };

function sha256(filePath) {
    return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function stableJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function existingManifest() {
    if (!existsSync(MANIFEST_PATH)) {
        return null;
    }
    return readJson(MANIFEST_PATH);
}

function existingVersion(manifest, kind, id, fallback) {
    const entry = manifest?.assets?.find((asset) => asset.kind === kind && asset.id === id);
    return entry?.version || fallback;
}

function listFiles(relativeDir, suffix) {
    const dir = path.join(ROOT, relativeDir);
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir)
        .filter((name) => name.endsWith(suffix))
        .sort()
        .map((name) => ({ name, relativePath: path.posix.join(relativeDir, name), fullPath: path.join(dir, name) }));
}

function fontVersion(name) {
    const match = name.match(/_(\d+)(?:\.(\d+))?\.ttf$/i);
    if (!match) {
        return '1.0.0';
    }
    return `${match[1]}.${match[2] || '0'}.0`;
}

function generateManifest() {
    const current = existingManifest();
    const assets = [];

    for (const file of listFiles('resources/libs', '.json')) {
        const lib = readJson(file.fullPath);
        if (!lib.id || !lib.version) {
            throw new Error(`Library asset requires id and version: ${file.relativePath}`);
        }
        assets.push({
            kind: 'lib',
            id: lib.id,
            version: lib.version,
            path: file.relativePath,
            sha256: sha256(file.fullPath),
        });
    }

    for (const file of listFiles('resources/cart_templates', '.png')) {
        const id = path.basename(file.name, '.png');
        assets.push({
            kind: 'template',
            id,
            version: existingVersion(current, 'template', id, '1.0.0'),
            path: file.relativePath,
            sha256: sha256(file.fullPath),
        });
    }

    for (const file of listFiles('resources/fonts', '.ttf')) {
        const id = path.basename(file.name, '.ttf');
        assets.push({
            kind: 'font',
            id,
            version: existingVersion(current, 'font', id, fontVersion(file.name)),
            path: file.relativePath,
            sha256: sha256(file.fullPath),
        });
    }

    assets.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
    return {
        schemaVersion: 1,
        assetPack: current?.assetPack || DEFAULT_ASSET_PACK,
        assets,
    };
}

function writeManifest(manifest) {
    writeFileSync(MANIFEST_PATH, stableJson(manifest), 'utf-8');
}

function writeJson(filePath, value) {
    writeFileSync(filePath, stableJson(value), 'utf-8');
}

function checkManifest() {
    const expected = stableJson(generateManifest());
    if (!existsSync(MANIFEST_PATH)) {
        throw new Error('resources/assets.json is missing. Run npm run assets:manifest.');
    }
    const actual = readFileSync(MANIFEST_PATH, 'utf-8');
    if (actual !== expected) {
        throw new Error('resources/assets.json is stale. Run npm run assets:manifest.');
    }
    process.stdout.write('Asset manifest is current.\n');
}

function bumpVersion(version, bump) {
    if (/^\d+\.\d+\.\d+$/.test(bump)) {
        return bump;
    }
    const parts = version.split('.').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
        throw new Error(`Cannot bump invalid version: ${version}`);
    }
    if (bump === 'major') {
        return `${parts[0] + 1}.0.0`;
    }
    if (bump === 'minor') {
        return `${parts[0]}.${parts[1] + 1}.0`;
    }
    if (bump === 'patch') {
        return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
    throw new Error('Bump must be major, minor, patch, or an exact x.y.z version.');
}

function bumpAsset(kind, id, bump) {
    const manifest = generateManifest();
    const asset = manifest.assets.find((entry) => entry.kind === kind && entry.id === id);
    if (!asset) {
        throw new Error(`Asset not found: ${kind}:${id}`);
    }
    const nextVersion = bumpVersion(asset.version, bump);
    if (kind === 'lib') {
        const libPath = path.join(ROOT, asset.path);
        const lib = readJson(libPath);
        lib.version = nextVersion;
        writeJson(libPath, lib);
        const refreshed = generateManifest();
        writeManifest(refreshed);
    } else {
        asset.version = nextVersion;
        writeManifest(manifest);
    }
    process.stdout.write(`Bumped ${kind}:${id} to ${nextVersion}.\n`);
}

function main() {
    const [command, kind, id, bump] = process.argv.slice(2);
    if (command === 'write') {
        writeManifest(generateManifest());
        process.stdout.write('Asset manifest written.\n');
        return;
    }
    if (command === 'check') {
        checkManifest();
        return;
    }
    if (command === 'bump') {
        if (!kind || !id || !bump) {
            throw new Error('Usage: node scripts/asset-manifest.mjs bump <kind> <id> <major|minor|patch|x.y.z>');
        }
        bumpAsset(kind, id, bump);
        return;
    }
    throw new Error('Usage: node scripts/asset-manifest.mjs <write|check|bump>');
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}
