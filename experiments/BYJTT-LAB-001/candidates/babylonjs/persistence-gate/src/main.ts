import { ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';

type SaveData = { schema_version: 1; reward_count: number; selected_upgrades: string[] };
type Observation = Readonly<{ ready:boolean; loadedFromDisk:boolean; player:{x:number;z:number}; salvageHealth:number; salvageBroken:boolean; rewardCount:number; selectedUpgrades:string[]; effectiveDamage:number; attackPresses:number; interactPresses:number; savePresses:number; successfulSaves:number; attackExecuted:boolean; interactExecuted:boolean; saveExecuted:boolean; pickupDistance:number|null; attackDistance:number|null; renderedFrames:number; failures:string[] }>;
declare global { interface Window { __BYJTT_PERSIST__?: () => Observation } }

const WALK_SPEED=3.5, ATTACK_DAMAGE=34, ATTACK_RANGE=1.8, SALVAGE_HEALTH=34, PICKUP_RADIUS=1.25, DAMAGE_MULTIPLIER=1.2;
const UPGRADE_ID='damage-up-1', SAVE_KEY='byjtt-lab-001-babylon-save';
const canvas=document.querySelector<HTMLCanvasElement>('#app'); const status=document.querySelector<HTMLDivElement>('#status'); if(!canvas||!status) throw new Error('required DOM missing');
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}); const scene=new Scene(engine); scene.clearColor=new Color4(.035,.045,.06,1);
new HemisphericLight('light',new Vector3(0,1,0),scene).intensity=1.2; const camera=new ArcRotateCamera('camera',-Math.PI/2,1,24,new Vector3(2.5,0,4),scene); camera.attachControl(canvas,false);
const ground=MeshBuilder.CreateGround('arena',{width:24,height:32},scene); const gm=new StandardMaterial('gm',scene); gm.diffuseColor=new Color3(.16,.2,.17); ground.material=gm;
const player=MeshBuilder.CreateCapsule('player',{height:1.8,radius:.4},scene); player.position.set(0,.9,10);
const salvage=MeshBuilder.CreateBox('salvage',{size:1},scene); salvage.position.set(5,.5,0);
const held=new Set<string>(); let attackEdge=false, interactEdge=false, saveEdge=false; let salvageHealth=SALVAGE_HEALTH, salvageBroken=false, rewardCount=0, selectedUpgrades:string[]=[];
let attackPresses=0,interactPresses=0,savePresses=0,successfulSaves=0,attackExecuted=false,interactExecuted=false,saveExecuted=false,pickupDistance:number|null=null,attackDistance:number|null=null,renderedFrames=0; const failures:string[]=[];
let loadedFromDisk=false; try { const raw=localStorage.getItem(SAVE_KEY); if(raw){ const parsed=JSON.parse(raw) as SaveData; if(parsed.schema_version===1){rewardCount=parsed.reward_count;selectedUpgrades=[...parsed.selected_upgrades];loadedFromDisk=true;}} } catch(e){failures.push(`load:${String(e)}`);}
const distance=()=>Math.hypot(player.position.x-5,player.position.z);
addEventListener('keydown',e=>{if(e.repeat)return;held.add(e.code);if(e.code==='Space'){attackPresses++;attackEdge=true;}if(e.code==='KeyE'){interactPresses++;interactEdge=true;}if(e.code==='KeyP'){savePresses++;saveEdge=true;}}); addEventListener('keyup',e=>held.delete(e.code)); addEventListener('blur',()=>held.clear());
function update(dt:number){ const move=new Vector3((held.has('KeyD')?1:0)-(held.has('KeyA')?1:0),0,(held.has('KeyS')?1:0)-(held.has('KeyW')?1:0)); if(move.lengthSquared()>0){move.normalize().scaleInPlace(WALK_SPEED*dt);player.position.addInPlace(move);} const d=distance();
if(attackEdge){attackEdge=false;if(!salvageBroken&&d<=ATTACK_RANGE){attackExecuted=true;attackDistance=d;salvageHealth=Math.max(0,salvageHealth-ATTACK_DAMAGE);if(salvageHealth===0){salvageBroken=true;salvage.setEnabled(false);}}}
if(salvageBroken&&rewardCount===0&&d<=PICKUP_RADIUS){rewardCount=1;pickupDistance=d;}
if(interactEdge){interactEdge=false;if(rewardCount===1&&!selectedUpgrades.includes(UPGRADE_ID)){interactExecuted=true;selectedUpgrades=[UPGRADE_ID];}}
if(saveEdge){saveEdge=false;saveExecuted=true;try{const data:SaveData={schema_version:1,reward_count:rewardCount,selected_upgrades:[...selectedUpgrades]};localStorage.setItem(SAVE_KEY,JSON.stringify(data));successfulSaves++;}catch(e){failures.push(`save:${String(e)}`);}} }
function observe():Observation{return Object.freeze({ready:true,loadedFromDisk,player:{x:player.position.x,z:player.position.z},salvageHealth,salvageBroken,rewardCount,selectedUpgrades:[...selectedUpgrades],effectiveDamage:ATTACK_DAMAGE*(selectedUpgrades.includes(UPGRADE_ID)?DAMAGE_MULTIPLIER:1),attackPresses,interactPresses,savePresses,successfulSaves,attackExecuted,interactExecuted,saveExecuted,pickupDistance,attackDistance,renderedFrames,failures:[...failures]});}
window.__BYJTT_PERSIST__=observe; engine.runRenderLoop(()=>{update(Math.min(engine.getDeltaTime()/1000,1/30));scene.render();renderedFrames++;const o=observe();status.textContent=`reward ${o.rewardCount} upgrade ${o.selectedUpgrades.join(',')||'none'} loaded ${o.loadedFromDisk}`;}); addEventListener('resize',()=>engine.resize());
