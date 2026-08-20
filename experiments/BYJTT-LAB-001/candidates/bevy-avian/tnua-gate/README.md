# Bevy 0.19 + Avian 0.7 + Tnua controller gate

This is a bounded follow-on to the Bevy/Avian native-physics tracer in PR #105. It tests whether a mature ecosystem controller removes production character-controller work without changing the shared BYJTT-LAB-001 benchmark.

## Pinned solved-system path

- Bevy `0.19.0`
- Avian `0.7.0`
- `bevy-tnua` `0.32.0`
- `bevy-tnua-avian3d` `0.12.0`

The upstream Tnua compatibility table maps Bevy 0.19 to Tnua 0.32 and Avian 0.7 to the 0.12 Avian integration. The implementation follows Tnua's current Avian pattern: dynamic Avian rigid body + collider, `TnuaController`, `TnuaConfig`, `TnuaAvian3dSensorShape`, and locked rotation.

Primary references checked 2026-08-20:

- https://docs.rs/crate/bevy-tnua/0.32.0
- https://docs.rs/bevy-tnua/0.32.0/bevy_tnua/
- https://github.com/idanarye/bevy-tnua/blob/main/examples/example_config_asset.rs
- https://docs.rs/crate/avian3d/0.7.0

## Shared contract mapping

The gate keeps the 24×32 m arena, logical ground-space spawn `(0,0,10)`, 3.5 m/s walking speed, and 18 m/s² horizontal acceleration. Tnua is a floating controller, so the rigid body's physics center starts at `y=0.95`; the result explicitly records both that physics-center coordinate and the unchanged logical ground-space coordinate.

Static Avian walls place their inner faces exactly at `x=±12` and `z=±16`. With the 0.4 m player capsule radius, the expected east-wall player-center stop is `x=11.6`. There is no post-physics position clamp or teleport movement loop.

## Proof boundary

The execution drives `TnuaBuiltinWalk` through the normal Tnua controller feed, advances real Bevy/Avian/Tnua systems at deterministic 60 Hz, then requires native wall stopping, release stability, and copy-isolated observations.

This gate deliberately records `external_input_executed=false`. It does not establish physical keyboard/controller/touch delivery, rendering, navigation/combat, persistence, production assets, profiling/device/mobile execution, full Phase A, or human playability.
