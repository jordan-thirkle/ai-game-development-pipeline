# Babylon native combat gate

Bounded BYJTT-LAB-001 follow-on from the execution-proven Babylon Recast→Havok chase head.

This slice preserves the shared arena, movement, acquisition and enemy combat constants and proves only enemy attack/cooldown after legitimate native navigation→character chase. A real browser `KeyS` press/release moves the player through `PhysicsCharacterController`; Recast Navigation Plugin V2 computes the path after crossing the 12 m acquisition threshold; a second Havok `PhysicsCharacterController` chases at 2.7 m/s; the enemy attacks only inside 1.6 m for 20 damage with a 1.1 s cooldown.

The observation surface is copy-only. The gate exposes no health setter, teleport, arena clamp, direct acquisition setter, player attack helper or test-only gameplay mutation API.

Not proven here: player attack, progression, persistence/restart, unified Phase A, production assets, device/mobile profiling or human playability.
