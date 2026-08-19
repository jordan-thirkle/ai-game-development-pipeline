# Multi-Agent Workflow Audit — 2026-08-19

Status: post-PR #33 audit of how ChatGPT, Codex, engine-specific tooling, browser/device environments, GitHub, and the human control plane should cooperate.

## Executive finding

The largest risk was not model capability. It was using chat context as implicit project state and allowing multiple agents to choose work/environments independently without a durable claim, path ownership, merge ordering, or zero-rediscovery handoff.

PR #33 materially improves this by making GitHub canonical coordination state and treating chats as disposable workers. The pipeline is not yet 10/10 because the model has not been exercised across real Benchmark 001 implementation lanes or measured under sustained concurrent work.

## Scorecard

Scores are architecture-readiness estimates, not production measurements. They must be replaced by telemetry from real runs.

| Category | Before audit | After PR #33 | 10/10 evidence required |
|---|---:|---:|---|
| Durable source of truth | 5 | 9 | fresh sessions reliably reconstruct work without old chats |
| Cross-chat collision prevention | 4 | 8 | near-zero unplanned overlap/conflict over concurrent benchmark work |
| Environment/tool routing | 5 | 9 | no runtime claims made from inspection-only environments; reroutes rare |
| Plan-to-execution discipline | 6 | 9 | planning artifacts stop once a workstream is executable; low planning overhead |
| Parallelism quality | 5 | 8 | parallel lanes reduce validated elapsed time after integration, not only local coding time |
| Handoff/resumability | 5 | 9 | fresh agent resumes with negligible rediscovery from GitHub-visible state |
| Evidence integrity | 8 | 9 | every behaviour/runtime claim links to execution evidence and unknowns fail closed |
| Verification coverage awareness | 5 | 8 | every artifact/claim type has an explicit verifier or acknowledged manual gap |
| Merge/integration safety | 6 | 8.5 | downstream PRs revalidate against integrated main; conflict/rework remains low |
| Human visibility/control | 5 | 7 | control plane projects live canonical claims/dependencies/evidence and writes decisions through |
| Automation leverage | 7 | 8 | repetitive coordination is automated only where measured payoff exceeds complexity |
| Workflow observability | 4 | 8 | coordination telemetry is populated by real runs and changes decisions |
| Simplicity / low bureaucracy | 6 | 8 | issue/claim overhead stays small relative to rework avoided |
| Benchmark fairness under concurrency | 6 | 9 | shared foundation remains read-only for candidate lanes except coordinated fair changes |
| Long-term maintainability | 6 | 8.5 | conventions survive new chats/models/tools without instruction drift |

## Strengths now

- GitHub issues/PRs/commits are explicit canonical state.
- Workstreams declare branch/base, owned paths, avoided paths, dependencies, environment, and evidence.
- Same-account multi-chat operation no longer relies on assignee identity as a lock.
- Parallelism is conditional on coupling/integration cost rather than assumed beneficial.
- Shared benchmark foundation and candidate lanes have separate ownership.
- Runtime-dependent work is routed away from text-only GitHub editing.
- Pull requests expose handoff/next-safe-action metadata.
- Pipeline-run records can capture coordination failures and overhead.
- A dedicated coordinator is deliberately deferred until it can beat GitHub-native coordination on measured lifecycle cost.

## Failures observed during this audit

### Planning runaway

The workflow audit itself entered a planning runaway: after the program map and a bounded workstream claim were sufficient, additional meta-issues continued to be created before the implementation branch was started.

This was not hidden as noise. The permanent fix is the plan→execute invariant in `docs/MULTI-AGENT-OPERATING-MODEL.md`: once objective, ownership, dependencies, environment, and evidence are known, execution is the next action unless a new blocker appears.

The redundant checkpoint issues were closed rather than left on the frontier.

### Green CI did not validate a new artifact type

The first version of `.github/ISSUE_TEMPLATE/workstream.yml` used the legacy template key `about` rather than the Issue Forms key `description`. The existing repository workflow was green-capable because it does not validate GitHub Issue Form schema; the defect was caught by reviewing the artifact against its actual platform contract.

The immediate fix was to correct the form. The broader rule is more important: **green CI is evidence only for the behaviours and artifact types its checks actually cover.** Every new artifact type or lifecycle claim should ask what verifies it. When no cheap automated verifier exists, the gap must remain explicit and the relevant official/platform contract should be checked manually rather than treating generic CI as proof.

Do not automatically add validators for every file format. Add them when the expected defect/rework reduction justifies their maintenance cost.

## Remaining P1 gaps

### Real execution proof of the workflow

The protocol has not yet been exercised across all Benchmark 001 lanes. The strongest next evidence comes from #34–#40, not another orchestration design pass.

### Control-plane reconciliation

Draft PR #8 predates several integrated lifecycle/workflow changes. It must reconcile with current `main` and project canonical workstream/evidence state rather than own an independent state model. Follow-up #23 tracks the workflow-facing integration.

### Shared asset/harness execution

Benchmark candidates cannot fairly run until #34 turns asset/provenance/test contracts into an executable foundation.

## Remaining P2 gaps

### Automated overlap/stale-base detection

Manual live-PR/path inspection is the current incumbent. #25 should be implemented only after coordination telemetry shows enough repeated value to justify automation.

### Coordinator agent

No dedicated coordinator is justified yet. Reconsider only when concurrency produces repeated claim, scheduling, collision, or merge-train overhead that a coordinator can measurably remove.

### Verification coverage

The pipeline needs an explicit habit of matching verifier to artifact/claim type. Do not confuse a repository-structure check with browser validity, engine validity, device validity, store validity, or platform-config validity.

### Session-start friction

A native GitHub workstream issue form is being added so agents do not repeatedly hand-format claims. This reduces protocol friction without creating another system.

## Workflow principles to preserve

1. Optimise validated end-to-end throughput, not number of agents or code produced.
2. Prefer the strongest solved system—including GitHub itself—before building orchestration infrastructure.
3. Route work to the cheapest environment capable of proving the outcome.
4. Parallelise independent lanes; serialise or stack high-coupling mutations.
5. Make negative results and workflow failures durable evidence.
6. Keep the human at irreversible/commercial/quality gates rather than requiring human labour for routine coordination.
7. Make fresh-session continuation a first-class test of maintainability.
8. Match verification to the actual artifact/claim; generic green CI is never universal proof.

## Next verification

Use Benchmark 001 as the workflow benchmark as well as the engine benchmark. Every candidate pipeline-run should fill coordination telemetry where observable. After the first comparable lanes finish, run another Governor audit and answer:

- Did claims prevent duplicate work?
- Did path ownership prevent conflicts?
- How much rediscovery did fresh sessions need?
- Did environment routing catch wrong-tool choices early?
- Did parallel execution reduce total validated elapsed time?
- Which coordination steps created overhead without preventing rework?
- Which artifact/claim types escaped meaningful automated verification?
- Is automated overlap checking now justified?
- Is a dedicated coordinator still unnecessary?

The operating model should only be promoted toward 10/10 when these answers are evidence-backed.