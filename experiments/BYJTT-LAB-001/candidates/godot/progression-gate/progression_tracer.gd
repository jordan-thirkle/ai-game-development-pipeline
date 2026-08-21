extends SceneTree

const PLAYER_SCRIPT := preload("res://progression-gate/progression_player.gd")
const RUNTIME_SCRIPT := preload("res://progression-gate/progression_runtime.gd")

const ARENA_WIDTH_M := 24.0
const ARENA_DEPTH_M := 32.0
const PLAYER_SPAWN := Vector3(0.0, 0.0, 10.0)
const SALVAGE_SPAWN := Vector3(5.0, 0.0, 0.0)
const WALK_SPEED_MPS := 3.5
const ATTACK_DAMAGE := 34
const ATTACK_RANGE_M := 1.8
const ATTACK_COOLDOWN_S := 0.55
const SALVAGE_HEALTH := 34
const PICKUP_RADIUS_M := 1.25
const REWARD_COUNT := 1
const UPGRADE_ID := "damage-up-1"
const DAMAGE_MULTIPLIER := 1.2

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    _ensure_input_actions()

    var world := Node3D.new()
    world.name = "ProgressionGateWorld"
    root.add_child(world)

    var player: CharacterBody3D = PLAYER_SCRIPT.new()
    player.name = "Player"
    world.add_child(player)
    player.global_position = PLAYER_SPAWN
    player.configure(WALK_SPEED_MPS)

    var runtime: Node = RUNTIME_SCRIPT.new()
    runtime.name = "ProgressionRuntime"
    world.add_child(runtime)
    runtime.configure(player)

    await physics_frame
    await physics_frame

    var initial_distance := _horizontal_distance(player.global_position, SALVAGE_SPAWN)
    _expect(_inside_arena(player.global_position), "player spawn outside shared arena")
    _expect(absf(initial_distance - sqrt(125.0)) < 0.0001, "initial player-to-salvage distance drifted")

    var movement_steps := 0
    Input.action_press("move_forward")
    while player.global_position.z > 0.8 and movement_steps < 240:
        await physics_frame
        movement_steps += 1
    Input.action_release("move_forward")
    await physics_frame

    Input.action_press("move_right")
    while _horizontal_distance(player.global_position, SALVAGE_SPAWN) > 1.70 and movement_steps < 480:
        await physics_frame
        movement_steps += 1
    Input.action_release("move_right")
    await physics_frame

    var before_attack: Dictionary = runtime.observe()
    _expect(float(before_attack.get("distance_to_salvage_m", 999.0)) <= ATTACK_RANGE_M, "player never reached salvage attack range through action movement")
    _expect(int(before_attack.get("salvage_health", -1)) == SALVAGE_HEALTH, "salvage health changed before attack action")

    Input.action_press("attack")
    await physics_frame
    Input.action_release("attack")
    await physics_frame

    var after_attack: Dictionary = runtime.observe()
    _expect(int(after_attack.get("salvage_health", -1)) == 0, "attack action did not break salvage")
    _expect(int(after_attack.get("valid_attack_count", 0)) == 1, "expected exactly one valid salvage attack")
    _expect(float(after_attack.get("attack_distance_m", 999.0)) <= ATTACK_RANGE_M, "salvage attack happened outside shared range")
    _expect(bool(after_attack.get("reward_available", false)), "reward did not become available after salvage break")

    Input.action_press("move_right")
    while _horizontal_distance(player.global_position, SALVAGE_SPAWN) > 1.20 and movement_steps < 600:
        await physics_frame
        movement_steps += 1
    Input.action_release("move_right")
    await physics_frame
    await physics_frame

    var after_pickup: Dictionary = runtime.observe()
    _expect(bool(after_pickup.get("reward_collected", false)), "reward was not collected after native movement entered pickup radius")
    _expect(int(after_pickup.get("reward_count", 0)) == REWARD_COUNT, "reward count drifted from shared contract")
    _expect(float(after_pickup.get("pickup_distance_m", 999.0)) <= PICKUP_RADIUS_M, "reward pickup occurred outside shared pickup radius")

    Input.action_press("interact")
    await physics_frame
    Input.action_release("interact")
    await physics_frame

    var after_upgrade: Dictionary = runtime.observe()
    var selected: Array = after_upgrade.get("selected_upgrades", [])
    _expect(selected.has(UPGRADE_ID), "interact action did not select damage-up-1")
    _expect(int(after_upgrade.get("upgrade_selection_count", 0)) == 1, "expected exactly one upgrade selection")
    _expect(absf(float(after_upgrade.get("effective_attack_damage", 0.0)) - 40.8) < 0.0001, "effective damage did not become 34 * 1.2")

    var mutated_observation: Dictionary = runtime.observe()
    mutated_observation["reward_count"] = 999
    mutated_observation["selected_upgrades"] = ["forged-upgrade"]
    var fresh_observation: Dictionary = runtime.observe()
    var fresh_selected: Array = fresh_observation.get("selected_upgrades", [])
    var observation_mutation_isolated := int(fresh_observation.get("reward_count", 0)) == REWARD_COUNT and fresh_selected.has(UPGRADE_ID) and not fresh_selected.has("forged-upgrade")
    _expect(observation_mutation_isolated, "observation copy mutated engine-owned progression state")
    _expect(_inside_arena(player.global_position), "player left shared arena")

    var result := {
        "result": "pass" if failures.is_empty() else "fail",
        "experiment_id": "BYJTT-LAB-001",
        "engine": "Godot",
        "player_controller": "CharacterBody3D",
        "movement_api": "move_and_slide",
        "arena_width_m": ARENA_WIDTH_M,
        "arena_depth_m": ARENA_DEPTH_M,
        "player_spawn": [PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z],
        "salvage_spawn": [SALVAGE_SPAWN.x, SALVAGE_SPAWN.y, SALVAGE_SPAWN.z],
        "walk_speed_mps": WALK_SPEED_MPS,
        "attack_damage": ATTACK_DAMAGE,
        "attack_range_m": ATTACK_RANGE_M,
        "attack_cooldown_s": ATTACK_COOLDOWN_S,
        "salvage_max_health": SALVAGE_HEALTH,
        "pickup_radius_m": PICKUP_RADIUS_M,
        "reward_count": int(fresh_observation.get("reward_count", 0)),
        "upgrade_id": UPGRADE_ID,
        "damage_multiplier": DAMAGE_MULTIPLIER,
        "effective_attack_damage": float(fresh_observation.get("effective_attack_damage", 0.0)),
        "movement_steps": movement_steps,
        "attack_press_count": int(fresh_observation.get("attack_press_count", 0)),
        "valid_attack_count": int(fresh_observation.get("valid_attack_count", 0)),
        "interact_press_count": int(fresh_observation.get("interact_press_count", 0)),
        "upgrade_selection_count": int(fresh_observation.get("upgrade_selection_count", 0)),
        "attack_distance_m": float(fresh_observation.get("attack_distance_m", -1.0)),
        "pickup_distance_m": float(fresh_observation.get("pickup_distance_m", -1.0)),
        "selected_upgrades": fresh_selected,
        "action_input_executed": int(fresh_observation.get("attack_press_count", 0)) >= 1 and int(fresh_observation.get("interact_press_count", 0)) >= 1,
        "physical_os_input_executed": false,
        "observation_mutation_isolated": observation_mutation_isolated,
        "direct_salvage_health_setter_exposed": bool(fresh_observation.get("direct_salvage_health_setter_exposed", true)),
        "direct_reward_grant_exposed": bool(fresh_observation.get("direct_reward_grant_exposed", true)),
        "direct_upgrade_grant_exposed": bool(fresh_observation.get("direct_upgrade_grant_exposed", true)),
        "direct_position_setter_exposed": bool(fresh_observation.get("direct_position_setter_exposed", true)),
        "test_only_gameplay_mutation_shortcut": bool(fresh_observation.get("test_only_gameplay_mutation_shortcut", true)),
        "post_physics_arena_clamp": false,
        "persistence_executed": false,
        "failures": failures.duplicate(),
    }

    print("BYJTT_RESULT=" + JSON.stringify(result))
    quit(0 if failures.is_empty() else 1)

func _ensure_input_actions() -> void:
    for action in ["move_forward", "move_back", "move_left", "move_right", "attack", "interact"]:
        if not InputMap.has_action(action):
            InputMap.add_action(action)

func _horizontal_distance(a: Vector3, b: Vector3) -> float:
    return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))

func _inside_arena(position: Vector3) -> bool:
    return absf(position.x) <= ARENA_WIDTH_M * 0.5 and absf(position.z) <= ARENA_DEPTH_M * 0.5

func _expect(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
