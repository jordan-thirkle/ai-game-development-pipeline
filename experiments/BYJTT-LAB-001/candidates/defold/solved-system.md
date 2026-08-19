# Defold solved-system gate — runtime tracer

Checked against current primary Defold documentation on 2026-08-20.

## Selected for this slice

- **Defold 1.13.0 stable** as the candidate engine line. The 1.13.0 release is current and specifically expands 3D, physics, editor tooling, and build workflows.
- **Bob** as the official command-line build/bundle tool instead of scripting editor clicks. Current Bob documentation supports HTML5 (`wasm-web`) and requires OpenJDK 25 for current releases.
- **Defold input bindings + script `on_input()`** for movement proof. Browser automation sends only a normal keyboard `W` input.
- **`html5.run()`** only as a copy-only observation bridge from Lua to the browser. It does not expose a gameplay mutation API back into the engine.
- **Native Game Object transform** for this first locomotion/toolchain tracer. Collision is deliberately deferred rather than hidden behind custom math.

## Rejected / deferred for this slice

- Third-party controller/framework: unnecessary before native Defold movement/collision is measured.
- Custom browser-to-Lua mutation bridge: forbidden by the shared playtest contract and unnecessary.
- Second physics engine, ECS, navigation framework, networking, backend: out of scope until the common encounter requires them.
- Full editor automation `/eval`: strategically important for later agent-editability testing, but not required to prove CLI build + browser runtime execution.

## Primary sources

- https://defold.com/2026/06/22/Defold-1-13-0/
- https://defold.com/manuals/bob/
- https://defold.com/manuals/html5/
- https://defold.com/ref/html5-lua/
- https://defold.com/manuals/physics/
- https://defold.com/manuals/physics-objects/

## Evidence boundary

This decision is not a conclusion that Defold is suitable for the full 3D benchmark. The next native-system gate must measure 3D kinematic collision response and quantify how much candidate-specific Lua is required relative to mature controller systems in other engines.
