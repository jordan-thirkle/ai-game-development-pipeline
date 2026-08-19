# ADR 0001: Prefer composable validation for independent artifact families

## Status

Proposed by adversarial workflow test on 2026-08-19.

## Context

Concurrent sessions repeatedly targeted root validators, package scripts and shared CI files to register new checks. Those files are coordination hotspots even when the underlying work is otherwise independent.

## Decision

When a new artifact family can be verified independently, prefer an additive verifier plus a narrowly scoped workflow over mandatory edits to central validator/package/workflow files. Central registration is reserved for invariants that genuinely need repository-wide composition.

## Consequences

- independent workstreams can add verification with less merge conflict risk;
- CI remains explicit about what each verifier proves;
- the repository may contain multiple small validation workflows;
- periodic consolidation is allowed only when measured maintenance cost outweighs concurrency benefits;
- green checks remain claim-specific evidence, not universal proof.
