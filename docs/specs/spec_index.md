# Pico8IDE Specification Index

| Spec Path | Owner | Level | Parent | Status |
|---|---|---|---|---|
| `projects/pico8ide/docs/specs/PICO8IDE_SPEC.md` | pico8ide | product | `docs/specs/GLOBAL_SPEC.md` | Active |

## External Contract Dependencies

| Contract ID | Authority | Local Consumers |
|---|---|---|
| `xwsdk.p8mod` | `projects/xwsdk/docs/specs/p8mod_spec.md` | cart parse/serialize semantics, Draft/edit kernel, and cart-domain playable export consumed by the VS Code editor and `p8modtool` adapter |
| `xwsdk.release-artifacts` | `projects/xwsdk/docs/specs/release_artifacts_spec.md` | Pico8IDE-owned `p8mod-web` vendor pin and refresh/verify commands |
