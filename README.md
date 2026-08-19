# AI Game Development Pipeline — By JTT

An evidence-driven, open-source AI game development lab and commercial production pipeline for discovering faster, higher-quality ways to prototype, build, test, ship, monetise, operate, iterate, maintain, and retire games.

This repository is the canonical research and factory workspace behind the **By JTT AI Game Development Lab**. It benchmarks competing engines, runtimes, AI agents, asset pipelines, physics systems, QA methods, deployment routes, monetisation approaches, and other production choices using reproducible experiments rather than opinion.

## Core principle

**Reuse the best solved system before writing custom code.** Every meaningful technical decision is treated as a competition between engine-native capability, proven open source, commercial tooling, AI generation, and bespoke implementation. Custom code is used only when it is the strongest lifecycle choice.

## How the lab works

`research -> retrieve -> compose -> implement -> execute -> observe -> measure -> critique -> repair -> verify -> compare -> promote or reject`

Successful components become reusable factory knowledge. Promising prototypes can graduate into dedicated production game repositories. Public findings become first-party research for `games.byjtt.com`.

The pipeline then continues through the commercial lifecycle:

`opportunity -> prototype -> gameplay iteration -> vertical slice -> graduation -> production -> soft launch -> public release -> operate/iterate -> LiveOps -> maintenance -> retirement`

Publishing a game is a transition, not the finish line.

## Pipeline Governor

The permanent [`Pipeline Governor`](agents/PIPELINE-GOVERNOR.md) audits the complete system for missing pieces, weak assumptions, avoidable human bottlenecks, stronger solved technology, product-quality risk, economic risk, distribution/monetisation gaps, operational burden, and long-term maintainability.

Its job is to improve or challenge the pipeline rather than defend previous decisions.

## Repository map

- `experiments/` — benchmark specifications, implementations, and results;
- `registry/` — candidate/verified/preferred/superseded technologies and components;
- `docs/` — methodology, lifecycle, monetisation, production-repository, and publication contracts;
- `agents/` — durable specialist roles such as the Pipeline Governor;
- `workflows/` — implementable recurring lifecycle workflows;
- `schemas/` — machine-readable experiment, pipeline, graduation, and production-game contracts;
- `audits/` — dated evidence-based reviews of the factory itself;
- `tools/` — experiment, validation, evidence, and automation utilities;
- `.github/` — CI, issue intake, ownership, dependency maintenance, and review rules.

## First benchmark

[`BYJTT-LAB-001`](experiments/BYJTT-LAB-001/spec.md) is the Mobile 3D Action Slice. It will implement the same playable path across multiple serious runtimes, initially including Three.js/WebGPU, PlayCanvas, Babylon.js, Godot, Unity, and Defold where technically appropriate.

The benchmark measures:

- AI-production efficiency;
- gameplay and presentation quality;
- engineering quality and reproducibility;
- performance and mobile suitability;
- build/deployment reliability;
- economics and maintenance burden.

No engine or tool is declared the universal winner. Results are scoped to capabilities and contexts, and incumbents can be replaced by newer evidence.

## Commercial lifecycle

[`docs/PIPELINE.md`](docs/PIPELINE.md) defines the complete product lifecycle. [`workflows/commercial-game-lifecycle.md`](workflows/commercial-game-lifecycle.md) defines the implementable graduation/release/iteration/maintenance workflow, and [`docs/MONETIZATION-AND-LIVEOPS.md`](docs/MONETIZATION-AND-LIVEOPS.md) governs sustainable monetisation and post-launch content operations.

A promising prototype must earn graduation. A published game remains owned software with observability, release, rollback, support, migration, maintenance, and eventual retirement obligations. Graduated repositories follow [`docs/GAME-REPOSITORY-CONTRACT.md`](docs/GAME-REPOSITORY-CONTRACT.md) and can expose a validated `game-status` record without copying sensitive operational data into this public lab.

## Measuring the factory

AI-development speed must be evidenced rather than advertised. [`schemas/pipeline-run.schema.json`](schemas/pipeline-run.schema.json) captures reusable pipeline metrics including model/tool usage, human interventions, iterations, bespoke/reused work, execution evidence, quality, and outcome.

Game graduation decisions use [`schemas/game-graduation.schema.json`](schemas/game-graduation.schema.json), preserving the evidence and commercial/operational reasoning behind `graduate`, `continue-research`, `hold`, or `kill` decisions. Published/production games use [`schemas/game-status.schema.json`](schemas/game-status.schema.json) for cross-game lifecycle and maintenance visibility.

### Record tooling

Create safe, fail-closed scaffolds instead of inventing record shapes in individual chats or agents:

```bash
npm run new:record -- pipeline-run path/to/run.json RUN-ID
npm run new:record -- game-graduation path/to/graduation.json GAME-ID
npm run new:record -- game-status path/to/status.json GAME-ID
```

Generated records intentionally start with blocked/continue-research/unknown state. Validate populated records with:

```bash
npm run validate:record -- pipeline-run path/to/run.json
npm run validate:record -- game-graduation path/to/graduation.json
npm run validate:record -- game-status path/to/status.json
npm run gate:graduation -- path/to/graduation.json
```

Missing evidence is never treated as a pass.

## Reproducibility and evidence

Read [`docs/METHOD.md`](docs/METHOD.md) before creating an experiment and [`AGENTS.md`](AGENTS.md) before agent-driven implementation. Behaviour-changing work requires fresh execution evidence; code inspection alone is not considered proof that gameplay works.

Third-party code, assets, models, audio, and datasets must carry provenance and compatible licensing. Failed experiments are retained when they materially improve future decisions.

## Publishing

The public research contract lives in [`docs/PUBLISHING.md`](docs/PUBLISHING.md). The goal is useful original evidence, not generic AI-generated SEO content: versions, methodology, failures, measurements, playable evidence where appropriate, and scoped conclusions.

## Current status

**Lab v1 + commercial lifecycle foundation.** Benchmark 001 preflight, shared contracts/provenance, lifecycle telemetry/graduation tooling, production-game status contracts, and safe record scaffolding are established. The next execution milestone is running instrumented competing implementations with real executable/playtest evidence.

## License

MIT. Third-party assets and dependencies remain subject to their own licences and provenance records.
