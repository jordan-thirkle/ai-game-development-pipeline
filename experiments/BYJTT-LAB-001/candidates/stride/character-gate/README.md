# Stride 4.3 CharacterComponent gate

This is the bounded follow-up required by BYJTT-LAB-001 Stride issue #163 and parent PR #144. It advances from “the Stride Bepu package resolves and its backend executes” to the engine-integrated production character path.

## Solved-system choice

Stride 4.3.0.2507 ships `Stride.BepuPhysics.CharacterComponent`. Current upstream source implements movement through `CharacterComponent.Move(direction)`, which multiplies direction by the component `Speed`, and applies that velocity during the component's simulation update. Upstream Bepu tests attach `CharacterComponent` and `StaticComponent` instances as entity components under `SceneSystem.SceneInstance.RootScene` and observe their `BepuSimulation` updates.

This gate therefore uses that engine-native component and scene processor path. It does not build a replacement controller and does not call the Bepu solver directly.

## Shared contract preserved

- arena: 24 x 32 m;
- player ground-space spawn: `(0, 0, 10)`; the capsule entity centre is placed at `y=0.9` for the 1.8 m-tall collider;
- walk speed: 3.5 m/s;
- capsule radius: 0.4 m;
- east arena inner face: x=12 m;
- expected capsule-centre stop: x=11.6 m.

The character is driven with `CharacterComponent.Move(Vector3.UnitX)`, then released with `Move(Vector3.Zero)`. Position/contact state is observed read-only. There is no post-physics arena clamp, teleport loop, privileged gameplay mutation API, or acceptance-criterion change.

## Evidence boundary

A green run proves only that the pinned Stride engine can attach and execute its actual Bepu `CharacterComponent` against engine-native static scene colliders and stop at the shared arena wall.

It deliberately records `external_input_executed=false`: keyboard/controller/touch delivery is a later gate. Rendering quality, navigation, combat, persistence, production assets, profiler/device/mobile execution, full Phase A and human playability remain unproven.

CI must bind restore/build/runtime evidence to the exact candidate head and retain all failure logs/artifacts before any repair.
