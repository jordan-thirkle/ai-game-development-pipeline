# Godot player attack / bidirectional combat gate

This additive BYJTT-LAB-001 slice is stacked on the execution-proven Godot acquisition/enemy-combat gate and owns no parent files.

It preserves the shared contract unchanged and exercises the existing `CharacterBody3D` player, `NavigationServer3D` chase, and enemy `CharacterBody3D` path before adding one bounded gameplay attack-action consumer.

The player attack consumer reads only Godot `Input` action state. It exposes copy-only observations and no enemy-health setter. The proof requires:

- legitimate acquisition after normal `move_forward` action input crosses the unchanged 12 m threshold;
- native chase into combat range;
- enemy response reducing player health from 100;
- player attack range 1.8 m, damage 34, cooldown 0.55 s;
- first valid attack 100→66 enemy health;
- an early second action press blocked by cooldown;
- second valid post-cooldown attack 66→32;
- copy-isolated observations;
- no post-navigation or post-physics coordinate clamp.

## Evidence boundary

This is headless Godot action-input combat integration. `physical_os_input_executed=false` is deliberate. It does not claim rendered hit reactions, physical keyboard/controller/touch attack delivery, salvage/reward/upgrades, persistence/restart, full Phase A, production assets, profiling/device/mobile evidence, or human playability.
