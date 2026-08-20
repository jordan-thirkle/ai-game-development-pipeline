# Governor Review — External Open-Source/Game-Reuse Discovery Gate

Date: 2026-08-20
Decision: **APPROVE WITH GUARDRAILS**
Priority: **P1/P2**

## 1. Current strengths

- `AGENTS.md` already requires mature, maintained, permissively licensed open-source implementations to be considered before bespoke code.
- The Pipeline Governor already audits stronger solved systems, licensing/provenance, reusable asset libraries, lifecycle cost, and unnecessary human work.
- The pipeline already requires evidence rather than README-level confidence and requires provenance/licence status for assets.

## 2. Critical gap

The solved-system policy is currently a rule without a dedicated operational discovery/qualification mechanism. There is no canonical role and schema that:

- searches whole games, mechanics, starter kits, controllers, shaders, UI kits, plugins, tooling, and asset libraries;
- separates discovery from approval;
- retains rejected candidates to prevent repeated rediscovery;
- records exact licence/commercial/provenance evidence;
- ranks by project/lifecycle fit rather than popularity;
- feeds validated reusable candidates back into future projects and a publication-safe library.

This makes the existing solved-system gate dependent on the quality and memory of whichever agent happens to implement a feature.

## 3. Leverage opportunities

Create a dedicated External Open-Source/Game-Reuse Discovery Gate plus a shared reuse registry. Use primary upstream sources, GitHub/engine ecosystems, reputable creator libraries, deterministic schema validation, and project-specific bake-offs rather than building a bespoke universal crawler first.

## 4. Invalid assumptions to reject

- GitHub stars imply production quality.
- 'Free' implies commercial reuse is permitted.
- A repository-level licence automatically covers every bundled asset.
- A reusable system that prototypes faster necessarily wins lifecycle cost.
- Discovery success is measured by number of candidates found.
- One generic ranking can replace project-specific execution evidence.

## 5. New experiments

Initial proving corpus should cover distinct reuse classes:

1. official engine mechanic/reference implementation;
2. 2D/3D general-purpose game asset catalogue;
3. environment/material/HDRI catalogue;
4. game-ready modular 3D catalogue;
5. later: controllers, shaders, UI kits, whole games, networking, save systems, and test tooling.

For each class, measure search time, qualification precision, integration effort, licence/provenance completeness, and whether the chosen reusable candidate beats a custom baseline.

## 6. Pipeline changes approved

- Add `agents/EXTERNAL-REUSE-DISCOVERY-GATE.md`.
- Add `schemas/reuse-candidate.schema.json`.
- Add curated machine-readable records under `registry/reuse/`.
- Wire the gate into the solved-system contract and pipeline cross-cutting reuse gate.
- Treat `opensource.byjtt.com` as a publication surface over explicitly publication-safe registry data, not as the source of truth.
- Preserve internal rejected/quarantined evidence even when not public.

## 7. Commercial/legal risks

- Licence drift or inaccurate licence inference.
- Third-party assets nested inside permissively licensed code repositories.
- Trademark/brand/right-of-publicity restrictions not captured by copyright licence alone.
- Paid/source-tier differences inside otherwise free catalogues.
- Publishing a commercially valuable internal bake-off or copied third-party material.

Mitigation: fail closed to `quarantined`, keep source evidence/date, preserve notices, revalidate at adoption/release, and retain explicit human/legal review for unresolved ambiguity.

## 8. Human bottlenecks

Automate discovery, metadata collection, stale checks, candidate comparison, schema validation, and publication preparation. Retain human approval for unresolved licensing/legal ambiguity and irreversible publication decisions.

## 9. Priority order

1. Schema + state model.
2. Gate contract.
3. Small high-confidence seed registry.
4. Pipeline wiring.
5. Deterministic validator and stale-check automation.
6. Project-specific bake-off integration.
7. Public `opensource.byjtt.com` index generated from publication-safe entries.
8. Broaden sources only after precision is measured.

## 10. Verification plan

The capability is not considered promoted until evidence shows:

- valid registry records pass schema validation;
- ambiguous entries cannot become `qualified`/`promoted` without required licence/provenance evidence;
- at least one real project records a reuse search before bespoke implementation;
- at least one bake-off demonstrates saved implementation/integration effort without lowering acceptance criteria;
- rejected candidates remain discoverable internally;
- stale/upstream-changed candidates can be marked for revalidation;
- public output includes only `publication.safe = true` records;
- pipeline telemetry can record whether external reuse changed time/cost/quality.

## Decision rationale

**Approved** because the proposal operationalises an already-mandatory pipeline principle and fills a genuine ownership gap. It must remain a qualification/evidence system, not become an autonomous popularity crawler or an authority that bypasses Governor, execution, security, provenance, or legal gates.
