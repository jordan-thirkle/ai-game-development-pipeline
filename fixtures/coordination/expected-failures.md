# Expected rejected cases

The coordination verifier must reject at least these cases:

- a second exclusive claim while a work unit is already claimed;
- a human approval before the current candidate has passed QA;
- QA passing after a recorded failure without a recovery attempt in between;
- duplicate idempotency keys within one correlated event stream;
- release without an active claim;
- release before a required human approval;
- causation references to events that have not occurred yet;
- non-monotonic event timestamps.

Adding a new coordination invariant should normally add a mutation/negative case here or in the executable verifier.
