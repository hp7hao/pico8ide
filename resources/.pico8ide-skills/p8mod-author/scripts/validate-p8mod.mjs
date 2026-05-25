#!/usr/bin/env node
// Validate Pico-8 IDE .p8mod structure.
// Usage: node .codex/skills/p8mod-author/scripts/validate-p8mod.mjs path/to/game.p8mod

import fs from 'node:fs';

const HEADER = 'pico-8 cartridge // http://www.pico-8.com';
const STANDARD_SECTIONS = ['lua', 'gfx', 'gff', 'map', 'sfx', 'music'];
const CUSTOM_SECTIONS = ['meta', 'i18n'];
const SECTION_RE = /^__(\w+)__$/;

function usage() {
  console.log('Usage: node .codex/skills/p8mod-author/scripts/validate-p8mod.mjs path/to/game.p8mod');
}

function parseSections(lines) {
  const sections = new Map();
  const order = [];
  const duplicates = [];
  let current = null;

  lines.forEach((line, index) => {
    const match = line.match(SECTION_RE);
    if (match) {
      current = match[1];
      if (sections.has(current)) duplicates.push(current);
      sections.set(current, []);
      order.push([current, index + 1]);
    } else if (current) {
      sections.get(current).push(line);
    }
  });

  return { sections, order, duplicates };
}

function parseJsonSection(name, lines, errors) {
  const body = lines.join('\n').trim();
  if (!body) {
    errors.push(`ERROR: __${name}__ section is empty`);
    return null;
  }
  try {
    const parsed = JSON.parse(body);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      errors.push(`ERROR: __${name}__ must be a JSON object`);
      return null;
    }
    return parsed;
  } catch (error) {
    errors.push(`ERROR: __${name}__ invalid JSON: ${error.message}`);
    return null;
  }
}

function validateMeta(meta, errors) {
  if (!meta) return;
  for (const key of ['title', 'author', 'template']) {
    if (key in meta && typeof meta[key] !== 'string') {
      errors.push(`ERROR: __meta__.${key} must be a string`);
    }
  }
}

function validateI18n(i18n, luaBody, errors, warnings) {
  if (!i18n) return;
  let locales = i18n.locales;
  let entries = i18n.entries;
  const outputLocale = i18n.outputLocale ?? '';

  if (!Array.isArray(locales) || !locales.every((loc) => typeof loc === 'string' && loc.length > 0)) {
    errors.push('ERROR: __i18n__.locales must be an array of non-empty strings');
    locales = [];
  }
  if (!Array.isArray(entries)) {
    errors.push('ERROR: __i18n__.entries must be an array');
    entries = [];
  }
  if (typeof outputLocale !== 'string') {
    errors.push('ERROR: __i18n__.outputLocale must be a string');
  } else if (outputLocale && !locales.includes(outputLocale)) {
    errors.push(`ERROR: __i18n__.outputLocale "${outputLocale}" is not in locales`);
  }

  const seenKeys = new Set();
  entries.forEach((entry, index) => {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') {
      errors.push(`ERROR: __i18n__.entries[${index}] must be an object`);
      return;
    }
    const key = entry.key;
    const translations = entry.translations;
    if (typeof key !== 'string' || !key) {
      errors.push(`ERROR: __i18n__.entries[${index}].key must be a non-empty string`);
      return;
    }
    if (seenKeys.has(key)) errors.push(`ERROR: duplicate i18n key "${key}"`);
    seenKeys.add(key);
    if (!translations || Array.isArray(translations) || typeof translations !== 'object') {
      errors.push(`ERROR: entry "${key}" translations must be an object`);
      return;
    }
    for (const loc of locales) {
      if (typeof translations[loc] !== 'string') {
        errors.push(`ERROR: entry "${key}" missing string translation for locale "${loc}"`);
      }
    }
  });

  const txKeys = new Set([...luaBody.matchAll(/tx\(\s*["']([^"']+)["']/g)].map((m) => m[1]));
  for (const key of [...txKeys].sort()) {
    if (!seenKeys.has(key)) errors.push(`ERROR: Lua calls tx("${key}") but __i18n__ has no matching entry`);
  }
  for (const key of [...seenKeys].sort()) {
    if (!txKeys.has(key)) warnings.push(`WARNING: __i18n__ entry "${key}" is not referenced by tx() in __lua__`);
  }
  if (txKeys.size > 0 && !luaBody.includes('_txi()')) {
    warnings.push('WARNING: Lua uses tx() but _txi() was not found');
  }
}

function validateHexLines(sectionName, lines, expectedCount, expectedPattern, errors) {
  if (expectedCount !== null && lines.length !== expectedCount) {
    errors.push(`ERROR: __${sectionName}__ must contain ${expectedCount} lines, found ${lines.length}`);
  }
  lines.some((line, index) => {
    if (!expectedPattern.test(line)) {
      errors.push(`ERROR: __${sectionName}__ line ${index + 1} has invalid format`);
      return true;
    }
    return false;
  });
}

function validate(path) {
  const errors = [];
  const warnings = [];
  let text;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (error) {
    console.log(`ERROR: cannot read ${path}: ${error.message}`);
    return 1;
  }

  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines[0] !== HEADER) errors.push(`ERROR: first line must be exactly: ${HEADER}`);
  if (lines[1] !== 'version 42') errors.push('ERROR: second line must be exactly: version 42');
  if (text && !text.endsWith('\n')) warnings.push('WARNING: file should end with a trailing newline');

  const { sections, order, duplicates } = parseSections(lines);
  for (const duplicate of duplicates) errors.push(`ERROR: duplicate section __${duplicate}__`);
  for (const section of STANDARD_SECTIONS) {
    if (!sections.has(section)) errors.push(`ERROR: missing required section __${section}__`);
  }

  const known = new Set([...STANDARD_SECTIONS, ...CUSTOM_SECTIONS]);
  for (const [section, lineNo] of order) {
    if (!known.has(section)) warnings.push(`WARNING: unknown section __${section}__ at line ${lineNo}`);
  }

  const sectionNames = order.map(([name]) => name);
  const actualStandard = sectionNames.filter((name) => STANDARD_SECTIONS.includes(name));
  const expectedStandard = STANDARD_SECTIONS.filter((name) => sections.has(name));
  if (actualStandard.join('|') !== expectedStandard.join('|')) {
    errors.push(`ERROR: standard sections must appear in order: ${STANDARD_SECTIONS.map((s) => `__${s}__`).join(', ')}`);
  }
  const firstCustom = sectionNames.findIndex((name) => CUSTOM_SECTIONS.includes(name));
  if (firstCustom !== -1 && sectionNames.slice(firstCustom + 1).some((name) => STANDARD_SECTIONS.includes(name))) {
    errors.push('ERROR: custom sections must appear after all standard sections');
  }

  validateHexLines('gfx', sections.get('gfx') ?? [], 128, /^[0-9a-f]{128}$/, errors);
  validateHexLines('gff', sections.get('gff') ?? [], 2, /^[0-9a-f]{256}$/, errors);

  const mapLines = sections.get('map') ?? [];
  if (mapLines.length > 32) errors.push('ERROR: __map__ must not contain more than 32 lines');
  validateHexLines('map', mapLines, null, /^[0-9a-f]{256}$/, errors);

  const sfxLines = sections.get('sfx') ?? [];
  if (sfxLines.length > 64) errors.push('ERROR: __sfx__ must not contain more than 64 lines');
  validateHexLines('sfx', sfxLines, null, /^[0-9a-f]{168}$/, errors);

  const musicLines = sections.get('music') ?? [];
  if (musicLines.length > 64) errors.push('ERROR: __music__ must not contain more than 64 lines');
  validateHexLines('music', musicLines, null, /^[0-9a-f]{2} [0-9a-f]{8}$/, errors);

  if (sections.has('meta')) validateMeta(parseJsonSection('meta', sections.get('meta'), errors), errors);
  if (sections.has('i18n')) {
    validateI18n(parseJsonSection('i18n', sections.get('i18n'), errors), (sections.get('lua') ?? []).join('\n'), errors, warnings);
  }

  for (const message of warnings) console.log(message);
  for (const message of errors) console.log(message);
  if (errors.length > 0) {
    console.log(`FAILED: ${path} has ${errors.length} error(s)`);
    return 1;
  }
  console.log(`OK: ${path} is a structurally valid .p8mod file`);
  return 0;
}

if (process.argv.length !== 3) {
  usage();
  process.exit(2);
}

if (!fs.existsSync(process.argv[2]) || !fs.statSync(process.argv[2]).isFile()) {
  console.log(`ERROR: file not found: ${process.argv[2]}`);
  process.exit(1);
}

process.exit(validate(process.argv[2]));
