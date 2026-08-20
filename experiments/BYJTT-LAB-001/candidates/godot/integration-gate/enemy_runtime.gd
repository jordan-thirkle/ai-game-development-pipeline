extends Node3D

const ENEMY_HEIGHT := 1.7
const ENEMY_RADIUS := 0.4

var contract: Dictionary = {}
var player: CharacterBody3D
var enemy: CharacterBody3D
var navigation_map: RID
var navigation_region: RID
var initial_map_iteration_id := 0
var initial_region_iteration_id := 0
var navigation_synchronized := false
var target_acquired := false
var target_retained := false
var path_queries := 0
var native_path_found := false
var final_path_point_count := 0
var chase_frames := 0
var enemy_attack_count := 0
var enemy_wall_collision_observed := false
var player_health := 0
var attack_cooldown_left := 0.0
var configured := false

func configure(shared_contract: Dictionary, player_body: CharacterBody3D) -> void:
    contract = shared_contract.duplicate(true)
    player = player_body
    var player_contract: Dictionary = contract.get("player", {})
    player_health = int(player_contract.get("max_health", 100))
    _build_enemy()
    _build_navigation()
    configured = true

func _build_enemy() -> void:
    var arena: Dictionary = contract.get("arena", {})
    var enemy_spawn_array: Array = arena.get("enemy_spawn", [0.0, 0.0, -6.0])
    enemy = CharacterBody3D.new()
    enemy.name = "IntegrationEnemy"
    enemy.collision_layer = 2
    enemy.collision_mask = 1
    enemy.position = Vector3(float(enemy_spawn_array[0]), ENEMY_HEIGHT * 0.5, float(enemy_spawn_array[2]))
    var collision := CollisionShape3D.new()
    var capsule := CapsuleShape3D.new()
    capsule.radius = ENEMY_RADIUS
    capsule.height = ENEMY_HEIGHT
    collision.shape = capsule
    enemy.add_child(collision)
    add_child(enemy)

func _build_navigation() -> void:
    var arena: Dictionary = contract.get("arena", {})
    var width := float(arena.get("width", 24.0))
    var depth := float(arena.get("depth", 32.0))
    var half_width := width * 0.5
    var half_depth := depth * 0.5

    var navigation_mesh := NavigationMesh.new()
    navigation_mesh.set_vertices(PackedVector3Array([
        Vector3(-half_width, 0.0, half_depth),
        Vector3(half_width, 0.0, half_depth),
        Vector3(half_width, 0.0, -half_depth),
        Vector3(-half_width, 0.0, -half_depth),
    ]))
    navigation_mesh.add_polygon(PackedInt32Array([0, 1, 2, 3]))

    navigation_map = NavigationServer3D.map_create()
    NavigationServer3D.map_set_up(navigation_map, Vector3.UP)
    NavigationServer3D.map_set_cell_size(navigation_map, navigation_mesh.cell_size)
    NavigationServer3D.map_set_cell_height(navigation_map, navigation_mesh.cell_height)
    NavigationServer3D.map_set_use_async_iterations(navigation_map, false)

    navigation_region = NavigationServer3D.region_create()
    NavigationServer3D.region_set_enabled(navigation_region, true)
    NavigationServer3D.region_set_navigation_layers(navigation_region, 1)
    NavigationServer3D.region_set_navigation_mesh(navigation_region, navigation_mesh)
    NavigationServer3D.region_set_map(navigation_region, navigation_map)
    NavigationServer3D.map_set_active(navigation_map, true)
    initial_map_iteration_id = NavigationServer3D.map_get_iteration_id(navigation_map)
    initial_region_iteration_id = NavigationServer3D.region_get_iteration_id(navigation_region)

func _physics_process(delta: float) -> void:
    if not configured or player == null or enemy == null:
        return

    if not navigation_synchronized:
        navigation_synchronized = (
            NavigationServer3D.map_get_iteration_id(navigation_map) > initial_map_iteration_id
            and NavigationServer3D.region_get_iteration_id(navigation_region) > initial_region_iteration_id
            and NavigationServer3D.map_get_regions(navigation_map).has(navigation_region)
            and NavigationServer3D.map_is_active(navigation_map)
        )
        if not navigation_synchronized:
            return

    var enemy_contract: Dictionary = contract.get("enemy", {})
    var acquire_range := float(enemy_contract.get("acquire_range", 12.0))
    var lose_target_range := float(enemy_contract.get("lose_target_range", 18.0))
    var move_speed := float(enemy_contract.get("move_speed", 2.7))
    var attack_range := float(enemy_contract.get("attack_range", 1.6))
    var attack_damage := int(enemy_contract.get("attack_damage", 20))
    var attack_cooldown := float(enemy_contract.get("attack_cooldown", 1.1))
    var distance_to_player := _horizontal_distance(enemy.global_position, player.global_position)

    if not target_acquired:
        if distance_to_player <= acquire_range:
            target_acquired = true
            target_retained = true
        else:
            return

    if distance_to_player > lose_target_range:
        target_retained = false
        enemy.velocity = Vector3.ZERO
        return

    target_retained = true
    attack_cooldown_left = maxf(0.0, attack_cooldown_left - delta)
    if distance_to_player <= attack_range:
        enemy.velocity = Vector3.ZERO
        if attack_cooldown_left <= 0.0:
            player_health -= attack_damage
            enemy_attack_count += 1
            attack_cooldown_left = attack_cooldown
        return

    var path: PackedVector3Array = NavigationServer3D.map_get_path(
        navigation_map,
        _ground(enemy.global_position),
        _ground(player.global_position),
        true,
        1
    )
    path_queries += 1
    final_path_point_count = path.size()
    if path.size() < 2:
        enemy.velocity = Vector3.ZERO
        return

    native_path_found = true
    chase_frames += 1
    var waypoint := path[1]
    var direction := _ground(waypoint) - _ground(enemy.global_position)
    if direction.length_squared() <= 0.000001:
        enemy.velocity = Vector3.ZERO
        return

    direction = direction.normalized()
    enemy.velocity = Vector3(direction.x * move_speed, 0.0, direction.z * move_speed)
    if enemy.move_and_slide():
        enemy_wall_collision_observed = true

func _horizontal_distance(a: Vector3, b: Vector3) -> float:
    return Vector2(a.x, a.z).distance_to(Vector2(b.x, b.z))

func _ground(point: Vector3) -> Vector3:
    return Vector3(point.x, 0.0, point.z)

func observe() -> Dictionary:
    var arena: Dictionary = contract.get("arena", {})
    var enemy_contract: Dictionary = contract.get("enemy", {})
    var player_contract: Dictionary = contract.get("player", {})
    var enemy_position := Vector3.ZERO if enemy == null else enemy.global_position
    var player_position := Vector3.ZERO if player == null else player.global_position
    var snapshot := {
        "configured": configured,
        "navigation_synchronized": navigation_synchronized,
        "target_acquired": target_acquired,
        "target_retained": target_retained,
        "distance_to_player": _horizontal_distance(enemy_position, player_position),
        "enemy_position": [enemy_position.x, enemy_position.y, enemy_position.z],
        "player_health": player_health,
        "player_max_health": int(player_contract.get("max_health", 100)),
        "path_queries": path_queries,
        "native_path_found": native_path_found,
        "final_path_point_count": final_path_point_count,
        "chase_frames": chase_frames,
        "enemy_attack_count": enemy_attack_count,
        "enemy_wall_collision_observed": enemy_wall_collision_observed,
        "arena_width_m": float(arena.get("width", 24.0)),
        "arena_depth_m": float(arena.get("depth", 32.0)),
        "acquire_range_m": float(enemy_contract.get("acquire_range", 12.0)),
        "lose_target_range_m": float(enemy_contract.get("lose_target_range", 18.0)),
        "enemy_move_speed_mps": float(enemy_contract.get("move_speed", 2.7)),
        "enemy_attack_range_m": float(enemy_contract.get("attack_range", 1.6)),
        "enemy_attack_damage": int(enemy_contract.get("attack_damage", 20)),
        "enemy_attack_cooldown_s": float(enemy_contract.get("attack_cooldown", 1.1)),
        "post_navigation_position_clamp": false,
        "post_physics_arena_clamp": false,
    }
    return snapshot.duplicate(true)

func _exit_tree() -> void:
    if navigation_region.is_valid():
        NavigationServer3D.free_rid(navigation_region)
    if navigation_map.is_valid():
        NavigationServer3D.free_rid(navigation_map)
