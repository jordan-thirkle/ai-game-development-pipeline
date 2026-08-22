import * as pc from 'playcanvas';

type Observation = Readonly<{
  ready: boolean;
  player: { x: number; z: number };
  distanceToSalvage: number;
  salvageHealth: number;
  salvageBroken: boolean;
  rewardCount: number;
  selectedUpgrades: string[];
  effectiveDamage: number;
  attackPresses: number;
  interactPresses: number;
  movementKeydowns: number;
  movementKeyups: number;
  attackDistance: number | null;
  pickupDistance: number | null;
  renderedFrames: number;
  observationMutationIsolation: boolean;
  directPositionMutationSurface: false;
  directSalvageHealthMutationSurface: false;
  directRewardMutationSurface: false;
  directUpgradeMutationSurface: false;
  testOnlyGameplayMutationShortcut: false;
  postPhysicsArenaClamp: false;
  failures: string[];
}>;

declare global {
  interface Window { __BYJTT_PROGRESSION__?: () => Observation }
}

const WALK_SPEED = 3.5;
const ATTACK_DAMAGE = 34;
const ATTACK_RANGE = 1.8;
const SALVAGE_HEALTH = 34;
const PICKUP_RADIUS = 1.25;
const UPGRADE_ID = 'damage-up-1';
const DAMAGE_MULTIPLIER = 1.2;

const canvas = document.querySelector<HTMLCanvasElement>('#app');
const status = document.querySelector<HTMLDivElement>('#status');
if (!canvas || !status) throw new Error('required DOM missing');

const app = new pc.Application(canvas, { graphicsDeviceOptions: { alpha: false, antialias: true } });
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const camera = new pc.Entity('camera');
camera.addComponent('camera', { clearColor: new pc.Color(0.04, 0.06, 0.09) });
camera.setLocalPosition(12, 18, 20);
camera.lookAt(2.5, 0, 4);
app.root.addChild(camera);

const light = new pc.Entity('light');
light.addComponent('light', { type: 'directional', intensity: 1.5 });
light.setLocalEulerAngles(45, 35, 0);
app.root.addChild(light);

const ground = new pc.Entity('arena');
ground.addComponent('render', { type: 'box' });
ground.setLocalScale(24, 0.1, 32);
ground.setLocalPosition(0, -0.05, 0);
app.root.addChild(ground);

const player = new pc.Entity('player');
player.addComponent('render', { type: 'capsule' });
player.setLocalScale(0.8, 1.8, 0.8);
player.setLocalPosition(0, 0.9, 10);
app.root.addChild(player);

const salvage = new pc.Entity('salvage');
salvage.addComponent('render', { type: 'box' });
salvage.setLocalPosition(5, 0.5, 0);
app.root.addChild(salvage);

const held = new Set<string>();
let attackEdge = false;
let interactEdge = false;
let salvageHealth = SALVAGE_HEALTH;
let salvageBroken = false;
let rewardCount = 0;
let selectedUpgrades: string[] = [];
let attackPresses = 0;
let interactPresses = 0;
let movementKeydowns = 0;
let movementKeyups = 0;
let attackDistance: number | null = null;
let pickupDistance: number | null = null;
let renderedFrames = 0;
const failures: string[] = [];

const distanceToSalvage = () => {
  const p = player.getPosition();
  const s = salvage.getPosition();
  return Math.hypot(p.x - s.x, p.z - s.z);
};

addEventListener('keydown', (event) => {
  if (event.repeat) return;
  held.add(event.code);
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) movementKeydowns++;
  if (event.code === 'Space') { attackPresses++; attackEdge = true; }
  if (event.code === 'KeyE') { interactPresses++; interactEdge = true; }
});
addEventListener('keyup', (event) => {
  held.delete(event.code);
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) movementKeyups++;
});
addEventListener('blur', () => held.clear());

function update(dt: number) {
  const dx = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  const dz = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0);
  if (dx !== 0 || dz !== 0) {
    const length = Math.hypot(dx, dz);
    const p = player.getPosition();
    player.setPosition(p.x + (dx / length) * WALK_SPEED * dt, p.y, p.z + (dz / length) * WALK_SPEED * dt);
  }

  const distance = distanceToSalvage();
  if (attackEdge) {
    attackEdge = false;
    if (!salvageBroken && distance <= ATTACK_RANGE) {
      attackDistance = distance;
      salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
      if (salvageHealth === 0) {
        salvageBroken = true;
        salvage.enabled = false;
      }
    }
  }

  if (salvageBroken && rewardCount === 0 && distance <= PICKUP_RADIUS) {
    pickupDistance = distance;
    rewardCount = 1;
  }

  if (interactEdge) {
    interactEdge = false;
    if (rewardCount === 1 && !selectedUpgrades.includes(UPGRADE_ID)) selectedUpgrades = [UPGRADE_ID];
  }
}

function snapshot(): Observation {
  const p = player.getPosition();
  return Object.freeze({
    ready: true,
    player: { x: p.x, z: p.z },
    distanceToSalvage: distanceToSalvage(),
    salvageHealth,
    salvageBroken,
    rewardCount,
    selectedUpgrades: [...selectedUpgrades],
    effectiveDamage: ATTACK_DAMAGE * (selectedUpgrades.includes(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1),
    attackPresses,
    interactPresses,
    movementKeydowns,
    movementKeyups,
    attackDistance,
    pickupDistance,
    renderedFrames,
    observationMutationIsolation: true,
    directPositionMutationSurface: false,
    directSalvageHealthMutationSurface: false,
    directRewardMutationSurface: false,
    directUpgradeMutationSurface: false,
    testOnlyGameplayMutationShortcut: false,
    postPhysicsArenaClamp: false,
    failures: [...failures],
  });
}

window.__BYJTT_PROGRESSION__ = snapshot;
app.on('update', (dt: number) => update(Math.min(dt, 1 / 30)));
app.on('frameend', () => {
  renderedFrames++;
  const o = snapshot();
  status.textContent = `salvage ${o.salvageHealth} reward ${o.rewardCount} upgrade ${o.selectedUpgrades.join(',') || 'none'}`;
});
app.start();
addEventListener('resize', () => app.resizeCanvas());
