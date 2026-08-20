# Local pipeline quickstart

The repository includes a dependency-free sample project. Run the complete local pipeline from the repository root:

```sh
npm run pipeline:demo
```

The command is intentionally dry-run only. It builds `examples/sample-game/dist`, runs QA against that artifact, selects the requested source-verified registry entry, creates a release-candidate manifest, and writes the following files under `/tmp/ai-game-pipeline-demo/`:

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
npm run validate:record -- pipeline-run /tmp/ai-game-pipeline-demo/pipeline-run.json
```

To scaffold a fresh copy without overwriting an existing directory:

```sh
node tools/run-pipeline.mjs --scaffold /tmp/sample-game-copy
node tools/run-pipeline.mjs --project /tmp/sample-game-copy --output /tmp/sample-game-run --dry-run
```

The runner executes each manifest-declared argv array directly with `shell: false`; QA can receive the built artifact through the exact `{artifact}` token. Paths are contained, artifact hashes are deterministic, and build or QA failures stop the pipeline. Publishing always requires `--dry-run`, accepts only a `local://` planned destination, and writes a receipt with `executed: false`. No store, provider, secret, upload, or real publication operation occurs.
