# Human Control Plane

## Purpose

The AI Game Development Pipeline must be operable by a human, not merely executable by agents. The control plane is the visual, inspectable surface over the same canonical pipeline state used by automation.

It exists to answer, at a glance:

- What game or experiment are we building?
- Which lifecycle stage is it in?
- What is blocked, and why?
- Which agents/tools are active?
- What evidence proves the current state?
- What decisions were made and what alternatives were rejected?
- Can a human launch and play the latest build now?
- Which gates require explicit human judgement?
- What does publishing cost and expose?
- What happened after release?

The control plane is not allowed to become dashboard theatre. Its primary job is to expose the real work and make the most important human interactions fast and auditable.

## Product shape

Build the UI **web-first and local-first**. A desktop/macOS distribution may wrap the same application later; do not fork the product into a separate native implementation unless evidence shows a native-only requirement.

The long-term product is effectively a Game Development OS:

1. **Portfolio** — games, experiments, lifecycle stage, health, latest build, commercial status.
2. **Pipeline Graph** — stage/dependency graph from opportunity through retirement.
3. **Project Workspace** — goal, constraints, current stage, active work, blockers, latest evidence.
4. **Playable Build Lab** — launch latest build, choose viewport/device/input profile, record verdicts.
5. **Human Gates** — approve, reject, request changes, attach notes/evidence.
6. **Agent Room** — role, objective, status, inputs, tool calls, outputs, evidence and handoff.
7. **Decision Ledger** — material technical/product decisions with considered alternatives and evidence.
8. **Solved-System Registry** — engines, runtimes, libraries, MCP servers, plugins, skills, asset sources and services with lifecycle suitability.
9. **Asset Studio** — provenance, licence, format, optimisation, runtime readiness and previews.
10. **Quality Gauntlet** — automated checks, screenshots, visual regression, performance, accessibility, device tests, critic findings.
11. **Release Centre** — build, signing, store/web metadata, privacy/licensing checks, rollout, rollback and release evidence.
12. **Live Operations** — crashes, reviews, retention, revenue, experiments, maintenance and retirement work.
13. **Run Replay** — reconstruct a pipeline run and explain why each consequential transition happened.

## Canonical-state rule

The UI must never create a second source of truth.

- Machine-readable pipeline/project/evidence records are canonical.
- The UI reads and writes those records through a stable domain layer.
- Agents use the same records.
- CLI/MCP/API clients use the same records.
- Provider-specific configuration is an adapter, not canonical project state.

This prevents the common failure mode where the dashboard says one thing while the repository, agent and release system each believe something else.

## Minimum viable control-plane slice

The first slice must be deliberately small and genuinely useful.

A human must be able to:

1. Open a known project/benchmark.
2. See the lifecycle stage and pipeline-stage status.
3. Inspect at least one evidence item and one material decision.
4. See active/queued agent roles.
5. Launch or follow the latest playable-build target.
6. Record `approve`, `needs-work`, or `reject` at a human gate with notes.
7. Persist that verdict in machine-readable state.
8. See the next eligible stage change as a consequence.

Anything beyond that is secondary until this loop works end to end.

## Core domain concepts

### Project

A game, experiment, benchmark, or reusable pipeline initiative.

### Stage

A meaningful lifecycle/pipeline state with entry criteria, work, exit criteria and evidence requirements.

### Gate

A rule that determines whether advancement is allowed. A gate can be automated, human, or mixed.

### Evidence

Fresh proof: test output, screenshot, recording, benchmark result, device run, signed build, provenance record, analytics snapshot, etc.

### Decision

A consequential choice with considered alternatives, selection rationale, evidence and review date.

### Agent run

One bounded execution by a specialist role, with objective, inputs, tools, outputs, evidence and status.

### Build

A runnable artifact with source revision, target, environment, verification and launch location.

## Human-gate policy

Keep explicit human approval for:

- gameplay-feel acceptance where subjective player experience matters;
- graduation from experiment to production game;
- meaningful spend commitments;
- public release or shutdown;
- unresolved licensing/legal ambiguity;
- destructive migration without proven rollback;
- high-impact monetisation changes;
- publication of commercially sensitive findings.

Do not require human approval for low-risk reversible research, testing, evidence collection and routine maintenance when automation can prove the outcome.

## Agent/configuration architecture

The repository-wide `AGENTS.md` remains the canonical high-level operating contract.

Use the following separation:

- `AGENTS.md` — repository-wide agent contract and non-negotiable rules.
- scoped `AGENTS.md` files — only where a subtree genuinely needs stricter/local instructions.
- `agents/` — durable role definitions such as Pipeline Governor, QA Critic, Asset Pipeline Specialist or Release Engineer.
- `skills/` — reusable procedural capabilities with clear triggers, inputs, outputs and verification.
- `schemas/` — canonical machine-readable contracts.
- `registry/` — solved-system knowledge and adoption status.
- MCP — external tools/services and, where valuable, interactive MCP Apps.
- provider adapters — thin compatibility layers for Codex, Claude Code or other agents; they must point back to the canonical contracts rather than diverge.

Avoid maintaining several giant competing instruction files such as independent `AGENT.md`, `agents.md`, `CLAUDE.md` and tool-specific prompts containing the same rules. Where a provider requires a filename, keep it short and route to the canonical repository contract.

## MCP direction

Target the current MCP architecture rather than older session-bound assumptions. MCP `2026-07-28` has a stateless core and formal extensions, including Tasks and MCP Apps.

For this pipeline, MCP is most valuable for:

- repository/source control;
- engine/editor automation;
- build systems;
- browser/device test harnesses;
- asset generation and validation;
- design tools;
- analytics/crash tooling;
- deployment/store integrations;
- issue/project management;
- observability;
- interactive tool-specific UI via MCP Apps where it removes duplicate control-plane work.

Every MCP integration must still pass the solved-system, security, permission, provenance, cost and maintenance gates.

## Game-specific architectural requirements inherited from Game Studio

The control plane should surface — not blur — the boundaries that make games testable:

- simulation/game state separated from rendering where applicable;
- explicit input mapping;
- asset loading treated as a first-class system;
- serialisable save/debug/performance boundaries;
- DOM/application UI separated from canvas/WebGL playfield by default;
- stable 3D asset conventions and GLB/glTF shipping policy where relevant;
- screenshot evidence for canvas/WebGL QA;
- real playtesting before production-ready claims.

## Quality model

A green status requires evidence, not agent confidence.

The UI should distinguish:

- **unknown** — not evaluated;
- **running** — work/test in progress;
- **pass** — current evidence satisfies gate;
- **warn** — acceptable with recorded caveat;
- **fail** — known failure;
- **blocked** — cannot proceed because prerequisite is unresolved;
- **human-required** — automation cannot make the final judgement;
- **stale** — prior evidence exists but is too old or invalidated by change.

## Dogfooding requirement

Every real game developed by By JTT should be operable through the control plane as early as practical.

When a real game exposes a missing control-plane capability, record the gap and decide whether it is reusable enough to promote into the pipeline. This is how the system improves through production use rather than speculative platform building.

## Initial implementation order

1. Define canonical control-plane state schema.
2. Create a deterministic sample state for `BYJTT-LAB-001`.
3. Build a zero/low-dependency read-only visual prototype against that state.
4. Add human-gate mutation through the domain layer.
5. Connect real benchmark/build evidence.
6. Add playable-build launch flow.
7. Add agent-run feed.
8. Add decision/solved-system views.
9. Only then expand toward releases, analytics and desktop packaging.

## Success criterion

The first milestone is complete when a human can open the studio, understand the state of `BYJTT-LAB-001` without reading repository internals, launch the relevant playable output, inspect why the pipeline chose its current path, and record a human verdict that changes the next eligible action.
