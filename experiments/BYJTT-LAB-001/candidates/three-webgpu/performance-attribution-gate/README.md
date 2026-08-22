# Three.js/WebGPU hosted performance attribution gate

This bounded BYJTT-LAB-001 slice follows the integrated Three.js performance measurement without changing gameplay or render settings. It exists to determine what the GitHub-hosted Chrome result can actually tell us before any production optimization is attempted.

The gate rebuilds the existing production candidate, reruns the unchanged 13-step Phase A playthrough, and then executes the production bundle in real Chrome at 390×844. During idle and normal physical `KeyD` plus camera input it records requestAnimationFrame intervals, Chrome DevTools main-thread task/script/layout time, browser GPU/renderer information, engine-owned movement and release stability, screenshots, browser errors, dependency provenance and exact-head identity.

The classification is deliberately environment-scoped. A result such as `hosted-software-renderer-without-main-thread-saturation` means only that this hosted run showed software/virtualized renderer evidence while the measured main thread was not saturated. It is not a device-performance conclusion, optimization recommendation, human-playability claim, or release-readiness claim.

No shared benchmark constant, gameplay source, renderer setting, physics path, observation contract, or acceptance tolerance is modified by this gate. Dependency installation is fail-closed against the retained exact package-lock SHA-256 before `npm ci`.
