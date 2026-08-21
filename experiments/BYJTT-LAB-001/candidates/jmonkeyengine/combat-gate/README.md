# jMonkeyEngine Minie combat gate

Bounded BYJTT-LAB-001 follow-on to the execution-proven Recast→Minie chase head `575c97b8368c67c55cc4d79468b34a6590877fa0`.

## Contract held fixed

- arena: 24×32 m
- player spawn: `(0,0,10)`
- enemy spawn: `(0,0,-6)`
- player walk: 3.5 m/s
- enemy move: 2.7 m/s
- acquire range: 12 m
- enemy attack range: 1.6 m
- enemy damage: 20
- enemy cooldown: 1.1 s
- fixed step: 1/60 s

## Evidence target

The workflow reruns the unchanged parent chase gate first on the same exact candidate checkout. This additive gate then uses native Minie `PhysicsCharacter` movement from the original spawns, requires acquisition only after physical movement crosses 12 m, requires native-character chase into 1.6 m, applies one 20-damage attack, proves no second attack is permitted before the 1.1 s cooldown, and permits the second attack only after cooldown while still in range.

Position observations are copies obtained from engine-owned physics state. There is no post-physics arena clamp, teleport chase loop, privileged gameplay setter, external-input claim, or player-attack claim.

## Evidence boundary

This is a headless enemy attack/cooldown integration proof after the separately proven Recast→Minie chase. Rendering/physical keyboard, player attack, hit-reaction presentation, salvage/reward/upgrades, persistence, full Phase A, production assets, profiling/device/mobile evidence, and human playability remain unproven.
