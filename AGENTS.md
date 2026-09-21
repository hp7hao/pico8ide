# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Overview

PICO-8 IDE is a VS Code extension for browsing PICO-8 games from the Lexaloffle BBS. This extension is part of the larger fcdb ecosystem - see `../fcdbtool/AGENTS.md` for the full data pipeline.

Durable product authority lives in `projects/pico8ide/docs/specs/`. Cart format
and the editing kernel are owned by `projects/xwsdk/docs/specs/p8mod_spec.md`.
The TypeScript parser/exporter in this tree is a PC-authoring adapter, not a
second format owner.

**Important**: This is a hobby project for learning purposes. PICO-8 is paid software by Lexaloffle Games. The extension shows a disclaimer on every activation.

## Commands

```bash
npm run compile     # Build extension to out/
npm run watch       # Watch mode for development
npm run package     # Create .vsix distribution file
npm test            # vitest suite (webview unit + Tier C decoder golden)
npm run test:e2e    # Tier A extension-host E2E in a real VS Code
npm run test:webview # Tier B webview E2E in headless Chromium (Playwright)
```

**Debugging**: Use VS Code's "Run Extension" launch config (F5) which compiles and launches an Extension Development Host.

## Testing

Test tiers and their design are documented in `docs/E2E_TEST_PLAN.md`:

- **Tier C (decoder/format golden)** and the webview unit/component tests run
  under vitest (`npm test`, jsdom). Tier C decodes generated synthetic `.p8.png`
  fixtures under `tests/e2e/fixtures/carts/` and asserts against committed `golden.json`. This
  is the CI gate (`.github/workflows/test.yml` → `test` job).
- **Tier A (extension-host E2E)** uses `@vscode/test-electron`/`@vscode/test-cli`
  (`npm run test:e2e`, Mocha TDD interface). Suites live under
  `tests/e2e/suite/`, compiled to `out/e2e/` via `tests/e2e/tsconfig.json` and
  run by `.vscode-test.mjs`. Tests are hermetic: local `dataMode` + a fixture
  FCDB dir (no network) and a fake PICO-8 stub (`tests/e2e/fixtures/fake-pico8.sh`)
  for run/stop. CI runs this under `xvfb-run` (`e2e` job).
- **Tier B (webview E2E)** uses Playwright against the standalone webview build
  (`npm run test:webview`). Specs live under `tests/e2e-webview/specs/`; a
  fixed-port esbuild server (`tests/e2e-webview/server.mjs`, referenced by
  `playwright.config.ts`) serves the `dev:standalone` bundle with mock init data.
  Tests assert tab/panel rendering and the `standaloneBridge` message contract.
  CI runs this via `playwright install --with-deps chromium` (`webview-e2e` job).

## Architecture

### Source Files (`src/`)

- **extension.ts** - Main entry point containing:
  - `activate()` - Extension activation, registers commands and providers
  - `showDisclaimer()` - Shows disclaimer webview on every activation
  - `Pico8GamesProvider` - TreeDataProvider for the game list sidebar
  - `GameDetailViewProvider` - WebviewViewProvider for game details panel
  - `Pico8CartPanel` - WebviewPanel for viewing cartridge contents (code, sprites, map, SFX, music)
  - `Pico8Decoder` in `src/extension/pngDecoder.ts` - Decodes .p8.png cartridge files (steganography extraction, LZSS/PXA decompression)

- **dataManager.ts** - Handles data loading and caching:
  - Remote mode: Downloads db.json from GitHub releases, caches locally
  - Local mode: Loads from local fcdb repository path
  - On-demand asset downloading from Lexaloffle BBS
  - Resolves optional FCDB editable source artifacts from `sources/{source}/` for database forks, preferring `.p8mod`, then `.p8`, before runtime carts
  - ETag-based version checking for database updates

- **i18n.ts** - Internationalization (English, Chinese)
  - `t()` function returns `LocaleStrings` based on VS Code language setting
  - Package.json uses `%key%` pattern for static strings (package.nls.json)

- **libManager.ts / resources/libs/** - Opt-in shared Lua libraries for `--#include <id>` directives. Bundled `p8go` is the PICO8GO device bridge runtime helper library; keep it transport-aligned with `projects/xwsdk/p8mod/src/p8go_runtime.lua`.

### PICO-8 Cartridge Format

Cartridges are .p8.png files with data hidden in pixel LSBs:

```
RAM Layout (0x8000 bytes extracted from steganography):
0x0000-0x1FFF: GFX (sprite sheet, 128x128 pixels, 4 bits/pixel)
0x2000-0x2FFF: MAP (upper 32 rows; lower 32 share with GFX)
0x3000-0x30FF: GFX Flags
0x3100-0x31FF: Music (64 patterns × 4 bytes)
0x3200-0x42FF: SFX (64 slots × 68 bytes)
0x4300+: Code (compressed or raw)
```

Code compression formats:
- `:c:\0` header → Legacy LZSS compression
- `\0pxa` header → PXA compression (MTF + LZ77, LSB-first bitstream)
- No header → Raw ASCII

The old text-document content-provider decoder lane and root-level compiled
`src/*.js` first-commit artifacts have been removed. Do not restore
`src/extension/decoder.ts`, `src/extension/contentProvider.ts`, or tracked
root-level `src/*.js` files; `.p8`, `.p8mod`, and `.p8.png` entry points must
route through the custom editor and `pngDecoder.ts` path. Build output belongs
under ignored `out/`.

Label image is extracted from pixel area starting at offset (16, 24).

### Webview Content

Cart panel uses inline JavaScript (no external scripts) for:
- Canvas rendering of sprites and map
- SFX/Music tracker display with Web Audio API playback
- Tab navigation between Code, Sprites, Map, SFX, Music views

## FCDB Compatibility

Pico8IDE owns its exact supported FCDB schema declaration and package-ingestion
tests. Before changing that declaration, run a producer-generated candidate ZIP
through the complete DataManager suite: manifest and exact-version rejection,
record/list/locale parsing, declared carts/sources/thumbnails, unsafe or missing
members, staging and atomic replacement, last-working-cache rollback, and the
extension-host fixture flow. FCDB producer tests or a producer-owned readiness
registry are not consumer compatibility evidence.

Current implementation still consumes the legacy FCDB record/list shape and
must not be treated as schema `0.5.0` compatible until that suite and migration
are implemented.

## Extension Settings

Defined in `package.json` under `contributes.configuration`:
- `pico8ide.dataMode`: "remote" (default) or "local"
- `pico8ide.remoteUrl`: URL to database JSON (default: GitHub releases)
- `pico8ide.localPath`: Path to local fcdb dist directory

## i18n

Two layers of localization:
1. **package.nls.json / package.nls.zh-cn.json** - Static package.json strings (command titles, descriptions)
2. **src/i18n.ts** - Runtime strings used in webview HTML and messages
