# Fyrox 1.0 rendered normal-input gate

Issue: #188. Parent physics proof: #126. Parent benchmark: #2.

This additive gate tests the next independent Fyrox runtime frontier without changing the existing native-physics tracer or any BYJTT-LAB-001 shared contract.

## What this gate must prove

- exact `fyrox = 1.0.0`;
- Rust 1.88 as the minimum executable toolchain for the published dependency graph;
- warnings-as-errors compile/test/release build;
- a real Fyrox `Executor` window and graphics context under Linux/Xvfb;
- a real OS `D` press and release delivered by X11 to the focused window;
- delivery through Fyrox's documented event path: `Plugin::on_os_event` → `WindowEvent::KeyboardInput` → `PhysicalKey::Code(KeyCode::KeyD)`;
- fixed-rate plugin updates while the external key is held;
- the unchanged shared walk speed of 3.5 m/s used to quantify delivered input duration;
- screenshot, window diagnostics, runtime log, machine-readable result and hashes bound to the exact candidate head.

## Toolchain lifecycle finding

Fyrox `1.0.0` declares `rust-version = "1.87"`, and its published `fyrox-impl` `1.0.0` also declares Rust 1.87. However, that same upstream `fyrox-impl` manifest directly requires `libloading = "0.9"`; the published `libloading 0.9.0` requires Rust 1.88. Exact-head runs under Rust 1.87 therefore fail before candidate code can compile. This gate records that upstream package/MSRV mismatch as lifecycle cost and uses the minimum toolchain that can execute the unchanged Fyrox 1.0 dependency requirement. It does not alter a BYJTT gameplay constant or acceptance criterion.

## Evidence boundary

This gate deliberately does **not** duplicate #126's native Rapier-backed collision proof. `native_physics_integrated_in_this_gate=false` is mandatory in the runtime result. A green result means rendered desktop execution and external keyboard delivery are proven on the same Fyrox revision family; it does not yet prove an integrated production character controller.

Navigation/combat, persistence, full Phase A, Phase B production assets, mobile/device/profile evidence and human playability remain unproven.

No test-only gameplay mutation API exists. The runtime result is written only after Fyrox receives an actual `KeyD` release event; CI does not call the plugin or mutate its state directly.
