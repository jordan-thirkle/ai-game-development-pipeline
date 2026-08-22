import { Engine, Scene, Vector3, MeshBuilder, HemisphericLight, FreeCamera, HavokPlugin, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

type Observation = { ready:boolean; player:{x:number;y:number;z:number}; velocity:{x:number;y:number;z:number}; eastWallContact:boolean; havokVersion:number|null; errors:string[] };
declare global { interface Window { __BYJTT_BABYLON_HAVOK__?: { snapshot:()=>Observation } } }

const state: Observation = { ready:false, player:{x:8,y:2,z:0}, velocity:{x:0,y:0,z:0}, eastWallContact:false, havokVersion:null, errors:[] };
const snapshot = (): Observation => structuredClone(state);
window.__BYJTT_BABYLON_HAVOK__ = { snapshot };

try {
  const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
  if (!canvas) throw new Error('render canvas missing');
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  const havok = await HavokPhysics();
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  state.havokVersion = plugin.getPluginVersion();

  new HemisphericLight('light', new Vector3(0,1,0), scene);
  const camera = new FreeCamera('camera', new Vector3(0,12,-20), scene); camera.setTarget(new Vector3(8,0,0));

  const floor = MeshBuilder.CreateBox('floor',{width:24,height:0.5,depth:32},scene); floor.position.y=-0.25;
  new PhysicsAggregate(floor, PhysicsShapeType.BOX,{mass:0,restitution:0,friction:0.8},scene);
  const wall = MeshBuilder.CreateBox('east-wall',{width:0.5,height:4,depth:32},scene); wall.position.set(12,2,0);
  new PhysicsAggregate(wall, PhysicsShapeType.BOX,{mass:0,restitution:0,friction:0.8},scene);

  const player = MeshBuilder.CreateBox('player',{width:0.7,height:1.7,depth:0.7},scene); player.position.set(8,2,0);
  const aggregate = new PhysicsAggregate(player, PhysicsShapeType.BOX,{mass:1,restitution:0,friction:0.2},scene);
  aggregate.body.setAngularVelocity(Vector3.Zero());
  const keys = new Set<string>();
  addEventListener('keydown', e=>keys.add(e.code)); addEventListener('keyup', e=>keys.delete(e.code));

  scene.onBeforePhysicsObservable.add(()=>{
    const current = aggregate.body.getLinearVelocity();
    const targetX = keys.has('KeyD') ? 3.5 : keys.has('KeyA') ? -3.5 : 0;
    aggregate.body.setLinearVelocity(new Vector3(targetX,current.y,0));
  });
  scene.onAfterPhysicsObservable.add(()=>{
    const v = aggregate.body.getLinearVelocity();
    state.player={x:player.position.x,y:player.position.y,z:player.position.z}; state.velocity={x:v.x,y:v.y,z:v.z};
    if (keys.has('KeyD') && player.position.x < 11.6 && player.position.x > 11.25 && Math.abs(v.x) < 0.25) state.eastWallContact=true;
  });
  state.ready=true;
  engine.runRenderLoop(()=>scene.render());
} catch (error) { state.errors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error)); }
