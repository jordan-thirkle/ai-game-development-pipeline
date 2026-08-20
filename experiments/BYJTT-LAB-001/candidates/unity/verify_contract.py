#!/usr/bin/env python3
"""Static contract guard for the Unity BYJTT-LAB-001 handoff.

This deliberately proves only source/contract integrity. It does not claim Unity
compilation, physics, input, rendering, or gameplay execution.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SHARED = ROOT / "experiments" / "BYJTT-LAB-001" / "shared"
CANDIDATE = ROOT / "experiments" / "BYJTT-LAB-001" / "candidates" / "unity"

contract = json.loads((SHARED / "contract.json").read_text())
playtest = json.loads((SHARED / "playtest-contract.json").read_text())
constants = (CANDIDATE / "Assets" / "Benchmark" / "BenchmarkConstants.cs").read_text()
motor = (CANDIDATE / "Assets" / "Benchmark" / "PlayerMotor.cs").read_text()
tests = (CANDIDATE / "Assets" / "Tests" / "PlayMode" / "MovementProofTests.cs").read_text()


def require(pattern: str, text: str, label: str) -> None:
    if re.search(pattern, text, re.MULTILINE) is None:
        raise SystemExit(f"contract guard failed: {label}")


def f(value: float | int) -> str:
    return re.escape(f"{float(value):g}") + r"f"


require(rf"ArenaWidth\s*=\s*{f(contract['arena']['width'])}\s*;", constants, "arena width drift")
require(rf"ArenaDepth\s*=\s*{f(contract['arena']['depth'])}\s*;", constants, "arena depth drift")
require(rf"WalkSpeed\s*=\s*{f(contract['player']['walk_speed'])}\s*;", constants, "walk speed drift")
require(rf"RunSpeed\s*=\s*{f(contract['player']['run_speed'])}\s*;", constants, "run speed drift")
require(rf"Acceleration\s*=\s*{f(contract['player']['acceleration'])}\s*;", constants, "acceleration drift")
require(rf"Deceleration\s*=\s*{f(contract['player']['deceleration'])}\s*;", constants, "deceleration drift")
require(rf"TurnResponseSeconds\s*=\s*{f(contract['player']['turn_response_seconds'])}\s*;", constants, "turn response drift")

spawn = contract["arena"]["player_spawn"]
require(
    rf"PlayerSpawn\s*=\s*new\({f(spawn[0])},\s*{f(spawn[1])},\s*{f(spawn[2])}\)\s*;",
    constants,
    "player spawn drift",
)

require(r"CharacterController", motor, "native CharacterController is not used")
require(r"\.Move\(motion\)", motor, "native CharacterController.Move path missing")
require(r"Keyboard\.current", motor, "production keyboard input path missing")
require(r"InputSystem\.QueueStateEvent", tests, "normal Input System test event path missing")

# The benchmark's forbidden operations are semantic names. Reject obvious C#
# equivalents in executable test code rather than relying only on documentation.
for forbidden in playtest["driver_contract"]["forbidden_test_shortcuts"]:
    camel = "".join(part.capitalize() if i else part for i, part in enumerate(forbidden.split("-")))
    compact = forbidden.replace("-", "")
    if re.search(rf"\b({re.escape(camel)}|{re.escape(compact)})\b", tests, re.IGNORECASE):
        raise SystemExit(f"contract guard failed: forbidden test shortcut appears in tests: {forbidden}")

print("BYJTT-LAB-001 Unity static contract guard: PASS")
print("evidence_class=source_contract_only")
print("runtime_pass=false")
