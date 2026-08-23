# Three.js save-write failure correctness gate

This bounded BYJTT-LAB-001 correctness slice exercises the unchanged integrated Three.js/WebGPU production runtime when browser persistence writes fail.

It injects only browser `Storage.setItem` failures (`QuotaExceededError` and `SecurityError`), invokes the normal production Save control, and requires the game to remain alive and controllable while clearly reporting `Save unavailable`. No gameplay state setter, direct persistence write, benchmark-constant change, or production-source modification is introduced.

A passing run requires both injected failures to leave the save key absent, avoid publishing `save.schema_version=1`, keep `runtime.ready`/`player.alive` true, preserve normal keyboard movement and release stability, and produce zero uncaught browser/page errors.

Evidence boundary: save-write failure handling only. Corrupted-save import correctness, accessibility, physical-device behavior, performance, HUMAN-TESTED status, publication and release readiness are outside this slice.
