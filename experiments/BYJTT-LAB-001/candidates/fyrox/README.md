# Fyrox 1.0 native-physics feasibility tracer

Issue: #125. Parent benchmark: #2.

This bounded candidate tests whether stable Fyrox 1.0.0 can supply reproducible native 3D collision plumbing for BYJTT-LAB-001 without requiring an editor activation environment.

## Shared constants preserved

- arena: 24 × 32 m
- player spawn: `(0, 0, 10)`
- walk speed: 3.5 m/s
- world up: +Y

The tracer creates four static Fyrox rigid-body walls with native cuboid colliders and one dynamic player rigid body with a native cuboid collider. Gravity is disabled for this horizontal collision-only gate. The player receives an initial +X linear velocity equal to the shared walk-speed constant; no post-physics arena clamp or position teleport is used to manufacture the stop.

## Proof commands

```sh
cargo generate-lockfile
cargo check --locked
cargo test --locked
cargo build --release --locked
cargo run --release --locked
```

`cargo run` writes `evidence/runtime-result.json` and fails if the native physics result does not stop the player at the east-wall non-penetration boundary.

## Evidence boundary

This proves only a real Fyrox Scene/native-physics feasibility gate when executed successfully on the exact candidate head. It does **not** prove full Phase A, normal external keyboard/controller input, production character-controller quality, rendering/editor/browser/mobile support, navigation, combat, persistence, production assets, profiling, device behavior, or human playability.

## Current solved-system rationale

Fyrox 1.0.0 is the first stable Fyrox release (March 2026). Its scene graph has first-class Rapier-backed 3D rigid bodies/colliders and `Scene::update()` advances physics directly, so bespoke collision infrastructure would be unjustified before testing the native path.
