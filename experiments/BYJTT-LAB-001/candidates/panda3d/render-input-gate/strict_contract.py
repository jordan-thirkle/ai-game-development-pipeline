# pyright: strict
from __future__ import annotations

from typing import Final, TypedDict

ARENA_WIDTH: Final[float] = 24.0
ARENA_DEPTH: Final[float] = 32.0
WALK_SPEED: Final[float] = 3.5
PLAYER_RADIUS: Final[float] = 0.6
PLAYER_CYLINDER_HEIGHT: Final[float] = 0.8
SPAWN_CONTRACT: Final[tuple[float, float, float]] = (0.0, 0.0, 10.0)
FIXED_DT: Final[float] = 1.0 / 60.0
RELEASE_STABLE_STEPS: Final[int] = 60
TIMEOUT_STEPS: Final[int] = 900
WINDOW_TITLE: Final[str] = "BYJTT-LAB-001 Panda3D Bullet"


class Evidence(TypedDict):
    engine: str
    physics: str
    arena_width_m: float
    arena_depth_m: float
    spawn_contract_xyz: list[float]
    panda_spawn_xyz: list[float]
    walk_speed_mps: float
    rendered_window_executed: bool
    rendered_frames: int
    external_input_executed: bool
    input_press_callbacks: int
    input_release_callbacks: int
    final_panda_xyz: list[float]
    max_x_m: float
    east_wall_contact_observed: bool
    non_penetration_ceiling_x_m: float
    release_drift_m: float
    release_stable: bool
    post_physics_arena_clamp: bool
    observation_copy_isolated: bool
    timed_out: bool
    passed: bool
    errors: list[str]


def contract_to_panda(position: tuple[float, float, float]) -> tuple[float, float, float]:
    """Map shared X/Y-up/Z-forward coordinates to Panda3D X/Y-forward/Z-up."""
    return (position[0], position[2], position[1])


def non_penetration_ceiling_x() -> float:
    return ARENA_WIDTH / 2.0 - PLAYER_RADIUS


def evidence_passes(evidence: Evidence) -> bool:
    return all(
        (
            evidence["passed"],
            evidence["rendered_window_executed"],
            evidence["rendered_frames"] >= 1,
            evidence["external_input_executed"],
            evidence["input_press_callbacks"] >= 1,
            evidence["input_release_callbacks"] >= 1,
            evidence["east_wall_contact_observed"],
            evidence["release_stable"],
            evidence["observation_copy_isolated"],
            not evidence["post_physics_arena_clamp"],
            not evidence["timed_out"],
            not evidence["errors"],
        )
    )
