# Agent Operating Contract

This repository is an evidence-driven AI game-development laboratory and production system. Agents must optimise for the best end-to-end production outcome, not loyalty to a previously selected engine, framework, model, vendor, implementation, or workflow.

## Mandatory solved-system gate

Before substantial custom implementation, evaluate in order:

1. Can the requirement be removed or simplified?
2. Does the selected engine/runtime already solve it well?
3. Is there a mature, maintained, permissively licensed open-source implementation?
4. Is there a proven commercial/free solution whose lifecycle cost is lower?
5. Does this repository already contain a promoted solution?
6. Can an AI generator produce a production-ready result that passes the same validation gate?
7. Only then implement bespoke code.

Record why the selected option wins when the decision materially affects the experiment or product.

## Research before framework-specific changes

For fast-moving engines, SDKs, libraries, stores, deployment systems, AI tooling, model APIs, monetisation platforms, and platform requirements, verify current official documentation before relying on remembered APIs or constraints.

## Multi-agent/session operating model

Follow [`docs/MULTI-AGENT-OPERATING-MODEL.md`](docs/MULTI-AGENT-OPERATING-MODEL.md).

GitHub issues/PRs/commits are canonical project state; chat history is not. Before substantial work, reload live `main`, the authoritative issue, and open PR changed paths; then claim a bounded workstream with objective, branch/base, owned/avoided paths, dependencies, execution environment, and evidence plan.

Do not run unstacked concurrent work that meaningfully owns the same paths or outcome. Avoid, stack, sequence, or explicitly coordinate shared ownership first.

Once objective, ownership, dependencies, environment, and evidence are known, transition to execution. Do not keep expanding planning unless execution exposes a new blocker.

Route runtime-dependent work to an environment capable of executing and observing it. Text/code inspection alone cannot prove gameplay, rendering, engine, browser, device, performance, or release behaviour.

Every session must leave GitHub-visible handoff state sufficient for a fresh agent to resume without reading old chats.

## Evidence loop

The default development loop is:

`research -> retrieve -> compose -> implement -> execute -> observe -> measure -> critique -> repair -> verify -> compare -> promote or reject`

Code inspection alone is never proof that a gameplay feature works.

## Full lifecycle

The lab does not stop at a playable prototype. Use [`docs/PIPELINE.md`](docs/PIPELINE.md) for the complete lifecycle:

`opportunity -> prototype -> gameplay iteration -> vertical slice -> graduation -> production -> soft launch -> public release -> operate/iterate -> LiveOps -> maintenance -> retirement`

A game is never considered complete merely because it has been published. Published games remain owned software with telemetry, support, update, migration, release, rollback, and maintenance obligations.

## Pipeline Governor

[`agents/PIPELINE-GOVERNOR.md`](agents/PIPELINE-GOVERNOR.md) is the permanent adversarial review role for the factory. Invoke a Governor review at major stage gates and whenever current evidence suggests the pipeline, incumbent technology, economics, or operating model may be suboptimal.

The Governor is expected to challenge prior decisions and identify missing capabilities, unnecessary human bottlenecks, lifecycle risks, monetisation/distribution gaps, and stronger solved systems.

## Pipeline telemetry

AI speed claims must be measured rather than asserted. Significant pipeline runs should use the versioned telemetry contract in [`schemas/pipeline-run.schema.json`](schemas/pipeline-run.schema.json) so experiments can compare agent/tool cost, interventions, reuse, failures, iteration count, execution evidence, quality, outcomes, and where useful coordination overhead over time.

## Experiment integrity

- Use the shared specification and source assets for comparative benchmarks.
- Pin versions/commits where reproducibility requires it.
- Do not quietly weaken acceptance criteria for one candidate.
- Record failed attempts and incompatibilities.
- Keep benchmark-specific adapters separate from shared game rules where practical.
- Every result must link to fresh execution evidence.

## Assets

Prefer vetted existing assets before generation. Every third-party or generated asset must have provenance, licence/usage status, and validation results. Game-ready 3D assets must pass scale, orientation, topology/geometry, material, skeleton, animation, collision, memory/performance, and visual checks appropriate to the target.

## Games and graduation

Promising prototypes may graduate into standalone production repositories. Do not distort benchmark methodology merely to favour a game candidate.

Use [`schemas/game-graduation.schema.json`](schemas/game-graduation.schema.json) to record `graduate`, `continue-research`, `hold`, or `kill` decisions. A graduation decision must consider player value, technical viability, differentiation, production cost, monetisation/distribution hypotheses, operational burden, maintainability, risks, and opportunity cost.

Production telemetry can later feed aggregate lessons back into this lab.

## Monetisation and LiveOps

Follow [`docs/MONETIZATION-AND-LIVEOPS.md`](docs/MONETIZATION-AND-LIVEOPS.md). Monetisation is subordinate to player value and must be evaluated for lifecycle cost, trust, retention, support burden, platform constraints, and sustainable unit economics.

LiveOps must earn its complexity. Prefer data-driven, versioned, validated, rollback-capable content systems to recurring bespoke code changes.

## Irreversible actions

Keep explicit human approval for meaningful spend commitments, irreversible public releases or shutdowns, destructive migrations without proven rollback, unresolved legal/licensing ambiguity, high-impact monetisation changes, and publication of commercially sensitive advantages.

Automate low-risk/reversible research, implementation, validation, evidence capture, reporting, and maintenance work aggressively.

## Publication

Experiments should be structured so their methodology, evidence, failures, and conclusions can become first-party research on games.byjtt.com without inventing results or publishing commercially sensitive information by default.

Publication is an output of the production system, not a substitute for building and operating good games.
