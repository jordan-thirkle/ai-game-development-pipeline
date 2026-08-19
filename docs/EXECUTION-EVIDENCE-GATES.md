# Execution evidence gates

Runtime-sensitive changes must be proven in an environment capable of observing the relevant failure mode. Source review and schema validation are not substitutes for browser, engine, simulator, device, CI or release execution evidence.

`config/execution-gates.json` maps sensitive paths to an execution environment and required checks. A matching evidence record lives under `evidence/execution/` and follows `schemas/execution-evidence.schema.json`.

## Trust model

The production gate uses `pull_request_target` deliberately. GitHub runs the workflow from the target/base branch; it checks out the base revision and executes only trusted base code, dependencies and gate configuration. The PR head is fetched as data so the checker can inspect changed paths and parse the proposed evidence JSON without executing PR-controlled code.

Do **not** change this workflow to execute scripts, package manifests, actions or arbitrary commands from the PR head. A PR must not be able to teach its own merge gate to approve itself.

A separate `execution-evidence-gate-selftest.yml` workflow uses ordinary `pull_request` only to test changes to the gate implementation. That self-test is development evidence; the `pull_request_target` check is the production enforcement path once the gate is on `main`.

## Revision freshness

Evidence records the revision that was actually tested. The tested revision must be an ancestor of the PR head, and no gated path may change after that tested revision. This permits an evidence-only commit after testing without creating an impossible self-referential head SHA.

## Current gate

Changes under `apps/studio/` require browser-automation evidence for page load, clean console, navigation, disabled blocked gates, responsive layout and keyboard basics.

## Merge enforcement

The workflow `.github/workflows/execution-evidence-gate.yml` fails when required evidence is missing, failed, stale, from the wrong environment, or lacks required passing checks.

**Repository configuration still matters:** GitHub must require the `Require execution evidence / execution-evidence` status check on `main` through branch protection or a repository ruleset. Without that repository setting, a user or agent with merge permission can still merge a red or absent check. The workflow is the evidence gate; branch protection is the enforcement lock.

## Browser QA handoff

Issue #45 is the current browser-verification workstream for the Game Development OS. Its result should create `evidence/execution/control-plane-browser.json` against the exact tested revision, with artifact references for screenshots/console evidence. Any subsequent `apps/studio/` edit invalidates that evidence until the browser checks are rerun.
