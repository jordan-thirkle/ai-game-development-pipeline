# AI Game Analytics, Crash and Live-Ops Systems — 2026-08

Research date: **2026-08-20** (`Europe/London`)  
Execution status: **NOT EXECUTED — source/vendor research only**  
Tested version/configuration status: **no ByJTT analytics, crash, experiment or live-ops benchmark result is claimed here**  
Registry authority: `../registry/ai-game-dev-registry.v1.json`  
Evaluation authority: `AI-GAME-DEV-EVALUATION-SYSTEMS-2026-08.md`

## Decision

Do **not** buy or build “one analytics stack” as a monolith. Separate four replaceable roles:

1. **game/product analytics** — progression, funnels, retention, economy, engagement and monetisation evidence;
2. **crash/error/release health** — fatal/native/non-fatal diagnostics, symbols, regressions and crash-free health;
3. **remote config / feature rollout / experimentation** — safe parameter changes, cohorts, gradual rollout and controlled experiments;
4. **backend/server observability** — traces, metrics and logs for authoritative servers, APIs, workers and fleet infrastructure.

The canonical event/config model belongs to the game project. Provider SDK objects, dashboard IDs and proprietary event names are adapters only.

A provider can fill more than one role, but benchmark results are recorded per role. A platform does not win crash reporting because it has strong product analytics, or win experimentation because its crash UI is excellent.

---

# 1. Canonical telemetry contract

Every production game should be able to route the same approved telemetry envelope to one or more providers:

```text
TelemetryEvent
  schema_version
  event_id
  event_name
  occurred_at_monotonic_or_utc
  install_id_pseudonymous
  player_id_pseudonymous_optional
  session_id
  build_id
  release_channel
  platform
  device_class
  locale
  consent_state
  game_mode_optional
  level_or_content_id_optional
  experiment_assignments[]
  remote_config_versions[]
  properties{}
```

High-value domain events use stable semantic names such as:

```text
session_started
session_ended
onboarding_step_completed
level_started
level_completed
level_failed
reward_granted
currency_earned
currency_spent
purchase_started
purchase_completed
ad_impression
ad_reward_granted
match_started
match_completed
progression_changed
feature_exposed
error_recovered
```

Provider adapters translate these to GameAnalytics event types, Firebase/Google Analytics events, PostHog events, warehouse rows, or other sinks.

## Privacy rule

- No email, phone, real name, raw IP-derived identity, voice transcript, child identifier or other direct PII belongs in the default telemetry contract.
- Player identifiers are pseudonymous and independently revocable/rotatable where the provider permits it.
- Consent/collection state is part of runtime configuration and test evidence, not a dashboard-only assumption.
- Crash logs, breadcrumbs, custom properties and stack context require the same privacy review as analytics events.
- Remote config is never a secret store and never carries API keys, entitlement secrets or anti-cheat authority.

---

# 2. Crash / error incumbents

## Sentry Unity

Official repository: `getsentry/sentry-unity`  
Pinned release commit: `01f2aacb7ac4e29c3f801cb94ab6be7ca501e01a`  
Release: **4.8.0 — 2026-07-30**  
SDK repository licence at pin: **MIT**  
Evidence: **SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT CROSS-PLATFORM GAME CRASH/ERROR BENCHMARK**

The Unity SDK is independently versioned and open-source. Sentry's current game support materially extends beyond mobile: its console crash reporting is generally available for Xbox, PlayStation and Nintendo Switch through Unity, Unreal and native integrations, subject to each platform's developer/middleware access requirements.

Sentry also exposes releases/deploys and crash-free release-health statistics. This makes it a strong benchmark for correlating a regression with an exact build rather than only collecting exception text.

### Required benchmark

- C# caught/non-fatal exception;
- unhandled managed exception;
- native/IL2CPP crash where supported;
- symbol upload and readable production stack;
- build/release/environment correlation;
- breadcrumbs/custom context;
- crash-free users/sessions;
- offline buffering and next-launch delivery;
- data-scrubbing/PII controls;
- alert latency;
- SDK CPU/RAM/network/build-size overhead;
- Unity editor/development-build noise filtering;
- console path feasibility for games that target consoles.

Repository MIT licensing applies to the SDK code only. Hosted Sentry plans, data processing, retention and enterprise/security terms are separate records.

---

## Firebase Crashlytics for Unity

Current Unity SDK release observed in official Firebase release notes: **13.14.0 — 2026-07-17**  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT MOBILE/UNITY CRASH BENCHMARK + FIREBASE-SUITE BENCHMARK**

Current official Unity documentation covers managed and native crash reporting, caught exceptions, logs/custom keys, user identifiers and optional breadcrumb integration through Google Analytics. Android IL2CPP native crash symbolication requires uploading generated symbols; Apple symbol handling is integrated into the Unity/Xcode workflow.

Crashlytics collection is automatic by default but the Unity API supports disabling collection and runtime opt-in. That collection-state behavior must be exercised in privacy tests rather than inferred from configuration.

### Required benchmark

Use the exact same crash matrix and release build as Sentry. Compare:

- symbolication success rate;
- issue grouping/variant quality;
- actionable context before failure;
- non-fatal/fatal semantics;
- crash-free metrics;
- alerting;
- build pipeline integration;
- Google Analytics dependency required for breadcrumbs;
- opt-in/opt-out behavior;
- export path (for example BigQuery/Cloud Logging where applicable);
- mobile cost/ops burden.

Do not run two native crash SDKs in production merely to “have more data” until coexistence, handler ordering and overhead are explicitly tested.

---

# 3. Game/product analytics incumbents

## GameAnalytics Unity

Official repository: `GameAnalytics/GA-SDK-UNITY`  
Pinned source commit: `af7b0d28dc607b8cb0b2daddf60a813635d1abfe`  
Release: **8.0.1 — 2026-06-11**  
SDK repository licence at pin: **MIT**  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT GAME-SPECIFIC ANALYTICS + REMOTE-CONFIG/EXPERIMENT BENCHMARK**

GameAnalytics remains valuable precisely because its model is game-oriented rather than generic product analytics. Current product documentation supports analytics plus Remote Config and A/B testing, including enhanced JSON configs. Unity SDK 8.0.0+ is the documented minimum for enhanced JSON config support; the pinned 8.0.1 release therefore enters the benchmark.

Current experiment documentation has constraints that belong in the run manifest:

- users may be enrolled in only one active experiment at a time;
- offline users are not enrolled during their first qualifying session;
- experiments have a platform maximum of 1,000,000 users;
- enhanced JSON config support depends on compatible SDK versions.

These constraints can materially affect game experimentation and cannot be hidden behind a generic “supports A/B tests” capability flag.

### Required benchmark

Using one frozen synthetic game dataset plus a real instrumented vertical slice:

- session/retention cohorts;
- onboarding funnel;
- level progression/failure analysis;
- economy source/sink tracking;
- acquisition/channel segmentation where lawful/available;
- ad/IAP event correlation;
- custom dimension cardinality limits;
- dashboard-to-answer time for a non-technical operator;
- export/API access;
- event ingest delay;
- offline/session behavior;
- SDK overhead;
- GDPR/child-directed/privacy configuration and deletion/export workflow;
- remote-config propagation and safe default fallback;
- experiment assignment reproducibility and result interpretation.

Hosted service pricing, retention/export rights and data-processing terms are separate from the MIT Unity SDK.

---

## PostHog

Current official product surface includes product analytics, session replay, feature flags, experiments, surveys, error tracking, warehouse/CDP, logs/traces and agent-facing tooling.  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **CROSS-PRODUCT/AGENT-OPERABLE ANALYTICS BENCHMARK; NOT UNITY DEFAULT WITHOUT ADAPTER EVIDENCE**

PostHog is strategically interesting for ByJTT because the studio itself, marketing sites, launchers, web games and React Native apps can share analytics/experimentation infrastructure, and its current product direction includes agent/MCP-oriented operation. Its public pricing currently advertises large free tiers for product analytics and feature-flag requests, which makes it worth measuring for small commercial products.

However, this research did **not** identify a first-party Unity SDK in the current official installation surfaces inspected. Do not infer Unity parity from PostHog's broad web/mobile product list. A Unity game benchmark requires an explicit supported adapter, server-side event path, community SDK review or a custom thin transport, each with its own support and failure model.

### Required benchmark

- web/React Native install friction;
- game-event schema mapping;
- Unity integration feasibility separately;
- funnels/retention/cohorts;
- feature-flag evaluation and safe fallback;
- experiment assignment;
- session replay only where the target runtime supports it and privacy allows it;
- warehouse/export portability;
- API/MCP/agent operability;
- cost under realistic event and flag volumes;
- cloud-region/privacy/security requirements.

PostHog is not allowed to become the canonical telemetry schema merely because its agent-facing control surface is attractive.

---

# 4. Remote config / rollout / experiments

## Firebase Remote Config + A/B Testing

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **UNITY/MOBILE LIVE-CONFIG BENCHMARK**

Firebase Remote Config supports Unity and documents in-app defaults, targeted overrides, rollouts, A/B tests and side-by-side Analytics/Crashlytics measurement. Current Unity documentation also supports real-time Remote Config updates on Android/Apple when using Firebase Unity SDK 11.0.0+.

The strongest safety property is not “change values remotely”; it is that code retains local defaults and explicitly controls fetch/activation. The ByJTT adapter therefore requires typed defaults in source control and treats remote values as overrides, never as the only definition of a gameplay-critical value.

### Required benchmark

- cold launch offline with only defaults;
- fetch timeout/failure;
- invalid/missing value;
- percentage rollout;
- cohort targeting;
- emergency rollback;
- real-time update behavior where supported;
- config-version evidence attached to telemetry/crashes;
- experiment exposure logging;
- stale-cache behavior;
- unauthorized/client-tampered value handling;
- safe distinction between tunable experience and server-authoritative rules.

---

## GameAnalytics Remote Config + A/B

Evidence: **VENDOR-DOC CLAIM; SDK SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **GAME-SPECIFIC CONFIG/EXPERIMENT BENCHMARK**

Current docs support string and enhanced JSON configs, config version identifiers, targeted values and A/B overrides. The Unity SDK exposes readiness/update signals and default-value retrieval. GameAnalytics documentation explicitly warns that Remote Config must not be used for sensitive secrets or security-critical logic.

The benchmark must include compatibility with older client versions because enhanced configs are ignored by SDK versions that do not support them.

---

## PostHog Feature Flags + Experiments

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **WEB/APP + AGENT-OPERATED ROLLOUT BENCHMARK**

Benchmark for studio/web/app surfaces and any game runtime with a supported, reviewed adapter. Do not let feature-flag evaluation calls appear directly inside economy, entitlement or anti-cheat domain logic. Resolve a typed rollout/config snapshot at a boundary and pass the result into game logic.

---

# 5. Backend/server observability

## OpenTelemetry

Official docs: `https://opentelemetry.io/docs/`  
Evidence: **SOURCE/SPEC-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT VENDOR-NEUTRAL SERVER TELEMETRY CONTRACT**

OpenTelemetry is an open-source vendor-neutral framework for generating, collecting and exporting traces, metrics and logs. It is deliberately **not an observability backend**. The Collector provides a vendor-agnostic receive/process/export layer and can route telemetry to open-source or commercial backends.

This makes OTel the strongest default boundary for ByJTT backend/game-server observability: authoritative servers, matchmaking glue, fleet allocators, economy APIs and web services should not need to be re-instrumented when the storage/dashboard vendor changes.

### Required server conventions

Resource attributes include stable fields such as:

```text
service.name
service.version
service.instance.id
deployment.environment
byjtt.game_id
byjtt.build_id
byjtt.region
byjtt.server_provider
byjtt.server_image_digest
```

Game-session spans/metrics may add bounded-cardinality IDs where justified. Never put raw player PII, authentication tokens, chat content or unbounded arbitrary payloads into span attributes.

### Required benchmark

- OTLP export through Collector;
- traces across matchmaking/backend/server allocation boundaries;
- request/session correlation without direct PII;
- server tick/loop latency metrics;
- allocation/startup timing;
- errors/log correlation;
- sampling under load;
- collector outage/backpressure behavior;
- storage/vendor swap using the same instrumentation;
- cost/cardinality guardrails.

---

# 6. Provider-neutral live-ops contract

Canonical code should expose interfaces roughly equivalent to:

```text
AnalyticsSink.capture(TelemetryEvent)
AnalyticsSink.flush()
CrashSink.captureException(error, context)
CrashSink.setRelease(build_id)
ConfigProvider.getSnapshot(schema_id, defaults)
ExperimentProvider.getAssignments(player_context)
ServerTelemetry.startSpan(name, attributes)
ServerTelemetry.recordMetric(name, value, attributes)
```

Gameplay systems receive typed values or domain events. They do not import Firebase, GameAnalytics, PostHog, Sentry or a specific observability backend directly.

## Failure policy

Analytics and experiment infrastructure is **non-authoritative**:

- analytics failure must not block gameplay;
- crash reporting must not cause a second crash;
- a missing remote-config response falls back to versioned local defaults;
- a feature flag cannot grant purchases, entitlement or server authority by itself;
- telemetry queues are bounded;
- network retries have explicit caps/backoff;
- every production SDK has a kill switch/collection policy where practical;
- duplicate sinks must prove overhead before simultaneous production use.

---

# 7. Frozen benchmark families

## Benchmark A — game analytics conformance

Instrument one identical vertical slice with a canonical event adapter and produce the same questions:

1. Day/session retention proxy from synthetic/replayed cohorts;
2. onboarding completion/falloff;
3. level start → fail → complete funnel;
4. progression distribution;
5. economy earned/spent balance;
6. monetisation event path;
7. content/mode segmentation;
8. build/release comparison;
9. export/raw-data feasibility;
10. deletion/consent workflow.

Measure implementation time, event loss/duplication, query latency, dashboard usability, exportability, cost, SDK overhead and provider replacement cost.

## Benchmark B — crash fidelity

For the same release build inject a controlled matrix of managed, non-fatal and native/IL2CPP failures where supported. Freeze symbols, build IDs and device set. Score:

- capture rate;
- symbolication;
- grouping;
- breadcrumbs/context;
- build correlation;
- crash-free health;
- alert latency;
- privacy controls;
- time-to-root-cause for a blinded evaluator;
- runtime/build overhead.

## Benchmark C — remote config and experiment safety

Use one typed config schema with local defaults. Exercise:

- online/offline cold start;
- invalid response;
- old client/new config;
- cohort rollout;
- 10% → 50% → 100% rollout;
- emergency rollback;
- A/B assignment persistence;
- config exposure attached to analytics/crash evidence;
- client tampering attempt;
- server-authoritative override boundary.

A provider fails conformance if absence of the service can make the game unbootable or remove the local source-controlled defaults.

## Benchmark D — server observability portability

One authoritative test server emits OTel traces/metrics/logs through a Collector. Route the same signals to at least two backends or one backend plus an open local stack without changing application instrumentation. Measure data fidelity, operational effort, sampling, overhead and switch cost.

---

# 8. Current recommendation hierarchy

This is **research ordering, not production adoption**:

1. **Sentry Unity** — primary cross-platform crash/error benchmark, especially where console support or release-health depth matters.
2. **Firebase Crashlytics + Remote Config** — primary Unity/mobile integrated stability + live-config benchmark.
3. **GameAnalytics** — primary game-specific analytics + Remote Config/A/B benchmark.
4. **PostHog** — primary broad product/agent-operable analytics/flags benchmark for web/app/studio surfaces; Unity requires separate adapter evidence.
5. **OpenTelemetry + Collector** — incumbent vendor-neutral server observability boundary, not a product-analytics replacement.

A practical game may legitimately use GameAnalytics for game analytics, Sentry for crash diagnostics and OpenTelemetry for backend telemetry. Consolidation is valuable only when it lowers real cost/maintenance **without reducing evidence quality or portability**.

---

# 9. Promotion gate

No candidate becomes `EXECUTED`, `preferred` or a default project template until a completed experiment record contains:

- exact SDK/package/service versions;
- immutable source revision where available;
- platform/build/runtime manifest;
- privacy/consent configuration;
- canonical event/config schema revision;
- synthetic/real workload definition;
- raw evidence;
- cost snapshot;
- limitations/failures;
- rollback/removal path;
- explicit promotion decision.

Hosted-service terms and data-processing/privacy terms are reviewed separately from open-source SDK licences.
