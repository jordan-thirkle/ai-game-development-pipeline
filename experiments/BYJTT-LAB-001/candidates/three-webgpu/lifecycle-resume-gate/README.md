# Three.js lifecycle freeze/resume gate

This is a read-only runtime-resilience proof for the integrated Three.js/WebGPU BYJTT-LAB-001 candidate.

It rebuilds the unchanged production candidate, reruns the unchanged 13-step Phase A playthrough, then uses Chrome DevTools Protocol page lifecycle control to freeze the live page for three seconds and resume it.

Pass criteria require exact-head execution, the known dependency graph before npm ci, normal KeyD movement before and after resume, bounded simulation catch-up after the frozen interval, finite in-arena player state, release stability, copy-isolated observations, and zero browser/page errors.

The gate does not patch production source, change gameplay/physics/renderer settings, weaken shared constants, or expose a gameplay mutation shortcut. It proves browser lifecycle freeze/resume resilience only; it does not prove physical-device backgrounding, target-device performance, human testing, publication, or release readiness.
