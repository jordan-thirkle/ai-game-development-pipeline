# AI Game Development Evaluation Systems — 2026-08

Status: living research companion to `AI-GAME-DEV-LANDSCAPE-2026-08.md`  
Last verified: **2026-08-20T01:48:00+01:00** (`Europe/London` project time)

Materialized registry records: `../registry/ai-game-dev-systems.v1.json`.

## Why this exists

BYJTT-LAB should measure the full commercial game-development pipeline, but it should **not invent every agent/game-evaluation task itself**. Independent public benchmarks and game-playing harnesses improve comparability, reduce benchmark bias, and expose failure modes our own reference slice may miss.

The standard therefore separates:

1. **Agent capability benchmarks** — can an agent correctly modify multimodal game projects?
2. **Runtime/gameplay testing** — can automated players reach states, find soft-locks, exercise normal inputs and expose regressions?
3. **Pipeline conformance** — does the full creation system preserve evidence, ownership, provenance, release state and human gates?
4. **Human quality/playability** — is the game understandable, enjoyable and worth continuing?

No single benchmark replaces the others.

---

## GameDevBench — external agent capability benchmark

**Entry ID:** `benchmark.gamedevbench`  
**Benchmark ID:** `bench.gamedevbench`  
Repository: https://github.com/waynchi/gamedevbench  
Pinned revision: `3a80dfdfd01209485185909cb88ac1687dff925e`  
Paper/project: arXiv 2602.11103 / ICML 2026  
Licence: Apache-2.0 for the pinned repository; individual task assets remain separately reviewable  
Evidence: **SOURCE-VERIFIED**  
Adoption: **INCUMBENT + BENCHMARK NOW**

The pinned project defines 333 game-development tasks across 2D graphics/animation, 3D graphics/animation, UI and gameplay logic, and its public harness supports multiple coding agents. Any published scores or claims about visual-feedback gains remain **benchmark-author evidence** until ByJTT executes the relevant suite/configuration.

### Why it changes BYJTT-LAB

We should not invent a proprietary “agent can edit games” score when a serious external benchmark exists.

Instead:
- BYJTT-LAB remains the end-to-end commercial lifecycle benchmark;
- GameDevBench is an external **builder-agent capability** axis;
- adapters should eventually support a stratified subset and, where cost-effective, the full suite;
- visual feedback is a controlled experimental variable, not an assumed universal improvement.

### First experiment

Run a stratified subset spanning all four task categories and compare the same agent/model with:
1. repository/source context only;
2. runtime screenshot feedback;
3. screenshot + video/runtime feedback where supported.

Record success, retries, elapsed time, token/cost, files touched, ground-truth validity and self-assessment calibration.

---

## Roblox OpenGameEval — official platform evaluation suite

**Entry ID:** `benchmark.roblox.open-game-eval`  
**Benchmark ID:** `bench.roblox.open-game-eval`  
Repository: https://github.com/Roblox/open-game-eval  
Pinned revision: `99d231ffef36a80872657a4594246a1bdebfa588`  
Licence: MIT for the pinned repository; included places/assets require separate provenance review  
Evidence: **SOURCE-VERIFIED**  
Adoption: **BENCHMARK NOW**

OpenGameEval provides a useful platform-specific task/evaluation reference. Our Roblox adapter should reuse or map to its task design where appropriate, then add our separate cross-provider concerns such as ownership, portability, provenance and exact-revision evidence.

---

## Vitric — deterministic verification and swarm-playtest research

**Entry ID:** `system.vitric`  
**Benchmark ID:** `bench.vitric.verification`  
Repository: https://github.com/BlackBearCC/vitric  
Pinned revision: `24428f36a02d1669ff441245b1732e945814d5b8`  
Licence: MIT for the pinned repository; dependencies/assets remain separate  
Evidence: **SOURCE-VERIFIED**  
Adoption: **BENCHMARK NOW / architecture study**

The pinned repository documents fixed-step deterministic simulation, snapshot/restore, input recording/replay, semantic state, normal-input injection, headless screenshots and swarm-oriented verification concepts. These are **repository-documented capabilities**, not yet ByJTT-executed facts.

### Required experiment

Do not compare Vitric to Unity/Unreal on visual scope. Evaluate the verification primitives:
1. run an included example;
2. inspect the agent/state surface;
3. modify one bounded game rule;
4. capture deterministic replay;
5. deliberately introduce a soft-lock/unreachable ending;
6. test whether its verification path detects the defect;
7. decide which primitives generalize into engine-neutral conformance concepts.

---

## Unity Code Agent — editor implementation + runtime verification patterns

**Entry ID:** `system.unity.code-agent`  
Repository: https://github.com/Signal-Loop/UnityCodeAgent  
Pinned revision: `978b1c26f77301a20cf92a90f7ccc024c3544c8b`  
Licence: **Unity package code is MIT as declared by the README at the pinned revision**  
Evidence: **SOURCE-VERIFIED**  
Adoption: **WATCH / benchmark selected verification patterns**

The pinned README documents editor mutation, Unity tests, screenshots and closed-loop gameplay verification.

The MIT statement is deliberately scoped: it does **not** establish licences for the GitHub Copilot SDK, other dependencies, bundled assets, model/provider services, user source material or generated outputs. Those require separate dependency/provenance records before embedding or redistribution.

### Why it matters

It demonstrates a useful packaging pattern: **agent skills + engine tools + runtime verification**. Our Unity benchmark should compare first-party Unity integration, a strong OSS editor-agent pattern, and our provider-neutral adapter contract.

---

## Other gameplay-agent/test candidates

### Unity ML-Agents

Repository: https://github.com/Unity-Technologies/ml-agents  
Evidence: **SOURCE-VERIFIED at repository-scope only; not materialized for an experiment yet**  
Adoption: **REFERENCE**

A mature reinforcement/imitation-learning toolkit. Standard consequence: do not use expensive LLM/VLM playtesters when deterministic search or learned policies can test the property more exhaustively or cheaply.

### GamingAgent / LMGame Bench

Repository: https://github.com/lmgame-org/GamingAgent  
Evidence: **SOURCE-VERIFIED at repository-scope only; not materialized for an experiment yet**  
Adoption: **WATCH**

Relevant as a **black-box player-agent** baseline, distinct from builder-agent benchmarks such as GameDevBench.

### Playcaller

Repository: https://github.com/takashicompany/playcaller  
Evidence: **SOURCE-VERIFIED at repository-scope only; not materialized for an experiment yet**  
Adoption: **WATCH**

Relevant because it exposes normal game-view interactions to agents. Normal player input is a separate evidence property from privileged state mutation.

Before any of these becomes experiment evidence, pin exact repository/version/licence inputs in the structured registry and provenance ledger.

---

# Proposed standard evaluation profile

```text
AgentDevCapability:
  benchmark_id: bench.gamedevbench
  result: ...

PlatformAgentCapability:
  benchmark_id: bench.roblox.open-game-eval
  result: ...

RuntimeMechanicalQA:
  deterministic/replay/reachability/softlock evidence: ...

BlackBoxPlayerQA:
  screenshot/video/normal-input evidence: ...

PipelineConformance:
  provenance / exact revision / ownership / release state: ...

HumanPlaytest:
  clarity / feel / fun / taste / accessibility: ...
```

Stable benchmark/system IDs live in `../registry/ai-game-dev-systems.v1.json`; every actual experiment also satisfies `../registry/PROVENANCE.md`.

This prevents a product from becoming “best AI game engine” by optimizing a single benchmark.

# Immediate actions

1. Add GameDevBench execution feasibility to Godot/agent evaluation.
2. Map Roblox adapter tests to OpenGameEval before inventing duplicates.
3. Run a Vitric verification-primitives spike and harvest engine-neutral concepts.
4. Add a `normal_input=true|false` evidence property, rejecting hidden mutation APIs as user-behavior proof.
5. Keep builder-agent and independent player-agent evidence separate.
6. Benchmark visual feedback as a variable.
7. Select deterministic/search, learned-policy and LLM/VLM testers by expected information gain per cost.
