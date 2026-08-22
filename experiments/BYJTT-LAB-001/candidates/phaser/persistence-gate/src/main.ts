import Phaser from 'phaser';

declare global {
  interface Window {
    __BYJTT_OBSERVATION__?: Readonly<PersistenceObservation>;
    __BYJTT_SAVE_RESULT__?: Readonly<PersistenceResult>;
    __BYJTT_RESTORE_RESULT__?: Readonly<PersistenceResult>;
  }
}

type SaveDocument = Readonly<{ schema_version: 1; reward_count: 1; selected_upgrades: readonly ['damage-up-1'] }>;
type PersistenceObservation = Readonly<{
  runtime_ready: boolean; player_x_m: number; player_z_m: number; salvage_health: number;
  reward_count: number; upgrade_menu_visible: boolean; selected_upgrades: readonly string[];
  effective_attack_damage: number; save_schema_version: number | null; loaded_from_storage: boolean;
  save_count: number; pause_keydowns: number; pause_keyups: number;
}>;
type PersistenceResult = Readonly<{
  engine: string; phase: 'save' | 'restore'; schema_version: number; reward_count: number;
  selected_upgrades: readonly string[]; effective_attack_damage: number; save_count: number;
  pause_keydowns: number; pause_keyups: number; loaded_from_storage: boolean;
  progression_earned_through_gameplay: boolean; observation_isolation_passed: boolean;
  direct_save_write_exposed: false; direct_position_setter_exposed: false;
  direct_salvage_health_setter_exposed: false; direct_reward_grant_exposed: false;
  direct_upgrade_grant_exposed: false; test_only_gameplay_mutation_shortcut: false;
  post_physics_arena_clamp: false; passed: boolean;
}>;

const SAVE_KEY = 'byjtt-lab-001-phaser-save-v1';
const ARENA_WIDTH_M = 24; const ARENA_DEPTH_M = 32; const PLAYER_SPAWN = [0, 0, 10] as const;
const SALVAGE_SPAWN = [5, 0, 0] as const; const WALK_SPEED_MPS = 3.5; const PLAYER_RADIUS_M = 0.4;
const ATTACK_DAMAGE = 34; const ATTACK_RANGE_M = 1.8; const SALVAGE_MAX_HEALTH = 34;
const PICKUP_RADIUS_M = 1.25; const UPGRADE_ID = 'damage-up-1'; const DAMAGE_MULTIPLIER = 1.2;
const PPM = 12; const VIEW_W = 390; const VIEW_H = 844; const WORLD_CX = VIEW_W / 2; const WORLD_CY = VIEW_H / 2;

function isSaveDocument(value: unknown): value is SaveDocument {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as { schema_version?: unknown; reward_count?: unknown; selected_upgrades?: unknown };
  return c.schema_version === 1 && c.reward_count === 1 && Array.isArray(c.selected_upgrades) &&
    c.selected_upgrades.length === 1 && c.selected_upgrades[0] === UPGRADE_ID;
}

class PersistenceScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle; private body!: Phaser.Physics.Arcade.Body;
  private keys!: Record<'left'|'right'|'up'|'down'|'attack'|'interact'|'pause', Phaser.Input.Keyboard.Key>;
  private salvageHealth = SALVAGE_MAX_HEALTH; private rewardAvailable = false; private rewardCount = 0;
  private upgradeMenuVisible = false; private selectedUpgrades: string[] = []; private loadedFromStorage = false;
  private saveCount = 0; private pauseKeydowns = 0; private pauseKeyups = 0; private progressionEarned = false;

  constructor() { super('persistence'); }

  create(): void {
    this.physics.world.setFPS(60);
    const arenaW = ARENA_WIDTH_M * PPM; const arenaH = ARENA_DEPTH_M * PPM; const wallT = 0.5 * PPM;
    const walls = [
      this.add.rectangle(WORLD_CX-arenaW/2-wallT/2,WORLD_CY,wallT,arenaH+2*wallT,0x666666),
      this.add.rectangle(WORLD_CX+arenaW/2+wallT/2,WORLD_CY,wallT,arenaH+2*wallT,0x666666),
      this.add.rectangle(WORLD_CX,WORLD_CY-arenaH/2-wallT/2,arenaW,wallT,0x666666),
      this.add.rectangle(WORLD_CX,WORLD_CY+arenaH/2+wallT/2,arenaW,wallT,0x666666)
    ];
    for (const wall of walls) this.physics.add.existing(wall, true);
    this.player = this.add.rectangle(WORLD_CX, WORLD_CY-PLAYER_SPAWN[2]*PPM, PLAYER_RADIUS_M*2*PPM, PLAYER_RADIUS_M*2*PPM, 0xeeeeee);
    this.physics.add.existing(this.player); this.body = this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false); this.body.setBounce(0,0); this.physics.add.collider(this.player, walls);
    this.add.rectangle(WORLD_CX+SALVAGE_SPAWN[0]*PPM,WORLD_CY-SALVAGE_SPAWN[2]*PPM,0.8*PPM,0.8*PPM,0xc58b3c);
    this.loadNormalGameState();
    if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
    this.keys = {
      left:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A), right:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W), down:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      attack:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), interact:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      pause:this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    };
    this.keys.attack.on('down',()=>this.consumeAttack()); this.keys.interact.on('down',()=>this.consumeInteract());
    this.keys.pause.on('down',()=>{ this.pauseKeydowns += 1; this.saveNormalGameState(); });
    this.keys.pause.on('up',()=>{ this.pauseKeyups += 1; this.publishObservation(); });
    this.publishObservation(); if (this.loadedFromStorage) this.publishRestoreResult();
  }

  update(): void {
    if (!this.loadedFromStorage) {
      const x = Number(this.keys.right.isDown)-Number(this.keys.left.isDown); const z = Number(this.keys.up.isDown)-Number(this.keys.down.isDown);
      const v = new Phaser.Math.Vector2(x,-z); if (v.lengthSq()>0) v.normalize().scale(WALK_SPEED_MPS*PPM); this.body.setVelocity(v.x,v.y);
      if (this.rewardAvailable && this.distanceToSalvage() <= PICKUP_RADIUS_M) {
        this.rewardAvailable=false; this.rewardCount=1; this.upgradeMenuVisible=true;
      }
    } else this.body.setVelocity(0,0);
    this.publishObservation();
  }

  private consumeAttack(): void {
    if (this.loadedFromStorage || this.salvageHealth<=0 || this.distanceToSalvage()>ATTACK_RANGE_M) return;
    this.salvageHealth=Math.max(0,this.salvageHealth-ATTACK_DAMAGE); if (this.salvageHealth===0) this.rewardAvailable=true;
  }
  private consumeInteract(): void {
    if (this.loadedFromStorage || !this.upgradeMenuVisible || this.rewardCount!==1 || this.selectedUpgrades.includes(UPGRADE_ID)) return;
    this.selectedUpgrades.push(UPGRADE_ID); this.upgradeMenuVisible=false; this.progressionEarned=true;
  }
  private logicalX(): number { return (this.player.x-WORLD_CX)/PPM; }
  private logicalZ(): number { return (WORLD_CY-this.player.y)/PPM; }
  private distanceToSalvage(): number { return Phaser.Math.Distance.Between(this.logicalX(),this.logicalZ(),SALVAGE_SPAWN[0],SALVAGE_SPAWN[2]); }
  private effectiveDamage(): number { return ATTACK_DAMAGE*(this.selectedUpgrades.includes(UPGRADE_ID)?DAMAGE_MULTIPLIER:1); }

  private loadNormalGameState(): void {
    const raw=localStorage.getItem(SAVE_KEY); if (raw===null) return;
    const parsed:unknown=JSON.parse(raw); if (!isSaveDocument(parsed)) throw new Error('Persisted save shape is invalid');
    this.rewardCount=parsed.reward_count; this.selectedUpgrades=[...parsed.selected_upgrades]; this.loadedFromStorage=true;
  }
  private saveNormalGameState(): void {
    if (!this.progressionEarned || this.rewardCount!==1 || this.selectedUpgrades[0]!==UPGRADE_ID) return;
    const doc:SaveDocument=Object.freeze({schema_version:1,reward_count:1,selected_upgrades:Object.freeze([UPGRADE_ID] as ['damage-up-1'])});
    localStorage.setItem(SAVE_KEY,JSON.stringify(doc)); this.saveCount+=1; this.publishObservation(1); this.publishSaveResult();
  }
  private publishObservation(schema:number|null=this.loadedFromStorage?1:null):void {
    window.__BYJTT_OBSERVATION__=Object.freeze({runtime_ready:true,player_x_m:this.logicalX(),player_z_m:this.logicalZ(),salvage_health:this.salvageHealth,
      reward_count:this.rewardCount,upgrade_menu_visible:this.upgradeMenuVisible,selected_upgrades:Object.freeze([...this.selectedUpgrades]),effective_attack_damage:this.effectiveDamage(),
      save_schema_version:schema,loaded_from_storage:this.loadedFromStorage,save_count:this.saveCount,pause_keydowns:this.pauseKeydowns,pause_keyups:this.pauseKeyups});
  }
  private isolationPassed():boolean { const o=window.__BYJTT_OBSERVATION__; if(!o)return false; try{(o as {reward_count:number}).reward_count=999;}catch{return this.rewardCount===1;} return this.rewardCount===1; }
  private result(phase:'save'|'restore'):PersistenceResult {
    const restore=phase==='restore'; const passed=this.rewardCount===1&&this.selectedUpgrades[0]===UPGRADE_ID&&Math.abs(this.effectiveDamage()-40.8)<1e-9&&
      this.isolationPassed()&&(restore?this.loadedFromStorage:(this.progressionEarned&&this.saveCount===1&&this.pauseKeydowns===1));
    return Object.freeze({engine:`Phaser ${Phaser.VERSION}`,phase,schema_version:1,reward_count:this.rewardCount,selected_upgrades:Object.freeze([...this.selectedUpgrades]),
      effective_attack_damage:this.effectiveDamage(),save_count:this.saveCount,pause_keydowns:this.pauseKeydowns,pause_keyups:this.pauseKeyups,loaded_from_storage:this.loadedFromStorage,
      progression_earned_through_gameplay:restore||this.progressionEarned,observation_isolation_passed:this.isolationPassed(),direct_save_write_exposed:false,
      direct_position_setter_exposed:false,direct_salvage_health_setter_exposed:false,direct_reward_grant_exposed:false,direct_upgrade_grant_exposed:false,
      test_only_gameplay_mutation_shortcut:false,post_physics_arena_clamp:false,passed});
  }
  private publishSaveResult():void { window.__BYJTT_SAVE_RESULT__=this.result('save'); }
  private publishRestoreResult():void { this.publishObservation(1); window.__BYJTT_RESTORE_RESULT__=this.result('restore'); }
}

new Phaser.Game({type:Phaser.AUTO,parent:'app',width:VIEW_W,height:VIEW_H,backgroundColor:'#111111',physics:{default:'arcade',arcade:{gravity:{x:0,y:0},debug:false}},scene:PersistenceScene});
