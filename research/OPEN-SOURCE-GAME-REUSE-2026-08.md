# External open-source and game-reuse discovery gate — August 2026

## Why this exists

The repository already requires solved-system-first decisions, but current candidate work still has a gap between “the engine does not solve this” and “write bespoke code.” Agents need a mandatory external discovery pass over complete games, templates, controllers, mechanics, frameworks, shaders, UI systems and commercial-safe free assets before custom implementation begins.

This file defines the first bounded evidence-backed gate for issue #106. It is a discovery and screening layer, not a claim that any listed project has been executed or adopted in a By JTT game.

## Gate order

For a material game-development requirement:

1. Search the selected engine/runtime’s official examples/templates first.
2. Search current GitHub/web sources for whole games, starter kits and reusable implementations of the mechanic.
3. Search vetted free/commercial-safe asset sources before generating or commissioning replacement assets.
4. Screen candidates for exact licence boundaries, maintenance recency, engine/version fit, platform fit, documentation/tests, dependency burden, integration effort and supply-chain risk.
5. Treat stars/forks/popularity only as discovery signals. They never override licence compatibility or technical fit.
6. Preserve useful copyleft/mixed-licence systems as architecture references, but do not silently classify them as proprietary drop-ins.
7. If no candidate survives, record why before bespoke implementation.
8. Re-run discovery periodically; the current policy uses a 30-day re-challenge interval for fast-moving categories.

## Seed evidence

### Godot demo projects — official template collection

- Canonical repository: https://github.com/godotengine/godot-demo-projects
- Pinned source revision: `34fc99545fc41520a958248f607101e7d0b95b05`
- Current upstream documentation states the repository is a collection of demonstration/template projects and that the demos are distributed under MIT.
- Upstream also documents version-branch compatibility, so a demo should be selected against the target Godot version rather than copied from a mutable development branch without review.
- Decision: `drop_in_candidate` at the individual-demo/pattern level, subject to exact path and asset-provenance review.

Primary source: https://github.com/godotengine/godot-demo-projects

### Dialogic 2 — reusable dialogue/character framework

- Canonical repository: https://github.com/dialogic-godot/dialogic
- Pinned source revision: `fd0fa22c335c72583b89b35699f9fb19dd1b4eae`
- Current upstream README states Dialogic requires Godot 4.3+ and is licensed under MIT; it separately notes Roboto under Apache-2.0.
- Current upstream activity remains active in 2026, but its own docs warn public APIs can change during alpha/beta releases.
- Decision: `drop_in_candidate` for Godot dialogue/character workloads, with exact version pinning and regression tests required before production promotion.

Primary sources:
- https://github.com/dialogic-godot/dialogic
- https://github.com/dialogic-godot/dialogic/blob/main/LICENSE

### OpenTTD — complete-game architecture reference

- Canonical repository: https://github.com/OpenTTD/OpenTTD
- Pinned source revision: `4d4f8bff38d200fbcfda11789bd69259ebbefd17`
- Upstream describes OpenTTD as an open-source simulation game and documents GPL-2.0 for the main distribution with explicitly listed third-party licence exceptions.
- It is valuable for studying long-lived game architecture: simulation systems, save/load, networking, content/mod distribution and operational maintenance.
- Decision: `architecture_reference`, not a proprietary `drop_in_candidate`. GPL/mixed boundaries must not be hidden by repository popularity or maturity.

Primary source: https://github.com/OpenTTD/OpenTTD

### Kenney — commercial-safe free asset source

- Canonical library: https://www.kenney.nl/assets
- Current support documentation states that game assets on Kenney asset pages are public-domain licensed under CC0, may be used in commercial projects, and do not require attribution.
- Individual current asset pages such as Prototype Kit, Tower Defense Kit and Mini Market explicitly display Creative Commons CC0.
- Decision: `asset_source_candidate`. Because the website is mutable, every production intake still records the exact pack page, pack version/files, retrieval date and included licence/provenance material.

Primary sources:
- https://www.kenney.nl/support
- https://www.kenney.nl/assets/prototype-kit
- https://www.kenney.nl/assets/tower-defense-kit
- https://www.kenney.nl/assets/mini-market

## What this gate deliberately does not do

- It does not declare a “best” engine, library or asset source.
- It does not equate source inspection with execution.
- It does not treat a repository licence as proof that every bundled asset has the same licence.
- It does not treat CC0/free assets as production-ready without technical/art validation.
- It does not infer commercial eligibility from stars, forks, README language or an SPDX badge alone.
- It does not automatically vendor dependencies into production projects.

## Required record before reuse

For a selected external component or asset pack, capture at minimum:

- stable entry/source ID;
- canonical URL;
- exact Git commit/tag/release or exact asset-pack page/version;
- retrieval timestamp;
- code licence;
- asset/content licence separately;
- any transitive or bundled exceptions;
- commercial-use conclusion and conditions;
- target engine/version/platform fit;
- integration and dependency burden;
- security/supply-chain concerns;
- tests/documentation/maintenance evidence;
- intended use;
- replacement/exit cost;
- later execution evidence if actually integrated.

## Before/after impact

Before this slice, the repository’s solved-system rule named open-source reuse conceptually but had **no machine-valid external reuse registry and no fail-closed commercial drop-in rule**. Current candidate sessions therefore had to rediscover source/licence boundaries ad hoc.

After this slice, one reusable gate covers four distinct initial source classes and rejects unsafe promotions mechanically. This does not remove domain research; it makes the minimum evidence and legal/technical screening deterministic before custom work starts.
