# AI Game Development Pipeline — By JTT

An evidence-driven, open-source AI game development lab and production pipeline for discovering faster, higher-quality ways to prototype, build, test, ship, and iterate games.

This repository is the canonical research and factory workspace behind the **By JTT AI Game Development Lab**. It benchmarks competing engines, runtimes, AI agents, asset pipelines, physics systems, QA methods, deployment routes, and other production choices using reproducible experiments rather than opinion.

## Core principle

**Reuse the best solved system before writing custom code.** Every meaningful technical decision is treated as a competition between engine-native capability, proven open source, commercial tooling, AI generation, and bespoke implementation. Custom code is used only when it is the strongest lifecycle choice.

## How the lab works

`research -> retrieve -> compose -> implement -> execute -> observe -> measure -> critique -> repair -> verify -> compare -> promote or reject`

Successful components become reusable factory knowledge. Promising prototypes can graduate into dedicated production game repositories. Public findings become first-party research for `games.byjtt.com`.

## Repository map

- `experiments/` — benchmark specifications, implementations, and results;
- `registry/` — candidate/verified/preferred/superseded technologies and components;
- `docs/` — methodology and research-publication contracts;
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

## Reproducibility and evidence

Read [`docs/METHOD.md`](docs/METHOD.md) before creating an experiment and [`AGENTS.md`](AGENTS.md) before agent-driven implementation. Behaviour-changing work requires fresh execution evidence; code inspection alone is not considered proof that gameplay works.

Third-party code, assets, models, audio, and datasets must carry provenance and compatible licensing. Failed experiments are retained when they materially improve future decisions.

## Publishing

The public research contract lives in [`docs/PUBLISHING.md`](docs/PUBLISHING.md). The goal is useful original evidence, not generic AI-generated SEO content: versions, methodology, failures, measurements, playable evidence where appropriate, and scoped conclusions.

## Current status

**Lab v1 bootstrap.** The next execution milestone is implementing `BYJTT-LAB-001`, establishing shared source assets/evidence capture, and running the first competing implementations.

## License

MIT. Third-party assets and dependencies remain subject to their own licences and provenance records.
