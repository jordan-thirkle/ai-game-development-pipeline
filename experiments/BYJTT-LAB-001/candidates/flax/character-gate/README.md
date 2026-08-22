# Flax 1.12 native CharacterController gate

This bounded follow-on reuses the exact Flax 1.12.6912 runtime/toolchain foundation previously proven on `de47fdbcafdc3b509adf52d1a00adda22c58676a` and advances only the engine-native character/collision frontier.

## Engine-native path

The gate uses `FlaxEngine.CharacterController.Move(displacement)` and static `BoxCollider` arena geometry. Flax documents `Move` as a collide-and-slide operation constrained by collisions, and the official FPS sample drives the same API from fixed update. No bespoke penetration solver, post-physics arena clamp, or per-step position teleport is permitted.

Flax world units are centimetres. The shared benchmark values are converted without changing them:

- arena: 24 × 32 m -> 2400 × 3200 cm;
- player spawn: `(0,0,10)` m -> `(0,0,1000)` cm;
- player radius: 0.4 m -> 40 cm;
- walk speed: 3.5 m/s -> 350 cm/s;
- fixed step displacement: `350 / 60` cm.

The east wall inner face remains x=12 m, therefore the expected 0.4 m-radius controller centre stop is x=11.6 m (1160 cm).

## Fail-closed execution

The workflow verifies the official Flax Linux package SHA-256 before extraction or execution, compiles the candidate C# through the real Flax project toolchain, and requires an engine-emitted `BYJTT_FLAX_CHARACTER_GATE_RESULT` marker. A successful editor process without that marker is explicitly a blocker, not a gameplay pass.

## Evidence boundary

This slice can prove native headless CharacterController feasibility only. `external_input_executed=false` remains deliberate. Rendering, keyboard/controller/touch delivery, navigation/combat, persistence, production assets, profiling/device/mobile execution, complete Phase A, and human playability remain unproven.
