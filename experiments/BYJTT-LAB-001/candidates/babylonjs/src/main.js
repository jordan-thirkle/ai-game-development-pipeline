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

const CONTRACT = Object.freeze({
  arena: { width: 24, depth: 32, playerSpawn: [0, 1, 10], enemySpawn: [0, 1, -6], salvageSpawn: [5, 0.65, 0] },
  player: { maxHealth: 100, walkSpeed: 3.5, runSpeed: 5.5, acceleration: 18, deceleration: 22, attackDamage: 34, attackRange: 1.8, attackCooldown: 0.55, hitInvulnerability: 0.2 },
  enemy: { maxHealth: 100, moveSpeed: 2.7, acquireRange: 12, attackRange: 1.6, attackDamage: 20, attackCooldown: 1.1, loseTargetRange: 18 },
  salvage: { maxHealth: 34, rewardCount: 1, pickupRadius: 1.25 },
  upgrade: { id: 'damage-up-1', damageMultiplier: 1.2 },
});

const SAVE_KEY = 'byjtt-lab-001-babylonjs-v1';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DELTA = 0.25;
const MAX_SIM_STEPS_PER_FRAME = 15;
const canvas = document.querySelector('#renderCanvas');
const statsEl = document.querySelector('#stats');
const statusEl = document.querySelector('#status');
const upgradeEl = document.querySelector('#upgrade');
const upgradeButton = document.querySelector('#upgrade-damage');
const saveButton = document.querySelector('#save');
const startedAt = performance.now();
const input = new Set();

let engine;
let scene;
let camera;
let playerMesh;
let enemyMesh;
let salvageMesh;
let rewardMesh;
let impactMaterial;
let audioContext = null;
let lastSaved = null;
let lastStatsText = '';
let cameraYaw = 0;
let attackQueued = false;
let interactQueued = false;
let simulationAccumulator = 0;
let simulationSteps = 0;
let droppedSimulationSeconds = 0;
let elapsed = 0;
const activeVfx = [];

const runtime = {
  ready: false,
  gameplayActive: false,
  backend: 'initializing',
  webgpuSupported: false,
  havokReady: false,
  havokPluginVersion: null,
  startupMs: null,
  renderFrames: 0,
  errors: [],
  warnings: [],
  audioSupported: Boolean(window.AudioContext || window.webkitAudioContext),
  audioEvents: 0,
  audioFailures: [],
  vfxEvents: 0,
  hitReactions: 0,
};

const state = {
  player: {
    health: 100,
    alive: true,
    position: { x: 0, y: 1, z: 10 },
    velocity: { x: 0, z: 0 },
    hitCooldown: 0,
    attackCooldown: 0,
    respawnTimer: 0,
    animationState: 'idle',
    hitReaction: 0,
  },
  enemy: {
    health: 100,
    alive: true,
    position: { x: 0, y: 1, z: -6 },
    targetState: 'idle',
    attackCooldown: 0,
    hitReaction: 0,
  },
  salvage: { health: 34, broken: false },
  reward: { available: false, count: 0 },
  upgrade: { menuVisible: false, selectedIds: [] },
  paused: false,
};

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.schema_version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

lastSaved = readSave();
if (lastSaved) {
  state.reward.count = Number(lastSaved.reward_count || 0);
  state.upgrade.selectedIds = Array.isArray(lastSaved.selected_upgrades) ? [...lastSaved.selected_upgrades] : [];
}

function snapshot() {
  return Object.freeze({
    'runtime.ready': runtime.ready,
    'scene.gameplay_active': runtime.gameplayActive,
    'renderer.backend': runtime.backend,
    'renderer.webgpu_supported': runtime.webgpuSupported,
    'renderer.navigator_gpu': Boolean(navigator.gpu),
    'physics.havok_ready': runtime.havokReady,
    'physics.plugin_version': runtime.havokPluginVersion,
    'simulation.fixed_dt': FIXED_DT,
    'simulation.steps': simulationSteps,
    'simulation.dropped_seconds': droppedSimulationSeconds,
    'player.position': { ...state.player.position },
    'player.health': state.player.health,
    'player.alive': state.player.alive,
    'player.animation_state': state.player.animationState,
    'player.effective_attack_damage': effectiveAttackDamage(),
    'enemy.position': { ...state.enemy.position },
    'enemy.health': state.enemy.health,
    'enemy.alive': state.enemy.alive,
    'enemy.target_state': state.enemy.targetState,
    'salvage.health': state.salvage.health,
    'salvage.broken': state.salvage.broken,
    'reward.available': state.reward.available,
    'reward.count': state.reward.count,
    'upgrade.menu_visible': state.upgrade.menuVisible,
    'upgrade.selected_ids': [...state.upgrade.selectedIds],
    'save.schema_version': lastSaved?.schema_version ?? null,
    'feedback.vfx_events': runtime.vfxEvents,
    'feedback.hit_reactions': runtime.hitReactions,
    'audio.supported': runtime.audioSupported,
    'audio.events': runtime.audioEvents,
    'audio.context_state': audioContext?.state ?? 'not-created',
    'audio.failures': [...runtime.audioFailures],
    'paused': state.paused,
    'elapsed_seconds': elapsed,
    'startup.ms': runtime.startupMs,
    'render.frames': runtime.renderFrames,
    'runtime.errors': [...runtime.errors],
    'runtime.warnings': [...runtime.warnings],
  });
}

Object.defineProperty(window, '__BYJTT_BENCHMARK__', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ snapshot }),
});

function effectiveAttackDamage() {
  return state.upgrade.selectedIds.includes(CONTRACT.upgrade.id)
    ? CONTRACT.player.attackDamage * CONTRACT.upgrade.damageMultiplier
    : CONTRACT.player.attackDamage;
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function playTone(frequency, duration = 0.065) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  try {
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === 'suspended') await audioContext.resume();
    if (audioContext.state !== 'running') {
      runtime.audioFailures.push(`audio context not running: ${audioContext.state}`);
      return;
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
    runtime.audioEvents += 1;
  } catch (error) {
    runtime.audioFailures.push(error instanceof Error ? error.message : String(error));
  }
}

function spawnImpact(position, color = new Color3(1, 0.65, 0.2)) {
  if (!scene) return;
  runtime.vfxEvents += 1;
  impactMaterial.diffuseColor = color;
  const directions = [
    [1, 1.2, 0], [-1, 1.0, 0], [0, 1.35, 1], [0, 0.9, -1], [0.7, 1.1, 0.7], [-0.7, 1.15, -0.7],
  ];
  for (let i = 0; i < directions.length; i += 1) {
    const mesh = MeshBuilder.CreateSphere(`impact-${runtime.vfxEvents}-${i}`, { diameter: 0.12, segments: 6 }, scene);
    mesh.position.set(position.x, position.y + 0.45, position.z);
    mesh.material = impactMaterial;
    activeVfx.push({ mesh, velocity: { x: directions[i][0] * 2.2, y: directions[i][1] * 2.0, z: directions[i][2] * 2.2 }, life: 0.32 });
  }
}

function updateVfx(dt) {
  for (let i = activeVfx.length - 1; i >= 0; i -= 1) {
    const effect = activeVfx[i];
    effect.life -= dt;
    effect.velocity.y -= 4.5 * dt;
    effect.mesh.position.x += effect.velocity.x * dt;
    effect.mesh.position.y += effect.velocity.y * dt;
    effect.mesh.position.z += effect.velocity.z * dt;
    const scale = Math.max(0.15, effect.life / 0.32);
    effect.mesh.scaling.setAll(scale);
    if (effect.life <= 0) {
      effect.mesh.dispose();
      activeVfx.splice(i, 1);
    }
  }
}

async function createEngine() {
  runtime.webgpuSupported = Boolean(await WebGPUEngine.IsSupportedAsync);
  if (runtime.webgpuSupported) {
    try {
      const webgpu = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await webgpu.initAsync();
      runtime.backend = 'webgpu';
      return webgpu;
    } catch (error) {
      runtime.warnings.push(`webgpu-init: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  runtime.backend = 'webgl2-fallback';
  return new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
}

function material(name, color) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = color;
  return result;
}

async function createScene() {
  scene = new Scene(engine);
  scene.clearColor.set(0.055, 0.06, 0.07, 1);

  camera = new UniversalCamera('camera', new Vector3(0, 6.8, 18), scene);
  camera.minZ = 0.1;

  const light = new HemisphericLight('hemi', new Vector3(0.2, 1, -0.2), scene);
  light.intensity = 1.1;

  const ground = MeshBuilder.CreateGround('ground', { width: CONTRACT.arena.width, height: CONTRACT.arena.depth }, scene);
  ground.material = material('ground-material', new Color3(0.18, 0.2, 0.22));

  playerMesh = MeshBuilder.CreateCapsule('player', { height: 2, radius: 0.45 }, scene);
  playerMesh.position.set(...CONTRACT.arena.playerSpawn);
  playerMesh.material = material('player-material', new Color3(0.25, 0.55, 0.9));

  enemyMesh = MeshBuilder.CreateCapsule('enemy', { height: 2, radius: 0.45 }, scene);
  enemyMesh.position.set(...CONTRACT.arena.enemySpawn);
  enemyMesh.material = material('enemy-material', new Color3(0.8, 0.25, 0.2));

  salvageMesh = MeshBuilder.CreateBox('salvage', { size: 1.3 }, scene);
  salvageMesh.position.set(...CONTRACT.arena.salvageSpawn);
  salvageMesh.material = material('salvage-material', new Color3(0.75, 0.55, 0.18));

  rewardMesh = MeshBuilder.CreateSphere('reward', { diameter: 0.7, segments: 12 }, scene);
  rewardMesh.position.set(CONTRACT.arena.salvageSpawn[0], 0.45, CONTRACT.arena.salvageSpawn[2] - 1.7);
  rewardMesh.material = material('reward-material', new Color3(0.35, 0.9, 0.28));
  rewardMesh.setEnabled(false);
  impactMaterial = material('impact-material', new Color3(1, 0.65, 0.2));

  const havok = await HavokPhysics();
  const physics = new HavokPlugin(true, havok);
  const enabled = scene.enablePhysics(new Vector3(0, -9.81, 0), physics);
  if (!enabled) throw new Error('Babylon scene.enablePhysics returned false');
  runtime.havokReady = true;
  runtime.havokPluginVersion = physics.getPluginVersion();

  // Havok owns the static environment proof in Phase A. Player/enemy locomotion is a thin,
  // deterministic game-specific kinematic layer because the shared greybox arena is unobstructed.
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
  new PhysicsAggregate(salvageMesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
}

function resetPlayer() {
  state.player.health = CONTRACT.player.maxHealth;
  state.player.alive = true;
  state.player.respawnTimer = 0;
  state.player.hitCooldown = 0;
  state.player.hitReaction = 0;
  state.player.velocity.x = 0;
  state.player.velocity.z = 0;
  state.player.animationState = 'idle';
  playerMesh.scaling.setAll(1);
  playerMesh.position.set(...CONTRACT.arena.playerSpawn);
  state.player.position = { x: playerMesh.position.x, y: playerMesh.position.y, z: playerMesh.position.z };
  playerMesh.setEnabled(true);
}

function attack() {
  if (!state.player.alive || state.player.attackCooldown > 0 || state.paused) return;
  state.player.attackCooldown = CONTRACT.player.attackCooldown;
  const player = state.player.position;
  const salvageDistance = state.salvage.broken ? Infinity : distanceXZ(player, salvageMesh.position);
  const enemyDistance = state.enemy.alive ? distanceXZ(player, state.enemy.position) : Infinity;

  if (salvageDistance <= CONTRACT.player.attackRange && salvageDistance <= enemyDistance) {
    state.salvage.health = Math.max(0, state.salvage.health - effectiveAttackDamage());
    spawnImpact(salvageMesh.position, new Color3(1, 0.72, 0.22));
    void playTone(230);
    if (state.salvage.health <= 0) {
      state.salvage.broken = true;
      salvageMesh.setEnabled(false);
      state.reward.available = true;
      rewardMesh.setEnabled(true);
      spawnImpact(salvageMesh.position, new Color3(1, 0.9, 0.28));
      void playTone(360, 0.1);
    }
    return;
  }

  if (enemyDistance <= CONTRACT.player.attackRange && state.enemy.alive) {
    state.enemy.health = Math.max(0, state.enemy.health - effectiveAttackDamage());
    state.enemy.hitReaction = 0.16;
    runtime.hitReactions += 1;
    spawnImpact(state.enemy.position, new Color3(1, 0.3, 0.18));
    void playTone(190);
    if (state.enemy.health <= 0) {
      state.enemy.alive = false;
      state.enemy.targetState = 'dead';
      enemyMesh.setEnabled(false);
      void playTone(120, 0.12);
    }
  }
}

function collectRewardIfClose() {
  if (!state.reward.available || !state.player.alive) return;
  if (distanceXZ(state.player.position, rewardMesh.position) <= CONTRACT.salvage.pickupRadius) {
    state.reward.available = false;
    state.reward.count += CONTRACT.salvage.rewardCount;
    rewardMesh.setEnabled(false);
    state.upgrade.menuVisible = true;
    upgradeEl.hidden = false;
    spawnImpact(rewardMesh.position, new Color3(0.35, 1, 0.4));
    void playTone(520, 0.1);
  }
}

function chooseDamageUpgrade() {
  if (!state.upgrade.menuVisible) return;
  if (!state.upgrade.selectedIds.includes(CONTRACT.upgrade.id)) state.upgrade.selectedIds.push(CONTRACT.upgrade.id);
  state.upgrade.menuVisible = false;
  upgradeEl.hidden = true;
  spawnImpact(state.player.position, new Color3(0.3, 0.7, 1));
  void playTone(660, 0.12);
}

function saveProgress() {
  const document = {
    schema_version: 1,
    reward_count: state.reward.count,
    selected_upgrades: [...state.upgrade.selectedIds],
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(document));
    lastSaved = document;
    statusEl.textContent = 'Progress saved';
  } catch {
    statusEl.textContent = 'Save unavailable';
  }
}

function setKey(code, down) {
  if (down) input.add(code); else input.delete(code);
}

function handleTap(code) {
  if (code === 'Space') attackQueued = true;
  else if (code === 'KeyE') interactQueued = true;
  else if (code === 'Escape') state.paused = !state.paused;
  else if (code === 'ArrowLeft') cameraYaw += 0.18;
  else if (code === 'ArrowRight') cameraYaw -= 0.18;
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) setKey(event.code, true);
  else handleTap(event.code);
});
window.addEventListener('keyup', (event) => setKey(event.code, false));
window.addEventListener('blur', () => input.clear());

for (const button of document.querySelectorAll('[data-hold]')) {
  const code = button.dataset.hold;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setKey(code, true);
    button.setPointerCapture?.(event.pointerId);
  });
  const release = () => setKey(code, false);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
for (const button of document.querySelectorAll('[data-tap]')) button.addEventListener('click', () => handleTap(button.dataset.tap));
upgradeButton.addEventListener('click', chooseDamageUpgrade);
saveButton.addEventListener('click', saveProgress);

function updatePlayer(dt) {
  if (!state.player.alive) {
    state.player.animationState = 'dead';
    state.player.respawnTimer -= dt;
    if (state.player.respawnTimer <= 0) resetPlayer();
    return;
  }

  const x = (input.has('KeyD') ? 1 : 0) - (input.has('KeyA') ? 1 : 0);
  const z = (input.has('KeyS') ? 1 : 0) - (input.has('KeyW') ? 1 : 0);
  const length = Math.hypot(x, z);
  const running = input.has('ShiftLeft') || input.has('ShiftRight');
  const speed = running ? CONTRACT.player.runSpeed : CONTRACT.player.walkSpeed;
  const targetX = length > 0 ? (x / length) * speed : 0;
  const targetZ = length > 0 ? (z / length) * speed : 0;
  const rate = length > 0 ? CONTRACT.player.acceleration : CONTRACT.player.deceleration;
  const maxChange = rate * dt;

  const changeX = Math.max(-maxChange, Math.min(maxChange, targetX - state.player.velocity.x));
  const changeZ = Math.max(-maxChange, Math.min(maxChange, targetZ - state.player.velocity.z));
  state.player.velocity.x += changeX;
  state.player.velocity.z += changeZ;

  playerMesh.position.x += state.player.velocity.x * dt;
  playerMesh.position.z += state.player.velocity.z * dt;
  playerMesh.position.x = Math.max(-CONTRACT.arena.width / 2 + 0.5, Math.min(CONTRACT.arena.width / 2 - 0.5, playerMesh.position.x));
  playerMesh.position.z = Math.max(-CONTRACT.arena.depth / 2 + 0.5, Math.min(CONTRACT.arena.depth / 2 - 0.5, playerMesh.position.z));
  if (Math.hypot(state.player.velocity.x, state.player.velocity.z) > 0.05) playerMesh.rotation.y = Math.atan2(state.player.velocity.x, state.player.velocity.z);
  state.player.position = { x: playerMesh.position.x, y: playerMesh.position.y, z: playerMesh.position.z };

  if (length > 0) state.player.animationState = running ? 'run' : 'walk';
  else state.player.animationState = Math.hypot(state.player.velocity.x, state.player.velocity.z) > 0.12 ? 'walk' : 'idle';
}

function updateAnimationVisuals(dt) {
  if (state.player.hitReaction > 0) state.player.hitReaction = Math.max(0, state.player.hitReaction - dt);
  if (state.enemy.hitReaction > 0) state.enemy.hitReaction = Math.max(0, state.enemy.hitReaction - dt);

  if (playerMesh?.isEnabled()) {
    const mode = state.player.animationState;
    const frequency = mode === 'run' ? 12 : mode === 'walk' ? 8 : 2.4;
    const amplitude = mode === 'run' ? 0.065 : mode === 'walk' ? 0.038 : 0.012;
    const pulse = Math.sin(elapsed * frequency) * amplitude;
    const reaction = state.player.hitReaction > 0 ? 0.12 : 0;
    playerMesh.scaling.x = 1 - pulse * 0.35 + reaction;
    playerMesh.scaling.y = 1 + pulse - reaction * 0.5;
    playerMesh.scaling.z = 1 - pulse * 0.35 + reaction;
  }
  if (enemyMesh?.isEnabled()) {
    const reaction = state.enemy.hitReaction > 0 ? 0.14 : 0;
    enemyMesh.scaling.x = 1 + reaction;
    enemyMesh.scaling.y = 1 - reaction * 0.5;
    enemyMesh.scaling.z = 1 + reaction;
  }
}

function updateEnemy(dt) {
  if (!state.enemy.alive) return;
  const distance = distanceXZ(state.enemy.position, state.player.position);
  if (state.enemy.targetState === 'idle' && distance <= CONTRACT.enemy.acquireRange) state.enemy.targetState = 'acquired';
  if (state.enemy.targetState === 'acquired' && distance > CONTRACT.enemy.loseTargetRange) state.enemy.targetState = 'idle';

  if (state.enemy.targetState === 'acquired' && state.player.alive) {
    if (distance > CONTRACT.enemy.attackRange * 0.92) {
      const dx = state.player.position.x - state.enemy.position.x;
      const dz = state.player.position.z - state.enemy.position.z;
      const length = Math.max(0.001, Math.hypot(dx, dz));
      state.enemy.position.x += (dx / length) * CONTRACT.enemy.moveSpeed * dt;
      state.enemy.position.z += (dz / length) * CONTRACT.enemy.moveSpeed * dt;
      enemyMesh.position.x = state.enemy.position.x;
      enemyMesh.position.z = state.enemy.position.z;
      enemyMesh.rotation.y = Math.atan2(dx, dz);
    } else if (state.enemy.attackCooldown <= 0 && state.player.hitCooldown <= 0) {
      state.enemy.attackCooldown = CONTRACT.enemy.attackCooldown;
      state.player.hitCooldown = CONTRACT.player.hitInvulnerability;
      state.player.hitReaction = 0.18;
      runtime.hitReactions += 1;
      state.player.health = Math.max(0, state.player.health - CONTRACT.enemy.attackDamage);
      spawnImpact(state.player.position, new Color3(0.35, 0.65, 1));
      void playTone(145);
      if (state.player.health <= 0) {
        state.player.alive = false;
        state.player.animationState = 'dead';
        state.player.respawnTimer = 1.2;
        state.player.velocity.x = 0;
        state.player.velocity.z = 0;
        playerMesh.setEnabled(false);
      }
    }
  }
}

function updateCamera() {
  if (!playerMesh) return;
  const radius = 8.2;
  camera.position.x = playerMesh.position.x + Math.sin(cameraYaw) * radius;
  camera.position.y = playerMesh.position.y + 5.8;
  camera.position.z = playerMesh.position.z + Math.cos(cameraYaw) * radius;
  camera.setTarget(new Vector3(playerMesh.position.x, playerMesh.position.y + 0.7, playerMesh.position.z));
}

function updateHud() {
  const text = `HP ${Math.round(state.player.health)}/${CONTRACT.player.maxHealth}`
    + ` · Enemy ${Math.round(state.enemy.health)}/${CONTRACT.enemy.maxHealth}`
    + ` · Salvage ${Math.round(state.salvage.health)}/${CONTRACT.salvage.maxHealth}`
    + ` · Rewards ${state.reward.count}`
    + ` · ${state.player.animationState}`;
  if (text !== lastStatsText) {
    lastStatsText = text;
    statsEl.textContent = text;
  }
  if (!statusEl.textContent || statusEl.textContent.startsWith('Initializing')) {
    statusEl.textContent = `${runtime.backend} · Havok v${runtime.havokPluginVersion}`;
  }
}

function simulate(dt) {
  elapsed += dt;
  simulationSteps += 1;
  state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
  state.player.hitCooldown = Math.max(0, state.player.hitCooldown - dt);
  state.enemy.attackCooldown = Math.max(0, state.enemy.attackCooldown - dt);
  if (attackQueued) { attack(); attackQueued = false; }
  if (interactQueued) { collectRewardIfClose(); interactQueued = false; }
  updatePlayer(dt);
  updateEnemy(dt);
  updateAnimationVisuals(dt);
  updateVfx(dt);
  if (rewardMesh?.isEnabled()) rewardMesh.rotation.y += dt * 2.8;
}

try {
  engine = await createEngine();
  await createScene();
  runtime.ready = true;
  runtime.gameplayActive = true;
  runtime.startupMs = Math.round((performance.now() - startedAt) * 100) / 100;
  updateCamera();
  updateHud();

  engine.runRenderLoop(() => {
    runtime.renderFrames += 1;
    const rawDelta = Math.max(0, engine.getDeltaTime() / 1000);
    const frameDelta = Math.min(rawDelta, MAX_FRAME_DELTA);
    if (rawDelta > frameDelta) droppedSimulationSeconds += rawDelta - frameDelta;

    if (!state.paused) {
      simulationAccumulator += frameDelta;
      let stepsThisFrame = 0;
      while (simulationAccumulator >= FIXED_DT && stepsThisFrame < MAX_SIM_STEPS_PER_FRAME) {
        simulate(FIXED_DT);
        simulationAccumulator -= FIXED_DT;
        stepsThisFrame += 1;
      }
      if (simulationAccumulator >= FIXED_DT) {
        const dropped = simulationAccumulator - (simulationAccumulator % FIXED_DT);
        droppedSimulationSeconds += dropped;
        simulationAccumulator %= FIXED_DT;
      }
    }

    updateCamera();
    updateHud();
    scene.render();
  });

  window.addEventListener('resize', () => engine.resize());
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  runtime.errors.push(message);
  statusEl.textContent = `Initialization failed: ${message}`;
  console.error(error);
}
