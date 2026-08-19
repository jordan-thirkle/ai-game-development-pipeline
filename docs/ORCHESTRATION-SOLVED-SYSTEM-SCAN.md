# Orchestration solved-system scan — 2026-08-19

## Question

Should the pipeline build its own durable multi-agent orchestration runtime, or compose an existing solved system beneath the By JTT game-development domain layer?

## Requirements

The substrate should support durable long-running work, retries/idempotency, concurrency control, event-driven coordination, human-in-the-loop waits, observability/tracing, resumability, structured I/O, and reactive control-plane integration while repository contracts remain portable.

## Current candidates

### Trigger.dev

Strong TypeScript-first fit: durable long-running tasks, retries, queues/concurrency, HITL approval, realtime/streaming, structured I/O, observability, versioning, Python/system packages/browser/FFmpeg execution and integrations. Its 2026 AI Agents release adds durable sessions that survive refreshes, redeploys and crashes.

Sources: `https://trigger.dev/product/ai-agents`, `https://trigger.dev/product`, `https://trigger.dev/changelog/v4-5-0`.

### Inngest

Strong event-driven fit: independently persisted/retried steps, durable dynamic agent loops, multi-agent coordination, human waits via events, observability, event coordination and production agent evaluation. 2026 checkpointing specifically targets durable-workflow latency.

Sources: `https://www.inngest.com/docs/learn/durable-agents`, `https://www.inngest.com/docs/patterns/durable`, `https://www.inngest.com/docs/learn/agent-evals`, `https://www.inngest.com/blog/introducing-checkpointing`.

### Temporal

Strong mature general-purpose durability reference. Its current AI architecture keeps durable orchestration state in workflows and external/non-deterministic work in activities with update-driven interaction. Likely more operational/conceptual weight than needed initially.

Source: `https://go.temporal.io/platform-hub/ai-engineering/ai-reference-architecture`.

### LangGraph / LangSmith ecosystem

Strong agent-runtime/evaluation reference: durable execution, memory, HITL, observability and run/trace/thread-level evaluation. Avoid coupling the factory to one agent-framework abstraction unless benchmark evidence justifies it.

Sources: `https://www.langchain.com/blog/runtime-behind-production-deep-agents`, `https://www.langchain.com/resources/agent-evals`.

### OpenAI Agents SDK

Relevant as a model-native worker harness, not the sole cross-provider orchestration authority. OpenAI's 2026 direction includes long-horizon file/command/computer work and native sandbox execution.

Source: `https://openai.com/index/the-next-evolution-of-the-agents-sdk/`.

## Provisional decision

Do **not** build a bespoke durable workflow engine.

Benchmark **Trigger.dev and Inngest first** for the TypeScript control-plane implementation. Keep Temporal as the durability reference/scale-up candidate and OpenAI Agents SDK/Codex as worker execution harnesses rather than global state authorities.

By JTT-specific code should remain the thin domain layer these systems do not solve: game lifecycle semantics, solved-system gates, evidence freshness, gameplay/human gates, asset provenance, commercial graduation, persistent roles, context compilation and Studio projections.

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
- repository-owned canonical contracts;
- measured orchestration latency/cost;
- model/provider neutrality.

## Decision rule

Adopt the smallest solved substrate that demonstrably satisfies the first real cross-session game-development workflow. If repository + GitHub coordination remains simpler and more reliable at current scale, retain it until durable execution earns its complexity.
