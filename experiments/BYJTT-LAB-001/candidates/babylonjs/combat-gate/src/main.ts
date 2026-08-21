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
import { CreateNavigationPluginAsync } from '@babylonjs/addons/navigation/factory/factory.single-thread';
import * as RecastCore from '@recast-navigation/core';
import * as RecastGenerators from '@recast-navigation/generators';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPAWN = Object.freeze({ x: 0, y: 0, z: 10 });
const ENEMY_SPAWN = Object.freeze({ x: 0, y: 0, z: -6 });
const PLAYER_SPEED = 3.5;
const ENEMY_SPEED = 2.7;
const ACQUIRE_RANGE = 12;
const PLAYER_MAX_HEALTH = 100;
const ENEMY_ATTACK_RANGE = 1.6;
const ENEMY_ATTACK_DAMAGE = 20;
const ENEMY_ATTACK_COOLDOWN = 1.1;
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
let keyDownCallbacks = 0;
let keyUpCallbacks = 0;
let ready = false;
let renderFrames = 0;
let simulationSteps = 0;
let acquired = false;
let lastDistanceBeforeAcquire = Number.NaN;
let acquisitionDistance = Number.NaN;
let initialDistance = 16;
let pathPoints: Vector3[] = [];
let pathLength = 0;
let pathInsideArena = false;
let chaseSteps = 0;
let maxEnemyStep = 0;
let releaseAnchorZ: number | null = null;
let releaseDrift = 0;
let observationIsolation = false;
let havokPluginVersion: number | null = null;
let navigationName = '';
let player: PhysicsCharacterController | null = null;
let enemy: PhysicsCharacterController | null = null;
let playerVisual: ReturnType<typeof MeshBuilder.CreateCapsule> | null = null;
let enemyVisual: ReturnType<typeof MeshBuilder.CreateCapsule> | null = null;
let playerHealth = PLAYER_MAX_HEALTH;
let enemyAttackCount = 0;
let firstAttackDistance = Number.NaN;
let firstAttackTime = Number.NaN;
let secondAttackTime = Number.NaN;
let healthAfterFirstAttack = PLAYER_MAX_HEALTH;
let cooldownBlockedSteps = 0;
let combatClock = 0;
let lastEnemyAttackTime = Number.NEGATIVE_INFINITY;

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyS') {
    keys.add(event.code);
    keyDownCallbacks += 1;
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyS') {
    keys.delete(event.code);
    keyUpCallbacks += 1;
    releaseAnchorZ = player?.getPosition().z ?? null;
  }
});
window.addEventListener('blur', () => keys.clear());

function groundPosition(controller: PhysicsCharacterController, spawn: Readonly<{ x: number; y: number; z: number }>): Vector3 {
  const p = controller.getPosition();
  return new Vector3(p.x, spawn.y, p.z);
}

function horizontalDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function insideArena(point: Vector3): boolean {
  return Math.abs(point.x) <= ARENA_WIDTH / 2 + 0.001 && Math.abs(point.z) <= ARENA_DEPTH / 2 + 0.001;
}

function pathDistance(points: readonly Vector3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += Vector3.Distance(points[i - 1]!, points[i]!);
  return total;
}

function snapshot() {
  const playerPosition = player?.getPosition() ?? new Vector3(PLAYER_SPAWN.x, CENTER_Y, PLAYER_SPAWN.z);
  const enemyPosition = enemy?.getPosition() ?? new Vector3(ENEMY_SPAWN.x, CENTER_Y, ENEMY_SPAWN.z);
  const currentDistance = horizontalDistance(playerPosition, enemyPosition);
  return Object.freeze({
    ready,
    babylon_version: Engine.Version,
    havok_plugin_version: havokPluginVersion,
    navigation_plugin: navigationName,
    recast_version: '0.43.1',
    arena: Object.freeze({ width: ARENA_WIDTH, depth: ARENA_DEPTH }),
    player_spawn: Object.freeze({ ...PLAYER_SPAWN }),
    enemy_spawn: Object.freeze({ ...ENEMY_SPAWN }),
    player_speed: PLAYER_SPEED,
    enemy_speed: ENEMY_SPEED,
    acquire_range: ACQUIRE_RANGE,
    player_max_health: PLAYER_MAX_HEALTH,
    enemy_attack_range: ENEMY_ATTACK_RANGE,
    enemy_attack_damage: ENEMY_ATTACK_DAMAGE,
    enemy_attack_cooldown: ENEMY_ATTACK_COOLDOWN,
    fixed_dt: FIXED_DT,
    initial_distance: initialDistance,
    current_distance: currentDistance,
    last_distance_before_acquire: lastDistanceBeforeAcquire,
    acquisition_distance: acquisitionDistance,
    acquired,
    path_points: Object.freeze(pathPoints.map((p) => Object.freeze({ x: p.x, y: p.y, z: p.z }))),
    path_length: pathLength,
    path_inside_arena: pathInsideArena,
    chase_steps: chaseSteps,
    max_enemy_step: maxEnemyStep,
    player_release_drift: releaseDrift,
    player_position: Object.freeze({ x: playerPosition.x, y: playerPosition.y - CENTER_Y, z: playerPosition.z }),
    enemy_position: Object.freeze({ x: enemyPosition.x, y: enemyPosition.y - CENTER_Y, z: enemyPosition.z }),
    player_health: playerHealth,
    enemy_attack_count: enemyAttackCount,
    first_attack_distance: firstAttackDistance,
    first_attack_time: firstAttackTime,
    second_attack_time: secondAttackTime,
    health_after_first_attack: healthAfterFirstAttack,
    cooldown_blocked_steps: cooldownBlockedSteps,
    key_down_callbacks: keyDownCallbacks,
    key_up_callbacks: keyUpCallbacks,
    render_frames: renderFrames,
    simulation_steps: simulationSteps,
    observation_isolation: observationIsolation,
    post_navigation_clamp: false,
    post_physics_arena_clamp: false,
    external_input_executed: keyDownCallbacks > 0 && keyUpCallbacks > 0,
    enemy_combat_executed: enemyAttackCount > 0,
    player_attack_executed: false,
    direct_health_setter_exposed: false,
  });
}

declare global {
  interface Window {
    __BYJTT_BABYLON_COMBAT__: { snapshot: typeof snapshot };
  }
}

Object.defineProperty(window, '__BYJTT_BABYLON_COMBAT__', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ snapshot }),
});

function addStaticBox(scene: Scene, name: string, size: { width: number; height: number; depth: number }, position: Vector3) {
  const mesh = MeshBuilder.CreateBox(name, size, scene);
  mesh.position.copyFrom(position);
  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = new Color3(0.18, 0.2, 0.23);
  mesh.material = material;
  new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
  return mesh;
}

function tickController(controller: PhysicsCharacterController, desired: Vector3): void {
  const current = controller.getVelocity();
  controller.setVelocity(new Vector3(desired.x, current.y, desired.z));
  const support = controller.checkSupport(FIXED_DT, GRAVITY);
  controller.integrate(FIXED_DT, support, GRAVITY);
}

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

  const navGround = MeshBuilder.CreateGround('nav-ground', { width: ARENA_WIDTH, height: ARENA_DEPTH }, scene);
  navGround.isVisible = false;
  await RecastCore.init();
  const navigation = await CreateNavigationPluginAsync({ instance: { ...RecastCore, ...RecastGenerators } });
  navigationName = navigation.name;
  navigation.createNavMesh([navGround], {
    cs: 0.25,
    ch: 0.25,
    walkableSlopeAngle: 45,
    walkableHeight: 2,
    walkableClimb: 0.4,
    walkableRadius: 0.4,
    maxEdgeLen: 12,
    maxSimplificationError: 1.3,
    minRegionArea: 8,
    mergeRegionArea: 20,
    maxVertsPerPoly: 6,
    detailSampleDist: 6,
    detailSampleMaxError: 1,
  });

  player = new PhysicsCharacterController(new Vector3(PLAYER_SPAWN.x, CENTER_Y, PLAYER_SPAWN.z), { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS }, scene);
  enemy = new PhysicsCharacterController(new Vector3(ENEMY_SPAWN.x, CENTER_Y, ENEMY_SPAWN.z), { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS }, scene);
  player.maxCharacterSpeedForSolver = 8;
  enemy.maxCharacterSpeedForSolver = 8;
  player.maxAcceleration = 50;
  enemy.maxAcceleration = 50;

  playerVisual = MeshBuilder.CreateCapsule('player', { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS }, scene);
  enemyVisual = MeshBuilder.CreateCapsule('enemy', { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS }, scene);
  const playerMaterial = new StandardMaterial('player-material', scene);
  playerMaterial.diffuseColor = new Color3(0.25, 0.55, 0.9);
  playerVisual.material = playerMaterial;
  const enemyMaterial = new StandardMaterial('enemy-material', scene);
  enemyMaterial.diffuseColor = new Color3(0.9, 0.25, 0.25);
  enemyVisual.material = enemyMaterial;

  initialDistance = horizontalDistance(player.getPosition(), enemy.getPosition());
  let accumulator = 0;
  let waypointIndex = 1;

  scene.onBeforeRenderObservable.add(() => {
    accumulator += Math.min(engine.getDeltaTime() / 1000, 0.25);
    while (accumulator >= FIXED_DT) {
      if (!player || !enemy) break;
      combatClock += FIXED_DT;
      tickController(player, new Vector3(0, 0, keys.has('KeyS') ? -PLAYER_SPEED : 0));
      if (releaseAnchorZ !== null) releaseDrift = Math.max(releaseDrift, Math.abs(player.getPosition().z - releaseAnchorZ));

      const separationBeforeChase = horizontalDistance(player.getPosition(), enemy.getPosition());
      if (!acquired) {
        if (separationBeforeChase > ACQUIRE_RANGE) {
          lastDistanceBeforeAcquire = separationBeforeChase;
        } else {
          acquired = true;
          acquisitionDistance = separationBeforeChase;
          const enemyGround = groundPosition(enemy, ENEMY_SPAWN);
          const playerGround = groundPosition(player, PLAYER_SPAWN);
          const start = navigation.getClosestPoint(enemyGround);
          const end = navigation.getClosestPoint(playerGround);
          pathPoints = navigation.computePath(start, end);
          pathLength = pathDistance(pathPoints);
          pathInsideArena = pathPoints.length >= 2 && pathPoints.every(insideArena);
          waypointIndex = Math.min(1, Math.max(0, pathPoints.length - 1));
        }
      }

      if (acquired && pathPoints.length >= 2) {
        const before = enemy.getPosition().clone();
        const current = enemy.getPosition();
        const currentSeparation = horizontalDistance(player.getPosition(), current);
        if (currentSeparation > ENEMY_ATTACK_RANGE) {
          const target = pathPoints[Math.min(waypointIndex, pathPoints.length - 1)]!;
          const dx = target.x - current.x;
          const dz = target.z - current.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 0.2 && waypointIndex < pathPoints.length - 1) waypointIndex += 1;
          const norm = distance > 1e-6 ? 1 / distance : 0;
          tickController(enemy, new Vector3(dx * norm * ENEMY_SPEED, 0, dz * norm * ENEMY_SPEED));
          maxEnemyStep = Math.max(maxEnemyStep, horizontalDistance(before, enemy.getPosition()));
          chaseSteps += 1;
        } else {
          tickController(enemy, Vector3.Zero());
        }

        const attackDistance = horizontalDistance(player.getPosition(), enemy.getPosition());
        if (attackDistance <= ENEMY_ATTACK_RANGE) {
          const sinceLastAttack = combatClock - lastEnemyAttackTime;
          if (sinceLastAttack + 1e-9 >= ENEMY_ATTACK_COOLDOWN) {
            playerHealth = Math.max(0, playerHealth - ENEMY_ATTACK_DAMAGE);
            enemyAttackCount += 1;
            lastEnemyAttackTime = combatClock;
            if (enemyAttackCount === 1) {
              firstAttackDistance = attackDistance;
              firstAttackTime = combatClock;
              healthAfterFirstAttack = playerHealth;
            } else if (enemyAttackCount === 2) {
              secondAttackTime = combatClock;
            }
          } else if (enemyAttackCount === 1) {
            cooldownBlockedSteps += 1;
          }
        }
      } else {
        tickController(enemy, Vector3.Zero());
      }

      simulationSteps += 1;
      accumulator -= FIXED_DT;
    }

    if (player && playerVisual) playerVisual.position.copyFrom(player.getPosition());
    if (enemy && enemyVisual) enemyVisual.position.copyFrom(enemy.getPosition());
  });

  const first = snapshot();
  try {
    (first.player_position as { z: number }).z = 9999;
  } catch {
    // Frozen observation copies reject mutation in module mode.
  }
  observationIsolation = snapshot().player_position.z !== 9999;

  ready = true;
  status.textContent = 'ready';
  engine.runRenderLoop(() => {
    renderFrames += 1;
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());
}

void main().catch((error: unknown) => {
  status.textContent = `error: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
  throw error;
});
