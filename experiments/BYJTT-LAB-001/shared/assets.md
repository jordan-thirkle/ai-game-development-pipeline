# BYJTT-LAB-001 Shared Asset Baseline

Status: `candidate-baseline` pending actual download/import validation in every runtime.

The benchmark should minimise art-pipeline bias by starting from the same permissively licensed source content, then allowing runtime-specific import optimisation while recording all transformations.

## Character baseline

### Preferred candidate: Quaternius Universal Base Characters

Why it is currently the strongest shared baseline:
- CC0;
- six game-ready base characters;
- animation-friendly topology;
- humanoid rig intended for retargeting;
- glTF support suitable for browser and engine tracks;
- compatible with Quaternius Universal Animation Library;
- source rig/Blend availability provides a neutral upstream representation when conversion is required.

Primary source:
- https://quaternius.com/packs/universalbasecharacters.html

## Animation baseline

### Preferred candidate: Quaternius Universal Animation Library 2

Why:
- CC0;
- 130+ animations;
- universal humanoid rig;
- GLB/FBX/Blend formats;
- combat, locomotion, parkour and other clips well beyond the small subset required by Benchmark 001;
- explicitly designed for retargeting and tested by the publisher in major engines.

Benchmark 001 should select the smallest required clip set only:
- idle;
- walk/run locomotion;
- attack;
- hit reaction if available/suitable;
- death if available/suitable.

Primary source:
- https://quaternius.com/packs/universalanimationlibrary2.html

## Environment / primitive gameplay baseline

### Preferred candidate: Kenney Prototype Kit

Why:
- CC0;
- 145 assets;
- designed for prototyping;
- includes characters/vehicles/environment/building-style primitives, allowing the arena and salvage object to be constructed without custom modelling;
- deliberately simple geometry reduces rendering-style bias between engines.

Alternative: Kenney Platformer Kit if its modular pieces prove cleaner for the arena after import testing.

Primary sources:
- https://www.kenney.nl/assets/prototype-kit
- https://kenney.nl/assets/platformer-kit

## Optional materials / lighting references

Poly Haven is approved as a CC0 source for HDRIs, textures and models when a shared neutral material/lighting input is required. Do not add high-resolution assets merely because they are available; mobile memory/performance budgets remain part of the benchmark.

Primary source:
- https://polyhaven.com/license

## Asset fairness rules

1. Keep the original source files and hashes in the provenance record.
2. Use the same chosen character and animation clips in every runtime unless an import blocker is documented.
3. Runtime-native conversion, compression, material setup, texture processing, LOD generation and animation import settings are allowed.
4. Measure the work required for those transformations rather than pretending import pipelines are identical.
5. Do not manually polish one candidate's content while leaving another on default import settings.
6. If a runtime cannot support the common representation reasonably, record the incompatibility as evidence rather than silently substituting a better bespoke asset.
7. Generated assets are not part of the baseline. AI asset generation should be a later dedicated benchmark so engine comparison is not confounded by model-generation variance.

## Required import validation

Before freezing the baseline, each runtime track must verify:
- source file loads;
- scale/orientation;
- skeleton/skin integrity;
- animation playback;
- material/texture correctness;
- root-motion handling or deliberate non-root-motion policy;
- collision proxy strategy;
- mobile memory/performance suitability;
- no licence/provenance ambiguity.

## Decision rule

Freeze this baseline only if the same source character + animation subset can be imported into all serious Benchmark 001 candidates without candidate-specific manual reconstruction.

If that fails, the Governor should prefer the next most portable common source asset rather than weakening the benchmark.
