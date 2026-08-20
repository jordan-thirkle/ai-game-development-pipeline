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

The canonical event/config model belongs to the game project. Provider SDK objects, dashboard IDs and proprietary event names are adapters only. A provider can fill more than one role, but benchmark results are recorded per role.

---

# 1. Canonical telemetry contract

Every production game should be able to route the same approved telemetry envelope to one or more providers:

```text
TelemetryEvent
  schema_version
  event_id
  event_name
  occurred_at_utc
  monotonic_elapsed_ms_optional
  session_sequence
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
  properties_typed{}
```

## Event identity and delivery semantics

`event_id` is generated once at the canonical event boundary and is globally unique for that logical event. Retries, fan-out to multiple sinks, local persistence and replay **reuse the same `event_id`**. An adapter must never generate a fresh ID merely because delivery is retried.

The canonical transport is **at-least-once internally with deduplication by `event_id` wherever the provider/export path permits it**. Provider APIs that cannot preserve an idempotency key are recorded as having weaker duplicate guarantees and are scored accordingly. Replayed events retain original occurrence time, original `event_id`, schema version and session sequence.

`session_sequence` is monotonic only within one canonical session and provides deterministic local ordering evidence. Cross-device/global ordering is not inferred from it. `occurred_at_utc` is the canonical comparable event time. `monotonic_elapsed_ms_optional` is only for local durations and must never be interpreted as an epoch timestamp.

Queues are bounded by both event count and encoded bytes. On overflow, low-priority events are dropped before high-value lifecycle/economy/purchase/error events according to a versioned project-owned priority table. Drop counts, reasons and queue high-water marks are themselves observable through bounded internal counters. Telemetry must never consume unbounded disk, memory or retry time.

## Typed payload bounds

`properties_typed{}` is not an arbitrary JSON dumping ground. Each stable `event_name` has a versioned allowlist/schema. The canonical baseline is:

- scalar types only by default: boolean, bounded integer/decimal, bounded UTF-8 string, and enumerated string;
- arrays/objects only when explicitly declared by that event schema;
- maximum nesting depth: **2**;
- maximum custom properties per event: **32**;
- maximum property-key length: **64 bytes UTF-8**;
- maximum string value: **256 bytes UTF-8** unless an event schema declares a smaller bound;
- maximum canonical encoded event payload before provider mapping: **16 KiB**;
- free-form logs, stack traces, chat, prompts, transcripts and arbitrary user text are not analytics properties;
- high-cardinality identifiers require explicit schema review and must not be promoted into provider dimensions/tags by default.

Provider adapters may impose stricter limits but may not silently widen the canonical privacy/cardinality contract. A rejected/trimmed property produces a bounded diagnostic counter rather than blocking gameplay.

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

Provider adapters translate these to provider-native forms; game/domain code never emits provider-specific names directly.

## Consent and privacy state machine

Canonical collection state is explicit:

```text
unknown -> granted | denied
granted -> revoked
denied -> granted
revoked -> granted | denied
```

Before `granted`, app-controlled optional analytics events are not uploaded. The default privacy-safe implementation also does not persist those optional events to a cross-launch queue. Strictly necessary local operational counters must be separately classified and may not be routed to analytics providers merely by calling them “essential.”

On `granted`, new eligible events may flow. Events captured while consent was not granted are **not retroactively uploaded** unless the product has an explicit lawful, documented requirement and benchmark evidence for that exact behavior.

On `granted -> revoked`, adapters stop new optional capture/upload, purge project-owned unsent queues, rotate/revoke project-controlled pseudonymous analytics identifiers where applicable, and invoke provider-specific opt-out/deletion controls that actually exist. Already-uploaded provider data is governed by that provider’s deletion/export capabilities and documented separately; the project must not claim deletion guarantees a provider cannot deliver.

Provider-managed crash SDKs require separate treatment. For example, current Firebase Crashlytics Unity behavior can retain crash information locally while automatic collection is disabled and later transmit it if collection becomes enabled. Therefore “collection disabled” is not assumed to mean “no local provider cache.” Every crash provider benchmark must record local caching, re-enable behavior, available unsent-report purge controls, identifier behavior and server-side deletion limits for the exact SDK/platform version.

No email, phone, real name, raw IP-derived identity, voice transcript, child identifier or other direct PII belongs in the default telemetry contract. Crash breadcrumbs/custom context receive the same privacy review. Remote config is never a secret, entitlement or anti-cheat authority store.

Frozen consent tests include: fresh install unknown state, unknown→denied, unknown→granted, denied→granted, granted→revoked, revoked→granted, offline transitions, app restart in each state, queued project events, provider-managed cached crash reports, identifier rotation, and deletion/export workflows.

---

# 2. Crash / error incumbents

## Sentry Unity

Official repository: `getsentry/sentry-unity`  
Pinned release commit: `01f2aacb7ac4e29c3f801cb94ab6be7ca501e01a`  
Release: **4.8.0 — 2026-07-30**  
SDK repository licence at pin: **MIT**  
Evidence: **SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT CROSS-PLATFORM GAME CRASH/ERROR BENCHMARK**

The Unity SDK is independently versioned and open-source. Sentry’s current game support materially extends beyond mobile; console feasibility is benchmarked only with the required platform/developer access and never inferred from desktop behavior.

### Required benchmark

- caught/non-fatal managed exception;
- unhandled managed exception;
- native/IL2CPP crash where supported;
- symbol upload and readable production stack;
- build/release/environment correlation;
- breadcrumbs/custom context;
- crash-free users/sessions;
- offline buffering and next-launch delivery;
- privacy/scrubbing and consent behavior;
- alert latency;
- SDK CPU/RAM/network/build-size overhead;
- Unity editor/development-build filtering;
- console path feasibility where applicable.

Repository MIT licensing applies to SDK code only. Hosted-service terms, retention and data processing are separate records.

## Firebase Crashlytics for Unity

Current Unity SDK release observed in official Firebase release notes: **13.14.0 — 2026-07-17**  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT MOBILE/UNITY CRASH BENCHMARK + FIREBASE-SUITE BENCHMARK**

Current Unity documentation covers managed/native crash reporting, caught exceptions, logs/custom keys, identifiers and optional Analytics breadcrumbs. Android IL2CPP symbolication requires generated symbol upload; Apple symbol handling follows the Unity/Xcode path.

Crashlytics collection is automatic by default but supports disabling automatic collection/runtime opt-in. Importantly, current Unity documentation states that crash information can remain stored locally while collection is disabled and can be sent if collection is later enabled. This exact cached-report path is a required privacy benchmark.

### Required benchmark

Use the same failure matrix/build as Sentry and compare symbolication, grouping, actionable context, non-fatal/fatal semantics, crash-free metrics, alerting, build integration, Analytics dependency for breadcrumbs, consent transitions, local cached-report behavior, export/deletion feasibility and mobile cost/ops burden.

Do not run two native crash SDKs in production merely to “have more data” until handler ordering, coexistence and overhead are explicitly tested.

---

# 3. Game/product analytics incumbents

## GameAnalytics Unity

Official repository: `GameAnalytics/GA-SDK-UNITY`  
Pinned source commit: `af7b0d28dc607b8cb0b2daddf60a813635d1abfe`  
Release: **8.0.1 — 2026-06-11**  
SDK repository licence at pin: **MIT**  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT GAME-SPECIFIC ANALYTICS + REMOTE-CONFIG/EXPERIMENT BENCHMARK**

GameAnalytics remains valuable because its model is game-oriented. Current product documentation supports analytics plus Remote Config/A-B testing including enhanced JSON configs; Unity SDK 8.0.0+ is the documented minimum for enhanced JSON support.

Current experiment constraints belong in every run manifest: only one active experiment enrollment per user, no first qualifying offline-session enrollment, a documented 1,000,000-user experiment ceiling, and SDK-version compatibility requirements for enhanced JSON configuration.

### Required benchmark

Using one frozen synthetic dataset plus an instrumented vertical slice, measure retention/cohorts, onboarding, progression/failure, economy source/sink, lawful acquisition segmentation, ad/IAP correlation, cardinality limits, operator answer time, export/API access, ingest delay, offline behavior, SDK overhead, privacy/deletion/export workflow, config fallback/propagation and experiment assignment reproducibility.

Hosted-service pricing/data terms remain separate from the MIT SDK.

## PostHog Unity

Official repository: `PostHog/posthog-unity`  
Pinned release commit: `79b930c851b0acc9a04ae2262745fc8402f71a58`  
Release: **1.1.1 — 2026-07-29**  
SDK repository licence at pin: **MIT**, with files derived from Sentry explicitly carrying their applicable notice  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **CROSS-PRODUCT + UNITY ANALYTICS/FLAGS/ERROR BENCHMARK**

PostHog now has a first-party Unity SDK. The current Unity surface documents asynchronous queueing/batching, configurable queue/batch limits, analytics capture, feature flags/experiments and error tracking. Unity therefore enters the benchmark directly rather than through a hypothetical custom adapter.

This does **not** make PostHog the default. Its unusually broad studio/web/app/game surface and agent-operable product direction are advantages to measure, while Unity platform limitations, WebGL persistence/CORS behavior, privacy controls, failure modes and unsupported features such as Session Replay on Unity must be frozen in the exact benchmark manifest.

### Required benchmark

- first-party Unity install/update/removal friction;
- canonical event mapping and `event_id` preservation where feasible;
- queue/batch overflow and offline behavior;
- consent opt-in/opt-out plus restart behavior;
- funnels/retention/cohorts;
- feature flags and experiment assignment/exposure;
- error tracking versus dedicated crash providers;
- WebGL storage/CORS limitations;
- session-replay unavailability on Unity;
- warehouse/export portability;
- API/MCP/agent operability;
- cost at realistic analytics + flag volumes;
- cloud-region/privacy/security requirements.

PostHog is not allowed to become the canonical telemetry schema merely because its control surface is attractive.

---

# 4. Remote config / rollout / experiments

## Firebase Remote Config + A/B Testing

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **UNITY/MOBILE LIVE-CONFIG BENCHMARK**

Firebase Remote Config supports Unity with in-app defaults, targeted overrides, rollouts and A/B tests. Current Unity documentation supports real-time Remote Config updates on Android/Apple with Firebase Unity SDK 11.0.0+.

The safety property is source-controlled typed defaults plus explicit validation/fetch/activation. Remote values are overrides, never the only definition of a gameplay-critical value.

## GameAnalytics Remote Config + A/B

Evidence: **VENDOR-DOC CLAIM; SDK SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **GAME-SPECIFIC CONFIG/EXPERIMENT BENCHMARK**

Current docs support string/enhanced-JSON configs, version identifiers, targeted values and A/B overrides. Older-client compatibility is part of the benchmark because enhanced configs require compatible SDK versions.

## PostHog Feature Flags + Experiments

Evidence: **SOURCE-VERIFIED UNITY SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **UNITY/WEB/APP + AGENT-OPERATED ROLLOUT BENCHMARK**

The first-party Unity SDK means flags/experiments are benchmarked on Unity directly. Provider calls still remain outside economy, entitlement and anti-cheat logic: gameplay receives a validated typed snapshot/assignment from the boundary.

---

# 5. Backend/server observability

## OpenTelemetry

Official docs: `https://opentelemetry.io/docs/`  
Evidence: **SOURCE/SPEC-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT VENDOR-NEUTRAL SERVER TELEMETRY CONTRACT**

OpenTelemetry is the open vendor-neutral instrumentation/collection/export boundary for traces, metrics and logs. It is deliberately **not an observability backend**. The Collector provides a vendor-agnostic receive/process/export layer, allowing backend changes without re-instrumenting authoritative servers and services.

Stable resource attributes include `service.name`, `service.version`, `service.instance.id`, `deployment.environment`, `byjtt.game_id`, `byjtt.build_id`, `byjtt.region`, `byjtt.server_provider` and `byjtt.server_image_digest`. Bounded-cardinality session correlation is allowed where justified; raw PII, tokens, chat content and arbitrary payloads are not.

Required benchmarks cover OTLP via Collector, cross-service traces, server loop/tick metrics, allocation/startup timing, error/log correlation, sampling under load, collector outage/backpressure, backend swap without instrumentation change, and cardinality/cost guardrails.

---

# 6. Provider-neutral live-ops runtime contract

Canonical code should expose typed boundaries equivalent to:

```text
AnalyticsSink.capture(event: TelemetryEvent) -> CaptureResult
AnalyticsSink.flush(deadline_ms) -> FlushResult
CrashSink.captureException(error, CrashContext) -> CaptureResult
CrashSink.setRelease(build_id)
ConfigProvider.getSnapshot<T>(schema: ConfigSchema<T>, defaults: T) -> ConfigSnapshot<T>
ExperimentProvider.getAssignments(context) -> ExperimentSnapshot
ServerTelemetry.startSpan(name, BoundedAttributes) -> SpanHandle
ServerTelemetry.recordMetric(name, value, BoundedAttributes)
```

```text
CaptureResult
  accepted | dropped | disabled
  drop_reason_optional
  queue_depth

FlushResult
  delivered_count
  retained_count
  dropped_count
  timed_out

ConfigSnapshot<T>
  schema_id
  schema_version
  source = local_default | cached_remote | fresh_remote
  provider_optional
  provider_config_version_optional
  fetched_at_utc_optional
  validated
  fallback_reason_optional
  value: T

ExperimentAssignment
  experiment_id
  experiment_version
  variant
  assignment_id
  assignment_source
  assigned_at_utc
  persistence_scope
  exposure_event_id_optional

ExperimentSnapshot
  assignments[]
  provider_optional
  generated_at_utc
```

Gameplay systems receive domain events, typed configuration snapshots or immutable experiment assignments. They do not import Firebase, GameAnalytics, PostHog, Sentry or an observability backend directly.

## Failure semantics

- `capture()` is non-blocking with respect to gameplay; it either accepts to a bounded local queue, drops with an explicit reason, or reports disabled collection.
- `flush()` accepts a deadline and never blocks game shutdown indefinitely.
- queues have frozen count/byte bounds and deterministic overflow policy;
- retries use capped exponential backoff with jitter and a maximum retention age;
- retries preserve canonical `event_id`;
- analytics failure never blocks gameplay;
- crash reporting must not cause a second crash;
- missing/invalid remote config yields a validated source-controlled local default snapshot;
- a feature flag cannot grant purchases, entitlements or server authority by itself;
- assignment persistence scope is explicit rather than provider-default magic;
- experiment exposure is emitted once per defined exposure boundary with a canonical event ID;
- every production SDK has an operational kill switch/collection policy where practical;
- duplicate simultaneous sinks must prove value and overhead before production use.

---

# 7. Frozen benchmark families

## Benchmark A — game analytics conformance

Instrument one identical vertical slice and answer the same retention, onboarding, progression, economy, monetisation, segmentation, release-comparison and raw-export questions. Measure implementation time, event loss, duplicate rate, schema-rejection/drop rate, queue behavior, query latency, dashboard usability, exportability, cost, SDK overhead and provider replacement cost.

The test matrix includes retries with the same `event_id`, process restart, offline replay, duplicate injection, queue overflow, oversized payload, excessive cardinality, invalid property type and out-of-order delivery.

## Benchmark B — crash fidelity and privacy

Use the same release build and controlled managed/native failure matrix. Score capture, symbolication, grouping, context, release correlation, crash-free health, alert latency, privacy controls and root-cause time. Repeat across consent states, offline/restart, provider-managed cached reports and re-enable/revocation behavior.

## Benchmark C — remote config and experiment safety

Use one typed config schema with source-controlled defaults. Exercise online/offline cold start, fetch timeout, invalid response, old-client/new-config mismatch, cached stale config, rollout progression, emergency rollback, assignment persistence, exposure de-duplication, consent transitions, client tampering and server-authoritative boundaries.

A provider fails conformance if its absence can make the game unbootable, remove local defaults, silently change entitlement/security authority, or make assignment/config provenance unknowable.

## Benchmark D — server observability portability

One authoritative test server emits OTel traces/metrics/logs through a Collector. Route the same instrumentation to two destinations (or one hosted destination plus an open local stack) without application-instrumentation changes. Measure fidelity, operations, sampling, outage/backpressure behavior, overhead, cost and switch effort.

---

# 8. Current recommendation hierarchy

This is **research ordering, not production adoption**:

1. **Sentry Unity** — primary cross-platform crash/error benchmark, especially where release-health depth or console feasibility matters.
2. **Firebase Crashlytics + Remote Config** — primary Unity/mobile integrated stability + live-config benchmark, with cached-crash privacy behavior explicitly tested.
3. **GameAnalytics** — primary game-specific analytics + Remote Config/A-B benchmark.
4. **PostHog Unity** — first-party Unity plus broad product/agent-operable analytics/flags/error benchmark; not promoted above game-specific/dedicated incumbents until execution evidence proves it.
5. **OpenTelemetry + Collector** — incumbent vendor-neutral server observability boundary, not a product-analytics replacement.

A game may legitimately compose GameAnalytics or PostHog for product analytics, Sentry or Crashlytics for crash diagnostics, and OpenTelemetry for backend telemetry. Consolidation matters only when it lowers real cost/maintenance without reducing evidence quality, privacy or portability.

---

# 9. Promotion gate

No candidate becomes `EXECUTED`, `preferred` or a default template until a completed experiment record contains:

- exact SDK/package/service versions;
- immutable source revision where available;
- platform/build/runtime manifest;
- consent state-machine configuration and transition evidence;
- canonical event/config schema revision;
- queue/retry/drop/idempotency configuration;
- synthetic/real workload definition;
- raw evidence including duplicate/loss/drop counts;
- provider cache/deletion/export behavior;
- cost snapshot;
- limitations/failures;
- rollback/removal path;
- explicit promotion decision.

Hosted-service terms and data-processing/privacy terms are reviewed separately from open-source SDK licences.