# Evergine 2026 native Bullet CharacterController gate

This bounded BYJTT-LAB-001 slice evaluates the engine-native Evergine physics path only.

## Fixed benchmark values

- Arena: 24 m × 32 m
- Logical player spawn: `(0, 0, 10)`
- Player radius: 0.4 m
- Player height: 1.8 m
- Walk speed: 3.5 m/s
- Fixed reference step: 1/60 s

The physics-center spawn is `(0, 0.9, 10)` so the capsule rests on the logical ground plane without changing the shared ground-space spawn.

## Native solved systems

- `BulletPhysicManager3D` owns the scene physics world.
- `StaticBody3D` + `BoxCollider3D` own the floor and four arena boundaries.
- `CharacterController3D` + `CapsuleCollider3D` own character collision.
- Movement is issued only through `CharacterController3D.SetVelocity(Vector3)`.

No post-physics position clamp or teleport movement loop exists in this gate.

## Execution oracle

The proof drives +X velocity for 300 fixed steps, releases velocity for 60 fixed steps, and requires the engine-owned player transform to stop at the east-wall capsule-center boundary near x=11.6 m with bounded release drift. Observation-copy mutation must not alter engine-owned state.

## Evidence boundary

This gate proves only headless Evergine scene/Bullet/CharacterController movement and collision if its runtime workflow succeeds. It deliberately does not claim physical keyboard/controller/touch input, rendering, navigation/combat, progression, persistence, production assets, device/mobile profiling, full Phase A, or human playability.
