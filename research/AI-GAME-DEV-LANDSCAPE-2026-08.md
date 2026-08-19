# AI Game Development Landscape — 2026-08

Status: **living research registry**  
Canonical standard: `../docs/AI-GAME-DEVELOPMENT-STANDARD.md` when that normative draft lands; until then, GitHub issue `#75` is authoritative.  
Last substantive review: **2026-08-20**

## Purpose

This registry makes the pipeline's **best solved system first** rule executable.

Before building a game-development subsystem, editor bridge, creator workflow, asset pipeline, agent runtime, testing layer, publishing path or live-ops capability, workers MUST search this registry and current primary sources. Existing systems should be adopted, wrapped, forked or benchmarked before bespoke implementation is accepted.

This is not a popularity list. Stars, funding and marketing visibility are secondary signals. The important questions are:

1. Does it solve the real capability we need?
2. Can it be independently executed and verified?
3. Is the project active and maintainable?
4. Is the licence compatible with our intended use?
5. Does it preserve user/project ownership and portability?
6. Can it expose evidence rather than only claim success?
7. Does it integrate through a stable API, CLI, MCP surface, open format or other replaceable adapter?
8. What does adopting it cost in runtime, money, lock-in and maintenance?

## Evidence labels

- **EXECUTED** — ByJTT has independently run the relevant capability.
- **SOURCE-VERIFIED** — current official docs/source/repository inspected, but ByJTT has not executed the capability yet.
- **VENDOR-CLAIM** — vendor documentation/marketing claim requiring independent execution.
- **PAPER-CLAIM** — research result not yet reproduced by ByJTT.
- **UNKNOWN** — insufficient current evidence.

A vendor/source claim MUST NOT silently become an EXECUTED result.

## Dispositions

- **BENCHMARK NOW** — directly relevant and strong enough to deserve an execution experiment.
- **INCUMBENT** — current strongest solved-system baseline until displaced by evidence.
- **ADAPTER CANDIDATE** — likely valuable behind a provider-neutral interface.
- **WATCH** — promising but not yet high enough leverage.
- **REJECT FOR NOW** — known mismatch; record why so future agents do not repeat the same investigation.

---

# 1. Full creator / engine systems

## Unity AI + official MCP

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW / engine-adapter baseline

Primary sources checked:
- https://unity.com/blog/unity-ai-how-to-get-started
- https://unity.com/features/ai
- https://unity.com/news/unity-7-roadmap-revealed-at-unite-seoul

Current documented baseline:
- project-aware in-editor Assistant with Ask / Plan / Agent modes;
- scene/GameObject/package/target-platform context;
- official MCP server for external coding agents;
- AI Gateway for third-party agents/models;
- undo for AI changes, autonomy permissions and generated-asset tagging;
- broader Unity lifecycle remains mature across runtime, profiling, platform builds, services and monetisation.

**Why it matters:** `AI agent + editor context + MCP + undo` is already table stakes. Our engine adapter must be more portable/trustworthy, not merely replicate these features.

**Required benchmark:** same bounded game edit via Unity Assistant and an external agent over official MCP; measure context accuracy, mutation safety/undo, playtest execution, screenshots/evidence, token/tool friction, and exportability.

## Roblox Studio + Assistant + official MCP

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW / creator-experience baseline

Primary sources checked:
- https://create.roblox.com/docs/assistant/guide
- https://create.roblox.com/docs/studio/mcp
- https://create.roblox.com/docs/ai/accelerated-workflows
- https://create.roblox.com/docs/studio

Current documented baseline includes:
- direct manipulation of Studio's place data model and scripts;
- asset search/insertion and generated materials/meshes/procedural models;
- persistent and branching chats;
- viewport screenshot reasoning;
- simulated-input playtests;
- official MCP access for external agents;
- deeply integrated engine, networking, collaboration, device emulation and publishing.

**Strength:** unusually complete creator→test→publish loop.

**Constraint:** strong Roblox-platform lock-in means it is a UX/capability benchmark, not our ownership model.

**Required benchmark:** first playable from a fixed novice brief; edit through natural language; screenshot-informed correction; normal-input playtest; branch/revert; publish-preview path.

## GDevelop

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW / incumbent beginner→shipping benchmark

Primary sources:
- https://gdevelop.io/en-gb/features
- https://gdevelop.io/en-gb/game-makers
- https://gdevelop.io/en-gb/pricing

Current documented baseline:
- MIT-licensed open-source editor/engine;
- no-code event system with JavaScript escape hatch;
- built-in AI helper/agent;
- 2D and 3D authoring, live preview, debugging/profiling;
- touch/gamepad and broad platform export;
- ready-made behaviours/extensions and asset/template ecosystem;
- multiplayer/lobbies/player accounts/leaderboards;
- analytics/player feedback/cloud services;
- ads, Steamworks and platform integrations;
- local and cloud workflows.

**Why it matters:** a strong direct challenge to any claim that our Creator Mode is special merely because non-technical users can build and ship.

**Required benchmark:** novice journey from fixed brief → first playable → iteration → save/reopen → multiplayer/backend requirement → analytics/monetisation setup → export. Record every point where code/pro concepts become necessary.

## Rosebud

**Evidence:** VENDOR-CLAIM  
**Disposition:** BENCHMARK NOW / time-to-first-playable baseline

Primary vendor sources:
- https://lab.rosebud.ai/blog/create-3d-game-with-ai
- https://lab.rosebud.ai/blog/rosebud-ai-interface-guide
- https://lab.rosebud.ai/blog/how-to-create-a-video-game

Vendor-positioned strengths:
- browser-first natural-language creation;
- rapid playable 2D/3D scenes;
- chat iteration + generated assets;
- play/publish loop with little setup.

**Required benchmark:** same non-technical creator brief and fixed time budget used for our Creator Mode. Measure first-playable time, number of user decisions, edit reliability, ownership/export, debugging escape hatches, iteration quality and publishing path.

---

# 2. Engine-agent bridges / MCP

## `tomyud1/godot-mcp`

**Evidence:** SOURCE-VERIFIED  
**Disposition:** INCUMBENT Godot bridge candidate; BENCHMARK NOW

Repository snapshot checked 2026-08-20:
- https://github.com/tomyud1/godot-mcp
- MIT;
- 409 stars / 45 forks at check time;
- Godot 4.x plugin + MCP server;
- README advertises 42 tools across file, scene, script, project, asset and visualisation categories.

Documented capabilities include scene/node mutation, script editing/validation, run/stop, Output/Debugger inspection, project/input/collision configuration and a browser project/scene visualiser.

Documented limitations:
- local-only;
- one Godot connection at a time;
- no undo;
- not sufficient to autonomously create an entire game.

**Adapter test targets:** mutation correctness, live editor truth, compile/runtime error recovery, normal-input playtest, screenshot/visual evidence, undo/versioning workaround, concurrency and token cost.

## `n24q02m/better-godot-mcp`

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW as contrasting Godot architecture

Repository snapshot checked 2026-08-20:
- https://github.com/n24q02m/better-godot-mcp
- Apache-2.0;
- 34 stars / 7 forks at check time;
- actively pushed on 2026-08-19;
- TypeScript, npm + Docker distribution;
- 17 composite tools.

Interesting architectural difference: many scene/resource operations work by parsing/writing `.tscn` and project files directly **without Godot running**; Godot is only required for runtime/editor/export actions. Tools cover project, scenes, nodes, scripts, resources, input, signals, animation, tilemap, shader, physics, audio, navigation and UI.

**Potential advantage:** token-efficient composite tools and editor-independent structural edits.

**Risk:** direct text manipulation of Godot resources is not the same trust boundary as using the editor/internal APIs. We must test round-trip correctness, version compatibility, import side-effects and whether structural success diverges from runtime truth.

## Official Unity MCP

**Evidence:** SOURCE-VERIFIED  
**Disposition:** INCUMBENT Unity bridge; BENCHMARK BEFORE OSS UNITY MCP

Use Unity's official MCP as the first Unity baseline. Open-source alternatives should only displace it on evidence (capability, openness, latency, safety or licensing), not because they are easier to install.

## `emeryporter/UnityMCP`

**Evidence:** SOURCE-VERIFIED repository metadata; capability description not independently executed  
**Disposition:** WATCH / benchmark only if official Unity MCP is insufficient

Repository snapshot 2026-08-20:
- https://github.com/emeryporter/UnityMCP
- GPL-3.0;
- 9 stars / 3 forks at check time;
- description advertises 40+ tools for scene/object/test automation.

**Caution:** GPL-3.0 is materially different from MIT/Apache for embedding/forking decisions. Treat as an external tool candidate unless legal/licence analysis explicitly supports deeper integration.

---

# 3. Multi-agent game generation / research

## UniGen

**Evidence:** PAPER-CLAIM  
**Disposition:** BENCHMARK / REPRODUCE selected claims

Sources:
- https://arxiv.org/abs/2509.26161
- https://github.com/yxwan123/UniGen

Paper describes a Planning → Generation → Automation → Debugging multi-agent workflow for natural-language-to-runnable 3D prototypes and reports a 91.4% development-time reduction across three prototypes.

**Research value:** useful topology/automation baseline.

**Rule:** none of the performance claims enter our standard as fact until we reproduce an equivalent experiment.

---

# 4. Agent/workflow infrastructure

These are not game engines, but they can remove substantial custom orchestration work.

## Trigger.dev

**Evidence:** SOURCE-VERIFIED in earlier pipeline research  
**Disposition:** BENCHMARK durable workflow substrate

Relevant solved capabilities: durable long-running tasks, retries, queues/concurrency, human-in-the-loop waits, realtime updates and execution environments suitable for browser/media work.

## Inngest

**Evidence:** SOURCE-VERIFIED in earlier pipeline research  
**Disposition:** BENCHMARK durable workflow substrate

Relevant solved capabilities: durable step execution, event waits, recovery, multi-agent coordination and evaluation-oriented workflows.

## Temporal

**Evidence:** SOURCE-VERIFIED in earlier pipeline research  
**Disposition:** REFERENCE baseline; adopt only if complexity is justified

Temporal remains the heavyweight durability/reference architecture. It should prevent us reinventing durable execution semantics, but is not automatically the right operational cost/complexity for Creator Mode.

**Rule:** do not build a bespoke durable workflow engine unless these systems fail a measured requirement.

---

# 5. Standards / interoperability incumbents

## MCP

**Evidence:** SOURCE-VERIFIED  
**Disposition:** INCUMBENT tool interoperability protocol

Current standard direction: MCP 2026-07-28 stateless core plus extensions/Tasks/MCP Apps. Our tool/plugin architecture should compose with MCP rather than inventing a proprietary equivalent where MCP fits.

## AGENTS.md + provider adapters

**Evidence:** SOURCE-VERIFIED  
**Disposition:** INCUMBENT repository-agent guidance pattern

Canonical project instructions should live in portable repository state, with thin adapters for Codex/GitHub/Claude/etc., not divergent model-specific brains.

## C2PA

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK for media provenance compatibility

Use C2PA/Content Credentials as the external provenance reference for generated/edited media. Our broader asset ledger still needs game-specific licence/source/transformation/build relationships that C2PA does not replace.

## WCAG 2.2

**Evidence:** SOURCE-VERIFIED  
**Disposition:** Creator/Game Development OS web accessibility baseline

Creator Mode's web UI should target WCAG 2.2 AA where applicable; generated games additionally need game/platform-specific accessibility evaluation.

---

# 6. What is now table stakes

The standard MUST NOT claim novelty merely because it has:

- natural-language generation;
- project-aware AI chat;
- scene/object mutation;
- an MCP server;
- AI-generated assets;
- screenshot/viewport reasoning;
- automated playtest;
- no-code authoring;
- version/undo basics;
- one-click preview/publish.

All exist in meaningful current systems.

Our combined differentiator must be tested around:

1. **engine/provider portability**;
2. **same-project beginner → professional continuity**;
3. **independent, revision-bound evidence**;
4. **full code/dependency/asset provenance and ownership**;
5. **solved-system-first cross-engine orchestration**;
6. **complete commercial lifecycle** from idea through retirement;
7. **open conformance tests and public benchmarks**;
8. **human-operable control plane** where visible truth derives from canonical state;
9. **ability to replace providers without losing the project**.

---

# 7. Standard benchmark queue

Priority order should change when evidence changes.

| Priority | System | Experiment | Why now |
|---|---|---|---|
| P0 | GDevelop | fixed novice Creator Journey | strongest solved beginner→shipping baseline |
| P0 | Roblox Assistant + MCP | create/edit/visual-playtest/branch/publish | unusually integrated creator UX |
| P0 | Unity Assistant + official MCP | editor mutation/undo/external-agent/playtest | official professional-engine AI baseline |
| P0 | Godot MCP pair | same adapter conformance suite against `tomyud1` and `better-godot-mcp` | tests live-editor vs file-first bridge tradeoff |
| P0 | Rosebud | same brief/time-box first-playable journey | direct prompt→playable UX comparison |
| P1 | UniGen | reproduce one bounded prototype | tests academic multi-agent topology claims |
| P1 | Trigger.dev vs Inngest | same coordination work unit / human gate / recovery | avoid custom workflow-engine build |
| P1 | C2PA | attach/retain provenance through one generated asset pipeline | tests external-standard compatibility |

---

# 8. Missing categories to research next

Do not fill these with the first search result. Each category needs at least one strong commercial incumbent and one strong open-source option where available.

- 2D generation / sprite consistency / animation;
- 3D generation, retopology, rigging and animation;
- audio/music/voice generation and editing;
- procedural/world generation;
- automated game-play agents and visual QA;
- multiplayer/backend/state sync;
- analytics/crash/live-ops;
- store publishing/build/signing automation;
- localisation;
- age/privacy/safety/compliance;
- game-design evaluation and human-playtest research.

## Registry maintenance rule

Every material entry should eventually carry:

```text
name
category
canonical_url
source_type
license
version_or_revision
last_verified_at
activity_signal
capabilities
limitations
execution_status
benchmark_id
adoption_status
replacement_cost
lock_in_risk
notes
```

The public `games.byjtt.com/registry/` can later project a reviewed subset of this data. The internal registry remains stricter and may include rejected systems, implementation risks and unflattering benchmark results.
