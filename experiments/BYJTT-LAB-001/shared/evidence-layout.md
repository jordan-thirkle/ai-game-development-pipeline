# BYJTT-LAB-001 Candidate Evidence Layout

Status: shared contract for candidate lanes. This defines where comparable evidence belongs; it does not claim any candidate has produced it yet.

Each candidate owns only its subtree:

```text
experiments/BYJTT-LAB-001/candidates/<candidate-id>/
  README.md
  implementation/              # candidate-native source/project as appropriate
  solved-system.md             # built-in/OSS/buy/generate/build decisions
  dependencies.json            # exact runtime/packages/addons used
  deviations.json              # explicit differences from shared contract
  evidence/
    pipeline-run.json           # schemas/pipeline-run.schema.json
    playtest-result.json        # results keyed to shared/playtest-contract.json step IDs
    build.md                    # exact reproducible build/run commands and output identity
    environment.json            # OS/device/browser/engine/tool versions
    logs/                       # useful console/engine/runtime logs
    screenshots/                # named by playtest step where possible
    video/                      # short proof captures, not marketing edits
    profiles/                   # profiler/performance traces or exports
    mobile/                     # simulator/device evidence when applicable
```

## Required neutral identifiers

Candidate IDs for Benchmark 001:

- `three-webgpu`
- `playcanvas`
- `babylonjs`
- `godot`
- `unity`
- `defold`

Do not rename a candidate to make results look like a different track. A materially different stack is a new candidate or documented variant.

## `playtest-result.json` minimum shape

Each result should include:

```json
{
  "contract_version": 1,
  "scenario_id": "mobile-action-slice-v1",
  "candidate_id": "<candidate-id>",
  "source_revision": "<commit-sha>",
  "execution_verified": false,
  "steps": [
    {
      "id": "01-cold-launch",
      "status": "unknown",
      "observations": {},
      "evidence": [],
      "notes": []
    }
  ],
  "failures": [],
  "deviations": []
}
```

Allowed step statuses:

- `pass`
- `fail`
- `blocked`
- `unknown`
- `not-applicable-with-approved-deviation`

Missing evidence is `unknown`, never `pass`.

## Evidence naming

Prefer stable names tied to the shared step IDs, for example:

- `screenshots/01-cold-launch.png`
- `screenshots/07-break-salvage.png`
- `video/06-exchange-damage.mp4`
- `logs/runtime.log`
- `profiles/gameplay-profile.*`

Do not store huge raw captures in Git when a CI artifact or external durable evidence store is more appropriate; commit a durable pointer and integrity metadata instead.

## Source/build identity

Every evidence package must make it possible to answer:

1. Which exact repository revision was executed?
2. Which engine/runtime and dependency versions were used?
3. Which source assets and transformed assets were used?
4. Which commands/settings produced the build?
5. Which device/browser/OS executed it?
6. Which shared playtest-contract version was applied?
7. Which failures/retries occurred before the shown result?

Evidence that cannot answer those questions cannot promote a candidate.

## Fairness boundary

Candidate-native optimisation is encouraged when it is how a real production team would use that runtime. It must be recorded in `deviations.json` or `solved-system.md` when it changes implementation effort, content transformation, rendering, physics, navigation, input, save, or build behaviour materially.

The benchmark measures total production leverage, not artificial lowest-common-denominator sameness.

## Human taste evidence

Automated evidence can establish function/performance/reproducibility. It cannot establish that combat feels good, animation looks convincing, or the game is fun. Human playtest/taste verdicts must point to the exact tested revision and expire when that revision's player-visible behaviour changes.
