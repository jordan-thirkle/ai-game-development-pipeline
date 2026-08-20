# Panda3D rendered normal-input gate

This additive gate follows the native-physics proof in PR #129 without modifying its files.

It exercises one deliberately bounded path:

1. start Panda3D 1.10.16 in a real desktop window;
2. render Panda3D's native Bullet debug geometry for the unchanged 24×32 m arena;
3. receive an OS-level `D` key press and release through Panda3D's normal `d` / `d-up` event system;
4. drive the existing native Bullet rigid-body path at the unchanged 3.5 m/s walk speed;
5. stop at the native east wall with no post-physics position clamp;
6. prove release stability and copy-isolated observations;
7. emit exact-head machine-readable evidence and screenshots.

The contract spawn `(0,0,10)` is mapped to Panda3D's Z-up coordinates `(0,10,0)`, exactly as in the parent physics gate. With a 0.6 m player radius, the expected east-wall centre ceiling is `x=11.4 m`.

## Evidence boundary

A pass proves desktop rendering + normal external keyboard delivery + native Bullet collision feasibility for this candidate. It does **not** prove that Panda3D's built-in Bullet character controller is production-ready, nor touch/mobile/device input, navigation/combat, persistence, complete Phase A, production assets, performance readiness, or human playability.

The workflow is fail-closed: missing window/input callbacks, timeout, wall penetration, release drift, observation mutation, runtime traceback, or a missing evidence file fails the gate. Shared benchmark constants are read-only.
