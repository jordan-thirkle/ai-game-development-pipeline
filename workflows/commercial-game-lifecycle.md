# Workflow: Commercial Game Lifecycle

## Purpose and owner

Purpose: move a promising experiment from research through production, release, monetisation, operation, iteration, maintenance, and retirement without losing evidence or creating avoidable human bottlenecks.

Owner: Pipeline Governor coordinates; the game-specific production agent owns execution; irreversible publication, spend, legal commitments, and material monetisation changes retain explicit human approval.

## Trigger

Start when an experiment is proposed for graduation or when an already-published game enters a new lifecycle review.

## Required inputs

- experiment/game ID and repository;
- current playable build;
- evidence/results;
- target platforms;
- current engine/runtime/dependencies;
- provenance/licence ledger;
- known audience/market assumptions;
- estimated production/operational costs;
- current telemetry for published games;
- access to required build, store, hosting, analytics, backend, and support systems.

## Ordered actions

### 1. Graduation audit

Pipeline Governor reviews the candidate against `docs/PIPELINE.md` and `agents/PIPELINE-GOVERNOR.md`.

Output one decision:
- `graduate`;
- `continue-research`;
- `hold`;
- `kill`.

A `graduate` decision must state the evidence, unresolved risks, target product scope, and why continued investment is justified.

### 2. Product repository and ownership

For a graduated game:
- preserve the benchmark implementation in the lab;
- create/use a dedicated product repository;
- record upstream lab experiment and reusable component versions;
- establish product-specific AGENTS/instructions, release policy, support ownership, and decision log;
- create a minimal production roadmap centred on a commercially coherent release, not feature accumulation.

### 3. Production architecture review

Re-run the solved-system gate for every major production concern. Prototype choices are not automatically production choices.

Review at minimum:
- engine/runtime;
- rendering;
- physics;
- input;
- UI;
- save/cloud save;
- auth if required;
- backend/multiplayer if required;
- analytics/crash reporting;
- feature flags/remote config;
- commerce;
- asset pipeline;
- localisation;
- build/distribution;
- QA/device testing;
- support tooling.

Record build-vs-buy-vs-reuse-vs-generate decisions with lifecycle cost.

### 4. Monetisation design

Define monetisation only after the player value loop is credible.

For each candidate model (premium, ads, IAP, DLC/content, subscription, cosmetics, other), evaluate:
- fit with player expectations and session structure;
- impact on game design and trust;
- implementation/QA/support burden;
- platform constraints/fees;
- fraud/refund implications;
- content obligations;
- revenue concentration risk;
- expected revenue versus operating cost.

Reject monetisation that degrades the core experience enough to threaten retention or brand trust.

### 5. Instrumentation and economics

Before soft launch, ensure the game can measure:
- install/launch health;
- first-session funnel;
- core-loop engagement;
- progression;
- return behaviour;
- content usage;
- crashes/errors/performance;
- monetisation funnel where applicable;
- infrastructure/API/inference cost;
- support burden.

Define target metrics and stop/iterate thresholds before reading results where practical.

### 6. Release readiness

Verify:
- functional and regression tests;
- deterministic gameplay checks where applicable;
- real-device coverage;
- save migration/recovery;
- offline/network failure handling;
- purchase restore/failure handling where applicable;
- privacy/consent flows;
- security review;
- accessibility baseline;
- crash/performance budgets;
- store metadata/assets;
- rating/compliance inputs;
- release signing/configuration;
- rollout/rollback procedure;
- changelog and support route;
- monitoring dashboards.

Human checkpoint: approve external publication/release.

### 7. Controlled release / soft launch

Release to the smallest population that can answer the highest-risk commercial and product questions.

Observe actual behaviour rather than relying on qualitative impressions alone.

Automatically surface material failures; do not automatically expand rollout when thresholds fail.

### 8. Post-release diagnosis

Classify findings into:
- reliability;
- performance;
- comprehension/onboarding;
- gameplay quality;
- progression/balance;
- retention;
- monetisation;
- acquisition/discovery;
- support/community;
- content demand;
- infrastructure cost.

Separate symptoms from root causes before implementation.

### 9. Iteration

Every meaningful change requires:
- hypothesis;
- target metric/player outcome;
- implementation scope;
- regression risks;
- verification;
- rollout plan;
- post-release measurement;
- keep/revert/iterate decision.

Promote reusable fixes and lessons back into the lab registry where appropriate.

### 10. Research/publication output

Where useful and safe:
- package methodology/results for games.byjtt.com;
- link game, experiment, version, evidence, and source where appropriate;
- produce screenshots/video/charts from reproducible evidence;
- preserve negative findings;
- redact commercially sensitive implementation advantages when disclosure would materially reduce product advantage.

### 11. Maintenance loop

For every active published game, maintain a living inventory of:
- engine/runtime version;
- dependencies/SDKs;
- store/platform requirements;
- backend services;
- certificates/signing;
- billing/IAP configuration;
- analytics/crash tooling;
- data/storage migrations;
- privacy/compliance obligations;
- operational costs;
- known vulnerabilities/incidents;
- unresolved support issues.

Run focused upgrades with regression evidence; avoid unattended broad dependency churn.

### 12. Retirement decision

Evaluate retirement when:
- maintenance/support cost materially exceeds expected value;
- platform/runtime support becomes uneconomic;
- player population is no longer sustainable;
- a replacement product supersedes it;
- security/compliance obligations cannot be met economically.

Human checkpoint: approve irreversible shutdown/delisting decisions.

## Outputs

- lifecycle decision record;
- production roadmap;
- architecture and monetisation decisions;
- release-readiness evidence;
- telemetry/economics dashboard definitions;
- release/rollback record;
- iteration experiment records;
- maintenance inventory;
- publication package;
- retirement/archive record if applicable.

## Idempotency and retries

- Reviews and validation may be rerun safely against a pinned commit/build/version.
- Publication, store release, purchases, paid campaigns, migrations, and destructive infrastructure operations require idempotent tooling or explicit safeguards.
- Never infer success from a request being accepted; read back the resulting state.

## Failure and escalation

- P0 reliability/security/payment/save failures block rollout and may require rollback.
- P1 product/economic failures block expansion until diagnosed.
- Missing evidence is `unknown`, not `pass`.
- Tooling failure should trigger an alternative verification route before declaring the pipeline blocked.

## Privacy and credentials

- Do not commit tokens, keys, signing material, raw private telemetry, or personal support data.
- Production telemetry must be minimised and purpose-bound.
- Public research uses aggregated/anonymised evidence where user data is involved.

## Observability / proof of success

A lifecycle run succeeds only when the state transition is externally/read-back verified and the required evidence exists. Examples: published build version, store status, deployment health, telemetry receipt, purchase test, migration result, rollback test, or post-release metric readback.

## Acceptance criteria

An implementer should be able to determine what happens before, during, and after release without inventing missing ownership, approval, measurement, rollback, maintenance, or retirement semantics.
