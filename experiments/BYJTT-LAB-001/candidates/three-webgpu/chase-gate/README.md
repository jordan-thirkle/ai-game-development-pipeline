# Three.js Recast → Jolt Chase Gate

Bounded BYJTT-LAB-001 proof for issue #277.

This gate uses Three.js `0.185.1`, JoltPhysics.js `1.1.0`, and Recast Navigation `0.43.1`. Physical browser `KeyS` moves the player through Jolt `CharacterVirtual`; acquisition must remain false outside 12 m; only after legitimate acquisition does Detour compute the enemy route, which a second Jolt `CharacterVirtual` follows at the unchanged 2.7 m/s enemy speed.

The shared 24×32 m arena, `(0,0,10)` player spawn, `(0,0,-6)` enemy spawn, 3.5 m/s player speed, 12 m acquisition range, and 1/60 s simulation step are unchanged. There is no post-navigation or post-physics coordinate clamp and no combat behavior in this slice.

Evidence boundary: rendered-browser navigation-to-native-character chase only. Combat, progression, persistence, full Phase A, production assets, device/mobile profiling, performance readiness, and human playability remain unproven.
