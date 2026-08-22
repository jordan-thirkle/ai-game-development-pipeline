import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

type Observation = Readonly<{
  ready: boolean;
  player: { x: number; z: number };
  salvageHealth: number;
  salvageBroken: boolean;
  rewardCount: number;
  selectedUpgrades: string[];
  effectiveDamage: number;
  attackPresses: number;
  interactPresses: number;
  attackExecuted: boolean;
  interactExecuted: boolean;
  pickupDistance: number | null;
  attackDistance: number | null;
  renderedFrames: number;
  failures: string[];
}>;

declare global { interface Window { __BYJTT_PROGRESS__?: () => Observation } }

const ARENA_HALF_X = 12;
const ARENA_HALF_Z = 16;
const WALK_SPEED = 3.5;
const ATTACK_DAMAGE = 34;
const ATTACK_RANGE = 1.8;
const SALVAGE_HEALTH = 34;
const PICKUP_RADIUS = 1.25;
const REWARD_COUNT = 1;
const UPGRADE_ID = 'damage-up-1';
const DAMAGE_MULTIPLIER = 1.2;

const canvas = document.querySelector<HTMLCanvasElement>('#app');
const status = document.querySelector<HTMLDivElement>('#status');
if (!canvas || !status) throw new Error('required DOM missing');

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.035, 0.045, 0.06, 1);
new HemisphericLight('light', new Vector3(0, 1, 0), scene).intensity = 1.2;
const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.0, 24, new Vector3(2.5, 0, 4), scene);
camera.attachControl(canvas, false);

const ground = MeshBuilder.CreateGround('arena', { width: 24, height: 32 }, scene);
const groundMat = new StandardMaterial('groundMat', scene); groundMat.diffuseColor = new Color3(0.16, 0.2, 0.17); ground.material = groundMat;
const player = MeshBuilder.CreateCapsule('player', { height: 1.8, radius: 0.4 }, scene); player.position.set(0, 0.9, 10);
const playerMat = new StandardMaterial('playerMat', scene); playerMat.diffuseColor = new Color3(0.2, 0.55, 0.95); player.material = playerMat;
const salvage = MeshBuilder.CreateBox('salvage', { size: 1 }, scene); salvage.position.set(5, 0.5, 0);
const salvageMat = new StandardMaterial('salvageMat', scene); salvageMat.diffuseColor = new Color3(0.8, 0.45, 0.15); salvage.material = salvageMat;

const held = new Set<string>();
let attackEdge = false;
let interactEdge = false;
let salvageHealth = SALVAGE_HEALTH;
let salvageBroken = false;
let rewardCount = 0;
let selectedUpgrades: string[] = [];
let attackPresses = 0;
let interactPresses = 0;
let attackExecuted = false;
let interactExecuted = false;
let pickupDistance: number | null = null;
let attackDistance: number | null = null;
let renderedFrames = 0;
const failures: string[] = [];

const gameDistance = () => Math.hypot(player.position.x - salvage.position.x, player.position.z - salvage.position.z);

addEventListener('keydown', (event) => {
  if (event.repeat) return;
  held.add(event.code);
  if (event.code === 'Space') { attackPresses++; attackEdge = true; }
  if (event.code === 'KeyE') { interactPresses++; interactEdge = true; }
});
addEventListener('keyup', (event) => held.delete(event.code));
addEventListener('blur', () => held.clear());

function update(dt: number) {
  const move = new Vector3(
    (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
    0,
    (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0),
  );
  if (move.lengthSquared() > 0) {
    move.normalize().scaleInPlace(WALK_SPEED * dt);
    player.position.addInPlace(move);
    player.position.x = Math.max(-ARENA_HALF_X + 0.4, Math.min(ARENA_HALF_X - 0.4, player.position.x));
    player.position.z = Math.max(-ARENA_HALF_Z + 0.4, Math.min(ARENA_HALF_Z - 0.4, player.position.z));
  }

  const distance = gameDistance();
  if (attackEdge) {
    attackEdge = false;
    if (!salvageBroken && distance <= ATTACK_RANGE) {
      attackExecuted = true;
      attackDistance = distance;
      salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
      if (salvageHealth === 0) { salvageBroken = true; salvage.setEnabled(false); }
    }
  }

  if (salvageBroken && rewardCount === 0 && distance <= PICKUP_RADIUS) {
    rewardCount = REWARD_COUNT;
    pickupDistance = distance;
  }

  if (interactEdge) {
    interactEdge = false;
    if (rewardCount === 1 && !selectedUpgrades.includes(UPGRADE_ID)) {
      interactExecuted = true;
      selectedUpgrades = [UPGRADE_ID];
    }
  }
}

function observe(): Observation {
  const snapshot = {
    ready: true,
    player: { x: player.position.x, z: player.position.z },
    salvageHealth,
    salvageBroken,
    rewardCount,
    selectedUpgrades: [...selectedUpgrades],
    effectiveDamage: ATTACK_DAMAGE * (selectedUpgrades.includes(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1),
    attackPresses,
    interactPresses,
    attackExecuted,
    interactExecuted,
    pickupDistance,
    attackDistance,
    renderedFrames,
    failures: [...failures],
  };
  return Object.freeze(snapshot);
}
window.__BYJTT_PROGRESS__ = observe;

engine.runRenderLoop(() => {
  update(Math.min(engine.getDeltaTime() / 1000, 1 / 30));
  scene.render(); renderedFrames++;
  const o = observe(); status.textContent = `salvage ${o.salvageHealth} reward ${o.rewardCount} upgrade ${o.selectedUpgrades.join(',') || 'none'}`;
});
addEventListener('resize', () => engine.resize());
