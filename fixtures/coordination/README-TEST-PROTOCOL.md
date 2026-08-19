# Coordination test protocol

1. Validate work-unit and event records against their JSON Schemas.
2. Replay the valid event stream through invariant checks.
3. Mutate the stream into known-bad states.
4. Require the verifier to reject each mutation.
5. Run the verifier in an independent path-scoped CI workflow.
6. Treat CI success as evidence only for these coordination contracts/invariants.
7. Continue to require real Benchmark 001 multi-session runs for end-to-end workflow promotion.
