# Cross-session work workflow

## Purpose and owner

Coordinate substantial work across ChatGPT, Codex and other workers without depending on conversation history. Owned by the Pipeline Governor / coordination layer.

## Trigger

A substantial unit of research, implementation, validation, release or maintenance work is ready to enter the pipeline frontier.

## Inputs

- current repository revision;
- canonical project/control-plane state;
- bounded work unit and acceptance criteria;
- dependency/blocker state;
- required role and tool access;
- relevant evidence and decisions.

## Actions

1. Refresh repository and tracker state.
2. Select an unblocked, unclaimed work unit appropriate to the worker role.
3. Claim it and verify ownership against current state.
4. Compile the minimum sufficient context bundle.
5. Execute using the repository evidence loop and solved-system gate.
6. Emit structured progress/failure/decision events as durable evidence.
7. Run the required verification for the work unit.
8. Derive affected pipeline/gate state from the new evidence.
9. Record resulting revision/evidence and release the claim.
10. Route newly unblocked work to the frontier; do not silently begin unrelated scope.

## Human checkpoints

Escalate only when the work requires gameplay/taste judgement, material spend, irreversible public action, unresolved legal/licensing judgement, destructive action without proven rollback, or information/authority unavailable to the worker.

The human decision must be explicit and recorded as durable evidence.

## Outputs

- updated repository/tracker state;
- structured events/evidence;
- verified resulting revision or documented failed attempt;
- released/renewed claim;
- derived next frontier.

## Idempotency and retries

Claim/release and event writes need stable ids/idempotency keys. Automated retries are allowed only for operations classified safe/idempotent. A retry must not create duplicate decisions, releases, publications or spend.

## Failure and escalation

A failure enters recovery routing: classify -> inspect -> retry if safe -> research current solved alternatives -> bounded repair -> verify. Human escalation is the final authority path, not the default failure path.

## Privacy and credentials

Never store secrets in work units, events, prompts or evidence. Store references to approved secret locations/capabilities instead.

## Observability

A successful run has traceable claim ownership, starting/ending revisions, emitted evidence, verification outcome, elapsed time, interventions, recovery attempts and final state transition.

## Acceptance criteria

- two independent worker sessions cannot unknowingly own the same exclusive work unit;
- a fresh worker can resume from repository state without the prior chat transcript;
- completion cannot turn a gate green without required fresh evidence;
- failed work remains visible and recoverable;
- human intervention is attributable and measurable;
- the workflow can be replayed/audited from durable records.