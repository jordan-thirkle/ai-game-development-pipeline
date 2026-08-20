# External open-source and game-reuse discovery gate — August 2026

## Why this exists

The repository already requires solved-system-first decisions, but there is a critical gap between “the engine does not solve this” and “write bespoke code.” Agents need a mandatory external discovery pass over **complete games, starter kits, controllers, mechanics, frameworks, shaders, UI systems, free/CC0 assets and asset-discovery systems** before custom implementation begins.

For By JTT, “reuse” means the wider published ecosystem, not merely components already created inside our own repositories. Internal incumbents are checked **after** current external discovery so the factory cannot become an inward-looking local maximum.

This file defines the bounded evidence-backed gate for issue #106 / PR #110. It is a discovery and screening layer, not a claim that any listed project has been executed or adopted in a By JTT game.

## Gate order

For a material game-development requirement:

1. Derive capability requirements from the game brief, not from a preferred implementation.
2. Search the selected engine/runtime’s official examples/templates.
3. Search current GitHub/web sources for **whole games and starter kits** containing several needed mechanics at once.
4. Search mature implementations of remaining mechanics: controllers, dialogue, inventory, AI/state machines, navigation, saves, procedural generation, networking, shaders, VFX and UI.
5. Search direct commercial-safe free/CC0 asset sources and agent-oriented asset indexes **before** generating generic replacement assets.
6. Freeze promising repositories to exact commits and record mutable web sources explicitly as mutable.
7. Screen code licence, bundled/example asset licence and third-party dependency licence as separate machine-readable boundaries.
8. Compare task fit, maintenance recency, engine/version fit, platform/mobile fit, documentation/tests, dependency burden, integration effort, security/supply-chain risk and exit/maintenance cost.
9. Use stars/forks only as a **soft discovery signal**. They never override licence compatibility or technical fit.
10. Preserve useful copyleft/mixed-licence systems as architecture references, but never classify them as proprietary drop-ins.
11. Execute the strongest eligible candidate in the actual target environment before production promotion.
12. If no external candidate survives, record why before choosing an internal incumbent, AI generation or bespoke implementation.
13. Re-run discovery periodically; the initial policy uses a 30-day re-challenge interval for fast-moving categories.

## Fail-closed licence clearance

Licence prose alone is not enough. Each entry now records three independent clearance states:

- `code_clearance_status`
- `asset_clearance_status`
- `dependency_clearance_status`

A `drop_in_candidate` must have cleared code, cleared/not-applicable assets, and cleared/not-applicable dependency licences. An unresolved `requires_review` state blocks drop-in promotion regardless of stars, README wording or technical attractiveness.

This deliberately makes the initial classifications stricter:

- the **Godot demo collection** is a `component_candidate`, not a blanket drop-in, because individual demo assets/dependencies still need path-level review;
- **Dialogic**, **Dialogue Manager** and **LimboAI** are `component_candidate`s: their code licences are cleared, but target-project asset/dependency boundaries still need review;
- **Kenney Starter Kit 3D Platformer** is the seeded code `drop_in_candidate` because the pinned revision gives MIT code, explicitly CC0 bundled sprites/models/audio, and no unresolved dependency-licence blocker in the starter evidence;
- **OpenTTD** remains architecture-reference-only because strong/copyleft mixed boundaries are incompatible with silent proprietary drop-in reuse;
- direct **Kenney assets** are an asset-source candidate, while every exact production pack still receives pack-level provenance;
- **CC0 Asset Index** is an asset-discovery candidate: its MIT tool can be evaluated, but indexed upstream assets remain review-required.

## Ranking model

Eligibility is fail-closed **before** ranking. A repository with an unresolved licence boundary or wrong engine/platform fit cannot compensate by having more stars.

| Signal | Weight |
|---|---:|
| Task/feature fit | 30% |
| Maintenance / lifecycle health | 20% |
| Licence + provenance quality | 20% |
| Integration cost | 10% |
| Documentation/tests | 10% |
| Platform/mobile fit | 5% |
| Popularity (stars/forks/adoption) | **5%** |

Popularity is capped at <=10% by machine validation. A zero-star project can win an evaluation if exact task fit and lifecycle economics are stronger; a 10k-star project can still be rejected.

## Seed evidence

### Godot demo projects

- https://github.com/godotengine/godot-demo-projects
- pinned revision `34fc99545fc41520a958248f607101e7d0b95b05`
- GitHub snapshot: 9,372 stars / 2,215 forks
- official MIT demonstration/template collection
- classification: `component_candidate`, because selected demo assets/dependencies remain review-required.

### Dialogic 2

- https://github.com/dialogic-godot/dialogic
- pinned revision `fd0fa22c335c72583b89b35699f9fb19dd1b4eae`
- 5,922 stars / 344 forks
- MIT code; Roboto separately Apache-2.0; target integration/dependencies still reviewed
- classification: `component_candidate`.

### Kenney Starter Kit 3D Platformer

- https://github.com/KenneyNL/Starter-Kit-3D-Platformer
- pinned revision `3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0`
- 1,205 stars / 175 forks
- pinned README provides movement/double jump, collectibles, falling platforms, camera controls and gamepad
- pinned `LICENSE.md`: MIT code
- pinned README explicitly states bundled sprites, 3D models and sounds are CC0
- classification: `drop_in_candidate`; runtime/device evidence still required before production promotion.

This is the core whole-starter pattern: ask whether an external project already solves 60–80% of generic mechanics before generating each system separately.

### Dialogue Manager for Godot

- https://github.com/nathanhoad/godot_dialogue_manager
- pinned revision `e37b2e0d784e238bb936e0485dcee1a8e307a8f3`
- 3,790 stars / 268 forks
- active MIT code
- classification: `component_candidate`; compare against Dialogic for the actual game rather than installing both.

### LimboAI

- https://github.com/limbonaut/limboai
- pinned revision `a6f5c7fc11ff80d512dd75c82cfa85724fd8a742`
- 2,965 stars / 139 forks
- MIT code; demo art has separate attribution/licence boundaries
- classification: `component_candidate`; framework overhead must earn its lifecycle cost.

### OpenTTD

- https://github.com/OpenTTD/OpenTTD
- pinned revision `4d4f8bff38d200fbcfda11789bd69259ebbefd17`
- GPL-2.0 with third-party exceptions
- classification: `architecture_reference` for simulation, saves, networking, content/mod and operational architecture; not proprietary drop-in.

### Kenney assets

- https://www.kenney.nl/assets
- current official pages state CC0/public-domain commercial use
- classification: `asset_source_candidate`; exact production packs retain pack/file provenance because the site is mutable.

### CC0 Asset Index

- https://github.com/Jpalmer95/cc0-asset-index
- pinned revision `ca53d0e7d50e5a05960625710b9105102c3f16f1`
- current GitHub snapshot: 0 stars / 0 forks
- agent-oriented searchable CC0 catalogue with provider provenance/semantic-search tooling
- classification: `asset_discovery_candidate`; indexed assets remain independently review-required.

This is the deliberate counterexample to star-driven selection: exact task fit earns evaluation even when popularity is zero.

### Awesome Gamedev

- https://github.com/Calinou/awesome-gamedev
- pinned revision `d051efc5c1f628d127a1a16fd7ce7280aac8ad85`
- classification: `discovery_source` only. Linked projects re-enter the full licence/fit gate.

## Creator Mode integration

Creator Mode should never begin a conventional mechanic from a blank-code prompt.

For “mobile third-person extraction game with inventory, quests and dialogue,” derive parallel capability searches for:

- whole/starter games already combining several mechanics;
- official engine examples/templates;
- current inventory/dialogue/controller/AI implementations;
- direct free/CC0 art/audio/animation sources and asset indexes;
- curated discovery indexes for recall only.

The planner outputs an explicit reuse plan:

- `reuse unchanged`
- `adapt`
- `reference architecture only`
- `generate missing content`
- `build bespoke`

Every accepted external input retains its upstream revision/source/licence. AI transformations do not erase provenance.

## What this gate deliberately does not do

- It does not declare a universal best engine/library/asset source.
- It does not equate source inspection with execution.
- It does not treat repository code licence as proof for bundled assets/dependencies.
- It does not treat CC0/free assets as production-ready without technical/art validation.
- It does not infer commercial eligibility from stars, forks, README claims or SPDX metadata alone.
- It does not automatically vendor dependencies.
- It does not reward larger dependency graphs simply because more features are nominally solved.

## Required record before reuse

Capture at minimum canonical source, exact revision/pack, retrieval timestamp, popularity snapshot when relevant, separate code/asset/dependency clearance, commercial-use conclusion, engine/version/platform fit, integration/dependency burden, security/supply-chain concerns, docs/tests/maintenance evidence, intended use, exit cost and later target-project execution evidence.

## Before / after

Before this slice, external reuse was a principle but had no canonical machine gate, no whole-starter/asset-discovery categories, no popularity ceiling, and no explicit code/asset/dependency clearance states.

After this slice, one gate covers seven external source categories and nine initial records, including highly starred mature systems and a zero-star high-fit asset-search candidate. Machine validation prevents popularity inflation and blocks unresolved code/asset/dependency licence states from being promoted as drop-ins.

## Evidence boundary

Every external entry is currently `SOURCE-VERIFIED`, not `EXECUTED`. Source evidence establishes that the candidate exists at a pinned revision and records the legal/maintenance hypothesis. It does not prove target-game compatibility, mobile performance, security, art quality or production fitness.

The next useful experiment is **not** to grow this registry indefinitely. Dogfood it on real Creator Mode/game requirements and measure whether external discovery reduces custom code, asset generation, agent iterations, human intervention and total validated elapsed time.
