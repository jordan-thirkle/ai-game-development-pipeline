import initJolt from 'jolt-physics';

type Snapshot = Readonly<{
  ready: boolean;
  x: number;
  y: number;
  z: number;
  eastWallX: number;
  nativeBoundary: true;
}>;

declare global {
  interface Window {
    __threeNativeBoundary?: {
      observe: () => Snapshot;
    };
  }
}

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const WALK_SPEED = 3.5;
const PLAYER_RADIUS = 0.42;
const WALL_HALF_THICKNESS = 0.25;
const PLAYER_SPAWN = [8, 1, 0] as const;
const FIXED_DT = 1 / 60;

const Jolt = await initJolt();
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_OBJECT_LAYERS = 2;

const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
const bpStatic = new Jolt.BroadPhaseLayer(0);
const bpMoving = new Jolt.BroadPhaseLayer(1);
const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, 2);
bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, bpStatic);
bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving);

const settings = new Jolt.JoltSettings();
settings.mObjectLayerPairFilter = objectFilter;
settings.mBroadPhaseLayerInterface = bpInterface;
settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(
  bpInterface,
  2,
  objectFilter,
  NUM_OBJECT_LAYERS,
);

const jolt = new Jolt.JoltInterface(settings);
Jolt.destroy(settings);
const physicsSystem = jolt.GetPhysicsSystem();
const bodyInterface = physicsSystem.GetBodyInterface();

function addStaticBox(halfX: number, halfY: number, halfZ: number, x: number, y: number, z: number): void {
  const shape = new Jolt.BoxShape(new Jolt.Vec3(halfX, halfY, halfZ), 0.05, undefined);
  const bodySettings = new Jolt.BodyCreationSettings(
    shape,
    new Jolt.RVec3(x, y, z),
    Jolt.Quat.prototype.sIdentity(),
    Jolt.EMotionType_Static,
    LAYER_NON_MOVING,
  );
  const body = bodyInterface.CreateBody(bodySettings);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(bodySettings);
}

addStaticBox(ARENA_WIDTH / 2, 0.25, ARENA_DEPTH / 2, 0, -0.25, 0);
addStaticBox(WALL_HALF_THICKNESS, 2, ARENA_DEPTH / 2, ARENA_WIDTH / 2, 2, 0);
addStaticBox(WALL_HALF_THICKNESS, 2, ARENA_DEPTH / 2, -ARENA_WIDTH / 2, 2, 0);
addStaticBox(ARENA_WIDTH / 2, 2, WALL_HALF_THICKNESS, 0, 2, ARENA_DEPTH / 2);
addStaticBox(ARENA_WIDTH / 2, 2, WALL_HALF_THICKNESS, 0, 2, -ARENA_DEPTH / 2);

const characterShape = new Jolt.CapsuleShape(0.575, PLAYER_RADIUS);
const characterSettings = new Jolt.CharacterVirtualSettings();
characterSettings.mMass = 80;
characterSettings.mMaxSlopeAngle = Math.PI / 4;
characterSettings.mMaxStrength = 100;
characterSettings.mShape = characterShape;
characterSettings.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
characterSettings.mCharacterPadding = 0.02;
characterSettings.mPenetrationRecoverySpeed = 1.0;
characterSettings.mPredictiveContactDistance = 0.1;
characterSettings.mSupportingVolume = new Jolt.Plane(Jolt.Vec3.prototype.sAxisY(), -PLAYER_RADIUS);
const character = new Jolt.CharacterVirtual(
  characterSettings,
  new Jolt.RVec3(...PLAYER_SPAWN),
  Jolt.Quat.prototype.sIdentity(),
  physicsSystem,
);

const objectVsBroadPhaseLayerFilter = jolt.GetObjectVsBroadPhaseLayerFilter();
const objectLayerPairFilter = jolt.GetObjectLayerPairFilter();
const movingBPFilter = new Jolt.DefaultBroadPhaseLayerFilter(objectVsBroadPhaseLayerFilter, LAYER_MOVING);
const movingLayerFilter = new Jolt.DefaultObjectLayerFilter(objectLayerPairFilter, LAYER_MOVING);
const bodyFilter = new Jolt.BodyFilter();
const shapeFilter = new Jolt.ShapeFilter();
const updateSettings = new Jolt.ExtendedUpdateSettings();
const gravity = new Jolt.Vec3(0, -9.81, 0);
const velocity = new Jolt.Vec3();
const keys = new Set<string>();

window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

let ready = false;
let accumulator = 0;
let previous = performance.now();

function fixedStep(): void {
  const current = character.GetLinearVelocity();
  velocity.Set(keys.has('KeyD') ? WALK_SPEED : keys.has('KeyA') ? -WALK_SPEED : 0, current.GetY(), 0);
  character.SetLinearVelocity(velocity);
  character.ExtendedUpdate(
    FIXED_DT,
    gravity,
    updateSettings,
    movingBPFilter,
    movingLayerFilter,
    bodyFilter,
    shapeFilter,
    jolt.GetTempAllocator(),
  );
}

function observe(): Snapshot {
  const position = character.GetPosition();
  return Object.freeze({
    ready,
    x: position.GetX(),
    y: position.GetY(),
    z: position.GetZ(),
    eastWallX: ARENA_WIDTH / 2,
    nativeBoundary: true as const,
  });
}

window.__threeNativeBoundary = { observe };
ready = true;
(document.querySelector('#status') as HTMLElement).textContent = 'ready';

function frame(now: number): void {
  accumulator += Math.min((now - previous) / 1000, 0.1);
  previous = now;
  while (accumulator >= FIXED_DT) {
    fixedStep();
    accumulator -= FIXED_DT;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
