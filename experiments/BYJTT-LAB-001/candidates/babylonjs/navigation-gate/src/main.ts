import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RecastJSPlugin } from '@babylonjs/core/Navigation/Plugins/recastJSPlugin';
import Recast from 'recast-detour';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const ENEMY_SPAWN = new Vector3(0, 0, -6);
const PLAYER_SPAWN = new Vector3(0, 0, 10);

interface Observation {
  ready: boolean;
  babylonVersion: string;
  recastPlugin: string;
  arena: { width: number; depth: number };
  pathPoints: Array<{ x: number; y: number; z: number }>;
  pathLength: number;
  startError: number;
  endError: number;
  pathInsideArena: boolean;
  observationIsolation: boolean;
  postNavigationClamp: boolean;
  externalInputExecuted: boolean;
  combatExecuted: boolean;
}

declare global {
  interface Window {
    __BYJTT_OBSERVE__?: () => Readonly<Observation>;
  }
}

function distance(a: Vector3, b: Vector3): number {
  return Vector3.Distance(a, b);
}

function cloneObservation(value: Observation): Readonly<Observation> {
  return Object.freeze({
    ...value,
    arena: Object.freeze({ ...value.arena }),
    pathPoints: Object.freeze(value.pathPoints.map((point) => Object.freeze({ ...point }))) as unknown as Observation['pathPoints'],
  });
}

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
  if (!canvas) throw new Error('renderCanvas missing');

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  const camera = new FreeCamera('camera', new Vector3(0, 22, -22), scene);
  camera.setTarget(new Vector3(0, 0, 2));
  new HemisphericLight('light', new Vector3(0, 1, 0), scene);

  const arena = MeshBuilder.CreateGround('arena', { width: ARENA_WIDTH, height: ARENA_DEPTH }, scene);
  const material = new StandardMaterial('arenaMaterial', scene);
  material.diffuseColor = new Color3(0.18, 0.32, 0.2);
  arena.material = material;

  const recast = await Recast();
  const navigation = new RecastJSPlugin(recast);
  navigation.createNavMesh([arena], {
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

  const start = navigation.getClosestPoint(ENEMY_SPAWN);
  const end = navigation.getClosestPoint(PLAYER_SPAWN);
  const path = navigation.computePath(start, end);
  const pathLength = path.slice(1).reduce((sum, point, index) => sum + distance(path[index]!, point), 0);
  const pathInsideArena = path.every((point) => Math.abs(point.x) <= ARENA_WIDTH / 2 + 0.001 && Math.abs(point.z) <= ARENA_DEPTH / 2 + 0.001);

  const observation: Observation = {
    ready: true,
    babylonVersion: Engine.Version,
    recastPlugin: navigation.name,
    arena: { width: ARENA_WIDTH, depth: ARENA_DEPTH },
    pathPoints: path.map((point) => ({ x: point.x, y: point.y, z: point.z })),
    pathLength,
    startError: distance(start, ENEMY_SPAWN),
    endError: distance(end, PLAYER_SPAWN),
    pathInsideArena,
    observationIsolation: false,
    postNavigationClamp: false,
    externalInputExecuted: false,
    combatExecuted: false,
  };

  window.__BYJTT_OBSERVE__ = () => cloneObservation(observation);
  const probe = window.__BYJTT_OBSERVE__();
  try {
    (probe.pathPoints[0] as { x: number }).x = 9999;
  } catch {
    // Frozen observations are expected to reject mutation in strict/module mode.
  }
  observation.observationIsolation = path.length > 0 && path[0]!.x !== 9999;

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
}

void main().catch((error: unknown) => {
  console.error(error);
  throw error;
});
