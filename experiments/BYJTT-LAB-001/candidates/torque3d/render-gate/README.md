# Torque3D 4.0.3 GLX/OpenGL render gate

Issue: #202  
Parent runtime proof: PR #196

This additive gate answers one question only: can the exact official Torque3D 4.0.3 Linux package that already passed the runtime/provenance gate create a real OpenGL-backed desktop window in the hosted Linux proof environment?

## Fixed inputs

- Official asset: `Torque3D_403_LinBinaries.zip`
- Expected SHA-256: `42513ac8f8390790acef91742f2ec962df9ced55d6b1f4dcd38f321af13eeb5b`
- Shared BYJTT-LAB-001 gameplay contracts are read-only and are not exercised by this render-only slice.

## Pass boundary

A pass requires all of the following on the exact candidate head:

1. official package SHA-256 verified before extraction/execution;
2. GLX-capable Mesa software renderer established and `glxinfo -B` succeeds;
3. actual packaged Torque3D executable starts;
4. runtime log does **not** contain `GFX Null Device`, `GFXNulDevice`, `Null device found`, or `Couldn't find matching GLX visual`;
5. runtime log shows OpenGL renderer/device initialization;
6. a Torque3D top-level X11 window is externally enumerable;
7. a non-empty screenshot is captured from that real window;
8. result/evidence files are hashed.

If the hosted environment cannot satisfy this, the result remains blocked. Null-device execution is never promoted into a rendering pass.

## Not proven here

No `Player` movement/collision, external input, Phase A gameplay, production assets, profiling, target-device/mobile evidence, or human playability claim is made by this gate.
