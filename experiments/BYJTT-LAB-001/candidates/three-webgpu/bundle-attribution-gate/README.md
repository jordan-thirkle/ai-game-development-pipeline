# Three.js production bundle attribution gate

This is a bounded BYJTT-LAB-001 depth slice for the already integrated Three.js/WebGPU Phase A candidate.

## What it proves

The workflow rebuilds the existing production candidate with source maps, reruns the unchanged 13-step Phase A browser playthrough, and measures the emitted JavaScript bundle without changing gameplay or chunking.

Evidence includes:

- exact candidate head and exact retained npm graph;
- production JavaScript raw and gzip byte counts by emitted chunk;
- source-map `sourcesContent` attribution grouped into candidate source, `three`, `jolt-physics`, and other dependencies;
- the largest represented original-source files;
- production build log, Phase A log, dependency tree, result JSON, summary, and SHA-256 manifest.

The analyzer fails closed if production JS or source maps are missing, source maps contain no `sourcesContent`, or the candidate source / `three` / `jolt-physics` runtime dependencies are not represented.

## Interpretation boundary

Represented source bytes are **not** equivalent to minified byte ownership and are not a CPU/GPU/runtime-cost measurement. This gate does not claim target-device performance, an optimization success, human playability, Phase B fidelity, publication, or release readiness.

Any optimization based on this evidence must be a separate reviewable slice with before/after exact-head build and runtime evidence.

## Shared contract

`experiments/BYJTT-LAB-001/shared/**` remains read-only. The 390×844 reference viewport, 60 FPS target, gameplay constants, normal-input playthrough, and observation-only instrumentation rules are unchanged.
