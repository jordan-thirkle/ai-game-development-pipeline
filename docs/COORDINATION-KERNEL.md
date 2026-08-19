# Coordination Kernel

## Goal

Make parallel ChatGPT, Codex and future agent work safe, resumable, measurable and largely independent of conversation history.

## Principle

Workers are ephemeral. Roles, work, state, evidence and decisions persist.

## Canonical flow

`orient -> select frontier -> claim -> compile context -> execute -> emit events/evidence -> verify -> derive state -> release claim -> route next work`

## Work unit

Every substantial unit should eventually have a machine-readable record containing:

- stable id and bounded objective;
- project/stage and owning persistent role;
- status and priority;
- dependencies/blockers;
- starting repository revision;
- claim/lease owner and expiry;
- required context pointers;
- acceptance criteria;
- evidence requirements;
- risk/approval class;
- retry/recovery policy;
- resulting revision and evidence ids.

## Claims and leases

A worker must claim before doing substantial mutable work. Claims are leases, not permanent ownership. They expire, can be released, and must be revalidated immediately before writes. Conflicting scopes should be detected before execution. Read-only research can run concurrently unless a decision ticket explicitly requires exclusivity.

## Event ledger

Important changes are append-only events rather than prose-only status updates. Initial event vocabulary:

- `work.created`
- `work.claimed`
- `work.released`
- `work.blocked`
- `research.completed`
- `decision.proposed`
- `decision.accepted`
- `implementation.changed`
- `build.ready`
- `build.failed`
- `qa.passed`
- `qa.failed`
- `human.verdict`
- `component.promoted`
- `release.shipped`
- `incident.detected`
- `recovery.attempted`

Events should identify actor/role, timestamp, project/work id, repository revision, evidence pointers and causation/correlation ids.

## Derived state

The control plane should derive current state from durable facts where practical rather than trusting hand-edited status. Examples:

- a required failed QA event blocks graduation;
- an approved human verdict can satisfy a human gate;
- a newer build supersedes an older candidate;
- expired claims return work to the frontier;
- missing/stale evidence prevents a false green state.

## Context compiler

A worker should receive the minimum sufficient context bundle:

1. root operating contract;
2. current project/stage;
3. claimed work unit and acceptance criteria;
4. relevant decisions/domain docs/schemas;
5. latest evidence and repository revision;
6. tool/skill pointers needed for that role.

Do not default to whole-chat transcripts. Retrieve deeper context on demand.

## Recovery protocol

`blocked` is a routing state, not a stopping condition.

For recoverable failures:

1. classify the blocker;
2. retry only when idempotent and evidence suggests transient failure;
3. inspect current official documentation/tool state;
4. search for a stronger solved alternative;
5. attempt a bounded safe recovery;
6. emit evidence for every attempt;
7. escalate to the human only when authority, taste, unavailable information, meaningful spend, legal/licensing judgement, or irreversible action is required.

## Human attention budget

Human checkpoints should be explicit and scarce. Prefer automation for reversible research, implementation, testing, evidence capture and recovery. Require human judgement for gameplay/taste, material commercial commitments, irreversible publication/shutdown, unresolved licensing/legal questions and destructive operations without proven rollback.

## Persistent roles

Roles outlive sessions. Initial roles include:

- Pipeline Governor
- Opportunity/Research
- Technical Architect
- Gameplay Implementation
- Asset Pipeline
- QA Critic
- Performance/Device QA
- Security/Privacy
- Release/Distribution
- Monetisation/LiveOps
- Maintenance/Incident Response

A session may fill one role for one bounded work unit; role policy remains repository-owned.

## Metrics

The coordination system itself should measure:

- cycle and lead time;
- time waiting for humans;
- duplicate/conflicting work rate;
- stale claim rate;
- recovery success rate;
- context tokens/bytes loaded per completed work unit;
- tool/model cost;
- intervention count;
- first-pass verification rate;
- escaped defects;
- reuse vs bespoke implementation;
- evidence freshness;
- percentage of state derived automatically.

The Pipeline Governor should periodically challenge whether these mechanisms reduce total lifecycle cost and increase shipped-game quality. Complexity that does not earn its keep should be removed.

## Build-vs-buy gate

Do not implement a bespoke orchestration service merely because this document specifies one. Benchmark mature task/workflow/event/agent systems and MCP capabilities against these requirements. Compose solved systems where they win; retain only the thin domain-specific kernel necessary for game-development semantics, evidence and human gates.

## Near-term implementation sequence

1. Formalise work-unit, claim and event schemas.
2. Project existing benchmark/control-plane state into those contracts.
3. Add deterministic state derivation tests.
4. Add context-bundle generation.
5. Add claim/release and human-verdict operations.
6. Surface them in the Studio UI.
7. Integrate one real Codex/ChatGPT cross-session workflow end-to-end.
8. Measure coordination overhead and failure rate before expanding scope.
