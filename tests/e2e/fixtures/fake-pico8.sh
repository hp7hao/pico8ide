#!/bin/sh
# Fake PICO-8 for E2E: records invocation, then stays alive until killed so the
# extension observes a live process (pico8RunState=true). See docs/E2E_TEST_PLAN.md §3.
if [ -n "$PICO8_FAKE_LOG" ]; then
  printf 'cwd=%s args=%s\n' "$(pwd)" "$*" >> "$PICO8_FAKE_LOG"
fi
# Sleep in a way that dies promptly on SIGTERM (process group kill in stopGame).
sleep 300 &
wait $!
