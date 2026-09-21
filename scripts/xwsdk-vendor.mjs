#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(ROOT, 'vendor', 'xwsdk');
const PRODUCER_SCHEMA = 'xwsdk.release-artifacts';
const LOCK_SCHEMA = 'pico8ide.xwsdk-vendor.v1';
const LANES = new Set(['release', 'dev']);
const REQUIRED = new Map([
  ['web/p8mod/p8mod.d.ts', 'p8mod-web'],
  ['web/p8mod/p8mod.js', 'p8mod-web'],
  ['web/p8mod/p8mod_bg.wasm', 'p8mod-web'],
]);
const IGNORED = new Map([
  ['android/xwsdk-agent.aar', 'agent-android-aar'],
  ['licenses/THIRD_PARTY_LICENSES.json', 'third-party-licenses'],
  ['linux-x64/xwsdk-agent-sidecar', 'agent-sidecar-linux-x64'],
  ['win-x64/xwsdk-agent-sidecar.exe', 'agent-sidecar-win-x64'],
]);
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const REVISION = /^sha256:[0-9a-f]{64}$/;

function fail(message) { throw new Error(message); }
function laneRoot(lane) {
  if (!LANES.has(lane)) fail('XWSDK vendor lane must be release or dev');
  return path.join(VENDOR_ROOT, lane);
}
function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
function digest(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function safeRelative(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\')) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && normalized !== '..' && !normalized.startsWith('../');
}
function regularFile(file) {
  if (!existsSync(file)) return false;
  const stat = lstatSync(file);
  return stat.isFile() && !stat.isSymbolicLink();
}
function listFiles(root, prefix = '') {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(root, entry.name);
    if (entry.isSymbolicLink()) fail(`vendored XWSDK path is a symlink: ${relative}`);
    return entry.isDirectory() ? listFiles(absolute, relative) : [relative];
  }).sort();
}
function knownId(relative) {
  return REQUIRED.get(relative) || IGNORED.get(relative);
}

export function validateProducerArtifacts(producerRoot, lane) {
  laneRoot(lane);
  const manifestPath = path.join(producerRoot, 'xwsdk-release.json');
  if (!regularFile(manifestPath)) fail('XWSDK producer manifest is missing');
  if (lstatSync(producerRoot).isSymbolicLink()) fail('XWSDK producer root must not be a symlink');
  const manifest = readJson(manifestPath);
  if (manifest.schema !== PRODUCER_SCHEMA) fail(`unsupported XWSDK producer schema: ${manifest.schema}`);
  if (!SEMVER.test(manifest.version || '')) fail('XWSDK producer version is not canonical SemVer');
  if (!REVISION.test(manifest.source_revision || '')) fail('XWSDK producer source revision is invalid');
  if (!Array.isArray(manifest.artifacts)) fail('XWSDK producer artifacts must be an array');
  const records = new Map();
  const seen = new Set();
  for (const record of manifest.artifacts) {
    if (!safeRelative(record.path)) fail(`unsafe XWSDK producer artifact path: ${record.path}`);
    if (seen.has(record.path)) fail(`duplicate XWSDK producer artifact path: ${record.path}`);
    seen.add(record.path);
    if (record.profile !== lane) fail(`XWSDK producer artifact profile does not match ${lane}: ${record.path}`);
    const expectedId = knownId(record.path);
    if (!expectedId || record.id !== expectedId) fail(`unexpected XWSDK producer artifact: ${record.path}`);
    const file = path.join(producerRoot, ...record.path.split('/'));
    if (!regularFile(file)) fail(`XWSDK producer artifact is missing or not regular: ${record.path}`);
    let cursor = path.dirname(file);
    while (cursor !== producerRoot) {
      if (lstatSync(cursor).isSymbolicLink()) fail(`XWSDK producer artifact traverses a symlink: ${record.path}`);
      cursor = path.dirname(cursor);
    }
    if (!Number.isSafeInteger(record.size_bytes) || lstatSync(file).size !== record.size_bytes) {
      fail(`XWSDK producer size mismatch: ${record.path}`);
    }
    if (!SHA256.test(record.sha256 || '') || digest(file) !== record.sha256) {
      fail(`XWSDK producer digest mismatch: ${record.path}`);
    }
    if (REQUIRED.has(record.path)) {
      records.set(record.path, { ...record, source: file });
    }
  }
  for (const expected of REQUIRED.keys()) {
    if (!records.has(expected)) fail(`XWSDK producer artifact is missing: ${expected}`);
  }
  return { manifest, manifestPath, records };
}

export function validateVendor(lane, root = laneRoot(lane)) {
  laneRoot(lane);
  const lockPath = path.join(root, 'manifest.json');
  if (!regularFile(lockPath)) fail(`vendored XWSDK ${lane} lock is missing`);
  const lock = readJson(lockPath);
  if (lock.schema !== LOCK_SCHEMA) fail(`unsupported vendored XWSDK schema: ${lock.schema}`);
  if (lock.profile !== lane) fail(`vendored XWSDK lock profile does not match ${lane}`);
  if (!SEMVER.test(lock.version || '')) fail('vendored XWSDK version is not canonical SemVer');
  if (!REVISION.test(lock.source_revision || '')) fail('vendored XWSDK source revision is invalid');
  if (!SHA256.test(lock.producer_manifest_sha256 || '')) fail('vendored XWSDK producer manifest digest is invalid');
  if (!Array.isArray(lock.artifacts)) fail('vendored XWSDK artifacts must be an array');
  const versionRoot = path.join(root, lock.version);
  if (!existsSync(versionRoot) || lstatSync(versionRoot).isSymbolicLink() || !lstatSync(versionRoot).isDirectory()) {
    fail('vendored XWSDK version root is missing, symlinked, or not a directory');
  }
  const seen = new Set();
  for (const record of lock.artifacts) {
    if (!safeRelative(record.path) || !record.path.startsWith(`${lock.version}/`)) {
      fail(`unsafe vendored XWSDK path: ${record.path}`);
    }
    const artifactPath = record.path.slice(lock.version.length + 1);
    if (!REQUIRED.has(artifactPath) || REQUIRED.get(artifactPath) !== record.id) {
      fail(`unexpected vendored XWSDK artifact: ${record.path}`);
    }
    if (record.profile !== lane) fail(`vendored XWSDK artifact profile does not match ${lane}: ${record.path}`);
    if (seen.has(artifactPath)) fail(`duplicate vendored XWSDK artifact: ${record.path}`);
    const file = path.join(root, ...record.path.split('/'));
    if (!regularFile(file)) fail(`vendored XWSDK artifact is missing or not regular: ${record.path}`);
    if (!Number.isSafeInteger(record.size_bytes) || lstatSync(file).size !== record.size_bytes) {
      fail(`vendored XWSDK size mismatch: ${record.path}`);
    }
    if (!SHA256.test(record.sha256 || '') || digest(file) !== record.sha256) {
      fail(`vendored XWSDK digest mismatch: ${record.path}`);
    }
    seen.add(artifactPath);
  }
  for (const expected of REQUIRED.keys()) {
    if (!seen.has(expected)) fail(`vendored XWSDK artifact is missing: ${expected}`);
  }
  if (JSON.stringify(listFiles(versionRoot)) !== JSON.stringify([...seen].sort())) {
    fail('vendored XWSDK version directory contains unexpected files');
  }
  return { lock, versionRoot };
}

export function vendorArtifacts(lane, producerRoot) {
  const root = laneRoot(lane);
  const lockPath = path.join(root, 'manifest.json');
  const { manifest, manifestPath, records } = validateProducerArtifacts(producerRoot, lane);
  mkdirSync(root, { recursive: true });
  const stageRoot = path.join(root, `.stage-${process.pid}-${Date.now()}`);
  const stageVersion = path.join(stageRoot, manifest.version);
  mkdirSync(stageVersion, { recursive: true });
  try {
    const artifacts = [];
    for (const [relative, record] of [...records.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const target = path.join(stageVersion, ...relative.split('/'));
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(record.source, target);
      artifacts.push({
        id: record.id,
        path: `${manifest.version}/${relative}`,
        media_type: record.media_type,
        profile: lane,
        size_bytes: record.size_bytes,
        sha256: record.sha256,
      });
    }
    const lock = {
      schema: LOCK_SCHEMA,
      profile: lane,
      version: manifest.version,
      source_revision: manifest.source_revision,
      producer_manifest_sha256: digest(manifestPath),
      artifacts,
    };
    writeFileSync(path.join(stageRoot, 'manifest.json'), `${JSON.stringify(lock, null, 2)}\n`);
    validateVendor(lane, stageRoot);
    const targetVersion = path.join(root, manifest.version);
    const backup = `${targetVersion}.previous`;
    const lockBackup = `${lockPath}.previous`;
    rmSync(backup, { recursive: true, force: true });
    rmSync(lockBackup, { force: true });
    if (existsSync(targetVersion)) renameSync(targetVersion, backup);
    if (existsSync(lockPath)) renameSync(lockPath, lockBackup);
    try {
      renameSync(stageVersion, targetVersion);
      renameSync(path.join(stageRoot, 'manifest.json'), lockPath);
      validateVendor(lane);
      rmSync(backup, { recursive: true, force: true });
      rmSync(lockBackup, { force: true });
    } catch (error) {
      rmSync(targetVersion, { recursive: true, force: true });
      rmSync(lockPath, { force: true });
      if (existsSync(backup)) renameSync(backup, targetVersion);
      if (existsSync(lockBackup)) renameSync(lockBackup, lockPath);
      throw error;
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && SEMVER.test(entry.name) && entry.name !== manifest.version) {
        rmSync(path.join(root, entry.name), { recursive: true });
      }
    }
    return lock;
  } finally {
    rmSync(stageRoot, { recursive: true, force: true });
  }
}

function main(argv) {
  const [command, lane, argument] = argv;
  if (command === 'verify' && LANES.has(lane) && !argument) {
    const { lock } = validateVendor(lane);
    process.stdout.write(`XWSDK ${lock.version} ${lane} vendor lane verified\n`);
    return;
  }
  if (command === 'vendor' && LANES.has(lane) && argument && argv.length === 3) {
    const lock = vendorArtifacts(lane, path.resolve(argument));
    process.stdout.write(`Vendored XWSDK ${lock.version} into ${lane} lane\n`);
    return;
  }
  fail('usage: xwsdk-vendor.mjs verify <release|dev> | vendor <release|dev> <producer-directory>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
