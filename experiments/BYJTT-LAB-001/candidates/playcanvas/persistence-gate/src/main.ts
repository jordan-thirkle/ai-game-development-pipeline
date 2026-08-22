import * as pc from 'playcanvas';

type Observation = Readonly<{
  ready: boolean;
  loadedFromDisk: boolean;
  schemaVersion: number;
  player: { x: number; z: number };
  distanceToSalvage: number;
  salvageHealth: number;
  salvageBroken: boolean;
  rewardCount: number;
  selectedUpgrades: string[];
  effectiveDamage: number;
  attackPresses: number;
  interactPresses: number;
  savePresses: number;
  successfulSaves: number;
  renderedFrames: number;
  directSaveWriteSurface: false;
  directPositionMutationSurface: false;
  directRewardMutationSurface: false;
  directUpgradeMutationSurface: false;
  testOnlyGameplayMutationShortcut: false;
  failures: string[];
}>;

declare global {
  interface Window { __BYJTT_PERSIST__?: () => Observation }
}

const SCHEMA_VERSION = 1;
const WALK_SPEED = 3.5;
const ATTACK_DAMAGE = 34;
const ATTACK_RANGE = 1.8;
const SALVAGE_HEALTH = 34;
const PICKUP_RADIUS = 1.25;
const UPGRADE_ID = 'damage-up-1';
const DAMAGE_MULTIPLIER = 1.2;
const STORAGE_KEY = 'byjtt-lab-001-playcanvas-save';

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
let saveEdge = false;
let salvageHealth = SALVAGE_HEALTH;
let salvageBroken = false;
let rewardCount = 0;
let selectedUpgrades: string[] = [];
let attackPresses = 0;
let interactPresses = 0;
let savePresses = 0;
let successfulSaves = 0;
let renderedFrames = 0;
let loadedFromDisk = false;
const failures: string[] = [];

const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  try {
    const parsed = JSON.parse(stored) as { schema_version?: unknown; reward_count?: unknown; selected_upgrades?: unknown };
    if (parsed.schema_version === SCHEMA_VERSION && parsed.reward_count === 1 && Array.isArray(parsed.selected_upgrades) && parsed.selected_upgrades.includes(UPGRADE_ID)) {
      rewardCount = 1;
      selectedUpgrades = [UPGRADE_ID];
      loadedFromDisk = true;
    } else {
      failures.push('invalid persisted save shape');
    }
  } catch {
    failures.push('persisted save parse failed');
  }
}

const distanceToSalvage = () => {
  const p = player.getPosition();
  const s = salvage.getPosition();
  return Math.hypot(p.x - s.x, p.z - s.z);
};

addEventListener('keydown', (event) => {
  if (event.repeat) return;
  held.add(event.code);
  if (event.code === 'Space') { attackPresses++; attackEdge = true; }
  if (event.code === 'KeyE') { interactPresses++; interactEdge = true; }
  if (event.code === 'KeyP') { savePresses++; saveEdge = true; }
});
addEventListener('keyup', (event) => held.delete(event.code));
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
      salvageHealth = Math.max(0, salvageHealth - ATTACK_DAMAGE);
      if (salvageHealth === 0) {
        salvageBroken = true;
        salvage.enabled = false;
      }
    }
  }

  if (salvageBroken && rewardCount === 0 && distance <= PICKUP_RADIUS) rewardCount = 1;

  if (interactEdge) {
    interactEdge = false;
    if (rewardCount === 1 && !selectedUpgrades.includes(UPGRADE_ID)) selectedUpgrades = [UPGRADE_ID];
  }

  if (saveEdge) {
    saveEdge = false;
    if (rewardCount === 1 && selectedUpgrades.includes(UPGRADE_ID)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schema_version: SCHEMA_VERSION,
        reward_count: rewardCount,
        selected_upgrades: [...selectedUpgrades],
      }));
      successfulSaves++;
    }
  }
}

function observe(): Observation {
  const p = player.getPosition();
  return Object.freeze({
    ready: true,
    loadedFromDisk,
    schemaVersion: SCHEMA_VERSION,
    player: { x: p.x, z: p.z },
    distanceToSalvage: distanceToSalvage(),
    salvageHealth,
    salvageBroken,
    rewardCount,
    selectedUpgrades: [...selectedUpgrades],
    effectiveDamage: ATTACK_DAMAGE * (selectedUpgrades.includes(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1),
    attackPresses,
    interactPresses,
    savePresses,
    successfulSaves,
    renderedFrames,
    directSaveWriteSurface: false,
    directPositionMutationSurface: false,
    directRewardMutationSurface: false,
    directUpgradeMutationSurface: false,
    testOnlyGameplayMutationShortcut: false,
    failures: [...failures],
  });
}

window.__BYJTT_PERSIST__ = observe;
app.on('update', (dt: number) => update(Math.min(dt, 1 / 30)));
app.on('frameend', () => {
  renderedFrames++;
  const o = observe();
  status.textContent = `reward ${o.rewardCount} upgrade ${o.selectedUpgrades.join(',') || 'none'} loaded ${o.loadedFromDisk}`;
});
app.start();
addEventListener('resize', () => app.resizeCanvas());
