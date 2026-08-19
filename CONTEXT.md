# AI Game Development Pipeline Context

## Mission

Build and continuously improve an evidence-driven AI-native game-development system that can discover opportunities, choose the strongest solved systems, build excellent games, validate them with machines and humans, publish/monetise them responsibly, and maintain them over their full lifecycle.

## Operating model

The repository is the durable source of truth. ChatGPT, Codex and other agents are interchangeable workers and interfaces over shared state. Human attention is reserved primarily for taste, gameplay judgement, material spend, irreversible publication, legal/licensing ambiguity, and other decisions where human authority is genuinely required.

## Current system direction

- Human-facing control plane / Game Development OS.
- Canonical machine-readable pipeline state and evidence.
- Persistent specialist roles with disposable worker sessions.
- Solved-system-first selection before bespoke implementation.
- Automated validation plus real human playtesting.
- Full lifecycle through release, monetisation, LiveOps, maintenance and retirement.
- Pipeline telemetry so the factory itself can be benchmarked and improved.

## Current coordination problem

Parallel chats increase throughput but can create coordination entropy: duplicated research, stale branches, conflicting decisions, context reconstruction and unclear ownership. The next architectural layer is a coordination kernel with bounded work units, leases/claims, append-only events, evidence-derived state, recovery policies and minimal context compilation.

## Canonical references

- `AGENTS.md` — operating contract.
- `docs/PIPELINE.md` — lifecycle.
- `docs/CONTROL-PLANE.md` — human control-plane architecture.
- `docs/AI-AGENT-CONFIG.md` — provider/tool configuration policy.
- `docs/agents/issue-tracker.md` — multi-session coordination.
- `schemas/` — executable contracts.
- `experiments/` — reproducible benchmark evidence.

Detailed decisions should be recorded in focused docs, issues, schemas or future ADRs rather than expanding this file into a transcript.