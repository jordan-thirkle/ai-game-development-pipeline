# Godot native navigation gate

This stacked BYJTT-LAB-001 slice advances the explicit next frontier from the Godot tracer without modifying the shared benchmark contract or the already-owned movement/collision implementation.

## Solved system

Use Godot 4.7.1 `NavigationServer3D` directly. The official Godot navigation-server documentation demonstrates creating a procedural `NavigationMesh`, assigning it to a server region, waiting for server synchronization, and querying a native path with `map_get_path()`. This gate follows that engine-native path rather than introducing a bespoke grid/A* implementation or a third-party behavior tree.

## Contract values retained

- arena: 24 × 32 m;
- player spawn: `(0, 0, 10)`;
- enemy spawn: `(0, 0, -6)`;
- enemy movement speed: 2.7 m/s;
- fixed simulation step used by the chase probe: 1/60 s.

The native path is queried from the unchanged enemy spawn to the unchanged player spawn. A bounded chase probe then follows that returned path for 180 fixed steps. The probe does not alter the shared constants and applies no post-navigation arena clamp.

## Evidence boundary

This is native navigation/path-following feasibility only. It deliberately records `external_input_executed=false` and `combat_executed=false`. It does **not** claim the full `acquire-enemy` or `exchange-damage` playtest steps, because the shared initial spawn separation exceeds `enemy.acquire_range` and this gate does not manufacture player movement through a privileged test setter.

Full Phase A still requires normal-input acquisition conditions, camera/combat, salvage/reward/upgrade, persistence/restart, the complete 13-step playthrough, visual evidence, profiler/device evidence, and human playability.

## Verification

The candidate workflow fails closed before executing the downloaded Godot binary until the exact 4.7.1 Linux archive SHA-256 has been observed and committed. After that provenance bootstrap, the same exact candidate head must pass project/script parsing and the real headless `NavigationServer3D` execution before this slice can be treated as runtime evidence.
