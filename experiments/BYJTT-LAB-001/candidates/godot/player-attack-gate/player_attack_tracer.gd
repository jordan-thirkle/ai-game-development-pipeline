extends SceneTree

const MAX_SYNC_FRAMES := 30
const MAX_ACQUISITION_FRAMES := 180
const MAX_CHASE_FRAMES := 420
const EARLY_REPRESS_FRAMES := 8
const POST_COOLDOWN_FRAMES := 34

const REQUIRED_ARENA_WIDTH := 24.0
const REQUIRED_ARENA_DEPTH := 32.0
const REQUIRED_PLAYER_ATTACK_DAMAGE := 34
const REQUIRED_PLAYER_ATTACK_RANGE := 1.8
const REQUIRED_PLAYER_ATTACK_COOLDOWN := 0.55
const REQUIRED_ENEMY_MAX_HEALTH := 100
const REQUIRED_ENEMY_ATTACK_DAMAGE := 20
const REQUIRED_ENEMY_ATTACK_RANGE := 1.6
const REQUIRED_ENEMY_ATTACK_COOLDOWN := 1.1
const REQUIRED_ACQUIRE_RANGE := 12.0

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _check(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
        push_error(message)

func _press_action_once(action: String) -> void:
    Input.action_press(action)
    await physics_frame
    Input.action_release(action)
    await physics_frame

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

    var contract_value = scene.get("contract")
    var player = scene.get("player") as CharacterBody3D
    _check(typeof(contract_value) == TYPE_DICTIONARY, "existing scene must expose shared contract")
    _check(player != null, "existing scene must expose CharacterBody3D player")
    if typeof(contract_value) != TYPE_DICTIONARY or player == null:
        quit(1)
        return

    var contract: Dictionary = contract_value
    var arena: Dictionary = contract.get("arena", {})
    var player_contract: Dictionary = contract.get("player", {})
    var enemy_contract: Dictionary = contract.get("enemy", {})
    _check(is_equal_approx(float(arena.get("width", -1.0)), REQUIRED_ARENA_WIDTH), "arena width must remain 24 m")
    _check(is_equal_approx(float(arena.get("depth", -1.0)), REQUIRED_ARENA_DEPTH), "arena depth must remain 32 m")
    _check(int(player_contract.get("attack_damage", -1)) == REQUIRED_PLAYER_ATTACK_DAMAGE, "player attack damage must remain 34")
    _check(is_equal_approx(float(player_contract.get("attack_range", -1.0)), REQUIRED_PLAYER_ATTACK_RANGE), "player attack range must remain 1.8 m")
    _check(is_equal_approx(float(player_contract.get("attack_cooldown", -1.0)), REQUIRED_PLAYER_ATTACK_COOLDOWN), "player attack cooldown must remain 0.55 s")
    _check(int(enemy_contract.get("max_health", -1)) == REQUIRED_ENEMY_MAX_HEALTH, "enemy max health must remain 100")
    _check(int(enemy_contract.get("attack_damage", -1)) == REQUIRED_ENEMY_ATTACK_DAMAGE, "enemy attack damage must remain 20")
    _check(is_equal_approx(float(enemy_contract.get("attack_range", -1.0)), REQUIRED_ENEMY_ATTACK_RANGE), "enemy attack range must remain 1.6 m")
    _check(is_equal_approx(float(enemy_contract.get("attack_cooldown", -1.0)), REQUIRED_ENEMY_ATTACK_COOLDOWN), "enemy attack cooldown must remain 1.1 s")
    _check(is_equal_approx(float(enemy_contract.get("acquire_range", -1.0)), REQUIRED_ACQUIRE_RANGE), "enemy acquire range must remain 12 m")
    if not failures.is_empty():
        _emit_result({}, {})
        quit(1)
        return

    var enemy_runtime_script := load("res://integration-gate/enemy_runtime.gd") as GDScript
    var player_attack_script := load("res://player-attack-gate/player_attack_runtime.gd") as GDScript
    _check(enemy_runtime_script != null, "existing enemy runtime must load")
    _check(player_attack_script != null, "player attack runtime must load")
    if enemy_runtime_script == null or player_attack_script == null:
        quit(1)
        return

    var enemy_runtime = enemy_runtime_script.new()
    enemy_runtime.configure(contract, player)
    root.add_child(enemy_runtime)

    var sync_frames := 0
    while sync_frames < MAX_SYNC_FRAMES:
        await physics_frame
        sync_frames += 1
        if bool(enemy_runtime.observe().get("navigation_synchronized", false)):
            break
    _check(bool(enemy_runtime.observe().get("navigation_synchronized", false)), "NavigationServer3D must synchronize normally")

    var initial_distance := float(enemy_runtime.observe().get("distance_to_player", -1.0))
    _check(initial_distance > REQUIRED_ACQUIRE_RANGE, "shared spawns must begin outside acquisition range")

    Input.action_press("move_forward")
    var acquisition_frame := -1
    for frame in range(MAX_ACQUISITION_FRAMES):
        await physics_frame
        if bool(enemy_runtime.observe().get("target_acquired", false)):
            acquisition_frame = frame + 1
            break
    Input.action_release("move_forward")
    await physics_frame
    _check(acquisition_frame > 0, "normal move_forward action must cross acquisition threshold")
    _check(float(enemy_runtime.observe().get("distance_to_player", 999.0)) <= REQUIRED_ACQUIRE_RANGE + 0.05, "acquisition must occur at unchanged 12 m threshold")

    var in_combat := false
    for _frame in range(MAX_CHASE_FRAMES):
        await physics_frame
        var enemy_observation: Dictionary = enemy_runtime.observe()
        if float(enemy_observation.get("distance_to_player", 999.0)) <= REQUIRED_ENEMY_ATTACK_RANGE + 0.05 and int(enemy_observation.get("enemy_attack_count", 0)) >= 1:
            in_combat = true
            break
    _check(in_combat, "native CharacterBody3D chase must legitimately reach combat range and execute enemy response")

    var attack_runtime = player_attack_script.new()
    attack_runtime.configure(contract, player, enemy_runtime.enemy)
    root.add_child(attack_runtime)
    await physics_frame

    var enemy_before: Dictionary = enemy_runtime.observe()
    var player_health_before := int(enemy_before.get("player_health", -1))
    _check(player_health_before == 80, "enemy response must reduce player health 100 to 80 before player attack proof")
    _check(float(enemy_before.get("distance_to_player", 999.0)) <= REQUIRED_PLAYER_ATTACK_RANGE, "enemy must be inside unchanged player attack range")

    await _press_action_once("attack")
    var first_attack: Dictionary = attack_runtime.observe()
    _check(int(first_attack.get("enemy_health", -1)) == 66, "first valid player attack must reduce enemy health 100 to 66")
    _check(int(first_attack.get("attack_count", 0)) == 1, "first valid player action must execute exactly one attack")
    _check(float(first_attack.get("last_attack_distance_m", 999.0)) <= REQUIRED_PLAYER_ATTACK_RANGE, "first attack must occur only inside 1.8 m range")

    for _frame in range(EARLY_REPRESS_FRAMES):
        await physics_frame
    await _press_action_once("attack")
    var early_attack: Dictionary = attack_runtime.observe()
    _check(EARLY_REPRESS_FRAMES / 60.0 < REQUIRED_PLAYER_ATTACK_COOLDOWN, "early repress interval must remain below player cooldown")
    _check(int(early_attack.get("enemy_health", -1)) == 66, "early second press must not damage enemy during cooldown")
    _check(int(early_attack.get("attack_count", 0)) == 1, "early second press must not increment attack count")
    _check(int(early_attack.get("blocked_cooldown_press_count", 0)) >= 1, "cooldown must explicitly reject the early press")

    for _frame in range(POST_COOLDOWN_FRAMES):
        await physics_frame
    await _press_action_once("attack")
    var final_attack: Dictionary = attack_runtime.observe()
    var final_enemy: Dictionary = enemy_runtime.observe()
    _check(int(final_attack.get("enemy_health", -1)) == 32, "second valid post-cooldown attack must reduce enemy health 66 to 32")
    _check(int(final_attack.get("attack_count", 0)) == 2, "exactly two valid player attacks must execute")
    _check(int(final_attack.get("attack_press_count", 0)) == 3, "three attack action presses must be consumed")
    _check(int(final_attack.get("out_of_range_press_count", 0)) == 0, "no accepted proof attack may depend on out-of-range behavior")
    _check(int(final_enemy.get("player_health", 100)) < 100, "enemy response must remain active during bidirectional exchange")

    var mutated: Dictionary = attack_runtime.observe()
    mutated["enemy_health"] = 999
    mutated["attack_count"] = 999
    var isolated: Dictionary = attack_runtime.observe()
    var observation_isolated := int(isolated.get("enemy_health", 999)) == 32 and int(isolated.get("attack_count", 999)) == 2
    _check(observation_isolated, "mutating an attack observation snapshot must not alter runtime state")

    _emit_result(final_attack, final_enemy, {
        "initial_distance_m": initial_distance,
        "acquisition_frame": acquisition_frame,
        "player_health_before_player_attack": player_health_before,
        "observation_mutation_isolated": observation_isolated,
    })
    quit(0 if failures.is_empty() else 1)

func _emit_result(attack_observation: Dictionary, enemy_observation: Dictionary, extra: Dictionary = {}) -> void:
    var result := {
        "experiment_id": "BYJTT-LAB-001",
        "slice": "godot-player-attack-bidirectional-combat-gate",
        "result": "pass" if failures.is_empty() else "fail",
        "engine_version": Engine.get_version_info().get("string", "unknown"),
        "player_controller": "CharacterBody3D",
        "navigation_system": "NavigationServer3D",
        "player_attack_action_input_executed": true,
        "physical_os_input_executed": false,
        "player_attack_range_m": REQUIRED_PLAYER_ATTACK_RANGE,
        "player_attack_damage": REQUIRED_PLAYER_ATTACK_DAMAGE,
        "player_attack_cooldown_s": REQUIRED_PLAYER_ATTACK_COOLDOWN,
        "enemy_health_after": int(attack_observation.get("enemy_health", -1)),
        "player_attack_count": int(attack_observation.get("attack_count", 0)),
        "attack_press_count": int(attack_observation.get("attack_press_count", 0)),
        "blocked_cooldown_press_count": int(attack_observation.get("blocked_cooldown_press_count", 0)),
        "enemy_attack_count": int(enemy_observation.get("enemy_attack_count", 0)),
        "player_health_after": int(enemy_observation.get("player_health", -1)),
        "bidirectional_damage_exchange_executed": int(attack_observation.get("attack_count", 0)) >= 2 and int(enemy_observation.get("enemy_attack_count", 0)) >= 1,
        "direct_enemy_health_setter_exposed": bool(attack_observation.get("direct_enemy_health_setter_exposed", true)),
        "test_only_gameplay_mutation_shortcut": false,
        "post_navigation_position_clamp": bool(enemy_observation.get("post_navigation_position_clamp", true)),
        "post_physics_arena_clamp": bool(enemy_observation.get("post_physics_arena_clamp", true)),
        "failures": failures,
    }
    result.merge(extra, true)
    print("BYJTT_RESULT=" + JSON.stringify(result))
