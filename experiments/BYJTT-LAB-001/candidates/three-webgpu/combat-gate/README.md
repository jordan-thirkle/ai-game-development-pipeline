# Three.js Recast → Jolt Enemy Combat Gate

Bounded BYJTT-LAB-001 proof for issue #281.

This gate extends the separately proven Three.js Recast → Jolt chase architecture with enemy attack behavior only. Physical browser `KeyS` moves the player through Jolt `CharacterVirtual`; acquisition must remain false outside 12 m; Recast/Detour then supplies the chase route; a second Jolt `CharacterVirtual` follows at the unchanged 2.7 m/s enemy speed.

Combat keeps the shared enemy contract unchanged: attack range 1.6 m, damage 20, cooldown 1.1 s, player health 100. The enemy may attack only after legitimate acquisition/chase enters range. The gate requires health 100→80→60 with an explicit blocked-cooldown interval between attacks.

The shared 24×32 m arena, `(0,0,10)` player spawn, `(0,0,-6)` enemy spawn, 3.5 m/s player speed, 12 m acquisition range, and 1/60 s simulation step are unchanged. There is no post-navigation or post-physics coordinate clamp and no direct test health/position setter.

Evidence boundary: rendered-browser acquisition → native navigation → native-character chase → enemy attack/cooldown only. Player attack, progression, persistence, full Phase A, production assets, device/mobile profiling, performance readiness, and human playability remain unproven.
