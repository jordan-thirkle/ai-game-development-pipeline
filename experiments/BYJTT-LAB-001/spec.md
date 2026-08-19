# BYJTT-LAB-001 — Mobile 3D Action Slice

## Status

`active-phase-a`

Phase A (greybox / engine plumbing) is active across candidate lanes. Phase B (frozen shared-content comparison) begins only after the shared asset baseline has execution-backed binary/hash/import evidence.

## Hypothesis

For an AI-driven mobile-first 3D game prototype, browser-native TypeScript stacks may reach a verified playable state faster than editor-centric engines, while complete engines may reduce downstream integration, mobile, and maintenance work. The experiment measures where those trade-offs actually occur.

## Initial candidates

- Three.js / WebGPU
- PlayCanvas
- Babylon.js
- Godot
- Unity
- Defold (only if the required 3D feature set is reasonably comparable)

Candidates may be added or removed before implementation when current research shows the comparison would otherwise be misleading. Changes must be documented.

## Shared playable slice

The implementation must support this complete path:

`launch -> move -> camera -> enemy encounter -> attack -> hit reaction -> damage -> break salvage object -> collect reward -> choose upgrade -> defeat/avoid enemy -> save -> restart -> state restored`

### Required systems

- controllable 3D player;
- idle/walk/run animation states;
- camera suitable for mobile play;
- collision and physics appropriate to the mechanic;
- one enemy with navigation/steering and attack behaviour;
- melee or short-range attack;
- damage, hit reaction, death/reset state;
- breakable salvage object;
- collectible reward;
- one meaningful upgrade choice;
- particles/visual feedback;
- audio feedback;
- minimal HUD;
- touch controls;
- save/reload;
- deterministic or repeatable automated playthrough;
- mobile-shaped viewport and performance capture.

## Execution phases

### Phase A — greybox / engine plumbing

Candidate lanes may use engine-native primitives so they can execute in parallel before the final shared art baseline is frozen. Phase A measures implementation/agent velocity, engine-native leverage, bespoke/reused code burden, build/startup/tooling cost, deterministic QA capability, gameplay-system maintainability, and workflow coordination cost.

Phase A does not support final claims about shared-asset import quality, animation fidelity, production visual quality, or production-content mobile performance.

### Phase B — frozen shared content

After the shared asset baseline records exact selected source binaries, hashes, licence evidence, skeleton/clip inspection and cross-runtime import viability, every retained candidate swaps to the same approved character/animation/environment sources and reruns the common evidence contract.

Phase B adds comparable asset transformation/import effort, animation/material quality, production-content performance, mobile packaging/device evidence, and human gameplay/presentation evaluation.

## Fairness constraints

- use the same approved source asset set where engine compatibility permits in Phase B;
- use equivalent gameplay numbers and encounter layout;
- do not intentionally use a weaker implementation pattern for a candidate;
- use mature engine-native or proven open-source systems before bespoke replacements;
- record any candidate-specific advantage that cannot be normalised;
- acceptance criteria may not be weakened silently;
- test instrumentation may observe gameplay state but may not mutate it to manufacture a pass;
- missing evidence remains `unknown`, not `pass`.

## Evidence required

Each implementation must produce:

- pinned engine/runtime/library versions;
- build instructions;
- dependency/provenance record;
- implementation log;
- automated test/playthrough result keyed to the shared playtest contract;
- screenshot set;
- gameplay capture;
- console/editor error record;
- performance measurements appropriate to the current phase;
- AI-efficiency measurements where observable;
- custom/reused-code estimate;
- pipeline/workflow coordination measurements where observable;
- known limitations;
- final scorecard only when evidence is comparable for the claimed context.

## Quality gate

A candidate cannot be ranked as a production winner unless:

1. the full required path is playable;
2. the automated/repeatable playthrough succeeds;
3. there are no known crash/blocker defects in the measured path;
4. touch input is usable at the target viewport;
5. visual/animation defects are explicitly scored rather than ignored;
6. performance evidence exists on at least one representative environment;
7. build/reproduction instructions are verified;
8. the claim is limited to the phase and evidence actually completed.

## Outcome

The experiment may produce multiple winners by context. Example categories include fastest prototype iteration, strongest browser production stack, strongest native-mobile production stack, lowest maintenance burden, and best overall result.

No engine is entitled to remain the incumbent after contradictory evidence.
