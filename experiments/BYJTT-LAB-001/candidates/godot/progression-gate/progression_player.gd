extends CharacterBody3D

var walk_speed := 3.5

func configure(speed_mps: float) -> void:
    walk_speed = speed_mps

func _physics_process(_delta: float) -> void:
    var input_vector := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var direction := Vector3(input_vector.x, 0.0, input_vector.y)
    velocity = direction * walk_speed
    move_and_slide()

func observe() -> Dictionary:
    return {
        "position": [global_position.x, global_position.y, global_position.z],
        "velocity": [velocity.x, velocity.y, velocity.z],
        "walk_speed_mps": walk_speed,
    }.duplicate(true)
