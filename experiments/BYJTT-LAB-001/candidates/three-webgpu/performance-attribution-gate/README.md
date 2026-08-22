# Three.js/WebGPU hosted performance attribution gate

This bounded BYJTT-LAB-001 slice follows the integrated Three.js performance measurement without changing gameplay or render settings. It exists to determine what the GitHub-hosted Chrome result can actually tell us before any production optimization is attempted.

The gate rebuilds the existing production candidate, reruns the unchanged 13-step Phase A playthrough, and then executes the production bundle in real Chrome at 390×844. During idle and normal physical `KeyD` plus camera input it records requestAnimationFrame intervals, Chrome DevTools task/script/layout time, browser GPU/renderer information, engine-owned movement and release stability, screenshots, browser errors, dependency provenance and exact-head identity.

The classification is deliberately environment-scoped. It distinguishes broad Chrome `TaskDuration` from the narrower measured application script+layout time. In particular, a software renderer plus high browser task occupancy and low script+layout occupancy is recorded as `software-renderer-browser-task-saturation-low-script-layout`; this does not assert a device-side bottleneck or identify a production optimization.

## Failure / recovery retained

The first successful exact-head execution exposed an evidence-oracle defect rather than a gameplay failure. Chrome reported roughly a full sample window of `TaskDuration`, while `ScriptDuration + LayoutDuration` was only about 1–1.5% of the same window and the browser explicitly identified SwiftShader. Treating `TaskDuration` alone as application main-thread saturation would therefore overstate what the metric proves.

Recovery changed only the attribution classifier: it now records both broad browser task occupancy and narrow script+layout occupancy and carries an explicit caveat that `TaskDuration` includes browser/rendering work. The runtime requirements, 13-step prerequisite, renderer settings, gameplay implementation, benchmark constants, movement/release criteria and error gates were not changed.

No shared benchmark constant, gameplay source, renderer setting, physics path, observation contract, or acceptance tolerance is modified by this gate. Dependency installation is fail-closed against the retained exact package-lock SHA-256 before `npm ci`.
