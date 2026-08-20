# LÖVR 0.19 rendered normal-input gate

Bounded follow-on to the LÖVR native-Jolt feasibility tracer in PR #148.

This gate keeps the shared BYJTT-LAB-001 values unchanged: 24×32 m arena, `(0,0,10)` ground-space spawn, and 3.5 m/s walk speed. It uses LÖVR 0.19's native desktop window/input APIs, `lovr.draw`/`Pass` rendering primitives, and the same native Jolt physics path already proven by the parent candidate.

The CI harness focuses the real LÖVR window and sends an OS-level `D` key through X11/xdotool. Gameplay reads that state through `lovr.system.isKeyDown('d')`; there is no direct test movement setter, teleport, or post-physics arena clamp.

A passing run must prove all of the following on the exact candidate head:

- strict Lua 5.4 syntax and luacheck;
- verified official LÖVR 0.19.0 binary provenance before execution;
- a real desktop render loop with at least 10 frames and at least 6 recorded draws per frame;
- externally delivered `D` key press and release events;
- native Jolt stop at the east arena wall;
- stable release after input is removed;
- copy-isolated observations;
- a captured desktop-window screenshot and machine-readable result artifact.

Evidence boundary: this is desktop rendering + external keyboard input + native physics only. It does not prove production controller feel, VR hardware, mobile/device performance, navigation/combat, persistence, production assets, full Phase A, or human playability.
