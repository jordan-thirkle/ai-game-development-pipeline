# Three.js/WebGPU paused-input correctness gate

This additive gate tests one production correctness boundary on the unchanged integrated BYJTT-LAB-001 Three.js/WebGPU alpha.

## Required behavior

1. Build the production candidate and rerun the unchanged 13-step Phase A browser playthrough.
2. In a fresh real Chrome runtime, use normal physical keyboard movement to enter the unchanged salvage attack range.
3. Pause through the production `Escape` input path.
4. Press and release physical `Space` while paused.
5. The paused action must not damage salvage while paused **and must not be retained/replayed after resume**.
6. Resume through physical `Escape` and observe the production copy-only benchmark surface.

A deferred attack after resume is `blocked-paused-attack-leak` and fails the workflow while evidence is retained.

## Boundaries

- Shared gameplay constants are read-only.
- This gate does not call `attack()`, mutate the production input set, set salvage health, teleport the player, or expose a gameplay setter.
- Production `src/**` and `index.html` are not modified by this slice.
- Browser automation is evidence transport only and must not claim HUMAN-TESTED, physical-device execution, publication, or release readiness.
- PR #99 owns overlapping integrated controller source. If the blocker reproduces, a later source-owning repair should discard queued gameplay actions across pause/resume, then rerun this exact gate plus Phase A.
