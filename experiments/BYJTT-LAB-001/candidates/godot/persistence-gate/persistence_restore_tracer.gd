extends SceneTree

const PERSISTENCE_SCRIPT := preload("res://persistence-gate/persistence_runtime.gd")
const UPGRADE_ID := "damage-up-1"
const REWARD_COUNT := 1

var failures: Array[String] = []

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var persistence: Node = PERSISTENCE_SCRIPT.new()
    root.add_child(persistence)
    await process_frame
    await process_frame

    var restored: Dictionary = persistence.observe()
    var restored_upgrades: Array = restored.get("selected_upgrades", [])
    _expect(bool(restored.get("loaded_from_disk", false)), "fresh runtime did not load the existing save")
    _expect(int(restored.get("load_count", 0)) == 1, "fresh runtime did not execute exactly one startup load")
    _expect(int(restored.get("schema_version", 0)) == 1, "restored schema version drifted")
    _expect(int(restored.get("reward_count", 0)) == REWARD_COUNT, "reward count did not survive restart")
    _expect(restored_upgrades.has(UPGRADE_ID), "damage-up-1 did not survive restart")
    _expect(absf(float(restored.get("effective_attack_damage", 0.0)) - 40.8) < 0.0001, "restored upgrade did not reproduce effective damage")

    var mutated: Dictionary = persistence.observe()
    mutated["reward_count"] = 999
    mutated["selected_upgrades"] = ["forged-upgrade"]
    var fresh: Dictionary = persistence.observe()
    var fresh_upgrades: Array = fresh.get("selected_upgrades", [])
    var observation_mutation_isolated := int(fresh.get("reward_count", 0)) == REWARD_COUNT and fresh_upgrades.has(UPGRADE_ID) and not fresh_upgrades.has("forged-upgrade")
    _expect(observation_mutation_isolated, "restored observation mutated engine-owned state")

    var result := {
        "result": "pass" if failures.is_empty() else "fail",
        "experiment_id": "BYJTT-LAB-001",
        "engine": "Godot",
        "engine_persistence_api": str(fresh.get("engine_persistence_api", "")),
        "second_process_restore_executed": true,
        "loaded_from_disk": bool(fresh.get("loaded_from_disk", false)),
        "load_count": int(fresh.get("load_count", 0)),
        "schema_version": int(fresh.get("schema_version", 0)),
        "reward_count": int(fresh.get("reward_count", 0)),
        "selected_upgrades": fresh_upgrades,
        "effective_attack_damage": float(fresh.get("effective_attack_damage", 0.0)),
        "save_file_exists": bool(fresh.get("save_file_exists", false)),
        "observation_mutation_isolated": observation_mutation_isolated,
        "direct_save_file_write_exposed_to_harness": bool(fresh.get("direct_save_file_write_exposed_to_harness", true)),
        "direct_reward_grant_exposed": bool(fresh.get("direct_reward_grant_exposed", true)),
        "direct_upgrade_grant_exposed": bool(fresh.get("direct_upgrade_grant_exposed", true)),
        "test_only_gameplay_mutation_shortcut": bool(fresh.get("test_only_gameplay_mutation_shortcut", true)),
        "physical_os_input_executed": false,
        "rendered_execution": false,
        "failures": failures.duplicate(),
    }
    print("BYJTT_RESTORE_RESULT=" + JSON.stringify(result))
    quit(0 if failures.is_empty() else 1)

func _expect(condition: bool, message: String) -> void:
    if not condition:
        failures.append(message)
