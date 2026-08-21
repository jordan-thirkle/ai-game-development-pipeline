# jMonkeyEngine progression gate

Bounded BYJTT-LAB-001 proof for shared playthrough steps 07–09 only.

The gate uses jMonkeyEngine 3.9.0-stable with Minie 9.0.3. A native `PhysicsCharacter` starts at the shared `(0,0,10)` spawn and walks at the shared 3.5 m/s speed toward salvage at `(5,0,0)`. Salvage is broken only by the gameplay attack action while inside the shared 1.8 m range; its 34 health matches the shared 34 attack damage. Reward availability follows breakage, pickup occurs only after entering the shared 1.25 m radius, and the cumulative reward count becomes exactly 1. The damage upgrade is selected only through the gameplay interact action after the upgrade menu is exposed, producing effective attack damage `34 × 1.2 = 40.8`.

Shared contracts are read-only. There is no teleport movement loop, post-physics arena clamp, direct salvage-health setter, reward grant, upgrade grant, persistence shortcut, or physical-input claim. Observations are copy-isolated from engine/gameplay state.

Evidence is generated under `evidence/` by the candidate workflow and is bound to the exact checked-out PR head. This gate does not claim rendering, physical keyboard/controller/touch delivery, save/restart, full Phase A, production assets, performance/device evidence, or human playability.
