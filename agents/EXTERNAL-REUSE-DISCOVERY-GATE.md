# External Open-Source/Game-Reuse Discovery Gate

This role operationalises the repository's mandatory solved-system gate. It exists to prevent avoidable bespoke work by finding, qualifying, comparing, and preserving reusable external game-development systems and assets before implementation begins.

It does **not** replace the Pipeline Governor, engine/runtime selection, security review, legal judgement, or execution evidence. It supplies structured candidates and evidence to those gates.

## Trigger

Invoke before substantial bespoke implementation of any reusable game-development capability, including:

- whole/open-source games suitable as references or foundations;
- gameplay mechanics and systems;
- player, vehicle, camera, combat, interaction, inventory, save, dialogue, AI, networking, input, and animation controllers;
- shaders, rendering systems, VFX, lighting, post-processing, terrain, water, foliage, and procedural generation;
- starter kits, templates, plugins, engine add-ons, libraries, SDKs, editor tools, build/release tooling, testing harnesses, and observability;
- UI kits, HUDs, menus, accessibility systems, localisation tooling, audio systems, and content pipelines;
- 2D/3D assets, rigs, animations, textures, HDRIs, SFX, music, fonts, icons, and other production-ready content.

The gate may be skipped only when the requirement is demonstrably unique/trivial or a promoted internal solution already wins. Record the reason.

## Search order

1. Existing promoted By JTT registry entries.
2. Selected engine/runtime's official ecosystem and examples.
3. Mature open-source repositories and packages.
4. Reputable open asset libraries and creator catalogues.
5. Proven free/commercial systems whose lifecycle cost may beat custom work.
6. AI-generated alternatives only after existing reusable systems are assessed.

Prefer primary/official sources for current licence, compatibility, release, and maintenance claims.

## Candidate states

Every candidate must be one of:

- `discovered` — found but not qualified;
- `quarantined` — provenance/licence/security/quality evidence is incomplete or concerning;
- `qualified` — basic reuse checks passed; suitable for comparison;
- `benchmarking` — undergoing project-specific execution/bake-off;
- `promoted` — approved for reuse for a defined scope with evidence;
- `rejected` — evaluated and unsuitable; retain the reason to prevent rediscovery;
- `stale` — previously useful but needs revalidation due to upstream/time/platform change.

Discovery never implies approval.

## Hard gates

A candidate cannot be `qualified` or above without:

- canonical upstream/source URL;
- exact licence identifier/status and evidence source;
- commercial-use assessment;
- attribution/notice obligations where applicable;
- provenance/author/source confidence;
- current maintenance/release evidence where maintenance matters;
- target engine/runtime/platform compatibility assessment;
- dependency and supply-chain risk assessment appropriate to the candidate;
- integration-cost estimate;
- evidence date.

If licence or provenance is ambiguous, fail closed to `quarantined`. Do not infer commercial permission from 'free', stars, forks, package popularity, or availability on an asset site.

## Ranking model

Rank for project fit, not popularity. Suggested 0-5 dimensions:

- player/product fit;
- capability coverage;
- licence/commercial compatibility;
- provenance confidence;
- maintenance/upstream health;
- architecture/code quality;
- execution/test evidence;
- target-platform support;
- performance suitability;
- AI-agent editability and documentation;
- integration effort (reverse-scored);
- dependency/supply-chain burden (reverse-scored);
- lifecycle/maintenance cost (reverse-scored);
- asset/content quality where applicable;
- accessibility/localisation readiness where applicable.

Stars/downloads/forks may be recorded only as weak ecosystem signals and must never dominate the score.

## Bake-off rule

For material decisions, compare the strongest reusable candidate against the incumbent/custom option under the same acceptance criteria. README claims are not proof.

Evidence can include:

- reproducible build/run;
- benchmark or automated test;
- gameplay/device observation;
- profiler/performance capture;
- import/retarget/render validation for assets;
- integration diff/effort;
- licence/provenance verification;
- failure and incompatibility log.

## Asset-specific checks

For game-ready assets also assess, as relevant:

- scale/units and orientation;
- topology/geometry integrity;
- materials/textures and colour-space correctness;
- rig/skeleton compatibility;
- animation quality/retargetability/root motion;
- collision/physics readiness;
- LODs and draw-call/material count;
- texture/memory footprint;
- mobile/web/desktop suitability;
- style consistency and editability;
- source formats and downstream export options.

## Output

Write records conforming to `schemas/reuse-candidate.schema.json` and place curated entries under `registry/reuse/`.

A gate run should end with:

1. requirement/capability searched;
2. search surfaces and date;
3. candidates found;
4. candidates rejected/quarantined and why;
5. top qualified candidates;
6. bake-off/evidence required;
7. recommendation: `reuse`, `benchmark`, `custom`, or `defer`;
8. confidence and unresolved risks;
9. registry updates made;
10. whether the Pipeline Governor must review the decision.

## Publication boundary

The internal registry is operational evidence. Public pages on `opensource.byjtt.com` may be generated only from entries explicitly marked publication-safe. Do not publish commercially sensitive comparative advantages, private evaluation data, restricted artefacts, copied proprietary content, or licence-ambiguous material.

## Success metrics

Track whether the gate reduces:

- bespoke implementation hours/tokens;
- duplicate systems;
- asset-production cost;
- integration failures;
- licence/provenance incidents;
- time to first playable/vertical slice;
- maintenance burden.

Also track false positives, rejected recommendations, stale entries, and cases where bespoke implementation genuinely beat reuse. The gate is valuable only if it improves the complete production lifecycle.