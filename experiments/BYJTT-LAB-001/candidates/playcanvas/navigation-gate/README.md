# PlayCanvas Recast navigation gate

Bounded BYJTT-LAB-001 follow-on for issue #209. This gate evaluates the maintained `@recast-navigation/playcanvas` integration without modifying the integrated PlayCanvas candidate or its active native-physics migration.

## Fixed benchmark inputs

- arena: 24×32 m;
- enemy start: `(0,0,-6)`;
- player target: `(0,0,10)`;
- PlayCanvas baseline: `2.21.3`;
- Recast navigation packages: `0.43.1`;
- reference browser viewport: 390×844.

The generated solo navmesh is derived from PlayCanvas render geometry through `pcToSoloNavMesh`. Detour pathfinding is queried through `NavMeshQuery.computePath`. Returned observations are structured-cloned and frozen; the browser proof mutates only an observation copy and requires authoritative state to remain unchanged.

## Dependency provenance

The first CI execution generated the npm lock from the exact direct pins, uploaded that lock as evidence, and failed closed. Its observed SHA-256 is retained in `expected-lock-sha256.txt`. Every later execution regenerates the lock from the same manifest, requires its bytes to match that retained SHA-256 **before** `npm ci`, and archives the verified lock and full dependency tree again. Registry/dependency drift therefore fails closed instead of silently changing the executed graph.

## Evidence boundary

A green run proves only browser-executed PlayCanvas geometry → Recast navmesh generation → Detour path query feasibility for the unchanged benchmark spawns. It deliberately records `externalInputExecuted=false` and `postNavigationClamp=false`.

It does **not** prove integrated enemy steering, combat, persistence, full Phase A, production assets, performance/device/mobile behavior, or human playability.

Failed revisions remain part of the PR evidence trail; acceptance criteria and shared benchmark constants are not relaxed during recovery.
