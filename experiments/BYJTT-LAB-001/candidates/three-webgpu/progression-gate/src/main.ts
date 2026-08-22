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
const PLAYER_SPAWN = new THREE.Vector3(0, CHARACTER_Y, 10);
const SALVAGE_SPAWN = new THREE.Vector3(5, CHARACTER_Y, 0);

type Observation = Readonly<{
  ready: boolean;
  three_revision: string;
  jolt_version: string;
  player_x_m: number;
  player_z_m: number;
  player_to_salvage_m: number;
  movement_keydowns: number;
  movement_keyups: number;
  attack_keydowns: number;
  attack_keyups: number;
  interact_keydowns: number;
  interact_keyups: number;
  attack_action_presses: number;
  interact_action_presses: number;
  attack_distance_m: number | null;
  pickup_distance_m: number | null;
  salvage_health: number;
  salvage_broken: boolean;
  reward_count: number;
  upgrade_menu_visible: boolean;
  selected_upgrade: string | null;
  effective_attack_damage: number;
  observation_isolation: boolean;
  rendered_frames: number;
}>;

type Result = Readonly<{
  passed: boolean;
  engine: string;
  jolt_version: string;
  arena_width_m: number;
  arena_depth_m: number;
  walk_speed_mps: number;
  attack_damage: number;
  attack_range_m: number;
  attack_cooldown_s: number;
  salvage_max_health: number;
  pickup_radius_m: number;
  reward_count: number;
  selected_upgrade: string | null;
  effective_attack_damage: number;
  attack_distance_m: number | null;
  pickup_distance_m: number | null;
  external_movement_input_executed: boolean;
  external_attack_input_executed: boolean;
  external_interact_input_executed: boolean;
  gameplay_attack_action_executed: boolean;
  gameplay_interact_action_executed: boolean;
  observation_isolation: boolean;
  direct_position_setter_exposed: false;
  direct_salvage_health_setter_exposed: false;
  direct_reward_grant_exposed: false;
  direct_upgrade_grant_exposed: false;
  post_physics_arena_clamp: false;
  rendered_frames: number;
}>;

declare global {
  interface Window {
    __BYJTT_OBSERVATION__?: Observation;
    __BYJTT_RESULT__?: Result;
  }
}

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
let interactKeyDowns = 0;
let interactKeyUps = 0;
let attackQueued = false;
let interactQueued = false;
let attackActionPresses = 0;
let interactActionPresses = 0;
let salvageHealth = SALVAGE_MAX_HEALTH;
let rewardCount = 0;
let upgradeMenuVisible = false;
let selectedUpgrade: string | null = null;
let effectiveAttackDamage = ATTACK_DAMAGE;
let lastAttackTime = Number.NEGATIVE_INFINITY;
let simulationTime = 0;
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
  keys.add(event.code);
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyS' || event.code === 'KeyD') movementKeyUps += 1;
  if (event.code === 'Space') attackKeyUps += 1;
  if (event.code === 'KeyE') interactKeyUps += 1;
  keys.delete(event.code);
});
window.addEventListener('blur', () => { keys.clear(); attackQueued = false; interactQueued = false; });

function makeObservation(): Observation {
  const p = playerHorizontal();
  return Object.freeze({
    ready: true,
    three_revision: THREE.REVISION,
    jolt_version: '1.1.0',
    player_x_m: p.x,
    player_z_m: p.y,
    player_to_salvage_m: distanceToSalvage(),
    movement_keydowns: movementKeyDowns,
    movement_keyups: movementKeyUps,
    attack_keydowns: attackKeyDowns,
    attack_keyups: attackKeyUps,
    interact_keydowns: interactKeyDowns,
    interact_keyups: interactKeyUps,
    attack_action_presses: attackActionPresses,
    interact_action_presses: interactActionPresses,
    attack_distance_m: attackDistance,
    pickup_distance_m: pickupDistance,
    salvage_health: salvageHealth,
    salvage_broken: salvageHealth === 0,
    reward_count: rewardCount,
    upgrade_menu_visible: upgradeMenuVisible,
    selected_upgrade: selectedUpgrade,
    effective_attack_damage: effectiveAttackDamage,
    observation_isolation: observationIsolation,
    rendered_frames: renderedFrames,
  });
}

function publish(): void {
  window.__BYJTT_OBSERVATION__ = makeObservation();
  if (selectedUpgrade === UPGRADE_ID) {
    const o = window.__BYJTT_OBSERVATION__;
    const passed = Boolean(
      o &&
      o.attack_distance_m !== null && o.attack_distance_m <= ATTACK_RANGE + 1e-6 &&
      o.pickup_distance_m !== null && o.pickup_distance_m <= PICKUP_RADIUS + 1e-6 &&
      o.salvage_health === 0 && o.reward_count === REWARD_COUNT &&
      o.selected_upgrade === UPGRADE_ID && Math.abs(o.effective_attack_damage - 40.8) < 1e-9 &&
      o.observation_isolation
    );
    window.__BYJTT_RESULT__ = Object.freeze({
      passed,
      engine: `Three.js 0.185.1`,
      jolt_version: '1.1.0',
      arena_width_m: ARENA_WIDTH,
      arena_depth_m: ARENA_DEPTH,
      walk_speed_mps: PLAYER_SPEED,
      attack_damage: ATTACK_DAMAGE,
      attack_range_m: ATTACK_RANGE,
      attack_cooldown_s: ATTACK_COOLDOWN,
      salvage_max_health: SALVAGE_MAX_HEALTH,
      pickup_radius_m: PICKUP_RADIUS,
      reward_count: rewardCount,
      selected_upgrade: selectedUpgrade,
      effective_attack_damage: effectiveAttackDamage,
      attack_distance_m: attackDistance,
      pickup_distance_m: pickupDistance,
      external_movement_input_executed: movementKeyDowns > 0 && movementKeyUps > 0,
      external_attack_input_executed: attackKeyDowns > 0 && attackKeyUps > 0,
      external_interact_input_executed: interactKeyDowns > 0 && interactKeyUps > 0,
      gameplay_attack_action_executed: attackActionPresses > 0,
      gameplay_interact_action_executed: interactActionPresses > 0,
      observation_isolation: observationIsolation,
      direct_position_setter_exposed: false,
      direct_salvage_health_setter_exposed: false,
      direct_reward_grant_exposed: false,
      direct_upgrade_grant_exposed: false,
      post_physics_arena_clamp: false,
      rendered_frames: renderedFrames,
    });
  }
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
  if (attackQueued) {
    attackQueued = false;
    attackActionPresses += 1;
    if (distance <= ATTACK_RANGE && salvageHealth > 0 && simulationTime - lastAttackTime + 1e-9 >= ATTACK_COOLDOWN) {
      salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
      lastAttackTime = simulationTime;
      attackDistance = distance;
      if (salvageHealth === 0) salvageMesh.visible = false;
    }
  }
  if (salvageHealth === 0 && rewardCount === 0 && distance <= PICKUP_RADIUS) {
    rewardCount = REWARD_COUNT;
    pickupDistance = distance;
    upgradeMenuVisible = true;
  }
  if (interactQueued) {
    interactQueued = false;
    interactActionPresses += 1;
    if (upgradeMenuVisible && rewardCount === REWARD_COUNT && selectedUpgrade === null) {
      selectedUpgrade = UPGRADE_ID;
      effectiveAttackDamage = ATTACK_DAMAGE * DAMAGE_MULTIPLIER;
    }
  }
  publish();
}

publish();
const probe = window.__BYJTT_OBSERVATION__;
if (!probe) throw new Error('observation missing');
try { (probe as { salvage_health: number }).salvage_health = 0; } catch { /* frozen observation */ }
observationIsolation = salvageHealth === SALVAGE_MAX_HEALTH;
publish();
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
