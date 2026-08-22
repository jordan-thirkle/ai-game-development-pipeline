# Three.js/WebGPU live orientation-resize gate

This bounded gate proves only that the integrated BYJTT-LAB-001 production candidate survives a live mobile viewport/orientation transition without a runtime reload.

It starts real Chrome with touch/mobile emulation at 390×844 portrait, transitions the same running page to 844×390 landscape and back to portrait through Chrome device-metrics/orientation emulation, and requires the production canvas and touch controls to remain inside the viewport without document overflow. Normal production touch movement must still move engine-owned state after both transitions and settle within the existing release-drift bound.

The gate does not modify gameplay, renderer configuration, physics, shared benchmark constants, or production input code. It reruns the unchanged 13-step Phase A browser playthrough before the resize proof.

A green hosted run is browser compatibility evidence only. It explicitly does **not** prove physical phone/tablet execution, target-device performance, human playability, Phase B fidelity, publication, or release readiness.
