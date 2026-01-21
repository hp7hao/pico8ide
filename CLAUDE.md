# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PICO-8 IDE is a VS Code extension for browsing PICO-8 games from the Lexaloffle BBS. This extension is part of the larger fcdb ecosystem - see `../fcdbtool/CLAUDE.md` for the full data pipeline.

**Important**: This is a hobby project for learning purposes. PICO-8 is paid software by Lexaloffle Games. The extension shows a disclaimer on every activation.

## Commands

```bash
npm run compile    # Build extension to out/
npm run watch      # Watch mode for development
npm run package    # Create .vsix distribution file
```

**Debugging**: Use VS Code's "Run Extension" launch config (F5) which compiles and launches an Extension Development Host.

## Architecture

### Source Files (`src/`)

- **extension.ts** - Main entry point containing:
  - `activate()` - Extension activation, registers commands and providers
  - `showDisclaimer()` - Shows disclaimer webview on every activation
  - `Pico8GamesProvider` - TreeDataProvider for the game list sidebar
  - `GameDetailViewProvider` - WebviewViewProvider for game details panel
  - `Pico8CartPanel` - WebviewPanel for viewing cartridge contents (code, sprites, map, SFX, music)
  - `Pico8Decoder` - Decodes .p8.png cartridge files (steganography extraction, LZSS/PXA decompression)

- **dataManager.ts** - Handles data loading and caching:
  - Remote mode: Downloads db.json from GitHub releases, caches locally
  - Local mode: Loads from local fcdb repository path
  - On-demand asset downloading from Lexaloffle BBS
  - ETag-based version checking for database updates

- **i18n.ts** - Internationalization (English, Chinese)
  - `t()` function returns `LocaleStrings` based on VS Code language setting
  - Package.json uses `%key%` pattern for static strings (package.nls.json)

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

Label image is extracted from pixel area starting at offset (16, 24).

### Webview Content

Cart panel uses inline JavaScript (no external scripts) for:
- Canvas rendering of sprites and map
- SFX/Music tracker display with Web Audio API playback
- Tab navigation between Code, Sprites, Map, SFX, Music views

## Extension Settings

Defined in `package.json` under `contributes.configuration`:
- `pico8ide.dataMode`: "remote" (default) or "local"
- `pico8ide.remoteUrl`: URL to database JSON (default: GitHub releases)
- `pico8ide.localPath`: Path to local fcdb dist directory

## i18n

Two layers of localization:
1. **package.nls.json / package.nls.zh-cn.json** - Static package.json strings (command titles, descriptions)
2. **src/i18n.ts** - Runtime strings used in webview HTML and messages
