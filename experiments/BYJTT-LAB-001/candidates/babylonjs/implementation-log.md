# Babylon.js Phase A implementation log

This log records the evidence-bearing implementation path for BYJTT-LAB-001 candidate `babylonjs`. Failed probes are retained because they explain design changes and prevent rediscovery of the same integration problems.

## Baseline and solved-system selection

- Pinned Babylon.js `9.20.0`, `@babylonjs/havok` `1.3.14`, Vite `8.2.1`, and Playwright `1.62.0`.
- Chose Babylon WebGPU-first rendering with engine-native WebGL fallback.
- Chose official Havok Physics V2 rather than adding another physics engine.
- Kept navigation direct-steering-only for the unobstructed Phase A arena.

## Physics bootstrap investigation

Initial browser execution built and served successfully but failed before readiness. The first tracer exposed an instrumentation defect because the observation surface was installed only after async bootstrap; bootstrap failures therefore returned `snapshot=null`.

The observation surface was moved before asynchronous renderer/physics initialization. The next probe isolated `Error: No Physics Engine available.` Upstream Babylon source showed that modular Physics V2 registration is split: `joinedPhysicsEngineComponent` installs the scene physics methods and selects V1/V2 by plugin version, while the V2 component registers Physics V2-specific runtime behavior. Importing only the V2 component was insufficient. Importing the minimal joined + V2 pair produced a successful Havok v2 tracer without pulling the broad backward-compatibility physics barrel.

## Full gameplay implementation

Implemented the neutral Phase A loop with fixed-step deterministic simulation: movement/camera, enemy acquisition and pursuit, bidirectional combat, normal death/respawn, salvage destruction, reward/upgrade progression, save, reload and restored-state verification. Havok owns the static environment while player/enemy locomotion remains a deliberately thin kinematic layer.

The first full 13-step run passed on candidate `c7b3115d...`. A later revision-exact run on `19004afb...` also passed, proving documentation drift had not invalidated the gameplay implementation.

## Independent specification audit

A code/spec audit found that the original 13-step harness was not sufficient to prove every system explicitly required by the shared experiment specification. It did not exercise real touch movement and did not explicitly prove idle/walk/run states, hit reactions, visual feedback or audio feedback.

The candidate was extended with:

- explicit procedural `idle`, `walk`, `run` and `dead` state observations;
- deterministic procedural animation transforms;
- hit-reaction state and visual response;
- deterministic mesh-spark VFX;
- synthesized WebAudio event feedback;
- real Chrome touch input testing;
- Playwright trace capture;
- explicit feedback/performance evidence fields.

The first stricter probe failed for two harness reasons rather than gameplay failure: runtime feedback counters were checked after the intentional reload, where they correctly reset, and synthetic pointer dispatch could not legally satisfy pointer capture. Failed run `32301027692` preserved artifact `9383026962` (SHA-256 `bc3113554e1456bb5bd253e44a659217a26fad295813c75f9a83c7d0a59b4021`). The harness was corrected to preserve pre-restart feedback evidence and use Chrome's real CDP touch path.

## CodeRabbit review remediation

CodeRabbit identified five verified issues, all addressed before landing:

1. Playwright was missing from `dependencies.json` provenance despite being pinned in `package.json`.
2. A recoverable WebGPU initialization failure was being stored in the fatal `runtime.errors` channel even when WebGL2 fallback succeeded. The candidate now records this in `runtime.warnings` and preserves warnings as evidence.
3. Reward collection happened automatically by proximity, leaving the Interact action unproven. Automatic pickup was removed; step 08 now proves that proximity alone does not collect the reward, presses `KeyE`, and verifies the resulting collection.
4. The preview child process lacked spawn-error handling and confirmed shutdown. The harness now records spawn failures and waits for termination with a bounded SIGKILL fallback.
5. `ensurePlayerAlive()` indexed a potentially null snapshot. Snapshot handling is now null-safe and reacquires valid state through the normal wait path.

Two later evidence-integrity findings were also addressed before final landing:

6. Audio feedback previously incremented its evidence counter even if `AudioContext.resume()` rejected or remained suspended. `playTone()` now awaits resume, records resume/state failures, and increments the event counter only when the context is actually `running`. The Phase A gate explicitly requires running-audio evidence.
7. Trace capture originally occurred after a successful verdict could already be serialized. Cleanup was restructured so trace completion/failure, browser shutdown and preview-server shutdown are incorporated before evidence serialization and before the final verdict. A missing trace can no longer coexist with `execution_verified: true`.

## Reviewed execution proof

Run `32301836744` tested exact candidate head `29ee92108e4e3a7a2a66be31219e47cb317978e4` under Google Chrome `151.0.7922.137` / Node `26.7.0` and passed:

- all 13 shared `mobile-action-slice-v1` steps;
- idle/walk/run state evidence;
- real touch movement;
- bidirectional hit reactions;
- deterministic VFX;
- synthesized audio feedback;
- explicit Interact-driven reward pickup;
- observation mutation isolation;
- mobile viewport constraints;
- performance counters;
- completed Playwright trace capture.

Renderer evidence was `webgl2-fallback`, Havok plugin version `2`, and `navigator.gpu=true`. Build evidence was ~1,249.57 kB JS minified / ~301.10 kB gzip plus ~2,094.56 kB Havok WASM / ~668.98 kB gzip. Artifact `9383303209`, SHA-256 `d51a6a732d256fda664facd1e6f03e43ad1cb350d56e829bc86481baafd49da1`.

## Remaining landing gate

The final audio/cleanup review fixes and this log update advance the branch revision beyond the last reviewed execution. Before integration, execute the exact final candidate revision and then execute that same candidate as a GitHub merge ref against current `main`. Merge only after both are green and the latest CodeRabbit review reports no unresolved actionable findings.


## Final evidence-snapshot integrity remediation

A later CodeRabbit review found that the harness serialized final evidence after browser shutdown, which could reduce `final_snapshot`, renderer, Havok and performance fields to unknown despite a successful gameplay run. The harness now captures the final benchmark snapshot while the browser is still open, passes that immutable observation into evidence writing after cleanup, and derives trace/screenshot capture paths from files that actually exist rather than from a fixed claimed list. This changed evidence integrity only; gameplay behavior was not altered. The candidate must be rerun revision-exact after this change before landing.
