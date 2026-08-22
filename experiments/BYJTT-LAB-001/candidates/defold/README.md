# BYJTT-LAB-001 — Defold runtime tracer

This candidate subtree is a bounded Phase A tracer for issue #40. It does **not** claim full Benchmark 001 completion.

## Current proof target

The first slice proves only that the pinned Defold toolchain can build a real HTML5 engine bundle and that the launched engine can:

- become runtime-ready within the shared cold-start ceiling;
- receive normal keyboard input through Defold's input binding system;
- move the player using the shared `walk_speed`, `acceleration`, and `deceleration` constants;
- keep the player within the shared arena depth bound for the exercised path;
- expose copy-only/read-only observations to the browser without exposing gameplay mutators;
- reproduce the result in Chromium with exact-head and toolchain evidence.

## Explicitly not yet proved

- native 3D collision response;
- camera contract;
- enemy acquisition/navigation/combat;
- salvage/reward/upgrade loop;
- persistence/restart;
- frozen shared asset import/animation;
- profiler, real-device, packaging, or final mobile evidence.

Missing evidence remains unknown. Later slices must keep using normal player-visible inputs and may not add test-only gameplay mutation shortcuts.
