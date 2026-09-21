# Pico8IDE Spec

**Version**: 0.1.0
**Status**: Active
**Level**: product
**Owner**: pico8ide
**Parent**: docs/specs/GLOBAL_SPEC.md
**Last Reviewed**: 2026-09-21

## Purpose

Define Pico8IDE as the PC PICO-8 authoring product: a VS Code extension that
browses FCDB carts, edits `.p8` / `.p8.png` / `.p8mod` sources, exports with
`p8modtool`, and runs a user-provided official PICO-8 executable.

## Scope

In scope:

- the VS Code extension identity, commands, custom editor, and webview cart
  surfaces;
- FCDB browse/search as a consumer of `projects/fcdb/docs/specs/fcdb_database_contract_spec.md`;
- `--#include` library resolution, cover templates, asset packs, and export
  provenance for the PC authoring path;
- the `p8modtool` CLI as the headless PC export adapter.

Out of scope:

- cart format, section semantics, structured editing kernel, and cart-domain
  playable export, owned by `projects/xwsdk/docs/specs/p8mod_spec.md`;
- handheld, Electron, Android, or XiaoweiOS application shells;
- other PICO-8 product jobs assigned by `docs/specs/pico8_product_landscape_spec.md`;
- agent game-craft doctrine, owned by `docs/specs/pico8_game_authoring_spec.md`.

## Authority And Ownership

Pico8IDE owns the PC authoring product. Job assignment across PICO-8 products
is owned by `docs/specs/pico8_product_landscape_spec.md`.

XWSDK P8Mod owns `.p8`, `.p8.png`, and `.p8mod` parse/serialize, Draft/edit
semantics, and cart-domain locale export. Pico8IDE must not invent a second
cart format. The current TypeScript parser/exporter under
`projects/pico8ide/src/extension/` is a product adapter for VS Code and
`p8modtool`; converging it onto the kernel is implementation work, not a rival
format authority.

`projects/pico8ide/docs/SPEC.md` is a reference snapshot of commands and export
mechanics. It is not canonical spec authority.

## Product Contract

- Pico8IDE runs only as a VS Code extension on a PC with an optional local
  official PICO-8 binary configured by the user.
- Editable source may be `.p8`, `.p8.png`, or `.p8mod`. `.p8mod` is the
  first-class localized and templated authoring form.
- Include ids in Lua stay unversioned (`--#include p8go`). Compatibility pins
  belong in optional metadata, not include lines.
- Cover templates, bundled libraries, fonts, and asset packs are Pico8IDE
  authoring assets. Cart-section bytes remain XWSDK cart-domain data.
- Running or stopping a cart uses the configured official PICO-8 process. The
  extension does not ship PICO-8 and does not replace it with Education JS,
  fake08, or a handheld wrapper.
- FCDB consumption stays product-local: Pico8IDE owns its supported schema
  declaration and package-ingestion evidence.

## Failure And External Contracts

- Missing or invalid PICO-8 path fails visibly for run/stop; browse and edit
  remain available.
- Invalid carts fail closed at parse/export rather than emitting partial
  playable bytes.
- Parent pin and submodule publication stay under
  `docs/specs/submodule_workflow_spec.md`.

## Validation Contract

- Required evidence: Pico8IDE unit, decoder golden, and extension-host or
  webview tests named by `projects/pico8ide/AGENTS.md` for behavior changes;
  canonical spec validators for this product root.
- Validation commands: `npm test` in `projects/pico8ide`, plus
  `node scripts/specs/validate-specs.mjs` after spec edits.

## Agent Contract

| Field | Contract |
|---|---|
| Governed files | `projects/pico8ide/**` except generated `out/` and ignored build artifacts |
| Invariants | Remain a PC VS Code authoring product; consume XWSDK P8Mod for cart format; keep libraries, templates, asset packs, and `p8modtool` here; do not add handheld, Electron, or Android shells |
| Validation | Run Pico8IDE focused tests for behavior changes and canonical spec validators for authority changes |
| Parent specs | `docs/specs/GLOBAL_SPEC.md`, `docs/specs/pico8_product_landscape_spec.md`, `projects/xwsdk/docs/specs/p8mod_spec.md` |
