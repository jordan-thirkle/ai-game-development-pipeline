# jMonkeyEngine 3.9 + Recast4j navigation gate

This is a bounded BYJTT-LAB-001 feasibility slice for issue #213.

## What executes

- jMonkeyEngine `3.9.0-stable` creates the arena as a real `Mesh` and `Geometry`.
- Recast4j/Detour `1.5.12` consumes the same geometry data and builds a solo navigation mesh.
- Detour queries the unchanged enemy spawn `(0,0,-6)` to unchanged player spawn `(0,0,10)`.
- The proof requires the straight path to remain inside the unchanged 24×32 m arena, stay close to both endpoints, and have a sane ~16 m length.
- Observations are copied before mutation probes; no navigation position clamp or gameplay mutation shortcut is used.

## Shared values retained

- arena: 24×32 m
- player spawn: `(0,0,10)`
- enemy spawn: `(0,0,-6)`
- enemy movement speed recorded: 2.7 m/s
- world up: +Y

The 2.7 m/s speed is recorded for contract continuity but this gate proves path acquisition only; it does not move an integrated enemy.

## Evidence boundary

A pass proves jMonkeyEngine geometry can feed the current mature Recast4j/Detour stack and produce a valid path between the shared benchmark spawns in real JVM execution. It does **not** prove integrated Minie steering, rendered input, combat, persistence, full Phase A, production assets, profiling/device/mobile execution, or human playability.

The existing jMonkeyEngine physics, Minie and rendered-input subtrees are separate owners and are not modified here.
