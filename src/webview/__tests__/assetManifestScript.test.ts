import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { satisfiesVersion } from '../../extension/assetManifest';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'asset-manifest.mjs');

function createTempAssetRoot(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'pico8ide-assets-'));
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'resources', 'libs'), { recursive: true });
    mkdirSync(path.join(root, 'resources', 'cart_templates'), { recursive: true });
    mkdirSync(path.join(root, 'resources', 'fonts'), { recursive: true });
    cpSync(SCRIPT_PATH, path.join(root, 'scripts', 'asset-manifest.mjs'));
    cpSync(path.join(PROJECT_ROOT, 'resources', 'libs', 'vec2.json'), path.join(root, 'resources', 'libs', 'vec2.json'));
    cpSync(path.join(PROJECT_ROOT, 'resources', 'cart_templates', 'pico8pixelbomb.png'), path.join(root, 'resources', 'cart_templates', 'pico8pixelbomb.png'));
    cpSync(
        path.join(PROJECT_ROOT, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf'),
        path.join(root, 'resources', 'fonts', 'BoutiqueBitmap7x7_1.7.ttf')
    );
    return root;
}

function runAssetScript(root: string, args: string[]) {
    return spawnSync(process.execPath, [
        path.join(root, 'scripts', 'asset-manifest.mjs'),
        ...args,
    ], { cwd: root, encoding: 'utf-8' });
}

function readJson(root: string, relativePath: string): any {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf-8'));
}

function assetVersion(root: string, kind: string, id: string): string {
    const manifest = readJson(root, 'resources/assets.json');
    const asset = manifest.assets.find((entry: any) => entry.kind === kind && entry.id === id);
    if (!asset) {
        throw new Error(`missing asset ${kind}:${id}`);
    }
    return asset.version;
}

function assetHash(root: string, kind: string, id: string): string {
    const manifest = readJson(root, 'resources/assets.json');
    const asset = manifest.assets.find((entry: any) => entry.kind === kind && entry.id === id);
    if (!asset) {
        throw new Error(`missing asset ${kind}:${id}`);
    }
    return asset.sha256;
}

describe('asset manifest package script', () => {
    it('validates the tracked asset manifest in check mode', () => {
        const result = spawnSync(process.execPath, [
            SCRIPT_PATH,
            'check',
        ], { cwd: PROJECT_ROOT, encoding: 'utf-8' });

        expect(result.status, result.stderr || result.stdout).toBe(0);
        expect(result.stdout).toContain('Asset manifest is current.');
    });

    it('bumps template versions and keeps check mode green', () => {
        const root = createTempAssetRoot();
        expect(runAssetScript(root, ['write']).status).toBe(0);

        const bump = runAssetScript(root, ['bump', 'template', 'pico8pixelbomb', 'minor']);

        expect(bump.status, bump.stderr || bump.stdout).toBe(0);
        expect(bump.stdout).toContain('Bumped template:pico8pixelbomb to 1.1.0.');
        expect(assetVersion(root, 'template', 'pico8pixelbomb')).toBe('1.1.0');
        expect(runAssetScript(root, ['check']).status).toBe(0);
    });

    it('bumps library versions in both the source library JSON and manifest', () => {
        const root = createTempAssetRoot();
        expect(runAssetScript(root, ['write']).status).toBe(0);

        const bump = runAssetScript(root, ['bump', 'lib', 'vec2', 'patch']);

        expect(bump.status, bump.stderr || bump.stdout).toBe(0);
        expect(readJson(root, 'resources/libs/vec2.json').version).toBe('1.0.1');
        expect(assetVersion(root, 'lib', 'vec2')).toBe('1.0.1');
        expect(runAssetScript(root, ['check']).status).toBe(0);
    });

    it('supports exact version bumps for binary assets', () => {
        const root = createTempAssetRoot();
        expect(runAssetScript(root, ['write']).status).toBe(0);

        const bump = runAssetScript(root, ['bump', 'font', 'BoutiqueBitmap7x7_1.7', '2.3.4']);

        expect(bump.status, bump.stderr || bump.stdout).toBe(0);
        expect(assetVersion(root, 'font', 'BoutiqueBitmap7x7_1.7')).toBe('2.3.4');
        expect(runAssetScript(root, ['check']).status).toBe(0);
    });

    it('detects stale hashes and write refreshes them without resetting bumped versions', () => {
        const root = createTempAssetRoot();
        expect(runAssetScript(root, ['write']).status).toBe(0);
        expect(runAssetScript(root, ['bump', 'template', 'pico8pixelbomb', 'minor']).status).toBe(0);
        const oldHash = assetHash(root, 'template', 'pico8pixelbomb');
        writeFileSync(path.join(root, 'resources', 'cart_templates', 'pico8pixelbomb.png'), Buffer.from([0]), { flag: 'a' });

        const stale = runAssetScript(root, ['check']);
        expect(stale.status).not.toBe(0);
        expect(stale.stderr).toContain('resources/assets.json is stale');

        expect(runAssetScript(root, ['write']).status).toBe(0);
        expect(assetVersion(root, 'template', 'pico8pixelbomb')).toBe('1.1.0');
        expect(assetHash(root, 'template', 'pico8pixelbomb')).not.toBe(oldHash);
        expect(runAssetScript(root, ['check']).status).toBe(0);
    });

    it('rejects invalid bump requests without changing the manifest', () => {
        const root = createTempAssetRoot();
        expect(runAssetScript(root, ['write']).status).toBe(0);
        const manifestPath = path.join(root, 'resources', 'assets.json');
        const before = readFileSync(manifestPath, 'utf-8');

        const bump = runAssetScript(root, ['bump', 'template', 'pico8pixelbomb', 'banana']);

        expect(bump.status).not.toBe(0);
        expect(bump.stderr).toContain('Bump must be major, minor, patch');
        expect(readFileSync(manifestPath, 'utf-8')).toBe(before);
    });

    it('reports missing assets during bump', () => {
        const root = createTempAssetRoot();
        expect(runAssetScript(root, ['write']).status).toBe(0);

        const bump = runAssetScript(root, ['bump', 'template', 'missing', 'patch']);

        expect(bump.status).not.toBe(0);
        expect(bump.stderr).toContain('Asset not found: template:missing');
        expect(existsSync(path.join(root, 'resources', 'assets.json'))).toBe(true);
    });
});

describe('asset version range checks', () => {
    it('supports exact, caret, and comparison ranges', () => {
        expect(satisfiesVersion('1.2.3', '1.2.3')).toBe(true);
        expect(satisfiesVersion('1.2.3', '^1.2.0')).toBe(true);
        expect(satisfiesVersion('2.0.0', '^1.2.0')).toBe(false);
        expect(satisfiesVersion('1.2.3', '>=1.0.0 <2.0.0')).toBe(true);
        expect(satisfiesVersion('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
        expect(satisfiesVersion('0.2.5', '^0.2.0')).toBe(true);
        expect(satisfiesVersion('0.3.0', '^0.2.0')).toBe(false);
    });
});
