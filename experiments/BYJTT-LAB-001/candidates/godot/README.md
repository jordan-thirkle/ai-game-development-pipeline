# BYJTT-LAB-001 — Godot Phase A tracer

Benchmark pin: Godot `4.7.1-stable` (official release 2026-07-14, upstream commit `a13da4feb`).

## Current slice

This tracer intentionally proves only the first engine-native plumbing gate:

- loads the shared `contract.json` read-only from the benchmark root;
- builds the contract-sized arena with native `StaticBody3D` collision;
- uses native `CharacterBody3D` + `move_and_slide()` for player locomotion;
- drives gameplay only through declared Godot `Input` actions;
- exposes a copy-only `observe()` snapshot for benchmark assertions;
- provides a headless runtime tracer that verifies one-second movement, arena-wall collision, and observation mutation isolation.

## Evidence boundary

This is **not** full Phase A completion. Enemy acquisition/navigation/combat, salvage/reward/upgrade, save/restart, full 13-step automation, rendered screenshots/video, profiler evidence, production assets, animation import and device/export evidence remain unproven.

No third-party controller, physics, navigation, behavior-tree, save or UI framework is introduced in this slice. This follows the Godot solved-system baseline recorded on issue #38.

## Reproduction

From this directory with Godot 4.7.1 available:

```sh
godot --headless --path . --script tests/headless_tracer.gd
```

A passing run prints a single `BYJTT_RESULT={...}` record and exits `0`.
