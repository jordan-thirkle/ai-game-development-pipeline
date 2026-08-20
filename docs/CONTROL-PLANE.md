# Human Control Plane

The AI Game Development Pipeline needs a human-operable surface over the same durable state used by ChatGPT, Codex, CI and future workers. The control plane is a **projection and command surface**, never a second source of truth.

## Relationship to the multi-agent operating model

[`docs/MULTI-AGENT-OPERATING-MODEL.md`](MULTI-AGENT-OPERATING-MODEL.md) owns cross-session coordination: workstream claims, branches/bases, owned and avoided paths, dependency/overlap rules, environment routing, evidence and handoff.

The Studio must project that model rather than invent a competing coordination kernel. Canonical writes resolve to GitHub/repository records; UI-only state that can disagree with them is a defect.

## First useful slice

A human should be able to open a benchmark/game and immediately see:

- lifecycle and pipeline stage state;
- active workstreams, branch/base, environment and next safe action;
- blockers and dependencies;
- agent roles;
- material decisions and rejected alternatives;
- fresh evidence and evidence gaps;
- latest playable build when one exists;
- explicit human gates.

A human gate must be **ineligible while its prerequisites are blocked**. The UI may not turn a blocked stage green merely because a button was clicked.

## Product direction

Build web-first/local-first. A future macOS/desktop distribution should wrap the same domain model unless native-only requirements are proven.

Longer term the Game Development OS can expose portfolio health, pipeline graph, Playtest Lab, workstream/agent room, decision ledger, solved-system registry, asset provenance, quality gauntlet, releases, commercial telemetry, LiveOps and run replay. Those are secondary until the first real benchmark can move through the visible pipeline end to end.

## Canonical concepts

- **Project** — game, experiment, benchmark or reusable pipeline initiative.
- **Stage** — lifecycle state with prerequisites and evidence requirements.
- **Workstream** — bounded claimed unit projected from GitHub coordination state.
- **Gate** — automated, human or mixed rule controlling advancement.
- **Evidence** — reproducible proof such as test output, build, screenshot, recording, profiler/device run or provenance record.
- **Decision** — consequential choice with alternatives, rationale and evidence.
- **Build** — runnable artifact tied to a source revision and verification state.

## Human authority boundary

Keep explicit human authority for gameplay/taste acceptance, graduation to production, meaningful spend, irreversible publication/shutdown, unresolved legal/licensing ambiguity, destructive operations without proven rollback and other genuinely human decisions. Routine research, implementation, testing, evidence capture and safe recovery should not require Jordan to coordinate agents manually.

## Verification rule

Green status is claim-specific evidence, not confidence. Repository/schema CI can verify data contracts; it cannot prove browser rendering, gameplay feel, engine behaviour, mobile performance or store correctness. Browser UI requires browser verification, games require real execution/playtesting, and device claims require simulator/device evidence.

## Current milestone

The Studio keeps its canonical benchmark projection read-mostly: it consumes the deterministic `BYJTT-LAB-001` fixture, projects stages/workstreams/agents/decisions/evidence/builds, and prevents human approval while the gate is blocked.

It also exposes one bounded command surface for local user testing. The **Run Pipeline** view creates a fresh copy of the repository sample, executes intake, registry selection, build and QA, then displays its release candidate and publishing receipt. The local service binds only to `127.0.0.1`; the publishing boundary remains dry-run only, local-only, secret-free, and non-executing. It does not write verdicts to the canonical fixture or provide any store/provider operation.
