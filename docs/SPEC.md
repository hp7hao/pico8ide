# PICO-8 IDE Extension — Specification

> Version 0.1.0 — 2026-02-12

## 1. Overview

PICO-8 IDE is a VS Code extension for browsing, viewing, editing, and running PICO-8 fantasy console games. It downloads game metadata from a remote database (or reads from a local FCDB distribution), displays games in a sidebar tree view, and provides a webview-based cartridge viewer with an integrated Monaco editor for inspecting and editing code, sprites, maps, SFX, and music.

## 2. Configuration Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `pico8ide.dataMode` | `"remote" \| "local"` | `"remote"` | Source of game data |
| `pico8ide.remoteUrl` | `string` | GitHub release URL | URL to master database ZIP |
| `pico8ide.localPath` | `string` | `""` | Absolute path to local FCDB dist directory |
| `pico8ide.language` | `"" \| "en_US" \| "zh_CN"` | `""` | Display language override (empty = auto) |
| `pico8ide.pico8Path` | `string` | `""` | Absolute path to PICO-8 executable |

## 3. Commands

| Command ID | Title (EN) | Icon | Description |
|------------|-----------|------|-------------|
| `pico8ide.search` | Search | search.svg | Filter games by name or author |
| `pico8ide.refreshEntry` | Refresh | refresh.svg | Reload game database |
| `pico8ide.openCart` | Open Cartridge | — | Open cart viewer for a game |
| `pico8ide.selectGame` | *(internal)* | — | Select a game from the tree; opens cart viewer |
| `pico8ide.setPico8Path` | Set PICO-8 Path | — | Browse for PICO-8 executable; saves to global config |
| `pico8ide.runGame` | Run in PICO-8 | play.svg | Launch current game in local PICO-8 |
| `pico8ide.stopGame` | Stop PICO-8 | stop.svg | Kill the running PICO-8 process |
| `pico8ide.forkGame` | Fork Game | fork.svg | Copy a database game's cart into the workspace |
| `pico8ide.previewP8Cart` | Preview PICO-8 Cart | — | Open a `.p8` file in the cart viewer (context menu on `.p8` files in explorer) |

## 4. Keybindings

| Key | Command | When |
|-----|---------|------|
| `Ctrl+R` (`Cmd+R` on macOS) | `pico8ide.runGame` | `activeWebviewPanelId == pico8Cart \|\| resourceExtname == .p8` |

## 5. Menus

### `view/title` (pico8Lists)
- `pico8ide.search` — navigation group
- `pico8ide.refreshEntry` — navigation group

### `view/item/context` (pico8Lists, inline)
- `pico8ide.runGame` — when `viewItem == gameItem`
- `pico8ide.forkGame` — when `viewItem == gameItem`

### `explorer/context`
- `pico8ide.previewP8Cart` — when `resourceExtname == .p8`, navigation group

## 6. Tree View Behavior

### Game Selection (single click)
- Updates the detail sidebar webview with game metadata and thumbnail.
- Opens (or reuses) a **preview** cart viewer panel.

### Game Double-Click
- Detected by a second click on the same game item within 300 ms.
- **Pins** the current preview panel (promotes it to a persistent tab).

### Panel Activation Sync
- When a cart viewer panel tab becomes active (user clicks on a tab), the extension automatically updates `currentSelectedGame` and the detail sidebar to show that game's metadata.

### Tree Item Context
- `ListGameItem` sets `contextValue = 'gameItem'` so inline menu items can target game entries.

## 7. Cart Viewer Webview

### Architecture

The webview is a React single-page application bundled by esbuild. The extension host generates a minimal HTML shell that loads the bundled JS/CSS and passes initial data via a `<script>` tag setting `window.__INIT_DATA__`.

#### Source Layout

```
src/
├── extension/                    # Extension host code (Node.js, CommonJS)
│   ├── extension.ts
│   ├── cartEditorProvider.ts
│   ├── cartData.ts
│   ├── pngDecoder.ts
│   ├── p8format.ts
│   ├── i18n.ts
│   ├── dataManager.ts
│   ├── treeProvider.ts
│   ├── pico8Runner.ts
│   └── decoder.ts
└── webview/                      # React webview app (esbuild, ES2020)
    ├── index.tsx                  # Entry point: renders <App /> into #root
    ├── App.tsx                    # Root: reads __INIT_DATA__, provides stores, renders TabContainer
    ├── vscodeApi.ts               # Singleton acquireVsCodeApi() wrapper
    ├── types.ts                   # Shared types (CartData, LocaleStrings, etc.)
    ├── store/
    │   ├── cartStore.ts           # zustand: GFX, MAP, FLAGS, SFX, MUSIC, CODE
    │   ├── uiStore.ts             # zustand: activeTab, tool, zoom, pan, selection
    │   ├── metaStore.ts           # zustand: MetaData, i18n entries
    │   └── undoStore.ts           # zustand: per-editor undo/redo stacks
    ├── components/
    │   ├── TabBar.tsx             # Tab header with tab switching
    │   ├── TabContainer.tsx       # Renders active tab content
    │   ├── code/
    │   │   └── CodeTab.tsx        # Monaco editor wrapper
    │   ├── sprites/
    │   │   ├── SpriteTab.tsx      # Sprite editor container
    │   │   ├── SpriteCanvas.tsx   # Canvas rendering + interaction
    │   │   ├── SpriteToolbar.tsx  # Tools, palette, flags, zoom
    │   │   └── SpriteStatusBar.tsx
    │   ├── map/
    │   │   ├── MapTab.tsx
    │   │   ├── MapCanvas.tsx
    │   │   ├── MapToolbar.tsx
    │   │   ├── TilePicker.tsx
    │   │   └── MapStatusBar.tsx
    │   ├── sfx/
    │   │   ├── SfxTab.tsx
    │   │   ├── SfxList.tsx
    │   │   ├── SfxBarMode.tsx
    │   │   ├── SfxTrackerMode.tsx
    │   │   ├── SfxToolbar.tsx
    │   │   └── SfxStatusBar.tsx
    │   ├── music/
    │   │   ├── MusicTab.tsx
    │   │   ├── PatternEditor.tsx
    │   │   ├── PatternNavigator.tsx
    │   │   ├── MusicToolbar.tsx
    │   │   └── MusicStatusBar.tsx
    │   ├── i18n/
    │   │   ├── I18nTab.tsx
    │   │   ├── TranslationTable.tsx
    │   │   ├── I18nToolbar.tsx
    │   │   └── I18nStatusBar.tsx
    │   └── export/
    │       ├── ExportTab.tsx
    │       ├── TemplatePicker.tsx
    │       ├── ExportPreview.tsx
    │       └── ExportButtons.tsx
    ├── hooks/
    │   ├── useVscodeMessaging.ts   # postMessage send + onMessage receive
    │   ├── useCanvas.ts            # Canvas ref + resize + DPR handling
    │   └── useUndoRedo.ts          # Generic undo/redo with max 50 levels
    └── styles/
        ├── global.css              # Base styles (body margin, font, colors)
        ├── tabs.module.css
        ├── sprites.module.css
        ├── map.module.css
        ├── sfx.module.css
        ├── music.module.css
        ├── i18n.module.css
        └── export.module.css
```

#### Build Pipeline

The webview is built separately from the extension host:

```bash
# Development (watch mode)
npm run watch:webview     # esbuild --watch

# Production
npm run build:webview     # esbuild --minify --bundle

# Full build (extension + webview)
npm run compile           # tsc -p ./ && esbuild webview
```

esbuild configuration:
- **Entry point**: `src/webview/index.tsx`
- **Output**: `out/webview/bundle.js` + `out/webview/bundle.css`
- **Format**: `iife` (immediately-invoked function expression — no module system needed in webview)
- **Target**: `es2020`
- **JSX**: `automatic` (React 18 JSX transform, no `import React` needed)
- **External**: `['vscode']` (not used in webview, but prevents accidental imports)
- **Loader**: `.tsx` → `tsx`, `.ts` → `ts`, `.css` → `css`
- **Plugins**: CSS modules plugin for `*.module.css` files

#### HTML Shell Generation

`cartViewerHtml.ts` is reduced to a thin function (~50 lines) that generates a minimal HTML document:

```typescript
function generateCartViewerHtml(options: CartViewerOptions): string
```

The generated HTML contains:
1. CSP meta tag
2. `<link>` to bundled CSS (`out/webview/bundle.css`)
3. `<link>` to Monaco CSS (if available)
4. `<script>` setting `window.__INIT_DATA__` with serialized cart data, locale, options
5. `<script src="bundle.js">` loading the React app
6. `<div id="root"></div>` mount point

```typescript
interface CartViewerOptions {
    cartData: CartData;
    locale: LocaleStrings;
    extensionUri: vscode.Uri;
    webview: vscode.Webview;
    gameName?: string;
    showRunButton?: boolean;
    showAudio?: boolean;
    editable?: boolean;
    i18nData?: object | null;
    metaData?: MetaData | null;
    templatePreviews?: { [name: string]: string };
}
```

#### State Management (zustand)

##### `cartStore`
```typescript
interface CartState {
    gfx: number[];           // 8192 bytes: sprite sheet
    map: number[];           // 4096 bytes: tilemap
    flags: number[];         // 256 bytes: sprite flags
    sfx: number[];           // 4352 bytes: 64 SFX × 68
    music: number[];         // 256 bytes: 64 patterns × 4
    code: string;            // Lua source
    label: string | null;    // data:image/png;base64 label
    pal: number[][];         // 16-color PICO-8 palette

    setGfx(gfx: number[]): void;
    setMap(map: number[]): void;
    setFlags(flags: number[]): void;
    setSfx(sfx: number[]): void;
    setMusic(music: number[]): void;
    setCode(code: string): void;
}
```

##### `uiStore`
```typescript
interface UIState {
    activeTab: 'code' | 'sprites' | 'map' | 'sfx' | 'music' | 'i18n' | 'export';
    editable: boolean;
    showAudio: boolean;
    showRunButton: boolean;
    pico8Running: boolean;

    // Sprite editor
    spriteTool: 'pencil' | 'fill' | 'rect' | 'circle' | 'line' | 'select' | 'hand';
    spriteFgColor: number;
    spriteBgColor: number;
    spriteZoom: number;

    // Map editor
    mapTool: 'pencil' | 'fill' | 'select' | 'hand';
    mapSelectedTile: number;
    mapZoom: number;

    // SFX editor
    sfxMode: 'bar' | 'tracker';
    sfxSelectedIndex: number;
    sfxSelectedWaveform: number;
    sfxSelectedEffect: number;

    // Music editor
    musicSelectedPattern: number;

    setActiveTab(tab: string): void;
    setPico8Running(running: boolean): void;
    // ... setters for each field
}
```

##### `metaStore`
```typescript
interface MetaState {
    meta: { title: string; author: string; template: string };
    i18nData: I18nData | null;

    setMeta(meta: any): void;
    setI18nData(data: I18nData): void;
}
```

#### VS Code API Communication

The `useVscodeMessaging` hook provides typed send/receive:

```typescript
function useVscodeMessaging(): {
    postMessage(msg: WebviewToExtensionMessage): void;
    onMessage(handler: (msg: ExtensionToWebviewMessage) => void): void;
}
```

All change notifications are debounced (100ms) at the store level before posting to the extension host. The message protocol (§7 Message Protocol) is unchanged — the same message types and payloads are used.

### Shared HTML Generator (`cartViewerHtml.ts`)

The former 6000-line inline HTML generator is replaced by a thin shell generator (~50 lines). It generates a minimal HTML document that loads the bundled React app and passes initial data. The function signature and `CartViewerOptions` interface remain the same for backward compatibility with the three callers:
1. **`Pico8CartPanel`** — database game viewer (read-only, with audio + run button)
2. **`Pico8PngEditorProvider`** — `.p8.png` custom editor (editable for workspace files)
3. **`previewP8Cart` command** — `.p8` file preview (read-only)

### Layout

The webview uses an edge-to-edge layout with no gaps:
- `body` has `margin: 0; padding: 0` (overrides VS Code's default `padding: 20px`)
- Tab header has no border separators between tabs or below the header
- Content areas have `padding: 0` — Monaco and other panels fill the entire available space
- `#monaco-container` has `overflow: hidden` so the editor scrollbar sits flush against the right edge

### Monaco Editor Integration

The Code tab uses Monaco Editor (AMD build) instead of a plain `<pre>` element.

**Loading**: Monaco's AMD loader (`loader.js`) is injected as a dynamic `<script>` element with the correct nonce. On load, it configures `require.config` and loads `vs/editor/editor.main`. Monaco workers use `data:` URL workaround for webview cross-origin restrictions.

**Language**: A custom `pico8-lua` Monarch tokenizer handles PICO-8 Lua syntax — keywords, builtins (print, cls, spr, etc.), comments (`--`, `--[[ ]]`), strings, numbers (decimal, hex `0x`, binary `0b`), and operators.

**Theme**: `pico8-dark` uses PICO-8-native colors:
| Token | Color |
|-------|-------|
| keyword | `#ff77a8` (pink) |
| builtin | `#29adff` (blue) |
| string | `#00e436` (green) |
| comment | `#5f574f` (brown, italic) |
| number | `#ffec27` (yellow) |
| operator | `#ff77a8` (pink) |
| identifier | `#c2c3c7` (light gray) |

Editor background: `#1a1a1a`. Cursor: `#ff77a8`.

**Read-only vs editable**: Controlled by the `editable` option. When editable, `onDidChangeModelContent` sends `{ type: 'codeChanged', code }` messages to the extension host.

### CSP (Content Security Policy)

```
default-src 'none';
script-src <cspSource> 'nonce-<nonce>' 'unsafe-eval';
style-src <cspSource> 'unsafe-inline';
font-src <cspSource>;
worker-src blob:;
img-src <cspSource>;
```

- `'unsafe-eval'` — required by Monaco's AMD loader (`new Function()`)
- `'unsafe-inline'` for `style-src` — Monaco injects CSS dynamically
- `blob:` for `worker-src` — Monaco web workers use blob URLs
- All inline `<script>` tags carry a nonce attribute
- **No inline event handlers** (`onclick`, etc.) — all click handlers are attached via `addEventListener` inside the nonce'd script block, because nonce-based CSP blocks inline HTML event attributes

### Tabs

- **Code** — Monaco editor with PICO-8 Lua syntax highlighting
- **Sprites** — 128×128 sprite sheet rendered to `<canvas>`; three-area layout: header bar (tools + palette + flags + zoom), canvas, status bar (see §7.4)
- **Map** — 128×64 tile map editor; three-area layout: header bar (tools + tile picker + zoom), dual canvas (tiles + overlay), status bar (see §7.6)
- **SFX** — interactive SFX editor with bar (pitch) and tracker modes; 64 SFX × 32 notes; per-SFX playback (see §7.7)
- **Music** — interactive music pattern editor with 4-channel pattern editing, 64-pattern navigator, flags, and playback (see §7.8)
- **i18n** — internationalization pipeline for translating text in PICO-8 games; scans code for `tx()` calls, manages translation table, and generates runtime glyph data (see §7.9)

Tab switching calls `monacoEditor.layout()` when returning to the Code tab (Monaco does not auto-resize when its container is `display: none`).

### 7.4 Sprite Editor Layout

The sprite editor has three vertical areas:

1. **Header bar** (top, single row, wraps if narrow): Drawing tools (editable only) → separator → 16 color palette swatches (left-click = FG, right-click = BG) → FG/BG info label → separator → 8 flag filter buttons → 8 flag editor circles → separator → zoom controls. All elements share one `.sprite-toolbar` container.
2. **Canvas** (middle, flex-fills remaining space): 128×128 sprite sheet with grid/overlay.
3. **Status bar** (bottom, informational only, no interactive elements): Pixel coordinates, sprite number, current FG/BG color indices, active flags of hovered sprite as comma-separated list.

The separate palette row (`.sprite-palette`) is removed — its color swatches and flag circles are integrated into the header bar.

### 7.5 Sprite Flags

PICO-8 sprites have 8 flag bits per sprite (256 sprites × 1 byte = `gfxFlags[256]`). Flags are stored as a bitmask: bit 0 = flag 0, bit 7 = flag 7. Each flag is associated with a PICO-8 palette color (flags 0–7 → palette indices 8–15: red, orange, yellow, green, blue, lavender, pink, peach).

#### Flag Filter (toolbar)

Eight small colored buttons are displayed in the sprite toolbar between the drawing tools and the zoom controls. Each button corresponds to one flag (0–7) and is colored with the associated palette color. Buttons are off (dimmed) by default.

- **Toggle on**: Click a flag button to activate it. All 8×8 sprites whose bitmask includes that flag get a colored border overlay on the sprite sheet. The border color matches the flag's palette color.
- **Multiple flags**: Multiple flag filters can be active simultaneously. A sprite matching any active flag gets an overlay. If a sprite matches multiple active flags, the border uses the color of the lowest active flag.
- **Toggle off**: Click an active flag button again to deactivate it. The overlay updates immediately.
- The overlay is drawn in `seRenderOverlay()` after the grid lines but before the hover highlight.

#### Flag Editor (header bar)

Eight circular toggle buttons are displayed in the header bar, after the flag filter buttons. Each circle corresponds to one flag (0–7) and uses the associated flag color. They reflect the flags of the currently hovered sprite (the 8×8 cell under the mouse cursor).

- **Display**: When no sprite is hovered, all flag circles are dimmed/empty. When a sprite is hovered, filled circles indicate set flags.
- **Toggle (editable mode only)**: Clicking a flag circle toggles that bit in `FLAGS[spriteIndex]` and sends a `flagsChanged` message to the extension host.
- **Read-only mode**: Flag circles are displayed but not clickable.

#### Status Bar

The status bar is informational only (no interactive elements). It displays: pixel coordinates (`Pos: (x, y)`), sprite number (`Sprite: #n`), FG/BG color indices (`FG:n BG:n`), and the hovered sprite's flag bits as a comma-separated list (e.g. `Flags: 0,2,5`). Empty sections are omitted when the mouse is outside the canvas.

#### Message Protocol Addition

**Webview → Extension:**
- `{ type: 'flagsChanged', flags: number[] }` — the full 256-byte flags array, sent when any flag bit is toggled (debounced 100ms, same pattern as `gfxChanged`)

### 7.6 Map Editor Layout

The map editor mirrors the sprite editor's three-area layout and interaction model (§7.4), adapted for tile-based editing instead of pixel-based editing.

#### Data Model

- Map is 128 columns × 64 rows of tile indices (each 0–255, referencing a sprite).
- Upper 32 rows: stored in `MAP[ty * 128 + tx]` (4096 bytes at 0x2000–0x2FFF).
- Lower 32 rows: shared with sprite sheet lower half — `GFX[4096 + (ty - 32) * 128 + tx]`.
- Native canvas: 1024×512 pixels (128 tiles × 8px, 64 tiles × 8px).

#### Three-Area Layout

1. **Header bar** (top, single row, wraps if narrow): Drawing tools (editable only) → separator → tile picker (selected tile # + 8×8 sprite preview) → separator → zoom controls. All elements share one `.map-toolbar` container.
2. **Canvas** (middle, flex-fills remaining space): Dual canvas — `cvs-map` for tile rendering, `cvs-map-overlay` for grid/hover/selection overlays. Zoomable and pannable with the same interaction model as the sprite editor.
3. **Status bar** (bottom, informational only): Tile coordinates (`Tile: (tx, ty)`), sprite index at that position (`Sprite: #n`), flags of that sprite.

#### Coordinate System

All interactions use tile coordinates (0–127 × 0–63), not pixel coordinates. `meScreenToTile(clientX, clientY)` converts viewport position to `{tx, ty}` accounting for zoom and pan.

#### Tools (editable mode only)

| Tool | Key | Icon | Behavior |
|------|-----|------|----------|
| Pencil | D | ✎ | Left-click/drag: place selected tile. Right-click: pick tile from map (eyedropper). |
| Fill | F | ▧ | Flood-fill contiguous area of the same tile index with the selected tile. |
| Select | S | □ | Drag to create rectangular selection. Ctrl+C/X/V for copy/cut/paste. Drag selection to move. |
| Hand | P | ✋ | Click-drag to pan. Also activated by holding Space (temporary hand, same as sprite editor). |

#### Tile Picker

- **Header preview**: Shows `Tile: #n` with an inline 8×8 pixel canvas rendering the selected sprite. Updated whenever the selected tile changes.
- **Right-click (eyedropper)**: Right-clicking the map with the pencil tool picks the tile at that position, updating the selected tile.
- **Q / W keys**: Select previous / next sprite index (wraps 0–255).
- **X key or click on header preview**: Opens a popup tile picker — a 16×16 grid (128×128 canvas) showing all 256 sprites. Click a sprite to select it as the current tile. Click outside or press Escape to dismiss.

#### Zoom, Pan, and Overlays

Same model as sprite editor (§7.4):
- **Zoom**: Mouse wheel (normalized, same sensitivity as sprite editor). +/− keys. 0 key to fit.
- **Pan**: Hand tool, Space+drag, middle-mouse drag.
- **Tile grid overlay**: Drawn at zoom ≥ 1 (every 8px = 1 tile). Dimmed gray lines.
- **Hover highlight**: Outlines the tile under the cursor.
- **Selection**: Marching ants rectangle (same as sprite editor).
- `meRenderOverlay()` handles all overlay drawing.

#### Undo / Redo

- `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`): Undo / redo.
- Undo stack stores snapshots of `MAP` (4096 bytes). For lower-row edits, also stores the affected GFX range.
- Max 50 undo levels (same as sprite editor).

#### Change Notification

- `notifyMapChanged()`: Debounced 100ms. Sends `{ type: 'mapChanged', map: MAP.slice() }` to the extension host.
- Lower 32-row edits additionally trigger `notifyGfxChanged()` (existing message) since they modify shared GFX memory.

#### Initialization

`initMapEditor()` is called when the Map tab is first activated (lazy init, same pattern as sprite editor's `initSpriteEditor()`). It sets up the dual canvas, fits to container, attaches event listeners, and calls `meRenderCanvas()`.

### 7.7 SFX Editor Layout

The SFX editor replaces the previous split-panel text-only view with an interactive editor modeled after PICO-8's native SFX editor. It supports two editing modes — **bar mode** (pitch view) and **tracker mode** — toggled with the Tab key or toolbar buttons.

#### Data Model

- 64 SFX entries, each 68 bytes at `SFX[sfxId * 68]`.
- Each SFX contains 32 notes (2 bytes each) + speed (byte 65) + loop start (byte 66) + loop end (byte 67).
- Per-note fields (packed in 2 bytes):
  - `pitch` (6 bits, 0–63): C-0 to D#5.
  - `waveform` (3 bits, 0–7): sine, triangle, saw, square, pulse, ring, noise, ring2.
  - `volume` (3 bits, 0–7).
  - `effect` (3 bits, 0–7): none, slide, vibrato, drop, fade-in, fade-out, arpeggio-fast, arpeggio-slow.
  - `customWave` (1 bit): if set, waveform index references SFX 0–7 as a custom instrument.

#### Three-Area Layout

```
┌────────────────────────────────────────────────┐
│  SFX Toolbar                                   │
├──────────┬─────────────────────────────────────┤
│          │  Bar/Tracker Canvas Area            │
│  SFX     │  ┌──────────────────────────────┐   │
│  List    │  │  Pitch bars (32 columns)     │   │
│  (64     │  │  height = pitch, color =     │   │
│  entries)│  │  waveform                    │   │
│          │  ├──────────────────────────────┤   │
│          │  │  Volume row (32 mini-bars)   │   │
│          │  ├──────────────────────────────┤   │
│          │  │  Effect row (32 cells)       │   │
│          │  └──────────────────────────────┘   │
│          │                                     │
├──────────┴─────────────────────────────────────┤
│  Status bar                                    │
└────────────────────────────────────────────────┘
```

1. **Toolbar** (top, full width): Mode toggle (bar/tracker) → SFX index selector (◀ #nn ▶) → speed control (SPD ◀ nn ▶) → loop controls (LOOP ◀ nn ▶ ◀ nn ▶) → separator → waveform selector (8 buttons, colored by waveform) → separator → effect selector (8 buttons) → separator → play/stop button (when audio enabled).
2. **Left panel** (narrow, scrollable): List of 64 SFX entries. Each shows `SFX nn` with a mini waveform preview or "empty" label. Clicking selects the SFX for editing. Active SFX is highlighted. Play button per-entry when audio is enabled.
3. **Main area** (flex-fills remaining space): Either bar mode canvas or tracker mode table (see below).
4. **Status bar** (bottom): Current note index, pitch name, waveform, volume, effect values under the cursor. In editable mode, also shows "Modified" indicator.

#### Bar Mode (Pitch View)

The bar mode renders the 32 notes as vertical bars on a canvas. This is the default mode, matching PICO-8's "pitch mode" which is described as "more suitable for sound effects."

**Pitch area** (top, ~70% of canvas height):
- 32 columns, one per note. Each column is a vertical bar whose height maps to pitch (0 at bottom, 63 at top).
- Bar color corresponds to the note's waveform instrument, using distinct colors per waveform:
  - 0 sine: `#ff77a8` (pink), 1 triangle: `#29adff` (blue), 2 saw: `#00e436` (green), 3 square: `#ffec27` (yellow), 4 pulse: `#ff6c24` (orange), 5 ring: `#a8e6cf` (lavender), 6 noise: `#83769c` (gray-purple), 7 ring2: `#fff1e8` (peach).
- Notes with volume 0 are drawn as dim/transparent bars.
- A horizontal grid line is drawn at each octave boundary (every 12 pitches).
- The current playback position (when playing) is highlighted with a vertical marker.

**Volume area** (below pitch, ~15% of canvas height):
- 32 mini-bars, height proportional to volume (0–7). Color: `#00e436` (green).

**Effect area** (below volume, ~15% of canvas height):
- 32 cells, each showing the effect value as a colored block. Effect 0 (none) is empty/dim.
- Effect colors: 0 none: dim, 1 slide: `#29adff`, 2 vibrato: `#ff77a8`, 3 drop: `#ff004d`, 4 fade-in: `#00e436`, 5 fade-out: `#ffa300`, 6 arp-fast: `#ffec27`, 7 arp-slow: `#a8e6cf`.

**Loop region**: Notes between loop-start and loop-end are shaded with a subtle background color. Loop markers are drawn as vertical lines at the loop boundaries.

#### Bar Mode Interaction (editable mode)

| Action | Target Area | Behavior |
|--------|-------------|----------|
| Left-click/drag | Pitch area | Set pitch for the note column under the cursor. Height maps linearly to pitch 0–63. |
| Shift+left-drag | Pitch area | Apply currently selected waveform to notes without changing pitch. |
| Ctrl+left-drag | Pitch area | Snap pitch to C minor pentatonic scale (C, D#, F, G, A#). |
| Right-click | Pitch area | Eyedropper — pick the waveform of the note under the cursor as the active waveform. |
| Left-click/drag | Volume area | Set volume (0–7) for the note column. |
| Left-click/drag | Effect area | Set effect (0–7) for the note column. Uses the currently selected effect from toolbar. |
| Right-click | Effect area | Eyedropper — pick the effect of the note under the cursor. |

#### Tracker Mode

The tracker mode displays 32 rows in a table with columns: `#` (index), `Note` (pitch as note name + octave), `Wave` (waveform name/index), `Vol` (0–7), `FX` (effect name). This is the existing tracker display, now enhanced for editing.

**Tracker editing (editable mode):**
- Click a cell to select it. Selected cell has a highlight border.
- Keyboard note entry via piano layout: `q2w3er5t6y7ui` (octave 2), `zsxdcvgbhnjm` (octave 1). Entering a note sets the pitch and advances to the next row.
- Hold Shift while entering a note to transpose ±1 octave.
- Backspace: delete note (set volume to 0, clear pitch).
- Arrow keys: navigate between cells (up/down = rows, left/right = columns).
- PageUp/PageDown: skip 4 rows.
- Home/End: jump to first/last row.
- Tab: switch to bar mode.

#### Toolbar Controls Detail

**SFX index selector**: ◀ and ▶ buttons cycle through SFX 0–63. The current SFX number is displayed between the buttons. Clicking the number allows direct input.

**Speed (SPD)**: Left-click ▶ to increase, left-click ◀ to decrease. Range 0–255. Hold Shift to change by 4. Direct click on value to type a number.

**Loop start/end**: Two pairs of ◀▶ buttons. Range 0–31 each. When loop start ≥ loop end, looping is disabled (displayed as "OFF"). If loop end is 0 and loop start > 0, it functions as note length (displayed as "LEN" instead of "LOOP").

**Waveform selector**: 8 buttons labeled 0–7 (or with waveform icons). The active waveform is highlighted. Clicking selects it as the brush waveform for painting in bar mode. Displayed in waveform colors (same as bar colors above).

**Effect selector**: 8 buttons labeled 0–7. Clicking selects the brush effect for painting in bar mode.

**Play/stop** (audio enabled only): Space key or button. Plays the current SFX. During playback, the current note is highlighted in both bar and tracker modes.

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Toggle bar ↔ tracker mode |
| Space | Play / stop current SFX (audio enabled) |
| ◀ / ▶ (or - / +) | Previous / next SFX index |
| Q / W | Previous / next waveform |
| A / S | Previous / next effect |
| 1–8 | Select waveform 0–7 directly |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |

#### Undo / Redo

- Undo stack stores per-SFX snapshots (68 bytes). Max 50 undo levels (same as sprite/map editors).
- Any edit (pitch, volume, waveform, effect, speed, loop) pushes an undo frame.

#### Change Notification

- `notifySfxChanged()`: Debounced 100ms. Sends `{ type: 'sfxChanged', sfx: SFX.slice() }` to the extension host.
- Contains the full 4352-byte SFX array (64 × 68).

#### Initialization

`initSfxEditor()` is called when the SFX tab is first activated (lazy init). It renders the SFX list, creates the bar-mode canvas, attaches event listeners, and selects SFX 0 by default.

### 7.8 Music Editor Layout

The music editor replaces the previous read-only 8-column pattern grid with an interactive editor modeled after PICO-8's native music editor. It provides a focused pattern editor for the currently selected pattern, a compact pattern navigator showing all 64 patterns, and playback controls.

#### Data Model

- 64 music patterns, each 4 bytes (256 bytes total at `0x3100–0x31FF`).
- Each pattern has 4 channels (ch0–ch3). Per-channel byte:
  - Bits 0–5: SFX id (0–63).
  - Bit 6: disabled/muted flag (1 = channel silent).
  - Bit 7 (ch0 only): loop-start marker.
  - Bit 7 (ch1 only): loop-end marker (playback jumps back to nearest preceding loop-start).
  - Bit 7 (ch2 only): stop marker (song ends after this pattern).

#### Three-Area Layout

```
┌──────────────────────────────────────────────────────┐
│  Music Toolbar                                       │
│  [◀ ## ▶]  [▶ Play] / [■ Stop]                      │
├──────────────────────────────────────────────────────┤
│  Pattern Editor (current pattern)                    │
│  ┌──────────┬──────────┬──────────┬──────────┐       │
│  │  CH 0    │  CH 1    │  CH 2    │  CH 3    │       │
│  │  ☑ ◀ 03 ▶│  ☑ ◀ 12 ▶│  ☐ ◀ -- ▶│  ☑ ◀ 08 ▶│    │
│  └──────────┴──────────┴──────────┴──────────┘       │
│  Flags: [○ Loop Start] [○ Loop End] [○ Stop]         │
├──────────────────────────────────────────────────────┤
│  Pattern Navigator (64 patterns, compact strip)      │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬── ... ──┬──┐    │
│  │00│01│02│03│04│05│06│07│08│09│10│11  ...  63│  │    │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴── ... ──┴──┘    │
├──────────────────────────────────────────────────────┤
│  Status bar                                          │
└──────────────────────────────────────────────────────┘
```

1. **Toolbar** (top, full width): Pattern index selector (◀ `##` ▶, range 0–63) → play/stop button (when audio enabled). The play button plays from the current pattern; during playback, it becomes a stop button.
2. **Pattern Editor** (middle): Displays the 4 channels of the currently selected pattern. Each channel has:
   - **Enable/disable checkbox**: Toggles bit 6 (muted). When disabled, the SFX id is shown as `--` and the channel is visually dimmed.
   - **SFX id selector** (◀ `##` ▶): Range 0–63. Clicking ◀/▶ changes the SFX id. Only active when the channel is enabled.
   - Below the 4 channels, three **flag toggle buttons**: Loop Start, Loop End, Stop. Active flags are highlighted with their associated color (green, red, yellow respectively).
3. **Pattern Navigator** (below pattern editor): A compact horizontal strip of 64 pattern cells, wrapping into rows. Each cell shows the pattern number (00–63). Visual indicators:
   - **Selected**: highlighted background.
   - **Non-empty**: brighter text (at least one channel enabled).
   - **Empty**: dimmed (all 4 channels disabled).
   - **Loop start**: left green border.
   - **Loop end**: right red border.
   - **Stop**: bottom yellow border.
   - **Playing** (during playback): pulsing/highlighted background.
   - Clicking a cell selects it for editing and scrolls the pattern editor to that pattern.
4. **Status bar** (bottom): Displays `Pattern ##` and, during playback, `Playing pattern ##`.

#### Pattern Editor Interaction (editable mode)

| Action | Behavior |
|--------|----------|
| Click channel checkbox | Toggle channel enable/disable (bit 6). |
| Click ◀/▶ on channel SFX | Decrement/increment SFX id (0–63, wraps). |
| Click flag button | Toggle the flag for the current pattern. |
| Click pattern cell in navigator | Select that pattern for editing. |

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Left / Right (or − / +) | Previous / next pattern index |
| Space | Play / stop from current pattern (audio enabled) |
| 1 / 2 / 3 / 4 | Toggle channel 1–4 enable/disable |

#### Undo / Redo

- Undo stack stores per-pattern snapshots (4 bytes × current pattern index). Max 50 undo levels.
- Any edit (channel enable, SFX id, flags) pushes an undo frame.
- `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`): Undo / redo.

#### Change Notification

- `notifyMusicChanged()`: Debounced 100ms. Sends `{ type: 'musicChanged', music: MUSIC.slice() }` to the extension host.
- Contains the full 256-byte music array (64 × 4).

#### Initialization

`initMusicEditor()` is called when the Music tab is first activated (lazy init). It renders the pattern navigator, sets up the pattern editor for pattern 0, attaches event listeners, and wires up the toolbar.

### 7.9 i18n Tab (Internationalization Pipeline)

The i18n tab provides a code-to-translation pipeline for PICO-8 games. It allows developers to write UTF-8 text (including Chinese, Japanese, etc.) directly in their Lua code via a `tx("key")` function, then manage translations and generate optimized runtime glyph data — all within the editor, without external Python tools.

#### Concept

PICO-8's built-in `print()` only supports ASCII + the PICO-8 extended glyph set. To display CJK or other Unicode text, characters must be rendered as pixel bitmaps and drawn via `pset()` or `sspr()`. The picovibe project pioneered this approach with external Python tooling; pico8ide integrates the entire pipeline into the editor.

The developer's workflow:
1. Write `tx("hello_msg")` or `tx("你好世界")` in Lua code (the argument is a text key or native-language string)
2. Switch to the i18n tab — the editor auto-scans the code and populates a translation table
3. Add target locales (e.g. `zh_CN`, `ja`) and fill in translations
4. On save/run, the extension processes the cart: injects a runtime decoder function and hex-encoded glyph data for the selected output locale

#### Data Model

i18n data is stored alongside the cart as a JSON object (persisted separately from the `.p8` binary data):

```typescript
interface I18nData {
    defaultLocale: string;           // e.g. "en" — the language used in Lua source
    outputLocale: string;            // e.g. "zh_CN" — currently selected output locale
    locales: string[];               // ["en", "zh_CN", "ja"] — all configured locales
    entries: I18nEntry[];            // extracted text entries
}

interface I18nEntry {
    key: string;                     // text key or native string from tx() call
    sourceText: string;              // original text (same as key for native strings)
    translations: Record<string, string>;  // locale → translated text, e.g. { "zh_CN": "你好世界", "ja": "こんにちは世界" }
}
```

#### Three-Area Layout

```
┌──────────────────────────────────────────────────────────────┐
│  i18n Toolbar                                                │
│  Default locale: [en ▼]  Output locale: [zh_CN ▼]  [+ Add]  │
│  [↻ Scan Code]  [▶ Preview]                                  │
├──────────────────────────────────────────────────────────────┤
│  Translation Table                                           │
│  ┌──────────┬──────────────┬──────────────┬─────────────┐    │
│  │ Key      │ en (default) │ zh_CN        │ ja          │    │
│  ├──────────┼──────────────┼──────────────┼─────────────┤    │
│  │ greet    │ Hello!       │ 你好！       │ こんにちは！│    │
│  │ start    │ Press START  │ 按下开始     │ スタート    │    │
│  │ gameover │ Game Over    │ 游戏结束     │ ゲームオーバー│  │
│  └──────────┴──────────────┴──────────────┴─────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  Status bar                                                  │
│  3 entries, 2 locales  │  Output: zh_CN  │  2/3 translated   │
└──────────────────────────────────────────────────────────────┘
```

1. **Toolbar** (top): Default locale selector, output locale selector, "Add Locale" button, "Scan Code" button (re-scans Lua code for `tx()` calls), "Preview" button (shows a preview of how text will render at 128×128 PICO-8 resolution).
2. **Translation Table** (middle, flex-fills): An editable table. First column is the text key. Remaining columns are one per locale. The default locale column shows the source text (editable — this is the native-language string). Other locale columns are translation inputs. Empty cells are highlighted to indicate missing translations.
3. **Status bar** (bottom): Entry count, locale count, output locale, translation completeness for the output locale.

#### Code Scanning

When the user clicks "Scan Code" (or when the i18n tab is first activated), the extension scans the current Lua code for `tx()` call patterns:

- **Regex**: `/tx\(\s*"([^"]+)"\s*(?:,|\))/g` — matches `tx("key", ...)` or `tx("key")`
- Extracted keys are merged into the existing `I18nEntry[]` array:
  - New keys are appended with empty translations
  - Existing keys are preserved (translations not overwritten)
  - Keys no longer in the code are marked as stale (dimmed in the table, not deleted — the user can manually remove them)

#### Translation Table Interaction (editable mode)

| Action | Behavior |
|--------|----------|
| Click cell | Activate cell for editing (inline text input) |
| Tab / Enter | Move to next cell (right, then down) |
| Escape | Cancel editing |
| Delete key on row | Remove the entry (with confirmation if translations exist) |
| Click "Add Locale" | Prompt for locale code (e.g. `ja`), adds a new column |
| Right-click locale header | Remove locale (with confirmation) |

#### Glyph Encoding (Build-Time Processing)

When the cart is saved or run, the extension processes `tx()` calls for the selected output locale. This happens in TypeScript (no external Python dependency).

**Font rendering**: The extension bundles a bitmap font resource (e.g. the same BoutiqueBitmap7x7 used by picovibe, or a configurable font). For each unique character in the translations for the output locale:

1. Render the character to an 8×8 (CJK) or variable-width (ASCII) 1-bit bitmap using an offscreen canvas in the webview
2. Encode the bitmap as a binary string: `0001` + 64 bits (CJK) or `0000` + 4-bit width + 4-bit height + w×h bits (ASCII)
3. Convert the binary string to hex

**Output**: For each `tx("key")` call in the code, the translated text for the output locale is converted to a hex-encoded glyph string. The extension injects:
1. A `_i18n_data` table mapping keys to hex strings
2. A minimal runtime decoder function (`tx()` implementation) that decodes hex→pixels via `pset()`

The injected runtime is ~40 tokens of Lua, significantly smaller than a full i18n library.

#### Glyph Rendering Optimization

The picovibe approach (pixel-by-pixel `pset()` per frame) has performance issues:
- `h2b()` re-decodes hex→binary every call (O(n) per hex digit with function call overhead)
- Lua string indexing is O(n) per `sub()` call — decoding a 20-character Chinese string touches ~1360 string indices
- 64 `pset()` calls per 8×8 character, every frame

#### Resource trade-off analysis

PICO-8's constraints make i18n rendering a resource allocation problem:

| Resource | Limit | Notes |
|----------|-------|-------|
| Sprite sheet | 128×128 px (256 8×8 slots) | Shared with game art; most games use majority of slots |
| Code/data | ~65536 compressed bytes | Hex glyph data competes with game logic |
| CPU per frame | ~4M ops at 30fps | `pset()` is cheap individually but adds up |
| Lua table RAM | Shared 32KB | Cached decode tables consume working memory |

| Approach | Sprite cost | CPU cost/char/frame | Pros | Cons |
|----------|-------------|---------------------|------|------|
| `pset()` + per-frame decode (picovibe) | 0 | ~130 ops (decode + 64 pset) | Zero resource pre-allocation | Wasteful re-decode; slow with many chars |
| `pset()` + cached decode | 0 | ~64 ops (64 pset, no decode) | No sprite cost; eliminates main bottleneck | Still 64 pset per char; Lua table RAM for cache |
| Sprite sheet cache + `sspr()` | 1 slot per unique char | ~1 op (1 sspr call) | Fastest rendering | Consumes scarce sprite space; impractical for CJK |

The pico8ide runtime decoder uses **cached decode + `pset()`** as the default strategy — zero sprite cost, and eliminates the per-frame hex decoding bottleneck:

1. **Decode once**: On first `tx()` call for a given key, decode hex→pixel table and cache in a Lua table. Cost: ~70 bytes of Lua table per unique string.
2. **Render from cache**: Subsequent calls read directly from the cached pixel table — 64 `pset()` calls per CJK character, no string decoding.
3. This is sufficient for typical PICO-8 text volumes (10–30 CJK characters on screen = 640–1920 `pset()` calls — well within the CPU budget).

Sprite-based rendering (`sspr()`) is intentionally not offered because most games cannot afford the sprite space — even 30 unique CJK characters would consume 12% of the entire sprite sheet.

#### i18n Data Persistence

The i18n data is stored as a JSON file alongside the cart:
- For `.p8` files: `<cartname>.i18n.json` in the same directory
- For `.p8.png` files: `<cartname>.i18n.json` in the same directory

The extension reads this file when opening the cart and writes it on save. The `.i18n.json` file is not embedded in the cart — it is a development-time artifact.

#### Preview

The "Preview" button renders a small 128×128 canvas showing how each translated string will look at PICO-8 resolution. Characters are rendered using the bundled bitmap font at 8×8 pixels per CJK character. This allows the developer to verify glyph quality and line wrapping before running the cart.

#### Message Protocol Addition

**Webview → Extension:**
- `{ type: 'i18nChanged', i18nData: I18nData }` — translation table changed (debounced 100ms)
- `{ type: 'i18nScanRequest' }` — request to re-scan code for `tx()` calls

**Extension → Webview:**
- `{ type: 'i18nScanResult', entries: I18nEntry[] }` — result of code scan with updated entries

#### Initialization

`initI18nEditor()` is called when the i18n tab is first activated (lazy init). It loads the `.i18n.json` file if it exists, performs an initial code scan, renders the translation table, and attaches event listeners.

### Cart Viewer Panel (`Pico8CartPanel`)

ViewType: `pico8Cart`. Opens as an editor-area webview panel for database games.

#### Preview / Pin Model

Cart panels follow a preview/pin model inspired by VS Code's file preview behavior:

- **Preview panel**: Opened on single-click. Only one preview panel exists at a time. Its tab title is prefixed with `*` (e.g. `*Cart: Celeste`) to indicate transient status. Opening a different game replaces the current preview panel.
- **Pinned panel**: Created when the user double-clicks a game, or when the preview panel is promoted. The `*` prefix is removed from the title. Pinned panels persist — opening another game does not close them. Multiple pinned panels can coexist.

#### Internal Tracking

- `Pico8CartPanel._previewPanel` — the single replaceable preview panel (or `undefined`).
- `Pico8CartPanel._pinnedPanels` — a `Map<string, Pico8CartPanel>` keyed by game ID.
- `Pico8CartPanel.currentGame` — returns the game of the most recently focused panel (preview or pinned).
- When a preview panel is pinned, it is moved from `_previewPanel` to `_pinnedPanels` and the title `*` prefix is removed.
- Each panel's `onDidDispose` removes itself from the tracking structures.

#### Run / Stop Button

A run/stop button is displayed in the top-right area of the cart viewer header (only for database game viewers via `showRunButton: true`).

- **Idle state**: Shows ▶ Run in PICO-8. Clicking sends a `run` message.
- **Running state**: Shows ⏹ Stop PICO-8. Clicking sends a `stop` message.
- The extension host pushes `{ type: 'runState', running: boolean }` to keep the button in sync.

### Message Protocol (webview ↔ extension)

**Webview → Extension:**
- `{ type: 'run' }` — request to launch PICO-8 with the current cart
- `{ type: 'stop' }` — request to kill the running PICO-8 process
- `{ type: 'codeChanged', code: string }` — Monaco editor content changed (editable mode only)
- `{ type: 'gfxChanged', gfx: number[] }` — sprite pixel data changed (editable mode only)
- `{ type: 'mapChanged', map: number[] }` — map tile data changed (editable mode only, debounced 100ms)
- `{ type: 'flagsChanged', flags: number[] }` — sprite flags changed (editable mode only, debounced 100ms)
- `{ type: 'sfxChanged', sfx: number[] }` — SFX data changed (editable mode only, debounced 100ms)
- `{ type: 'musicChanged', music: number[] }` — music pattern data changed (editable mode only, debounced 100ms)
- `{ type: 'i18nChanged', i18nData: object }` — translation table changed (editable mode only, debounced 100ms)
- `{ type: 'i18nScanRequest' }` — request extension to re-scan code for `tx()` calls
- `{ type: 'convert' }` — user clicked the convert-to-`.p8` banner button

**Extension → Webview:**
- `{ type: 'runState', running: boolean }` — update the run/stop button state
- `{ type: 'i18nScanResult', entries: object[] }` — result of code scan with updated i18n entries

## 8. `.p8.png` Custom Editor (`Pico8PngEditorProvider`)

ViewType: `pico8ide.pngViewer`. Registered as a `CustomEditorProvider<Pico8PngDocument>` for `*.p8.png` files.

### Document Model

```typescript
interface Pico8PngDocument extends CustomDocument {
    uri: vscode.Uri;
    cartData: CartData | null;
    currentCode: string | null;  // edited code from Monaco, null if unchanged
}
```

### Three Modes

1. **Database cart** (file inside `globalStorageUri`): Read-only viewer, no banner, no audio.
2. **Workspace file with companion `.p8`**: Shows a prompt to open the `.p8` file instead. Does not render the cart viewer.
3. **Workspace file without companion `.p8`**: Editable viewer with convert banner. Monaco editor is editable; code changes are tracked via `codeChanged` messages.

### Save Behavior

- **Save** (`Cmd+S`): Writes a companion `.p8` file alongside the `.p8.png` (cannot re-encode steganographic PNG). Uses `cartDataToP8()` from `p8format.ts`.
- **Save As**: Writes to the chosen destination as `.p8` format.
- **Revert**: Re-decodes the `.p8.png` file, resets `currentCode` to null.
- **Backup**: Writes `.p8` format to the backup destination for VS Code's hot exit.

### Convert Banner

When `showConvertBanner` is true, a yellow banner appears above the tabs with a button to extract the cart as a `.p8` file. On click, the extension writes the `.p8` file and opens it in the text editor.

## 9. `.p8` File Preview

The `pico8ide.previewP8Cart` command (available via right-click context menu on `.p8` files in the explorer) opens a read-only cart viewer in a webview panel. It parses `.p8` text format, extracts sections (code, gfx, map, sfx, music), and passes the data to `generateCartViewerHtml()` with no audio, no run button, and not editable.

## 10. PICO-8 Process Management

### Launching
- `pico8ide.runGame` resolves the game from: (1) `ListGameItem` argument (context menu), (2) `currentSelectedGame`, or (3) `Pico8CartPanel.currentGame`.
- Checks `pico8ide.pico8Path`; if empty, prompts user via warning message to set it.
- Verifies the executable exists on disk.
- Downloads the cart via `dataManager.getAssetPath(game, 'cart')`.
- Spawns PICO-8 with `-run <cartPath>` (detached, stdio ignored).
- Stores the `ChildProcess` reference for stop support.
- Pushes `runState: true` to the cart webview.

### Stopping
- `pico8ide.stopGame` (or webview stop button) kills the tracked child process.
- Pushes `runState: false` to the cart webview.
- The process `exit` event also triggers `runState: false`.

### macOS `.app` Resolution
When the user selects a `.app` bundle via `setPico8Path`, the extension auto-resolves to `<bundle>/Contents/MacOS/pico8`.

## 11. Cartridge Decoding (`pngDecoder.ts`)

`Pico8Decoder.decode()` reads a `.p8.png` file and extracts:
- **RAM** (32 KB): Reconstructed from steganographic 2-bit channels (A, R, G, B low bits)
- **Label**: 128×128 pixel region extracted at offset (16, 24) from the source PNG, returned as a `data:image/png;base64,...` URL
- **Sections** sliced from RAM: GFX (0x0000–0x1FFF), MAP (0x2000–0x2FFF), GFX Flags (0x3000–0x30FF), Music (0x3100–0x31FF), SFX (0x3200–0x42FF)
- **Code** starting at 0x4300, decoded by format:
  - Raw: null-terminated ASCII
  - `:c:\0` (legacy LZSS): 8-byte header (magic + 2-byte big-endian codelen + 2 zero bytes), then LZSS-compressed data with LUT dictionary
  - `\0pxa` (PXA): bit-packed MTF + LZ compression

## 12. Localization

### NLS Keys (package.nls)
| Key | EN | ZH-CN |
|-----|-----|-------|
| `command.setPico8Path.title` | Set PICO-8 Path | 设置 PICO-8 路径 |
| `command.runGame.title` | Run in PICO-8 | 在 PICO-8 中运行 |
| `command.stopGame.title` | Stop PICO-8 | 停止 PICO-8 |
| `config.pico8Path.description` | Absolute path to the PICO-8 executable... | PICO-8 可执行文件的绝对路径... |

### Runtime Locale Keys (i18n.ts)
| Key | EN | ZH-CN |
|-----|-----|-------|
| `pico8PathNotSet` | PICO-8 path is not set. Would you like to set it now? | 未设置 PICO-8 路径。是否现在设置？ |
| `pico8PathNotFound` | PICO-8 executable not found at the configured path. | 在配置的路径中未找到 PICO-8 可执行文件。 |
| `pico8PathSelectPrompt` | Select PICO-8 executable | 选择 PICO-8 可执行文件 |
| `runGameFailed` | Failed to launch PICO-8 | 启动 PICO-8 失败 |
| `stopGame` | Stop PICO-8 | 停止 PICO-8 |
| `runInPico8` | Run in PICO-8 | 在 PICO-8 中运行 |

## 13. Dependencies

| Package | Purpose |
|---------|---------|
| `react` (^18.3.0) | UI component library for webview |
| `react-dom` (^18.3.0) | React DOM renderer for webview |
| `zustand` (^5.0.0) | Lightweight state management for webview |
| `monaco-editor` (^0.52.0) | Code editor in webview tabs |
| `pngjs` (^7.0.0) | PNG decode/encode for `.p8.png` steganography |
| `adm-zip` (^0.5.10) | Unzip remote database downloads |
| `esbuild` (^0.24.0) | Bundles React webview app (dev dependency) |
| `@types/react` (^18.3.0) | TypeScript types for React (dev dependency) |
| `@types/react-dom` (^18.3.0) | TypeScript types for React DOM (dev dependency) |
| `esbuild-css-modules-plugin` (^3.1.0) | CSS Modules support for esbuild (dev dependency) |

Monaco's AMD build (`min/vs/`) is copied to `resources/monaco/` by `scripts/copy-monaco.js` (runs on `postinstall` and `precompile`). The `.gitignore` excludes `resources/monaco/`; `.vscodeignore` ensures it is included in the VSIX package.

The React webview bundle (`out/webview/bundle.js`, `out/webview/bundle.css`) is generated by esbuild during `npm run compile` and included in the VSIX package.

## 14. Icon Assets

| Path | Fill | Purpose |
|------|------|---------|
| `resources/dark/play.svg` | `#C5C5C5` | Play/run icon (dark theme) |
| `resources/light/play.svg` | `#424242` | Play/run icon (light theme) |
| `resources/dark/stop.svg` | `#C5C5C5` | Stop icon (dark theme) |
| `resources/light/stop.svg` | `#424242` | Stop icon (light theme) |
| `resources/dark/fork.svg` | `#C5C5C5` | Fork icon (dark theme) |
| `resources/light/fork.svg` | `#424242` | Fork icon (light theme) |

All icons use 16×16 viewBox SVG format.

---

## Changelog

### 0.1.0 — 2026-02-12
- **React Migration**: Replaced inline HTML string generation (`cartViewerHtml.ts`, ~6000 lines) with React component architecture.
- Added esbuild bundler for webview: `src/webview/index.tsx` → `out/webview/bundle.js` + `bundle.css`.
- Added zustand state management with three stores: `cartStore` (data), `uiStore` (UI state), `metaStore` (metadata/i18n).
- Modular React components per tab: CodeTab, SpriteTab, MapTab, SfxTab, MusicTab, I18nTab, ExportTab.
- Canvas-based editors (Sprites, Map, SFX) wrapped in React via `useRef` + `useEffect`.
- CSS Modules for scoped styling per component.
- Extension host source moved to `src/extension/`; webview source in `src/webview/`.
- `cartViewerHtml.ts` reduced to ~50-line HTML shell generator that loads the React bundle.
- All existing message protocol types preserved (no breaking changes to webview↔extension communication).
- Added dependencies: react, react-dom, zustand, esbuild.
- Updated build pipeline: `npm run compile` now runs both `tsc` and `esbuild`.

### 0.0.14 — 2026-02-09
- Added i18n tab (§7.9) for internationalization pipeline.
- Code scanning extracts `tx()` call keys from Lua source.
- Editable translation table with rows per text key and columns per locale.
- Glyph encoding: renders characters to 8×8 (CJK) or variable-width (ASCII) bitmaps, hex-encodes for PICO-8 runtime.
- Runtime decoder uses cached decode + `pset()` strategy: zero sprite cost, eliminates per-frame hex decoding.
- i18n data persisted as `<cartname>.i18n.json` alongside the cart.
- Preview canvas for verifying glyph rendering at 128×128 PICO-8 resolution.
- Added `i18nChanged` and `i18nScanRequest`/`i18nScanResult` webview↔extension messages.

### 0.0.13 — 2026-02-09
- Added interactive music pattern editor (§7.8) replacing the read-only 8-column pattern grid.
- Pattern editor: 4-channel view with enable/disable toggles and SFX id selectors per channel.
- Pattern flags: loop start, loop end, stop — toggle buttons with colored indicators.
- Compact 64-pattern navigator strip with visual indicators for empty/flags/selected/playing.
- Toolbar: pattern index selector, play/stop button.
- Keyboard shortcuts: Left/Right for pattern navigation, Space for play/stop, 1–4 for channel toggles.
- Undo/redo for music edits (per-pattern 4-byte snapshots, max 50 levels).
- Added `musicChanged` webview→extension message for music editing persistence.

### 0.0.12 — 2026-02-09
- Added interactive SFX editor (§7.7) replacing the split-panel text-only SFX viewer.
- Two editing modes: bar mode (pitch view with 32 vertical bars) and tracker mode (table with note/wave/vol/fx columns), toggled with Tab.
- Bar mode: pitch bars colored by waveform, volume mini-bars, effect cells; click/drag to edit pitch, volume, effect; right-click eyedropper; Ctrl+drag for scale snapping.
- Tracker mode: keyboard note entry via piano layout, cell navigation, direct editing of all note fields.
- Toolbar: SFX index selector, speed/loop controls, waveform selector (8 buttons), effect selector (8 buttons), play/stop.
- SFX list panel with 64 entries, per-entry playback, mini waveform preview.
- Undo/redo for SFX edits (per-SFX 68-byte snapshots, max 50 levels).
- Added `sfxChanged` webview→extension message for SFX editing persistence.

### 0.0.11 — 2026-02-09
- Added interactive map editor (§7.6) replacing the static read-only map canvas.
- Map editor uses same three-area layout as sprite editor: header bar (tools + tile picker + zoom), dual canvas, status bar.
- Tools: pencil (draw/pick), fill (flood fill), select (rect, copy/cut/paste), hand (pan).
- Tile picker with header preview, right-click eyedropper, Q/W next/prev, X key popup grid.
- Zoom, pan, overlays (tile grid, hover, selection) mirroring sprite editor interaction model.
- Undo/redo for map edits (MAP snapshots + shared GFX range for lower rows).
- Added `mapChanged` webview→extension message for map editing persistence.

### 0.0.10 — 2026-02-09
- Merged sprite toolbar and palette into a single header bar: drawing tools + color swatches + flag filter + flag editor circles + zoom controls in one row.
- Removed the separate palette row (`.sprite-palette`); palette elements now in header bar.
- Status bar is now purely informational: pixel coords, sprite #, FG/BG colors, active flags. No interactive elements.
- Added §7.4 Sprite Editor Layout section; renumbered Sprite Flags to §7.5.

### 0.0.9 — 2026-02-09
- Added sprite flag filter overlay: 8 colored toggle buttons in sprite toolbar highlight all sprites with a given flag on the sprite sheet.
- Added per-sprite flag editor: 8 flag circles in the palette area show/toggle flags for the hovered sprite.
- Status bar now shows active flag bits for the hovered sprite.
- Added `flagsChanged` webview→extension message for flag editing persistence.
- Documented sprite flags system in §7.4.

### 0.0.8 — 2026-02-08
- Replaced `<pre>` code display with Monaco Editor in all cart viewer webviews.
- Created shared `cartViewerHtml.ts` module (`generateCartViewerHtml`) replacing three duplicated HTML generators.
- PICO-8 Lua Monarch tokenizer and `pico8-dark` theme with native PICO-8 color palette.
- Edge-to-edge layout: removed body padding, tab gaps, and content padding; Monaco fills entire code area.
- All inline `onclick` handlers replaced with `addEventListener` to comply with nonce-based CSP.
- Upgraded `Pico8PngEditorProvider` from `CustomReadonlyEditorProvider` to `CustomEditorProvider` with save/revert/backup support.
- Editable Monaco editor for workspace `.p8.png` files; save writes companion `.p8` file.
- Added `pico8ide.forkGame` command to copy database carts into workspace.
- Added `pico8ide.previewP8Cart` command for `.p8` file preview via explorer context menu.
- Removed `pico8ide.runGame` from `view/title` menu (kept in `view/item/context` inline only).
- Fixed `:c:` LZSS decompression: corrected 8-byte header parsing (was skipping only 4 bytes, producing `???` characters).
- Added `monaco-editor` dependency with `postinstall`/`precompile` copy script.
- Added `.vscodeignore` to exclude source from VSIX but include `resources/monaco/`.

### 0.0.7 — 2026-02-08
- Cart viewer now uses preview/pin model: single-click opens a preview panel (tab prefixed with `*`), double-click pins it (removes `*`, persists across subsequent opens). Multiple pinned panels can coexist.

### 0.0.6 — 2026-02-08
- Added `pico8ide.pico8Path` setting for local PICO-8 executable path.
- Added `pico8ide.setPico8Path` command with macOS `.app` bundle auto-resolution.
- Added `pico8ide.runGame` command with play icon in tree view title and inline on game items.
- Added `pico8ide.stopGame` command to kill a running PICO-8 process.
- Added `Ctrl+R` / `Cmd+R` keybinding to run game when cart viewer is active.
- Game selection now auto-runs the game in PICO-8 on double-click (single click opens cart viewer only).
- Cart viewer webview now shows a Run/Stop toggle button with bidirectional message passing.
- Added play and stop SVG icons for dark and light themes.
- Added runtime locale keys for run/stop strings in English and Chinese.
