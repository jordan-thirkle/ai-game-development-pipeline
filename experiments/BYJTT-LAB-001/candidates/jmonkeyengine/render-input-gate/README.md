# jMonkeyEngine 3.9 + Minie rendered normal-input gate

Issue: #175
Parent candidate: #141
Modern physics precursor: #157

This bounded gate takes the jMonkeyEngine candidate's explicit next frontier after the Minie/Libbulletjme feasibility proof: run an actual jME desktop application, render a scene, deliver a real OS keyboard event through jME's normal input system, and preserve the same native Minie character collision evidence.

## Engine-native systems

- jMonkeyEngine `3.9.0-stable` `SimpleApplication` + `AppSettings` desktop window;
- jME `InputManager` mapping `KeyInput.KEY_D` through `KeyTrigger` and `ActionListener`;
- Minie `9.0.3` / resolved Libbulletjme backend;
- Minie `PhysicsCharacter` native character controller;
- engine scene graph + unshaded geometry for rendered evidence.

Primary references checked 2026-08-20:
- https://wiki.jmonkeyengine.org/docs/3.9/core/input/input_handling.html
- https://wiki.jmonkeyengine.org/docs/3.9/core/system/appsettings.html
- https://stephengold.github.io/Minie/minie/minie-library-tutorials/character.html

## Shared constants preserved

- arena: `24 x 32 m`;
- player spawn: `(0, 0, 10)`;
- walk speed: `3.5 m/s`;
- fixed physics step: `1/60 s`;
- player radius: `0.4 m`, giving the same east-wall centre ceiling `x = 11.6 m`.

The OS test presses and releases `D` against the focused jME window. Gameplay observes that only through the engine's input callback. There is no test-only movement setter, no teleport, and no post-physics arena clamp.

## Required proof

1. exact candidate-head checkout assertion;
2. Java 17 `-Xlint:all -Werror` Maven build;
3. pinned jME/Minie dependency graph including `jme3-lwjgl3` and Libbulletjme;
4. actual desktop window under Xvfb/Openbox;
5. external `D` press/release delivered with `xdotool`;
6. jME input callbacks observed;
7. rendered frames observed and window screenshot captured;
8. native Minie east-wall stop and stable release;
9. copy-isolated observation probe;
10. result/dependency/runtime/window/screenshot hashes uploaded as exact-head evidence.

## Evidence boundary

This is desktop rendered-input + native character/physics feasibility only. It does **not** claim touch/mobile/device input, production camera quality, enemy/navigation/combat, salvage/reward/upgrades, persistence, full Phase A, Phase B assets, performance readiness, or human playability.
