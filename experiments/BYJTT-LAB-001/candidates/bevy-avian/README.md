# BYJTT-LAB-001 — Bevy 0.19 + Avian 0.7 feasibility tracer

Issue: #104

This candidate is additive because every original Benchmark 001 candidate subtree is currently integrated or owned by another active worker. It consumes the shared contract read-only and does not change benchmark constants.

## Current solved-system baseline

- Bevy `0.19.0`: current 2026 stable release selected for this gate.
- Avian `0.7.0`: Bevy 0.19-compatible ECS-native 3D physics generation.
- Avian `PhysicsPlugins`: real engine physics execution, using the same headless `MinimalPlugins` + `TransformPlugin` pattern exercised by Avian's own test suite.
- Four native static Avian colliders represent the shared 24 × 32 m arena.
- A dynamic Avian player body starts at `(8, 0, 10)` with the unchanged shared 3.5 m/s walk speed and is expected to stop at the east wall by collision response.

No manual/post-physics arena clamp is present.

## Execute

```sh
cargo generate-lockfile
cargo check --locked
cargo test --locked
cargo build --release --locked
BYJTT_EVIDENCE_JSON=bevy-avian-proof.json cargo run --release --locked
```

The GitHub proof workflow executes the exact pull-request head and uploads the generated lockfile, JSON result, toolchain metadata, dependency tree and logs.

## Evidence boundary

This first gate proves only headless Bevy/Avian toolchain and native-collision feasibility when the execution succeeds. It does **not** prove:

- external keyboard/controller/touch delivery;
- camera/rendering/WebGPU/browser behavior;
- a production character controller;
- enemy acquisition/navigation/combat;
- salvage/reward/upgrade or save/restart;
- shared production asset import/animation;
- profiler, mobile package, device, or human playtest quality;
- full 13-step Phase A conformance.

Avian 0.7 exposes `MoveAndSlide` character-controller primitives but explicitly does not provide a complete built-in character controller. That lifecycle gap remains benchmark evidence and must not be hidden by bespoke code before mature alternatives are evaluated.

## Reproducibility note

Direct Bevy and Avian versions are exact-pinned. This initial branch cannot commit a generated Cargo lockfile until a network-capable Rust execution environment resolves the full transitive graph. The workflow therefore generates the lockfile before any `--locked` build/test/run step and preserves that exact resolved lockfile as evidence. A later integration slice should commit the proven lockfile if this candidate is retained.
