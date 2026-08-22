# Torque3D runtime gate

Owning issue: #191

This is a bounded feasibility gate for the official Torque3D v4.0.3 Linux package. It does **not** claim BYJTT-LAB-001 gameplay completion.

## Preserved shared contract

The shared benchmark remains authoritative. This gate does not change arena dimensions, player spawn, movement constants, playtest semantics, or shared evidence contracts.

## Evidence boundary

This slice may prove only:

- exact candidate-head checkout;
- official GitHub v4.0.3 Linux release-asset resolution;
- SHA-256-before-execution provenance;
- bounded execution of the actual packaged Linux runtime under Xvfb/Openbox when compatible with the hosted runner.

It must not infer or claim native `Player` collision, normal external input, rendering correctness, full Phase A, mobile/device support, performance readiness, or human playability.

The initial bootstrap revision intentionally left the release SHA unset so CI could record the observed official asset digest and fail closed before extraction or execution. This revision pins that observed official asset SHA-256 in `expected-sha256.txt`; subsequent runs must verify the pinned digest before extraction or execution and fail closed on any mismatch.
