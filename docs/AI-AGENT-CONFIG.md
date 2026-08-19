# AI Agent and Tool Configuration

## Goal

Keep one durable operating model while allowing multiple AI coding agents, IDE assistants, MCP clients, and future orchestration systems to work on the repository without instruction drift.

## Canonical hierarchy

1. **`AGENTS.md`** — repository-wide non-negotiable operating contract.
2. **Nearest scoped `AGENTS.md`** — local rules only when a subtree genuinely needs them.
3. **`agents/`** — durable specialist roles and review responsibilities.
4. **`skills/`** — reusable procedures that can be invoked by compatible agents/orchestrators.
5. **`schemas/`, `registry/`, `docs/`, `workflows/`** — source-of-truth domain contracts and knowledge.
6. **Provider adapters** — short files such as `CLAUDE.md` or `.github/copilot-instructions.md` that point back to the canonical contract and add only provider-specific mechanics.

Do not copy the full operating contract into several provider files. Duplicate long-lived instructions drift and eventually contradict one another.

## Supported adapters

### Codex / AGENTS.md-aware agents

Use the root `AGENTS.md` directly. Add scoped `AGENTS.md` files only where local constraints materially differ.

### Claude Code

Root `CLAUDE.md` is a thin adapter. It tells Claude to read and obey the canonical `AGENTS.md` and relevant project contracts before making changes. Claude-specific workflow advice belongs there only when it cannot be expressed portably.

### GitHub Copilot

`.github/copilot-instructions.md` is a thin repository-wide adapter. Prefer `AGENTS.md` support where the active Copilot surface supports it; keep the Copilot file concise and non-conflicting.

### Future providers

Only add a provider-specific root instruction file when that provider actually uses it and the adapter increases reliability. Every adapter must point to the canonical contract.

## MCP policy

MCP integrations are capabilities, not authority. A tool becoming available does not automatically make it approved for the pipeline.

Before promoting an MCP server/integration, record:

- purpose and capability;
- official/source repository and version/protocol compatibility;
- authentication and permission model;
- local vs remote execution;
- data exposed to the server;
- write/destructive capabilities;
- licensing and cost;
- maintenance/status signal;
- failure and rollback behaviour;
- evidence that it removes meaningful work or improves quality.

Target the current MCP `2026-07-28` model for new first-party integrations. Avoid new dependencies on deprecated protocol features when a current alternative exists.

## Interactive MCP Apps

An MCP App may provide a specialised interface inside compatible hosts. Prefer this when a third-party capability already owns a rich UI (for example profiler, asset browser, deployment or analytics view) and embedding that UI avoids rebuilding it in the By JTT control plane.

The control plane still owns cross-tool orchestration, canonical project state, gates, evidence, decisions and lifecycle status.

## Specialist roles vs skills

Create an `agents/` role when the value comes from a durable perspective, responsibility or adversarial review stance.

Create a `skills/` procedure when the value comes from a repeatable sequence of steps, tool usage, validation or output contract.

A role can invoke many skills. A skill should not silently become the owner of overall product decisions.

## Context discipline

Agents should retrieve only the context needed for the current bounded task. Prefer references to canonical docs/schemas over pasting large duplicated instruction bodies into prompts.

Record consequential decisions and evidence in repository state so another agent can resume without relying on private conversational memory.

## Human visibility

The control plane should eventually surface:

- active agent role and bounded objective;
- status and blockers;
- tools/capabilities used;
- material decisions;
- output/evidence links;
- required human gates;
- handoff/next action.

Do not expose private chain-of-thought. Surface concise rationale, evidence, decisions and reproducible actions instead.
