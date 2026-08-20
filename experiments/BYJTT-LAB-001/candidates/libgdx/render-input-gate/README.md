# libGDX rendered normal-input gate

This additive BYJTT-LAB-001 slice follows the native Bullet feasibility proof in PR #147 without modifying that gate.

## Fixed contract values

- libGDX / gdx-bullet: `1.14.2`
- arena: `24 x 32 m`
- player contract spawn: `(0, 0, 10)`
- walk speed: `3.5 m/s`
- physics step: `1/60 s`
- player capsule radius: `0.6 m`

## Proof path

The desktop application is a real `Lwjgl3Application`. It installs a libGDX `InputProcessor`; only `D` key down/up callbacks control the production movement state. The workflow sends those events from the OS with `xdotool` to the focused application window. No test-only movement setter or position teleport is exposed.

The player is the same native Bullet dynamic capsule shape used by the parent feasibility lane, constrained by four static native Bullet walls. Rendering uses libGDX's normal GL/LWJGL3 path and draws a top-down arena/player view every frame. The physics step never applies a post-physics arena clamp.

## Pass boundary

A pass requires all of the following on the exact candidate head:

- Java 17 Maven verify with `-Xlint:all -Werror`;
- exact libGDX, LWJGL3 backend and Bullet 1.14.2 dependency resolution;
- externally enumerable desktop window;
- real OS `D` press and release observed through libGDX input callbacks;
- rendered frames and screenshot evidence;
- native east-wall stop near the mathematically expected capsule-centre boundary;
- stable release with <= 0.01 m drift;
- copy-isolated observation state;
- no timeout and no post-physics arena clamp.

This does **not** claim HTML Bullet parity, production character-controller quality, touch/mobile/device execution, navigation/combat, persistence, full Phase A, production assets, performance readiness, or human playability.
