# Local pipeline quickstart

## Visual Studio (recommended)

Start the local visual interface from the repository root:

```sh
npm run studio
```

Open `http://127.0.0.1:4173/apps/studio/`, choose **Run Pipeline**, enter a bounded brief, select one reviewed gameplay mechanic—collect, dodge, or survive—then choose **Build playable starter**. Studio applies the project name, objective, target, and mechanic to a fresh playable sample, shows intake/scaffold, registry selection, build, QA, release-candidate, and publishing-plan evidence, then opens the exact verified browser artifact below the journey. Web and desktop targets use WASD or the arrow keys; mobile targets add on-screen touch controls. **Open in new tab** launches the same artifact in a larger view.

The brief customizes the identity, displayed objective, target metadata, target-appropriate controls, and one of three reviewed mechanics. It does not yet generate arbitrary mechanics, art, levels, or narrative from free-form prose; those require a later constrained generation and human-review stage.

This interface is local and user-safe: it listens only on the loopback address, never requests secrets, accepts no store destination, performs no upload, and displays the final receipt proving `executed: false` and `secretsUsed: false`. Only the latest successful sample artifact is playable, and its temporary sandbox is removed when Studio stops or a newer successful run replaces it.

## Command-line alternative

The repository includes a dependency-free sample project. Run the complete local pipeline from the repository root:

```sh
node tools/run-pipeline.mjs --project examples/sample-game --output /tmp/ai-game-pipeline-demo --dry-run
```

Use a new or empty output directory for each run. The runner refuses to mix evidence with an existing run.

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
node tools/validate-record.mjs pipeline-run /tmp/ai-game-pipeline-demo/pipeline-run.json
```

To scaffold a fresh copy without overwriting an existing directory:

```sh
node tools/run-pipeline.mjs --scaffold /tmp/sample-game-copy
node tools/run-pipeline.mjs --project /tmp/sample-game-copy --output /tmp/sample-game-run --dry-run
```

The runner executes each manifest-declared argv array directly with `shell: false`; QA can receive the built artifact through the exact `{artifact}` token. Paths are contained, artifact hashes are deterministic, and build or QA failures stop the pipeline. Publishing always requires `--dry-run`, accepts only a `local://` planned destination, and writes a receipt with `executed: false`. No store, provider, secret, upload, or real publication operation occurs.
