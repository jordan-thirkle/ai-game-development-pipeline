import * as pc from 'playcanvas';
import contract from '../../../../shared/contract.json';

type PhysicsSnapshot = {
  runtime: {
    ready: boolean;
    backend: string;
    ammo_ready: boolean;
    seed: number;
  };
  scene: { gameplay_active: boolean };
  player: {
    position: [number, number, number];
    velocity: [number, number, number];
    dynamic: boolean;
  };
  probe: {
    position: [number, number, number];
    dynamic: boolean;
  };
  arena: {
    width: number;
    depth: number;
  };
};

declare global {
  interface Window {
    __BYJTT_PLAYCANVAS_PHYSICS__?: {
      snapshot: () => Readonly<PhysicsSnapshot>;
    };
  }
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required physics-gate DOM missing: ${selector}`);
  return element;
}

function tuple(value: pc.Vec3): [number, number, number] {
  return [Number(value.x.toFixed(3)), Number(value.y.toFixed(3)), Number(value.z.toFixed(3))];
}

const canvas = required<HTMLCanvasElement>('#application');
const startButton = required<HTMLButtonElement>('#start');
const status = required<HTMLElement>('#status');
const coords = required<HTMLElement>('#coords');

pc.WasmModule.setConfig('Ammo', {
  glueUrl: '/ammo/ammo.wasm.js',
  wasmUrl: '/ammo/ammo.wasm.wasm',
  fallbackUrl: '/ammo/ammo.js',
  errorHandler: (message) => {
    throw new Error(`Ammo WasmModule load failed: ${String(message)}`);
  }
});

await new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new Error('Ammo WasmModule timed out after 12 seconds')), 12_000);
  pc.WasmModule.getInstance('Ammo', () => {
    window.clearTimeout(timer);
    resolve();
  });
});

const graphicsDevice = await pc.createGraphicsDevice(canvas, {
  deviceTypes: [pc.DEVICETYPE_WEBGPU],
  antialias: true,
  powerPreference: 'high-performance'
});
const keyboard = new pc.Keyboard(window);
const app = new pc.Application(canvas, { graphicsDevice, keyboard });
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.start();

if (!app.systems.rigidbody) throw new Error('PlayCanvas rigidbody system unavailable after Ammo load');

function material(color: pc.Color): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  result.update();
  return result;
}

function box(name: string, position: pc.Vec3, scale: pc.Vec3, color: pc.Color): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type: 'box' });
  entity.setPosition(position);
  entity.setLocalScale(scale);
  const mat = material(color);
  entity.render?.meshInstances.forEach((instance) => { instance.material = mat; });
  entity.addComponent('collision', {
    type: 'box',
    halfExtents: new pc.Vec3(scale.x / 2, scale.y / 2, scale.z / 2)
  });
  entity.addComponent('rigidbody', { type: pc.BODYTYPE_STATIC, friction: 0.8, restitution: 0 });
  app.root.addChild(entity);
  return entity;
}

const floor = box(
  'Arena floor',
  new pc.Vec3(0, -0.25, 0),
  new pc.Vec3(contract.arena.width, 0.5, contract.arena.depth),
  new pc.Color(0.12, 0.16, 0.2)
);
void floor;
box('Wall east', new pc.Vec3(contract.arena.width / 2, 1, 0), new pc.Vec3(0.35, 2, contract.arena.depth), new pc.Color(0.35, 0.4, 0.48));
box('Wall west', new pc.Vec3(-contract.arena.width / 2, 1, 0), new pc.Vec3(0.35, 2, contract.arena.depth), new pc.Color(0.35, 0.4, 0.48));
box('Wall north', new pc.Vec3(0, 1, -contract.arena.depth / 2), new pc.Vec3(contract.arena.width, 2, 0.35), new pc.Color(0.35, 0.4, 0.48));
box('Wall south', new pc.Vec3(0, 1, contract.arena.depth / 2), new pc.Vec3(contract.arena.width, 2, 0.35), new pc.Color(0.35, 0.4, 0.48));

const player = new pc.Entity('Physics player');
player.addComponent('render', { type: 'capsule' });
player.setPosition(contract.arena.width / 2 - 4, 1, 0);
player.addComponent('collision', { type: 'capsule', radius: 0.4, height: 1.6 });
player.addComponent('rigidbody', {
  type: pc.BODYTYPE_DYNAMIC,
  mass: 1,
  friction: 0,
  restitution: 0,
  linearDamping: 0.1,
  linearFactor: new pc.Vec3(1, 0, 1),
  angularFactor: new pc.Vec3(0, 0, 0)
});
app.root.addChild(player);

const dropProbe = new pc.Entity('Gravity probe');
dropProbe.addComponent('render', { type: 'sphere' });
dropProbe.setPosition(0, 4, 0);
dropProbe.setLocalScale(0.7, 0.7, 0.7);
dropProbe.addComponent('collision', { type: 'sphere', radius: 0.35 });
dropProbe.addComponent('rigidbody', {
  type: pc.BODYTYPE_DYNAMIC,
  mass: 1,
  friction: 0.6,
  restitution: 0
});
app.root.addChild(dropProbe);

const camera = new pc.Entity('Camera');
camera.addComponent('camera', { clearColor: new pc.Color(0.035, 0.055, 0.075), farClip: 80, fov: 58 });
camera.setPosition(0, 12, 17);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

const light = new pc.Entity('Light');
light.addComponent('light', { type: 'directional', intensity: 2, castShadows: true });
light.setEulerAngles(48, 35, 0);
app.root.addChild(light);
app.scene.ambientLight = new pc.Color(0.22, 0.24, 0.27);

let active = false;
const held = new Set<string>();
window.addEventListener('keydown', (event) => held.add(event.code));
window.addEventListener('keyup', (event) => held.delete(event.code));
window.addEventListener('blur', () => held.clear());
startButton.addEventListener('click', () => {
  active = true;
  startButton.hidden = true;
  player.rigidbody?.activate();
  dropProbe.rigidbody?.activate();
  status.textContent = `Native Ammo active · ${graphicsDevice.deviceType}`;
});

function snapshot(): Readonly<PhysicsSnapshot> {
  const playerVelocity = player.rigidbody?.linearVelocity ?? pc.Vec3.ZERO;
  return Object.freeze(structuredClone({
    runtime: { ready: true, backend: graphicsDevice.deviceType, ammo_ready: Boolean(app.systems.rigidbody), seed: 1337 },
    scene: { gameplay_active: active },
    player: { position: tuple(player.getPosition()), velocity: tuple(playerVelocity as pc.Vec3), dynamic: player.rigidbody?.type === pc.BODYTYPE_DYNAMIC },
    probe: { position: tuple(dropProbe.getPosition()), dynamic: dropProbe.rigidbody?.type === pc.BODYTYPE_DYNAMIC },
    arena: { width: contract.arena.width, depth: contract.arena.depth }
  } satisfies PhysicsSnapshot));
}

window.__BYJTT_PLAYCANVAS_PHYSICS__ = { snapshot };

app.on('update', () => {
  if (active && player.rigidbody) {
    const x = Number(held.has('KeyD')) - Number(held.has('KeyA'));
    const z = Number(held.has('KeyS')) - Number(held.has('KeyW'));
    const velocity = new pc.Vec3(x * contract.player.run_speed, 0, z * contract.player.run_speed);
    player.rigidbody.linearVelocity = velocity;
  }
  const p = player.getPosition();
  const q = dropProbe.getPosition();
  coords.textContent = `player x ${p.x.toFixed(2)} · probe y ${q.y.toFixed(2)}`;
});

status.textContent = `Ammo loaded · ${graphicsDevice.deviceType} · press Start`;
