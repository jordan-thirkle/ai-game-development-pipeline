# PlayCanvas persistence/restart gate

Bounded BYJTT-LAB-001 slice for issue #298.

This gate proves only the browser persistence path. It uses PlayCanvas 2.21.3 for the rendered runtime, normal browser keyboard events for movement/attack/interact/save, browser `localStorage` behind the game-owned save action, and a full first-page close followed by a fresh second runtime in the same browser context.

Shared benchmark values remain unchanged: 24×32 m arena, player `(0,0,10)`, salvage `(5,0,0)`, 3.5 m/s walk speed, 34 damage at 1.8 m, salvage health 34, pickup radius 1.25 m, reward count 1, and `damage-up-1` ×1.2.

The proof harness may observe state and preserve browser storage across restart, but does not write the save, teleport the player, damage salvage, grant reward, or select the upgrade. Progression must be re-earned through `S`/`D`, `Space`, and `E`; save must be requested through `P`.

## Evidence boundary

A green result proves progression can reach the shared saved state through normal input, the game-owned save action writes the required document, and a fresh PlayCanvas runtime restores it within the 15 s contract. It does not claim native Ammo collision, Recast enemy chase, combat integration, full Phase A, production assets, device/mobile profiling, performance readiness, or human playability.

Dependency execution starts fail-closed. `expected-package-lock.sha256` is initially unset; CI materializes the exact graph, uploads it, and refuses dependency execution until its observed SHA-256 is pinned on a revised exact head.
