import * as THREE from 'three';
import initJolt from 'jolt-physics';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPEED = 3.5;
const PLAYER_ATTACK_RANGE = 1.8;
const PLAYER_ATTACK_DAMAGE = 34;
const PLAYER_ATTACK_COOLDOWN = 0.55;
const ENEMY_ATTACK_RANGE = 1.6;
const ENEMY_ATTACK_DAMAGE = 20;
const ENEMY_ATTACK_COOLDOWN = 1.1;
const INITIAL_PLAYER_HEALTH = 100;
const INITIAL_ENEMY_HEALTH = 100;
const FIXED_DT = 1 / 60;
const PLAYER_RADIUS = 0.42;
const CHARACTER_Y = 1;
const PLAYER_SPAWN = new THREE.Vector3(0, CHARACTER_Y, 10);
const ENEMY_SPAWN = new THREE.Vector3(0, CHARACTER_Y, -6);

interface Observation {
  ready: boolean;
  threeRevision: string;
  joltVersion: string;
  initialSeparation: number;
  separation: number;
  movementKeyDowns: number;
  movementKeyUps: number;
  attackKeyDowns: number;
  attackKeyUps: number;
  attackActionPresses: number;
  validPlayerAttacks: number;
  blockedPlayerAttacks: number;
  playerAttackDistances: number[];
  playerAttackTimes: number[];
  playerHealth: number;
  enemyHealth: number;
  enemyAttackCount: number;
  enemyAttackDistances: number[];
  playerReleaseDrift: number;
  observationIsolation: boolean;
  externalMovementInputExecuted: boolean;
  externalAttackInputExecuted: boolean;
  gameplayAttackActionExecuted: boolean;
  directHealthSetterExposed: boolean;
  directPositionSetterExposed: boolean;
  postPhysicsClamp: boolean;
  renderedFrames: number;
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
const floorGeometry = new THREE.PlaneGeometry(ARENA_WIDTH, ARENA_DEPTH);
floorGeometry.rotateX(-Math.PI / 2);
scene.add(new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({ color: 0x345d43, side: THREE.DoubleSide })));
const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0x5da9ff }));
const enemyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0xff665d }));
enemyMesh.position.copy(ENEMY_SPAWN);
scene.add(playerMesh, enemyMesh);

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
  const bodySettings = new Jolt.BodyCreationSettings(shape, new Jolt.RVec3(x, y, z), Jolt.Quat.prototype.sIdentity(), Jolt.EMotionType_Static, LAYER_NON_MOVING);
  const body = bodyInterface.CreateBody(bodySettings);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(bodySettings);
}
addStaticBox(ARENA_WIDTH / 2, 0.25, ARENA_DEPTH / 2, 0, -0.25, 0);
addStaticBox(0.25, 2, ARENA_DEPTH / 2, ARENA_WIDTH / 2, 2, 0);
addStaticBox(0.25, 2, ARENA_DEPTH / 2, -ARENA_WIDTH / 2, 2, 0);
addStaticBox(ARENA_WIDTH / 2, 2, 0.25, 0, 2, ARENA_DEPTH / 2);
addStaticBox(ARENA_WIDTH / 2, 2, 0.25, 0, 2, -ARENA_DEPTH / 2);

const shape = new Jolt.CapsuleShape(0.575, PLAYER_RADIUS);
const characterSettings = new Jolt.CharacterVirtualSettings();
characterSettings.mMass = 80;
characterSettings.mMaxSlopeAngle = Math.PI / 4;
characterSettings.mMaxStrength = 100;
characterSettings.mShape = shape;
characterSettings.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
characterSettings.mCharacterPadding = 0.02;
characterSettings.mPenetrationRecoverySpeed = 1;
characterSettings.mPredictiveContactDistance = 0.1;
characterSettings.mSupportingVolume = new Jolt.Plane(Jolt.Vec3.prototype.sAxisY(), -PLAYER_RADIUS);
const player = new Jolt.CharacterVirtual(characterSettings, new Jolt.RVec3(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z), Jolt.Quat.prototype.sIdentity(), physicsSystem);
const movingBPFilter = new Jolt.DefaultBroadPhaseLayerFilter(jolt.GetObjectVsBroadPhaseLayerFilter(), LAYER_MOVING);
const movingLayerFilter = new Jolt.DefaultObjectLayerFilter(jolt.GetObjectLayerPairFilter(), LAYER_MOVING);
const bodyFilter = new Jolt.BodyFilter();
const shapeFilter = new Jolt.ShapeFilter();
const updateSettings = new Jolt.ExtendedUpdateSettings();
const gravity = new Jolt.Vec3(0, -9.81, 0);
const velocity = new Jolt.Vec3();
const keys = new Set<string>();

let movementKeyDowns = 0;
let movementKeyUps = 0;
let attackKeyDowns = 0;
let attackKeyUps = 0;
let attackQueued = false;
let attackActionPresses = 0;
let validPlayerAttacks = 0;
let blockedPlayerAttacks = 0;
let playerHealth = INITIAL_PLAYER_HEALTH;
let enemyHealth = INITIAL_ENEMY_HEALTH;
let enemyAttackCount = 0;
let lastPlayerAttackTime = Number.NEGATIVE_INFINITY;
let lastEnemyAttackTime = Number.NEGATIVE_INFINITY;
let simulationTime = 0;
let releasePosition: THREE.Vector2 | null = null;
let playerReleaseDrift = 0;
let observationIsolation = false;
let renderedFrames = 0;
const playerAttackDistances: number[] = [];
const playerAttackTimes: number[] = [];
const enemyAttackDistances: number[] = [];

function playerHorizontal(): THREE.Vector2 {
  const p = player.GetPosition();
  return new THREE.Vector2(p.GetX(), p.GetZ());
}
function separation(): number { return playerHorizontal().distanceTo(new THREE.Vector2(ENEMY_SPAWN.x, ENEMY_SPAWN.z)); }

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyS' && !event.repeat) movementKeyDowns += 1;
  if (event.code === 'Space' && !event.repeat) {
    attackKeyDowns += 1;
    attackQueued = true;
  }
  keys.add(event.code);
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyS') {
    movementKeyUps += 1;
    releasePosition = playerHorizontal();
  }
  if (event.code === 'Space') attackKeyUps += 1;
  keys.delete(event.code);
});
window.addEventListener('blur', () => { keys.clear(); attackQueued = false; });

function fixedStep(): void {
  simulationTime += FIXED_DT;
  const current = player.GetLinearVelocity();
  velocity.Set(0, current.GetY(), keys.has('KeyS') ? -PLAYER_SPEED : 0);
  player.SetLinearVelocity(velocity);
  player.ExtendedUpdate(FIXED_DT, gravity, updateSettings, movingBPFilter, movingLayerFilter, bodyFilter, shapeFilter, jolt.GetTempAllocator());

  const distance = separation();
  if (attackQueued) {
    attackQueued = false;
    attackActionPresses += 1;
    if (distance <= PLAYER_ATTACK_RANGE && simulationTime - lastPlayerAttackTime + 1e-9 >= PLAYER_ATTACK_COOLDOWN && enemyHealth > 0) {
      validPlayerAttacks += 1;
      enemyHealth = Math.max(0, enemyHealth - PLAYER_ATTACK_DAMAGE);
      playerAttackDistances.push(distance);
      playerAttackTimes.push(simulationTime);
      lastPlayerAttackTime = simulationTime;
    } else if (distance <= PLAYER_ATTACK_RANGE && enemyHealth > 0) {
      blockedPlayerAttacks += 1;
    }
  }

  if (distance <= ENEMY_ATTACK_RANGE && playerHealth > 0 && simulationTime - lastEnemyAttackTime + 1e-9 >= ENEMY_ATTACK_COOLDOWN) {
    enemyAttackCount += 1;
    playerHealth = Math.max(0, playerHealth - ENEMY_ATTACK_DAMAGE);
    enemyAttackDistances.push(distance);
    lastEnemyAttackTime = simulationTime;
  }

  if (releasePosition) playerReleaseDrift = Math.max(playerReleaseDrift, playerHorizontal().distanceTo(releasePosition));
}

function observe(): Readonly<Observation> {
  const value: Observation = {
    ready: true,
    threeRevision: THREE.REVISION,
    joltVersion: '1.1.0',
    initialSeparation: PLAYER_SPAWN.distanceTo(ENEMY_SPAWN),
    separation: separation(),
    movementKeyDowns,
    movementKeyUps,
    attackKeyDowns,
    attackKeyUps,
    attackActionPresses,
    validPlayerAttacks,
    blockedPlayerAttacks,
    playerAttackDistances: [...playerAttackDistances],
    playerAttackTimes: [...playerAttackTimes],
    playerHealth,
    enemyHealth,
    enemyAttackCount,
    enemyAttackDistances: [...enemyAttackDistances],
    playerReleaseDrift,
    observationIsolation,
    externalMovementInputExecuted: movementKeyDowns > 0 && movementKeyUps > 0,
    externalAttackInputExecuted: attackKeyDowns > 0 && attackKeyUps > 0,
    gameplayAttackActionExecuted: attackActionPresses > 0,
    directHealthSetterExposed: false,
    directPositionSetterExposed: false,
    postPhysicsClamp: false,
    renderedFrames,
  };
  return Object.freeze({
    ...value,
    playerAttackDistances: Object.freeze([...value.playerAttackDistances]) as unknown as number[],
    playerAttackTimes: Object.freeze([...value.playerAttackTimes]) as unknown as number[],
    enemyAttackDistances: Object.freeze([...value.enemyAttackDistances]) as unknown as number[],
  });
}
window.__BYJTT_OBSERVE__ = observe;
const probe = observe();
try { (probe as Observation).enemyHealth = 1; } catch { /* frozen copy */ }
observationIsolation = enemyHealth === INITIAL_ENEMY_HEALTH;
(document.querySelector('#status') as HTMLElement).textContent = 'ready';

window.setInterval(fixedStep, FIXED_DT * 1000);
function renderFrame(): void {
  const p = player.GetPosition();
  playerMesh.position.set(p.GetX(), p.GetY(), p.GetZ());
  renderer.render(scene, camera);
  renderedFrames += 1;
  requestAnimationFrame(renderFrame);
}
requestAnimationFrame(renderFrame);
