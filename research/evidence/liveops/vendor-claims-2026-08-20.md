# Live-Ops Vendor Claim Snapshot — 2026-08-20

Snapshot purpose: preserve the exact claim set used by `AI-GAME-LIVEOPS-OBSERVABILITY-SYSTEMS-2026-08.md` without treating mutable live documentation as immutable truth.

Retrieved: **2026-08-20T04:49:00+01:00** (`Europe/London`)

Rules:
- This is a project-authored, paraphrased claim snapshot, not a copy of vendor documentation.
- Live URLs remain the provenance source and must be re-checked at execution time.
- The Git revision containing this file is the immutable snapshot revision.
- Hosted-service terms/pricing are excluded unless explicitly stated.

## liveops.firebase.unity-release
Source: `https://firebase.google.com/support/release-notes/unity`
Claim scope:
- Firebase Unity SDK release notes listed version **13.14.0** dated **2026-07-17** when retrieved.
- The research uses that version only as a current SDK-release reference; execution must pin the actual package version.

## liveops.firebase.crashlytics-unity
Sources:
- `https://firebase.google.com/docs/crashlytics/unity/customize-crash-reports`
- `https://firebase.google.com/docs/crashlytics/unity/get-started`
Claim scope:
- Crashlytics Unity supports managed/non-fatal reporting, custom logs/keys and native-symbol workflows where supported.
- Automatic collection is enabled by default unless configured otherwise.
- With automatic collection disabled, crash information can remain stored locally and can be sent after collection is later enabled.
- Android IL2CPP symbolication requires matching symbols to be generated and uploaded for the released build.
- Google Analytics integration is relevant to breadcrumb-style context and is not treated as mandatory for all Crashlytics functionality.

## liveops.firebase.remote-config-unity
Sources:
- `https://firebase.google.com/docs/remote-config/unity/get-started`
- `https://firebase.google.com/docs/remote-config/unity/real-time`
- `https://firebase.google.com/docs/remote-config/quotas-limits`
Claim scope:
- Unity Remote Config supports source-code/in-app defaults plus fetch/cache/activation of remote values.
- Real-time Remote Config on supported Android/Apple Unity targets requires Firebase Unity SDK 11.0.0+ and the Firebase Remote Config Realtime API enabled.
- Real-time listeners use a foreground HTTP connection, stop/restart with app background/foreground lifecycle, and listener registrations share the connection.
- The documented project ceiling is 20,000,000 concurrent open real-time connections.
- When new real-time connections exceed the applicable limit, the client can fall back to normal fetch behavior; Firebase documents a propagation-related exception after publishing a new template.
- These prerequisites are setup facts, not evidence that a ByJTT game has executed real-time Remote Config successfully.

## liveops.gameanalytics.ab
Sources:
- `https://docs.gameanalytics.com/products-and-features/segment-iq/ab-testing/how-to-create-and-manage-ab-tests/`
- `https://docs.gameanalytics.com/products-and-features/segment-iq/ab-testing/best-practices-and-faq/`
Claim scope:
- Current GameAnalytics A/B documentation constrains users to one active experiment enrollment at a time.
- A user whose first qualifying session is offline is not enrolled during that session.
- Documentation describes a 1,000,000-user experiment ceiling.
- Enhanced JSON Remote Config depends on compatible SDK versions; the Unity research benchmark uses Unity SDK 8.0.1 as a source-pinned candidate.

## liveops.posthog.unity-docs
Source: `https://posthog.com/docs/libraries/unity`
Claim scope:
- PostHog publishes a first-party Unity SDK.
- The Unity SDK documents queued/asynchronous event delivery, analytics, feature flags/experiments and error tracking.
- Session Replay support is documented for Windows/macOS/Linux, iOS and Android; WebGL is documented unsupported.
- This snapshot does not establish console support; consoles remain untested/unknown.
- WebGL has platform-specific persistence/CORS considerations that must be benchmarked on the exact target.

## liveops.otel
Sources:
- `https://opentelemetry.io/docs/`
- `https://opentelemetry.io/docs/what-is-opentelemetry/`
- `https://opentelemetry.io/docs/collector/`
Claim scope:
- OpenTelemetry is a vendor-neutral observability framework for generating/collecting/exporting traces, metrics and logs.
- OpenTelemetry itself is not an observability storage/query backend.
- The Collector is a vendor-agnostic receive/process/export component that can route telemetry to different backends.
- The research treats OTel/Collector as a backend instrumentation boundary, not as product analytics.
