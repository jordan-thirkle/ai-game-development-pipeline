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
4. Torque does not **select** `GFX Null Device` or report that OpenGL is unavailable; simple enumeration of an available Null device is not itself a failure;
5. the runtime does not report `Couldn't find matching GLX visual` on the selected path;
6. runtime evidence shows OpenGL device creation/profiler initialization;
7. a Torque3D top-level X11 window is externally enumerable as an OpenGL window;
8. a non-empty screenshot is captured from that real window;
9. result/evidence files are hashed.

The first exact-head run established healthy GLX 4.5/llvmpipe but failed because Torque's bundled SDL could not select its GLX visual. The recovery uses SDL's supported `SDL_VIDEO_X11_FORCE_EGL=1` X11-to-EGL OpenGL path while retaining the GLX/Mesa environment proof. Null-device fallback is never promoted into a rendering pass.

## Not proven here

No `Player` movement/collision, external input, Phase A gameplay, production assets, profiling, target-device/mobile evidence, or human playability claim is made by this gate.
