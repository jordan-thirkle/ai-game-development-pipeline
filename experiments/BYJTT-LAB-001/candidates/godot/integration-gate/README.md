# Godot acquisition/combat integration gate

This additive gate takes the explicit handoff from draft PR #155 without modifying either of the two already-owned Godot slices:

- `src/**` and `tests/**` remain owned by the native `CharacterBody3D` movement/collision tracer from PR #80;
- `navigation-gate/**` remains owned by the native `NavigationServer3D` path tracer from PR #155.

## Proof target

On the exact stacked candidate head, the workflow first reruns both parent proofs, then this gate:

1. instantiates the existing `main.tscn`, so player locomotion remains the existing `CharacterBody3D` + `move_and_slide()` implementation;
2. composes the additive `enemy_runtime.gd`, which owns enemy state, native navigation/chase, target acquisition and combat health state;
3. drives `move_forward` only through Godot's `Input` action state until the unchanged player/enemy separation crosses the shared 12 m acquisition threshold;
4. the runtime follows native `NavigationServer3D.map_get_path()` results with an enemy `CharacterBody3D` at the unchanged 2.7 m/s enemy speed;
5. the runtime applies enemy attacks only after the unchanged 1.6 m enemy attack range is reached, using the unchanged 20 damage / 1.1 s cooldown contract;
6. the tracer only supplies input and reads copy-isolated observations. It does not move the player/enemy, set health, teleport gameplay actors or call a privileged gameplay mutation helper;
7. both runtime and tracer record that no post-navigation or post-physics arena clamp exists.

`Input.action_press("move_forward")` exercises the same action state polled by the existing player implementation. The gate records this as normal Godot action-input execution, not physical OS keyboard/device execution.

## Evidence boundary

A pass proves a bounded integration path: existing native player movement/collision + runtime-owned native navigation acquisition/chase + runtime-owned enemy damage. It does **not** prove player attack input, bidirectional damage exchange, salvage/reward/upgrades, save/restart, rendering quality, physical device input, full Phase A, production assets, profiler/device/mobile evidence, or human playability.

Shared BYJTT-LAB-001 files remain read-only and no benchmark constant is changed.