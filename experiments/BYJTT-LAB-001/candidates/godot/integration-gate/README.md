# Godot acquisition/combat integration gate

This additive gate takes the explicit handoff from draft PR #155 without modifying either of the two already-owned Godot slices:

- `src/**` and `tests/**` remain owned by the native `CharacterBody3D` movement/collision tracer from PR #80;
- `navigation-gate/**` remains owned by the native `NavigationServer3D` path tracer from PR #155.

## Proof target

On the exact stacked candidate head, the workflow first reruns both parent proofs, then this gate:

1. instantiates the existing `main.tscn`, so player locomotion is still the existing `CharacterBody3D` + `move_and_slide()` implementation;
2. drives `move_forward` only through Godot's `Input` action state until the unchanged player/enemy separation crosses the shared 12 m acquisition threshold;
3. creates the same engine-native `NavigationServer3D` map/region shape already proven by the navigation gate;
4. follows a native `map_get_path()` result with an enemy `CharacterBody3D` at the unchanged 2.7 m/s enemy speed;
5. applies one enemy attack only after the unchanged 1.6 m enemy attack range is reached, using the unchanged 20 damage / 1.1 s cooldown contract;
6. proves copy-isolated observations and records that no post-navigation or post-physics arena clamp exists.

The player is never teleported or moved through a test-only gameplay setter. `Input.action_press("move_forward")` is used only to exercise the same input action polled by the existing player implementation. The gate records this as normal Godot action-input execution, not physical OS keyboard/device execution.

## Evidence boundary

A pass proves a bounded integration path: existing native player movement/collision + native navigation acquisition/chase + one enemy damage event. It does **not** prove player attack input, bidirectional damage exchange, salvage/reward/upgrades, save/restart, rendering quality, device input, full Phase A, production assets, profiler/device/mobile evidence, or human playability.

Shared BYJTT-LAB-001 files remain read-only and no benchmark constant is changed.