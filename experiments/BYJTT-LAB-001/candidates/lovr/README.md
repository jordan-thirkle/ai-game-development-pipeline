# LÖVR 0.19 native-physics feasibility gate

Bounded BYJTT-LAB-001 candidate for issue #148. This lane consumes the shared benchmark contract read-only and proves only current LÖVR runtime/native-physics feasibility.

## Frozen benchmark values

- arena: 24 m × 32 m
- player ground-space spawn: `(0, 0, 10)`
- walk speed: `3.5 m/s`
- fixed physics step: `1/60 s`
- dynamic player box: `0.8 × 1.8 × 0.8 m`
- east-wall inner face: `x = 12.0 m`
- expected player-centre collision ceiling: `x = 11.6 m`

The physics collider starts at `(0, 0.9, 10)` because the shared spawn is defined in ground-space while the box collider is centre-based.

## Solved-system choice

LÖVR 0.19 uses Jolt Physics internally. This gate uses `lovr.physics.newWorld`, engine-native box colliders, static collision tags, per-axis degrees-of-freedom locking, impulse-based movement and `World:update`. No post-physics position clamp or bespoke collision resolver is present.

Official LÖVR documentation warns that rewriting linear velocity every frame can interfere with collision forces, so the drive loop uses `applyLinearImpulse` to approach the shared target speed instead.

## Evidence boundary

This gate does **not** claim normal external input, rendered gameplay, a production character controller, navigation/combat, persistence, production assets, profiling, device/mobile execution, full Phase A or human playability. Missing evidence remains unknown.
