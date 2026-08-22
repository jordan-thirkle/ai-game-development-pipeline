import * as THREE from 'three';
import initJolt from 'jolt-physics';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPEED = 3.5;
const PLAYER_RADIUS = 0.42;
const CHARACTER_Y = 1;
const FIXED_DT = 1 / 60;
const ATTACK_DAMAGE = 34;
const ATTACK_RANGE = 1.8;
const ATTACK_COOLDOWN = 0.55;
const SALVAGE_MAX_HEALTH = 34;
const PICKUP_RADIUS = 1.25;
const REWARD_COUNT = 1;
const UPGRADE_ID = 'damage-up-1';
const DAMAGE_MULTIPLIER = 1.2;
const SAVE_SCHEMA_VERSION = 1;
const SAVE_KEY = 'byjtt-lab-001-three-save-v1';
const PLAYER_SPAWN = new THREE.Vector3(0, CHARACTER_Y, 10);
const SALVAGE_SPAWN = new THREE.Vector3(5, CHARACTER_Y, 0);

type SaveDocument = Readonly<{
  schema_version: number;
  reward_count: number;
  selected_upgrades: readonly string[];
}>;

type Observation = Readonly<{
  ready: boolean;
  loaded_from_persistence: boolean;
  three_revision: string;
  jolt_version: string;
  player_x_m: number;
  player_z_m: number;
  player_to_salvage_m: number;
  salvage_health: number;
  salvage_broken: boolean;
  reward_count: number;
  upgrade_menu_visible: boolean;
  selected_upgrades: readonly string[];
  effective_attack_damage: number;
  save_schema_version: number | null;
  save_action_presses: number;
  successful_saves: number;
  load_count: number;
  movement_keydowns: number;
  movement_keyups: number;
  attack_keydowns: number;
  attack_keyups: number;
  interact_keydowns: number;
  interact_keyups: number;
  save_keydowns: number;
  save_keyups: number;
  attack_distance_m: number | null;
  pickup_distance_m: number | null;
  observation_isolation: boolean;
  rendered_frames: number;
}>;

declare global {
  interface Window {
    __BYJTT_OBSERVATION__?: Observation;
  }
}

function parseSave(raw: string | null): SaveDocument | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const candidate = value as { schema_version?: unknown; reward_count?: unknown; selected_upgrades?: unknown };
    if (candidate.schema_version !== SAVE_SCHEMA_VERSION || candidate.reward_count !== REWARD_COUNT) return null;
    if (!Array.isArray(candidate.selected_upgrades) || !candidate.selected_upgrades.every((item) => typeof item === 'string')) return null;
    if (!candidate.selected_upgrades.includes(UPGRADE_ID)) return null;
    return Object.freeze({
      schema_version: SAVE_SCHEMA_VERSION,
      reward_count: REWARD_COUNT,
      selected_upgrades: Object.freeze([...candidate.selected_upgrades]),
    });
  } catch {
    return null;
  }
}

const loadedSave = parseSave(window.localStorage.getItem(SAVE_KEY));
let loadedFromPersistence = loadedSave !== null;
let loadCount = loadedSave ? 1 : 0;
let rewardCount = loadedSave?.reward_count ?? 0;
let selectedUpgrades: string[] = loadedSave ? [...loadedSave.selected_upgrades] : [];
let effectiveAttackDamage = selectedUpgrades.includes(UPGRADE_ID) ? ATTACK_DAMAGE * DAMAGE_MULTIPLIER : ATTACK_DAMAGE;
let salvageHealth = loadedSave ? 0 : SALVAGE_MAX_HEALTH;
let upgradeMenuVisible = false;
let saveSchemaVersion: number | null = loadedSave?.schema_version ?? null;
let saveActionPresses = 0;
let successfulSaves = 0;

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
if (!canvas) throw new Error('renderCanvas missing');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101318);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(12, 20, 22);
camera.lookAt(2, 0, 2);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2));
const floorGeometry = new THREE.PlaneGeometry(ARENA_WIDTH, ARENA_DEPTH);
floorGeometry.rotateX(-Math.PI / 2);
scene.add(new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({ color: 0x345d43, side: THREE.DoubleSide })));
const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(PLAYER_RADIUS, 1.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0x5da9ff }));
const salvageMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xf0b34a }));
salvageMesh.position.copy(SALVAGE_SPAWN);
salvageMesh.visible = salvageHealth > 0;
scene.add(playerMesh, salvageMesh);

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

const capsule = new Jolt.CapsuleShape(0.575, PLAYER_RADIUS);
const characterSettings = new Jolt.CharacterVirtualSettings();
characterSettings.mMass = 80;
characterSettings.mMaxSlopeAngle = Math.PI / 4;
characterSettings.mMaxStrength = 100;
characterSettings.mShape = capsule;
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
let interactKeyDowns = 0;
let interactKeyUps = 0;
let saveKeyDowns = 0;
let saveKeyUps = 0;
let attackQueued = false;
let interactQueued = false;
let saveQueued = false;
let simulationTime = 0;
let lastAttackTime = Number.NEGATIVE_INFINITY;
let attackDistance: number | null = null;
let pickupDistance: number | null = null;
let observationIsolation = false;
let renderedFrames = 0;

function playerHorizontal(): THREE.Vector2 {
  const p = player.GetPosition();
  return new THREE.Vector2(p.GetX(), p.GetZ());
}
function distanceToSalvage(): number {
  return playerHorizontal().distanceTo(new THREE.Vector2(SALVAGE_SPAWN.x, SALVAGE_SPAWN.z));
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyS' || event.code === 'KeyD') movementKeyDowns += 1;
  if (event.code === 'Space') { attackKeyDowns += 1; attackQueued = true; }
  if (event.code === 'KeyE') { interactKeyDowns += 1; interactQueued = true; }
  if (event.code === 'KeyP') { saveKeyDowns += 1; saveQueued = true; }
  keys.add(event.code);
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyS' || event.code === 'KeyD') movementKeyUps += 1;
  if (event.code === 'Space') attackKeyUps += 1;
  if (event.code === 'KeyE') interactKeyUps += 1;
  if (event.code === 'KeyP') saveKeyUps += 1;
  keys.delete(event.code);
});
window.addEventListener('blur', () => { keys.clear(); attackQueued = false; interactQueued = false; saveQueued = false; });

function makeObservation(): Observation {
  const p = playerHorizontal();
  return Object.freeze({
    ready: true,
    loaded_from_persistence: loadedFromPersistence,
    three_revision: THREE.REVISION,
    jolt_version: '1.1.0',
    player_x_m: p.x,
    player_z_m: p.y,
    player_to_salvage_m: distanceToSalvage(),
    salvage_health: salvageHealth,
    salvage_broken: salvageHealth === 0,
    reward_count: rewardCount,
    upgrade_menu_visible: upgradeMenuVisible,
    selected_upgrades: Object.freeze([...selectedUpgrades]),
    effective_attack_damage: effectiveAttackDamage,
    save_schema_version: saveSchemaVersion,
    save_action_presses: saveActionPresses,
    successful_saves: successfulSaves,
    load_count: loadCount,
    movement_keydowns: movementKeyDowns,
    movement_keyups: movementKeyUps,
    attack_keydowns: attackKeyDowns,
    attack_keyups: attackKeyUps,
    interact_keydowns: interactKeyDowns,
    interact_keyups: interactKeyUps,
    save_keydowns: saveKeyDowns,
    save_keyups: saveKeyUps,
    attack_distance_m: attackDistance,
    pickup_distance_m: pickupDistance,
    observation_isolation: observationIsolation,
    rendered_frames: renderedFrames,
  });
}

function publish(): void {
  window.__BYJTT_OBSERVATION__ = makeObservation();
}

function saveProgress(): void {
  saveActionPresses += 1;
  if (rewardCount !== REWARD_COUNT || !selectedUpgrades.includes(UPGRADE_ID)) return;
  const document: SaveDocument = Object.freeze({
    schema_version: SAVE_SCHEMA_VERSION,
    reward_count: rewardCount,
    selected_upgrades: Object.freeze([...selectedUpgrades]),
  });
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(document));
  saveSchemaVersion = SAVE_SCHEMA_VERSION;
  successfulSaves += 1;
}

function fixedStep(): void {
  simulationTime += FIXED_DT;
  const current = player.GetLinearVelocity();
  let vx = 0;
  let vz = 0;
  if (keys.has('KeyD')) vx += PLAYER_SPEED;
  if (keys.has('KeyA')) vx -= PLAYER_SPEED;
  if (keys.has('KeyS')) vz -= PLAYER_SPEED;
  if (keys.has('KeyW')) vz += PLAYER_SPEED;
  velocity.Set(vx, current.GetY(), vz);
  player.SetLinearVelocity(velocity);
  player.ExtendedUpdate(FIXED_DT, gravity, updateSettings, movingBPFilter, movingLayerFilter, bodyFilter, shapeFilter, jolt.GetTempAllocator());

  const distance = distanceToSalvage();
  if (!loadedFromPersistence && attackQueued) {
    attackQueued = false;
    if (distance <= ATTACK_RANGE && salvageHealth > 0 && simulationTime - lastAttackTime + 1e-9 >= ATTACK_COOLDOWN) {
      salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
      lastAttackTime = simulationTime;
      attackDistance = distance;
      if (salvageHealth === 0) salvageMesh.visible = false;
    }
  } else {
    attackQueued = false;
  }
  if (!loadedFromPersistence && salvageHealth === 0 && rewardCount === 0 && distance <= PICKUP_RADIUS) {
    rewardCount = REWARD_COUNT;
    pickupDistance = distance;
    upgradeMenuVisible = true;
  }
  if (!loadedFromPersistence && interactQueued) {
    interactQueued = false;
    if (upgradeMenuVisible && rewardCount === REWARD_COUNT && !selectedUpgrades.includes(UPGRADE_ID)) {
      selectedUpgrades = [UPGRADE_ID];
      effectiveAttackDamage = ATTACK_DAMAGE * DAMAGE_MULTIPLIER;
    }
  } else {
    interactQueued = false;
  }
  if (saveQueued) {
    saveQueued = false;
    saveProgress();
  }
  publish();
}

publish();
const probe = window.__BYJTT_OBSERVATION__;
if (!probe) throw new Error('observation missing');
try { (probe as { reward_count: number }).reward_count = 99; } catch { /* frozen observation */ }
observationIsolation = rewardCount === (loadedSave?.reward_count ?? 0);
publish();
(document.querySelector('#status') as HTMLElement).textContent = loadedFromPersistence ? 'restored' : 'ready';
window.setInterval(fixedStep, FIXED_DT * 1000);

function renderFrame(): void {
  const p = player.GetPosition();
  playerMesh.position.set(p.GetX(), p.GetY(), p.GetZ());
  renderer.render(scene, camera);
  renderedFrames += 1;
  requestAnimationFrame(renderFrame);
}
requestAnimationFrame(renderFrame);
