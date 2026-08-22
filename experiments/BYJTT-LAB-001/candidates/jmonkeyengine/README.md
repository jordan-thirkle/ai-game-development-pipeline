# jMonkeyEngine physics feasibility gate

Issue: #140. Parent benchmark: #2.

## Scope

This is a bounded additive BYJTT-LAB-001 feasibility lane. It owns only this candidate subtree plus `.github/workflows/benchmark-001-jmonkeyengine.yml`. Shared contracts and every other candidate subtree are read-only.

The gate preserves the shared 24×32 metre arena, player spawn `(0,0,10)`, +Y world-up convention, 3.5 m/s walk speed, and 60 Hz target step. It deliberately proves only engine/toolchain physics feasibility.

## Solved-system decision

Current primary-source review on 2026-08-20 found jMonkeyEngine `v3.9.0-stable` is the current stable engine release. jME's 3.9 physics documentation exposes Bullet through `com.jme3.bullet`, uses metres as physics units, and documents 60 Hz stepping. The engine publishes `jme3-jbullet:3.9.0-stable` to Maven Central.

This first gate uses the shipped pure-Java jBullet integration because it can execute headlessly in normal Java CI without a renderer/editor binary. That is a feasibility choice, not a production endorsement. A current upstream RFC proposes deprecating `jme3-jbullet`; a retained jME candidate must therefore compare the modern Minie/Libbulletjme path before any production promotion.

## What execution must prove

`PhysicsGate` constructs a real `PhysicsSpace`, four static Bullet arena walls, and a dynamic capsule. The capsule begins at the contract spawn and is driven toward +X at the unchanged walk speed for 300 fixed 1/60-second steps. No post-physics arena clamp is present.

The workflow fails unless:

- Maven strict compilation/package succeeds with `-Xlint:all -Werror`;
- the checked-out revision equals the PR candidate head;
- the resolved dependency graph records jME 3.9.0-stable artifacts;
- real Bullet stepping stops the capsule at the east wall within collision tolerance;
- mutating a returned position copy cannot mutate engine-owned physics state;
- a machine-readable result records `passed: true`;
- environment, build log, runtime log, dependency tree, result and SHA-256 files are uploaded even when a later step fails.

## Explicitly unproved

Normal external keyboard/controller input, rendering, production character-controller quality, navigation/combat, salvage/reward/upgrades, persistence/restart, shared production assets, profiling, browser/mobile/device execution, full 13-step Phase A, and human playability remain unknown.

## Failure/recovery log

No failure is omitted. Any compile/runtime problem encountered by the exact-head workflow must be preserved in the PR discussion/artifact trail before repair and rerun.
