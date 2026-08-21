# BYJTT-LAB-001 — raylib 6.0 + Jolt 5.5 gate

This additive feasibility slice evaluates a lightweight code-first runtime pairing without changing any shared benchmark contract.

## Pinned systems

- raylib `6.0`
- Jolt Physics `v5.5.0`
- C++20

raylib owns the real desktop window, rendering, and normal keyboard polling (`IsKeyDown(KEY_D)`). Jolt owns the native rigid-body world, static arena collision, and dynamic capsule. No bespoke collision solver or post-physics arena clamp is used.

## Preserved shared contract

- arena: `24 x 32 m`
- logical player spawn: `(0, 0, 10)`
- player radius: `0.4 m`
- walk speed: `3.5 m/s`
- world up: `+Y`
- fixed physics step: `1/60 s`

The capsule center starts at `y=0.9 m` so the logical ground-space spawn remains `y=0`.

## Executable proof target

A proof-capable run must:

1. assert the exact candidate head;
2. configure and build with warnings treated as errors;
3. create a real raylib window under Xvfb/Openbox;
4. find and focus that top-level window externally;
5. inject one physical OS `D` press/release with `xdotool`;
6. observe exactly one press and release transition through raylib's normal input path;
7. step Jolt at `1/60 s` while the key is down;
8. stop the dynamic capsule at the native east wall near the `x=11.6 m` center boundary;
9. remain stable for 60 released physics steps;
10. retain screenshots, environment/build/runtime logs, result JSON, exact-head identity, and SHA-256 hashes.

## Evidence boundary

This gate proves only rendered desktop + physical keyboard + native Jolt collision feasibility if execution succeeds. It does **not** claim a production character controller, camera/game feel, navigation/combat, salvage/progression/save, mobile/device/profile evidence, full Phase A, Phase B content, or human playability.

Any first compile, graphics, input, or runtime failure is evidence. Repair only this isolated gate and do not weaken shared constants or acceptance criteria.
