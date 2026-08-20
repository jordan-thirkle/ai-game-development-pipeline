# AI Game Development Landscape — 2026-08

Status: **living research narrative backed by structured registry data**  
Canonical standard: `../docs/AI-GAME-DEVELOPMENT-STANDARD.md` when the normative draft lands; until then issue `#75` is authoritative.  
Materialized records: `../registry/ai-game-dev-systems.v1.json`  
Last substantive review: **2026-08-20T01:48:00+01:00** (`Europe/London` project time)

## Purpose

This research makes the pipeline's **best solved system first** rule executable.

Before building a game-development subsystem, workers MUST consult the structured registry and current primary sources. Existing systems should be adopted, wrapped, forked or benchmarked before bespoke implementation is accepted.

This Markdown file is the interpretation layer. Stable IDs, source revisions, licences, benchmark joins, adoption states and blocking conditions live in `registry/ai-game-dev-systems.v1.json`. Any system or asset used by an experiment must additionally satisfy `registry/PROVENANCE.md`.

## Evidence labels

- **EXECUTED** — ByJTT independently ran the relevant capability.
- **SOURCE-VERIFIED** — identified official source/docs/repository inspected, but not executed by ByJTT.
- **VENDOR-CLAIM** — vendor claim requiring independent execution.
- **PAPER-CLAIM** — research result not reproduced by ByJTT.
- **UNKNOWN** — insufficient reproducible evidence.

A claim MUST NOT silently graduate between evidence classes.

## Adoption states

- `benchmark` — execute a bounded comparison now.
- `incumbent` — strongest current solved-system baseline until displaced by evidence.
- `adapter_candidate` — useful behind a provider-neutral interface.
- `watch` — promising but lower current leverage.
- `reference` — architectural/reference baseline.
- `rejected` — known mismatch; retain the reason to prevent repeated investigation.

---

# 1. Full creator / engine systems

## Unity AI + first-party external-agent integration

**Entry ID:** `system.unity.ai-first-party`  
**Evidence:** SOURCE-VERIFIED  
**Adoption:** benchmark

Current official Unity sources document project/editor-aware AI and external-agent integration alongside a mature professional engine lifecycle. These are source-documented capabilities, not ByJTT execution results.

**Required benchmark:** same bounded game edit through the current first-party Unity AI path and an external agent; measure context accuracy, mutation safety/undo, execution/playtest evidence, tool friction, exportability and project ownership.

## Roblox Studio + Assistant + MCP

**Entry ID:** `system.roblox.studio-assistant`  
**Evidence:** SOURCE-VERIFIED  
**Adoption:** benchmark

Roblox is a strong vertically integrated creator/test/publish UX baseline. Its platform coupling makes it a capability/creator-experience benchmark, not our portability/ownership model.

**Required benchmark:** fixed novice brief → first playable → language-driven edit → visual correction → normal-input playtest → branch/revert → publish-preview.

## GDevelop

**Entry ID:** `system.gdevelop`  
**Evidence:** SOURCE-VERIFIED  
**Adoption:** incumbent + benchmark

GDevelop is our current beginner→shipping reference because it combines approachable authoring, code escape hatches and real publishing/product features.

**Required benchmark:** novice fixed brief → first playable → iteration → save/reopen → online/backend need → analytics/monetisation configuration → export. Record every point where professional concepts become unavoidable.

## Rosebud

**Entry ID:** `system.rosebud`  
**Evidence:** VENDOR-CLAIM  
**Adoption:** benchmark

Rosebud is a time-to-first-playable benchmark. Ownership/export/debug/publishing claims remain untrusted until executed.

---

# 2. Engine-agent bridges

## Godot bridge pair

- `system.godot-mcp.tomyud1` — live-editor-oriented incumbent candidate.
- `system.godot-mcp.better` — contrasting file-first/composite-tool architecture.

Both have immutable repository revisions in the structured registry.

**Why compare both:** structural edits that look correct in files are not automatically equivalent to editor/runtime truth. The benchmark must test round-trip correctness, runtime behavior, error recovery, visual evidence, normal-input interaction, concurrency and token/tool cost.

## Unity MCP / agent alternatives

- `system.unity.ai-first-party` — first-party baseline.
- `system.unity.mcp.emeryporter` — GPL external-tool candidate.
- `system.unity.code-agent` — MIT-scoped Unity package with tests/screenshots/closed-loop play patterns; dependencies/assets remain separate licence records.

Open-source alternatives displace first-party integration only on measured capability, openness, latency, safety, cost or licensing.

---

# 3. Multi-agent game generation research

## UniGen

**Entry ID:** `system.unigen`  
Pinned repository revision: `ce722cdc1fb80103a20c34783b80dccbed5c22f9`  
**Evidence:** PAPER-CLAIM  
**Adoption:** benchmark via `bench.byjtt.multi-agent-reproduction`

The paper describes Planning → Generation → Automation → Debugging and reports large development-time reductions. Those numbers remain paper-author evidence until reproduced.

The repository currently exposes no licence in GitHub metadata, so code reuse/redistribution is blocked even though studying/reproducing the architecture is useful.

---

# 4. External evaluation incumbents

## GameDevBench

**Entry ID:** `benchmark.gamedevbench`  
**Benchmark ID:** `bench.gamedevbench`

This is the incumbent external builder-agent benchmark. Its 333 Godot development tasks reduce our need to invent a self-serving proprietary “can this agent build games?” score.

BYJTT-LAB should retain the broader lifecycle/commercial benchmark while consuming GameDevBench as one independent capability axis.

## Roblox OpenGameEval

**Entry ID:** `benchmark.roblox.open-game-eval`  
**Benchmark ID:** `bench.roblox.open-game-eval`

Use/match platform-specific tasks where appropriate rather than rebuilding all Roblox evaluation from scratch.

## Vitric verification primitives

**Entry ID:** `system.vitric`  
**Benchmark ID:** `bench.vitric.verification`

Vitric is not assumed to be our production engine. Its deterministic replay, snapshot/restore, semantic state, reachability/soft-lock and swarm-verification concepts deserve direct study because they may strengthen engine-agnostic evidence.

---

# 5. Asset-production incumbents and legal gates

See `AI-GAME-ASSET-SYSTEMS-2026-08.md` and structured entries:

- `asset.comfyui` — workflow/orchestration baseline; GPL embedding requires separate review.
- `asset.trellis` — open 3D baseline; production use blocked until model/submodule licences are fully inventoried.
- `asset.hunyuan3d2` — rejected as the current UK default at the pinned licence revision due territorial restrictions.
- `asset.meshy` — commercial 3D baseline candidate; VENDOR-CLAIM until executed.
- `asset.scenario` — style-consistent/multimodal production candidate; VENDOR-CLAIM until executed.

The asset pipeline treats **creator intent as canonical and providers as replaceable**. Art approval and legal/licence approval are separate gates.

---

# 6. Workflow and standards candidates not yet materialized

Trigger.dev, Inngest, Temporal, AGENTS.md, C2PA and WCAG remain relevant research targets, but this registry revision intentionally does **not** call them SOURCE-VERIFIED unless the exact source/version record is materialized.

MCP is the exception because the current specification revision is known and should remain our default interoperability reference where it fits.

**Rule:** reputation or previous-chat memory is not evidence. A system becomes a registry input only when the current source/version/licence state is recorded.

---

# 7. Capabilities that cannot support novelty claims by themselves

Current source/vendor materials document meaningful systems with subsets of:

- natural-language generation;
- project-aware AI chat;
- scene/object mutation;
- MCP/external-agent integration;
- generated assets;
- screenshot/viewport reasoning;
- automated playtest;
- no-code authoring;
- version/undo basics;
- low-friction preview/publish.

This does **not** mean every capability is universal or independently proven by ByJTT. It means none should be marketed as our moat in isolation.

Our combined differentiation must instead survive testing around:

1. engine/provider portability;
2. same-project beginner → professional continuity;
3. independent revision-bound evidence;
4. code/dependency/asset provenance and ownership;
5. solved-system-first cross-engine orchestration;
6. complete commercial lifecycle;
7. open conformance tests and external/public benchmarks;
8. human-operable control plane derived from canonical state;
9. replacing providers without losing the project.

---

# 8. Benchmark queue

| Priority | Benchmark/system | Experiment |
|---|---|---|
| P0 | `bench.byjtt.creator-journey` / GDevelop | fixed novice Creator Journey |
| P0 | Roblox + `bench.roblox.open-game-eval` | create/edit/visual-playtest/branch/publish |
| P0 | `bench.byjtt.engine-adapter` / Unity | editor mutation/undo/external-agent/playtest |
| P0 | `bench.byjtt.engine-adapter` / Godot pair | same adapter conformance suite |
| P0 | `bench.byjtt.creator-journey` / Rosebud | same brief/time-box first-playable journey |
| P0 | `bench.gamedevbench` | stratified subset then full external suite |
| P1 | `bench.byjtt.multi-agent-reproduction` / UniGen | reproduce one bounded prototype |
| P1 | `bench.vitric.verification` | deterministic verification-primitives spike |
| P1 | `bench.byjtt.asset-production` | same accepted-asset brief across open/commercial providers |

---

# 9. Research gaps

Each category needs strong commercial and open candidates where available, with current source/licence evidence before adoption:

- deterministic 2D generation / sprite consistency / animation;
- rigging and animation systems;
- audio/music/voice generation and editing;
- procedural/world generation;
- gameplay agents and visual QA;
- multiplayer/backend/state sync;
- analytics/crash/live-ops;
- store publishing/build/signing automation;
- localisation;
- age/privacy/safety/compliance;
- game-design evaluation and human-playtest research.

The public `games.byjtt.com/registry/` should eventually project a reviewed subset. The internal registry stays stricter and may include rejected systems, legal blockers, negative experiments and commercial-sensitive implementation risks.
