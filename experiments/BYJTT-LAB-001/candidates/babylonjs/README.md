# BYJTT-LAB-001 — Babylon.js Phase A candidate

This lane evaluates Babylon.js as a batteries-included web game engine against the neutral `mobile-action-slice-v1` contract used by the other candidates.

## Current status

**Phase A implementation and expanded browser contract proven on candidate head `29ee92108e4e3a7a2a66be31219e47cb317978e4`.**

Run `32301836744` passed the original 13 shared gameplay steps plus the specification gates discovered during independent review: idle/walk/run states, real touch movement, hit reactions, deterministic VFX, synthesized audio feedback, interaction-driven reward pickup, immutable observation checks, mobile viewport checks, performance counters and Playwright trace capture.

Execution environment and packaging evidence:

- Google Chrome `151.0.7922.137`, Node `26.7.0`;
- renderer: `webgl2-fallback`; `navigator.gpu=true`;
- official Havok Physics V2 initialized with plugin version `2`;
- main JavaScript: ~1,249.57 kB minified / ~301.10 kB gzip;
- Havok WASM: ~2,094.56 kB / ~668.98 kB gzip;
- evidence artifact: `9383303209`;
- artifact SHA-256: `d51a6a732d256fda664facd1e6f03e43ad1cb350d56e829bc86481baafd49da1`.

## Implemented Phase A systems

- WebGPU-first Babylon initialization with clean WebGL2 fallback and non-fatal fallback diagnostics;
- minimum modular Physics V2 registration (`joinedPhysicsEngineComponent` + V2 registration) with official Havok;
- fixed-step deterministic player movement and camera controls;
- explicit procedural idle/walk/run states;
- real keyboard and touch movement paths;
- enemy acquisition, pursuit, bidirectional combat, hit reactions, death and normal respawn;
- deterministic mesh-spark visual feedback and synthesized WebAudio feedback;
- salvage destruction, explicit Interact-driven reward pickup and +20% damage upgrade;
- normal local save path and restored reward/upgrade state after reload;
- immutable `window.__BYJTT_BENCHMARK__.snapshot()` observations;
- candidate-local Playwright driver with screenshots, trace, logs and result JSON;
- pinned dependency/provenance and deviation records.

## Physics boundary

Havok Physics V2 owns the Phase A static arena/environment proof. Player and enemy locomotion use a deliberately thin deterministic game-specific kinematic layer because the greybox arena is unobstructed. This is an explicit maintainability/integration choice, not a claim that Havok drives character motion. A heavier Babylon character-controller or navigation solution should only be added when later collision/asset/pathfinding evidence requires it.

## Run locally

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run test:phase-a
```

## Evidence boundary

Phase A remains greybox benchmark evidence. Frozen shared production assets, production animation fidelity, obstacle-heavy navigation, deployed-network behavior, real-device renderer selection and sustained real-device performance remain Phase B/device claims. The branch must still pass final revision-exact and current-`main` landing validation before integration.
