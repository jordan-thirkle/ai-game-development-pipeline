# Stride 4.3 + Bepu feasibility gate

Issue: #143  
Parent benchmark: #2

This is a bounded additive BYJTT-LAB-001 candidate gate. It preserves the shared contract and owns only this candidate subtree plus its candidate-specific workflow.

## Solved-system baseline

- `Stride.BepuPhysics` is pinned to stable `4.3.0.2507`.
- The project targets .NET 10, matching the stable Stride package generation.
- Stride's current physics direction is the Bepu integration; the older Bullet integration is being phased out.
- Stride exposes `Stride.BepuPhysics.CharacterComponent` as its engine-integrated character path. This first gate loads that assembly/type for provenance, but does **not** claim that the Stride scene processor or `CharacterComponent` executed.

## Shared contract preserved

- world up: `+Y`
- arena: `24 x 32 m`
- contract player spawn: `(0, 0, 10)`
- walk speed: `3.5 m/s`
- fixed proof step: `1/60 s`

The capsule's simulated centre starts above the floor by its physical half-height while its horizontal contract spawn remains `(0, 10)`. No post-physics arena clamp is used.

## What this gate proves when execution is green

1. the exact stable Stride Bepu package restores under .NET 10;
2. nullable/analyzer/warnings-as-errors release compilation succeeds;
3. `Stride.BepuPhysics.CharacterComponent` is present in the resolved Stride assembly;
4. the Bepu backend resolved by that package executes a real dynamic capsule/static-wall simulation;
5. the shared east arena wall stops the capsule natively;
6. a copied observation can be mutated without changing authoritative physics state;
7. the result is tied to the exact checked-out candidate SHA and preserved with dependency/environment hashes.

## Local reproduction

```sh
dotnet restore StridePhysicsGate.csproj
dotnet build StridePhysicsGate.csproj -c Release --no-restore /warnaserror
dotnet run --project StridePhysicsGate.csproj -c Release --no-build -- artifacts/physics-gate/result.json
```

## Explicitly unproven

This backend/toolchain slice does not prove Stride `CharacterComponent` scene execution, external keyboard/controller input, renderer/Game Studio behavior, navigation, combat, salvage/upgrades, persistence/restart, shared production assets, profiling, mobile/device packaging, full Phase A, or human playability.

If retained, the next Stride slice must move upward from this backend proof and execute the engine-integrated `CharacterComponent` path rather than treating backend availability as equivalent evidence.
