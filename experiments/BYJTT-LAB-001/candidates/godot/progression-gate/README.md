# Godot progression gate

Bounded BYJTT-LAB-001 proof for shared playthrough steps 07–09: break salvage, collect reward, select upgrade.

## Runtime path

- Godot 4.7.1 official Linux runtime.
- Real `CharacterBody3D` movement via normal Godot action state and `move_and_slide()`.
- Shared player spawn `(0,0,10)` and salvage spawn `(5,0,0)`.
- Shared walk speed `3.5 m/s`.
- Salvage breaks only after an `attack` action while within `1.8 m`.
- Reward is collected only after engine-owned player movement enters the `1.25 m` pickup radius.
- `damage-up-1` is selected only after an `interact` action and raises effective damage from `34` to `40.8`.
- Observations are copies; the proof mutates a returned observation and verifies engine-owned state is unchanged.

## Explicitly rejected shortcuts

The gate exposes no direct salvage-health setter, reward grant, upgrade grant, direct movement setter, teleport loop, or post-physics arena clamp. Test instrumentation drives only Godot input actions and reads copy-isolated observations.

## Evidence boundary

This is headless action-input progression evidence only. It does not claim physical OS input, rendered progression UI, persistence/restart, a unified full Phase A playthrough, Phase B production assets, profiling/device/mobile evidence, or human playability.
