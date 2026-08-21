# PlayCanvas Recast enemy-chase gate

Bounded follow-on to BYJTT-LAB-001 PlayCanvas navigation proof (#209 / PR #210). This directory proves only the handoff from a maintained Recast/Detour path to bounded enemy chase in a real PlayCanvas browser runtime.

Shared contract values are unchanged: 24×32 m arena, player spawn `(0,0,10)`, enemy spawn `(0,0,-6)`, player walk speed 3.5 m/s, acceleration/deceleration 18/22 m/s², enemy speed 2.7 m/s, 12 m acquisition range, and fixed 1/60 s simulation.

The player crosses the acquisition boundary through normal browser `KeyS` input handled by application key listeners. No observation bridge mutates gameplay. Once acquired, Detour computes the path and the enemy follows that path at no more than 2.7 m/s. There is no post-navigation or arena position clamp.

Evidence boundary: this is navigation-to-chase integration only. It is not physics collision, combat, persistence, full Phase A, production assets, device profiling, or human playability.

The package metadata intentionally matches the parent navigation gate byte-for-byte so the exact previously proven dependency lock can be reconstructed and hash-verified before `npm ci`; changing that graph must fail closed.
