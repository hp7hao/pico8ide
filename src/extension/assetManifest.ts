import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export type AssetKind = 'lib' | 'template' | 'font';

export interface AssetManifestEntry {
    kind: AssetKind;
    id: string;
    version: string;
    path: string;
    sha256: string;
}

export interface AssetManifest {
    schemaVersion: number;
    assetPack: {
        id: string;
        version: string;
    };
    assets: AssetManifestEntry[];
}

export interface ProvenanceAsset extends AssetManifestEntry {
    source: 'bundled' | 'external' | 'embedded';
}

export interface ExportProvenance {
    schemaVersion: number;
    tool: {
        name: 'p8modtool';
        package: string;
        version: string;
    };
    assetPack: {
        id: string;
        version: string;
    };
    input: string;
    outputs: string[];
    format: string;
    lang?: string;
    assets: ProvenanceAsset[];
}

export interface AssetUsageTracker {
    manifest: AssetManifest;
    assets: Map<string, ProvenanceAsset>;
    recordManifestAsset(kind: AssetKind, id: string): ProvenanceAsset;
    recordExternalAsset(kind: AssetKind, id: string, filePath: string, version?: string): ProvenanceAsset;
    recordEmbeddedAsset(kind: AssetKind, id: string, bytes: Buffer, version?: string): ProvenanceAsset;
}

export function loadAssetManifest(extensionPath: string): AssetManifest {
    const manifestPath = path.join(extensionPath, 'resources', 'assets.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error('Asset manifest not found: resources/assets.json');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as AssetManifest;
    if (manifest.schemaVersion !== 1 || !manifest.assetPack?.id || !Array.isArray(manifest.assets)) {
        throw new Error('Invalid asset manifest: resources/assets.json');
    }
    for (const asset of manifest.assets) {
        const fullPath = path.join(extensionPath, asset.path);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Manifest asset missing: ${asset.path}`);
        }
        const actual = sha256File(fullPath);
        if (actual !== asset.sha256) {
            throw new Error(`Manifest hash mismatch for ${asset.kind}:${asset.id}`);
        }
    }
    return manifest;
}

export function createAssetUsageTracker(extensionPath: string): AssetUsageTracker {
    const manifest = loadAssetManifest(extensionPath);
    const assets = new Map<string, ProvenanceAsset>();
    return {
        manifest,
        assets,
        recordManifestAsset(kind: AssetKind, id: string): ProvenanceAsset {
            const asset = findManifestAsset(manifest, kind, id);
            if (!asset) {
                throw new Error(`Asset manifest entry not found: ${kind}:${id}`);
            }
            const provenanceAsset = { ...asset, source: 'bundled' as const };
            assets.set(assetKey(kind, id), provenanceAsset);
            return provenanceAsset;
        },
        recordExternalAsset(kind: AssetKind, id: string, filePath: string, version = '0.0.0'): ProvenanceAsset {
            const absolute = path.resolve(filePath);
            const provenanceAsset: ProvenanceAsset = {
                kind,
                id,
                version,
                path: absolute,
                sha256: sha256File(absolute),
                source: 'external',
            };
            assets.set(assetKey(kind, id), provenanceAsset);
            return provenanceAsset;
        },
        recordEmbeddedAsset(kind: AssetKind, id: string, bytes: Buffer, version = '1.0.0'): ProvenanceAsset {
            const provenanceAsset: ProvenanceAsset = {
                kind,
                id,
                version,
                path: `__meta__.templates[${id}]`,
                sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
                source: 'embedded',
            };
            assets.set(assetKey(kind, id), provenanceAsset);
            return provenanceAsset;
        },
    };
}

export function findManifestAsset(manifest: AssetManifest, kind: AssetKind, id: string): AssetManifestEntry | undefined {
    return manifest.assets.find((asset) => asset.kind === kind && asset.id === id);
}

export function findManifestAssetByPath(manifest: AssetManifest, filePath: string): AssetManifestEntry | undefined {
    const normalized = normalizeAssetPath(filePath);
    return manifest.assets.find((asset) => normalizeAssetPath(asset.path) === normalized);
}

export function assertAssetSatisfies(asset: Pick<AssetManifestEntry, 'kind' | 'id' | 'version'>, range: string): void {
    if (!satisfiesVersion(asset.version, range)) {
        throw new Error(`Asset ${asset.kind}:${asset.id} version ${asset.version} does not satisfy ${range}`);
    }
}

export function satisfiesVersion(version: string, range: string): boolean {
    const trimmed = range.trim();
    if (!trimmed || trimmed === '*') {
        return true;
    }
    if (trimmed.startsWith('^')) {
        const base = parseVersion(trimmed.slice(1));
        const current = parseVersion(version);
        if (!base || !current || compareVersions(current, base) < 0) {
            return false;
        }
        if (base.major > 0) {
            return current.major === base.major;
        }
        if (base.minor > 0) {
            return current.major === 0 && current.minor === base.minor;
        }
        return current.major === 0 && current.minor === 0 && current.patch === base.patch;
    }
    const comparisons = trimmed.split(/\s+/).filter(Boolean);
    if (comparisons.length > 1) {
        return comparisons.every((comparison) => satisfiesVersion(version, comparison));
    }
    const match = trimmed.match(/^(>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+)$/);
    if (!match) {
        return version === trimmed;
    }
    const current = parseVersion(version);
    const target = parseVersion(match[2]);
    if (!current || !target) {
        return false;
    }
    const cmp = compareVersions(current, target);
    const op = match[1] || '=';
    return op === '>=' ? cmp >= 0
        : op === '<=' ? cmp <= 0
            : op === '>' ? cmp > 0
                : op === '<' ? cmp < 0
                    : cmp === 0;
}

export function assertFrozenProvenance(current: ExportProvenance, frozenPath: string): void {
    const frozen = JSON.parse(fs.readFileSync(frozenPath, 'utf-8')) as ExportProvenance;
    const frozenAssets = new Map(frozen.assets.map((asset) => [assetKey(asset.kind, asset.id), asset]));
    for (const asset of current.assets) {
        const frozenAsset = frozenAssets.get(assetKey(asset.kind, asset.id));
        if (!frozenAsset) {
            throw new Error(`Frozen provenance missing asset: ${asset.kind}:${asset.id}`);
        }
        if (frozenAsset.version !== asset.version || frozenAsset.sha256 !== asset.sha256) {
            throw new Error(`Frozen provenance mismatch for ${asset.kind}:${asset.id}`);
        }
    }
}

export function sha256File(filePath: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function sortedProvenanceAssets(tracker: AssetUsageTracker): ProvenanceAsset[] {
    return [...tracker.assets.values()].sort((a, b) => assetKey(a.kind, a.id).localeCompare(assetKey(b.kind, b.id)));
}

function assetKey(kind: AssetKind, id: string): string {
    return `${kind}:${id}`;
}

function normalizeAssetPath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
}

function parseVersion(version: string): ParsedVersion | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        return null;
    }
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}
