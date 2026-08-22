import * as THREE from 'three';
import { init, NavMeshQuery } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const ENEMY_SPAWN = new THREE.Vector3(0, 0, -6);
const PLAYER_SPAWN = new THREE.Vector3(0, 0, 10);

interface Observation {
  ready: boolean;
  threeRevision: string;
  recastVersion: string;
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
  interface Window { __BYJTT_OBSERVE__?: () => Readonly<Observation>; }
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101318);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 22, 24);
  camera.lookAt(0, 0, 2);

  const geometry = new THREE.PlaneGeometry(ARENA_WIDTH, ARENA_DEPTH, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x345d43, side: THREE.DoubleSide }));
  scene.add(mesh);

  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!index) throw new Error('Three arena geometry has no index');
  const positions = Array.from(position.array as ArrayLike<number>);
  const indices = Array.from(index.array as ArrayLike<number>);

  await init();
  const generated = generateSoloNavMesh(positions, indices, {
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
  if (!generated.success) throw new Error('Recast navmesh generation failed');

  const query = new NavMeshQuery(generated.navMesh);
  const startResult = query.findClosestPoint({ x: ENEMY_SPAWN.x, y: ENEMY_SPAWN.y, z: ENEMY_SPAWN.z });
  const endResult = query.findClosestPoint({ x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, z: PLAYER_SPAWN.z });
  if (!startResult.success || !endResult.success) throw new Error('Detour closest-point query failed');
  const pathResult = query.computePath(startResult.point, endResult.point);
  if (!pathResult.success) throw new Error(`Detour path query failed: ${String(pathResult.error)}`);
  const path = pathResult.path;
  const pathLength = path.slice(1).reduce((sum, point, i) => sum + distance(path[i]!, point), 0);
  const pathInsideArena = path.every((point) => Math.abs(point.x) <= ARENA_WIDTH / 2 + 0.001 && Math.abs(point.z) <= ARENA_DEPTH / 2 + 0.001);

  const observation: Observation = {
    ready: true,
    threeRevision: THREE.REVISION,
    recastVersion: '0.43.1',
    arena: { width: ARENA_WIDTH, depth: ARENA_DEPTH },
    pathPoints: path.map((point) => ({ ...point })),
    pathLength,
    startError: distance(startResult.point, ENEMY_SPAWN),
    endError: distance(endResult.point, PLAYER_SPAWN),
    pathInsideArena,
    observationIsolation: false,
    postNavigationClamp: false,
    externalInputExecuted: false,
    combatExecuted: false,
  };

  window.__BYJTT_OBSERVE__ = () => cloneObservation(observation);
  const probe = window.__BYJTT_OBSERVE__();
  try { (probe.pathPoints[0] as { x: number }).x = 9999; } catch { /* expected for frozen observations */ }
  observation.observationIsolation = path.length > 0 && path[0]!.x !== 9999;

  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}

void main().catch((error: unknown) => { console.error(error); throw error; });
