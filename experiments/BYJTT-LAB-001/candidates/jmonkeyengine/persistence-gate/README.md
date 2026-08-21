# jMonkeyEngine persistence/restart gate

This additive BYJTT-LAB-001 gate advances the jMonkeyEngine lane through shared playthrough steps 11–13 without modifying any existing jMonkeyEngine candidate subtree or shared contract.

The gate preserves the shared 24×32 m arena, player `(0,0,10)`, salvage `(5,0,0)`, 3.5 m/s movement, 34 damage / 1.8 m attack range, 34 salvage health, 1.25 m reward pickup radius, one reward, and `damage-up-1` ×1.2 upgrade.

The save phase first earns progression through native Minie `PhysicsCharacter` movement and gameplay attack/interact action edges. The normal game save path then serializes a jME `Savable` through the engine-native `BinaryExporter`. A second, separate JVM invocation starts a fresh runtime and loads the same `.j3o` using `BinaryImporter`; restored observations must contain `schema_version=1`, `reward_count=1`, and `damage-up-1` with effective damage 40.8.

Instrumentation is observation-only. The workflow also performs fail-closed structural checks: no direct health/reward/upgrade/save mutation helper may exist, and the only `setPhysicsLocation` calls allowed are initial spawn/static-wall construction required to instantiate the native physics scene. Runtime observations are returned as immutable copies.

## Evidence boundary

This proves headless jMonkeyEngine/Minie progression persistence and a true process-boundary restart/load path. It does not claim rendered progression UI, physical keyboard/controller/touch delivery, a unified production scene, full Phase A, production assets, device/mobile profiling, or human playability.

The PR must remain draft and unmerged until fresh exact-head execution and independent review of that exact revision are clean.
