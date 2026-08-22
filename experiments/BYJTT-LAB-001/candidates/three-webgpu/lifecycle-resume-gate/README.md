# Three.js execution suspend/resume gate

This is a read-only runtime-resilience proof for the integrated Three.js/WebGPU BYJTT-LAB-001 candidate.

It rebuilds the unchanged production candidate, reruns the unchanged 13-step Phase A playthrough, then uses Chrome DevTools Protocol `Debugger.pause` and requires a real `Debugger.paused` event before holding JavaScript execution suspended for three seconds. It resumes the same live runtime with `Debugger.resume` and measures engine-owned state.

Pass criteria require exact-head execution, the known dependency graph before `npm ci`, normal `KeyD` movement before and after resume, bounded fixed-step catch-up after the confirmed suspension, finite in-arena player state, passive position stability, release stability, copy-isolated observations, and zero browser/page errors.

The first revision used `Page.setWebLifecycleState(frozen)` but was rejected as final evidence: Chrome accepted the command while the candidate's fixed-step simulation continued to advance, so that transport did not prove actual execution suspension in the hosted environment. The retained failed run is evidence about the proof transport, not a production gameplay defect.

The gate does not patch production source, change gameplay/physics/renderer settings, weaken shared constants, or expose a gameplay mutation shortcut. It proves deterministic browser execution suspension/resume resilience only. It does not prove physical-device backgrounding, browser tab lifecycle behavior, target-device performance, human testing, publication, or release readiness.
