# Three.js/WebGPU Phase A — Solved-System Decisions

## Renderer

**Selected:** Three.js r185 family (`three@0.185.1`) with `WebGPURenderer`.

Why:
- this lane exists specifically to measure the AI-editable/composable Three.js route;
- current Three WebGPU support can fall back to WebGL2 when WebGPU is unavailable;
- the test records both the actual backend class and `navigator.gpu` instead of assuming the hosted runner proves native WebGPU.

Rejected for this lane: replacing Three with Babylon/PlayCanvas. Those are independent benchmark candidates, not dependencies of this candidate.

## Physics / character controller

**Phase A incumbent:** `jolt-physics@1.1.0`, using Jolt `CharacterVirtual` directly.

Why it displaced the earlier Rapier assumption:
- JoltPhysics.js is active and published 1.1.0 in July 2026;
- the standalone `dimforge/rapier.js` repository was archived in July 2026, which is a lifecycle-maintenance signal even though the Rapier npm bindings remain usable;
- Jolt exposes a purpose-built virtual character controller and Three ships an official Jolt integration route;
- direct Jolt bindings keep controller/observation access available for the benchmark rather than hiding it behind an abstraction that may be too narrow.

**Fallback/comparison:** `@dimforge/rapier3d@0.19.3` only if execution shows Jolt's bundle/startup/debugging burden is materially worse.

## Navigation

**Selected for Phase A:** direct enemy steering.

The shared arena is unobstructed and the requirement is navigation/steering, not specifically navmesh pathfinding. Adding Recast before an obstacle/pathfinding requirement would measure dependency overhead rather than useful leverage.

Recast becomes a solved-system candidate when a later benchmark introduces obstacles, crowd navigation, off-mesh links, or pathfinding correctness requirements.

## Animation

Phase A uses greybox primitives and does not claim final animation fidelity. Three's native `AnimationMixer` is the Phase B baseline when the frozen shared animation assets arrive.

## Build / browser execution

**Selected:** Vite 8.2.1 + Playwright 1.62.1 driving installed stable Google Chrome in CI.

The browser harness operates through normal keys/buttons and reads only `window.__BYJTT_BENCHMARK__.snapshot()`. It is not permitted to teleport entities, set health, grant rewards/upgrades, or write save data.

## Decision status

These are Phase A incumbents, not promoted factory defaults. Execution evidence can reject any of them.
