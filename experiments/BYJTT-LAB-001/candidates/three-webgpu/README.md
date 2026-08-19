# BYJTT-LAB-001 — Three.js/WebGPU Phase A

Status: implementation under execution test. Do not infer a pass from source presence.

## Scope

This candidate implements the Benchmark 001 Phase A greybox path with:
- Three.js r185 family / `WebGPURenderer`;
- JoltPhysics.js `CharacterVirtual` player controller;
- direct steering for the single unobstructed enemy;
- breakable salvage, reward, upgrade and normal local save path;
- mobile-shaped HUD and touch controls;
- ordinary keyboard/button-driven automated playtest;
- read-only benchmark observations.

## Local reproduction

From this directory:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run test:phase-a
```

The browser test expects stable Google Chrome to be available through Playwright `channel: 'chrome'`.

## Evidence boundary

Phase A may support claims about implementation velocity, engine/native-system leverage, QA ergonomics, build/startup behavior, custom/reused-code burden and gameplay-system maintainability.

It may not support final claims about the frozen shared asset pipeline, animation fidelity, production visual quality or production-content mobile performance.

The CI artifact is authoritative for the exact tested revision. The test writes `artifacts/phase-a/playtest-result.json`, screenshots and server log. Missing evidence remains unknown.
