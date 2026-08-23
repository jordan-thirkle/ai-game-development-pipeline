# Three.js/WebGPU accessibility runtime gate

This is a bounded correctness proof for the already integrated BYJTT-LAB-001 Three.js/WebGPU alpha.

It does **not** change production gameplay, renderer code, Jolt physics, shared benchmark constants, or accessibility semantics. It builds the unchanged candidate, reruns the unchanged 13-step Phase A playthrough, then executes the production page in real Chrome at 390×844.

The gate checks:

- document language and title;
- accessible names for every visible button;
- visible button target boxes of at least 44×44 CSS px;
- Tab traversal across every visible button with no keyboard trap;
- browser focus-visible state on keyboard-focused controls;
- normal keyboard activation of the production Save and Pause/Resume buttons;
- programmatic status semantics for the player-visible save confirmation (`role=status` or an `aria-live` region);
- zero browser/page errors and exact-head evidence identity.

The status-message assertion follows WCAG 2.2's programmatic status-message requirement. A failure is blocker evidence, not permission to weaken the oracle.

Evidence boundary: browser accessibility correctness only. This is not HUMAN-TESTED, assistive-technology/device certification, target-device performance, publication, or release readiness.
