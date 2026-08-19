# Babylon.js solved-system baseline

Status: **Phase A tracer — not a benchmark pass**.

## Native-first decisions

- Renderer: use Babylon `WebGPUEngine` first, initialized asynchronously with `initAsync()`, and fall back to Babylon `Engine`/WebGL when WebGPU initialization is unavailable or fails.
- Physics: evaluate Babylon Physics V2 with the official `@babylonjs/havok` Web/WASM runtime before considering another physics library.
- Navigation: for the unobstructed single-enemy Phase A arena, direct steering remains the minimum acceptable implementation. Recast/navigation addons are introduced only when obstacle/pathfinding evidence requires them.
- Animation/import: Phase B should use Babylon's native glTF loader and animation system against the frozen shared assets rather than adding a generic animation framework.

## Current tracer questions

1. Does the exact pinned candidate build cleanly under Vite?
2. Which renderer backend actually initializes in hosted Chrome and on target devices?
3. Does Havok initialize reliably, and what startup/package cost does it add?
4. Does Babylon Physics V2 reduce controller/collision work enough to justify that cost?
5. Can the shared observation contract remain strictly read-only?

## Deliberate non-additions

No React, second renderer, second physics engine, generic ECS, backend, networking, or generic gameplay framework is added in Phase A by default.

## Evidence boundary

The current primitive scene proves nothing until executable browser evidence exists. Even after the full Phase A gameplay contract passes, production assets, animation fidelity, deployed-network behavior and real-device performance remain Phase B/device claims.
