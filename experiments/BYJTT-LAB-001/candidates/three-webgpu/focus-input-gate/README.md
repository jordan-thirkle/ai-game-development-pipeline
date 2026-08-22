# Three.js/WebGPU focus-loss input gate

This bounded gate probes the already integrated BYJTT-LAB-001 Three.js/WebGPU alpha for held-input safety when the page loses focus. It does not modify gameplay or shared benchmark contracts.

The production runtime stores held movement keys in its normal browser input path. This gate holds a real `KeyD`, proves engine-owned movement, dispatches the page's real `blur` lifecycle event without synthesizing a key release, and measures movement after focus loss. The harness always releases the physical key during cleanup.

A safe runtime must stop held movement promptly after focus loss. Continued movement is recorded as `blocked-focus-input-stuck`; it is blocker evidence, not a pass. No test-only setter, direct input-set mutation, gameplay state mutation, coordinate clamp, or benchmark tolerance change is introduced.

The integrated controller source is deliberately not changed here because another open candidate slice owns overlapping source. Once that ownership is free, the exact handoff is to clear held keyboard/touch movement state on focus loss and rerun this same gate plus the unchanged 13-step Phase A playthrough.
