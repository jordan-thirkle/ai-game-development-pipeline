# Godot 4.7.1 rendered physical-input gate

This isolated BYJTT-LAB-001 slice proves a runtime boundary that is deliberately separate from the existing Godot movement, navigation, and combat gates.

## Owned proof

- official Godot `4.7.1-stable` Linux runtime, SHA-256 verified before execution;
- actual X11/OpenGL-compatibility window under the proof environment;
- physical OS `D` key press/release delivered to Godot and observed by `InputEventKey` plus normal `Input.is_key_pressed(KEY_D)` state;
- engine-native `CharacterBody3D.move_and_slide()` against static `StaticBody3D` arena walls;
- unchanged 24×32 m arena, logical `(0,0,10)` spawn, 0.4 m radius, 3.5 m/s walk speed, and 60 Hz physics;
- east-wall stop near the native capsule boundary at `x=11.6`, release stability, copy-isolated observations, screenshots, runtime logs, and exact-head hashes;
- no post-physics coordinate clamp, teleport movement loop, or test-only gameplay mutation API.

The character's collision shape is centered vertically at `y=0.9` because the shared spawn is expressed in logical ground-space. Its reported observation subtracts that center offset and therefore preserves the logical `(0,0,10)` contract.

## Evidence boundary

This gate does **not** claim full Phase A or replace any separately owned Godot slice. Navigation, combat integration, touch/controller/mobile/device execution, persistence, production assets, profiling, and human playability remain outside this proof.

A green source/config check is not sufficient. The dedicated workflow must execute the exact candidate head, launch the real Godot window, receive real OS keyboard events, observe native collision, and retain machine-readable evidence.
