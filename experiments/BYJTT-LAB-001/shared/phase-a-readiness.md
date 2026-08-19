# BYJTT-LAB-001 Phase A Readiness

Status: active.

Phase A is the greybox / engine-plumbing tranche. Candidate lanes may begin before the final shared art baseline is frozen, provided they obey the shared gameplay constants and `playtest-contract.json`.

## What is frozen enough for Phase A

- candidate IDs and version pins;
- gameplay constants in `contract.json`;
- neutral input/observation protocol in `playtest-contract.json`;
- candidate evidence layout;
- solved-system research baselines on issues #35–#40;
- candidate path ownership and environment requirements.

## What is intentionally not frozen yet

- selected binary source asset hashes;
- exact animation clip mappings;
- cross-runtime skeleton/import evidence;
- final production-content performance baseline.

Those belong to #34's execution tranche and gate Phase B, not Phase A engine plumbing.

## Phase A lane completion evidence

A candidate may claim Phase A complete only when the exact candidate revision has:

1. executed the shared playable path using normal gameplay input;
2. produced a candidate `pipeline-run.json`;
3. produced `playtest-result.json` keyed to all shared step IDs;
4. retained build/start commands and environment identity;
5. retained runtime/editor/browser logs;
6. captured visual evidence for player-facing mechanics;
7. recorded solved-system selections/rejections and benchmark deviations;
8. recorded failures/recovery rather than presenting only the successful final state.

Source inspection alone cannot satisfy any runtime-dependent item.

## Parallelism rule

Candidate lanes #35–#40 are independent for Phase A and should execute concurrently where proof-capable environments are available. They must not modify `shared/**` unilaterally. If execution reveals a genuinely cross-runtime contract defect, stop the affected assertion, record evidence, and coordinate one shared-contract revision before continuing.

## Promotion boundary

Phase A can produce context-scoped findings about iteration velocity, agent editability, native-system leverage, QA ergonomics, custom/reused code burden, build/startup cost and coordination overhead.

It cannot crown a final production-content visual/mobile winner. That requires Phase B.
