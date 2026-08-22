# BYJTT-LAB-001 Three.js Recast navigation gate

Bounded navigation feasibility proof for Three.js/WebGPU.

- Three.js `0.185.1`
- `recast-navigation` / `@recast-navigation/three` `0.43.1`
- unchanged 24x32 m shared arena
- enemy `(0,0,-6)` to player `(0,0,10)`
- real Recast WASM navmesh generation and Detour path query
- strict TypeScript, production build, Chromium runtime, copy-isolated observations
- no post-navigation coordinate clamp

Evidence boundary: navigation path feasibility only. This does not claim integrated chase, combat, progression, persistence, full Phase A, device/mobile execution, production assets, performance readiness, or human playability.
