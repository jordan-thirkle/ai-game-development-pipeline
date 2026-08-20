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

## Reproducible evidence records

Mutable vendor documentation is pinned by retrieval date and claim scope; open-source SDK claims additionally use immutable source commits. Hosted-service/product terms are deliberately separate from SDK licences.

| Evidence ID | Scope | Primary source | Pin / retrieval |
|---|---|---|---|
| `liveops.sentry.unity-4.8.0` | Unity SDK source/release/licence | `https://github.com/getsentry/sentry-unity` | release commit `01f2aacb7ac4e29c3f801cb94ab6be7ca501e01a`; retrieved 2026-08-20 |
| `liveops.firebase.unity-release` | Firebase Unity SDK release | `https://firebase.google.com/support/release-notes/unity` | mutable vendor docs; v13.14.0 dated 2026-07-17; retrieved 2026-08-20 |
| `liveops.firebase.crashlytics-unity` | Crashlytics Unity collection, crash, symbolication behavior | `https://firebase.google.com/docs/crashlytics/unity/customize-crash-reports` and `https://firebase.google.com/docs/crashlytics/unity/get-started` | mutable vendor docs; retrieved 2026-08-20 |
| `liveops.firebase.remote-config-unity` | Remote Config defaults/fetch/activate/realtime behavior | `https://firebase.google.com/docs/remote-config/unity/get-started`, `https://firebase.google.com/docs/remote-config/unity/real-time`, `https://firebase.google.com/docs/remote-config/quotas-limits` | mutable vendor docs; retrieved 2026-08-20 |
| `liveops.gameanalytics.unity-8.0.1` | Unity SDK source/release/licence | `https://github.com/GameAnalytics/GA-SDK-UNITY` | commit `af7b0d28dc607b8cb0b2daddf60a813635d1abfe`; retrieved 2026-08-20 |
| `liveops.gameanalytics.ab` | A/B enrollment, limits and enhanced-JSON compatibility | `https://docs.gameanalytics.com/products-and-features/segment-iq/ab-testing/how-to-create-and-manage-ab-tests/` and `https://docs.gameanalytics.com/products-and-features/segment-iq/ab-testing/best-practices-and-faq/` | mutable vendor docs; retrieved 2026-08-20 |
| `liveops.posthog.unity-1.1.1` | first-party Unity SDK source/release/licence | `https://github.com/PostHog/posthog-unity` | release commit `79b930c851b0acc9a04ae2262745fc8402f71a58`; retrieved 2026-08-20 |
| `liveops.posthog.unity-docs` | queueing, feature flags/experiments, error tracking, platform behavior | `https://posthog.com/docs/libraries/unity` | mutable vendor docs; retrieved 2026-08-20 |
| `liveops.otel` | vendor-neutral instrumentation/Collector role | `https://opentelemetry.io/docs/`, `https://opentelemetry.io/docs/what-is-opentelemetry/`, `https://opentelemetry.io/docs/collector/` | mutable project docs; retrieved 2026-08-20 |

Pricing, retention, DPA/region availability and hosted-plan limits are **not frozen by this table** unless explicitly captured in a benchmark run manifest; they change too quickly to be treated as timeless SDK facts.

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

Provider-managed crash SDKs require separate treatment. Current Firebase Crashlytics Unity documentation states that crash information can remain stored locally while automatic collection is disabled and can later be sent if collection is enabled. Therefore “collection disabled” is not assumed to mean “no local provider cache.” Every crash provider benchmark records local caching, re-enable behavior, available unsent-report purge controls, identifier behavior and server-side deletion limits for the exact SDK/platform version.

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

The Unity SDK is independently versioned and open-source. Console feasibility is benchmarked only with required platform/developer access and never inferred from desktop behavior.

Required benchmark: caught/non-fatal and unhandled managed exceptions; native/IL2CPP where supported; symbolication; release correlation; breadcrumbs/context; crash-free health; offline delivery; privacy/consent; alert latency; CPU/RAM/network/build-size overhead; development-build filtering; and console path feasibility where applicable.

Repository MIT licensing applies to SDK code only. Hosted-service terms, retention and data processing are separate records.

## Firebase Crashlytics for Unity

Current Unity SDK release in official release notes: **13.14.0 — 2026-07-17**  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT MOBILE/UNITY CRASH BENCHMARK + FIREBASE-SUITE BENCHMARK**

Current Unity docs cover managed/native crash reporting, caught exceptions, logs/custom keys, identifiers and optional Analytics breadcrumbs. Android IL2CPP symbolication requires generated symbol upload; Apple symbol handling follows the Unity/Xcode path.

Crashlytics collection is automatic by default but supports disabling automatic collection/runtime opt-in. Current docs explicitly state local crash information may be retained while disabled and sent after later enablement. This cached-report path is a required privacy benchmark.

Use the same failure matrix/build as Sentry. Compare symbolication, grouping, context, fatal/non-fatal semantics, crash-free metrics, alerting, build integration, Analytics dependency for breadcrumbs, consent transitions, cached reports, export/deletion feasibility and mobile cost/ops burden. Do not run two native crash SDKs simultaneously until coexistence and handler ordering are proven.

---

# 3. Game/product analytics incumbents

## GameAnalytics Unity

Official repository: `GameAnalytics/GA-SDK-UNITY`  
Pinned source commit: `af7b0d28dc607b8cb0b2daddf60a813635d1abfe`  
Release: **8.0.1 — 2026-06-11**  
SDK repository licence at pin: **MIT**  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT GAME-SPECIFIC ANALYTICS + REMOTE-CONFIG/EXPERIMENT BENCHMARK**

Current product docs support analytics plus Remote Config/A-B testing including enhanced JSON configs; Unity SDK 8.0.0+ is the documented minimum for enhanced JSON support. Current experiment docs state one active experiment enrollment per user, no assignment when the first qualifying session is offline, a 1,000,000-user maximum, and compatible SDK requirements for enhanced JSON.

Benchmark retention/cohorts, onboarding, progression/failure, economy, lawful acquisition segmentation, ad/IAP correlation, cardinality limits, operator answer time, export/API access, ingest delay, offline behavior, SDK overhead, privacy/deletion/export workflow, config fallback and assignment reproducibility.

Hosted-service pricing/data terms remain separate from the MIT SDK.

## PostHog Unity

Official repository: `PostHog/posthog-unity`  
Pinned release commit: `79b930c851b0acc9a04ae2262745fc8402f71a58`  
Release: **1.1.1 — 2026-07-29**  
SDK repository licence at pin: **MIT**, with applicable inherited Sentry notices retained where stated  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **CROSS-PRODUCT + UNITY ANALYTICS/FLAGS/ERROR BENCHMARK**

PostHog now has a first-party Unity SDK. Current Unity docs describe asynchronous queueing/batching, analytics capture, feature flags/experiments and error tracking. This earns direct Unity benchmarking, not default status.

Benchmark install/update/removal, canonical event mapping and ID preservation, queue overflow/offline behavior, consent/restart behavior, funnels/cohorts, flags/assignments/exposure, error tracking versus dedicated crash incumbents, WebGL storage/CORS constraints, Unity Session Replay availability, export portability, API/MCP operability, cost and privacy/security requirements. Platform/feature claims must be frozen from the exact official Unity docs in the run manifest rather than assumed from another PostHog SDK.

---

# 4. Remote config / rollout / experiments

## Firebase Remote Config + A/B Testing

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **UNITY/MOBILE LIVE-CONFIG BENCHMARK**

Firebase Remote Config supports Unity with source-code in-app defaults, explicit fetch/cache/activate behavior, targeted overrides, rollouts and A/B tests. Current Unity docs support real-time updates on Android/Apple with Firebase Unity SDK 11.0.0+ **and require the Firebase Remote Config Realtime API to be enabled**.

Real-time mode opens a foreground HTTP connection. Listener registrations share that connection; removing the final listener closes it, and the SDK stops listening in background and restarts in foreground. Current Firebase limits projects to **20,000,000 concurrent open real-time connections**. Above the limit, incremental real-time connection requests can be rejected and the client SDK falls back to standard fetch. A newly published template receives a temporary propagation exception to that connection ceiling as documented by Firebase.

Therefore every Firebase realtime benchmark manifest records:

- exact Firebase Unity SDK version;
- Realtime API enabled/disabled state;
- listener registration/removal lifecycle;
- foreground/background transition behavior;
- concurrent-connection quota assumptions;
- standard-fetch fallback path;
- fetch/activate timing policy;
- setup failures separately from provider capability failures.

The safety property remains typed source-controlled defaults plus explicit validation/fetch/activation. Remote values are overrides, never the only definition of a gameplay-critical value.

## GameAnalytics Remote Config + A/B

Evidence: **VENDOR-DOC CLAIM; SDK SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **GAME-SPECIFIC CONFIG/EXPERIMENT BENCHMARK**

Current docs support string/enhanced-JSON configs, version identifiers, targeted values and A/B overrides. Older-client compatibility is part of the benchmark because enhanced configs require compatible SDK versions.

## PostHog Feature Flags + Experiments

Evidence: **SOURCE-VERIFIED UNITY SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **UNITY/WEB/APP + AGENT-OPERATED ROLLOUT BENCHMARK**

The first-party Unity SDK means flags/experiments are benchmarked on Unity directly. Provider calls remain outside economy, entitlement and anti-cheat logic: gameplay receives a validated typed snapshot/assignment from the boundary.

---

# 5. Backend/server observability

## OpenTelemetry

Evidence sources: `liveops.otel` above  
Evidence: **SOURCE/SPEC-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT VENDOR-NEUTRAL SERVER TELEMETRY CONTRACT**

OpenTelemetry is the open vendor-neutral instrumentation/collection/export boundary for traces, metrics and logs and is explicitly **not an observability backend**. The Collector is a vendor-agnostic receive/process/export layer, allowing backend changes without re-instrumenting authoritative servers and services.

Stable resource attributes include `service.name`, `service.version`, `service.instance.id`, `deployment.environment`, `byjtt.game_id`, `byjtt.build_id`, `byjtt.region`, `byjtt.server_provider` and `byjtt.server_image_digest`. Bounded-cardinality session correlation is allowed where justified; raw PII, tokens, chat content and arbitrary payloads are not.

Required benchmarks cover OTLP via Collector, cross-service traces, server loop/tick metrics, allocation/startup timing, error/log correlation, sampling, collector outage/backpressure, backend swap without instrumentation change, and cardinality/cost guardrails.

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

Gameplay systems receive domain events, typed configuration snapshots or immutable experiment assignments. They do not import provider SDKs directly.

## Failure semantics

- `capture()` is non-blocking with respect to gameplay; it either accepts to a bounded queue, drops with explicit reason, or reports disabled collection.
- `flush()` accepts a deadline and never blocks shutdown indefinitely.
- queues have frozen count/byte bounds and deterministic overflow policy;
- retries use capped exponential backoff with jitter and a maximum retention age;
- retries preserve canonical `event_id`;
- analytics failure never blocks gameplay;
- crash reporting must not cause a second crash;
- missing/invalid remote config yields a validated source-controlled local default snapshot;
- a feature flag cannot grant purchases, entitlements or server authority by itself;
- assignment persistence scope is explicit;
- experiment exposure is emitted once per defined boundary with a canonical event ID;
- every production SDK has an operational kill switch/collection policy where practical;
- duplicate simultaneous sinks must prove value and overhead before production use.

---

# 7. Frozen benchmark families

## Benchmark A — game analytics conformance

Instrument one identical vertical slice and answer the same retention, onboarding, progression, economy, monetisation, segmentation, release-comparison and raw-export questions. Measure implementation time, event loss, duplicate rate, schema-rejection/drop rate, queue behavior, query latency, usability, exportability, cost, SDK overhead and replacement cost.

Test retries with the same `event_id`, process restart, offline replay, duplicate injection, queue overflow, oversized payload, excessive cardinality, invalid property type and out-of-order delivery.

## Benchmark B — crash fidelity and privacy

Use the same release build and controlled managed/native failure matrix. Score capture, symbolication, grouping, context, release correlation, crash-free health, alert latency, privacy controls and root-cause time. Repeat across consent states, offline/restart, provider-managed cached reports and re-enable/revocation behavior.

## Benchmark C — remote config and experiment safety

Use one typed config schema with source-controlled defaults. Exercise online/offline cold start, fetch timeout, invalid response, old-client/new-config mismatch, stale cache, rollout progression, emergency rollback, assignment persistence, exposure de-duplication, consent transitions, client tampering and server-authoritative boundaries. For Firebase realtime runs, also exercise API-disabled setup, foreground/background listener lifecycle and the documented standard-fetch fallback path.

A provider fails conformance if its absence can make the game unbootable, remove local defaults, silently change entitlement/security authority, or make assignment/config provenance unknowable.

## Benchmark D — server observability portability

One authoritative test server emits OTel traces/metrics/logs through a Collector. Route the same instrumentation to two destinations (or one hosted destination plus an open local stack) without application-instrumentation changes. Measure fidelity, operations, sampling, outage/backpressure, overhead, cost and switch effort.

---

# 8. Current recommendation hierarchy

This is **research ordering, not production adoption**:

1. **Sentry Unity** — primary cross-platform crash/error benchmark.
2. **Firebase Crashlytics + Remote Config** — primary Unity/mobile integrated stability + live-config benchmark, with cached-crash and realtime prerequisites explicitly tested.
3. **GameAnalytics** — primary game-specific analytics + Remote Config/A-B benchmark.
4. **PostHog Unity** — first-party Unity plus broad product/agent-operable analytics/flags/error benchmark; not promoted above incumbents until execution evidence proves it.
5. **OpenTelemetry + Collector** — incumbent vendor-neutral server observability boundary, not a product-analytics replacement.

A game may legitimately compose providers. Consolidation matters only when it lowers real cost/maintenance without reducing evidence quality, privacy or portability.

---

# 9. Promotion gate

No candidate becomes `EXECUTED`, `preferred` or a default template until a completed experiment record contains:

- exact SDK/package/service versions;
- immutable source revision where available;
- primary-source evidence IDs and mutable-doc retrieval date;
- platform/build/runtime manifest;
- consent state-machine configuration and transition evidence;
- canonical event/config schema revision;
- queue/retry/drop/idempotency configuration;
- provider prerequisites (including Firebase Realtime API/listener mode where applicable);
- synthetic/real workload definition;
- raw evidence including duplicate/loss/drop counts;
- provider cache/deletion/export behavior;
- cost snapshot;
- limitations/failures;
- rollback/removal path;
- explicit promotion decision.

Hosted-service terms and data-processing/privacy terms are reviewed separately from open-source SDK licences.