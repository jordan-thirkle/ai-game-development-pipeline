# BYJTT-LAB-001 — Babylon.js Phase A candidate

This lane evaluates Babylon.js as a batteries-included web game engine against the same neutral `mobile-action-slice-v1` contract used by the other candidates.

## Current status

**Full Phase A implementation under adversarial execution. Not yet a Phase A pass until the complete 13-step browser lane succeeds.**

Proven bootstrap evidence:

- Babylon `WebGPUEngine` first with Babylon WebGL fallback;
- hosted stable Chrome selected `webgl2-fallback`;
- official Havok Physics V2 initialized with plugin version 2;
- modular ESM physics requires `joinedPhysicsEngineComponent` plus the V2 physics component; upstream source was used to isolate that registration requirement;
- browser tracer passed Havok readiness, frame advancement, portrait layout, console cleanliness and read-only observation mutation isolation;
- successful tracer readiness was ~423 ms on hosted CI;
- tracer build was ~1,238.73 kB JS minified / ~297.49 kB gzip plus ~2,094.56 kB Havok WASM / ~668.98 kB gzip.

Full Phase A implementation now includes:

- fixed-step deterministic player movement and camera controls;
- enemy acquisition, pursuit, damage exchange, death and normal player respawn;
- salvage destruction, reward collection and +20% damage upgrade;
- normal local save path and restored reward/upgrade state after reload;
- mobile-shaped touch controls;
- immutable `window.__BYJTT_BENCHMARK__.snapshot()` observations matching the neutral contract;
- candidate-local Playwright driver executing all 13 shared steps through ordinary inputs only;
- failure-preserving screenshots, logs and result JSON.

## Physics boundary

Havok Physics V2 owns the Phase A static arena/environment proof. Player and enemy locomotion use a deliberately thin deterministic game-specific kinematic layer because the greybox arena is unobstructed. This is an explicit maintainability/integration choice, not a claim that Havok is driving character motion. A heavier Babylon character-controller solution should only be added if later collision/asset/pathfinding evidence requires it.

## Run locally

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run test:phase-a
```

Phase A remains greybox evidence. Frozen shared assets, animation fidelity, final visuals and real-device performance are Phase B/device claims.
