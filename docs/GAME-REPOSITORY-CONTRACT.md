# Graduated Game Repository Contract

Every game that graduates from the lab into its own production repository remains connected to the AI Game Development Pipeline through a small, stable contract. The production repository owns the game. This lab owns cross-game learning, lifecycle comparison, promoted components, and public research methodology.

## Required production-repository files

A graduated game repository should expose these machine-readable or durable records:

- `byjtt/game-status.json` — current lifecycle, release, operations, monetisation, and maintenance state;
- `byjtt/pipeline-runs/` — significant AI production/maintenance run records using this lab's `pipeline-run` schema or a compatible copied version;
- `byjtt/decisions/` — graduation/runtime/architecture/monetisation decisions whose rationale must survive chat context;
- `CHANGELOG.md` — player/release-facing change history;
- `AGENTS.md` — repository-specific agent rules layered on top of the factory principles;
- provenance/licence records for third-party and generated production inputs.

The exact directory may be adapted when an engine has strong conventions, but the information must remain easy for agents and CI to locate.

## `game-status.json`

The status document uses `schemas/game-status.schema.json` from this lab. It is deliberately a summary/index rather than a replacement for analytics, crash reporting, stores, issue trackers, or release systems.

It records:

- lifecycle stage;
- current production runtime and version;
- release channels/platforms;
- release/build identifiers;
- evidence locations;
- telemetry/crash/commerce/support health as explicit `healthy`, `degraded`, `blocked`, `unknown`, or `not-applicable` states;
- monetisation model and current experiment state;
- maintenance/upstream risks;
- next review date/action;
- publication-safe research pointers.

`unknown` is a valid state. Missing evidence must never be silently interpreted as healthy.

## Ownership boundary

The production repository owns:

- player-facing roadmap;
- source/assets/builds;
- product analytics and sensitive raw telemetry;
- store credentials and release signing;
- monetisation configuration;
- incidents/support;
- game-specific CI/CD;
- secrets and private operational data.

This lab owns or receives only what is needed to improve the cross-game pipeline:

- aggregate pipeline metrics;
- non-sensitive benchmark/maintenance evidence;
- reusable component outcomes;
- engine/runtime/tool lessons;
- publication-safe findings;
- de-identified operational lessons.

Do not copy secrets, private player data, raw support conversations, or sensitive business data into the public lab repository.

## Lifecycle synchronization

Update `game-status.json` when any of these materially changes:

- lifecycle stage;
- production runtime/major dependency;
- release channel or platform;
- monetisation model;
- telemetry/crash/release health;
- unresolved P0/P1 operational risk;
- maintenance policy;
- retirement decision.

Significant game work should also emit a `pipeline-run` record so the factory can compare development and maintenance cost over time.

## Promotion back into the lab

When a production game proves a component or workflow under real player load, record the evidence before promoting it into the shared registry. Production success is stronger evidence than a lab-only benchmark but does not automatically make a component universal.

## Publication

A game repo may expose publication-safe summaries that feed `games.byjtt.com`. Research output must preserve method, versions, dates, limitations, and evidence while excluding private telemetry and commercially sensitive implementation details.

## Retirement

A retiring game keeps a final status record referencing:

- final release/build;
- shutdown/delisting decision;
- player communication where applicable;
- save/backend implications;
- reusable components promoted back to the lab;
- final operational/research lessons.
