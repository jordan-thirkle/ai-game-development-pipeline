# Wicked Engine v0.72.106 — native Jolt character gate

Issue: #151. Parent benchmark: #2. Shared foundation: #34 (read-only).

This bounded candidate proves only whether current stable Wicked Engine can be acquired reproducibly, strictly compile a small candidate against the engine, and execute the engine-integrated Jolt character path against the frozen BYJTT-LAB-001 arena constants.

## Solved-system decision

Wicked Engine v0.72.106 exposes native character physics through `RigidBodyPhysicsComponent::SetCharacterPhysics`, `wi::physics::MoveCharacter`, character ground-state queries, and `RunPhysicsUpdateSystem`. The release updates its Jolt backend to 5.6.0. This gate therefore uses the engine path directly instead of writing a bespoke collision/controller layer.

## Frozen inputs

- arena: 24 m × 32 m;
- world up: +Y;
- player ground-space spawn: `(0, 0, 10)`;
- walk speed: 3.5 m/s;
- fixed physics step: 1/60 s;
- player collision radius: 0.4 m;
- expected east-wall ground-space centre ceiling: x = 11.6 m.

Static engine rigid bodies place wall inside faces exactly at x = ±12 and z = ±16. The player is an engine character capsule. Movement is requested through `MoveCharacter`; the test never clamps or teleports the player after physics.

## Reproduction

The candidate workflow checks out the exact PR head, acquires Wicked Engine commit `27c0df160d738925474a2181d3f88bfd59edaefe` / tag `v0.72.106`, installs the Linux dependency declared by upstream, configures CMake, builds `byjtt_wicked_gate` with candidate warnings as errors, executes the engine physics gate, validates `result.json`, records hashes, and uploads evidence even on failure.

## Evidence boundary

This gate does **not** claim normal external keyboard/controller/touch delivery, rendered gameplay, enemy/navigation/combat, salvage/reward/upgrades, persistence/restart, shared production assets, profiling, mobile/device execution, complete Phase A, or human playability. A failed compile/runtime run is retained and repaired rather than converted into a pass by weakening the shared contract.
