# Coordination Kernel

## Goal

Make parallel ChatGPT, Codex and future agent work safe, resumable, measurable and largely independent of conversation history.

## Principle

Workers are ephemeral. Roles, work, state, evidence and decisions persist.

## Canonical flow

`orient -> select frontier -> claim -> compile context -> execute -> emit events/evidence -> verify -> derive state -> release claim -> route next work`

## Cross-chat operating protocol

Every substantial ChatGPT/Codex session should follow the same protocol:

1. **Orient from durable state, not memory.** Read `AGENTS.md`, `CONTEXT.md`, the current issue/work unit, affected contracts, current PR/branch and latest evidence.
2. **Refresh before acting.** Re-read mutable GitHub/repository state immediately before claiming or writing because another session may have advanced it.
3. **Claim bounded scope.** One session owns one mutable work unit at a time unless the unit explicitly allows parallel sub-work.
4. **Use specialists, not duplicated generalists.** Route research, implementation, QA, release and governance to distinct roles where separation improves evidence quality.
5. **Write progress as facts.** Commits, events, test evidence, benchmark records and decisions are durable; chat narration is not.
6. **Recover autonomously.** A blocker triggers diagnosis and solved-alternative search before human escalation.
7. **Checkpoint before context loss.** Before a session ends or changes phase, ensure the repository contains enough state for a fresh worker to continue without the transcript.
8. **Verify before claiming completion.** Fresh execution evidence is required; confidence or code inspection is not enough.
9. **Release ownership.** Completed, failed or paused work must not remain ambiguously claimed.
10. **Re-evaluate the workflow itself.** Record friction, duplicated work, intervention and orchestration overhead so the Governor can remove mechanisms that do not earn their complexity.

## Work unit

Every substantial unit should eventually have a machine-readable record containing a stable bounded objective, project/stage, persistent role, status/priority, dependencies, starting revision, lease, context pointers, acceptance criteria, evidence requirements, approval class, recovery policy, result revision and evidence ids.

## Claims and leases

A worker must claim before substantial mutable work. Claims are leases, not permanent ownership. They expire, can be released, and must be revalidated immediately before writes. Conflicting scopes should be detected before execution. Read-only research can run concurrently unless a decision ticket explicitly requires exclusivity.

## Event ledger

Important changes are append-only events rather than prose-only status updates. Initial vocabulary includes `work.created`, `work.claimed`, `work.released`, `work.blocked`, `research.completed`, `decision.proposed`, `decision.accepted`, `implementation.changed`, `build.ready`, `build.failed`, `qa.passed`, `qa.failed`, `human.verdict`, `component.promoted`, `release.shipped`, `incident.detected`, and `recovery.attempted`.

Events identify actor/role, timestamp, project/work id, repository revision, evidence pointers and causation/correlation ids.

## Derived state

The control plane should derive state from durable facts where practical. A required failed QA event blocks graduation; an approved human verdict can satisfy a human gate; newer builds supersede older candidates; expired claims return work to the frontier; missing/stale evidence prevents false green state.

## Context compiler

A worker receives the minimum sufficient bundle: root operating contract, current project/stage, claimed work and acceptance criteria, relevant decisions/docs/schemas, latest evidence/revision, and tool/skill pointers for the role. Do not default to whole-chat transcripts; retrieve deeper context on demand.

## Recovery protocol

`blocked` is a routing state, not a stopping condition. Classify the blocker, retry only when safe/idempotent, inspect current docs/tool state, search stronger solved alternatives, attempt bounded recovery, emit evidence, and escalate only when human authority/taste/unavailable information/material spend/legal or irreversible action is required.

## Human attention budget

Prefer automation for reversible research, implementation, testing, evidence capture and recovery. Require human judgement for gameplay/taste, material commercial commitments, irreversible publication/shutdown, unresolved licensing/legal questions and destructive operations without proven rollback.

## Persistent roles

Initial persistent roles: Pipeline Governor; Opportunity/Research; Technical Architect; Gameplay Implementation; Asset Pipeline; QA Critic; Performance/Device QA; Security/Privacy; Release/Distribution; Monetisation/LiveOps; Maintenance/Incident Response. A session fills a role for bounded work; role policy remains repository-owned.

## Metrics

Measure cycle/lead time, human wait time, duplicate/conflicting work, stale claims, recovery success, context loaded per completed unit, tool/model cost, intervention count, first-pass verification, escaped defects, reuse vs bespoke work, evidence freshness and percentage of automatically derived state.

## Build-vs-buy gate

Do not implement a bespoke orchestration service merely because this document specifies one. Benchmark mature workflow/event/agent systems and MCP capabilities. Compose solved systems where they win; retain only thin game-domain connective tissue. See `docs/ORCHESTRATION-SOLVED-SYSTEM-SCAN.md`.

## Near-term implementation sequence

1. Formalise work-unit, claim and event schemas. **Started.**
2. Project existing benchmark/control-plane state into those contracts.
3. Benchmark Trigger.dev vs Inngest on the same cross-session workflow.
4. Add deterministic state derivation tests.
5. Add context-bundle generation.
6. Add claim/release and human-verdict operations.
7. Surface them in Studio.
8. Run one real ChatGPT/Codex handoff end-to-end.
9. Measure coordination overhead and failure rate before expanding scope.
