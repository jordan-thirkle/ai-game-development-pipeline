# By JTT AI Game Lab Method

## Purpose

The lab exists to discover, measure, and continuously improve the most effective end-to-end ways to build games with AI. It treats engines, runtimes, models, libraries, asset sources, automation methods, QA systems, and deployment routes as competing production choices.

## Core loop

1. Define a game or production capability with measurable acceptance criteria.
2. Identify serious candidate solutions using current documentation and ecosystem research.
3. Reuse identical source assets, constraints, and test sequences where a comparison requires fairness.
4. Build the smallest complete playable slice that exercises the capability.
5. Execute it, capture telemetry/evidence, and run deterministic or repeatable playtests.
6. Evaluate product quality, engineering quality, performance, AI-production efficiency, mobile suitability, and economics.
7. Compare candidates honestly, including failures.
8. Promote winners into the reusable registry only when evidence is reproducible.
9. Publish appropriate first-party research to games.byjtt.com.
10. If a prototype is genuinely fun or commercially promising, graduate it into a production game repository and continue learning from real players.

## Required score families

### AI production efficiency
- elapsed agent execution time;
- token/inference usage where observable;
- tool calls and failures;
- human interventions;
- retries/repair cycles;
- custom lines of code;
- reused component ratio;
- iterations to acceptance.

### Product quality
- control feel and responsiveness;
- gameplay comprehension;
- visual coherence;
- animation integrity;
- audio/visual feedback;
- touch usability;
- accessibility considerations;
- critic and human playtest results.

### Engineering quality
- reproducible builds;
- automated test pass rate;
- crashes/errors/warnings;
- maintainability;
- dependency burden;
- portability;
- deterministic replay reliability.

### Performance
- average/median FPS and frame time;
- 1% low where available;
- CPU/GPU utilisation where measurable;
- RAM/VRAM;
- draw calls/triangles for 3D;
- startup/load time;
- package or transfer size;
- thermals/battery on representative mobile hardware where feasible.

### Economics
- paid asset/tool cost;
- inference/API cost;
- CI/build cost;
- hosting/backend cost;
- estimated maintenance burden.

## Promotion states

`candidate` -> `verified` -> `preferred` -> `superseded`

A `preferred` solution is only the current incumbent for a defined capability and context. New evidence may replace it at any time.

## Publication rule

Public research must distinguish measured results from interpretation, include tested versions/dates, explain methodology and limitations, and preserve negative results that materially affect the conclusion.
