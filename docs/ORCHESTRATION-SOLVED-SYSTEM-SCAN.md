# Orchestration solved-system scan — 2026-08-19

## Question

Should the pipeline build its own durable multi-agent orchestration runtime, or compose an existing solved system beneath the By JTT game-development domain layer?

## Requirements

The orchestration substrate should support durable long-running work, retries/idempotency, concurrency control, event-driven coordination, human-in-the-loop waits, observability/tracing, resumability across crashes/deploys, structured inputs/outputs, and a reactive UI/control-plane integration. It must not become the canonical source of game-development decisions; repository schemas/evidence remain portable.

## Current candidates

### Trigger.dev

Strong fit for a TypeScript-first control plane. Current product material exposes long-running durable tasks, retries, queues, concurrency keys, human-in-the-loop approval, realtime/streaming, structured inputs/outputs, observability, versioning, Python/system-package/browser/FFmpeg execution and GitHub/Vercel integration. Its 2026 AI Agents release adds durable chat agents/sessions that survive refreshes, redeploys and crashes.

### Inngest

Strong fit for event-driven durable execution. Current documentation exposes independently persisted/retried steps, durable agent loops, dynamic multi-agent coordination, human waits via events, observability/debugging, event coordination and production agent evaluation. Its 2026 checkpointing work targets the latency tax common to durable workflow engines.

### Temporal

Strongest mature general-purpose durability model among the candidates reviewed. Temporal's current AI reference architecture keeps durable orchestration state in workflows while external/non-deterministic work occurs in activities, with update-driven interaction. It is powerful but likely carries more operational/conceptual weight than this pipeline needs initially.

### LangGraph / LangSmith ecosystem

Strong agent graph/runtime and evaluation story. Current LangChain material emphasises durable execution, memory, human-in-the-loop and observability for long-running agents, plus run/trace/thread-level evaluation. Useful reference and possible substrate, but we should avoid coupling the whole game factory to one agent-framework abstraction unless benchmarks show a clear advantage.

### OpenAI Agents SDK

Relevant as a model-native agent harness rather than the sole cross-provider orchestration substrate. OpenAI's 2026 Agents SDK direction includes long-horizon computer/file/command work and native sandbox execution. It should be supported as a worker/harness option while canonical pipeline state remains provider-neutral.

## Provisional decision

Do **not** build a bespoke durable workflow engine.

Benchmark **Trigger.dev and Inngest first** for the initial TypeScript web/control-plane implementation. Keep Temporal as the durability reference/scale-up candidate and support OpenAI Agents SDK/Codex as worker execution harnesses rather than making them the global state authority.

The By JTT-specific code should focus on the thin domain layer that these systems do not solve for us: game lifecycle semantics, solved-system gates, evidence freshness, gameplay/human gates, asset provenance, commercial graduation, persistent roles, context compilation and projections into the Studio UI.

## Benchmark criteria

- local development and self-hosting/portability;
- free/low-cost path and lifecycle cost;
- durable waits and human approval;
- idempotency and recovery correctness;
- concurrency/claim semantics;
- realtime UI subscription quality;
- observability and exportability;
- TypeScript ergonomics;
- sandbox/browser/native-tool integration;
- vendor lock-in and migration path;
- ability to preserve repository-owned canonical contracts;
- measured orchestration latency/cost;
- AI-agent integration without forcing one model/provider.

## Decision rule

Adopt the smallest solved substrate that demonstrably satisfies the first real cross-session game-development workflow. Do not adopt infrastructure because its feature list is impressive. If a plain repository + GitHub coordination projection remains simpler and more reliable at current scale, retain it until durable execution earns its complexity.
