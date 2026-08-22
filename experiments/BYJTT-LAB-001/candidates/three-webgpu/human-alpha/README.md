# Three.js/WebGPU human-alpha gate

This bounded gate advances the already integrated BYJTT-LAB-001 Three.js/WebGPU Phase A candidate toward a **human-testable local alpha artifact**. It does not create another engine candidate and does not modify the shared benchmark contract.

## What this gate must prove

1. The exact candidate head is checked out and recorded.
2. The candidate dependency graph is materialized from exact direct pins, SHA-256 checked before dependency execution, and installed with `npm ci`.
3. The existing production build succeeds.
4. The existing unchanged 13-step Phase A Chrome playthrough succeeds through normal gameplay input.
5. The exact `dist/` output is copied into a self-contained local playtest package with launch instructions and a file hash manifest.
6. The packaged build is launched through its bundled static server in real Chrome at 390×844.
7. The real candidate observation bridge becomes ready, a canvas is visible, the renderer backend is known, one normal `KeyD` press changes engine-owned player position, release drift remains bounded, and browser/page errors remain empty.

## Human handoff boundary

A green gate means the exact tested build can be handed to a person for local playtesting. It is **not HUMAN-TESTED evidence** and it is not a publication/deployment claim. A person must still run the package and provide the human playability/taste verdict required by the Governor.

The packaged bundle contains:

- `site/` — exact Vite production output;
- `serve.mjs` — dependency-free Node static server bound to `127.0.0.1` by default;
- `START.command` — macOS/Linux launcher;
- `START.cmd` — Windows launcher;
- `PLAYTEST.md` — controls and evidence boundary;
- `MANIFEST.json` — exact source revision and package metadata;
- `SHA256SUMS.txt` — package-file integrity hashes.

No test-only gameplay setter, direct state mutation, coordinate clamp, or save-state fabrication is introduced by this gate.