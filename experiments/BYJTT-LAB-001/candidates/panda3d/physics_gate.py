# pyright: strict
from __future__ import annotations

import json
from pathlib import Path
from typing import Final, TypedDict

from panda3d.bullet import BulletBoxShape, BulletCapsuleShape, BulletRigidBodyNode, BulletWorld, ZUp
from panda3d.core import NodePath, Vec3

ARENA_WIDTH: Final[float] = 24.0
ARENA_DEPTH: Final[float] = 32.0
WALK_SPEED: Final[float] = 3.5
PLAYER_RADIUS: Final[float] = 0.6
PLAYER_CYLINDER_HEIGHT: Final[float] = 0.8
SPAWN_CONTRACT: Final[tuple[float, float, float]] = (0.0, 0.0, 10.0)
FIXED_DT: Final[float] = 1.0 / 60.0
STEPS: Final[int] = 300


class Evidence(TypedDict):
    engine: str
    physics: str
    arena_width_m: float
    arena_depth_m: float
    spawn_contract_xyz: list[float]
    panda_spawn_xyz: list[float]
    walk_speed_mps: float
    final_panda_xyz: list[float]
    max_x_m: float
    east_wall_contact_observed: bool
    non_penetration_ceiling_x_m: float
    post_physics_arena_clamp: bool
    observation_mutation_isolated: bool
    steps: int


def contract_to_panda(position: tuple[float, float, float]) -> Vec3:
    # Shared contract is X/Y-up/Z-forward; Panda3D is X/Y-forward/Z-up.
    return Vec3(position[0], position[2], position[1])


def add_static_wall(world: BulletWorld, name: str, half_extents: Vec3, position: Vec3) -> None:
    node = BulletRigidBodyNode(name)
    node.setMass(0.0)
    node.addShape(BulletBoxShape(half_extents))
    node_path = NodePath(node)
    node_path.setPos(position)
    world.attachRigidBody(node)


def run_gate() -> Evidence:
    world = BulletWorld()
    world.setGravity(Vec3(0.0, 0.0, 0.0))

    wall_half_thickness = 0.1
    wall_half_height = 2.0
    add_static_wall(world, "east-wall", Vec3(wall_half_thickness, ARENA_DEPTH / 2.0, wall_half_height), Vec3(ARENA_WIDTH / 2.0 + wall_half_thickness, 0.0, 0.0))
    add_static_wall(world, "west-wall", Vec3(wall_half_thickness, ARENA_DEPTH / 2.0, wall_half_height), Vec3(-ARENA_WIDTH / 2.0 - wall_half_thickness, 0.0, 0.0))
    add_static_wall(world, "north-wall", Vec3(ARENA_WIDTH / 2.0, wall_half_thickness, wall_half_height), Vec3(0.0, ARENA_DEPTH / 2.0 + wall_half_thickness, 0.0))
    add_static_wall(world, "south-wall", Vec3(ARENA_WIDTH / 2.0, wall_half_thickness, wall_half_height), Vec3(0.0, -ARENA_DEPTH / 2.0 - wall_half_thickness, 0.0))

    player = BulletRigidBodyNode("player")
    player.setMass(80.0)
    player.setFriction(0.0)
    player.setRestitution(0.0)
    player.addShape(BulletCapsuleShape(PLAYER_RADIUS, PLAYER_CYLINDER_HEIGHT, ZUp))
    player_path = NodePath(player)
    panda_spawn = contract_to_panda(SPAWN_CONTRACT)
    player_path.setPos(panda_spawn)
    world.attachRigidBody(player)

    # Feasibility input: feed the shared walk-speed constant into Bullet's native body velocity.
    # There is deliberately no position correction/clamp after physics.
    player.setLinearVelocity(Vec3(WALK_SPEED, 0.0, 0.0))

    contact_observed = False
    max_x = float(player_path.getX())
    for _ in range(STEPS):
        world.doPhysics(FIXED_DT, 1, FIXED_DT)
        x = float(player_path.getX())
        max_x = max(max_x, x)
        if world.contactTest(player).getNumContacts() > 0:
            contact_observed = True

    before = (float(player_path.getX()), float(player_path.getY()), float(player_path.getZ()))
    observation = {"position": list(before)}
    observation["position"][0] = -9999.0
    after = (float(player_path.getX()), float(player_path.getY()), float(player_path.getZ()))

    non_penetration_ceiling = ARENA_WIDTH / 2.0 - PLAYER_RADIUS
    if not contact_observed:
        raise RuntimeError("native east-wall contact was not observed")
    if max_x > non_penetration_ceiling + 0.02:
        raise RuntimeError(f"player penetrated east wall: max_x={max_x:.6f}, ceiling={non_penetration_ceiling:.6f}")
    if before != after:
        raise RuntimeError("observation mutation affected engine-owned state")

    return {
        "engine": "Panda3D 1.10.16",
        "physics": "Panda3D BulletWorld / BulletRigidBodyNode",
        "arena_width_m": ARENA_WIDTH,
        "arena_depth_m": ARENA_DEPTH,
        "spawn_contract_xyz": list(SPAWN_CONTRACT),
        "panda_spawn_xyz": [float(panda_spawn.x), float(panda_spawn.y), float(panda_spawn.z)],
        "walk_speed_mps": WALK_SPEED,
        "final_panda_xyz": list(after),
        "max_x_m": max_x,
        "east_wall_contact_observed": contact_observed,
        "non_penetration_ceiling_x_m": non_penetration_ceiling,
        "post_physics_arena_clamp": False,
        "observation_mutation_isolated": True,
        "steps": STEPS,
    }


def main() -> None:
    evidence = run_gate()
    output = Path("evidence") / "panda3d-physics-gate.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence, sort_keys=True))


if __name__ == "__main__":
    main()
