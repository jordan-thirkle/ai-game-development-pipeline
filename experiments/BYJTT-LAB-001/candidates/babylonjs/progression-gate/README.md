# Babylon.js progression gate

Bounded BYJTT-LAB-001 proof for shared steps 07–09 only: break salvage, collect the fixed reward, and select `damage-up-1`.

Shared values are copied unchanged from `shared/contract.json`: 24×32 m arena, `(0,0,10)` player spawn, `(5,0,0)` salvage spawn, 3.5 m/s walk speed, 34 attack damage, 1.8 m attack range, salvage health 34, pickup radius 1.25 m, reward count 1, and damage multiplier 1.2.

The Playwright proof uses only normal browser keyboard input (`W`, `D`, `Space`, `E`). It does not expose position, salvage-health, reward, or upgrade mutation helpers. Runtime observations are copy-only and mutation-isolation is verified in browser execution.

This gate intentionally does not claim native Havok character collision, enemy navigation/chase/combat, persistence, full Phase A, production assets, device/mobile profiling, or human playability. Those are separately owned frontiers.
