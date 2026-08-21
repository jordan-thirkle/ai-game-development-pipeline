extends Node

const SAVE_PATH := "user://byjtt-lab-001-persistence.cfg"
const SCHEMA_VERSION := 1
const UPGRADE_ID := "damage-up-1"
const BASE_ATTACK_DAMAGE := 34.0
const DAMAGE_MULTIPLIER := 1.2

var progression_source: Node
var configured := false
var schema_version := SCHEMA_VERSION
var reward_count := 0
var selected_upgrades: Array[String] = []
var save_action_press_count := 0
var save_count := 0
var load_count := 0
var loaded_from_disk := false
var last_save_error := OK
var last_load_error := OK

func _ready() -> void:
    _load_from_disk()

func configure(source: Node) -> void:
    progression_source = source
    if not InputMap.has_action("pause"):
        InputMap.add_action("pause")
    configured = true

func _physics_process(_delta: float) -> void:
    if not configured or progression_source == null:
        return
    if Input.is_action_just_pressed("pause"):
        save_action_press_count += 1
        _save_progression_state()

func _save_progression_state() -> void:
    var progression: Dictionary = progression_source.observe()
    schema_version = SCHEMA_VERSION
    reward_count = int(progression.get("reward_count", 0))
    var observed_upgrades: Array = progression.get("selected_upgrades", [])
    selected_upgrades.clear()
    for upgrade in observed_upgrades:
        selected_upgrades.append(str(upgrade))

    var config := ConfigFile.new()
    config.set_value("save", "schema_version", schema_version)
    config.set_value("save", "reward_count", reward_count)
    config.set_value("save", "selected_upgrades", selected_upgrades.duplicate())
    last_save_error = config.save(SAVE_PATH)
    if last_save_error == OK:
        save_count += 1

func _load_from_disk() -> void:
    if not FileAccess.file_exists(SAVE_PATH):
        return
    var config := ConfigFile.new()
    last_load_error = config.load(SAVE_PATH)
    if last_load_error != OK:
        return
    schema_version = int(config.get_value("save", "schema_version", 0))
    reward_count = int(config.get_value("save", "reward_count", 0))
    selected_upgrades.clear()
    var stored_upgrades: Array = config.get_value("save", "selected_upgrades", [])
    for upgrade in stored_upgrades:
        selected_upgrades.append(str(upgrade))
    loaded_from_disk = true
    load_count += 1

func effective_attack_damage() -> float:
    if selected_upgrades.has(UPGRADE_ID):
        return BASE_ATTACK_DAMAGE * DAMAGE_MULTIPLIER
    return BASE_ATTACK_DAMAGE

func observe() -> Dictionary:
    return {
        "schema_version": schema_version,
        "reward_count": reward_count,
        "selected_upgrades": selected_upgrades.duplicate(),
        "effective_attack_damage": effective_attack_damage(),
        "save_action_press_count": save_action_press_count,
        "save_count": save_count,
        "load_count": load_count,
        "loaded_from_disk": loaded_from_disk,
        "save_file_exists": FileAccess.file_exists(SAVE_PATH),
        "last_save_error": last_save_error,
        "last_load_error": last_load_error,
        "engine_persistence_api": "ConfigFile",
        "direct_save_file_write_exposed_to_harness": false,
        "direct_reward_grant_exposed": false,
        "direct_upgrade_grant_exposed": false,
        "test_only_gameplay_mutation_shortcut": false,
    }.duplicate(true)
