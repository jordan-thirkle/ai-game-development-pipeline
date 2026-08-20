extends SceneTree

const ARENA_WIDTH := 24.0
const ARENA_DEPTH := 32.0
const PLAYER_SPAWN := Vector3(0.0, 0.0, 10.0)
const ENEMY_SPAWN := Vector3(0.0, 0.0, -6.0)
const ENEMY_MOVE_SPEED := 2.7
const FIXED_DT := 1.0 / 60.0
const DRIVEN_STEPS := 180
const MAX_SYNC_FRAMES := 10

var _authoritative_enemy_position := ENEMY_SPAWN

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var navigation_map: RID = NavigationServer3D.map_create()
    NavigationServer3D.map_set_active(navigation_map, true)

    var region: RID = NavigationServer3D.region_create()
    NavigationServer3D.region_set_enabled(region, true)
    NavigationServer3D.region_set_map(region, navigation_map)

    var navigation_mesh := NavigationMesh.new()
    var half_width := ARENA_WIDTH * 0.5
    var half_depth := ARENA_DEPTH * 0.5
    navigation_mesh.set_vertices(PackedVector3Array([
        Vector3(-half_width, 0.0, half_depth),
        Vector3(half_width, 0.0, half_depth),
        Vector3(half_width, 0.0, -half_depth),
        Vector3(-half_width, 0.0, -half_depth),
    ]))
    navigation_mesh.add_polygon(PackedInt32Array([0, 1, 2, 3]))
    NavigationServer3D.region_set_navigation_mesh(region, navigation_mesh)

    # The native server applies map/region changes at physics-frame synchronization.
    var sync_frames := 0
    while NavigationServer3D.map_get_iteration_id(navigation_map) == 0 and sync_frames < MAX_SYNC_FRAMES:
        sync_frames += 1
        await physics_frame

    var map_iteration_id := NavigationServer3D.map_get_iteration_id(navigation_map)
    var closest_enemy_point := NavigationServer3D.map_get_closest_point(navigation_map, ENEMY_SPAWN)
    var closest_player_point := NavigationServer3D.map_get_closest_point(navigation_map, PLAYER_SPAWN)
    var path: PackedVector3Array = NavigationServer3D.map_get_path(
        navigation_map,
        ENEMY_SPAWN,
        PLAYER_SPAWN,
        true,
        1
    )

    var path_found := path.size() >= 2
    var start_distance := ENEMY_SPAWN.distance_to(PLAYER_SPAWN)
    var path_index := 1
    _authoritative_enemy_position = ENEMY_SPAWN

    for _step in range(DRIVEN_STEPS):
        if path_index >= path.size():
            break
        var waypoint := path[path_index]
        var remaining := _authoritative_enemy_position.distance_to(waypoint)
        if remaining <= 0.001:
            path_index += 1
            continue
        var travel := minf(ENEMY_MOVE_SPEED * FIXED_DT, remaining)
        _authoritative_enemy_position += _authoritative_enemy_position.direction_to(waypoint) * travel
        if _authoritative_enemy_position.distance_to(waypoint) <= 0.001:
            path_index += 1

    var final_distance := _authoritative_enemy_position.distance_to(PLAYER_SPAWN)
    var observation := {
        "enemy_position": [_authoritative_enemy_position.x, _authoritative_enemy_position.y, _authoritative_enemy_position.z],
        "distance_to_player": final_distance,
    }
    var mutated_observation: Dictionary = observation.duplicate(true)
    mutated_observation["enemy_position"][0] = 999.0
    mutated_observation["distance_to_player"] = 999.0
    var observation_isolated := not is_equal_approx(_authoritative_enemy_position.x, 999.0) and not is_equal_approx(final_distance, 999.0)

    var path_inside_arena := true
    for point in path:
        if absf(point.x) > half_width + 0.001 or absf(point.z) > half_depth + 0.001:
            path_inside_arena = false
            break

    var result := {
        "experiment_id": "BYJTT-LAB-001",
        "slice": "godot-native-navigation-gate",
        "result": "pass" if map_iteration_id > 0 and path_found and path_inside_arena and final_distance < start_distance and observation_isolated else "fail",
        "engine_system": "NavigationServer3D",
        "arena_width_m": ARENA_WIDTH,
        "arena_depth_m": ARENA_DEPTH,
        "player_spawn": [PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z],
        "enemy_spawn": [ENEMY_SPAWN.x, ENEMY_SPAWN.y, ENEMY_SPAWN.z],
        "enemy_move_speed_mps": ENEMY_MOVE_SPEED,
        "fixed_dt_s": FIXED_DT,
        "driven_steps": DRIVEN_STEPS,
        "sync_frames": sync_frames,
        "map_iteration_id": map_iteration_id,
        "closest_enemy_point": [closest_enemy_point.x, closest_enemy_point.y, closest_enemy_point.z],
        "closest_player_point": [closest_player_point.x, closest_player_point.y, closest_player_point.z],
        "path_found": path_found,
        "path_point_count": path.size(),
        "path_inside_arena": path_inside_arena,
        "start_distance_m": start_distance,
        "final_distance_m": final_distance,
        "distance_reduced_m": start_distance - final_distance,
        "observation_mutation_isolated": observation_isolated,
        "external_input_executed": false,
        "combat_executed": false,
        "post_navigation_position_clamp": false,
    }

    print("BYJTT_RESULT=" + JSON.stringify(result))
    NavigationServer3D.free_rid(region)
    NavigationServer3D.free_rid(navigation_map)
    quit(0 if result["result"] == "pass" else 1)
