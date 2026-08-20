# Unity 6.3 Phase A proof handoff

Status: **implementation prepared; Unity Editor/runtime execution remains BLOCKED / UNKNOWN on this head until a licensed Unity environment runs the proof suite.**

Parent: `BYJTT-LAB-001` / issue #39. This is intentionally a bounded player movement + native collision tracer, not a full Phase A candidate claim.

## Pinned runtime

- Unity Editor: `6000.3.13f1` (verified Unity 6.3 LTS patch; not claimed to be the latest 6.3 patch)
- Input System: `com.unity.inputsystem` `1.17.0`
- Player collision/movement: built-in GameObject `CharacterController`

Primary documentation checked 2026-08-20:

- https://unity.com/releases/editor/whats-new/6000.3.13f1
- https://docs.unity3d.com/current/ScriptReference/CharacterController.Move.html
- https://docs.unity3d.com/current/Manual/com.unity.inputsystem.html
- https://game.ci/docs/github/test-runner/

## Shared contract preserved

The implementation consumes the shared contract read-only. It preserves:

- arena: `24m × 32m`
- player spawn: `(0, 0, 10)`
- walk/run: `3.5 / 5.5 m/s`
- acceleration/deceleration: `18 / 22 m/s²`
- turn-response constant retained: `0.12s`
- reference viewport: `390 × 844`, target `60fps`

The CharacterController capsule uses its **local center** at `y=1` while the GameObject transform remains at the shared spawn `y=0`; this does not rewrite the shared world-space spawn.

## Proof design

`MovementProofTests` is a Unity PlayMode suite. It does not call player setters, teleport, write health, grant rewards, or mutate save state.

It creates a Unity Input System `Keyboard`, queues W/D key state through the input subsystem, and lets production `PlayerMotor.Update()` read `Keyboard.current`. Assertions then use a fresh `BenchmarkObservation` value returned by `CaptureObservation()`.

Prepared proofs:

1. W held for one second moves the player >1m and keeps it inside arena bounds.
2. D held long enough reaches the east wall and `CharacterController.Move` reports `CollisionFlags.Sides`; the controller remains within the 24m arena.
3. Mutating a detached `Vector3` copied from an observation does not change engine-owned player state.

These tests are **not evidence until a real Unity Editor executes them on the exact head**.

## Reproduce in a licensed environment

The repository workflow `.github/workflows/benchmark-001-unity.yml` is `workflow_dispatch` only and fails closed when Unity activation credentials are absent. It runs the PlayMode suite against this project through GameCI's Unity Test Runner.

Required repository secrets for the documented Personal-license route:

- `UNITY_LICENSE`
- `UNITY_EMAIL`
- `UNITY_PASSWORD`

A successful future run must record:

- exact candidate head SHA;
- exact Editor version from the run;
- PlayMode XML/results and logs;
- failed/recovered attempts, if any;
- artifact ID/digest;
- no upgrade from `UNKNOWN` to pass until those artifacts are tied to the exact head.

## Explicitly deferred

Enemy acquisition/navigation/combat, salvage/reward/upgrade, persistence/restart, production shared assets, animation, profiler evidence, mobile packaging/device evidence and full 13-step Phase A conformance remain **unknown**.
