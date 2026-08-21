# MonoGame 3.8.5.1 + BEPUphysics2 runtime gate

Bounded BYJTT-LAB-001 feasibility slice for issue #227.

## What this executes

- MonoGame `3.8.5.1` DesktopGL as the actual game/window/input runtime.
- BEPUphysics2 `2.4.0` as the native 3D rigid-body solver.
- The unchanged 24×32 m arena and logical player spawn `(0,0,10)`.
- The unchanged 3.5 m/s walk constant.
- A dynamic BEPU sphere with 0.4 m radius, so the east-wall player-centre ceiling is `12.0 - 0.4 = 11.6 m`.
- Four static BEPU arena walls and a static floor. There is no post-physics coordinate clamp or teleport movement path.
- MonoGame `Keyboard.GetState()` receives the normal `D` key state. CI must deliver a real OS key press/release to the focused DesktopGL window.
- Copy-only observation isolation, wall-stop bounds and 60 fixed-step frames of release stability.

## Evidence boundary

A green run proves only this exact framework/runtime/physics/input slice. It does not establish a production character controller, navigation, combat, persistence, production assets, device/mobile performance, full Phase A, or human playability.

The workflow is fail-closed: it asserts the exact PR head, restores exact direct package pins, freezes the generated NuGet graph into locked mode before build, requires a real X11 window and rendered screenshots, requires physical `D` press/release to appear in MonoGame keyboard state, validates the machine-readable result, and hashes retained evidence.
