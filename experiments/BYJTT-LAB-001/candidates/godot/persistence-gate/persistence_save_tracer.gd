extends SceneTree

const PLAYER_SCRIPT := preload("res://progression-gate/progression_player.gd")
const PROGRESSION_SCRIPT := preload("res://progression-gate/progression_runtime.gd")
const PERSISTENCE_SCRIPT := preload("res://persistence-gate/persistence_runtime.gd")

const PLAYER_SPAWN := Vector3(0.0, 0.0, 10.0)
const SALVAGE_SPAWN := Vector3(5.0, 0.0, 0.0)
const WALK_SPEED_MPS := 3.5
const ATTACK_RANGE_M := 1.8
const PICKUP_RADIUS_M := 1.25
const REWARD_COUNT := 1
const UPGRADE_ID := "damage-up-1"

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    _ensure_input_actions()

    var world := Node3D.new()
    root.add_child(world)

    var player: CharacterBody3D = PLAYER_SCRIPT.new()
    world.add_child(player)
    player.global_position = PLAYER_SPAWN
    player.configure(WALK_SPEED_MPS)

    var progression: Node = PROGRESSION_SCRIPT.new()
    world.add_child(progression)
    progression.configure(player)

    var persistence: Node = PERSISTENCE_SCRIPT.new()
    world.add_child(persistence)
    persistence.configure(progression)

    await physics_frame
    await physics_frame

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

    var before_attack: Dictionary = progression.observe()
    _expect(float(before_attack.get("distance_to_salvage_m", 999.0)) <= ATTACK_RANGE_M, "player never reached salvage attack range")

    Input.action_press("attack")
    await physics_frame
    Input.action_release("attack")
    await physics_frame

    Input.action_press("move_right")
    while _horizontal_distance(player.global_position, SALVAGE_SPAWN) > 1.20 and movement_steps < 600:
        await physics_frame
        movement_steps += 1
    Input.action_release("move_right")
    await physics_frame
    await physics_frame

    var after_pickup: Dictionary = progression.observe()
    _expect(int(after_pickup.get("reward_count", 0)) == REWARD_COUNT, "reward count was not earned through gameplay")
    _expect(float(after_pickup.get("pickup_distance_m", 999.0)) <= PICKUP_RADIUS_M, "reward pickup occurred outside shared radius")

    Input.action_press("interact")
    await physics_frame
    Input.action_release("interact")
    await physics_frame

    var after_upgrade: Dictionary = progression.observe()
    var earned_upgrades: Array = after_upgrade.get("selected_upgrades", [])
    _expect(earned_upgrades.has(UPGRADE_ID), "upgrade was not earned through interact action")
    _expect(absf(float(after_upgrade.get("effective_attack_damage", 0.0)) - 40.8) < 0.0001, "earned damage multiplier drifted")

    Input.action_press("pause")
    await physics_frame
    Input.action_release("pause")
    await physics_frame

    var saved: Dictionary = persistence.observe()
    _expect(int(saved.get("save_action_press_count", 0)) == 1, "save gameplay action was not consumed exactly once")
    _expect(int(saved.get("save_count", 0)) == 1, "engine save path did not complete exactly once")
    _expect(bool(saved.get("save_file_exists", false)), "engine ConfigFile save was not created")
    _expect(int(saved.get("schema_version", 0)) == 1, "saved schema version drifted")
    _expect(int(saved.get("reward_count", 0)) == REWARD_COUNT, "saved reward count drifted")
    var saved_upgrades: Array = saved.get("selected_upgrades", [])
    _expect(saved_upgrades.has(UPGRADE_ID), "saved upgrade set lost damage-up-1")

    var mutated: Dictionary = persistence.observe()
    mutated["reward_count"] = 999
    mutated["selected_upgrades"] = ["forged-upgrade"]
    var fresh: Dictionary = persistence.observe()
    var fresh_upgrades: Array = fresh.get("selected_upgrades", [])
    var observation_mutation_isolated := int(fresh.get("reward_count", 0)) == REWARD_COUNT and fresh_upgrades.has(UPGRADE_ID) and not fresh_upgrades.has("forged-upgrade")
    _expect(observation_mutation_isolated, "persistence observation mutated engine-owned state")

    var result := {
        "result": "pass" if failures.is_empty() else "fail",
        "experiment_id": "BYJTT-LAB-001",
        "engine": "Godot",
        "engine_persistence_api": str(fresh.get("engine_persistence_api", "")),
        "schema_version": int(fresh.get("schema_version", 0)),
        "reward_count": int(fresh.get("reward_count", 0)),
        "selected_upgrades": fresh_upgrades,
        "effective_attack_damage": float(fresh.get("effective_attack_damage", 0.0)),
        "save_action_press_count": int(fresh.get("save_action_press_count", 0)),
        "save_count": int(fresh.get("save_count", 0)),
        "save_file_exists": bool(fresh.get("save_file_exists", false)),
        "movement_steps": movement_steps,
        "progression_earned_through_action_input": int(after_upgrade.get("attack_press_count", 0)) >= 1 and int(after_upgrade.get("interact_press_count", 0)) >= 1,
        "save_triggered_through_gameplay_action": int(fresh.get("save_action_press_count", 0)) == 1,
        "observation_mutation_isolated": observation_mutation_isolated,
        "direct_save_file_write_exposed_to_harness": bool(fresh.get("direct_save_file_write_exposed_to_harness", true)),
        "direct_reward_grant_exposed": bool(fresh.get("direct_reward_grant_exposed", true)),
        "direct_upgrade_grant_exposed": bool(fresh.get("direct_upgrade_grant_exposed", true)),
        "test_only_gameplay_mutation_shortcut": bool(fresh.get("test_only_gameplay_mutation_shortcut", true)),
        "physical_os_input_executed": false,
        "rendered_execution": false,
        "failures": failures.duplicate(),
    }
    print("BYJTT_SAVE_RESULT=" + JSON.stringify(result))
    quit(0 if failures.is_empty() else 1)

func _ensure_input_actions() -> void:
    for action in ["move_forward", "move_back", "move_left", "move_right", "attack", "interact", "pause"]:
        if not InputMap.has_action(action):
            InputMap.add_action(action)

func _horizontal_distance(a: Vector3, b: Vector3) -> float:
    return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))

func _expect(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
