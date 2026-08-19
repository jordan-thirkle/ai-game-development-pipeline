# BYJTT-LAB-001 — Babylon.js Phase A candidate

This lane evaluates Babylon.js as a batteries-included web game engine against the same neutral `mobile-action-slice-v1` contract used by the other candidates.

## Current status

**Tracer only. Not a Phase A pass.**

Implemented so far:

- WebGPU-first Babylon renderer initialization with WebGL fallback;
- official Havok Physics V2 initialization;
- primitive arena/player/enemy/salvage scene;
- read-only `window.__BYJTT_BENCHMARK__.snapshot()` tracer observations for renderer, Havok, startup, frames and errors;
- candidate-local Chrome tracer verifying boot, Havok readiness, frame advancement, portrait layout, console cleanliness and observation mutation isolation;
- pinned candidate-local package manifest, dependency decision record and explicit deviations.

Still required before Phase A can pass:

- full shared input/observation contract;
- player movement and camera semantics;
- enemy acquisition and bidirectional combat;
- salvage break/reward pickup/upgrade flow;
- normal save/restart restoration;
- browser automation through ordinary inputs only for the complete 13-step contract;
- full evidence artifacts and failure-preserving logs.

## Run locally

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run dev
```

The browser tracer additionally expects Playwright to be available and can be run against a preview server with `BABYLON_URL` and `BABYLON_ARTIFACTS` environment variables.

The branch deliberately does not modify shared benchmark assertions or other candidate subtrees.
