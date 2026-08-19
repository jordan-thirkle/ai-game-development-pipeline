# Issue Tracker Contract

GitHub Issues is the canonical coordination tracker for multi-session work in this repository.

## Purpose

Chats and agent sessions are disposable execution contexts. Durable ownership, decisions, blockers, dependencies, evidence pointers, and handoffs belong in GitHub/repository state rather than conversation history.

## Work ownership

Before substantial work, a worker must identify or create a bounded work unit and claim it before execution. A claimed unit must identify the worker/session role, intended output, starting revision, and claim time. Workers must not knowingly duplicate an active claim.

Until an automated lease service exists, assignment plus a claim comment is the compatibility mechanism. Claims should be short-lived and released when work completes, blocks, or the session ends.

## Wayfinding

Large uncertain efforts use one GitHub issue as the map and child/linked issues as decision tickets. The map records destination, decisions already made, unresolved fog, and scope boundaries. Decisions live in their tickets, not duplicated across chats.

## Evidence

A ticket is not complete because an agent says it is. Resolution must point to durable evidence such as commits, PRs, tests, benchmark records, screenshots, recordings, device runs, decisions, or validated state transitions.

## Concurrency rule

Repository state wins over chat recollection. A new worker must refresh the relevant issue/PR and repository revision immediately before acting. If another worker changed the same scope, reconcile first.

## Future kernel

The planned coordination kernel will replace manual claim comments with machine-readable leases, append-only events, derived state, recovery policies, and context compilation while retaining GitHub as a durable human-auditable projection.