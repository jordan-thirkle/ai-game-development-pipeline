# Babylon.js navigation gate

Bounded BYJTT-LAB-001 solved-system proof for issue #242.

## Scope

This gate uses Babylon.js `RecastJSPlugin` plus the published Recast/Detour runtime to build a navmesh from an actual Babylon 24×32 m ground mesh and query a path from the shared enemy spawn `(0,0,-6)` to player spawn `(0,0,10)`.

It proves navigation-path feasibility only. It does not claim integrated chase, Havok character movement, external gameplay input, combat, persistence, Phase B assets, profiling/device/mobile execution, or human playability.

## Invariants

- shared arena/spawns are unchanged;
- no post-navigation coordinate clamp;
- test code reads a copy-only frozen observation;
- browser/page errors fail closed;
- strict TypeScript and production build must pass before runtime proof;
- exact PR head is asserted by CI and retained with evidence.
