# BYJTT-LAB-001 — libGDX 1.14.2 Bullet feasibility gate

This candidate is a bounded additive runtime/toolchain proof for issue #146. It does **not** claim full Phase A.

## Solved-system choice

The gate uses libGDX's official `gdx-bullet` extension and `natives-desktop` artifacts rather than a bespoke collision solver. Current libGDX documentation describes `gdx-bullet` as the Java wrapper over native C++ Bullet and documents the desktop native classifier. The same documentation also states that Bullet is not compatible with the libGDX HTML target; that lifecycle limitation is intentionally retained.

Pinned direct version: `1.14.2`.

## Shared contract values retained

- arena: `24 × 32 m`;
- world up: `+Y`;
- contract player spawn: `(0, 0, 10)`;
- player walk speed: `3.5 m/s`;
- fixed simulation step: `1/60 s`.

The shared spawn represents the player's ground-space position. The Bullet capsule centre is offset upward by half of its total capsule height so the ground-space Y remains `0` after settling. This is a representation mapping, not a benchmark-constant change.

## What the tracer executes

- `Bullet.init()` loads the official desktop native Bullet binding;
- a real `btDiscreteDynamicsWorld` runs with gravity, a native static floor and four native static arena walls;
- a dynamic native capsule starts from the shared spawn and is driven east using the shared walk speed for 300 fixed steps;
- movement input is then released for 60 fixed steps to verify stable contact rather than a one-frame crossing;
- no post-physics arena clamp exists;
- the result records expected/observed wall position, final velocity/drift and observation-copy isolation.

The east wall's inner face is `x = 12.0 m`. With a `0.60 m` capsule radius, the expected capsule-centre ceiling is `x = 11.40 m`.

## Reproduce

```bash
mvn -B -ntp verify
mvn -B -ntp dependency:tree
mvn -B -ntp exec:java -Dexec.args="artifacts/physics-gate/result.json"
```

CI additionally records the exact checked-out SHA, Java/Maven versions, dependency tree, build/runtime logs, result JSON and SHA-256 hashes.

## Evidence boundary

This gate does not prove:

- normal external keyboard/controller/touch input;
- rendering or browser/HTML parity;
- a production character-controller abstraction;
- enemy navigation/combat;
- salvage/reward/upgrades;
- persistence/restart;
- frozen shared-content import;
- profiler/device/mobile execution;
- the complete shared 13-step Phase A playthrough;
- human playability.

Missing items remain `unknown`, not pass.
