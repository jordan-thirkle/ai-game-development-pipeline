# Pipeline Governor Audit — 2026-08-19

Status: initial architecture audit before BYJTT-LAB-001 implementation.

## Strengths

- Experiment-first methodology is explicit.
- The solved-system gate prevents defaulting to bespoke implementation.
- Engine/runtime selection is competitive rather than ideological.
- Reproducibility, provenance, licensing, and negative results are first-class.
- Public research is tied to evidence rather than generic SEO output.
- Promising prototypes may graduate instead of being discarded.

## Critical gaps

### P1 — No formal post-prototype commercial lifecycle

The original lab stops too early. It does not fully govern production, release, monetisation, telemetry, iteration, maintenance, or retirement.

Action: add `docs/PIPELINE.md`, `workflows/commercial-game-lifecycle.md`, and monetisation/LiveOps guidance.

### P1 — No permanent adversarial owner for pipeline quality

Without a dedicated role, agents can locally optimise tasks while systemic gaps remain invisible.

Action: establish `agents/PIPELINE-GOVERNOR.md` and require audits at major gates.

### P1 — Factory performance is not yet instrumented

We plan to benchmark engines but do not yet have a canonical schema for measuring the AI factory itself across experiments.

Required metrics should include:
- time to validated playable;
- model/token/API cost;
- tool calls and tool failure rate;
- human interventions and elapsed human effort;
- reused versus bespoke implementation ratio;
- iterations to acceptance;
- defects found after claimed completion;
- build/deploy reliability;
- asset generation rejection rate;
- maintenance interventions after release;
- post-launch player/business outcomes.

Action: create a versioned pipeline telemetry schema and collection tooling before concluding Benchmark 001.

### P1 — No production-game graduation contract/template yet

The decision to split a prototype into a product repository needs a durable record of evidence, architecture, commercial hypothesis, operational obligations, and inherited lab components.

Action: create a machine-readable graduation manifest and product-repository template.

### P1 — Real-device and end-to-end execution infrastructure is not yet implemented

The methodology demands execution evidence but the repository currently contains policy, not a cross-engine execution harness or real-device validation route.

Action: Benchmark 001 must establish actual browser/engine/mobile validation paths before any engine is promoted.

### P1 — Release engineering matrix is missing

The factory needs evidence for web, Android, iOS, desktop, and engine-specific packaging where relevant, including signing, release channels, rollback, and reproducible artifacts.

Action: build release capability incrementally from the first production candidate rather than deferring it to launch week.

### P1 — Telemetry/observability architecture is undefined

A released game cannot be iterated intelligently without reliable product, crash, performance, and cost telemetry.

Action: benchmark current solved analytics/crash/feature-flag options when a game candidate approaches vertical slice; avoid building an analytics platform.

### P1 — Monetisation is not a benchmark dimension deep enough yet

Economics currently appears in Benchmark 001, but commerce introduces restoration, retries, fraud/refunds, platform constraints, support, and long-term content obligations.

Action: add dedicated monetisation experiments only after a core game loop passes the player-value gate.

## Leverage opportunities

### P2 — Component intelligence registry

Turn the technology registry into a queryable capability registry with context-specific incumbents, evidence links, licence, version, maintenance risk, AI editability, production use, and replacement threshold.

### P2 — Model/task router

Do not assume one frontier model is optimal for all work. Benchmark specialised routing for planning, coding, shader work, visual critique, 3D, animation, debugging, and research.

### P2 — Asset factory metrics

Measure the complete cost of generated assets, including rejection, repair, retarget, optimisation, and integration. Generation speed alone is misleading.

### P2 — Failure-to-skill promotion

Repeated failures should automatically trigger consideration of a reusable validator, skill, template, test, or troubleshooting entry rather than repeated prompting.

### P2 — Publication automation

Experiment manifests should be capable of producing a structured draft research package for games.byjtt.com: methodology, versions, tables, evidence links, media manifest, conclusions, FAQs, and structured-data inputs.

### P2 — Portfolio-level game router

Once multiple candidate games exist, prioritisation must consider expected player value, learning value, revenue potential, maintenance load, strategic fit, and opportunity cost—not just whichever prototype is newest.

### P2 — Cross-game reusable account/backend strategy

If multiple shipped games eventually need identity, cloud save, social systems, or cross-promotion, evaluate shared infrastructure only after repeated need is proven. Avoid premature platform-building.

## Invalid assumptions to guard against

- Faster code generation equals faster game production.
- A high-quality prototype implies a maintainable production game.
- The engine that wins one benchmark should become the universal default.
- AI-generated assets are cheap if repair/QA costs are ignored.
- More LiveOps automatically improves retention.
- More monetisation surfaces automatically improve revenue.
- Automated tests remove the need for real-device/player validation.
- Search traffic alone indicates research quality.
- A published game can be considered complete and left unattended.

## New experiments required

1. BYJTT-LAB-001 engine/runtime bake-off.
2. Pipeline telemetry instrumentation test.
3. Shared asset retrieval/generation/validation benchmark.
4. Cross-runtime deterministic playtest benchmark.
5. Mobile packaging/device-validation benchmark.
6. Model/task-routing benchmark once enough repeated tasks exist.
7. Production telemetry/feature-flag/crash stack bake-off before first soft launch.
8. Monetisation stack and UX experiment only for a game that passes graduation.
9. Maintenance simulation: engine/dependency upgrade plus save migration/rollback on a shipped-like test game.
10. Publication pipeline benchmark from raw experiment evidence to games.byjtt.com-ready package.

## Human bottlenecks to remove or retain

### Automate aggressively
- documentation/version research collection;
- candidate discovery;
- asset conversion/validation;
- repetitive implementation;
- deterministic gameplay execution;
- screenshot/video capture;
- profiling/data collection;
- result aggregation;
- changelog/release-note drafts;
- dependency/provenance inventories;
- research publication packaging.

### Retain deliberate checkpoints
- game-fun/product judgement where metrics are insufficient;
- meaningful spend commitments;
- irreversible public releases/shutdowns;
- legal/licensing ambiguity;
- high-impact monetisation changes;
- publication of commercially sensitive research;
- destructive migrations without proven rollback.

## Priority order

1. Land the commercial lifecycle and Pipeline Governor.
2. Add pipeline telemetry schema before Benchmark 001 conclusions.
3. Execute BYJTT-LAB-001 with real evidence.
4. Build component intelligence from those results.
5. Graduate only a genuinely promising prototype.
6. Establish production observability/release/monetisation based on that real game's needs.
7. Publish useful first-party research throughout.
8. Feed post-launch evidence back into the lab and rerun the Governor audit.

## Verification

This audit is successful only if its high-priority findings become version-controlled workflow, tooling, schemas, or explicit tracked work rather than remaining prose recommendations.
