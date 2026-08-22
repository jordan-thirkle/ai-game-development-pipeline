# Three.js no-WebGPU fallback runtime gate

This gate is an additive BYJTT-LAB-001 compatibility proof for the already integrated Three.js/WebGPU alpha. It does not modify gameplay or renderer configuration.

It builds the production candidate, reruns the unchanged 13-step Phase A playthrough, then launches a separate Chromium instance with WebGPU features disabled. The browser probe requires the real production observation bridge to report ready/gameplay-active state, a visible canvas, normal `KeyD` movement with bounded release drift, zero page/console errors, and copy-isolated observations.

The result is classified fail-closed:

- `webgl-fallback-proven`: `navigator.gpu` is unavailable and the Three renderer reports a WebGL backend while gameplay remains functional.
- `blocked-webgpu-still-exposed`: the browser flags did not actually remove WebGPU, so fallback was not proven.
- `blocked-no-rendering-fallback`: WebGPU was absent but the production runtime did not establish a WebGL fallback.

This evidence is browser-environment scoped. It does not prove target-device compatibility, performance readiness, HUMAN-TESTED status, Phase B, publication, or release readiness.
