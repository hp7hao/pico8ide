# PICO-8 IDE — End-to-End Test Plan (Design)

> Status: implemented. Tier C (decoder/format golden) runs under vitest; Tier A
> (extension-host, groups A0–A9) runs under `@vscode/test-electron`; Tier B
> (webview, groups B0–B9) runs under Playwright. CI gates on Tier C and also runs
> A and B. Some editor-internal assertions (webview dirty/undo message injection)
> are intentionally deferred to Tier B DOM coverage and marked in-suite. Scope:
> automated E2E for the `pico8ide` VS Code extension. This document enumerates the
> harness, fixtures, hermeticity strategy, and concrete test cases grounded in the
> current behavior of `extension.ts`, `cartEditorProvider.ts`, and `dataManager.ts`.

## 1. Why / current gap

Today the only automated tests are **vitest/jsdom unit + component tests** under
`src/webview/__tests__/` (webview logic against `mockInitData`). They do **not**:

- run the extension host (`src/extension/*` — ~13 of 17 files untested, incl.
  `pngDecoder.ts`, `dataManager.ts`, `extension.ts`, `cartEditorProvider.ts`),
- exercise the real open → decode → render → edit → export → run flow,
- run in CI (`.github/workflows/release.yml` never invokes `npm test`).

This plan adds **real E2E** at two altitudes, plus a cheap pure-Node decoder tier.

## 2. Test altitudes

| Tier | Harness | Runs | Covers | Cost |
|------|---------|------|--------|------|
| **A. Extension-host E2E** | `@vscode/test-electron` + `@vscode/test-cli` (Mocha) | Real VS Code, real Extension Host, real `vscode` API | activation, commands, custom editors, tree, decode-on-open, run/stop, fork, export, save/revert/backup, dirty/undo | High (downloads VS Code; CI needs `xvfb-run`) |
| **B. Webview E2E** | Playwright vs `dev:standalone` esbuild server | Chromium, standalone bridge, `mockInitData` | tab switching, sprite/map paint, SFX/music edit, i18n table, export preview render | Medium (no VS Code download) |
| **C. Decoder golden** | plain vitest (Node) | Node only | `pngDecoder.decode()` on real `.p8.png` → snapshot GFX/MAP/SFX/CODE; `p8format`/`p8modFormat` round-trips | Low |

Tier A is the "real E2E" that proves the extension seam. Tier B gives high-fidelity
webview interaction without booting VS Code. Tier C is the cheapest way to lock down
the riskiest code (steganography + LZSS/PXA). Recommended build order: **C → A → B**.

## 3. Hermeticity strategy (no network, no PICO-8 binary)

The extension is fully E2E-able because every external dependency is behind a seam:

1. **No network.** `dataManager.getDataMode()` returns `"local"` when
   `pico8ide.dataMode = "local"` and `pico8ide.localPath` points at a dir with
   `db.json`. Tests build a **fixture FCDB dir** in a temp location:
   ```
   <tmp>/fcdb/dist/pico8/db.json            # array of GameMetadata
   <tmp>/fcdb/dist/pico8/lists/curated.json # { meta, games }
   <tmp>/fcdb/platforms/pico8/artifacts/carts/bbs/<id>.p8.png   # generated synthetic cart fixture
   <tmp>/fcdb/platforms/pico8/artifacts/sources/bbs/<id>.p8mod  # optional source for fork
   ```
   `getAssetPath(game,'cart')` resolves package-relative paths below
   `platforms/pico8/artifacts/` locally (dataManager.ts:494) and never hits
   `lexaloffle.com` or GitHub. `dist/pico8` and `platforms/pico8` remain siblings
   under the same `fcdb/` root.

2. **No real emulator.** `runGameInPico8` (extension.ts:927) only requires
   `pico8ide.pico8Path` to exist on disk, then `spawn(pico8Path,['-run',cartPath])`.
   Tests point `pico8Path` at a **fake pico8 stub**:
   ```sh
   #!/bin/sh
   # writes argv + cwd to $PICO8_FAKE_LOG, sleeps so the process is observably alive
   echo "$@" >> "$PICO8_FAKE_LOG"
   sleep 30
   ```
   (Windows CI: a `.cmd`/`.bat` equivalent, or gate these tests to POSIX.)
   The stub lets us assert: it was invoked, with the right cart path, that
   `pico8RunState` flipped true, and that stop kills it (`runState` → false).

3. **read-only vs editable toggle.** `isDatabaseCart` (cartEditorProvider.ts:516)
   is `filePath.startsWith(globalStorageUri)`. So a cart opened from the fixture
   *workspace* is editable; one under globalStorage is read-only. Tests place
   fixtures deliberately on each side of that line.

4. **Modal dialogs.** Commands use `showSaveDialog` / `showOpenDialog` /
   `showWarningMessage`. In Tier A these are stubbed by replacing
   `vscode.window.showSaveDialog` etc. with a test double that returns a
   pre-seeded URI/choice (sinon or a manual monkeypatch installed in the test's
   `activate`). Where a command reads config right after (e.g. `setPico8Path`),
   the test instead sets config directly via `workspace.getConfiguration().update`.

## 4. Fixtures to add

- `tests/e2e/fixtures/fcdb/` — generated at test setup (not committed) OR a small
  committed `db.json` + `lists/curated.json` referencing 2–3 games.
- Synthetic carts: generate first-party `.p8.png` fixtures into `tests/e2e/fixtures/carts/` and the
  fixture FCDB tree. Include at least one **legacy `:c:` LZSS** cart and one **`\0pxa`** cart so the
  decoder golden tier covers both formats, without vendoring third-party BBS cartridge content.
- `docs/demo_chinese.p8mod` — existing; reuse as the editable `.p8mod` + i18n fixture.
- `tests/p8go_probe/p8go_probe.p8` — existing raw `.p8`; reuse for the
  `.p8` → `openWithP8IDE` path.
- Decoder golden snapshots: `tests/e2e/golden/<id>.json` with
  `{ codeLen, gfxHash, mapHash, sfxHash, musicHash, flagsHash, labelPrefix }`
  (hash = sha256 of the byte array) so snapshots stay small and diffable.

## 5. Tier A — Extension-host E2E cases

Runner: `@vscode/test-cli` opens a fixture workspace folder with the fixture
FCDB `localPath` pre-configured (via `.vscode/settings.json` in the fixture
workspace, or `--user-data-dir` seeded settings). Each suite awaits activation.

### A0. Activation & registration
- **A0.1** Extension activates without throwing; `activate()` completes.
- **A0.2** Disclaimer webview panel is created on activation (title contains the
  disclaimer string). *(showDisclaimer runs unconditionally — extension.ts:743.)*
- **A0.3** All contributed commands are registered
  (`getCommands(true)` includes every `pico8ide.*` id from package.json:83-155).
- **A0.4** TreeView `pico8Lists` is registered and the `pico8-explorer` view
  container exists.
- **A0.5** Both custom editors are registered: `pico8ide.pngViewer`,
  `pico8ide.p8Editor` (open-with entries exist).

### A1. Data loading & tree (local mode)
- **A1.1** With fixture `localPath`, `listsProvider.load()` populates the tree:
  root shows each curated list group **plus** a synthesized `BBS Released` group
  when `allGames.length > 0` (extension.ts:333-340).
- **A1.2** Expanding a `ListGroupItem` yields one `ListGameItem` per game;
  each item's `contextValue === 'gameItem'`, `description === author.name`.
- **A1.3** `pico8ide.search` filter: invoking `setFilter("celeste")` (drive via
  the command with a stubbed `showInputBox`) narrows children by name/author/id
  (extension.ts:345-351). Empty query restores all.
- **A1.4** `pico8ide.refreshEntry` reloads without error and resets the filter.
- **A1.5** Missing/`""` localPath in local mode → `getGames()` returns `[]` and
  surfaces the "Local path not configured" error (no crash) (dataManager.ts:134).

### A2. Detail sidebar sync
- **A2.1** `selectGame(game)` (single) updates the detail webview
  (`GameDetailViewProvider.updateGame`) and opens a **preview** cart panel
  titled `*Cart: <name>` (extension.ts:838-857, 488).
- **A2.2** `selectList(listInfo)` shows list info HTML in the detail view
  (game count rendered) (extension.ts:821-823, 108-133).
- **A2.3** Expanding/collapsing a list group calls `showListInfo`
  (onDidExpand/Collapse — extension.ts:770-779).

### A3. Open cart (database viewer, read-only)
- **A3.1** `pico8ide.openCart(game)` for a `.p8.png` game: panel goes
  loading → `showCart`; `detailProvider.updateCartInfo` fires with a non-zero
  `code.length` and a `data:image/png` label (extension.ts:895-899).
- **A3.2** `openCart` for a game whose cart resolves to `.p8mod`: parsed via
  `p8ModToCartData`, metadata surfaced (extension.ts:886-890).
- **A3.3** `openCart(unknownId)` → `gameNotFound` error message, no panel crash
  (extension.ts:871-874).
- **A3.4** Decode failure (corrupt cart fixture) → panel shows error HTML via
  `panel.showError`, extension does not throw (extension.ts:900-902).
- **A3.5** Preview/pin model:
  - single-click twice on **different** games reuses one preview panel (old
    disposed) — only one `*`-prefixed tab exists (extension.ts:481-484).
  - double-click (`selectGame` twice within 300ms) pins: title loses `*`,
    game id present in `_pinnedPanels` (extension.ts:848-850, 433-442).
  - `hasGame`/`revealGame`: re-selecting an already-open game reveals, does not
    reopen (extension.ts:851-853).

### A4. `.p8.png` custom editor (workspace file)
- **A4.1** `openWith(uri,'pico8ide.pngViewer')` on a **workspace** `.p8.png`:
  document opens with decoded `cartData`; webview HTML generated read-only
  (`editable:false`) (cartEditorProvider.ts:541-548).
- **A4.2** Same for a cart under globalStorage → `isDatabaseCart` true, still
  read-only, no banner (cartEditorProvider.ts:518-533).
- **A4.3** Decode failure → `getErrorHtml('Failed to decode cartridge')`
  (cartEditorProvider.ts:521, 537).
- **A4.4** `saveCustomDocumentAs` to `.p8` writes a valid `.p8` (parseable back
  via `p8ToCartData`); to `.p8mod` writes valid `.p8mod` (cartEditorProvider.ts:555-561).
- **A4.5** `backupCustomDocument` writes a `.p8` at the backup path and returns a
  backup with a working `delete()` (cartEditorProvider.ts:572-581).

### A5. `.p8mod` custom editor (editable) + dirty/undo
- **A5.1** `openWith(demo_chinese.p8mod,'pico8ide.p8Editor')`: editable webview
  (`editable:true`), `templatePreviews` + `availableLibs` present in init
  (cartEditorProvider.ts:379-391).
- **A5.2** Dirty tracking: after `ready`, a `codeChanged` with new code fires an
  undoable edit → `document` becomes dirty (tab shows dirty indicator). A
  `codeChanged` **equal** to current code does **not** dirty it
  (cartEditorProvider.ts:247-257). *Drive by posting a message into the webview
  through a test hook, or assert at the provider layer via a spy on
  `onDidChangeCustomDocument`.*
- **A5.3** Pre-`ready` change messages do **not** dirty the doc (the `initialized`
  guard — cartEditorProvider.ts:221-227).
- **A5.4** Undo/redo: after two edits, `workbench.action.files.undo`… actually
  custom-editor undo is via the fired edit's `undo()`/`redo()`; assert the
  `CustomDocumentEditEvent` handlers restore `currentCode` and post
  `restoreState` (cartEditorProvider.ts:171-194).
- **A5.5** `save` on a normal `.p8mod` writes back inline via `saveDocumentAsP8Mod`
  (round-trips; meta preserved) (cartEditorProvider.ts:664-665).
- **A5.6** `save` on a **temp** `.p8mod` (under `globalStorage/temp_p8mod`) opens
  a save dialog (stubbed dest), writes there, unlinks temp, reopens saved
  (cartEditorProvider.ts:643-661).
- **A5.7** `revert` re-parses file, clears `currentCode`
  (cartEditorProvider.ts:679-690).
- **A5.8** `metaChanged` on a `.p8/.p8.png` doc persists a `.meta.json` companion;
  on a `.p8mod` doc it does **not** write a companion (inline on save)
  (cartEditorProvider.ts:305-329).

### A6. Run / Stop (fake pico8)
- **A6.1** With `pico8Path` set to the stub, `pico8ide.runGame(gameItem)` spawns
  the stub with `-run <cart>`; `pico8RunState` becomes true; stub log records the
  cart path (extension.ts:976-981).
- **A6.2** `.p8mod` run path: writes a temp `.p8` under `globalStorage/temp_run`,
  prepends the `_txi/tx/txw` stubs, spawns on the temp path (extension.ts:960-974).
  Assert the temp `.p8` exists and contains the stub prelude.
- **A6.3** `stopGame` kills the process; `pico8RunState` → false; on POSIX the
  process group is signalled (extension.ts:993-1010).
- **A6.4** Running while already running stops the previous first
  (extension.ts:929-931).
- **A6.5** `pico8Path` unset → warning message shown; declining leaves state
  unchanged, no spawn (extension.ts:936-948). *(Stub `showWarningMessage` → 'No'.)*
- **A6.6** `pico8Path` set but file missing → `pico8PathNotFound` error, no spawn
  (extension.ts:950-953).
- **A6.7** `runGame` argument resolution fallbacks: string path runs directly;
  no-arg falls back to `currentSelectedGame` → `currentGame` → active `.p8`
  editor → active `.p8.png` tab (extension.ts:1016-1042). One case per branch.
- **A6.8** Editable-webview run: a `run` message from the `.p8mod` editor saves a
  companion `.p8` next to the source, then runs it (cartEditorProvider.ts:228-243).

### A7. Fork
- **A7.1** `forkGame(gameItem)` with a workspace open + a `.p8mod` **source**
  fixture: save dialog (stubbed) → writes the source `.p8mod` verbatim, opens it
  in the p8 editor (extension.ts:1063-1104).
- **A7.2** Fork when only a `.p8` source exists → converts via
  `p8ToCartData`→`cartDataToP8Mod` (extension.ts:1069-1072).
- **A7.3** Fork with no source artifact → falls back to decoding the runtime
  `.p8.png` cart into `.p8mod` (extension.ts:1088-1100).
- **A7.4** Fork with **no workspace open** → `forkNoWorkspace` error, no write
  (extension.ts:1057-1061).
- **A7.5** Filename sanitization: a game name with `/ \ : * ? " < > |` and spaces
  yields a safe `<=64`-char `.p8mod` default name (extension.ts:1078).

### A8. New / demo / open-with / text-editor commands
- **A8.1** `newP8Mod`: save dialog (stubbed) → writes `blankP8Mod()`, opens in
  p8 editor; file parses via `p8ModToCartData` (extension.ts:1161-1173).
- **A8.2** `showI18nDemo`: writes `i18nDemoP8Mod()`, opens; parsed cart has i18n
  metadata (extension.ts:1176-1188).
- **A8.3** `openWithP8IDE(.p8 uri)`: converts to a temp `.p8mod` under
  `globalStorage/temp_p8mod`, opens it (extension.ts:1119-1137). Assert temp file
  exists and round-trips.
- **A8.4** `openWithP8IDE(.p8.png uri)`: decodes then converts, carries
  `loadMetaData` companion if present (extension.ts:1119-1121).
- **A8.5** `useTextEditorForP8`: sets `workbench.editorAssociations["*.p8"]="default"`;
  the offered Undo restores the prior association (extension.ts:1144-1157).
  *(Stub the info-message return to the Undo label to exercise the revert.)*
- **A8.6** `installAgentSkills`: with a workspace open, copies
  `resources/.pico8ide-skills/p8mod-author` into `<ws>/.pico8ide-skills/` and
  writes the three thin wrappers (`.codex`, `.claude`, `.github`); leaves
  unrelated workspace skills untouched (SPEC §3 Bundled Agent Skills;
  extension.ts:1191-1193). Re-running overwrites only the known skill dir.

### A9. Export (`.p8mod` editor → `.p8.png`)
- **A9.1** `exportCart` with `lang` + `i18nLuaCode`: writes
  `<base>.<lang>.p8.png` next to the source; the emitted PNG decodes back (via
  `Pico8Decoder.decode`) to the same cart data plus injected i18n prelude.
- **A9.2** `exportCartBatch`: writes one `<base>.<lang>.p8.png` file for every
  declared language in `__i18n__.locales`, then posts `exportBatchComplete` with
  all paths.
- **A9.3** Batch error handling: a deliberately failing item lands in `errors[]`
  while other language outputs still write.
- **A9.4** Library includes: code with `--#include vec2` resolves through
  `libManager.resolveIncludes` before assembly — exported cart contains the lib
  code and no raw directive line (cartEditorProvider.ts:84-88, 400-411).

## 6. Tier B — Webview E2E (Playwright vs `dev:standalone`)

Boot: `npm run dev:standalone` (esbuild serve) → Playwright navigates to
`/src/webview/standalone/index.html`. The app mounts with `createMockInitData()`
and `__HOST_MODE__="standalone"` so `bridge` = `standaloneBridge` (no VS Code).
Assert on real DOM + canvas, not mocks.

- **B1. Tabs.** Clicking each tab header (`Code/Sprites/Map/SFX/Music/i18n/Export`)
  shows the matching panel; returning to Code triggers Monaco `layout()` (editor
  visible, sized) (SPEC §7 Tabs).
- **B2. Sprites.** Select pencil, set FG color by clicking a palette swatch,
  paint a pixel on the sprite canvas → status bar reflects `FG:n`, and the
  standalone bridge received a `gfxChanged` payload (spy on `standaloneBridge`).
- **B3. Sprite flags.** Toggle a flag filter button → overlay appears; hover a
  sprite → flag circles reflect its bits; in editable mode clicking a circle
  emits `flagsChanged` (SPEC §7.5).
- **B4. Map.** Pencil-place a tile; right-click eyedropper picks a tile;
  `mapChanged` emitted; lower-row (ty≥32) edit also emits `gfxChanged`
  (SPEC §7.6 change notification).
- **B5. SFX.** Bar mode: drag in the pitch area sets pitch; volume/effect rows
  edit; Tab toggles to tracker; keyboard note entry advances rows; `sfxChanged`
  emitted (SPEC §7.7).
- **B6. Music.** Toggle a channel checkbox, change SFX id with ◀/▶, toggle a
  Loop/Stop flag → navigator cell shows the flag border; `musicChanged` emitted
  (SPEC §7.8).
- **B7. i18n.** Load `demo_chinese`-style mock with `tx()` code; Scan populates
  the table; edit a translation cell → `i18nChanged`; Preview renders glyphs on
  the 128×128 canvas (SPEC §7.9).
- **B8. Export tab.** TemplatePicker shows 4 templates; selecting one updates the
  ExportPreview (160×205 canvas) (existing `exportComponents.test.tsx` at the DOM
  level, here as a real render).
- **B9. Read-only vs editable.** With `editable:false` mock, drawing tools are
  hidden and canvases do not emit change messages.

## 7. Tier C — Decoder & format golden (pure vitest, add to existing suite)

- **C1.** `Pico8Decoder.decode(<legacy :c: cart>)` → assert `code.length`,
  section hashes, and `label` prefix match the committed golden.
- **C2.** Same for a `\0pxa` cart.
- **C3.** Same for a raw (uncompressed) cart, if available.
- **C4.** `cartDataToP8` → `p8ToCartData` round-trip preserves gfx/map/sfx/music/
  flags/code (property-style over a fixture).
- **C5.** `cartDataToP8Mod` → `p8ModToCartData` round-trip preserves meta + i18n
  (extends existing `p8modFormat.test.ts`).
- **C6.** `Pico8Encoder.assembleRAM` + `encodeSteg` → `decode` round-trip
  (export path integrity, mirrors A9.1 without VS Code).

## 8. CI wiring

- Add a `test` job to CI (separate from release) that runs on push/PR:
  `npm ci && npm run compile && npm test` (Tier C, fast, gates every change).
- Add an `e2e` job: `xvfb-run -a npm run test:e2e` (Tier A) — Linux runner with
  `libnss3`/`libgbm` deps; download of VS Code cached by `@vscode/test-electron`.
- Tier B (`test:webview`) as its own job or folded into `e2e`; Playwright
  browsers installed via `npx playwright install --with-deps chromium`.
- Gate release on the `test` job (Tier C) at minimum.

## 9. Open questions / decisions for the user

1. **Scope of first slice.** Recommend Tier C + a thin Tier A vertical
   (A0 activation, A3 open+decode, A6 run/stop via fake pico8) as the first PR —
   proves both harnesses with the highest-risk coverage. Full A/B enumeration
   lands incrementally.
2. **Fixtures committed vs generated.** Committing 2–3 real `.p8.png` carts
   (~30–60KB each) makes tests deterministic and offline. Acceptable to vendor a
   few from `fcdb/platforms`, or generate synthetic carts via `Pico8Encoder`.
3. **Windows.** Run/stop stub is POSIX `sh`. Either add a `.cmd` stub or gate
   A6/A2 run cases to non-Windows CI.
4. **Webview drive-through in Tier A.** Posting messages *into* a real webview
   from a test is awkward; several A5/A9 cases assert at the provider/document
   layer (spying on `onDidChangeCustomDocument`, checking written files) rather
   than through the DOM. Tier B covers the DOM side. Confirm this split is
   acceptable, or we invest in a webview test-hook.
