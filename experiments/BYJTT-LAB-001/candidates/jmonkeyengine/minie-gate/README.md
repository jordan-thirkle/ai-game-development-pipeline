# jMonkeyEngine Minie / Libbulletjme gate

This is a bounded follow-on to the jMonkeyEngine 3.9 feasibility tracer in PR #141. It evaluates the mature Minie/Libbulletjme path before any deeper jMonkeyEngine Phase A work.

## Pinned stack

- jMonkeyEngine core: `3.9.0-stable`
- Minie: `9.0.3`
- Java: `17`

Primary-source rationale checked on 2026-08-20:

- Minie describes itself as a more feature-complete, faster-moving Bullet integration for jMonkeyEngine with automated regression tests and fixes beyond `jme3-jbullet`.
- Minie `9.0.3` is the latest stable release recorded in its release log (2025-12-19).
- the `9.0.2` release immediately before it updated the native backend to Libbulletjme `22.0.3` and its jMonkeyEngine dependency to `3.8.1-stable`; this gate intentionally requests jMonkeyEngine `3.9.0-stable` directly and records the resolved Maven graph so compatibility is execution-tested rather than assumed.

Sources:

- https://github.com/stephengold/Minie
- https://github.com/stephengold/Minie/blob/master/MinieLibrary/release-notes.md
- https://github.com/jMonkeyEngine/jmonkeyengine/releases/tag/v3.9.0-stable

## Contract preserved

- arena: `24 x 32 m`
- player spawn: `(0, 0, 10)`
- walk speed: `3.5 m/s`
- fixed step: `1/60 s`
- no post-physics arena clamp
- observations are copies only

The gate drives Minie's native `PhysicsCharacter` toward four static Bullet walls for 300 fixed steps, releases movement for 60 more steps, and requires a native east-wall stop, release stability, and observation-copy isolation.

## Evidence boundary

This proves only headless Minie/Libbulletjme physics-stack feasibility on the exact candidate revision. `external_input_executed` remains `false` deliberately. Rendering, input delivery, navigation/combat, persistence, mobile/device execution, full BYJTT-LAB-001 Phase A, and human playability remain unknown.
