# Creator ↔ Pro Mode Continuity Contract

**Status:** Proposed Standard v0.1 profile  
**Profile:** `mode-transition-continuity`  
**Scope:** Creator Mode ↔ professional development handoff

## Purpose

A Creator Mode project must remain professional-owned software. Moving from a simplified authoring surface into professional tooling must preserve the canonical project lineage and must not silently discard source, assets, provenance, evidence, or decision history.

## Normative requirements

The following terms are normative: **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**.

### 1. Canonical project identity

- A project **MUST** have a stable `projectId` across Creator and Pro modes.
- A transition **MUST** record the source revision and resulting revision as exact 40-character Git object IDs when Git revisions are the authoritative project revisions.
- A transition **MUST** identify the source mode, target mode, actor, timestamp, and transition type.
- A provider **MUST NOT** replace the canonical project identity merely because the project enters a different editor, engine surface, workspace, or authoring mode.

### 2. Ownership and editability

- Creator output **MUST** remain exportable/editable source where the product claims professional ownership.
- A transition **MUST NOT** silently convert editable source into an opaque hosted artifact.
- Dependencies, engine/runtime identity, asset references, and required tooling **MUST** remain discoverable after transition.
- If a provider requires a conversion that changes project semantics or removes capabilities, the transition **MUST** be classified as `one_way_handoff` or `lossy_handoff`, not `round_trip`.

### 3. Evidence and provenance continuity

- Evidence attached to the source revision **MUST** remain addressable from the target revision or have an explicit supersession mapping.
- Asset provenance, licence/usage status, source identifiers and hashes **MUST** survive a transition unless technically impossible; losses **MUST** be enumerated.
- Agent actions and human decisions relevant to the handoff **SHOULD** remain attributable.
- A transition **MUST NOT** self-certify the resulting project as production-ready. Independent verification remains a separate gate.
- `evidenceMapping` identifiers are **references to external evidence records, not evidence themselves**. A conformance implementation **MUST** resolve and validate those references against its evidence store before treating continuity as verified.

### 4. Reversibility

A conformant implementation **MUST** declare one of these transition classes:

- `reversible` — the project can return to the source mode without loss of canonical project state;
- `one_way_handoff` — the target is supported, but reverse transition is intentionally unsupported;
- `lossy_handoff` — reverse transition is possible only with documented loss;
- `copy` — a new independent project is created rather than transitioning the canonical project.

A `reversible` transition **MUST NOT** be represented as verified unless its `verification.status` is `pass` and at least one evidence identifier is present. If the transition has not been executed, use an appropriate non-verified status or a non-reversible classification.

If a platform performs an irreversible conversion, the implementation **MUST** create a checkpoint before conversion when the platform permits it and **MUST** expose the irreversible nature of the operation before it occurs.

### 5. Capability disclosure

A transition record **MUST** identify capabilities that are:

- preserved;
- newly available;
- removed;
- transformed;
- unavailable because of platform/tool prerequisites.

The UI **SHOULD** explain these changes in Creator-friendly language while Pro Mode **SHOULD** expose the exact technical details.

### 6. Verification

A conformance test **SHOULD** exercise:

`create → save/checkpoint → Creator edit → transition → Pro edit → verify lineage → export/build → inspect evidence`

Where the source mode is intended to remain usable after Pro editing, a second test **SHOULD** exercise:

`Pro edit → reverse transition → compare canonical state`

A failed reverse transition **MUST** be recorded as evidence rather than hidden as an implementation detail.

## Evidence model

Minimum transition evidence:

| Field | Requirement |
| --- | --- |
| `projectId` | stable project identity |
| `sourceRevision` | exact source revision/hash |
| `targetRevision` | exact resulting revision/hash |
| `sourceMode` / `targetMode` | mode identities |
| `transitionClass` | reversibility classification |
| `capabilities` | preserved/lost/changed capability inventory |
| `checkpoint` | pre-transition checkpoint where available |
| `provenanceStatus` | source/asset/dependency provenance continuity |
| `evidenceMapping` | carried-forward/superseded evidence references, resolved before conformance is claimed |
| `actor` | human/agent/system attribution |
| `recordedAt` | transition timestamp |
| `verification` | execution verdict and evidence references when verified |

## Conformance rule

A product **MUST NOT** claim `creator-pro-continuity` solely because it can open the same project in another editor. It must demonstrate canonical identity continuity, editable ownership, evidence/provenance continuity, and an explicit transition-class declaration.

The strongest claim, `round_trip_continuity`, additionally requires an executed reverse-transition benchmark with no unexplained canonical-state loss.
