# Contributing

This repository is an evidence-driven game-development laboratory. Changes should make experiments more reproducible, improve the production pipeline, or add a clearly scoped candidate implementation.

## Principles

1. Reuse proven engine-native or open-source solutions before adding bespoke infrastructure.
2. Record provenance and licence information for third-party code, assets, models, audio, and datasets.
3. Keep simulation/game rules separable from renderer/editor integration where practical so comparisons and ports remain meaningful.
4. Do not claim an experiment passes without fresh execution evidence.
5. Preserve failed experiments and negative results when they teach us something useful.
6. Prefer small, reviewable changes with explicit acceptance criteria.

## Experiment changes

Every benchmark or experiment must include:

- a stable experiment ID;
- hypothesis and scope;
- candidate technologies and pinned versions;
- shared constraints and source assets;
- acceptance criteria;
- deterministic or repeatable test procedure;
- result/evidence locations;
- licence/provenance notes;
- conclusion and promotion decision when complete.

## Production promotion

A component is not promoted into `registry/` merely because it works once. Promotion requires reproducible evidence, acceptable licensing, maintainability, and a documented reason it beats or complements the current incumbent.

## Game graduation

If an experiment produces a genuinely promising game, preserve the benchmark implementation and create a separate production repository for the game. The production game may continue to consume reusable components from this lab while its player-facing roadmap remains independent.
