# Multi-Agent Operating Model

This document defines how multiple ChatGPT, Codex, engine-specific, browser/device, and CI agents work on the By JTT AI Game Development Pipeline without turning chat history into infrastructure.

## Core model

The system has three layers:

1. **GitHub is canonical state.** Issues, pull requests, commits, branches, schemas, evidence, and release records are authoritative.
2. **The control plane is a projection.** It may make canonical state easier to inspect and approve, but must not silently become a second independent source of truth.
3. **Chats/agents are disposable workers.** A fresh session must be able to continue from GitHub without requiring private knowledge of an earlier chat.

This is intentionally different from treating one long-running chat as the project manager. Chats are excellent reasoning/execution contexts but poor durable coordination databases.

## Session startup invariant

Before substantial work, every session must:

1. load current `main` / repository head;
2. inspect the authoritative issue for the workstream;
3. inspect open pull requests and their changed paths;
4. identify dependencies and stale-base risk;
5. choose the correct execution environment;
6. claim a bounded scope;
7. only then implement.

Do not infer repository state from an earlier conversation.

## Workstream claim

A workstream is claimed in a GitHub issue or PR-visible comment/body using this minimum contract:

```text
Session: <unique session/workstream id>
Objective: <bounded outcome>
Branch: <branch or planned branch>
Base: <main/head SHA or dependency PR>
Own paths: <paths/subtrees this work may modify>
Avoid paths: <known concurrent ownership/hotspots>
Dependencies: <issues/PRs/commits or none>
Environment: <ChatGPT/Codex/browser/engine/device/CI>
Evidence: <proof expected before completion>
```

Because multiple chats may operate through the same GitHub account, assignee identity alone is not a session lock.

### Claim rule

Before editing, verify that no active unstacked workstream already owns the same meaningful paths or outcome.

If overlap exists, choose one of four actions:

1. **Avoid** — move this work to independent files/scope.
2. **Stack** — explicitly branch from/depend on the other PR when the work is causally dependent.
3. **Sequence** — wait for the dependency to land and rebase from current `main`.
4. **Coordinate ownership** — one workstream owns the shared file; the other supplies requirements/evidence rather than competing edits.

Two independent PRs must not casually edit the same hotspot file merely because Git can sometimes merge text automatically.

## Plan-to-execute invariant

Once a session has:

- a bounded objective;
- owned/avoided paths;
- dependencies;
- an execution environment;
- an evidence plan;

**the next action is execution.**

Do not keep creating planning tickets, architecture documents, or decomposition layers unless execution exposes a new blocking ambiguity.

Planning is valuable only to reduce execution risk. Planning that does not change the next executable action is overhead.

## Environment router

Choose the environment that can actually prove the requested outcome.

| Work | Primary environment | Completion evidence |
|---|---|---|
| Research/current APIs/market/tool comparison | ChatGPT + primary sources | cited findings / decision record |
| GitHub coordination/issues/PR metadata/small declarative repo changes | ChatGPT + GitHub | GitHub readback + CI where applicable |
| Local repository implementation/refactor/debugging | Codex/local execution | tests/build/runtime evidence |
| Three.js/web gameplay | Codex + browser automation | launched build, console, screenshots/video, perf |
| Godot/Unity/Unreal/Defold editor/runtime work | Codex + engine/editor tooling/MCP where appropriate | engine execution, tests, captures, build evidence |
| Browser product/control-plane QA | browser automation | interaction trace, console, screenshots |
| Mobile correctness/performance | simulator/emulator then representative real device | device result, frame/perf/crash evidence |
| CI/release behaviour | CI/release environment | workflow/build/release evidence |
| Store/payment/irreversible production action | appropriate platform + explicit human gate | platform readback + audit record |

### Routing rules

- Do not use a text-only GitHub editing surface to claim a runtime-dependent feature is complete.
- Do not use a heavyweight engine/editor when a browser/local prototype answers the current design question more cheaply.
- Do not port a proven prototype to a production engine until the lifecycle benefit outweighs migration cost.
- Escalate to a stronger environment when the current surface cannot observe the failure mode.
- A failure to access the needed environment is a blocker/unknown, not permission to infer success.

## Parallelism policy

Parallelism is an optimisation, not a goal.

### Prefer parallel execution when

- workstreams own independent paths;
- results do not depend on each other's implementation;
- the same shared contract can be consumed read-only;
- comparison benefits from independent attempts;
- integration cost is low.

Examples: independent engine candidates, primary-source research, asset-generator evaluations, visual critic passes, independent test analysis.

### Prefer sequential/stacked execution when

- several workstreams mutate the same schema/contract;
- architecture or migration decisions change downstream assumptions;
- release integration is involved;
- a shared foundation is still unstable;
- verification must occur on the integrated result;
- conflict/rebase cost is likely to exceed elapsed-time savings.

More agents are not automatically faster. Measure validated throughput after integration.

## Shared-foundation ownership

For comparative experiments, separate:

- **shared foundation lane** — contracts, source assets, provenance, test sequence, scoring, evidence schemas;
- **candidate lanes** — runtime-specific implementation/evidence only.

Candidate lanes treat the frozen shared foundation as read-only unless they raise a coordinated change request that applies fairly to all candidates.

This prevents one implementation from quietly changing the benchmark to suit itself.

## Hotspot files

Files that coordinate the whole repository create disproportionate collision risk, including examples such as:

- `AGENTS.md`;
- shared schemas;
- root `package.json`;
- repository validators;
- root README;
- CI workflows;
- shared benchmark contracts.

A session planning to change a hotspot must inspect open PR changed-file lists first and explicitly own that edit. Prefer additive files over central-file edits when discoverability/enforcement does not require the hotspot change.

## Pull request contract

Every substantive PR must expose:

- authoritative issue/workstream;
- branch/base dependency;
- owned scope;
- concurrent PRs checked;
- known overlap or stacking relationship;
- environment used;
- execution evidence;
- unresolved unknowns;
- handoff/next action if not complete.

A green CI check proves only what that workflow actually tests.

## Merge train

The integration unit is `main`, not an isolated green branch.

Before merge:

1. confirm the PR still targets the intended current integration state;
2. inspect newly opened/merged concurrent PRs for overlap;
3. resolve review threads/material findings;
4. run the freshest relevant validation after the final material change;
5. verify expected head SHA when merging where supported.

When several PRs are causally dependent, merge in dependency order and revalidate/rebase downstream work against the new `main` rather than pretending independent green checks prove the combined state.

After a material integration, verify `main`/the integrated environment. If integration breaks behaviour, fix forward when safe or revert the smallest offending change when rollback is lower risk.

## Handoff contract

A session is not done merely because its chat stops.

Before releasing a workstream, leave GitHub-visible context containing:

```text
Status: completed | partial | blocked | handed-off
Issue: <authoritative issue>
Branch/PR: <links>
Head SHA: <commit>
What changed: <bounded summary>
Evidence: <tests/builds/captures/records>
Decisions: <important conclusions>
Failures/unknowns: <what did not work or remains unknown>
Dependencies: <live dependencies>
Owned paths released: <yes/no/list>
Next safe action: <specific executable continuation>
```

A completely fresh agent should be able to continue from this record without reading old chats.

## Stale claim recovery

Claims are logical leases, not permanent locks.

A claim may be superseded when live GitHub evidence shows its branch/PR is inactive, merged/closed, or explicitly handed off. Before superseding it:

1. inspect the issue comments;
2. inspect the claimed branch/PR/head;
3. preserve any unmerged useful work;
4. post a new claim explaining why the earlier lease is stale/superseded.

Do not wait indefinitely for an unavailable chat.

## Control-plane rule

The human control plane should make the system easier to understand and operate, including displaying:

- active workstreams;
- branch/PR/head SHA;
- dependencies;
- path ownership/overlap risk;
- evidence freshness;
- human gates;
- handoff state;
- pipeline/game health.

But canonical writes should resolve to repository/tracker records. UI-only state that can disagree with GitHub is a defect.

## Coordination telemetry

We should measure enough coordination data to know whether this operating model improves throughput. Useful optional metrics include:

- stale-base detections;
- pre-edit overlap detections;
- merge conflicts;
- rebases caused by parallel work;
- duplicate-work incidents;
- handoffs;
- rediscovery effort after handoff;
- wrong-environment reroutes;
- human interventions caused by coordination;
- integration rework unrelated to product defects.

Do not collect a metric unless it can change a workflow decision.

## Coordinator-agent threshold

Do not build a bespoke coordinator merely because it sounds more autonomous.

GitHub-native coordination remains preferred while it is cheap and reliable. A dedicated coordinator agent/App earns implementation only when measured evidence shows repeated collision, stale-claim, scheduling, or integration overhead that automation can materially reduce.

If built, it should automate the protocol above rather than invent a second coordination model.

## Session completion test

A work session is 10/10 only when:

1. it improved the product/pipeline rather than merely producing activity;
2. it used the strongest practical environment and solved systems;
3. its claims are supported by fresh evidence;
4. it did not create avoidable concurrent conflicts;
5. its state is reconstructable from GitHub;
6. a fresh agent can continue with little rediscovery;
7. failures/unknowns remain explicit;
8. the next frontier is clearer than before.