# Babylon.js Recast -> Havok chase gate

Bounded BYJTT-LAB-001 integration proof for issue #245.

## Solved systems

- Babylon.js `9.20.0` Physics V2 `PhysicsCharacterController` with Havok `1.3.14` for both player and enemy movement/collision.
- Babylon Addons Navigation Plugin V2 with Recast Navigation `0.43.1` for path generation.

The pin stays aligned with the separately execution-proven Babylon controller/navigation gates so this slice measures integration rather than version churn.

## Shared contract preserved

- arena: 24 x 32 m;
- player spawn: `(0,0,10)`;
- enemy spawn: `(0,0,-6)`;
- player walk: 3.5 m/s;
- enemy move: 2.7 m/s;
- acquisition range: 12 m;
- fixed simulation step: 1/60 s.

The browser proof delivers a real `KeyS` press/release. Player motion is owned by `PhysicsCharacterController`; acquisition is forbidden above 12 m. After legitimate player movement crosses the threshold, Recast computes the enemy path and a second Havok character follows it. No post-navigation or post-physics coordinate clamp is present.

## Evidence boundary

This gate proves only rendered browser input + navigation-to-native-character chase integration. It does not claim combat, progression, persistence, full Phase A, production assets, device/mobile profiling, or human playability.
