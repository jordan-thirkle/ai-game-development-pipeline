# Three.js hardware gamepad input gate

This is a proof-capable handoff for the integrated BYJTT-LAB-001 Three.js/WebGPU alpha. It does not add gamepad gameplay code and does not synthesize Gamepad API state.

The gate executes the unchanged production build in real Chrome, verifies the exact candidate head and retained npm graph, requires a visible production canvas, records browser/page errors, and asks the browser for `navigator.getGamepads()`.

A GitHub-hosted run with no physically attached browser-visible controller must produce `proof_state: blocked-no-hardware-gamepad`, `hardware_gamepad_observed: false`, and `gamepad_gameplay_mapping_proven: false`. That blocked result is valid environment evidence, not a gameplay-input pass.

A capable hardware runner may advance only when Chrome reports at least one connected, non-empty gamepad entry. Even then this gate proves device enumeration only; gameplay mapping, controller feel, target-device performance, HUMAN-TESTED status, and release readiness remain separate evidence requirements.

Shared benchmark constants and integrated gameplay are read-only.