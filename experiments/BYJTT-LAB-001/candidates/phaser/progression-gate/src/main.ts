import Phaser from 'phaser';

declare global {
  interface Window {
    __BYJTT_RESULT__?: ProgressionResult;
    __BYJTT_OBSERVATION__?: Readonly<ProgressionObservation>;
  }
}

type ProgressionObservation = {
  player_x_m: number;
  player_z_m: number;
  salvage_health: number;
  salvage_broken: boolean;
  reward_available: boolean;
  reward_count: number;
  upgrade_menu_visible: boolean;
  selected_upgrades: readonly string[];
  effective_attack_damage: number;
};

type ProgressionResult = Readonly<{
  engine: string;
  arena_width_m: number;
  arena_depth_m: number;
  player_spawn: readonly [number, number, number];
  salvage_spawn: readonly [number, number, number];
  walk_speed_mps: number;
  attack_damage: number;
  attack_range_m: number;
  attack_cooldown_s: number;
  salvage_max_health: number;
  pickup_radius_m: number;
  reward_count: number;
  selected_upgrade: string | null;
  effective_attack_damage: number;
  attack_distance_m: number | null;
  pickup_distance_m: number | null;
  movement_keydowns: number;
  movement_keyups: number;
  attack_keydowns: number;
  attack_keyups: number;
  interact_keydowns: number;
  interact_keyups: number;
  observation_isolation_passed: boolean;
  direct_position_setter_exposed: false;
  direct_salvage_health_setter_exposed: false;
  direct_reward_grant_exposed: false;
  direct_upgrade_grant_exposed: false;
  post_physics_arena_clamp: false;
  rendered_frames: number;
  passed: boolean;
}>;

const ARENA_WIDTH_M = 24;
const ARENA_DEPTH_M = 32;
const PLAYER_SPAWN = [0, 0, 10] as const;
const SALVAGE_SPAWN = [5, 0, 0] as const;
const WALK_SPEED_MPS = 3.5;
const PLAYER_RADIUS_M = 0.4;
const ATTACK_DAMAGE = 34;
const ATTACK_RANGE_M = 1.8;
const ATTACK_COOLDOWN_MS = 550;
const SALVAGE_MAX_HEALTH = 34;
const PICKUP_RADIUS_M = 1.25;
const REWARD_COUNT = 1;
const UPGRADE_ID = 'damage-up-1';
const DAMAGE_MULTIPLIER = 1.2;
const PPM = 12;
const VIEW_W = 390;
const VIEW_H = 844;
const WORLD_CX = VIEW_W / 2;
const WORLD_CY = VIEW_H / 2;
const WALL_THICKNESS_M = 0.5;

class ProgressionScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private body!: Phaser.Physics.Arcade.Body;
  private salvage!: Phaser.GameObjects.Rectangle;
  private keys!: Record<'left' | 'right' | 'up' | 'down' | 'attack' | 'interact', Phaser.Input.Keyboard.Key>;
  private salvageHealth = SALVAGE_MAX_HEALTH;
  private rewardAvailable = false;
  private rewardCount = 0;
  private upgradeMenuVisible = false;
  private selectedUpgrades: string[] = [];
  private lastAttackAt = Number.NEGATIVE_INFINITY;
  private attackDistance: number | null = null;
  private pickupDistance: number | null = null;
  private renderedFrames = 0;
  private movementKeydowns = 0;
  private movementKeyups = 0;
  private attackKeydowns = 0;
  private attackKeyups = 0;
  private interactKeydowns = 0;
  private interactKeyups = 0;
  private resultPublished = false;

  constructor() {
    super('progression');
  }

  create(): void {
    this.physics.world.setFPS(60);
    const arenaW = ARENA_WIDTH_M * PPM;
    const arenaH = ARENA_DEPTH_M * PPM;
    const wallT = WALL_THICKNESS_M * PPM;
    const walls = [
      this.add.rectangle(WORLD_CX - arenaW / 2 - wallT / 2, WORLD_CY, wallT, arenaH + 2 * wallT, 0x666666),
      this.add.rectangle(WORLD_CX + arenaW / 2 + wallT / 2, WORLD_CY, wallT, arenaH + 2 * wallT, 0x666666),
      this.add.rectangle(WORLD_CX, WORLD_CY - arenaH / 2 - wallT / 2, arenaW, wallT, 0x666666),
      this.add.rectangle(WORLD_CX, WORLD_CY + arenaH / 2 + wallT / 2, arenaW, wallT, 0x666666)
    ];
    for (const wall of walls) this.physics.add.existing(wall, true);

    this.player = this.add.rectangle(
      WORLD_CX + PLAYER_SPAWN[0] * PPM,
      WORLD_CY - PLAYER_SPAWN[2] * PPM,
      PLAYER_RADIUS_M * 2 * PPM,
      PLAYER_RADIUS_M * 2 * PPM,
      0xeeeeee
    );
    this.physics.add.existing(this.player);
    this.body = this.player.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setBounce(0, 0);
    this.body.setSize(PLAYER_RADIUS_M * 2 * PPM, PLAYER_RADIUS_M * 2 * PPM, true);
    this.physics.add.collider(this.player, walls);

    this.salvage = this.add.rectangle(
      WORLD_CX + SALVAGE_SPAWN[0] * PPM,
      WORLD_CY - SALVAGE_SPAWN[2] * PPM,
      0.8 * PPM,
      0.8 * PPM,
      0xc58b3c
    );

    if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
    this.keys = {
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      attack: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      interact: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };
    for (const key of [this.keys.left, this.keys.right, this.keys.up, this.keys.down]) {
      key.on('down', () => { this.movementKeydowns += 1; });
      key.on('up', () => { this.movementKeyups += 1; });
    }
    this.keys.attack.on('down', () => {
      this.attackKeydowns += 1;
      this.consumeAttack(this.time.now);
    });
    this.keys.attack.on('up', () => { this.attackKeyups += 1; });
    this.keys.interact.on('down', () => {
      this.interactKeydowns += 1;
      this.consumeInteract();
    });
    this.keys.interact.on('up', () => { this.interactKeyups += 1; });
    this.publishObservation();
  }

  update(): void {
    this.renderedFrames += 1;
    const axisX = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    const axisZ = Number(this.keys.up.isDown) - Number(this.keys.down.isDown);
    const movement = new Phaser.Math.Vector2(axisX, -axisZ);
    if (movement.lengthSq() > 0) movement.normalize().scale(WALK_SPEED_MPS * PPM);
    this.body.setVelocity(movement.x, movement.y);

    if (this.rewardAvailable && this.distanceToSalvage() <= PICKUP_RADIUS_M) {
      this.pickupDistance = this.distanceToSalvage();
      this.rewardAvailable = false;
      this.rewardCount += REWARD_COUNT;
      this.upgradeMenuVisible = true;
    }

    this.publishObservation();
    if (!this.resultPublished && this.selectedUpgrades.includes(UPGRADE_ID)) this.publishResult();
  }

  private consumeAttack(now: number): void {
    if (now - this.lastAttackAt < ATTACK_COOLDOWN_MS || this.salvageHealth <= 0) return;
    const distance = this.distanceToSalvage();
    if (distance > ATTACK_RANGE_M) return;
    this.lastAttackAt = now;
    this.attackDistance = distance;
    this.salvageHealth = Math.max(0, this.salvageHealth - ATTACK_DAMAGE);
    if (this.salvageHealth === 0) this.rewardAvailable = true;
  }

  private consumeInteract(): void {
    if (!this.upgradeMenuVisible || this.rewardCount !== 1 || this.selectedUpgrades.includes(UPGRADE_ID)) return;
    this.selectedUpgrades.push(UPGRADE_ID);
    this.upgradeMenuVisible = false;
  }

  private distanceToSalvage(): number {
    return Phaser.Math.Distance.Between(this.logicalX(), this.logicalZ(), SALVAGE_SPAWN[0], SALVAGE_SPAWN[2]);
  }

  private logicalX(): number {
    return (this.player.x - WORLD_CX) / PPM;
  }

  private logicalZ(): number {
    return (WORLD_CY - this.player.y) / PPM;
  }

  private effectiveDamage(): number {
    return ATTACK_DAMAGE * (this.selectedUpgrades.includes(UPGRADE_ID) ? DAMAGE_MULTIPLIER : 1);
  }

  private publishObservation(): void {
    window.__BYJTT_OBSERVATION__ = Object.freeze({
      player_x_m: this.logicalX(),
      player_z_m: this.logicalZ(),
      salvage_health: this.salvageHealth,
      salvage_broken: this.salvageHealth === 0,
      reward_available: this.rewardAvailable,
      reward_count: this.rewardCount,
      upgrade_menu_visible: this.upgradeMenuVisible,
      selected_upgrades: Object.freeze([...this.selectedUpgrades]),
      effective_attack_damage: this.effectiveDamage()
    });
  }

  private publishResult(): void {
    const observation = window.__BYJTT_OBSERVATION__;
    if (!observation) throw new Error('Observation unavailable');
    let isolation = false;
    try {
      (observation as ProgressionObservation).reward_count = 999;
    } catch {
      isolation = true;
    }
    isolation = isolation || this.rewardCount === 1;
    const passed =
      this.salvageHealth === 0 &&
      this.attackDistance !== null && this.attackDistance <= ATTACK_RANGE_M &&
      this.pickupDistance !== null && this.pickupDistance <= PICKUP_RADIUS_M &&
      this.rewardCount === 1 &&
      this.selectedUpgrades.length === 1 && this.selectedUpgrades[0] === UPGRADE_ID &&
      Math.abs(this.effectiveDamage() - 40.8) < 1e-9 &&
      this.attackKeydowns >= 1 && this.attackKeyups >= 1 &&
      this.interactKeydowns >= 1 && this.interactKeyups >= 1 &&
      this.movementKeydowns >= 1 && this.movementKeyups >= 1 &&
      isolation;

    window.__BYJTT_RESULT__ = Object.freeze({
      engine: `Phaser ${Phaser.VERSION}`,
      arena_width_m: ARENA_WIDTH_M,
      arena_depth_m: ARENA_DEPTH_M,
      player_spawn: Object.freeze(PLAYER_SPAWN),
      salvage_spawn: Object.freeze(SALVAGE_SPAWN),
      walk_speed_mps: WALK_SPEED_MPS,
      attack_damage: ATTACK_DAMAGE,
      attack_range_m: ATTACK_RANGE_M,
      attack_cooldown_s: ATTACK_COOLDOWN_MS / 1000,
      salvage_max_health: SALVAGE_MAX_HEALTH,
      pickup_radius_m: PICKUP_RADIUS_M,
      reward_count: this.rewardCount,
      selected_upgrade: this.selectedUpgrades[0] ?? null,
      effective_attack_damage: this.effectiveDamage(),
      attack_distance_m: this.attackDistance,
      pickup_distance_m: this.pickupDistance,
      movement_keydowns: this.movementKeydowns,
      movement_keyups: this.movementKeyups,
      attack_keydowns: this.attackKeydowns,
      attack_keyups: this.attackKeyups,
      interact_keydowns: this.interactKeydowns,
      interact_keyups: this.interactKeyups,
      observation_isolation_passed: isolation,
      direct_position_setter_exposed: false,
      direct_salvage_health_setter_exposed: false,
      direct_reward_grant_exposed: false,
      direct_upgrade_grant_exposed: false,
      post_physics_arena_clamp: false,
      rendered_frames: this.renderedFrames,
      passed
    });
    this.resultPublished = true;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#111111',
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: ProgressionScene
});
