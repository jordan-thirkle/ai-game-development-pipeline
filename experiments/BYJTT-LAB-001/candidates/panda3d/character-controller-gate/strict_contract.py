# pyright: strict
from __future__ import annotations

from typing import Final, TypedDict

ARENA_WIDTH: Final[float] = 24.0
ARENA_DEPTH: Final[float] = 32.0
WALK_SPEED: Final[float] = 3.5
PLAYER_RADIUS: Final[float] = 0.4
PLAYER_TOTAL_HEIGHT: Final[float] = 1.8
PLAYER_CYLINDER_HEIGHT: Final[float] = PLAYER_TOTAL_HEIGHT - 2.0 * PLAYER_RADIUS
SPAWN_CONTRACT: Final[tuple[float, float, float]] = (0.0, 0.0, 10.0)
FIXED_DT: Final[float] = 1.0 / 60.0
DRIVEN_STEPS: Final[int] = 300
RELEASE_STEPS: Final[int] = 60


class Evidence(TypedDict):
    engine: str
    controller: str
    arena_width_m: float
    arena_depth_m: float
    spawn_contract_xyz: list[float]
    panda_spawn_xyz: list[float]
    walk_speed_mps: float
    driven_steps: int
    release_steps: int
    expected_east_wall_center_x_m: float
    max_x_m: float
    final_x_m: float
    release_drift_m: float
    native_wall_stop_observed: bool
    release_stable: bool
    observation_copy_isolated: bool
    post_physics_arena_clamp: bool
    external_input_executed: bool
    passed: bool
    errors: list[str]


def contract_to_panda(position: tuple[float, float, float]) -> tuple[float, float, float]:
    """Map shared X/Y-up/Z-forward coordinates to Panda3D X/Y-forward/Z-up."""
    return (position[0], position[2], position[1])


def expected_east_wall_center_x() -> float:
    return ARENA_WIDTH / 2.0 - PLAYER_RADIUS


def evidence_passes(evidence: Evidence) -> bool:
    return all(
        (
            evidence["passed"],
            evidence["controller"] == "BulletCharacterControllerNode",
            evidence["native_wall_stop_observed"],
            evidence["release_stable"],
            evidence["observation_copy_isolated"],
            not evidence["post_physics_arena_clamp"],
            not evidence["external_input_executed"],
            not evidence["errors"],
        )
    )
