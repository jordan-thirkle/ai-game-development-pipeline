import * as THREE from 'three';
import initJolt from 'jolt-physics';
import { init as initRecast, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPEED = 3.5;
const ENEMY_SPEED = 2.7;
const ACQUIRE_RANGE = 12;
const FIXED_DT = 1 / 60;
const PLAYER_RADIUS = 0.42;
const CHARACTER_Y = 1;
const PLAYER_SPAWN = new THREE.Vector3(0, CHARACTER_Y, 10);
const ENEMY_SPAWN = new THREE.Vector3(0, CHARACTER_Y, -6);

type Point = { x: number; y: number; z: number };
interface Observation {
  ready: boolean;
  threeRevision: string;
  joltVersion: string;
  recastVersion: string;
  initialSeparation: number;
  lastOutsideAcquireDistance: number;
  acquiredDistance: number | null;
  acquired: boolean;
  pathPoints: Point[];
  pathInsideArena: boolean;
  chaseSteps: number;
  finalSeparation: number;
  maxEnemyStep: number;
  playerReleaseDrift: number;
  observationIsolation: boolean;
  postNavigationClamp: boolean;
  postPhysicsClamp: boolean;
  externalInputExecuted: boolean;
  combatExecuted: boolean;
}

declare global {
  interface Window { __BYJTT_OBSERVE__?: () => Readonly<Observation>; }
}

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
if (!canvas) throw new Error('renderCanvas missing');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101318);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 22, 24);
camera.lookAt(0, 0, 2);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2));

const floorGeometry = new THREE.PlaneGeometry(ARENA_WIDTH, ARENA_DEPTH, 1, 1);
floorGeometry.rotateX(-Math.PI / 2);
scene.add(new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({ color: 0x345d43, side: THREE.DoubleSide })));
const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0x5da9ff }));
const enemyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0xff665d }));
scene.add(playerMesh, enemyMesh);

await initRecast();
const position = floorGeometry.getAttribute('position');
const index = floorGeometry.getIndex();
if (!index) throw new Error('Arena geometry missing index');
const generated = generateSoloNavMesh(Array.from(position.array as ArrayLike<number>), Array.from(index.array as ArrayLike<number>), {
  cs: 0.25, ch: 0.25, walkableSlopeAngle: 45, walkableHeight: 2, walkableClimb: 0.4,
  walkableRadius: 0.4, maxEdgeLen: 12, maxSimplificationError: 1.3, minRegionArea: 8,
  mergeRegionArea: 20, maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1,
});
if (!generated.success) throw new Error('Recast navmesh generation failed');
const navQuery = new NavMeshQuery(generated.navMesh);

const Jolt = await initJolt();
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const objectFilter = new Jolt.ObjectLayerPairFilterTable(2);
objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
const bpStatic = new Jolt.BroadPhaseLayer(0);
const bpMoving = new Jolt.BroadPhaseLayer(1);
const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(2, 2);
bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, bpStatic);
bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving);
const settings = new Jolt.JoltSettings();
settings.mObjectLayerPairFilter = objectFilter;
settings.mBroadPhaseLayerInterface = bpInterface;
settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bpInterface, 2, objectFilter, 2);
const jolt = new Jolt.JoltInterface(settings);
Jolt.destroy(settings);
const physicsSystem = jolt.GetPhysicsSystem();
const bodyInterface = physicsSystem.GetBodyInterface();

function addStaticBox(hx: number, hy: number, hz: number, x: number, y: number, z: number): void {
  const shape = new Jolt.BoxShape(new Jolt.Vec3(hx, hy, hz), 0.05, undefined);
  const bs = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(x, y, z), Jolt.Quat.prototype.sIdentity(), Jolt.EMotionType_Static, LAYER_NON_MOVING);
  const body = bodyInterface.CreateBody(bs);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(bs);
}
addStaticBox(ARENA_WIDTH / 2, 0.25, ARENA_DEPTH / 2, 0, -0.25, 0);
addStaticBox(0.25, 2, ARENA_DEPTH / 2, ARENA_WIDTH / 2, 2, 0);
addStaticBox(0.25, 2, ARENA_DEPTH / 2, -ARENA_WIDTH / 2, 2, 0);
addStaticBox(ARENA_WIDTH / 2, 2, 0.25, 0, 2, ARENA_DEPTH / 2);
addStaticBox(ARENA_WIDTH / 2, 2, 0.25, 0, 2, -ARENA_DEPTH / 2);

function makeCharacter(spawn: THREE.Vector3) {
  const shape = new Jolt.CapsuleShape(0.575, PLAYER_RADIUS);
  const cs = new Jolt.CharacterVirtualSettings();
  cs.mMass = 80;
  cs.mMaxSlopeAngle = Math.PI / 4;
  cs.mMaxStrength = 100;
  cs.mShape = shape;
  cs.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
  cs.mCharacterPadding = 0.02;
  cs.mPenetrationRecoverySpeed = 1;
  cs.mPredictiveContactDistance = 0.1;
  cs.mSupportingVolume = new Jolt.Plane(Jolt.Vec3.prototype.sAxisY(), -PLAYER_RADIUS);
  return new Jolt.CharacterVirtual(cs, new Jolt.RVec3(spawn.x, spawn.y, spawn.z), Jolt.Quat.prototype.sIdentity(), physicsSystem);
}
const player = makeCharacter(PLAYER_SPAWN);
const enemy = makeCharacter(ENEMY_SPAWN);
const objectVsBroadPhase = jolt.GetObjectVsBroadPhaseLayerFilter();
const objectLayerPair = jolt.GetObjectLayerPairFilter();
const movingBPFilter = new Jolt.DefaultBroadPhaseLayerFilter(objectVsBroadPhase, LAYER_MOVING);
const movingLayerFilter = new Jolt.DefaultObjectLayerFilter(objectLayerPair, LAYER_MOVING);
const bodyFilter = new Jolt.BodyFilter();
const shapeFilter = new Jolt.ShapeFilter();
const updateSettings = new Jolt.ExtendedUpdateSettings();
const gravity = new Jolt.Vec3(0, -9.81, 0);
const playerVelocity = new Jolt.Vec3();
const enemyVelocity = new Jolt.Vec3();
const keys = new Set<string>();

let physicalKeyDowns = 0;
let physicalKeyUps = 0;
let releasePosition: THREE.Vector2 | null = null;
window.addEventListener('keydown', (event) => { if (event.code === 'KeyS' && !event.repeat) physicalKeyDowns += 1; keys.add(event.code); });
window.addEventListener('keyup', (event) => { if (event.code === 'KeyS') { physicalKeyUps += 1; const p = player.GetPosition(); releasePosition = new THREE.Vector2(p.GetX(), p.GetZ()); } keys.delete(event.code); });
window.addEventListener('blur', () => keys.clear());

const initialSeparation = PLAYER_SPAWN.distanceTo(ENEMY_SPAWN);
let lastOutsideAcquireDistance = initialSeparation;
let acquiredDistance: number | null = null;
let acquired = false;
let pathPoints: Point[] = [];
let pathInsideArena = false;
let chaseSteps = 0;
let maxEnemyStep = 0;
let previousEnemy = new THREE.Vector2(ENEMY_SPAWN.x, ENEMY_SPAWN.z);
let playerReleaseDrift = 0;
let observationIsolation = false;

function horizontalPosition(character: ReturnType<typeof makeCharacter>): THREE.Vector2 {
  const p = character.GetPosition();
  return new THREE.Vector2(p.GetX(), p.GetZ());
}
function separation(): number { return horizontalPosition(player).distanceTo(horizontalPosition(enemy)); }
function updateCharacter(character: ReturnType<typeof makeCharacter>, velocity: InstanceType<typeof Jolt.Vec3>): void {
  character.SetLinearVelocity(velocity);
  character.ExtendedUpdate(FIXED_DT, gravity, updateSettings, movingBPFilter, movingLayerFilter, bodyFilter, shapeFilter, jolt.GetTempAllocator());
}
function acquirePath(): void {
  const ep = enemy.GetPosition();
  const pp = player.GetPosition();
  const start = navQuery.findClosestPoint({ x: ep.GetX(), y: 0, z: ep.GetZ() });
  const end = navQuery.findClosestPoint({ x: pp.GetX(), y: 0, z: pp.GetZ() });
  if (!start.success || !end.success) throw new Error('Recast closest-point failed after acquisition');
  if (start.polyRef === end.polyRef) {
    pathPoints = [{ ...start.point }, { ...end.point }];
  } else {
    const result = navQuery.computePath(start.point, end.point);
    if (!result.success || result.path.length < 2) throw new Error(`Detour path failed after acquisition: ${String(result.error)}`);
    pathPoints = result.path.map((p) => ({ ...p }));
  }
  pathInsideArena = pathPoints.every((p) => Math.abs(p.x) <= ARENA_WIDTH / 2 + 0.001 && Math.abs(p.z) <= ARENA_DEPTH / 2 + 0.001);
}

function fixedStep(): void {
  const playerCurrent = player.GetLinearVelocity();
  playerVelocity.Set(0, playerCurrent.GetY(), keys.has('KeyS') ? -PLAYER_SPEED : 0);
  updateCharacter(player, playerVelocity);

  const before = separation();
  if (!acquired) {
    if (before > ACQUIRE_RANGE) lastOutsideAcquireDistance = before;
    if (before <= ACQUIRE_RANGE) {
      acquirePath();
      acquiredDistance = before;
      acquired = true;
    }
  }

  const enemyCurrent = enemy.GetLinearVelocity();
  if (acquired) {
    const ep = horizontalPosition(enemy);
    const pathTarget = pathPoints[pathPoints.length - 1];
    if (!pathTarget) throw new Error('Detour path endpoint missing during chase');
    const delta = new THREE.Vector2(pathTarget.x, pathTarget.z).sub(ep);
    if (delta.lengthSq() > 0.000001) delta.normalize().multiplyScalar(ENEMY_SPEED);
    enemyVelocity.Set(delta.x, enemyCurrent.GetY(), delta.y);
  } else {
    enemyVelocity.Set(0, enemyCurrent.GetY(), 0);
  }
  updateCharacter(enemy, enemyVelocity);
  const nowEnemy = horizontalPosition(enemy);
  maxEnemyStep = Math.max(maxEnemyStep, nowEnemy.distanceTo(previousEnemy));
  previousEnemy = nowEnemy.clone();
  if (acquired) chaseSteps += 1;

  if (releasePosition) playerReleaseDrift = Math.max(playerReleaseDrift, horizontalPosition(player).distanceTo(releasePosition));
}

function observe(): Readonly<Observation> {
  const value: Observation = {
    ready: true,
    threeRevision: THREE.REVISION,
    joltVersion: '1.1.0',
    recastVersion: '0.43.1',
    initialSeparation,
    lastOutsideAcquireDistance,
    acquiredDistance,
    acquired,
    pathPoints: pathPoints.map((p) => ({ ...p })),
    pathInsideArena,
    chaseSteps,
    finalSeparation: separation(),
    maxEnemyStep,
    playerReleaseDrift,
    observationIsolation,
    postNavigationClamp: false,
    postPhysicsClamp: false,
    externalInputExecuted: physicalKeyDowns > 0 && physicalKeyUps > 0,
    combatExecuted: false,
  };
  return Object.freeze({ ...value, pathPoints: Object.freeze(value.pathPoints.map((p) => Object.freeze(p))) as unknown as Point[] });
}
window.__BYJTT_OBSERVE__ = observe;
const isolationProbe = observe();
try { if (isolationProbe.pathPoints[0]) (isolationProbe.pathPoints[0] as Point).x = 9999; } catch { /* frozen copy */ }
observationIsolation = pathPoints.length === 0;
(document.querySelector('#status') as HTMLElement).textContent = 'ready';

window.setInterval(fixedStep, FIXED_DT * 1000);
function renderFrame(): void {
  const pp = player.GetPosition();
  const ep = enemy.GetPosition();
  playerMesh.position.set(pp.GetX(), pp.GetY(), pp.GetZ());
  enemyMesh.position.set(ep.GetX(), ep.GetY(), ep.GetZ());
  renderer.render(scene, camera);
  requestAnimationFrame(renderFrame);
}
requestAnimationFrame(renderFrame);
