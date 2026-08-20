# BYJTT-LAB-001 — External Controller Reuse Bake-off

Status: `baseline-evidence-bound-reuse-not-executed`
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

## Real incumbent baselines already available

The comparison does not need a synthetic bespoke baseline. BYJTT-LAB-001 already produced execution-backed controller/physics traces before this discovery gate existed.

### PlayCanvas incumbent

PR #61, `Start BYJTT-LAB-001 PlayCanvas Phase A tracer`, records exact candidate head `7a486b74748a1fe2d1a9c548b05de4a134d73de5` executed successfully in workflow run `32212343706`.

Known evidence from that run:
- PlayCanvas `2.21.3`;
- strict TypeScript and production build passed after a recorded compile failure/repair cycle;
- real browser execution at `390×844`;
- normal-input movement observed: `2.84 m`;
- keyboard/touch movement and pointer camera path present;
- observation mutation isolation passed;
- renderer fell back to `webgl2` in the measured environment;
- the PR explicitly labels its arena-clamped movement as provisional tracer plumbing, not final controller/physics evidence.

PR #88, `Prove PlayCanvas native Ammo physics gate`, later records exact candidate head `36e6f4368e66ecb8e5c3295bebda84baca371f9f` and successful execution run `32308446517` proving native Ammo gravity/contact and east-wall collision under normal keyboard input. It explicitly does not yet replace the integrated tracer's provisional player controller.

Therefore the reuse comparison must measure the official first-party controller against the actual existing PlayCanvas tracer/native-physics path, preserving its failures, adaptation work, bundle/tooling cost and existing execution evidence.

### Godot incumbent

PR #80, `Start BYJTT-LAB-001 Godot Phase A tracer`, records exact candidate head `b2be94fecd7e6615b2c161bca0e928b42b00a315` executed using the official Godot runtime in workflow run `32303293888`.

Known evidence from that run:
- engine `4.7.1.stable.official.a13da4feb`;
- native `CharacterBody3D + move_and_slide()` controller;
- runtime tracer passed;
- normal `move_forward` produced `3.241 m` movement in one second;
- native east-wall collision stopped at `x=11.35 m`;
- observation mutation isolation passed;
- the PR deliberately used Godot-native machinery first and did not add a third-party controller dependency.

This is a strong engine-native incumbent. The reuse gate must not create churn merely because a reusable TPS example exists. The first-party TPS code earns promotion only if it adds measurable lifecycle value—such as camera, aiming, input, locomotion-state or integration leverage—without degrading the simpler native baseline.

## Baseline rule

For each retained engine lane, preserve the existing execution-backed implementation as the incumbent wherever it covers the capability under test.

Do **not** deliberately make the incumbent poor, rewrite it merely to create a comparison, or ignore its already-paid implementation/debugging cost. Measure both:

- incremental effort from the current incumbent to satisfy the frozen controller contract; and
- counterfactual evidence, where reconstructable, showing work the reuse gate could have avoided had it run before the original implementation.

The second measure must be labelled estimated/counterfactual unless repository telemetry makes it directly observable.

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

Capture separately for reuse and incumbent:

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

For historical incumbents also capture already-recorded failure/recovery cycles and implementation evidence rather than erasing sunk work from the comparison.

## Decision rule

`promote` only if the reusable candidate:

- passes all applicable frozen acceptance criteria;
- has no unresolved licence/provenance blocker;
- demonstrates a material implementation or lifecycle advantage over the credible incumbent;
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
- exact incumbent commit(s);
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

`PARTIAL EVIDENCE — INCUMBENTS EXECUTED; REUSE VARIANTS REQUIRE EXECUTION`

The discovery gate has already demonstrated one concrete process improvement: the PlayCanvas lane previously implemented provisional movement/camera plumbing before this workflow surfaced a current first-party reusable controller that directly covers movement, jump, camera, touch, gamepad and animation-state signalling. That is evidence of a discovery gap, but not yet evidence that adopting the controller now beats the incumbent.

The Godot lane provides the opposite and equally important test: its simple engine-native `CharacterBody3D` tracer is already execution-backed and may remain the lifecycle winner. The discovery gate succeeds if it recommends **not** replacing that implementation when the TPS reference cannot prove additional value.

No reuse candidate is production-promoted from this document. Fresh target-runtime execution remains required.
