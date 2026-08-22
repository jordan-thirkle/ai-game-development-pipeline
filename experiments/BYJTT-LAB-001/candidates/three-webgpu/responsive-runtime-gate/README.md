# Three.js responsive runtime gate

Governor-aligned depth proof for the already integrated BYJTT-LAB-001 Three.js/WebGPU alpha.

This gate does not modify gameplay. It executes the production build in real Chrome at the shared portrait viewport (390x844) and a landscape mobile viewport (844x390), then verifies:

- the real benchmark observation bridge reaches `runtime.ready`;
- the renderer canvas is visible and fills the viewport;
- the production HUD/control surface stays inside the viewport without horizontal overflow or clipped controls;
- normal keyboard movement changes engine-owned player state and normal release/deceleration stabilises;
- observations are copy-isolated;
- renderer/GPU identity and screenshots are retained;
- page/console errors fail the run.

Evidence is browser/runtime responsive viability only. It is not physical-device, accessibility-conformance, HUMAN-TESTED, performance-readiness, publication, or release-readiness evidence.
