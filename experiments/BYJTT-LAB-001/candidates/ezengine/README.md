# BYJTT-LAB-001 — ezEngine 26.3 Jolt feasibility gate

This additive lane is intentionally narrower than Phase A. It asks whether current stable ezEngine can be consumed reproducibly in a Linux CI environment and whether the exact Jolt backend shipped by the engine can execute the shared arena collision geometry without a candidate-specific position clamp.

## Frozen shared inputs

The candidate consumes the shared contract read-only:

- arena: 24 × 32 metres;
- contract ground-space player spawn: `(0, 0, 10)`;
- walk speed: 3.5 m/s;
- world up: +Y.

The physics capsule is 1.8 m tall with radius 0.4 m, so its body centre starts at `(0, 0.9, 10)` while preserving the contract ground-space spawn. The east arena boundary is at x = 12 m and the expected capsule-centre collision ceiling is x = 11.6 m.

## Solved-system choice

The gate links ezEngine's own `JoltPlugin`, which in turn links the Jolt dependency distributed by the engine. It does not add a second physics library. The executable directly exercises that bundled solver so native contact resolution can be measured independently of rendering/editor support.

The engine also exposes `ezJoltDefaultCharacterComponent`, but upstream describes it as an example FPS controller and notes that many games will implement or derive their own controller. This first gate therefore records `ezengine_character_component_executed=false`; a retained candidate must measure that controller/lifecycle boundary explicitly before claiming production character control.

## Evidence boundary

A green run proves only:

- exact ezEngine `release-26.3` source revision acquisition;
- strict candidate C++ compilation through the ezEngine CMake graph;
- engine `JoltPlugin` linkage and bundled Jolt execution;
- fixed-step native floor/wall collision under shared arena dimensions;
- no post-physics arena clamp;
- copy-isolated observations;
- exact candidate-head and upstream revision artifacts.

It does **not** prove normal keyboard/controller/touch input, ezEngine rendering or editor quality on Linux, a production character controller, navigation/combat, persistence, shared production assets, profiling/device/mobile execution, full Phase A, or human playability.

## Failure policy

Build/runtime failures are evidence. The workflow uploads environment/configure/build/runtime state even when the gate fails; fixes must stay inside this candidate lane and may not weaken the shared constants or convert missing execution into a pass.
