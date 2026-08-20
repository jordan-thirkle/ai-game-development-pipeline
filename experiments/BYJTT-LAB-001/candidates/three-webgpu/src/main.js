import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import initJolt from 'jolt-physics';

const CONTRACT = Object.freeze({
  arena: { width: 24, depth: 32, playerSpawn: [0, 1, 10], enemySpawn: [0, 1, -6], salvageSpawn: [5, 0.65, 0] },
  player: { maxHealth: 100, walkSpeed: 3.5, runSpeed: 5.5, acceleration: 18, deceleration: 22, attackDamage: 34, attackRange: 1.8, attackCooldown: 0.55, hitInvulnerability: 0.2 },
  enemy: { maxHealth: 100, moveSpeed: 2.7, acquireRange: 12, attackRange: 1.6, attackDamage: 20, attackCooldown: 1.1, loseTargetRange: 18 },
  salvage: { maxHealth: 34, rewardCount: 1, pickupRadius: 1.25 },
  upgrade: { id: 'damage-up-1', damageMultiplier: 1.2 }
});

const SAVE_KEY = 'byjtt-lab-001-three-webgpu-v1';
const input = new Set();
let attackQueued = false;
let interactQueued = false;
let paused = false;
let runtimeReady = false;
let gameplayActive = false;
let rendererBackend = 'initialising';
let lastSaved = null;
let lastStatsText = '';

const state = {
  player: { health: 100, alive: true, position: { x: 0, y: 1, z: 10 }, hitCooldown: 0, attackCooldown: 0 },
  enemy: { health: 100, alive: true, position: { x: 0, y: 1, z: -6 }, targetState: 'idle', attackCooldown: 0 },
  salvage: { health: 34, broken: false },
  reward: { available: false, count: 0 },
  upgrade: { menuVisible: false, selectedIds: [] },
  paused: false
};

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.schema_version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

lastSaved = readSave();
if (lastSaved) {
  state.reward.count = Number(lastSaved.reward_count || 0);
  state.upgrade.selectedIds = Array.isArray(lastSaved.selected_upgrades) ? [...lastSaved.selected_upgrades] : [];
}

const app = document.querySelector('#app');
const statsEl = document.querySelector('#stats');
const bannerEl = document.querySelector('#banner');
const upgradeEl = document.querySelector('#upgrade');
const upgradeButton = document.querySelector('#upgrade-damage');
const saveButton = document.querySelector('#save');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15202b);
scene.fog = new THREE.Fog(0x15202b, 28, 58);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
let cameraYaw = 0;

const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);
await renderer.init();
rendererBackend = `${renderer.backend?.constructor?.name || 'unknown'}${navigator.gpu ? ':navigator-gpu' : ':no-navigator-gpu'}`;

scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x23301c, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.position.set(8, 14, 10);
sun.castShadow = true;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(CONTRACT.arena.width, 0.5, CONTRACT.arena.depth),
  new THREE.MeshStandardMaterial({ color: 0x506448, roughness: 0.92 })
);
floor.position.y = -0.25;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(CONTRACT.arena.depth, 16, 0x8aa37e, 0x617259);
grid.position.y = 0.01;
scene.add(grid);

const playerMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.42, 1.15, 6, 10),
  new THREE.MeshStandardMaterial({ color: 0x56a8ff, roughness: 0.45 })
);
playerMesh.castShadow = true;
scene.add(playerMesh);

const enemyMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.44, 1.1, 6, 10),
  new THREE.MeshStandardMaterial({ color: 0xd85757, roughness: 0.5 })
);
enemyMesh.position.set(...CONTRACT.arena.enemySpawn);
enemyMesh.castShadow = true;
scene.add(enemyMesh);

const salvageMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 1.3, 1.3),
  new THREE.MeshStandardMaterial({ color: 0xd0a34f, roughness: 0.72 })
);
salvageMesh.position.set(...CONTRACT.arena.salvageSpawn);
salvageMesh.castShadow = true;
scene.add(salvageMesh);

const rewardMesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.34, 1),
  new THREE.MeshStandardMaterial({ color: 0x9cff6b, emissive: 0x163b0e, emissiveIntensity: 1.4 })
);
rewardMesh.visible = false;
scene.add(rewardMesh);

const particles = [];
function burst(position, color = 0xffffff) {
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(position);
    scene.add(mesh);
    particles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), life: 0.42 });
  }
}

let audioContext = null;
function beep(freq = 220, duration = 0.045) {
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(0.025, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio is non-critical to simulation; browser autoplay policy is recorded via runtime evidence.
  }
}

const Jolt = await initJolt();
const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_OBJECT_LAYERS = 2;
const WALL_HALF_THICKNESS = 0.25;

function setupCollisionFiltering(settings) {
  const objectFilter = new Jolt.ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
  objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
  objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);
  const bpStatic = new Jolt.BroadPhaseLayer(0);
  const bpMoving = new Jolt.BroadPhaseLayer(1);
  const bpInterface = new Jolt.BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, 2);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, bpStatic);
  bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving);
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bpInterface;
  settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bpInterface, 2, objectFilter, NUM_OBJECT_LAYERS);
}

const joltSettings = new Jolt.JoltSettings();
setupCollisionFiltering(joltSettings);
const jolt = new Jolt.JoltInterface(joltSettings);
Jolt.destroy(joltSettings);
const physicsSystem = jolt.GetPhysicsSystem();
const bodyInterface = physicsSystem.GetBodyInterface();

function addStaticBox(halfX, halfY, halfZ, x, y, z) {
  const shape = new Jolt.BoxShape(new Jolt.Vec3(halfX, halfY, halfZ), 0.05, undefined);
  const bodySettings = new Jolt.BodyCreationSettings(
    shape,
    new Jolt.RVec3(x, y, z),
    Jolt.Quat.prototype.sIdentity(),
    Jolt.EMotionType_Static,
    LAYER_NON_MOVING
  );
  const body = bodyInterface.CreateBody(bodySettings);
  bodyInterface.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
  Jolt.destroy(bodySettings);
}

addStaticBox(CONTRACT.arena.width / 2, 0.25, CONTRACT.arena.depth / 2, 0, -0.25, 0);
addStaticBox(WALL_HALF_THICKNESS, 2, CONTRACT.arena.depth / 2, CONTRACT.arena.width / 2, 2, 0);
addStaticBox(WALL_HALF_THICKNESS, 2, CONTRACT.arena.depth / 2, -CONTRACT.arena.width / 2, 2, 0);
addStaticBox(CONTRACT.arena.width / 2, 2, WALL_HALF_THICKNESS, 0, 2, CONTRACT.arena.depth / 2);
addStaticBox(CONTRACT.arena.width / 2, 2, WALL_HALF_THICKNESS, 0, 2, -CONTRACT.arena.depth / 2);

const characterShape = new Jolt.CapsuleShape(0.575, 0.42);
const characterSettings = new Jolt.CharacterVirtualSettings();
characterSettings.mMass = 80;
characterSettings.mMaxSlopeAngle = Math.PI / 4;
characterSettings.mMaxStrength = 100;
characterSettings.mShape = characterShape;
characterSettings.mBackFaceMode = Jolt.EBackFaceMode_CollideWithBackFaces;
characterSettings.mCharacterPadding = 0.02;
characterSettings.mPenetrationRecoverySpeed = 1.0;
characterSettings.mPredictiveContactDistance = 0.1;
characterSettings.mSupportingVolume = new Jolt.Plane(Jolt.Vec3.prototype.sAxisY(), -0.42);
const character = new Jolt.CharacterVirtual(
  characterSettings,
  new Jolt.RVec3(...CONTRACT.arena.playerSpawn),
  Jolt.Quat.prototype.sIdentity(),
  physicsSystem
);

const objectVsBroadPhaseLayerFilter = jolt.GetObjectVsBroadPhaseLayerFilter();
const objectLayerPairFilter = jolt.GetObjectLayerPairFilter();
const movingBPFilter = new Jolt.DefaultBroadPhaseLayerFilter(objectVsBroadPhaseLayerFilter, LAYER_MOVING);
const movingLayerFilter = new Jolt.DefaultObjectLayerFilter(objectLayerPairFilter, LAYER_MOVING);
const bodyFilter = new Jolt.BodyFilter();
const shapeFilter = new Jolt.ShapeFilter();
const updateSettings = new Jolt.ExtendedUpdateSettings();
const joltVelocity = new Jolt.Vec3();
const joltGravity = new Jolt.Vec3(0, -9.81, 0);
const joltScratchPosition = new Jolt.RVec3();
const joltZeroVelocity = new Jolt.Vec3();

const desiredVelocity = new THREE.Vector3();
const clock = new THREE.Clock();
const FIXED_DT = 1 / 60;
const MAX_FRAME_DELTA = 0.25;
const MAX_SIM_STEPS_PER_FRAME = 15;
let simulationAccumulator = 0;
let droppedSimulationSeconds = 0;
let simulationSteps = 0;
let elapsed = 0;

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function resetPlayer() {
  state.player.health = CONTRACT.player.maxHealth;
  state.player.alive = true;
  state.player.hitCooldown = 0;
  joltScratchPosition.Set(...CONTRACT.arena.playerSpawn);
  joltZeroVelocity.Set(0, 0, 0);
  character.SetPosition(joltScratchPosition);
  character.SetLinearVelocity(joltZeroVelocity);
  desiredVelocity.set(0, 0, 0);
}

function effectiveAttackDamage() {
  return state.upgrade.selectedIds.includes(CONTRACT.upgrade.id)
    ? CONTRACT.player.attackDamage * CONTRACT.upgrade.damageMultiplier
    : CONTRACT.player.attackDamage;
}

function queueAttack() {
  attackQueued = true;
}

function attack() {
  if (!state.player.alive || state.player.attackCooldown > 0 || paused) return;
  state.player.attackCooldown = CONTRACT.player.attackCooldown;
  const playerPos = playerMesh.position;
  const salvageDistance = state.salvage.broken ? Infinity : distanceXZ(playerPos, salvageMesh.position);
  const enemyDistance = state.enemy.alive ? distanceXZ(playerPos, enemyMesh.position) : Infinity;

  if (salvageDistance <= CONTRACT.player.attackRange && salvageDistance <= enemyDistance) {
    state.salvage.health = Math.max(0, state.salvage.health - effectiveAttackDamage());
    burst(salvageMesh.position, 0xffcf62);
    beep(330);
    if (state.salvage.health <= 0) {
      state.salvage.broken = true;
      salvageMesh.visible = false;
      state.reward.available = true;
      rewardMesh.position.set(salvageMesh.position.x, 0.45, salvageMesh.position.z - 1.7);
      rewardMesh.visible = true;
    }
    return;
  }

  if (enemyDistance <= CONTRACT.player.attackRange && state.enemy.alive) {
    state.enemy.health = Math.max(0, state.enemy.health - effectiveAttackDamage());
    enemyMesh.material.emissive.setHex(0x661111);
    burst(enemyMesh.position, 0xff6e6e);
    beep(180);
    setTimeout(() => enemyMesh.material.emissive.setHex(0x000000), 100);
    if (state.enemy.health <= 0) {
      state.enemy.alive = false;
      state.enemy.targetState = 'dead';
      enemyMesh.visible = false;
    }
  }
}

function collectRewardIfClose() {
  if (!state.reward.available || !state.player.alive) return;
  if (distanceXZ(playerMesh.position, rewardMesh.position) <= CONTRACT.salvage.pickupRadius) {
    state.reward.available = false;
    state.reward.count += CONTRACT.salvage.rewardCount;
    rewardMesh.visible = false;
    state.upgrade.menuVisible = true;
    upgradeEl.hidden = false;
    burst(playerMesh.position, 0x9cff6b);
    beep(520, 0.08);
  }
}

function chooseDamageUpgrade() {
  if (!state.upgrade.menuVisible) return;
  if (!state.upgrade.selectedIds.includes(CONTRACT.upgrade.id)) state.upgrade.selectedIds.push(CONTRACT.upgrade.id);
  state.upgrade.menuVisible = false;
  upgradeEl.hidden = true;
  beep(660, 0.1);
}

function saveProgress() {
  const document = {
    schema_version: 1,
    reward_count: state.reward.count,
    selected_upgrades: [...state.upgrade.selectedIds]
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(document));
  } catch {
    bannerEl.textContent = 'Save unavailable';
    return;
  }
  lastSaved = document;
  bannerEl.textContent = 'Progress saved';
  setTimeout(() => { if (bannerEl.textContent === 'Progress saved') bannerEl.textContent = rendererBackend; }, 800);
}

upgradeButton.addEventListener('click', chooseDamageUpgrade);
saveButton.addEventListener('click', saveProgress);

function setKey(code, down) {
  if (down) input.add(code); else input.delete(code);
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) setKey(event.code, true);
  if (event.code === 'Space') queueAttack();
  if (event.code === 'KeyE') interactQueued = true;
  if (event.code === 'Escape') { paused = !paused; state.paused = paused; }
  if (event.code === 'ArrowLeft') cameraYaw += 0.18;
  if (event.code === 'ArrowRight') cameraYaw -= 0.18;
});
window.addEventListener('keyup', (event) => setKey(event.code, false));
window.addEventListener('blur', () => input.clear());

for (const button of document.querySelectorAll('[data-hold]')) {
  const code = button.dataset.hold;
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); setKey(code, true); button.setPointerCapture?.(event.pointerId); });
  const release = () => setKey(code, false);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}
for (const button of document.querySelectorAll('[data-tap]')) {
  button.addEventListener('click', () => {
    const code = button.dataset.tap;
    if (code === 'Space') queueAttack();
    else if (code === 'KeyE') interactQueued = true;
    else if (code === 'Escape') { paused = !paused; state.paused = paused; }
    else if (code === 'ArrowLeft') cameraYaw += 0.18;
    else if (code === 'ArrowRight') cameraYaw -= 0.18;
  });
}

function updatePlayer(dt) {
  if (!state.player.alive) return;
  const x = (input.has('KeyD') ? 1 : 0) - (input.has('KeyA') ? 1 : 0);
  const z = (input.has('KeyS') ? 1 : 0) - (input.has('KeyW') ? 1 : 0);
  const target = new THREE.Vector3(x, 0, z);
  if (target.lengthSq() > 0) target.normalize();
  const speed = input.has('ShiftLeft') || input.has('ShiftRight') ? CONTRACT.player.runSpeed : CONTRACT.player.walkSpeed;
  target.multiplyScalar(speed);
  const rate = target.lengthSq() > 0 ? CONTRACT.player.acceleration : CONTRACT.player.deceleration;
  const alpha = Math.min(1, rate * dt / Math.max(0.001, speed));
  desiredVelocity.lerp(target, alpha);

  const current = character.GetLinearVelocity();
  const vertical = current.GetY();
  joltVelocity.Set(desiredVelocity.x, vertical - 9.81 * dt, desiredVelocity.z);
  character.SetLinearVelocity(joltVelocity);
  character.ExtendedUpdate(
    dt,
    joltGravity,
    updateSettings,
    movingBPFilter,
    movingLayerFilter,
    bodyFilter,
    shapeFilter,
    jolt.GetTempAllocator()
  );
  const pos = character.GetPosition();
  playerMesh.position.set(pos.GetX(), pos.GetY(), pos.GetZ());
  state.player.position = { x: playerMesh.position.x, y: playerMesh.position.y, z: playerMesh.position.z };
  if (desiredVelocity.lengthSq() > 0.02) playerMesh.rotation.y = Math.atan2(desiredVelocity.x, desiredVelocity.z);
}

function updateEnemy(dt) {
  if (!state.enemy.alive) return;
  const distance = distanceXZ(enemyMesh.position, playerMesh.position);
  if (state.enemy.targetState === 'idle' && distance <= CONTRACT.enemy.acquireRange) state.enemy.targetState = 'acquired';
  if (state.enemy.targetState === 'acquired' && distance > CONTRACT.enemy.loseTargetRange) state.enemy.targetState = 'idle';

  if (state.enemy.targetState === 'acquired' && state.player.alive) {
    if (distance > CONTRACT.enemy.attackRange * 0.92) {
      const direction = new THREE.Vector3(playerMesh.position.x - enemyMesh.position.x, 0, playerMesh.position.z - enemyMesh.position.z).normalize();
      enemyMesh.position.addScaledVector(direction, CONTRACT.enemy.moveSpeed * dt);
      enemyMesh.rotation.y = Math.atan2(direction.x, direction.z);
    } else if (state.enemy.attackCooldown <= 0 && state.player.hitCooldown <= 0) {
      state.enemy.attackCooldown = CONTRACT.enemy.attackCooldown;
      state.player.hitCooldown = CONTRACT.player.hitInvulnerability;
      state.player.health = Math.max(0, state.player.health - CONTRACT.enemy.attackDamage);
      playerMesh.material.emissive.setHex(0x113d66);
      burst(playerMesh.position, 0x68b6ff);
      beep(120);
      setTimeout(() => playerMesh.material.emissive.setHex(0x000000), 100);
      if (state.player.health <= 0) {
        state.player.alive = false;
        setTimeout(resetPlayer, 1200);
      }
    }
  }
  state.enemy.position = { x: enemyMesh.position.x, y: enemyMesh.position.y, z: enemyMesh.position.z };
}

function updateCamera() {
  const radius = 8.2;
  const offset = new THREE.Vector3(Math.sin(cameraYaw) * radius, 5.8, Math.cos(cameraYaw) * radius);
  camera.position.copy(playerMesh.position).add(offset);
  camera.lookAt(playerMesh.position.x, playerMesh.position.y + 0.7, playerMesh.position.z);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life -= dt;
    particle.velocity.y -= 5 * dt;
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.scale.setScalar(Math.max(0.01, particle.life / 0.42));
    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function updateHud() {
  const text = `HP ${Math.round(state.player.health)}/${CONTRACT.player.maxHealth}`
    + ` · Enemy ${Math.round(state.enemy.health)}/${CONTRACT.enemy.maxHealth}`
    + ` · Salvage ${Math.round(state.salvage.health)}/${CONTRACT.salvage.maxHealth}`
    + ` · Rewards ${state.reward.count}`;
  if (text !== lastStatsText) {
    lastStatsText = text;
    statsEl.textContent = text;
  }
  bannerEl.textContent ||= rendererBackend;
}

function simulate(dt) {
  elapsed += dt;
  simulationSteps += 1;
  state.player.attackCooldown = Math.max(0, state.player.attackCooldown - dt);
  state.player.hitCooldown = Math.max(0, state.player.hitCooldown - dt);
  state.enemy.attackCooldown = Math.max(0, state.enemy.attackCooldown - dt);
  if (attackQueued) { attack(); attackQueued = false; }
  if (interactQueued) { interactQueued = false; collectRewardIfClose(); }
  updatePlayer(dt);
  updateEnemy(dt);
  collectRewardIfClose();
  updateParticles(dt);
  rewardMesh.rotation.y += dt * 2.8;
  jolt.Step(dt, 1);
}

function snapshot() {
  return {
    'runtime.ready': runtimeReady,
    'scene.gameplay_active': gameplayActive,
    'renderer.backend': rendererBackend,
    'renderer.navigator_gpu': Boolean(navigator.gpu),
    'simulation.fixed_dt': FIXED_DT,
    'simulation.steps': simulationSteps,
    'simulation.dropped_seconds': droppedSimulationSeconds,
    'physics.native_arena_boundary': true,
    'physics.post_physics_arena_clamp': false,
    'player.position': { ...state.player.position },
    'player.health': state.player.health,
    'player.alive': state.player.alive,
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
    'paused': paused,
    'elapsed_seconds': elapsed
  };
}

Object.defineProperty(window, '__BYJTT_BENCHMARK__', {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ snapshot })
});

runtimeReady = true;
gameplayActive = true;
playerMesh.position.set(...CONTRACT.arena.playerSpawn);
updateCamera();
updateHud();

renderer.setAnimationLoop(() => {
  const rawDelta = clock.getDelta();
  const frameDelta = Math.min(rawDelta, MAX_FRAME_DELTA);
  if (rawDelta > frameDelta) droppedSimulationSeconds += rawDelta - frameDelta;

  if (!paused) {
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
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});