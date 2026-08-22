# Three.js loaded-runtime offline resilience gate

This bounded BYJTT-LAB-001 depth slice verifies the already-integrated Three.js/WebGPU alpha after connectivity is removed from an already-loaded production runtime.

The gate must first pass the unchanged 13-step Phase A browser playthrough. It then loads the production build in real Chrome, waits for `runtime.ready`, switches the browser context offline without reloading, and proves that normal keyboard movement, release stability, the normal Save control, and copy-isolated observations continue to work from engine/game-owned state.

It records requests seen after the offline transition and rejects browser/page errors. It does not patch `navigator.onLine`, intercept gameplay state, write localStorage from the harness, or expose a gameplay mutation API.

Evidence boundary: this proves loaded-runtime network-loss resilience only. It does not prove first-launch offline/PWA support, cached installation, physical-device execution, target-device performance, HUMAN-TESTED status, publication, or release readiness.
