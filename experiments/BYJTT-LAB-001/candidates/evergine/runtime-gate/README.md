# Evergine 2026 runtime gate

Bounded BYJTT-LAB-001 feasibility probe for current Evergine 2026 packages.

## Frozen benchmark inputs

- arena: 24 × 32 m
- logical player spawn: `(0, 0, 10)`
- player radius: 0.4 m
- walk speed: 3.5 m/s
- physics fixed-step target: 1/60 s

## What this first slice proves

The workflow restores exact `Evergine.Framework` and `Evergine.Bullet` `2026.5.26.1667` packages on .NET 10, compiles with nullable analysis and warnings-as-errors, and executes real Evergine assemblies. The executable instantiates `Application`, `BulletPhysicManager3D`, `CharacterController3D`, `CapsuleCollider3D`, and `StaticBody3D`, verifies the documented `CharacterController3D.SetVelocity(Vector3)` API at runtime, and records the Bullet manager fixed timestep.

This is deliberately **not** a native-collision or movement pass. The machine result must keep `native_physics_world_executed=false`, `character_movement_executed=false`, `external_input_executed=false`, and `rendered_execution=false` until those capabilities are actually executed.

## Provenance bootstrap

The first PR run is expected to resolve and retain the NuGet dependency graph. If no committed `packages.lock.json` exists, the workflow uploads the generated lock as evidence and fails closed. A recovery revision may commit that exact resolved graph and rerun in locked mode; versions or benchmark constants must not be changed to make the gate pass.

Primary references checked 2026-08-21:

- Evergine 2026 major release: https://evergine.com/evergine-2026-major-release/
- Character controller: https://docs.evergine.com/2024.6.28/manual/physics/physics_bodies/character_controller.html
- Bullet physics manager: https://docs.evergine.com/2024.6.28/manual/physics/physicmanager_bullet.html
- current Evergine.Bullet package: https://www.nuget.org/packages/Evergine.Bullet/2026.5.26.1667

Next slice, if retained: construct and execute a real Evergine Scene with `BulletPhysicManager3D`, static arena geometry and `CharacterController3D.SetVelocity`, then measure native east-wall collision without a post-physics clamp.
