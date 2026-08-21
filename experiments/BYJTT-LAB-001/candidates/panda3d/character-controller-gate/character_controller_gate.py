from __future__ import annotations

import json
import sys
from pathlib import Path

from panda3d.bullet import (
    BulletBoxShape,
    BulletCapsuleShape,
    BulletCharacterControllerNode,
    BulletRigidBodyNode,
    BulletWorld,
    ZUp,
)
from panda3d.core import NodePath, Vec3

from strict_contract import (
    ARENA_DEPTH,
    ARENA_WIDTH,
    DRIVEN_STEPS,
    FIXED_DT,
    PLAYER_CYLINDER_HEIGHT,
    PLAYER_RADIUS,
    RELEASE_STEPS,
    SPAWN_CONTRACT,
    WALK_SPEED,
    Evidence,
    contract_to_panda,
    expected_east_wall_center_x,
)

WALL_HALF_THICKNESS = 0.1
WALL_HALF_HEIGHT = 2.0
PASS_TOLERANCE = 0.08
RELEASE_TOLERANCE = 0.01


def add_static_box(world: BulletWorld, name: str, half_extents: Vec3, position: Vec3) -> NodePath:
    body = BulletRigidBodyNode(name)
    body.setMass(0.0)
    body.setFriction(0.8)
    body.setRestitution(0.0)
    body.addShape(BulletBoxShape(half_extents))
    path = NodePath(body)
    path.setPos(position)
    world.attachRigidBody(body)
    return path


def run_gate(output_path: Path) -> Evidence:
    world = BulletWorld()
    world.setGravity(Vec3(0.0, 0.0, -9.81))

    # Static arena geometry. Inner wall faces remain exactly at +/-12 m and +/-16 m.
    keep_alive = [
        add_static_box(world, "floor", Vec3(ARENA_WIDTH / 2.0, ARENA_DEPTH / 2.0, 0.1), Vec3(0.0, 0.0, -0.1)),
        add_static_box(world, "east-wall", Vec3(WALL_HALF_THICKNESS, ARENA_DEPTH / 2.0, WALL_HALF_HEIGHT), Vec3(ARENA_WIDTH / 2.0 + WALL_HALF_THICKNESS, 0.0, WALL_HALF_HEIGHT)),
        add_static_box(world, "west-wall", Vec3(WALL_HALF_THICKNESS, ARENA_DEPTH / 2.0, WALL_HALF_HEIGHT), Vec3(-ARENA_WIDTH / 2.0 - WALL_HALF_THICKNESS, 0.0, WALL_HALF_HEIGHT)),
        add_static_box(world, "north-wall", Vec3(ARENA_WIDTH / 2.0, WALL_HALF_THICKNESS, WALL_HALF_HEIGHT), Vec3(0.0, ARENA_DEPTH / 2.0 + WALL_HALF_THICKNESS, WALL_HALF_HEIGHT)),
        add_static_box(world, "south-wall", Vec3(ARENA_WIDTH / 2.0, WALL_HALF_THICKNESS, WALL_HALF_HEIGHT), Vec3(0.0, -ARENA_DEPTH / 2.0 - WALL_HALF_THICKNESS, WALL_HALF_HEIGHT)),
    ]

    shape = BulletCapsuleShape(PLAYER_RADIUS, PLAYER_CYLINDER_HEIGHT, ZUp)
    controller = BulletCharacterControllerNode(shape, 0.4, "player")
    controller.setGravity(9.81)
    controller.setFallSpeed(55.0)
    controller.setUseGhostSweepTest(True)
    player = NodePath(controller)
    panda_spawn = contract_to_panda(SPAWN_CONTRACT)
    # Capsule origin is its centre; lift by half total height from logical ground-space spawn.
    player.setPos(panda_spawn[0], panda_spawn[1], PLAYER_CYLINDER_HEIGHT / 2.0 + PLAYER_RADIUS)
    world.attachCharacter(controller)

    errors: list[str] = []
    max_x = float(player.getX())
    movement = Vec3(WALK_SPEED, 0.0, 0.0)
    controller.setLinearMovement(movement, False)

    for _ in range(DRIVEN_STEPS):
        world.doPhysics(FIXED_DT, 1, FIXED_DT)
        max_x = max(max_x, float(player.getX()))

    release_x = float(player.getX())
    controller.setLinearMovement(Vec3(0.0, 0.0, 0.0), False)
    for _ in range(RELEASE_STEPS):
        world.doPhysics(FIXED_DT, 1, FIXED_DT)
        max_x = max(max_x, float(player.getX()))

    final_x = float(player.getX())
    release_drift = abs(final_x - release_x)
    expected = expected_east_wall_center_x()
    native_wall_stop = max_x <= expected + PASS_TOLERANCE and final_x >= expected - PASS_TOLERANCE
    release_stable = release_drift <= RELEASE_TOLERANCE

    authoritative = [float(player.getX()), float(player.getY()), float(player.getZ())]
    observation = {"position": list(authoritative)}
    observation["position"][0] = -9999.0
    after_mutation = [float(player.getX()), float(player.getY()), float(player.getZ())]
    isolated = authoritative == after_mutation

    if not native_wall_stop:
        errors.append(f"character did not stop at native east wall: expected~{expected:.6f}, max={max_x:.6f}, final={final_x:.6f}")
    if not release_stable:
        errors.append(f"character drifted after movement release: {release_drift:.9f} m")
    if not isolated:
        errors.append("mutating observation copy changed engine-owned character state")

    passed = not errors and native_wall_stop and release_stable and isolated
    evidence: Evidence = {
        "engine": "Panda3D 1.10.16",
        "controller": "BulletCharacterControllerNode",
        "arena_width_m": ARENA_WIDTH,
        "arena_depth_m": ARENA_DEPTH,
        "spawn_contract_xyz": list(SPAWN_CONTRACT),
        "panda_spawn_xyz": list(panda_spawn),
        "walk_speed_mps": WALK_SPEED,
        "driven_steps": DRIVEN_STEPS,
        "release_steps": RELEASE_STEPS,
        "expected_east_wall_center_x_m": expected,
        "max_x_m": max_x,
        "final_x_m": final_x,
        "release_drift_m": release_drift,
        "native_wall_stop_observed": native_wall_stop,
        "release_stable": release_stable,
        "observation_copy_isolated": isolated,
        "post_physics_arena_clamp": False,
        "external_input_executed": False,
        "passed": passed,
        "errors": errors,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence, sort_keys=True), flush=True)
    # Keep static NodePaths alive until after the final physics observation.
    assert len(keep_alive) == 5
    return evidence


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: character_controller_gate.py <result.json>")
    result = run_gate(Path(sys.argv[1]).resolve())
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
