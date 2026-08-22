# jMonkeyEngine Recast → Minie chase gate

This bounded BYJTT-LAB-001 gate connects two already execution-proven jMonkeyEngine systems without modifying their precursor subtrees:

- Recast4j/Detour provides the enemy-to-player navigation path.
- Minie/Libbulletjme `PhysicsCharacter` owns player approach and enemy chase movement inside a native `PhysicsSpace`.

## Shared contract retained

- arena: 24 × 32 m
- player spawn: `(0, 0, 10)`
- enemy spawn: `(0, 0, -6)`
- player walk speed: 3.5 m/s
- enemy move speed: 2.7 m/s
- enemy acquisition range: 12 m
- fixed simulation step: 1/60 s

The initial separation is 16 m, so acquisition may not be manufactured at spawn. The player first approaches from its unchanged spawn through `PhysicsCharacter.setWalkDirection()`. The enemy remains idle while separation is above 12 m. Only after physical movement legitimately crosses the unchanged acquisition threshold does the gate build a Detour path and feed path-following increments to the enemy `PhysicsCharacter` at 2.7 m/s.

No position teleport is used to manufacture acquisition or chase. No post-navigation or post-physics arena clamp is present.

## Exact systems

- jMonkeyEngine `3.9.0-stable`
- Minie `9.0.3` / its resolved Libbulletjme backend
- Recast4j `recast` + `detour` `1.5.12`
- Java 17, `-Xlint:all -Werror`

## Evidence boundary

A pass proves headless navigation → native-character chase integration, acquisition timing, material chase distance reduction, release stability, arena containment, and copy-isolated observations on the exact candidate revision.

It deliberately records `external_input_executed=false` and `combat_executed=false`. Rendered/physical keyboard execution is separately owned by the rendered-input gate. Combat, persistence, full Phase A, production assets, profiling/device/mobile execution, and human playability remain unproven.
