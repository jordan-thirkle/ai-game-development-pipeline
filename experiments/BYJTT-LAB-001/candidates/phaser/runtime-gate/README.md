# Phaser 4 Arcade Physics runtime gate

Bounded BYJTT-LAB-001 feasibility slice for Phaser 4.1.0.

## What this proves

- strict TypeScript application code;
- production Vite build;
- real Chromium at the shared 390x844 viewport;
- normal browser `KeyD` input;
- Phaser Arcade Physics dynamic-body movement and static-wall separation;
- unchanged 24x32 m arena, `(0,0,10)` spawn, 0.4 m player radius and 3.5 m/s walk speed;
- native east-wall stop near x=11.6 m;
- release stability and copy-isolated observations;
- no post-physics coordinate clamp.

## Evidence boundary

This is movement/collision/rendered-browser feasibility only. It does not claim navigation, enemy/combat, salvage/reward/upgrades, persistence/restart, the complete Phase A playthrough, production assets, device/mobile profiling, or human playability.
