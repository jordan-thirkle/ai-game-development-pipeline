# BYJTT-LAB-001 — External Controller Reuse Bake-off

Status: `specified-not-executed`
Date specified: 2026-08-20
Owner: External Open-Source/Game-Reuse Discovery Gate

## Purpose

Prove whether the new reuse gate can materially reduce implementation effort for the movement/camera/input portion of BYJTT-LAB-001 without weakening quality, portability, mobile, maintenance, licence, or execution requirements.

This is the first proving run for the reuse gate. It is not allowed to promote a candidate from documentation inspection alone.

## Capability under test

Subset of the shared slice:

`launch -> move -> camera -> jump -> idle/walk/run state signal -> touch input -> gamepad/desktop input -> camera obstruction handling`

The controller must remain compatible with later enemy/combat/save integration.

## Reuse candidates discovered

### PlayCanvas

Registry candidate: `playcanvas-third-person-controller`

Pinned first-party source:
`playcanvas/engine@c84daf93a4a8c96cd97d429b17dc5abfb12375ce/scripts/esm/third-person-controller.mjs`

Expected leverage before execution:
- first-party reusable controller rather than custom movement code;
- keyboard/mouse, touch and gamepad input already represented;
- movement/jump/controller-camera behaviour already composed;
- camera collision avoidance already present;
- speed/jump events can feed animation state.

### Godot

Registry candidate: `godot-tps-demo-controller`

Pinned first-party source:
`godotengine/tps-demo@90f2e38`

Expected leverage before execution:
- first-party third-person movement/camera/shooter reference;
- gamepad and desktop control path already present;
- mature scene-level reference for the Godot lane.

Important constraint: code is MIT, while bundled assets/music have separate CC-BY 3.0 obligations. The bake-off should preferentially reuse/reference controller code and use the experiment's separately approved shared assets.

## Baseline

For each retained engine lane, the comparison baseline is the smallest credible bespoke implementation an experienced agent would otherwise have written after engine-native primitives were considered.

Do **not** deliberately make the bespoke baseline poor. Record every custom source line/module and agent iteration required.

If the lane already contains custom controller work predating this gate, preserve it as the baseline rather than rewriting it merely to create a comparison.

## Frozen acceptance criteria

Both reuse and baseline variants must satisfy the same criteria:

1. Player launches in a deterministic test scene.
2. Ground movement works in at least four planar directions.
3. Character orientation is visually coherent with movement/camera mode.
4. Camera orbit/look works and does not remain inside known blocking geometry in the test path.
5. Jump works and cannot be repeatedly triggered while unsupported unless the candidate intentionally implements a documented multi-jump mechanic.
6. Idle/walk/run or equivalent locomotion state is observable for animation driving.
7. Desktop input works where the runtime supports desktop.
8. Gamepad input works where the runtime supports gamepad.
9. Mobile/touch input works at the experiment's mobile-shaped viewport; if the upstream candidate lacks touch, adaptation effort must be counted.
10. No known blocker/crash occurs during the repeated controller path.
11. Source/licence/provenance obligations are recorded.
12. Integration remains understandable and editable by future agents.
13. No hidden instrumentation mutates game state to manufacture a pass.

## Measurements

Capture separately for reuse and baseline:

- elapsed agent implementation time where observable;
- agent/tool calls and intervention count where observable;
- files/modules added or materially changed;
- custom lines/modules versus reused lines/modules;
- dependency additions;
- setup/import steps;
- failed attempts and repairs;
- controller defects found during the repeated path;
- desktop/gamepad/touch coverage;
- camera obstruction correctness;
- integration difficulty: low/medium/high plus evidence;
- maintenance/editability assessment;
- execution evidence links;
- target-view performance impact where measurable;
- licence/notice burden;
- total lifecycle concerns introduced by reuse.

## Decision rule

`promote` only if the reusable candidate:

- passes all applicable frozen acceptance criteria;
- has no unresolved licence/provenance blocker;
- demonstrates a material implementation or lifecycle advantage over the credible bespoke baseline;
- does not create disproportionate maintenance, dependency, performance or platform risk;
- has fresh execution evidence attached to the registry record;
- records the experiment in `usedIn`.

Otherwise choose one of:

- `qualified` — useful candidate, no project-specific win proven yet;
- `rejected` — loses the project-specific bake-off or has unacceptable risk;
- `quarantined` — unresolved licence/provenance/security issue;
- `stale` — upstream evidence requires revalidation.

## Required evidence package

For each executed lane:

- exact engine version;
- exact reusable source commit/version;
- exact baseline commit;
- setup/build/run command or editor procedure;
- repeatable controller test path result;
- screenshot/video evidence;
- console/editor errors;
- mobile-shaped viewport evidence;
- touch/gamepad evidence as applicable;
- code/change statistics;
- measured implementation/repair effort where available;
- final recommendation and rationale.

## Current outcome

`UNKNOWN — EXECUTION REQUIRED`

Discovery evidence shows strong candidates exist, which already proves the previous workflow could miss substantial solved work. It does **not** yet prove either controller should be production-promoted.
