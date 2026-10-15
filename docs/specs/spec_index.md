# Pico8IDE Specification Index

| Spec Path | Owner | Level | Parent | Status |
|---|---|---|---|---|
| `docs/specs/PICO8IDE_SPEC.md` | pico8ide | product | `none` | Active |

## External Contract Dependencies

| Contract ID | Authority | Local Consumers |
|---|---|---|
| `xwsdk.p8mod` | the P8Mod contract | cart parse/serialize semantics, Draft/edit kernel, and cart-domain playable export consumed by the VS Code editor and `p8modtool` adapter |
| `xwsdk.release-artifacts` | the release-artifacts contract | Pico8IDE-owned `p8mod-web` vendor pin and refresh/verify commands |
