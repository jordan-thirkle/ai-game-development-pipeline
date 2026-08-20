# Panda3D rendered normal-input gate

This additive gate advances the Panda3D native-Bullet feasibility lane without modifying the earlier physics candidate or any BYJTT-LAB-001 shared contract.

It exercises one bounded path: start Panda3D 1.10.16 in a real desktop window; render native Bullet debug geometry for the unchanged 24×32 m arena; receive an OS-level `D` key press/release through Panda3D's normal `d` / `d-up` event system; drive a native Bullet rigid body using the unchanged 3.5 m/s walk constant; stop at the native east wall with no post-physics position clamp; prove release stability and copy-isolated observations; and emit exact-head machine-readable evidence plus rendered screenshots.

The shared `(0,0,10)` spawn maps to Panda3D's Z-up coordinates `(0,10,0)`. With the unchanged 0.6 m gate radius, the expected east-wall centre ceiling is `x=11.4 m`.

## Static-type boundary

Panda3D 1.10.16's installed `direct.*`, Bullet, and core runtime modules do not provide enough type information for Pyright strict mode. The first attempted stacked revision (`d3e5c012393dc7d9b62cf6ef0562cee410e668aa`, run `32398124641`) failed closed with 142 unknown/stub errors before runtime; artifact `9417428451` (SHA-256 `a4f7d6f709e72bc9e4370f42627e9144c35017b7bc999217c5f5d22ebf51a8e6`) preserves that evidence. Re-executing the parent Panda3D gate on the same revision also exposed 67 strict-Pyright unknown-type errors in the external Panda3D boundary.

The recovery does **not** suppress a failing full-adapter type check and call it strict. `strict_contract.py` contains candidate-owned constants, coordinate mapping, evidence schema, and pass predicate and must pass `# pyright: strict` with zero errors; every Python file must compile; and the dynamically typed Panda3D adapter is accepted or rejected by real rendered-engine execution, OS input delivery, native Bullet collision, machine-readable assertions, runtime failure scanning, and artifact hashes. The upstream typing limitation remains lifecycle evidence.

## Failure/recovery history

- `d3e5c012393dc7d9b62cf6ef0562cee410e668aa`, run `32398124641`: strict typing failed on upstream Panda3D API unknowns. Superseded PR #180 was closed unmerged; artifact `9417428451`, SHA-256 `a4f7d6f709e72bc9e4370f42627e9144c35017b7bc999217c5f5d22ebf51a8e6`.
- `326b71df3e0b79bdd5d985724a76f51b7ea26b08`, run `32398564293`: strict owned-contract typing passed, but a renderer-speed-dependent 900-frame timeout ended the app before external input; an unnecessary floor also caused invalid Z displacement under zero gravity. Artifact `9417596884`, SHA-256 `ef09b8f736128fa5eceedfd9ae821e73da4eb6d2e58bee5b351c9e8daba26d6a`.
- `f7272cff519acf4052c7f01886df722c988461b2`, run `32398834819`: compile/strict contract passed, real Panda3D window rendered, and the real OS input path produced one `d` and one `d-up` callback, but the idle Bullet body remained at x=0 and never contacted the wall. Artifact `9417712929`, SHA-256 `9c94be68cea449b199c253db37ed77c53f079f80e33b958ced5a25865cb07f2c`.

Panda3D's documented Bullet body API states that bodies can deactivate after inactivity and exposes `setActive`/deactivation controls. The current recovery therefore treats normal input as controller state: while `D` is held, each fixed simulation step requests the unchanged 3.5 m/s X velocity and explicitly wakes the native body; release requests zero X velocity and wakes it once more. This is engine-native velocity control through the real input path, not a test-only position mutation or arena clamp.

## Evidence boundary

A pass proves desktop rendering + normal external keyboard delivery + native Bullet collision feasibility. It does **not** prove Panda3D's limited Bullet character controller is production-ready, nor touch/mobile/device input, navigation/combat, persistence, complete Phase A, production assets, performance readiness, or human playability.
