# Flax 1.12 runtime handoff

This bounded BYJTT-LAB-001 lane owns only `candidates/flax/**` and its candidate workflow. Shared benchmark files are read-only.

## Solved-system baseline

- Runtime/editor pin: Flax `1.12.6912`.
- Official Linux package: `Package_1_12_06912/FlaxEditorLinux.zip`.
- Runtime proof path: official Flax Editor in `-headless -null -mute -std` mode.
- Future collision/controller proof, if this gate succeeds: engine-native `FlaxEngine.CharacterController`/PhysX before any bespoke movement solver.

## Unchanged shared contract snapshot

This candidate validator reads the canonical shared contract and fails unless it still reports a 24 x 32 metre arena, player spawn `[0, 0, 10]`, 3.5 m/s walk speed, +Y world up, 390 x 844 portrait viewport and 60 FPS target. The snapshot is not an alternate source of truth.

## Evidence boundary

The first slice proves only reproducible official-binary acquisition plus Flax headless project/toolchain execution on the exact PR head. It does **not** claim Phase A, character physics, normal player input, rendering, mobile/device performance, navigation, combat, persistence, or human playability.

The workflow bootstraps supply-chain provenance fail-closed: an unpinned binary may be downloaded and hashed, but is never extracted or executed. After its observed SHA-256 is committed, the exact revised head must rerun before any runtime claim is allowed.
