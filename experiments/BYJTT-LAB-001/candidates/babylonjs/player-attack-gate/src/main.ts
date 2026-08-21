import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsCharacterController } from '@babylonjs/core/Physics/v2/characterController';
import HavokPhysics from '@babylonjs/havok';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPAWN = Object.freeze({ x: 0, y: 0, z: 10 });
const ENEMY_SPAWN = Object.freeze({ x: 0, y: 0, z: -6 });
const PLAYER_SPEED = 3.5;
const PLAYER_ATTACK_DAMAGE = 34;
const PLAYER_ATTACK_RANGE = 1.8;
const PLAYER_ATTACK_COOLDOWN = 0.55;
const ENEMY_MAX_HEALTH = 100;
const FIXED_DT = 1 / 60;
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;
const CENTER_Y = CAPSULE_HEIGHT / 2;
const GRAVITY = new Vector3(0, -9.81, 0);

const canvasNode = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const statusNode = document.querySelector<HTMLDivElement>('#status');
if (!canvasNode || !statusNode) throw new Error('required DOM nodes missing');
const canvas = canvasNode;
const status = statusNode;

const keys = new Set<string>();
let moveKeyDownCallbacks = 0;
let moveKeyUpCallbacks = 0;
let attackKeyDownCallbacks = 0;
let attackKeyUpCallbacks = 0;
let attackQueued = 0;
let attackPressesConsumed = 0;
let validAttacks = 0;
let blockedCooldownPresses = 0;
let blockedRangePresses = 0;
let enemyHealth = ENEMY_MAX_HEALTH;
let lastAttackTime = Number.NEGATIVE_INFINITY;
let firstAttackTime = Number.NaN;
let secondAttackTime = Number.NaN;
let firstAttackDistance = Number.NaN;
let secondAttackDistance = Number.NaN;
let healthAfterFirstAttack = ENEMY_MAX_HEALTH;
let combatClock = 0;
let ready = false;
let renderFrames = 0;
let simulationSteps = 0;
let releaseAnchorZ: number | null = null;
let releaseDrift = 0;
let player: PhysicsCharacterController | null = null;
let enemy: PhysicsCharacterController | null = null;
let observationIsolation = false;
let havokPluginVersion: number | null = null;

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyS') {
    keys.add(event.code);
    moveKeyDownCallbacks += 1;
  } else if (event.code === 'Space') {
    attackQueued += 1;
    attackKeyDownCallbacks += 1;
    event.preventDefault();
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyS') {
    keys.delete(event.code);
    moveKeyUpCallbacks += 1;
    releaseAnchorZ = player?.getPosition().z ?? null;
  } else if (event.code === 'Space') {
    attackKeyUpCallbacks += 1;
    event.preventDefault();
  }
});
window.addEventListener('blur', () => keys.clear());

function horizontalDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function tickController(controller: PhysicsCharacterController, desired: Vector3): void {
  const current = controller.getVelocity();
  controller.setVelocity(new Vector3(desired.x, current.y, desired.z));
  const support = controller.checkSupport(FIXED_DT, GRAVITY);
  controller.integrate(FIXED_DT, support, GRAVITY);
}

function addStaticBox(scene: Scene, name: string, size: { width: number; height: number; depth: number }, position: Vector3): void {
  const mesh = MeshBuilder.CreateBox(name, size, scene);
  mesh.position.copyFrom(position);
  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = new Color3(0.18, 0.2, 0.23);
  mesh.material = material;
  new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
}

function snapshot() {
  const playerPosition = player?.getPosition() ?? new Vector3(PLAYER_SPAWN.x, CENTER_Y, PLAYER_SPAWN.z);
  const enemyPosition = enemy?.getPosition() ?? new Vector3(ENEMY_SPAWN.x, CENTER_Y, ENEMY_SPAWN.z);
  return Object.freeze({
    ready,
    babylon_version: Engine.Version,
    havok_plugin_version: havokPluginVersion,
    arena: Object.freeze({ width: ARENA_WIDTH, depth: ARENA_DEPTH }),
    player_spawn: Object.freeze({ ...PLAYER_SPAWN }),
    enemy_spawn: Object.freeze({ ...ENEMY_SPAWN }),
    player_speed: PLAYER_SPEED,
    attack_damage: PLAYER_ATTACK_DAMAGE,
    attack_range: PLAYER_ATTACK_RANGE,
    attack_cooldown: PLAYER_ATTACK_COOLDOWN,
    enemy_max_health: ENEMY_MAX_HEALTH,
    fixed_dt: FIXED_DT,
    player_position: Object.freeze({ x: playerPosition.x, y: playerPosition.y - CENTER_Y, z: playerPosition.z }),
    enemy_position: Object.freeze({ x: enemyPosition.x, y: enemyPosition.y - CENTER_Y, z: enemyPosition.z }),
    current_distance: horizontalDistance(playerPosition, enemyPosition),
    enemy_health: enemyHealth,
    attack_presses_consumed: attackPressesConsumed,
    valid_attacks: validAttacks,
    blocked_cooldown_presses: blockedCooldownPresses,
    blocked_range_presses: blockedRangePresses,
    first_attack_time: firstAttackTime,
    second_attack_time: secondAttackTime,
    first_attack_distance: firstAttackDistance,
    second_attack_distance: secondAttackDistance,
    health_after_first_attack: healthAfterFirstAttack,
    move_key_down_callbacks: moveKeyDownCallbacks,
    move_key_up_callbacks: moveKeyUpCallbacks,
    attack_key_down_callbacks: attackKeyDownCallbacks,
    attack_key_up_callbacks: attackKeyUpCallbacks,
    release_drift: releaseDrift,
    render_frames: renderFrames,
    simulation_steps: simulationSteps,
    observation_isolation: observationIsolation,
    external_input_executed: moveKeyDownCallbacks > 0 && moveKeyUpCallbacks > 0 && attackKeyDownCallbacks > 0 && attackKeyUpCallbacks > 0,
    player_attack_executed: validAttacks > 0,
    direct_position_setter_exposed: false,
    direct_health_setter_exposed: false,
    post_physics_arena_clamp: false,
  });
}

declare global {
  interface Window { __BYJTT_BABYLON_PLAYER_ATTACK__: { snapshot: typeof snapshot }; }
}

Object.defineProperty(window, '__BYJTT_BABYLON_PLAYER_ATTACK__', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ snapshot }),
});

async function main(): Promise<void> {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  new HemisphericLight('light', new Vector3(0.2, 1, -0.2), scene).intensity = 1.1;
  const camera = new UniversalCamera('camera', new Vector3(0, 18, 22), scene);
  camera.setTarget(new Vector3(0, 0, 1));

  const havok = await HavokPhysics();
  const plugin = new HavokPlugin(true, havok);
  if (!scene.enablePhysics(GRAVITY, plugin)) throw new Error('scene.enablePhysics returned false');
  havokPluginVersion = plugin.getPluginVersion();

  const wallThickness = 1;
  addStaticBox(scene, 'floor', { width: ARENA_WIDTH, height: 1, depth: ARENA_DEPTH }, new Vector3(0, -0.5, 0));
  addStaticBox(scene, 'east-wall', { width: wallThickness, height: 4, depth: ARENA_DEPTH }, new Vector3(ARENA_WIDTH / 2 + wallThickness / 2, 2, 0));
  addStaticBox(scene, 'west-wall', { width: wallThickness, height: 4, depth: ARENA_DEPTH }, new Vector3(-ARENA_WIDTH / 2 - wallThickness / 2, 2, 0));
  addStaticBox(scene, 'north-wall', { width: ARENA_WIDTH, height: 4, depth: wallThickness }, new Vector3(0, 2, -ARENA_DEPTH / 2 - wallThickness / 2));
  addStaticBox(scene, 'south-wall', { width: ARENA_WIDTH, height: 4, depth: wallThickness }, new Vector3(0, 2, ARENA_DEPTH / 2 + wallThickness / 2));

  player = new PhysicsCharacterController(new Vector3(PLAYER_SPAWN.x, CENTER_Y, PLAYER_SPAWN.z), { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS }, scene);
  enemy = new PhysicsCharacterController(new Vector3(ENEMY_SPAWN.x, CENTER_Y, ENEMY_SPAWN.z), { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS }, scene);
  player.maxCharacterSpeedForSolver = 8;
  player.maxAcceleration = 50;
  enemy.maxCharacterSpeedForSolver = 8;
  enemy.maxAcceleration = 50;

  const playerVisual = MeshBuilder.CreateCapsule('player', { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS }, scene);
  const enemyVisual = MeshBuilder.CreateCapsule('enemy', { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS }, scene);
  const playerMaterial = new StandardMaterial('player-material', scene);
  playerMaterial.diffuseColor = new Color3(0.25, 0.55, 0.9);
  playerVisual.material = playerMaterial;
  const enemyMaterial = new StandardMaterial('enemy-material', scene);
  enemyMaterial.diffuseColor = new Color3(0.9, 0.25, 0.25);
  enemyVisual.material = enemyMaterial;

  let accumulator = 0;
  scene.onBeforeRenderObservable.add(() => {
    accumulator += Math.min(engine.getDeltaTime() / 1000, 0.25);
    while (accumulator >= FIXED_DT) {
      if (!player || !enemy) break;
      combatClock += FIXED_DT;
      tickController(player, new Vector3(0, 0, keys.has('KeyS') ? -PLAYER_SPEED : 0));
      tickController(enemy, Vector3.Zero());
      if (releaseAnchorZ !== null) releaseDrift = Math.max(releaseDrift, Math.abs(player.getPosition().z - releaseAnchorZ));

      while (attackQueued > 0) {
        attackQueued -= 1;
        attackPressesConsumed += 1;
        const distance = horizontalDistance(player.getPosition(), enemy.getPosition());
        if (distance > PLAYER_ATTACK_RANGE) {
          blockedRangePresses += 1;
        } else if (combatClock - lastAttackTime + 1e-9 < PLAYER_ATTACK_COOLDOWN) {
          blockedCooldownPresses += 1;
        } else {
          enemyHealth = Math.max(0, enemyHealth - PLAYER_ATTACK_DAMAGE);
          lastAttackTime = combatClock;
          validAttacks += 1;
          if (validAttacks === 1) {
            firstAttackTime = combatClock;
            firstAttackDistance = distance;
            healthAfterFirstAttack = enemyHealth;
          } else if (validAttacks === 2) {
            secondAttackTime = combatClock;
            secondAttackDistance = distance;
          }
        }
      }
      simulationSteps += 1;
      accumulator -= FIXED_DT;
    }
    if (player && enemy) {
      playerVisual.position.copyFrom(player.getPosition());
      enemyVisual.position.copyFrom(enemy.getPosition());
    }
    renderFrames += 1;
    status.textContent = `distance=${snapshot().current_distance.toFixed(3)} hp=${enemyHealth}`;
  });

  const before = snapshot();
  try { (before as unknown as { enemy_health: number }).enemy_health = -999; } catch { /* frozen by design */ }
  observationIsolation = snapshot().enemy_health === ENEMY_MAX_HEALTH;
  ready = true;
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
}

void main().catch((error: unknown) => {
  status.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  throw error;
});
