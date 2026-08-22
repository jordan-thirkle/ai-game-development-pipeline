extends Node3D

const PLAYER_HEIGHT := 1.7
const PLAYER_RADIUS := 0.4
const WALL_HEIGHT := 2.0

var contract: Dictionary
var player: CharacterBody3D
var ready_at_ms := 0
var collided_last_frame := false

func _ready() -> void:
	contract = _load_contract()
	_build_world()
	ready_at_ms = Time.get_ticks_msec()

func _load_contract() -> Dictionary:
	var project_root := ProjectSettings.globalize_path("res://")
	var contract_path := project_root.path_join("../../shared/contract.json").simplify_path()
	var file := FileAccess.open(contract_path, FileAccess.READ)
	if file == null:
		push_error("Unable to open shared contract: %s" % contract_path)
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Shared contract is not a dictionary")
		return {}
	return parsed

func _build_world() -> void:
	var arena: Dictionary = contract.get("arena", {})
	var player_spawn: Array = arena.get("player_spawn", [0.0, 0.0, 10.0])
	var width := float(arena.get("width", 24.0))
	var depth := float(arena.get("depth", 32.0))

	_add_static_box("Floor", Vector3(0.0, -0.25, 0.0), Vector3(width, 0.5, depth))
	_add_static_box("WallNorth", Vector3(0.0, WALL_HEIGHT * 0.5, -depth * 0.5), Vector3(width, WALL_HEIGHT, 0.5))
	_add_static_box("WallSouth", Vector3(0.0, WALL_HEIGHT * 0.5, depth * 0.5), Vector3(width, WALL_HEIGHT, 0.5))
	_add_static_box("WallWest", Vector3(-width * 0.5, WALL_HEIGHT * 0.5, 0.0), Vector3(0.5, WALL_HEIGHT, depth))
	_add_static_box("WallEast", Vector3(width * 0.5, WALL_HEIGHT * 0.5, 0.0), Vector3(0.5, WALL_HEIGHT, depth))

	player = CharacterBody3D.new()
	player.name = "Player"
	player.collision_layer = 2
	player.collision_mask = 1
	player.position = Vector3(float(player_spawn[0]), PLAYER_HEIGHT * 0.5, float(player_spawn[2]))
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = PLAYER_RADIUS
	capsule.height = PLAYER_HEIGHT
	collision.shape = capsule
	player.add_child(collision)
	add_child(player)

func _add_static_box(label: String, position_value: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = label
	body.collision_layer = 1
	body.collision_mask = 2
	body.position = position_value
	var collision := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	collision.shape = box
	body.add_child(collision)
	add_child(body)

func _physics_process(delta: float) -> void:
	if player == null or contract.is_empty():
		return
	var player_contract: Dictionary = contract.get("player", {})
	var target_speed := float(player_contract.get("walk_speed", 3.5))
	var acceleration := float(player_contract.get("acceleration", 18.0))
	var deceleration := float(player_contract.get("deceleration", 22.0))
	var axis := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var desired := Vector3(axis.x, 0.0, axis.y)
	if desired.length_squared() > 1.0:
		desired = desired.normalized()
	var target_velocity := desired * target_speed
	var rate := acceleration if desired.length_squared() > 0.0 else deceleration
	player.velocity.x = move_toward(player.velocity.x, target_velocity.x, rate * delta)
	player.velocity.z = move_toward(player.velocity.z, target_velocity.z, rate * delta)
	player.velocity.y = 0.0
	collided_last_frame = player.move_and_slide()

func observe() -> Dictionary:
	var position_value := Vector3.ZERO if player == null else player.global_position
	var snapshot := {
		"runtime": {
			"ready": player != null and not contract.is_empty(),
			"engine": "godot",
			"engine_version": Engine.get_version_info().get("string", "unknown"),
			"ready_at_ms": ready_at_ms
		},
		"player": {
			"position": [position_value.x, position_value.y, position_value.z],
			"collided_last_frame": collided_last_frame
		},
		"physics": {
			"controller": "CharacterBody3D",
			"native_move_and_slide": true
		}
	}
	return snapshot.duplicate(true)
