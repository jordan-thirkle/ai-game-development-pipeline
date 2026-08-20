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

Mutable vendor documentation is pinned by a project-authored immutable claim snapshot as well as its live provenance URL. The current snapshot is:

- artifact: `research/evidence/liveops/vendor-claims-2026-08-20.md`
- artifact commit: `139129d07402df18cb4bb82312c6264df4c8de92`
- artifact SHA-256: `a55c99d31d40b7d7797f7a686c5247d738d6df7d0236b9ad29b761d1386a71cf`
- retrieval timestamp recorded in artifact: `2026-08-20T04:49:00+01:00`

The snapshot is paraphrased claim evidence, not a substituted copy of vendor docs; live sources must still be rechecked at execution time. Hosted-service/product terms remain separate from SDK licences.

| Evidence ID | Scope | Live primary source | Immutable evidence |
|---|---|---|---|
| `liveops.sentry.unity-4.8.0` | Unity SDK source/release/licence | `https://github.com/getsentry/sentry-unity` | release commit `01f2aacb7ac4e29c3f801cb94ab6be7ca501e01a` |
| `liveops.firebase.unity-release` | Firebase Unity SDK release | `https://firebase.google.com/support/release-notes/unity` | snapshot artifact above, anchor `#liveopsfirebaseunity-release`, SHA-256 above |
| `liveops.firebase.crashlytics-unity` | Crashlytics Unity collection/crash/symbolication behavior | Firebase Crashlytics Unity customize/get-started docs | snapshot anchor `#liveopsfirebasecrashlytics-unity`, SHA-256 above |
| `liveops.firebase.remote-config-unity` | Remote Config defaults/fetch/activate/realtime behavior | Firebase Remote Config Unity get-started/realtime/quotas docs | snapshot anchor `#liveopsfirebaseremote-config-unity`, SHA-256 above |
| `liveops.gameanalytics.unity-8.0.1` | Unity SDK source/release/licence | `https://github.com/GameAnalytics/GA-SDK-UNITY` | commit `af7b0d28dc607b8cb0b2daddf60a813635d1abfe` |
| `liveops.gameanalytics.ab` | A/B enrollment/limits/enhanced-JSON compatibility | current GameAnalytics A/B docs | snapshot anchor `#liveopsgameanalyticsab`, SHA-256 above |
| `liveops.posthog.unity-1.1.1` | first-party Unity SDK source/release/licence | `https://github.com/PostHog/posthog-unity` | release commit `79b930c851b0acc9a04ae2262745fc8402f71a58` |
| `liveops.posthog.unity-docs` | queueing/flags/experiments/error/platform behavior | `https://posthog.com/docs/libraries/unity` | snapshot anchor `#liveopsposthogunity-docs`, SHA-256 above |
| `liveops.otel` | vendor-neutral instrumentation/Collector role | OpenTelemetry docs / what-is / Collector docs | snapshot anchor `#liveopsotel`, SHA-256 above |

Pricing, retention, DPA/region availability and hosted-plan limits are **not frozen by this table** unless explicitly captured in a benchmark run manifest.

---

# 1. Canonical telemetry contract

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

`event_id` is generated once at the canonical event boundary and is globally unique for that logical event. Retries, fan-out, local persistence and replay **reuse the same `event_id`**.

The canonical transport is **at-least-once internally with deduplication by `event_id` wherever the provider/export path permits it**. Provider APIs that cannot preserve an idempotency key are recorded as having weaker duplicate guarantees. Replayed events retain original occurrence time, ID, schema version and session sequence.

`session_sequence` is monotonic only within one canonical session. `occurred_at_utc` is the comparable event time. `monotonic_elapsed_ms_optional` is only for local durations and never an epoch timestamp.

Queues are bounded by both event count and encoded bytes. On overflow, low-priority events drop before high-value lifecycle/economy/purchase/error events according to a versioned project-owned table. Drop counts/reasons/high-water marks are themselves bounded diagnostics.

## Typed payload bounds

Each stable `event_name` has a versioned allowlist/schema. Canonical baseline:

- scalar types by default: boolean, bounded integer/decimal, bounded UTF-8 string, enumerated string;
- arrays/objects only when explicitly declared;
- maximum nesting depth **2**;
- maximum custom properties **32**;
- key length **64 UTF-8 bytes**;
- string value **256 UTF-8 bytes** unless stricter;
- maximum canonical encoded event **16 KiB** before provider mapping;
- logs, stack traces, chat, prompts, transcripts and arbitrary user text are not analytics properties;
- high-cardinality identifiers require explicit schema review and are not provider dimensions/tags by default.

Provider adapters may be stricter but may not silently widen the canonical privacy/cardinality contract.

Stable domain names include `session_started`, `session_ended`, `onboarding_step_completed`, `level_started`, `level_completed`, `level_failed`, `reward_granted`, `currency_earned`, `currency_spent`, `purchase_started`, `purchase_completed`, `ad_impression`, `ad_reward_granted`, `match_started`, `match_completed`, `progression_changed`, `feature_exposed`, and `error_recovered`.

## Consent and privacy state machine

```text
unknown -> granted | denied
granted -> revoked
denied -> granted
revoked -> granted | denied
```

Before `granted`, app-controlled optional analytics is neither uploaded nor persisted to a cross-launch queue by default. On grant, new eligible events may flow; pre-grant events are not retroactively uploaded by default. On revoke, adapters stop optional capture/upload, purge project queues, rotate/revoke project-controlled pseudonymous analytics identifiers where applicable, and invoke only provider controls that actually exist.

Already-uploaded data follows provider deletion/export capabilities; the project never promises deletion the provider cannot deliver.

Provider-managed crash SDKs are separate. Current Firebase Crashlytics Unity docs state crash information can remain stored locally while automatic collection is disabled and later be sent if enabled. Every crash benchmark records exact local caching/re-enable/purge/identifier/server-deletion behavior for its SDK/platform version.

No direct PII belongs in the default telemetry contract. Crash breadcrumbs/context receive the same privacy review. Remote config is never a secret, entitlement or anti-cheat authority store.

Frozen consent tests cover fresh/unknown, denied, granted, revoke/regrant, offline, restart, project queues, provider-managed cached crash reports, identifier rotation and deletion/export workflows.

---

# 2. Crash / error incumbents

## Sentry Unity

Pinned release commit: `01f2aacb7ac4e29c3f801cb94ab6be7ca501e01a`  
Release: **4.8.0 — 2026-07-30**  
SDK repository licence: **MIT**  
Evidence: **SOURCE-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **CROSS-PLATFORM GAME CRASH/ERROR BENCHMARK**

Benchmark caught/unhandled managed exceptions, native/IL2CPP where supported, symbolication, release correlation, breadcrumbs/context, crash-free health, offline delivery, privacy/consent, alert latency, runtime/build overhead, development-build filtering and console feasibility where applicable. Console support is only proven with required platform access.

Hosted-service terms/retention/data processing remain separate from SDK licensing.

## Firebase Crashlytics for Unity

Observed vendor release reference: **Firebase Unity SDK 13.14.0 — 2026-07-17**  
Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **MOBILE/UNITY CRASH + FIREBASE-SUITE BENCHMARK**

Current Unity docs cover managed/native reporting, caught exceptions, logs/custom keys, identifiers and optional Analytics breadcrumbs. Android IL2CPP symbolication requires matching symbols to be **generated and uploaded** for the exact build.

Automatic collection is default but configurable. Current docs explicitly state local crash information may be retained while disabled and sent after later enablement; that path is a required privacy benchmark.

Use the same failure matrix/build as Sentry. Do not run two native crash SDKs simultaneously until coexistence, handler ordering and overhead are proven.

---

# 3. Game/product analytics incumbents

## GameAnalytics Unity

Pinned source commit: `af7b0d28dc607b8cb0b2daddf60a813635d1abfe`  
Release: **8.0.1 — 2026-06-11**  
SDK licence: **MIT**  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **GAME-SPECIFIC ANALYTICS + CONFIG/EXPERIMENT BENCHMARK**

Current product docs cover analytics, Remote Config/A-B and enhanced JSON config. Current A/B docs describe one active experiment enrollment per user, no enrollment during a first qualifying offline session, a 1,000,000-user ceiling, and enhanced-config SDK compatibility constraints.

Benchmark retention, onboarding, progression/failure, economy, lawful acquisition segmentation, ad/IAP correlation, cardinality, operator answer time, export/API access, ingest delay, offline behavior, SDK overhead, privacy/deletion/export, config fallback and assignment reproducibility.

## PostHog Unity

Pinned release commit: `79b930c851b0acc9a04ae2262745fc8402f71a58`  
Release: **1.1.1 — 2026-07-29**  
SDK licence: **MIT** with inherited notices where stated  
Evidence: **SOURCE-VERIFIED SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **CROSS-PRODUCT + UNITY ANALYTICS/FLAGS/ERROR BENCHMARK**

PostHog has a first-party Unity SDK with queued/asynchronous delivery, analytics, flags/experiments and error tracking. Current Unity docs scope Session Replay as supported on **Windows/macOS/Linux, iOS and Android**, unsupported on **WebGL**, with console support unestablished by this research. WebGL persistence/CORS constraints remain separate benchmark inputs.

Benchmark install/removal, canonical ID mapping, queue/offline/consent behavior, funnels/cohorts, flags/assignments/exposure, error tracking, platform constraints, export, API/MCP operability, cost and privacy/security.

---

# 4. Remote config / rollout / experiments

## Firebase Remote Config + A/B Testing

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **UNITY/MOBILE LIVE-CONFIG BENCHMARK**

Unity supports in-app defaults plus explicit fetch/cache/activation, targeting, rollout and A/B. Real-time updates on supported Android/Apple targets require **Firebase Unity SDK 11.0.0+ and the Firebase Remote Config Realtime API enabled**.

Realtime uses a foreground HTTP connection; listener registrations share it; final listener removal closes it; backgrounding stops listening and foregrounding restarts. Current docs state a **20,000,000 concurrent open real-time connection** project limit, with rejected incremental connections able to fall back to standard fetch and a documented propagation exception after publishing a new template.

Every run records SDK version, API enabled state, listener lifecycle, background/foreground behavior, quota assumption, standard-fetch fallback, fetch/activate policy, and setup failures separately from capability failures.

Typed source-controlled defaults remain authoritative fallback; remote config never becomes the only definition of critical gameplay state.

## GameAnalytics Remote Config + A/B

Evidence: **VENDOR-DOC CLAIM + SOURCE-PINNED SDK; NOT BYJTT EXECUTED**  
Disposition: **GAME-SPECIFIC CONFIG/EXPERIMENT BENCHMARK**

Benchmark version identifiers, targeted overrides, enhanced JSON compatibility, defaults/readiness/update behavior and old-client compatibility.

## PostHog Feature Flags + Experiments

Evidence: **SOURCE-VERIFIED UNITY SDK + VENDOR-DOC PRODUCT CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **UNITY/WEB/APP ROLLOUT BENCHMARK**

Flags/experiments are benchmarked directly in Unity, but provider calls remain outside economy, entitlement and anti-cheat logic.

---

# 5. Backend/server observability

## OpenTelemetry

Evidence: **SOURCE/SPEC-VERIFIED; NOT BYJTT EXECUTED**  
Disposition: **VENDOR-NEUTRAL SERVER TELEMETRY CONTRACT BENCHMARK**

OpenTelemetry is the instrumentation/collection/export boundary for traces, metrics and logs and is **not an observability backend**. The Collector is a vendor-agnostic receive/process/export layer.

Stable resource attributes include `service.name`, `service.version`, `service.instance.id`, `deployment.environment`, `byjtt.game_id`, `byjtt.build_id`, `byjtt.region`, `byjtt.server_provider` and `byjtt.server_image_digest`. Direct PII/tokens/chat/arbitrary payloads are forbidden.

Benchmark OTLP via Collector, cross-service traces, loop/tick metrics, allocation/startup, error/log correlation, sampling, outage/backpressure, backend swap and cardinality/cost.

---

# 6. Provider-neutral live-ops runtime contract

```text
AnalyticsSink.capture(event: TelemetryEvent) -> CaptureResult
AnalyticsSink.flush(deadline_ms) -> FlushResult
CrashSink.captureException(error, CrashContext) -> CaptureResult
CrashSink.setRelease(build_id)
ConfigProvider.getSnapshot<T>(schema: ConfigSchema<T>, defaults: T) -> ConfigSnapshot<T>
ExperimentProvider.getAssignments(context: ExperimentContext) -> ExperimentSnapshot
ServerTelemetry.startSpan(name, BoundedAttributes) -> SpanHandle
ServerTelemetry.recordMetric(name, value, BoundedAttributes)
```

```text
CaptureResult
  status = accepted | dropped | disabled
  drop_reason_required_when_dropped = queue_full | payload_invalid | payload_too_large | consent_not_granted | retention_expired | retry_budget_exhausted | provider_rejected | adapter_disabled | sampled_out | other_bounded
  queue_depth

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

OpaqueProjectId
  encoding = lowercase_hex
  bytes_before_encoding = 16
  encoded_length = 32_ASCII_chars
  semantics = opaque_no_embedded_PII_or_business_meaning

ExperimentContext
  consent_state
  install_id_pseudonymous_optional: OpaqueProjectId
  player_id_pseudonymous_optional: OpaqueProjectId
  session_id_pseudonymous_optional: OpaqueProjectId
  locale_optional
  platform
  release_channel
  game_mode_optional
  approved_cohort_attributes{}

ExperimentContextValidation
  status = valid_pseudonymous | valid_anonymous | invalid_consent | invalid_identifier | invalid_attribute | invalid_required_field
  provider_call_allowed
  reason_code

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
  context_available
  context_validation_status
  provider_call_attempted
```

`OpaqueProjectId` is generated or privacy-preservingly transformed by project-owned code before provider evaluation. A generated ID uses 128 bits of cryptographically secure randomness. A stable transformed ID may use an environment-scoped keyed one-way derivation and truncate to 128 bits before the fixed lowercase-hex encoding. Raw emails, phone numbers, account names, platform IDs, auth tokens, database keys, or strings merely *labelled* pseudonymous are invalid. IDs that are not exactly 32 lowercase hexadecimal ASCII characters are rejected before any provider call.

`ExperimentContext` is allowlisted and privacy-bounded. `platform` and `release_channel` are always required; `consent_state` is always required. `approved_cohort_attributes` follows canonical scalar/type discipline, max **16 attributes**, each max **128 UTF-8 bytes**; no direct PII or unbounded identifiers.

Before `getAssignments` can call a provider, the canonical layer produces `ExperimentContextValidation`. `consent_state != granted` yields `invalid_consent` and `provider_call_allowed=false`. Invalid opaque IDs, attributes, or required fields similarly suppress the provider call. A consent-granted context containing only required fields (`platform`, `release_channel`, `consent_state`) is `valid_anonymous` **only when the frozen experiment contract explicitly declares `identity_requirement=anonymous_allowed`**; otherwise it is unusable for that experiment and the provider is not called. A context with at least one valid required pseudonymous identity field is `valid_pseudonymous` when the experiment contract permits that identity scope.

If the context is invalid or an experiment disallows anonymous evaluation, gameplay receives an empty assignment snapshot or a locally deterministic privacy-approved fallback only when the frozen experiment contract explicitly defines one. It never invents identity, blocks boot, or silently changes to a different provider identity policy.

`drop_reason` is mandatory exactly for `status=dropped` and omitted for accepted/disabled. `other_bounded` requires a project-owned bounded subcode.

## Canonical experiment exposure boundary

The project owns **one exposure boundary: first eligible product/gameplay use of the assigned variant** — not assignment fetch, flag download, config activation, or provider callback. Every adapter suppresses its own automatic exposure semantics where possible or maps them so the canonical layer remains authoritative.

Canonical exposure identity is derived from:

```text
experiment_id
experiment_version
assignment_id
exposure_boundary_id = first_eligible_feature_use
```

The resulting `exposure_key` is persisted for the lifetime of that assignment after the canonical exposure event has been accepted into the project queue. Retries/replay reuse the same canonical `event_id`; restart does not create a second exposure for an already-recorded key. Provider sinks that cannot accept a dedupe/idempotency identifier are explicitly scored with weaker guarantees.

Consent governs emission. If exposure telemetry is not permitted when the first feature use occurs, **no exposure event is emitted and no retroactive event is fabricated**. If consent later permits telemetry and the assigned feature is used again while the assignment is still valid, that later eligible use becomes the first emit-capable boundary and records the exposure once. Assignment fetch alone never counts as exposure.

Gameplay receives domain events, typed config snapshots or immutable assignments; provider SDKs are not imported directly into game rules.

## Failure semantics

- capture is non-blocking and returns accepted/dropped/disabled;
- flush has a deadline and cannot block shutdown indefinitely;
- queues have frozen count/byte bounds and deterministic overflow;
- retries use capped exponential backoff+jitter and max retention age;
- retries preserve canonical IDs;
- analytics/crash infrastructure cannot block or crash gameplay;
- missing/invalid remote config yields validated source defaults;
- feature flags cannot grant purchases/entitlements/server authority;
- assignment persistence is explicit;
- exposure follows the single canonical boundary above;
- duplicate sinks must prove value/overhead before simultaneous production use.

---

# 7. Frozen benchmark families

## Game analytics conformance

Instrument one identical vertical slice. Measure event loss, duplicate rate, schema rejection/drop, queue behavior, query latency, usability, exportability, cost, overhead and replacement cost. Inject same-ID retries, restart, offline replay, duplicates, queue overflow, oversized payload, excessive cardinality, invalid property type and out-of-order delivery.

## Crash fidelity and privacy

Use one release build/failure matrix. Score capture, symbolication, grouping, context, release correlation, health, alerts, privacy and root-cause time across consent, offline/restart and cached-report transitions.

## Remote config and experiment safety

Use source-controlled typed defaults. Exercise offline/online, timeout, invalid response, old-client mismatch, stale cache, rollout, rollback, assignment persistence, the **first-eligible-feature-use** exposure boundary and dedupe, missing/denied/invalid-identifier `ExperimentContext`, anonymous-allowed versus identity-required experiments, consent transitions, tampering and server-authoritative boundaries. Firebase runs also exercise Realtime API-disabled setup, listener lifecycle and standard-fetch fallback.

For every missing, denied or invalid experiment context case, raw run evidence must record: `context_available`, `context_validation_status`, consent state, assignment source/fallback outcome, `provider_call_attempted`, provider-call suppression reason, and whether the game reached the expected boot/playable checkpoint. A documented fallback does not pass without these observations.

## Server observability portability

Emit OTel signals through Collector to two destinations without changing application instrumentation. Measure fidelity, operations, sampling, outage/backpressure, overhead, cost and switch effort.

---

# 8. Role benchmark matrix — explicitly unranked

These are **candidate roles to benchmark, not provider rankings or production recommendations**. Ordering has no meaning.

| Candidate | Roles under test | Why it belongs in the benchmark | Promotion boundary |
|---|---|---|---|
| Sentry Unity | crash/error/release health | source-pinned Unity SDK; cross-platform crash/release-health benchmark | completed crash benchmark only |
| Firebase Crashlytics + Remote Config | crash + mobile/Unity config/rollout | integrated Unity/mobile benchmark with explicit cached-crash/realtime prerequisites | completed role-specific benchmarks only |
| GameAnalytics | game analytics + config/A-B | game-oriented event/config/experiment model | completed analytics/config benchmarks only |
| PostHog Unity | analytics + flags/experiments + error tracking | first-party Unity SDK plus broader product/agent-operable surface | completed role-specific benchmarks only |
| OpenTelemetry + Collector | backend/server observability boundary | vendor-neutral instrumentation/export model | completed server-observability benchmark only |

A real game may compose multiple providers. No row is `preferred`, “primary,” a default template, or a recommendation until a completed experiment record makes that decision for the relevant role.

---

# 9. Promotion gate

No candidate becomes `EXECUTED`, `preferred` or default until a completed experiment record contains:

- exact SDK/package/service versions;
- immutable source revision where available;
- for **every mutable source claim**: live URL, snapshot artifact path, immutable artifact revision, artifact SHA-256, section anchor and retrieval timestamp;
- platform/build/runtime manifest;
- consent state-machine evidence;
- canonical event/config/ExperimentContext revision;
- OpaqueProjectId generation/derivation policy and invalid-identifier rejection evidence;
- queue/retry/drop/idempotency configuration;
- canonical exposure-boundary/dedupe configuration;
- provider prerequisites;
- frozen workload;
- raw duplicate/loss/drop evidence;
- missing/denied/invalid ExperimentContext evidence including context availability/validation, consent, fallback assignment source, provider-call suppression and boot/playable result;
- provider cache/deletion/export behavior;
- cost snapshot;
- failures/limitations;
- rollback/removal path;
- explicit role-specific promotion decision.

Hosted-service and data-processing/privacy terms remain separate from open-source SDK licences.