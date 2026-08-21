# jMonkeyEngine rendered physical player-attack input gate

Issue: #233. Parent headless player-attack proof: PR #231 exact head `e3897a8e36b09d5bf59728748bd51087e2c97051`. Rendered input precursor: PR #176.

This bounded slice reruns the unchanged headless player-attack prerequisite, then proves that a real OS Space press/release reaches a real jMonkeyEngine 3.9 desktop process through `InputManager` -> `KeyTrigger` -> `ActionListener` and is consumed by the gameplay attack action. The rendered fixture keeps the shared player attack values unchanged: 1.8 m range, 34 damage, 0.55 s cooldown. It begins explicitly in range at 1.5 m so this slice measures attack-input delivery rather than duplicating the already-proven native-character acquisition/chase path.

Required result: first physical attack 100->66, an early second press is blocked at 66, and the next physical press after cooldown produces 66->32. The external harness has no health setter or gameplay mutation API; it only focuses the jME window and emits OS keyboard events. Screenshots, window/runtime diagnostics, strict Java build, dependency graph, exact-head identity and SHA-256 evidence are retained.

Evidence boundary: physical OS attack input + rendered gameplay-action handling only. The unchanged parent #231 result remains the proof for legitimate Minie acquisition/chase/combat positioning. This gate does not claim those two proof surfaces are yet one production scene, nor rendered hit reaction quality, salvage/reward/upgrades, persistence, full Phase A, production assets, profiler/device/mobile evidence, or human playability.
