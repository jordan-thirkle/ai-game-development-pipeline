# Babylon.js solved-system baseline

Status: **Phase A browser contract proven; final landing validation pending.**

## Native-first decisions

- Renderer: Babylon `WebGPUEngine` is attempted first with async `initAsync()`. A successful Babylon `Engine`/WebGL2 fallback is a supported outcome and is recorded as a non-fatal diagnostic rather than a benchmark failure.
- Physics: Babylon Physics V2 uses the official `@babylonjs/havok` Web/WASM runtime. Modular ESM requires the joined scene-physics registration plus the V2 component registration; this was isolated from upstream Babylon source rather than solved with a broad compatibility import.
- Character movement: Havok proves the static environment/collision system. The unobstructed Phase A arena uses a thin deterministic kinematic player/enemy locomotion layer; no heavier controller dependency is justified yet.
- Navigation: direct steering is sufficient for the single-enemy unobstructed Phase A arena. Recast/navigation addons are introduced only if later obstacle/pathfinding evidence requires them.
- Animation and feedback: Phase A uses explicit procedural idle/walk/run states, hit reactions, mesh-spark VFX and synthesized WebAudio. Phase B should use Babylon's native glTF/animation and production asset systems against the frozen shared assets rather than adding generic frameworks prematurely.
- Browser evidence: Playwright is pinned candidate-locally and drives ordinary keyboard, pointer/touch and UI input. The observation surface is read-only and separated from mutation/control paths.

## Phase A answers

1. **Does the pinned candidate build and execute?** Yes. The reviewed candidate passed install, Vite production build and the expanded browser contract.
2. **Which hosted renderer actually initializes?** Hosted stable Chrome reports `navigator.gpu=true`, while the successful Babylon execution uses `webgl2-fallback`. This is evidence about the hosted lane only, not target devices.
3. **Does Havok initialize reliably and what does it cost?** Yes in the proven hosted lane, reporting Physics V2 plugin version `2`. The reviewed build contains ~2,094.56 kB Havok WASM / ~668.98 kB gzip.
4. **Did native Physics V2 eliminate all controller work?** No. Havok is valuable for the environment, while a small kinematic locomotion layer remains clearer for this specific unobstructed Phase A scenario.
5. **Can the observation contract remain read-only?** Yes. The harness attempts to mutate returned observations and verifies subsequent snapshots remain unchanged.
6. **Can the complete neutral loop run through ordinary inputs?** Yes. The expanded pass includes all 13 shared steps, explicit Interact reward pickup, real touch movement, animation states, VFX/audio feedback, save/reload and restored-state verification.

## Deliberate non-additions

No React, second renderer, second physics engine, generic ECS, backend, networking, generic gameplay framework, third-party character-controller package or navmesh runtime is added in Phase A by default.

## Evidence boundary

The latest reviewed execution was run `32301836744` against candidate head `29ee92108e4e3a7a2a66be31219e47cb317978e4`, artifact `9383303209`, SHA-256 `d51a6a732d256fda664facd1e6f03e43ad1cb350d56e829bc86481baafd49da1`. Subsequent evidence-document commits require one final revision-exact execution before merge. Production assets, animation fidelity, deployed-network behavior and real-device performance remain Phase B/device claims.
