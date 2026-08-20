# Defold native 3D collision gate

Bounded follow-on to the Defold runtime tracer. This gate tests whether Defold 1.13.0 can supply engine-solved 3D arena collision without Lua penetration correction or a post-physics arena clamp.

## Shared contract retained

- arena: 24 × 32 m;
- player spawn: `(0, 0, 10)`;
- walk speed: 3.5 m/s;
- browser viewport: 390 × 844;
- input: normal `KeyD` through Defold input binding and `on_input()`;
- observations: browser receives copies only and cannot mutate engine state.

## Solved-system choice

Defold's current collision-object manual states that dynamic objects are simulated by the physics engine and that collisions against static objects are solved by the engine. It also exposes `linear_velocity` as a runtime collision-object property. The official Defold examples repository demonstrates embedded dynamic/static collision objects and primitive box shapes. The implementation therefore tests a dynamic player body against four static native arena walls before accepting a bespoke character-collision solver.

Primary references used while implementing this slice:

- https://defold.com/manuals/physics-objects/
- https://defold.com/ref/stable/physics-lua/
- https://defold.com/manuals/physics-messages/
- `defold/examples` revision `ef4f37bc5c057168348a9548b6980b6d8face09a`, including `physics/dynamic/example/dynamic.collection`.

## Evidence boundary

A pass proves only native 3D collision/toolchain feasibility through real Defold HTML5 execution and normal browser input. Dynamic-body velocity steering is not automatically a production character-controller recommendation. Camera, enemy/navigation/combat, salvage/reward/upgrade, save/restart, complete Phase A, frozen Phase B assets, profiling/device/mobile evidence, and human playability remain unknown.

No test API sets player position. No Lua collision handler resolves penetration. The `collision_response` message is counted only as observation evidence.
