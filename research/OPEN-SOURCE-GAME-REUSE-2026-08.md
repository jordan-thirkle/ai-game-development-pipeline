# External open-source and game-reuse discovery gate — August 2026

## Why this exists

The repository already requires solved-system-first decisions, but there is a critical gap between “the engine does not solve this” and “write bespoke code.” Agents need a mandatory external discovery pass over **complete games, starter kits, controllers, mechanics, frameworks, shaders, UI systems, free/CC0 assets and asset-discovery systems** before custom implementation begins.

For By JTT, “reuse” means the wider published ecosystem, not merely components already created inside our own repositories. Internal incumbents are checked **after** current external discovery so the factory cannot become an inward-looking local maximum.

This file defines the first bounded evidence-backed gate for issue #106 / PR #110. It is a discovery and screening layer, not a claim that any listed project has been executed or adopted in a By JTT game.

## Gate order

For a material game-development requirement:

1. Derive the actual capability requirements from the game brief, not from a preferred implementation.
2. Search the selected engine/runtime’s official examples/templates.
3. Search current GitHub/web sources for **whole games and starter kits** containing several needed mechanics at once.
4. Search mature reusable implementations of the remaining mechanics: controllers, dialogue, inventory, AI/state machines, navigation, saves, procedural generation, networking, shaders, VFX and UI.
5. Search direct commercial-safe free/CC0 asset sources and agent-oriented asset indexes **before** generating generic replacement assets.
6. Freeze promising repositories to exact commits and record mutable web sources explicitly as mutable.
7. Screen code licence, bundled/example asset licence and third-party dependency licence as separate boundaries.
8. Compare task fit, maintenance recency, engine/version fit, platform/mobile fit, documentation/tests, dependency burden, integration effort, security/supply-chain risk and exit/maintenance cost.
9. Use stars/forks/adoption only as a **soft discovery signal**. They never override licence compatibility or technical fit.
10. Preserve useful copyleft/mixed-licence systems as architecture references, but never silently classify them as proprietary drop-ins.
11. Execute the strongest eligible candidate in the actual target environment before production promotion.
12. If no external candidate survives, record why before choosing an internal incumbent, AI generation or bespoke implementation.
13. Re-run discovery periodically; the current policy uses a 30-day re-challenge interval for fast-moving categories.

## Ranking model

Eligibility is fail-closed **before** ranking. A repository with an unresolved licence boundary or wrong engine/platform fit cannot compensate by having more stars.

The initial soft-ranking weights are:

| Signal | Weight |
|---|---:|
| Task/feature fit | 30% |
| Maintenance / lifecycle health | 20% |
| Licence + provenance quality | 20% |
| Integration cost | 10% |
| Documentation/tests | 10% |
| Platform/mobile fit | 5% |
| Popularity (stars/forks/adoption) | **5%** |

Popularity is deliberately capped at <=10% by the validator. It helps us discover mature work; it does not decide whether that work is legally or technically appropriate.

A zero-star project can still win if it solves the exact task better. A 10k-star project can still be rejected if its licence, maintenance state, dependency graph or platform fit is wrong.

## Seed evidence

### Godot demo projects — official implementation pool

- Canonical repository: https://github.com/godotengine/godot-demo-projects
- Pinned source revision: `34fc99545fc41520a958248f607101e7d0b95b05`
- GitHub snapshot: **9,372 stars / 2,215 forks** at verification time.
- Repository is the official Godot demonstration/template collection under MIT.
- Master follows current development, so a production game must choose a revision compatible with its stable Godot pin and inspect the exact demo/path asset provenance.
- Decision: `drop_in_candidate` at selected-demo/pattern level, not permission to copy the whole collection blindly.

Primary source: https://github.com/godotengine/godot-demo-projects

### Dialogic 2 — reusable dialogue/character framework

- Canonical repository: https://github.com/dialogic-godot/dialogic
- Pinned source revision: `fd0fa22c335c72583b89b35699f9fb19dd1b4eae`
- GitHub snapshot: **5,922 stars / 344 forks**.
- Current upstream README states Dialogic requires Godot 4.3+ and is MIT; Roboto is separately Apache-2.0.
- Upstream remains active, but its own docs warn public APIs can change during alpha/beta releases.
- Decision: `drop_in_candidate`, with exact version pinning and regression tests required before production promotion.

Primary source: https://github.com/dialogic-godot/dialogic

### Kenney Starter Kit 3D Platformer — whole starter before bespoke mechanics

- Canonical repository: https://github.com/KenneyNL/Starter-Kit-3D-Platformer
- Pinned source revision: `3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0`
- GitHub snapshot: **1,205 stars / 175 forks**.
- Pinned README provides character movement with double jump, collectibles, falling platforms, camera rotate/zoom and gamepad support.
- Pinned `LICENSE.md` is MIT; the README separately states included sprites, 3D models and sounds are CC0.
- Decision: `drop_in_candidate` for a Godot 4.6-style platformer foundation, subject to target-engine execution/device proof.

This entry is important because the pipeline should ask “does a good starter already contain 60–80% of these generic mechanics?” before generating six separate bespoke systems.

Primary source: https://github.com/KenneyNL/Starter-Kit-3D-Platformer

### Dialogue Manager for Godot — competing solved system

- Canonical repository: https://github.com/nathanhoad/godot_dialogue_manager
- Pinned revision: `e37b2e0d784e238bb936e0485dcee1a8e307a8f3`
- GitHub snapshot: **3,790 stars / 268 forks**.
- GitHub repository metadata reports MIT and current activity on 19 August 2026.
- Decision: `component_candidate`.

This intentionally overlaps Dialogic. The goal is not to install every mature library; it is to compare the strongest external candidates for the **actual game context** and choose one when reuse beats bespoke work.

### LimboAI — AI framework only when it earns its cost

- Canonical repository: https://github.com/limbonaut/limboai
- Pinned revision: `a6f5c7fc11ff80d512dd75c82cfa85724fd8a742`
- GitHub snapshot: **2,965 stars / 139 forks**.
- Pinned source code licence is MIT; demo/project art retains separate attribution/licence obligations.
- Decision: `component_candidate` for behavior-tree/state-machine complexity.

The solved-system gate is not dependency collecting. A one-enemy prototype may be cheaper with native state logic; a larger NPC ecosystem may strongly favour LimboAI. Integration cost remains part of the comparison.

### OpenTTD — complete-game architecture reference

- Canonical repository: https://github.com/OpenTTD/OpenTTD
- Pinned source revision: `4d4f8bff38d200fbcfda11789bd69259ebbefd17`
- Upstream documents GPL-2.0 for the main distribution with third-party licence exceptions.
- It is valuable for studying simulation, save/load, networking, content/mod distribution and long-lived operations.
- Decision: `architecture_reference`, **not** proprietary `drop_in_candidate`.

This is the negative control proving that technical maturity/popularity never overrides a strong-copyleft boundary.

Primary source: https://github.com/OpenTTD/OpenTTD

### Kenney — commercial-safe direct asset source

- Canonical library: https://www.kenney.nl/assets
- Current support documentation states game assets on Kenney asset pages are CC0/public-domain, commercially usable and attribution-free.
- Decision: `asset_source_candidate`.
- Because the website is mutable, every production intake records exact pack URL/files/retrieval evidence rather than treating the library homepage as immutable provenance.

Search this source before generating another generic crate, coin, UI icon, environment prop or common SFX.

### CC0 Asset Index — agent-first asset discovery

- Canonical repository: https://github.com/Jpalmer95/cc0-asset-index
- Pinned revision: `ca53d0e7d50e5a05960625710b9105102c3f16f1`
- GitHub snapshot currently has **0 stars / 0 forks**.
- Repository describes an agent-first searchable catalog for CC0 assets with provider provenance, CLI discovery/download and semantic-search tooling.
- Decision: `asset_discovery_candidate`, not automatic trust of every indexed upstream asset.

This is a deliberate counterexample to star-driven selection: it is new and unpopular, but potentially removes substantial AI-agent asset-search work. Task fit earns evaluation; upstream assets still need exact provenance/licence freeze before shipping.

### Awesome Gamedev — discovery multiplier, never licence authority

- Canonical repository: https://github.com/Calinou/awesome-gamedev
- Pinned revision: `d051efc5c1f628d127a1a16fd7ce7280aac8ad85`
- Decision: `discovery_source` only.

Curated “awesome” lists are useful for recall, but inclusion never proves a linked project’s licence, maintenance state, security, engine compatibility or commercial fitness. Each downstream candidate re-enters the normal gate independently.

## Creator Mode integration

Creator Mode should never begin a conventional mechanic from a blank-code prompt.

For a brief such as “mobile third-person extraction game with inventory, quests and dialogue,” the system derives capability searches and runs external discovery in parallel:

- starter/whole games that already combine several mechanics;
- engine-native/official templates;
- strongest current inventory/dialogue/controller/AI implementations;
- direct free/CC0 art/audio/animation sources and asset indexes;
- curated discovery indexes for recall only.

The planner then produces an explicit **reuse plan**:

- `reuse unchanged`
- `adapt`
- `reference architecture only`
- `generate missing content`
- `build bespoke`

Every accepted external input retains its upstream revision/source/licence. AI transformations do not erase provenance.

## What this gate deliberately does not do

- It does not declare a universal “best” engine, library or asset source.
- It does not equate source inspection with execution.
- It does not treat a repository licence as proof that every bundled asset/dependency has the same licence.
- It does not treat CC0/free assets as production-ready without technical/art validation.
- It does not infer commercial eligibility from stars, forks, README claims or an SPDX badge alone.
- It does not automatically vendor dependencies into production projects.
- It does not reward a larger dependency graph just because more problems are technically “solved.”

## Required record before reuse

For a selected external component or asset pack, capture at minimum:

- stable entry/source ID;
- canonical URL;
- exact Git commit/tag/release or exact asset-pack page/version;
- retrieval timestamp;
- popularity snapshot when relevant (discovery signal only);
- code licence;
- asset/content licence separately;
- transitive/bundled exceptions;
- commercial-use conclusion and conditions;
- target engine/version/platform fit;
- integration and dependency burden;
- security/supply-chain concerns;
- documentation/test/maintenance evidence;
- intended use;
- replacement/exit cost;
- later execution evidence if actually integrated.

## Before / after impact

Before this slice, solved-system-first named open-source reuse conceptually but had **no machine-valid external reuse registry, no popularity ceiling, no explicit whole-starter category, no asset-discovery category and no fail-closed commercial drop-in rule**.

After this slice:

- the external gate covers seven distinct source categories;
- strongly starred official/framework candidates are visible without being automatically preferred;
- a low-star agent-oriented asset index can still enter evaluation on task fit;
- code/asset licence boundaries are explicit;
- copyleft whole-game references remain useful without contaminating proprietary drop-in decisions;
- CI mutates records by stable ID instead of brittle array index and proves unsafe promotions/popularity inflation fail closed.

## Evidence boundary

Every external repository/library entry in this registry is currently `SOURCE-VERIFIED`, not `EXECUTED`.

Source evidence establishes that the candidate exists at the pinned revision and records the current legal/maintenance hypothesis. It does **not** prove target-game compatibility, mobile performance, correct import/build behavior, security, fun or production quality. Those claims require revision-bound execution in the target project’s proof environment.

The next useful experiment is not to grow the list indefinitely. Dogfood this gate on real Creator Mode/game requirements and measure whether external discovery reduces custom code, asset generation, agent iterations, human intervention and total validated elapsed time.
