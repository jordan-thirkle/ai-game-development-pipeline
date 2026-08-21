import * as pc from 'playcanvas';
import { init, NavMeshQuery } from 'recast-navigation';
import { pcToSoloNavMesh, NavMeshHelper } from '@recast-navigation/playcanvas';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPAWN = { x: 0, y: 0, z: 10 } as const;
const ENEMY_SPAWN = { x: 0, y: 0, z: -6 } as const;
const AGENT_RADIUS = 0.4;

interface PathPoint {
  x: number;
  y: number;
  z: number;
}

interface NavigationObservation {
  ready: boolean;
  backend: string;
  playcanvasVersion: string;
  recastVersion: string;
  arena: { width: number; depth: number };
  start: PathPoint;
  end: PathPoint;
  path: PathPoint[];
  pathLength: number;
  navMeshGenerated: boolean;
  pathFound: boolean;
  pointsInsideArena: boolean;
  postNavigationClamp: false;
  externalInputExecuted: false;
}

declare global {
  interface Window {
    __BYJTT_NAV_OBSERVE__?: () => Readonly<NavigationObservation>;
  }
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function pathLength(points: readonly PathPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

function insideArena(point: PathPoint): boolean {
  const epsilon = 0.001;
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z) &&
    point.x >= -ARENA_WIDTH / 2 - epsilon &&
    point.x <= ARENA_WIDTH / 2 + epsilon &&
    point.z >= -ARENA_DEPTH / 2 - epsilon &&
    point.z <= ARENA_DEPTH / 2 + epsilon
  );
}

const canvas = required<HTMLCanvasElement>('#application');
const status = required<HTMLElement>('#status');
const graphicsDevice = await pc.createGraphicsDevice(canvas, {
  deviceTypes: [pc.DEVICETYPE_WEBGL2],
  antialias: true
});
const app = new pc.Application(canvas, { graphicsDevice });
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.start();
app.scene.ambientLight = new pc.Color(0.28, 0.3, 0.33);

const floor = new pc.Entity('Navigation floor');
floor.addComponent('render', { type: 'plane' });
floor.setLocalScale(ARENA_WIDTH, 1, ARENA_DEPTH);
app.root.addChild(floor);
const floorMaterial = new pc.StandardMaterial();
floorMaterial.diffuse = new pc.Color(0.18, 0.24, 0.2);
floorMaterial.update();
floor.render?.meshInstances.forEach((meshInstance) => {
  meshInstance.material = floorMaterial;
});

const camera = new pc.Entity('Camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.035, 0.055, 0.075),
  farClip: 80,
  fov: 55
});
camera.setPosition(15, 20, 24);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

const light = new pc.Entity('Key light');
light.addComponent('light', {
  type: 'directional',
  color: new pc.Color(1, 0.96, 0.9),
  intensity: 1.5
});
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

await init();

const meshInstances = floor.render?.meshInstances ?? [];
if (meshInstances.length === 0) throw new Error('PlayCanvas floor did not expose mesh instances');

const generation = pcToSoloNavMesh(meshInstances, {
  cs: 0.2,
  ch: 0.1,
  walkableSlopeAngle: 45,
  walkableHeight: 18,
  walkableClimb: 4,
  walkableRadius: Math.ceil(AGENT_RADIUS / 0.2),
  maxEdgeLen: 60,
  maxSimplificationError: 1.3,
  minRegionArea: 8,
  mergeRegionArea: 20,
  maxVertsPerPoly: 6,
  detailSampleDist: 6,
  detailSampleMaxError: 1
});

if (!generation.success || !generation.navMesh) {
  throw new Error('Recast failed to generate a navmesh from PlayCanvas arena geometry');
}

const helper = new NavMeshHelper(generation.navMesh, graphicsDevice);
app.root.addChild(helper);

const query = new NavMeshQuery(generation.navMesh);
const computed = query.computePath(ENEMY_SPAWN, PLAYER_SPAWN, {
  halfExtents: { x: 1, y: 2, z: 1 },
  maxPathPolys: 64,
  maxStraightPathPoints: 64
});

if (!computed.success || computed.path.length < 2) {
  throw new Error(`Recast failed to compute benchmark path: ${computed.error?.name ?? 'unknown error'}`);
}

const path = computed.path.map((point) => ({ x: point.x, y: point.y, z: point.z }));
const length = pathLength(path);
const pointsInsideArena = path.every(insideArena);
if (!pointsInsideArena) throw new Error('Computed path escaped the shared arena bounds');
if (!Number.isFinite(length) || length < 15 || length > 24) {
  throw new Error(`Unexpected path length ${length}`);
}

for (const [index, point] of path.entries()) {
  const marker = new pc.Entity(`Path point ${index}`);
  marker.addComponent('render', { type: 'sphere' });
  marker.setLocalScale(0.25, 0.25, 0.25);
  marker.setPosition(point.x, point.y + 0.15, point.z);
  app.root.addChild(marker);
}

const authoritative: NavigationObservation = {
  ready: true,
  backend: graphicsDevice.deviceType,
  playcanvasVersion: '2.21.3',
  recastVersion: '0.43.1',
  arena: { width: ARENA_WIDTH, depth: ARENA_DEPTH },
  start: { ...ENEMY_SPAWN },
  end: { ...PLAYER_SPAWN },
  path,
  pathLength: length,
  navMeshGenerated: true,
  pathFound: true,
  pointsInsideArena,
  postNavigationClamp: false,
  externalInputExecuted: false
};

window.__BYJTT_NAV_OBSERVE__ = () => Object.freeze(structuredClone(authoritative));
status.textContent = `ready · ${graphicsDevice.deviceType} · ${path.length} path points · ${length.toFixed(3)} m`;
