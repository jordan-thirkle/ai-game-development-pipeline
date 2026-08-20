# AI Game Release, Signing and Store-Publishing Systems — 2026-08

Research date: **2026-08-20** (`Europe/London`)  
Execution status: **NOT EXECUTED — source/vendor research only**  
Tested version/configuration status: **no ByJTT store submission, signing, notarisation or production-promotion result is claimed here**  
Registry authority: `../registry/ai-game-dev-registry.v1.json`  
Evaluation authority: `AI-GAME-DEV-EVALUATION-SYSTEMS-2026-08.md`

## Decision

Do **not** model “publishing” as one command or one vendor. Separate five replaceable roles:

1. **artifact build** — deterministic engine/platform build from a pinned source revision;
2. **signing / notarisation / package integrity** — platform identity, certificates, profiles, keys and notarisation where required;
3. **store upload** — binary/package delivery into the platform’s pre-production store state;
4. **store metadata / testing / release orchestration** — listings, release notes, internal/beta tracks, staged rollout and promotion;
5. **human/bootstrap/compliance gates** — developer enrollment, app/product creation where APIs do not support it, agreements, banking/tax, ratings/content declarations and irreversible production decisions.

The canonical release manifest belongs to the project. Fastlane lanes, App Store Connect IDs, Google Play edit IDs, Steam VDF scripts and itch Butler channels are provider adapters, not canonical release state.

A goal of “one-click publish” is valid only after every required human/bootstrap gate has been completed and recorded. Automation must never fabricate acceptance of legal terms or silently bypass a store’s deliberate human boundary.

---

# 1. Canonical release contract

Every release candidate should have one immutable project-owned manifest before any store adapter runs:

```text
ReleaseCandidate
  release_manifest_version
  release_id
  game_id
  source_revision
  build_pipeline_revision
  engine
  engine_version
  platform
  architecture
  build_configuration
  semantic_version
  platform_build_number
  artifact_path
  artifact_sha256
  symbols_path_optional
  symbols_sha256_optional
  sbom_path_optional
  provenance_attestation_optional
  signing_profile_id_or_alias
  release_channel
  store_target
  store_product_id
  changelog_revision
  metadata_revision
  privacy_manifest_revision_optional
  content_rating_revision_optional
  created_at_utc
```

Store adapters return a durable receipt rather than only printing success:

```text
ReleaseReceipt
  release_id
  provider
  provider_product_id
  provider_build_id_or_version_code
  uploaded_artifact_sha256
  uploaded_at_utc
  processing_state
  testing_channel_optional
  rollout_state
  rollout_fraction_optional
  provider_receipt_ids[]
  logs_or_evidence_paths[]
```

No provider may mutate the source artifact between checksum and upload. If a platform requires post-build signing/notarisation/package transformation, the transformed artifact receives its own checksum and provenance step before store upload.

---

# 2. Human bootstrap gates versus repeatable machine gates

The pipeline explicitly classifies each step.

## Human/bootstrap gate

Examples:

- developer-program enrollment and identity verification;
- accepting platform/program agreements;
- tax/banking setup;
- creating an App Store Connect app when the platform API does not permit app creation;
- creating the store/product identity and obtaining package/app/depot IDs;
- first-time permissions/API-access grants;
- content-rating, privacy, encryption/export or age-rating declarations that require accountable human/legal input;
- production launch approval for a new product where no reversible automated path exists.

Human gates are not “pipeline failures.” They become explicit prerequisites with owner, status, evidence and re-check policy.

## Repeatable machine gate

Examples after bootstrap:

- deterministic builds;
- artifact checksums;
- signing with scoped secret access;
- notarisation submission/status checks;
- symbol uploads;
- test-track/beta uploads;
- staged rollout creation/update/halt where the platform supports it;
- store metadata synchronisation;
- release notes/localisations;
- release-state polling;
- reversible beta/default-channel promotion where explicitly permitted and approved.

---

# 3. Apple App Store / TestFlight

Primary sources:

- `https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api`
- `https://developer.apple.com/documentation/appstoreconnectapi/apps`
- `https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds`

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT APPLE STORE API + TRANSPORTER/XCODE BENCHMARK**

Current Apple documentation establishes several important boundaries:

- App Store Connect API access must first be requested by the Account Holder and is approved through App Store Connect;
- role-based API keys can automate supported App Store Connect tasks;
- the `apps` API manages existing apps and explicitly does **not** create a new app — new apps are created in App Store Connect;
- build upload can use Xcode, Transporter/altool paths, with App Store Connect API JWT credentials available for Transporter authentication;
- uploaded builds are asynchronous and require Apple-side processing before appearing in App Store Connect.

Therefore Apple release automation begins **after** account/API/app bootstrap. The pipeline must not claim that an API token alone can create an entire new App Store product from zero.

## Apple signing/notarisation rule

Signing keys, certificates, provisioning material and API private keys never enter Git history, benchmark fixtures, model prompts or release logs. Automation receives only the minimum scoped secret at execution time through an approved secret store or local secure keychain path.

Signing is treated as a transformation step with evidence:

```text
unsigned_or_prepared_sha256
signing_identity_alias
provisioning_profile_identifier
signed_sha256
notarisation_request_id_optional
notarisation_status_optional
```

For macOS, modern notarisation tooling is benchmarked; deprecated legacy upload/signing flows must not become new defaults simply because an old CI recipe still works.

## Apple frozen benchmark

- existing app/API-key bootstrap confirmation;
- clean build → archive/package;
- signing/provisioning failure modes;
- Transporter/Xcode validation;
- binary upload;
- processing-state polling;
- TestFlight assignment;
- build metadata/release notes;
- App Review submission preparation;
- failure/rejection evidence capture;
- no-secret log audit;
- rollback/remove-from-testing path;
- exact human gate required before production release.

---

# 4. Google Play

Primary sources:

- `https://developers.google.com/android-publisher`
- `https://developers.google.com/android-publisher/api-ref/rest`
- `https://developers.google.com/android-publisher/api-ref/rest/v3/edits.tracks`

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT ANDROID PUBLISHING-API BENCHMARK**

Google Play Developer Publishing API provides a particularly strong repeatable release surface. Current docs cover:

- uploading APKs/App Bundles through edits;
- transactional edits that group changes and apply only when committed;
- assigning releases to tracks;
- draft, in-progress staged rollout, halted and completed release states;
- rollout user fraction;
- release notes and country targeting;
- store listing management, including localized text/graphics where applicable.

The transaction model is a good pipeline primitive: prepare an edit, validate the intended mutation, then commit once the release manifest and gate policy agree.

## Google Play release rule

A canonical adapter must never directly “upload and production release” as one opaque step. It exposes at least:

```text
create_edit
upload_artifact
stage_track_mutation
validate_edit
commit_edit
poll_release_state
promote_or_adjust_rollout
halt_rollout
```

Production rollout requires an explicit release policy decision. Internal/test-track upload can be fully automatic after bootstrap; production promotion is governed independently.

## Google frozen benchmark

- service-account/OAuth scope and least privilege;
- AAB upload and returned version code;
- internal-test release;
- draft release;
- staged rollout at controlled user fraction;
- rollout increase;
- halt;
- full rollout;
- release notes/localisation;
- listing mutation;
- invalid edit/expired edit behavior;
- duplicate build/version-code handling;
- processing/availability delay;
- rollback/supersede path;
- no-secret log audit.

---

# 5. Steam / SteamPipe

Primary source: `https://partner.steamgames.com/doc/sdk/uploading`

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT PC STOREFRONT CONTENT-DELIVERY BENCHMARK**

SteamPipe is a build/depot delivery system using Steamworks SDK content-builder tooling and SteamCMD. Current documentation supports scripted app/depot build definitions, upload, generated BuildIDs, beta branches, preview builds and local-content-server testing.

A particularly valuable safety boundary is explicit in Valve’s current build-script behavior: `SetLive` can automatically make a **beta branch** live after a successful build, while the **default branch cannot be set live automatically by that field** and must be changed through Steamworks administration.

The ByJTT standard preserves that asymmetry rather than attempting to work around it. Beta automation is encouraged; default/public promotion remains a separate approval gate unless Steam introduces an officially supported safer automation path later.

## Steam frozen benchmark

- Steamworks SDK/tool version recorded;
- depot/app VDF generated from canonical release manifest;
- preview build before upload;
- local-content-server installation smoke test where useful;
- SteamCMD upload;
- BuildID + depot manifest evidence;
- private/beta branch promotion;
- update-size inspection;
- rollback to prior build;
- credential isolation;
- default-branch human gate.

Steam account credentials are never embedded in VDF files committed to the repository.

---

# 6. itch.io / Butler

Primary sources:

- `https://itch.io/docs/butler/pushing.html`
- `https://itch.io/docs/butler/installing.html`

Evidence: **VENDOR-DOC CLAIM; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT LOW-FRICTION INDIE CHANNEL BENCHMARK**

Butler exposes a minimal and automation-friendly content primitive:

```text
butler push <directory-or-zip> <user>/<game>:<channel>
```

Channels map naturally to platform/build lanes such as Windows, macOS, Linux, web, beta or bonus content. Butler uploads incrementally, so unchanged data can make subsequent pushes substantially cheaper/faster.

The current install docs explicitly recommend fixed `broth` URLs for CI/CD because normal download links expire. Authentication remains an external credential step and must be handled as a secret/bootstrap concern.

## itch frozen benchmark

- deterministic butler version acquisition;
- authenticated CI without token leakage;
- first push;
- no-change push;
- small delta push;
- channel separation;
- rollback/re-push behavior;
- HTML5/web compatibility path where applicable;
- evidence receipt/log capture.

---

# 7. fastlane

Official repository: `fastlane/fastlane`  
Pinned release commit: `8eba00ac8ad4b9447aef5e4d0036ead009568185`  
Release: **2.235.0 — 2026-05-26**  
Repository licence: **MIT**  
Evidence: **SOURCE-VERIFIED TOOL + PROVIDER-DOC CLAIMS; NOT BYJTT EXECUTED**  
Disposition: **INCUMBENT MOBILE RELEASE-ORCHESTRATION BENCHMARK, NOT CANONICAL RELEASE STATE**

Fastlane remains a serious solved-system candidate because it composes mature Apple/Google release actions and signing workflows rather than requiring a studio to rebuild every API client. The pinned 2.235.0 release includes current App Store/Play tooling work and removal of a legacy macOS notarisation flow, reinforcing why pinning exact tool versions matters.

However, Fastfile/lane semantics must remain an adapter over the canonical release manifest. A lane cannot be the only record of what build was released, which source revision it came from, which artifact hash was uploaded, or which rollout decision was approved.

## fastlane benchmark

- install reproducibility and Ruby/toolchain burden;
- Apple API-key/JWT flow;
- Apple build/upload/TestFlight metadata path;
- Android AAB/track/listing path;
- signing-material management;
- macOS notarisation path where applicable;
- secret redaction;
- dry-run/precheck feasibility;
- retry/idempotency behavior;
- provider API drift handling;
- upgrade burden;
- removal/replacement cost versus thin first-party API adapters.

Fastlane’s own optional usage metrics are explicitly disabled in controlled benchmark/production automation unless separately approved.

---

# 8. Secret and signing-key policy

The release layer is a high-value credential boundary.

Mandatory rules:

- no private signing keys, `.p8` API keys, keystores, passwords, recovery codes, Steam credentials or store tokens in Git;
- no secrets pasted into model prompts or issue/PR bodies;
- short-lived/scoped credentials preferred where platforms support them;
- CI environment secrets are scoped per repository/environment and protected by release-environment controls;
- human approval is required before granting a new automation principal production-store permissions;
- logs are scrubbed and benchmarked for accidental secret disclosure;
- key rotation/revocation procedure is documented before production adoption;
- signing identities are referenced in manifests by safe alias/fingerprint, never private material;
- release workers receive only the credentials required for the current platform/action.

A release adapter fails production readiness if successful operation requires broad personal-account credentials that cannot be isolated, rotated or audited.

---

# 9. Provider-neutral release interfaces

Canonical automation should expose typed operations roughly equivalent to:

```text
BuildService.build(BuildRequest) -> BuiltArtifact
SigningService.sign(BuiltArtifact, SigningPolicy) -> SignedArtifact
SigningService.notarise(SignedArtifact, NotarisationPolicy) -> NotarisedArtifact
StorePublisher.validate(ReleaseCandidate) -> ValidationReport
StorePublisher.upload(ReleaseCandidate) -> UploadReceipt
StorePublisher.assignTestingChannel(UploadReceipt, channel) -> ReleaseReceipt
StorePublisher.stageRollout(ReleaseReceipt, fraction) -> ReleaseReceipt
StorePublisher.haltRollout(ReleaseReceipt) -> ReleaseReceipt
StorePublisher.promote(ReleaseReceipt, target) -> ReleaseReceipt
StorePublisher.getStatus(receipt) -> ReleaseStatus
```

`promote()` is policy-gated. The fact that a provider SDK exposes a production mutation does not imply an AI agent may call it autonomously.

## Release state machine

```text
planned
 -> built
 -> validated
 -> signed
 -> notarised_if_required
 -> uploaded
 -> processing
 -> testing
 -> approved_for_rollout
 -> staged
 -> production
```

Failure/cancel paths include `rejected`, `failed`, `halted`, `superseded` and `rolled_back`. State transitions are append-only evidence; provider dashboards do not replace the project release ledger.

---

# 10. Frozen benchmark families

## Benchmark A — deterministic artifact and provenance

Build the same source revision repeatedly in a controlled environment. Record source/build revisions, engine/toolchain versions, artifact checksum, symbols, SBOM/provenance availability, build duration and reproducibility differences.

## Benchmark B — mobile store automation

Using non-production/internal testing products where possible, compare thin first-party Apple/Google API tooling with fastlane orchestration for setup effort, secret surface, validation, upload, metadata, testing distribution, processing-state handling, retry/idempotency, evidence quality and maintenance.

## Benchmark C — desktop storefront delivery

Publish the same frozen desktop build to Steam beta and itch test channels. Measure packaging friction, upload delta efficiency, branch/channel semantics, rollback, automation-safe promotion boundaries, credential handling and evidence receipts.

## Benchmark D — release safety and failure injection

Exercise:

- wrong artifact hash;
- duplicate platform build number/version code;
- expired/revoked credential;
- wrong store product ID;
- missing signing identity;
- failed notarisation;
- transient upload network failure;
- store processing rejection;
- rollout halt;
- attempted production promotion without required approval;
- log/secret scanning.

A conformant system fails closed before irreversible promotion and leaves a durable diagnostic trail.

---

# 11. Current research hierarchy

This is **benchmark ordering, not production adoption**:

1. **first-party store APIs/tools** — authority for store capability and minimum portable boundary;
2. **fastlane 2.235.0** — incumbent mobile release-orchestration benchmark on top of Apple/Google, especially where it removes substantial glue safely;
3. **SteamPipe/SteamCMD** — incumbent Steam content/depot/branch delivery benchmark;
4. **itch Butler** — incumbent low-friction incremental indie/web/desktop channel benchmark;
5. **custom release code** — only for thin canonical adapters/evidence normalization or where first-party + mature solved systems leave a proven gap.

Do not build a bespoke App Store/Google Play/Steam uploader merely because writing API requests appears easy. Rebuild only after measuring maintenance, credential, review-state and provider-drift costs against mature tooling.

---

# 12. Promotion gate

No release tool/provider becomes `EXECUTED`, `preferred` or part of the default production template until a completed experiment record includes:

- exact store/tool/API versions or mutable-doc snapshot date;
- immutable tool source revision where available;
- frozen source/build/release manifest;
- artifact and transformed-artifact checksums;
- signing/notarisation evidence without private material;
- exact permission scope and secret-storage model;
- bootstrap/human gates;
- testing-channel upload evidence;
- processing/rejection behavior;
- staged rollout/rollback evidence where supported;
- production-promotion policy and approval boundary;
- raw logs with secret-scan result;
- cost/maintenance snapshot;
- limitations/failures;
- removal/replacement path;
- explicit promotion decision.

A release system is not “10/10” because it can upload quickly. It must be reproducible, least-privileged, reversible where possible, auditable, provider-current and incapable of silently crossing human/legal production gates.