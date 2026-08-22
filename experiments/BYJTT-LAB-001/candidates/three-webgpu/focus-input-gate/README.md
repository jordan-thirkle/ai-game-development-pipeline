# Three.js/WebGPU focus-loss input gate

This bounded gate probes the already integrated BYJTT-LAB-001 Three.js/WebGPU alpha for held-input safety when the page loses focus. It does not modify gameplay or shared benchmark contracts.

The production runtime stores held movement keys in its normal browser input path. This gate holds a real `KeyD`, proves engine-owned movement, then runs headed Chrome under Xvfb and transfers browser focus to a second tab in the same Chrome context with Playwright `bringToFront()`. The gate requires the production page's `document.hasFocus()` value to transition from `true` to `false` and requires the browser-generated `blur` event to report `isTrusted === true`. Only after that verified focus transfer does it measure continued engine-owned movement. The harness always returns focus to the production page and releases the physical key during cleanup.

The first hardened revision intentionally rejected headless Chrome because activating a second page there did not make the production page lose document focus. That exact-head failure is retained as environment/proof-boundary evidence rather than weakening the oracle. If the configured headed runner still cannot produce the real focus transition, the probe records an inconclusive/failed focus-transfer result and the workflow fails closed. A synthetic `dispatchEvent(new Event('blur'))` is never accepted as focus-loss evidence.

A safe runtime must stop held movement promptly after verified focus loss and may pass only as `focus-input-release-proven`. Continued movement is recorded as `blocked-focus-input-stuck`; it is blocker evidence and the workflow fails while still retaining artifacts. No test-only setter, direct input-set mutation, gameplay state mutation, coordinate clamp, or benchmark tolerance change is introduced.

The integrated controller source is deliberately not changed here because another open candidate slice owns overlapping source. Once that ownership is free, the exact handoff is to clear held keyboard/touch movement state on focus loss and rerun this same gate plus the unchanged 13-step Phase A playthrough.
