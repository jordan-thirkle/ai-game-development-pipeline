# AI Game Development Evaluation Systems — 2026-08

Status: living research companion to `AI-GAME-DEV-LANDSCAPE-2026-08.md`  
Last verified: **2026-08-20**

## Why this exists

BYJTT-LAB should measure the full commercial game-development pipeline, but it should **not invent every agent/game-evaluation task itself**. Independent public benchmarks and game-playing harnesses improve comparability, reduce benchmark bias, and expose failure modes our own reference slice may miss.

The standard should therefore separate:

1. **Agent capability benchmarks** — can an agent correctly modify multimodal game projects?
2. **Runtime/gameplay testing** — can automated players reach states, find soft-locks, exercise inputs and expose regressions?
3. **Pipeline conformance** — does the full creation system preserve evidence, ownership, provenance, release state and human gates?
4. **Human quality/playability** — is the game understandable, enjoyable and worth continuing?

No single benchmark replaces the other three.

---

## GameDevBench — external agent capability benchmark

Repository: https://github.com/waynchi/gamedevbench  
Paper/project: arXiv 2602.11103 / ICML 2026  
Licence: Apache-2.0  
Evidence: **SOURCE-VERIFIED**  
Disposition: **INCUMBENT external game-development agent benchmark; BENCHMARK NOW**

Repository snapshot checked 2026-08-20:
- 101 stars / 7 forks;
- pushed 2026-08-13;
- exact validation environment uses Godot 4.4.1;
- public runner supports Claude Code, Codex, Gemini CLI, OpenCode and OpenHands.

The project defines **333 game-development tasks** across:
- 2D Graphics & Animation — 33.3%;
- 3D Graphics & Animation — 26.7%;
- User Interface — 20.1%;
- Gameplay Logic — 19.8%.

Its README reports that reference solutions average 4.7 changed files and 114 lines across 3.2 file types, making the tasks meaningfully multimodal rather than toy one-file coding prompts.

The camera-ready README reports:
- best tested agent/method solves 63.7% of tasks;
- average success falls materially on graphics-heavy tasks;
- simple image/video feedback mechanisms substantially improve performance for at least one reported model configuration.

Treat those numbers as **benchmark-author results**, not our execution evidence, until we run the suite ourselves.

### Why it changes BYJTT-LAB

We should not design a proprietary "agent can edit games" score when a strong academic benchmark now exists.

Instead:
- BYJTT-LAB remains the full lifecycle/commercial pipeline benchmark;
- GameDevBench becomes an external **Agent Game-Dev Capability** evidence source;
- our engine/agent adapters should eventually be able to run a selected representative subset and, where practical, the full suite;
- visual feedback should be an explicit experimental variable because GameDevBench reports measurable benefit from it.

### Proposed first experiment

Run a small stratified subset before paying the cost of all 333 tasks:
- 2D graphics/animation;
- 3D graphics/animation;
- UI;
- gameplay logic.

Compare the same agent/model with:
1. repository/source context only;
2. runtime screenshot feedback;
3. screenshot + video/runtime feedback where available.

Record success, retries, elapsed time, token/cost, files touched, test validity and whether the agent's self-assessment matched ground truth.

---

## Roblox OpenGameEval — official platform evaluation suite

Repository: https://github.com/Roblox/open-game-eval  
Owner: Roblox  
Licence: MIT  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW for Roblox adapter / creator-agent evaluation**

Repository snapshot checked 2026-08-20:
- 65 stars / 15 forks;
- pushed 2026-07-30;
- repository contains evaluation scripts, places, detailed reviews and an LLM leaderboard for automated assessments in Roblox Studio.

### Why it matters

Roblox is not only shipping an Assistant + official Studio MCP; it is also publishing an evaluation framework. That makes Roblox a useful reference for how a vertically integrated game platform measures AI development quality.

We should inspect its task design and scoring before inventing Roblox-specific conformance tests. Where licensing and task structure permit, our Roblox benchmark should reuse or map to OpenGameEval tasks and then add our cross-provider concerns (ownership, provenance, portability and evidence classes) separately.

---

## Vitric — AI-first deterministic engine + swarm playtesting

Repository: https://github.com/BlackBearCC/vitric  
Licence: MIT  
Language: Rust  
Evidence: **SOURCE-VERIFIED**  
Disposition: **BENCHMARK NOW / architecture study; do not dismiss because adoption metrics are currently tiny**

Repository snapshot checked 2026-08-20:
- created 2026-06-10;
- pushed 2026-08-07;
- currently 0 stars / 0 forks;
- pre-1.0 and explicitly under active development.

The repository describes an unusually relevant architecture:
- deterministic fixed-step simulation and seeded RNG;
- exact snapshot/restore and input recording/replay;
- JSON-schema'd scenes/entities/state;
- HTTP JSON-RPC agent control plane;
- semantic render description plus headless screenshots;
- normal input injection and deterministic stepping;
- swarm playtesting for reachability, soft-locks, dead content, pacing, balance and dominant strategies;
- delivery gates based on replaying a winning recording and requiring terminal events/assertions;
- MCP server and a built-in multi-agent team/turf model.

The README explicitly distinguishes **mechanical floor** from **human quality ceiling**: automated playtest can prove reachability/mechanical properties but not fun, feel or art. That aligns closely with our evidence philosophy.

### Why it matters

Vitric may or may not become a production runtime for us, but several primitives deserve direct study even if the engine is never adopted:

- deterministic replay as evidence;
- snapshot/restore for lookahead tests;
- semantic state designed for models rather than scraping editor UI;
- soft-lock/reachability/dominant-strategy swarm testing;
- delivery certificates tied to exact replayable behavior;
- engine errors carrying stable codes + fix hints for agents.

These are stronger than generic screenshot-only QA for properties that can be represented deterministically.

### Required experiment

Do **not** compare Vitric directly to Unity/Unreal on visual scope. Instead evaluate its verification primitives:
1. run included example;
2. inspect agent API/state descriptions;
3. create or modify one bounded game rule;
4. capture deterministic replay;
5. deliberately introduce a soft-lock or unreachable ending;
6. test whether swarm/gate reliably detects it;
7. assess which primitives can become engine-agnostic conformance concepts in our standard.

---

## Unity Code Agent — in-editor implementation + screenshot/play verification

Repository: https://github.com/Signal-Loop/UnityCodeAgent  
Evidence: **SOURCE-VERIFIED**  
Disposition: **WATCH / benchmark selected verification patterns**

Repository metadata checked 2026-08-20:
- created 2026-06-26;
- pushed 2026-07-21;
- public C# project;
- GitHub metadata currently exposes **no detected licence**, so do not embed/fork until licence status is clarified.

Repository documentation describes an editor agent that can create/modify Unity content, run tests, analyze screenshots and play the game to verify implementation. It also distributes agent skill files for editor scripting and closed-loop game playing.

### Why it matters

This is a direct example of **skills + engine tools + runtime verification** being packaged together. Even if we do not adopt it, our Unity adapter benchmark should compare:
- official Unity Assistant/MCP;
- one strong OSS editor-agent implementation;
- our provider-neutral adapter requirements.

Licence uncertainty is itself part of the solved-system evaluation record.

---

## Unity ML-Agents — mature gameplay-agent baseline

Repository: https://github.com/Unity-Technologies/ml-agents  
Evidence: **SOURCE-VERIFIED**  
Disposition: **REFERENCE / benchmark when learning agents are justified**

Unity ML-Agents is a mature open toolkit for training intelligent agents in Unity through reinforcement learning, imitation learning and related approaches. Its documented use cases include automated testing and evaluating game-design decisions.

### Standard consequence

Do not use an LLM/VLM for every automated playtest problem. Where a deterministic or learned policy is cheaper/more exhaustive, classic RL/imitation/search agents are valid solved systems. The pipeline should choose test-agent type by property being tested.

---

## GamingAgent / LMGame Bench — computer-use game-playing evaluation

Repository: https://github.com/lmgame-org/GamingAgent  
Evidence: **SOURCE-VERIFIED**  
Disposition: **WATCH / benchmark for black-box visual playtesting**

This project evaluates LLM/VLM models across interactive games and provides a computer-use gaming-agent harness. Its relevance is different from GameDevBench:
- GameDevBench tests **development/modification** of game projects;
- GamingAgent tests **playing/interacting** with games from the user side.

This distinction maps well to our verifier architecture: a builder agent's implementation ability and an independent play agent's ability to understand/operate the result should remain separate signals.

---

## Playcaller — Unity real-input MCP playtesting

Repository: https://github.com/takashicompany/playcaller  
Evidence: **SOURCE-VERIFIED from repository**  
Disposition: **WATCH / test against normal-input conformance requirement**

Playcaller exposes Unity Game View interactions such as tap/drag/flick to AI agents through MCP. This is directly relevant to our rule that test harnesses should use normal player inputs rather than privileged gameplay mutation shortcuts when validating user-facing behavior.

The concept should be evaluated even if the specific implementation is not adopted.

---

# Proposed standard evaluation stack

Rather than one giant "AI game-dev score", Standard v0.1 should eventually produce a profile such as:

```text
AgentDevCapability:
  external_suite: GameDevBench
  result: ...

PlatformAgentCapability:
  external_suite: OpenGameEval (when Roblox)
  result: ...

RuntimeMechanicalQA:
  deterministic/replay/reachability/softlock evidence: ...

BlackBoxPlayerQA:
  screenshot/video/normal-input agent evidence: ...

PipelineConformance:
  provenance / exact revision / ownership / release state: ...

HumanPlaytest:
  clarity / feel / fun / taste / accessibility: ...
```

This prevents a system from becoming "best AI game engine" simply because it optimizes one benchmark.

# Immediate actions

1. Add GameDevBench integration feasibility to the Godot/agent evaluation backlog.
2. Add OpenGameEval mapping to the Roblox benchmark rather than writing all Roblox evals ourselves.
3. Run a Vitric verification-primitives spike; harvest concepts even if the engine itself is not selected.
4. Add a `normal-input` conformance flag for playtest evidence, explicitly rejecting hidden mutation APIs as user-behavior proof.
5. Separate **builder-agent benchmark** from **independent player-agent benchmark** in the standard schema.
6. Keep visual feedback as a controlled benchmark variable rather than an assumed universal win.
7. Research test cost: exhaustive deterministic/search tests, learned agents and LLM/VLM playtesters should be selected by expected information gain per cost.
