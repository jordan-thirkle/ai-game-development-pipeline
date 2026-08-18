# End-to-End AI Game Production Pipeline

This pipeline extends the lab beyond prototyping. A game is not complete when it runs, when a benchmark passes, or when it is published. The production system must cover discovery, validation, commercialisation, operation, iteration, maintenance, and eventual retirement.

## Operating principle

Optimise the whole lifecycle, not a single development stage. A technology that makes prototyping faster but creates disproportionate release, maintenance, performance, support, or migration cost can lose to a slower prototype stack.

Every stage must apply the solved-system gate from `AGENTS.md`.

## Lifecycle states

### 0. Opportunity

Purpose: decide whether a game deserves prototype effort.

Required outputs:
- player fantasy and target audience;
- market/problem evidence;
- core loop hypothesis;
- differentiation thesis;
- platform/distribution hypothesis;
- monetisation hypotheses without designing around extraction;
- primary production risks;
- kill criteria.

Gate: a prototype can test the highest-risk assumptions cheaply.

### 1. Research prototype

Purpose: answer a bounded question as quickly and honestly as possible.

Required outputs:
- executable prototype;
- explicit hypothesis;
- repeatable evaluation;
- evidence and failures;
- technology/asset provenance;
- learning captured in the lab.

Gate: evidence justifies deeper gameplay iteration or the prototype is rejected.

### 2. Gameplay iteration

Purpose: prove that the game is worth making before production complexity accumulates.

Required outputs:
- complete core loop;
- repeated player sessions or equivalent structured playtests;
- control/feel/pacing evidence;
- retention hypotheses;
- identified sources of delight, frustration, confusion, and boredom;
- performance budget;
- content-production cost estimate.

Gate: the game is repeatedly enjoyable and has a plausible reason to return.

### 3. Vertical slice

Purpose: prove production quality and production repeatability.

Required outputs:
- representative final-quality art, animation, audio, UX, gameplay, and performance;
- validated asset pipeline;
- save/progression model;
- telemetry plan;
- crash/error reporting;
- device/platform validation;
- estimated cost per unit of future content;
- production backlog and risk register.

Gate: quality can be reproduced without heroic manual intervention.

### 4. Production candidate

Purpose: decide whether to graduate the game from research into a dedicated product repository.

Graduation review must evaluate:
- player value and differentiation;
- technical viability;
- content scalability;
- production cost;
- monetisation fit;
- distribution fit;
- compliance/privacy needs;
- operational/support burden;
- maintainability;
- strategic value to By JTT;
- opportunity cost versus other candidates.

Gate: explicit `graduate`, `continue research`, `hold`, or `kill` decision.

### 5. Production

Purpose: build the smallest commercially coherent version.

Required systems include, when applicable:
- onboarding;
- accessibility;
- progression;
- save/cloud save;
- commerce;
- analytics;
- crash/error reporting;
- consent/privacy handling;
- content configuration;
- feature flags/remote configuration;
- release channels;
- support/contact route;
- recovery/rollback strategy;
- localisation strategy;
- age-rating/store metadata inputs;
- test matrix;
- build/release automation.

Gate: release candidate satisfies product, engineering, commercial, compliance, and operational readiness criteria.

### 6. Soft launch / controlled release

Purpose: test the business and operational model with real players before broad promotion.

Measure at minimum:
- install-to-first-play success;
- onboarding completion;
- session length/distribution;
- return behaviour;
- progression funnels;
- difficulty/friction points;
- crashes/ANRs/errors;
- performance by device class;
- acquisition source where lawful/available;
- monetisation funnel where applicable;
- support burden;
- infrastructure and inference cost per active user.

Gate: expand, iterate, reposition, pause, or retire based on evidence.

### 7. Public release

Purpose: launch a stable game with a measurable growth and support loop.

Required outputs:
- reproducible release build;
- store/web release assets;
- changelog;
- rollback path;
- telemetry dashboards;
- support and incident ownership;
- launch research/article package where strategically useful;
- games.byjtt.com game page and related research links;
- acquisition/SEO/social plan appropriate to the title.

Gate: production health remains within agreed thresholds.

### 8. Operate and iterate

Purpose: turn player behaviour and qualitative feedback into higher player value and sustainable economics.

Continuous loop:
`observe -> diagnose -> hypothesise -> prioritise -> implement -> test -> release -> measure -> retain/revert`

Inputs:
- gameplay telemetry;
- crash/performance telemetry;
- reviews/support;
- retention/cohort behaviour;
- acquisition economics;
- monetisation behaviour;
- content engagement;
- community signals;
- competitor/market changes;
- platform/runtime changes.

Changes must state the expected player/business effect before implementation and evaluate the effect after release.

### 9. LiveOps / content operations

Only add LiveOps complexity if it materially improves the game.

Prefer data-driven content and reusable tools over repeated code changes. Measure content production cost, engagement, failure risk, and operational burden.

Potential systems:
- events;
- challenges;
- seasons;
- rotations;
- new content;
- balancing;
- experiments;
- social/community features.

Avoid creating a treadmill whose maintenance cost exceeds its player value.

### 10. Maintenance

A published game remains owned software.

Continuously manage:
- engine/runtime/security updates;
- platform SDK/store requirement changes;
- dependency vulnerabilities;
- backend/database maintenance;
- device/OS compatibility;
- save-data migrations;
- billing/IAP compatibility;
- analytics correctness;
- privacy/compliance changes;
- performance regressions;
- asset licensing/provenance records;
- operational costs;
- support volume.

Every production game must have a documented update and migration strategy before broad launch.

### 11. Retirement / archival

Retirement is a designed state, not abandonment.

Plan for:
- player communication;
- purchase/subscription implications;
- backend shutdown;
- save/export considerations where appropriate;
- store delisting;
- preservation of source, builds, provenance, analytics summaries, and lessons;
- promotion of reusable systems back into the lab.

## Cross-cutting gates

At every meaningful transition, evaluate:

1. **Player value** — is it genuinely enjoyable/useful?
2. **Evidence** — do we have executable proof rather than confidence?
3. **Reuse** — are we rebuilding solved work?
4. **Quality** — does presentation match the intended product bar?
5. **Performance** — does it meet target-device budgets?
6. **Economics** — are development, infrastructure, content, support, and acquisition costs sustainable?
7. **Monetisation** — does monetisation fit the player experience and expected market?
8. **Distribution** — can we reach players efficiently?
9. **Observability** — can we know when the game is broken or underperforming?
10. **Maintainability** — can future agents safely understand and update it?
11. **Security/privacy/compliance** — are user, platform, and commercial obligations handled?
12. **Rollback/recovery** — can failed updates be contained?
13. **Documentation/provenance** — can decisions and inputs be reconstructed?
14. **Publication value** — is there useful research to publish without exposing commercially sensitive advantages?
15. **Opportunity cost** — is this still the best use of effort?

## Pipeline success metric

The factory is improving only when it produces better games with less total lifecycle cost, fewer human bottlenecks, faster validated iteration, and lower operational risk—not merely when it generates more code faster.
