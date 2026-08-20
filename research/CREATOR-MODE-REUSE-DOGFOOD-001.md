# Creator Mode external-reuse dogfood 001 — August 2026

## Purpose

This experiment tests whether the external open-source/game-reuse gate from issue #106 / PR #110 can materially improve a realistic Creator Mode planning decision before the pipeline considers deploying a dedicated continuous discovery agent or public `opensource.byjtt.com` service.

It is a **planning experiment**, not an implementation benchmark. It measures external candidate coverage and planned generic work avoided. It does not claim realized development-time savings, production quality, runtime compatibility, player retention, or commercial success.

## Reference brief

A mobile-first 3D salvage/extraction roguelite:

- iOS and Android first, web preview second;
- responsive third-person movement/camera;
- enemy combat and behavior;
- breakable salvage and rewards;
- inventory/run loot;
- persistent save/meta progression;
- touch controls/haptics;
- prototype environment art and SFX.

This was chosen because it contains enough generic game-development work to expose whether external-first planning actually reduces bespoke surface area.

## External-first order used

1. official engine examples/templates;
2. complete external starters/whole-game sources;
3. mature reusable mechanic/framework candidates;
4. free/CC0 asset sources and asset discovery;
5. only then internal/incumbent or new implementation paths.

No capability was allowed to jump directly to AI generation or bespoke implementation merely because the existing registry lacked an answer.

## Result

The machine plan covers **8 generic capabilities**.

| Outcome | Count |
|---|---:|
| planned external reuse/adaptation | 4 |
| blocked pending independent review | 1 |
| honest discovery gaps | 3 |
| AI-generation decisions | 0 |
| bespoke decisions | 0 |

Measured planning metrics:

- external candidate coverage: **88%** (7/8 capabilities considered at least one registered external candidate);
- fully eligible reuse/adapt coverage: **50%** (4/8 capabilities currently have a selected, machine-cleared external path);
- no-reuse baseline generic custom surface: **8 capabilities**;
- planned generic custom/unresolved surface after reuse: **4 capabilities**;
- planned generic surface reduction: **50%**;
- realized time savings claimed: **false**.

The 50% figure is a planning comparison only: four capabilities have a current external reuse/adapt route instead of being treated as generic custom work. It is not a claim that implementation effort will fall by exactly 50%.

## High-leverage selections

### Player controller / camera

Selected: `reuse.kenney-starter-3d-platformer` → `adapt`.

Why: the pinned starter already contains character control, camera and gamepad foundations with MIT code plus explicitly CC0 bundled content. The plan still requires mobile touch adaptation and device-feel execution before production acceptance.

### Salvage / collectibles

Selected: `reuse.kenney-starter-3d-platformer` → `adapt`.

Why: collectible/gameplay-scene plumbing can be adapted into salvage interactions rather than recreated as generic pickup infrastructure.

### Environment art

Selected: `reuse.kenney` → `adapt`.

Why: direct CC0 packs should be searched and frozen before generating commodity environment props. Production intake still requires exact pack/file provenance and mobile performance/art-direction review.

### Prototype SFX

Selected: `reuse.kenney` → `adapt`.

Why: commercial-safe CC0 prototype sounds remove the need to spend generation budget on commodity feedback before the game has earned a bespoke audio direction.

## Correctly blocked selection

### Enemy AI

Candidate: `reuse.limboai` → `blocked_review`.

LimboAI may remove behavior-tree/state-machine framework work, but its current registry record retains review-required asset/dependency boundaries and must earn its integration overhead against simpler native state logic. Creator Mode therefore cannot silently install it.

## Honest discovery gaps

The current registry did **not** provide a cleared answer for:

- inventory/run loot;
- versioned save/meta progression;
- mobile touch/haptics.

Those gaps remain external-discovery work. They do not automatically become AI-generated or bespoke systems.

This is an important success condition: an AI pipeline that fabricates completeness is worse than one that exposes the missing search/evidence explicitly.

## Discovery-agent approval signal

Issue #116 proposed a dedicated External Reuse Discovery Agent + `opensource.byjtt.com` public library only if critical review approves it.

This dogfood provides **positive leverage evidence**:

- the proposed ≥50% eligible-candidate threshold is met exactly;
- the proposed ≥30% planned generic-surface-reduction threshold is exceeded (50%);
- whole-starter and free/CC0 asset reuse both materially alter the plan;
- no unsafe source was promoted merely because it was popular.

But it does **not** yet prove a dedicated continuous agent is better than bounded interactive discovery.

The first run did not instrument:

- search-action count;
- source-fetch count;
- elapsed discovery time;
- API/LLM cost.

Therefore the #116 critical decision should remain `DEFER_PENDING_EVIDENCE` for **agent deployment**, even though the external-first gate itself shows strong value.

A follow-up comparison should instrument discovery effort and compare at least:

1. bounded interactive/manual-agent discovery using PR #110;
2. a minimal, non-continuous discovery worker/prototype using the same canonical registry contract.

Only if the dedicated worker produces meaningfully better coverage/freshness/effort economics should it graduate into scheduled/autonomous operation.

## `opensource.byjtt.com` implication

The public-library concept remains promising independently of a continuous agent.

The preferred architecture remains:

`canonical pipeline registry/review evidence -> disposable static/search index -> public searchable pages`

not:

`separate public database -> pipeline tries to synchronize back from it`.

The public surface should help other AI game developers find and evaluate sources by:

- engine/runtime;
- mechanic/capability;
- asset/media type;
- licence and clearance state;
- platform/mobile fit;
- maintenance status;
- stars/forks as a soft signal;
- source verification vs execution status;
- why-use / why-not-use reasoning;
- alternatives;
- original upstream links and provenance.

It should not bulk rehost third-party code/assets and should not create thin automated SEO pages.

## Next evidence

1. finish machine validation and adversarial CI for this plan;
2. execute one selected reuse path (for example the Kenney starter controller/collectible subset) and measure actual integration work versus a bespoke equivalent or established benchmark;
3. instrument discovery effort on a second brief;
4. re-run critical review #116;
5. only then approve/reject a dedicated discovery agent and decide whether `opensource.byjtt.com` deserves a dedicated repo or a static projection within the existing By JTT web architecture.
