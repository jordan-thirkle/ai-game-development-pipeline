# BYJTT-LAB-001 Preflight — 2026-08-19

Purpose: freeze a defensible starting set of engine/runtime candidates for the first Mobile 3D Action Slice comparison using current primary sources rather than remembered versions.

## Version policy

Benchmark 001 defaults to the latest stable production release verified on the preflight date. Pre-release builds may be tested separately when they contain a capability materially relevant to the research question, but they do not silently replace the stable track.

All candidates remain `candidate`. Version verification is not evidence that a runtime wins the benchmark.

## Candidate pins

### Three.js / WebGPU

- Benchmark pin: **r185**.
- Status: latest release shown by the official Three.js GitHub releases page at preflight time.
- r186 has migration documentation and an open milestone but is not listed as a published release in the current release list, so Benchmark 001 does not silently pin an unreleased milestone.
- License: MIT.
- Primary research interest: maximum AI editability and browser iteration velocity with an intentionally composable rather than all-in-one game stack.

Primary sources:
- https://github.com/mrdoob/three.js/releases
- https://github.com/mrdoob/three.js/wiki/Migration-Guide

### PlayCanvas

- Benchmark pin: **Engine v2.21.3**.
- v2.21.0 was released July 21, 2026 and patched through v2.21.3 by July 29.
- Engine V1 Editor support ended July 29, 2026; the benchmark therefore uses Engine V2 rather than carrying a deprecated Editor path.
- Primary research interest: whether a more complete web game engine preserves much of the TypeScript/web-agent advantage while removing work that raw Three.js requires us to compose.

Primary sources:
- https://forum.playcanvas.com/t/engine-v2-21-0/42453
- https://developer.playcanvas.com/user-manual/editor/engine-compatibility/

### Babylon.js

- Benchmark pin: **9.20.0**.
- Status: latest release listed by the official Babylon.js repository at preflight time.
- License: Apache-2.0.
- Primary research interest: batteries-included TypeScript/WebGPU game/rendering infrastructure and whether its broader built-in surface reduces agent integration work versus Three.js.

Primary sources:
- https://www.babylonjs.com/
- https://github.com/BabylonJS/Babylon.js/releases

### Godot

- Benchmark pin: **4.7.1-stable**.
- Godot 4.7.2 is currently RC1, not stable; Godot 4.8 is a development branch.
- Primary research interest: complete open-source editor/runtime, native mobile export, headless/CLI automation, mature scene/game systems, and lifecycle cost beyond rapid prototyping.

Primary source:
- https://godotengine.org/download/archive/

### Unity

- Benchmark pin: **Unity 6.3 LTS**.
- Status: current LTS family used for the benchmark rather than a short-lived update stream.
- Unity 6.3 includes broad platform tooling and production-oriented cross-platform systems that may reduce later lifecycle work even if prototype iteration is heavier.
- AI/MCP usage must remain compliant with current Unity terms and supported automation paths; this is a benchmark constraint, not a reason to pre-reject Unity.

Primary sources:
- https://unity.com/blog/unity-6-3-lts-is-now-available
- https://unity.com/features/ai

### Defold

- Benchmark pin: **1.13.0 stable**.
- A 1.13.1 beta exists, but stable is used for the baseline.
- 1.13.0 materially expands 3D/glTF, physics scripting, Android Vulkan defaults, runtime graphics capability inspection, and editor automation via an authenticated `/eval` endpoint.
- Primary research interest: lightweight native/mobile production with unusually small runtime/build overhead and improving agent/editor automation.

Primary sources:
- https://defold.com/2026/06/22/Defold-1-13-0/
- https://defold.com/2026/07/01/Newsletter-June-2026/

## Fairness controls

### Shared product specification

Every candidate implements the same externally observable player path from `spec.md`. Engine-specific architecture may differ where using the engine as intended eliminates work.

A candidate must not be penalised for using a strong built-in system merely because another runtime requires a third-party library. The benchmark is specifically measuring total production leverage, not lowest-common-denominator implementation.

### Shared source content

Use the same licence-safe source character, environment, animations, audio, textures, and encounter layout where technically possible.

Engine-specific import optimisation is allowed and measured.

### Solved-system gate

For each runtime, first investigate:
1. engine-native capability;
2. officially recommended packages/modules;
3. mature maintained open-source solutions;
4. existing By JTT promoted components;
5. bespoke code only for unresolved gaps.

This prevents intentionally underusing a mature engine in order to make raw-code stacks appear competitive.

### Comparable gameplay constants

Keep shared values for movement speed, acceleration intent, attack timing, damage, enemy health, pickup radius, arena dimensions, and encounter sequence in a neutral benchmark definition where practical.

Adapters may translate those values into engine-native units or systems but must record deviations.

### Test sequence

The deterministic/repeatable path must cover at minimum:
1. cold launch;
2. enter gameplay;
3. move and turn;
4. enemy acquisition/navigation;
5. attack and receive attack;
6. damage/death-state handling;
7. break salvage object;
8. collect item;
9. trigger upgrade;
10. save;
11. restart/reload;
12. restore expected progression state.

### Evidence

Each candidate must produce a `pipeline-run` record using `schemas/pipeline-run.schema.json` and retain:
- exact version/commit;
- source/build commit;
- dependency inventory;
- solved-system decisions;
- agent/model/tool usage where measurable;
- human interventions;
- failure/recovery history;
- automated test result;
- screenshot/video evidence;
- profiler/performance evidence;
- build/package output;
- known limitations.

## Initial research questions

Benchmark 001 is not asking only “which engine is fastest?” It asks:

1. Which candidate reaches a **validated playable** with the least total agent/human effort?
2. Which produces the strongest gameplay/presentation quality under the same product scope?
3. Which requires the least bespoke infrastructure because solved systems are available?
4. Which is easiest for agents to inspect, execute, debug, and repair from evidence?
5. Which has the strongest deterministic QA route?
6. Which has the best mobile production path?
7. Which creates the lowest expected maintenance burden?
8. Does the browser-native TypeScript advantage survive when total game-engine functionality is included?
9. Does a complete engine's higher initial setup cost repay itself before or after vertical-slice complexity?
10. Are different winners appropriate for prototype and production stages?

## Preflight conclusion

No universal winner is selected. The first meaningful comparison should begin with the web-native group (Three.js, PlayCanvas, Babylon.js) and open/native group (Godot, Defold), while Unity remains a full production-ecosystem control track subject to its current automation/licensing constraints.

The benchmark should publish context-specific conclusions, not a global engine ranking.
