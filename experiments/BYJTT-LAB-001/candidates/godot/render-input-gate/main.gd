extends Node3D

const ARENA_WIDTH: float = 24.0
const ARENA_DEPTH: float = 32.0
const WALK_SPEED: float = 3.5
const PLAYER_RADIUS: float = 0.4
const PLAYER_HEIGHT: float = 1.8
const LOGICAL_SPAWN: Vector3 = Vector3(0.0, 0.0, 10.0)
const PLAYER_CENTER_Y: float = PLAYER_HEIGHT * 0.5
const EAST_WALL_INNER_X: float = ARENA_WIDTH * 0.5
const EXPECTED_EAST_STOP_X: float = EAST_WALL_INNER_X - PLAYER_RADIUS
const WALL_THICKNESS: float = 0.4
const RELEASE_STABILITY_FRAMES: int = 180
const MAX_RUNTIME_SECONDS: float = 14.0

var player: CharacterBody3D
var press_callbacks: int = 0
var release_callbacks: int = 0
var physics_frames: int = 0
var rendered_frames: int = 0
var release_frames: int = 0
var wall_collision_observed: bool = false
var released: bool = false
var finished: bool = false
var max_x: float = LOGICAL_SPAWN.x
var x_at_release: float = LOGICAL_SPAWN.x
var runtime_seconds: float = 0.0

func _ready() -> void:
	_setup_environment()
	_setup_arena()
	_setup_player()
	_setup_camera()
	print("BYJTT_READY=1")

func _input(event: InputEvent) -> void:
	if event is InputEventKey:
		var key_event := event as InputEventKey
		if key_event.keycode == KEY_D and not key_event.echo:
			if key_event.pressed:
				press_callbacks += 1
			else:
				release_callbacks += 1
				released = true
				x_at_release = player.global_position.x

func _process(delta: float) -> void:
	rendered_frames += 1
	runtime_seconds += delta
	if runtime_seconds >= MAX_RUNTIME_SECONDS and not finished:
		_finish(false, "runtime-timeout")

func _physics_process(_delta: float) -> void:
	if finished:
		return
	physics_frames += 1
	var moving_right: bool = Input.is_key_pressed(KEY_D)
	player.velocity.x = WALK_SPEED if moving_right else 0.0
	player.velocity.y = 0.0
	player.velocity.z = 0.0
	player.move_and_slide()
	max_x = maxf(max_x, player.global_position.x)
	if player.get_slide_collision_count() > 0:
		for index in range(player.get_slide_collision_count()):
			var collision := player.get_slide_collision(index)
			if collision != null and collision.get_normal().x < -0.5:
				wall_collision_observed = true
	if released:
		release_frames += 1
		if release_frames >= RELEASE_STABILITY_FRAMES:
			_finish(true, "completed")

func _setup_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.035, 0.045, 0.065, 1.0)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.72, 0.78, 0.9, 1.0)
	environment.ambient_light_energy = 1.25
	world_environment.environment = environment
	add_child(world_environment)

	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-55.0, -35.0, 0.0)
	light.light_energy = 1.4
	add_child(light)

func _setup_arena() -> void:
	_add_static_box("Floor", Vector3(ARENA_WIDTH, 0.2, ARENA_DEPTH), Vector3(0.0, -0.1, 0.0), Color(0.16, 0.19, 0.24, 1.0))
	_add_static_box("EastWall", Vector3(WALL_THICKNESS, 2.6, ARENA_DEPTH), Vector3(EAST_WALL_INNER_X + WALL_THICKNESS * 0.5, 1.3, 0.0), Color(0.26, 0.34, 0.5, 1.0))
	_add_static_box("WestWall", Vector3(WALL_THICKNESS, 2.6, ARENA_DEPTH), Vector3(-EAST_WALL_INNER_X - WALL_THICKNESS * 0.5, 1.3, 0.0), Color(0.26, 0.34, 0.5, 1.0))
	_add_static_box("NorthWall", Vector3(ARENA_WIDTH, 2.6, WALL_THICKNESS), Vector3(0.0, 1.3, ARENA_DEPTH * 0.5 + WALL_THICKNESS * 0.5), Color(0.26, 0.34, 0.5, 1.0))
	_add_static_box("SouthWall", Vector3(ARENA_WIDTH, 2.6, WALL_THICKNESS), Vector3(0.0, 1.3, -ARENA_DEPTH * 0.5 - WALL_THICKNESS * 0.5), Color(0.26, 0.34, 0.5, 1.0))

func _setup_player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	player.position = Vector3(LOGICAL_SPAWN.x, PLAYER_CENTER_Y, LOGICAL_SPAWN.z)
	player.floor_stop_on_slope = true
	player.safe_margin = 0.001

	var collision_shape := CollisionShape3D.new()
	var capsule_shape := CapsuleShape3D.new()
	capsule_shape.radius = PLAYER_RADIUS
	capsule_shape.height = PLAYER_HEIGHT
	collision_shape.shape = capsule_shape
	player.add_child(collision_shape)

	var mesh_instance := MeshInstance3D.new()
	var capsule_mesh := CapsuleMesh.new()
	capsule_mesh.radius = PLAYER_RADIUS
	capsule_mesh.height = PLAYER_HEIGHT
	mesh_instance.mesh = capsule_mesh
	mesh_instance.material_override = _material(Color(0.95, 0.58, 0.18, 1.0))
	player.add_child(mesh_instance)
	add_child(player)

func _setup_camera() -> void:
	var camera := Camera3D.new()
	camera.position = Vector3(0.0, 15.0, 27.0)
	camera.fov = 68.0
	add_child(camera)
	camera.look_at_from_position(camera.position, Vector3(3.0, 0.6, 10.0), Vector3.UP)

func _add_static_box(node_name: String, size: Vector3, position_value: Vector3, color: Color) -> void:
	var body := StaticBody3D.new()
	body.name = node_name
	body.position = position_value

	var collision_shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = size
	collision_shape.shape = box_shape
	body.add_child(collision_shape)

	var mesh_instance := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	mesh_instance.mesh = box_mesh
	mesh_instance.material_override = _material(color)
	body.add_child(mesh_instance)
	add_child(body)

func _material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	return material

func _observation() -> Dictionary:
	return {
		"x": player.global_position.x,
		"y": player.global_position.y - PLAYER_CENTER_Y,
		"z": player.global_position.z,
		"velocity_x": player.velocity.x,
		"wall_collision_observed": wall_collision_observed
	}.duplicate(true)

func _finish(completed_release_window: bool, reason: String) -> void:
	if finished:
		return
	finished = true
	var first_observation := _observation()
	first_observation["x"] = -999.0
	var second_observation := _observation()
	var observation_isolated: bool = absf(float(second_observation["x"]) - player.global_position.x) < 0.000001
	var final_x: float = player.global_position.x
	var release_drift: float = absf(final_x - x_at_release) if released else 999.0
	var collision_stop_pass: bool = absf(final_x - EXPECTED_EAST_STOP_X) <= 0.08 and max_x <= EXPECTED_EAST_STOP_X + 0.08
	var passed: bool = (
		completed_release_window
		and press_callbacks >= 1
		and release_callbacks >= 1
		and wall_collision_observed
		and collision_stop_pass
		and release_drift <= 0.02
		and observation_isolated
		and rendered_frames > 0
	)
	var result := {
		"result": "pass" if passed else "fail",
		"reason": reason,
		"engine_system": "CharacterBody3D.move_and_slide",
		"arena_width": ARENA_WIDTH,
		"arena_depth": ARENA_DEPTH,
		"logical_spawn": [LOGICAL_SPAWN.x, LOGICAL_SPAWN.y, LOGICAL_SPAWN.z],
		"walk_speed": WALK_SPEED,
		"physics_hz": 60,
		"expected_east_stop_x": EXPECTED_EAST_STOP_X,
		"final_x": final_x,
		"max_x": max_x,
		"release_drift": release_drift,
		"press_callbacks": press_callbacks,
		"release_callbacks": release_callbacks,
		"physics_frames": physics_frames,
		"rendered_frames": rendered_frames,
		"native_wall_collision_observed": wall_collision_observed,
		"observation_mutation_isolated": observation_isolated,
		"post_physics_arena_clamp": false,
		"external_input_executed": press_callbacks >= 1 and release_callbacks >= 1,
		"passed": passed
	}
	print("BYJTT_RESULT=" + JSON.stringify(result))
	get_tree().quit(0 if passed else 1)
