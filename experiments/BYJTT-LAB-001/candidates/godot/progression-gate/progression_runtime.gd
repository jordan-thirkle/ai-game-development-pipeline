extends Node

var player: CharacterBody3D
var salvage_position := Vector3(5.0, 0.0, 0.0)
var salvage_health := 34
var reward_count := 0
var reward_available := false
var reward_collected := false
var selected_upgrades: Array[String] = []
var attack_cooldown_left := 0.0
var attack_press_count := 0
var valid_attack_count := 0
var interact_press_count := 0
var upgrade_selection_count := 0
var attack_distance_m := -1.0
var pickup_distance_m := -1.0
var configured := false

const ATTACK_DAMAGE := 34
const ATTACK_RANGE_M := 1.8
const ATTACK_COOLDOWN_S := 0.55
const PICKUP_RADIUS_M := 1.25
const UPGRADE_ID := "damage-up-1"
const DAMAGE_MULTIPLIER := 1.2

func configure(player_body: CharacterBody3D) -> void:
    player = player_body
    if not InputMap.has_action("attack"):
        InputMap.add_action("attack")
    if not InputMap.has_action("interact"):
        InputMap.add_action("interact")
    configured = true

func _physics_process(delta: float) -> void:
    if not configured or player == null:
        return

    attack_cooldown_left = maxf(0.0, attack_cooldown_left - delta)
    var distance := _horizontal_distance(player.global_position, salvage_position)

    if reward_available and not reward_collected and distance <= PICKUP_RADIUS_M:
        reward_collected = true
        reward_available = false
        reward_count += 1
        pickup_distance_m = distance

    if Input.is_action_just_pressed("attack"):
        attack_press_count += 1
        if salvage_health > 0 and attack_cooldown_left <= 0.0 and distance <= ATTACK_RANGE_M:
            salvage_health = maxi(0, salvage_health - ATTACK_DAMAGE)
            valid_attack_count += 1
            attack_distance_m = distance
            attack_cooldown_left = ATTACK_COOLDOWN_S
            if salvage_health == 0:
                reward_available = true

    if Input.is_action_just_pressed("interact"):
        interact_press_count += 1
        if reward_collected and not selected_upgrades.has(UPGRADE_ID):
            selected_upgrades.append(UPGRADE_ID)
            upgrade_selection_count += 1

func _horizontal_distance(a: Vector3, b: Vector3) -> float:
    return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))

func effective_attack_damage() -> float:
    if selected_upgrades.has(UPGRADE_ID):
        return float(ATTACK_DAMAGE) * DAMAGE_MULTIPLIER
    return float(ATTACK_DAMAGE)

func observe() -> Dictionary:
    var distance := -1.0
    if player != null:
        distance = _horizontal_distance(player.global_position, salvage_position)
    return {
        "salvage_position": [salvage_position.x, salvage_position.y, salvage_position.z],
        "distance_to_salvage_m": distance,
        "salvage_health": salvage_health,
        "reward_available": reward_available,
        "reward_collected": reward_collected,
        "reward_count": reward_count,
        "selected_upgrades": selected_upgrades.duplicate(),
        "effective_attack_damage": effective_attack_damage(),
        "attack_press_count": attack_press_count,
        "valid_attack_count": valid_attack_count,
        "interact_press_count": interact_press_count,
        "upgrade_selection_count": upgrade_selection_count,
        "attack_distance_m": attack_distance_m,
        "pickup_distance_m": pickup_distance_m,
        "direct_salvage_health_setter_exposed": false,
        "direct_reward_grant_exposed": false,
        "direct_upgrade_grant_exposed": false,
        "direct_position_setter_exposed": false,
        "test_only_gameplay_mutation_shortcut": false,
    }.duplicate(true)
