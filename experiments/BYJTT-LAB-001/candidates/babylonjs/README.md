# BYJTT-LAB-001 — Babylon.js Phase A candidate

This lane evaluates Babylon.js as a batteries-included web game engine against the same neutral `mobile-action-slice-v1` contract used by the other candidates.

## Current status

**Tracer only. Not a Phase A pass.**

Implemented so far:

- WebGPU-first Babylon renderer initialization with WebGL fallback;
- official Havok Physics V2 initialization;
- primitive arena/player/enemy/salvage scene;
- read-only `window.__BYJTT_BENCHMARK__.snapshot()` tracer observations for renderer, Havok, startup, frames and errors;
- pinned candidate-local package manifest and dependency decision record.

Still required before Phase A can pass:

- full shared input/observation contract;
- player movement and camera semantics;
- enemy acquisition and bidirectional combat;
- salvage break/reward pickup/upgrade flow;
- normal save/restart restoration;
- browser automation through ordinary inputs only;
- executable evidence artifacts and failure-preserving logs.

## Run locally

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run dev
```

The branch deliberately does not modify shared benchmark assertions or other candidate subtrees.
