extends Node

var contract: Dictionary = {}
var player: CharacterBody3D
var enemy: CharacterBody3D
var enemy_health := 0
var attack_cooldown_left := 0.0
var attack_count := 0
var attack_press_count := 0
var blocked_cooldown_press_count := 0
var out_of_range_press_count := 0
var last_attack_distance_m := -1.0
var configured := false

func configure(shared_contract: Dictionary, player_body: CharacterBody3D, enemy_body: CharacterBody3D) -> void:
    contract = shared_contract.duplicate(true)
    player = player_body
    enemy = enemy_body
    var enemy_contract: Dictionary = contract.get("enemy", {})
    enemy_health = int(enemy_contract.get("max_health", 100))
    if not InputMap.has_action("attack"):
        InputMap.add_action("attack")
    configured = true

func _physics_process(delta: float) -> void:
    if not configured or player == null or enemy == null:
        return

    attack_cooldown_left = maxf(0.0, attack_cooldown_left - delta)
    if not Input.is_action_just_pressed("attack"):
        return

    attack_press_count += 1
    var player_contract: Dictionary = contract.get("player", {})
    var attack_range := float(player_contract.get("attack_range", 1.8))
    var attack_damage := int(player_contract.get("attack_damage", 34))
    var attack_cooldown := float(player_contract.get("attack_cooldown", 0.55))
    var distance := _horizontal_distance(player.global_position, enemy.global_position)

    if attack_cooldown_left > 0.0:
        blocked_cooldown_press_count += 1
        return
    if distance > attack_range or enemy_health <= 0:
        out_of_range_press_count += 1
        return

    enemy_health = maxi(0, enemy_health - attack_damage)
    attack_count += 1
    last_attack_distance_m = distance
    attack_cooldown_left = attack_cooldown

func _horizontal_distance(a: Vector3, b: Vector3) -> float:
    return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))

func observe() -> Dictionary:
    var player_contract: Dictionary = contract.get("player", {})
    var enemy_contract: Dictionary = contract.get("enemy", {})
    var distance := -1.0
    if player != null and enemy != null:
        distance = _horizontal_distance(player.global_position, enemy.global_position)
    var snapshot := {
        "configured": configured,
        "enemy_health": enemy_health,
        "enemy_max_health": int(enemy_contract.get("max_health", 100)),
        "attack_count": attack_count,
        "attack_press_count": attack_press_count,
        "blocked_cooldown_press_count": blocked_cooldown_press_count,
        "out_of_range_press_count": out_of_range_press_count,
        "attack_cooldown_left_s": attack_cooldown_left,
        "last_attack_distance_m": last_attack_distance_m,
        "distance_to_enemy_m": distance,
        "player_attack_range_m": float(player_contract.get("attack_range", 1.8)),
        "player_attack_damage": int(player_contract.get("attack_damage", 34)),
        "player_attack_cooldown_s": float(player_contract.get("attack_cooldown", 0.55)),
        "direct_enemy_health_setter_exposed": false,
        "test_only_gameplay_mutation_shortcut": false,
    }
    return snapshot.duplicate(true)
