# AI Game Development Pipeline

An evidence-driven laboratory and production system for discovering, benchmarking, building, shipping, monetising, operating, and continuously improving games with AI-assisted teams.

The objective is not to prove that one engine, framework, model, or workflow is always best. The objective is to build the strongest repeatable end-to-end game-production system and continuously replace weaker components when evidence supports doing so.

## Core rule

Before substantial bespoke implementation, use the solved-system gate in [`AGENTS.md`](AGENTS.md): simplify first, then prefer engine-native capability, mature maintained open source, proven commercial/free systems, promoted repository components, and validated AI generation before custom code.

## Lifecycle

[`docs/PIPELINE.md`](docs/PIPELINE.md) defines the full lifecycle from opportunity through prototype, iteration, vertical slice, graduation, production, launch, LiveOps, maintenance, and retirement. Publishing a game is a transition, not the finish line.

## Human control plane

The pipeline is becoming a **human-operable Game Development OS** rather than remaining an invisible collection of agent workflows.

[`docs/CONTROL-PLANE.md`](docs/CONTROL-PLANE.md) defines the control-plane architecture. The first prototype lives in [`apps/studio/`](apps/studio/) and renders the same canonical machine-readable state agents use, including lifecycle stages, gates, agent activity, decisions, evidence and playable-build state.

The first milestone is deliberately narrow: a human should be able to open `BYJTT-LAB-001`, understand its real state without reading repository internals, inspect evidence and decisions, launch a candidate build when one exists, and record a human gameplay verdict that changes the next eligible action.

Web/local-first is the default implementation. A macOS/desktop distribution should wrap the same control plane rather than fork it unless a proven native-only requirement emerges.

## Multi-agent coordination

[`docs/COORDINATION-KERNEL.md`](docs/COORDINATION-KERNEL.md) defines the cross-session operating model: workers are disposable; roles, work units, decisions, events and evidence persist. [`CONTEXT.md`](CONTEXT.md) provides the low-resolution domain map and [`workflows/cross-session-work.md`](workflows/cross-session-work.md) specifies claim → execute → verify → release behavior.

The repository now has machine-readable [`work-unit`](schemas/work-unit.schema.json) and [`pipeline-event`](schemas/pipeline-event.schema.json) contracts. The goal is for a fresh ChatGPT/Codex worker to resume safely from repository state without requiring the previous conversation transcript.

We will not custom-build durability infrastructure by default. [`docs/ORCHESTRATION-SOLVED-SYSTEM-SCAN.md`](docs/ORCHESTRATION-SOLVED-SYSTEM-SCAN.md) records the current build-vs-buy scan; Trigger.dev and Inngest are the first candidates to benchmark beneath the portable By JTT domain layer.

## Pipeline Governor

The permanent [`Pipeline Governor`](agents/PIPELINE-GOVERNOR.md) audits the complete system for missing pieces, weak assumptions, avoidable human bottlenecks, stronger solved technology, product-quality risk, economic risk, distribution/monetisation gaps, operational burden, and long-term maintainability.

Its job is to improve or challenge the pipeline rather than defend previous decisions.

## Repository map

- `apps/` — human-facing studio/control-plane surfaces;
- `experiments/` — benchmark specifications, implementations, and results;
- `fixtures/` — deterministic pipeline/control-plane states for contract and UI testing;
- `registry/` — candidate/verified/preferred/superseded technologies and components;
- `docs/` — methodology, lifecycle, coordination, control-plane, monetisation, and publication contracts;
- `agents/` — durable specialist roles such as the Pipeline Governor;
- `workflows/` — implementable recurring lifecycle workflows;
- `schemas/` — machine-readable experiment, pipeline, graduation, coordination, and control-plane contracts;
- `audits/` — dated evidence-based reviews of the factory itself;
- `tools/` — experiment, validation, evidence, and automation utilities;
- `.github/` — CI, issue intake, ownership, dependency maintenance, and review rules.

## Benchmark 001

`BYJTT-LAB-001` is the first comparative benchmark. It uses one shared mobile-3D action-slice contract to compare serious runtime candidates on AI production efficiency, player-facing quality, performance, deployment reliability, economics, and maintainability.

See [`experiments/BYJTT-LAB-001/spec.md`](experiments/BYJTT-LAB-001/spec.md).

## Telemetry and graduation

AI-development speed must be evidenced rather than advertised. [`schemas/pipeline-run.schema.json`](schemas/pipeline-run.schema.json) records execution cost, interventions, reuse, failures, evidence, quality, and outcomes.

Game graduation decisions use [`schemas/game-graduation.schema.json`](schemas/game-graduation.schema.json), preserving the evidence and commercial/operational reasoning behind `graduate`, `continue-research`, `hold`, or `kill` decisions.

The visual studio consumes [`schemas/control-plane-state.schema.json`](schemas/control-plane-state.schema.json), which keeps the UI, agents and future CLI/MCP clients on one source of truth.

## Reproducibility and evidence

Read [`docs/METHOD.md`](docs/METHOD.md) before creating an experiment and [`AGENTS.md`](AGENTS.md) before agent-driven implementation. Behaviour-changing work requires fresh execution evidence; code inspection alone is not considered proof that gameplay works.

Third-party code, assets, models, audio, and datasets must carry provenance and compatible licensing. Failed experiments are retained when they materially improve future decisions.

## Publishing

The public research contract lives in [`docs/PUBLISHING.md`](docs/PUBLISHING.md). The goal is useful original evidence, not generic AI-generated SEO content: versions, methodology, failures, measurements, playable evidence where appropriate, and scoped conclusions.

## Current status

**Lab v1 + commercial lifecycle + control-plane + coordination-kernel foundation.** The next execution milestone is to benchmark the durable orchestration substrate, project real work/event state into the Studio, persist human gate verdicts, and run `BYJTT-LAB-001` through a cross-session workflow that can be resumed by a fresh worker without chat-history transfer.

## License

MIT. Third-party assets and dependencies remain subject to their own licences and provenance records.
