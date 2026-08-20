from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from direct.showbase.ShowBase import ShowBase
from direct.task import Task
from panda3d.bullet import BulletBoxShape, BulletCapsuleShape, BulletDebugNode, BulletRigidBodyNode, BulletWorld, ZUp
from panda3d.core import Vec3, loadPrcFileData

from strict_contract import (
    ARENA_DEPTH,
    ARENA_WIDTH,
    FIXED_DT,
    PLAYER_CYLINDER_HEIGHT,
    PLAYER_RADIUS,
    RELEASE_STABLE_STEPS,
    SPAWN_CONTRACT,
    WALK_SPEED,
    WALL_CLOCK_TIMEOUT_SECONDS,
    WINDOW_TITLE,
    Evidence,
    contract_to_panda,
    non_penetration_ceiling_x,
)

loadPrcFileData("", f"window-title {WINDOW_TITLE}")
loadPrcFileData("", "win-size 960 540")
loadPrcFileData("", "sync-video false")
loadPrcFileData("", "show-frame-rate-meter false")
loadPrcFileData("", "audio-library-name null")


class RenderInputGate(ShowBase):
    def __init__(self, output_path: Path) -> None:
        super().__init__()
        self.disableMouse()
        self.setBackgroundColor(0.035, 0.045, 0.06, 1.0)
        self.output_path = output_path
        self.world = BulletWorld()
        self.world.setGravity(Vec3(0.0, 0.0, 0.0))
        self.player = BulletRigidBodyNode("player")
        self.held_d = False
        self.press_callbacks = 0
        self.release_callbacks = 0
        self.rendered_frames = 0
        self.contact_observed = False
        self.max_x = 0.0
        self.release_x: float | None = None
        self.release_steps = 0
        self.errors: list[str] = []
        self._finished = False
        self.started_at = time.monotonic()

        self._build_world()
        self.accept("d", self._on_d_down)
        self.accept("d-up", self._on_d_up)
        self.taskMgr.add(self._step, "byjtt-render-input-gate")

    def _add_static_box(self, name: str, half_extents: Vec3, position: Vec3) -> None:
        node = BulletRigidBodyNode(name)
        node.setMass(0.0)
        node.setFriction(0.8)
        node.setRestitution(0.0)
        node.addShape(BulletBoxShape(half_extents))
        path = self.render.attachNewNode(node)
        path.setPos(position)
        self.world.attachRigidBody(node)

    def _build_world(self) -> None:
        wall_half_thickness = 0.1
        wall_half_height = 2.0
        self._add_static_box("east-wall", Vec3(wall_half_thickness, ARENA_DEPTH / 2.0, wall_half_height), Vec3(ARENA_WIDTH / 2.0 + wall_half_thickness, 0.0, 0.0))
        self._add_static_box("west-wall", Vec3(wall_half_thickness, ARENA_DEPTH / 2.0, wall_half_height), Vec3(-ARENA_WIDTH / 2.0 - wall_half_thickness, 0.0, 0.0))
        self._add_static_box("north-wall", Vec3(ARENA_WIDTH / 2.0, wall_half_thickness, wall_half_height), Vec3(0.0, ARENA_DEPTH / 2.0 + wall_half_thickness, 0.0))
        self._add_static_box("south-wall", Vec3(ARENA_WIDTH / 2.0, wall_half_thickness, wall_half_height), Vec3(0.0, -ARENA_DEPTH / 2.0 - wall_half_thickness, 0.0))

        self.player.setMass(80.0)
        self.player.setFriction(0.0)
        self.player.setRestitution(0.0)
        self.player.addShape(BulletCapsuleShape(PLAYER_RADIUS, PLAYER_CYLINDER_HEIGHT, ZUp))
        self.player_path = self.render.attachNewNode(self.player)
        panda_spawn = contract_to_panda(SPAWN_CONTRACT)
        self.player_path.setPos(Vec3(*panda_spawn))
        self.world.attachRigidBody(self.player)
        self.max_x = float(self.player_path.getX())

        debug = BulletDebugNode("bullet-debug")
        debug.showWireframe(True)
        debug.showConstraints(True)
        debug.showBoundingBoxes(False)
        self.render.attachNewNode(debug)
        self.world.setDebugNode(debug)

        self.camera.setPos(19.0, -25.0, 18.0)
        self.camera.lookAt(0.0, 2.0, 0.0)

    def _on_d_down(self) -> None:
        if self.held_d:
            return
        self.held_d = True
        self.press_callbacks += 1
        self.player.setActive(True)

    def _on_d_up(self) -> None:
        if not self.held_d:
            return
        self.held_d = False
        self.release_callbacks += 1
        current = self.player.getLinearVelocity()
        self.player.setLinearVelocity(Vec3(0.0, current.y, current.z))
        self.player.setActive(True)
        self.release_x = float(self.player_path.getX())
        self.release_steps = 0

    def _step(self, task: Task.Task) -> int:
        if self._finished:
            return Task.done
        self.rendered_frames += 1
        if self.held_d:
            current = self.player.getLinearVelocity()
            self.player.setLinearVelocity(Vec3(WALK_SPEED, current.y, current.z))
            self.player.setActive(True)
        self.world.doPhysics(FIXED_DT, 1, FIXED_DT)
        x = float(self.player_path.getX())
        self.max_x = max(self.max_x, x)
        if self.world.contactTest(self.player).getNumContacts() > 0 and x > 10.0:
            self.contact_observed = True

        if self.release_x is not None and not self.held_d:
            self.release_steps += 1
            if self.release_steps >= RELEASE_STABLE_STEPS:
                self._finish(False)
                return Task.done

        if time.monotonic() - self.started_at >= WALL_CLOCK_TIMEOUT_SECONDS:
            self.errors.append("render/input proof exceeded wall-clock timeout before stable release")
            self._finish(True)
            return Task.done
        return Task.cont

    def _finish(self, timed_out: bool) -> None:
        if self._finished:
            return
        self._finished = True
        final = (float(self.player_path.getX()), float(self.player_path.getY()), float(self.player_path.getZ()))
        observation = {"position": list(final)}
        observation["position"][0] = -9999.0
        engine_after = (float(self.player_path.getX()), float(self.player_path.getY()), float(self.player_path.getZ()))
        isolated = final == engine_after
        ceiling = non_penetration_ceiling_x()
        release_origin = self.release_x if self.release_x is not None else final[0]
        release_drift = abs(final[0] - release_origin)
        external_input = self.press_callbacks >= 1 and self.release_callbacks >= 1
        window_executed = self.win is not None and self.rendered_frames > 0
        wall_stop = self.contact_observed and self.max_x <= ceiling + 0.02 and final[0] >= ceiling - 0.08
        release_stable = self.release_x is not None and release_drift <= 0.01
        passed = not timed_out and window_executed and external_input and wall_stop and release_stable and isolated and not self.errors
        evidence: Evidence = {
            "engine": "Panda3D 1.10.16",
            "physics": "Panda3D BulletWorld / BulletRigidBodyNode",
            "arena_width_m": ARENA_WIDTH,
            "arena_depth_m": ARENA_DEPTH,
            "spawn_contract_xyz": list(SPAWN_CONTRACT),
            "panda_spawn_xyz": list(contract_to_panda(SPAWN_CONTRACT)),
            "walk_speed_mps": WALK_SPEED,
            "rendered_window_executed": window_executed,
            "rendered_frames": self.rendered_frames,
            "external_input_executed": external_input,
            "input_press_callbacks": self.press_callbacks,
            "input_release_callbacks": self.release_callbacks,
            "final_panda_xyz": list(final),
            "max_x_m": self.max_x,
            "east_wall_contact_observed": self.contact_observed,
            "non_penetration_ceiling_x_m": ceiling,
            "release_drift_m": release_drift,
            "release_stable": release_stable,
            "post_physics_arena_clamp": False,
            "observation_copy_isolated": isolated,
            "timed_out": timed_out,
            "passed": passed,
            "errors": list(self.errors),
        }
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(evidence, sort_keys=True), flush=True)
        self.userExit()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: render_input_gate.py <result.json>")
    app = RenderInputGate(Path(sys.argv[1]).resolve())
    app.run()


if __name__ == "__main__":
    main()
