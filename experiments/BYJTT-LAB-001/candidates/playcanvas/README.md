# BYJTT-LAB-001 PlayCanvas Phase A

Pinned: PlayCanvas `2.21.3`, Vite `8.2.1`, TypeScript `7.0.2`.

Current tracer: WebGPU-first device with WebGL2 fallback; frozen arena/spawns; portrait controls; keyboard/touch movement; pointer camera; normal gameplay start; basic attack/salvage/reward/upgrade flow; read-only benchmark observations; browser tracer using normal inputs.

Still required before Phase A completion: native Ammo/controller evaluation; navigation decision; enemy attack/player damage/reset; persistence/restart; all 13 shared playtest steps; particles/audio; full evidence records.

Current arena clamping and direct enemy steering are temporary tracer plumbing, **not** final physics/navigation evidence and must not be scored as a PlayCanvas advantage.

The candidate reads `../../../shared/contract.json` but does not modify shared benchmark files.

Commands: `npm install`, `npm run typecheck`, `npm run build`, `npm run dev`.
