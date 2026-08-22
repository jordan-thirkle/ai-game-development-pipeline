#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CANDIDATE = Path(__file__).resolve().parent
manifest = json.loads((CANDIDATE / "runtime-manifest.json").read_text())
shared = json.loads((ROOT / manifest["shared_contract_path"]).read_text())
expected = manifest["expected_shared_constants"]

assert manifest["experiment_id"] == "BYJTT-LAB-001"
assert manifest["candidate"] == "flax"
assert manifest["flax_version"] == "1.12.6912"
assert shared["units"]["world_up"] == expected["world_up"]
assert [shared["viewport"]["reference_width"], shared["viewport"]["reference_height"]] == expected["viewport"]
assert shared["viewport"]["target_fps"] == expected["target_fps"]
assert [shared["arena"]["width"], shared["arena"]["depth"]] == expected["arena"]
assert shared["arena"]["player_spawn"] == expected["player_spawn"]
assert shared["player"]["walk_speed"] == expected["walk_speed"]

boundary = manifest["evidence_boundary"]
for key in (
    "official_binary_verified",
    "headless_engine_executed",
    "project_generated",
    "character_controller_executed",
    "external_input_executed",
    "phase_a_executed",
):
    assert boundary[key] is False, f"source manifest must not predeclare runtime evidence: {key}"

print("Flax candidate contract: PASS")
