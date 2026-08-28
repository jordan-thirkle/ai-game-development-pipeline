# Creator ↔ Pro Mode Continuity Contract

**Status:** Proposed Standard v0.1 profile  
**Profile:** `mode-transition-continuity`  
**Scope:** Creator Mode ↔ professional development handoff

A Creator Mode project must remain professional-owned software. Moving from a simplified authoring surface into professional tooling must preserve canonical project lineage and must not silently discard source, assets, provenance, evidence, or decision history.

## Normative requirements

The following terms are normative: **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**.

### Canonical identity

- A project **MUST** have a stable `projectId` across Creator and Pro modes.
- When Git revisions are authoritative, source and target revisions **MUST** be exact 40-character Git object IDs.
- A transition **MUST** identify source mode, target mode, actor, timestamp, and transition type.
- A provider **MUST NOT** replace canonical project identity merely because the project enters another editor, engine surface, workspace, or authoring mode.

### Ownership and provenance

- Creator output **MUST** remain exportable/editable source where professional ownership is claimed.
- A transition **MUST NOT** silently convert editable source into an opaque hosted artifact.
- Dependencies, engine/runtime identity, asset references, and required tooling **MUST** remain discoverable.
- Evidence attached to the source revision **MUST** remain addressable from the target revision or have an explicit supersession mapping.
- A transition **MUST NOT** self-certify production readiness.
- `evidenceMapping` values are external evidence-record references, not evidence themselves; a conformance implementation **MUST** resolve them before treating continuity as verified.

### Reversibility

A transition **MUST** declare one of `reversible`, `one_way_handoff`, `lossy_handoff`, or `copy`.

A `reversible` transition **MUST NOT** be represented as verified unless `verification.status` is `pass` and at least one evidence identifier exists. If not executed, use a non-verified status.

If a platform performs an irreversible conversion, a checkpoint **MUST** be created before conversion where the platform permits it, and the irreversible nature **MUST** be exposed before the operation.

### Capability disclosure

A transition record **MUST** identify capabilities that are preserved, added, removed, transformed, or unavailable because of platform/tool prerequisites.

### Conformance

A conformance implementation **SHOULD** exercise:

`create → save/checkpoint → Creator edit → transition → Pro edit → verify lineage → export/build → inspect evidence`

Where reverse transition is intended:

`Pro edit → reverse transition → compare canonical state`

A failed reverse transition **MUST** be retained as evidence rather than hidden.

The strongest `round_trip_continuity` claim additionally requires an executed reverse-transition benchmark with no unexplained canonical-state loss.

This standard is a **contract proposal**, not evidence that any particular Creator/Pro product currently conforms.
