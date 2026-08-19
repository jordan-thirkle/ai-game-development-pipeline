extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)

func _run() -> void:
	var packed := load("res://main.tscn") as PackedScene
	_check(packed != null, "main.tscn must load")
	if packed == null:
		quit(1)
		return
	var scene := packed.instantiate()
	root.add_child(scene)
	await process_frame
	await physics_frame

	var initial: Dictionary = scene.observe()
	_check(bool(initial.get("runtime", {}).get("ready", false)), "runtime must report ready")
	_check(initial.get("physics", {}).get("controller", "") == "CharacterBody3D", "native CharacterBody3D controller must be active")
	var initial_pos: Array = initial.get("player", {}).get("position", [])
	_check(initial_pos.size() == 3, "player observation must expose a 3D position")

	Input.action_press("move_forward")
	for _frame in range(60):
		await physics_frame
	Input.action_release("move_forward")
	await physics_frame
	var moved: Dictionary = scene.observe()
	var moved_pos: Array = moved.get("player", {}).get("position", [])
	var forward_distance := float(initial_pos[2]) - float(moved_pos[2])
	_check(forward_distance > 2.5, "normal move_forward input must move the player materially")
	_check(forward_distance < 4.0, "one second walk must remain near the shared 3.5 m/s contract")

	moved_pos[0] = 999.0
	var isolated: Dictionary = scene.observe()
	_check(float(isolated.get("player", {}).get("position", [999.0])[0]) != 999.0, "observation mutations must not alter game state")

	var saw_collision := false
	Input.action_press("move_right")
	for _frame in range(300):
		await physics_frame
		if bool(scene.observe().get("player", {}).get("collided_last_frame", false)):
			saw_collision = true
	Input.action_release("move_right")
	await physics_frame
	var wall: Dictionary = scene.observe()
	var wall_x := float(wall.get("player", {}).get("position", [999.0])[0])
	_check(saw_collision, "native move_and_slide must report arena-wall collision")
	_check(wall_x < 11.6, "player must be stopped by the east arena wall, not pass through it")

	var result := {
		"result": "pass" if failures.is_empty() else "fail",
		"engine_version": wall.get("runtime", {}).get("engine_version", "unknown"),
		"controller": wall.get("physics", {}).get("controller", "unknown"),
		"forward_distance_m": snappedf(forward_distance, 0.001),
		"wall_stop_x_m": snappedf(wall_x, 0.001),
		"wall_collision_observed": saw_collision,
		"observation_mutation_isolated": float(isolated.get("player", {}).get("position", [999.0])[0]) != 999.0,
		"failures": failures
	}
	print("BYJTT_RESULT=" + JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
