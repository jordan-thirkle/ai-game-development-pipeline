# Three.js/Jolt packaging optimization gate

This gate is a reversible packaging experiment for the already-integrated BYJTT-LAB-001 Three.js/WebGPU candidate. It does **not** modify or replace production gameplay.

## Hypothesis

The current candidate mixes the root `three` namespace with `three/webgpu` and uses JoltPhysics.js's default `wasm-compat` entry point, which embeds the WASM payload into JavaScript. Current upstream guidance supports two lower-coupling packaging choices:

1. import the Three namespace from `three/webgpu` when using `WebGPURenderer`;
2. load `jolt-physics/wasm` with `jolt-physics/jolt-physics.wasm.wasm?url`, allowing Vite to emit the WASM payload as a separate asset.

## Evidence contract

The workflow must:

- assert the exact candidate head and exact retained npm graph before dependency execution;
- build and run the unchanged 13-step Phase A playthrough before any transform;
- fail closed unless the Phase A artifact's `candidate_head_revision` equals the actual checked-out `git rev-parse HEAD` for both baseline and optimized runs;
- retain baseline/optimized Phase A result copies plus wrapper metadata that records the checked-out head separately from the legacy `tested_revision` field (on pull-request runs, that legacy field is GitHub's event/merge SHA and is not used as standalone candidate-head identity);
- apply only the two packaging substitutions above to the checked-out `src/main.js`;
- build and run the same unchanged Phase A playthrough again;
- measure emitted JavaScript and WASM raw/gzip bytes before and after;
- require an emitted optimized WASM asset, at least 20% lower JavaScript gzip bytes, and no increase in combined JavaScript+WASM gzip bytes;
- restore `src/main.js` and prove no integrated gameplay-source mutation remains in the proposed diff;
- retain exact-head environment, dependency, build, runtime, transform, result, and SHA-256 evidence.

A green result is packaging-feasibility evidence only. It does not establish target-device performance, runtime speedup, human playability, Phase B fidelity, publication, or release readiness. Production adoption requires a separate reviewed integration slice.
