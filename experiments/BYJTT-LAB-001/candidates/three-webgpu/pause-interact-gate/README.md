# Three.js pause/interact correctness gate

This gate verifies that a one-shot gameplay interaction entered while the production runtime is paused is discarded rather than replayed after resume.

It leaves the integrated Three.js/WebGPU candidate and shared BYJTT-LAB-001 contracts read-only. The probe must earn the upgrade opportunity through normal browser keyboard gameplay: move to salvage, attack it, collect the reward, then pause and press `E`.

A pass requires the upgrade to remain unselected both while paused and after resume. If effective attack damage changes from the baseline 34 to the `damage-up-1` value after resume without another interact press, the gate records `blocked-paused-interact-leak` and fails while preserving evidence.

The harness may observe production state only. It exposes no position, reward, upgrade, health or queue mutation helper and does not count setup/fault input as gameplay evidence beyond the normal physical keyboard path.

Evidence boundary: browser correctness only. This does not establish HUMAN-TESTED, physical-device, performance, publication or release readiness.
