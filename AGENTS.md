# Agent Operating Contract

This repository is an evidence-driven AI game-development laboratory. Agents must optimise for the best end-to-end production outcome, not loyalty to a previously selected engine, framework, model, vendor, or implementation.

## Mandatory solved-system gate

Before substantial custom implementation, evaluate in order:

1. Can the requirement be removed or simplified?
2. Does the selected engine/runtime already solve it well?
3. Is there a mature, maintained, permissively licensed open-source implementation?
4. Is there a proven commercial/free solution whose lifecycle cost is lower?
5. Does this repository already contain a promoted solution?
6. Can an AI generator produce a production-ready result that passes the same validation gate?
7. Only then implement bespoke code.

Record why the selected option wins when the decision materially affects the experiment.

## Research before framework-specific changes

For fast-moving engines, SDKs, libraries, stores, deployment systems, AI tooling, model APIs, and platform requirements, verify current official documentation before relying on remembered APIs or constraints.

## Evidence loop

The default development loop is:

`research -> retrieve -> compose -> implement -> execute -> observe -> measure -> critique -> repair -> verify -> compare -> promote or reject`

Code inspection alone is never proof that a gameplay feature works.

## Experiment integrity

- Use the shared specification and source assets for comparative benchmarks.
- Pin versions/commits where reproducibility requires it.
- Do not quietly weaken acceptance criteria for one candidate.
- Record failed attempts and incompatibilities.
- Keep benchmark-specific adapters separate from shared game rules where practical.
- Every result must link to fresh execution evidence.

## Assets

Prefer vetted existing assets before generation. Every third-party or generated asset must have provenance, licence/usage status, and validation results. Game-ready 3D assets must pass scale, orientation, topology/geometry, material, skeleton, animation, collision, memory/performance, and visual checks appropriate to the target.

## Games

Promising prototypes may graduate into standalone production repositories. Do not distort benchmark methodology merely to favour a game candidate. Production telemetry can later feed aggregate lessons back into this lab.

## Publication

Experiments should be structured so their methodology, evidence, failures, and conclusions can become first-party research on games.byjtt.com without inventing results or publishing commercially sensitive information by default.
