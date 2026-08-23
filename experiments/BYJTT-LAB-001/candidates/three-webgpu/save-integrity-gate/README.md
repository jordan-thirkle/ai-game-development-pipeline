# Three.js save-integrity correctness gate

This bounded gate fuzzes the integrated BYJTT-LAB-001 Three.js/WebGPU persistence input before startup. It does not modify production gameplay or claim progression.

The production candidate must start safely when local persistence is absent, malformed, from an unsupported schema, or semantically invalid. Invalid persisted values must not import non-finite or negative reward counts, unknown upgrade identifiers, or an upgrade-derived damage increase.

## Owned scope

- `experiments/BYJTT-LAB-001/candidates/three-webgpu/save-integrity-gate/**`
- `.github/workflows/benchmark-001-three-save-integrity.yml`

`src/**`, `index.html`, `shared/**`, and every other proof subtree are read-only.

## Runtime cases

The real production build is launched in Chrome at 390×844 in isolated browser contexts with these startup persistence inputs:

1. no save;
2. malformed JSON;
3. unsupported schema;
4. schema 1 with a non-numeric reward count plus a valid upgrade identifier;
5. schema 1 with a negative reward count;
6. schema 1 with an unknown upgrade identifier.

Writing corrupt localStorage before page startup is persistence-boundary fuzzing only. It is never accepted as gameplay progress or a Phase A result.

## Fail-closed expectations

- runtime still becomes ready;
- `reward.count` is finite, integer, and non-negative;
- selected upgrade identifiers are limited to `damage-up-1`;
- cases with invalid reward counts do not retain `damage-up-1` or elevated attack damage;
- unknown upgrade identifiers never reach engine-owned observations;
- browser/page errors remain empty;
- the harness exposes no gameplay state setter.

A reproduced production defect is valid blocker evidence. Do not weaken these checks to manufacture green CI.
