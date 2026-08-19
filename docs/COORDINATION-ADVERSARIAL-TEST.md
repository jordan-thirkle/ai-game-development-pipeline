# Coordination adversarial test — 2026-08-19

## Purpose

Dogfood the multi-agent operating model against real concurrent ChatGPT/GitHub work rather than rating the workflow from prose alone.

## Failures observed

### 1. Stale write collision

A session attempted to update `tools/validate-repo.mjs` from a stale blob SHA after another session changed the same hotspot. GitHub rejected the write with HTTP 409.

**Lesson:** optimistic concurrency protected the repository, but the workflow allowed two sessions to enter the same hotspot before ownership was reconciled. Stale-write rejection must be treated as a first-class coordination conflict, not a generic Git error.

### 2. Long-lived branch drift

The original control-plane PR accumulated dozens of commits while four related multi-agent workflow commits landed independently on `main`. The branch became both stale and semantically overlapping.

**Lesson:** long-lived cross-cutting feature branches are coordination amplifiers. Prefer small independent slices from current `main`; stack only when dependency is real.

### 3. Central validator coupling

Multiple sessions wanted to edit root validation/package/workflow files to register new checks.

**Lesson:** validation should be composable. New artifact families should prefer independent workflow/test entry points and additive files when central registration is not required. Central validators remain hotspot-owned integration surfaces.

## Workflow improvements applied

- Started this test branch fresh from current `main` instead of continuing the stale control-plane branch.
- Limited scope to additive coordination schemas, fixtures, adversarial verifier and a dedicated CI workflow.
- Avoided `AGENTS.md`, root `README.md`, root validator, package scripts and existing CI workflow.
- Added mutation tests that must reject duplicate exclusive claims, premature human approval, missing recovery evidence and duplicate idempotency keys.
- Added an explicit `coordination.conflict` event type for durable collision evidence.

## Promotion criteria

Do not call the coordination model 10/10 until real Benchmark 001 runs show:

- near-zero unplanned path collisions;
- fresh sessions resume without old-chat dependency;
- correct environment routing for runtime claims;
- coordination overhead is lower than prevented rework;
- integrated-main verification catches branch-composition defects;
- human interventions are mostly quality/authority gates rather than routine project management.

## Next experiment

Use the actual Benchmark 001 shared-foundation and candidate workstreams as the next workload. Record coordination telemetry and rerun this audit after multiple independent lanes have integrated.
