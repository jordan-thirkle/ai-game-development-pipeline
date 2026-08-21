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
const LOGICAL_SPAWN = Object.freeze({ x: 0, y: 0, z: 10 });
const WALK_SPEED = 3.5;
const FIXED_DT = 1 / 60;
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;
const PHYSICS_CENTER_Y = CAPSULE_HEIGHT / 2;
const EAST_WALL_INNER_X = ARENA_WIDTH / 2;
const EXPECTED_EAST_CENTER_X = EAST_WALL_INNER_X - CAPSULE_RADIUS;
const GRAVITY = new Vector3(0, -9.81, 0);

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const status = document.querySelector<HTMLDivElement>('#status');
if (!canvas || !status) throw new Error('required DOM nodes missing');

const keys = new Set<string>();
let keyDownCallbacks = 0;
let keyUpCallbacks = 0;
let ready = false;
let renderFrames = 0;
let simulationSteps = 0;
let maxX = LOGICAL_SPAWN.x;
let havokPluginVersion: number | null = null;
let controller: PhysicsCharacterController | null = null;
let playerVisual: ReturnType<typeof MeshBuilder.CreateCapsule> | null = null;

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyD') {
    keys.add(event.code);
    keyDownCallbacks += 1;
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'KeyD') {
    keys.delete(event.code);
    keyUpCallbacks += 1;
  }
});
window.addEventListener('blur', () => keys.clear());

function snapshot() {
  const position = controller?.getPosition() ?? new Vector3(LOGICAL_SPAWN.x, PHYSICS_CENTER_Y, LOGICAL_SPAWN.z);
  const velocity = controller?.getVelocity() ?? Vector3.Zero();
  return {
    ready,
    controller: 'PhysicsCharacterController',
    position: { x: position.x, y: position.y, z: position.z },
    logical_ground_position: { x: position.x, y: position.y - PHYSICS_CENTER_Y, z: position.z },
    velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
    logical_spawn: { ...LOGICAL_SPAWN },
    arena: { width: ARENA_WIDTH, depth: ARENA_DEPTH },
    walk_speed: WALK_SPEED,
    fixed_dt: FIXED_DT,
    capsule: { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS },
    expected_east_center_x: EXPECTED_EAST_CENTER_X,
    max_x: maxX,
    key_down_callbacks: keyDownCallbacks,
    key_up_callbacks: keyUpCallbacks,
    render_frames: renderFrames,
    simulation_steps: simulationSteps,
    havok_plugin_version: havokPluginVersion,
    post_physics_arena_clamp: false,
    external_input_executed: keyDownCallbacks > 0 && keyUpCallbacks > 0,
  };
}

Object.defineProperty(window, '__BYJTT_BABYLON_CC__', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ snapshot }),
});

declare global {
  interface Window {
    __BYJTT_BABYLON_CC__: { snapshot: typeof snapshot };
  }
}

function addStaticBox(scene: Scene, name: string, size: { width: number; height: number; depth: number }, position: Vector3) {
  const mesh = MeshBuilder.CreateBox(name, size, scene);
  mesh.position.copyFrom(position);
  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = new Color3(0.18, 0.2, 0.23);
  mesh.material = material;
  new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
  return mesh;
}

async function main() {
  const engine = new Engine(canvas, true, { stencil: true });
  const scene = new Scene(engine);
  const light = new HemisphericLight('light', new Vector3(0.2, 1, -0.2), scene);
  light.intensity = 1.1;
  const camera = new UniversalCamera('camera', new Vector3(0, 7, 19), scene);
  camera.setTarget(new Vector3(0, 1, 6));

  const havok = await HavokPhysics();
  const plugin = new HavokPlugin(true, havok);
  if (!scene.enablePhysics(GRAVITY, plugin)) throw new Error('scene.enablePhysics returned false');
  havokPluginVersion = plugin.getPluginVersion();

  const wallThickness = 1;
  addStaticBox(scene, 'floor', { width: ARENA_WIDTH, height: 1, depth: ARENA_DEPTH }, new Vector3(0, -0.5, 0));
  addStaticBox(scene, 'east-wall', { width: wallThickness, height: 4, depth: ARENA_DEPTH }, new Vector3(EAST_WALL_INNER_X + wallThickness / 2, 2, 0));
  addStaticBox(scene, 'west-wall', { width: wallThickness, height: 4, depth: ARENA_DEPTH }, new Vector3(-EAST_WALL_INNER_X - wallThickness / 2, 2, 0));
  addStaticBox(scene, 'north-wall', { width: ARENA_WIDTH, height: 4, depth: wallThickness }, new Vector3(0, 2, -ARENA_DEPTH / 2 - wallThickness / 2));
  addStaticBox(scene, 'south-wall', { width: ARENA_WIDTH, height: 4, depth: wallThickness }, new Vector3(0, 2, ARENA_DEPTH / 2 + wallThickness / 2));

  controller = new PhysicsCharacterController(
    new Vector3(LOGICAL_SPAWN.x, PHYSICS_CENTER_Y, LOGICAL_SPAWN.z),
    { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
    scene,
  );
  controller.maxCharacterSpeedForSolver = 8;
  controller.maxAcceleration = 50;

  playerVisual = MeshBuilder.CreateCapsule('player-visual', { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS }, scene);
  const playerMaterial = new StandardMaterial('player-material', scene);
  playerMaterial.diffuseColor = new Color3(0.25, 0.55, 0.9);
  playerVisual.material = playerMaterial;

  let accumulator = 0;
  scene.onBeforeRenderObservable.add(() => {
    accumulator += Math.min(engine.getDeltaTime() / 1000, 0.25);
    while (accumulator >= FIXED_DT) {
      if (!controller) break;
      const currentVelocity = controller.getVelocity();
      const desiredX = keys.has('KeyD') ? WALK_SPEED : 0;
      controller.setVelocity(new Vector3(desiredX, currentVelocity.y, 0));
      const support = controller.checkSupport(FIXED_DT, GRAVITY);
      controller.integrate(FIXED_DT, support, GRAVITY);
      simulationSteps += 1;
      maxX = Math.max(maxX, controller.getPosition().x);
      accumulator -= FIXED_DT;
    }
    if (controller && playerVisual) playerVisual.position.copyFrom(controller.getPosition());
  });

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
});
