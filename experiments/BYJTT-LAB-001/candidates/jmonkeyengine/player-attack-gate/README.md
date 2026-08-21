# jMonkeyEngine Minie player-attack gate

Bounded BYJTT-LAB-001 follow-on for issue #230, stacked on the exact execution-proven enemy-combat head from PR #222.

This gate preserves the shared 24×32 m arena, `(0,0,10)` player spawn, `(0,0,-6)` enemy spawn, 3.5 m/s player movement, 2.7 m/s enemy movement, 12 m acquisition range, player attack range 1.8 m, player attack damage 34, player attack cooldown 0.55 s, enemy attack range 1.6 m, enemy damage 20, enemy cooldown 1.1 s, and 60 Hz fixed simulation step.

The player and enemy are real Minie `PhysicsCharacter` instances. The player first moves legitimately through native character movement until the enemy is acquired; the enemy then closes distance through native character movement. Player damage is initiated only through a gameplay attack-action press/release state machine consumed during the simulation update. The proof harness never receives a health setter, never teleports either character, and never applies a post-physics arena clamp.

The first valid player attack must reduce enemy health from 100 to 66 while in range. An attack action before 0.55 s must not cause a second hit; the next valid attack after cooldown must reduce 66 to 32. During the same exchange, the already-proven enemy response must reduce player health from 100 to 80 and remain blocked by its 1.1 s cooldown during the player's second strike.

Evidence boundary: this is headless gameplay-action/combat integration. `external_input_executed=false` is deliberate: rendered physical keyboard delivery remains separately proven by PR #176 and is not silently promoted into this gate. Salvage, rewards, upgrades, persistence, full Phase A, production assets, profiling/device/mobile evidence and human playability remain unproven.
