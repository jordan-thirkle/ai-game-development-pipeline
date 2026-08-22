# Three.js integrated touch-input gate

This additive BYJTT-LAB-001 gate proves only that the already integrated Three.js/WebGPU alpha accepts touch/pointer input through its production on-screen controls.

## Scope

- Reuse the existing Three.js `0.185.1` + Jolt `1.1.0` candidate unchanged.
- Rebuild the production candidate and rerun the unchanged 13-step Phase A playthrough first.
- Launch real Chromium at the shared 390×844 viewport with `hasTouch: true` and `isMobile: true`.
- Exercise the actual production `data-hold`, `data-tap`, and Save controls with pointer events whose `pointerType` is `touch`.
- Require engine-owned player movement from the movement control, bounded release stability after normal deceleration, pause/resume state transitions, attack action state, a normal Save-button write through the game path, and copy-isolated observations.
- Retain screenshots, runtime/browser errors, exact candidate-head identity, dependency provenance, result JSON, and SHA-256 evidence.

## Evidence boundary

A pass proves browser touch-control delivery into the production alpha. It does **not** prove physical phone/tablet hardware execution, target-device performance, HUMAN-TESTED status, publication, Phase B fidelity, or release readiness.

The harness may add read-only DOM event counters and read the existing copy-only benchmark snapshot. It must not call gameplay setters, write localStorage directly, teleport actors, change health/progression, or modify shared benchmark constants.
