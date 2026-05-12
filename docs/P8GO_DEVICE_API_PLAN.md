# PICO8GO Device API Plan

Version: 0.1.0
Date: 2026-05-12

## Purpose

PICO8GO needs a small, capability-gated device API for carts that want to use handheld-specific features while remaining safe on stock PICO-8. The initial feature set is vibration, IPC with local services, and achievements.

This plan covers three delivery areas:

- `projects/pico8ide`: authoring support, Lua runtime API, validation, export/run packaging.
- `projects/pico8go`: target-device bridge that implements the API against the handheld OS.
- `projects/fcdb` and `projects/fcdbtool`: metadata and release pipeline for enhanced carts.

## Constraints

- Stock PICO-8 carts cannot open sockets, spawn processes, or call OS APIs directly.
- Transport must not suspend PICO-8 during gameplay. Suspending or stop-and-read memory is only acceptable for debug/offline inspection.
- `printh()` can introduce delay because it may write to local files. It is useful for debug and rare events, not smooth 60 FPS device control.
- A 60 FPS frame budget is about 16.7 ms. Vibration and live IPC should target less than one frame of added latency.
- The API must no-op safely when the bridge is not present.

## Game API V0

```lua
--#include p8go

p8go.has("vibration")
p8go.has("ipc")
p8go.has("achievements")

p8go.vibe(ms,strength)
p8go.vibe_stop()

p8go.ipc_send(channel,payload)
local msg=p8go.ipc_recv(channel)

p8go.ach_unlock(id)
p8go.ach_progress(id,value,target)
```

Rules:

- `p8go.has(name)` returns `false` if the bridge is absent or the capability is disabled.
- `p8go.vibe(ms,strength)` clamps duration and strength and is rate-limited.
- IPC payloads start as short strings. JSON should not be part of the cart runtime API unless the token/runtime cost is justified.
- Achievement events are idempotent. Repeated unlocks must not duplicate notifications or corrupt state.

## Manifest V0

Enhanced carts should ship a sidecar manifest:

```json
{
  "schema": "p8go.manifest.v0",
  "gameId": "example_game",
  "capabilities": ["vibration", "ipc", "achievements"],
  "ipcChannels": ["music", "system"],
  "achievements": [
    {
      "id": "first_jump",
      "title": "First Jump",
      "description": "Jump once",
      "hidden": false
    }
  ]
}
```

The manifest is used by pico8ide for validation/export, by fcdb for release metadata, and by pico8go for bridge permissions.

## Transport Strategy

Preferred transport order:

1. Live shared-memory/mailbox bridge that can be read and written while PICO-8 continues running.
2. pico8go launcher/runtime hook if shared memory is not reliable.
3. File/save-data polling only for slow state such as achievements.
4. `printh()` only for development logging and rare events.

Rejected for live features:

- Stop-and-read process memory.
- Per-frame synchronous file logging.

## Mailbox Sketch

Reserve a small PICO-8 memory area for packets. Final addresses must be confirmed by feasibility testing.

```lua
-- cart -> host packet sketch
poke(base+0,version)
poke(base+1,seq)
poke(base+2,cmd)
poke(base+3,len)
-- payload bytes follow
```

Command IDs:

- `1`: vibration request
- `2`: vibration stop
- `3`: IPC send
- `4`: achievement unlock
- `5`: achievement progress
- `128..255`: host-to-cart responses/events

Bridge requirements:

- Bounded queues.
- Sequence numbers to avoid duplicate dispatch.
- Capability and channel allowlists from manifest.
- Clean shutdown when PICO-8 exits.

## pico8ide Work Items

1. Add this API to the authoritative pico8ide spec.
2. Add bundled `resources/libs/p8go.json` runtime library.
3. Add Monaco completions and docs for `p8go.*` calls.
4. Add manifest parsing/validation for `.p8go.json`.
5. Validate achievement IDs and IPC channel names referenced by code where practical.
6. Ensure run/export includes the runtime library and sidecar manifest.
7. Add a desktop bridge simulator for development logs and tests.

## pico8go Work Items

1. Add a `p8go_device_bridge_spec.md` spec.
2. Build a bridge feasibility benchmark against native PICO-8.
3. Implement bridge lifecycle in the launcher/device runtime.
4. Implement live mailbox transport if feasible.
5. Implement vibration driver mapping with clamp/rate-limit behavior.
6. Implement IPC broker with manifest allowlists.
7. Implement achievement persistence and optional notifications.
8. Add debug logs and a bridge status view/command.

## fcdb / fcdbtool Work Items

1. Extend metadata with p8go enhancement fields.
2. Copy sidecar manifests into release artifacts.
3. Validate manifests during build/pack.
4. Add curated list support for PICO8GO-enhanced carts.
5. Preserve `ref_id` links from enhanced mods to original carts.
6. Update pico8go FCDB browser to show an enhanced badge and prefer enhanced artifacts on the target device.

## Feasibility Tests

The first tests use `/home/hp/apps/pico-8/pico8` with an isolated `-home` directory.

Test commands should prefer headless execution:

```bash
/home/hp/apps/pico-8/pico8 -home /tmp/p8go-pico8-home -x projects/pico8ide/tests/p8go_probe/p8go_probe.p8
```

If a window is required, keep it small and windowed:

```bash
/home/hp/apps/pico-8/pico8 -home /tmp/p8go-pico8-home -windowed 1 -width 128 -height 128 -draw_rect 0,0,128,128 -run projects/pico8ide/tests/p8go_probe/p8go_probe.p8
```

Acceptance criteria before committing to live IPC:

- PICO-8 can run probe carts headless or in a tiny window for automated tests.
- The chosen bridge transport can observe cart-written state while the game runs.
- The bridge does not require suspending PICO-8 during gameplay.
- Added polling/dispatch does not visibly affect frame pacing or audio.

## Current Evidence

- Bundled PICO-8 manual documents `-x filename` as experimental headless cart execution.
- Bundled PICO-8 manual documents `-width`, `-height`, `-windowed`, `-draw_rect`, and `-home` command-line flags.
- Manual notes that Raspberry Pi `pico8_dyn` does not support GPIO/serial, so native GPIO assumptions must be tested rather than assumed.
- Local x86-64 native PICO-8 at `/home/hp/apps/pico-8/pico8` successfully runs a probe cart with `-x` headless mode and emits `printh()` output to stdout.
- A bounded host-side probe using `process_vm_readv` found a cart-written mailbox marker while PICO-8 continued running: `FOUND marker_addr=0xca64a1 scan_ms=2 bytes=00137038676f21140000000000000000`.
- The same `process_vm_readv` probe failed inside the Codex sandbox with `errno=1`, so bridge tests that inspect another process need normal host permissions or device-side launcher privileges.
- 5-second 60 Hz polling test: `reads=311 failed=0 changed=295 stagnant=15 backward=0 avg_read_us=7 worst_read_us=32`; host-to-cart write ack succeeded after 1 poll.
- 10-second 120 Hz stress polling test: `reads=1236 failed=0 changed=599 stagnant=636 backward=0 avg_read_us=5 worst_read_us=75`; stagnant reads are expected because polling is faster than the cart's 60 Hz update rate; host-to-cart write ack succeeded after 1 poll.
- 30-second 60 Hz stability test: `reads=1854 failed=0 changed=1777 stagnant=76 backward=0 avg_read_us=15 worst_read_us=77`; host-to-cart write ack succeeded after 1 poll.
- `p8mod` now has ignored real-memory tests that launch `/home/hp/apps/pico-8/pico8` with isolated `-home`, generate carts from the bundled `p8go_lua_runtime()`, and validate live mailbox discovery against native PICO-8.
- `p8mod` validated host-packet writes with a one-shot sentinel: `touch /tmp/p8go-real-write-after-discovery.ok` followed by `P8GO_PICO8_BIN=/home/hp/apps/pico-8/pico8 cargo test -p p8mod --features p8go-memory-bridge real_pico8_validated_host_write_readback -- --ignored --nocapture`.
- Cart-side consumption of host events is not yet part of the committed real test. The current committed write test proves bounded `process_vm_writev` into the validated host packet range and readback from the child process; the inbound Lua API needs a separately specified safe memory range and runtime contract.

## Feasibility Conclusion

The local x86-64 tests show the live-memory mailbox approach is feasible enough to become the primary bridge design, provided the pico8go launcher runs the bridge with normal process-inspection permissions on the target device.

The measured read cost is far below a 16.7 ms frame budget. The 30-second run had no failed reads and no backward sequence movement. Host-to-cart writes via `process_vm_writev` were observed by the cart on the next 60 Hz poll.

Remaining target-device risks:

- ARM native PICO-8 may arrange memory differently; marker discovery must scan rather than assume a fixed address.
- Kernel security policy may block `process_vm_readv`/`process_vm_writev`; the launcher may need same-user execution, `ptrace_scope` policy, or a controlled helper.
- Tests still need to run with real game audio/input and the target vibration driver active.
- The current prototype discovers a marker by scanning process memory. Production code should cache the found address per process and re-discover on cart restart.

## XWSDK Placement

The reusable parts should live in `projects/xwsdk/p8mod`:

- `p8go` manifest types and validation.
- Mailbox packet encoding/decoding.
- Memory marker constants and protocol versioning.
- PICO-8 runtime Lua source generation for `--#include p8go`.
- Optional native bridge helpers for Linux process memory read/write, gated behind non-WASM cfg/features.

The device-specific actions should not live in `p8mod`:

- Vibration dispatch belongs in `hal`/`platform` because xwsdk already has vibration abstractions.
- Achievements persistence likely belongs in `platform` or a future game-services module.
- pico8go launcher lifecycle and process ownership belongs in `projects/pico8go`.

This split keeps `p8mod` as the PICO-8 protocol/cart layer and lets pico8ide, pico8go, and fcdbtool share one schema/protocol implementation.

## Probe Files

- `projects/pico8ide/tests/p8go_probe/p8go_probe.p8`: short headless smoke test for `-x`, `printh()`, and clean shutdown.
- `projects/pico8ide/tests/p8go_probe/p8go_live_probe.p8`: long-running mailbox marker writer.
- `projects/pico8ide/tests/p8go_probe/p8go_mem_probe.c`: host-side `process_vm_readv` scanner used to prove a running PICO-8 process can be inspected without explicit stop/continue.

## Next Feasibility Step

The positive local tests should be repeated on the target ARM device:

1. Run the headless probe with the target native PICO-8 binary.
2. Run the 30-second 60 Hz memory polling test.
3. Run the validated host write/readback test with the one-shot sentinel.
4. Specify and run the cart-side host-event consumption test once the inbound Lua runtime contract is finalized.
5. Repeat while audio, input, and vibration are active.
6. Verify the bridge can run under the same launcher privileges that pico8go will use in production.

Only after the target ARM run passes should live vibration and IPC ship on device builds.
