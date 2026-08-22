# Three.js/WebGPU focus-loss input gate

This bounded gate probes the already integrated BYJTT-LAB-001 Three.js/WebGPU alpha for held-input safety when the page loses focus. It does not modify gameplay or shared benchmark contracts.

The production runtime stores held movement keys in its normal browser input path. This gate holds a real `KeyD`, proves engine-owned movement, then transfers browser focus to a second page in the same Chrome context with Playwright `bringToFront()`. The gate requires the production page's `document.hasFocus()` value to transition from `true` to `false` and requires the browser-generated `blur` event to report `isTrusted === true`. Only after that verified focus transfer does it measure continued engine-owned movement. The harness always returns focus to the production page and releases the physical key during cleanup.

If the configured runner cannot produce that real focus transition, the probe records `inconclusive-focus-transfer` and the workflow fails closed. A synthetic `dispatchEvent(new Event('blur'))` is not accepted as focus-loss evidence.

A safe runtime must stop held movement promptly after verified focus loss and may pass only as `focus-input-release-proven`. Continued movement is recorded as `blocked-focus-input-stuck`; it is blocker evidence and the workflow fails while still retaining artifacts. No test-only setter, direct input-set mutation, gameplay state mutation, coordinate clamp, or benchmark tolerance change is introduced.

The integrated controller source is deliberately not changed here because another open candidate slice owns overlapping source. Once that ownership is free, the exact handoff is to clear held keyboard/touch movement state on focus loss and rerun this same gate plus the unchanged 13-step Phase A playthrough.
