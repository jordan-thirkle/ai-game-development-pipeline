# Fyrox 1.0 rendered normal-input gate

Issue: #188. Parent physics proof: #126. Parent benchmark: #2.

This additive gate tests the next independent Fyrox runtime frontier without changing the existing native-physics tracer or any BYJTT-LAB-001 shared contract.

## What this gate must prove

- exact `fyrox = 1.0.0` on Rust 1.87;
- warnings-as-errors compile/test/release build;
- a real Fyrox `Executor` window and graphics context under Linux/Xvfb;
- a real OS `D` press and release delivered by X11 to the focused window;
- delivery through Fyrox's documented event path: `Plugin::on_os_event` → `WindowEvent::KeyboardInput` → `PhysicalKey::Code(KeyCode::KeyD)`;
- fixed-rate plugin updates while the external key is held;
- the unchanged shared walk speed of 3.5 m/s used to quantify delivered input duration;
- screenshot, window diagnostics, runtime log, machine-readable result and hashes bound to the exact candidate head.

## Evidence boundary

This gate deliberately does **not** duplicate #126's native Rapier-backed collision proof. `native_physics_integrated_in_this_gate=false` is mandatory in the runtime result. A green result means rendered desktop execution and external keyboard delivery are proven on the same Fyrox revision family; it does not yet prove an integrated production character controller.

Navigation/combat, persistence, full Phase A, Phase B production assets, mobile/device/profile evidence and human playability remain unproven.

No test-only gameplay mutation API exists. The runtime result is written only after Fyrox receives an actual `KeyD` release event; CI does not call the plugin or mutate its state directly.
