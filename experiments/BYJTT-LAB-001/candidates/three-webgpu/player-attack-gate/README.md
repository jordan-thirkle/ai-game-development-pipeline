# Three.js Jolt Physical Player Attack Gate

Bounded BYJTT-LAB-001 proof for issue #284.

This slice isolates the next player-combat frontier after the separately proven Three.js Recast→Jolt chase/enemy-combat work. The player begins at the unchanged `(0,0,10)` spawn and reaches the unchanged enemy `(0,0,-6)` through physical browser `KeyS` input and Jolt `CharacterVirtual` movement. No teleport or direct position setter is exposed.

Player attacks use physical browser `Space` press/release events consumed by the gameplay fixed-step action path. Shared constants remain unchanged: 34 damage, 1.8 m attack range, 0.55 s cooldown, enemy health 100. The proof requires 100→66, an immediate blocked repeat, then 66→32 only after cooldown. It also moves into the unchanged 1.6 m enemy range and requires one 20-damage enemy response, proving bidirectional damage without a direct health setter.

The shared 24×32 m arena, 3.5 m/s player speed, 1/60 s simulation step, observation-isolation rule, and prohibition on post-physics coordinate clamps remain unchanged.

Evidence boundary: rendered physical movement + physical player attack + cooldown/range/damage + one enemy response. This slice does not claim Recast execution, integrated chase, progression, persistence, full Phase A, production assets, device/mobile profiling, performance readiness, or human playability.
