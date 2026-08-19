import * as pc from 'playcanvas';
import contract from '../../../shared/contract.json';
import './style.css';

type Vec3Tuple = [number, number, number];
type TargetState = 'idle' | 'acquired';

type Observation = {
  runtime: { ready: boolean; backend: string; seed: number };
  scene: { gameplay_active: boolean };
  player: { position: Vec3Tuple; health: number; alive: boolean };
  enemy: { position: Vec3Tuple; health: number; alive: boolean; target_state: TargetState };
  salvage: { health: number; broken: boolean };
  reward: { available: boolean; count: number };
  upgrade: { menu_visible: boolean; selected_ids: string[] };
  save: { schema_version: number };
};

declare global {
  interface Window {
    __BYJTT_OBSERVE__?: () => Readonly<Observation>;
  }
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required benchmark DOM missing: ${selector}`);
  return element;
}

function frozenTuple(value: readonly number[], label: string): Vec3Tuple {
  if (value.length !== 3 || value.some((part) => !Number.isFinite(part))) {
    throw new Error(`${label} must be a finite 3-value tuple`);
  }
  return [value[0]!, value[1]!, value[2]!];
}

const canvas = required<HTMLCanvasElement>('#application');
const startButton = required<HTMLButtonElement>('#start');
const attackButton = required<HTMLButtonElement>('#attack');
const statusLabel = required<HTMLElement>('#status');
const healthLabel = required<HTMLElement>('#health');
const playerSpawn = frozenTuple(contract.arena.player_spawn, 'player_spawn');
const enemySpawn = frozenTuple(contract.arena.enemy_spawn, 'enemy_spawn');
const salvageSpawn = frozenTuple(contract.arena.salvage_spawn, 'salvage_spawn');

const graphicsDevice = await pc.createGraphicsDevice(canvas, {
  deviceTypes: [pc.DEVICETYPE_WEBGPU],
  antialias: true,
  powerPreference: 'high-performance'
});

const keyboard = new pc.Keyboard(window);
const mouse = new pc.Mouse(canvas);
const touch = new pc.TouchDevice(canvas);
const app = new pc.Application(canvas, { graphicsDevice, keyboard, mouse, touch });
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.start();

const state = {
  gameplayActive: false,
  playerHealth: contract.player.max_health,
  enemyHealth: contract.enemy.max_health,
  enemyTargetState: 'idle' as TargetState,
  salvageHealth: contract.salvage.max_health,
  salvageBroken: false,
  rewardAvailable: false,
  rewardCount: 0,
  upgradeMenuVisible: false,
  selectedUpgrades: [] as string[]
};

function makeMaterial(rgb: Vec3Tuple, emissive = 0): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = new pc.Color(rgb[0], rgb[1], rgb[2]);
  if (emissive > 0) material.emissive = new pc.Color(rgb[0] * emissive, rgb[1] * emissive, rgb[2] * emissive);
  material.update();
  return material;
}

function primitive(
  name: string,
  type: 'box' | 'sphere' | 'capsule' | 'cylinder' | 'plane',
  position: Vec3Tuple,
  scale: Vec3Tuple,
  material: pc.Material
): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type });
  entity.setPosition(...position);
  entity.setLocalScale(...scale);
  entity.render?.meshInstances.forEach((mesh) => { mesh.material = material; });
  app.root.addChild(entity);
  return entity;
}

const floorMaterial = makeMaterial([0.12, 0.15, 0.18]);
const wallMaterial = makeMaterial([0.2, 0.23, 0.27]);
const playerMaterial = makeMaterial([0.25, 0.75, 1], 0.12);
const enemyMaterial = makeMaterial([1, 0.28, 0.24], 0.08);
const salvageMaterial = makeMaterial([0.95, 0.68, 0.2], 0.08);

primitive('Arena floor', 'box', [0, -0.25, 0], [contract.arena.width, 0.5, contract.arena.depth], floorMaterial);
primitive('Wall north', 'box', [0, 1, -contract.arena.depth / 2], [contract.arena.width, 2, 0.35], wallMaterial);
primitive('Wall south', 'box', [0, 1, contract.arena.depth / 2], [contract.arena.width, 2, 0.35], wallMaterial);
primitive('Wall west', 'box', [-contract.arena.width / 2, 1, 0], [0.35, 2, contract.arena.depth], wallMaterial);
primitive('Wall east', 'box', [contract.arena.width / 2, 1, 0], [0.35, 2, contract.arena.depth], wallMaterial);

const player = primitive('Player', 'capsule', [playerSpawn[0], 1, playerSpawn[2]], [0.8, 1.7, 0.8], playerMaterial);
const enemy = primitive('Enemy', 'capsule', [enemySpawn[0], 1, enemySpawn[2]], [0.9, 1.8, 0.9], enemyMaterial);
const salvage = primitive('Salvage', 'box', [salvageSpawn[0], 0.65, salvageSpawn[2]], [1.3, 1.3, 1.3], salvageMaterial);

const camera = new pc.Entity('Camera');
camera.addComponent('camera', { clearColor: new pc.Color(0.035, 0.055, 0.08), farClip: 90, fov: 58 });
app.root.addChild(camera);

const keyLight = new pc.Entity('Key light');
keyLight.addComponent('light', { type: 'directional', color: new pc.Color(1, 0.94, 0.82), intensity: 1.8, castShadows: true });
keyLight.setEulerAngles(42, 32, 0);
app.root.addChild(keyLight);

const fillLight = new pc.Entity('Fill light');
fillLight.addComponent('light', { type: 'omni', color: new pc.Color(0.2, 0.45, 0.85), intensity: 2.4, range: 20 });
fillLight.setPosition(-4, 5, 6);
app.root.addChild(fillLight);
app.scene.ambientLight = new pc.Color(0.18, 0.2, 0.24);

const held = new Set<string>();
const touchDirections = new Set<string>();
const velocity = new pc.Vec3();
let yaw = 0;
let pitch = 24;
let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

function setHeld(code: string, active: boolean): void {
  if (active) held.add(code);
  else held.delete(code);
}

window.addEventListener('keydown', (event) => {
  setHeld(event.code, true);
  if (event.code === 'Space') {
    event.preventDefault();
    performAttack();
  }
});
window.addEventListener('keyup', (event) => setHeld(event.code, false));
window.addEventListener('blur', () => held.clear());

document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
  const direction = button.dataset.move;
  if (!direction) return;
  const activate = (event: Event) => { event.preventDefault(); touchDirections.add(direction); };
  const deactivate = (event: Event) => { event.preventDefault(); touchDirections.delete(direction); };
  button.addEventListener('pointerdown', activate);
  button.addEventListener('pointerup', deactivate);
  button.addEventListener('pointercancel', deactivate);
  button.addEventListener('pointerleave', deactivate);
});

attackButton.addEventListener('click', performAttack);
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw -= (event.clientX - lastPointerX) * 0.22;
  pitch = pc.math.clamp(pitch - (event.clientY - lastPointerY) * 0.18, 12, 58);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});
canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

startButton.addEventListener('click', () => {
  state.gameplayActive = true;
  startButton.hidden = true;
  statusLabel.textContent = `Gameplay · ${graphicsDevice.deviceType}`;
});

function inputAxis(): { x: number; z: number; running: boolean } {
  const left = held.has('KeyA') || held.has('ArrowLeft') || touchDirections.has('left');
  const right = held.has('KeyD') || held.has('ArrowRight') || touchDirections.has('right');
  const forward = held.has('KeyW') || held.has('ArrowUp') || touchDirections.has('forward');
  const back = held.has('KeyS') || held.has('ArrowDown') || touchDirections.has('back');
  return { x: Number(right) - Number(left), z: Number(back) - Number(forward), running: held.has('ShiftLeft') || held.has('ShiftRight') };
}

function distanceXZ(a: pc.Vec3, b: pc.Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function performAttack(): void {
  if (!state.gameplayActive || state.playerHealth <= 0) return;
  const playerPos = player.getPosition();
  const damageMultiplier = state.selectedUpgrades.includes(contract.upgrade.id) ? contract.upgrade.damage_multiplier : 1;
  const damage = contract.player.attack_damage * damageMultiplier;
  if (state.enemyHealth > 0 && distanceXZ(playerPos, enemy.getPosition()) <= contract.player.attack_range) {
    state.enemyHealth = Math.max(0, state.enemyHealth - damage);
    statusLabel.textContent = state.enemyHealth === 0 ? 'Enemy down' : `Enemy hit · ${Math.ceil(state.enemyHealth)} HP`;
    return;
  }
  if (!state.salvageBroken && distanceXZ(playerPos, salvage.getPosition()) <= contract.player.attack_range) {
    state.salvageHealth = Math.max(0, state.salvageHealth - damage);
    if (state.salvageHealth === 0) {
      state.salvageBroken = true;
      state.rewardAvailable = true;
      salvage.enabled = false;
      statusLabel.textContent = 'Salvage broken · reward available';
    }
    return;
  }
  statusLabel.textContent = 'Attack · no target in range';
}

function updatePlayer(dt: number): void {
  if (!state.gameplayActive || state.playerHealth <= 0) return;
  const axis = inputAxis();
  const inputLength = Math.hypot(axis.x, axis.z);
  const desiredSpeed = axis.running ? contract.player.run_speed : contract.player.walk_speed;
  const targetX = inputLength > 0 ? (axis.x / inputLength) * desiredSpeed : 0;
  const targetZ = inputLength > 0 ? (axis.z / inputLength) * desiredSpeed : 0;
  const response = inputLength > 0 ? contract.player.acceleration : contract.player.deceleration;
  const maxDelta = response * dt;
  velocity.x += pc.math.clamp(targetX - velocity.x, -maxDelta, maxDelta);
  velocity.z += pc.math.clamp(targetZ - velocity.z, -maxDelta, maxDelta);
  const position = player.getPosition().clone();
  position.x = pc.math.clamp(position.x + velocity.x * dt, -contract.arena.width / 2 + 0.6, contract.arena.width / 2 - 0.6);
  position.z = pc.math.clamp(position.z + velocity.z * dt, -contract.arena.depth / 2 + 0.6, contract.arena.depth / 2 - 0.6);
  player.setPosition(position);
  if (Math.hypot(velocity.x, velocity.z) > 0.15) player.setEulerAngles(0, Math.atan2(velocity.x, velocity.z) * pc.math.RAD_TO_DEG, 0);
}

function updateEnemy(dt: number): void {
  if (!state.gameplayActive || state.enemyHealth <= 0 || state.playerHealth <= 0) return;
  const playerPos = player.getPosition();
  const enemyPos = enemy.getPosition();
  const distance = distanceXZ(playerPos, enemyPos);
  if (distance <= contract.enemy.acquire_range) state.enemyTargetState = 'acquired';
  if (distance >= contract.enemy.lose_target_range) state.enemyTargetState = 'idle';
  if (state.enemyTargetState === 'acquired' && distance > contract.enemy.attack_range) {
    const direction = new pc.Vec3(playerPos.x - enemyPos.x, 0, playerPos.z - enemyPos.z).normalize();
    enemy.translate(direction.x * contract.enemy.move_speed * dt, 0, direction.z * contract.enemy.move_speed * dt);
    enemy.setEulerAngles(0, Math.atan2(direction.x, direction.z) * pc.math.RAD_TO_DEG, 0);
  }
}

function updateRewardAndUpgrade(): void {
  if (!state.rewardAvailable) return;
  const salvagePosition = new pc.Vec3(salvageSpawn[0], 0, salvageSpawn[2]);
  if (distanceXZ(player.getPosition(), salvagePosition) <= contract.salvage.pickup_radius) {
    state.rewardAvailable = false;
    state.rewardCount = contract.salvage.reward_count;
    state.upgradeMenuVisible = true;
    statusLabel.textContent = 'Reward collected · press E to choose +20% damage';
  }
}

function selectUpgradeIfRequested(): void {
  if (!state.upgradeMenuVisible || state.selectedUpgrades.includes(contract.upgrade.id)) return;
  if (held.has('KeyE')) {
    state.selectedUpgrades.push(contract.upgrade.id);
    state.upgradeMenuVisible = false;
    statusLabel.textContent = `${contract.upgrade.label} selected`;
  }
}

function updateCamera(): void {
  const playerPos = player.getPosition();
  const yawRad = yaw * pc.math.DEG_TO_RAD;
  const pitchRad = pitch * pc.math.DEG_TO_RAD;
  const horizontal = Math.cos(pitchRad) * 8.2;
  camera.setPosition(playerPos.x + Math.sin(yawRad) * horizontal, playerPos.y + Math.sin(pitchRad) * 8.2 + 1.2, playerPos.z + Math.cos(yawRad) * horizontal);
  camera.lookAt(playerPos.x, playerPos.y + 0.65, playerPos.z);
}

function tuple(position: pc.Vec3): Vec3Tuple {
  return [Number(position.x.toFixed(3)), Number(position.y.toFixed(3)), Number(position.z.toFixed(3))];
}

function snapshot(): Readonly<Observation> {
  return Object.freeze(structuredClone({
    runtime: { ready: true, backend: graphicsDevice.deviceType, seed: 1337 },
    scene: { gameplay_active: state.gameplayActive },
    player: { position: tuple(player.getPosition()), health: state.playerHealth, alive: state.playerHealth > 0 },
    enemy: { position: tuple(enemy.getPosition()), health: state.enemyHealth, alive: state.enemyHealth > 0, target_state: state.enemyTargetState },
    salvage: { health: state.salvageHealth, broken: state.salvageBroken },
    reward: { available: state.rewardAvailable, count: state.rewardCount },
    upgrade: { menu_visible: state.upgradeMenuVisible, selected_ids: [...state.selectedUpgrades] },
    save: { schema_version: 1 }
  } satisfies Observation));
}

window.__BYJTT_OBSERVE__ = snapshot;
app.on('update', (dt: number) => {
  const safeDt = Math.min(dt, 0.05);
  updatePlayer(safeDt);
  updateEnemy(safeDt);
  updateRewardAndUpgrade();
  selectUpgradeIfRequested();
  updateCamera();
  healthLabel.textContent = `HP ${Math.ceil(state.playerHealth)}`;
});

updateCamera();
statusLabel.textContent = `Ready · ${graphicsDevice.deviceType}`;
