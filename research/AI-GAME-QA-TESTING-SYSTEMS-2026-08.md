# AI Game QA, Visual, Performance and Device Testing Systems — 2026-08

Research date: **2026-08-20** (`Europe/London`)  
Execution status: **NOT EXECUTED — source/vendor research only**  
Tested version/configuration status: **no ByJTT game-QA benchmark result is claimed here**  
Companion: `AI-GAME-DEV-EVALUATION-SYSTEMS-2026-08.md`

## Decision

Do not collapse “game testing” into one agent, one screenshot tool, or one engine test runner. A commercial game needs six evidence layers:

1. **engine-native deterministic/functional correctness**;
2. **rendered visual regression**;
3. **packaged-game black-box player/input verification**;
4. **performance/frame-time/memory/startup/thermal regression**;
5. **target-device and multiplayer-session orchestration**;
6. **human playability/accessibility/taste evidence**.

Each layer has a different trust model. Privileged engine state mutation cannot prove a real player can complete the action. A screenshot diff cannot prove gameplay correctness. A black-box player cannot replace deterministic unit tests. Simulator performance cannot establish physical-device thermal behavior. Human fun scores cannot replace crash/performance gates.

The existing evaluation companion remains authority for GameDevBench, OpenGameEval, Vitric, learned/LLM player-agent research and human evaluation. This document fills the production-QA/tooling layer without duplicating those benchmarks.

---

# 1. Canonical QA evidence contract

Every test result must identify exactly what executed and what observation surface was used:

```text
QAResult
  qa_schema_version
  test_id
  test_revision
  test_layer
  source_revision
  build_id
  artifact_sha256_optional
  engine
  engine_version
  platform
  device_or_environment_id
  device_class
  execution_mode
  normal_player_input
  privileged_state_access
  start_at_utc
  duration_ms
  status = passed | failed | blocked | invalid
  failure_class_optional
  assertions[]
  screenshots[]
  video_optional
  trace_paths[]
  log_paths[]
  metrics[]
  crash_artifact_paths[]
  environment_manifest_path
```

`normal_player_input=true` means the observed behavior was driven only through inputs available to the intended player on that platform. Engine console commands, direct transform mutation, hidden RPCs, editor-only state injection or privileged test controllers must set `normal_player_input=false` even if they are legitimate testing mechanisms.

Both forms are valuable; they answer different questions.

---

# 2. Unity incumbent QA layer

## Unity Test Framework

Primary source: `https://docs.unity3d.com/current/Manual/com.unity.test-framework.html`  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT UNITY ENGINE-NATIVE TEST BASELINE**

Unity 6 documents `com.unity.test-framework` as the built-in framework for Edit Mode and Play Mode testing; the core package version is tied to the Editor version. Platform-capable Play Mode tests can execute in a built player, so editor-only success must not be treated as target-runtime proof.

Required benchmark:

- pure/domain unit tests where engine runtime is unnecessary;
- Edit Mode editor/tooling tests;
- Play Mode scene/gameplay tests;
- target-player execution for at least desktop plus one mobile target where the game supports them;
- deterministic test fixtures and cleanup;
- test-result export suitable for CI evidence;
- intentionally failing fixture proving CI rejects the build.

## Unity Performance Testing API

Primary source: `https://docs.unity3d.com/current/Manual/com.unity.test-framework.performance.html`  
Current Unity 6000.0 docs list **Performance Testing API 3.2.0** as released.  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT UNITY REPEATABLE PERFORMANCE-TEST BASELINE**

The package extends Unity Test Framework with performance measurement and configuration metadata. It is a benchmark harness, not proof that editor measurements represent physical-device performance.

Required metrics include frame/update duration for frozen workloads, allocations, memory where available, load/startup boundaries, distributions rather than only averages, warm-up policy and environment metadata.

Unity benchmark policy: editor performance is diagnostic evidence; production mobile performance requires target hardware evidence.

---

# 3. Unreal incumbent QA layer

## Unreal Automation Test Framework

Primary source: `https://dev.epicgames.com/documentation/unreal-engine/automation-test-framework-in-unreal-engine` for Unreal Engine **5.8**.  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT UNREAL ENGINE-NATIVE TEST + VISUAL BASELINE**

Current Unreal docs explicitly separate Unit, Feature, Smoke, Content Stress and Screenshot Comparison tests. The framework also exposes Automation Driver for input simulation, Functional Testing, editor Blueprint/Python test paths and CQTest/Automation Spec patterns.

The screenshot comparison system keeps approved ground truth and incoming/difference evidence, with configurable tolerances. Ground truth is versioned test evidence and must never be automatically replaced merely because a new build differs.

Required benchmark:

- unit/feature/smoke/content-stress examples;
- functional level test;
- screenshot comparison with an intentional visual regression;
- UI screenshot path where applicable;
- Automation Driver input path;
- command-line/build-farm execution;
- result/log/screenshot artifact collection.

## Unreal Gauntlet

Primary sources:
- `https://dev.epicgames.com/documentation/unreal-engine/gauntlet-automation-framework-overview-in-unreal-engine`
- `https://dev.epicgames.com/documentation/unreal-engine/running-gauntlet-tests-in-unreal-engine`

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT PACKAGED-SESSION / MULTIPLAYER / DEVICE ORCHESTRATION BENCHMARK**

Gauntlet runs project sessions rather than building them. Epic documents complex role configurations such as multiple clients plus a server, platform/device abstractions, log/crash/saved-data collection and packaged target automation. Current built-in test patterns include boot, editor/target automation, networking, error and process-lifetime tests.

This makes Gauntlet a much stronger Unreal benchmark than inventing our own shell scripts for 5v5/client-server startup orchestration.

Required benchmark:

- packaged boot smoke test;
- dedicated server + two clients minimum;
- deliberate server/client failure detection;
- per-role logs/crashes;
- platform/device selection;
- timeout/cleanup/orphan-process handling;
- target automation test invocation;
- networking trace correlation.

## Unreal Horde Devices / Automation Hub

Primary source: `https://dev.epicgames.com/documentation/unreal-engine/horde-devices-for-unreal-engine`  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **REFERENCE / SCALE BENCHMARK, NOT SMALL-STUDIO DEFAULT**

Horde provides device pools, reservations, health/history and Gauntlet integration. It is a serious solved-system reference for device-farm architecture, but its operational cost must be compared with simpler hosted/local device solutions before adoption.

---

# 4. Browser/web-game QA

## Playwright Test

Primary sources:
- `https://playwright.dev/docs/test-snapshots`
- `https://playwright.dev/docs/trace-viewer`

Evidence: **SOURCE/DOC-VERIFIED; NOT BYJTT EXECUTED IN THIS QA PROFILE**  
Disposition: **INCUMBENT BROWSER-GAME BLACK-BOX + VISUAL/UI EVIDENCE BASELINE**

Playwright is appropriate for web-game shells, menus, onboarding, payments/account surfaces and canvas/WebGL interactions that can be driven through browser input. It provides visual screenshot comparisons and rich traces for failed CI runs.

Playwright itself warns that screenshot rendering varies with OS, browser version, hardware and other environment details. Therefore screenshot baselines are keyed by a frozen environment identity; a Linux/Chromium baseline is not silently compared to macOS/WebKit.

Required benchmark:

- title/menu → gameplay start journey;
- keyboard/mouse/touch-emulation input where appropriate;
- browser console/page errors;
- screenshot checkpoints under frozen browser/container environment;
- first-retry traces containing screenshots/snapshots/actions;
- loss-of-focus/resume;
- viewport/responsive variants;
- WebGL/canvas readiness state;
- network/offline failure where supported.

A Playwright DOM assertion cannot substitute for rendered gameplay verification inside a canvas; use screenshots, game-exposed **read-only test semantics**, or true player-observable outcomes rather than hidden state mutation.

---

# 5. Android physical-device performance

Primary sources:
- `https://developer.android.com/games/optimize/gameperformance`
- `https://developer.android.com/games/optimize/overview`
- `https://developer.android.com/games/optimize/adpf/fixed-performance-mode`

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT ANDROID DEVICE-PERFORMANCE EVIDENCE POLICY**

Current Android game guidance treats scene-level measurement, CPU/GPU diagnosis, profiling and repeated verification as a physical-device workflow. It explicitly calls out Unity Profiler, Unreal Insights, Perfetto, RenderDoc and Android GPU Inspector among the relevant tools. Performance work also includes thermal and power behavior, not just desktop frame rate.

Fixed Performance Mode can reduce some run-to-run variability but does not eliminate core selection or thermal effects; Google recommends repeated runs using comparable cores and waiting for thermally sustainable state. Therefore it cannot be used to hide thermal throttling.

Frozen Android run evidence:

- exact physical device/model/SoC/GPU;
- OS/build;
- power/battery state;
- refresh rate and game mode;
- thermal state before/during run;
- fixed-performance-mode state if used;
- scene/workload ID;
- target FPS and frame-time distribution;
- CPU/GPU utilization and bottleneck classification;
- memory/high-water mark;
- startup/load timings;
- trace/profiler artifacts;
- repeated-run distribution.

---

# 6. Apple platform performance

Primary source: `https://developer.apple.com/documentation/xctest/performance-tests`  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **APPLE-NATIVE PERFORMANCE REGRESSION REFERENCE**

XCTest performance tests can baseline metrics and fail on significant regressions. Current metric types include clock/time, CPU, memory, UI hitches, storage, signposts and application launch duration.

For Unity/Unreal games, XCTest is not a replacement for the engine profiler. It is useful for native app lifecycle/startup/UI/system integration and repeatable platform-level metrics around the game binary.

Physical-device execution remains required before claiming iPhone/iPad performance readiness.

---

# 7. Visual regression policy

A visual baseline is evidence, not an oracle.

Every baseline records:

```text
VisualBaseline
  baseline_id
  test_id
  source_revision
  build_id
  engine_version
  platform
  device_or_browser
  resolution
  graphics_api
  quality_preset
  render_pipeline
  locale
  accessibility_state
  tolerance_policy
  image_sha256
```

Rules:

- baseline changes require explicit review/approval;
- do not auto-update snapshots on CI after a diff failure;
- visual tests use deterministic camera/state setup where possible;
- temporal effects, particles, animation and nondeterministic shaders require a deliberate capture policy;
- tolerances are frozen before the candidate run;
- a high tolerance cannot be introduced after observing a failure without invalidating/restarting the run;
- multiple baseline families are allowed when platform/render differences are legitimate and documented.

AI/VLM review may classify or prioritize diffs, but pixel/engine comparison evidence remains available independently. A VLM saying “looks fine” cannot erase a failed deterministic visual gate.

---

# 8. Performance regression policy

Performance is a distribution tied to hardware/environment, not one FPS screenshot.

Canonical performance record:

```text
PerformanceRun
  workload_id
  workload_revision
  build_id
  platform
  device_id
  environment_manifest
  warmup_policy
  sample_count
  frame_time_p50
  frame_time_p95
  frame_time_p99
  hitch_count_thresholded
  cpu_metrics
  gpu_metrics
  memory_metrics
  startup_or_load_metrics
  thermal_metrics_where_available
  trace_artifacts[]
```

Regression thresholds are frozen before execution and can differ by device tier. One faster machine cannot compensate for a regression on the minimum-supported target.

---

# 9. Black-box gameplay evidence

The player-facing QA layer should prefer normal player inputs and observable outcomes:

```text
BlackBoxJourney
  journey_id
  start_state_contract
  input_actions[]
  expected_observable_checkpoints[]
  max_duration
  recovery_policy
  normal_player_input = true
```

Examples:

- fresh install → main menu → new game → first objective;
- controller navigation through every primary menu;
- die/fail → retry → recover;
- suspend/background → resume;
- disconnect → reconnect/recover;
- multiplayer join → spawn → move → action → leave;
- save → exit → relaunch → continue.

Privileged setup is allowed **before** the journey to create a fixture, but the evidence must make that explicit. A journey claiming user accessibility cannot use hidden mutation to complete the actual interaction under test.

---

# 10. Cross-engine QA adapter

The pipeline should normalize tools into a small contract instead of abstracting away their strengths:

```text
QARunner.listTests(filter) -> TestDescriptor[]
QARunner.runEngineTests(manifest) -> QAResult[]
QARunner.runBlackBoxJourney(manifest) -> QAResult
QARunner.captureVisualCheckpoint(checkpoint) -> VisualEvidence
QARunner.runPerformanceWorkload(manifest) -> PerformanceRun
QARunner.runSession(manifest) -> SessionEvidence
```

Engine-specific adapters retain raw native evidence:

- Unity test XML/performance data/profiler artifacts;
- Unreal automation/Gauntlet reports, screenshots, logs and traces;
- Playwright traces/screenshots/report;
- Android Perfetto/AGI/device telemetry;
- Apple XCTest result bundles/metrics.

Normalization is additive. Never throw away raw provider/engine reports just to fit a simplified dashboard.

---

# 11. Frozen benchmark families

## Benchmark A — engine-native correctness

Implement equivalent bounded game rules in Unity and Unreal and run their first-party test frameworks. Measure setup, execution speed, failure quality, CI portability, target-player support and evidence export.

## Benchmark B — visual regression

Introduce known visual regressions: missing material, wrong UI scale, incorrect camera, changed lighting, hidden button and text overflow. Compare Unreal native screenshot tests and Playwright where applicable; add Unity visual candidates only after current source verification rather than assuming parity.

## Benchmark C — black-box journey

Run the same user-visible journey through supported normal-input harnesses. Score completion, false positives, hidden-state reliance, evidence quality, recovery handling and agent cost.

## Benchmark D — performance regression

Freeze workloads and intentionally introduce CPU, GPU, allocation/memory and loading regressions. Verify that thresholds detect them on representative physical devices without conflating environment variance with code regression.

## Benchmark E — multiplayer/session orchestration

For an authoritative test game, launch server plus multiple clients, inject disconnect/server failure, capture per-role evidence and prove cleanup. Unreal Gauntlet is the incumbent reference; other engines must meet the same evidence contract without reimplementing unnecessary orchestration.

## Benchmark F — human calibration

Blind human playtesters review a subset of automation-pass and automation-fail builds for clarity, feel, fun, accessibility and obvious visual defects. Measure automation false-negative/false-positive rates rather than pretending human and machine QA are interchangeable.

---

# 12. Current research hierarchy

This is **benchmark ordering, not production adoption**:

1. **engine first-party testing frameworks first** — Unity Test Framework / Performance API and Unreal Automation Framework;
2. **Unreal Gauntlet** — incumbent packaged-session, multiplayer and target-device orchestration benchmark;
3. **engine-native screenshot comparison where mature** — Unreal is a strong first-party baseline;
4. **Playwright** — incumbent browser/web-game UI, journey, visual and trace baseline;
5. **Android platform tooling** — physical-device performance truth for Android builds;
6. **XCTest metrics** — Apple-native regression evidence around launch/UI/system integration;
7. **Vitric / learned policies / LLM-VLM players** — complementary gameplay-verification research from the existing evaluation companion;
8. **custom harness code** — only for thin adapters, missing normal-input bridges or evidence normalization after mature solved systems are exhausted.

Do not build an entire proprietary cross-engine testing framework before proving the specific gaps first-party systems leave.

---

# 13. Promotion gate

No QA tool becomes `EXECUTED`, `preferred` or a default project template until a completed experiment record contains:

- exact engine/tool/package versions;
- immutable source revision where applicable;
- frozen test/workload/journey manifest;
- platform/device/browser manifest;
- whether normal player input or privileged access was used;
- screenshot baseline/tolerance revision where applicable;
- performance threshold and warmup policy frozen before execution;
- raw reports, screenshots, traces, logs and crash artifacts;
- deliberate fault-injection evidence proving the test can fail;
- false-positive/false-negative observations;
- runtime/CI cost;
- maintenance burden;
- limitations;
- rollback/removal path;
- explicit promotion decision.

A QA pipeline is not strong because it has many green checks. It is strong when each check has a known observation boundary, can demonstrably catch the defect it claims to catch, runs on the hardware/runtime that matters, and leaves evidence another engineer or agent can independently inspect.