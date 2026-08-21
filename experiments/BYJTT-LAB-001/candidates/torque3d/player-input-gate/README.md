# Torque3D 4.0.3 native Player + physical-keyboard gate

This bounded BYJTT-LAB-001 slice tests Torque3D's solved engine-native desktop player path after the official package/runtime and OpenGL renderer were proven separately.

## Shared contract mapping

The shared contract remains read-only. Torque3D uses Z-up, so logical BYJTT `(x, y-up, z-depth)` maps to Torque `(x, y-depth, z-up)`. The logical player spawn `(0, 0, 10)` is therefore Torque `(0, 10, 0)`.

Unchanged values exercised here:
- arena: 24 m × 32 m;
- player logical spawn: `(0, 0, 10)`;
- player width: 0.8 m (0.4 m half-width);
- walk speed: 3.5 m/s;
- east wall inner face: x = 12.0 m;
- expected player-centre stop: x = 11.6 m.

## Solved-system path

- proper Torque `Game` module and `LevelAsset`;
- engine-native `PlayerData` / `Player` controlled by the local `GameConnection`;
- engine-native `ActionMap` keyboard binding for `D`;
- four static `TSStatic` walls using the packaged unit cube asset;
- engine-owned `Player` collision/movement; no post-movement coordinate clamp or repeated `setTransform` movement loop.

`setTransform` is used exactly once to establish the required initial spawn before control is handed to the engine.

## Evidence boundary

A pass proves rendered Linux desktop execution, physical OS keyboard delivery into the normal Torque input path, and native Player collision/release stability on the exact candidate head. It does not prove camera/game feel, touch/controller/mobile, enemy/navigation/combat, salvage/reward/upgrade, persistence, full Phase A, production assets, performance/device readiness, or human playability.
