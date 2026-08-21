import * as pc from 'playcanvas';
import { init, NavMeshQuery } from 'recast-navigation';
import { pcToSoloNavMesh } from '@recast-navigation/playcanvas';

const ARENA_WIDTH = 24;
const ARENA_DEPTH = 32;
const PLAYER_SPAWN = { x: 0, y: 0, z: 10 } as const;
const ENEMY_SPAWN = { x: 0, y: 0, z: -6 } as const;
const PLAYER_SPEED = 3.5;
const PLAYER_ACCEL = 18;
const PLAYER_DECEL = 22;
const ENEMY_SPEED = 2.7;
const ACQUISITION_RANGE = 12;
const FIXED_DT = 1 / 60;
const PROOF_CHASE_STEPS = 180;
const AGENT_RADIUS = 0.4;

interface Point { x: number; y: number; z: number }
interface ChaseObservation {
  ready: boolean;
  playcanvasVersion: string;
  recastVersion: string;
  arena: { width: number; depth: number };
  playerSpawn: Point;
  enemySpawn: Point;
  playerPosition: Point;
  enemyPosition: Point;
  initialSeparation: number;
  acquired: boolean;
  acquisitionSeparation: number | null;
  playerDistanceAtAcquisition: number | null;
  pathFound: boolean;
  path: Point[];
  chaseSteps: number;
  separationAtProofStep: number | null;
  distanceReductionAtProofStep: number | null;
  maxEnemyStepDistance: number;
  maxPlayerSpeed: number;
  keyDownCount: number;
  keyUpCount: number;
  pointsInsideArena: boolean;
  postNavigationClamp: false;
  postPhysicsArenaClamp: false;
}

declare global { interface Window { __BYJTT_CHASE_OBSERVE__?: () => Readonly<ChaseObservation> } }

function required<T extends Element>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing required element: ${selector}`);
  return value;
}
function distance(a: Point, b: Point): number { return Math.hypot(b.x - a.x, b.z - a.z); }
function insideArena(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) &&
    p.x >= -ARENA_WIDTH / 2 - 0.001 && p.x <= ARENA_WIDTH / 2 + 0.001 &&
    p.z >= -ARENA_DEPTH / 2 - 0.001 && p.z <= ARENA_DEPTH / 2 + 0.001;
}
function approach(current: number, target: number, delta: number): number {
  if (current < target) return Math.min(current + delta, target);
  if (current > target) return Math.max(current - delta, target);
  return target;
}
function pointFromVec(v: pc.Vec3): Point { return { x: v.x, y: v.y, z: v.z }; }

const canvas = required<HTMLCanvasElement>('#application');
const status = required<HTMLElement>('#status');
const graphicsDevice = await pc.createGraphicsDevice(canvas, { deviceTypes: [pc.DEVICETYPE_WEBGL2], antialias: true });
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
floor.render?.meshInstances.forEach((mi) => { mi.material = floorMaterial; });

function actor(name: string, point: Point, color: pc.Color): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type: 'capsule' });
  entity.setLocalScale(0.8, 1.8, 0.8);
  entity.setPosition(point.x, 0.9, point.z);
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.update();
  entity.render?.meshInstances.forEach((mi) => { mi.material = material; });
  app.root.addChild(entity);
  return entity;
}
const player = actor('Player', PLAYER_SPAWN, new pc.Color(0.3, 0.7, 1));
const enemy = actor('Enemy', ENEMY_SPAWN, new pc.Color(0.9, 0.25, 0.2));

const camera = new pc.Entity('Camera');
camera.addComponent('camera', { clearColor: new pc.Color(0.035, 0.055, 0.075), farClip: 80, fov: 55 });
camera.setPosition(15, 20, 24);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);
const light = new pc.Entity('Key light');
light.addComponent('light', { type: 'directional', intensity: 1.5 });
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

await init();
const meshInstances = floor.render?.meshInstances ?? [];
if (meshInstances.length === 0) throw new Error('PlayCanvas floor did not expose mesh instances');
const generated = pcToSoloNavMesh([...meshInstances], {
  cs: 0.2, ch: 0.1, walkableSlopeAngle: 45, walkableHeight: 18, walkableClimb: 4,
  walkableRadius: Math.ceil(AGENT_RADIUS / 0.2), maxEdgeLen: 60, maxSimplificationError: 1.3,
  minRegionArea: 8, mergeRegionArea: 20, maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1
});
if (!generated.success || !generated.navMesh) throw new Error('Recast failed to generate arena navmesh');
const query = new NavMeshQuery(generated.navMesh);

const keys = new Set<string>();
let keyDownCount = 0;
let keyUpCount = 0;
window.addEventListener('keydown', (event) => { if (event.code === 'KeyS') { keys.add(event.code); keyDownCount += 1; } });
window.addEventListener('keyup', (event) => { if (event.code === 'KeyS') { keys.delete(event.code); keyUpCount += 1; } });
window.addEventListener('blur', () => keys.clear());

let playerVelocityZ = 0;
let maxPlayerSpeed = 0;
let acquired = false;
let acquisitionSeparation: number | null = null;
let playerDistanceAtAcquisition: number | null = null;
let path: Point[] = [];
let pathIndex = 1;
let chaseSteps = 0;
let maxEnemyStepDistance = 0;
let separationAtProofStep: number | null = null;
let distanceReductionAtProofStep: number | null = null;
let accumulator = 0;
const initialSeparation = distance(PLAYER_SPAWN, ENEMY_SPAWN);

function fixedStep(): void {
  const input = keys.has('KeyS') ? -PLAYER_SPEED : 0;
  const rate = input === 0 ? PLAYER_DECEL : PLAYER_ACCEL;
  playerVelocityZ = approach(playerVelocityZ, input, rate * FIXED_DT);
  maxPlayerSpeed = Math.max(maxPlayerSpeed, Math.abs(playerVelocityZ));
  const pp = player.getPosition();
  player.setPosition(pp.x, pp.y, pp.z + playerVelocityZ * FIXED_DT);

  const playerPoint = pointFromVec(player.getPosition());
  const enemyPoint = pointFromVec(enemy.getPosition());
  const separation = distance(playerPoint, enemyPoint);
  if (!acquired && separation <= ACQUISITION_RANGE) {
    const computed = query.computePath(enemyPoint, playerPoint, { halfExtents: { x: 1, y: 2, z: 1 }, maxPathPolys: 64, maxStraightPathPoints: 64 });
    if (!computed.success || computed.path.length < 2) throw new Error(`Detour path acquisition failed: ${computed.error?.name ?? 'unknown'}`);
    path = computed.path.map((p) => ({ x: p.x, y: p.y, z: p.z }));
    if (!path.every(insideArena)) throw new Error('Acquired path escaped arena');
    acquired = true;
    acquisitionSeparation = separation;
    playerDistanceAtAcquisition = distance(PLAYER_SPAWN, playerPoint);
  }

  if (acquired && pathIndex < path.length) {
    const current = pointFromVec(enemy.getPosition());
    const target = path[pathIndex]!;
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const remaining = Math.hypot(dx, dz);
    const stepDistance = Math.min(ENEMY_SPEED * FIXED_DT, remaining);
    if (remaining > 1e-6) enemy.setPosition(current.x + dx / remaining * stepDistance, current.y, current.z + dz / remaining * stepDistance);
    maxEnemyStepDistance = Math.max(maxEnemyStepDistance, stepDistance);
    chaseSteps += 1;
    if (remaining <= ENEMY_SPEED * FIXED_DT + 1e-6) pathIndex += 1;
    if (chaseSteps === PROOF_CHASE_STEPS) {
      separationAtProofStep = distance(pointFromVec(player.getPosition()), pointFromVec(enemy.getPosition()));
      distanceReductionAtProofStep = (acquisitionSeparation ?? separationAtProofStep) - separationAtProofStep;
    }
  }
}

app.on('update', (dt: number) => {
  accumulator = Math.min(accumulator + dt, 0.25);
  while (accumulator >= FIXED_DT) { fixedStep(); accumulator -= FIXED_DT; }
  const obs = window.__BYJTT_CHASE_OBSERVE__?.();
  if (obs) status.textContent = `${acquired ? 'acquired' : 'seeking'} · separation ${distance(obs.playerPosition, obs.enemyPosition).toFixed(3)} m · chase ${chaseSteps}`;
});

window.__BYJTT_CHASE_OBSERVE__ = () => {
  const playerPosition = pointFromVec(player.getPosition());
  const enemyPosition = pointFromVec(enemy.getPosition());
  const observation: ChaseObservation = {
    ready: true, playcanvasVersion: '2.21.3', recastVersion: '0.43.1', arena: { width: ARENA_WIDTH, depth: ARENA_DEPTH },
    playerSpawn: { ...PLAYER_SPAWN }, enemySpawn: { ...ENEMY_SPAWN }, playerPosition, enemyPosition, initialSeparation,
    acquired, acquisitionSeparation, playerDistanceAtAcquisition, pathFound: path.length >= 2, path: path.map((p) => ({ ...p })),
    chaseSteps, separationAtProofStep, distanceReductionAtProofStep, maxEnemyStepDistance, maxPlayerSpeed, keyDownCount, keyUpCount,
    pointsInsideArena: insideArena(playerPosition) && insideArena(enemyPosition) && path.every(insideArena),
    postNavigationClamp: false, postPhysicsArenaClamp: false
  };
  return Object.freeze(structuredClone(observation));
};
status.textContent = `ready · ${graphicsDevice.deviceType} · waiting for normal KeyS input`;
