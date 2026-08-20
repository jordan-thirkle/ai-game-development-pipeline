# Panda3D rendered normal-input gate

This additive gate advances the Panda3D native-Bullet feasibility lane without modifying the earlier physics candidate or any BYJTT-LAB-001 shared contract.

It exercises one bounded path:

1. start Panda3D 1.10.16 in a real desktop window;
2. render Panda3D's native Bullet debug geometry for the unchanged 24×32 m arena;
3. receive an OS-level `D` key press/release through Panda3D's normal `d` / `d-up` event system;
4. drive a native Bullet rigid body using the unchanged 3.5 m/s walk constant;
5. stop at the native east wall with no post-physics position clamp;
6. prove release stability and copy-isolated observations;
7. emit exact-head machine-readable evidence and rendered screenshots.

The shared `(0,0,10)` spawn maps to Panda3D's Z-up coordinates `(0,10,0)`. With the unchanged gate radius of 0.6 m, the expected east-wall centre ceiling is `x=11.4 m`.

## Static-type boundary

Panda3D 1.10.16's installed `direct.*`, Bullet, and core runtime modules do not provide enough type information for Pyright strict mode. The first attempted revision (`d3e5c012393dc7d9b62cf6ef0562cee410e668aa`, run `32398124641`) failed closed with 142 unknown/stub errors before runtime; artifact `9417428451` (SHA-256 `a4f7d6f709e72bc9e4370f42627e9144c35017b7bc999217c5f5d22ebf51a8e6`) preserves that evidence. Re-executing the parent Panda3D gate on the same revision also exposed 67 strict-Pyright unknown-type errors in the external Panda3D boundary.

The recovery does **not** suppress a failing full-adapter type check and call it strict. Instead:

- `strict_contract.py` contains candidate-owned constants, coordinate mapping, evidence schema, and pass predicate and must pass `# pyright: strict` with zero errors;
- every Python file in this gate must compile successfully;
- the dynamically typed Panda3D engine adapter is accepted or rejected by real rendered-engine execution, OS input delivery, native Bullet collision, machine-readable assertions, runtime failure scanning, and artifact hashes.

This limitation is retained as lifecycle evidence for Panda3D rather than hidden.

## Evidence boundary

A pass proves desktop rendering + normal external keyboard delivery + native Bullet collision feasibility. It does **not** prove Panda3D's limited Bullet character controller is production-ready, nor touch/mobile/device input, navigation/combat, persistence, complete Phase A, production assets, performance readiness, or human playability.
