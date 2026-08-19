import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Physics/joinedPhysicsEngineComponent';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import HavokPhysics from '@babylonjs/havok';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const startedAt = performance.now();

const state = {
  ready: false,
  backend: 'initializing',
  webgpuSupported: false,
  havokReady: false,
  havokPluginVersion: null,
  startupMs: null,
  renderFrames: 0,
  errors: [],
};

function snapshot() {
  return Object.freeze({
    'runtime.ready': state.ready,
    'renderer.backend': state.backend,
    'renderer.webgpu_supported': state.webgpuSupported,
    'physics.havok_ready': state.havokReady,
    'physics.plugin_version': state.havokPluginVersion,
    'startup.ms': state.startupMs,
    'render.frames': state.renderFrames,
    'runtime.errors': [...state.errors],
  });
}

Object.defineProperty(window, '__BYJTT_BENCHMARK__', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ snapshot }),
});

async function createEngine() {
  state.webgpuSupported = Boolean(await WebGPUEngine.IsSupportedAsync);
  if (state.webgpuSupported) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await engine.initAsync();
      state.backend = 'webgpu';
      return engine;
    } catch (error) {
      state.errors.push(`webgpu-init: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  state.backend = 'webgl2-fallback';
  return new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
}

async function createScene(engine) {
  const scene = new Scene(engine);
  scene.clearColor.set(0.055, 0.06, 0.07, 1);

  const camera = new UniversalCamera('camera', new Vector3(0, 7, -12), scene);
  camera.setTarget(new Vector3(0, 1, 0));
  camera.attachControl(canvas, true);

  const light = new HemisphericLight('hemi', new Vector3(0.2, 1, -0.2), scene);
  light.intensity = 1.1;

  const ground = MeshBuilder.CreateGround('ground', { width: 18, height: 18 }, scene);
  const groundMaterial = new StandardMaterial('ground-material', scene);
  groundMaterial.diffuseColor = new Color3(0.18, 0.2, 0.22);
  ground.material = groundMaterial;

  const player = MeshBuilder.CreateCapsule('player', { height: 2, radius: 0.45 }, scene);
  player.position = new Vector3(-3, 1, 0);
  const playerMaterial = new StandardMaterial('player-material', scene);
  playerMaterial.diffuseColor = new Color3(0.25, 0.55, 0.9);
  player.material = playerMaterial;

  const enemy = MeshBuilder.CreateCapsule('enemy', { height: 2, radius: 0.45 }, scene);
  enemy.position = new Vector3(3, 1, 1.5);
  const enemyMaterial = new StandardMaterial('enemy-material', scene);
  enemyMaterial.diffuseColor = new Color3(0.8, 0.25, 0.2);
  enemy.material = enemyMaterial;

  const salvage = MeshBuilder.CreateBox('salvage', { size: 1.2 }, scene);
  salvage.position = new Vector3(5, 0.6, 0);
  const salvageMaterial = new StandardMaterial('salvage-material', scene);
  salvageMaterial.diffuseColor = new Color3(0.75, 0.55, 0.18);
  salvage.material = salvageMaterial;

  const havok = await HavokPhysics();
  const physics = new HavokPlugin(true, havok);
  const physicsEnabled = scene.enablePhysics(new Vector3(0, -9.81, 0), physics);
  if (!physicsEnabled) throw new Error('Babylon scene.enablePhysics returned false');
  state.havokReady = true;
  state.havokPluginVersion = physics.getPluginVersion();

  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
  new PhysicsAggregate(player, PhysicsShapeType.CAPSULE, { mass: 1, friction: 0.3 }, scene);
  new PhysicsAggregate(enemy, PhysicsShapeType.CAPSULE, { mass: 1, friction: 0.3 }, scene);
  new PhysicsAggregate(salvage, PhysicsShapeType.BOX, { mass: 0 }, scene);

  return scene;
}

try {
  const engine = await createEngine();
  const scene = await createScene(engine);

  state.ready = true;
  state.startupMs = Math.round((performance.now() - startedAt) * 100) / 100;
  status.textContent = `${state.backend} · Havok v${state.havokPluginVersion} · ${state.startupMs} ms startup`;

  engine.runRenderLoop(() => {
    state.renderFrames += 1;
    scene.render();
  });

  window.addEventListener('resize', () => engine.resize());
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  state.errors.push(message);
  status.textContent = `Initialization failed: ${message}`;
  console.error(error);
}
