# Three.js Recast → Jolt enemy combat gate

Bounded BYJTT-LAB-001 follow-on to the execution-proven Three.js chase slice.

This gate preserves the shared benchmark constants and proves only this path:

1. physical browser `S` input moves the player through Jolt `CharacterVirtual`;
2. acquisition remains false until engine-owned separation crosses the shared 12 m threshold;
3. Recast/Detour supplies the enemy route;
4. native Jolt character motion chases at the shared 2.7 m/s speed;
5. enemy attacks only at or inside 1.6 m, applies 20 damage, and respects the 1.1 s cooldown.

The player starts at 100 health. The evidence oracle requires exactly two valid attacks, producing 100 → 80 → 60, with an intermediate 350 ms probe proving no premature second hit.

No direct health setter, position teleport, post-navigation clamp, or post-physics arena clamp is exposed. Observations are frozen/copy-isolated. This slice does not claim player attack, progression, persistence, production assets, device performance, or full Phase A completion.

Dependency bytes intentionally match the previously proven chase gate graph; CI materializes the lock, verifies its retained SHA-256 before `npm ci`, and asserts exact Three/Jolt/Recast versions.
