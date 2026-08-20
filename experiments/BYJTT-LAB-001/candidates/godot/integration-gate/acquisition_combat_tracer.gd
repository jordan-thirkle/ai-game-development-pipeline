extends SceneTree

const MAX_ACQUISITION_FRAMES := 180
const MAX_COMBAT_FRAMES := 420
const MAX_SYNC_FRAMES := 30

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _check(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
        push_error(message)

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

    var initial_player_observation: Dictionary = scene.observe()
    _check(bool(initial_player_observation.get("runtime", {}).get("ready", false)), "existing Godot runtime must report ready")
    _check(initial_player_observation.get("physics", {}).get("controller", "") == "CharacterBody3D", "existing native player controller must be CharacterBody3D")

    var contract_value = scene.get("contract")
    var player = scene.get("player") as CharacterBody3D
    _check(typeof(contract_value) == TYPE_DICTIONARY, "existing scene must expose the loaded shared contract")
    _check(player != null, "existing scene must expose the CharacterBody3D player")
    if typeof(contract_value) != TYPE_DICTIONARY or player == null:
        quit(1)
        return

    var contract: Dictionary = contract_value
    var enemy_contract: Dictionary = contract.get("enemy", {})
    var player_contract: Dictionary = contract.get("player", {})
    var acquire_range := float(enemy_contract.get("acquire_range", 12.0))
    var attack_range := float(enemy_contract.get("attack_range", 1.6))
    var attack_damage := int(enemy_contract.get("attack_damage", 20))
    var player_max_health := int(player_contract.get("max_health", 100))

    var runtime_script := load("res://integration-gate/enemy_runtime.gd") as GDScript
    _check(runtime_script != null, "enemy integration runtime must load")
    if runtime_script == null:
        quit(1)
        return
    var runtime = runtime_script.new()
    runtime.configure(contract, player)
    root.add_child(runtime)

    var sync_frames := 0
    while sync_frames < MAX_SYNC_FRAMES:
        await physics_frame
        sync_frames += 1
        if bool(runtime.observe().get("navigation_synchronized", false)):
            break
    var synchronized_observation: Dictionary = runtime.observe()
    _check(bool(synchronized_observation.get("navigation_synchronized", false)), "runtime navigation map and region must synchronize normally")

    var initial_player_position: Vector3 = player.global_position
    var initial_runtime_observation: Dictionary = runtime.observe()
    var initial_distance := float(initial_runtime_observation.get("distance_to_player", -1.0))
    _check(initial_distance > acquire_range, "shared spawns must begin outside the unchanged acquisition range")

    var acquisition_frame := -1
    Input.action_press("move_forward")
    for frame in range(MAX_ACQUISITION_FRAMES):
        await physics_frame
        var observation: Dictionary = runtime.observe()
        if bool(observation.get("target_acquired", false)):
            acquisition_frame = frame + 1
            break
    Input.action_release("move_forward")
    await physics_frame

    var acquisition_observation: Dictionary = runtime.observe()
    var player_after_input: Vector3 = player.global_position
    var player_input_distance := Vector2(initial_player_position.x, initial_player_position.z).distance_to(Vector2(player_after_input.x, player_after_input.z))
    var acquisition_distance := float(acquisition_observation.get("distance_to_player", 999.0))
    _check(bool(acquisition_observation.get("target_acquired", false)), "normal move_forward action input must legitimately cross the enemy acquisition range")
    _check(player_input_distance > 3.0, "player must move materially through the existing CharacterBody3D input path")
    _check(acquisition_distance <= acquire_range + 0.05, "acquisition must occur at the unchanged shared acquire range")

    for _frame in range(MAX_COMBAT_FRAMES):
        await physics_frame
        if int(runtime.observe().get("enemy_attack_count", 0)) >= 1:
            break

    var final_observation: Dictionary = runtime.observe()
    var player_health := int(final_observation.get("player_health", -1))
    var final_distance := float(final_observation.get("distance_to_player", 999.0))
    _check(bool(final_observation.get("target_retained", false)), "enemy runtime must retain the legitimately acquired target within the unchanged lose range")
    _check(bool(final_observation.get("native_path_found", false)), "enemy runtime must consume a native NavigationServer3D path")
    _check(int(final_observation.get("path_queries", 0)) > 0, "enemy runtime must execute at least one native path query")
    _check(int(final_observation.get("enemy_attack_count", 0)) == 1, "enemy runtime must execute one bounded attack before the tracer stops")
    _check(player_health == player_max_health - attack_damage, "runtime attack must apply the unchanged shared damage exactly once")
    _check(final_distance <= attack_range + 0.1, "runtime attack must only occur after reaching the unchanged attack range")

    var mutated_observation: Dictionary = final_observation.duplicate(true)
    mutated_observation["player_health"] = 999
    mutated_observation["enemy_position"][0] = 999.0
    mutated_observation["distance_to_player"] = 999.0
    var isolated_observation: Dictionary = runtime.observe()
    var isolated_enemy_position: Array = isolated_observation.get("enemy_position", [999.0, 999.0, 999.0])
    var observation_isolated := (
        int(isolated_observation.get("player_health", 999)) == player_health
        and float(isolated_enemy_position[0]) != 999.0
        and float(isolated_observation.get("distance_to_player", 999.0)) != 999.0
    )
    _check(observation_isolated, "observation mutation must not alter authoritative runtime state")

    var result := {
        "experiment_id": "BYJTT-LAB-001",
        "slice": "godot-character-navigation-acquisition-combat-gate",
        "result": "pass" if failures.is_empty() else "fail",
        "engine_version": Engine.get_version_info().get("string", "unknown"),
        "player_controller": "CharacterBody3D",
        "player_native_move_and_slide": true,
        "navigation_system": "NavigationServer3D",
        "enemy_controller": "CharacterBody3D",
        "initial_distance_m": initial_distance,
        "acquire_range_m": acquire_range,
        "acquired": bool(acquisition_observation.get("target_acquired", false)),
        "acquisition_frame": acquisition_frame,
        "acquisition_distance_m": acquisition_distance,
        "player_normal_action_input_executed": true,
        "physical_os_input_executed": false,
        "player_input_distance_m": player_input_distance,
        "navigation_synchronized": bool(final_observation.get("navigation_synchronized", false)),
        "native_path_found": bool(final_observation.get("native_path_found", false)),
        "path_queries": int(final_observation.get("path_queries", 0)),
        "final_path_point_count": int(final_observation.get("final_path_point_count", 0)),
        "enemy_move_speed_mps": float(final_observation.get("enemy_move_speed_mps", -1.0)),
        "target_retained": bool(final_observation.get("target_retained", false)),
        "chase_frames": int(final_observation.get("chase_frames", 0)),
        "enemy_attack_range_m": float(final_observation.get("enemy_attack_range_m", -1.0)),
        "enemy_attack_damage": int(final_observation.get("enemy_attack_damage", -1)),
        "enemy_attack_cooldown_s": float(final_observation.get("enemy_attack_cooldown_s", -1.0)),
        "enemy_attack_count": int(final_observation.get("enemy_attack_count", 0)),
        "player_health_before": player_max_health,
        "player_health_after": player_health,
        "final_distance_m": final_distance,
        "enemy_wall_collision_observed": bool(final_observation.get("enemy_wall_collision_observed", false)),
        "observation_mutation_isolated": observation_isolated,
        "test_only_gameplay_mutation_shortcut": false,
        "post_navigation_position_clamp": bool(final_observation.get("post_navigation_position_clamp", true)),
        "post_physics_arena_clamp": bool(final_observation.get("post_physics_arena_clamp", true)),
        "player_attack_executed": false,
        "bidirectional_damage_exchange_executed": false,
        "failures": failures,
    }

    print("BYJTT_RESULT=" + JSON.stringify(result))
    quit(0 if failures.is_empty() else 1)
