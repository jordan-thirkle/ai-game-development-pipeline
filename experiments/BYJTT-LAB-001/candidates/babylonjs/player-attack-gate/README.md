# Babylon.js player-attack gate

Bounded BYJTT-LAB-001 slice proving the player attack path with Babylon.js 9.20.0 + Havok 1.3.14.

The gate preserves the shared 24x32 m arena, player `(0,0,10)`, enemy `(0,0,-6)`, 3.5 m/s movement, 34 damage, 1.8 m range and 0.55 s cooldown. Playwright sends normal browser `S` and `Space` keyboard events. Player locomotion uses Babylon `PhysicsCharacterController`; attack damage is consumed from the normal application key action during fixed-step simulation.

Evidence must prove strict TypeScript, production build, real Chromium execution, legitimate movement into range, first hit `100 -> 66`, an early cooldown-blocked press, a valid second hit `66 -> 32`, observation isolation, stable key release, no direct position/health setter, and no post-physics arena clamp.

This does **not** claim enemy navigation/chase, enemy combat, progression, persistence, full Phase A, mobile/device execution or human playability. Those remain separate evidence boundaries.
