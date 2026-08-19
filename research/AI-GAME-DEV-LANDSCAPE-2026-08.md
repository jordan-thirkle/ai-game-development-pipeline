# AI Game Development Landscape — 2026-08

Status: **living research registry narrative**  
Canonical standard: `../docs/AI-GAME-DEVELOPMENT-STANDARD.md` when that normative draft lands; until then, GitHub issue `#75` is authoritative.  
Materialized records: `../registry/ai-game-dev-systems.v1.json`  
Last substantive review: **2026-08-20** (Europe/London project date)

## Purpose

This registry makes the pipeline's **best solved system first** rule executable.

Before building a game-development subsystem, editor bridge, creator workflow, asset pipeline, agent runtime, testing layer, publishing path or live-ops capability, workers MUST search this registry and current primary sources. Existing systems should be adopted, wrapped, forked or benchmarked before bespoke implementation is accepted.

This Markdown file is the human-readable research view. Stable IDs, revisions, benchmark joins and adoption states for materialized entries live in `registry/ai-game-dev-systems.v1.json`. Any entry used by an experiment must additionally satisfy `registry/PROVENANCE.md`.

## Evidence labels

- **EXECUTED** — ByJTT has independently run the relevant capability.
- **SOURCE-VERIFIED** — identified official docs/source/repository inspected, but ByJTT has not executed the capability yet.
- **VENDOR-CLAIM** — vendor documentation/marketing claim requiring independent execution.
- **PAPER-CLAIM** — research result not yet reproduced by ByJTT.
- **UNKNOWN** — insufficient reproducible evidence in the registry.

A vendor/source/paper claim MUST NOT silently become EXECUTED evidence.

## Dispositions

- **BENCHMARK NOW** → `adoption_status=benchmark`
- **INCUMBENT** → `adoption_status=incumbent`
- **ADAPTER CANDIDATE** → `adoption_status=adapter_candidate`
- **WATCH** → `adoption_status=watch`
- **REFERENCE** → `adoption_status=reference`
- **REJECT FOR NOW** → `adoption_status=rejected`

Combinations such as `INCUMBENT + BENCHMARK NOW` are represented as combined adoption states in the materialized registry.

---

# 1. Full creator / engine systems

## Unity AI + official MCP

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW / engine-adapter baseline

Primary sources checked 2026-08-20:
- https://unity.com/blog/unity-ai-how-to-get-started
- https://unity.com/features/ai
- https://unity.com/news/unity-7-roadmap-revealed-at-unite-seoul

Documented baseline includes project-aware in-editor AI, editor/project context, external-agent integration, mutation/undo controls and the broader Unity development lifecycle. These are source-documented capabilities, not ByJTT execution results.

**Required benchmark:** same bounded game edit via Unity's current first-party AI path and an external agent over its supported integration surface; measure context accuracy, mutation safety/undo, playtest execution, screenshots/evidence, token/tool friction and exportability.

## Roblox Studio + Assistant + official MCP

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW / creator-experience baseline

Primary sources checked 2026-08-20:
- https://create.roblox.com/docs/assistant/guide
- https://create.roblox.com/docs/studio/mcp
- https://create.roblox.com/docs/ai/accelerated-workflows
- https://create.roblox.com/docs/studio

The sources document Assistant/Studio capabilities spanning project manipulation, asset workflows, visual context, playtest interaction and publishing. Strong Roblox-platform coupling makes this primarily a creator-UX/capability benchmark for our ownership model.

**Required benchmark:** fixed novice brief → first playable → natural-language edit → visual correction → normal-input playtest → branch/revert → publish-preview path.

## GDevelop

**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW / incumbent beginner→shipping benchmark

Primary sources checked 2026-08-20:
- https://gdevelop.io/en-gb/features
- https://gdevelop.io/en-gb/game-makers
- https://gdevelop.io/en-gb/pricing

The sources document no-code authoring with code escape hatches, 2D/3D workflows, preview/debugging, extensions/assets, online/player features, analytics/monetisation integrations and publishing paths. Treat exact availability/plan limits as date-sensitive vendor facts to re-check at experiment time.

**Required benchmark:** novice journey from fixed brief → first playable → iteration → save/reopen → multiplayer/backend requirement → analytics/monetisation setup → export.

## Rosebud

**Evidence:** VENDOR-CLAIM  
**Disposition:** BENCHMARK NOW / time-to-first-playable baseline

Vendor sources checked 2026-08-20:
- https://lab.rosebud.ai/blog/create-3d-game-with-ai
- https://lab.rosebud.ai/blog/rosebud-ai-interface-guide
- https://lab.rosebud.ai/blog/how-to-create-a-video-game

Vendor-positioned strengths include browser-first natural-language creation, rapid playable scenes, chat iteration/generated assets and a low-setup play/publish loop. These remain vendor claims until independently executed.

---

# 2. Engine-agent bridges / MCP

## `tomyud1/godot-mcp`

**Entry ID:** `system.godot-mcp.tomyud1`  
**Evidence:** SOURCE-VERIFIED  
**Disposition:** INCUMBENT + BENCHMARK NOW

Pinned repository state verified 2026-08-20:
- repository: https://github.com/tomyud1/godot-mcp
- revision: `0d3f473922ea270c38df5c17cf061aa9da8470a2`
- licence: MIT
- pinned commit/release notes identify v0.5.0.

The repository documents a Godot 4.x plugin/MCP bridge with file, scene, script, project, asset/runtime-oriented operations. Limitations and exact tool counts must be read from the pinned revision rather than assumed from later `main`.

**Adapter test targets:** mutation correctness, live-editor truth, compile/runtime recovery, normal-input playtest, visual evidence, undo/versioning workaround, concurrency and token cost.

## `n24q02m/better-godot-mcp`

**Entry ID:** `system.godot-mcp.better`  
**Evidence:** SOURCE-VERIFIED  
**Disposition:** BENCHMARK NOW

Pinned repository state verified 2026-08-20:
- repository: https://github.com/n24q02m/better-godot-mcp
- revision: `85d7de392d2a59e32a82b41b643b3c389f5d1133`
- licence: Apache-2.0
- pinned commit dated 2026-08-19.

The project provides a contrasting file-first/composite-tool architecture. The key experiment is whether structural edits that succeed at the file layer remain correct after Godot import/runtime execution.

## Official Unity MCP / supported first-party external-agent surface

**Evidence:** SOURCE-VERIFIED from the Unity sources above  
**Disposition:** INCUMBENT first-party Unity baseline

Use the current first-party Unity integration as the first Unity baseline. Open-source alternatives should displace it only on measured capability, openness, latency, safety, cost or licensing.

## `emeryporter/UnityMCP`

**Entry ID:** `system.unity.mcp.emeryporter`  
**Evidence:** SOURCE-VERIFIED repository metadata  
**Disposition:** WATCH

Pinned repository state verified 2026-08-20:
- repository: https://github.com/emeryporter/UnityMCP
- revision: `846caa5b15fe9758c4ed0caa60022b80c1c81229`
- release: 2.2.4
- licence: GPL-3.0.

GPL-3.0 is materially different from MIT/Apache for embedding/forking decisions. Treat as an external-tool candidate unless licence/dependency analysis explicitly supports deeper integration.

---

# 3. Multi-agent game generation / research

## UniGen

**Evidence:** PAPER-CLAIM  
**Disposition:** BENCHMARK / reproduce selected claims

Sources checked 2026-08-20:
- https://arxiv.org/abs/2509.26161
- https://github.com/yxwan123/UniGen

The paper describes a Planning → Generation → Automation → Debugging multi-agent workflow and reports large development-time reductions on its evaluated prototypes. None of those performance claims become ByJTT facts until reproduced.

---

# 4. Agent/workflow infrastructure

These systems remain important solved-system candidates, but this PR does not yet carry immutable/versioned source records for them. To preserve research integrity they are **not SOURCE-VERIFIED entries in the materialized registry yet**.

## Trigger.dev

**Evidence:** UNKNOWN for this registry revision  
**Disposition:** WATCH pending pinned-source record

Candidate durable-workflow substrate. Before benchmark/adoption, add canonical docs/source revision, version/date, licence/deployment model and a bounded recovery/human-gate experiment.

## Inngest

**Evidence:** UNKNOWN for this registry revision  
**Disposition:** WATCH pending pinned-source record

Candidate durable step/event orchestration substrate. Materialize evidence before relying on earlier chat/research claims.

## Temporal

**Evidence:** UNKNOWN for this registry revision  
**Disposition:** REFERENCE pending pinned-source record

Reference candidate for durable execution semantics. Do not adopt solely from reputation; pin the exact SDK/server/docs state used by an experiment.

**Rule:** do not build a bespoke durable workflow engine until these and other current incumbents have failed measured requirements.

---

# 5. Standards / interoperability candidates

The following remain design references, but only MCP currently has a version identifier recorded in this narrative. They must receive materialized source/version records before an experiment claims conformance.

## MCP

**Evidence:** SOURCE-VERIFIED at specification level  
**Disposition:** INCUMBENT interoperability protocol candidate

Canonical source: https://modelcontextprotocol.io/specification/2026-07-28  
Specification revision: `2026-07-28`  
Verified: 2026-08-20.

Our tool/plugin architecture should compose with MCP where it fits rather than inventing a proprietary equivalent by default.

## AGENTS.md + provider adapters

**Evidence:** UNKNOWN for this registry revision  
**Disposition:** REFERENCE

The architectural principle remains: canonical project instructions should live in portable repository state with thin provider adapters. Before treating AGENTS.md itself as an external standard, materialize its canonical source/version record.

## C2PA

**Evidence:** UNKNOWN for this registry revision  
**Disposition:** WATCH / provenance reference candidate

C2PA/Content Credentials is a relevant external provenance reference, but exact spec/version/source metadata must be pinned before a conformance claim. It does not replace a game-specific asset ledger for licence/source/transformation/build relationships.

## WCAG 2.2

**Evidence:** UNKNOWN for this registry revision  
**Disposition:** REFERENCE / accessibility baseline candidate

WCAG 2.2 AA remains the intended web accessibility target, but the exact W3C Recommendation source/version must be materialized before this registry calls the entry SOURCE-VERIFIED.

---

# 6. Capabilities that cannot support novelty claims by themselves

The listed Unity, Roblox, GDevelop, Rosebud and bridge sources **document current systems offering meaningful subsets of** the following capabilities; this is not an assertion that every capability is universal or independently executed by ByJTT:

- natural-language generation;
- project-aware AI chat;
- scene/object mutation;
- MCP/external-agent integration;
- AI-generated assets;
- screenshot/viewport reasoning;
- automated playtest;
- no-code authoring;
- version/undo basics;
- low-friction preview/publish.

Therefore the standard MUST NOT claim novelty merely because it implements one of these features. Differentiation must be tested around the combined system:

1. engine/provider portability;
2. same-project beginner → professional continuity;
3. independent, revision-bound evidence;
4. code/dependency/asset provenance and ownership;
5. solved-system-first cross-engine orchestration;
6. complete commercial lifecycle;
7. open conformance tests and external/public benchmarks;
8. human-operable control plane derived from canonical state;
9. provider replacement without losing the project.

---

# 7. Standard benchmark queue

Stable benchmark IDs are materialized in `registry/ai-game-dev-systems.v1.json`.

| Priority | Benchmark ID / system | Experiment | Why now |
|---|---|---|---|
| P0 | `bench.byjtt.creator-journey` / GDevelop | fixed novice Creator Journey | beginner→shipping baseline |
| P0 | `bench.roblox.open-game-eval` + Creator Journey | create/edit/visual-playtest/branch/publish | integrated creator UX + external eval |
| P0 | `bench.byjtt.engine-adapter` / Unity first-party | editor mutation/undo/external-agent/playtest | professional-engine AI baseline |
| P0 | `bench.byjtt.engine-adapter` / Godot MCP pair | same adapter conformance suite | live-editor vs file-first bridge tradeoff |
| P0 | `bench.byjtt.creator-journey` / Rosebud | same brief/time-box first-playable journey | prompt→playable UX comparison |
| P0 | `bench.gamedevbench` | stratified then full external suite | independent builder-agent capability |
| P1 | UniGen | reproduce one bounded prototype | academic multi-agent topology claims |
| P1 | durable workflow candidates | same work unit / human gate / recovery | avoid custom workflow-engine build |
| P1 | provenance standards | generated-asset provenance round-trip | external-standard compatibility |

---

# 8. Missing categories to research next

Each category needs at least one strong commercial incumbent and one strong open/open-source option where available, with licences and immutable evidence recorded before adoption:

- 2D generation / sprite consistency / animation;
- 3D generation, retopology, rigging and animation;
- audio/music/voice generation and editing;
- procedural/world generation;
- automated gameplay agents and visual QA;
- multiplayer/backend/state sync;
- analytics/crash/live-ops;
- store publishing/build/signing automation;
- localisation;
- age/privacy/safety/compliance;
- game-design evaluation and human-playtest research.

## Registry maintenance rule

Materialized entries use stable IDs and the following fields in `registry/ai-game-dev-systems.v1.json`:

```text
entry_id
name
category
canonical_url
source_type
license
version_or_revision
last_verified_at
activity_signal
execution_status
benchmark_id
adoption_status
replacement_cost
lock_in_risk
redistribution_status
notes
```

The public `games.byjtt.com/registry/` can later project a reviewed subset. The internal registry remains stricter and may include rejected systems, implementation risks and negative benchmark results.
