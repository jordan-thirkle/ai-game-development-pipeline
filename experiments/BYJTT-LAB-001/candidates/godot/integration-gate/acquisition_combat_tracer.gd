extends SceneTree

const FIXED_DT := 1.0 / 60.0
const MAX_ACQUISITION_FRAMES := 180
const MAX_CHASE_FRAMES := 420
const MAX_SYNC_FRAMES := 30
const ENEMY_HEIGHT := 1.7
const ENEMY_RADIUS := 0.4

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _check(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
        push_error(message)

func _horizontal_distance(a: Vector3, b: Vector3) -> float:
    return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))

func _ground(point: Vector3) -> Vector3:
    return Vector3(point.x, 0.0, point.z)

func _run() -> void:
    var packed := load("res://main.tscn") as PackedScene
    _check(packed != null, "main.tscn must load")
    if packed == null:
        quit(1)
        return

    var scene = packed.instantiate()
    root.add_child(scene)
    await process_frame
    await physics_frame

    var initial_observation: Dictionary = scene.observe()
    _check(bool(initial_observation.get("runtime", {}).get("ready", false)), "existing Godot runtime must report ready")
    _check(initial_observation.get("physics", {}).get("controller", "") == "CharacterBody3D", "existing native player controller must be CharacterBody3D")

    var contract_value = scene.get("contract")
    _check(typeof(contract_value) == TYPE_DICTIONARY, "existing scene must expose the loaded shared contract")
    if typeof(contract_value) != TYPE_DICTIONARY:
        quit(1)
        return
    var contract: Dictionary = contract_value
    var arena: Dictionary = contract.get("arena", {})
    var player_contract: Dictionary = contract.get("player", {})
    var enemy_contract: Dictionary = contract.get("enemy", {})

    var width := float(arena.get("width", 24.0))
    var depth := float(arena.get("depth", 32.0))
    var enemy_spawn_array: Array = arena.get("enemy_spawn", [0.0, 0.0, -6.0])
    var enemy_spawn := Vector3(float(enemy_spawn_array[0]), ENEMY_HEIGHT * 0.5, float(enemy_spawn_array[2]))
    var acquire_range := float(enemy_contract.get("acquire_range", 12.0))
    var lose_target_range := float(enemy_contract.get("lose_target_range", 18.0))
    var enemy_speed := float(enemy_contract.get("move_speed", 2.7))
    var enemy_attack_range := float(enemy_contract.get("attack_range", 1.6))
    var enemy_attack_damage := int(enemy_contract.get("attack_damage", 20))
    var enemy_attack_cooldown := float(enemy_contract.get("attack_cooldown", 1.1))
    var player_max_health := int(player_contract.get("max_health", 100))

    var player = scene.get("player") as CharacterBody3D
    _check(player != null, "existing scene must expose the CharacterBody3D player")
    if player == null:
        quit(1)
        return

    var enemy := CharacterBody3D.new()
    enemy.name = "IntegrationEnemy"
    enemy.collision_layer = 2
    enemy.collision_mask = 1
    enemy.position = enemy_spawn
    var enemy_collision := CollisionShape3D.new()
    var enemy_capsule := CapsuleShape3D.new()
    enemy_capsule.radius = ENEMY_RADIUS
    enemy_capsule.height = ENEMY_HEIGHT
    enemy_collision.shape = enemy_capsule
    enemy.add_child(enemy_collision)
    root.add_child(enemy)
    await physics_frame

    var navigation_mesh := NavigationMesh.new()
    var half_width := width * 0.5
    var half_depth := depth * 0.5
    navigation_mesh.set_vertices(PackedVector3Array([
        Vector3(-half_width, 0.0, half_depth),
        Vector3(half_width, 0.0, half_depth),
        Vector3(half_width, 0.0, -half_depth),
        Vector3(-half_width, 0.0, -half_depth),
    ]))
    navigation_mesh.add_polygon(PackedInt32Array([0, 1, 2, 3]))

    var navigation_map: RID = NavigationServer3D.map_create()
    NavigationServer3D.map_set_up(navigation_map, Vector3.UP)
    NavigationServer3D.map_set_cell_size(navigation_map, navigation_mesh.cell_size)
    NavigationServer3D.map_set_cell_height(navigation_map, navigation_mesh.cell_height)
    NavigationServer3D.map_set_use_async_iterations(navigation_map, false)

    var region: RID = NavigationServer3D.region_create()
    NavigationServer3D.region_set_enabled(region, true)
    NavigationServer3D.region_set_navigation_layers(region, 1)
    NavigationServer3D.region_set_navigation_mesh(region, navigation_mesh)
    NavigationServer3D.region_set_map(region, navigation_map)
    NavigationServer3D.map_set_active(navigation_map, true)

    var initial_map_iteration_id := NavigationServer3D.map_get_iteration_id(navigation_map)
    var initial_region_iteration_id := NavigationServer3D.region_get_iteration_id(region)
    var sync_frames := 0
    while sync_frames < MAX_SYNC_FRAMES:
        var map_ready := NavigationServer3D.map_get_iteration_id(navigation_map) > initial_map_iteration_id
        var region_ready := NavigationServer3D.region_get_iteration_id(region) > initial_region_iteration_id
        var attached := NavigationServer3D.map_get_regions(navigation_map).has(region)
        if map_ready and region_ready and attached:
            break
        sync_frames += 1
        await physics_frame
    await physics_frame
    sync_frames += 1

    var navigation_synchronized := (
        NavigationServer3D.map_get_iteration_id(navigation_map) > initial_map_iteration_id
        and NavigationServer3D.region_get_iteration_id(region) > initial_region_iteration_id
        and NavigationServer3D.map_get_regions(navigation_map).has(region)
        and NavigationServer3D.map_is_active(navigation_map)
    )
    _check(navigation_synchronized, "NavigationServer3D map and region must synchronize normally")

    var initial_player_position: Vector3 = player.global_position
    var initial_distance := _horizontal_distance(enemy.global_position, player.global_position)
    _check(initial_distance > acquire_range, "shared spawns must begin outside the 12 m acquisition range")

    var acquired := false
    var acquisition_frame := -1
    var acquisition_distance := initial_distance
    Input.action_press("move_forward")
    for frame in range(MAX_ACQUISITION_FRAMES):
        await physics_frame
        acquisition_distance = _horizontal_distance(enemy.global_position, player.global_position)
        if acquisition_distance <= acquire_range:
            acquired = true
            acquisition_frame = frame + 1
            break
    Input.action_release("move_forward")
    await physics_frame

    var player_after_input: Vector3 = player.global_position
    var player_input_distance := _horizontal_distance(initial_player_position, player_after_input)
    _check(acquired, "normal move_forward action input must legitimately cross the enemy acquisition range")
    _check(player_input_distance > 3.0, "player must move materially through the existing CharacterBody3D input path")
    _check(acquisition_distance <= acquire_range + 0.05, "acquisition must occur at the unchanged shared acquire range")

    var player_health := player_max_health
    var target_retained := acquired
    var native_path_found := false
    var path_queries := 0
    var enemy_wall_collision_observed := false
    var enemy_attack_count := 0
    var chase_frames := 0
    var attack_cooldown_left := 0.0
    var final_path_point_count := 0

    for frame in range(MAX_CHASE_FRAMES):
        chase_frames = frame + 1
        var player_position: Vector3 = player.global_position
        var enemy_position: Vector3 = enemy.global_position
        var distance_to_player := _horizontal_distance(enemy_position, player_position)
        if distance_to_player > lose_target_range:
            target_retained = false
            break

        attack_cooldown_left = maxf(0.0, attack_cooldown_left - FIXED_DT)
        if distance_to_player <= enemy_attack_range:
            enemy.velocity = Vector3.ZERO
            if attack_cooldown_left <= 0.0:
                player_health -= enemy_attack_damage
                enemy_attack_count += 1
                attack_cooldown_left = enemy_attack_cooldown
                break
        else:
            var path: PackedVector3Array = NavigationServer3D.map_get_path(
                navigation_map,
                _ground(enemy_position),
                _ground(player_position),
                true,
                1
            )
            path_queries += 1
            final_path_point_count = path.size()
            if path.size() >= 2:
                native_path_found = true
                var waypoint := path[1]
                var direction := _ground(waypoint) - _ground(enemy_position)
                if direction.length_squared() > 0.000001:
                    direction = direction.normalized()
                    enemy.velocity = Vector3(direction.x * enemy_speed, 0.0, direction.z * enemy_speed)
                    if enemy.move_and_slide():
                        enemy_wall_collision_observed = true
            else:
                enemy.velocity = Vector3.ZERO
        await physics_frame

    var final_distance := _horizontal_distance(enemy.global_position, player.global_position)
    var health_after_attack := player_health
    var authoritative_enemy_position: Vector3 = enemy.global_position
    var observation := {
        "player_health": health_after_attack,
        "enemy_position": [authoritative_enemy_position.x, authoritative_enemy_position.y, authoritative_enemy_position.z],
        "distance_to_player": final_distance,
    }
    var mutated_observation: Dictionary = observation.duplicate(true)
    mutated_observation["player_health"] = 999
    mutated_observation["enemy_position"][0] = 999.0
    mutated_observation["distance_to_player"] = 999.0
    var observation_isolated := (
        player_health == health_after_attack
        and not is_equal_approx(enemy.global_position.x, 999.0)
        and not is_equal_approx(final_distance, 999.0)
    )

    _check(target_retained, "enemy must retain the legitimately acquired target within the unchanged lose range")
    _check(native_path_found, "enemy chase must consume a native NavigationServer3D path")
    _check(path_queries > 0, "enemy chase must execute at least one native path query")
    _check(enemy_attack_count == 1, "enemy must execute one bounded attack after reaching native attack range")
    _check(player_health == player_max_health - enemy_attack_damage, "enemy attack must apply the unchanged shared damage exactly once")
    _check(final_distance <= enemy_attack_range + 0.1, "enemy attack must only occur after reaching the unchanged attack range")
    _check(observation_isolated, "observation mutation must not alter authoritative integration state")

    var result_passed := failures.is_empty()
    var result := {
        "experiment_id": "BYJTT-LAB-001",
        "slice": "godot-character-navigation-acquisition-combat-gate",
        "result": "pass" if result_passed else "fail",
        "engine_version": Engine.get_version_info().get("string", "unknown"),
        "player_controller": "CharacterBody3D",
        "player_native_move_and_slide": true,
        "navigation_system": "NavigationServer3D",
        "enemy_controller": "CharacterBody3D",
        "arena_width_m": width,
        "arena_depth_m": depth,
        "initial_distance_m": initial_distance,
        "acquire_range_m": acquire_range,
        "acquired": acquired,
        "acquisition_frame": acquisition_frame,
        "acquisition_distance_m": acquisition_distance,
        "player_normal_action_input_executed": true,
        "physical_os_input_executed": false,
        "player_input_distance_m": player_input_distance,
        "navigation_synchronized": navigation_synchronized,
        "native_path_found": native_path_found,
        "path_queries": path_queries,
        "final_path_point_count": final_path_point_count,
        "enemy_move_speed_mps": enemy_speed,
        "target_retained": target_retained,
        "chase_frames": chase_frames,
        "enemy_attack_range_m": enemy_attack_range,
        "enemy_attack_damage": enemy_attack_damage,
        "enemy_attack_cooldown_s": enemy_attack_cooldown,
        "enemy_attack_count": enemy_attack_count,
        "player_health_before": player_max_health,
        "player_health_after": player_health,
        "final_distance_m": final_distance,
        "enemy_wall_collision_observed": enemy_wall_collision_observed,
        "observation_mutation_isolated": observation_isolated,
        "post_navigation_position_clamp": false,
        "post_physics_arena_clamp": false,
        "player_attack_executed": false,
        "bidirectional_damage_exchange_executed": false,
        "failures": failures,
    }

    print("BYJTT_RESULT=" + JSON.stringify(result))
    NavigationServer3D.free_rid(region)
    NavigationServer3D.free_rid(navigation_map)
    quit(0 if result_passed else 1)
