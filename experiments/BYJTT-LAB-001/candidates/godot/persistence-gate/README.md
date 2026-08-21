# Godot persistence and restart gate

Bounded BYJTT-LAB-001 proof for shared playthrough steps 11–13: save state, restart runtime, verify restored state.

## Runtime path

- Stack on the exact Godot progression proof from PR #252.
- Earn reward count `1` and `damage-up-1` through the existing CharacterBody3D + Godot action-input progression path.
- Trigger save through the normal `pause` gameplay action consumed by the persistence runtime.
- Serialize only the shared save-contract fields with Godot's engine-native `ConfigFile` API.
- Exit the first Godot process.
- Launch a second independent Godot process under the same project user-data location.
- Restore automatically during persistence-node startup and prove reward count, selected upgrade, and effective damage survive the process boundary.

## Explicitly rejected shortcuts

The proof harness does not write the save file, grant rewards/upgrades, set progression state, or call a privileged save-state setter. It drives gameplay input actions and reads copy-isolated observations only.

## Evidence boundary

This is headless persistence/restart evidence. It does not claim physical OS input, rendered save/progression UI, a unified full Phase A scene, Phase B production assets, profiling/device/mobile evidence, or human playability.
