# Three.js/WebGPU performance gate

This bounded BYJTT-LAB-001 slice measures the already integrated Three.js/WebGPU Phase A candidate on a GitHub-hosted Linux Chrome runner. It does not modify gameplay source or the shared benchmark contract.

The gate reuses the candidate production build and unchanged 13-step Phase A playthrough, then measures requestAnimationFrame timing at the shared 390×844 viewport during idle and normal physical keyboard movement/camera input. It records startup time, frame-interval distributions, a median-FPS comparison against the shared 60 FPS target, engine-owned movement/release stability, renderer identity, screenshots, browser errors, dependency provenance and exact-head hashes.

A green result means the performance measurement is valid and gameplay remained functional under the measured workload. It does **not** mean device/mobile performance readiness, human playability, Phase B production-asset fidelity, publication, or release readiness. Hosted-runner measurements are retained as one evidence class only.

Dependency installation is fail-closed: the workflow materializes the exact npm lock graph and refuses to execute dependencies until its SHA-256 matches `expected-lock-sha256.txt`.
