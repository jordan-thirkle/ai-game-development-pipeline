extends SceneTree

const MAX_ACQUISITION_FRAMES := 180
const MAX_COMBAT_FRAMES := 420
const MAX_SYNC_FRAMES := 30
const COOLDOWN_GUARD_FRAMES := 30

const REQUIRED_ARENA_WIDTH := 24.0
const REQUIRED_ARENA_DEPTH := 32.0
const REQUIRED_PLAYER_SPAWN := Vector3(0.0, 0.0, 10.0)
const REQUIRED_ENEMY_SPAWN := Vector3(0.0, 0.0, -6.0)
const REQUIRED_PLAYER_MAX_HEALTH := 100
const REQUIRED_ENEMY_MOVE_SPEED := 2.7
const REQUIRED_ACQUIRE_RANGE := 12.0
const REQUIRED_LOSE_RANGE := 18.0
const REQUIRED_ATTACK_RANGE := 1.6
const REQUIRED_ATTACK_DAMAGE := 20
const REQUIRED_ATTACK_COOLDOWN := 1.1

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _check(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
        push_error(message)

func _required_vector3(value: Variant, label: String) -> Vector3:
    _check(value is Array, label + " must be an array")
    if not value is Array:
        return Vector3.INF
    var values: Array = value
    _check(values.size() == 3, label + " must contain exactly three values")
    if values.size() != 3:
        return Vector3.INF
    for component in values:
        _check(typeof(component) == TYPE_INT or typeof(component) == TYPE_FLOAT, label + " components must be numeric")
    return Vector3(float(values[0]), float(values[1]), float(values[2]))

func _validate_contract(contract: Dictionary) -> bool:
    for key in ["schema_version", "experiment_id", "arena", "player", "enemy"]:
        _check(contract.has(key), "shared contract missing required key: " + key)
    if failures.size() > 0:
        return false

    _check(typeof(contract["schema_version"]) == TYPE_INT and int(contract["schema_version"]) == 1, "schema_version must remain 1")
    _check(typeof(contract["experiment_id"]) == TYPE_STRING and String(contract["experiment_id"]) == "BYJTT-LAB-001", "experiment_id must remain BYJTT-LAB-001")
    _check(contract["arena"] is Dictionary, "arena must be a dictionary")
    _check(contract["player"] is Dictionary, "player must be a dictionary")
    _check(contract["enemy"] is Dictionary, "enemy must be a dictionary")
    if failures.size() > 0:
        return false

    var arena: Dictionary = contract["arena"]
    var player_contract: Dictionary = contract["player"]
    var enemy_contract: Dictionary = contract["enemy"]
    for key in ["width", "depth", "player_spawn", "enemy_spawn"]:
        _check(arena.has(key), "arena missing required key: " + key)
    _check(player_contract.has("max_health"), "player missing required key: max_health")
    for key in ["move_speed", "acquire_range", "lose_target_range", "attack_range", "attack_damage", "attack_cooldown"]:
        _check(enemy_contract.has(key), "enemy missing required key: " + key)
    if failures.size() > 0:
        return false

    _check((typeof(arena["width"]) == TYPE_INT or typeof(arena["width"]) == TYPE_FLOAT) and is_equal_approx(float(arena["width"]), REQUIRED_ARENA_WIDTH), "arena width must remain 24 m")
    _check((typeof(arena["depth"]) == TYPE_INT or typeof(arena["depth"]) == TYPE_FLOAT) and is_equal_approx(float(arena["depth"]), REQUIRED_ARENA_DEPTH), "arena depth must remain 32 m")
    _check(_required_vector3(arena["player_spawn"], "player_spawn").is_equal_approx(REQUIRED_PLAYER_SPAWN), "player spawn must remain (0,0,10)")
    _check(_required_vector3(arena["enemy_spawn"], "enemy_spawn").is_equal_approx(REQUIRED_ENEMY_SPAWN), "enemy spawn must remain (0,0,-6)")
    _check(typeof(player_contract["max_health"]) == TYPE_INT and int(player_contract["max_health"]) == REQUIRED_PLAYER_MAX_HEALTH, "player max health must remain 100")
    _check((typeof(enemy_contract["move_speed"]) == TYPE_INT or typeof(enemy_contract["move_speed"]) == TYPE_FLOAT) and is_equal_approx(float(enemy_contract["move_speed"]), REQUIRED_ENEMY_MOVE_SPEED), "enemy move speed must remain 2.7 m/s")
    _check((typeof(enemy_contract["acquire_range"]) == TYPE_INT or typeof(enemy_contract["acquire_range"]) == TYPE_FLOAT) and is_equal_approx(float(enemy_contract["acquire_range"]), REQUIRED_ACQUIRE_RANGE), "enemy acquire range must remain 12 m")
    _check((typeof(enemy_contract["lose_target_range"]) == TYPE_INT or typeof(enemy_contract["lose_target_range"]) == TYPE_FLOAT) and is_equal_approx(float(enemy_contract["lose_target_range"]), REQUIRED_LOSE_RANGE), "enemy lose range must remain 18 m")
    _check((typeof(enemy_contract["attack_range"]) == TYPE_INT or typeof(enemy_contract["attack_range"]) == TYPE_FLOAT) and is_equal_approx(float(enemy_contract["attack_range"]), REQUIRED_ATTACK_RANGE), "enemy attack range must remain 1.6 m")
    _check(typeof(enemy_contract["attack_damage"]) == TYPE_INT and int(enemy_contract["attack_damage"]) == REQUIRED_ATTACK_DAMAGE, "enemy attack damage must remain 20")
    _check((typeof(enemy_contract["attack_cooldown"]) == TYPE_INT or typeof(enemy_contract["attack_cooldown"]) == TYPE_FLOAT) and is_equal_approx(float(enemy_contract["attack_cooldown"]), REQUIRED_ATTACK_COOLDOWN), "enemy attack cooldown must remain 1.1 s")
    return failures.is_empty()

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
    if not _validate_contract(contract):
        print("BYJTT_RESULT=" + JSON.stringify({"experiment_id": "BYJTT-LAB-001", "slice": "godot-character-navigation-acquisition-combat-gate", "result": "fail", "failures": failures}))
        quit(1)
        return

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
    _check(bool(runtime.observe().get("navigation_synchronized", false)), "runtime navigation map and region must synchronize normally")

    var initial_player_position: Vector3 = player.global_position
    var initial_distance := float(runtime.observe().get("distance_to_player", -1.0))
    _check(initial_distance > REQUIRED_ACQUIRE_RANGE, "shared spawns must begin outside the unchanged acquisition range")

    var acquisition_frame := -1
    Input.action_press("move_forward")
    for frame in range(MAX_ACQUISITION_FRAMES):
        await physics_frame
        if bool(runtime.observe().get("target_acquired", false)):
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
    _check(acquisition_distance <= REQUIRED_ACQUIRE_RANGE + 0.05, "acquisition must occur at the unchanged shared acquire range")

    for _frame in range(MAX_COMBAT_FRAMES):
        await physics_frame
        if int(runtime.observe().get("enemy_attack_count", 0)) >= 1:
            break

    var first_attack_observation: Dictionary = runtime.observe()
    _check(int(first_attack_observation.get("enemy_attack_count", 0)) == 1, "enemy runtime must execute one bounded first attack")
    _check(is_equal_approx(float(first_attack_observation.get("enemy_attack_cooldown_s", -1.0)), REQUIRED_ATTACK_COOLDOWN), "runtime must expose the unchanged 1.1 s enemy cooldown")
    _check(float(first_attack_observation.get("distance_to_player", 999.0)) <= REQUIRED_ATTACK_RANGE + 0.1, "first attack must occur only inside unchanged attack range")

    for _frame in range(COOLDOWN_GUARD_FRAMES):
        await physics_frame
    var final_observation: Dictionary = runtime.observe()
    var player_health := int(final_observation.get("player_health", -1))
    var final_distance := float(final_observation.get("distance_to_player", 999.0))
    _check(COOLDOWN_GUARD_FRAMES / 60.0 < REQUIRED_ATTACK_COOLDOWN, "cooldown guard duration must stay below required cooldown")
    _check(int(final_observation.get("enemy_attack_count", 0)) == 1, "enemy cooldown must prevent a second attack during the sub-cooldown guard window")
    _check(bool(final_observation.get("target_retained", false)), "enemy runtime must retain the legitimately acquired target within the unchanged lose range")
    _check(bool(final_observation.get("native_path_found", false)), "enemy runtime must consume a native NavigationServer3D path")
    _check(int(final_observation.get("path_queries", 0)) > 0, "enemy runtime must execute at least one native path query")
    _check(player_health == REQUIRED_PLAYER_MAX_HEALTH - REQUIRED_ATTACK_DAMAGE, "runtime attack must apply the unchanged shared damage exactly once")
    _check(final_distance <= REQUIRED_ATTACK_RANGE + 0.1, "target must remain in attack range during cooldown guard")

    var mutated_observation: Dictionary = runtime.observe()
    mutated_observation["player_health"] = 999
    mutated_observation["enemy_position"][0] = 999.0
    mutated_observation["distance_to_player"] = 999.0
    var isolated_observation: Dictionary = runtime.observe()
    var isolated_enemy_position: Array = isolated_observation.get("enemy_position", [999.0, 999.0, 999.0])
    var observation_isolated := (
        int(isolated_observation.get("player_health", 999)) == player_health
        and float(isolated_enemy_position[0]) != 999.0
        and float(isolated_observation.get("distance_to_player", 999.0)) != 999.0
        and player.global_position.is_equal_approx(player_after_input)
    )
    _check(observation_isolated, "mutating an actual runtime observation snapshot must not alter fresh observations or authoritative player state")

    var result := {
        "experiment_id": "BYJTT-LAB-001",
        "slice": "godot-character-navigation-acquisition-combat-gate",
        "result": "pass" if failures.is_empty() else "fail",
        "engine_version": Engine.get_version_info().get("string", "unknown"),
        "player_controller": "CharacterBody3D",
        "player_native_move_and_slide": true,
        "navigation_system": "NavigationServer3D",
        "enemy_controller": "CharacterBody3D",
        "contract_oracle_validated": true,
        "initial_distance_m": initial_distance,
        "acquire_range_m": REQUIRED_ACQUIRE_RANGE,
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
        "enemy_attack_range_m": REQUIRED_ATTACK_RANGE,
        "enemy_attack_damage": REQUIRED_ATTACK_DAMAGE,
        "enemy_attack_cooldown_s": REQUIRED_ATTACK_COOLDOWN,
        "cooldown_guard_s": COOLDOWN_GUARD_FRAMES / 60.0,
        "cooldown_guard_passed": int(final_observation.get("enemy_attack_count", 0)) == 1,
        "enemy_attack_count": int(final_observation.get("enemy_attack_count", 0)),
        "player_health_before": REQUIRED_PLAYER_MAX_HEALTH,
        "player_health_after": player_health,
        "final_distance_m": final_distance,
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
