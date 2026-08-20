# Release / Store-Publishing Vendor Claim Snapshot — 2026-08-20

Snapshot purpose: preserve the exact mutable provider claim set used by `AI-GAME-RELEASE-PUBLISHING-SYSTEMS-2026-08.md` while retaining live first-party URLs for re-verification.

Retrieved: **2026-08-20T05:02:00+01:00** (`Europe/London`)

Rules:
- Project-authored paraphrase only; this is not a copy of vendor documentation.
- The Git revision containing this file is the immutable claim-snapshot revision.
- Live first-party sources must be rechecked at execution time.
- Account, legal, commercial, tax/banking and developer-program terms are separate from tool/API capability claims.

## release.apple.app-store-connect
Sources:
- `https://developer.apple.com/documentation/appstoreconnectapi/apps`
- `https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app`
- `https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds`
Claim scope:
- App Store Connect `apps` API manages existing app records and is not the mechanism for creating a new app record.
- A new app record is created in App Store Connect and requires applicable role/access plus current agreements.
- After an app record exists, builds can be uploaded with Xcode, Transporter, or `altool`; App Store Connect API keys/JWTs can be used with Transporter authentication.
- Uploaded builds require Apple-side processing before becoming available in App Store Connect.

## release.apple.notarisation
Source:
- `https://developer.apple.com/documentation/technotes/tn3147-migrating-to-the-latest-notarization-tool`
Claim scope:
- `altool` is deprecated and no longer accepted for **notarisation**; `notarytool` is the current notarisation path.
- The deprecation does not mean `altool` is universally deprecated for unrelated App Store upload tasks; Apple still documents it for app submission/upload workflows.

## release.google-play.edits
Sources:
- `https://developers.google.com/android-publisher/edits`
- `https://developers.google.com/android-publisher/concurrency-considerations`
- `https://developers.google.com/android-publisher/api-ref/rest/v3/edits`
- `https://developers.google.com/android-publisher/api-ref/rest/v3/edits/validate`
- `https://developers.google.com/android-publisher/api-ref/rest/v3/edits/commit`
Claim scope:
- Publishing API Edits group supported app changes transactionally; changes in an edit do not take effect until commit.
- Edits are for an existing app with an initial artifact already uploaded through Play Console; legal publishing consents are not completed by this API.
- An `AppEdit` exposes an `id` and `expiryTimeSeconds`.
- Play Console changes invalidate active API edits.
- Creating a new edit invalidates another active edit by the same API user for that app.
- Multiple users may hold edits until one commits; a committed edit invalidates other active edits for the app.
- Invalidated/expired edits must not be blindly retried; create a replacement edit, reapply the intended canonical manifest, validate, then commit the replacement.
- `edits.commit` behavior around changes already in review has explicit options and must be frozen in the release manifest rather than accepted as an implicit provider default.

## release.steam.steampipe
Sources:
- `https://partner.steamgames.com/doc/sdk/uploading`
- `https://partner.steamgames.com/doc/store/application/branches`
Claim scope:
- SteamPipe/SteamCMD uploads content/depot manifests and produces a global BuildID.
- `SetLive` in the app build script may automatically publish a successful build to a named beta branch.
- The default branch cannot be set live automatically using `SetLive`; current Steamworks documentation requires the default branch to be set live through App Admin.
- Preview builds and Local Content Server flows exist for testing before a public/default-branch release.

## release.itch.butler
Sources:
- `https://itch.io/docs/butler/installing.html`
- `https://itch.io/docs/butler/pushing.html`
- `https://itch.io/docs/butler/launcher-integration.html`
Claim scope:
- Butler supports `butler push <directory-or-zip> <user>/<game>:<channel>` and incremental upload behavior.
- Broth endpoints are automation-friendly; a `/LATEST/` archive endpoint is permanent as a URL but resolves to the latest version and is therefore **not immutable**.
- The current launcher-integration docs expose the versioned form `https://broth.itch.zone/butler/<os>-<arch>/<version>/archive/default` after resolving a version from the platform `LATEST` endpoint.
- A reproducible CI benchmark must record the resolved Butler version and archive hash before extraction/execution; the official installation path itself does not constitute a project-owned immutable version pin.

## release.fastlane.metrics
Sources:
- `https://docs.fastlane.tools/`
- `https://docs.fastlane.tools/actions/opt_out_usage/`
Claim scope:
- Fastlane collects anonymous usage metrics by default.
- Metrics can be disabled by placing `opt_out_usage` at the top of the Fastfile or setting `FASTLANE_OPT_OUT_USAGE`.
- Controlled benchmark/release automation must record that opt-out state and treat missing opt-out configuration as a failed privacy preflight unless explicitly approved otherwise.
