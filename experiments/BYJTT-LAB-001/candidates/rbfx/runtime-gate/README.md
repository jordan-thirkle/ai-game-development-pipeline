# rbfx native character feasibility gate

Bounded BYJTT-LAB-001 slice for issue #200.

## What this executes

- exact upstream rbfx revision `5dd5df44886220be53a8eb1a0f1be5f84a3e9e21`;
- rbfx `Scene` + `PhysicsWorld` with the engine-integrated Bullet backend;
- rbfx `KinematicCharacterController` using `SetWalkIncrement`, which upstream defines as displacement per physics simulation iteration;
- unchanged shared arena `24 x 32 m`, logical spawn `(0,0,10)`, player diameter `0.8 m`, walk speed `3.5 m/s`, and 60 Hz reference stepping;
- native floor and four static walls, 300 driven steps, then 60 released steps;
- machine-readable native wall-stop, release-stability, containment, and observation-isolation evidence.

No post-physics position clamp or test-only teleport is used. The observation-copy mutation probe mutates only a copied `Vector3`, then re-reads engine-owned state.

## Evidence boundary

This proves only rbfx engine/toolchain/native-character feasibility if the executable actually passes. `external_input_executed=false` is deliberate. Rendering, physical keyboard/controller/touch delivery, navigation/combat, progression/persistence, production assets, profiler/device/mobile execution, full Phase A, and human playability remain unproven.

Upstream currently describes rbfx as actively developed but not yet released, with C++ API changes still possible. That lifecycle risk is part of the benchmark rather than hidden.
