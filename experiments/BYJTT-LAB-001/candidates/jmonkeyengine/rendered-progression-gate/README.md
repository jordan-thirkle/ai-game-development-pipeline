# BYJTT-LAB-001 jMonkeyEngine rendered progression gate

This bounded gate proves the shared salvage → reward → upgrade loop through a real jMonkeyEngine desktop window and physical OS keyboard events while movement remains engine-native through Minie `PhysicsCharacter`.

## Shared constants preserved

- arena: 24 × 32 m
- player spawn: `(0,0,10)`
- salvage spawn: `(5,0,0)`
- walk speed: 3.5 m/s
- attack: 34 damage at <= 1.8 m
- salvage health: 34
- pickup radius: 1.25 m
- reward count: 1
- upgrade: `damage-up-1`, ×1.2 damage => 40.8

## Solved systems

- jMonkeyEngine 3.9.0-stable owns rendering/window/input.
- Minie 9.0.3 / Libbulletjme owns character movement and arena collision.
- No custom collision solver, coordinate clamp, teleport movement loop, direct health setter, reward grant, or upgrade grant is exposed.

The workflow may poll `live-observation.json` only to decide when to release/press physical OS keys. That file is produced by the running engine from copy-only observations and is never accepted as a gameplay mutation channel.

## Evidence boundary

A pass proves rendered desktop execution, real physical keyboard delivery, native character movement, salvage break, radius-gated pickup, and physical interact upgrade selection. It does not prove unified navigation/combat/full Phase A, production assets, device/mobile profiling, or human playability.
