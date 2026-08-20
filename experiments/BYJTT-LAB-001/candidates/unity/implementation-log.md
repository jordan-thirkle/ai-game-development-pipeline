# Unity candidate implementation log

## 2026-08-20 — bounded proof-capable tracer

### Environment routing

The connected automation environment does not expose an activated Unity Editor or Unity licence credentials. Under the repository evidence policy, this prevents any Unity runtime/editor pass claim. The slice therefore prepares the smallest exact proof that a licensed engine worker can execute without rediscovery.

### Solved-system decision

Selected built-in `CharacterController` rather than a bespoke capsule-cast/move-and-slide controller. The current Unity API documents `CharacterController.Move(Vector3)` as collision-constrained movement and reports `CollisionFlags`. The Input System package is used for the normal keyboard path instead of adding an input wrapper.

### Corrections made before handoff

1. **Core test-framework pin removed.** The first package manifest explicitly pinned `com.unity.test-framework`. Current Unity 6 documentation says core packages are fixed to the Editor version, so the explicit pin was removed. This avoids inventing a package version outside the Editor's core-package contract.
2. **Player spawn corrected back to the shared contract.** An early scaffold placed the player transform at `y=1` to account for capsule height. That would have changed shared spawn `(0,0,10)`. The transform is now exactly `(0,0,10)` and the CharacterController capsule uses local `center.y=1` instead.
3. **Visual collider separated from the controller root.** The first greybox used `CreatePrimitive(Capsule)` on the player root, which temporarily creates a CapsuleCollider before deferred destruction. The final structure uses an empty controller root and a collider-free child visual, avoiding a transient second physics shape.
4. **Pre-merge proof trigger fixed.** The first workflow used only `workflow_dispatch`. Because a brand-new dispatch workflow is not a reliable pre-merge entry point when it exists only on a feature branch, the final workflow also runs on pushes to this exact isolated branch. It records exact-head status before the licence gate and preserves a blocker artifact if credentials are absent.
5. **Runtime evidence remains unknown.** No source review, test source, workflow definition, or blocker run is counted as Unity execution. The candidate stays blocked until the exact head is run with a licensed Editor and result artifacts are captured.

### Proof surface prepared

- exact shared arena and movement constants;
- Unity-native CharacterController movement/collision;
- normal Input System keyboard path;
- read-only copy observations;
- PlayMode tests for one-second movement, east-wall native collision, and observation isolation;
- branch-scoped CI proof gate that requires Unity licence secrets and fails closed with exact-head/blocker evidence when they are absent.

### Still unknown

All full Phase A steps beyond this movement/collision proof, plus Phase B content, profiler/device/export evidence and human playability remain unknown.
