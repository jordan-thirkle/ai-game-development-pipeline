# Local pipeline quickstart

The repository includes a dependency-free sample project. Run the complete local pipeline from the repository root:

```sh
node tools/run-pipeline-truthful.mjs --project examples/sample-game --output /tmp/ai-game-pipeline-demo --dry-run
```

Use a new or empty output directory for each run. The runner refuses to mix evidence with an existing run. The truthful wrapper requires an explicit `--output` so it can normalize the exact emitted run record rather than guessing which evidence directory belongs to the current execution.

The command is intentionally dry-run only. It delegates build, QA, registry selection, release-candidate generation, and publishing simulation to the existing `tools/run-pipeline.mjs` runner, then applies one evidence-truthfulness correction: execution telemetry that the local runner does not actually measure is stored as `null` instead of fabricated zeroes or iteration counts.

It writes the following files under `/tmp/ai-game-pipeline-demo/`:

```text
intake.json
registry-selection.json
build-result.json
build.stdout.log
build.stderr.log
qa-result.json
qa.stdout.log
qa.stderr.log
release-candidate.json
publishing-receipt.json
pipeline-run.json
```

Validate the emitted run record with the repository schema validator:

```sh
node tools/validate-record.mjs pipeline-run /tmp/ai-game-pipeline-demo/pipeline-run.json
```

To scaffold a fresh copy without overwriting an existing directory, keep using the existing scaffold command, then run the truthful wrapper:

```sh
node tools/run-pipeline.mjs --scaffold /tmp/sample-game-copy
node tools/run-pipeline-truthful.mjs --project /tmp/sample-game-copy --output /tmp/sample-game-run --dry-run
```

The underlying runner executes each manifest-declared argv array directly with `shell: false`; QA can receive the built artifact through the exact `{artifact}` token. Paths are contained, artifact hashes are deterministic, and build or QA failures stop the pipeline. Publishing always requires `--dry-run`, accepts only a `local://` planned destination, and writes a receipt with `executed: false`. No store, provider, secret, upload, or real publication operation occurs.

## Evidence boundary

The wrapper does **not** claim to measure agent/tool usage or human effort. Until those signals are instrumented, `toolCalls`, `failedToolCalls`, `humanInterventions`, `humanMinutes`, `iterations`, and `bespokeLinesChanged` remain `null`. Measured fields such as elapsed runtime, build/QA execution status, artifact hashes, and the local dry-run publishing receipt remain unchanged.
