# Three.js/WebGPU target-device performance gate

Governor-aligned depth slice for BYJTT-LAB-001. This gate does **not** create another engine candidate and does not modify gameplay or `shared/**`.

## Purpose

GitHub-hosted Chrome has already been observed through software rendering, so hosted frame pacing cannot establish target-device performance. This gate makes that limitation executable and fail-closed:

1. build the unchanged integrated Three.js candidate;
2. rerun the unchanged 13-step Phase A playthrough;
3. launch real Chrome and record CDP GPU identity plus the candidate observation bridge;
4. exercise normal `KeyD` input and visible rendering;
5. reject SwiftShader/llvmpipe/software renderers as `blocked-software-renderer` rather than measuring them as target-device proof;
6. on a hardware-rendered target device, record startup and requestAnimationFrame pacing using the same runner.

## Target-device command

From `experiments/BYJTT-LAB-001/candidates/three-webgpu` after the exact dependency graph has been installed and `npm run build` has succeeded:

```bash
CANDIDATE_HEAD_SHA="$(git rev-parse HEAD)" \
BYJTT_REQUIRE_HARDWARE=1 \
BYJTT_CHROME_HEADLESS=0 \
node device-performance-gate/run-device-proof.mjs
```

A target-device pass requires a non-software renderer, `navigator.gpu`, a visible canvas, normal keyboard movement of engine-owned state, bounded release drift, zero browser/page errors, at least 120 frame samples, and exact revision identity. The runner records measurements but deliberately does not claim HUMAN-TESTED or release/performance readiness.

Hosted CI is expected to produce `blocked-software-renderer` when Chrome uses SwiftShader. That blocked result is valid environment evidence, not a device-performance pass.