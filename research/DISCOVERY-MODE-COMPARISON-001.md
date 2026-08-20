# Discovery Mode Comparison 001

Status: **bounded on-demand worker passes; continuous agent remains deferred**  
Parent experiment: #122  
Approval gate: #116  
Dogfood dependency: #115 / PR #117  
External reuse dependency: PR #110

## Question

Does a bounded, non-continuous external discovery worker materially reduce repeated public-source discovery work versus normal interactive research without reducing useful coverage or weakening licence/provenance safety?

This experiment does **not** test whether an always-on crawler should exist, whether discovered code is production-ready, or whether `opensource.byjtt.com` should be deployed.

## Frozen brief

Mobile-first co-op survival-builder with 12 generic capability buckets:

1. whole starter/game architecture;
2. controller/camera;
3. combat/interactions;
4. enemy/NPC AI;
5. building/placement;
6. inventory/economy;
7. crafting/recipes;
8. save/progression;
9. UI/touch/accessibility;
10. environment/character/animation assets;
11. audio/music;
12. multiplayer/networking/social.

## Frozen interactive baseline

The interactive baseline was instrumented by explicit action count and then frozen before the bounded worker was judged.

- search actions: **17**
- verification/source fetches: **21**
- total external actions: **38**
- candidate records retained: **11**
- capability candidate coverage: **92%** (11/12)
- fully-cleared capability coverage: **25%**
- unsafe promotions: **0**
- wall-clock duration: not reliably instrumented
- monetary/tool cost: unknown

The baseline deliberately kept unresolved/no-licence candidates blocked instead of inflating production eligibility.

## Bounded worker architecture

The prototype is an on-demand, stateless Node worker. It uses:

- the existing local canonical external-reuse registry as read-only seed evidence;
- GitHub Repository Search for one bounded query per capability;
- repository name/description/topic metadata for direct-component task screening;
- deterministic ranking dominated by task fit;
- maintenance and licence class ahead of popularity;
- popularity only as a capped soft signal;
- one exact branch-revision fetch for each selected unique new repository;
- revision caching and queue deduplication.

It cannot:

- schedule itself;
- execute discovered repositories;
- modify the canonical registry;
- mark a newly discovered permissively licensed repository commercially cleared;
- promote anything to `EXECUTED` or production-approved;
- deploy or write to the public library.

Only inherited canonical entries with already-cleared code/assets/dependencies can appear as immediately `reviewable`. New discoveries remain `needs_deeper_review`, `blocked_license`, or `reference_only` until the independent canonical gates do their work.

## Failure retained: run 1

Workflow run `32328860233` initially appeared excellent:

- 20 external actions;
- 47% fewer actions than manual;
- apparent 100% candidate coverage;
- 25% fully-cleared coverage;
- 0 unsafe promotions.

Artifact inspection rejected this as approval evidence. README-wide matching and permissive task screening had selected generic/non-solution repositories such as broad `awesome` indexes, MCP-server lists, AI-agent collections and a game-security list for unrelated game capabilities.

The lesson is explicit: **retrieval efficiency without precision is not useful discovery**. The false-positive run remains documented rather than being hidden.

## Precision correction: run 2

The worker was tightened to:

- search repository name/description rather than arbitrary README matches;
- require a Godot signal for engine/system capabilities;
- require primary + secondary task metadata signals;
- exclude generic `awesome`, resource-list, MCP and unrelated agent aggregators from direct-component coverage;
- record search-hit rejection and duplicate-selection telemetry.

Run `32329033352` then produced:

- 21 external actions;
- 45% reduction;
- 83% candidate coverage;
- 25% fully-cleared coverage;
- 0 unsafe promotions.

This was safer but below the frozen baseline's 92% candidate coverage, so it was **not sufficient**.

The missing useful capability was UI/touch: the query `godot mobile joystick accessibility` was unnecessarily conjunctive even though a direct virtual-joystick component is enough to supply a candidate lead for that combined capability bucket.

## Final bounded result: run 4

The UI query was minimally changed to `godot virtual joystick`. No extra search was added: the worker remained exactly one search per capability.

The semantic validator was also hardened before accepting the run. CI now requires all of:

- exactly 12 capability searches;
- at most one exact-revision fetch per capability;
- **>=25% reduction** in total external actions versus the frozen baseline;
- candidate coverage **>= the 92% frozen baseline**;
- fully-cleared coverage **>= the 25% frozen baseline**;
- 0 human interventions during worker execution;
- 0 unsafe promotions;
- exact non-placeholder Git SHAs;
- no generic index/resource-list repository counted as a direct component candidate;
- no `reviewable` candidate with unresolved asset/dependency boundaries;
- no no-licence candidate marked reviewable.

Workflow run `32329236844`, exact branch head `608dc5651ce441f14ed31cf6aac6bf7ae2a5552b`, passed those gates:

| Metric | Interactive | Bounded worker | Result |
| --- | ---: | ---: | --- |
| Search actions | 17 | 12 | lower |
| Verification/source fetches | 21 | 10 | lower |
| **Total external actions** | **38** | **22** | **42% reduction** |
| Candidate coverage | 92% | 92% | parity |
| Fully-cleared coverage | 25% | 25% | parity |
| Unsafe promotions | 0 | 0 | parity |
| Worker retrieval time | not measured | ~0.108 min | worker-only evidence |

The worker inspected 79 first-page search hits, retained a 12-record deduplicated review queue, and kept the whole-starter capability as an honest gap rather than forcing a false match.

## Independent semantic spot-check

Several low-popularity selections were deliberately checked because the ranking contract says stars must not dominate task fit.

- `DevPoodle/delta-battle` is actually described upstream as a Godot recreation of a combat system and is MIT-licensed. Its low star count did not make it irrelevant.
- `sa-aris/aithena` is actually an NPC AI framework with FSMs, behavior trees, pathfinding and an API explicitly targeting Unity/Unreal/Godot; MIT metadata was present. This is a useful low-star discovery lead, not popularity noise.
- `julienandreu/input_forge` is actually a Godot couch/online multiplayer input + packet-loss-safe netcode plugin, MIT-licensed.
- `JoenTNT/godot_thumbstick_addon` supplied the recovered UI/touch lead.

These checks support the intended ranking principle: **fit first; popularity soft**.

The new queue is still only a review queue. For example, a repository can say `MIT` in GitHub metadata while its bundled assets or dependencies remain unresolved. New results therefore remain blocked from automatic production adoption.

## Decision

### Bounded on-demand discovery worker — `APPROVE_WITH_CONDITIONS`

The bounded worker demonstrated a material mechanical discovery improvement on this brief:

- **42% fewer explicit external actions**;
- candidate coverage parity;
- fully-cleared coverage parity;
- zero unsafe promotions;
- exact revision pinning;
- no human intervention during the worker run;
- disposable/rebuildable output;
- no production-state write authority.

Conditions:

1. it remains on-demand, not continuously scheduled;
2. its queue remains advisory/disposable;
3. new discoveries cannot self-promote beyond the canonical independent licence/provenance/execution gates;
4. direct-component precision screening and generic-index rejection remain mandatory;
5. exact upstream revision identifiers remain mandatory;
6. external content remains untrusted and is never executed during discovery;
7. action-count improvement is not represented as realized engineering-time savings.

### Continuous/scheduled discovery agent — `DEFER_PENDING_EVIDENCE`

One successful bounded brief does not establish:

- repeated-brief freshness benefit;
- optimal schedule/cadence;
- rate-limit/API economics over time;
- long-term stale-source handling cost;
- whether continuously polling beats invoking the bounded worker only when a Creator Mode plan needs it.

Run the bounded worker across additional materially different briefs before authorizing recurring execution. Continuous scheduling should only exist if repeated evidence shows it removes work that on-demand execution cannot.

### `opensource.byjtt.com` — separate conditional architecture decision

This experiment makes the data pipeline more suitable for a public library, but it does not itself authorize public deployment.

The preferred architecture remains:

`canonical pipeline evidence -> static projection -> Pagefind/search/filter -> existing By JTT deployment stack`

rather than a new mutable public database or crawler-backed service.

The public product should surface reviewed evidence, provenance, licence boundaries, maintenance/fit and why-use/why-not-use decisions while linking to upstream projects. It should not publish raw unreviewed discovery hits as recommendations.

## Evidence boundary

The 42% figure measures explicit public discovery/verification actions in one controlled comparison. The interactive baseline did not have reliable wall-clock timing, so this is **not a 42% engineering-time claim**.

Likewise, candidate coverage is not production readiness. Only 25% of this brief's capability buckets had an already fully-cleared candidate in both modes; the remaining discoveries still require the pipeline's deeper legal, dependency, execution, platform and quality gates.
