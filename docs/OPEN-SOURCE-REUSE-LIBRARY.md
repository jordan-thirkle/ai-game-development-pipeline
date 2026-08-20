# Open-Source/Game-Reuse Library

This document defines the internal registry and public publication model for reusable external game-development systems and assets.

## Goal

Build a continuously improving, evidence-backed library of whole games, mechanics, controllers, shaders, UI systems, plugins, tools, starter kits, asset packs, animations, audio and other reusable production inputs that can reduce bespoke work without lowering product quality or creating hidden legal/maintenance risk.

The library exists to support the complete By JTT AI Game Development Pipeline. It is not a link directory and it is not an endorsement list.

## Source of truth

`registry/reuse/*.json` is canonical operational state.

`opensource.byjtt.com` is a publication surface only. It must never become a second manually maintained registry.

Generate public data with:

```sh
npm run export:reuse-public
```

The exporter includes only records that are both:

- `publication.safe = true`; and
- in `qualified`, `benchmarking`, or `promoted` state.

Generated output is intentionally not committed as canonical state.

## Trust levels

### Discovered

Known to exist. No reuse claim has been made.

### Quarantined

Useful-looking candidate with unresolved licence, provenance, security, quality or other blocking uncertainty.

### Qualified

Source/licence/provenance/maintenance/compatibility/risk checks pass sufficiently to justify project-specific comparison.

Qualified does **not** mean production-approved.

### Benchmarking

Currently undergoing a project-specific bake-off against credible alternatives or bespoke implementation.

### Promoted

Has fresh execution/benchmark evidence proving the candidate wins for a defined scope. Promotion must name where it was used.

### Rejected

Evaluated and not worth using for the evaluated scope. Keep the record so future agents do not rediscover and repeat the same failed evaluation.

### Stale

Previously useful evidence is too old or upstream conditions changed enough that revalidation is required.

## Taxonomy

Initial reusable kinds:

- whole game;
- starter kit/template;
- mechanic/system;
- controller;
- engine plugin/add-on;
- library/SDK;
- shader/rendering system;
- UI kit;
- development/build/test tool;
- asset pack;
- 3D asset;
- 2D asset;
- animation;
- audio;
- font;
- reference/demo.

Expand the taxonomy only when repeated real candidates cannot be represented cleanly.

## Discovery surfaces

Search in this order unless the capability requires a justified exception:

1. already promoted By JTT candidates;
2. engine/runtime first-party systems and examples;
3. official package/plugin/add-on ecosystems;
4. mature open-source repositories;
5. reputable open asset libraries and creator catalogues;
6. proven free/commercial solved systems;
7. AI-generated replacements;
8. bespoke implementation.

Use current primary sources for licence, release, compatibility and maintenance claims whenever possible.

## Ranking principles

Rank by lifecycle/project fit, not GitHub popularity.

Useful dimensions include:

- requirement coverage;
- player/product fit;
- target runtime/platform support;
- licence/commercial compatibility;
- provenance confidence;
- maintenance/upstream health;
- code/architecture quality;
- test/execution evidence;
- performance suitability;
- AI-agent editability;
- documentation quality;
- integration effort;
- dependency/supply-chain burden;
- lifecycle maintenance cost;
- content/visual quality where relevant;
- accessibility/localisation readiness where relevant.

Stars, forks, downloads and social popularity may be weak ecosystem signals but cannot override evidence.

## Legal/provenance rule

Never infer commercial permission from `free`, public availability, a GitHub repository, an asset-store listing, or an engine's licence.

Repository code and bundled assets can have different licences. A candidate must preserve that distinction.

If copyright licence is clear but trademark, personality, dataset/source, model-training, patent or bundled third-party material remains uncertain, record it and fail closed when material.

This registry is engineering evidence, not legal advice. Unresolved high-impact ambiguity retains a human/legal checkpoint.

## Asset library rule

Asset-source records such as Kenney, Poly Haven or Quaternius qualify the **source catalogue**, not every individual asset automatically.

When an exact asset is adopted into a production game, preserve at minimum:

- exact asset/pack identity and source URL;
- source/download date;
- source file/hash where practical;
- exact licence/notice evidence;
- transformation history where material;
- game/project using it;
- technical validation appropriate to asset type;
- final release attribution/notice requirement.

## Software reuse rule

For code/systems, prefer exact commit/version pinning for benchmark evidence.

Before promotion, execute the candidate in the target environment and record:

- integration steps and modifications;
- acceptance criteria result;
- failures/repairs;
- target-device/runtime evidence;
- dependency changes;
- performance impact where material;
- lifecycle/editability assessment;
- comparison with the credible baseline.

## Public site product model

`opensource.byjtt.com` should become a useful public research/product surface around the safe subset of the registry.

Recommended page families:

- `/` — library/search entry point;
- `/assets/` — reusable game-ready asset sources;
- `/controllers/` — player/camera/vehicle/input controllers;
- `/games/` — open-source games/reference projects;
- `/shaders/` — reusable rendering/shader systems;
- `/ui/` — UI kits/HUD/menu systems;
- `/tools/` — build/test/editor/content tools;
- `/engines/{engine}/` — engine-specific reusable systems;
- `/license/{spdx-or-family}/` — licence-oriented discovery with strong caveats;
- `/{kind}/{slug}/` — evidence-backed candidate detail pages;
- `/comparisons/` — only publication-safe By JTT bake-offs;
- `/methodology/` — explain qualification/promotion and prevent readers mistaking the library for automatic endorsement.

Do not generate thin SEO pages for combinations with no useful evidence.

## Detail page contents

A useful public candidate page should show:

- what it solves;
- upstream/source owner;
- current qualification state;
- engine/platform fit;
- licence and attribution obligations;
- last verification date;
- what By JTT actually verified;
- what remains unverified;
- integration notes where publication-safe;
- benchmark result when one exists;
- alternatives/related candidates;
- upstream link rather than mirrored third-party content.

## Feedback loop

The library improves through:

`discover -> qualify -> benchmark -> promote/reject -> use in real game -> measure production outcome -> revalidate -> rerank -> selectively publish`

Real production outcomes should outweigh speculative scoring.

## Success measures

Track whether this system reduces:

- time to first playable;
- bespoke code volume;
- duplicated systems;
- asset creation/purchase cost;
- failed integrations;
- licensing/provenance incidents;
- agent/human intervention count;
- maintenance burden;
- project abandonment caused by preventable technical work.

Also track false-positive recommendations and cases where bespoke work genuinely wins. A reuse gate that always recommends reuse is broken.
